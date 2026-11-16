/* =========================================================
 * PW · 宝可梦图鉴（官方立绘版）
 * 数据来自 PokéAPI 官方立绘（tools/build_pokedex.js 预生成 PW_POKEDEX）
 * 全图鉴基础形态 + 4 只初始伙伴的成长进化链
 * 渲染改为 <img> 官方立绘 + 装扮 emoji 叠加
 * ========================================================= */
PW.pokemon = (function () {

  /* 官方立绘源（国内用 jsDelivr，raw 作兜底） */
  const ART_JS = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/other/official-artwork/';
  const ART_RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/';

  /* ---------- 全图鉴（预生成） ---------- */
  const DEX_SRC = (typeof window !== 'undefined' && window.PW_POKEDEX) || [];

  /* 初始伙伴（全国图鉴编号）：皮卡丘 / 妙蛙种子 / 杰尼龟 / 小火龙 */
  const STARTERS = ['25', '1', '7', '4'];
  const STARTER_INFO = {
    '25': { type: '电', desc: '脸颊有电囊，开心时会放小电花。' },
    '1':  { type: '草', desc: '背上的种子会随着阳光慢慢长大。' },
    '7':  { type: '水', desc: '会从嘴里喷出泡泡水枪，性格温和。' },
    '4':  { type: '火', desc: '尾巴的火苗代表它的心情，越旺越精神。' }
  };
  /* 关都全图鉴(1–151)线性进化链：随成长进化（stage0→150→stage1→450→stage2）。
     分支进化（伊布→水/雷/火伊布）与跨代道具/亲密度/通信进化不在成长模型内，故未纳入。 */
  /* Kanto 基线（含幼基拉斯家系）：手写以保证成长模型一致，自动生成数据作补充（见下方合并） */
  const EVO_BASE = { '1': '2', '2': '3', '4': '5', '5': '6', '7': '8', '8': '9', '10': '11', '11': '12', '13': '14', '14': '15', '16': '17', '17': '18', '19': '20', '21': '22', '23': '24', '25': '26', '27': '28', '29': '30', '30': '31', '32': '33', '33': '34', '35': '36', '37': '38', '39': '40', '41': '42', '43': '44', '44': '45', '46': '47', '48': '49', '50': '51', '52': '53', '54': '55', '56': '57', '58': '59', '60': '61', '61': '62', '63': '64', '64': '65', '66': '67', '67': '68', '69': '70', '70': '71', '72': '73', '74': '75', '75': '76', '77': '78', '79': '80', '81': '82', '84': '85', '86': '87', '88': '89', '90': '91', '92': '93', '93': '94', '96': '97', '98': '99', '100': '101', '102': '103', '104': '105', '109': '110', '111': '112', '115': '116', '117': '118', '119': '120', '129': '130', '138': '139', '140': '141', '147': '148', '148': '149', '246': '247', '247': '248' };
  const STAGE_BASE = {
    '1': 0, '2': 1, '3': 2,
    '4': 0, '5': 1, '6': 2,
    '7': 0, '8': 1, '9': 2,
    '10': 0, '11': 1, '12': 2,
    '13': 0, '14': 1, '15': 2,
    '16': 0, '17': 1, '18': 2,
    '19': 0, '20': 1,
    '21': 0, '22': 1,
    '23': 0, '24': 1,
    '25': 0, '26': 1,
    '27': 0, '28': 1,
    '29': 0, '30': 1, '31': 2,
    '32': 0, '33': 1, '34': 2,
    '35': 0, '36': 1,
    '37': 0, '38': 1,
    '39': 0, '40': 1,
    '41': 0, '42': 1,
    '43': 0, '44': 1, '45': 2,
    '46': 0, '47': 1,
    '48': 0, '49': 1,
    '50': 0, '51': 1,
    '52': 0, '53': 1,
    '54': 0, '55': 1,
    '56': 0, '57': 1,
    '58': 0, '59': 1,
    '60': 0, '61': 1, '62': 2,
    '63': 0, '64': 1, '65': 2,
    '66': 0, '67': 1, '68': 2,
    '69': 0, '70': 1, '71': 2,
    '72': 0, '73': 1,
    '74': 0, '75': 1, '76': 2,
    '77': 0, '78': 1,
    '79': 0, '80': 1,
    '81': 0, '82': 1,
    '84': 0, '85': 1,
    '86': 0, '87': 1,
    '88': 0, '89': 1,
    '90': 0, '91': 1,
    '92': 0, '93': 1, '94': 2,
    '96': 0, '97': 1,
    '98': 0, '99': 1,
    '100': 0, '101': 1,
    '102': 0, '103': 1,
    '104': 0, '105': 1,
    '109': 0, '110': 1,
    '111': 0, '112': 1,
    '115': 0, '116': 1,
    '117': 0, '118': 1,
    '119': 0, '120': 1,
    '129': 0, '130': 1,
    '138': 0, '139': 1,
    '140': 0, '141': 1,
    '147': 0, '148': 1, '149': 2,
    '246': 0, '247': 1, '248': 2
  };

  /* 全图鉴进化数据（tools/build_evolutions.js 自动生成）：补充跨世代宝可梦的进化链与 stage。
     生成数据在前，Kanto 基线（EVO_BASE / STAGE_BASE）在后覆盖，保证已有成长模型一致；
     分支进化（伊布等）多子节点未登记 next，沿用单链成长模型。 */
  const EVO_GEN = (typeof window !== 'undefined' && window.PW_EVOLUTION) || {};
  const STAGE_GEN = (typeof window !== 'undefined' && window.PW_STAGES) || {};
  const EVOLUTION = Object.assign({}, EVO_GEN, EVO_BASE);
  const STAGE_MAP = Object.assign({}, STAGE_GEN, STAGE_BASE);

  /* 装扮叠加（emoji + 身体部位定位） */
  const COSMETIC_EMOJI = {
    hat_straw: { icon: '👒', pos: 'hat' }, bow: { icon: '🎀', pos: 'head' },
    hat_cap: { icon: '🧢', pos: 'hat' }, glasses: { icon: '\U0001f537', pos: 'face' },
    scarf: { icon: '🧣', pos: 'neck' }, headphone: { icon: '🎧', pos: 'hat' },
    hat_grad: { icon: '🎓', pos: 'hat' }, wings: { icon: '\U0001fa4a', pos: 'back' },
    cape: { icon: '🦸', pos: 'back' }, crown: { icon: '👑', pos: 'hat' }
  };
  /* 部位定位 */
  const POS_STYLE = {
    hat:   { top: '-6px', left: '50%', transform: 'translateX(-50%)', fontSize: '30px', zIndex: 3 },
    head:  { top: '4px', right: '-4px', fontSize: '18px', zIndex: 2 },
    face:  { top: '34%', left: '50%', transform: 'translateX(-50%)', fontSize: '20px', zIndex: 2 },
    neck:  { top: '50%', left: '50%', transform: 'translateX(-50%)', fontSize: '22px', zIndex: 2 },
    back:  { top: '22%', right: '-10px', fontSize: '28px', zIndex: 1 }
  };

  /* ---------- 成长与进化阈值（宠物养成用，不变） ---------- */
  const GROWTH = { perDay: 10, stage1: 150, stage2: 450 };
  function nextThreshold(stage) {
    if (stage === 0) return GROWTH.stage1;
    if (stage === 1) return GROWTH.stage2;
    return null;
  }

  /* ---------- 构建图鉴 ---------- */
  const DEX = DEX_SRC.map((p) => {
    const no = String(p.no);
    const info = STARTER_INFO[no];
    return {
      id: no,
      no: p.no,
      name: p.zh || p.en,
      en: p.en,
      type: info ? info.type : '',
      desc: info ? info.desc : (p.genus || ''),
      color: p.color || 'gray',
      rarity: p.rarity || 'R',
      stage: STAGE_MAP[no] != null ? STAGE_MAP[no] : 0,
      next: EVOLUTION[no] || null
    };
  });
  const MAP = {};
  DEX.forEach((p) => (MAP[p.id] = p));

  /* 捕捉/盲盒池阶段：有进化数据用真实阶段；单阶（无法进化）宝可梦返回 -1，不进入任何球/盲盒池，
     保证精灵球只捞到「能进化的一阶」，避免抓到盐石巨灵这类单阶宝可梦 */
  function catchStage(no) {
    if (STAGE_MAP[no] == null) return -1;
    if (STAGE_MAP[no] === 0 && !EVOLUTION[no]) return -1; // 单阶基础形态（无进化链）不进捕捉池
    return STAGE_MAP[no];
  }
  /* 盲盒池：仅初级（stage 0）宝可梦，进化形态需通过喂养获得 */
  const BOX_POOL = DEX.filter((p) => catchStage(p.id) === 0).map((p) => p.id);

  /* ---------- 渲染（官方立绘 + 装扮） ---------- */
  function artUrl(no) { return ART_JS + no + '.png'; }

  /** 图片加载失败兜底：先换 raw，再换 🔴 占位 */
  function imgError(img) {
    if (img.dataset.fb !== '1') {
      img.dataset.fb = '1';
      img.src = ART_RAW + img.dataset.no + '.png';
    } else {
      img.onerror = null;
      img.style.visibility = 'hidden';
      const s = document.createElement('span');
      s.textContent = '🔴';
      s.style.fontSize = '2.2em';
      img.parentNode.insertBefore(s, img.nextSibling);
    }
  }

  /**
   * 渲染宝可梦
   * @param {string} no   全国图鉴编号
   * @param {string[]} cosmetics 已装备装扮 id
   */
  function render(no, cosmetics) {
    const p = MAP[no] || {};
    const cos = (cosmetics || []).filter((c) => COSMETIC_EMOJI[c]);
    let html = '<div class="poke-render">';
    html += '<img class="poke-img" src="' + artUrl(no) + '" alt="' + (p.name || '') + '" loading="lazy" ' +
      'data-no="' + no + '" onerror="PW.pokemon.imgError(this)">';
    if (cos.length) {
      // 按部位定位穿戴在宝可梦身上
      html += cos.map(function(c) {
        const info = COSMETIC_EMOJI[c];
        const style = POS_STYLE[info.pos] || {};
        const parts = Object.keys(style).map(function(k){return k+':'+style[k]}).join(';');
        return '<span class="cos-item" style="'+parts+'">'+info.icon+'</span>';
      }).join('');
    }
    html += '</div>';
    return html;
  }

  function get(no) { return MAP[no] || null; }
  function name(no) { return (MAP[no] || {}).name || '神秘宝可梦'; }
  function totalCount() { return DEX.length; }

  return {
    DEX, MAP, STARTERS, BOX_POOL, GROWTH, EVOLUTION, STAGE_MAP, catchStage,
    COSMETIC_EMOJI, artUrl, imgError, render, get, name, nextThreshold, totalCount
  };
})();
