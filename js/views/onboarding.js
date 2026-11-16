/* =========================================================
   PW · 首次进入引导：昵称 / 年龄 / 年级 / 初始伙伴
   ========================================================= */
PW.onboarding = (function () {
  const U = PW.util;

  const GRADES = [
    { g: 1, n: '一年级', age: 7 }, { g: 2, n: '二年级', age: 8 }, { g: 3, n: '三年级', age: 9 },
    { g: 4, n: '四年级', age: 10 }, { g: 5, n: '五年级', age: 11 }, { g: 6, n: '六年级', age: 12 },
    { g: 7, n: '初一', age: 13 }, { g: 8, n: '初二', age: 14 }, { g: 9, n: '初三', age: 15 }
  ];

  let step = 0;
  const draft = { name: '', age: 10, grade: 4, starter: '' };

  function root() { return document.getElementById('onboarding'); }

  function show() {
    step = 0;
    root().classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    render();
  }

  /* 一键清空前预填已保留的昵称/年级/年龄，让引导更顺滑 */
  function prefill(p) {
    if (p) {
      draft.name = p.name || '';
      draft.age = p.age || 10;
      draft.grade = p.grade || 4;
    }
  }

  function dots() {
    return '<div class="ob-steps">' + [0, 1, 2].map((i) => '<i class="' + (i === step ? 'on' : '') + '"></i>').join('') + '</div>';
  }

  function render() {
    const r = root();
    if (step === 0) r.innerHTML = step0();
    if (step === 1) r.innerHTML = step1();
    if (step === 2) r.innerHTML = step2();
    bind();
  }

  function step0() {
    return '<div class="ob-card">' +
      '<div class="ob-hero"><div class="ob-ball"></div>' +
      '<h2>欢迎来到宝可梦训练道馆！</h2>' +
      '<p>先告诉我你是谁，我好安排合适的关卡难度～</p></div>' + dots() +
      '<div class="field"><label>你的昵称</label>' +
      '<input class="input" id="obName" maxlength="12" placeholder="例如：小宇 / 阿泽" value="' + U.esc(draft.name) + '"></div>' +
      '<div class="field"><label>你的年龄</label>' +
      '<select class="input" id="obAge">' +
      Array.from({ length: 12 }, (_, i) => i + 5).map((a) =>
        '<option value="' + a + '"' + (a === draft.age ? ' selected' : '') + '>' + a + ' 岁</option>').join('') +
      '</select></div>' +
      '<div class="field"><label>现在读几年级？<span class="muted small">（以后可以在"管理配置"里升级）</span></label>' +
      '<div class="grade-grid">' + GRADES.map((g) =>
        '<button class="grade-btn' + (g.g === draft.grade ? ' on' : '') + '" data-grade="' + g.g + '">' + g.n +
        '<small>' + (g.g <= 6 ? '小学' : '初中') + ' · 约 ' + g.age + ' 岁</small></button>').join('') +
      '</div></div>' +
      '<button class="btn btn-primary btn-lg btn-block" id="obNext">下一步：选择我的伙伴 →</button>' +
      '</div>';
  }

  function step1() {
    const list = PW.pokemon.STARTERS.map((id) => {
      const p = PW.pokemon.get(id);
      return '<div class="starter-cell' + (draft.starter === id ? ' on' : '') + '" data-starter="' + id + '">' +
        PW.pokemon.render(id) + '<b>' + p.name + '</b><small>' + p.type + '系</small></div>';
    }).join('');
    const chosen = draft.starter ? PW.pokemon.get(draft.starter) : null;
    return '<div class="ob-card">' +
      '<div class="ob-hero"><h2>选择你的第一只伙伴</h2>' +
      '<p>它会陪你写作业、闯关，每天照顾它就会长大、进化！</p></div>' + dots() +
      '<div class="starter-grid">' + list + '</div>' +
      '<div class="card" style="margin-top:16px;background:#fbfdff">' +
      (chosen ? '<b>' + chosen.name + '</b><span class="tag tag-school" style="margin-left:8px">' + chosen.type + '系</span>' +
        '<p class="small muted" style="margin:8px 0 0">' + chosen.desc + '</p>'
        : '<p class="small muted" style="margin:0">点一只看看它的介绍吧～ 免费领取，之后还能用金币抽盲盒收集更多！</p>') +
      '</div>' +
      '<div class="row" style="margin-top:16px">' +
      '<button class="btn btn-ghost" id="obBack">← 上一步</button>' +
      '<button class="btn btn-primary" id="obNext" style="flex:1"' + (draft.starter ? '' : ' disabled') + '>就选它了！</button>' +
      '</div></div>';
  }

  function step2() {
    const g = GRADES.find((x) => x.g === draft.grade);
    const p = PW.pokemon.get(draft.starter);
    return '<div class="ob-card">' +
      '<div class="ob-hero">' +
      '<div style="height:120px">' + PW.pokemon.render(draft.starter) + '</div>' +
      '<h2>' + (draft.name || '小训练家') + '，出发吧！</h2>' +
      '<p>' + p.name + ' 已经加入你的队伍</p></div>' + dots() +
      '<div class="card" style="background:#fffdf5;border-color:#ffe9a8">' +
      '<h3 style="font-size:15px;margin-bottom:10px">🎯 每天可以这样赚金币和星星</h3>' +
      '<ul class="small" style="margin:0;padding-left:18px;line-height:2.2;color:#5a6a7d">' +
      '<li>✅ 完成作业、阅读打卡、运动打卡</li>' +
      '<li>⚔️ 闯关冒险答对题目</li>' +
      '<li>' + PW.COIN_SVG + ' 金币 → 买食物道具照顾宝可梦、抽盲盒得新伙伴</li>' +
      '<li>' + PW.STAR_SVG + ' 星星 → 在「星星商店」兑换零花钱（凭记录找家长兑现）</li>' +
      '</ul></div>' +
      '<div class="row" style="margin-top:16px">' +
      '<button class="btn btn-ghost" id="obBack">← 换一只</button>' +
      '<button class="btn btn-primary btn-lg" id="obDone" style="flex:1">进入工作台 🚀</button>' +
      '</div>' +
      '<p class="hint center" style="margin-top:12px">当前难度：' + g.n + ' · 闯关会自动出这个学段的题目</p>' +
      '</div>';
  }

  function bind() {
    const r = root();
    U.$$('.grade-btn', r).forEach((b) => {
      b.onclick = () => {
        draft.grade = +b.dataset.grade;
        const g = GRADES.find((x) => x.g === draft.grade);
        draft.age = g.age;
        const nameEl = U.$('#obName', r);
        if (nameEl) draft.name = nameEl.value;
        render();
      };
    });
    U.$$('.starter-cell', r).forEach((c) => {
      c.onclick = () => { draft.starter = c.dataset.starter; render(); };
    });
    const nameEl = U.$('#obName', r);
    if (nameEl) nameEl.oninput = () => { draft.name = nameEl.value; };
    const ageEl = U.$('#obAge', r);
    if (ageEl) ageEl.onchange = () => { draft.age = +ageEl.value; };

    const next = U.$('#obNext', r);
    if (next) next.onclick = () => {
      if (step === 0) {
        if (nameEl) draft.name = nameEl.value.trim();
        if (ageEl) draft.age = +ageEl.value;
        if (!draft.name) { U.toast('先起个昵称吧～', 'warn'); return; }
        step = 1; render(); return;
      }
      if (step === 1) {
        if (!draft.starter) { U.toast('先选一只伙伴哦', 'warn'); return; }
        step = 2; render(); U.confetti(30);
      }
    };
    const back = U.$('#obBack', r);
    if (back) back.onclick = () => { step -= 1; render(); };

    const done = U.$('#obDone', r);
    if (done) done.onclick = () => {
      const st = PW.store.state;
      st.profile.name = draft.name;
      st.profile.age = draft.age;
      st.profile.grade = draft.grade;
      st.profile.onboarded = true;
      st.profile.createdAt = U.todayStr();
      PW.store.chooseStarter(draft.starter);
      PW.store.log('start', '开始训练家之旅', 0, 0);
      PW.store.save();
      root().classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      PW.app.boot();
      U.toast('欢迎，' + draft.name + '！', 'good');
    };
  }

  return { show, GRADES, prefill };
})();
