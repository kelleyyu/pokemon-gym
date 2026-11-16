/* =========================================================
   PW · 阅读积累（书名 + 时长 + 感想，每日不限次数，奖励递减）
   第1次 30金币+5星 / 第2次 20金币+3星 / 第3次 10金币+2星 / 之后无奖励
   ========================================================= */
PW.viewReading = (function () {
  const U = PW.util;
  const PAGE = 10;
  let rPage = 1;
  let rSearch = '';

  function rdRow(r) {
    return '<div class="log-row">' +
      '<div class="log-ico">📖</div>' +
      '<div class="log-main"><b>' + U.esc(r.book || '阅读打卡') + '</b>' +
      '<span class="small muted">' + r.date + ' · ' + (r.minutes || 0) + ' 分钟' +
      (r.thoughts ? ' · ' + U.esc(r.thoughts.slice(0, 22)) : '') + '</span></div>' +
      (r.date === U.todayStr() ? '<span class="tag tag-school">今天</span>' : '') +
      '<button class="mini-btn" data-editr="' + r.id + '" title="修改">✏️</button>' +
      '<button class="mini-btn" data-delr="' + r.id + '" title="删除">🗑️</button></div>';
  }

  function rdPager(rPage, pages, total) {
    if (total <= PAGE) return '';
    return '<div class="row" style="justify-content:center;gap:10px;margin-top:12px">' +
      '<button class="btn btn-ghost btn-sm" id="rdPrev"' + (rPage <= 1 ? ' disabled' : '') + '>◀</button>' +
      '<span class="small muted" style="align-self:center">第 ' + rPage + ' / ' + pages + ' 页</span>' +
      '<button class="btn btn-ghost btn-sm" id="rdNext"' + (rPage >= pages ? ' disabled' : '') + '>▶</button>' +
      '</div>';
  }

  /* 计算当前搜索/分页状态下的列表内部 HTML（仅列表区，不含搜索栏） */
  function buildListInner() {
    const st = PW.store.state;
    const all = st.reading.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const kw = rSearch.trim().toLowerCase();
    const filtered = kw
      ? all.filter((r) => (r.book || '').toLowerCase().includes(kw) || (r.thoughts || '').toLowerCase().includes(kw))
      : all;
    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if (rPage > pages) rPage = pages;
    if (rPage < 1) rPage = 1;
    const start = (rPage - 1) * PAGE;
    const pageItems = filtered.slice(start, start + PAGE);
    let html;
    if (!st.reading.length) {
      html = '<div class="empty" style="margin-top:8px"><span class="e-ico">📖</span>还没有阅读记录，今天开始第一笔吧！</div>';
    } else if (!pageItems.length) {
      html = '<div class="empty" style="margin-top:8px"><span class="e-ico">📖</span>没有匹配「' + U.esc(rSearch) + '」的阅读记录</div>';
    } else {
      html = pageItems.map(rdRow).join('') + rdPager(rPage, pages, total);
    }
    return { html, kw, filtered, total, st };
  }

  /* 局部刷新：只替换记录列表区，保留顶部搜索框（不动焦点/输入法/滚动） */
  function updateList(root) {
    const wrap = U.$('#rdListWrap', root);
    if (!wrap) return;
    const li = buildListInner();
    wrap.innerHTML = li.html;
    const cnt = U.$('#rdCount', root);
    if (cnt) cnt.textContent = (li.kw ? (li.filtered.length + '/' + li.st.reading.length) : li.total) + ' 条';
    const clr = U.$('#rdClearS', root);
    if (clr) clr.style.display = li.kw ? '' : 'none';
    // 重新绑定列表区内的按钮
    U.$$('[data-delr]', wrap).forEach(bindDel);
    U.$$('[data-editr]', wrap).forEach(bindEdit);
    const pv = U.$('#rdPrev', wrap); if (pv) pv.onclick = () => { if (rPage > 1) { rPage--; updateList(root); } };
    const nx = U.$('#rdNext', wrap); if (nx) nx.onclick = () => { rPage++; updateList(root); };
  }

  function bindDel(b) {
    b.onclick = () => {
      U.confirmBox('删除这条阅读记录？', '将移入回收站，可在「管理配置 → 回收站」恢复。', '删除', () => {
        const id = b.dataset.delr;
        const i = PW.store.state.reading.findIndex((x) => x.id === id);
        if (i >= 0) { const rec = PW.store.state.reading.splice(i, 1)[0]; PW.store.trashRecord('reading', rec); PW.store.save(); }
        U.toast('已删除，可在回收站恢复', 'good'); PW.app.rerender();
      }, 'btn-red');
    };
  }

  function bindEdit(b) {
    b.onclick = () => {
      const id = b.dataset.editr;
      const rec = PW.store.state.reading.find((x) => x.id === id);
      if (!rec) return;
      U.modal({
        title: '✏️ 修改阅读记录',
        body: '<div class="field"><label>书名 / 内容</label><input class="input" id="editRdBook" value="' + U.esc(rec.book || '') + '"></div>' +
          '<div class="field"><label>时长（分钟）</label><input class="input" id="editRdMin" type="number" min="20" max="300" value="' + (rec.minutes || 20) + '"></div>' +
          '<div class="field"><label>读后感想</label><textarea class="input" id="editRdNote" placeholder="选填">' + U.esc(rec.thoughts || '') + '</textarea></div>',
        ops: [
          { text: '取消', cls: 'btn-ghost' },
          { text: '保存修改', cls: 'btn-primary', onClick: (c, card) => {
            const ebook = U.$('#editRdBook', card).value.trim();
            const emin = Math.max(20, Math.min(300, parseInt(U.$('#editRdMin', card).value, 10) || 20));
            const ethoughts = U.$('#editRdNote', card).value.trim();
            if (!ebook) { U.toast('书名不能为空哦～', 'warn'); return; }
            rec.book = ebook; rec.minutes = emin; rec.thoughts = ethoughts;
            PW.store.save(); c(); PW.app.rerender(); U.toast('✅ 阅读记录已修改', 'good');
          } }
        ]
      });
    };
  }

  function render() {
    const st = PW.store.state;
    const todayReadings = st.reading.filter((r) => r.date === U.todayStr());
    const cnt = todayReadings.length;
    const tier = PW.store.nextTier('reading');
    const days = new Set(st.reading.map((r) => r.date));
    const streak = U.streak(days);
    const minutes = st.reading.reduce((s, r) => s + (Number(r.minutes) || 0), 0);

    const tierHint = tier
      ? '本次将获得 <b style="color:#e08600">+' + tier.coins + ' 金币</b> · <b style="color:#3757a8">+' + tier.stars + ' 星星</b>（第 ' + (cnt + 1) + ' 次）'
      : '今日 3 次奖励已拿满，再记录也不会有奖励啦（仍可记录）';

    const todayList = todayReadings.length
      ? '<div class="card" style="margin-top:14px;border-color:#dcefe4;background:linear-gradient(180deg,#f4fcf8,#fff)">' +
        '<div class="card-h"><h3>📖 今天已打卡 ' + cnt + ' 次</h3>' +
        '<span class="sub">获得 ' + todayReadings.reduce((s, r) => s + (r._c || 0), 0) + ' 金币</span></div>' +
        todayReadings.map((r) => '<div class="log-row">' +
          '<div class="log-ico">📖</div>' +
          '<div class="log-main"><b>' + U.esc(r.book || '阅读打卡') + '</b>' +
          '<span class="small muted">' + (r.minutes || 0) + ' 分钟' +
          (r.thoughts ? ' · ' + U.esc(r.thoughts.slice(0, 20)) : '') + '</span></div>' +
          '<button class="mini-btn" data-editr="' + r.id + '" title="修改">✏️</button>' +
          '<button class="mini-btn" data-delr="' + r.id + '" title="删除">🗑️</button></div>').join('') + '</div>'
      : '';

    const body = '<div class="card">' +
      '<div class="card-h"><h3>✏️ 记录今天的阅读</h3>' +
      '<span class="sub">完成后领取奖励 🎁</span></div>' +
      '<div class="field"><label>书名 / 内容</label>' +
      '<input class="input" id="rdBook" placeholder="例如：《夏洛的网》第 3 章 / 语文课外读本"></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>时长（分钟）</label>' +
      '<input class="input" id="rdMin" type="number" min="20" max="300" value="20"></div>' +
      '</div>' +
      '<div class="field"><label>读后感想 <span class="muted small">（选填）</span></label>' +
      '<textarea class="input" id="rdNote" placeholder="最喜欢哪个人物？学到了什么？一句话就好～"></textarea></div>' +
      '<button class="btn btn-blue btn-lg btn-block" id="rdSubmit">打卡，领取奖励 🎁</button>' +
      '<p class="tier-hint" style="margin-top:8px;font-weight:700;color:#2a75bb">' + tierHint + '</p>' +
      '</div>' + todayList;

    const statCards =
      '<div style="display:flex;gap:10px;margin-top:16px">' +
      statCard('📅', streak + ' 天', '连续阅读') +
      statCard('📚', days.size + ' 天', '累计打卡') +
      statCard('⏱️', minutes + ' 分钟', '累计时长') +
      '</div>';

    const li = buildListInner();
    const countTxt = li.kw ? (li.filtered.length + '/' + st.reading.length) : li.total;
    const history = st.reading.length
      ? '<div class="card" style="margin-top:16px">' +
        '<div class="card-h"><h3>📜 阅读记录</h3>' +
        '<span class="spacer"></span>' +
        '<input class="input search-inp" id="rdSearch" placeholder="🔍 搜索书名/感想" value="' + U.esc(rSearch) + '">' +
        '<button class="btn btn-ghost btn-sm" id="rdClearS" style="flex-shrink:0;' + (rSearch.trim() ? '' : 'display:none') + '">返回全部</button>' +
        '<span class="sub" id="rdCount">' + countTxt + ' 条</span></div>' +
        '<div id="rdListWrap">' + li.html + '</div>' +
        '</div>'
      : '<div class="empty" style="margin-top:16px"><span class="e-ico">📖</span>还没有阅读记录，今天开始第一笔吧！</div>';

    return body + statCards + history;
  }

  function statCard(ico, v, k) {
    return '<div class="stat" style="flex:1">' + ico + ' <b>' + v + '</b><span>' + k + '</span></div>';
  }

  function mount(root) {
    const btn = U.$('#rdSubmit', root);
    if (btn) btn.onclick = () => {
      const book = U.$('#rdBook', root).value.trim();
      const minutes = Math.max(20, Math.min(300, parseInt(U.$('#rdMin', root).value, 10) || 20));
      if (minutes < 20) { U.toast('阅读时长至少需要 20 分钟哦～', 'warn'); return; }
      const note = U.$('#rdNote', root).value.trim();
      if (!book) { U.toast('先填一下今天读了什么书吧～', 'warn'); return; }
      const res = PW.store.addReading({ book, minutes, thoughts: note }, btn);
      if (!res.ok) { U.toast(res.msg, 'warn'); return; }
      if (res.capped) {
        U.toast('已记录！今日 3 次奖励已拿满，本次无奖励', 'good');
      } else {
        U.confetti(36);
        U.toast('+' + res.coins + ' 金币 +' + res.stars + ' 星星，阅读棒棒！', 'good');
      }
      PW.app.rerender();
    };
    // 今天已打卡列表里的修改/删除（这部分不在局部刷新范围内）
    U.$$('[data-delr]', root).forEach(bindDel);
    U.$$('[data-editr]', root).forEach(bindEdit);
    // 搜索：只做局部刷新，保留输入框与滚动位置
    const sb = U.$('#rdSearch', root);
    if (sb) sb.oninput = () => { rSearch = sb.value; rPage = 1; updateList(root); };
    // 返回全部
    const clearBtn = U.$('#rdClearS', root);
    if (clearBtn) clearBtn.onclick = () => {
      rSearch = '';
      if (sb) { sb.value = ''; sb.focus(); }
      updateList(root);
    };
    // 初次挂载后，确保列表区内的分页/修改/删除都绑定好
    updateList(root);
  }

  return { title: '阅读积累', sub: '每天读一点，脑子里的小星星会变多', render, mount };
})();
