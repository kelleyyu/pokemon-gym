/* =========================================================
   PW · 科目定义 + 作业文本智能分类
   ========================================================= */
PW.subjects = (function () {

  const LIST = [
    { key: 'chinese', name: '语文', icon: '📖', color: '#ee5b5b', stage: 'all',
      kw: ['语文', '生字', '字词', '词语', '听写', '默写', '背诵', '朗读', '古诗', '课文', '作文', '日记', '阅读理解', '练字', '看拼音', '组词', '造句', '摘抄', '成语', '文言文', '名著', '周记', '书法'] },
    { key: 'math', name: '数学', icon: '➗', color: '#2a75bb', stage: 'all',
      kw: ['数学', '口算', '计算', '竖式', '应用题', '解方程', '方程', '几何', '面积', '周长', '分数', '小数', '倍数', '因数', '统计', '图形', '函数', '不等式', '三角形', '习题', '错题'] },
    { key: 'english', name: '英语', icon: '🔤', color: '#f2a900', stage: 'all',
      kw: ['英语', '单词', '英文', 'unit', 'Unit', '跟读', '听读', '课文录音', '句型', '语法', '完形', '英语作文', '音标', '短语', 'abc'] },
    { key: 'other', name: '其他', icon: '📌', color: '#93a1b3', stage: 'all',
      kw: ['科学', '实验', '观察', '自然', '道法', '道德与法治', '品德', '法治', '物理', '受力', '电路', '透镜', '浮力', '欧姆', '化学', '化学式', '方程式', '溶液', '元素', '生物', '细胞', '光合', '生态', '历史', '朝代', '年表', '史料', '地理', '地图', '气候', '经纬', '政治', '思想品德', '音乐', '美术', '画', '手工', '体育', '跳绳', '素描', '海报', '手抄报', '信息', '编程', '电脑', 'scratch', '打字'] }
  ];

  const MAP = {};
  LIST.forEach((s) => (MAP[s.key] = s));

  /** 家庭作业（家长/自主安排）关键词 */
  const HOME_KW = ['家长', '家庭', '妈妈', '爸爸', '自主', '课外', '亲子', '加练', '拓展', '额外', '预习加', '自选', '奥数', '兴趣', '打卡', '练琴', '家务'];
  /** 学校布置关键词 */
  const SCHOOL_KW = ['老师', '课堂', '校内', '作业本', '练习册', '试卷', '同步', '课本', '书上', '第几页', '交'];

  function get(key) { return MAP[key] || MAP.other; }

  function forGrade(grade) {
    const stage = grade >= 7 ? 'junior' : 'primary';
    return LIST.filter((s) => s.stage === 'all' || s.stage === stage);
  }

  function detectSubject(text) {
    const t = String(text || '').toLowerCase();
    let best = null, bestPos = 1e9;
    LIST.forEach((s) => {
      s.kw.forEach((k) => {
        const p = t.indexOf(String(k).toLowerCase());
        if (p >= 0 && p < bestPos) { bestPos = p; best = s.key; }
      });
    });
    return best || 'other';
  }

  function detectTag(text) {
    const t = String(text || '');
    for (let i = 0; i < HOME_KW.length; i++) if (t.indexOf(HOME_KW[i]) >= 0) return 'home';
    for (let i = 0; i < SCHOOL_KW.length; i++) if (t.indexOf(SCHOOL_KW[i]) >= 0) return 'school';
    return 'school';
  }

  /**
   * 把 OCR / 手动粘贴的一整段作业文本解析成任务条目
   * 支持：1. / 1、/ ① / - / • 编号，"语文：" 段落标题，中文分号顿号分隔
   */
  function parseText(raw) {
    if (!raw) return [];
    let text = String(raw)
      .replace(/\r/g, '\n')
      .replace(/[｜|]/g, '\n')
      .replace(/([；;])/g, '\n');

    const rawLines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    const items = [];
    let curSubject = null;

    const noise = /^(今日作业|今天作业|作业|家庭作业|作业布置|各位家长|家长朋友|通知|请查收|今日|日期|附件|完成后|签字|以上|谢谢|温馨提示|注意|明天|周[一二三四五六日])[:：]?$/;
    const headSubject = /^(语文|数学|英语)\s*[:：]?\s*$/;

    rawLines.forEach((line) => {
      let s = line
        .replace(/^[\s\u3000]*[\d一二三四五六七八九十]{1,2}\s*[.、．)）:：]\s*/, '')
        .replace(/^[\s\u3000]*[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
        .replace(/^[\s\u3000]*[-—•·*▪◆●]\s*/, '')
        .replace(/^[\s\u3000]*[（(]\d+[)）]\s*/, '')
        .trim();

      if (!s) return;
      if (noise.test(s)) return;
      if (s.length < 2) return;
      if (/^[\d\s:：\-\/年月日周（）()]+$/.test(s)) return;

      const hs = s.match(headSubject);
      if (hs) { curSubject = detectSubject(hs[1]); return; }

      // "语文：抄写生字2遍" —— 同行带科目前缀
      const inline = s.match(/^(语文|数学|英语)\s*[:：]\s*(.+)$/);
      let subject = null, body = s;
      if (inline) { subject = detectSubject(inline[1]); body = inline[2].trim(); curSubject = subject; }

      if (body.length < 2) return;
      const detected = detectSubject(body);
      const finalSubject = subject || (detected !== 'other' ? detected : (curSubject || 'other'));

      items.push({
        title: body.slice(0, 90),
        subject: finalSubject,
        tag: detectTag(body)
      });
    });

    // 去重
    const seen = {};
    return items.filter((it) => {
      const k = it.title.replace(/\s/g, '');
      if (seen[k]) return false;
      seen[k] = 1; return true;
    }).slice(0, 30);
  }

  return { LIST, MAP, get, forGrade, detectSubject, detectTag, parseText, HOME_KW, SCHOOL_KW };
})();
