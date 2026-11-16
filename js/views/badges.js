/* =========================================================
   PW · 成就徽章（10 组 × 5 档基础 + 1 枚 Mega 突破）
   ========================================================= */
PW.viewBadges = (function () {
  const U = PW.util;

  function rankOf(b) { return b.isMega ? 99 : (PW.badges.ORDER.indexOf(b.level)); }

  function render() {
    const st = PW.store.state;
    const evalResult = PW.badges.evaluate(PW.store.stats(), st.badges.claimed, st.badges.megaClaimed);
    const evaluated = evalResult.badges || evalResult;
    const byGroup = {};
    evaluated.forEach((b) => { (byGroup[b.group] = byGroup[b.group] || []).push(b); });
    Object.keys(byGroup).forEach((g) => byGroup[g].sort((a, b) => rankOf(a) - rankOf(b)));

    const claimedBase = evaluated.filter((b) => b.claimed).length;
    const claimedMega = evaluated.filter((b) => b.isMega).reduce((s, b) => s + (b.claimedMega || 0), 0);
    const claimed = claimedBase + claimedMega;
    const ready = evaluated.filter((b) => b.canClaim).length;
    const achieved = evaluated.filter((b) => b.achieved).length;
    const total = evaluated.length;

    const summary = '<div class="grid g3" style="margin-bottom:16px">' +
      summaryCard('🏅', claimed + ' / ' + total, '已领取徽章', '#2eb87a') +
      summaryCard('✨', ready, '可领取奖励', '#f2a900') +
      summaryCard('🎯', achieved + ' / ' + total, '已达成条件', '#2a75bb') +
      '</div>';

    const summaryExtra = ready > 0
      ? '<div class="card center" style="margin-bottom:16px;background:linear-gradient(180deg,#fffaea,#fff);border-color:#ffe3a8">' +
        '<b>🎁 有 ' + ready + ' 枚徽章可以领奖！</b><p class="small muted" style="margin:6px 0 0">点徽章上的"领取"按钮，金币和星星立刻到账～</p></div>'
      : '';

    const sections = PW.badges.GROUPS.map((g) => {
      const list = byGroup[g.key] || [];
      return '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-h"><h3>' + g.icon + ' ' + g.title + '</h3></div>' +
        '<div class="badge-grid">' + list.map((b) => badgeCard(b)).join('') + '</div></div>';
    }).join('');

    return summary + summaryExtra + sections;
  }

  function summaryCard(ico, v, k, col) {
    return '<div class="stat">' + ico + ' <b style="color:' + col + '">' + v + '</b><span>' + k + '</span></div>';
  }

  function badgeCard(b) {
    const reward = b.coins || b.stars
      ? '<svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg>' + b.coins + (b.stars ? ' · <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg>' + b.stars : '') : '—';
    const medal = '<div class="badge-medal ' + b.cls + '">' + b.icon + '</div>';

    const levelInner = '<span class="small" style="color:var(--ink-3)">' + b.levelName + '</span>';

    let btn, prog, extraCls = '', megaDesc = '';

    if (!b.isMega) {
      /* ---- 基础徽章：每枚仅领 1 次 ---- */
      btn = b.canClaim
        ? '<button class="btn btn-primary btn-sm btn-block" data-claim="' + b.id + '" style="margin-top:8px">领取奖励</button>'
        : (b.claimed ? '<button class="btn btn-ghost btn-sm btn-block" disabled>已领取</button>'
          : '<button class="btn btn-ghost btn-sm btn-block" disabled>未达成</button>');
      prog = (b.cur / b.need >= 1)
        ? '<div class="progress" style="height:7px;margin:3px 0"><i style="width:100%"></i></div>' +
          '<span class="small muted">' + b.cur + ' / ' + b.need + ' ' + b.unit + '</span>'
        : '<div class="progress" style="height:7px;margin:3px 0"><i style="width:' + b.pct + '%"></i></div>' +
          '<span class="small muted">' + b.cur + ' / ' + b.need + ' ' + b.unit + '</span>';
    } else {
      /* ---- Mega 突破 ---- */
      extraCls = b.canClaim ? 'ready' : '';
      if (!b.achieved) {
        /* 未解锁：desc=集齐本类徽章解锁(对齐前5枚的获取条件), prog=？？？, btn=未达成 */
        btn = '<button class="btn btn-ghost btn-sm btn-block" disabled>未达成</button>';
        prog = '<span class="small muted">？？？</span>';
        /* 覆盖desc为解锁规则说明 */
        megaDesc = '<span class="small muted">集齐本类徽章解锁</span>';
      } else {
        btn = b.canClaim
          ? '<button class="btn btn-primary btn-sm btn-block" data-claim="' + b.id + '" style="margin-top:8px">领取突破奖励</button>'
          : '<button class="btn btn-ghost btn-sm btn-block" disabled>' + (b.claimedMega > 0 ? '已领 ' + b.claimedMega + ' 次' : '再积累解锁') + '</button>';
        const remainTxt = b.remaining > 0 ? '还差 ' + b.remaining + ' ' + b.unit + ' 解锁下一次' : '已达可领条件';
        prog = '<div class="progress" style="height:7px;margin:3px 0"><i style="width:' + b.pct + '%"></i></div>' +
          '<span class="small muted">' + remainTxt + '</span>';
      }
    }

    const cls = 'badge-card ' + extraCls + (b.isMega ? ' mega' : '') + ((!b.isMega && b.claimed) ? ' claimed ' : '') + ((!b.isMega && !b.achieved) ? 'locked' : '') + ((b.isMega && !b.achieved) ? ' locked' : '');

    /* 已领取徽章右上角绿色丝带 */
    const ribbon = (!b.isMega && b.claimed)
      ? '<div class="badge-ribbon">已领取</div>'
      : (b.isMega && b.claimedMega > 0
        ? '<div class="badge-ribbon mega-ribbon">已领' + b.claimedMega + '次</div>'
        : '');

    return '<div class="' + cls + '">' + ribbon + medal +
      '<b>' + b.name + '</b>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:4px">' + levelInner + '</div>' +
      '<div class="b-desc">' + (megaDesc || b.desc) + '</div>' +
      prog +
      '<div class="b-rw">' + reward + '</div>' + btn + '</div>';
  }

  function mount(root) {
    U.$$('[data-claim]', root).forEach((b) => {
      b.onclick = (e) => {
        const r = PW.store.claimBadge(b.dataset.claim, e.currentTarget);
        if (!r.ok) { U.toast(r.msg, 'warn'); return; }
        U.confetti(50);
        if (r.mega) {
          U.toast('Mega 突破！已领取 ' + r.count + ' 次 +' + r.badge.coins + ' 金币 +' + r.badge.stars + ' 星星', 'good');
        } else {
          U.toast('领取成功！+' + r.badge.coins + ' 金币' + (r.badge.stars ? ' +' + r.badge.stars + ' 星星' : ''), 'good');
        }
        PW.app.rerender();
      };
    });
  }

  return { title: '成就徽章', sub: '完成挑战点亮徽章，领取金币与星星', render, mount };
})();
