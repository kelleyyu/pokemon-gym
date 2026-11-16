/* =========================================================
   PW · 应用骨架（路由 / 导航 / 启动）
   ========================================================= */
PW.app = (function () {
  const U = PW.util;

  const NAV = [
    { hash: '#/tasks', icon: '📚', title: '今日任务', tab: true },
    { hash: '#/reading', icon: '📖', title: '阅读积累', tab: true },
    { hash: '#/sports', icon: '🏃', title: '运动锻炼', tab: true },
    { hash: '#/adventure', icon: '⚔️', title: '闯关冒险', tab: true },
    { hash: '#/pet', icon: '🐾', title: '宠物之家', tab: true },
    { hash: '#/rewards', icon: '⭐', title: '训练奖励', tab: true },
    { hash: '#/badges', icon: '🏅', title: '成就徽章', tab: false },
    { hash: '#/settings', icon: '🔧', title: '管理配置', tab: false }
  ];
  const VIEW_MAP = {
    '#/tasks': 'viewTasks', '#/reading': 'viewReading', '#/sports': 'viewSports',
    '#/adventure': 'viewAdventure', '#/pet': 'viewPet', '#/rewards': 'viewRewards',
    '#/badges': 'viewBadges', '#/settings': 'viewSettings'
  };

  let booted = false;

  function currentHash() {
    let h = location.hash || '#/tasks';
    if (!VIEW_MAP[h]) h = '#/tasks';
    return h;
  }

  function currentView() {
    const key = VIEW_MAP[currentHash()];
    return PW[key];
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    PW.store.load();
    if (!PW.store.state.profile.onboarded) {
      /* 本机存档标记丢失（如 iOS 清理了 PWA 本地数据）：先尝试从云端恢复。
         若已配置云同步且云端有完整档案，恢复后直接进入应用，跳过手填引导；
         否则（无任何云端档案）才显示引导页，让用户首次填写。 */
      document.getElementById('app').classList.add('hidden');
      PW.onboarding.show();
      if (PW.sync && PW.sync.init) {
        PW.sync.init().then(function (res) {
          if (res && res.restored && PW.store.state.profile.onboarded) {
            var ob = document.getElementById('onboarding');
            if (ob && !ob.classList.contains('hidden')) {
              ob.classList.add('hidden');
              document.getElementById('app').classList.remove('hidden');
              startApp();
            }
          }
        }).catch(function () {});
      }
      return;
    }
    if (PW.sync && PW.sync.init) PW.sync.init();
    startApp();
  }

  function startApp() {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    buildNav();
    bindGlobal();
    PW.petwidget.init();
    render();

    // PWA 安装提示（仅移动端且未安装时显示）
    showInstallPrompt();
    PW.petwidget.greet();
    // 检查是否需要发送每日/周/月/年学习报告（22:00 后自动触发，周/月/年报告在 22:30 后）
    try { PW.store.checkAndSendDailySummary(); } catch (e) { console.warn('[PW] 报告检查跳过:', e); }
    setInterval(() => { try { PW.store.checkAndSendDailySummary(); } catch (e) {} }, 60000);
    // 钱包 / 角标 / 消息 随状态刷新
    PW.store.on(() => { updateWallet(); updateBadgeCount(); updateBell(); });
    updateWallet(); updateBadgeCount(); updateBell();
    if (!booted) {
      window.addEventListener('hashchange', render);
      booted = true;
    }
  }

  /* ---------------- 导航 ---------------- */
  function buildNav() {
    const navList = document.getElementById('navList');
    const tabbar = document.getElementById('tabbar');
    const st = PW.store.state;

    navList.innerHTML = NAV.map((n) =>
      '<button class="nav-item" data-hash="' + n.hash + '">' +
      '<span class="n-ico">' + n.icon + '</span><span>' + n.title + '</span>' +
      (n.hash === '#/badges' ? '<span class="n-badge" id="badgeNav" style="display:none"></span>' : '') +
      '</button>').join('');

    tabbar.innerHTML = NAV.filter((n) => n.tab).map((n) =>
      '<button class="tab-item" data-hash="' + n.hash + '">' +
      '<span class="t-i">' + n.icon + '</span><span>' + n.title + '</span></button>').join('');

    // 点击导航
    U.$$('.nav-item', navList).forEach((b) => (b.onclick = () => go(b.dataset.hash)));
    U.$$('.tab-item', tabbar).forEach((b) => (b.onclick = () => go(b.dataset.hash)));
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
    closeDrawer();
  }

  /* ---------------- 渲染当前视图（防重入 + 异常保护） ---------------- */
  let _rendering = false;  // 防止 render 被循环触发导致页面卡死
  let _lastRenderHash = '';  // 记录上次渲染的视图hash，只在切换视图时才滚到顶部
  function render() {
    if (_rendering) return;  // 如果正在渲染中，跳过（防止 mount → rerender → render 死循环）
    /* 输入框聚焦时跳过重建：移动端打字中若整体替换 DOM，会导致键盘消失、内容清空。
       （iOS 不允许程序化 focus 重新弹键盘，故唯一可靠做法是“不打断正在输入的框”。）
       数据同步在 render 之前已并入本地 state，仅跳过视觉重建；用户失焦后下个轮询自然刷新。 */
    var _ae = document.activeElement;
    if (_ae && (_ae.tagName === 'INPUT' || _ae.tagName === 'TEXTAREA') && !_ae.readOnly && !_ae.disabled) return;
    _rendering = true;
    const root = document.getElementById('view');
    try {
      const view = currentView();
      if (!view) return;
      // 清理可能残留的弹窗遮罩层（避免 DOM 泄漏导致卡顿）
      document.querySelectorAll('.modal-overlay, .sheet-overlay').forEach((el) => { el.remove(); });
      document.getElementById('viewTitle').textContent = view.title;
      document.getElementById('viewSub').textContent = view.sub || '';
      /* 先清空内容区，防止 render() 抛异常时残留上一个页面的内容 */
      root.innerHTML = '';
      root.innerHTML = view.render();
      if (view.mount) view.mount(root);
      // 高亮导航
      U.$$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.hash === currentHash()));
      U.$$('.tab-item').forEach((b) => b.classList.toggle('active', b.dataset.hash === currentHash()));
      /* 只在切换视图（hash变化）时滚到顶部，日期筛选等 rerender 不跳 */
      var curHash = currentHash();
      if (curHash !== _lastRenderHash) { window.scrollTo(0, 0); _lastRenderHash = curHash; }
    } catch (e) {
      console.error('[PW] 渲染出错:', e);
      /* 渲染失败时显示错误提示（含详细错误信息便于排查），不再残留旧页面内容 */
      var errInfo = (e && e.message) ? String(e.message).replace(/</g,'&lt;') : String(e).replace(/</g,'&lt;');
      var errStack = (e && e.stack) ? String(e.stack).slice(0, 500).replace(/</g,'&lt;') : '';
      if (root) {
        root.innerHTML = '<div class="card" style="margin-top:20px;text-align:center;padding:30px">' +
          '<div style="font-size:36px;margin-bottom:10px">⚠️</div>' +
          '<b style="font-size:16px;color:#e67e22">页面加载出了点问题</b>' +
          '<pre style="text-align:left;background:#fff3cd;padding:10px;border-radius:8px;margin-top:10px;font-size:11px;color:#856404;overflow:auto;max-height:200px">' + errInfo + '\n\n' + errStack + '</pre>' +
          '<p class="muted small" style="margin-top:8px">试试刷新页面（Ctrl+Shift+R）<br>如果反复出现，请在「管理配置」里清除数据后重新录入</p>' +
          '<button class="btn btn-blue btn-sm" style="margin-top:12px" onclick="location.reload()">🔄 刷新页面</button></div>';
      }
      // 尝试恢复：至少保证导航可用
      try {
        U.$$('.nav-item').forEach((b) => b.classList.remove('active'));
        U.$$('.tab-item').forEach((b) => b.classList.remove('active'));
        const activeHash = currentHash();
        const activeBtn = document.querySelector('.nav-item[data-hash="' + activeHash + '"]');
        if (activeBtn) activeBtn.classList.add('active');
        const activeTab = document.querySelector('.tab-item[data-hash="' + activeHash + '"]');
        if (activeTab) activeTab.classList.add('active');
      } catch (_) {}
    } finally {
      _rendering = false;
    }
  }

  function rerender() { render(); }
  /* 强制重新渲染（绕过防重入锁，用于需要立即刷新的场景如PIN解锁） */
  function forceRender() { _rendering = false; render(); }

  /* ---------------- 钱包 / 角标 ---------------- */
  function updateWallet() {
    const w = PW.store.state.wallet;
    const c = document.getElementById('coinNum'), s = document.getElementById('starNum');
    if (c) c.textContent = w.coins;
    if (s) s.textContent = w.stars;
    const av = document.getElementById('avatarEmoji');
    if (av) av.textContent = '🎒';
  }
  function updateBadgeCount() {
    const n = PW.store.todayOverview().badgeReady;
    const el = document.getElementById('badgeNav');
    if (el) {
      if (n > 0) { el.style.display = ''; el.textContent = n; }
      else el.style.display = 'none';
    }
  }
  function updateBell() {
    const el = document.getElementById('bellBadge');
    if (!el) return;
    const n = PW.store.unreadNotifCount();
    if (n > 0) { el.classList.remove('hidden'); el.textContent = n > 99 ? '99+' : n; }
    else el.classList.add('hidden');
  }
  function openNotifications() {
    const list = PW.store.state.notifications;
    const body = list.length
      ? list.map((n) => {
          const reward = (n.coins || n.stars)
            ? ' <span class="notif-reward">🎁 +' + (n.coins || 0) + ' ' + PW.COIN_SVG + ' +' + (n.stars || 0) + ' ' + PW.STAR_SVG + '</span>' : '';
          const itemReward = (n.items && typeof n.items === 'object')
            ? ' <span class="notif-reward">🎒 ' + Object.keys(n.items).map((k) => {
                const def = PW.shop.CONSUMABLE_MAP[k];
                return (def ? def.icon : '🎁') + ' ' + (def ? def.name : k) + '×' + n.items[k];
              }).join(' · ') + '</span>' : '';
          const hasReward = !!(n.coins || n.stars);
          const claimed = n.claimed ? '<span class="tag tag-school">已领取</span>'
            : hasReward ? '<button class="btn btn-sm btn-primary" data-claim="' + n.id + '">领取奖励</button>' : '';
          return '<div class="notif-item' + (n.read ? '' : ' unread') + '" data-id="' + n.id + '">' +
            '<div class="notif-top"><b>' + U.esc(n.title || '消息') + '</b>' +
            (n.from === 'parent' ? '<span class="tag">家长</span>' : '<span class="tag tag-school">系统</span>') + '</div>' +
            '<div class="notif-text">' + U.esc(n.text) + reward + itemReward + '</div>' +
            '<div class="notif-foot">' + (n.at ? U.todayStr(new Date(n.at)) : '') + ' ' + claimed + ' <button class="btn btn-sm btn-ghost" data-delnotif="' + n.id + '" style="font-size:11px;padding:2px 8px">删除</button></div>' +
            '</div>';
        }).join('')
      : '<div class="empty"><span class="e-ico">📭</span>还没有消息，家长可以在「管理配置」里给你发消息和奖励哦！</div>';
    U.modal({
      title: '📬 我的消息',
      sub: PW.store.unreadNotifCount() + ' 条未读',
      body: '<div class="notif-list">' + body + '</div>',
      ops: [{ text: '关闭', cls: 'btn-ghost' }],
      onMount: (card) => {
        // 点击消息项自动标记已读，红点消失
        U.$$('.notif-item', card).forEach((item) => {
          item.onclick = () => {
            const id = item.dataset.id || (item.querySelector('[data-delnotif]') && item.querySelector('[data-delnotif]').dataset.delnotif);
            if (id) { PW.store.markNotifRead(id); item.classList.remove('unread'); updateBell(); }
          };
        });
        U.$$('[data-claim]', card).forEach((b) => {
          b.onclick = () => {
            const r = PW.store.claimNotif(b.dataset.claim, b);
            if (r && r.ok) { U.confetti(28); U.toast('领取成功！+' + r.coins + ' 金币 +' + r.stars + ' 星星', 'good'); openNotifications(); }
          };
        });
        U.$$('[data-delnotif]', card).forEach((b) => {
          b.onclick = () => {
            const id = b.dataset.delnotif;
            U.confirmBox('确定删除这条消息？', '删除后可在「管理配置 → 回收站」恢复。', '确定删除', () => {
              const idx = PW.store.state.notifications.findIndex((x) => x.id === id);
              if (idx >= 0) { const rec = PW.store.state.notifications.splice(idx, 1)[0]; PW.store.trashRecord('notification', rec); PW.store.save(); }
              openNotifications();
              U.toast('已移入回收站', 'good');
            }, 'btn-red');
          };
        });
      }
    });
  }

  /* ---------------- 全局交互 ---------------- */
  function bindGlobal() {
    const menu = document.getElementById('btnMobileMenu');
    if (menu) menu.onclick = () => document.querySelector('.sidebar').classList.toggle('open');
    // 点击侧栏外部区域自动收起侧栏
    document.addEventListener('click', function (e) {
      var sb = document.querySelector('.sidebar');
      if (sb && sb.classList.contains('open') && !sb.contains(e.target) && e.target !== sb) {
        // 排除菜单按钮本身（避免 toggle 后立即又关闭）
        var menuBtn = document.getElementById('btnMobileMenu');
        if (!menuBtn || !menuBtn.contains(e.target)) {
          sb.classList.remove('open');
        }
      }
    });
    const avatar = document.getElementById('avatarBtn');
    if (avatar) avatar.onclick = openProfile;
    const syncPill = document.getElementById('syncPill');
    if (syncPill) syncPill.onclick = () => { if (PW.sync && PW.sync.manual) PW.sync.manual(); };
    const bell = document.getElementById('bellBtn');
    if (bell) bell.onclick = openNotifications;
    const aiBtn = document.getElementById('aiBtn');
    if (aiBtn) aiBtn.onclick = () => { if (PW.petwidget && PW.petwidget.openChat) PW.petwidget.openChat(); };
  }
  function closeDrawer() {
    const sb = document.querySelector('.sidebar');
    if (sb) sb.classList.remove('open');
  }

  function openProfile() {
    const st = PW.store.state;
    const g = (PW.onboarding.GRADES || []).find((x) => x.g === st.profile.grade);
    U.sheet('🎒 我的训练家档案',
      '<div class="card" style="border:none;box-shadow:none;padding:0">' +
      '<div class="row" style="gap:12px;align-items:center"><div style="font-size:40px">🧒</div>' +
      '<div><b style="font-size:17px">' + U.esc(st.profile.name || '小训练家') + '</b>' +
      '<div class="small muted">' + (g ? g.n : st.profile.grade + ' 年级') + ' · ' + st.profile.age + ' 岁</div></div></div>' +
      '<div class="grid g2" style="margin-top:14px">' +
      '<div class="stat">' + PW.COIN_SVG + ' <b>' + st.wallet.coins + '</b><span>金币</span></div>' +
      '<div class="stat">' + PW.STAR_SVG + ' <b>' + st.wallet.stars + '</b><span>星星</span></div></div>' +
      '<div class="grid g2" style="margin-top:10px">' +
      '<div class="stat">💰 <b>' + st.wallet.totalCoins + '</b><span>累计金币</span></div>' +
      '<div class="stat">🌟 <b>' + st.wallet.totalStars + '</b><span>累计星星</span></div></div>' +
      '<div class="grid g2" style="margin-top:10px">' +
      '<div class="stat">📕 <b>' + (st.pet.dexUnlocked || []).length + '</b><span>收集图鉴</span></div>' +
      '<div class="stat">🏅 <b>' + (Object.keys(st.badges.claimed || {}).length) + '</b><span>获得徽章</span></div></div></div>');
  }

  /* ---------------- PWA 安装提示 ---------------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
  function showInstallPrompt() {
    const isMobile = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
    if (!isMobile || !deferredPrompt || localStorage.getItem('pw_pwa_dismissed')) return;
    const bar = document.createElement('div');
    bar.id = 'pwaInstallBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;padding:10px 16px;display:flex;align-items:center;gap:10px;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.2);animation:pwa-slide .4s ease-out';
    bar.innerHTML =
      '<span style="flex:1"><b>📱 安装到手机桌面</b><br><span style="opacity:.85;font-size:12px">像APP一样使用，离线也能打开！</span></span>' +
      '<button id="pwaInstallBtn" style="background:#fff;color:#764ba2;border:none;padding:8px 18px;border-radius:20px;font-weight:bold;font-size:13px;cursor:pointer">立即安装</button>' +
      '<button id="pwaDismissBtn" style="background:none;border:none;color:rgba(255,255,255,.7);font-size:20px;cursor:pointer;line-height:1">×</button>';
    document.body.appendChild(bar);
    document.getElementById('pwaInstallBtn').onclick = async () => {
      if (deferredPrompt) { deferredPrompt.prompt(); const r = await deferredPrompt.userChoice; deferredPrompt = null; }
      bar.remove();
      localStorage.setItem('pw_pwa_installed', '1');
    };
    document.getElementById('pwaDismissBtn').onclick = () => {
      localStorage.setItem('pw_pwa_dismissed', '1');
      bar.remove();
    };
  }

  return { boot, render, rerender, forceRender, go, startApp };
})();

/* 页面加载后启动 */
document.addEventListener('DOMContentLoaded', PW.app.boot);
