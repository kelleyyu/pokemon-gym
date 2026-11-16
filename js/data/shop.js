/* =========================================================
   PW · 训练奖励 / 金币商店 / 盲盒
   ========================================================= */
PW.shop = (function () {

  /* ---------- 星星兑换现金（非线性阶梯：越攒越划算！）
     设计原则：
       低档位方便「天天能换」，高档位明显更值（鼓励攒星星）
       ★/<svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg> 从 25 降到约 9，顶级性价比是入门的 2.7 倍
       零花钱兑换不设月度上限，有星星即可兑换（界面「收益预览」仅为每月可换金额的估算参考）
     四年级实测估算：
       作业 ≈5项/天=10★，阅读+运动=10★，闯关≈3★ → 日≈23★
       周≈145★，月≈600★ → 全换最高档约 <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg>65（无月度上限，星星足即可全兑）
  -------------------------------------------------------- */
  const CASH = [
    { id: 'cash1',  stars: 25,  cash: 1,  name: '一枚硬币', icon: '💴', desc: '相当于 1 元' },
    { id: 'cash3',  stars: 60,  cash: 3,  name: '一张钞票', icon: '💵', desc: '相当于 3 元' },
    { id: 'cash8',  stars: 120, cash: 8,  name: '几张钞票', icon: '💷', desc: '相当于 8 元', tip: true },
    { id: 'cash18', stars: 220, cash: 18, name: '一叠钞票', icon: '🧧', desc: '相当于 18 元' },
    { id: 'cash35', stars: 380, cash: 35,  name: '一堆钞票', icon: '💎', desc: '相当于 35 元' },
    { id: 'cash60', stars: 550, cash: 60,  name: '好多钞票', icon: '👑', desc: '相当于 60 元', tip: true }
  ];

  /* ---------- 金币商店：消耗品（每种照顾类型分基础/中档/高档，同成长值=同价格，统一 2币/成长点） ---------- */
  const CONSUMABLE = [
    /* ---- 喂食 food ---- */
    { id: 'berry', coins: 8, name: '元气树果', icon: '🍎', kind: 'food', growth: 4, desc: '喂食一次 · 成长 +4' },
    { id: 'lunchBox', coins: 12, name: '营养便当', icon: '🍞', kind: 'food', growth: 6, desc: '丰盛午餐 · 成长 +6' },
    { id: 'superBerry', coins: 16, name: '超级树果', icon: '🍇', kind: 'food', growth: 8, desc: '高级喂食 · 成长 +8' },
    /* ---- 喝水 water ---- */
    { id: 'water', coins: 8, name: '清泉水', icon: '💧', kind: 'water', growth: 4, desc: '喝水一次 · 成长 +4' },
    { id: 'vitaminWater', coins: 12, name: '维生素水', icon: '🥛', kind: 'water', growth: 6, desc: '营养补水 · 成长 +6' },
    { id: 'energyDrink', coins: 16, name: '能量饮品', icon: '🧃', kind: 'water', growth: 8, desc: '活力饮料 · 成长 +8' },
    /* ---- 洗澡 bath ---- */
    { id: 'soap', coins: 8, name: '泡泡香波', icon: '🧼', kind: 'bath', growth: 4, desc: '洗澡一次 · 成长 +4' },
    { id: 'spaOil', coins: 12, name: '精油SPA', icon: '🧖', kind: 'bath', growth: 6, desc: '精油护理 · 成长 +6' },
    { id: 'spaSalt', coins: 16, name: '香薰浴盐', icon: '🛁', kind: 'bath', growth: 8, desc: '豪华洗澡 · 成长 +8' }
  ];
  const CONSUMABLE_MAP = {};
  CONSUMABLE.forEach((c) => (CONSUMABLE_MAP[c.id] = c));

  /* ---------- 金币商店：装扮（越好看越贵） ---------- */
  const COSMETIC = [
    { id: 'hat_straw', coins: 60, name: '夏日草帽', icon: '👒', rarity: 'R' },
    { id: 'bow', coins: 80, name: '甜心蝴蝶结', icon: '🎀', rarity: 'R' },
    { id: 'hat_cap', coins: 100, name: '训练家帽', icon: '🧢', rarity: 'R' },
    { id: 'glasses', coins: 130, name: '酷炫墨镜', icon: '🕶️', rarity: 'SR' },
    { id: 'scarf', coins: 150, name: '火焰围巾', icon: '🧣', rarity: 'SR' },
    { id: 'headphone', coins: 180, name: '音乐耳机', icon: '🎧', rarity: 'SR' },
    { id: 'hat_grad', coins: 240, name: '学霸学士帽', icon: '🎓', rarity: 'SR' },
    { id: 'wings', coins: 360, name: '天使之翼', icon: '👼', rarity: 'SSR' },
    { id: 'cape', coins: 420, name: '冠军披风', icon: '🦸', rarity: 'SSR' },
    { id: 'crown', coins: 560, name: '传说王冠', icon: '👑', rarity: 'SSR' }
  ];
  const COSMETIC_MAP = {};
  COSMETIC.forEach((c) => (COSMETIC_MAP[c.id] = c));

  /* ---------- 金币商店：精灵球（每天每种限购1个，指定阶段宝可梦） ---------- */
  const POKEBALLS = [
    { id: 'pokeball', coins: 500, name: '精灵球', icon: '<svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="24" r="22" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="2.4"/><path d="M2 24 A22 22 0 0 1 46 24 Z" fill="#e63946"/><rect x="2" y="21.4" width="44" height="5.2" fill="#2b2b2b"/><circle cx="24" cy="24" r="8.4" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="2.4"/><circle cx="24" cy="24" r="3.6" fill="#2b2b2b"/></svg>', stage: 0, desc: '捕捉初级宝可梦' },
    { id: 'ultraball', coins: 1000, name: '巢穴球', icon: '<svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="24" r="22" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="2.4"/><path d="M2 24 A22 22 0 0 1 46 24 Z" fill="#d9b15c"/><rect x="2" y="21.4" width="44" height="5.2" fill="#e63946"/><circle cx="24" cy="24" r="8.4" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="2.4"/><circle cx="24" cy="24" r="3.6" fill="#e63946"/></svg>', stage: 1, desc: '捕捉中级宝可梦' },
    { id: 'masterball', coins: 3000, name: '高级球', icon: '<svg viewBox="0 0 48 48" width="44" height="44"><circle cx="24" cy="24" r="22" fill="#f4f4f4" stroke="#2b2b2b" stroke-width="2.4"/><path d="M2 24 A22 22 0 0 1 46 24 Z" fill="#1f1f1f"/><rect x="2" y="21.4" width="44" height="5.2" fill="#ffd400"/><circle cx="24" cy="24" r="8.4" fill="#1f1f1f" stroke="#2b2b2b" stroke-width="2.4"/><circle cx="24" cy="24" r="3.6" fill="#ffd400"/></svg>', stage: 2, desc: '捕捉高级宝可梦' }
  ];
  const POKEBALL_MAP = {};
  POKEBALLS.forEach((p) => (POKEBALL_MAP[p.id] = p));

  /* ---------- 盲盒每日限抽次数 ---------- */
  const BLIND_BOX_DAILY_LIMIT = 6;
  const BOX_COST_DEFAULT = 150;

  /** 抽盲盒：返回 {type, id, name, icon, rarity, amount} —— 使用可配置比例和数量 */
  function drawBox(state) {
    const U = PW.util;
    const ownedPets = Object.keys(state.pet.owned || {});
    const dex = state.pet.dexUnlocked || [];
    const petPool = PW.pokemon.BOX_POOL.filter((id) => ownedPets.indexOf(id) < 0);
    /* 装扮已从盲盒移除，盲盒奖励类别：新宝可梦 / 星星 / 消耗品 / 金币 */

    /* 读取配置比例（确保总和=100） */
    const bc = (state.config && state.config.blindBoxConfig) || {};
    let rPokemon = (bc.ratioPokemon || 28);
    let rStar = bc.ratioStar || 32;
    let rConsumable = bc.ratioConsumable || 30;
    let rCoins = bc.ratioCoins || 10;
    const total = rPokemon + rStar + rConsumable + rCoins;
    if (total > 0 && total !== 100) {
      /* 归一化到 100 */
      rPokemon = Math.round(rPokemon / total * 100);
      rStar = Math.round(rStar / total * 100);
      rConsumable = Math.round(rConsumable / total * 100);
      rCoins = 100 - rPokemon - rStar - rConsumable;
    }
    const pPokemon = rPokemon / 100;
    const pStarEnd = pPokemon + (rStar / 100);
    const pConsumableEnd = pStarEnd + (rConsumable / 100);

    const roll = Math.random();
    // 1) 新宝可梦
    if (petPool.length && roll < pPokemon) {
      const id = U.pick(petPool);
      const p = PW.pokemon.get(id);
      return { type: 'pokemon', id, name: p.name, icon: '🎉', rarity: p.rarity };
    }
    // 2) 星星
    if (roll < pStarEnd) {
      const amt = U.rnd(bc.starMin || 20, bc.starMax || 60);
      return { type: 'stars', id: 'stars', name: '星星 ×' + amt, icon: '⭐', rarity: 'R', amount: amt };
    }
    // 3) 消耗品礼包
    if (roll < pConsumableEnd) {
      const c = U.pick(CONSUMABLE);
      const n = U.rnd(bc.consumableMin || 2, bc.consumableMax || 4);
      return { type: 'consumable', id: c.id, name: c.name + ' ×' + n, icon: c.icon, rarity: 'R', amount: n };
    }
    // 4) 金币返还
    const amt = U.rnd(bc.coinMin || 40, bc.coinMax || 120);
    return { type: 'coins', id: 'coins', name: '金币 ×' + amt, icon: '<svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg>', rarity: 'R', amount: amt };
  }

  /** 每周 / 每月星星产出预估（用于界面提示） */
  function estimate(cfg) {
    const r = cfg.rewards;
    const hwPerDay = 5;
    const school = hwPerDay * r.homework.stars + r.reading.stars + r.sports.stars + 3;
    const weekend = 2 * r.homework.stars + r.reading.stars + r.sports.stars + 4;
    const week = school * 5 + weekend * 2;
    return { day: school, week, month: Math.round(week * 4.3) };
  }

  /** 获取实际生效的零花钱商品列表（优先用配置，否则默认） */
  function getCashProducts() {
    var cfg = PW.store && PW.store.state && PW.store.state.config && PW.store.state.config.cashProducts;
    if (cfg && Array.isArray(cfg) && cfg.length > 0) return cfg;
    return CASH;
  }

  return { CASH, CONSUMABLE, CONSUMABLE_MAP, COSMETIC, COSMETIC_MAP, POKEBALLS, POKEBALL_MAP, BLIND_BOX_DAILY_LIMIT, BOX_COST_DEFAULT, drawBox, estimate, getCashProducts };
})();
