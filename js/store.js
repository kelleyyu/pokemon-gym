/* =========================================================
   PW · 状态中心（本地持久化 + 奖励结算 + 统计 + 宠物成长）
   ========================================================= */
PW.store = (function () {
  const U = PW.util;
  const KEY = 'pw_state_v2';

  /* ---------------- 默认配置 ---------------- */
  function defaultConfig() {
    return {
      rewards: {
        homework: { coins: 10, stars: 2 },
        reading: { coins: 30, stars: 5 },
        sports: { coins: 30, stars: 5 },
        readingTiers: [{ coins: 30, stars: 5 }, { coins: 20, stars: 3 }, { coins: 10, stars: 2 }],
        sportsTiers: [{ coins: 30, stars: 5 }, { coins: 20, stars: 3 }, { coins: 10, stars: 2 }],
        quiz80: { coins: 5, stars: 0 },
        quiz90: { coins: 5, stars: 1 },
        quiz100: { coins: 10, stars: 2 }
      },
      quizDailyLimit: 2,
      quizCount: 20,
      homeworkDeadline: '21:30',
      blindBoxCost: 66,
      blindBoxConfig: {
        ratioPokemon: 28,
        ratioStar: 32,
        ratioConsumable: 30,
        ratioCoins: 10,
        coinMin: 40,
        coinMax: 120,
        starMin: 20,
        starMax: 60,
        consumableMin: 2,
        consumableMax: 4
      },
      cashProducts: [
        { id: 'cash1', stars: 25, cash: 1, name: '一枚硬币', icon: '💴' },
        { id: 'cash3', stars: 60, cash: 3, name: '一张钞票', icon: '💵' },
        { id: 'cash8', stars: 120, cash: 8, name: '几张钞票', icon: '💷' },
        { id: 'cash18', stars: 220, cash: 18, name: '一叠钞票', icon: '🧧' },
        { id: 'cash35', stars: 380, cash: 35, name: '一堆钞票', icon: '💎' },
        { id: 'cash60', stars: 550, cash: 60, name: '好多钞票', icon: '👑' }
      ],
      pin: '1234',
      customTasks: [],
      readingMinMinutes: 20,
      sportsMinMinutes: 20,
      childCanDeleteOwnTask: true,
      cloudConfig: {
        enabled: false,
        url: 'https://gaiazfyyzxbgvcfrzyxi.supabase.co',
        anon: 'sb_publishable_wA2JbGkqCwxO2fQduIr3XA_YkO9oE0m',
        familyCode: ''
      },
      aiConfig: {
        enabled: true,
        mode: 'proxy',
        endpoint: '',
        apiKey: '',
        model: 'deepseek-chat',
        systemPrompt: '',
        proxyUrl: 'https://gaiazfyyzxbgvcfrzyxi.supabase.co/functions/v1/ai-chat'
      },
      updatedAt: 0            // 配置变更时间戳，供多端同步时判断哪端配置更新
    };
  }

  function defaultState() {
    return {
      version: 2,
      updatedAt: 0,
      _resetAt: 0,
      profile: { name: '', age: 10, grade: 4, onboarded: false, createdAt: U.todayStr(), familyCode: '', syncKey: '' },
      wallet: { coins: 0, stars: 0, totalCoins: 0, totalStars: 0, updatedAt: 0, ledger: [] },
      config: defaultConfig(),
      tasks: {},          // { 'YYYY-MM-DD': [task] }
      reading: [],        // {id,date,book,minutes,thoughts,at}
      sports: [],         // {id,date,type,minutes,note,at}
      quizRuns: [],       // {id,date,correct,total,accuracy,coins,stars,band,at}
      badges: { claimed: {}, megaClaimed: {} },
      redemptions: [],
      pet: {
        active: '',
        owned: {},        // id: {growth, stage, feedDays:[], obtainedAt, nickname}
        dexUnlocked: [],
        cosmeticsOwned: [],
        equipped: {},     // petId: [cosmeticId]
        inventory: { berry: 2, water: 2, soap: 1, superBerry: 0, lunchBox: 0, vitaminWater: 0, energyDrink: 0, spaOil: 0, spaSalt: 0 },
        care: {},         // date: {petId, food, water, bath}
        evolveCount: 0,
        boxCount: 0,
        updatedAt: 0      // 宠物状态变更时间戳，供多端同步判断哪端最新
      },
      logs: [],
      notifications: [],     // {id,title,text,coins,stars,from,read,claimed,awarded,at}
      trash: [],              // 回收站：被删除的记录暂存，可恢复
      mistakes: [],           // 错题集：拍照检查中做错的题目
      redeemLog: [],           // 星星商店兑换记录（时间+内容）
      weeklyBonusKey: '',     // 已发放周全勤奖励的周一日期，避免重复发放
      dailyItemRewardKey: '', // 已发放每日任务道具奖励的日期
      dailySummaryDate: '',  // 已发送每日学习总结的日期
      weeklyReportKey: '',   // 已发送本周学习报告的周一日期
      monthlyReportKey: '',  // 已发送本月学习报告的 年-月
      yearlyReportKey: '',   // 已发送年度学习报告的 年
      dailyPokeballBought: {},  // 每日精灵球购买记录 { '2026-08-16': { pokeball:1, ultraball:0, masterball:0 } }
      dailyBlindBoxCount: 0,   // 今日已抽盲盒次数
      deletedTaskIds: [],      // 墓碑：已删除的任务实例 id（含一次性任务与"今天不显示"的重复实例）
      deletedCustomIds: [],     // 墓碑：已整组取消的重复任务定义 id
      deletedSportIds: [],     // 墓碑：已删除的运动打卡记录 id，防止删除后云端同步又把它拉回来
      _trashPurgedIds: [],     // 墓碑：回收站中被「彻底删除/清空」的记录 id（两端并集合并），防止旧记录被同步拉回
      _trashEmptiedAt: 0       // 上次清空回收站的时间戳（旧兜底机制，不再重置）
    };
  }

  let state = defaultState();
  const listeners = [];

  /* ---------------- 身份 cookie 备份（抗 iOS PWA 本地存储被清） ----------------
     PAD 端（iPad Safari / 主屏 PWA）在关闭后常因 iOS 存储清理机制丢失 localStorage，
     导致 syncKey、onboarded、PIN、云配置一并消失，重开即回到引导页、需重新粘贴密钥。
     这里把"身份类"小数据镜像到 cookie（含 1 年有效期），localStorage 被清时据此自动
     重连云端并拉取最新数据，无需手动再贴密钥。cookie 仅存身份，不存业务数据（过大且
     云端才是真源）。 */
  function setCookie(name, value, days) {
    try {
      var d = new Date();
      d.setTime(d.getTime() + days * 24 * 3600 * 1000);
      document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
    } catch (e) {}
  }
  function getCookie(name) {
    try {
      var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : '';
    } catch (e) { return ''; }
  }
  function persistIdentity() {
    try {
      var c = state.config || {};
      var cc = c.cloudConfig || {};
      var blob = {
        v: 1,
        syncKey: state.profile.syncKey || '',
        familyCode: state.profile.familyCode || state.profile.syncKey || '',
        onboarded: !!state.profile.onboarded,
        name: state.profile.name || '',
        age: state.profile.age,
        grade: state.profile.grade,
        pin: (c.pin != null ? c.pin : ''),
        cloudEnabled: !!cc.enabled,
        cloudUrl: cc.url || '',
        cloudAnon: cc.anon || ''
      };
      setCookie('pw_ident', JSON.stringify(blob), 365);
    } catch (e) {}
  }
  function restoreIdentity() {
    try {
      /* 本地已有密钥则无需回退（避免用旧 cookie 覆盖本机更新的 PIN 等） */
      if (state.profile.syncKey) return;
      var raw = getCookie('pw_ident');
      if (!raw) return;
      var b = JSON.parse(raw);
      if (!b || !b.syncKey) return;
      state.profile.syncKey = b.syncKey;
      state.profile.familyCode = b.familyCode || b.syncKey;
      state.profile.onboarded = !!b.onboarded;
      if (b.name) state.profile.name = b.name;
      if (b.age) state.profile.age = b.age;
      if (b.grade) state.profile.grade = b.grade;
      if (b.pin != null && b.pin !== '' && state.config) state.config.pin = b.pin;
      if (b.cloudEnabled && b.cloudUrl && b.cloudAnon && state.config) {
        state.config.cloudConfig = { enabled: true, url: b.cloudUrl, anon: b.cloudAnon };
      }
    } catch (e) {}
  }

  /* ---------------- 读写 ---------------- */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const oldEmptied = state._trashEmptiedAt; // 保留内存中的清空标记
        state = merge(defaultState(), parsed);
        // 如果之前清空过且新数据没有更新的清空标记，保持回收站为空
        if (oldEmptied && (!parsed._trashEmptiedAt || parsed._trashEmptiedAt < oldEmptied)) {
          state.trash = [];
          state._trashEmptiedAt = oldEmptied;
        }
        // 旧数据没有 config.updatedAt 时补 0，避免同步时误判为"最新"
        if (state.config && state.config.updatedAt == null) state.config.updatedAt = 0;
        // 清理历史脏数据：tasks 只应是 { "YYYY-MM-DD": [...] }，
        // 旧版本曾把任务存到数字键（0,1,2…）下，统计时会把这些非法键当日期计入，拉低完成率。
        // 每次加载都过滤掉非日期格式的键，确保本地与同步数据干净。
        if (state.tasks && typeof state.tasks === 'object') {
          Object.keys(state.tasks).forEach(function (k) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) delete state.tasks[k];
          });
        }
      }
      /* 钱包账本迁移：老数据无 ledger 时按当前余额播种一条快照 */
      ensureWalletLedger();
      recomputeWallet();
      /* 由 owned 重新推导真实进化次数 */
      state.pet.evolveCount = recomputeEvolveCount(state.pet);
      /* 自愈：补回被历史版本误删的“已进化的旧形态”（如皮卡丘），使其可继续作为伙伴切换 */
      healEvolvedPets(state.pet);
      /* 一次性补发存量已达“最高形态 + 成长满”的宝可梦 10 星奖励 */
      grantMaxedRewards();
    } catch (e) { console.warn('读取本地数据失败', e); }
    /* localStorage 被清时，从 cookie 恢复身份（syncKey/PIN/云配置），使启动可自动重连云端 */
    restoreIdentity();
    return state;
  }
  function merge(base, patch) {
    if (patch == null || typeof patch !== 'object') return base;
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = merge(base[k], v);
      } else if (v !== undefined) base[k] = v;
    });
    return base;
  }
  function save(opt) {
    /* noBump：仅静默落盘，不更新 updatedAt，也不触发同步调度。
       用于 tasksOf 注入重复任务实例等"派生状态"，避免把本地时间戳顶到比云端新，
       导致刚打开页面时漏掉对方设备推送的最新数据。 */
    if (!(opt && opt.noBump)) {
      state.updatedAt = Date.now();
      if (PW.sync && PW.sync.schedule) PW.sync.schedule();
      /* 关键写操作兜底：云端可用就立即推送一次，避免只靠 5 秒轮询/本地模式导致"完成未同步" */
      if (PW.sync && PW.sync.push) { try { PW.sync.push(); } catch (e) {} }
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('保存失败', e); }
    persistIdentity();
    if (!(opt && opt.silent)) emit();
  }
  function replaceAll(next) {
    state = merge(defaultState(), next || {});
    /* 回收站"已清空"保护：双重过滤——
       ①不在墓碑 _trashPurgedIds 中（已彻底删除/清空的 id 永不恢复）；
       ②在清空时间点之后删除（保留清空后新删的内容）。 */
    var emptiedAt = state._trashEmptiedAt || 0;
    var purged = Array.isArray(state._trashPurgedIds) ? state._trashPurgedIds : [];
    if ((emptiedAt || purged.length) && Array.isArray(state.trash)) {
      state.trash = state.trash.filter(function (t) {
        return (t.at || 0) > emptiedAt && purged.indexOf(t.id) < 0;
      });
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    persistIdentity();
    emit();
  }
  /* 配置变更时更新时间戳，供多端同步判断哪端配置更新 */
  function touchConfig() {
    if (!state.config) state.config = defaultConfig();
    state.config.updatedAt = Date.now();
  }

  function resetAll() {
    state = defaultState();
    localStorage.removeItem(KEY);
    emit();
  }

  function on(fn) { listeners.push(fn); }
  function emit() { listeners.forEach((f) => { try { f(state); } catch (e) { console.warn(e); } }); }

  /* ---------------- 日志 & 奖励 ---------------- */
  function touchWallet() { state.wallet.updatedAt = Date.now(); }

  /* ---------------- 钱包账本（事件溯源，防多端同步丢扣罚/丢奖励） ----------------
     余额不再直接加减，而是记录每一笔"赚/花/扣/重置"事件，由账本重算得出。
     多端同步时账本按事件 id 取并集（而非整钱包按 updatedAt 取较新端覆盖），
     因此"扣罚"这类减法事件不会被另一台还没收到扣罚、但 updatedAt 更晚的设备整包冲掉。 */
  function ensureWalletLedger() {
    if (!state.wallet) state.wallet = { coins: 0, stars: 0, totalCoins: 0, totalStars: 0, updatedAt: 0, ledger: [] };
    if (!Array.isArray(state.wallet.ledger)) state.wallet.ledger = [];
    /* 迁移：老数据无账本 → 用当前余额生成一条固定 id('seed') 的快照。
       固定 id 保证多端各自首次播种时并集成同一条，不会重复计数。 */
    if (state.wallet.ledger.length === 0) {
      state.wallet.ledger.push({
        id: 'seed', type: 'snapshot',
        coins: state.wallet.coins || 0, stars: state.wallet.stars || 0,
        totalCoins: state.wallet.totalCoins || 0, totalStars: state.wallet.totalStars || 0, at: 0
      });
    }
  }
  /* 纯函数：根据 obj.wallet.ledger 重算余额（可作用于任意对象，供 sync 合并使用） */
  function recomputeWalletFromLedger(obj) {
    if (!obj || !obj.wallet) return;
    var w = obj.wallet, L = w.ledger || [];
    var snap = { coins: 0, stars: 0, totalCoins: 0, totalStars: 0 };
    for (var i = 0; i < L.length; i++) {
      var e = L[i]; if (!e) continue;
      if (e.type === 'snapshot') {
        snap.coins += (e.coins || 0); snap.stars += (e.stars || 0);
        snap.totalCoins += (e.totalCoins || 0); snap.totalStars += (e.totalStars || 0);
      } else if (e.type === 'reset') {
        snap = { coins: 0, stars: 0, totalCoins: 0, totalStars: 0 };
      } else if (e.type === 'earn') {
        snap.coins += (e.coins || 0); snap.stars += (e.stars || 0);
        snap.totalCoins += (e.coins || 0); snap.totalStars += (e.stars || 0);
      } else if (e.type === 'spend') {
        snap.coins -= (e.coins || 0); snap.stars -= (e.stars || 0);
      } else if (e.type === 'deduct') {
        snap.stars -= (e.stars || 0); snap.totalStars -= (e.stars || 0);
      }
    }
    w.coins = Math.max(0, Math.round(snap.coins));
    w.stars = Math.max(0, Math.round(snap.stars));
    w.totalCoins = Math.max(0, Math.round(snap.totalCoins));
    w.totalStars = Math.max(0, Math.round(snap.totalStars));
  }
  function recomputeWallet() { ensureWalletLedger(); recomputeWalletFromLedger(state); }
  /* 追加一笔钱包事件并重算（不直接加减，保证账本与余额一致） */
  function appendWallet(type, delta, note, idOpt) {
    ensureWalletLedger();
    /* 确定性 id（如 notif-xxx / badge-xxx）：同一事件只记一次，杜绝多端重复领取导致双倍发放 */
    if (idOpt) {
      for (var li = 0; li < state.wallet.ledger.length; li++) {
        if (state.wallet.ledger[li].id === idOpt) return state.wallet.ledger[li];
      }
    }
    var entry = { id: idOpt || U.uid('w'), type: type, at: Date.now(), note: note || '' };
    if (delta.coins) entry.coins = delta.coins;
    if (delta.stars) entry.stars = delta.stars;
    state.wallet.ledger.push(entry);
    recomputeWalletFromLedger(state);
    state.wallet.updatedAt = Date.now();
    return entry;
  }
  function touchPet() { state.pet.updatedAt = Date.now(); }
  function log(type, text, coins, stars) {
    state.logs.unshift({ at: Date.now(), date: U.todayStr(), type, text, coins: coins || 0, stars: stars || 0 });
    if (state.logs.length > 300) state.logs.length = 300;
  }
  function award(coins, stars, reason, anchor, idOpt) {
    coins = Math.max(0, Math.round(coins || 0));
    stars = Math.max(0, Math.round(stars || 0));
    appendWallet('earn', { coins: coins, stars: stars }, reason, idOpt);
    if (coins || stars) log('award', reason || '获得奖励', coins, stars);
    save();
    if (coins || stars) U.flyReward(coins, stars, anchor);
    bumpWallet();
    return { coins, stars };
  }
  function bumpWallet() {
    ['walletCoin', 'walletStar'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('pop');
      void el.offsetWidth;
      el.classList.add('pop');
    });
  }
  function spend(coins, stars, reason) {
    coins = coins || 0; stars = stars || 0;
    if (state.wallet.coins < coins) return { ok: false, msg: '金币不够啦，再去做几项任务吧！' };
    if (state.wallet.stars < stars) return { ok: false, msg: '星星不够哦，继续加油攒星星～' };
    appendWallet('spend', { coins: coins, stars: stars }, reason);
    log('spend', reason || '消费', -coins, -stars);
    save();
    return { ok: true };
  }

  /* ---------------- 今日任务 ---------------- */
  function todayKey() { return U.todayStr(); }

  function customTaskDue(ct, dateStr) {
    if (ct.active === false) return false;
    if (ct.skipDates && ct.skipDates.indexOf(dateStr) >= 0) return false;
    const p = dateStr.split('-');
    const d = new Date(+p[0], +p[1] - 1, +p[2]);
    const wd = d.getDay();          // 0=周日 .. 6=周六
    const day = d.getDate();        // 1..31
    const month = d.getMonth() + 1; // 1..12
    switch (ct.repeat) {
      case 'daily': return true;
      case 'weekdays': return wd >= 1 && wd <= 5;
      case 'weekend': return wd === 0 || wd === 6;
      case 'once': return ct.date === dateStr;
      case 'week': return (ct.days || []).indexOf(wd) >= 0;
      case 'month': return day === clampMonthDay(ct.monthDay, month, +p[0]);
      case 'quarter': return [1, 4, 7, 10].indexOf(month) >= 0 && day === clampMonthDay(ct.monthDay, month, +p[0]);
      case 'year': return month === (ct.month || 1) && day === clampMonthDay(ct.monthDay, month, +p[0]);
      default: return false;
    }
  }
  function clampMonthDay(md, month, year) {
    md = parseInt(md, 10) || 1;
    if (md < 1) md = 1;
    const max = new Date(year, month, 0).getDate(); // 该月天数
    if (md > max) md = max;
    return md;
  }

  /** 获取某天任务列表（自动注入家长自定义任务） */
  function tasksOf(dateStr) {
    dateStr = dateStr || todayKey();
    if (!state.tasks[dateStr]) state.tasks[dateStr] = [];
    let list = state.tasks[dateStr];
    let changed = false;
    const delTaskIds = new Set(state.deletedTaskIds || []);
    const delCustomIds = new Set(state.deletedCustomIds || []);

    /* 墓碑过滤：剔除本地或他端已删除/跳过的实例，避免同步拉回旧数据复活 */
    const filtered = list.filter((t) => {
      if (t.id && delTaskIds.has(t.id)) return false;
      if (t.customId && delCustomIds.has(t.customId)) return false;
      return true;
    });
    if (filtered.length !== list.length) { state.tasks[dateStr] = filtered; list = filtered; changed = true; }

    /* 清理同一日期下同一重复定义的重复实例（旧版用随机 id，多端同步后会出现两条）。
       保留：已完成优先，否则 createdAt/finishedTs 最新的一条。 */
    const bestByCustomId = new Map();
    const survivors = [];
    list.forEach((t) => {
      if (!t.customId) { survivors.push(t); return; }
      const cur = bestByCustomId.get(t.customId);
      if (!cur) {
        bestByCustomId.set(t.customId, t);
        survivors.push(t);
        return;
      }
      changed = true;
      const score = (x) => (x.done ? 2e15 : 0) + (x.finishedTs || x.createdAt || 0);
      if (score(t) > score(cur)) {
        const idx = survivors.indexOf(cur);
        if (idx >= 0) survivors[idx] = t;
        bestByCustomId.set(t.customId, t);
      }
    });
    if (changed) {
      list = state.tasks[dateStr] = survivors;
    }

    (state.config.customTasks || []).forEach((ct) => {
      if (delCustomIds.has(ct.id)) return;                 // 整组已取消 → 不再注入
      if (!customTaskDue(ct, dateStr)) return;
      const instId = 'ct_' + ct.id + '_' + dateStr;
      if (delTaskIds.has(instId)) return;                  // 该天被"今天不显示"墓碑 → 不再注入
      if (list.some((t) => t.customId === ct.id || t.id === instId)) return;
      /* 重复任务实例使用确定性 id：所有设备同一天对同一自定义任务生成相同 id，
         云端按 id 合并时自然去重，不会再出现多条。 */
      list.push({
        id: instId, customId: ct.id, title: ct.title, subject: ct.subject || 'other',
        tag: ct.tag || 'home', done: false, doneAt: '', feeling: '', note: '',
        locked: ct.locked !== false, source: ct.source || (ct.locked === false ? 'manual' : 'parent'),
        repeat: ct.repeat, createdAt: Date.now()
      });
      changed = true;
    });
    if (changed) save({ silent: true, noBump: true });
    return list;
  }

  function addTasks(items, dateStr) {
    dateStr = dateStr || todayKey();
    const list = tasksOf(dateStr);
    let n = 0;
    (items || []).forEach((it) => {
      if (!it.title || !String(it.title).trim()) return;
      list.push({
        id: U.uid('t'), title: String(it.title).trim().slice(0, 120),
        subject: it.subject || 'other', tag: it.tag || 'school',
        done: false, doneAt: '', feeling: '', note: '',
        locked: false, source: it.source || 'manual', createdAt: Date.now(), updatedAt: Date.now()
      });
      n++;
    });
    save();
    return n;
  }

  function updateTask(id, patch, dateStr) {
    const list = tasksOf(dateStr);
    const t = list.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, patch);
    if (patch.updatedAt == null) t.updatedAt = Date.now();
    save();
    return t;
  }
  /* 墓碑：记录已删除的实例/定义，使其跨端同步后也不再复活 */
  function recordDelete(id) {
    if (!id) return;
    state.deletedTaskIds = state.deletedTaskIds || [];
    if (state.deletedTaskIds.indexOf(id) < 0) state.deletedTaskIds.push(id);
  }
  function recordDeleteCustom(customId) {
    if (!customId) return;
    state.deletedCustomIds = state.deletedCustomIds || [];
    if (state.deletedCustomIds.indexOf(customId) < 0) state.deletedCustomIds.push(customId);
  }
  function recordDeleteSport(id) {
    if (!id) return;
    state.deletedSportIds = state.deletedSportIds || [];
    if (state.deletedSportIds.indexOf(id) < 0) state.deletedSportIds.push(id);
  }
  function removeSports(id) {
    const i = state.sports.findIndex((x) => x.id === id);
    if (i < 0) return null;
    const rec = state.sports.splice(i, 1)[0];
    recordDeleteSport(id);
    trashRecord('sports', rec);
    save();
    return rec;
  }
  function removeTask(id, dateStr, opts) {
    dateStr = dateStr || todayKey();
    const list = tasksOf(dateStr);
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return false;
    if (list[i].locked && !(opts && opts.force)) return false;
    list.splice(i, 1);
    recordDelete(id);   // 墓碑：本地删除后，跨端同步也不再把它拉回来
    save();
    return true;
  }
  /** 新增一条"重复任务"定义（孩子侧添加，不锁定、可自己完成/删除）。返回新增条数 */
  function addRecurringTask(def) {
    if (!def || !def.title || !String(def.title).trim()) return 0;
    const ct = {
      id: U.uid('ct'),
      title: String(def.title).trim().slice(0, 120),
      subject: def.subject || 'other',
      tag: def.tag || 'home',
      repeat: def.repeat,
      active: true,
      locked: false,
      source: 'manual'
    };
    if (ct.repeat === 'week') {
      ct.days = Array.isArray(def.days) ? def.days.map(Number) : [];
      if (!ct.days.length) return 0;
    } else if (ct.repeat === 'month') {
      ct.monthDay = parseInt(def.monthDay, 10) || new Date().getDate();
    } else if (ct.repeat === 'quarter') {
      ct.monthDay = parseInt(def.monthDay, 10) || 1;
    } else if (ct.repeat === 'year') {
      ct.month = parseInt(def.month, 10) || (new Date().getMonth() + 1);
      ct.monthDay = parseInt(def.monthDay, 10) || new Date().getDate();
    } else if (ct.repeat === 'once') {
      ct.date = def.date || U.todayStr();
    }
    state.config.customTasks.push(ct);
    touchConfig();
    save();
    return 1;
  }
  /** 删除整个重复任务定义（不再出现在任何一天） */
  function removeRecurringDef(customId) {
    const arr = state.config.customTasks || [];
    const i = arr.findIndex((x) => x.id === customId);
    if (i < 0) return false;
    const item = arr.splice(i, 1)[0];
    trashRecord('customTask', item);
    // 清掉所有日期下该重复定义注入的实例（不只当天），否则其它天仍残留、跨端同步后又复活
    Object.keys(state.tasks).forEach((d) => {
      const l = state.tasks[d];
      if (!Array.isArray(l)) return;
      state.tasks[d] = l.filter((t) => t.customId !== customId);
    });
    recordDeleteCustom(customId);   // 墓碑：整组取消后，跨端同步也不再重新注入
    save();
    return true;
  }
  /** 某天"不显示"这条重复任务（不影响其它天，也不删除定义） */
  function skipRecurringDay(customId, dateStr) {
    const ct = (state.config.customTasks || []).find((x) => x.id === customId);
    if (!ct) return false;
    ct.skipDates = ct.skipDates || [];
    if (ct.skipDates.indexOf(dateStr) < 0) ct.skipDates.push(dateStr);
    // 同时移除当天已注入的实例：否则 tasksOf 因 customId 已存在而不再重新注入，
    // 但旧实例仍残留在 state.tasks[date] 中，"今天不显示"在界面上删不掉
    const list = state.tasks[dateStr];
    if (Array.isArray(list)) {
      const i = list.findIndex((x) => x.customId === customId);
      if (i >= 0) {
        const removedId = list[i].id;
        list.splice(i, 1);
        if (removedId) recordDelete(removedId);  // 墓碑该天实例，跨端同步也不再复活
      }
    }
    save();
    return true;
  }
  /** 重复规则的可读说明（具体到周几/几号） */
  function repeatDetail(ct) {
    if (!ct) return '';
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    switch (ct.repeat) {
      case 'daily': return '每天';
      case 'weekdays': return '仅上学日（周一至周五）';
      case 'weekend': return '仅周末';
      case 'once': return '仅 ' + (ct.date || '');
      case 'week': {
        const ds = (ct.days || []).slice().sort((a, b) => a - b).map((d) => names[d] || '').filter(Boolean);
        return '每' + (ds.length ? ds.join('、') : '周');
      }
      case 'month': return '每月 ' + clampMonthDay(ct.monthDay, new Date().getMonth() + 1, new Date().getFullYear()) + ' 号';
      case 'quarter': return '每季度首月（1/4/7/10 月）' + clampMonthDay(ct.monthDay, 1, new Date().getFullYear()) + ' 号';
      case 'year': return '每年 ' + (ct.month || 1) + ' 月 ' + clampMonthDay(ct.monthDay, ct.month || 1, new Date().getFullYear()) + ' 号';
      default: return '';
    }
  }

  /* ---------------- 回收站（删除暂存，可恢复） ---------------- */
  function trashRecord(type, record, extra) {
    var tid = U.uid('trash');
    state.trash.push({ id: tid, type, record, date: (extra && extra.date) || '', at: Date.now() });
    /* ⚠️ 此处绝不可重置 _trashEmptiedAt（历史 bug）：
       重置会让清空墓碑失效，之后云端旧记录在同步并集时被拉回 → "清空后文件又恢复"。
       新删记录靠「不在 _trashPurgedIds」保留，无需动清空标记。 */
    if (!Array.isArray(state._trashPurgedIds)) state._trashPurgedIds = [];
    var pi = state._trashPurgedIds.indexOf(tid);
    if (pi >= 0) state._trashPurgedIds.splice(pi, 1);
    save();
    return true;
  }
  function getTrash() { if (!Array.isArray(state.trash)) state.trash = []; return state.trash; }
  function restoreTrash(id) {
    const i = state.trash.findIndex((t) => t.id === id);
    if (i < 0) return false;
    const t = state.trash[i];
    if (t.type === 'task') {
      const d = t.date || todayKey();
      const rec = t.record || {};
      (state.tasks[d] = state.tasks[d] || []).push(rec);
      /* 取消墓碑：否则 tasksOf 会因 deletedTaskIds 含该 id 而立即过滤掉，
         恢复后任务又瞬间消失，看起来"恢复无效" */
      if (rec.id && state.deletedTaskIds) {
        const k = state.deletedTaskIds.indexOf(rec.id);
        if (k >= 0) state.deletedTaskIds.splice(k, 1);
      }
    } else if (t.type === 'reading') {
      state.reading.unshift(t.record);
    } else if (t.type === 'sports') {
      state.sports.unshift(t.record);
      /* 取消运动墓碑：否则 sync 合并会再次过滤掉这条恢复的记录 */
      if (t.record && t.record.id && state.deletedSportIds) {
        const k = state.deletedSportIds.indexOf(t.record.id);
        if (k >= 0) state.deletedSportIds.splice(k, 1);
      }
    } else if (t.type === 'customTask') {
      state.config.customTasks.push(t.record);
      touchConfig();
      /* 取消整组墓碑，否则 tasksOf 不再注入该重复定义 */
      if (t.record && t.record.id && state.deletedCustomIds) {
        const k = state.deletedCustomIds.indexOf(t.record.id);
        if (k >= 0) state.deletedCustomIds.splice(k, 1);
      }
    } else if (t.type === 'notification') {
      /* 恢复消息通知：重新插回通知列表（按时间倒序排最前） */
      state.notifications.unshift(t.record);
    }
    state.trash.splice(i, 1);
    /* 同样不可重置 _trashEmptiedAt（见 trashRecord 注释）；该 id 若曾在墓碑中则移除 */
    if (!Array.isArray(state._trashPurgedIds)) state._trashPurgedIds = [];
    var ti = state._trashPurgedIds.indexOf(id);
    if (ti >= 0) state._trashPurgedIds.splice(ti, 1);
    save();
    return true;
  }
  function purgeTrash(id) {
    const i = state.trash.findIndex((t) => t.id === id);
    if (i < 0) return false;
    state.trash.splice(i, 1);
    /* 记入墓碑：防止他端同步时把这条已彻底删除的记录合并回来 */
    if (!Array.isArray(state._trashPurgedIds)) state._trashPurgedIds = [];
    if (state._trashPurgedIds.indexOf(id) < 0) state._trashPurgedIds.push(id);
    if (state._trashPurgedIds.length > 500) state._trashPurgedIds = state._trashPurgedIds.slice(-500);
    save();
    return true;
  }
  function emptyTrash() {
    /* 清空前把当前所有记录 id 记入墓碑（两端并集合并），
       这样即使他端仍持有旧 trash，同步合并时也会被墓碑过滤掉，不再"复活"。 */
    if (!Array.isArray(state._trashPurgedIds)) state._trashPurgedIds = [];
    (Array.isArray(state.trash) ? state.trash : []).forEach(function (t) {
      if (t && t.id && state._trashPurgedIds.indexOf(t.id) < 0) state._trashPurgedIds.push(t.id);
    });
    if (state._trashPurgedIds.length > 500) state._trashPurgedIds = state._trashPurgedIds.slice(-500);
    state.trash = [];
    state._trashEmptiedAt = Date.now(); // 旧兜底机制保留
    save();
    /* 自动推送到云端，确保已删除的记录在云端也清除 */
    if (PW.sync && PW.sync.schedule) PW.sync.schedule();
  }

  /* ---------------- 错题集（拍照检查做错的题目） ---------------- */
  function addMistake(record) {
    if (!record) return null;
    record.id = record.id || ('mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
    record.at = record.at || Date.now();
    record.date = record.date || todayKey();
    record.fixed = false;
    state.mistakes.unshift(record);
    if (state.mistakes.length > 500) state.mistakes.length = 500;
    save();
    return record;
  }
  function getMistakes(subject) {
    var list = state.mistakes || [];
    if (subject && subject !== 'all') list = list.filter(function (m) { return m.subject === subject; });
    return list;
  }
  function fixMistake(id) {
    var m = state.mistakes.find(function (x) { return x.id === id; });
    if (m) { m.fixed = true; m.fixedAt = Date.now(); save(); return true; }
    return false;
  }
  function toggleMistake(id) {
    var m = state.mistakes.find(function (x) { return x.id === id; });
    if (!m) return false;
    if (m.fixed) { m.fixed = false; delete m.fixedAt; }
    else { m.fixed = true; m.fixedAt = Date.now(); }
    save();
    return !m.fixed; /* 返回切换后的状态：true=刚取消掌握，false=刚标记掌握 */
  }
  function deleteMistake(id) {
    var i = state.mistakes.findIndex(function (x) { return x.id === id; });
    if (i >= 0) { state.mistakes.splice(i, 1); save(); return true; }
    return false;
  }
  function clearFixedMistakes() {
    state.mistakes = (state.mistakes || []).filter(function (m) { return !m.fixed; });
    save();
  }

  /* ---------- 兑换记录 ---------- */
  function addRedeemLog(entry) {
    var now = new Date();
    var time = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');
    var record = {
      id: 'rl_' + U.uid(8),
      name: entry.name || '',
      icon: entry.icon || '💴',
      cash: entry.cash || 0,
      cost: entry.cost || 0,
      time: time,
      at: Date.now()
    };
    state.redeemLog = state.redeemLog || [];
    state.redeemLog.unshift(record);
    if (state.redeemLog.length > 200) state.redeemLog.length = 200;
    save();
    return record;
  }
  function getRedeemLog() {
    return state.redeemLog || [];
  }

  /** 完成任务并结算奖励 */
  function completeTask(id, info, anchor, dateStr) {
    const list = tasksOf(dateStr);
    const t = list.find((x) => x.id === id);
    if (!t || t.done) return null;
    t.done = true;
    t.doneAt = info.doneAt || U.nowHM();
    t.duration = info.duration || 0;
    t.feeling = info.feeling || '';
    t.note = info.note || '';
    t.onTime = t.doneAt <= state.config.homeworkDeadline;
    t.finishedTs = Date.now();
    t.updatedAt = Date.now();   // 关键：完成即刷新时间戳，使多端合并时采用本端(已完成)版本，而非旧端未完成版
    const r = state.config.rewards.homework;
    log('task', '完成作业：' + t.title, r.coins, r.stars);
    award(r.coins, r.stars, '完成作业', anchor);
    checkWeeklyBonus();
    grantDailyItemReward(anchor);
    return t;
  }
  /** 修改已完成作业的完成情况（不重复发奖励） */
  function updateTaskCompletion(id, info, dateStr) {
    const list = tasksOf(dateStr);
    const t = list.find((x) => x.id === id);
    if (!t || !t.done) return null;
    t.doneAt = info.doneAt || t.doneAt || U.nowHM();
    t.duration = info.duration || 0;
    t.feeling = info.feeling || '';
    t.note = info.note || '';
    t.onTime = t.doneAt <= state.config.homeworkDeadline;
    t.updatedAt = Date.now();
    save();
    return t;
  }
  function undoTask(id) {
    const t = updateTask(id, { done: false, doneAt: '', feeling: '', note: '', onTime: undefined, updatedAt: Date.now() });
    return t;
  }

  /* ---------------- 阅读 / 运动（每日不限次数，奖励递减，最多 3 次有奖励） ---------------- */
  // 递减档位：从配置读取，默认 3 档（之后无奖励）
  function getReadingTiers() { return (state.config.rewards && state.config.rewards.readingTiers) || [ { coins: 30, stars: 5 }, { coins: 20, stars: 3 }, { coins: 10, stars: 2 } ]; }
  function getSportsTiers() { return (state.config.rewards && state.config.rewards.sportsTiers) || [ { coins: 30, stars: 5 }, { coins: 20, stars: 3 }, { coins: 10, stars: 2 } ]; }
  const DAILY_REWARD_MAX = 3; // 每天前 3 次打卡有奖励

  function hasReadingToday() { return state.reading.some((r) => r.date === todayKey()); }
  function hasSportsToday() { return state.sports.some((r) => r.date === todayKey()); }
  function readingsTodayCount() { return state.reading.filter((r) => r.date === todayKey()).length; }
  function sportsTodayCount() { return state.sports.filter((r) => r.date === todayKey()).length; }
  function nextTier(kind) {
    const cnt = kind === 'reading' ? readingsTodayCount() : sportsTodayCount();
    if (cnt >= DAILY_REWARD_MAX) return null;
    return (kind === 'reading' ? getReadingTiers() : getSportsTiers())[cnt];
  }

  function addReading(rec, anchor) {
    const tier = nextTier('reading');
    const awardCoins = tier ? tier.coins : 0, awardStars = tier ? tier.stars : 0;
    state.reading.unshift(Object.assign({ id: U.uid('r'), date: todayKey(), at: Date.now(), _c: awardCoins, _s: awardStars }, rec));
    log('reading', '阅读打卡：' + (rec.book || ''), awardCoins, awardStars);
    if (tier) { award(awardCoins, awardStars, '阅读打卡（第' + (readingsTodayCount()) + '次）', anchor); }
    grantDailyItemReward(anchor);
    save();
    return { ok: true, coins: awardCoins, stars: awardStars, capped: !tier };
  }
  function addSports(rec, anchor) {
    const tier = nextTier('sports');
    const awardCoins = tier ? tier.coins : 0, awardStars = tier ? tier.stars : 0;
    state.sports.unshift(Object.assign({ id: U.uid('s'), date: todayKey(), at: Date.now(), _c: awardCoins, _s: awardStars }, rec));
    log('sports', '运动打卡：' + (rec.type || ''), awardCoins, awardStars);
    if (tier) { award(awardCoins, awardStars, '运动打卡（第' + (sportsTodayCount()) + '次）', anchor); }
    grantDailyItemReward(anchor);
    save();
    return { ok: true, coins: awardCoins, stars: awardStars, capped: !tier };
  }

  /* ---------------- 闯关 ---------------- */
  function quizTodayCount() { return state.quizRuns.filter((r) => r.date === todayKey()).length; }
  function quizLeft() { return Math.max(0, (state.config.quizDailyLimit || 2) - quizTodayCount()); }
  function addQuizRun(run, anchor) {
    state.quizRuns.unshift(Object.assign({ id: U.uid('q'), date: todayKey(), at: Date.now() }, run));
    if (state.quizRuns.length > 400) state.quizRuns.length = 400;
    log('quiz', '闯关 ' + run.correct + '/' + run.total + '（' + run.accuracy + '%）', run.coins, run.stars);
    award(run.coins, run.stars, '闯关奖励', anchor);
    grantDailyItemReward(anchor);
  }

  /* ---------- 每日任务道具奖励（食物/饮料/洗澡 各1个） ---------- */
  function rollConsumable(kind) {
    const roll = Math.random();
    const tier = roll < 0.6 ? 'low' : (roll < 0.9 ? 'mid' : 'high');
    const map = {
      food: { low: 'berry', mid: 'lunchBox', high: 'superBerry' },
      water: { low: 'water', mid: 'vitaminWater', high: 'energyDrink' },
      bath: { low: 'soap', mid: 'spaOil', high: 'spaSalt' }
    };
    const id = (map[kind] && map[kind][tier]) || 'berry';
    return { id, def: PW.shop.CONSUMABLE_MAP[id] };
  }
  function grantDailyItemReward(anchor) {
    const key = todayKey();
    if (state.dailyItemRewardKey === key) return { ok: false, msg: 'already' };
    /* 跨端去重闸门：本端已通过同步拿到今日奖励通知（同一 repKey）时，
       不再重复发放道具与通知，避免三端各发一次导致道具/消息重复。 */
    if (state.notifications.some(function (n) { return n && n.repKey === 'dailyReward:' + key; })) {
      state.dailyItemRewardKey = key;
      return { ok: false, msg: 'already-synced' };
    }
    const food = rollConsumable('food');
    const water = rollConsumable('water');
    const bath = rollConsumable('bath');
    state.pet.inventory[food.id] = (state.pet.inventory[food.id] || 0) + 1;
    state.pet.inventory[water.id] = (state.pet.inventory[water.id] || 0) + 1;
    state.pet.inventory[bath.id] = (state.pet.inventory[bath.id] || 0) + 1;
    state.dailyItemRewardKey = key;
    const title = '🎁 每日努力奖励';
    const text = '今天完成了努力目标，获得照顾道具：' +
      food.def.icon + ' ' + food.def.name + '、' +
      water.def.icon + ' ' + water.def.name + '、' +
      bath.def.icon + ' ' + bath.def.name + ' 各1个！';
    /* repKey 用「日期」作稳定标识：多端各自闯关时都会生成这条每日奖励通知，
       但合并同步时会按 repKey 去重（见 sync.js mergeRemoteData 的 seenRepKeys 去重），
       三端重复的"每日努力奖励"自动塌缩成一条，避免一天出现多条同款消息。 */
    addNotification({ title: title, text: text, from: 'system', read: false,
      items: { [food.id]: 1, [water.id]: 1, [bath.id]: 1 },
      repKey: 'dailyReward:' + key
    });
    touchPet();
    U.toast('每日努力奖励已到账，去消息里查看吧！', 'good');
    return { ok: true, food: food.def, water: water.def, bath: bath.def };
  }

  /* ---------------- 统计（供徽章使用） ---------------- */
  function stats() {
    const dates = Object.keys(state.tasks);
    let hwDoneTotal = 0;
    const onTimeDays = new Set();
    const taskDays = [];
    dates.forEach((d) => {
      const list = state.tasks[d] || [];
      if (!list.length) return;
      taskDays.push(d);
      const done = list.filter((t) => t.done);
      hwDoneTotal += done.length;
      if (done.length === list.length && list.length > 0) {
        const late = done.some((t) => (t.doneAt || '23:59') > state.config.homeworkDeadline);
        if (!late) onTimeDays.add(d);
      }
    });

    const today = todayKey();
    const recentTaskDays = taskDays.filter((d) => U.daysBetween(d, today) >= 0 && U.daysBetween(d, today) < 30);
    const recentOnTime = recentTaskDays.filter((d) => onTimeDays.has(d)).length;
    const ontimeRate30 = recentTaskDays.length >= 8 ? Math.round((recentOnTime / recentTaskDays.length) * 100) : 0;

    const readSet = new Set(state.reading.map((r) => r.date));
    const sportSet = new Set(state.sports.map((r) => r.date));
    const quizSet = new Set(state.quizRuns.map((r) => r.date));

    return {
      hwDoneTotal,
      ontimeStreak: U.streak(onTimeDays),
      ontimeDays: onTimeDays.size,
      ontimeRate30,
      quizPerfectCount: state.quizRuns.filter((r) => r.accuracy >= 100).length,
      quizHighCount: state.quizRuns.filter((r) => r.accuracy >= 90).length,
      quizStreak: U.streak(quizSet),
      quizDays: quizSet.size,
      quizTotalRuns: state.quizRuns.length,
      quizAvgAccuracy: state.quizRuns.length
        ? Math.round(state.quizRuns.reduce((s, r) => s + r.accuracy, 0) / state.quizRuns.length) : 0,
      readDays: readSet.size,
      readStreak: U.streak(readSet),
      readMinutes: state.reading.reduce((s, r) => s + (Number(r.minutes) || 0), 0),
      sportDays: sportSet.size,
      sportStreak: U.streak(sportSet),
      sportMinutes: state.sports.reduce((s, r) => s + (Number(r.minutes) || 0), 0),
      dexCount: (state.pet.dexUnlocked || []).length,
      evolveCount: state.pet.evolveCount || 0,
      starTotalEarned: state.wallet.totalStars,
      coinTotalEarned: state.wallet.totalCoins
    };
  }

  function badgeReadyCount() {
    const ev = PW.badges.evaluate(stats(), state.badges.claimed, state.badges.megaClaimed);
    return (ev.badges || ev).filter((b) => b.canClaim).length;
  }
  function claimBadge(id, anchor) {
    /* ---- Mega 突破：可重复领取，记录次数 ---- */
    const megaMatch = String(id).match(/^(.+)_mega$/);
    if (megaMatch) {
      const gk = megaMatch[1];
      const gDef = PW.badges.GROUPS.find(function(g) { return g.key === gk; });
      if (!gDef) return { ok: false, msg: '找不到这类徽章' };
      const ev = PW.badges.evaluate(stats(), state.badges.claimed, state.badges.megaClaimed);
      const mb = (ev.badges || ev).find(function(x) { return x.id === id; });
      if (!mb) return { ok: false, msg: '找不到这枚徽章' };
      if (!mb.achieved) return { ok: false, msg: '需先集齐本类前 5 枚徽章' };
      if (!mb.canClaim) return { ok: false, msg: '还没到可领取次数哦' };
      if (!state.badges.megaClaimed) state.badges.megaClaimed = {};
      const cnt = (state.badges.megaClaimed[gk] || 0) + 1;
      state.badges.megaClaimed[gk] = cnt;
      log('badge', '获得 Mega 突破：' + gDef.title + '（已领取 ' + cnt + ' 次）', gDef.mega.coins, gDef.mega.stars);
      award(gDef.mega.coins, gDef.mega.stars, 'Mega 突破奖励', anchor, 'badge-' + id);
      return { ok: true, badge: mb, mega: true, count: cnt };
    }

    /* ---- 基础徽章：每枚仅领取 1 次 ---- */
    const ev = PW.badges.evaluate(stats(), state.badges.claimed, state.badges.megaClaimed);
    const b = (ev.badges || ev).find(function(x) { return x.id === id; });
    if (!b) return { ok: false, msg: '找不到这枚徽章' };
    if (!b.achieved) return { ok: false, msg: '还没达成条件哦' };
    if (b.claimed) return { ok: false, msg: '这枚徽章已经领取过啦' };
    state.badges.claimed[id] = { at: Date.now(), coins: b.coins, stars: b.stars };
    const gTitle = b.groupTitle || ((PW.badges.GROUPS.find(function(g) { return g.key === b.group; }) || {}).title) || '';
    log('badge', '获得徽章：' + gTitle + '·' + b.name, b.coins, b.stars);
    award(b.coins, b.stars, '徽章奖励', anchor, 'badge-' + id);
    return { ok: true, badge: b };
  }

  /* ---------------- 训练奖励兑换 ---------------- */
  /* 零花钱兑换不设月度上限：有星星即可兑换（stars 余额由 spend 校验）。 */
  function redeem(item, kind) {
    const sp = spend(0, item.stars, '兑换：' + item.name);
    if (!sp.ok) return sp;
    state.redemptions.unshift({
      id: U.uid('rd'), kind, itemId: item.id, name: item.name,
      stars: item.stars, cash: item.cash || 0, date: todayKey(), at: Date.now(), status: 'pending'
    });
    log('redeem', '兑换 ' + item.name, 0, -item.stars);
    save();
    return { ok: true };
  }
  function markRedemption(id, status) {
    const r = state.redemptions.find((x) => x.id === id);
    if (r) { r.status = status; save(); }
  }

  /* ---------------- 宠物 ---------------- */
  /* 进化家族根：沿 evolvedFrom 一直追溯到最初形态（如雷丘26→皮卡丘25→25）。
     皮卡丘与雷丘属同一只宝可梦的不同形态，每日照顾应视为同一个名额。 */
  function lineageRoot(id) {
    var pid = id;
    var guard = 0;
    while (guard++ < 20) {
      var p = state.pet.owned[pid];
      if (p && p.evolvedFrom) pid = p.evolvedFrom;
      else break;
    }
    return pid;
  }
  function petCareToday() {
    const d = todayKey();
    if (!state.pet.care[d]) state.pet.care[d] = {};
    /* 兼容旧格式 {petId, food, water, bath} → 按宠物 id 分组 */
    if (state.pet.care[d] && state.pet.care[d].petId !== undefined) {
      const old = state.pet.care[d];
      const migrated = {};
      if (old.petId) migrated[old.petId] = { food: !!old.food, water: !!old.water, bath: !!old.bath };
      state.pet.care[d] = migrated;
    }
    const active = state.pet.active;
    const container = state.pet.care[d];
    if (!active) return { food: false, water: false, bath: false };
    const root = lineageRoot(active);
    /* 归一化：把同家族其它形态的旧护理记录合并到 root 并删除，保证“家族=1名额” */
    Object.keys(container).forEach(function (k) {
      if (k === root) return;
      const rec = container[k];
      if (!rec || rec.petId !== undefined) return;
      if (lineageRoot(k) === root) {
        const t = container[root] || (container[root] = { food: false, water: false, bath: false });
        if (rec.food) t.food = true;
        if (rec.water) t.water = true;
        if (rec.bath) t.bath = true;
        delete container[k];
      }
    });
    /* 注意：此处只读、不得为当前 root 新建空占位记录——否则每次 render() 切看宠物都会
       凭空多记一条“今日照顾”，导致“只照顾了1只却显示已照顾3只”。仅在确实有照顾动作时由 care() 写入。 */
    return container[root] || { food: false, water: false, bath: false };
  }
  function todayFeedPet() {
    const d = todayKey();
    const c = state.pet.care[d];
    const active = state.pet.active;
    const root = active ? lineageRoot(active) : '';
    if (c && root && c[root] && (c[root].food || c[root].water || c[root].bath)) return active;
    if (c && c.petId) return c.petId; /* 兼容旧格式 */
    return '';
  }

  function chooseStarter(id) {
    state.pet.active = id;
    state.pet.owned[id] = { growth: 0, stage: 0, feedDays: [], obtainedAt: Date.now(), nickname: '' };
    if (state.pet.dexUnlocked.indexOf(id) < 0) state.pet.dexUnlocked.push(id);
    state.pet.inventory = { berry: 2, water: 2, soap: 1, superBerry: 0, lunchBox: 0, vitaminWater: 0, energyDrink: 0, spaOil: 0, spaSalt: 0 };
    log('pet', '选择了初始伙伴：' + PW.pokemon.name(id), 0, 0);
    touchPet();
    save();
  }
  function ownPokemon(id) {
    if (!state.pet.owned[id]) {
      state.pet.owned[id] = { growth: 0, stage: (PW.pokemon.get(id) || {}).stage || 0, feedDays: [], obtainedAt: Date.now(), nickname: '' };
    }
    if (state.pet.dexUnlocked.indexOf(id) < 0) state.pet.dexUnlocked.push(id);
    touchPet();
    save();
  }
  function setActivePet(id) {
    if (!state.pet.owned[id]) return { ok: false, msg: '还没有这只宝可梦哦' };
    /* 允许自由切换任意已拥有的伙伴（含已进化的旧形态，如皮卡丘与雷丘都可切换） */
    state.pet.active = id;
    touchPet();
    save();
    return { ok: true };
  }

  /** 照顾宠物：kind = food | water | bath */
  function care(kind, anchor) {
    const invKeyMap = {
      food: ['superBerry', 'lunchBox', 'berry'],
      water: ['energyDrink', 'vitaminWater', 'water'],
      bath: ['spaSalt', 'spaOil', 'soap']
    };
    const invKeys = invKeyMap[kind] || [kind];
    const active = state.pet.active;
    if (!active || !state.pet.owned[active]) return { ok: false, msg: '还没有可以照顾的宝可梦' };
    /* 已进化出后代的旧形态（如皮卡丘已进化雷丘）不可再照顾，去照顾进化后的当前形态 */
    if (hasEvolvedChild(active)) return { ok: false, msg: '它已经进化成新形态啦，去照顾进化后的伙伴吧～' };
    const root = lineageRoot(active);
    const d = todayKey();
    if (!state.pet.care[d]) state.pet.care[d] = {};
    /* 归一化同家族记录（确保向下兼容旧数据把记录写在了雷丘26而非皮卡丘25） */
    petCareToday();
    const pet = state.pet.owned[active];
    /* 同一类别（喂食/喝水/洗澡）当天对该进化家族只能做一次（皮卡丘↔雷丘视为同一只）。
       此处用本地引用 c，不提前落库空占位，避免把“只是看了这只”记成照顾。 */
    const c = state.pet.care[d][root] || { food: false, water: false, bath: false };
    if (c[kind]) return { ok: false, msg: '今天这只已经' + (kind === 'food' ? '喂过食' : kind === 'water' ? '喝过水' : '洗过澡') + '啦，明天再来～' };
    /* 每天最多照顾 3 只（按进化家族计）：只统计“确有照顾动作（至少一个 true）”的家族，
       空占位记录（仅切看宠物产生）不计入，避免“只照顾1只却显示已照顾3只”。 */
    const famRoots = {};
    Object.keys(state.pet.care[d]).forEach(function (k) {
      if (k === root) return;
      const rec = state.pet.care[d][k];
      if (!rec || rec.petId !== undefined) return;
      if (!(rec.food || rec.water || rec.bath)) return;
      famRoots[lineageRoot(k)] = true;
    });
    if (Object.keys(famRoots).length >= 3) {
      return { ok: false, msg: '今天已经照顾够 3 只啦，明天再来～' };
    }

    // 道具选择策略：默认高档优先；若接近进化阈值，则改用刚好能填满的最小档，避免浪费高级道具成长值
    let usedKey = null;
    let item = null;
    const need = PW.pokemon.nextThreshold(pet.stage);
    const remaining = (need != null && pet.growth < need) ? need - pet.growth : Infinity;
    const CONS = PW.shop.CONSUMABLE_MAP;
    // exact-fit：剩余成长值 <= 当前库存最大道具成长值时，选能覆盖且成长值最小的那一档
    if (remaining !== Infinity && remaining > 0) {
      const maxAvailableGrowth = Math.max.apply(null, invKeys.map((k) => (state.pet.inventory[k] || 0) > 0 ? (CONS[k] && CONS[k].growth) || 0 : 0));
      if (maxAvailableGrowth > 0 && remaining <= maxAvailableGrowth) {
        for (let i = invKeys.length - 1; i >= 0; i--) {
          const k = invKeys[i];
          if ((state.pet.inventory[k] || 0) > 0) {
            const it = CONS[k];
            if (it && it.growth >= remaining) { usedKey = k; item = it; break; }
          }
        }
      }
    }
    // 默认：高档优先
    if (!item) {
      for (let i = 0; i < invKeys.length; i++) {
        const k = invKeys[i];
        if ((state.pet.inventory[k] || 0) > 0) {
          usedKey = k;
          item = PW.shop.CONSUMABLE.find((c) => c.id === k) || CONS[k];
          break;
        }
      }
    }
    if (!item) {
      // 全部没有库存，返回第一个缺货项用于弹窗购买
      const firstKey = invKeys[0];
      const firstItem = PW.shop.CONSUMABLE.find((c) => c.id === firstKey) || CONS[firstKey];
      return { ok: false, msg: '没有' + firstItem.name + '了，去商店买一点吧！', needBuy: firstKey };
    }

    state.pet.inventory[usedKey] -= 1;
    state.pet.care[d][root] = c;
    c[kind] = true;
    pet.growth += item.growth;
    if (pet.feedDays.indexOf(d) < 0) pet.feedDays.push(d);
    log('pet', PW.pokemon.name(active) + ' ' + (kind === 'food' ? '吃了' + item.name : kind === 'water' ? '喝了水' : '洗了澡') + '，成长 +' + item.growth, 0, 0);
    touchPet();
    /* 最高形态且成长值满 → 一次性 10 星奖励 */
    if (isFullyGrown(active, pet) && !pet.maxedReward) {
      pet.maxedReward = true;
      award(0, 10, PW.pokemon.name(active) + ' 已达最高形态且成长值满，奖励 10 星！', anchor, 'maxed-' + active);
    }
    save();
    return { ok: true, growth: item.growth, evolveReady: canEvolve(active) };
  }

  function canEvolve(id) {
    const pet = state.pet.owned[id];
    const def = PW.pokemon.get(id);
    if (!pet || !def || !def.next) return false;
    /* 已进化出后代（如皮卡丘已生雷丘）的不可再次进化，防止重复进化 / evolveCount 虚高 */
    const hasChild = Object.keys(state.pet.owned).some(function (k) {
      var p = state.pet.owned[k]; return p && p.evolvedFrom === id;
    });
    if (hasChild) return false;
    const need = PW.pokemon.nextThreshold(pet.stage);
    return need != null && pet.growth >= need;
  }
  /* 某只宝可梦“最高形态成长值满”的判定（触发 10 星奖励）。
     def.next 为空 = 已是进化链最终形态；此时按当前形态取成长上限：stage2=450，stage0/1 终态=150。 */
  function growthCapFor(id) {
    const def = PW.pokemon.get(id);
    if (!def || def.next) return null; // 仍可进化 → 非最高形态
    return (def.stage || 0) >= 2 ? PW.pokemon.GROWTH.stage2 : PW.pokemon.GROWTH.stage1;
  }
  function isFullyGrown(id, pet) {
    const cap = growthCapFor(id);
    return cap != null && (pet.growth || 0) >= cap;
  }
  /* 已进化出后代的旧形态（如皮卡丘）不可再照顾，仅当前/最终形态可照顾 */
  function hasEvolvedChild(id) {
    return Object.keys(state.pet.owned).some(function (k) {
      var p = state.pet.owned[k]; return p && p.evolvedFrom === id;
    });
  }
  /* 一次性补发：存量中已达“最高形态 + 成长满”的宝可梦各 10 星（新照顾到满的则在 care 内实时发放） */
  function grantMaxedRewards() {
    let n = 0;
    Object.keys(state.pet.owned).forEach(function (id) {
      const pet = state.pet.owned[id];
      if (!pet || pet.maxedReward) return;
      if (isFullyGrown(id, pet)) {
        pet.maxedReward = true;
        award(0, 10, PW.pokemon.name(id) + ' 已达最高形态且成长值满，补发 10 星奖励', null, 'maxed-' + id);
        n++;
      }
    });
    return n;
  }
  /* 由 owned 推导真实进化次数：每只有 evolvedFrom 的宠物代表一次“被进化出来”的事件，
     计数即累计进化次数。相比“自增计数器”这一定义不可被同步回退污染（回退会删掉旧形态，
     带 evolvedFrom 的宠物数自然回落），也能自愈历史上因重复进化而虚高的计数。 */
  function recomputeEvolveCount(petObj) {
    petObj = petObj || state.pet;
    if (!petObj || !petObj.owned) return 0;
    var n = 0;
    Object.keys(petObj.owned).forEach(function (id) {
      var p = petObj.owned[id];
      if (p && p.evolvedFrom) n++;
    });
    return n;
  }
  /* 自愈进化数据：进化后保留原形态（皮卡丘仍作为可切换伙伴）。
     历史版本曾误删“已进化的旧形态”，导致用户手里的皮卡丘消失、且无法再选皮卡丘。
     这里把“被进化来源却不在 owned 中”的宠物补回，使其可继续作为伙伴切换，并重新推导 evolveCount。
     支持进化链（4→5→6）：循环补齐每一级缺失的来源。可作用于任意 pet 对象（供 sync 合并复用）。 */
  function healEvolvedPets(petObj) {
    petObj = petObj || state.pet;
    if (!petObj || !petObj.owned) return petObj;
    var changed = true, guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      Object.keys(petObj.owned).forEach(function (id) {
        var p = petObj.owned[id];
        if (p && p.evolvedFrom && !petObj.owned[p.evolvedFrom]) {
          var srcStage = Math.max(0, (p.stage || 1) - 1);
          petObj.owned[p.evolvedFrom] = {
            growth: 0, stage: srcStage, feedDays: [],
            obtainedAt: (p.obtainedAt || Date.now()) - 1, nickname: '', evolvedFrom: null
          };
          if (petObj.dexUnlocked.indexOf(p.evolvedFrom) < 0) petObj.dexUnlocked.push(p.evolvedFrom);
          changed = true;
        }
      });
    }
    petObj.evolveCount = recomputeEvolveCount(petObj);
    return petObj;
  }
  function evolve(id) {
    if (!canEvolve(id)) return { ok: false, msg: '还没到进化条件哦' };
    const def = PW.pokemon.get(id);
    const pet = state.pet.owned[id];
    const nextId = def.next;
    const need = PW.pokemon.nextThreshold(pet.stage) || 0;
    const leftover = Math.max(0, pet.growth - need);  // 进化后只保留超出阈值的部分，避免刚进化又立即满足下一阶、被连点连算
    /* 保留原形态（皮卡丘继续作为可切换伙伴留在 owned），仅新增进化形态 */
    state.pet.owned[nextId] = {
      growth: leftover, stage: pet.stage + 1, feedDays: pet.feedDays.slice(),
      obtainedAt: Date.now(), nickname: pet.nickname || '', evolvedFrom: id
    };
    if (state.pet.dexUnlocked.indexOf(nextId) < 0) state.pet.dexUnlocked.push(nextId);
    if (state.pet.active === id) state.pet.active = nextId; // 进化后展示新形态，原形态仍可切回
    state.pet.evolveCount = recomputeEvolveCount(state.pet);
    log('pet', PW.pokemon.name(id) + ' 进化成了 ' + PW.pokemon.name(nextId) + '！', 0, 0);
    touchPet();
    save();
    return { ok: true, from: id, to: nextId };
  }

  function buyConsumable(id, n) {
    n = n || 1;
    const item = PW.shop.CONSUMABLE_MAP[id];
    if (!item) return { ok: false, msg: '没有这个商品' };
    const sp = spend(item.coins * n, 0, '购买 ' + item.name + ' ×' + n);
    if (!sp.ok) return sp;
    const key = item.id; // 直接用 id 作为库存 key
    state.pet.inventory[key] = (state.pet.inventory[key] || 0) + n;
    touchPet();
    save();
    return { ok: true };
  }
  function buyCosmetic(id) {
    const item = PW.shop.COSMETIC_MAP[id];
    if (!item) return { ok: false, msg: '没有这个装扮' };
    if ((state.pet.cosmeticsOwned || []).indexOf(id) >= 0) return { ok: false, msg: '已经拥有这个装扮啦' };
    const sp = spend(item.coins, 0, '购买装扮 ' + item.name);
    if (!sp.ok) return sp;
    state.pet.cosmeticsOwned.push(id);
    touchPet();
    save();
    return { ok: true };
  }
  function toggleCosmetic(id) {
    const p = state.pet.active;
    if (!p) return;
    const arr = state.pet.equipped[p] || [];
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    state.pet.equipped[p] = arr;
    touchPet();
    save();
  }
  function equippedOf(id) { return state.pet.equipped[id] || []; }

  function drawBlindBox() {
    const cost = state.config.blindBoxCost;
    const dailyLimit = PW.shop.BLIND_BOX_DAILY_LIMIT || 6;
    /* 每日限抽检查 */
    var key = todayKey();
    if (!state._blindBoxDaily) state._blindBoxDaily = {};
    var todayCount = state._blindBoxDaily[key] || 0;
    if (todayCount >= dailyLimit) {
      return { ok: false, msg: '今天盲盒已经抽了' + dailyLimit + '次啦，明天再来吧～' };
    }
    const sp = spend(cost, 0, '抽盲盒');
    if (!sp.ok) return sp;
    state._blindBoxDaily[key] = todayCount + 1;
    state.pet.boxCount = (state.pet.boxCount || 0) + 1;
    const res = PW.shop.drawBox(state);
    if (res.type === 'pokemon') ownPokemon(res.id);
    else if (res.type === 'stars') { appendWallet('earn', { stars: res.amount }, '盲盒星星'); }
    else if (res.type === 'consumable') {
      state.pet.inventory[res.id] = (state.pet.inventory[res.id] || 0) + res.amount;
    } else if (res.type === 'coins') {
      appendWallet('earn', { coins: res.amount }, '盲盒金币');
    }
    log('box', '盲盒开出：' + res.name, res.type === 'coins' ? res.amount : 0, 0);
    touchPet();
    save();
    return { ok: true, result: res };
  }

  /* ---- 盲盒每日限抽 ---- */
  function getBlindBoxDailyCount() {
    const key = todayKey();
    return (state._blindBoxDaily && state._blindBoxDaily[key]) || 0;
  }

  /* ---- 精灵球每日购买状态 ---- */
  function getPokeballDailyStatus() {
    const key = todayKey();
    return (state._pokeballDaily && state._pokeballDaily[key]) || {};
  }

  /* ---- 购买精灵球 ---- */
  function buyPokeball(pokeballId) {
    const pbDef = PW.shop.POKEBALL_MAP[pokeballId];
    if (!pbDef) return { ok: false, msg: '未知精灵球' };
    /* 每日限购1个 */
    const key = todayKey();
    if (!state._pokeballDaily) state._pokeballDaily = {};
    if (!state._pokeballDaily[key]) state._pokeballDaily[key] = {};
    if (state._pokeballDaily[key][pokeballId] >= 1) {
      return { ok: false, msg: pbDef.name + '今天已经买过啦，明天再来吧～' };
    }
    const sp = spend(pbDef.coins, 0, '购买' + pbDef.name);
    if (!sp.ok) return sp;
    state._pokeballDaily[key][pokeballId] = (state._pokeballDaily[key][pokeballId] || 0) + 1;
    /* 按阶段抽一只宝可梦（catchStage 排除无进化数据的跨世代宝可梦，避免精灵球捞到高阶/异世代） */
    const stagePool = PW.pokemon.DEX.filter(function (p) { return PW.pokemon.catchStage(p.id) === pbDef.stage; });
    if (stagePool.length === 0) {
      save(); return { ok: false, msg: '没有对应阶段的宝可梦' };
    }
    const picked = stagePool[Math.floor(Math.random() * stagePool.length)];
    const duplicate = !!state.pet.owned[picked.id];
    ownPokemon(picked.id);
    log('shop', '使用' + pbDef.name + '捕获了' + picked.name);
    save();
    return { ok: true, pokemonId: picked.id, duplicate: duplicate };
  }

  /* ---------------- 今日概览 ---------------- */
  function todayOverview() {
    const list = tasksOf();
    const done = list.filter((t) => t.done).length;
    const activePet = state.pet.active;
    const care = petCareToday();
    const canFeed = !!activePet && !(care.food && care.water && care.bath);
    return {
      homeworkTotal: list.length,
      homeworkDone: done,
      homeworkLeft: list.length - done,
      readingDone: hasReadingToday(),
      sportsDone: hasSportsToday(),
      quizLeft: quizLeft(),
      quizUsed: quizTodayCount(),
      canFeed,
      badgeReady: badgeReadyCount(),
      nearEvolve: !!activePet && state.pet.owned[activePet] && (() => {
        const p = state.pet.owned[activePet];
        const need = PW.pokemon.nextThreshold(p.stage);
        return need ? p.growth >= need * 0.85 : false;
      })()
    };
  }

  /* ---------------- 消息通知 ---------------- */
  function addNotification(n) {
    const item = Object.assign({
      id: U.uid('n'), title: '', text: '', coins: 0, stars: 0,
      from: 'parent', read: false, claimed: false, awarded: false, at: Date.now()
    }, n);
    item.coins = Math.max(0, Math.round(item.coins || 0));
    item.stars = Math.max(0, Math.round(item.stars || 0));
    /* 同 id 已存在（如多端各自生成的全勤/系统通知），更新而非重复添加，避免重复领取 */
    const existing = state.notifications.find((x) => x.id === item.id);
    if (existing) { Object.assign(existing, item); save(); emit('notifications'); return existing; }
    state.notifications.unshift(item);
    if (state.notifications.length > 100) state.notifications.length = 100;
    save();
    emit('notifications');
    return item;
  }
  function sendParentMessage(msg) {
    const text = (msg.text || '').trim();
    if (!text && !msg.coins && !msg.stars) return { ok: false, msg: '消息不能为空' };
    const n = addNotification({
      title: '家长留言', text: text || '（家长发来一份奖励）',
      coins: msg.coins || 0, stars: msg.stars || 0, from: 'parent'
    });
    return { ok: true, n };
  }
  function deductStars(reason, amount) {
    amount = Math.max(0, parseInt(amount, 10) || 0);
    if (!amount) return { ok: false, msg: '请输入扣罚数量' };
    reason = (reason || '').trim();
    if (!reason) return { ok: false, msg: '请填写扣罚原因' };
    if (state.wallet.stars < amount) return { ok: false, msg: '当前星星只有 ' + state.wallet.stars + ' 颗，不够扣减' };
    /* 扣减星星（同时扣余额和累计总值）：记为 deduct 事件，由账本重算，
       多端同步时该事件不会因另一端 updatedAt 更晚而被整包覆盖丢失 */
    appendWallet('deduct', { stars: amount }, reason);
    /* 记录到兑换列表 */
    state.redemptions.unshift({
      id: U.uid('rd'), kind: 'deduct', itemId: 'deduct', name: '⚠️ 扣罚：' + reason,
      stars: -amount, cash: 0, date: todayKey(), at: Date.now(), status: 'completed'
    });
    /* 同步写入兑换记录列表（训练奖励页可见） */
    var dedTime = U.nowHM();
    state.redeemLog = state.redeemLog || [];
    state.redeemLog.unshift({
      id: 'rl_' + U.uid(8),   /* 带 id 才能在多端合并时按 id 去重，不会丢也不会重复 */
      name: '⚠️ 扣罚' + (reason ? ('·' + reason) : ''),
      icon: '⚠️', cash: 0, cost: -amount, time: dedTime, at: Date.now()
    });
    if (state.redeemLog.length > 200) state.redeemLog.length = 200;
    /* 发通知给孩子 */
    addNotification({
      title: '⚠️ 星星扣罚',
      text: reason + '（-' + amount + ' ⭐）',
      stars: 0, coins: 0, from: 'parent', deduct: true
    });
    log('deduct', '家长扣罚：' + reason, 0, -amount);
    save();
    emit('wallet');
    return { ok: true, amount };
  }
  function unreadNotifCount() {
    return state.notifications.filter((n) => !n.read).length;
  }
  function markNotifRead(id) {
    const n = state.notifications.find((x) => x.id === id);
    if (n) { n.read = true; n.updatedAt = Date.now(); save(); emit('notifications'); }
  }
  function claimNotif(id, anchor) {
    const n = state.notifications.find((x) => x.id === id);
    if (!n || n.claimed) return { ok: false };
    if (n.coins || n.stars) {
      n.awarded = true;
      /* 用确定性 id，多端各领一次也只会记一笔账本，不会双倍发放 */
      award(n.coins, n.stars, '消息奖励：' + (n.title || '家长留言'), anchor, 'notif-' + n.id);
    }
    n.claimed = true; n.read = true; n.updatedAt = Date.now(); save(); emit('notifications');
    return { ok: true, coins: n.coins, stars: n.stars };
  }

  /* ---------------- 周全勤奖励（周一至周五核心任务100%完成，阅读运动家长任务额外翻倍） ---------------- */
  function mondayOf(dateStr) {
    const p = dateStr.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    const off = (d.getDay() + 6) % 7; // 周一=0
    return U.dateAdd(dateStr, -off);
  }
  /* 核心任务完成：仅检查作业/手动任务（排除家长派发的source=parent），不含阅读/运动 */
  function dayCoreTasksDone(dateStr) {
    const list = (state.tasks[dateStr] || []).filter(function(t){return t.source !== 'parent';});
    if (!list.length) return false;
    return list.every(function(t){return t.done;});
  }
  /* 额外任务全部完成：阅读+运动+家长任务都做了 */
  function dayExtraAllDone(dateStr) {
    var readingDone = state.reading.some(function(r){return r.date === dateStr;});
    var sportsDone = state.sports.some(function(r){return r.date === dateStr;});
    var parentTasks = (state.tasks[dateStr] || []).filter(function(t){return t.source === 'parent';});
    var parentDone = parentTasks.length === 0 || parentTasks.every(function(t){return t.done;});
    return readingDone && sportsDone && parentDone;
  }
  function checkWeeklyBonus() {
    var today = todayKey();
    var wd = U.weekdayCN(today);
    if (wd === '六' || wd === '日') return;  // 周末不计入
    var mon = mondayOf(today);
    if (state.weeklyBonusKey === mon) return; // 本周已发
    // 周一~周五每天核心任务都完成
    var weekdays = ['一','二','三','四','五'];
    var coreAllDone = true;
    for (var i = 0; i < 5; i++) {
      var d = U.dateAdd(mon, i);
      if (!dayCoreTasksDone(d)) { coreAllDone = false; break; }
    }
    if (!coreAllDone) return;
    // 检查额外任务是否也全完成（用于翻倍）
    var extraAllDone = true;
    for (var j = 0; j < 5; j++) {
      var ed = U.dateAdd(mon, j);
      if (!dayExtraAllDone(ed)) { extraAllDone = false; break; }
    }
    state.weeklyBonusKey = mon;
    var baseCoins = 30, baseStars = 5;
    if (extraAllDone) { baseCoins = 60; baseStars = 10; }
    var n = addNotification({
      id: 'weeklyBonus-' + mon,
      title: extraAllDone ? '🏆 本周完美全勤！' : '🏆 本周全勤达成！',
      text: extraAllDone 
        ? '周一到周五核心任务+阅读运动+家长任务全部完成！超级奖励已翻倍到账～'
        : '周一到周五每天都完成了核心任务，太了不起啦！额外奖励已到账～（阅读运动家长任务也全部完成可翻倍）',
      coins: baseCoins, stars: baseStars, from: 'system'
    });
    return n;
  }

  /* ---------------- 学习报告（日 / 周 / 月 / 年） ---------------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function inRange(date, start, end) { return date >= start && date <= end; }

  function periodRange(period) {
    const now = new Date();
    if (period === 'day') {
      const t = todayKey();
      return { start: t, end: t, label: '今日' };
    }
    if (period === 'week') {
      const dow = now.getDay(); // 0=周日
      const diffToMon = (dow === 0 ? -6 : 1 - dow);
      const mon = U.dateAdd(todayKey(), diffToMon);
      const sun = U.dateAdd(mon, 6);
      return { start: mon, end: sun, label: '本周（' + mon + ' ~ ' + sun + '）' };
    }
    if (period === 'month') {
      const y = now.getFullYear(), m = now.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      return { start: y + '-' + pad2(m + 1) + '-01', end: y + '-' + pad2(m + 1) + '-' + pad2(last), label: (m + 1) + ' 月' };
    }
    const y = now.getFullYear();
    return { start: y + '-01-01', end: y + '-12-31', label: y + ' 年' };
  }

  function buildReport(period) {
    const rg = periodRange(period);
    // 任务
    const tasks = [];
    Object.keys(state.tasks).forEach((k) => {
      if (inRange(k, rg.start, rg.end)) (state.tasks[k] || []).forEach((t) => tasks.push(t));
    });
    const total = tasks.length;
    const done = tasks.filter((t) => t.done);
    const doneCount = done.length;
    const completionPct = total ? Math.round((doneCount / total) * 100) : 0;
    /* 按时完成率必须按「全部任务」计算：未完成的任务不可能"按时完成"，
       否则会出现"完成率67% 但按时完成率100%"的矛盾。只有 onTime===true 才算按时。 */
    const onTimeCount = tasks.filter((t) => t.onTime === true).length;
    const onTimePct = total ? Math.round((onTimeCount / total) * 100) : 0;
    const duration = done.reduce((s, t) => s + (Number(t.duration) || 0), 0);
    // 阅读
    const rd = state.reading.filter((x) => inRange(x.date, rg.start, rg.end));
    const rdCount = rd.length;
    const rdMins = rd.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
    // 运动
    const sp = state.sports.filter((x) => inRange(x.date, rg.start, rg.end));
    const spCount = sp.length;
    const spMins = sp.reduce((s, x) => s + (Number(x.minutes) || 0), 0);
    // 闯关
    const qr = state.quizRuns.filter((x) => inRange(x.date, rg.start, rg.end));
    const qrCount = qr.length;
    const qrCorrect = qr.reduce((s, x) => s + (Number(x.correct) || 0), 0);
    const qrTotal = qr.reduce((s, x) => s + (Number(x.total) || 0), 0);
    const qrAcc = qrTotal ? Math.round((qrCorrect / qrTotal) * 100) : 0;
    // 闯关错题知识点（按 band 难度段统计薄弱环节）
    const bandMap = {};
    qr.forEach(function (q) {
      var b = q.band || '未知';
      if (!bandMap[b]) bandMap[b] = { total: 0, wrong: 0 };
      bandMap[b].total += Number(q.total) || 0;
      bandMap[b].wrong += (Number(q.total) || 0) - (Number(q.correct) || 0);
    });
    // 找出正确率最低的薄弱 band
    var weakBands = [];
    Object.keys(bandMap).forEach(function (b) {
      var info = bandMap[b];
      if (info.total >= 2 && info.wrong > 0) {
        weakBands.push({ band: b, acc: Math.round(((info.total - info.wrong) / info.total) * 100), wrong: info.wrong });
      }
    });
    weakBands.sort(function (a, b) { return a.acc - b.acc; });

    // 闯关错题类别统计（从 quizRuns 的 wrongCats 字段提取）
    const quizWrongCats = {};
    qr.forEach(function (q) {
      var cats = q.wrongCats || [];
      cats.forEach(function (c) {
        if (!quizWrongCats[c]) quizWrongCats[c] = 0;
        quizWrongCats[c]++;
      });
    });

    // 错题集分析（按科目+类型统计薄弱知识点）
    const mk = state.mistakes.filter(function (x) { return !x.fixed && inRange(x.date, rg.start, rg.end); });
    const mistakeBySubject = {};
    mk.forEach(function (m) {
      var sub = m.subject || '未知';
      var typ = m.type || '';
      if (!mistakeBySubject[sub]) mistakeBySubject[sub] = { count: 0, types: {} };
      mistakeBySubject[sub].count++;
      if (typ) {
        if (!mistakeBySubject[sub].types[typ]) mistakeBySubject[sub].types[typ] = 0;
        mistakeBySubject[sub].types[typ]++;
      }
    });

    // 作业完成情况分析（感受 + 备注）
    const hardTasks = done.filter(function (t) { return t.feeling && (t.feeling.indexOf('难') >= 0 || t.feeling.indexOf('帮助') >= 0 || t.feeling.indexOf('没弄懂') >= 0); });
    const easyTasks = done.filter(function (t) { return t.feeling && t.feeling.indexOf('轻松') >= 0; });
    const taskNotes = done.filter(function (t) { return t.note && t.note.trim(); }).map(function (t) { return t.title + '：' + t.note.trim(); });
    return {
      period, label: rg.label, start: rg.start, end: rg.end,
      total, doneCount, completionPct, onTimePct, duration,
      rdCount, rdMins, spCount, spMins, qrCount, qrAcc,
      weakBands: weakBands.slice(0, 3),
      mistakeBySubject: mistakeBySubject,
      hardTasks: hardTasks,
      easyTasks: easyTasks,
      taskNotes: taskNotes,
      quizWrongCats: quizWrongCats
    };
  }

  function buildAdvice(r) {
    const tips = [];
    if (r.completionPct >= 100 && r.total > 0) tips.push('✅ 本期任务全部完成，执行力满分！保持这个节奏，学习会越来越轻松。');
    else if (r.completionPct >= 80) tips.push('👍 完成率 ' + r.completionPct + '%，已经很棒，剩下一点点明天早点动手就能清掉。');
    else if (r.completionPct >= 50) tips.push('📌 完成率 ' + r.completionPct + '%，建议把大任务拆成小步骤，每天先完成最不难的一项，建立信心。');
    else if (r.total > 0) tips.push('💡 完成率只有 ' + r.completionPct + '%，别着急，从「每天先列好作业、完成一项勾一项」开始，慢慢养成习惯。');
    else tips.push('📝 本期还没有任务记录，记得先录入当天的作业，完成一项勾一项，效率会更高。');

    if (r.doneCount > 0) {
      if (r.onTimePct >= 90) tips.push('⏰ 按时完成率 ' + r.onTimePct + '%，时间观念很强，点赞！');
      else if (r.onTimePct >= 60) tips.push('⏰ 按时完成率 ' + r.onTimePct + '%，可以试着把「最难的任务」安排在精力最好的时段先做。');
      else tips.push('⏰ 按时完成率仅 ' + r.onTimePct + '%，容易拖到截止后。建议设一个提前 30 分钟的小闹钟，专治拖延。');
      if (r.duration > 0) tips.push('⏱️ 本期累计投入 ' + r.duration + ' 分钟专注学习，' + (r.duration >= 120 ? '专注时长很扎实！' : '可以适当再加点深度学习的时间哦。'));
    }
    // 阅读超长提醒（单日>120分钟）
    if (r.period === 'day' && r.rdMins > 120) tips.push('📚 今天阅读了 ' + r.rdMins + ' 分钟，量很大！不过眼睛和大脑也需要休息哦，建议每阅读 20 分钟眺望一下远处，保护视力。');
    else if (r.rdMins >= 20) tips.push('📚 阅读 ' + r.rdMins + ' 分钟，积累很稳，知识就是这么一点点长出来的。');
    else tips.push('📚 本期阅读 ' + (r.rdCount ? r.rdMins + ' 分钟' : '还没打卡') + '，建议每天固定 15-20 分钟阅读，对理解和写作都很有帮助。');
    // 运动超长提醒（单日>90分钟）
    if (r.period === 'day' && r.spMins > 90) tips.push('🏃 今天运动了 ' + r.spMins + ' 分钟，运动达人！但也要注意不要过度疲劳，运动后记得拉伸放松，喝点水补充水分。');
    else if (r.spMins >= 20) tips.push('🏃 运动 ' + r.spMins + ' 分钟，身体棒学习才更有劲！');
    else tips.push('🏃 本期运动 ' + (r.spCount ? r.spMins + ' 分钟' : '还没打卡') + '，每天动一动 20 分钟，大脑会更清醒。');
    // 闯关数据已在上方统计区展示，此处不再重复写正确率

    // ====== 薄弱环节分析（紧接上方建议，不空行）======
    var weakParts = [];

    // 来源1：闯关错题 — 按题目类别（英语、计算、乘法、除法、应用题、常识等）
    if (r.quizWrongCats && Object.keys(r.quizWrongCats).length > 0) {
      var catNames = { '英语': '英语', '计算': '计算', '应用题': '应用题', '大数': '大数运算', '常识': '常识', '几何': '几何', '方程': '方程', '小数': '小数', '分数': '分数' };
      var sortedCats = Object.keys(r.quizWrongCats).sort(function (a, b) { return r.quizWrongCats[b] - r.quizWrongCats[a]; });
      var catParts = sortedCats.map(function (c) { return (catNames[c] || c) + '(' + r.quizWrongCats[c] + '题)'; });
      weakParts.push('📌 闯关错题集中在：' + catParts.join('、') + '。建议针对这些薄弱点多做专项练习，弄懂后再做几道类似的巩固。');
    }

    // 来源2：拍照检查错题集 — 按科目/题型
    if (r.mistakeBySubject && Object.keys(r.mistakeBySubject).length > 0) {
      var subNames = { math: '数学', english: '英语', chinese: '语文', science: '科学', general: '常识' };
      var typeNames = { add: '加法', sub: '减法', mul: '乘法', div: '除法', compare: '大小比较', equation: '方程', decimal: '小数', fraction: '分数', geometry: '几何', application: '应用题', word: '文字题', calc: '计算', bigNum: '大数计算', memory: '记忆', vocab: '词汇', grammar: '语法', reading: '阅读理解' };
      var subEntries = [];
      Object.keys(r.mistakeBySubject).forEach(function (sub) {
        var info = r.mistakeBySubject[sub];
        var subLabel = subNames[sub] || sub;
        var topTypes = Object.keys(info.types || {}).sort(function (a, b) { return info.types[b] - info.types[a]; }).slice(0, 3);
        var typeStr = topTypes.length > 0
          ? '（' + topTypes.map(function (t) { return (typeNames[t] || t); }).join('、') + '）'
          : '';
        subEntries.push(subLabel + typeStr + '错 ' + info.count + ' 题');
      });
      if (subEntries.length > 0) weakParts.push('📌 拍照检查错题：' + subEntries.join('；') + '。');
    }

    // 来源2：作业完成感受 — 从"觉得难"的作业中提炼问题并给建议
    if (r.hardTasks && r.hardTasks.length > 0) {
      var hardTitles = r.hardTasks.map(function (t) { return t.title; }).slice(0, 3);
      weakParts.push('📌 作业中「' + hardTitles.join('」「') + '」' +
        (r.hardTasks.length > 3 ? ' 等 ' + r.hardTasks.length + ' 项' : '') +
        ' 完成时感觉偏难 → 建议家长陪孩子一起梳理这些知识点，或联系老师请教更好的学习方法。');
    } else if (r.easyTasks && r.easyTasks.length > 0 && r.doneCount > 0 && r.doneCount === r.easyTasks.length) {
      weakParts.push('✨ 本期作业整体完成顺利，孩子觉得都很轻松，保持这个势头！');
    }

    if (weakParts.length > 0) {
      tips.push('🎯 薄弱环节分析：' + weakParts.join(' '));
    }
    return tips.join('\n');
  }

  /* 名人名言库（正面激励，适合孩子） */
  var QUOTES = [
    '「学习不是任务，而是发现世界的钥匙。」—— 爱因斯坦',
    '「每一个不曾起舞的日子，都是对生命的辜负。」—— 尼采',
    '「读书破万卷，下笔如有神。」—— 杜甫',
    '「天才是 1% 的灵感加上 99% 的汗水。」—— 爱迪生',
    '「学而不思则罔，思而不学则殆。」—— 孔子',
    '「不积跬步，无以至千里；不积小流，无以成江海。」—— 荀子',
    '「书山有路勤为径，学海无涯苦作舟。」—— 韩愈',
    '「你今天的努力，是明天的底气。」',
    '「成功不是终点，失败也不是终结，继续前进的勇气才最可贵。」—— 丘吉尔',
    '「种一棵树最好的时间是十年前，其次是现在。」',
    '「知识就是力量。」—— 培根',
    '「只要功夫深，铁杵磨成针。」—— 中国谚语',
    '「世上无难事，只怕有心人。」',
    '「千里之行，始于足下。」—— 老子',
    '「业精于勤，荒于嬉；行于思，毁于随。」—— 韩愈'
  ];
  function pickQuote(period) {
    // 按日期+周期选名言，确保每天不同，同周期内稳定不变
    var d = new Date();
    var dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
    // 用周期类型偏移，避免日/周/月/年报告在同一天撞同名言
    var offset = { day: 0, week: 1, month: 2, year: 3 }[period] || 0;
    var candidate = (dayOfYear + offset) % QUOTES.length;
    /* 不重复：跳过最近用过的 4 条，避免短期报告里名言反复出现 */
    var hist = (state._quoteHistory && Array.isArray(state._quoteHistory)) ? state._quoteHistory : [];
    for (var k = 1; k <= QUOTES.length; k++) {
      if (hist.slice(-4).indexOf(candidate) < 0) break;
      candidate = (candidate + 1) % QUOTES.length;
    }
    state._quoteHistory = hist.concat([candidate]).slice(-8);
    return QUOTES[candidate];
  }

  function formatReport(r) {
    const titleMap = { day: '📝 今日学习总结', week: '📊 本周学习报告', month: '📈 本月学习报告', year: '🏆 年度学习报告' };
    const quote = '\n💬 ' + pickQuote(r.period) + '\n';
    const text =
      quote +
      '\n【' + r.label + '】\n' +
      '📋 任务：' + r.doneCount + ' / ' + r.total + ' 项完成（完成率 ' + r.completionPct + '%）\n' +
      '⏰ 按时完成率：' + (r.doneCount ? r.onTimePct + '%' : '—') + '\n' +
      '⏱️ 累计用时：' + (r.duration ? r.duration + ' 分钟' : '—') + '\n' +
      '📚 阅读：' + (r.rdCount ? r.rdCount + ' 次 · ' + r.rdMins + ' 分钟' : '未打卡') + '\n' +
      '🏃 运动：' + (r.spCount ? r.spCount + ' 次 · ' + r.spMins + ' 分钟' : '未打卡') + '\n' +
      '⚔️ 闯关：' + (r.qrCount ? r.qrCount + ' 次 · 正确率 ' + r.qrAcc + '%' : '未闯关') + '\n' +
      '\n💡 学习建议：\n' + buildAdvice(r);
    return { title: titleMap[r.period] || '学习报告', text };
  }

  function sendSummary(period) {
    const keyMap = { day: 'dailySummaryDate', week: 'weeklyReportKey', month: 'monthlyReportKey', year: 'yearlyReportKey' };
    const d = new Date();
    const key = (period === 'day') ? todayKey()
      : (period === 'week') ? periodRange('week').start
      : (period === 'month') ? (d.getFullYear() + '-' + pad2(d.getMonth() + 1))
      : ('' + d.getFullYear());
    if (state[keyMap[period]] === key) return null;
    const rep = buildReport(period);
    const { title, text } = formatReport(rep);
    // 防重键：同一周期同一天只发一条；多端各自生成时也能在同步合并阶段去重
    const repKey = 'summary-' + period + '-' + key;
    if (!(state.notifications || []).some((n) => n.repKey === repKey)) {
      addNotification({ title, text, coins: 0, stars: 0, from: 'system', read: false, repKey });
    }
    state[keyMap[period]] = key;
    save();
    return rep;
  }

  function checkAndSendReports() {
    const now = new Date();
    const hour = now.getHours(), minute = now.getMinutes();
    if (hour < 22) return; // 22:00 之前不生成
    if (state.dailySummaryDate !== todayKey()) sendSummary('day');
    // 周/月/年 报告在 22:30 之后生成（最后一天）
    const after2230 = (hour > 22 || (hour === 22 && minute >= 30));
    if (!after2230) return;
    if (now.getDay() === 0) { // 周日 = 本周最后一天
      const wk = periodRange('week').start;
      if (state.weeklyReportKey !== wk) sendSummary('week');
    }
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (now.getDate() === lastDay) {
      const mk = now.getFullYear() + '-' + pad2(now.getMonth() + 1);
      if (state.monthlyReportKey !== mk) sendSummary('month');
    }
    if (now.getMonth() === 11 && now.getDate() === 31) {
      const yk = '' + now.getFullYear();
      if (state.yearlyReportKey !== yk) sendSummary('year');
    }
  }

  /* 兼容旧调用（app.js 启动时会调用） */
  function checkAndSendDailySummary() { checkAndSendReports(); }
  /* 兼容旧调用别名：发送指定周期的学习总结通知（day/week/month/year） */
  function sendDailySummary(period) { return sendSummary(period || 'day'); }

  /* ---------------- 清空钱包+徽章记录（测试用） ---------------- */
  function clearWallet() {
    /* 重置钱包：用一条 reset 事件覆盖账本，所有余额归零（多端同步时按账本并集重算同样归零） */
    ensureWalletLedger();
    state.wallet.ledger.push({ id: 'reset', type: 'reset', at: Date.now() });
    recomputeWalletFromLedger(state);
    state.wallet.updatedAt = Date.now();
    /* 同时清空徽章领取记录（基础 + Mega 突破） */
    if (state.badges) {
      state.badges.claimed = {};
      state.badges.megaClaimed = {};
    }
    save();
    emit('wallet');
    return { ok: true };
  }

  /* ---------------- 一键清空全部数据（家长操作，需密码确认） ---------------- */
  function resetAllData() {
    /* 保留 profile 基础信息（名字/年级/年龄/头像）和 config（含 pin），其余全部归零 */
    var savedProfile = {
      name: state.profile.name,
      grade: state.profile.grade,
      age: state.profile.age,
      avatar: state.profile.avatar,
      onboarded: false,
      syncKey: state.profile.syncKey,
      familyCode: state.profile.familyCode
    };
    var savedConfig = JSON.parse(JSON.stringify(state.config));
    state = defaultState();
    state.profile = savedProfile;
    state.config = savedConfig;
    state._resetAt = Date.now();   // 记录清空时间，供多端同步时识别"从头开始"并尊重清空
    /* 防御性清空：确保消息/通知/错题等数组彻底归零（防止后续同步合并把云端旧数据拉回来） */
    state.notifications = [];
    state.mistakes = [];
    state.logs = [];
    state.trash = [];
    localStorage.removeItem(KEY);
    save();
    emit();
    /* 立即尝试推送到云端（不等 1200ms 延迟），缩小"已清空但云端还是旧数据"的窗口 */
    if (typeof PW !== 'undefined' && PW.sync && typeof PW.sync.push === 'function') {
      PW.sync.push().catch(function () {});
    }
    return { ok: true };
  }

  /* ---------------- URL参数触发：清空测试数据（一次性） ---------------- */
  if (typeof location !== 'undefined' && /resetTestData=1/.test(location.search)) {
    /* 清空成就徽章记录（基础 + Mega 突破） */
    if (state.badges) {
      state.badges.claimed = {};
      state.badges.megaClaimed = {};
    }
    /* 清空金币和星星 */
    clearWallet();
    /* 清空兑换记录中的扣罚/兑换条目（可选，用户只要求清徽章+钱） */
    save();
    /* 移除参数并刷新，避免反复触发 */
    var cleanUrl = location.pathname + location.hash;
    if (history.replaceState) history.replaceState(null, '', cleanUrl);
  }

  return {
    get state() { return state; },
    load, save, replaceAll, resetAll, on, emit, defaultConfig, touchConfig,
    award, spend, log,
    todayKey, tasksOf, addTasks, updateTask, removeTask, completeTask, updateTaskCompletion, undoTask, customTaskDue,
    addRecurringTask, removeRecurringDef, repeatDetail, skipRecurringDay,
    trashRecord, getTrash, restoreTrash, purgeTrash, emptyTrash,
    addMistake, getMistakes, fixMistake, toggleMistake, deleteMistake, clearFixedMistakes,
    addRedeemLog, getRedeemLog,
    hasReadingToday, hasSportsToday, readingsTodayCount, sportsTodayCount, nextTier, addReading, addSports, removeSports, DAILY_REWARD_MAX,
    quizTodayCount, quizLeft, addQuizRun, grantDailyItemReward,
    stats, badgeReadyCount, claimBadge,
    redeem, markRedemption,
    petCareToday, todayFeedPet, lineageRoot, chooseStarter, ownPokemon, setActivePet, care, canEvolve, evolve, recomputeEvolveCount, healEvolvedPets,
    isFullyGrown, hasEvolvedChild, grantMaxedRewards,
    buyConsumable, buyCosmetic, toggleCosmetic, equippedOf, drawBlindBox,
    buyPokeball, getPokeballDailyStatus, getBlindBoxDailyCount,
    todayOverview,
    addNotification, sendParentMessage, deductStars, unreadNotifCount, markNotifRead, claimNotif,
    checkWeeklyBonus,
    sendDailySummary,
    checkAndSendDailySummary,
    clearWallet, resetAllData,
    recomputeWalletFromLedger, ensureWalletLedger
  };
})();
