/* =========================================================
   PW · 数学表达式解析器（口算检查核心）
   支持四则运算：+ - × ÷ / ·
   输入：OCR识别出的文本行
   输出：每行的解析结果（算式、正确答案、学生答案、对错）
   ========================================================= */
PW.mathcheck = (function () {

  /* ---------- 算式正则 ----------
     匹配格式：
       123 + 456 = 579
       12×3=36
       100÷4=25
       23 - 14 = 9
     不匹配：纯文字、应用题描述等
  */
  // 主模式：数字 运算符 数字 = 答案（允许空格）
  const RE_MAIN = /^\s*(\d+(?:\.\d+)?)\s*([+\-×x·÷/])\s*(\d+(?:\.\d+)?)\s*=\s*(\d+(?:\.\d+)?)\s*$/;

  // 连续运算：a + b + c = d （最多3个操作数）
  // 暂不支持，保持简单

  /**
   * 安全计算表达式（避免 eval）
   * @param {number} a - 左操作数
   * @param {string} op - 操作符
   * @param {number} b - 右操作数
   * @returns {number|null} 结果，除零返回 null
   */
  function calc(a, op, b) {
    a = Number(a); b = Number(b);
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': case 'x': case 'X': case '*': case '·': return Math.round(a * b * 10000) / 10000; // 避免浮点误差
      case '÷': case '/':
        if (b === 0) return null;
        return Math.round(a / b * 10000) / 10000;
      default: return null;
    }
  }

  /**
   * 规范化操作符（统一为标准形式）
   */
  function normalizeOp(op) {
    if (op === 'x' || op === 'X' || op === '*' || op === '·') return '×';
    if (op === '/') return '÷';
    return op;
  }

  /**
   * 解析单行文本
   * @param {string} line - 一行文本
   * @returns {object|null} 解析结果或 null（非算式行）
   *
   * 返回格式：
   * {
   *   raw: "23 + 45 = 68",
   *   left: 23,
   *   op: "+",
   *   right: 45,
   *   studentAns: 68,
   *   correctAns: 68,
   *   correct: true,
   *   type: 'math'
   * }
   */
  function parseLine(line) {
    if (typeof line !== 'string' || !line.trim()) return null;

    const m = line.match(RE_MAIN);
    if (!m) return null;

    const left = parseFloat(m[1]);
    const op = normalizeOp(m[2]);
    const right = parseFloat(m[3]);
    const studentAns = parseFloat(m[4]);
    const correctAns = calc(left, op, right);

    if (correctAns === null) {
      return { raw: line.trim(), left, op, right, studentAns: m[4], correctAns: null, correct: false, error: 'DIV_ZERO', type: 'math' };
    }

    // 浮点数比较（允许微小误差）
    const isCorrect = Math.abs(studentAns - correctAns) < 0.0001;

    return {
      raw: line.trim(),
      left,
      op,
      right,
      studentAns: m[4],
      correctAns: correctAns % 1 === 0 ? correctAns : parseFloat(correctAns.toFixed(4)),
      correct: isCorrect,
      type: 'math'
    };
  }

  /**
   * 批量解析多行文本
   * @param {string} text - 多行文本
   * @returns {{ lines: object[], total: number, correct: number, wrong: number, skipped: number }}
   */
  function parseText(text) {
    if (!text || typeof text !== 'text') return { lines: [], total: 0, correct: 0, wrong: 0, skipped: 0 };

    const allLines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const results = [];
    let correct = 0, wrong = 0, skipped = 0;

    allLines.forEach((line) => {
      const r = parseLine(line);
      if (r) {
        results.push(r);
        if (r.correct) correct++; else wrong++;
      } else {
        skipped++;
        results.push({ raw: line, type: 'text', skipped: true });
      }
    });

    return { lines: results, total: results.length, correct, wrong, skipped };
  }

  /**
   * 生成错题记录（用于存入错题集）
   * @param {object} parsed - parseLine 的返回值
   * @param {string} subject - 科目
   * @returns {object} 错题记录
   */
  function makeMistakeRecord(parsed, subject) {
    return {
      id: 'mk_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      expression: parsed.raw,
      correctAns: parsed.correctAns,
      studentAns: parsed.studentAns,
      subject: subject || 'math',
      type: parsed.type,
      at: Date.now(),
      date: (typeof PW !== 'undefined' && PW.util && PW.util.todayStr) ? PW.util.todayStr() : new Date().toISOString().slice(0, 10),
      fixed: false
    };
  }

  return {
    parseLine,
    parseText,
    calc,
    normalizeOp,
    makeMistakeRecord,
    RE_MAIN
  };
})();
