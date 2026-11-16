/* =========================================================
   PW · 宠物之家（照顾 / 进化 / 图鉴）
   ========================================================= */
PW.viewPet = (function () {
  const U = PW.util;
  var dexPage = 0;
  var DEX_PER_PAGE = 24;

  /* 根据总数量动态计算每页数量，确保最后一页不留空位（每页不超过24个） */
  function getDexPerPage(total) {
    /* 尝试每行4/3列，找能整除的最近值，上限24 */
    var cols = window.innerWidth <= 420 ? 4 : (window.innerWidth <= 600 ? 5 : 6);
    var rows = 4; /* 固定4行，每页最多24只 */
    var perPage = cols * rows;
    /* 如果总数少于perPage，用能整除的最近值 */
    if (total > 0 && total < perPage) {
      perPage = Math.ceil(total / cols) * cols;
      if (perPage > cols * rows) perPage = cols * rows;
    }
    return Math.max(cols, Math.min(perPage, total || DEX_PER_PAGE));
  }

  /* 宠物互动对话库 */
  const PET_LINES = [
    '训练家，今天也要加油哦！✨', '我肚子饿了…能喂我点好吃的吗？🍎',
    '嘿嘿，我觉得我又变强了一点！💪', '今天的阳光真好呀～要不要出去走走？☀️',
    '训练家你最好了！我最喜欢你了！❤️', '我想去冒险！什么时候再去闯关？⚔️',
    '呼…洗个澡好舒服啊～🧼', '咕嘟咕嘟～水真好喝！💧',
    '我们一起成为最强的搭档吧！🏆',
    '今天完成了好多任务呢，真棒！🌟', '我想进化了…再陪我多练习一下吧！🌱',
    '训练家笑起来最好看了！😊', '我准备好迎接任何挑战！🔥'
  ];

  function render() {
    const st = PW.store.state;
    const active = st.pet.active;
    if (!active) {
      return '<div class="card center" style="margin-top:16px"><div style="font-size:48px">🥚</div>' +
        '<h3>还没有伙伴</h3><p class="small muted">去"今日任务"完成首步引导，或重新进入即可领取初始宝可梦。</p></div>';
    }
    const pet = st.pet.owned[active];
    const def = PW.pokemon.get(active);
    const care = PW.store.petCareToday();
    const inv = st.pet.inventory;
    const nickname = pet.nickname || '';

    /* 宠物舞台（用户上传的森林小屋背景图） */
    const stageNum = pet.stage + 1;
    const need = PW.pokemon.nextThreshold(pet.stage);
    const growthPct = need ? Math.min(100, Math.round((pet.growth / need) * 100)) : 100;
    const canEv = PW.store.canEvolve(active);

    const stage =
      '<div class="pet-stage-3d" style="background-image:url(\'img/pet-bg.jpg\')">' +
      /* 宝可梦（可点击互动，居中显示在背景图上） */
      '<div class="pet-canvas" id="petCanvas" title="点击和' + U.esc(def.name) + '说话">' + PW.pokemon.render(active, []) + '</div>' +
      '<div class="pet-name">' + def.name + (nickname ? '（' + U.esc(nickname) + '）' : '') + '</div>' +
      '<div class="pet-lvl">第 ' + stageNum + ' 形态 · 成长值 ' + pet.growth + (need ? ' / ' + need : '（最终形态）') + '</div>' +
      (need ? '<div class="progress" style="max-width:320px;margin:10px auto 0;height:9px"><i style="width:' + growthPct + '%"></i></div>' : '') +
      (canEv ? '<button class="btn btn-primary btn-sm" id="evolveBtn" style="margin-top:12px">✨ 进化！</button>' : '') +
      '</div>';

    /* 照顾按钮（已进化出后代的旧形态不可再照顾，按钮置灰提示） */
    const careBlocked = PW.store.hasEvolvedChild(active);
    const careRow = '<div class="care-row">' +
      careBtn('food', '🍎', '喂食', '点击选择道具', care.food, invCount('food'), careBlocked) +
      careBtn('water', '💧', '喝水', '点击选择道具', care.water, invCount('water'), careBlocked) +
      careBtn('bath', '🧼', '洗澡', '点击选择道具', care.bath, invCount('bath'), careBlocked) +
      '</div>' +
      (careBlocked ? '<p class="small muted" style="margin:8px 0 0">它已经进化成新形态啦，去“宠物之家/AI助手”切换到进化后的伙伴照顾吧～</p>' : '');

    const careCard = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>🤲 照顾宝可梦</h3>' +
      '<span class="sub">每天可照顾3只，优先使用高级道具</span></div>' + careRow +
      '<p class="small muted" style="margin:12px 0 0">库存：' + fullInventory(inv) + '</p></div>';

    /* 图鉴（分页）：已解锁排前面按编号顺序，未解锁排后面也按编号顺序，填满每页 */
    const allDex = PW.pokemon.DEX;
    const st2 = PW.store.state;
    /* 拆分为已解锁 + 未解锁，各自保持原始编号顺序 */
    const unlockedDex = allDex.filter((p) => st2.pet.dexUnlocked.indexOf(p.id) >= 0);
    const lockedDex = allDex.filter((p) => st2.pet.dexUnlocked.indexOf(p.id) < 0);
    /* 合并：解锁的在前，未解锁在后 */
    const orderedDex = unlockedDex.concat(lockedDex);
    const totalDex = orderedDex.length;
    const dpp = getDexPerPage(totalDex);
    const totalPages = Math.max(1, Math.ceil(totalDex / dpp));
    if (dexPage >= totalPages) dexPage = totalPages - 1;
    const startIdx = dexPage * dpp;
    const pageDex = orderedDex.slice(startIdx, startIdx + dpp);

    const dex = pageDex.map((p) => {
      const unlocked = st.pet.dexUnlocked.indexOf(p.id) >= 0;
      const isActive = p.id === active;
      const ownedPet = st.pet.owned[p.id];
      const stageTag = ownedPet ? 'Lv' + (ownedPet.stage + 1) : '';
      /* 已进化出后代的（如皮卡丘→雷丘）：图鉴仍点亮，标注「已进化」，可继续作为伙伴切换 */
      const hasChild = Object.keys(st.pet.owned).some(function (k) {
        var op = st.pet.owned[k]; return op && op.evolvedFrom === p.id;
      });
      const evoTag = (hasChild && ownedPet) ? ' · 已进化' : '';
      return '<div class="dex-cell ' + (unlocked ? '' : 'lock') + (isActive ? ' active' : '') + '" data-dex="' + p.id + '">' +
        PW.pokemon.render(p.id, []) +
        '<small>' + (unlocked ? p.name : '？？？') + (stageTag ? ' · ' + stageTag : '') + evoTag + '</small></div>';
    }).join('');

    const dexCard = '<div class="card" style="margin-top:16px"><div class="card-h"><h3 style="margin:0">📕 宝可梦图鉴</h3>' +
      '<span style="margin-left:auto;font-size:13px;color:var(--ink-2);font-weight:700;white-space:nowrap">已收集 ' + st.pet.dexUnlocked.length + ' / ' + totalDex + '</span></div>' +
      /* 说明文字 + 翻页控件同一行 */
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">' +
      '<p class="small muted" style="margin:0;flex:1;min-width:200px">点已拥有的宝可梦可把它设为当前伙伴（每天可以照顾3只）。收集更多还能点亮图鉴徽章！</p>' +
      (totalPages > 1 ? '<div style="display:flex;align-items:center;gap:6px;white-space:nowrap">' +
        '<button class="btn btn-ghost btn-sm" id="dexPrev"' + (dexPage <= 0 ? ' disabled' : '') + '>◀</button>' +
        '<span class="small" style="font-weight:700;color:var(--ink-2)">第 ' + (dexPage + 1) + '/' + totalPages + '</span>' +
        '<button class="btn btn-ghost btn-sm" id="dexNext"' + (dexPage >= totalPages - 1 ? ' disabled' : '') + '>▶</button>' +
        '</div>' : '') +
      '</div>' +
      '<div class="dex-grid" style="grid-template-columns:repeat(' + (window.innerWidth <= 420 ? 4 : (window.innerWidth <= 600 ? 5 : 6)) + ',1fr)">' + dex + '</div></div>';

    return stage + careCard + dexCard;
  }

  /**
   * 获取某类照顾的最佳可用成长值（高档道具优先）
   */
  function bestGrowth(kind) {
    const items = PW.shop.CONSUMABLE.filter((c) => c.kind === kind);
    let maxG = 0;
    items.forEach((c) => { if (c.growth > maxG) maxG = c.growth; });
    return maxG || '?';
  }

  /** 获取某类照顾的总库存数 */
  function invCount(kind) {
    const keys = {
      food: ['berry', 'lunchBox', 'superBerry'],
      water: ['water', 'vitaminWater', 'energyDrink'],
      bath: ['soap', 'spaOil', 'spaSalt']
    }[kind] || [kind];
    const st = PW.store.state;
    let total = 0;
    keys.forEach((k) => { total += (st.pet.inventory[k] || 0); });
    return total;
  }

  /** 完整库存显示字符串 */
  function fullInventory(inv) {
    const map = [
      ['berry', '🍎'], ['lunchBox', '🍞'], ['superBerry', '🍇'],
      ['water', '💧'], ['vitaminWater', '🥛'], ['energyDrink', '🧃'],
      ['soap', '🧼'], ['spaOil', '🧖'], ['spaSalt', '🛁']
    ];
    return map.filter((m) => (inv[m[0]] || 0) > 0).map((m) => m[1] + inv[m[0]]).join(' ') || '空';
  }

  /**
   * 照顾按钮
   * 库存不足时不加 disabled（让 onclick 触发弹窗购买），仅已完成时 disabled
   * done 优先于 low-stock，已做过的不显示缺货样式
   */
  function careBtn(kind, ico, name, sub, done, invCount, blocked) {
    const lowStock = !done && !blocked && invCount <= 0;
    if (blocked) {
      return '<button class="care-btn done" data-care="' + kind + '" disabled>' +
        '<span class="c-ico">' + ico + '</span><b>' + name + '</b>' +
        '<span>已进化 · 不可照顾</span></button>';
    }
    return '<button class="care-btn' + (done ? ' done' : '') + (lowStock ? ' low-stock' : '') + '" data-care="' + kind + '"' +
      (done ? ' disabled' : '') + '>' +
      '<span class="c-ico">' + ico + '</span><b>' + (done ? name + '✓' : name) + '</b>' +
      '<span>' + (done ? '今天做过' : (lowStock ? '库存不足 · 点击补货' : sub)) + '</span></button>';
  }

  function mount(root) {
    const st = PW.store.state;
    const active = st.pet.active;

    /* ====== 点击宝可梦对话互动 ====== */
    const canvas = U.$('#petCanvas', root);
    if (canvas) {
      canvas.onclick = () => {
        const line = PET_LINES[Math.floor(Math.random() * PET_LINES.length)];
        let bubble = document.getElementById('petTalkBubble');
        if (!bubble) {
          bubble = document.createElement('div');
          bubble.id = 'petTalkBubble';
          bubble.style.cssText = 'position:absolute;top:-6px;left:50%;transform:translateX(-50%);background:#fff;border:2px solid var(--line);border-radius:16px;padding:8px 14px;font-size:13px;line-height:1.5;box-shadow:var(--sh-2);z-index:10;white-space:nowrap;max-width:none;text-align:center;animation:bubbleIn .3s ease-out;pointer-events:none';
          canvas.appendChild(bubble);
          const tri = document.createElement('div');
          tri.style.cssText = 'position:absolute;bottom:-10px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #fff';
          bubble.appendChild(tri);
          const triB = document.createElement('div');
          triB.style.cssText = 'position:absolute;bottom:-13px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:10px solid var(--line)';
          bubble.appendChild(triB);
        }
        bubble.innerHTML = line + '<style>@keyframes bubbleIn{from{opacity:0;transform:translateX(-50%) translateY(8px) scale(.9)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}</style>';
        bubble.style.opacity = '1';
        clearTimeout(bubble._t);
        bubble._t = setTimeout(() => { bubble.style.transition = 'opacity .4s'; bubble.style.opacity = '0'; }, 3000);
      };
    }

    /* ====== 照顾按钮（含库存不足弹窗购买） ====== */
    U.$$('[data-care]', root).forEach((b) => {
      b.onclick = (e) => {
        const kind = b.dataset.care;
        const r = PW.store.care(kind, e.currentTarget);
        if (!r.ok) {
          if (r.needBuy) { openBuyDialog(r.needBuy); return; }
          U.toast(r.msg, 'warn'); return;
        }
        U.toast('照顾成功！成长 +' + r.growth, 'good');
        if (r.evolveReady) U.toast('成长够了，可以进化啦！', 'good', 2600);
        PW.app.rerender();
      };
    });

    /* ====== 进化 ====== */
    const ev = U.$('#evolveBtn', root);
    if (ev) ev.onclick = () => {
      ev.disabled = true;  // 立即禁用，防止连点沿进化链重复进化、虚增 evolveCount
      const r = PW.store.evolve(active);
      if (!r.ok) { U.toast(r.msg, 'warn'); return; }
      U.confetti(80);
      const from = PW.pokemon.name(r.from), to = PW.pokemon.name(r.to);
      U.modal({ title: '✨ 进化成功！', body: '<div class="center"><div style="font-size:50px">⚡</div>' +
        '<p style="font-size:16px;margin:8px 0">' + from + ' 进化成了 <b>' + to + '</b>！</p></div>',
        ops: [{ text: '好厉害！', cls: 'btn-primary', onClick: (c) => c() }] });
      PW.app.rerender();
    };

    /* ====== 图鉴切换 ====== */
    U.$$('[data-dex]', root).forEach((c) => {
      c.onclick = () => {
        const id = c.dataset.dex;
        if (st.pet.dexUnlocked.indexOf(id) < 0) { U.toast('这只还没收集到哦', 'warn'); return; }
        const r = PW.store.setActivePet(id);
        if (!r.ok) { U.toast(r.msg, 'warn'); return; }
        U.toast(PW.pokemon.name(id) + '，就决定是你了！', 'good');
        PW.petwidget && PW.petwidget.refreshAvatar && PW.petwidget.refreshAvatar();
        PW.petwidget && PW.petwidget.refresh();
        PW.app.rerender();
      };
    });

    /* ====== 图鉴翻页（保持滚动位置） ====== */
    const prevBtn = U.$('#dexPrev', root);
    const nextBtn = U.$('#dexNext', root);
    if (prevBtn) prevBtn.onclick = () => {
      const sx = window.scrollX || window.pageXOffset;
      const sy = window.scrollY || window.pageYOffset;
      dexPage--;
      PW.app.rerender();
      setTimeout(() => { window.scrollTo(sx, sy); }, 0);
    };
    if (nextBtn) nextBtn.onclick = () => {
      const sx = window.scrollX || window.pageXOffset;
      const sy = window.scrollY || window.pageYOffset;
      dexPage++;
      PW.app.rerender();
      setTimeout(() => { window.scrollTo(sx, sy); }, 0);
    };
  }

  /**
   * 库存不足时弹出内联购买弹窗（可选档次：基础/中档/高档）
   */
  function openBuyDialog(kind) {
    /* 获取该类照顾的所有道具，按成长值排序（低→高 = 基础→高档） */
    const kindItems = PW.shop.CONSUMABLE.filter((c) => c.kind === kind).sort((a, b) => a.growth - b.growth);
    if (!kindItems.length) { U.toast('找不到这类道具', 'warn'); return; }
    const wallet = PW.store.state.wallet;
    const TIER_NAMES = ['🌱 基础档', '🌿 中档', '🌳 高档'];
    let tierIndex = Math.min(kindItems.length - 1, 2); // 默认高档（最后一个有库存的或最高档）
    /* 找到最高档作为默认 */
    for (let i = kindItems.length - 1; i >= 0; i--) {
      if (wallet.coins >= kindItems[i].coins) { tierIndex = i; break; }
    }
    let qty = 1;

    function currentItem() { return kindItems[tierIndex] || kindItems[0]; }

    const maxAffordVal = currentItem().coins > 0 ? Math.floor(wallet.coins / currentItem().coins) : 99;

    U.modal({
      title: '🛒 购买' + (kind === 'food' ? '喂食' : kind === 'water' ? '喝水' : '洗澡') + '道具',
      sub: '选择档次和数量',
      body: '<div style="text-align:center;padding:8px 0">' +
        /* 档次切换器 */
        '<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px">' +
        '<button class="btn btn-ghost btn-sm" id="tierLeft" style="font-size:18px;padding:6px 12px"' + (tierIndex <= 0 ? ' disabled' : '') + '>◀</button>' +
        '<div id="tierDisplay" style="background:linear-gradient(135deg,#f8f3ff,#fff);border:2px solid #e0d4ff;border-radius:14px;padding:10px 20px;min-width:160px;text-align:center">' +
        '<div id="tierName" style="font-size:13px;font-weight:800;color:#7c3aed;margin-bottom:4px">' + (TIER_NAMES[tierIndex] || '道具') + '</div>' +
        '<div style="font-size:36px;margin-bottom:2px">' + currentItem().icon + '</div>' +
        '<b id="itemName" style="font-size:15px">' + currentItem().name + '</b>' +
        '<p class="small muted" id="itemDesc" style="margin:2px 0 8px">' + (currentItem().desc || '') + '</p>' +
        '<div style="font-weight:800;color:#e08600;font-size:16px"><svg class="coin-ico" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> <span id="itemPrice">' + currentItem().coins + '</span> / 个</div>' +
        '</div>' +
        '<button class="btn btn-ghost btn-sm" id="tierRight" style="font-size:18px;padding:6px 12px"' + (tierIndex >= kindItems.length - 1 ? ' disabled' : '') + '>▶</button>' +
        '</div>' +
        /* 数量选择 */
        '<div style="display:inline-flex;align-items:center;gap:14px;background:#f8f9fa;border-radius:14px;padding:12px 20px">' +
        '<button class="btn btn-ghost btn-sm" id="buyMinus" style="min-width:40px;font-size:20px;padding:6px 12px">−</button>' +
        '<b id="buyQty" style="font-size:22px;min-width:36px;text-align:center">' + qty + '</b>' +
        '<button class="btn btn-ghost btn-sm" id="buyPlus" style="min-width:40px;font-size:20px;padding:6px 12px">+</button>' +
        '</div>' +
        '<p id="buyTotal" style="margin-top:10px;font-size:15px;font-weight:700;color:var(--pk-red)">合计：<svg class="coin-ico" viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + (currentItem().coins * qty) + ' 金币</p>' +
        '<p class="small muted" style="margin:4px 0 0">你的金币：<svg class="coin-ico" viewBox="0 0 24 24" width="14" height="14" style="vertical-align:-2px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="10" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + wallet.coins + '</p>' +
        '</div>',
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        { text: '确认购买', cls: 'btn-primary', onClick: (c, card) => {
          const q = parseInt(U.$('#buyQty', card).textContent, 10) || 1;
          const item = currentItem();
          const r = PW.store.buyConsumable(item.id, q);
          if (!r.ok) { U.toast(r.msg, 'warn'); return; }
          c();
          U.toast('购买成功！' + item.name + ' ×' + q, 'good');
          PW.app.rerender();
        }}
      ],
      onMount: (card) => {
        let n = qty;
        let tIdx = tierIndex;

        function refreshTier() {
          const item = kindItems[tIdx] || kindItems[0];
          U.$('#tierName', card).textContent = TIER_NAMES[tIdx] || '道具';
          card.querySelector('#tierDisplay .style.font-size\\.36px').previousElementSibling ? null : null;
          /* 直接刷新关键元素 */
          const td = U.$('#tierDisplay', card);
          if (td) {
            td.innerHTML = '<div id="tierName" style="font-size:13px;font-weight:800;color:#7c3aed;margin-bottom:4px">' + (TIER_NAMES[tIdx] || '道具') + '</div>' +
              '<div style="font-size:36px;margin-bottom:2px">' + item.icon + '</div>' +
              '<b id="itemName" style="font-size:15px">' + item.name + '</b>' +
              '<p class="small muted" id="itemDesc" style="margin:2px 0 8px">' + (item.desc || '') + '</p>' +
              '<div style="font-weight:800;color:#e08600;font-size:16px"><svg class="coin-ico" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> <span id="itemPrice">' + item.coins + '</span> / 个</div>';
          }
          updateTotal();
          /* 更新左右按钮状态 */
          const leftBtn = U.$('#tierLeft', card);
          const rightBtn = U.$('#tierRight', card);
          if (leftBtn) leftBtn.disabled = tIdx <= 0;
          if (rightBtn) rightBtn.disabled = tIdx >= kindItems.length - 1;
        }

        function updateTotal() {
          const item = kindItems[tIdx] || kindItems[0];
          U.$('#buyTotal', card).innerHTML = '合计：<svg class="coin-ico" viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> ' + (item.coins * n) + ' 金币';
        }

        U.$('#buyMinus', card).onclick = () => { n = Math.max(1, n - 1); U.$('#buyQty', card).textContent = n; updateTotal(); };
        U.$('#buyPlus', card).onclick = () => { n = Math.min(99, n + 1); U.$('#buyQty', card).textContent = n; updateTotal(); };
        U.$('#tierLeft', card).onclick = () => { if (tIdx > 0) { tIdx--; refreshTier(); } };
        U.$('#tierRight', card).onclick = () => { if (tIdx < kindItems.length - 1) { tIdx++; refreshTier(); } };
      }
    });
  }

  return { title: '宠物之家', sub: '照顾你的宝可梦，喂它长大、进化、收集图鉴', render, mount };
})();
