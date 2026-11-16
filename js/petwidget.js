/* =========================================================
   PW · AI 学习助手（悬浮宝可梦 → 点击打开聊天）
   保留宝可梦形象作为头像，点击后展开聊天面板。
   支持 OpenAI 兼容 API（由家长在管理配置中设置）。
   ========================================================= */
PW.petwidget = (function () {
  const U = PW.util;
  let floatEl, bodyEl;
  let chatEl, chatMsgs, chatInput, sendBtn, closeBtn;
  let isOpen = false;
  let isSending = false;

  /* ---- 儿童友好系统提示词 ---- */
  const DEFAULT_SYSTEM = `你是一个名叫"{AI_NAME}"的友好AI学习伙伴，正在帮助一名小学生（4-9年级）学习。

你的特点：
- 说话温暖、鼓励、有耐心，像一个懂很多的大哥哥/大姐姐
- 用孩子能理解的语言解释复杂概念（多用比喻、生活例子）
- 回答问题时先肯定孩子的思考，再给出答案
- 如果不知道答案，诚实地说"这个问题很有趣，我们一起查查看"，然后给一个探索方向
- 适当使用表情符号让对话更生动 😊🌟📚
- 每次回答控制在3-5句话以内，不要太长
- 可以主动问引导性问题帮助孩子思考

你可以帮忙：
✅ 解释语文/数学/英语/科学等学科问题
✅ 推荐好书、好电影、有趣的科学实验
✅ 讲故事、出谜语、玩文字游戏
✅ 鼓励孩子完成作业和阅读任务
❌ 不帮写作业答案（可以给思路和提示）
❌ 不回答不适宜儿童的内容`;

  /* ---- AI 助手名字：随机形容词 + 当前宝可梦名（如"聪明的皮卡丘"） ---- */
  const AI_ADJ = ['聪明的', '勇敢的', '可爱的', '机灵的', '勤快的', '温柔的', '酷酷的', '闪亮的', '欢乐的', '神秘的', '热血的', '暖心的'];
  function aiAdj() {
    let adj = localStorage.getItem('pw_ai_adj');
    if (!adj) { adj = U.pick(AI_ADJ); localStorage.setItem('pw_ai_adj', adj); }
    return adj;
  }
  function aiName() {
    const active = PW.store.state.pet.active;
    const pn = (active && PW.pokemon.name(active)) || '';
    if (pn) return aiAdj() + pn;
    // 无伙伴时：用训练家昵称 + 学习伙伴，避免显示误导性的「勇敢的宝可梦」
    const trainer = (PW.store.state.profile && PW.store.state.profile.name) || '';
    return trainer ? (trainer + '的AI学习伙伴') : 'AI学习伙伴';
  }

  /* ---- 聊天记录（内存 + 持久化） ---- */
  let history = [];

  function loadHistory() {
    try {
      const raw = localStorage.getItem('pw_ai_chat_v1');
      if (raw) history = JSON.parse(raw);
    } catch (e) { history = []; }
  }
  function saveHistory() {
    try {
      // 只保留最近 100 条
      const trimmed = history.slice(-100);
      localStorage.setItem('pw_ai_chat_v1', JSON.stringify(trimmed));
    } catch (e) { /* ignore */ }
  }

  /* ---- 初始化 ---- */
  function init() {
    floatEl = document.getElementById('petFloat');
    bodyEl = document.getElementById('petFloatBody');
    chatEl = document.getElementById('aiChatPanel');
    if (!floatEl) return;

    loadHistory();
    refresh();
    buildChatUI();
    bindEvents();
    renderMessages();

    // 还原上次拖拽位置
    try {
      const pos = JSON.parse(localStorage.getItem('pw_float_pos') || 'null');
      if (pos && typeof pos.left === 'number') {
        floatEl.style.right = 'auto'; floatEl.style.bottom = 'auto';
        floatEl.style.left = pos.left + 'px'; floatEl.style.top = pos.top + 'px';
      }
    } catch (e) {}

    // 未配置 API 时，首次点击提示家长设置
    let suppressClick = false;
    floatEl.onclick = (e) => {
      if (suppressClick) { suppressClick = false; return; }
      if (e.target.closest('#aiChatPanel') || e.target.closest('.chat-header')) return;
      toggle();
    };

    // 可拖拽（避免遮挡按钮时挪不开）
    let dragging = false, moved = false, sx = 0, sy = 0, ol = 0, ot = 0;
    floatEl.style.touchAction = 'none';
    floatEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#aiChatPanel') || e.target.closest('.chat-header')) return;
      dragging = true; moved = false;
      const r = floatEl.getBoundingClientRect();
      floatEl.style.right = 'auto'; floatEl.style.bottom = 'auto';
      floatEl.style.left = r.left + 'px'; floatEl.style.top = r.top + 'px';
      sx = e.clientX; sy = e.clientY; ol = r.left; ot = r.top;
      try { floatEl.setPointerCapture(e.pointerId); } catch (_) {}
    });
    floatEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      const w = floatEl.offsetWidth, h = floatEl.offsetHeight;
      let nl = Math.max(2, Math.min(window.innerWidth - w - 2, ol + dx));
      let nt = Math.max(2, Math.min(window.innerHeight - h - 2, ot + dy));
      floatEl.style.left = nl + 'px'; floatEl.style.top = nt + 'px';
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      try { floatEl.releasePointerCapture(e.pointerId); } catch (_) {}
      if (moved) {
        suppressClick = true;
        localStorage.setItem('pw_float_pos', JSON.stringify({ left: parseFloat(floatEl.style.left), top: parseFloat(floatEl.style.top) }));
      }
    };
    floatEl.addEventListener('pointerup', endDrag);
    floatEl.addEventListener('pointercancel', endDrag);
  }

  /* ---- 构建/注入聊天面板 DOM ---- */
  function buildChatUI() {
    // 避免重复创建
    if (document.getElementById('aiChatPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'aiChatPanel';
    panel.className = 'ai-chat-panel hidden';
    panel.innerHTML =
      '<div class="chat-header">' +
        '<div class="chat-avatar" id="chatAvatar"></div>' +
        '<div class="chat-title"><b id="aiName">' + aiName() + '</b><span class="chat-sub">有什么想问的？</span></div>' +
        '<button class="chat-close" id="chatClose" title="收起">✕</button>' +
      '</div>' +
      '<div class="chat-messages" id="chatMessages"></div>' +
      '<div class="chat-suggestions" id="chatSuggestions"></div>' +
      '<div class="chat-input-row">' +
        '<input class="chat-input" id="chatInput" type="text" placeholder="输入你的问题…" maxlength="500" autocomplete="off" />' +
        '<button class="chat-send" id="chatSend" title="发送">➤</button>' +
      '</div>';

    floatEl.parentNode.insertBefore(panel, floatEl.nextSibling);
    chatEl = panel;
    chatMsgs = document.getElementById('chatMessages');
    chatInput = document.getElementById('chatInput');
    sendBtn = document.getElementById('chatSend');
    closeBtn = document.getElementById('chatClose');

    refreshAvatar();
  }

  function bindEvents() {
    if (closeBtn) closeBtn.onclick = () => toggle();
    if (sendBtn) sendBtn.onclick = () => sendMessage();
    if (chatInput) {
      chatInput.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
    }
  }

  /* ---- 开关面板 ---- */
  function toggle() {
    isOpen = !isOpen;
    if (!chatEl) buildChatUI();
    chatEl.classList.toggle('hidden', !isOpen);
    if (isOpen) {
      chatInput && chatInput.focus();
      scrollToBottom();
      showSuggestions();
    }
  }

  /** 外部调用：打开 AI 聊天面板（不会在已打开时关闭），供顶栏「🤖 AI 助手」按钮使用 */
  function openChat() {
    if (!chatEl) buildChatUI();
    if (!isOpen) toggle();
    else { chatInput && chatInput.focus(); }
  }

  /* ---- 渲染消息列表 ---- */
  function renderMessages() {
    if (!chatMsgs) return;
    if (history.length === 0) {
      chatMsgs.innerHTML = '<div class="chat-welcome">' +
        '<b>你好呀！我是' + aiName() + '</b>' +
        '<p class="small muted" style="margin:6px 0 0">问我任何关于学习、百科、故事的问题吧～</p></div>';
      return;
    }
    chatMsgs.innerHTML = history.map((m) => {
      if (m.role === 'user') {
        return '<div class="chat-msg chat-user"><div class="chat-bubble">' + U.esc(m.content) + '</div></div>';
      }
      return '<div class="chat-msg chat-ai"><div class="chat-bubble ai-bubble">' + formatAI(m.content) + '</div></div>';
    }).join('');
    scrollToBottom();
  }

  /** 简单的 Markdown-like 格式化：换行、加粗 */
  function formatAI(text) {
    return U.esc(text)
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  }

  function scrollToBottom() {
    if (chatMsgs) chatMsgs.scrollTop = chatMsgs.scrollHeight;
  }

  /* ---- 快捷建议（空状态时显示） ---- */
  function showSuggestions() {
    const el = document.getElementById('chatSuggestions');
    if (!el || history.length > 0) { if (el) el.innerHTML = ''; return; }
    const qs = [
      '📖 今天读了什么书？',
      '🧮 帮我讲解这道数学题',
      '🌍 为什么天空是蓝色的？',
      '⭐ 给我讲个有趣的故事'
    ];
    el.innerHTML = '<div class="suggest-chips">' + qs.map((q) =>
      '<button class="chip suggest-chip">' + q + '</button>'
    ).join('') + '</div>';
    el.querySelectorAll('.suggest-chip').forEach((btn) => {
      btn.onclick = () => { chatInput.value = btn.textContent.trim(); sendMessage(); };
    });
  }

  /* ---- 发送消息 ---- */
  async function sendMessage() {
    if (!chatInput || isSending) return;
    const text = chatInput.value.trim();
    if (!text) return;

    // 检查 AI 是否已配置
    const cfg = PW.store.state.config.aiConfig;
    const mode = (cfg && cfg.mode) || 'direct';
    if (mode === 'proxy') {
      if (!cfg || !cfg.proxyUrl) {
        chatMsgs.innerHTML = '<div class="chat-welcome">' +
          '<div style="font-size:36px;margin-bottom:8px">⚙️</div>' +
          '<b>AI 助手还未配置</b>' +
          '<p class="small muted" style="margin:6px 0 0">请爸爸妈妈在「管理配置」里设置中转函数地址哦～</p></div>';
        return;
      }
    } else {
      if (!cfg || !cfg.endpoint || !cfg.apiKey) {
        chatMsgs.innerHTML = '<div class="chat-welcome">' +
          '<div style="font-size:36px;margin-bottom:8px">⚙️</div>' +
          '<b>AI 助手还未配置</b>' +
          '<p class="small muted" style="margin:6px 0 0">请爸爸妈妈在「管理配置」里设置 AI 接口哦～</p></div>';
        return;
      }
    }

    // 添加用户消息
    history.push({ role: 'user', content: text, at: Date.now() });
    chatInput.value = '';
    renderMessages();
    if (document.getElementById('chatSuggestions')) document.getElementById('chatSuggestions').innerHTML = '';

    // 显示加载中
    isSending = true;
    const loadingId = 'loading-' + Date.now();
    const loadingHtml = '<div class="chat-msg chat-ai" id="' + loadingId + '">' +
      '<div class="chat-bubble ai-bubble typing"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
    chatMsgs.insertAdjacentHTML('beforeend', loadingHtml);
    scrollToBottom();

    try {
      const reply = await callAI(text, cfg);
      // 移除 loading
      const ld = document.getElementById(loadingId);
      if (ld) ld.remove();

      history.push({ role: 'assistant', content: reply, at: Date.now() });
      saveHistory();
      renderMessages();
    } catch (err) {
      const ld = document.getElementById(loadingId);
      if (ld) ld.remove();
      const errMsg = err.message || '连接失败';
      history.push({ role: 'assistant', content: '😅 哎呀，我暂时无法回答：' + errMsg + '\n请检查网络或请家长确认 AI 设置～', at: Date.now() });
      saveHistory();
      renderMessages();
    } finally {
      isSending = false;
    }
  }

  /* ---- 调用 AI API（支持直连 / Supabase 中转两种模式） ---- */
  async function callAI(userText, cfg) {
    const messages = [
      { role: 'system', content: (cfg.systemPrompt || DEFAULT_SYSTEM).replace('{AI_NAME}', aiName()) },
      ...history.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
    ];
    // 只发最近 20 条上下文（节省 token）
    const contextMsgs = messages.slice(-21);

    // 中转模式：浏览器只发消息，密钥在服务端 Edge Function
    if ((cfg.mode || 'direct') === 'proxy') {
      const res = await fetch(cfg.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: contextMsgs })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error('中转函数返回 ' + res.status + (errText ? ': ' + errText.slice(0, 100) : ''));
      }
      const j = await res.json();
      if (!j || !j.text) throw new Error('AI 返回了空回复');
      return j.text.trim();
    }

    // 直连模式：浏览器持有 Key（仅适合本地/受信环境）
    const body = {
      model: cfg.model || 'deepseek-chat',
      messages: contextMsgs,
      temperature: 0.7,
      max_tokens: 600
    };

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API 返回 ' + res.status + (errText ? ': ' + errText.slice(0, 100) : ''));
    }

    const data = await res.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg || !msg.content) throw new Error('AI 返回了空回复');
    return msg.content.trim();
  }

  /* ---- 刷新宝可梦头像（进化/切换时调用） ---- */
  function refresh() {
    if (!bodyEl) return;
    const active = PW.store.state.pet.active;
    if (!active) { bodyEl.innerHTML = ''; return; }
    bodyEl.innerHTML = PW.pokemon.render(active, []);
  }

  function refreshAvatar() {
    const av = document.getElementById('chatAvatar');
    if (!av) return;
    const active = PW.store.state.pet.active;
    if (active) av.innerHTML = PW.pokemon.render(active, []);
    else av.innerHTML = '🤖';
    const nm = document.getElementById('aiName');
    if (nm) nm.textContent = aiName();
    /* 同步更新欢迎消息中的名字（如果当前显示的是空状态欢迎语） */
    const msgs = document.getElementById('chatMessages');
    if (msgs && history.length === 0) {
      msgs.innerHTML = '<div class="chat-welcome">' +
        '<b>你好呀！我是' + aiName() + '</b>' +
        '<p class="small muted" style="margin:6px 0 0">问我任何关于学习、百科、故事的问题吧～</p></div>';
    }
  }

  /** 进入工作台时的欢迎（不再自动弹气泡，改为静默就绪） */
  function greet() {
    // 可选：首次使用时自动打开聊天面板并显示欢迎语
    // const name = PW.store.state.profile.name || '小训练家';
    // setTimeout(() => { if (!isOpen) toggle(); }, 1200);
  }

  /* ---- 鼓励语池（任务完成时随机选取） ---- */
  const ENCOURAGEMENTS = [
    '太棒了！又完成一项，你离今天的全部目标更近一步啦～',
    '厉害！坚持就是胜利，继续加油哦！',
    '做得好！每完成一项作业，就像打败了一只小怪兽！',
    '哇，你今天的学习效率真高！为你点赞！👍',
    '不错不错！保持这个节奏，很快就能全部搞定啦～',
    '加油加油！你是最棒的小训练家！',
    '又消灭一项！你的努力我都看在眼里呢～',
    '好样的！认真完成每一项，收获会越来越大！',
    '太强了！这种学习态度值得表扬！✨',
    '继续冲！今天的你比昨天更优秀！'
  ];

  /** 外部调用：显示鼓励气泡（不打开聊天面板，仅弹出气泡） */
  function encourage() {
    if (!floatEl) return;
    // 移除旧气泡
    const old = floatEl.querySelector('.encourage-bubble');
    if (old) old.remove();
    const text = U.pick(ENCOURAGEMENTS);
    const el = document.createElement('div');
    el.className = 'encourage-bubble';
    el.innerHTML = '<div class="eb-arrow"></div><div class="eb-text">' + U.esc(text) + '</div>';
    floatEl.appendChild(el);
    // 动画结束后自动移除
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3500);
  }

  /** 外部调用：让 AI 说一句话（如其他模块触发） */
  function say(text) {
    if (!chatEl) buildChatUI();
    if (!isOpen) toggle();
    history.push({ role: 'assistant', content: text, at: Date.now() });
    saveHistory();
    renderMessages();
  }

  return { init, refresh, say, encourage, openChat, hide: function(){if(isOpen)toggle();}, greet, refreshAvatar };
})();
