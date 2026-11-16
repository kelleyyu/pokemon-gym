/* =========================================================
   PW · 基础工具库
   ========================================================= */
window.PW = window.PW || {};

/* ---- 通用金币 / 星星 SVG（避免 emoji 在旧设备上显示为方框） ---- */
PW.COIN_SVG = '<svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg>';
PW.STAR_SVG = '<svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg>';
PW.COIN_SVG_LG = '<svg viewBox="0 0 24 24" width="56" height="56"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg>';

PW.util = (function () {
  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  function todayStr(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function nowHM(d) {
    d = d || new Date();
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function dateAdd(str, n) {
    const p = str.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    d.setDate(d.getDate() + n);
    return todayStr(d);
  }
  function daysBetween(a, b) {
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    const da = new Date(pa[0], pa[1] - 1, pa[2]), db = new Date(pb[0], pb[1] - 1, pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function weekdayCN(str) {
    const p = str.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return '日一二三四五六'[d.getDay()];
  }
  /** 连续天数（含今天或昨天为起点） */
  function streak(dateSet) {
    const t = todayStr();
    let cur = dateSet.has(t) ? t : (dateSet.has(dateAdd(t, -1)) ? dateAdd(t, -1) : null);
    if (!cur) return 0;
    let n = 0;
    while (dateSet.has(cur)) { n++; cur = dateAdd(cur, -1); }
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, function (e) {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) fn.call(t, e, t);
    });
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, type, ms) {
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = '.3s'; el.style.opacity = '0'; el.style.transform = 'translateY(-10px)';
      setTimeout(() => el.remove(), 320);
    }, ms || 2100);
  }

  /* ---------------- Modal ---------------- */
  let modalCloser = null;
  function modal(opts) {
    // opts: {title, sub, body(html), ops:[{text,cls,onClick(close)}], onMount(card, close), closable}
    const root = document.getElementById('modalRoot');
    const card = document.getElementById('modalCard');
    const ops = opts.ops || [];
    card.innerHTML =
      (opts.title ? '<h3>' + opts.title + '</h3>' : '') +
      (opts.sub ? '<p class="m-sub">' + opts.sub + '</p>' : '') +
      '<div class="m-body">' + (opts.body || '') + '</div>' +
      (ops.length ? '<div class="modal-ops">' + ops.map((o, i) =>
        '<button class="btn ' + (o.cls || 'btn-ghost') + '" data-op="' + i + '">' + o.text + '</button>').join('') + '</div>' : '');
    root.classList.remove('hidden');
    const close = () => { root.classList.add('hidden'); card.innerHTML = ''; modalCloser = null; };
    modalCloser = opts.closable === false ? null : close;
    card.querySelectorAll('[data-op]').forEach((b) => {
      b.onclick = () => {
        const o = ops[+b.dataset.op];
        if (!o.onClick) return close();
        o.onClick(close, card);
      };
    });
    if (opts.onMount) opts.onMount(card, close);
    return close;
  }
  function confirmBox(title, sub, okText, onOk, tone) {
    return modal({
      title, sub,
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        { text: okText || '确定', cls: tone || 'btn-primary', onClick: (close) => { close(); onOk && onOk(); } }
      ]
    });
  }

  /* ---------------- Sheet（移动端底部面板） ---------------- */
  function sheet(title, html, onMount) {
    const root = document.getElementById('sheetRoot');
    const card = document.getElementById('sheetCard');
    card.innerHTML = '<div class="sheet-title">' + title + '</div>' + html;
    root.classList.remove('hidden');
    const close = () => { root.classList.add('hidden'); card.innerHTML = ''; };
    if (onMount) onMount(card, close);
    return close;
  }

  /* ---------------- 奖励特效 ---------------- */
  function flyReward(coins, stars, anchor) {
    const layer = document.getElementById('fxLayer');
    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    if (anchor && anchor.getBoundingClientRect) {
      const r = anchor.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top;
    }
    const parts = [];
    if (coins) parts.push({ t: PW.COIN_SVG + ' +' + coins, c: '#e08600' });
    if (stars) parts.push({ t: PW.STAR_SVG + ' +' + stars, c: '#3757a8' });
    parts.forEach((p, i) => {
      const el = document.createElement('div');
      el.className = 'fx-item';
      el.innerHTML = p.t;
      el.style.color = p.c;
      el.style.left = (x - 40 + i * 12) + 'px';
      el.style.top = y + 'px';
      el.style.animationDelay = (i * 0.12) + 's';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    });
  }
  function confetti(n) {
    const layer = document.getElementById('fxLayer');
    const colors = ['#ffcb05', '#ee1515', '#2a75bb', '#4cc98b', '#ff8fc7', '#9b6bdf'];
    for (let i = 0; i < (n || 40); i++) {
      const c = document.createElement('i');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = (Math.random() * 0.6) + 's';
      c.style.animationDuration = (1.6 + Math.random() * 1.1) + 's';
      layer.appendChild(c);
      setTimeout(() => c.remove(), 3200);
    }
  }

  function fmtMoney(n) {
    return (Math.round(n * 100) / 100).toString().replace(/\.0+$/, '') + ' 元';
  }

  /* ---------------- 相机拍照（getUserMedia，支持安装到主屏幕的 PWA） ---------------- */
  /* 为什么不用 <input type=file capture>：
     在 iOS/Android「添加到主屏幕」的独立运行模式下，file input 不提供拍照选项，
     只有 getUserMedia 能在 PWA 中真实调起相机（需 iOS 16.4+ 或安卓）。
     onCapture(files) 回调收到 [File]，可直接交给 startOcr 等流程。 */
  function openCamera(onCapture) {
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) {
      toast('当前环境不支持直接调起相机，请用「选图」从相册选取', 'warn');
      return;
    }
    modal({
      title: '📷 拍照识别',
      body: '<div class="cam-wrap"><video id="camVideo" class="cam-video" autoplay playsinline muted></video>' +
        '<div id="camErr" class="cam-err hidden"></div></div>',
      ops: [{ text: '取消', cls: 'btn-ghost' }, { text: '📸 拍照', cls: 'btn-primary' }],
      onMount: function (card, close) {
        const video = card.querySelector('#camVideo');
        const errEl = card.querySelector('#camErr');
        let stream = null;
        const stop = function () { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); };
        md.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
          .then(function (s) { stream = s; video.srcObject = s; })
          .catch(function (e) {
            errEl.classList.remove('hidden');
            errEl.textContent = (e && e.name === 'NotAllowedError')
              ? '相机权限被拒绝，请在系统设置中允许本应用使用相机'
              : '无法打开相机：' + ((e && e.message) || '设备不支持');
          });
        const opsBtns = card.querySelectorAll('[data-op]');
        if (opsBtns[1]) opsBtns[1].onclick = function () {
          try {
            const w = video.videoWidth || 1280, h = video.videoHeight || 720;
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            cv.getContext('2d').drawImage(video, 0, 0, w, h);
            cv.toBlob(function (blob) {
              const file = new File([blob], 'camera_' + Date.now() + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
              stop(); close();
              if (onCapture) onCapture([file]);
            }, 'image/jpeg', 0.92);
          } catch (e2) { toast('拍照失败：' + ((e2 && e2.message) || e2), 'warn'); }
        };
        if (opsBtns[0]) { const old = opsBtns[0].onclick; opsBtns[0].onclick = function () { stop(); if (old) old(); }; }
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.id === 'modalMask' && modalCloser) modalCloser();
    if (e.target.id === 'sheetMask') document.getElementById('sheetRoot').classList.add('hidden');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modalCloser) modalCloser(); });

  return {
    pad, todayStr, nowHM, dateAdd, daysBetween, weekdayCN, streak, esc, uid, clamp, pick, shuffle, rnd,
    $, $$, on, toast, modal, confirmBox, sheet, flyReward, confetti, fmtMoney, openCamera
  };
})();
