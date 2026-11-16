/* =========================================================
   PW · 数据同步（本地优先，云端可选）
   支持三种后端：
     1) supabase   —— Supabase Postgres（多端云同步，推荐）
     2) local-server —— 本地 Node 服务器 /api/state（调试用）
     3) local      —— 纯本地存储（file:// 或无网络时自动降级）
   ========================================================= */
PW.sync = (function () {
  let backend = 'local';   // 'local' | 'local-server' | 'supabase'
  let available = false;
  /* 默认 Supabase 后端（与 settings.v2.js 的 CORRECT_URL/CORRECT_ANON 一致）。
     用于在「用户填了同步密钥但 cloudConfig 缺 url/anon/enabled」时自动补全，
     避免只填密钥却始终本地模式、三端不同步。已显式配置的设备不受影响。 */
  var SUPABASE_URL = 'https://gaiazfyyzxbgvcfrzyxi.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_wA2JbGkqCwxO2fQduIr3XA_YkO9oE0m';
  let timer = null, busy = false, lastPush = 0;
  let _pollTimer = null, _lastRemoteAt = 0, _lastLocalPushAt = 0, _focusBound = false;
  let _lastSyncMsg = '';  // 最后同步状态信息，供 UI 调试
  let _lastPushError = '';  // 最近一次 push 失败的具体原因（HTTP 状态/异常），供 UI 诊断
  let _lastPullError = '';  // 最近一次 pull 失败的具体原因
  let _lastSyncAt = 0;     // 最近一次成功同步/拉取的时间

  function cfg() { return PW.store.state.config.cloudConfig || {}; }
  function familyCode() { return (PW.store.state.profile.syncKey || PW.store.state.profile.familyCode || '').trim(); }
  function canSupabase() {
    const c = cfg();
    return !!(c.enabled && c.url && c.anon && familyCode());
  }
  function headers() {
    const c = cfg();
    return { 'apikey': c.anon, 'Authorization': 'Bearer ' + c.anon, 'Content-Type': 'application/json' };
  }

  // 拉取到的云端数据做结构净化，防止个别字段（如 tasks）因历史原因不是数组导致渲染崩溃
  /* 需要合并（而非替换）的关键数组列表：
     每项格式 [字段名, 唯一ID字段]
     拉取云端数据时，这些数组做去重合并（以唯一ID为准），不直接覆盖本地 */
  var MERGE_ARRAYS = [
    ['quizRuns', 'id'],
    ['tasks', 'id'],       /* 按 date 分组的任务数组 */
    ['logs', 'at'],
    ['redemptions', 'id'],
    ['reading', 'at'],
    ['sports', 'at'],
    ['notifications', 'id']  /* 通知按ID合并，避免云端旧通知覆盖本地已删除的 */
  ];

  /* 合并两个数组（去重，以 idField 为唯一标识）：
     本地有但云端没有的 → 保留；云端有但本地没有的 → 追加；
     两端都有同 ID 的 → 取 updatedAt/at 较新的那条 */
  function mergeArrays(localArr, remoteArr, idField) {
    if (!Array.isArray(localArr)) localArr = [];
    if (!Array.isArray(remoteArr) || !remoteArr.length) return localArr;
    if (!localArr.length) return remoteArr.slice();
    /* 用 Map 做 O(n) 合并 */
    var map = new Map();
    localArr.forEach(function (item) {
      if (item && item[idField] != null) map.set(item[idField], item);
    });
    remoteArr.forEach(function (item) {
      if (!item || item[idField] == null) return;
      var existing = map.get(item[idField]);
      if (!existing) {
        map.set(item[idField], item);  /* 云端新增 */
      } else {
        /* 两端都有：保留较新的（updatedAt > at > 任意时间戳）。
           任务（id=任务）额外规则：若时间戳相同但一端已完成、另一端未完成，
           优先采用「已完成」版本——完成是更终态的状态，避免一端打勾后
           被另一端旧的无时间戳副本（done=False）覆盖，导致完成不同步。 */
        var localTime = existing.updatedAt || existing.at || 0;
        var remoteTime = item.updatedAt || item.at || 0;
        var takeRemote = remoteTime > localTime ||
          (remoteTime === localTime && item.done === true && existing.done !== true);
        var winner = takeRemote ? item : existing;
        var loser = takeRemote ? existing : item;
        /* 终态布尔 OR 合并：read 等单向标志，任一端为真即为真，
           避免一端已读被另一端未读旧副本覆盖（已读消息跨端不同步）。 */
        ['read'].forEach(function (f) {
          if (typeof winner[f] === 'boolean' && typeof loser[f] === 'boolean' && loser[f]) winner[f] = true;
        });
        if (takeRemote) map.set(item[idField], winner);
      }
    });
    /* 转回数组，按时间倒序（最新在前） */
    var merged = Array.from(map.values());
    merged.sort(function (a, b) { return (b.updatedAt || b.at || 0) - (a.updatedAt || a.at || 0); });
    return merged;
  }

  /* 合并两端 config：以 updatedAt 较新的一端为基准，
     再把另一端中带 id 的数组（customTasks、cashProducts）合并进来，
     防止 A 端改盲盒价、B 端加自定义任务时互相覆盖。
     无 id 的索引数组（rewards.readingTiers 等）直接取较新端，避免按 id 合并丢数据。 */
  function mergeConfig(localCfg, remoteCfg) {
    if (!localCfg || !remoteCfg) return JSON.parse(JSON.stringify(localCfg || remoteCfg || {}));
    var localTime = localCfg.updatedAt || 0;
    var remoteTime = remoteCfg.updatedAt || 0;
    var winner = JSON.parse(JSON.stringify(remoteTime >= localTime ? remoteCfg : localCfg));
    var loser = JSON.parse(JSON.stringify(remoteTime >= localTime ? localCfg : remoteCfg));
    var idFields = { customTasks: 'id', cashProducts: 'id' };
    Object.keys(loser).forEach(function (k) {
      if (Array.isArray(loser[k]) && Array.isArray(winner[k])) {
        var idField = idFields[k];
        if (idField) {
          winner[k] = mergeArrays(winner[k], loser[k], idField);
        }
        /* 无 id 的数组：winner 已是较新端，保留即可 */
      } else if (typeof loser[k] === 'object' && loser[k] !== null && !Array.isArray(loser[k]) &&
                 typeof winner[k] === 'object' && winner[k] !== null && !Array.isArray(winner[k])) {
        /* 嵌套对象（如 rewards、blindBoxConfig）：递归合并，保留较新端的标量，合并 id 数组 */
        winner[k] = mergeConfig(winner[k], loser[k]);
      }
    });
    winner.updatedAt = Math.max(localTime, remoteTime);
    return winner;
  }

  /* 按「日 key」合并计数映射（{ 'YYYY-MM-DD': n }）：两端各自发生过的都算数，取较大值。
     用于 _blindBoxDaily / _pokeballDaily，避免一端抽到后被另一端旧值覆盖回 0。 */
  function mergeDayMap(localM, remoteM) {
    var out = Object.assign({}, remoteM || {});
    Object.keys(localM || {}).forEach(function (k) {
      out[k] = Math.max(out[k] || 0, (localM || {})[k] || 0);
    });
    return out;
  }
  /* 深层按日合并（{ 'YYYY-MM-DD': { id: n } }），同端语义同 mergeDayMap。 */
  function mergeDayMapDeep(localM, remoteM) {
    var out = JSON.parse(JSON.stringify(remoteM || {}));
    Object.keys(localM || {}).forEach(function (day) {
      out[day] = out[day] || {};
      Object.keys((localM || {})[day] || {}).forEach(function (id) {
        out[day][id] = Math.max(out[day][id] || 0, (localM || {})[day][id] || 0);
      });
    });
    return out;
  }

  function sanitize(d) {
    if (!d || typeof d !== 'object') return d;
    /* tasks 是 { "2026-08-31": [task, ...], ... } 对象，绝不能用 Object.values 转成数组，
       否则多端合并时日期键丢失，当天任务只剩一条或全部消失。 */
    if (!d.tasks || typeof d.tasks !== 'object' || Array.isArray(d.tasks)) d.tasks = {};
    /* 过滤 tasks 中的非法日期键（历史脏数据 0,1,2…），只保留 YYYY-MM-DD 格式 */
    if (d.tasks && typeof d.tasks === 'object' && !Array.isArray(d.tasks)) {
      Object.keys(d.tasks).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) delete d.tasks[k];
      });
    }
    const arr = ['logs', 'notifications', 'quizRuns', 'redemptions', 'reading', 'sports', 'mistakes', 'trash', 'redeemLog', 'deletedSportIds', '_trashPurgedIds'];
    arr.forEach(function (f) {
      if (d[f] == null || !Array.isArray(d[f])) {
        if (d[f] && typeof d[f] === 'object') d[f] = Object.values(d[f]);
        else d[f] = [];
      }
    });
    if (d.config && d.config.customTasks != null && !Array.isArray(d.config.customTasks)) {
      d.config.customTasks = (typeof d.config.customTasks === 'object') ? Object.values(d.config.customTasks) : [];
    }
    return d;
  }

  function setStatus(text, cls) {
    const pill = document.getElementById('syncPill');
    const t = document.getElementById('syncText');
    if (!pill || !t) return;
    t.textContent = text;
    pill.className = 'sync-pill' + (cls ? ' ' + cls : '');
  }

  /* ---------------- Supabase 后端 ---------------- */
  async function pingSupabase() {
    try {
      const r = await fetch(cfg().url + '/rest/v1/pw_state?select=updated_at&family_code=eq.' +
        encodeURIComponent(familyCode()) + '&limit=1', { headers: headers(), cache: 'no-store' });
      return r.ok || r.status === 406;
    } catch (e) { return false; }
  }
  async function pullSupabase() {
    try {
      const r = await fetch(cfg().url + '/rest/v1/pw_state?family_code=eq.' +
        encodeURIComponent(familyCode()) + '&select=data,updated_at', { headers: headers(), cache: 'no-store' });
      if (!r.ok) { _lastPullError = 'pullSupabase HTTP ' + r.status; return null; }
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]) {
        _lastPullError = '';
        return { data: sanitize(rows[0].data), updatedAt: new Date(rows[0].updated_at).getTime() };
      }
      return null;
    } catch (e) { _lastPullError = 'pullSupabase: ' + (e && e.message || e); return null; }
  }
  /* 读-改-写：推送前先拉取云端，与本地做并集合并，再写回。
     避免「任一端直接覆盖云端整行」把其它设备刚录入/刚完成的作业冲掉——典型现象：
     网页端录入并完成作业，PAD 端看不到完成、手机端连录入都看不到。 */
  async function buildMergedPushData() {
    try {
      const pullFn = backend === 'supabase' ? pullSupabase : pullLocal;
      const remote = await pullFn();
      if (!remote) return PW.store.state;
      const rdata = remote.data || remote;
      if (!rdata || typeof rdata !== 'object') return PW.store.state;
      /* 只计算「云端 ∪ 本地」的并集用于上传，不回写本地：
         ① pull 是 await，期间用户可能又做了新修改，回写会把新改动覆盖掉；
         ② 每次 push 都 forceRender 会频繁重建 DOM，打断正在填写的表单
            （运动打卡类型被重置回跳绳就是这个原因）。
         本地会在下一次 5 秒轮询里自然收敛到这份并集。 */
      return mergeRemoteData(rdata);
    } catch (e) { return PW.store.state; }
  }
  /* 判断一份存档是否为「空档」：无宝可梦、无任务、无日志、无姓名，且钱包为初始 0。
     用于阻断「新设备空数据覆盖云端完整档案」的灾难性事故（2026-11-16 曾发生一次）。 */
  function isEmptyArchive(d) {
    if (!d || typeof d !== 'object') return true;
    const owned = (d.pet && d.pet.owned) || {};
    const tasks = d.tasks || {};
    const logs = d.logs || [];
    const name = (d.profile && d.profile.name || '').trim();
    const coins = d.wallet && d.wallet.coins;
    const stars = d.wallet && d.wallet.stars;
    return Object.keys(owned).length === 0 && Object.keys(tasks).length === 0 &&
      (!Array.isArray(logs) || logs.length === 0) && !name && !coins && !stars;
  }
  async function pushSupabase() {
    if (busy) return false;
    busy = true;
    try {
      const data = await buildMergedPushData();
      /* 硬护栏：本机为空档时，若云端同 key 已有实质数据，拒绝上传并改为拉取云端。
         杜绝新设备（自动生成新 key 或刚粘贴密钥但尚未拉到数据）把空档推上云。 */
      if (isEmptyArchive(data)) {
        const remote = await pullSupabase();
        if (remote && remote.data && !isEmptyArchive(remote.data)) {
          PW.store.replaceAll(remote.data);
          _lastRemoteAt = remote.updatedAt || 0;
          _lastPushError = ''; _lastPullError = '';
          setStatus('已阻止空档覆盖云端，改用云端数据', '');
          busy = false;
          return true;
        }
      }
      const payload = { family_code: familyCode(), data: data, updated_at: new Date().toISOString() };
      const r = await fetch(cfg().url + '/rest/v1/pw_state', {
        method: 'POST',
        headers: Object.assign(headers(), { 'Prefer': 'resolution=merge-duplicates, return=minimal' }),
        body: JSON.stringify(payload)
      });
      if (r.ok || r.status === 201 || r.status === 204) { lastPush = Date.now(); _lastLocalPushAt = Date.now(); _lastPushError = ''; setStatus('已同步到云端', ''); return true; }
      _lastPushError = 'pushSupabase HTTP ' + r.status;
      setStatus('同步失败（本地已存）', 'err'); return false;
    } catch (e) { _lastPushError = 'pushSupabase: ' + (e && e.message || e); setStatus('离线 · 本地已存', 'off'); return false; }
    finally { busy = false; }
  }

  /* ---------------- 本地 Node 服务器（兼容/调试） ---------------- */
  function userKey() {
    const code = familyCode();
    return code ? 'family_' + code.toLowerCase() : 'local_default';
  }
  async function pingLocal() {
    if (location.protocol === 'file:') return false;
    /* 关键修复：本地服务器后端仅用于本机调试（localhost / 127.0.0.1 / 局域网 IP）。
       公网静态托管（EdgeOne / CloudStudio / GitHub Pages 等）绝不能探测 /api/ping，
       否则宿主会把 SPA 兜底页当成 200 → 误判为 local-server → pullLocal/pushLocal 404，
       更严重的是新设备空数据会经 pushLocal 上传到错误的后端。 */
    const h = (location.hostname || '').toLowerCase();
    const isLocalHost = (h === 'localhost' || h === '127.0.0.1' || h === '::1' ||
      /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h));
    if (!isLocalHost) return false;
    try { const r = await fetch('/api/ping', { cache: 'no-store' }); if (!r.ok) return false; const j = await r.json(); return !!j.ok; }
    catch (e) { return false; }
  }
  async function pullLocal() {
    try {
      const r = await fetch('/api/state?user=' + encodeURIComponent(userKey()), { cache: 'no-store' });
      if (!r.ok) { _lastPullError = 'pullLocal HTTP ' + r.status; return null; }
      const j = await r.json();
      if (j && j.data) { _lastPullError = ''; return sanitize(j.data); }
      return null;
    } catch (e) { _lastPullError = 'pullLocal: ' + (e && e.message || e); return null; }
  }
  async function pushLocal() {
    if (busy) return false; busy = true;
    try {
      const data = await buildMergedPushData();
      const r = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: userKey(), data: data }) });
      busy = false;
      if (r.ok) { lastPush = Date.now(); _lastLocalPushAt = Date.now(); setStatus('已同步到服务器', ''); return true; }
      _lastPushError = 'pushLocal HTTP ' + r.status;
      setStatus('同步失败（本地已存）', 'err'); return false;
    } catch (e) { busy = false; _lastPushError = 'pushLocal: ' + (e && e.message || e); setStatus('离线 · 本地已存', 'off'); return false; }
  }

  /* ---------------- 调度 ---------------- */
  function schedule() {
    /* 后端按当前云端配置动态判定（不依赖启动时固定的 backend 变量，
       否则粘贴密钥后 backend 仍是 'local'，清空/改动永远传不上云） */
    if (canSupabase()) {
      setStatus('保存中…', '');
      clearTimeout(timer);
      timer = setTimeout(pushSupabase, 1200);
      return;
    }
    if (backend === 'local-server') {
      setStatus('保存中…', '');
      clearTimeout(timer);
      timer = setTimeout(pushLocal, 1200);
      return;
    }
    setStatus('本地已保存', 'off');
  }

  /* 页面重新可见时（从手机切回网页 / 从后台恢复），自动拉取云端最新数据 */
  let _visibilityHandler = null;
  function bindVisibilityPull() {
    if (_visibilityHandler) return;  /* 防重复绑定 */
    _visibilityHandler = true;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        /* 统一走 pollOnce：支持重连云端 + 合并最新数据 */
        pollOnce();
      }
    });
  }

  /* ---------------- 定时轮询：让常驻前台的 PAD/网页端也能实时同步 ----------------
     手机录入作业后会被 push 上云，但 PAD/网页端若一直开着、不刷新也不切后台，
     旧逻辑（仅 init 与 visibilitychange 拉取）不会主动拉取 → 看不到新数据。
     这里加一个轻量轮询 + 窗口聚焦即时拉取，保证多端最终一致。 */
  async function ensureCloud() {
    /* 如果已配置密钥但还没连云，尝试重连（解决打开页面时网络抖动导致永远本地模式） */
    if (available && backend !== 'local') return true;
    if (!canSupabase()) return false;
    const ok = await pingSupabase();
    if (ok) { available = true; backend = 'supabase'; cfg().enabled = true; return true; }
    return false;
  }
  async function pollOnce() {
    if (busy) return;
    /* 短暂跳过：本端刚 push 完 3 秒内不拉，避免自己推自己拉的闪屏；
       其它时间一律拉取，防止因本机/手机时间不同步导致漏掉对方更新。 */
    if (Date.now() - _lastLocalPushAt < 3000) return;
    const cloudOk = await ensureCloud();
    if (!cloudOk) { _lastSyncMsg = '本地模式（未连云）'; return; }
    const pullFn = backend === 'supabase' ? pullSupabase : pullLocal;
    const remote = await pullFn();
    if (!remote) { _lastSyncMsg = '拉取无响应'; return; }
    const rUpd = remote.updatedAt || 0;
    const local = PW.store.state;
    const rRst = (remote.data && remote.data._resetAt) || 0;
    const lRst = local._resetAt || 0;
    /* 统一走「合并」而非「覆盖」：
       合并是幂等并集（按 id 去重），只会补回本端缺失的数据，不会丢失本端编辑。
       因此无论云端时间戳新旧，都合并一次，保证多端必定收敛、互不丢数据。 */
    if (rRst > lRst) {
      // 云端更晚清空 → 采用云端清空态
      const merged = mergeRemoteData(remote.data || remote);
      PW.store.replaceAll(merged);
      _lastRemoteAt = Math.max(_lastRemoteAt, rUpd);
      _lastSyncAt = Date.now();
      _lastPullError = ''; _lastPushError = '';
      setStatus(backend === 'supabase' ? '已同步云端最新' : '已同步服务器最新', '');
      if (PW.app && PW.app.forceRender) PW.app.forceRender();
      pushUnion();
      return;
    }
    if (lRst > rRst) {
      // 本端更晚清空 → 保留本端清空态，并把清空传播到云端（让其它设备也清空）
      _lastRemoteAt = Math.max(_lastRemoteAt, rUpd);
      _lastSyncAt = Date.now();
      pushUnion();
      return;
    }
    const merged = mergeRemoteData(remote.data || remote);
    // 仅在确有差异时才替换+渲染+回推，避免每 5 秒无意义重绘
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      PW.store.replaceAll(merged);
      _lastRemoteAt = Math.max(_lastRemoteAt, rUpd);
      _lastSyncAt = Date.now();
      _lastSyncMsg = '已同步云端最新 ' + new Date().toLocaleTimeString();
      _lastPullError = ''; _lastPushError = '';
      setStatus(backend === 'supabase' ? '已同步云端最新' : '已同步服务器最新', '');
      if (PW.app && PW.app.forceRender) PW.app.forceRender();
      pushUnion();
    } else {
      _lastRemoteAt = Math.max(_lastRemoteAt, rUpd);
      _lastSyncAt = Date.now();
      _lastSyncMsg = '云端无更新 ' + new Date().toLocaleTimeString();
    }
  }
  function pushUnion() {
    /* 把「本端 + 刚拉取的云端」合并后的并集回推云端，保证多端最终一致：
       否则仅最后推送的设备数据留在云端，其它设备录入的内容永远到不了对端。 */
    const pushFn = backend === 'supabase' ? pushSupabase : pushLocal;
    pushFn();
  }
  function startPolling() {
    if (_pollTimer) return;
    _pollTimer = setInterval(pollOnce, 5000);  // 每 5 秒与云端对账一次
  }

  /* 将云端数据与本地数据做智能合并（关键数组去重合并不覆盖），
     返回一个适合传给 replaceAll 的合并后对象 */
  function mergeRemoteData(remoteData) {
    var local = PW.store.state;
    /* 跨端"从头开始"传播（双向） */
    var remoteResetAt = remoteData._resetAt || 0;
    var localResetAt = local._resetAt || 0;
    if (remoteResetAt > localResetAt) {
      /* 云端更晚清空 → 本端采用云端清空态 */
      return JSON.parse(JSON.stringify(remoteData));
    }
    if (localResetAt > remoteResetAt) {
      /* 本端更晚清空 → 保留本端清空态，不把云端旧数据合并回来（否则消息/任务等旧数据永远清不掉） */
      return JSON.parse(JSON.stringify(local));
    }
    var merged = JSON.parse(JSON.stringify(remoteData)); /* 深拷，不污染原数据 */

    /* 回收站合并：本地与他端删除记录取并集（按 trash.id 去重），再按"已清空"标记过滤掉清空前的旧记录，
       确保：①清空回收站后不会被旧数据覆盖恢复；②任一端新删除的内容都能在回收站看到（多端一致）。
       注意 trash 不在 MERGE_ARRAYS（结构特殊，按 trash.id 去重而非业务 id），需在此单独合并。 */
    var localEmptied = local._trashEmptiedAt || 0;
    var remoteEmptied = merged._trashEmptiedAt || 0;
    var emptiedAt = Math.max(localEmptied, remoteEmptied);
    /* 墓碑并集：两端「已彻底删除/清空」的回收站记录 id 取并集，命中即永不合并回来。
       这一层不依赖时间戳，能防住「清空后再删新记录导致标记被重置 → 旧记录复活」的 bug。 */
    var purgedSet = {};
    (Array.isArray(local._trashPurgedIds) ? local._trashPurgedIds : []).forEach(function (id) { if (id) purgedSet[id] = 1; });
    (Array.isArray(merged._trashPurgedIds) ? merged._trashPurgedIds : []).forEach(function (id) { if (id) purgedSet[id] = 1; });
    var trashMap = new Map();
    (Array.isArray(local.trash) ? local.trash : []).forEach(function (t) { if (t && t.id) trashMap.set(t.id, t); });
    (Array.isArray(merged.trash) ? merged.trash : []).forEach(function (t) { if (t && t.id) trashMap.set(t.id, t); });
    merged.trash = Array.from(trashMap.values()).filter(function (t) {
      return (t.at || 0) > emptiedAt && !purgedSet[t.id];
    });
    merged._trashEmptiedAt = emptiedAt;
    merged._trashPurgedIds = Object.keys(purgedSet).slice(-500);

    MERGE_ARRAYS.forEach(function (cfg) {
      var field = cfg[0], idField = cfg[1];
      if (Array.isArray(local[field]) && Array.isArray(merged[field])) {
        merged[field] = mergeArrays(local[field], merged[field], idField);
      }
      /* tasks 是按 date 分组的对象：{ "2026-08-15": [...], ... } */
      if (field === 'tasks' && typeof local.tasks === 'object' && typeof merged.tasks === 'object') {
        var allDates = new Set(Object.keys(local.tasks).concat(Object.keys(merged.tasks)).filter(function (d) {
          return /^\d{4}-\d{2}-\d{2}$/.test(d);
        }));
        var mergedTasks = {};
        allDates.forEach(function (d) {
          var lt = local.tasks[d] || [];
          var rt = merged.tasks[d] || [];
          var arr = mergeArrays(lt, rt, 'id');
          /* 历史随机 id 的重复任务实例会在 mergeArrays 中因 id 不同而被保留多条；
             这里再按 customId 去重，保证同一日期同一重复定义只有一条（取 mergeArrays 已排好的最新一条）。 */
          var seenCustomIds = new Set();
          mergedTasks[d] = arr.filter(function(t) {
            if (!t.customId) return true;
            if (seenCustomIds.has(t.customId)) return false;
            seenCustomIds.add(t.customId);
            return true;
          });
        });
        merged.tasks = mergedTasks;
      }
    });
    /* 墓碑合并：本地与他端删除的记录取并集，过滤掉已删除的任务实例，
       防止「删除后再同步」把已删任务拉回来 */
    var delTaskIds = new Set((local.deletedTaskIds || []).concat(merged.deletedTaskIds || []));
    var delCustomIds = new Set((local.deletedCustomIds || []).concat(merged.deletedCustomIds || []));
    if (delTaskIds.size || delCustomIds.size) {
      Object.keys(merged.tasks || {}).forEach(function (d) {
        var l = merged.tasks[d];
        if (!Array.isArray(l)) return;
        merged.tasks[d] = l.filter(function (t) {
          if (t.id && delTaskIds.has(t.id)) return false;
          if (t.customId && delCustomIds.has(t.customId)) return false;
          return true;
        });
      });
      merged.deletedTaskIds = Array.from(delTaskIds);
      merged.deletedCustomIds = Array.from(delCustomIds);
    }

    /* 运动打卡墓碑合并：本地与他端删除的运动 id 取并集，过滤 sports，
       避免「删除后同步」又把已删的运动记录拉回来 */
    var delSportIds = new Set((local.deletedSportIds || []).concat(merged.deletedSportIds || []));
    if (delSportIds.size && Array.isArray(merged.sports)) {
      merged.sports = merged.sports.filter(function (r) { return !(r.id && delSportIds.has(r.id)); });
      merged.deletedSportIds = Array.from(delSportIds);
    }

    /* 钱包合并：账本事件溯源。
       旧逻辑按 wallet.updatedAt 整包取较新端覆盖，会导致「扣罚」等减法事件被另一台
       还没收到扣罚、但 updatedAt 更晚的设备整包冲掉（星星扣了又涨回来）。
       现改为本地+云端账本按事件 id 取并集后重算余额，任何赚/花/扣事件都不会丢失。 */
    if (local.wallet && merged.wallet) {
      var wlMap = new Map();
      (local.wallet.ledger || []).concat(merged.wallet.ledger || []).forEach(function (e) {
        if (e && e.id) wlMap.set(e.id, e);
      });
      merged.wallet.ledger = Array.from(wlMap.values());
      if (PW.store && PW.store.recomputeWalletFromLedger) PW.store.recomputeWalletFromLedger(merged);
      else {
        /* 兜底：纯函数不可用时按 updatedAt 取较新端（旧行为，仅保险） */
        var localW2 = local.wallet.updatedAt || 0, mergedW2 = merged.wallet.updatedAt || 0;
        if (localW2 >= mergedW2) merged.wallet = JSON.parse(JSON.stringify(local.wallet));
      }
      merged.wallet.updatedAt = Math.max(local.wallet.updatedAt || 0, merged.wallet.updatedAt || 0);
    }

    /* 本地优先的标记/计数器合并：这些字段同步时不能用云端覆盖本地，否则本地改动被冲掉。
       - badges.claimed / megaClaimed：任一端领过即算领过（取并集），避免「领了又变可领」「重复领不发币」。
       - _blindBoxDaily / _pokeballDaily：按日取较大值（两端各自抽的都算数），避免一端抽到后被另一端覆盖回 0。 */
    if (local.badges || merged.badges) {
      var bL = local.badges || {}, bM = merged.badges || {};
      var claimedMerged = Object.assign({}, bM.claimed || {}, bL.claimed || {});
      var megaMerged = Object.assign({}, bM.megaClaimed || {});
      Object.keys(bL.megaClaimed || {}).forEach(function (k) {
        megaMerged[k] = Math.max(megaMerged[k] || 0, (bL.megaClaimed || {})[k] || 0);
      });
      merged.badges = merged.badges || {};
      merged.badges.claimed = claimedMerged;
      merged.badges.megaClaimed = megaMerged;
    }
    /* 兑换记录（redeemLog）：本地与他端取并集。
       该数组不在 MERGE_ARRAYS 中，若按「整包取较新端」处理，本端刚兑换生成的记录
       会在下一次 5 秒轮询拉取时被云端旧数据覆盖 → 现象是「兑换记录生成后又秒消失」。
       按 id 去重；历史数据中家长扣罚写入的记录没有 id，用 name+time+at+cost 兜底去重。 */
    (function mergeRedeemLog() {
      var rlMap = new Map();
      function rlKey(r) {
        if (!r || typeof r !== 'object') return null;
        if (r.id) return 'id:' + r.id;
        return 'k:' + (r.name || '') + '|' + (r.time || '') + '|' + (r.at || 0) + '|' + (r.cost || 0) + '|' + (r.icon || '');
      }
      (Array.isArray(merged.redeemLog) ? merged.redeemLog : []).forEach(function (r) {
        var k = rlKey(r); if (k && !rlMap.has(k)) rlMap.set(k, r);
      });
      (Array.isArray(local.redeemLog) ? local.redeemLog : []).forEach(function (r) {
        var k = rlKey(r); if (k) rlMap.set(k, r);   /* 同 key 时本地版本优先 */
      });
      var rlOut = Array.from(rlMap.values());
      rlOut.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      merged.redeemLog = rlOut.slice(0, 200);
    })();

    merged._blindBoxDaily = mergeDayMap(local._blindBoxDaily, merged._blindBoxDaily);
    merged._pokeballDaily = mergeDayMapDeep(local._pokeballDaily, merged._pokeballDaily);

    /* “本日/本周/本月/本年已发放”闸门（dailyItemRewardKey / dailySummaryDate /
       weeklyBonusKey / weeklyReportKey / monthlyReportKey / yearlyReportKey）：
       这些是「上次发放日期」标记，不能再简单用云端覆盖本地——否则本地刚发过奖励(=今)、
       云端若还是旧值(=空/昨)，合并后该标记被清回，下次活动又发一次（同日/同周重复发）。
       与 _blindBoxDaily 同理，取两端较晚的日期，保证任一端发过即认定「已发」。
       日期串（yyyy-mm-dd / yyyy-mm / yyyy）均可按字典序比较取较大者。 */
    var DATE_KEYS = ['dailyItemRewardKey', 'dailySummaryDate', 'weeklyBonusKey', 'weeklyReportKey', 'monthlyReportKey', 'yearlyReportKey'];
    DATE_KEYS.forEach(function (k) {
      var a = local[k] || '', b = merged[k] || '';
      merged[k] = (a >= b) ? a : b;
    });
    /* config 智能合并：盲盒价、自定义任务、零花钱兑换项等不再被旧端配置整体覆盖 */
    if (local.config && merged.config) {
      merged.config = mergeConfig(local.config, merged.config);
    }

    /* 宝可梦合并：照顾记录(care)、成长值(growth)、库存(inventory) 等需要跨端合并，
       不能简单用云端覆盖本地，否则 iPad 上做完喝水/洗澡，网页端一同步就会回退。
       策略：以 updatedAt 较新的一端为基础，再对 care/owned/inventory/dex 等做并集合并。 */
    if (local.pet && merged.pet) {
      var localHasPet = !!(local.pet.active || (local.pet.owned && Object.keys(local.pet.owned).length));
      var remoteHasPet = !!(merged.pet.active || (merged.pet.owned && Object.keys(merged.pet.owned).length));
      if (!remoteHasPet && localHasPet) {
        merged.pet = JSON.parse(JSON.stringify(local.pet));
      } else if (remoteHasPet) {
        var localPetUpdated = local.pet.updatedAt || 0;
        var remotePetUpdated = merged.pet.updatedAt || 0;
        var basePet = JSON.parse(JSON.stringify(localPetUpdated >= remotePetUpdated ? local.pet : merged.pet));
        var otherPet = localPetUpdated >= remotePetUpdated ? merged.pet : local.pet;

        // 集合型字段取并集：图鉴、装扮、已拥有装扮
        ['dexUnlocked', 'cosmeticsOwned'].forEach(function (field) {
          (otherPet[field] || []).forEach(function (id) { if (basePet[field].indexOf(id) < 0) basePet[field].push(id); });
        });

        // 已拥有的宠物：同 id 合并，取最大成长/阶段，合并喂养天数
        Object.keys(otherPet.owned || {}).forEach(function (id) {
          if (!basePet.owned[id]) { basePet.owned[id] = JSON.parse(JSON.stringify(otherPet.owned[id])); return; }
          var bp = basePet.owned[id];
          var op = otherPet.owned[id];
          if ((op.growth || 0) > (bp.growth || 0)) bp.growth = op.growth;
          if ((op.stage || 0) > (bp.stage || 0)) bp.stage = op.stage;
          if (op.feedDays) {
            op.feedDays.forEach(function (d) { if (bp.feedDays.indexOf(d) < 0) bp.feedDays.push(d); });
          }
          if (op.nickname && !bp.nickname) bp.nickname = op.nickname;
          if ((op.obtainedAt || 0) > (bp.obtainedAt || 0)) bp.obtainedAt = op.obtainedAt;
        });

        // 照顾记录按日期 + 宠物 id 合并：每只宝可梦独立记录，任一端做过的喝水/洗澡都保留（或）
        Object.keys(otherPet.care || {}).forEach(function (d) {
          var rec = otherPet.care[d];
          if (!rec) return;
          // 兼容旧格式 {petId, food, water, bath}
          var ocMap;
          if (rec.petId !== undefined) {
            ocMap = {};
            if (rec.petId) ocMap[rec.petId] = { food: !!rec.food, water: !!rec.water, bath: !!rec.bath };
          } else { ocMap = rec; }
          var baseMap = basePet.care[d];
          if (!baseMap) { basePet.care[d] = JSON.parse(JSON.stringify(ocMap)); return; }
          if (baseMap.petId !== undefined) {
            var m = {};
            if (baseMap.petId) m[baseMap.petId] = { food: !!baseMap.food, water: !!baseMap.water, bath: !!baseMap.bath };
            basePet.care[d] = m; baseMap = m;
          }
          Object.keys(ocMap).forEach(function (pid) {
            var orec = ocMap[pid] || {};
            if (!baseMap[pid]) baseMap[pid] = { food: false, water: false, bath: false };
            if (orec.food) baseMap[pid].food = true;
            if (orec.water) baseMap[pid].water = true;
            if (orec.bath) baseMap[pid].bath = true;
          });
        });

        // 库存：多端各自可能购买/奖励，取并集（最大值）保留所有获得；
        // 消耗端会更新 updatedAt，所以基础版本通常就是本端最新库存，这里仅补另一端的额外获得
        Object.keys(otherPet.inventory || {}).forEach(function (k) {
          var ov = otherPet.inventory[k] || 0;
          var bv = basePet.inventory[k] || 0;
          if (ov > bv) basePet.inventory[k] = ov;
        });

        // 装备：按宠物 id 合并装扮
        Object.keys(otherPet.equipped || {}).forEach(function (id) {
          var arr = basePet.equipped[id] || [];
          (otherPet.equipped[id] || []).forEach(function (cid) { if (arr.indexOf(cid) < 0) arr.push(cid); });
          basePet.equipped[id] = arr;
        });

        // 计数器取最大值
        basePet.boxCount = Math.max(basePet.boxCount || 0, otherPet.boxCount || 0);

        /* 进化自愈：补回被历史版本误删的“已进化旧形态”（如皮卡丘），保留原形态与进化形态
           两种伙伴，避免把皮卡丘从 owned 中删掉；并重新推导 evolveCount。 */
        if (PW.store && PW.store.healEvolvedPets) PW.store.healEvolvedPets(basePet);
        else basePet.evolveCount = (PW.store && PW.store.recomputeEvolveCount)
          ? PW.store.recomputeEvolveCount(basePet) : (basePet.evolveCount || 0);

        merged.pet = basePet;
      }
    }
    /* 通知去重（与回收站/他端生成无关，始终执行）：
       1) 同一 repKey（学习报告等周期消息）只留一条，防止多端各自生成导致重复；
       2) 过滤掉本地回收站中已删除的通知ID，防止同步拉回已删消息 */
    var seenRepKeys = new Set();
    merged.notifications = (merged.notifications || []).filter(function(n){
      if (n && n.repKey) {
        if (seenRepKeys.has(n.repKey)) return false;
        seenRepKeys.add(n.repKey);
      }
      return true;
    });
    var deletedNotifIds = new Set(
      (local.trash || []).filter(function(t){ return t && t.type === 'notification'; }).map(function(t){ return t.record && t.record.id; })
    );
    if (deletedNotifIds.size > 0) {
      merged.notifications = merged.notifications.filter(function(n){ return n && !deletedNotifIds.has(n.id); });
    }
    return merged;
  }

  async function init() {
    backend = 'local'; available = false;
    var restoredNewDevice = false;
    const c = cfg();
    const key = familyCode();
    /* 自动补全云端配置：若设备里已有同步密钥，但 cloudConfig 缺 url/anon/enabled
       （常见于只填过密钥、或旧配置被清空），用默认值补全并启用，保证自动联网同步。
       仅当确实缺失时才补；已正确配置的设备原样不变。 */
    if (key && (!c.url || !c.anon || !c.enabled)) {
      c.url = c.url || SUPABASE_URL;
      c.anon = c.anon || SUPABASE_ANON;
      c.enabled = true;
      try { PW.store.save(); } catch (e) {}
    }
    // 只要云端地址/密钥已配置，且存在同步密钥，就尝试自动启用云端同步
    // （不再要求每次手动点「应用并同步」；有密钥即自动联网）
    if ((c.enabled || key) && c.url && c.anon && key) {
      available = await pingSupabase();
      if (available) { backend = 'supabase'; c.enabled = true; PW.store.save(); }
    }
    if (!available && location.protocol !== 'file:') {
      const ok = await pingLocal();
      if (ok) { available = true; backend = 'local-server'; }
    }
    if (!available) { setStatus('本地模式（未连云）', 'off'); }
    else {
      const pullFn = backend === 'supabase' ? pullSupabase : pullLocal;
      const remote = await pullFn();
      const local = PW.store.state;
      if (remote) {
        /* 关键修复：启动即「合并」云端，绝不拿本端本地数据直接覆盖云端。
           历史上 init 的 else 分支会把本端（可能缺对方数据）原样推上云，
           把对方设备已录入的内容覆盖掉，导致「网页录入 PAD 收不到 / PAD 录入网页收不到」。 */
        const merged = mergeRemoteData(remote.data || remote);
        if (!local.profile.onboarded) {
          PW.store.replaceAll(merged);
          setStatus(backend === 'supabase' ? '已从云端恢复' : '已从服务器恢复', '');
          _lastRemoteAt = remote.updatedAt || 0;
          // 新设备：把合并结果（含本端可能已有的数据）回推云端，保证并集
          setTimeout(pushUnion, 500);
          // 标记"云端已恢复出完整档案"，boot() 据此跳过引导页直接进入应用；
          // 不再提前 return —— 继续到下方启动轮询，恢复后的设备也能实时同步
          restoredNewDevice = true;
        }
        PW.store.replaceAll(merged);
        setStatus('已自动同步云端最新数据', '');
        _lastRemoteAt = remote.updatedAt || 0;
        setTimeout(pushUnion, 500);
      } else {
        (backend === 'supabase' ? pushSupabase() : pushLocal());
      }
    }
    /* 关键修复（PAD 长期前台却不自动同步）：
       即便启动瞬间云端 ping 失败（网络抖动）导致 available=false、走上面"本地模式"分支，
       也必须启动轮询 + 可见性拉取 + 窗口聚焦拉取。pollOnce 内部会 ensureCloud() 自动重连，
       连上后立刻对账，无需用户手动点同步。仅在确实配置了同步（有 familyCode）时才轮询，
       避免纯本地单设备用户无谓空转。 */
    if (familyCode() || backend === 'local-server') {
      bindVisibilityPull();
      startPolling();
      if (!_focusBound) {
        _focusBound = true;
        window.addEventListener('focus', function () { pollOnce(); });
      }
    }
    return { restored: restoredNewDevice };
  }

  async function manual() {
    if (!canSupabase() && backend !== 'local-server') { PW.util.toast('当前未连接云端，数据已存在本机', 'warn'); setStatus('本地模式（未连云）', 'off'); return; }
    const ok = canSupabase() ? await pushSupabase() : await pushLocal();
    PW.util.toast(ok ? '同步成功！' : '同步失败，请稍后再试', ok ? 'good' : 'bad');
  }

  /** 在设置页切换/保存云端配置后，重新初始化同步 */
  async function reinit() {
    backend = 'local'; available = false;
    if (canSupabase()) {
      available = await pingSupabase();
      if (available) backend = 'supabase';
    }
    if (backend === 'supabase') { setStatus('已连接云端', ''); await pushSupabase(); }
    else setStatus('本地模式（未连云）', 'off');
    return backend === 'supabase';
  }

  return {
    init, schedule, manual, reinit, pollOnce,
    merge: mergeRemoteData,
    mergeConfig,
    push: function () { return canSupabase() ? pushSupabase() : pushLocal(); },
    pull: function () { return canSupabase() ? pullSupabase() : pullLocal(); },
    get available() { return available; },
    get backend() { return backend; },
    get lastRemoteAt() { return _lastRemoteAt; },
    get lastLocalPushAt() { return _lastLocalPushAt; },
    get lastSyncMsg() { return _lastSyncMsg; },
    get lastPushError() { return _lastPushError; },
    get lastPullError() { return _lastPullError; },
    get lastSyncAt() { return _lastSyncAt; },
    get connectionState() { return { backend, available, canSupabase: canSupabase() }; },
    setStatus
  };
})();
