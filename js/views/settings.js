/* =========================================================
   PW · 家长管理配置（PIN 保护：奖励值 / 自定义任务 / 限制）
   新增：☁️ Supabase 云端同步、🤖 AI 接入（直连 / 中转）
   ========================================================= */
PW.viewSettings = (function () {
  const U = PW.util;
  let unlocked = false;
  let deleteUnlocked = false;
  let advancedOpen = '';  // 高级设置折叠面板：'' | 'cloud' | 'ai' | 'parent'
  let parentOpen = 'task';   // 家长管理折叠：'task' | 'msg' | 'deduct'
  let rewardOpen = 'limit';  // 奖励与规则折叠：'limit' | 'blindbox' | 'reward' | 'cash'

  function render() {
    if (!unlocked) return lockScreen();
    return panel();
  }

  function lockScreen() {
    return '<div class="card center" style="max-width:380px;margin:30px auto">' +
      '<div style="font-size:46px">🔐</div>' +
      '<h3 style="margin:8px 0">家长管理配置</h3>' +
      '<div class="row" style="justify-content:center;margin-top:12px">' +
      '<input class="input" id="pinInput" type="password" inputmode="numeric" maxlength="8" placeholder="密码" style="max-width:160px;text-align:center;letter-spacing:6px">' +
      '<button class="btn btn-primary" id="pinOk">解锁</button></div></div>';
  }

  function numField(label, id, val, step) {
    return '<div class="field" style="flex:1;margin-bottom:10px"><label>' + label + '</label>' +
      '<input class="input" id="' + id + '" type="number" min="0" step="' + (step || 1) + '" value="' + val + '"></div>';
  }

  function panel() {
    const st = PW.store.state;
    const c = st.config;
    const r = c.rewards;
    const familyCode = (st.profile.familyCode || '').trim();
    const cloud = c.cloudConfig || {};
    const ai = c.aiConfig || {};

    const rewardCard = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>🎁 各项奖励值</h3>' +
      '<button class="icon-btn" id="saveReward" title="保存奖励设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div class="grid g2">' +
      rewardRow('完成作业（每项）', 'hw', r.homework) +
      tierRewardRow('阅读打卡', 'rd', [
        { label: '第1次', coins: (r.readingTiers && r.readingTiers[0] ? r.readingTiers[0].coins : 30), stars: (r.readingTiers && r.readingTiers[0] ? r.readingTiers[0].stars : 5) },
        { label: '第2次', coins: (r.readingTiers && r.readingTiers[1] ? r.readingTiers[1].coins : 20), stars: (r.readingTiers && r.readingTiers[1] ? r.readingTiers[1].stars : 3) },
        { label: '第3次', coins: (r.readingTiers && r.readingTiers[2] ? r.readingTiers[2].coins : 10), stars: (r.readingTiers && r.readingTiers[2] ? r.readingTiers[2].stars : 2) }
      ]) +
      tierRewardRow('运动打卡', 'sp', [
        { label: '第1次', coins: (r.sportsTiers && r.sportsTiers[0] ? r.sportsTiers[0].coins : 30), stars: (r.sportsTiers && r.sportsTiers[0] ? r.sportsTiers[0].stars : 5) },
        { label: '第2次', coins: (r.sportsTiers && r.sportsTiers[1] ? r.sportsTiers[1].coins : 20), stars: (r.sportsTiers && r.sportsTiers[1] ? r.sportsTiers[1].stars : 3) },
        { label: '第3次', coins: (r.sportsTiers && r.sportsTiers[2] ? r.sportsTiers[2].coins : 10), stars: (r.sportsTiers && r.sportsTiers[2] ? r.sportsTiers[2].stars : 2) }
      ]) +
      tierRewardRow('闯关冒险', 'qt', [
        { label: '闯关 80%（成功）', coins: (r.quizTiers && r.quizTiers[0] ? r.quizTiers[0].coins : (r.quiz80 && r.quiz80.coins) || 5), stars: (r.quizTiers && r.quizTiers[0] ? r.quizTiers[0].stars : (r.quiz80 && r.quiz80.stars) || 0) },
        { label: '闯关 90%（优秀）', coins: (r.quizTiers && r.quizTiers[1] ? r.quizTiers[1].coins : (r.quiz90 && r.quiz90.coins) || 5), stars: (r.quizTiers && r.quizTiers[1] ? r.quizTiers[1].stars : (r.quiz90 && r.quiz90.stars) || 1) },
        { label: '闯关 100%（满分）', coins: (r.quizTiers && r.quizTiers[2] ? r.quizTiers[2].coins : (r.quiz100 && r.quiz100.coins) || 10), stars: (r.quizTiers && r.quizTiers[2] ? r.quizTiers[2].stars : (r.quiz100 && r.quiz100.stars) || 2) }
      ]) +
      '</div></div>';
    const limitCard = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>⚙️ 限制与规则</h3>' +
      '<button class="icon-btn" id="saveLimit" title="保存限制设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div class="grid g2">' +
      numField('闯关每天次数上限', 'limQuiz', c.quizDailyLimit) +
      numField('每次闯关题目数', 'limQCount', c.quizCount) +
      numField('月度零花钱上限（元，0=不限）', 'limCash', c.monthlyCashCap) +
      '<div class="field" style="flex:1;margin-bottom:10px"><label>作业按时截止时间</label>' +
      '<input class="input" id="limDeadline" type="time" value="' + c.homeworkDeadline + '" style="max-width:160px"></div>' +
      numField('阅读最少分钟', 'limRmin', c.readingMinMinutes) +
      numField('运动最少分钟', 'limSmin', c.sportsMinMinutes) +
      '</div>' +
      '</div>';
    /* ---------- 🎲 盲盒配置（价格 + 比例 + 数量） ---------- */
    const bbc = c.blindBoxConfig || {};
    const blindBoxConfigCard = '<div class="card" style="margin-top:16px;border-color:#f3e8ff;background:#faf5ff"><div class="card-h"><h3>🎲 盲盒配置</h3>' +
      '<button class="icon-btn" id="saveBlindBox" title="保存盲盒设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div style="border:2px solid #e0d4ff;border-radius:14px;padding:12px">' +
      /* 盲盒价格（移到这里） */
      '<div style="background:#fff8e0;border-radius:10px;padding:10px;margin-bottom:12px;display:flex;align-items:center;gap:8px">' +
      '<span class="small" style="font-weight:800;white-space:nowrap">盲盒价格 (金币)</span>' +
      '<input class="input" id="limBox" type="number" min="0" value="' + (c.blindBoxCost || 66) + '" style="max-width:100px;flex:1;padding:6px 10px;font-weight:700;color:#e08600;text-align:center">' +
      '</div>' +
      '<div class="small" style="font-weight:800;margin-bottom:10px">📊 奖品概率分配（总和应为 100%）</div>' +
      '<div class="grid g2">' +
      numField('宝可梦 %', 'bbRp', bbc.ratioPokemon || 28) +
      numField('星星 %', 'bbRstar', bbc.ratioStar || 32) +
      numField('消耗品 %', 'bbRcon', bbc.ratioConsumable || 30) +
      numField('金币 %', 'bbRx', bbc.ratioCoins || 10) +
      '</div>' +
      '<div class="small" style="font-weight:800;margin:14px 0 10px">💰 数量范围</div>' +
      '<div class="grid g2">' +
      numField('金币最少', 'bbCmin', bbc.coinMin || 40) +
      numField('金币最多', 'bbCmax', bbc.coinMax || 120) +
      numField('星星最少', 'bbSmin', bbc.starMin || 20) +
      numField('星星最多', 'bbSmax', bbc.starMax || 60) +
      numField('消耗品最少(个)', 'bbConMin', bbc.consumableMin || 2) +
      numField('消耗品最多(个)', 'bbConMax', bbc.consumableMax || 4) +
      '</div>' +
      '<p class="small muted" style="margin:6px 0 0">提示：当某类奖品池已抽完（如宝可梦全收集），概率会自动分配到其余类别。</p></div></div>';
    const customCard = customTaskCard();

    /* ---------- 💴 零花钱商品配置 ---------- */
    const cashProds = (c.cashProducts || PW.shop.CASH);
    const cashConfigCard = '<div class="card" style="margin-top:16px"><div class="card-h"><h3>⭐ 星星兑换配置</h3>' +
      '<button class="icon-btn" id="saveCash" title="保存零花钱设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div style="border:2px solid var(--line);border-radius:14px;padding:12px">' +
      cashProds.map((it, i) =>
        '<div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;flex-wrap:nowrap">' +
        '<span class="small" style="font-weight:700;white-space:nowrap">' + it.icon + ' ' + U.esc(it.name) + '</span>' +
        '<div style="flex:1;display:flex;align-items:center;gap:2px"><span class="small muted">⭐</span><input class="input" id="cp_s' + i + '" type="number" min="0" value="' + it.stars + '" style="max-width:64px;display:inline-block;padding:6px 6px;font-size:15px"></div>' +
        '<span class="small muted" style="white-space:nowrap">→ ¥</span>' +
        '<div style="flex:0.8"><input class="input" id="cp_c' + i + '" type="number" min="0" value="' + it.cash + '" style="max-width:60px;display:inline-block;padding:6px 6px;font-size:15px"><span class="small muted" style="white-space:nowrap">元</span></div>' +
        '</div>'
      ).join('') +
      '<p class="small muted" style="margin:6px 0 0">修改后点保存生效，孩子端会立即看到新价格。</p></div></div>';
    /* ---------- 📊 收益预览（含金币+零花钱，仅配置页显示） ---------- */
    const estCard = (function() {
      var est = PW.shop.estimate(c);
      var cp = c.cashProducts || PW.shop.CASH;
      var best = cp[cp.length - 1] || {};
      // 金币日/周/月预估
      var hwPerDay = 5;
      var coinDay = hwPerDay * (r.homework.coins || 10) + (r.reading.coins || 30) + (r.sports.coins || 30);
      var coinWeekDay = coinDay * 5 + (r.homework.coins || 10) * 2 + (r.reading.coins || 30) + (r.sports.coins || 30) * 2;
      var coinMonth = Math.round(coinWeekDay * 4.3);
      // 动态估算每周可兑换金额（按当前配置的零花钱商品）
      var weeklyCashEst = 0;
      for (var ci = 0; ci < cp.length; ci++) {
        var item = cp[ci];
        if (est.week >= (item.stars || 25)) {
          weeklyCashEst = Math.max(weeklyCashEst, item.cash || 1);
        }
      }
      return '<div class="card" style="margin-top:16px;background:linear-gradient(180deg,#fffbeb,#fff);border-color:#ffe3a8"><div class="card-h"><h3>📊 收益预览</h3>' +
        '<span class="sub">基于当前奖励配置估算，保存后自动更新</span></div>' +
        /* 第一行：金币（天·周·月，三列） */
        '<div class="grid g3 est-row" style="text-align:center">' +
        '<div><b style="color:#8a6100;font-size:18px">' + coinDay + '</b><div class="small muted">金币/天</div></div>' +
        '<div><b style="color:#8a6100;font-size:18px">' + coinWeekDay + '</b><div class="small muted">金币/周</div></div>' +
        '<div><b style="color:#8a6100;font-size:18px">' + coinMonth + '</b><div class="small muted">金币/月</div></div></div>' +
        /* 第二行：星星（天·周·月，三列） */
        '<div class="grid g3 est-row" style="text-align:center;margin-top:8px">' +
        '<div><b style="color:#e08600;font-size:18px">' + est.day + '</b><div class="small muted">星星/天</div></div>' +
        '<div><b style="color:#e08600;font-size:18px">' + est.week + '</b><div class="small muted">星星/周</div></div>' +
        '<div><b style="color:#e08600;font-size:18px">' + est.month + '</b><div class="small muted">星星/月</div></div></div>' +
        '<p class="hint center" style="margin-top:10px">每周约可兑换 <b>' + weeklyCashEst + ' 元</b>零花钱</p></div>';
    })();

    /* ---------- ☁️ 云端同步（Supabase） ---------- */
    const syncKey = (st.profile.syncKey || '').trim() || '';
    const cloudCard = '<div class="card" style="margin-top:16px;border-color:#e3f0ff;background:#f7fbff"><div class="card-h"><h3>☁️ 云同步</h3>' +
      '<span class="sub">（其他设备粘贴同一密钥即可共享数据）</span></div>' +

      /* 同步密钥 */
      '<div class="field" style="margin-bottom:10px"><label style="font-weight:700;color:#1565c0">同步密钥</label>' +
      '<div class="row" style="gap:8px">' +
      '<input class="input" id="syncKeyDisplay" type="text" readonly value="' + U.esc(syncKey || '(点击生成)') + '" style="flex:1;font-family:monospace;font-size:13px;background:#f0f6ff;cursor:text">' +
      '<button class="btn btn-primary btn-sm" id="syncKeyCopy" style="white-space:nowrap"' + (syncKey ? '' : ' disabled') + '>复制</button>' +
      '</div></div>' +

      /* 模板代码 */
      '<div class="field" style="margin-bottom:10px"><label style="font-weight:700;color:#555">模板代码</label>' +
      '<div style="background:#fafafa;border:1px solid #ddd;border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.7;font-family:monospace;color:#444">' +
      '<div>模板代码：<b>' + U.esc(cloud.url || 'https://gaiazfyyzxbgvcfrzyxi.supabase.co') + '</b></div>' +
      '<div><span style="color:#888">&#9632;</span> 默认设备：粘贴密钥后点「应用同步步」</div>' +
      '</div></div>' +

      /* 应用并同步 */
      '<button class="btn btn-blue btn-block" id="cloudApplySync" style="margin-bottom:8px">应用并同步</button>' +

      /* 粘贴对方密钥 */
      '<div class="field"><label style="font-weight:700;color:#555">粘贴电脑/手机端密钥</label>' +
      '<div class="row" style="gap:8px">' +
      '<input class="input" id="pasteSyncKey" type="text" placeholder="粘贴对方的同步密钥 sk-...">' +
      '<button class="btn btn-primary btn-sm" id="pasteSyncApply" style="white-space:nowrap">应用同步</button>' +
      '</div></div>' +

      /* 同步数据 + 重新登录 */
      '<div class="row" style="gap:8px;margin-top:8px">' +
      '<button class="btn btn-ghost" id="cloudSyncData" style="flex:1">🔄 同步数据</button>' +
      '<a href="#" id="cloudRelogin" style="font-size:12px;color:#c0392b;text-decoration:none;align-self:center;white-space:nowrap">重新登研</a>' +
      '</div>' +

      '<p class="small muted" style="margin:8px 0 0">提示：手机端打开此页 → 粘贴电脑端密钥 → 应用同步即可。无需同一网络、无需电脑开机。</p>' +

      /* 隐藏字段 */
      '<div style="display:none">' +
      '<input id="cloudUrl" type="hidden" value="' + U.esc(cloud.url || 'https://gaiazfyyzxbgvcfrzyxi.supabase.co') + '">' +
      '<input id="cloudAnon" type="hidden" value="' + U.esc(cloud.anon || 'sb_publishable_wA2JbGkqCwxO2fQduIr3XA_YkO9oE0m') + '">' +
      '<input id="cloudCode" type="hidden" value="' + U.esc(familyCode) + '">' +
      '<input id="cloudOn" type="checkbox"' + (cloud.enabled ? ' checked' : '') + '>' +
      '</div>' +

      '<p class="hint" id="cloudMsg"></p></div>';

    /* ---------- 🤖 AI 学习助手 ---------- */
    const aiMode = ai.mode || 'direct';
    const aiCard = '<div class="card" style="margin-top:16px;border-color:#e8f4fd;background:#faffff"><div class="card-h"><h3>🤖 AI 学习助手</h3>' +
      '<span class="sub">接入你的 AI，让孩子可以问问题</span></div>' +
      '<div class="field"><label>接入方式</label>' +
      '<select class="input" id="aiMode">' +
      '<option value="direct"' + (aiMode !== 'proxy' ? ' selected' : '') + '>直连（Key 存本机，简单）</option>' +
      '<option value="proxy"' + (aiMode === 'proxy' ? ' selected' : '') + '>Supabase 中转（推荐，Key 不暴露）</option>' +
      '</select></div>' +
      '<div id="aiDirect" style="' + (aiMode === 'proxy' ? 'display:none' : '') + '">' +
      '<div class="field"><label>API 地址（OpenAI 兼容）</label>' +
      '<input class="input" id="aiEndpoint" type="url" placeholder="https://api.deepseek.com/chat/completions" value="' + U.esc(ai.endpoint || '') + '"></div>' +
      '<div class="field"><label>API Key</label>' +
      '<input class="input" id="aiApiKey" type="password" placeholder="sk-..." value="' + U.esc(ai.apiKey || '') + '" style="letter-spacing:1px"></div>' +
      '<div class="row"><div class="field" style="flex:1"><label>模型名称</label>' +
      '<input class="input" id="aiModel" type="text" value="' + U.esc(ai.model || 'gpt-4o-mini') + '" placeholder="deepseek-chat"></div>' +
      '<div style="display:flex;align-items:flex-end;padding-bottom:6px">' +
      '<button class="btn btn-blue" id="aiTest" style="white-space:nowrap">🔗 测试连接</button></div></div>' +
      '</div>' +
      '<div id="aiProxy" style="' + (aiMode !== 'proxy' ? 'display:none' : '') + '">' +
      '<div class="field"><label>中转函数地址（Edge Function URL）</label>' +
      '<input class="input" id="aiProxyUrl" type="url" placeholder="https://xxxxx.supabase.co/functions/v1/ai-chat" value="' + U.esc(ai.proxyUrl || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>自定义系统提示词（可选）</label>' +
      '<textarea class="input" id="aiSystemPrompt" rows="3" placeholder="留空使用默认的儿童友好提示词…"' +
      '>' + U.esc(ai.systemPrompt || '') + '</textarea></div>' +
      '</div>';

    /* ---------- 💌 发消息给孩子 ---------- */
    const parentMsgCard = '<div class="card" style="margin-top:16px;border-color:#ffe3c2;background:#fffaf2">' +
      '<div class="card-h"><h3>💌 发消息给孩子</h3>' +
      '<span class="sub">可附上金币 / 星星奖励</span></div>' +
      '<div class="field"><label>留言内容</label>' +
      '<textarea class="input" id="pmText" rows="2" placeholder="例如：今天作业完成得很棒，继续加油！"></textarea></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>附金币 <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg></label>' +
      '<input class="input" id="pmCoins" type="number" min="0" value="0" style="max-width:96px;display:inline-block;padding:8px 10px"></div>' +
      '<div class="field" style="flex:1"><label>附星星 <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg></label>' +
      '<input class="input" id="pmStars" type="number" min="0" value="0" style="max-width:96px;display:inline-block;padding:8px 10px"></div>' +
      '</div>' +
      '<button class="btn btn-orange btn-lg btn-block" id="pmSend">📨 发送消息</button></div>';
    /* ---------- ⚠️ 扣罚星星 ---------- */
    const deductCard = '<div class="card" style="margin-top:16px;border-color:#ffd9d9;background:#fff7f7">' +
      '<div class="card-h"><h3 style="color:#c0392b">⚠️ 扣罚星星</h3>' +
      '<span class="sub">从孩子余额中扣除星星并告知原因</span></div>' +
      '<div class="field"><label>扣罚原因</label>' +
      '<input class="input" id="deductReason" type="text" placeholder="例如：未按时完成作业…" maxlength="100"></div>' +
      '<div class="field"><label>扣罚数量（颗星星）</label>' +
      '<input class="input" id="deductAmount" type="number" min="1" value="10" style="max-width:120px;font-weight:700;color:#c0392b;text-align:center"></div>' +
      '<p class="hint" style="color:#c0392b;margin:6px 0 8px">⚡ 扣减后不可恢复，请谨慎操作</p>' +
      '<button class="btn btn-block" id="deductBtn" style="background:#c0392b;color:#fff;font-weight:800;border:none;padding:12px;border-radius:10px;cursor:pointer">确认扣罚</button>' +
      '<hr style="margin:14px 0;border:none;border-top:1px solid #f5c6c6">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div><b style="color:#c0392b">🗑️ 清零全部数据</b><div class="small muted">将金币、星星和徽章记录归零（用于重新测试）</div></div>' +
      '</div>' +
      '<button class="btn btn-block" id="clearWalletBtn" style="background:#e74c3c;color:#fff;font-weight:800;border:none;padding:12px;border-radius:10px;cursor:pointer">🗑️ 确认清零（金币+星星+徽章）</button></div>';
    const danger = '<div class="card" style="margin-top:16px;border-color:#ffd9d9;background:#fff7f7">' +
      '<div class="card-h"><h3 style="color:#c0392b">🔒 家长操作</h3></div>' +
      '<div class="row">' +
      '<button class="btn btn-ghost" id="chgPin">修改管理密码</button>' +
      '</div></div>';

    return '<div class="card center" style="background:linear-gradient(180deg,#f3f7ff,#fff);border-color:#d6e4f8">' +
      '<b>🔓 已解锁家长配置</b></div>' +
      parentGroupCard() + rewardGroupCard() + estCard + (deleteUnlocked ? trashCard() : deleteLockCard()) + advancedCard();
  }

  /* ---------- 📋 家长管理分组（Tab式：发任务/发消息/扣星星） ---------- */
  function parentGroupCard() {
    const pBtn = function(key, icon, label, active) {
      return '<button class="btn btn-sm' + (parentOpen === key ? ' btn-primary' : ' btn-ghost') + '" data-pg="' + key + '" style="flex:1;min-width:0;font-size:13px;padding:7px 4px">' + icon + ' ' + label + '</button>';
    };
    return '<div class="card" style="margin-top:16px;border-color:#e8ecf2;background:#fafbff"><div class="card-h"><h3>📋 家长管理</h3>' +
      '<button class="icon-btn" id="saveParentGroup" title="保存家长管理设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div class="settings-tabs">' +
      pBtn('task', '📋', '发任务') + pBtn('msg', '📮', '发消息') + pBtn('deduct', '⚠️', '扣星星') +
      '</div>' +
      '<div class="settings-panel"' + (parentOpen !== 'task' ? ' style="display:none"' : '') + '>' + customCardInner() + '</div>' +
      '<div class="settings-panel"' + (parentOpen !== 'msg' ? ' style="display:none"' : '') + '>' + parentMsgCardInner() + '</div>' +
      '<div class="settings-panel"' + (parentOpen !== 'deduct' ? ' style="display:none"' : '') + '>' + deductCardInner() + '</div>' +
      '</div>';
  }

  /* ---------- ⚙️ 奖励与规则分组（Tab式：限制/盲盒/奖励值/兑换） ---------- */
  function rewardGroupCard() {
    const rBtn = function(key, icon, label) {
      return '<button class="btn btn-sm' + (rewardOpen === key ? ' btn-primary' : ' btn-ghost') + '" data-rg="' + key + '" style="flex:1;min-width:0;font-size:13px;padding:7px 4px">' + icon + ' ' + label + '</button>';
    };
    return '<div class="card" style="margin-top:16px;border-color:#fff3cd;background:#fffef5"><div class="card-h"><h3>⚙️ 奖励与规则</h3>' +
      '<button class="icon-btn" id="saveRewardGroup" title="保存奖励与规则设置" style="margin-left:auto;flex-shrink:0;font-size:16px">💾</button></div>' +
      '<div class="settings-tabs">' +
      rBtn('limit', '⚙️', '限制与规则') + rBtn('blindbox', '🎲', '盲盒配置') + rBtn('reward', '🎁', '各项奖励值') + rBtn('cash', '⭐', '星星兑换') +
      '</div>' +
      '<div class="settings-panel"' + (rewardOpen !== 'limit' ? ' style="display:none"' : '') + '>' + limitCardInner() + '</div>' +
      '<div class="settings-panel"' + (rewardOpen !== 'blindbox' ? ' style="display:none"' : '') + '>' + blindBoxCardInner() + '</div>' +
      '<div class="settings-panel"' + (rewardOpen !== 'reward' ? ' style="display:none"' : '') + '>' + rewardCardInner() + '</div>' +
      '<div class="settings-panel"' + (rewardOpen !== 'cash' ? ' style="display:none"' : '') + '>' + cashConfigCardInner() + '</div>' +
      '</div>';
  }

  /* ---- 各面板内部内容（自包含，无共享变量） ---- */
  function customTaskCardInner() {
    const st = PW.store.state;
    const subs = PW.subjects.LIST.map((s) => '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>').join('');
    const tasks = (st.config.customTasks || []).map((t, i) =>
      '<div class="log-row"><div class="log-ico">📌</div>' +
      '<div class="log-main"><b>' + U.esc(t.title) + '</b>' +
      '<span class="small muted">' + repeatName(t.repeat) + (t.repeat === 'once' ? ' · ' + t.date : '') + '</span></div>' +
      (deleteUnlocked ? '<button class="mini-btn" data-deltask="' + i + '" title="删除">🗑️</button>' : '') + '</div>').join('');
    return '<div class="field"><label>任务内容</label><input class="input" id="ctTitle" placeholder="例如：练琴 20 分钟 / 口算打卡"></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>科目</label><select class="input" id="ctSub">' + subs + '</select></div>' +
      '<div class="field" style="flex:1"><label>来源</label><select class="input" id="ctTag">' +
      '<option value="school">🏫 学校</option><option value="home">🏠 家庭</option></select></div></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>重复</label><select class="input" id="ctRep">' +
      '<option value="daily">每天</option><option value="weekdays">仅上学日</option>' +
      '<option value="weekend">仅周末</option>' +
      '<option value="once">一次性</option></select></div>' +
      '<div class="field" style="flex:1;display:none" id="ctDateWrap"><label>日期</label><input class="input" id="ctDate" type="date" value="' + U.todayStr() + '"></div>' +
      '</div>' +
      '<button class="btn btn-blue btn-lg btn-block" id="ctAdd">＋ 发布任务</button>' +
      (tasks ? '<div style="margin-top:14px">' + tasks + '</div>' : '<p class="small muted" style="margin-top:12px">还没有发布任务。</p>');
  }
  function parentMsgCardInner() {
    return '<div class="field"><label>留言内容</label>' +
      '<textarea class="input" id="pmText" rows="2" placeholder="例如：今天作业完成得很棒，继续加油！"></textarea></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>附金币 <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg></label>' +
      '<input class="input" id="pmCoins" type="number" min="0" value="0" style="max-width:96px;display:inline-block;padding:8px 10px"></div>' +
      '<div class="field" style="flex:1"><label>附星星 <svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg></label>' +
      '<input class="input" id="pmStars" type="number" min="0" value="0" style="max-width:96px;display:inline-block;padding:8px 10px"></div>' +
      '</div>' +
      '<button class="btn btn-orange btn-lg btn-block" id="pmSend">📨 发送消息</button>';
  }
  function deductCardInner() {
    return '<div class="field"><label>扣罚原因</label>' +
      '<input class="input" id="deductReason" type="text" placeholder="例如：未按时完成作业…" maxlength="100"></div>' +
      '<div class="field"><label>扣罚数量（颗星星）</label>' +
      '<input class="input" id="deductAmount" type="number" min="1" value="10" style="max-width:120px;font-weight:700;color:#c0392b;text-align:center"></div>' +
      '<p class="hint" style="color:#c0392b;margin:6px 0 8px">⚡ 扣减后不可恢复，请谨慎操作</p>' +
      '<button class="btn btn-block" id="deductBtn" style="background:#c0392b;color:#fff;font-weight:800;border:none;padding:12px;border-radius:10px;cursor:pointer">确认扣罚</button>' +
      '<hr style="margin:14px 0;border:none;border-top:1px solid #f5c6c6">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
      '<div><b style="color:#c0392b">🗑️ 清零全部数据</b><div class="small muted">将金币、星星和徽章记录归零（用于重新测试）</div></div>' +
      '</div>' +
      '<button class="btn btn-block" id="clearWalletBtn" style="background:#e74c3c;color:#fff;font-weight:800;border:none;padding:12px;border-radius:10px;cursor:pointer">🗑️ 确认清零（金币+星星+徽章）</button>';
  }
  function limitCardInner() {
    const c = PW.store.state.config;
    return '<div class="grid g2">' +
      numField('闯关每天次数上限', 'limQuiz', c.quizDailyLimit) +
      numField('每次闯关题目数', 'limQCount', c.quizCount) +
      numField('月度零花钱上限（元，0=不限）', 'limCash', c.monthlyCashCap) +
      '<div class="field" style="flex:1;margin-bottom:10px"><label>作业按时截止时间</label>' +
      '<input class="input" id="limDeadline" type="time" value="' + c.homeworkDeadline + '" style="max-width:160px"></div>' +
      numField('阅读最少分钟', 'limRmin', c.readingMinMinutes) +
      numField('运动最少分钟', 'limSmin', c.sportsMinMinutes) +
      '</div>';
  }
  function blindBoxCardInner() {
    const b = (PW.store.state.config || {}).blindBox || {};
    return '<div style="border:2px solid #e0d4ff;border-radius:14px;padding:12px">' +
      '<div class="small" style="font-weight:800;margin-bottom:10px">盲盒奖品池概率分配（总和100%）</div>' +
      '<div class="grid g2">' +
      numField('宝可梦', 'bbPokemon', b.pokemon || 40) +
      numField('道具', 'bbItem', b.item || 25) +
      numField('金币包', 'bbCoins', b.coins || 20) +
      numField('星星包', 'bbStars', b.stars || 15) +
      '</div>' +
      '<p class="small muted" style="margin:6px 0 0">提示：当某类奖品池已抽完（如宝可梦全收集），概率会自动分配到其余类别。</p></div>';
  }
  function rewardCardInner() {
    const r = PW.store.state.config.rewards;
    return '<div class="grid g2">' +
      rewardRow('完成作业（每项）', 'hw', r.homework) +
      tierRewardRow('阅读打卡', 'rd', [
        { label: '第1次', coins: (r.readingTiers && r.readingTiers[0] ? r.readingTiers[0].coins : 30), stars: (r.readingTiers && r.readingTiers[0] ? r.readingTiers[0].stars : 5) },
        { label: '第2次', coins: (r.readingTiers && r.readingTiers[1] ? r.readingTiers[1].coins : 20), stars: (r.readingTiers && r.readingTiers[1] ? r.readingTiers[1].stars : 3) },
        { label: '第3次', coins: (r.readingTiers && r.readingTiers[2] ? r.readingTiers[2].coins : 10), stars: (r.readingTiers && r.readingTiers[2] ? r.readingTiers[2].stars : 2) }
      ]) +
      tierRewardRow('运动打卡', 'sp', [
        { label: '第1次', coins: (r.sportsTiers && r.sportsTiers[0] ? r.sportsTiers[0].coins : 30), stars: (r.sportsTiers && r.sportsTiers[0] ? r.sportsTiers[0].stars : 5) },
        { label: '第2次', coins: (r.sportsTiers && r.sportsTiers[1] ? r.sportsTiers[1].coins : 20), stars: (r.sportsTiers && r.sportsTiers[1] ? r.sportsTiers[1].stars : 3) },
        { label: '第3次', coins: (r.sportsTiers && r.sportsTiers[2] ? r.sportsTiers[2].coins : 10), stars: (r.sportsTiers && r.sportsTiers[2] ? r.sportsTiers[2].stars : 2) }
      ]) +
      tierRewardRow('闯关冒险', 'qt', [
        { label: '闯关 80%（成功）', coins: (r.quizTiers && r.quizTiers[0] ? r.quizTiers[0].coins : (r.quiz80 && r.quiz80.coins) || 5), stars: (r.quizTiers && r.quizTiers[0] ? r.quizTiers[0].stars : (r.quiz80 && r.quiz80.stars) || 0) },
        { label: '闯关 90%（优秀）', coins: (r.quizTiers && r.quizTiers[1] ? r.quizTiers[1].coins : (r.quiz90 && r.quiz90.coins) || 5), stars: (r.quizTiers && r.quizTiers[1] ? r.quizTiers[1].stars : (r.quiz90 && r.quiz90.stars) || 1) },
        { label: '闯关 100%（满分）', coins: (r.quizTiers && r.quizTiers[2] ? r.quizTiers[2].coins : (r.quiz100 && r.quiz100.coins) || 10), stars: (r.quizTiers && r.quizTiers[2] ? r.quizTiers[2].stars : (r.quiz100 && r.quiz100.stars) || 2) }
      ]) +
      '</div>';
  }
  function cashConfigCardInner() {
    const ex = (PW.store.state.config || {}).exchange || {};
    return '<div style="border:2px solid var(--line);border-radius:14px;padding:12px">' +
      '<div class="small" style="font-weight:800;margin-bottom:10px">⭐ 星星兑换配置（1 星星 = 多少金币）</div>' +
      '<div class="grid g2" style="white-space:nowrap">' +
      numField('兑换比例', 'exRate', ex.rate || 10) +
      numField('每日上限(次)', 'exDaily', ex.dailyLimit || 3) +
      numField('每月上限(次)', 'exMonthly', ex.monthlyLimit || 30) +
      '</div>' +
      '<p class="small muted" style="margin:6px 0 0">修改后点保存生效，孩子端会立即看到新价格。</p></div>';
  }


  /* ---------- ⚙️ 高级设置（折叠式：云同步 / AI / 家长操作） ---------- */
  function advancedCard() {
    const st = PW.store.state;
    const c = st.config;
    const cloud = c.cloudConfig || {};
    const ai = c.aiConfig || {};
    const syncKey = (st.profile.syncKey || '').trim() || '';
    const aiMode = ai.mode || 'direct';

    const btnCls = (key) => 'btn btn-sm' + (advancedOpen === key ? ' btn-primary' : ' btn-ghost');
    const panelStyle = (key) => (advancedOpen === key ? '' : 'display:none');

    /* ---- 云同步面板内容 ---- */
    const cloudBody = '<div class="field" style="margin-bottom:10px"><label style="font-weight:700;color:#1565c0">同步密钥</label>' +
      '<div class="row" style="gap:8px">' +
      '<input class="input" id="syncKeyDisplay" type="text" readonly value="' + U.esc(syncKey || '(点击生成)') + '" style="flex:1;font-family:monospace;font-size:13px;background:#f0f6ff;cursor:text">' +
      '<button class="btn btn-primary btn-sm" id="syncKeyCopy" style="white-space:nowrap"' + (syncKey ? '' : ' disabled') + '>复制</button>' +
      '</div></div>' +
      '<button class="btn btn-blue btn-block" id="cloudApplySync" style="margin-bottom:8px">应用并同步</button>' +
      '<div class="field"><label style="font-weight:700;color:#555">粘贴对方密钥</label>' +
      '<div class="row" style="gap:8px">' +
      '<input class="input" id="pasteSyncKey" type="text" placeholder="粘贴对方的同步密钥 sk-...">' +
      '<button class="btn btn-primary btn-sm" id="pasteSyncApply" style="white-space:nowrap">应用同步</button>' +
      '</div></div>' +
      '<div class="row" style="gap:8px;margin-top:8px">' +
      '<button class="btn btn-ghost" id="cloudSyncData" style="flex:1">🔄 同步数据</button>' +
      '</div>' +
      '<p class="hint" id="cloudMsg"></p>' +
      '<div style="display:none">' +
      '<input id="cloudUrl" type="hidden" value="' + U.esc(cloud.url || 'https://gaiazfyyzxbgvcfrzyxi.supabase.co') + '">' +
      '<input id="cloudAnon" type="hidden" value="' + U.esc(cloud.anon || 'sb_publishable_wA2JbGkqCwxO2fQduIr3XA_YkO9oE0m') + '">' +
      '<input id="cloudCode" type="hidden" value="' + U.esc((st.profile.familyCode || '').trim()) + '">' +
      '<input id="cloudOn" type="checkbox"' + (cloud.enabled ? ' checked' : '') + '>' +
      '</div>';

    /* ---- AI 面板内容 ---- */
    const aiBody = '<div class="field"><label>接入方式</label>' +
      '<select class="input" id="aiMode">' +
      '<option value="direct"' + (aiMode !== 'proxy' ? ' selected' : '') + '>直连（Key 存本机，简单）</option>' +
      '<option value="proxy"' + (aiMode === 'proxy' ? ' selected' : '') + '>Supabase 中转（推荐，Key 不暴露）</option>' +
      '</select></div>' +
      '<div id="aiDirect" style="' + (aiMode === 'proxy' ? 'display:none' : '') + '">' +
      '<div class="field"><label>API 地址（OpenAI 兼容）</label>' +
      '<input class="input" id="aiEndpoint" type="url" placeholder="https://api.deepseek.com/chat/completions" value="' + U.esc(ai.endpoint || '') + '"></div>' +
      '<div class="field"><label>API Key</label>' +
      '<input class="input" id="aiApiKey" type="password" placeholder="sk-..." value="' + U.esc(ai.apiKey || '') + '" style="letter-spacing:1px"></div>' +
      '<div class="row"><div class="field" style="flex:1"><label>模型名称</label>' +
      '<input class="input" id="aiModel" type="text" value="' + U.esc(ai.model || 'gpt-4o-mini') + '" placeholder="deepseek-chat"></div>' +
      '<div style="display:flex;align-items:flex-end;padding-bottom:6px">' +
      '<button class="btn btn-blue" id="aiTest" style="white-space:nowrap">🔗 测试连接</button></div></div>' +
      '</div>' +
      '<div id="aiProxy" style="' + (aiMode !== 'proxy' ? 'display:none' : '') + '">' +
      '<div class="field"><label>中转函数地址（Edge Function URL）</label>' +
      '<input class="input" id="aiProxyUrl" type="url" placeholder="https://xxxxx.supabase.co/functions/v1/ai-chat" value="' + U.esc(ai.proxyUrl || '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>自定义系统提示词（可选）</label>' +
      '<textarea class="input" id="aiSystemPrompt" rows="3" placeholder="留空使用默认的儿童友好提示词…"' +
      '>' + U.esc(ai.systemPrompt || '') + '</textarea></div>';

    /* ---- 家长操作面板内容 ---- */
    const parentBody = '<div class="row">' +
      '<button class="btn btn-ghost" id="chgPin" style="flex:1">修改管理密码</button>' +
      '</div>';

    return '<div class="card" style="margin-top:16px;border-color:#e8ecf2;background:#fafbff"><div class="card-h"><h3>⚙️ 高级设置</h3>' +
      '<span class="sub">云同步 / AI 助手 / 家长操作</span></div>' +
      '<div class="row" style="gap:6px;margin-top:8px">' +
      '<button class="' + btnCls('cloud') + '" data-adv="cloud" style="flex:1">☁️ 云同步</button>' +
      '<button class="' + btnCls('ai') + '" data-adv="ai" style="flex:1">🤖 AI 助手</button>' +
      '<button class="' + btnCls('parent') + '" data-adv="parent" style="flex:1">🔒 家长操作</button>' +
      '</div>' +
      '<div id="advCloud" style="margin-top:12px;' + panelStyle('cloud') + '">' + cloudBody + '</div>' +
      '<div id="advAi" style="margin-top:12px;' + panelStyle('ai') + '">' + aiBody + '</div>' +
      '<div id="advParent" style="margin-top:12px;' + panelStyle('parent') + '">' + parentBody + '</div>' +
      '</div>';
  }

  function rewardRow(label, p, obj) {
    return '<div style="border:2px solid var(--line);border-radius:14px;padding:12px">' +
      '<div class="small" style="font-weight:800;margin-bottom:8px">' + label + '</div>' +
      '<div class="row">' +
      '<div style="flex:1"><span class="small muted"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="13" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg></span> <input class="input" id="' + p + '_c" type="number" min="0" value="' + obj.coins + '" style="max-width:84px;display:inline-block;padding:8px 10px"></div>' +
      '<div style="flex:1"><span class="small muted"><svg class="coin-ico" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg></span> <input class="input" id="' + p + '_s" type="number" min="0" value="' + obj.stars + '" style="max-width:84px;display:inline-block;padding:8px 10px"></div>' +
      '</div></div>';
  }


  function tierRewardRow(label, p, tiers) {
    const rows = tiers.map((ti, i) =>
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">' +
      '<span class="small" style="font-weight:700;min-width:42px;text-align:right">' + ti.label + '</span>' +
      '<div style="flex:1"><span class="small muted"><svg class="coin-ico" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-2px"><circle cx="12" cy="12" r="11" fill="#f2a900" stroke="#c48a00" stroke-width="1.5"/><text x="12" y="16.5" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold" font-family="Arial,sans-serif">¥</text></svg></span> <input class="input" id="' + p + '_c' + i + '" type="number" min="0" value="' + ti.coins + '" style="max-width:72px;display:inline-block;padding:6px 8px"></div>' +
      '<div style="flex:1"><span class="small muted"><svg class="coin-ico" viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-2px"><polygon points="12,2.5 15.1,8.8 22.1,9.3 16.8,14 18.2,21 12,17.3 5.8,21 7.2,14 1.9,9.3 8.9,8.8" fill="#ffcb05" stroke="#e0a200" stroke-width="1.1" stroke-linejoin="round"/></svg></span> <input class="input" id="' + p + '_s' + i + '" type="number" min="0" value="' + ti.stars + '" style="max-width:72px;display:inline-block;padding:6px 8px"></div>' +
      '</div>'
    ).join('');
    return '<div style="border:2px solid var(--line);border-radius:14px;padding:12px">' +
      '<div class="small" style="font-weight:800;margin-bottom:10px">' + label + '</div>' +
      rows + '</div>';
  }

  function customTaskCard() {
    const st = PW.store.state;
    const subs = PW.subjects.LIST.map((s) => '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>').join('');
    const tasks = (st.config.customTasks || []).map((t, i) =>
      '<div class="log-row"><div class="log-ico">📌</div>' +
      '<div class="log-main"><b>' + U.esc(t.title) + '</b>' +
      '<span class="small muted">' + repeatName(t.repeat) + (t.repeat === 'once' ? ' · ' + t.date : '') + '</span></div>' +
      (deleteUnlocked ? '<button class="mini-btn" data-deltask="' + i + '" title="删除">🗑️</button>' : '') + '</div>').join('');
  }
  function deleteLockCard() {
    return '<div class="card" style="margin-top:16px;border-color:#d9d9d9;background:#fafafa"><div class="card-h"><h3>🗑️ 回收站</h3>' +
      '<span class="sub">需要验证密码才能显示删除按钮</span></div>' +
      '<button class="btn btn-ghost btn-block" id="unlockDel" style="margin-top:8px">🔓 输入密码解锁删除</button></div>';
  }

  function trashCard() {
    const list = PW.store.getTrash();
    const items = list.length
      ? list.slice().reverse().map((t) => {
          const label = t.type === 'task' ? '作业' : (t.type === 'reading' ? '阅读' : (t.type === 'sports' ? '运动' : '自定义任务'));
          const summary = t.type === 'task' ? U.esc((t.record && t.record.title) || '作业')
            : t.type === 'reading' ? U.esc((t.record && t.record.book) || '阅读')
            : t.type === 'sports' ? U.esc((t.record && t.record.type) || '运动')
            : U.esc((t.record && t.record.title) || '任务');
          return '<div class="log-row">' +
            '<div class="log-main" style="flex:1"><b>' + label + '：' + summary + '</b>' +
            '<span class="small muted">' + (t.at ? U.todayStr(new Date(t.at)) : '') + ' 删除</span></div>' +
            '<button class="mini-btn" data-restore="' + t.id + '" title="恢复">↩️</button>' +
            '<button class="mini-btn" data-purge="' + t.id + '" title="永久删除">🗑️</button></div>';
        }).join('')
      : '<p class="small muted" style="margin-top:8px">回收站是空的，被删除的记录会先到这里，可恢复。</p>';
    return '<div class="card" style="margin-top:16px;border-color:#d9d9d9;background:#fafafa"><div class="card-h"><h3>回收站</h3>' +
      '<span class="sub">删除的记录暂存这里</span></div>' +
      items +
      (list.length ? '<button class="btn btn-ghost btn-block" id="emptyTrash" style="margin-top:10px">清空回收站</button>' : '') +
      '</div>';
  }

  function mistakeCard() {
    const list = PW.store.getMistakes ? PW.store.getMistakes() : [];
    const groups = {};
    list.forEach((m) => { (groups[m.subject] = groups[m.subject] || []).push(m); });
    const SUB = { math: '📐 数学', english: '🔤 英语', chinese: '📖 语文', other: '📝 其他' };
    const keys = Object.keys(groups);
    const body = keys.length
      ? keys.map((k) => {
          const rows = groups[k].map((m) => {
            const solved = m.fixed ? ' <span style="color:#27ae60;font-size:11px">✓已掌握</span>' : '';
            return '<div class="log-row">' +
              '<div class="log-main" style="flex:1"><code style="font-size:13px;font-weight:600">' + U.esc(m.expression) + '</code>' + solved +
              '<span class="small muted">' + (m.date || '') + '</span></div>' +
              (m.fixed ? '' : '<button class="mini-btn" data-mk-fix="' + m.id + '" title="标记已掌握">✓</button>') +
              '<button class="mini-btn" data-mk-del="' + m.id + '" title="删除">🗑️</button></div>';
          }).join('');
          return '<div style="margin:10px 0"><b style="font-size:13px">' + (SUB[k] || k) + '（' + groups[k].length + '）</b>' + rows + '</div>';
        }).join('')
      : '<p class="small muted" style="margin-top:8px">还没有错题。在「今日任务 → 检查作业」里拍照检查，做错的题目会自动归到这里。</p>';
    return '<div class="card" style="margin-top:16px;border-color:#f3d9d9;background:#fffaf9"><div class="card-h"><h3>📕 错题集</h3>' +
      '<span class="sub">按科目分类 · 拍照检查收录</span></div>' + body +
      (list.length ? '<button class="btn btn-ghost btn-block" id="clearFixedMk" style="margin-top:10px">清除已掌握的错题</button>' : '') +
      '</div>';
  }

  function repeatName(r) {
    return { daily: '每天', weekdays: '上学日', weekend: '周末', once: '一次性' }[r] || r;
  }

  /* ---------------- 交互 ---------------- */
  function deriveSupabaseUrl(anon) {
    if (!anon) return '';
    const m = String(anon).match(/^sb_publishable_([a-zA-Z0-9]+)_/);
    return m ? 'https://' + m[1] + '.supabase.co' : '';
  }
  function mount(root) {
    const pinOk = U.$('#pinOk', root);
    if (pinOk) {
      const tryUnlock = () => {
        const v = U.$('#pinInput', root).value;
        const correctPin = (PW.store.state.config && PW.store.state.config.pin) || '1234';
        if (v === correctPin) { unlocked = true; deleteUnlocked = true; U.toast('解锁成功', 'good'); PW.app.forceRender(); }
        else U.toast('密码不对哦', 'warn');
      };
      pinOk.onclick = tryUnlock;
      const pi = U.$('#pinInput', root);
      if (pi) pi.onkeydown = (e) => { if (e.key === 'Enter') tryUnlock(); };
      return;
    }

    /* 高级设置折叠面板切换（保持滚动位置） */
    U.$$('[data-adv]', root).forEach((b) => {
      b.onclick = () => {
        const key = b.dataset.adv;
        const sx = window.scrollX || window.pageXOffset;
        const sy = window.scrollY || window.pageYOffset;
        advancedOpen = (advancedOpen === key) ? '' : key;
        const _sx = sx, _sy = sy;
        PW.app.forceRender();
        setTimeout(() => { window.scrollTo(_sx, _sy); }, 0);
      };
    });

    /* 家长管理分组 Tab 切换 */
    U.$$('[data-pg]', root).forEach((b) => {
      b.onclick = () => {
        parentOpen = b.dataset.pg;
        PW.app.rerender();
      };
    });

    /* 奖励与规则分组 Tab 切换 */
    U.$$('[data-rg]', root).forEach((b) => {
      b.onclick = () => {
        rewardOpen = b.dataset.rg;
        PW.app.rerender();
      };
    });

    const rep = U.$('#ctRep', root);
    if (rep) rep.onchange = () => {
      const wrap = U.$('#ctDateWrap', root);
      if (wrap) wrap.style.display = rep.value === 'once' ? 'block' : 'none';
    };

    const add = U.$('#ctAdd', root);
    if (add) add.onclick = () => {
      const title = U.$('#ctTitle', root).value.trim();
      if (!title) { U.toast('先填任务内容', 'warn'); return; }
      const ct = {
        id: U.uid('ct'),
        title,
        subject: U.$('#ctSub', root).value,
        tag: U.$('#ctTag', root).value,
        repeat: U.$('#ctRep', root).value,
        date: U.$('#ctDate', root).value || U.todayStr(),
        active: true
      };
      PW.store.state.config.customTasks.push(ct);
      PW.store.save();
      U.toast('已发布，会出现在孩子任务里', 'good');
      PW.app.rerender();
    };

    U.$$('[data-deltask]', root).forEach((b) => {
      b.onclick = () => {
        U.confirmBox('删除这条自定义任务？', '将移入回收站，可在本页「回收站」恢复。', '删除', () => {
          const i = +b.dataset.deltask;
          const arr = PW.store.state.config.customTasks;
          if (i >= 0 && i < arr.length) {
            const item = arr.splice(i, 1)[0];
            PW.store.trashRecord('customTask', item);
          }
          PW.store.save(); U.toast('已删除，可在回收站恢复', 'good'); PW.app.rerender();
        }, 'btn-red');
      };
    });
    U.$$('[data-restore]', root).forEach((b) => {
      b.onclick = () => { PW.store.restoreTrash(b.dataset.restore); U.toast('已恢复', 'good'); PW.app.rerender(); };
    });
    U.$$('[data-purge]', root).forEach((b) => {
      b.onclick = () => {
        U.confirmBox('彻底删除这条记录？', '删除后将无法恢复。', '彻底删除', () => {
          PW.store.purgeTrash(b.dataset.purge); U.toast('已彻底删除', 'warn'); PW.app.rerender();
        }, 'btn-red');
      };
    });
    const emptyTrashBtn = U.$('#emptyTrash', root);
    if (emptyTrashBtn) emptyTrashBtn.onclick = () => {
      U.confirmBox('清空回收站？', '全部彻底删除，不可恢复。', '清空', () => {
        PW.store.emptyTrash(); U.toast('回收站已清空', 'warn'); PW.app.rerender();
      }, 'btn-red');
    };

    /* 错题集操作 */
    U.$$('[data-mk-del]', root).forEach((b) => {
      b.onclick = () => { PW.store.deleteMistake(b.dataset.mkDel); U.toast('已删除错题', 'warn'); PW.app.rerender(); };
    });
    U.$$('[data-mk-fix]', root).forEach((b) => {
      b.onclick = () => { PW.store.fixMistake(b.dataset.mkFix); U.toast('已标记掌握 👍', 'good'); PW.app.rerender(); };
    });
    const clearFixedBtn = U.$('#clearFixedMk', root);
    if (clearFixedBtn) clearFixedBtn.onclick = () => {
      PW.store.clearFixedMistakes(); U.toast('已清除已掌握的错题', 'good'); PW.app.rerender();
    };

    /* 回收站：解锁删除（复用管理配置密码） */
    const unlockDelBtn = U.$('#unlockDel', root);
    if (unlockDelBtn) unlockDelBtn.onclick = () => {
      U.modal({
        title: '🔓 验证密码后可删除',
        body: '<div class="field"><label>输入管理密码</label><input class="input" id="delPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="同管理配置密码" style="text-align:center;letter-spacing:4px"></div>',
        ops: [
          { text: '取消', cls: 'btn-ghost' },
          { text: '确认', cls: 'btn-primary', onClick: (c, card) => {
            const v = U.$('#delPinInput', card).value;
            const delCorrectPin = (PW.store.state.config && PW.store.state.config.pin) || '1234';
            if (v === delCorrectPin) { deleteUnlocked = true; c(); PW.app.forceRender(); U.toast('✅ 已解锁删除功能', 'good'); }
            else { U.toast('密码不对哦', 'warn'); }
          }}
        ]
      });
    };

    /* AI 模式切换 */
    const aiMode = U.$('#aiMode', root);
    if (aiMode) aiMode.onchange = () => {
      const proxy = aiMode.value === 'proxy';
      const d = U.$('#aiDirect', root), p = U.$('#aiProxy', root);
      if (d) d.style.display = proxy ? 'none' : '';
      if (p) p.style.display = proxy ? '' : 'none';
    };

    /* 云端：测试连接 */
    /* ---- 云同步：生成/复制密钥 ---- */
    const syncKeyDisp = U.$('#syncKeyDisplay', root);
    const syncKeyCopyBtn = U.$('#syncKeyCopy', root);
    if (syncKeyDisp && !PW.store.state.profile.syncKey) {
      const newKey = 'sk-' + U.uid(32);
      PW.store.state.profile.syncKey = newKey;
      syncKeyDisp.value = newKey;
      if (syncKeyCopyBtn) syncKeyCopyBtn.disabled = false;
      PW.store.save();
    }
    if (syncKeyCopyBtn) syncKeyCopyBtn.onclick = () => {
      const k = syncKeyDisp.value;
      if (!k || k === '(点击生成)') { U.toast('请先生成密钥', 'warn'); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(k).then(() => U.toast('✅ 密钥已复制', 'good'));
      else { syncKeyDisp.select(); document.execCommand('copy'); U.toast('✅ 已复制', 'good'); }
    };

    /* ---- 应用并同步 ---- */
    const applySyncBtn = U.$('#cloudApplySync', root);
    if (applySyncBtn) applySyncBtn.onclick = async () => {
      const CORRECT_URL = 'https://gaiazfyyzxbgvcfrzyxi.supabase.co';
      const anon = U.$('#cloudAnon', root).value.trim();
      const code = U.$('#cloudCode', root).value.trim();
      const msg = U.$('#cloudMsg', root);
      const url = CORRECT_URL; // 强制正确地址，避免 sb_publishable_ key 解析出错误项目 ID
      if (!url || !anon) { U.toast('请先在管理配置底部填写 Supabase 地址和密钥', 'warn'); return; }
      applySyncBtn.disabled = true; applySyncBtn.textContent = '⏳ 同步中…';
      try {
        const cc = PW.store.state.config.cloudConfig;
        cc.enabled = true; cc.url = url; cc.anon = anon;
        if (!PW.store.state.profile.familyCode && code) PW.store.state.profile.familyCode = code;
        PW.store.save();
        const r = await fetch(url + '/rest/v1/pw_state?select=updated_at&limit=1', {
          headers: { 'apikey': anon, 'Authorization': 'Bearer ' + anon }, cache: 'no-store'
        });
        if (!(r.ok || r.status === 406)) throw new Error('HTTP ' + r.status);
        // 智能同步：云端更新则用云端，否则把本机推上去（绝不用空数据覆盖对方）
        const remote = await PW.sync.pull();
        const remoteT = remote && remote.updatedAt ? remote.updatedAt : 0;
        const localT = PW.store.state.updatedAt || 0;
        if (remoteT > localT + 1500) {
          PW.store.replaceAll(remote.data);
          if (msg) { msg.textContent = '✅ 已从云端下载最新数据'; msg.style.color = '#2e7d32'; }
          U.toast('✅ 已从云端下载最新数据', 'good');
        } else {
          const ok = await PW.sync.push();
          if (msg) { msg.textContent = ok ? '✅ 已上传到云端' : '⚠️ 上传失败'; msg.style.color = ok ? '#2e7d32' : '#c0392b'; }
          U.toast(ok ? '✅ 数据已上传到云端' : '⚠️ 上传失败', ok ? 'good' : 'warn');
        }
        PW.app.rerender();
      } catch (e) {
        if (msg) { msg.textContent = '❌ 失败：' + e.message; msg.style.color = '#c0392b'; }
        U.toast('❌ ' + e.message, 'warn');
      } finally { applySyncBtn.disabled = false; applySyncBtn.textContent = '应用并同步'; }
    };

    /* ---- 粘贴对方密钥 ---- */
    const pasteApplyBtn = U.$('#pasteSyncApply', root);
    if (pasteApplyBtn) pasteApplyBtn.onclick = async () => {
      const pasted = U.$('#pasteSyncKey', root).value.trim();
      if (!pasted) { U.toast('请粘贴对方的同步密钥', 'warn'); return; }
      if (!pasted.startsWith('sk-')) { U.toast('密钥格式不对，应以 sk- 开头', 'warn'); return; }
      const CORRECT_URL = 'https://gaiazfyyzxbgvcfrzyxi.supabase.co';
      const CORRECT_ANON = 'sb_publishable_wA2JbGkqCwxO2fQduIr3XA_YkO9oE0m';
      pasteApplyBtn.disabled = true; pasteApplyBtn.textContent = '⏳ 下载中…';
      try {
        // 内存配置云端（暂不 save，避免把本地空数据误推上云覆盖对方）
        PW.store.state.profile.syncKey = pasted;
        PW.store.state.profile.familyCode = pasted;
        PW.store.state.config.cloudConfig = { enabled: true, url: CORRECT_URL, anon: CORRECT_ANON };
        const remote = await PW.sync.pull();
        if (remote && remote.data) {
          PW.store.replaceAll(remote.data); // 内部会 save 并持久化云端配置
          U.toast('✅ 已从云端下载数据', 'good');
        } else {
          U.toast('云端暂无数据，请先在电脑端点「应用并同步」上传', 'warn');
        }
        PW.app.rerender();
      } catch (e) {
        U.toast('❌ ' + e.message, 'warn');
      } finally {
        pasteApplyBtn.disabled = false; pasteApplyBtn.textContent = '应用同步';
      }
    };

    /* ---- 手动同步数据 ---- */
    const syncDataBtn = U.$('#cloudSyncData', root);
    if (syncDataBtn) syncDataBtn.onclick = async () => {
      syncDataBtn.disabled = true; syncDataBtn.textContent = '⏳ 同步中…';
      try {
        const remote = await PW.sync.pull();
        const remoteT = remote && remote.updatedAt ? remote.updatedAt : 0;
        const localT = PW.store.state.updatedAt || 0;
        if (remoteT > localT + 1500) {
          PW.store.replaceAll(remote.data);
          U.toast('✅ 已从云端下载最新数据', 'good');
        } else {
          const ok = await PW.sync.push();
          U.toast(ok ? '✅ 数据已同步到云端' : '⚠️ 同步失败', ok ? 'good' : 'warn');
        }
      } catch (e) { U.toast('❌ ' + e.message, 'warn'); }
      finally { syncDataBtn.disabled = false; syncDataBtn.textContent = '🔄 同步数据'; }
    };

    /* ---- 重新登录（清除云配置） ---- */
    const reloginLnk = U.$('#cloudRelogin', root);
    if (reloginLnk) reloginLnk.onclick = (ev) => {
      ev.preventDefault();
      U.confirmBox('重新登录？', '将清除云端同步配置，回到纯本地模式。本地数据不会丢失。', '确认清除', () => {
        PW.store.state.config.cloudConfig.enabled = false;
        PW.store.state.config.cloudConfig.url = '';
        PW.store.state.config.cloudConfig.anon = '';
        PW.store.save();
        PW.sync.setStatus('本地模式（未连云）', 'off');
        U.toast('已清除云配置', 'good');
        PW.app.rerender();
      }, 'btn-red');
    };

    
    /* AI 测试连接（兼容直连 / 中转） */
    const aiTest = U.$('#aiTest', root);
    if (aiTest) aiTest.onclick = async () => {
      const mode = U.$('#aiMode', root).value;
      if (mode === 'proxy') {
        const url = U.$('#aiProxyUrl', root).value.trim();
        if (!url) { U.toast('请先填中转函数地址', 'warn'); return; }
        aiTest.disabled = true; aiTest.textContent = '⏳ 测试中…';
        try {
          const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '你好，用一句话介绍你自己' }] }) });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const d = await r.json();
          if (!d.text) throw new Error('返回格式异常');
          U.toast('✅ 连接成功！AI 回复：' + d.text.slice(0, 40), 'good');
        } catch (e) { U.toast('❌ 连接失败：' + e.message, 'warn'); }
        finally { aiTest.disabled = false; aiTest.textContent = '🔗 测试连接'; }
        return;
      }
      const ep = U.$('#aiEndpoint', root).value.trim();
      const key = U.$('#aiApiKey', root).value.trim();
      const model = U.$('#aiModel', root).value.trim() || 'gpt-4o-mini';
      if (!ep || !key) { U.toast('请先填写 API 地址和 Key', 'warn'); return; }
      aiTest.disabled = true; aiTest.textContent = '⏳ 测试中…';
      try {
        const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify({ model, messages: [{ role: 'user', content: '你好，用一句话介绍你自己' }], temperature: 0.5, max_tokens: 50 }) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const d = await r.json(); const msg = d.choices && d.choices[0] && d.choices[0].message;
        if (!msg) throw new Error('返回格式异常');
        U.toast('✅ 连接成功！AI 回复：' + msg.content.slice(0, 40), 'good');
      } catch (e) { U.toast('❌ 连接失败：' + e.message, 'warn'); }
      finally { aiTest.disabled = false; aiTest.textContent = '🔗 测试连接'; }
    };

    const save = U.$('#saveCfg', root);
    if (save) save.onclick = () => {
      const c = PW.store.state.config;
      const setR = (p, obj) => { obj.coins = Math.max(0, parseInt(U.$('#' + p + '_c', root).value, 10) || 0); obj.stars = Math.max(0, parseInt(U.$('#' + p + '_s', root).value, 10) || 0); };
      setR('hw', c.rewards.homework);
      // Save 3-tier values for reading/sports/quiz
      if (!c.rewards.readingTiers) c.rewards.readingTiers = [];
      if (!c.rewards.sportsTiers) c.rewards.sportsTiers = [];
      if (!c.rewards.quizTiers) c.rewards.quizTiers = [];
      for (let ti = 0; ti < 3; ti++) {
        const rc = Math.max(0, parseInt(U.$('#rd_c' + ti, root).value, 10) || [30,20,10][ti]);
        const rs = Math.max(0, parseInt(U.$('#rd_s' + ti, root).value, 10) || [5,3,2][ti]);
        const sc = Math.max(0, parseInt(U.$('#sp_c' + ti, root).value, 10) || [30,20,10][ti]);
        const ss = Math.max(0, parseInt(U.$('#sp_s' + ti, root).value, 10) || [5,3,2][ti]);
        const qc = Math.max(0, parseInt(U.$('#qt_c' + ti, root).value, 10) || [5,5,10][ti]);
        const qs = Math.max(0, parseInt(U.$('#qt_s' + ti, root).value, 10) || [0,1,2][ti]);
        (c.rewards.readingTiers[ti] = c.rewards.readingTiers[ti] || {}).coins = rc;
        c.rewards.readingTiers[ti].stars = rs;
        (c.rewards.sportsTiers[ti] = c.rewards.sportsTiers[ti] || {}).coins = sc;
        c.rewards.sportsTiers[ti].stars = ss;
        (c.rewards.quizTiers[ti] = c.rewards.quizTiers[ti] || {}).coins = qc;
        c.rewards.quizTiers[ti].stars = qs;
      }
      // Also update base reading/sports/quiz from tier-1 for compatibility
      c.rewards.reading.coins = (c.rewards.readingTiers[0] && c.rewards.readingTiers[0].coins) || 30;
      c.rewards.reading.stars = (c.rewards.readingTiers[0] && c.rewards.readingTiers[0].stars) || 5;
      c.rewards.sports.coins = (c.rewards.sportsTiers[0] && c.rewards.sportsTiers[0].coins) || 30;
      c.rewards.sports.stars = (c.rewards.sportsTiers[0] && c.rewards.sportsTiers[0].stars) || 5;
      c.rewards.quiz80 = { coins: (c.rewards.quizTiers[0] && c.rewards.quizTiers[0].coins) || 5, stars: (c.rewards.quizTiers[0] && c.rewards.quizTiers[0].stars) || 0 };
      c.rewards.quiz90 = { coins: (c.rewards.quizTiers[1] && c.rewards.quizTiers[1].coins) || 5, stars: (c.rewards.quizTiers[1] && c.rewards.quizTiers[1].stars) || 1 };
      c.rewards.quiz100 = { coins: (c.rewards.quizTiers[2] && c.rewards.quizTiers[2].coins) || 10, stars: (c.rewards.quizTiers[2] && c.rewards.quizTiers[2].stars) || 2 };
      // Save cash products config
      if (!c.cashProducts) c.cashProducts = [];
      var baseCash = PW.shop.CASH;
      for (var ci = 0; ci < Math.max(c.cashProducts.length, baseCash.length); ci++) {
        if (!c.cashProducts[ci]) c.cashProducts[ci] = Object.assign({}, baseCash[ci]);
        c.cashProducts[ci].stars = Math.max(1, parseInt(U.$('#cp_s' + ci, root).value, 10) || (baseCash[ci] && baseCash[ci].stars) || 25);
        c.cashProducts[ci].cash = Math.max(1, parseInt(U.$('#cp_c' + ci, root).value, 10) || (baseCash[ci] && baseCash[ci].cash) || 1);
      }
      c.quizDailyLimit = Math.max(1, parseInt(U.$('#limQuiz', root).value, 10) || 2);
      c.quizCount = Math.max(5, Math.min(50, parseInt(U.$('#limQCount', root).value, 10) || 20));
      c.monthlyCashCap = Math.max(0, parseInt(U.$('#limCash', root).value, 10) || 0);
      c.blindBoxCost = Math.max(0, parseInt(U.$('#limBox', root).value, 10) || 66);
      /* 盲盒奖品配置保存 */
      if (!c.blindBoxConfig) c.blindBoxConfig = {};
      c.blindBoxConfig.ratioPokemon = Math.max(0, Math.min(100, parseInt(U.$('#bbRp', root).value, 10) || 28));
      c.blindBoxConfig.ratioStar = Math.max(0, Math.min(100, parseInt(U.$('#bbRstar', root).value, 10) || 32));
      c.blindBoxConfig.ratioConsumable = Math.max(0, Math.min(100, parseInt(U.$('#bbRcon', root).value, 10) || 30));
      c.blindBoxConfig.ratioCoins = Math.max(0, Math.min(100, parseInt(U.$('#bbRx', root).value, 10) || 10));
      c.blindBoxConfig.coinMin = Math.max(1, parseInt(U.$('#bbCmin', root).value, 10) || 40);
      c.blindBoxConfig.coinMax = Math.max(parseInt(U.$('#bbCmin', root).value, 10) || 40, parseInt(U.$('#bbCmax', root).value, 10) || 120);
      c.blindBoxConfig.starMin = Math.max(1, parseInt(U.$('#bbSmin', root).value, 10) || 20);
      c.blindBoxConfig.starMax = Math.max(parseInt(U.$('#bbSmin', root).value, 10) || 20, parseInt(U.$('#bbSmax', root).value, 10) || 60);
      c.blindBoxConfig.consumableMin = Math.max(1, parseInt(U.$('#bbConMin', root).value, 10) || 2);
      c.blindBoxConfig.consumableMax = Math.max(parseInt(U.$('#bbConMin', root).value, 10) || 2, parseInt(U.$('#bbConMax', root).value, 10) || 4);
      c.readingMinMinutes = Math.max(1, parseInt(U.$('#limRmin', root).value, 10) || 20);
      c.sportsMinMinutes = Math.max(1, parseInt(U.$('#limSmin', root).value, 10) || 20);
      c.homeworkDeadline = U.$('#limDeadline', root).value || '21:30';

      // 云端同步配置（强制使用正确的 Supabase 地址）
      const code = U.$('#cloudCode', root).value.trim();
      const ccAnon = U.$('#cloudAnon', root).value.trim();
      const ccUrl = 'https://gaiazfyyzxbgvcfrzyxi.supabase.co';
      c.cloudConfig = {
        enabled: !!U.$('#cloudOn', root).checked,
        url: ccUrl,
        anon: ccAnon
      };
      if (code && !PW.store.state.profile.familyCode) PW.store.state.profile.familyCode = code;

      // AI 配置
      const aiMode = U.$('#aiMode', root).value;
      c.aiConfig = {
        enabled: aiMode === 'proxy' ? !!U.$('#aiProxyUrl', root).value.trim()
          : !!(U.$('#aiEndpoint', root).value && U.$('#aiApiKey', root).value),
        mode: aiMode,
        endpoint: U.$('#aiEndpoint', root).value.trim(),
        apiKey: U.$('#aiApiKey', root).value.trim(),
        model: U.$('#aiModel', root).value.trim() || 'deepseek-chat',
        systemPrompt: U.$('#aiSystemPrompt', root).value.trim(),
        proxyUrl: U.$('#aiProxyUrl', root).value.trim()
      };

      PW.store.save();
      // 若启用了云端，保存后重连并立即同步一次
      if (c.cloudConfig.enabled) {
        PW.sync.reinit().then((ok) => {
          if (ok) U.toast('✅ 配置已保存，并同步到云端', 'good');
          else U.toast('✅ 配置已保存，但云端连接失败，请检查地址/密钥', 'warn');
        });
      } else {
        U.toast('✅ 配置已保存', 'good');
      }

    };

    /* ---- 各卡片独立保存按钮 ---- */
    const saveReward = U.$('#saveReward', root);
    if (saveReward) saveReward.onclick = () => {
      const c = PW.store.state.config;
      const setR = (p, obj) => { obj.coins = Math.max(0, parseInt(U.$('#' + p + '_c', root).value, 10) || 0); obj.stars = Math.max(0, parseInt(U.$('#' + p + '_s', root).value, 10) || 0); };
      setR('hw', c.rewards.homework);
      if (!c.rewards.readingTiers) c.rewards.readingTiers = [];
      if (!c.rewards.sportsTiers) c.rewards.sportsTiers = [];
      if (!c.rewards.quizTiers) c.rewards.quizTiers = [];
      for (let ti = 0; ti < 3; ti++) {
        const rc = Math.max(0, parseInt(U.$('#rd_c' + ti, root).value, 10) || [30,20,10][ti]);
        const rs = Math.max(0, parseInt(U.$('#rd_s' + ti, root).value, 10) || [5,3,2][ti]);
        const sc = Math.max(0, parseInt(U.$('#sp_c' + ti, root).value, 10) || [30,20,10][ti]);
        const ss = Math.max(0, parseInt(U.$('#sp_s' + ti, root).value, 10) || [5,3,2][ti]);
        const qc = Math.max(0, parseInt(U.$('#qt_c' + ti, root).value, 10) || [5,5,10][ti]);
        const qs = Math.max(0, parseInt(U.$('#qt_s' + ti, root).value, 10) || [0,1,2][ti]);
        (c.rewards.readingTiers[ti] = c.rewards.readingTiers[ti] || {}).coins = rc;
        c.rewards.readingTiers[ti].stars = rs;
        (c.rewards.sportsTiers[ti] = c.rewards.sportsTiers[ti] || {}).coins = sc;
        c.rewards.sportsTiers[ti].stars = ss;
        (c.rewards.quizTiers[ti] = c.rewards.quizTiers[ti] || {}).coins = qc;
        c.rewards.quizTiers[ti].stars = qs;
      }
      c.rewards.reading.coins = (c.rewards.readingTiers[0] && c.rewards.readingTiers[0].coins) || 30;
      c.rewards.reading.stars = (c.rewards.readingTiers[0] && c.rewards.readingTiers[0].stars) || 5;
      c.rewards.sports.coins = (c.rewards.sportsTiers[0] && c.rewards.sportsTiers[0].coins) || 30;
      c.rewards.sports.stars = (c.rewards.sportsTiers[0] && c.rewards.sportsTiers[0].stars) || 5;
      PW.store.save(); U.toast('✅ 奖励设置已保存', 'good');
    };

    const saveLimit = U.$('#saveLimit', root);
    if (saveLimit) saveLimit.onclick = () => {
      const c = PW.store.state.config;
      c.quizDailyLimit = Math.max(1, parseInt(U.$('#limQuiz', root).value, 10) || 2);
      c.quizCount = Math.max(5, Math.min(50, parseInt(U.$('#limQCount', root).value, 10) || 20));
      c.monthlyCashCap = Math.max(0, parseInt(U.$('#limCash', root).value, 10) || 0);
      c.homeworkDeadline = U.$('#limDeadline', root).value || '21:30';
      c.readingMinMinutes = Math.max(1, parseInt(U.$('#limRmin', root).value, 10) || 20);
      c.sportsMinMinutes = Math.max(1, parseInt(U.$('#limSmin', root).value, 10) || 20);
      PW.store.save(); U.toast('✅ 限制规则已保存', 'good');
    };

    const saveBlindBox = U.$('#saveBlindBox', root);
    if (saveBlindBox) saveBlindBox.onclick = () => {
      const c = PW.store.state.config;
      c.blindBoxCost = Math.max(0, parseInt(U.$('#limBox', root).value, 10) || 66);
      if (!c.blindBoxConfig) c.blindBoxConfig = {};
      c.blindBoxConfig.ratioPokemon = Math.max(0, Math.min(100, parseInt(U.$('#bbRp', root).value, 10) || 28));
      c.blindBoxConfig.ratioStar = Math.max(0, Math.min(100, parseInt(U.$('#bbRstar', root).value, 10) || 32));
      c.blindBoxConfig.ratioConsumable = Math.max(0, Math.min(100, parseInt(U.$('#bbRcon', root).value, 10) || 30));
      c.blindBoxConfig.ratioCoins = Math.max(0, Math.min(100, parseInt(U.$('#bbRx', root).value, 10) || 10));
      c.blindBoxConfig.coinMin = Math.max(1, parseInt(U.$('#bbCmin', root).value, 10) || 40);
      c.blindBoxConfig.coinMax = Math.max(parseInt(U.$('#bbCmin', root).value, 10) || 40, parseInt(U.$('#bbCmax', root).value, 10) || 120);
      c.blindBoxConfig.starMin = Math.max(1, parseInt(U.$('#bbSmin', root).value, 10) || 20);
      c.blindBoxConfig.starMax = Math.max(parseInt(U.$('#bbSmin', root).value, 10) || 20, parseInt(U.$('#bbSmax', root).value, 10) || 60);
      c.blindBoxConfig.consumableMin = Math.max(1, parseInt(U.$('#bbConMin', root).value, 10) || 2);
      c.blindBoxConfig.consumableMax = Math.max(parseInt(U.$('#bbConMin', root).value, 10) || 2, parseInt(U.$('#bbConMax', root).value, 10) || 4);
      PW.store.save(); U.toast('✅ 盲盒配置已保存', 'good');
    };

    const saveCash = U.$('#saveCash', root);
    if (saveCash) saveCash.onclick = () => {
      const c = PW.store.state.config;
      if (!c.cashProducts) c.cashProducts = [];
      var baseCash = PW.shop.CASH;
      for (var ci = 0; ci < Math.max(c.cashProducts.length, baseCash.length); ci++) {
        if (!c.cashProducts[ci]) c.cashProducts[ci] = Object.assign({}, baseCash[ci]);
        c.cashProducts[ci].stars = Math.max(1, parseInt(U.$('#cp_s' + ci, root).value, 10) || (baseCash[ci] && baseCash[ci].stars) || 25);
        c.cashProducts[ci].cash = Math.max(1, parseInt(U.$('#cp_c' + ci, root).value, 10) || (baseCash[ci] && baseCash[ci].cash) || 1);
      }
      PW.store.save(); U.toast('✅ 零花钱配置已保存', 'good');
    };

    const chg = U.$('#chgPin', root);
    if (chg) chg.onclick = () => {
      U.modal({
        title: '修改管理密码',
        body: '<div class="field"><label>新密码（4-8 位数字）</label><input class="input" id="newPin" type="password" inputmode="numeric" maxlength="8" placeholder="新密码"></div>',
        ops: [{ text: '取消', cls: 'btn-ghost' },
          { text: '确定', cls: 'btn-primary', onClick: (c, card) => {
            const v = U.$('#newPin', card).value.trim();
            if (!/^\d{4,8}$/.test(v)) { U.toast('密码需为 4-8 位数字', 'warn'); return; }
            PW.store.state.config.pin = v; PW.store.save();
            c(); U.toast('密码已修改', 'good');
          } }]
      });
    };

    const pmSend = U.$('#pmSend', root);
    if (pmSend) pmSend.onclick = () => {
      const text = U.$('#pmText', root).value.trim();
      const coins = Math.max(0, parseInt(U.$('#pmCoins', root).value, 10) || 0);
      const stars = Math.max(0, parseInt(U.$('#pmStars', root).value, 10) || 0);
      if (!text && !coins && !stars) { U.toast('请填写留言或奖励', 'warn'); return; }
      const r = PW.store.sendParentMessage({ text, coins, stars });
      if (r.ok) {
        U.toast('已发送，孩子可在 🔔 消息里查收', 'good');
        U.$('#pmText', root).value = ''; U.$('#pmCoins', root).value = '0'; U.$('#pmStars', root).value = '0';
        PW.app.rerender();
      } else U.toast(r.msg || '发送失败', 'warn');
    };

    /* 扣罚星星 */
    const deductBtn = U.$('#deductBtn', root);
    if (deductBtn) deductBtn.onclick = () => {
      const reason = U.$('#deductReason', root).value.trim();
      const amount = Math.max(0, parseInt(U.$('#deductAmount', root).value, 10) || 0);
      if (!amount) { U.toast('请输入扣罚数量', 'warn'); return; }
      if (!reason) { U.toast('请填写扣罚原因', 'warn'); return; }
      const currentStars = PW.store.state.wallet.stars || 0;
      if (amount > currentStars) { U.toast('当前只有 ' + currentStars + ' 颗星星，不够扣减', 'warn'); return; }
      const r = PW.store.deductStars(reason, amount);
      if (r.ok) {
        U.toast('已扣减 ' + amount + ' ⭐，孩子会收到通知', 'good');
        U.$('#deductReason', root).value = '';
        U.$('#deductAmount', root).value = '10';
        PW.app.rerender();
      } else U.toast(r.msg || '扣罚失败', 'warn');
    };

    /* 清零钱包 */
    const clearWalletBtn = U.$('#clearWalletBtn', root);
    if (clearWalletBtn) clearWalletBtn.onclick = () => {
      const s = PW.store.state.wallet;
      const coins = s.coins || 0, stars = s.stars || 0;
      if (!coins && !stars) { U.toast('金币和星星已经是 0', 'info'); return; }
      if (confirm('⚠️ 确定要清零全部数据吗？\n\n当前：💰 ' + coins + ' 金币  |  ⭐ ' + stars + ' 星星\n\n将同时清空：金币、星星、所有徽章领取记录\n\n清零后不可恢复！')) {
        PW.store.clearWallet();
        U.toast('已清零：金币和星星归零', 'good');
        PW.app.rerender();
      }
    };
  }
  // 注：出于安全考虑，已移除「清空全部数据」按钮，避免误触丢失所有进度。

  return { title: '管理配置', sub: '家长专属：调整奖励、发布任务、设置限制、连接云端', render, mount };
})();
