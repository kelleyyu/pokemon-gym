/* =========================================================
   PW · 训练奖励（星星商店 / 金币商店 / 盲盒）
   ========================================================= */
PW.viewRewards = (function () {
  const U = PW.util;
  let tab = 'shop';  // 默认显示金币商店
  let showLog = false;  // 兑换记录展开状态
  let redeemLogPage = 0;  // 兑换记录分页
  const REDEEM_LOG_PER_PAGE = 10;

  function render() {
    const st = PW.store.state;

    const tabs = [['shop', '🛍️ 金币商店'], ['cash', '⭐ 星星商店']]
      .map((t) => '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>').join('');

    let screen;
    if (tab === 'cash') screen = cashScreen();
    else screen = shopScreen();

    return '<div class="chips" style="margin-bottom:14px">' + tabs + '</div>' + screen;
  }

  /* ---------------- 星星商店（兑换零花钱） ---------------- */
  function cashScreen() {
    const st = PW.store.state;
    const cards = PW.shop.getCashProducts().map((it) => {
      const ribbon = it.id === 'cash60' ? '<span class="ribbon best">最划算</span>'
        : (it.tip ? '<span class="ribbon">推荐</span>' : '');
      const afford = st.wallet.stars >= it.stars;
      return '<div class="shop-card">' + ribbon +
        '<div class="s-ico">' + it.icon + '</div><b>' + it.name + '</b>' +
        '<div class="s-desc">' + (it.desc || (it.cash ? it.cash + ' 元' : '攒星星换零花钱')) + '</div>' +
        '<div class="s-price"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg> ' + it.stars + ' 星</div>' +
        '<button class="btn btn-block ' + (afford ? 'btn-primary' : 'btn-ghost') + '" data-cash="' + it.id + '"' +
        (afford ? '' : ' disabled') + '>' + (afford ? '兑换' : '不够') + '</button></div>';
    }).join('');

    /* 兑换记录（分页，每页10条） */
    const log = (PW.store.getRedeemLog || function(){return[];})();
    const totalLogPages = Math.max(1, Math.ceil(log.length / REDEEM_LOG_PER_PAGE));
    if (redeemLogPage >= totalLogPages) redeemLogPage = totalLogPages - 1;
    const logStart = redeemLogPage * REDEEM_LOG_PER_PAGE;
    const pageLog = log.slice().reverse().slice(logStart, logStart + REDEEM_LOG_PER_PAGE);
    const logHtml = pageLog.length
      ? pageLog.map((r) =>
          '<div class="log-row"><div class="log-ico">' + (r.icon || '💴') + '</div>' +
          '<div class="log-main"><b>' + U.esc(r.name) + '</b>' +
          '<span class="small muted">' + (r.time || '') + ' ' + ((r.cost || 0) < 0 ? '扣罚' : '兑换') + ' · ' + Math.abs(r.cost || 0) + ' 星</span></div></div>'
        ).join('')
      : '<p class="small muted" style="margin-top:8px">还没有兑换记录哦～</p>';

    const logPageNav = totalLogPages > 1
      ? '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px">' +
        '<button class="btn btn-ghost btn-sm" id="logPrev"' + (redeemLogPage <= 0 ? ' disabled' : '') + '>◀</button>' +
        '<span class="small" style="font-weight:700;color:var(--ink-2);min-width:70px;text-align:center">' + (redeemLogPage + 1) + '/' + totalLogPages + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="logNext"' + (redeemLogPage >= totalLogPages - 1 ? ' disabled' : '') + '>▶</button>' +
        '</div>'
      : '';

    const logSection = '<div class="card" style="margin-top:16px;border-color:#f0e6d2;background:#fffbf0"><div class="card-h" style="cursor:pointer" id="toggleRedeemLog">' +
      '<h3>📋 兑换记录</h3><span class="sub">查看历史兑换（' + log.length + ' 条）</span></div>' +
      '<div id="redeemLogBody" style="' + (showLog ? '' : 'display:none') + '">' + logHtml + logPageNav + '</div></div>';

    /* 我要许愿（与家长沟通后自定义兑换） */
    const wishCard = '<div class="shop-card" style="background:linear-gradient(180deg,#fff5f0,#fff);border-color:#ffd4b8">' +
      '<div class="s-ico" style="font-size:34px">🌟</div><b>我要许愿</b>' +
      '<div class="s-desc">和家长商量好愿望后，输入想用的星星数量来兑换～</div>' +
      '<button class="btn btn-block btn-primary" id="wishBtn">去许愿 ✨</button></div>';

    return '<div class="shop-grid">' + cards + wishCard + '</div>' +
      '<p class="hint center">凭兑换记录联系家长兑现 📝</p>' +
      logSection;
  }

  /* ---------------- 金币商店（消耗品+精灵球按价格排序 → 盲盒 → 兑换星星最后） ---------------- */
  function shopScreen() {
    const st = PW.store.state;
    const inv = st.pet.inventory;
    /* 精灵球每日购买状态 */
    const pokeStatus = PW.store.getPokeballDailyStatus();
    const blindBoxToday = PW.store.getBlindBoxDailyCount();
    const blindBoxLimit = PW.shop.BLIND_BOX_DAILY_LIMIT || 6;

    function itemCard(c) {
      const afford = st.wallet.coins >= c.coins;
      const have = inv[c.id] || 0;
      return '<div class="shop-card">' +
        '<div class="s-ico">' + c.icon + '</div><b>' + c.name + '</b>' +
        '<div class="s-desc">' + c.desc + '<br>已拥有 ' + have + '</div>' +
        '<div class="s-price"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + c.coins + '</div>' +
        '<button class="btn btn-block ' + (afford ? 'btn-green' : 'btn-ghost') + '" data-buy="' + c.id + '"' +
        (afford ? '' : ' disabled') + '>购买</button></div>';
    }

    /* 精灵球卡片 */
    function pokeballCard(pb) {
      const afford = st.wallet.coins >= pb.coins;
      const boughtToday = (pokeStatus[pb.id] || 0);
      const canBuy = afford && boughtToday < 1;
      return '<div class="shop-card" style="background:linear-gradient(180deg,#f8f3ff,#fff);border-color:#e0d4ff">' +
        '<div class="s-ico" style="font-size:36px">' + pb.icon + '</div><b>' + pb.name + '</b>' +
        '<div class="s-desc">' + pb.desc + '<br><span style="color:var(--pk-red);font-weight:800">今日已购 ' + boughtToday + '/1 次</span></div>' +
        '<div class="s-price"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + pb.coins + '</div>' +
        '<button class="btn btn-block ' + (canBuy ? 'btn-primary' : 'btn-ghost') + '" data-pokeball="' + pb.id + '"' +
        (canBuy ? '' : ' disabled') + '>' + (boughtToday >= 1 ? '明日再来' : (afford ? '购买' : '不够')) + '</button></div>';
    }

    /* 盲盒卡片（固定在高级球之后） */
    const boxCost = st.config.blindBoxCost || PW.shop.BOX_COST_DEFAULT;
    const boxAfford = st.wallet.coins >= boxCost && blindBoxToday < blindBoxLimit;
    const boxCard = '<div class="shop-card" style="background:linear-gradient(180deg,#fbf3ff,#fff);border-color:#ecdcff">' +
      '<div class="s-ico" style="font-size:36px">🎁</div><b>神秘盲盒</b>' +
      '<div class="s-desc">可能抽中初级宝可梦/道具/金币/星星<br><span style="color:var(--pk-red);font-weight:800">今日已抽 ' + blindBoxToday + '/' + blindBoxLimit + ' 次</span></div>' +
      '<div class="s-price"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + boxCost + '</div>' +
      '<button class="btn btn-block ' + (boxAfford ? 'btn-primary' : 'btn-ghost') + '" id="drawBox"' +
      (boxAfford ? '' : ' disabled') + '>' + (blindBoxToday >= blindBoxLimit ? '今日已满' : '抽一次') + '</button></div>';

    /* 兑换星星卡片（固定放最后） */
    const exchangeRate = 10;
    const exchangeCard = '<div class="shop-card" style="background:linear-gradient(180deg,#fff8e0,#fff);border-color:#ffd54f">' +
      '<div class="s-ico" style="font-size:36px">⭐</div><b>兑换星星</b>' +
      '<div class="s-desc">1 颗星星 = ' + exchangeRate + ' 金币</div>' +
      '<div style="text-align:center;margin:4px 0 0">' +
      '<input class="input" id="exchangeStarsInput" type="number" min="1" value="1" style="max-width:80px;text-align:center;font-weight:700;font-size:16px;color:#e08600;padding:8px 10px">' +
      '<span class="small muted" style="white-space:nowrap">颗</span></div>' +
      '<div class="s-price" style="text-align:center;display:inline-flex;align-items:center;justify-content:center;gap:4px"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> <b id="exchangeCostNum">' + exchangeRate + '</b></div>' +
      '<button class="btn btn-block btn-primary" id="exchangeStarsBtn"' + (st.wallet.coins >= exchangeRate ? '' : ' disabled') + '>兑换</button></div>';

    /* 消耗品 + 精灵球按价格从低到高排序；盲盒和兑换星星不参与排序，固定位置 */
    const sorted = [];
    PW.shop.CONSUMABLE.forEach((c) => sorted.push({ coins: c.coins, html: itemCard(c) }));
    PW.shop.POKEBALLS.forEach((p) => sorted.push({ coins: p.coins, html: pokeballCard(p) }));
    sorted.sort((a, b) => a.coins - b.coins);

    return '<div class="shop-grid">' + sorted.map((x) => x.html).join('') + boxCard + exchangeCard + '</div>';
  }

  /* ---------------- 交互 ---------------- */
  function mount(root) {
    U.$$('[data-tab]', root).forEach((c) => {
      c.onclick = () => { tab = c.dataset.tab; PW.app.rerender(); };
    });
    U.$$('[data-cash]', root).forEach((b) => {
      b.onclick = () => {
        const it = PW.shop.getCashProducts().find((x) => x.id === b.dataset.cash);
        const r = PW.store.redeem(it, 'cash');
        if (!r.ok) { U.toast(r.msg, 'warn'); return; }
        /* 记录兑换日志 */
        if (PW.store.addRedeemLog) {
          PW.store.addRedeemLog({ name: it.name, icon: it.icon, cash: it.cash, cost: it.stars });
        }
        U.toast('兑换成功！' + it.name + '，凭记录联系家长兑现～', 'good');
        PW.app.rerender();
      };
    });
    U.$$('[data-buy]', root).forEach((b) => {
      b.onclick = () => {
        const r = PW.store.buyConsumable(b.dataset.buy, 1);
        if (!r.ok) { U.toast(r.msg, 'warn'); return; }
        U.toast('购买成功！去宠物之家照顾它吧～', 'good');
        PW.app.rerender();
      };
    });
    /* 精灵球购买 */
    U.$$('[data-pokeball]', root).forEach((b) => {
      b.onclick = () => {
        const r = PW.store.buyPokeball(b.dataset.pokeball);
        if (!r.ok) { U.toast(r.msg, 'warn'); return; }
        const pbDef = PW.shop.POKEBALL_MAP[b.dataset.pokeball];
        const pname = PW.pokemon.name(r.pokemonId);
        if (r.duplicate) {
          U.toast('使用' + pbDef.name + '获得了 ' + pname + '（已拥有）', 'good');
        } else {
          U.confetti(60);
          U.modal({
            title: '🎉 捕获成功！',
            body: '<div class="center" style="padding:8px 0">' +
              '<div style="font-size:50px">' + (pbDef.icon || '🎉') + '</div>' +
              '<p style="font-size:16px;margin:10px 0">使用 <b>' + pbDef.name + '</b> 捕获了</p>' +
              '<div style="font-size:28px;margin:6px 0">' + PW.pokemon.render(r.pokemonId, []) + '</div>' +
              '<p style="font-size:15px"><b>' + pname + '</b>！</p></div>',
            ops: [{ text: '太棒了', cls: 'btn-primary', onClick: (c) => { c(); U.confetti(30); } }]
          });
        }
        PW.app.rerender();
      };
    });
    const box = U.$('#drawBox', root);
    if (box) box.onclick = () => {
      const r = PW.store.drawBlindBox();
      if (!r.ok) { U.toast(r.msg, 'warn'); return; }
      showBoxResult(r.result);
      PW.app.rerender();
    };

    /* 兑换星星（金币→星星） */
    const exInput = U.$('#exchangeStarsInput', root);
    const exBtn = U.$('#exchangeStarsBtn', root);
    const exCostNum = U.$('#exchangeCostNum', root);
    function updateExchangeCost() {
      if (!exInput || !exCostNum) return;
      var n = Math.max(1, parseInt(exInput.value, 10) || 1);
      var cost = n * 10;
      exCostNum.textContent = cost;
      if (exBtn) exBtn.disabled = PW.store.state.wallet.coins < cost;
    }
    if (exInput) { exInput.oninput = updateExchangeCost; }
    if (exBtn) exBtn.onclick = () => {
      var n = Math.max(1, parseInt(exInput.value, 10) || 1);
      var cost = n * 10;
      if (PW.store.state.wallet.coins < cost) { U.toast('金币不够哦，需要 ' + cost + ' 金币', 'warn'); return; }
      U.confirmBox(
        '确认兑换？',
        '花费 <b>' + cost + ' 金币</b> 兑换 <b>' + n + ' 颗星星</b>',
        '确认兑换',
        function() {
          /* 只扣金币，再用 award 增加星星；旧逻辑 spend(cost, n) 会同时扣减星星，导致越换越少 */
          PW.store.spend(cost, 0, '金币兑换' + n + '颗星星');
          PW.store.award(0, n, '金币兑换' + n + '颗星星');
          U.toast('✅ 兑换成功！获得 ' + n + ' 颗 ⭐', 'good');
          PW.app.rerender();
        }
      );
    };

    /* 兑换记录折叠 */
    const logToggle = U.$('#toggleRedeemLog', root);
    if (logToggle) logToggle.onclick = () => { showLog = !showLog; PW.app.rerender(); };

    /* 兑换记录分页 */
    const logPrev = U.$('#logPrev', root);
    const logNext = U.$('#logNext', root);
    if (logPrev) logPrev.onclick = () => { redeemLogPage--; PW.app.rerender(); };
    if (logNext) logNext.onclick = () => { redeemLogPage++; PW.app.rerender(); };

    /* 我要许愿 */
    const wishBtn = U.$('#wishBtn', root);
    if (wishBtn) wishBtn.onclick = () => {
      const st = PW.store.state;
      U.modal({
        title: '🌟 我要许愿',
        sub: '和家长商量好愿望后，输入想用的星星数量',
        body: '<div class="field"><label>你的愿望是什么？</label>' +
          '<input class="input" id="wishText" placeholder="例如：想去游乐园 / 想要一套新画笔" style="max-width:100%"></div>' +
          '<div class="field"><label>愿意用多少星星兑换？</label>' +
          '<div class="row" style="gap:8px">' +
          '<input class="input" id="wishStars" type="number" min="1" value="25" style="max-width:120px;flex:1;text-align:center;font-size:18px;font-weight:700;color:#e08600">' +
          '<span class="small muted" style="align-self:center">⭐ 星星</span></div>' +
          '<p class="hint">提交后请找家长确认，家长同意后即可兑现愿望～</p>',
        ops: [
          { text: '取消', cls: 'btn-ghost' },
          { text: '提交许愿', cls: 'btn-primary', onClick: (c, card) => {
            const text = U.$('#wishText', card).value.trim();
            const stars = Math.max(1, parseInt(U.$('#wishStars', card).value, 10) || 25);
            if (!text) { U.toast('写一下你的愿望吧', 'warn'); return; }
            if (stars > st.wallet.stars) { U.toast('星星不够哦，当前只有 ' + st.wallet.stars + ' 颗', 'warn'); return; }
            /* 扣星星 + 记录 */
            PW.store.spend(0, stars, '许愿：' + text);
            if (PW.store.addRedeemLog) {
              PW.store.addRedeemLog({ name: '🌟 许愿：' + text, icon: '🌟', cash: 0, cost: stars });
            }
            c();
            U.confetti(40);
            U.toast('许愿成功！快去找家长确认吧～', 'good');
            PW.app.rerender();
          }}
        ]
      });
    };
  }

  function showBoxResult(res) {
    const icon = res.type === 'coins' ? PW.COIN_SVG_LG : (res.type === 'pokemon' ? '🎉' : (res.type === 'stars' ? '⭐' : (res.icon || '🎁')));
    let line;
    if (res.type === 'pokemon') line = '获得了新伙伴：<b>' + res.name + '</b>！';
    else if (res.type === 'stars') line = '获得了 <b>' + res.amount + ' 颗星星</b>！';
    else if (res.type === 'consumable') line = '获得了：<b>' + res.name + '</b>！';
    else line = '获得了：<b>' + res.name + '</b>！';
    U.modal({
      title: '🎉 开盲盒啦！',
      body: '<div class="center" style="padding:8px 0">' +
        '<div style="font-size:60px">' + icon + '</div>' +
        '<p style="font-size:16px;margin:10px 0">' + line + '</p>' +
        '<p class="small muted">稀有度：' + (res.rarity || 'R') + '</p></div>',
      ops: [{ text: '太棒了', cls: 'btn-primary', onClick: (c) => { c(); U.confetti(50); } }]
    });

  }

  return { title: '训练奖励', sub: '努力就有回报，来看看训练家奖励！', render, mount };
})();
