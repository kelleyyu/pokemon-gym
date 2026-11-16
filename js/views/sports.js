/* =========================================================
   PW · 运动锻炼（类型 + 时长，每日不限次数，奖励递减）
   第1次 30金币+5星 / 第2次 20金币+3星 / 第3次 10金币+2星 / 之后无奖励
   ========================================================= */
PW.viewSports = (function () {
  const U = PW.util;
  const PAGE = 10;
  let sPage = 1;
  /* 未提交的表单草稿（类型/时长/备注）。
     后台同步每 5 秒会 forceRender 重建整个 DOM，若不保留草稿，
     用户选好的运动类型会被重置回第一个选项（跳绳），输入的备注也会被清空。 */
  let draft = null;
  const TYPES = [
    { key: 'rope', name: '跳绳', icon: '🤾' },
    { key: 'run', name: '跑步', icon: '🏃' },
    { key: 'bike', name: '骑车', icon: '🚴' },
    { key: 'ball', name: '球类', icon: '🏀' },
    { key: 'swim', name: '游泳', icon: '🏊' },
    { key: 'other', name: '其他', icon: '✨' }
  ];
  const MAP = {}; TYPES.forEach((t) => (MAP[t.key] = t));

  function render() {
    const st = PW.store.state;
    const todaySports = st.sports.filter((r) => r.date === U.todayStr());
    const cnt = todaySports.length;
    const tier = PW.store.nextTier('sports');
    const days = new Set(st.sports.map((r) => r.date));
    const streak = U.streak(days);
    const minutes = st.sports.reduce((s, r) => s + (Number(r.minutes) || 0), 0);

    const tierHint = tier
      ? '本次将获得 <b style="color:#e08600">+' + tier.coins + ' 金币</b> · <b style="color:#3757a8">+' + tier.stars + ' 星星</b>（第 ' + (cnt + 1) + ' 次）'
      : '今日 3 次奖励已拿满，再记录也不会有奖励啦（仍可记录）';

    const todayList = todaySports.length
      ? '<div class="card" style="margin-top:14px;border-color:#dcefe4;background:linear-gradient(180deg,#f4fcf8,#fff)">' +
        '<div class="card-h"><h3>🏃 今天已打卡 ' + cnt + ' 次</h3>' +
        '<span class="sub">获得 ' + todaySports.reduce((s, r) => s + (r._c || 0), 0) + ' 金币</span></div>' +
        todaySports.map((r) => { const tp = MAP[r.type] || MAP.other; return '<div class="log-row">' +
          '<div class="log-ico">' + tp.icon + '</div>' +
          '<div class="log-main"><b>' + tp.name + '</b>' +
          '<span class="small muted">' + (r.minutes || 0) + ' 分钟' +
          (r.note ? ' · ' + U.esc(r.note.slice(0, 20)) : '') + '</span></div>' +
          '<button class="mini-btn" data-edits="' + r.id + '" title="修改">✏️</button>' +
          '<button class="mini-btn" data-dels="' + r.id + '" title="删除">🗑️</button></div>'; }).join('') + '</div>'
      : '';

    const typeOpts = TYPES.map((t) =>
      '<option value="' + t.key + '"' + (draft && draft.type === t.key ? ' selected' : '') + '>' + t.icon + ' ' + t.name + '</option>').join('');
    const body = '<div class="card">' +
      '<div class="card-h"><h3>✏️ 记录今天的运动</h3>' +
      '<span class="sub">完成后领取奖励 🎁</span></div>' +
      '<div class="field"><label>运动类型</label><select class="input" id="spType">' + typeOpts + '</select></div>' +
      '<div class="field"><label>时长（分钟）</label>' +
      '<input class="input" id="spMin" type="number" min="20" max="300" value="' + (draft ? (draft.minutes || 20) : 20) + '"></div>' +
      '<div class="field"><label>备注 <span class="muted small">（选填，比如跳了多少个）</span></label>' +
      '<input class="input" id="spNote" placeholder="例如：跳绳 300 个 / 跑了 2 圈" value="' + (draft ? U.esc(draft.note || '') : '') + '"></div>' +
      '<button class="btn btn-green btn-lg btn-block" id="spSubmit">打卡，领取奖励 🎁</button>' +
      '<p class="tier-hint" style="margin-top:8px;font-weight:700;color:#2a75bb">' + tierHint + '</p>' +
      '</div>' + todayList;

    const statCards =
      '<div style="display:flex;gap:10px;margin-top:16px">' +
      statCard('📅', streak + ' 天', '连续运动') +
      statCard('🏃', days.size + ' 天', '累计打卡') +
      statCard('⏱️', minutes + ' 分钟', '累计时长') +
      '</div>';

    const all = st.sports.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    if (sPage > pages) sPage = pages;
    const start = (sPage - 1) * PAGE;
    const pageItems = all.slice(start, start + PAGE);
    const pager = total > PAGE
      ? '<div class="row" style="justify-content:center;gap:10px;margin-top:12px">' +
        '<button class="btn btn-ghost btn-sm" id="spPrev"' + (sPage <= 1 ? ' disabled' : '') + '>◀ 上一页</button>' +
        '<span class="small muted" style="align-self:center">第 ' + sPage + ' / ' + pages + ' 页</span>' +
        '<button class="btn btn-ghost btn-sm" id="spNext"' + (sPage >= pages ? ' disabled' : '') + '>下一页 ▶</button>' +
        '</div>'
      : '';
    const history = total
      ? '<div class="card" style="margin-top:16px"><div class="card-h"><h3>📜 运动记录</h3>' +
        '<span class="spacer"></span>' +
        '<span class="sub">' + total + ' 条</span></div>' +
        pageItems.map((r) => {
          const tp = MAP[r.type] || MAP.other;
          return '<div class="log-row">' +
            '<div class="log-ico">' + tp.icon + '</div>' +
            '<div class="log-main"><b>' + tp.name + '</b>' +
            '<span class="small muted">' + r.date + ' · ' + (r.minutes || 0) + ' 分钟' +
            (r.note ? ' · ' + U.esc(r.note.slice(0, 22)) : '') + '</span></div>' +
            (r.date === U.todayStr() ? '<span class="tag tag-school">今天</span>' : '') +
            '<button class="mini-btn" data-edits="' + r.id + '" title="修改">✏️</button>' +
            '<button class="mini-btn" data-dels="' + r.id + '" title="删除">🗑️</button></div>';
        }).join('') + pager + '</div>'
      : '<div class="empty" style="margin-top:16px"><span class="e-ico">🏃</span>还没有运动记录，动起来更健康！</div>';

    return body + statCards + history;
  }

  function statCard(ico, v, k) {
    return '<div class="stat" style="flex:1">' + ico + ' <b>' + v + '</b><span>' + k + '</span></div>';
  }

  function mount(root) {
    const typeSel = U.$('#spType', root);
    const minInp = U.$('#spMin', root);
    const noteInp = U.$('#spNote', root);
    /* 任何改动都写进草稿，重渲染后 render() 会按草稿还原（类型不被打回跳绳） */
    const syncDraft = () => {
      const prevFocus = draft && draft.focusNote;
      draft = {
        type: typeSel ? typeSel.value : 'rope',
        minutes: minInp ? minInp.value : '20',
        note: noteInp ? noteInp.value : '',
        focusNote: prevFocus   /* 重渲染后要把光标还回备注框，别打断打字 */
      };
    };
    if (typeSel) typeSel.onchange = syncDraft;
    if (minInp) minInp.oninput = syncDraft;
    if (noteInp) noteInp.oninput = syncDraft;
    if (noteInp) {
      noteInp.onfocus = () => { syncDraft(); draft.focusNote = true; };
      noteInp.onblur = () => { if (draft) draft.focusNote = false; };
    }
    /* 重渲染后恢复备注框焦点与光标（放在末尾） */
    if (draft && draft.focusNote && noteInp) {
      try {
        noteInp.focus();
        const n = (noteInp.value || '').length;
        if (noteInp.setSelectionRange) noteInp.setSelectionRange(n, n);
      } catch (e) {}
    }
    const btn = U.$('#spSubmit', root);
    if (btn) btn.onclick = () => {
      const minutes = Math.max(20, Math.min(300, parseInt((U.$('#spMin', root) || {}).value, 10) || 20));
      if (minutes < 20) { U.toast('运动时长至少需要 20 分钟哦～', 'warn'); return; }
      /* 类型直接从 DOM 读取，不用闭包里缓存的旧值，
         避免选中「球类🏀」后因重渲染/闭包失效而被记成跳绳 */
      const type = (U.$('#spType', root) || {}).value || 'rope';
      const note = ((U.$('#spNote', root) || {}).value || '').trim();
      const res = PW.store.addSports({ type, minutes, note }, btn);
      if (!res.ok) { U.toast(res.msg, 'warn'); return; }
      draft = null;   /* 提交成功，清空草稿，下一条从默认值开始 */
      if (res.capped) {
        U.toast('已记录！今日 3 次奖励已拿满，本次无奖励', 'good');
      } else {
        U.confetti(36);
        U.toast('+' + res.coins + ' 金币 +' + res.stars + ' 星星，运动棒棒！', 'good');

      }
      PW.app.rerender();
    };
    U.$$('[data-dels]', root).forEach((b) => {
      b.onclick = () => {
        U.confirmBox('删除这条运动记录？', '将移入回收站，可在「管理配置 → 回收站」恢复。', '删除', () => {
          const id = b.dataset.dels;
          PW.store.removeSports(id);
          U.toast('已删除，可在回收站恢复', 'good'); PW.app.rerender();
        }, 'btn-red');
      };
    });
    // 分页
    const pv = U.$('#spPrev', root); if (pv) pv.onclick = () => { if (sPage > 1) { sPage--; PW.app.rerender(); } };
    const nx = U.$('#spNext', root); if (nx) nx.onclick = () => { sPage++; PW.app.rerender(); };
    // 修改运动记录
    U.$$('[data-edits]', root).forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.edits;
        const rec = PW.store.state.sports.find((x) => x.id === id);
        if (!rec) return;
        const typeOpts = TYPES.map((t) =>
          '<option value="' + t.key + '"' + (t.key === (rec.type || 'rope') ? ' selected' : '') + '>' + t.icon + ' ' + t.name + '</option>').join('');
        U.modal({
          title: '✏️ 修改运动记录',
          body: '<div class="field"><label>运动类型</label><select class="input" id="editSpType">' + typeOpts + '</select></div>' +
            '<div class="field"><label>时长（分钟）</label><input class="input" id="editSpMin" type="number" min="20" max="300" value="' + (rec.minutes || 20) + '"></div>' +
            '<div class="field"><label>备注</label><input class="input" id="editSpNote" placeholder="选填" value="' + U.esc(rec.note || '') + '"></div>',
          ops: [
            { text: '取消', cls: 'btn-ghost' },
            { text: '保存修改', cls: 'btn-primary', onClick: (c, card) => {
              const etype = (U.$('#editSpType', card) || {}).value || rec.type || 'rope';
              const emin = Math.max(20, Math.min(300, parseInt(U.$('#editSpMin', card).value, 10) || 20));
              const enote = U.$('#editSpNote', card).value.trim();
              rec.type = etype; rec.minutes = emin; rec.note = enote;
              PW.store.save(); c(); PW.app.rerender(); U.toast('✅ 运动记录已修改', 'good');
            }}
          ]
        });
      };
    });
  }

  return { title: '运动锻炼', sub: '动一动，身体棒棒，学习也更有力气', render, mount };
})();
