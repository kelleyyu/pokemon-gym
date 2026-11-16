/* =========================================================
   PW · 闯关出题引擎（按年级动态生成 20 题，全部免草稿）
   ========================================================= */
PW.quiz = (function () {
  const U = PW.util;
  const B = PW.quizbank;

  function band(grade) {
    grade = Number(grade) || 4;
    if (grade <= 4) return 'p4';
    if (grade === 5) return 'p5';
    if (grade === 6) return 'p6';
    if (grade === 7) return 'j1';
    if (grade === 8) return 'j2';
    return 'j3';
  }
  function bandName(bd) {
    return { p4: '四年级', p5: '五年级', p6: '六年级', j1: '初一', j2: '初二', j3: '初三' }[bd] || '四年级';
  }
  function wordTier(bd) { return bd === 'p4' ? 't1' : (bd === 'p5' || bd === 'p6' ? 't2' : 't3'); }

  const num = (v) => String(Math.round(v * 1000) / 1000);

  /* ---------------- 口算 / 代数 ---------------- */
  function arith(bd) {
    const r = U.rnd, pick = U.pick;
    if (bd === 'p4') {
      switch (r(1, 12)) {
        // 三位数加减法
        case 1: { const a = r(105, 987), b = r(105, 987); return inp('口算', a + ' + ' + b + ' = ?', a + b); }
        case 2: { const a = r(300, 999), b = r(100, 299); return inp('口算', a + ' − ' + b + ' = ?', a - b); }
        // 两位数乘两位数（四年级核心）
        case 3: { const a = r(12, 39), b = r(12, 39); return inp('乘法', a + ' × ' + b + ' = ?', a * b); }
        // 三位数除以一位数
        case 4: { const b = r(2, 9), q = r(50, 199); return inp('除法', (b * q) + ' ÷ ' + b + ' = ?', q); }
        case 5: { const b = r(2, 9), q = r(20, 99), rem = r(1, b - 1); return inp('除法', (b * q + rem) + ' ÷ ' + b + ' = ?（商）', q); }
        // 小数加减（四年级下册）
        case 6: { const a = r(11, 89) / 10, bb = r(11, 89) / 10; return inp('小数', num(a) + ' + ' + num(bb) + ' = ?', num(Math.round((a + bb) * 10) / 10)); }
        case 7: { const a = r(50, 99) / 10, bb = r(11, 45) / 10; return inp('小数', num(a) + ' − ' + num(bb) + ' = ?', num(Math.round((a - bb) * 10) / 10)); }
        // 混合运算（两步，带括号）
        case 8: { const a = r(10, 50), b = r(3, 9), c = r(2, 6); return inp('混合', '(' + a + ' + ' + b + ') × ' + c + ' = ?', (a + b) * c); }
        case 9: { const a = r(20, 80), b = r(2, 9), c = r(3, 9); return inp('混合', a + ' × ' + b + ' − ' + c + ' = ?', a * b - c); }
        // 大数运算
        case 10: { const a = r(1000, 9999), b = r(1000, 9999); return inp('大数', a + ' + ' + b + ' = ?', a + b); }
        case 11: { const a = r(3000, 9999), b = r(1000, 2999); return inp('大数', a + ' − ' + b + ' = ?', a - b); }
        // 面积/周长
        default: { const a = r(4, 15), b = r(3, 12); return cho('图形', '长方形长' + a + 'cm、宽' + b + 'cm，面积=？cm²', [a * b, (a + b) * 2, a + b, a * 2 + b], 0); }
      }
    }
    if (bd === 'p5') {
      switch (r(1, 6)) {
        case 1: { const a = r(11, 25), b = r(11, 25); return inp('口算', a + ' × ' + b + ' = ?', a * b); }
        case 2: { const a = r(11, 89) / 10, b = r(11, 89) / 10; return inp('小数', num(a) + ' + ' + num(b) + ' = ?', num(Math.round((a + b) * 10) / 10)); }
        case 3: { const a = r(50, 99) / 10, b = r(11, 45) / 10; return inp('小数', num(a) + ' − ' + num(b) + ' = ?', num(Math.round((a - b) * 10) / 10)); }
        case 4: { const p = pick([10, 20, 25, 50]), n = pick([40, 60, 80, 200, 120]); return inp('百分数', p + '% × ' + n + ' = ?', n * p / 100); }
        case 5: { const d = pick([3, 4, 5, 6, 8]), a = r(2, d - 1), b = d - a; return cho('分数', a + '/' + d + ' + ' + b + '/' + d + ' = ?', ['1', '2', a + '/' + d, '0'], 0); }
        default: { const b = pick([2, 4, 5, 8]), q = r(11, 25); return inp('口算', (b * q) + ' ÷ ' + b + ' = ?', q); }
      }
    }
    if (bd === 'p6') {
      switch (r(1, 6)) {
        case 1: { const a = r(12, 45) / 10, b = pick([2, 4, 5, 0.5]); return inp('小数', num(a) + ' × ' + num(b) + ' = ?', num(Math.round(a * b * 100) / 100)); }
        case 2: { const a = r(2, 9), b = r(2, 9); return inp('分数', a + '/' + (a * b) + ' 化成最简分数的分母是 ?', b); }
        case 3: { const p = pick([15, 25, 40, 60, 75]), n = pick([80, 120, 200, 400]); return inp('百分数', p + '% × ' + n + ' = ?', n * p / 100); }
        case 4: { const a = r(2, 12), b = r(2, 12); return inp('比例', '若 ' + a + ' : ' + b + ' = x : ' + (b * 3) + '，x = ?', a * 3); }
        case 5: { const a = r(11, 30); return inp('口算', a + '² = ?', a * a); }
        default: { const a = r(3, 12), b = r(3, 12), c = r(2, 5); return inp('口算', a + ' × ' + b + ' + ' + c + ' × ' + b + ' = ?', b * (a + c)); }
      }
    }
    // 初中
    switch (r(1, 8)) {
      case 1: { const a = r(3, 19), b = r(4, 22); return inp('有理数', '(−' + a + ') + ' + b + ' = ?', b - a); }
      case 2: { const a = r(3, 15), b = r(3, 15); return inp('有理数', '(−' + a + ') × (−' + b + ') = ?', a * b); }
      case 3: { const a = r(2, 12); return inp('绝对值', '|' + (-a) + '| + ' + a + ' = ?', 2 * a); }
      case 4: { const k = r(2, 9), b = r(2, 15), x = r(2, 9); return inp('方程', k + 'x + ' + b + ' = ' + (k * x + b) + '，x = ?', x); }
      case 5: { const a = pick([4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144]); return inp('开方', '√' + a + ' = ?', Math.sqrt(a)); }
      case 6: { const a = r(2, 6), x = r(2, 6); return inp('代数式', '当 x = ' + x + ' 时，' + a + 'x² − ' + x + ' 的值 = ?', a * x * x - x); }
      case 7: { const p = r(2, 7), q = r(2, 7); return inp('因式', 'x² − ' + (p + q) + 'x + ' + (p * q) + ' = 0 的较大根是 ?', Math.max(p, q)); }
      default: { const k = r(2, 6), b = r(1, 9), x = r(2, 8); return inp('函数', '若 f(x) = ' + k + 'x − ' + b + '，f(' + x + ') = ?', k * x - b); }
    }
  }

  /* ---------------- 单位换算（小学） ---------------- */
  function unit() {
    const r = U.rnd, pick = U.pick;
    const set = [
      () => { const a = r(2, 9); return inp('单位', a + ' 米 = ? 厘米', a * 100); },
      () => { const a = r(2, 9); return inp('单位', a + ' 千米 = ? 米', a * 1000); },
      () => { const a = r(2, 9); return inp('单位', a + ' 千克 = ? 克', a * 1000); },
      () => { const a = r(2, 9); return inp('单位', a + ' 小时 = ? 分钟', a * 60); },
      () => { const a = r(2, 9); return inp('单位', a + ' 分钟 = ? 秒', a * 60); },
      () => { const a = r(2, 9); return inp('单位', a + ' 升 = ? 毫升', a * 1000); },
      () => { const a = r(2, 9); return inp('单位', a + ' 平方米 = ? 平方分米', a * 100); },
      () => { const a = r(2, 9); return inp('单位', a + ' 吨 = ? 千克', a * 1000); },
      () => { const a = r(2, 6); return inp('单位', '一个正方形边长 ' + a + ' 厘米，周长 = ? 厘米', a * 4); },
      () => { const a = r(3, 9), b = r(3, 9); return inp('图形', '长 ' + a + '、宽 ' + b + ' 的长方形面积 = ?', a * b); }
    ];
    return pick(set)();
  }

  /* ---------------- 英语单词 ---------------- */
  function word(bd) {
    const tier = wordTier(bd);
    const list = B.WORDS[tier];
    const item = U.pick(list);
    const others = U.shuffle(list.filter((w) => w[0] !== item[0])).slice(0, 3);
    if (Math.random() < 0.55) {
      const opts = U.shuffle([item[1]].concat(others.map((o) => o[1])));
      return cho('英语', '"' + item[0] + '" 的中文意思是？', opts, opts.indexOf(item[1]));
    }
    const opts = U.shuffle([item[0]].concat(others.map((o) => o[0])));
    return cho('英语', '"' + item[1] + '" 对应的英文单词是？', opts, opts.indexOf(item[0]));
  }

  /* ---------------- 从固定题库取 MCQ ---------------- */
  function fromBank(list, cat) {
    const it = U.pick(list);
    const right = it.opts[it.a];
    const opts = U.shuffle(it.opts.slice());
    return cho(cat, it.q, opts, opts.indexOf(right));
  }

  /* ---------------- 题目构造 ---------------- */
  function inp(cat, text, answer) {
    return { id: U.uid('q'), type: 'input', cat, text, answer: String(answer) };
  }
  function cho(cat, text, opts, ai) {
    return { id: U.uid('q'), type: 'choice', cat, text, opts, answerIndex: ai, answer: opts[ai] };
  }

  /* ---------------- 综合 / 拓展应用题 ---------------- */
  function comprehensive(bd) {
    const r = U.rnd, pick = U.pick;
    if (bd[0] === 'j') {
      switch (r(1, 6)) {
        case 1: { const v1 = r(40, 80), v2 = r(40, 80), d = r(3, 8) * 100;
          return inp('应用题', '甲、乙两车从相距 ' + d + ' 米的两地同时相向而行，甲速 ' + v1 + ' 米/分、乙速 ' + v2 + ' 米/分，几分钟后相遇？', Math.round(d / (v1 + v2))); }
        case 2: { const c = pick([80, 100, 120, 150]), p = c + pick([20, 30, 40, 50]);
          return inp('应用题', '一件商品进价 ' + c + ' 元，售价 ' + p + ' 元，利润率约是多少（%）？', Math.round((p - c) / c * 100)); }
        case 3: { const a = r(4, 9), b = r(4, 9);
          return inp('应用题', '一项工程，甲单独做 ' + a + ' 天完成，乙单独做 ' + b + ' 天完成，两人合作约几天完成（保留整数）？', Math.round(a * b / (a + b))); }
        case 4: { const s = r(10, 40), w = r(60, 160);
          return inp('应用题', s + ' 克盐溶于 ' + w + ' 克水中，盐水浓度约是多少（%）？', Math.round(s / (s + w) * 100)); }
        case 5: { const k = pick([100, 200, 500, 1000]), d = r(2, 9);
          return inp('应用题', '地图比例尺 1:' + k + '，图上距离 ' + d + ' 厘米，实际距离约多少米？', Math.round(d * k / 100)); }
        default: { const n = r(3, 8);
          return inp('应用题', '小明有 ' + (n * 3) + ' 颗糖，是小红的 3 倍，小红有几颗糖？', n); }
      }
    }
    switch (r(1, 6)) {
      case 1: { const price = r(3, 19), cnt = r(2, 4), pay = price * cnt + r(5, 49);
        return inp('应用题', '一支笔 ' + price + ' 元，买 ' + cnt + ' 支，付了 ' + pay + ' 元，应找回多少？', pay - price * cnt); }
      case 2: { const sp = r(50, 90), t = r(5, 15);
        return inp('应用题', '小明每分钟走 ' + sp + ' 米，走了 ' + t + ' 分钟，一共走了多少米？', sp * t); }
      case 3: { const a = r(4, 9), b = r(3, 8), c = r(2, 4);
        return inp('应用题', '房间长 ' + a + ' 米、宽 ' + b + ' 米，用边长 ' + c + ' 米的正方形地砖铺满，至少需要多少块？', Math.ceil(a * b / (c * c))); }
      case 4: { const a = r(20, 60), k = r(2, 4);
        return inp('应用题', '故事书有 ' + a + ' 本，科技书是故事书的 ' + k + ' 倍，两种书一共多少本？', a + a * k); }
      case 5: { const h1 = r(8, 18), m1 = pick([0, 15, 30, 45]), h2 = h1 + r(1, 3), m2 = pick([0, 15, 30, 45]);
        const mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        return inp('应用题', '电影从 ' + h1 + ':' + (m1 < 10 ? '0' + m1 : m1) + ' 开始，到 ' + h2 + ':' + (m2 < 10 ? '0' + m2 : m2) + ' 结束，时长多少分钟？', mins); }
      default: { const x = r(2, 6), y = r(3, 9);
        return inp('应用题', '一盒鸡蛋有 ' + (x * y) + ' 个，平均分成 ' + x + ' 盘，每盘几个？', y); }
    }
  }

  /* ---------------- 组卷 ---------------- */
  const PLAN = {
    p4: { arith: 8, unit: 2, word: 5, cn: 3, sci: 1, comp: 1 },
    p5: { arith: 8, unit: 2, word: 5, cn: 3, sci: 1, comp: 1 },
    p6: { arith: 8, unit: 1, word: 5, cn: 3, sci: 2, comp: 1 },
    j1: { arith: 7, unit: 0, word: 6, cn: 3, sci: 3, comp: 1 },
    j2: { arith: 7, unit: 0, word: 6, cn: 3, sci: 3, comp: 1 },
    j3: { arith: 8, unit: 0, word: 6, cn: 3, sci: 2, comp: 1 }
  };

  /* generate(grade, total, exclude)
   * - exclude: 最近若干次闯关的题目文本数组，避免连续两局出现完全相同的题
   * - 同局内按文本精确去重；不足时跨类型随机补足（仍去重 + 排除跨局重复） */
  function generate(grade, total, exclude) {
    const bd = band(grade);
    const plan = PLAN[bd];
    total = total || 20;
    const junior = bd[0] === 'j';
    const excludeSet = (exclude && exclude.length) ? new Set(exclude) : null;

    const qs = [];
    const seen = {};
    const ok = (q) => {
      if (!q) return false;
      if (seen[q.text]) return false;
      if (excludeSet && excludeSet.has(q.text)) return false;
      seen[q.text] = 1;
      return true;
    };

    for (let i = 0; i < plan.arith; i++) { const q = arith(bd); if (ok(q)) qs.push(q); }
    for (let i = 0; i < plan.unit; i++) { const q = unit(); if (ok(q)) qs.push(q); }
    for (let i = 0; i < plan.word; i++) {
      const q = (junior && i % 2 === 1) ? fromBank(B.EN_GRAMMAR, '英语语法') : word(bd);
      if (ok(q)) qs.push(q);
    }
    for (let i = 0; i < plan.cn; i++) {
      const pool = i % 3 === 0 ? B.IDIOMS : (i % 3 === 1 ? B.POEMS : B.CN_MISC);
      const q = fromBank(pool, '语文');
      if (ok(q)) qs.push(q);
    }
    for (let i = 0; i < plan.sci; i++) { const q = fromBank(junior ? B.JR_SCI : B.PR_SCI, '常识'); if (ok(q)) qs.push(q); }
    for (let i = 0; i < plan.comp; i++) { const q = comprehensive(bd); if (ok(q)) qs.push(q); }

    // 补足（跨类型随机，仍去重 + 排除跨局重复）
    const fillers = [
      () => arith(bd),
      () => word(bd),
      () => comprehensive(bd),
      () => fromBank(junior ? B.JR_SCI : B.PR_SCI, '常识')
    ];
    let guard = 0;
    while (qs.length < total && guard++ < 300) {
      const q = fillers[U.rnd(0, fillers.length - 1)]();
      if (ok(q)) qs.push(q);
    }
    return U.shuffle(qs).slice(0, total);
  }

  /* ---------------- 判分 ---------------- */
  function check(q, val) {
    if (q.type === 'choice') return String(val) === String(q.answerIndex);
    const s = String(val == null ? '' : val).trim().replace(/。/g, '.').replace(/，/g, '');
    if (!s) return false;
    const a = parseFloat(q.answer), b = parseFloat(s);
    if (isNaN(b)) return s === q.answer;
    return Math.abs(a - b) < 1e-6;
  }

  /** 奖励档位：按正确率 */
  function reward(accuracy, cfg) {
    const r = cfg.rewards;
    if (accuracy >= 100) return { coins: r.quiz100.coins, stars: r.quiz100.stars, tier: '完美通关', grade: 'S' };
    if (accuracy >= 90) return { coins: r.quiz90.coins, stars: r.quiz90.stars, tier: '优秀通关', grade: 'A' };
    if (accuracy >= 80) return { coins: r.quiz80.coins, stars: r.quiz80.stars, tier: '成功通关', grade: 'B' };
    return { coins: 0, stars: 0, tier: '再来一次', grade: 'C' };
  }

  return { band, bandName, generate, check, reward, PLAN };
})();
