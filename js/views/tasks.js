/* =========================================================
   PW · 今日任务（截图/拍照识别 → 自动分类 → 打勾结算）
   ========================================================= */
PW.viewTasks = (function () {
  const U = PW.util;
  let filterSubject = 'all';
  let filterTag = 'all';
  let filterState = 'all';
  let viewDate = null; // null = 今天
  let rangeStart = ''; // 统计区间起始(YYYY-MM-DD)
  let rangeEnd = '';   // 统计区间结束

  const FEELINGS = ['很轻松 😄', '正常 🙂', '有点难 😅', '需要帮助 🙋', '还没弄懂 🤔'];

  function hourOptions(init) {
    const h = parseInt((init || '').split(':')[0], 10) || new Date().getHours();
    let s = '';
    for (let i = 0; i < 24; i++) {
      const v = i < 10 ? '0' + i : '' + i;
      s += '<option value="' + v + '"' + (i === h ? ' selected' : '') + '>' + v + ' 时</option>';
    }
    return s;
  }
  function minuteOptions(init) {
    const m = parseInt((init || '').split(':')[1], 10) || new Date().getMinutes();
    let s = '';
    for (let i = 0; i < 60; i++) {
      const v = i < 10 ? '0' + i : '' + i;
      s += '<option value="' + v + '"' + (i === m ? ' selected' : '') + '>' + v + ' 分</option>';
    }
    return s;
  }

  function recurringDefOf(id) {
    return (PW.store.state.config.customTasks || []).find((c) => c.id === id);
  }

  function isToday() { return !viewDate || viewDate === U.todayStr(); }
  function dateKey() { return viewDate || U.todayStr(); }

  /* ---------------- 渲染 ---------------- */
  function render() {
    const st = PW.store.state;
    const ov = PW.store.todayOverview();
    const list = PW.store.tasksOf(dateKey());
    // 简化科目为 4 类：语文/数学/英语/其他
    const SIMPLE_SUBS = [
      { key: 'chinese', name: '语文', icon: '📖', color: '#ee5b5b' },
      { key: 'math', name: '数学', icon: '➗', color: '#2a75bb' },
      { key: 'english', name: '英语', icon: '🔤', color: '#f2a900' },
      { key: 'other', name: '其他', icon: '📌', color: '#93a1b3' }
    ];
    const subjects = SIMPLE_SUBS;

    // 顶部每日打卡条
    const strip = '<div class="daily-strip">' +
      dcard('d-hw', '📚', '今日作业', ov.homeworkDone + '/' + ov.homeworkTotal + ' 项完成',
        ov.homeworkTotal === 0 ? '待录入' : (ov.homeworkLeft === 0 ? '全部完成' : '进行中'), '#/tasks') +
      dcard('d-read', '📖', '阅读积累', ov.readingDone ? '今天已打卡' : '+30 金币 · 5 星星',
        ov.readingDone ? '已完成' : '待打卡', '#/reading') +
      dcard('d-sport', '🏃', '运动锻炼', ov.sportsDone ? '今天已打卡' : '+30 金币 · 5 星星',
        ov.sportsDone ? '已完成' : '待打卡', '#/sports') +
      dcard('d-quiz', '⚔️', '闯关冒险', '今日还剩 ' + ov.quizLeft + ' 次',
        ov.quizLeft > 0 ? '可挑战' : '已用完', '#/adventure') +
      '</div>';

    // 录入区（纯文字录入，不使用照片识别）
    const inbox = '<div class="card" style="margin-top:16px">' +
      '<div class="card-h"><h3>✏️ 录入今天的作业</h3></div>' +
      '<div class="row" style="margin-top:12px">' +
      '<input class="input" id="quickAdd" placeholder="快速添加一项作业，回车确认…" style="flex:1;min-width:180px">' +
      '<button class="btn btn-primary" id="btnQuickAdd">添加</button>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;justify-content:space-between;align-items:center">' +
      '<span class="small muted">有多条作业？一次粘贴进来处理</span>' +
      '<button class="btn btn-ghost btn-sm" id="btnPasteText">⌨️ 粘贴文字批量录入</button>' +
      '</div>' +
      '<div class="row" style="margin-top:10px;justify-content:space-between;align-items:center">' +
      '<span class="small muted">有每天都做的固定任务？</span>' +
      '<button class="btn btn-ghost btn-sm" id="btnRecurring">🔁 添加重复任务</button>' +
      '</div></div>';

    // 筛选
    const subChips = '<button class="chip' + (filterSubject === 'all' ? ' on' : '') + '" data-sub="all">全部科目</button>' +
      subjects.map((s) => '<button class="chip' + (filterSubject === s.key ? ' on sub-tone' : '') +
        '" style="--tone:' + s.color + '" data-sub="' + s.key + '">' + s.icon + ' ' + s.name + '</button>').join('');
    const tagChips = ['all', 'school', 'home'].map((t) =>
      '<button class="chip' + (filterTag === t ? ' on' : '') + '" data-tag="' + t + '">' +
      (t === 'all' ? '全部来源' : t === 'school' ? '🏫 学校' : '🏠 家庭') + '</button>').join('');
    const stateChips = ['all', 'todo', 'done'].map((t) =>
      '<button class="chip' + (filterState === t ? ' on' : '') + '" data-st="' + t + '">' +
      (t === 'all' ? '全部' : t === 'todo' ? '未完成' : '已完成') + '</button>').join('');

    // 任务列表
    let items = list.slice();
    if (filterSubject !== 'all') items = items.filter((t) => t.subject === filterSubject);
    if (filterTag !== 'all') items = items.filter((t) => t.tag === filterTag);
    if (filterState === 'todo') items = items.filter((t) => !t.done);
    if (filterState === 'done') items = items.filter((t) => t.done);
    items.sort((a, b) => (a.done === b.done ? a.createdAt - b.createdAt : a.done ? 1 : -1));

    const pct = list.length ? Math.round((list.filter((t) => t.done).length / list.length) * 100) : 0;
    const deadline = st.config.homeworkDeadline;

    const listHtml = items.length ? items.map(taskRow).join('') :
      '<div class="empty"><span class="e-ico">🗒️</span>' +
      (list.length ? '这个筛选下没有作业～' : '还没有录入今天的作业，先上传一张截图试试！') + '</div>';

    const dateBar = '<div class="row" style="margin-bottom:12px">' +
      '<button class="btn btn-ghost btn-sm" id="prevDay">◀</button>' +
      '<b style="font-size:14px">' + dateKey() + ' 周' + U.weekdayCN(dateKey()) + (isToday() ? '（今天）' : '') + '</b>' +
      '<button class="btn btn-ghost btn-sm" id="nextDay"' + (isToday() ? ' disabled' : '') + '>▶</button>' +
      (isToday() ? '' : '<button class="btn btn-ghost btn-sm" id="backToday">回到今天</button>') +
      '<span class="spacer"></span>' +
      '<span class="small muted">按时截止：' + deadline + ' 前</span></div>';

    return strip +
      '<div class="card" style="margin-top:16px">' + dateBar +
      '<div class="progress" style="margin-bottom:14px"><i style="width:' + pct + '%"></i></div>' +
      '<div class="chips scroll" id="subFilter" style="margin-bottom:8px">' + subChips + '</div>' +
      '<div class="row" style="margin-bottom:14px"><div class="chips" id="tagFilter">' + tagChips + '</div>' +
      '<span class="spacer"></span><div class="chips" id="stateFilter">' + stateChips + '</div></div>' +
      listHtml + '</div>' +
      (isToday() ? inbox : '') +
      statsDashboard() + '</div>';
  }

  function dcard(cls, ico, title, sub, state, href, accentColor) {
    var style = accentColor ? ' style="--d-accent:' + accentColor + '"' : '';
    return '<button class="d-card ' + cls + '" data-go="' + href + '"' + style + '>' +
      '<span class="d-state">' + state + '</span><span class="d-ico">' + ico + '</span>' +
      '<b>' + title + '</b><span>' + sub + '</span></button>';
  }

  function taskRow(t) {
    // 简化科目映射：只支持4类，其他全部归入"其他"
    const SUB_MAP = { chinese:{icon:'📖',name:'语文',color:'#ee5b5b'}, math:{icon:'➗',name:'数学',color:'#2a75bb'}, english:{icon:'🔤',name:'英语',color:'#f2a900'}, other:{icon:'📌',name:'其他',color:'#93a1b3'} };
    const s = SUB_MAP[t.subject] || SUB_MAP.other;
    const tagHtml = t.tag === 'home'
      ? '<span class="tag tag-home">🏠 家庭</span>'
      : '<span class="tag tag-school">🏫 学校</span>';
    const def = t.customId ? recurringDefOf(t.customId) : null;
    const repeatBadge = def ? '<span class="tag tag-repeat">🔁 ' + U.esc(PW.store.repeatDetail(def)) + '</span>' : '';
    const meta = repeatBadge + '<span class="tag tag-sub" style="background:' + s.color + '">' + s.icon + ' ' + s.name + '</span>' +
      tagHtml +
      (t.done ? '<span class="small muted">✅ ' + U.esc(t.doneAt) + (t.onTime === false ? ' · 超时' : '') + '</span>' : '');
    const note = (t.done && (t.feeling || t.note || t.duration))
      ? '<div class="t-note">' + (t.feeling ? '完成情况：' + U.esc(t.feeling) : '') +
        (t.duration ? ((t.feeling) ? ' · ' : '') + '时长：' + t.duration + ' 分钟' : '') +
        (t.note ? ((t.feeling || t.duration) ? ' · ' : '') + '备注：' + U.esc(t.note) : '') + '</div>' : '';
    return '<div class="task-item' + (t.done ? ' done' : '') + '" data-id="' + t.id + '">' +
      '<button class="tick" data-tick="' + t.id + '">✓</button>' +
      '<div class="t-main"><div class="t-title">' + U.esc(t.title) + '</div>' +
      '<div class="t-meta">' + meta + '</div>' + note + '</div>' +
      '<div class="t-ops">' +
      (t.tag !== 'home' && t.locked
        ? '<span class="mini-btn" title="家长发布，不能修改">🔒</span>'
        : '<button class="mini-btn" data-edit="' + t.id + '" title="编辑">✏️</button>' +
          '<button class="mini-btn" data-del="' + t.id + '" title="删除">🗑️</button>') +
      '</div></div>';
  }

  /* ---------------- 交互 ---------------- */
  function mount(root) {
    U.$$('[data-go]', root).forEach((b) => (b.onclick = () => (location.hash = b.dataset.go)));


    U.$$('#subFilter .chip', root).forEach((c) => (c.onclick = () => { filterSubject = c.dataset.sub; PW.app.rerender(); }));
    U.$$('#tagFilter .chip', root).forEach((c) => (c.onclick = () => { filterTag = c.dataset.tag; PW.app.rerender(); }));
    U.$$('#stateFilter .chip', root).forEach((c) => (c.onclick = () => { filterState = c.dataset.st; PW.app.rerender(); }));

    const rs = U.$('#rangeStart', root);
    if (rs) rs.onchange = () => { rangeStart = rs.value; PW.app.rerender(); };
    const re = U.$('#rangeEnd', root);
    if (re) re.onchange = () => { rangeEnd = re.value; PW.app.rerender(); };
    const ra = U.$('#rangeAll', root);
    if (ra) ra.onclick = () => { rangeStart = ''; rangeEnd = ''; PW.app.rerender(); };

    const prev = U.$('#prevDay', root);
    if (prev) prev.onclick = () => { viewDate = U.dateAdd(dateKey(), -1); PW.app.rerender(); };
    const next = U.$('#nextDay', root);
    if (next) next.onclick = () => { viewDate = U.dateAdd(dateKey(), 1); if (viewDate >= U.todayStr()) viewDate = null; PW.app.rerender(); };
    const back = U.$('#backToday', root);
    if (back) back.onclick = () => { viewDate = null; PW.app.rerender(); };

    // 打勾
    U.$$('[data-tick]', root).forEach((b) => {
      b.onclick = () => {
        const id = b.dataset.tick;
        const t = PW.store.tasksOf(dateKey()).find((x) => x.id === id);
        if (!t) return;
        if (t.done) {
          U.confirmBox('取消这项完成记录？', '取消后不会退回已获得的金币和星星。', '取消完成', () => {
            PW.store.undoTask(id); PW.app.rerender();
          }, 'btn-red');
          return;
        }
        openCompleteModal(t, b);
      };
    });

    U.$$('[data-del]', root).forEach((b) => {
      b.onclick = () => {
        const t = PW.store.tasksOf(dateKey()).find((x) => x.id === b.dataset.del);
        if (!t) return;

        /* 学校/家庭/重复任务均在任务列表删除，但都需要管理密码确认。
           家庭任务不放进家长发布/锁定区域，保留列表删除入口。 */
        const ct = recurringDefOf(t.customId);
        const isRecurring = !!t.customId && ct && ct.repeat !== 'once';

        if (!isRecurring) {
          /* 一次性任务（含一次性自定义任务）：输密码后直接删除，任务实例进回收站。
             若来自“发布自定义任务”，同时把该定义从列表移除，避免还要去设置页再删一次。 */
          U.modal({
            title: '🔒 需要管理密码',
            body: '<p>' + (t.tag === 'home' ? '删除家庭作业' : '删除作业') + '需要输入管理配置密码确认。</p>' +
              '<div class="field"><label>输入密码</label><input class="input" id="delTaskPin" type="password" inputmode="numeric" maxlength="8" placeholder="管理配置密码" style="text-align:center;letter-spacing:4px"></div>',
            ops: [
              { text: '取消', cls: 'btn-ghost' },
              { text: '确认删除', cls: 'btn-red', onClick: (c, card) => {
                const v = U.$('#delTaskPin', card).value;
                if (v !== PW.store.state.config.pin) { U.toast('密码不对哦', 'warn'); return; }
                if (ct) PW.store.removeRecurringDef(t.customId);
                PW.store.removeTask(b.dataset.del, dateKey(), { force: true });
                PW.store.trashRecord('task', t, { date: dateKey() });
                c(); PW.app.rerender(); U.toast('已移入回收站', 'good');
              }}
            ]
          });
          return;
        }

        /* 真正的重复任务：输密码后可选择今天不显示 / 取消整组。家庭重复任务也在这里删，不进家长发布卡片。 */
        U.modal({
          title: '删除重复任务',
          sub: U.esc(t.title),
          body: '<p class="small muted">这是一条重复任务，你想怎么处理？</p>' +
            '<div class="field"><label>管理密码</label><input class="input" id="delTaskPin" type="password" inputmode="numeric" maxlength="8" placeholder="管理配置密码" style="text-align:center;letter-spacing:4px"></div>',
          ops: [
            { text: '今天不显示', cls: 'btn-ghost', onClick: (c, card) => {
              const v = U.$('#delTaskPin', card).value;
              if (v !== PW.store.state.config.pin) { U.toast('密码不对哦', 'warn'); return; }
              PW.store.skipRecurringDay(t.customId, dateKey());
              PW.store.removeTask(b.dataset.del, dateKey(), { force: true });
              c(); PW.app.rerender(); U.toast('今天已隐藏，之后还会照常出现', 'good');
            }},
            { text: '取消整组重复', cls: 'btn-red', onClick: (c, card) => {
              const v = U.$('#delTaskPin', card).value;
              if (v !== PW.store.state.config.pin) { U.toast('密码不对哦', 'warn'); return; }
              PW.store.removeRecurringDef(t.customId);
              PW.store.removeTask(b.dataset.del, dateKey(), { force: true });
              c(); PW.app.rerender(); U.toast('已取消整组重复任务', 'good');
            }}
          ]
        });
      };
    });
    U.$$('[data-edit]', root).forEach((b) => {
      b.onclick = () => {
        const t = PW.store.tasksOf(dateKey()).find((x) => x.id === b.dataset.edit);
        if (!t) return;
        /* 编辑作业一律需要管理密码：
           未完成的改内容/科目/标签，已完成的改完成情况（用时/时间/感受/备注）都需要。 */
        requireManagePassword(() => {
          if (t.done) openCompleteModal(t, null, { edit: true });
          else openEditModal(b.dataset.edit);
        });
      };
    });

    if (!isToday()) return;

    U.$('#btnPasteText', root).onclick = (e) => { e.stopPropagation(); openPasteModal(); };

    const q = U.$('#quickAdd', root);
    const doAdd = () => {
      const v = q.value.trim();
      if (!v) return;
      const parsed = PW.subjects.parseText(v);
      const item = parsed[0] || { title: v, subject: PW.subjects.detectSubject(v), tag: PW.subjects.detectTag(v) };
      PW.store.addTasks([{ title: item.title, subject: item.subject, tag: item.tag, source: 'manual' }]);
      q.value = '';
      U.toast('已添加：' + item.title, 'good');
      PW.app.rerender();
    };
    U.$('#btnQuickAdd', root).onclick = doAdd;
    q.onkeydown = (e) => { if (e.key === 'Enter') doAdd(); };

    const rbtn = U.$('#btnRecurring', root);
    if (rbtn) rbtn.onclick = () => openRecurringModal();
  }

  /* ---------------- 完成弹窗 ---------------- */
  function openCompleteModal(t, anchor, opts) {
    opts = opts || {};
    const isEdit = opts.edit;
    const st = PW.store.state;
    const now = U.nowHM();
    const initDuration = isEdit && t.duration ? t.duration : '';
    const initTime = isEdit && t.doneAt ? t.doneAt : now;
    const initNote = isEdit && t.note ? U.esc(t.note) : '';
    let feeling = (isEdit && t.feeling) ? t.feeling : '';
    const body =
      '<div class="card" style="background:#f8fbff;border-color:#e2ecf9;padding:12px;margin-bottom:14px">' +
      '<b class="small">' + U.esc(t.title) + '</b></div>' +
      '<div class="field"><label>完成用时（分钟）<span class="req">*</span></label>' +
      '<input class="input" type="number" id="cmDuration" min="1" max="600" placeholder="如 20" value="' + initDuration + '" required></div>' +
      '<div class="field"><label>完成时间 <span class="req">*</span></label>' +
      '<div class="row" style="gap:8px;align-items:center">' +
      '<select class="input" id="cmHour" style="flex:1;font-size:16px;padding:10px">' + hourOptions(initTime) + '</select>' +
      '<span style="font-weight:800;font-size:18px">:</span>' +
      '<select class="input" id="cmMinute" style="flex:1;font-size:16px;padding:10px">' + minuteOptions(initTime) + '</select>' +
      '</div></div>' +
      '<div class="field"><label>完成情况 <span class="muted small">（选填）</span></label>' +
      '<div class="chips" id="cmFeel">' +
      FEELINGS.map((f) => '<button class="chip' + (f === feeling ? ' on' : '') + '" data-f="' + f + '">' + f + '</button>').join('') +
      '</div></div>' +
      '<div class="field"><label>备注 <span class="muted small">（选填，比如错了几道、哪里不懂）</span></label>' +
      '<textarea class="input" id="cmNote" placeholder="例如：口算错了 2 题，第 3 大题不太懂">' + initNote + '</textarea></div>' +
      (isEdit ? '' : '<p class="hint">✅ 确认后可获得 ' + st.config.rewards.homework.coins + ' 金币 + ' +
      st.config.rewards.homework.stars + ' 星星；' + st.config.homeworkDeadline + ' 前完成算"按时"，能攒守时徽章哦！</p>');

    U.modal({
      title: isEdit ? '✏️ 编辑完成情况' : '🎉 完成一项作业',
      sub: isEdit ? '修改这条作业的用时、时间和感受' : '记录一下完成情况，方便和爸爸妈妈复盘',
      body,
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        {
          text: isEdit ? '保存' : '确认完成', cls: isEdit ? 'btn-primary' : 'btn-green', onClick: (close, card) => {
            const duration = parseInt(U.$('#cmDuration', card).value, 10);
            if (!duration || duration < 1) { U.toast('完成用时（分钟）是必填的哦', 'warn'); return; }
            const hour = U.$('#cmHour', card).value;
            const minute = U.$('#cmMinute', card).value;
            const time = hour + ':' + minute;
            const note = U.$('#cmNote', card).value.trim();
            close();
            if (isEdit) {
              PW.store.updateTaskCompletion(t.id, { doneAt: time, duration, feeling, note }, dateKey());
              PW.app.rerender();
              U.toast('已保存', 'good');
            } else {
              const done = PW.store.completeTask(t.id, { doneAt: time, duration, feeling, note }, anchor, dateKey());
              PW.app.rerender();
              if (done) {
                const list = PW.store.tasksOf(dateKey());
                const allDone = list.length && list.every((x) => x.done);
                /* 实际发放的是「金币 + 星星」，提示语需一并体现（星星为 0 时不显示） */
                const rw = PW.store.state.config.rewards.homework;
                const gain = '+' + rw.coins + ' 金币' + (rw.stars ? ' +' + rw.stars + ' 星星' : '');
                if (allDone) {
                  U.confetti(60);
                  const onTime = list.every((x) => x.onTime !== false);
                  U.toast((onTime ? '全部作业按时完成！太棒啦！' : '全部作业完成！明天试试更早一点～') + ' ' + gain, 'good', 3000);
                } else {
                  U.toast(gain + '，继续加油！', 'good');
                }
                PW.petwidget && PW.petwidget.encourage();

              }
            }
          }
        }
      ],
      onMount: (card) => {
        U.$$('#cmFeel .chip', card).forEach((c) => {
          c.onclick = () => {
            U.$$('#cmFeel .chip', card).forEach((x) => x.classList.remove('on'));
            if (feeling === c.dataset.f) { feeling = ''; return; }
            c.classList.add('on'); feeling = c.dataset.f;
          };
        });
      }
    });
  }

  /* ---------------- 编辑弹窗 ---------------- */
  /* 管理密码校验：修改作业前统一调用（未完成改内容 / 已完成改完成情况都要） */
  function requireManagePassword(cb) {
    U.modal({
      title: '🔒 需要管理密码',
      body: '<p>修改作业需要输入管理配置密码确认。</p>' +
        '<div class="field"><label>输入密码</label><input class="input" id="editTaskPin" type="password" inputmode="numeric" maxlength="8" placeholder="管理配置密码" style="text-align:center;letter-spacing:4px"></div>',
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        { text: '确认', cls: 'btn-primary', onClick: (c, card) => {
          const v = U.$('#editTaskPin', card).value;
          if (v !== PW.store.state.config.pin) { U.toast('密码不对哦', 'warn'); return; }
          c(); cb();
        }}
      ]
    });
  }
  function openEditModal(id) {
    const t = PW.store.tasksOf(dateKey()).find((x) => x.id === id);
    if (!t) return;
    openEditForm(id, t);
  }
  function openEditForm(id, t) {
    const EDIT_SUBS = [
      { key: 'chinese', name: '📖 语文' }, { key: 'math', name: '➗ 数学' },
      { key: 'english', name: '🔤 英语' }, { key: 'other', name: '📌 其他' }
    ];
    const subs = EDIT_SUBS;
    U.modal({
      title: '编辑作业',
      body: '<div class="field"><label>内容</label><input class="input" id="edTitle" value="' + U.esc(t.title) + '"></div>' +
        '<div class="row"><div class="field" style="flex:1"><label>科目</label><select class="input" id="edSub">' +
        subs.map((s) => '<option value="' + s.key + '"' + (s.key === t.subject ? ' selected' : '') + '>' + s.name + '</option>').join('') +
        '</select></div><div class="field" style="flex:1"><label>标签</label><select class="input" id="edTag">' +
        '<option value="school"' + (t.tag === 'school' ? ' selected' : '') + '>🏫 学校</option>' +
        '<option value="home"' + (t.tag === 'home' ? ' selected' : '') + '>🏠 家庭</option></select></div></div>',
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        {
          text: '保存', cls: 'btn-primary', onClick: (close, card) => {
            PW.store.updateTask(id, {
              title: U.$('#edTitle', card).value.trim() || t.title,
              subject: U.$('#edSub', card).value,
              tag: U.$('#edTag', card).value
            }, dateKey());
            close(); PW.app.rerender(); U.toast('已保存', 'good');
          }
        }
      ]
    });
  }

  /* ---------------- 重复任务弹窗 ---------------- */
  function openRecurringModal() {
    const WD_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const todayWd = new Date().getDay();
    const today = new Date();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth() + 1;
    const REPS = [
      { v: 'once', n: '一次性' },
      { v: 'daily', n: '每天' },
      { v: 'weekdays', n: '上学日（周一至周五）' },
      { v: 'weekend', n: '周末' },
      { v: 'week', n: '每周（自选周几）' },
      { v: 'month', n: '每月（自选几号）' },
      { v: 'quarter', n: '每季度（1/4/7/10 月）' },
      { v: 'year', n: '每年（自选月日）' }
    ];
    const SUBS = [
      { key: 'chinese', name: '📖 语文' }, { key: 'math', name: '➗ 数学' },
      { key: 'english', name: '🔤 英语' }, { key: 'other', name: '📌 其他' }
    ];
    const weekChips = WD_NAMES.map((n, i) =>
      '<label class="chip" style="cursor:pointer"><input type="checkbox" data-wd="' + i + '"' + (i === todayWd ? ' checked' : '') + '> ' + n + '</label>').join('');
    const monthOpts = Array.from({ length: 12 }, (_, i) =>
      '<option value="' + (i + 1) + '"' + (i + 1 === todayMonth ? ' selected' : '') + '>' + (i + 1) + ' 月</option>').join('');

    const body =
      '<div class="field"><label>任务内容</label><input class="input" id="rcTitle" placeholder="例如：口算打卡 / 练琴 20 分钟" maxlength="120"></div>' +
      '<div class="row">' +
      '<div class="field" style="flex:1"><label>科目</label><select class="input" id="rcSub">' +
      SUBS.map((s) => '<option value="' + s.key + '">' + s.name + '</option>').join('') + '</select></div>' +
      '<div class="field" style="flex:1"><label>来源</label><select class="input" id="rcTag">' +
      '<option value="school">🏫 学校</option><option value="home">🏠 家庭</option></select></div>' +
      '</div>' +
      '<div class="field"><label>重复方式</label><select class="input" id="rcRep">' +
      REPS.map((r) => '<option value="' + r.v + '">' + r.n + '</option>').join('') + '</select></div>' +
      '<div class="field" style="display:none" id="rcWeekWrap"><label>选择星期几（可多选）</label>' +
      '<div class="chips" id="rcWeekChips" style="flex-wrap:wrap">' + weekChips + '</div></div>' +
      '<div class="field" style="display:none" id="rcMonthWrap"><label>每月几号</label>' +
      '<input class="input" id="rcMonthDay" type="number" min="1" max="31" value="' + todayDate + '"></div>' +
      '<div class="field" style="display:none" id="rcQuarterWrap"><label>每季度首月（1/4/7/10 月）几号</label>' +
      '<input class="input" id="rcQDay" type="number" min="1" max="31" value="1"></div>' +
      '<div class="field" style="display:none" id="rcYearWrap"><label>每年几月几号</label>' +
      '<div class="row"><select class="input" id="rcYearMonth">' + monthOpts + '</select>' +
      '<input class="input" id="rcYearDay" type="number" min="1" max="31" value="' + todayDate + '" style="max-width:120px"></div></div>' +
      '<p class="hint">设置后，任务会在对应日期自动出现在「今日任务」，每天独立打卡。可随时在任务右侧删除（今天不显示 / 取消整组）。</p>';

    U.modal({
      title: '🔁 添加重复任务',
      sub: '以后每天/每周/每月自动出现，不用重复录入',
      body,
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        {
          text: '添加', cls: 'btn-primary', onClick: (close, card) => {
            const rep = U.$('#rcRep', card).value;
            const def = {
              title: U.$('#rcTitle', card).value.trim(),
              subject: U.$('#rcSub', card).value,
              tag: U.$('#rcTag', card).value,
              repeat: rep
            };
            if (rep === 'week') {
              def.days = Array.from(U.$$('[data-wd]', card)).filter((c) => c.checked).map((c) => +c.dataset.wd);
              if (!def.days.length) { U.toast('至少选一个星期几', 'warn'); return; }
            } else if (rep === 'month') {
              def.monthDay = U.$('#rcMonthDay', card).value;
            } else if (rep === 'quarter') {
              def.monthDay = U.$('#rcQDay', card).value;
            } else if (rep === 'year') {
              def.month = U.$('#rcYearMonth', card).value;
              def.monthDay = U.$('#rcYearDay', card).value;
            }
            const n = PW.store.addRecurringTask(def);
            if (!n) { U.toast('请先填内容，或选好重复日', 'warn'); return; }
            close(); PW.app.rerender(); U.toast('已添加，会在对应日期自动出现 🔁', 'good');
          }
        }
      ],
      onMount: (card) => {
        const rep = U.$('#rcRep', card);
        const show = (id, on) => { const el = U.$('#' + id, card); if (el) el.style.display = on ? 'block' : 'none'; };
        const sync = () => {
          show('rcWeekWrap', rep.value === 'week');
          show('rcMonthWrap', rep.value === 'month');
          show('rcQuarterWrap', rep.value === 'quarter');
          show('rcYearWrap', rep.value === 'year');
        };
        rep.onchange = sync; sync();
      }
    });
  }

  /* ---------------- 粘贴文字 ---------------- */
  function openPasteModal(prefill) {
    U.modal({
      title: '粘贴作业文字',
      sub: '把老师发的作业内容粘进来，我会自动拆分并按科目分类',
      body: '<textarea class="input" id="pasteArea" style="min-height:160px" placeholder="例如：&#10;语文：抄写生字2遍，背诵古诗《静夜思》&#10;数学：练习册P23，口算20题&#10;英语：Unit3单词听读10分钟">' + U.esc(prefill || '') + '</textarea>',
      ops: [
        { text: '取消', cls: 'btn-ghost' },
        {
          text: '智能拆分', cls: 'btn-blue', onClick: (close, card) => {
            const txt = U.$('#pasteArea', card).value;
            const items = PW.subjects.parseText(txt);
            if (!items.length) { U.toast('没识别到内容，检查一下文字吧', 'warn'); return; }
            close();
            openReviewModal(items, 'manual');
          }
        }
      ]
    });
  }

  /* ---------------- 识别结果确认（来源：粘贴文字 / 快速添加，均为纯文字） ---------------- */
  function openReviewModal(items, source, raw) {
    const OCR_SUBS = [
      { key: 'chinese', name: '📖 语文' }, { key: 'math', name: '➗ 数学' },
      { key: 'english', name: '🔤 英语' }, { key: 'other', name: '📌 其他' }
    ];
    const subs = OCR_SUBS;
    const rows = items.map((it, i) =>
      '<div class="ocr-line" data-i="' + i + '">' +
      '<input type="checkbox" checked data-ck="' + i + '" style="width:18px;height:18px">' +
      '<input class="input" data-title="' + i + '" value="' + U.esc(it.title) + '" style="flex:1;min-width:90px">' +
      '<select class="input" data-sub="' + i + '">' +
      subs.map((s) => '<option value="' + s.key + '"' + (s.key === it.subject ? ' selected' : '') + '>' + s.name + '</option>').join('') +
      '</select>' +
      '<select class="input" data-tag="' + i + '">' +
      '<option value="school"' + (it.tag === 'school' ? ' selected' : '') + '>🏫学校</option>' +
      '<option value="home"' + (it.tag === 'home' ? ' selected' : '') + '>🏠家庭</option>' +
      '</select></div>').join('');

    U.modal({
      title: '识别到 ' + items.length + ' 项作业',
      sub: '已自动分好科目和标签，检查一下就可以加入今日任务',
      body: '<div style="max-height:46vh;overflow:auto">' + rows + '</div>' +
        (raw ? '<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">查看识别原文</summary>' +
          '<div class="card small" style="margin-top:8px;white-space:pre-wrap;max-height:140px;overflow:auto">' + U.esc(raw) + '</div></details>' : ''),
      ops: [
        { text: '取消', cls: 'btn-ghost', onClick: (close) => { close(); } },
        {
          text: '加入今日任务', cls: 'btn-primary', onClick: (close, card) => {
            const picked = [];
            items.forEach((it, i) => {
              const ck = U.$('[data-ck="' + i + '"]', card);
              if (!ck || !ck.checked) return;
              picked.push({
                title: U.$('[data-title="' + i + '"]', card).value.trim(),
                subject: U.$('[data-sub="' + i + '"]', card).value,
                tag: U.$('[data-tag="' + i + '"]', card).value,
                source
              });
            });
            if (!picked.length) { U.toast('至少勾选一项吧～', 'warn'); return; }
            const n = PW.store.addTasks(picked);
            close();
            PW.app.rerender();
            U.toast('已加入 ' + n + ' 项作业！', 'good');

          }
        }
      ]
    });
  }

  /* ---------------- 统计看板 ---------------- */
  function statsDashboard() {
    const st = PW.store.state;
    // 收集所有日期的任务数据（只认 YYYY-MM-DD 格式的键，过滤掉历史脏数据/非法键）
    const allDates = Object.keys(st.tasks || {})
      .filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); })
      .sort().reverse();
    const today = U.todayStr();

    // 今日统计
    const todayList = PW.store.tasksOf(today);
    const todayTotal = todayList.length;
    const todayDone = todayList.filter(t => t.done).length;
    const todayUndone = todayTotal - todayDone;
    const todayPct = todayTotal ? Math.round((todayDone / todayTotal) * 100) : 0;

    // 累计统计（按筛选日期区间；未筛选时默认排除未来日期，避免未来未完成任务拉低完成率）
    const hasStart = !!rangeStart;
    const hasEnd = !!rangeEnd;
    const inRange = (d) => {
      if (hasStart && d < rangeStart) return false;
      if (hasEnd && d > rangeEnd) return false;
      return true;
    };
    const rangeDates = allDates.filter(function(d) {
      if (!inRange(d)) return false;
      // "全部"（未指定截止日期）时排除未来日期；若用户手动选了截止日期，则尊重其选择
      if (!hasEnd && d > today) return false;
      return true;
    });
    let totalTasks = 0, totalDone = 0, totalOnTime = 0;
    rangeDates.forEach(d => {
      const list = (st.tasks[d] || []);
      list.forEach(t => {
        totalTasks++;
        if (t.done) { totalDone++; if (t.onTime !== false) totalOnTime++; }
        /* 未完成=未按时：不计入按时，避免「完成率<100% 却按时率=100%」的矛盾（与学习报告口径一致） */
      });
    });
    const rangeLabel = (hasStart || hasEnd)
      ? ('区间 ' + (rangeStart || '…') + ' ~ ' + (rangeEnd || '…'))
      : ('全部日期（截至 ' + today + '）');
    const cumPct = totalTasks ? Math.round((totalDone / totalTasks) * 100) : 0;
    const onTimePct = totalTasks ? Math.round((totalOnTime / totalTasks) * 100) : 0;

    // 日期筛选（默认显示最近7天）
    const filterDays = 7;

    return '<div class="card" style="margin-top:16px;border-color:#d6e4f8;background:linear-gradient(180deg,#f5f8ff,#fff)">' +
      '<div class="card-h"><h3>📊 任务完成统计</h3>' +
      '<span class="sub">今日 + 累计数据概览</span></div>' +
      '<div class="row" style="margin:6px 0 4px;align-items:flex-end;gap:8px">'
      + '<div class="field" style="flex:1;margin:0"><label>统计起</label><input class="input" id="rangeStart" type="date" value="' + rangeStart + '" style="padding:6px 8px"></div>'
      + '<div class="field" style="flex:1;margin:0"><label>统计止</label><input class="input" id="rangeEnd" type="date" value="' + rangeEnd + '" style="padding:6px 8px"></div>'
      + '<button class="btn btn-ghost btn-sm" id="rangeAll"' + ((rangeStart || rangeEnd) ? '' : ' disabled') + ' style="white-space:nowrap;align-self:flex-end">全部</button>'
      + '</div>' +

      /* 统计卡片：第1行·今日（4列） */
      '<div class="stats-grid g4" style="margin-bottom:14px">' +
      statCell('📋', todayTotal, '今日总数', '#e3e8f0') +
      statCell('✅', todayDone, '已完成', '#d4edda') +
      statCell('⏳', todayUndone, '未完成', '#fff3cd') +
      statCell('📈', todayPct + '%', '完成率', todayPct >= 100 ? '#d4edda' : (todayPct >= 50 ? '#fff3cd' : '#f8d7da')) +
      '</div>' +
      /* 第2行·累计任务（3列） */
      '<div class="stats-grid g3" style="margin-bottom:14px">' +
      statCell('🏆', totalDone, '累计完成', '#d4edda') +
      statCell('📊', cumPct + '%', '总完成率', cumPct >= 80 ? '#d4edda' : '#fff3cd') +
      statCell('⏰', onTimePct + '%', '按时率', onTimePct >= 80 ? '#d4edda' : '#ffe0b2') +
      '</div>' +
      /* 第3行·阅读/运动/闯关（3列，按日期筛选） */
      (function() {
        /* 按日期区间筛选阅读/运动记录 */
        var rdDays = 0, spDays = 0;
        if (rangeStart || rangeEnd) {
          rdDays = new Set((st.reading||[]).filter(function(r){ return inRange(r.date); }).map(function(r){return r.date;})).size;
          spDays = new Set((st.sports||[]).filter(function(r){ return inRange(r.date); }).map(function(r){return r.date;})).size;
        } else {
          rdDays = new Set((st.reading||[]).map(function(r){return r.date;})).size;
          spDays = new Set((st.sports||[]).map(function(r){return r.date;})).size;
        }
        /* 闯关数据：有日期的按日期筛选，无日期的全量显示 */
        var qRuns = st.quizRuns || [];
        var qTotal = 0, qCorrect = 0;
        var filteredQ = (rangeStart || rangeEnd)
          ? qRuns.filter(function(q){ return !q.date || inRange(q.date); })
          : qRuns;
        filteredQ.forEach(function(q){ qTotal += (q.total||0); qCorrect += (q.correct||0); });
        var qAcc = qTotal ? Math.round(qCorrect / qTotal * 100) : 0;
        return '<div class="stats-grid g3">' +
          statCell('📚', rdDays + ' 天', '累计阅读', '#e8f0fe') +
          statCell('🏃', spDays + ' 天', '累计运动', '#e6f4ea') +
          statCell('⚔️', qAcc + '%', '闯关正确率', qAcc >= 80 ? '#d4edda' : '#fff3cd') +
          '</div>';
      })() +
      '</div>' +
      '</div>';
  }

  function statCell(ico, val, label, bg) {
    return '<div style="background:' + (bg || '#f0f0f0') + ';border-radius:12px;padding:10px;text-align:center">' +
      '<div style="font-size:20px">' + ico + '</div>' +
      '<b style="font-size:18px;display:block;margin:2px 0">' + val + '</b>' +
      '<span class="small muted" style="font-size:11px">' + label + '</span></div>';
  }

  return {
    title: '今日任务',
    sub: '把今天要做的事一项项消灭掉',
    render, mount,
    openPasteModal
  };
})();
