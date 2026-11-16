/* =========================================================
   PW · 闯关冒险（按年级出 20 题，免草稿，实时判分）
   ========================================================= */
PW.viewAdventure = (function () {
  const U = PW.util;

  // 关卡进行中状态（模块级，避免重渲染丢失）
  let q = { qs: [], idx: 0, correct: 0, phase: 'home', result: null, inputDraft: '' };
  let quizLogPage = 0;  // 闯关记录分页
  const QUIZ_LOG_PER_PAGE = 8;

  function reset() { q = { qs: [], idx: 0, correct: 0, phase: 'home', result: null }; }

  function render() {
    const st = PW.store.state;
    const grade = st.profile.grade;
    const bd = PW.quiz.band(grade);
    const bandName = PW.quiz.bandName(bd);
    const left = PW.store.quizLeft();
    const total = st.config.quizCount || 20;

    if (q.phase === 'quiz') return quizScreen();
    if (q.phase === 'result') return resultScreen();

    // 首页（无规则卡片，直接展示开始区域）
    const startCard = (left > 0)
      ? '<div class="card center" style="margin-top:16px;background:linear-gradient(180deg,#fffaf0,#fff);border-color:#ffe3a8">' +
        '<div style="font-size:48px">⚔️</div>' +
        '<h3 style="margin:6px 0">每次' + total + '题，准备好去冒险了吗？</h3>' +
        '<p class="small muted" style="margin:0 0 14px">今天还剩 <b>' + left + '</b> 次机会，正确率越高，奖励越丰厚！</p>' +
        '<button class="btn btn-blue btn-lg" id="startQuiz">开始闯关 🚀</button>' +
        '</div>'
      : '<div class="card center" style="margin-top:16px;background:#f7faf9;border-color:#dcefe4">' +
        '<div style="font-size:48px">🌙</div>' +
        '<h3 style="margin:6px 0">今天的闯关次数用完啦</h3>' +
        '<p class="small muted" style="margin:0">明天再来挑战满分吧！</p>' +
        '</div>';

    /* 闯关记录（分页，每页8条，最新在前） */
    const totalRuns = st.quizRuns.length;
    const totalLogPages = Math.max(1, Math.ceil(totalRuns / QUIZ_LOG_PER_PAGE));
    if (quizLogPage >= totalLogPages) quizLogPage = totalLogPages - 1;
    const logStart = quizLogPage * QUIZ_LOG_PER_PAGE;
    const pageRuns = st.quizRuns.slice(logStart, logStart + QUIZ_LOG_PER_PAGE);

    const history = totalRuns > 0
      ? '<div class="card" style="margin-top:16px"><div class="card-h"><h3>📜 闯关记录</h3>' +
        '<span class="sub">共 ' + totalRuns + ' 次</span></div>' +
        pageRuns.map((r) => {
          const gradeLine = r.grade || (r.accuracy >= 100 ? 'S' : r.accuracy >= 90 ? 'A' : 'B');
          return '<div class="log-row">' +
            '<div class="log-ico">' + (r.accuracy >= 100 ? '💯' : r.accuracy >= 90 ? '🎯' : '⚔️') + '</div>' +
            '<div class="log-main"><b>' + r.correct + ' / ' + r.total + ' 题正确（' + r.accuracy + '%）</b>' +
            '<span class="small muted">' + r.date + ' · 获得 ' + (r.coins || 0) + ' 金币' + (r.stars ? ' + ' + r.stars + ' 星星' : '') + '</span></div>' +
            '<span class="tag ' + (r.accuracy >= 100 ? 'tag-home' : 'tag-school') + '">' + gradeLine + '</span>' +
            '</div>';
        }).join('') +
        (totalLogPages > 1
          ? '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:10px">' +
            '<button class="btn btn-ghost btn-sm" id="quizLogPrev"' + (quizLogPage <= 0 ? ' disabled' : '') + '>◀</button>' +
            '<span class="small" style="font-weight:700;color:var(--ink-2);min-width:70px;text-align:center">' + (quizLogPage + 1) + '/' + totalLogPages + '</span>' +
            '<button class="btn btn-ghost btn-sm" id="quizLogNext"' + (quizLogPage >= totalLogPages - 1 ? ' disabled' : '') + '>▶</button>' +
            '</div>'
          : '') +
        '</div>'
      : '';

    return startCard + history;
  }

  function quizScreen() {
    const cur = q.qs[q.idx];
    const total = q.qs.length;
    const pct = Math.round((q.idx / total) * 100);
    const head =
      '<div class="quiz-head"><div class="q-idx">第 ' + (q.idx + 1) + ' / ' + total + ' 题</div>' +
      '<div class="progress" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
      '<div class="q-idx">已对 ' + q.correct + '</div></div>';

    let stage;
    if (cur.type === 'choice') {
      stage = '<div class="q-stage"><span class="q-type">' + cur.cat + '</span>' +
        '<div class="q-text">' + U.esc(cur.text) + '</div>' +
        '<div class="q-opts" id="qOpts">' +
        cur.opts.map((o, i) => '<button class="q-opt" data-i="' + i + '">' + U.esc(o) + '</button>').join('') +
        '</div><div class="q-feedback" id="qfb"></div></div>';
    } else {
      stage = '<div class="q-stage"><span class="q-type">' + cur.cat + '</span>' +
        '<div class="q-text">' + U.esc(cur.text) + '</div>' +
        '<div class="q-input-row"><input class="input" id="qInput" placeholder="填答案，回车提交" value="' + U.esc(q.inputDraft || '') + '" autofocus>' +
        '<button class="btn btn-blue" id="qSubmit">提交</button></div>' +
        '<div class="q-feedback" id="qfb"></div></div>';
    }
    const quit = '<button class="btn btn-ghost btn-sm" id="qQuit" style="margin-top:14px">退出本局</button>';
    return head + stage + '<div class="center">' + quit + '</div>';
  }

  function resultScreen() {
    const r = q.result;
    const cfg = PW.store.state.config.rewards;
    const ring = '<div class="result-ring" style="--p:' + r.accuracy + '%"><b>' + r.accuracy + '%</b></div>';
    const medal = r.accuracy >= 100 ? '💯' : r.accuracy >= 90 ? '🎯' : r.accuracy >= 80 ? '✅' : '💪';
    const rewardLine = (r.coins || r.stars)
      ? '获得 <b style="color:#8a6100">' + r.coins + ' 金币' + (r.stars ? ' + ' + r.stars + ' 星星' : '') + '</b>'
      : '这次没有奖励，再练练就能拿啦！';
    const left = PW.store.quizLeft();
    const again = (left > 0)
      ? '<div style="display:flex;gap:10px;margin-top:14px">' +
        '<button class="btn btn-blue" id="again" style="flex:1">再战一场（剩 ' + left + ' 次）</button>' +
        '<button class="btn btn-ghost" id="backHome" style="flex:1">休息一下</button></div>'
      : '<button class="btn btn-ghost btn-block" id="backHome" style="margin-top:14px">休息一下</button>';

    return '<div class="card center">' + ring +
      '<div style="font-size:44px">' + medal + '</div>' +
      '<h3 style="margin:8px 0 2px">' + r.tier + '</h3>' +
      '<p class="small muted" style="margin:0 0 12px">正确 ' + r.correct + ' / ' + r.total + ' 题 · 评级 ' + r.grade + '</p>' +
      '<div class="card" style="background:#fff8e6;border-color:#ffe3a8;max-width:320px;margin:0 auto">' + rewardLine + '</div>' +
      again + '</div>';
  }

  /* ---------------- 交互 ---------------- */
  function mount(root) {
    if (q.phase === 'home') {
      const start = U.$('#startQuiz', root);
      if (start) start.onclick = () => {
        const st = PW.store.state;
        if (PW.store.quizLeft() <= 0) { U.toast('今天次数用完啦', 'warn'); return; }
        /* 收集最近 3 次闯关的题目文本，避免连续两局出现完全相同的题 */
        const recent = (st.quizRuns || []).slice(0, 3).reduce((acc, r) => acc.concat(r.texts || []), []);
        q.qs = PW.quiz.generate(st.profile.grade, st.config.quizCount || 20, recent);
        q.idx = 0; q.correct = 0; q.phase = 'quiz'; q.result = null;
        PW.app.rerender();
      };
      return;
    }
    if (q.phase === 'result') {
      const again = U.$('#again', root);
      if (again) again.onclick = () => {
        /* 再战一场：直接开新一局 */
        const st = PW.store.state;
        if (PW.store.quizLeft() <= 0) { q.phase = 'home'; q.qs = []; PW.app.rerender(); return; }
        const recent = (st.quizRuns || []).slice(0, 3).reduce((acc, r) => acc.concat(r.texts || []), []);
        q.qs = PW.quiz.generate(st.profile.grade, st.config.quizCount || 20, recent);
        q.idx = 0; q.correct = 0; q.phase = 'quiz'; q.result = null;
        PW.app.rerender();
      };
      const back = U.$('#backHome', root);
      if (back) back.onclick = () => { q.phase = 'home'; q.qs = []; PW.app.rerender(); };
      return;
    }
    // quiz 进行中
    const quit = U.$('#qQuit', root);
    if (quit) quit.onclick = () => { reset(); PW.app.rerender(); };

    /* 闯关记录翻页 */
    const qLogPrev = U.$('#quizLogPrev', root);
    const qLogNext = U.$('#quizLogNext', root);
    if (qLogPrev) qLogPrev.onclick = () => { quizLogPage--; PW.app.rerender(); };
    if (qLogNext) qLogNext.onclick = () => { quizLogPage++; PW.app.rerender(); };

    const cur = q.qs[q.idx];
    if (cur.type === 'choice') {
      U.$$('#qOpts .q-opt', root).forEach((b) => {
        b.onclick = () => answer(b.dataset.i, b);
      });
    } else {
      const inp = U.$('#qInput', root);
      const submit = () => doInputAnswer(inp.value);
      U.$('#qSubmit', root).onclick = submit;
      if (inp) {
        inp.focus();
        inp.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
        inp.oninput = () => { q.inputDraft = inp.value; };
      }
    }
  }

  function doInputAnswer(val) {
    if (q.phase !== 'quiz') return;
    const cur = q.qs[q.idx];
    cur.userAns = val; // 记录用户答案，用于错题分析
    const ok = PW.quiz.check(cur, val);
    reveal(null, ok, cur.answer);
  }

  function answer(optIdx, btn) {
    if (q.phase !== 'quiz') return;
    const cur = q.qs[q.idx];
    cur.userAns = optIdx; // 记录用户答案，用于错题分析
    const ok = PW.quiz.check(cur, optIdx);
    // 标记对错
    const opts = U.$$('#qOpts .q-opt');
    opts.forEach((o) => { o.style.pointerEvents = 'none'; });
    if (btn) btn.classList.add(ok ? 'right' : 'wrong');
    if (!ok && opts[cur.answerIndex]) opts[cur.answerIndex].classList.add('right');
    reveal(btn, ok, cur.answer);
  }

  function reveal(btn, ok, ans) {
    if (ok) q.correct++;
    const fb = U.$('#qfb');
    if (fb) {
      fb.textContent = ok ? '✅ 答对啦！' : '❌ 正确答案：' + ans;
      fb.className = 'q-feedback ' + (ok ? 'ok' : 'no');
    }
    setTimeout(() => {
      q.idx++;
      q.inputDraft = '';
      if (q.idx >= q.qs.length) finish();
      else PW.app.rerender();
    }, 780);
  }

  function finish() {
    const total = q.qs.length;
    const accuracy = Math.round((q.correct / total) * 100);
    const cfg = PW.store.state.config;
    const rw = PW.quiz.reward(accuracy, cfg);
    // 记录每道题的类别和是否做错，用于报告的薄弱环节分析
    var cats = q.qs.map(function (x) { return x.cat || '其他'; });
    var wrongCats = [];
    q.qs.forEach(function (x, i) {
      // userAns 在 q.qs[i] 上（提交时标记）
      if (x.userAns !== undefined && x.userAns !== null) {
        var isCorrect;
        if (x.type === 'choice') isCorrect = String(x.userAns) === String(x.answerIndex);
        else isCorrect = String(x.userAns).trim() === String(x.answer).trim();
        if (!isCorrect) wrongCats.push(x.cat || '其他');
      }
    });
    q.result = Object.assign({ correct: q.correct, total, accuracy, texts: q.qs.map(function (x) { return x.text; }), cats: cats, wrongCats: wrongCats }, rw);
    q.phase = 'result';
    PW.store.addQuizRun(q.result);
    if (accuracy >= 80) U.confetti(accuracy >= 100 ? 70 : 40);
    if (accuracy >= 100) PW.petwidget && PW.petwidget.encourage();
    PW.app.rerender();
  }

  return { title: '闯关冒险', sub: '知识就是财富，闯关挑战开宝箱', render, mount };
})();
