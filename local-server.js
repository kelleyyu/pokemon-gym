<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no">
<meta name="theme-color" content="#ffcb05">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="宝可梦训练道馆">
<title>宝可梦训练道馆</title>
<link rel="manifest" href="manifest.webmanifest?v=20260820">
<link rel="apple-touch-icon" href="icons/icon-192.png?v=20260820">
<link rel="icon" href="icons/icon-192.png?v=20260820">
<link rel="stylesheet" href="css/app.css?v=20260820">
</head>
<body>

<!-- ============ 启动引导（首次进入） ============ -->
<div id="onboarding" class="onboarding hidden"></div>

<!-- ============ 应用主体 ============ -->
<div id="app" class="app hidden">

  <!-- 侧边栏（PC） -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-ball"></div>
      <div class="brand-text">
        <strong>宝可梦训练道馆</strong>
        <span id="brandSub">训练家工作台</span>
      </div>
    </div>
    <nav class="nav" id="navList"></nav>
    <div class="sidebar-foot">
      <div class="sync-pill" id="syncPill" title="点击立即同步">
        <span class="dot"></span><span id="syncText">本地已保存</span>
      </div>
    </div>
  </aside>

  <!-- 主内容区 -->
  <main class="main">
    <header class="topbar">
      <button class="icon-btn only-mobile" id="btnMobileMenu" aria-label="菜单">☰</button>
      <div class="topbar-title">
        <h1 id="viewTitle">今日任务</h1>
        <p id="viewSub">每天一点点，进化看得见</p>
      </div>
      <div class="wallet">
        <div class="wallet-item coin" id="walletCoin">
          <span class="w-ico"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg></span><b id="coinNum">0</b>
        </div>
        <div class="wallet-item star" id="walletStar">
          <span class="w-ico"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg></span><b id="starNum">0</b>
        </div>
        <button class="icon-btn" id="bellBtn" title="消息通知" style="position:relative">🔔<span class="bell-badge hidden" id="bellBadge">0</span></button>
        <button class="avatar-btn" id="avatarBtn" title="我的训练家档案"><span id="avatarEmoji">🎒</span></button>
      </div>
    </header>

    <div class="view-wrap" id="view"></div>
    <div class="mobile-safe"></div>
  </main>

  <!-- 底部 Tab（移动端） -->
  <nav class="tabbar" id="tabbar"></nav>

  <!-- 悬浮宠物 -->
  <div class="pet-float" id="petFloat">
    <div class="pet-bubble" id="petBubble"></div>
    <div class="pet-body" id="petFloatBody"></div>
  </div>
</div>

<!-- ============ 通用弹层 ============ -->
<div class="modal-root hidden" id="modalRoot">
  <div class="modal-mask" id="modalMask"></div>
  <div class="modal-card" id="modalCard"></div>
</div>

<div class="sheet-root hidden" id="sheetRoot">
  <div class="modal-mask" id="sheetMask"></div>
  <div class="sheet-card" id="sheetCard"></div>
</div>

<div class="toast-wrap" id="toastWrap"></div>
<div class="fx-layer" id="fxLayer"></div>

<!-- ============ 脚本 ============ -->
<script src="js/util.js?v=20260820"></script>
<script src="js/data/subjects.js?v=20260820"></script>
<script src="js/data/pokedex-data.js?v=20260820"></script>
<script src="js/data/pokemon.js?v=20260820"></script>
<script src="js/data/pettalk.js?v=20260820"></script>
<script src="js/data/shop.js?v=20260820"></script>
<script src="js/data/mathcheck.js?v=20260820"></script>
<script src="js/data/badges.js?v=20260820"></script>
<script src="js/data/quizbank.js?v=20260820"></script>
<script src="js/data/quiz.js?v=20260820"></script>
<script src="js/store.js?v=20260820"></script>
<script src="js/sync.js?v=20260820"></script>
<script src="js/views/onboarding.js?v=20260820"></script>
<script src="js/views/tasks.js?v=20260820"></script>
<script src="js/views/reading.js?v=20260820"></script>
<script src="js/views/sports.js?v=20260820"></script>
<script src="js/views/adventure.js?v=20260820"></script>
<script src="js/views/badges.js?v=20260820"></script>
<script src="js/views/rewards.js?v=20260820"></script>
<script src="js/views/pet.js?v=20260820"></script>
<script src="js/views/settings.js?v=20260820"></script>
<script src="js/petwidget.js?v=20260820"></script>
<script src="js/app.js?v=20260820"></script>
<script>
  // 注册 Service Worker（PWA 离线 / 安装为 APP）。file:// 下跳过。
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
        // 新版本就绪后：强制激活并自动重载一次，用户永远看到最新版（无需手动硬刷新）
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', function () {
          if (reloading) return;
          reloading = true;
          location.reload();
        });
        if (reg.waiting) reg.waiting.postMessage('skip-waiting');
        reg.addEventListener('updatefound', function () {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('skip-waiting');
            }
          });
        });
      }).catch(function (e) { console.warn('SW 注册失败', e); });
    });
  }
</script>
</body>
</html>
