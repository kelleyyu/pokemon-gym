/* =========================================================
   PW · 成就徽章系统
   每组 5 档基础徽章（每枚仅可领取 1 次）
   + 第 6 枚「Mega 突破」（集齐前 5 枚后，按 step 可重复领取，记录次数）
   ========================================================= */
PW.badges = (function () {

  const LEVELS = {
    bronze: { name: '青铜', cls: 'lv-bronze', coins: 30, stars: 3 },
    silver: { name: '白银', cls: 'lv-silver', coins: 70, stars: 7 },
    gold: { name: '黄金', cls: 'lv-gold', coins: 150, stars: 15 },
    plat: { name: '铂金', cls: 'lv-plat', coins: 300, stars: 30 },
    legend: { name: '传说', cls: 'lv-legend', coins: 600, stars: 60 }
  };
  const ORDER = ['bronze', 'silver', 'gold', 'plat', 'legend'];

  // 每组 5 档基础徽章 + 1 枚 Mega 突破
  // mega.step：集齐前 5 枚后，对应指标每增加 step 单位即可再领 1 次 Mega
  // mega.coins / mega.stars：每次领取 Mega 发放的奖励
  const GROUPS = [
    { key: 'ontime', title: '守时训练家', icon: '⏰', unit: '天',
      metric: 'ontimeDays', needs: [3, 7, 15, 30, 60],
      names: ['守时新手', '守时达人', '时间管理者', '自律大师', '时间之神'],
      desc: (n) => '累计 ' + n + ' 天在截止时间前完成全部作业',
      mega: { step: 30, unit: '天', coins: 500, stars: 30 } },

    { key: 'hwTotal', title: '作业收割机', icon: '📚', unit: '项',
      metric: 'hwDoneTotal', needs: [20, 50, 100, 200, 300],
      names: ['小小勤奋', '作业好手', '百项达成', '作业宗师', '学海无涯'],
      desc: (n) => '累计完成 ' + n + ' 项作业',
      mega: { step: 200, unit: '项', coins: 500, stars: 30 } },

    { key: 'quizPerfect', title: '满分闯关者', icon: '💯', unit: '次',
      metric: 'quizPerfectCount', needs: [5, 10, 15, 30, 60],
      names: ['首次满分', '满分十连', '满分好手', '满分猎人', '满分传说'],
      desc: (n) => '闯关 100% 正确达成 ' + n + ' 次',
      mega: { step: 30, unit: '次', coins: 500, stars: 30 } },

    { key: 'quizHigh', title: '豌豆神射手', icon: '🎯', unit: '次',
      metric: 'quizHighCount', needs: [10, 20, 30, 50, 100],
      names: ['准星初现', '稳准狠', '神射手', '百步穿杨', '精准之神'],
      desc: (n) => '单次闯关正确率 ≥90% 达成 ' + n + ' 次',
      mega: { step: 50, unit: '次', coins: 500, stars: 30 } },

    { key: 'quizStreak', title: '勇者大冒险', icon: '⚔️', unit: '天',
      metric: 'quizDays', needs: [3, 7, 15, 30, 60],
      names: ['出发冒险', '冒险一周', '半月征程', '月度勇者', '不灭斗志'],
      desc: (n) => '累计参加闯关冒险 ' + n + ' 天',
      mega: { step: 30, unit: '天', coins: 500, stars: 30 } },

    { key: 'readDays', title: '阅读点灯人', icon: '📖', unit: '天',
      metric: 'readDays', needs: [3, 7, 15, 30, 60],
      names: ['翻开第一页', '书香小友', '博览小达人', '阅读大师', '万卷传说'],
      desc: (n) => '累计阅读打卡 ' + n + ' 天',
      mega: { step: 30, unit: '天', coins: 500, stars: 30 } },

    { key: 'sportDays', title: '运动小健将', icon: '🏃', unit: '天',
      metric: 'sportDays', needs: [3, 7, 15, 30, 60],
      names: ['动起来', '汗水少年', '体能达人', '运动健将', '钢铁体魄'],
      desc: (n) => '累计运动打卡 ' + n + ' 天',
      mega: { step: 30, unit: '天', coins: 500, stars: 30 } },

    { key: 'dex', title: '图鉴收藏家', icon: '📕', unit: '只',
      metric: 'dexCount', needs: [5, 10, 25, 50, 80],
      names: ['初识伙伴', '小小收藏', '收集达人', '收藏大家', '图鉴王者'],
      desc: (n) => '图鉴收集达到 ' + n + ' 只宝可梦',
      mega: { step: 30, unit: '只', coins: 500, stars: 30 } },

    { key: 'evolve', title: '进化见证者', icon: '🔥', unit: '次',
      metric: 'evolveCount', needs: [3, 6, 10, 20, 30],
      names: ['第一次进化', '三重进化', '进化十连', '进化专家', '宝可梦大师'],
      desc: (n) => '累计完成 ' + n + ' 次宝可梦进化',
      mega: { step: 10, unit: '次', coins: 500, stars: 30 } },

    { key: 'rich', title: '我是大富翁', icon: '💰', unit: '金币',
      metric: 'coinTotalEarned', needs: [500, 2000, 5000, 10000, 20000],
      names: ['小有积蓄', '家财初成', '财源滚滚', '富甲一方', '首富传说'],
      desc: (n) => '累计获得 ' + n + ' 金币',
      mega: { step: 10000, unit: '金币', coins: 500, stars: 30 } },

    { key: 'starTotal', title: '梦想是星辰大海', icon: '⭐', unit: '星',
      metric: 'starTotalEarned', needs: [100, 500, 1000, 2000, 5000],
      names: ['百星起航', '星光大道', '璀璨星河', '银河漫游', '星辰大海'],
      desc: (n) => '累计获得 ' + n + ' 颗星星',
      mega: { step: 2000, unit: '星', coins: 500, stars: 30 } }
  ];

  /** 生成全部徽章定义（含 Mega，isMega 标记第 6 枚） */
  const ALL = [];
  GROUPS.forEach((g) => {
    g.needs.forEach((need, i) => {
      const lv = ORDER[i];
      ALL.push({
        id: g.key + '_' + lv,
        group: g.key,
        groupTitle: g.title,
        icon: g.icon,
        name: g.names[i],
        level: lv,
        levelName: LEVELS[lv].name,
        cls: LEVELS[lv].cls,
        need,
        metric: g.metric,
        unit: g.unit,
        isMega: false,
        desc: g.desc(need),
        coins: LEVELS[lv].coins,
        stars: LEVELS[lv].stars
      });
    });
    /* 第 6 枚 Mega 突破 */
    ALL.push({
      id: g.key + '_mega',
      group: g.key,
      groupTitle: g.title,
      icon: '🌟',
      name: 'Mega 突破',
      level: 'mega',
      levelName: 'Mega',
      cls: 'lv-mega',
      need: g.mega.step,
      metric: g.metric,
      unit: g.mega.unit,
      isMega: true,
      desc: '集齐本类前 5 枚后，每累计再达成 ' + g.mega.step + ' ' + g.mega.unit + ' 即可重复领取',
      coins: g.mega.coins,
      stars: g.mega.stars,
      step: g.mega.step
    });
  });

  /**
   * 结合统计数据计算徽章状态
   * @param stats       统计指标
   * @param claimed     基础徽章领取记录 { [badgeId]: {...} }
   * @param megaClaimed Mega 领取次数 { [groupKey]: N }
   */
  function evaluate(stats, claimed, megaClaimed) {
    stats = stats || {};
    claimed = claimed || {};
    megaClaimed = megaClaimed || {};
    const badges = [];

    GROUPS.forEach((g) => {
      const lastNeed = g.needs[g.needs.length - 1];

      /* ---- 基础 5 枚：每枚仅可领取 1 次 ---- */
      g.needs.forEach((need, i) => {
        const lv = ORDER[i];
        const id = g.key + '_' + lv;
        const raw = stats[g.metric] || 0;
        const isClaimed = !!claimed[id];
        const achieved = raw >= need;
        badges.push({
          id, group: g.key, groupTitle: g.title, icon: g.icon,
          name: g.names[i], level: lv, levelName: LEVELS[lv].name, cls: LEVELS[lv].cls,
          need, metric: g.metric, unit: g.unit, isMega: false,
          desc: g.desc(need),
          cur: raw, achieved, claimed: isClaimed,
          canClaim: achieved && !isClaimed,
          pct: Math.min(100, Math.round((raw / need) * 100)),
          coins: LEVELS[lv].coins, stars: LEVELS[lv].stars
        });
      });

      /* ---- 第 6 枚 Mega 突破：集齐前 5 枚后按 step 重复领取 ---- */
      const mv = stats[g.metric] || 0;
      const baseAllClaimed = g.needs.every((_, i) => !!claimed[g.key + '_' + ORDER[i]]);
      const maxMega = baseAllClaimed ? Math.max(0, Math.floor((mv - lastNeed) / g.mega.step)) : 0;
      const claimedMega = megaClaimed[g.key] || 0;
      const canClaimMega = baseAllClaimed && (maxMega - claimedMega) > 0;
      const nextThreshold = lastNeed + (claimedMega + 1) * g.mega.step;
      const remaining = baseAllClaimed ? Math.max(0, nextThreshold - mv) : 0;
      const pct = baseAllClaimed
        ? Math.max(0, Math.min(100, Math.round(((mv - lastNeed - claimedMega * g.mega.step) / g.mega.step) * 100)))
        : 0;

      badges.push({
        id: g.key + '_mega', group: g.key, groupTitle: g.title, icon: '🌟',
        name: 'Mega 突破', level: 'mega', levelName: 'Mega', cls: 'lv-mega',
        need: g.mega.step, metric: g.metric, unit: g.mega.unit, isMega: true,
        desc: baseAllClaimed
          ? ('每累计再达成 ' + g.mega.step + ' ' + g.mega.unit + ' 即可重复领取')
          : '',
        cur: mv, achieved: baseAllClaimed, claimed: false,
        claimedMega, canClaim: canClaimMega, maxMega, remaining, pct,
        coins: g.mega.coins, stars: g.mega.stars, step: g.mega.step
      });
    });

    return { badges };
  }

  function readyCount(stats, claimed, megaClaimed) {
    const result = evaluate(stats, claimed, megaClaimed);
    return (result.badges || result).filter((b) => b.canClaim).length;
  }

  return { LEVELS, ORDER, GROUPS, ALL, evaluate, readyCount };
})();
