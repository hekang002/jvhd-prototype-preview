/* ============================================================
   今晚喝点吗 · 小程序原型（单页应用）
   路由：#/home #/result #/record #/calendar #/map #/game #/me #/settings #/gate
   ============================================================ */
(function () {
  'use strict';
  const C = window.Core;
  const M = window.Mock;
  const { icon, esc, today, addDays, ymdObj, fmtDateFull, fmtDateCN, WEEK, monthKey, rndInt, pick, toast } = C;

  const root = document.getElementById('mini-root');
  const sbTime = document.getElementById('sb-time');
  const pcTitle = document.getElementById('pc-title');
  const pcMenu = document.getElementById('pc-menu');
  const phoneSb = document.querySelector('.phone-sb');

  let db = M.initMini();       // 当前状态（引用）
  let frequent = false;        // ×60 加速
  let warm = true;             // 已进入过首页（用于反馈卡轮换）

  const TITLES = {
    home: '今晚喝点吗', result: '结果', record: '记一杯', calendar: '酒局日历', map: '克制地图',
    game: '酒桌小游戏', me: '我的', settings: '设置', gate: '今晚喝点吗', dm: '日明细',
  };
  const TAB_PATHS = ['home', 'calendar', 'map', 'game'];
  const NAV = [
    { tab: 'home', name: '今晚', path: 'home', icon: 'glass' },
    { tab: 'calendar', name: '酒局日历', path: 'calendar', icon: 'calendar' },
    { tab: 'map', name: '克制地图', path: 'map', icon: 'map' },
    { tab: 'game', name: '小游戏', path: 'game', icon: 'dice' },
    { tab: 'me', name: '我的', path: 'me', icon: 'user' },
  ];

  /* ---------------- 状态辅助 ---------------- */
  function save() { M.saveMini(db); }
  function reload() { db = M.initMini(); }
  const COOL = 10 * 60 * 1000;

  function remainMs() {
    if (!db.cooldown) return 0;
    return Math.max(0, db.cooldown.start + COOL - Date.now());
  }
  function route() { return C.parseHash(); }

  /* ---------------- 渲染入口 ---------------- */
  function render() {
    const r = route();
    const path = r.path || 'home';
    const q = r.query;
    let html = '';
    let noTab = false;
    try {
      if (path === 'gate') { html = pageGate(q); noTab = true; }
      else if (!db.user.ageOk) { html = pageGate({}); noTab = true; }
      else if (path === 'home') html = pageHome();
      else if (path === 'result') { html = pageResult(q); noTab = true; }
      else if (path === 'record') { html = isYouth() ? pageYouthBlocked() : pageRecord(q); noTab = true; }
      else if (path === 'calendar') html = pageCalendar(q);
      else if (path === 'map') html = youthBlocked('map') ? pageYouthBlocked() : pageMap(q);
      else if (path === 'game') html = youthBlocked('game') ? pageYouthBlocked() : pageGame(q);
      else if (path === 'me') html = pageMe();
      else if (path === 'settings') { html = pageSettings(); noTab = true; }
      else html = pageHome();
    } catch (e) {
      window.__miniErr = { msg: e.message, stack: String(e.stack || '').split('\n').slice(0, 6).join(' | ') };
      console.error(e);
      html = `<div class="pg" style="padding:120px 24px;color:#f2e8dc"><h2>页面渲染异常</h2><pre style="font-size:11px;white-space:pre-wrap">${esc(e.message)}</pre><a href="#/home">回到首页</a></div>`;
    }

    root.innerHTML = html + (noTab ? '' : tabbar(path));
    const pg = root.querySelector('.pg');
    // 微信胶囊控件：深色风格页面隐藏胶囊按钮前的自绘（保留右上胶囊）
    pcTitle.textContent = TITLES[path] || '今晚喝点吗';

    if (pg) {
      // 还原滚动位置
      const sk = 'scroll_' + path;
      if (window.__scrollSave && window.__scrollSave[sk]) pg.scrollTop = window.__scrollSave[sk];
    }
    syncTab();
    updateSidebar(path);
    bindPage(path);
    tickHomeCooldown();
  }

  /* 青年模式：不开放酒类内容、地图与游戏，仅保留「不喝」记录与健康提示（合规要求） */
  const YOUTH_BLOCKED = ['map', 'game'];
  function isYouth() { return !!(db.user && db.user.youth); }
  function youthBlocked(path) { return isYouth() && YOUTH_BLOCKED.indexOf(path) >= 0; }

  function tabbar(active) {
    const list = NAV.filter(n => !youthBlocked(n.path));
    return `<nav class="tabbar">${list.map(n => `
      <button class="tab ${n.tab === active ? 'on' : ''}" data-tab="${n.tab}">
        ${icon(n.icon, 23)}<span>${n.name}</span>
      </button>`).join('')}</nav>`;
  }

  function youthNotice() {
    return `<div class="youth-note">${icon('shield', 14)} 青年模式：不开放酒类内容、地图与游戏，仅保留「不喝」记录与健康提示。</div>`;
  }

  function syncTab() { }
  function updateSidebar(path) {
    C.qsa('#stage-nav a').forEach(a => a.classList.toggle('on', a.dataset.path === path));
  }

  /* ============================================================
     青年模式拦截页
     ============================================================ */
  function pageYouthBlocked() {
    return `
    <div class="pg youth-pg">
      <div class="youth-box">
        <div class="yb-ic">${icon('shield', 26)}</div>
        <div class="yb-t">青年模式</div>
        <div class="yb-s">这是一个只做记录、不卖酒的少喝工具。按合规要求，未满 18 周岁不开放酒类内容、地图与游戏，你可以记录「不喝」，也可以查看健康提示。</div>
        <button class="btn-wk solid" style="height:46px;border-radius:14px;width:100%;font-size:14px" data-go="home">回到首页</button>
      </div>
    </div>`;
  }

  /* ============================================================
     首页 · 今晚喝点吗
     ============================================================ */
  function pageHome() {
    const t = today();
    const d = C.dayTotals(db.logs, t);
    const inc = C.incentives(db.logs, db.user);
    const st = C.calcStreak(db.logs, C.addDays(t, -1));
    const ms = remainMs();
    const running = ms > 0;
    const over = d.grams > 60;
    return `
    <div class="home pg" id="home-root">
      <div class="home-top">
        <div>
          <div class="home-greet">${isYouth() ? '青年模式 · ' + (db.user.name || '阿康') : C.greet() + '，' + (db.user.name || '阿康') + ' · 加入第 ' + (db.user.joinDay || 88) + ' 天'}</div>
        </div>
        <button class="home-avatar" data-go="me">康</button>
      </div>
      <div id="home-cooldown">${cooldownBar(ms)}</div>
      <div class="home-hero">
        <div class="ask-date">${fmtDateCN(t)} · 今晚</div>
        ${isYouth() ? youthNotice() : ''}
        <h1 class="ask">今晚喝点<span class="q">吗</span>？</h1>
        <div class="ask-sub">${d.count ? `今天已喝 ${d.std.toFixed(1)} 标准杯（约 ${Math.round(d.grams)} g），还差一步就是明天了。` : '今天还是零克。要不要就到这里？'}</div>

        <div class="stack">
          ${isYouth() ? '' : `<button class="act primary" data-act="drink">
            <div class="act-main">
              <div>
                <div class="act-label">喝</div>
                <div class="act-cost">${over ? `今天已喝 ${d.std.toFixed(1)} 标准杯（约 ${Math.round(d.grams)} g）· 已超当日提示线` : d.count ? `今天已喝 ${d.std.toFixed(1)} 标准杯（约 ${Math.round(d.grams)} g）` : '今天还没开张，第一杯最贵'}</div>
              </div>
              ${icon('glass', 22)}
            </div>
          </button>`}

          <button class="act ghost ${running ? 'disabled' : ''} ${isYouth() ? 'primary-youth' : ''}" data-act="sober" ${running ? 'style="opacity:.45;pointer-events:none"' : ''}>
            <div class="act-main">
              <div>
                <div class="act-label">不喝</div>
                <div class="act-cost">无酒连击 +1 · 当前 ${st.current} 天，省下约 ¥${Math.round(inc.money)} / 月</div>
              </div>
              ${icon('check', 22)}
            </div>
          </button>

          <button class="act later ${running ? 'on' : ''}" data-act="later">
            <div class="act-main">
              <div>
                <div class="act-label" style="font-size:16px">再想想</div>
                <div class="act-cost">十分钟后再问一次 · 不催你，只提醒你</div>
              </div>
              ${icon('clock', 20)}
            </div>
          </button>
        </div>
      </div>

      <div class="home-stats">
        <div class="hs ${over ? 'warn' : ''}">
          <div class="k">今日</div>
          <div class="v">${Math.round(d.grams)}<small>g</small></div>
        </div>
        <div class="hs good">
          <div class="k">无酒连击</div>
          <div class="v">${st.current}<small>天</small></div>
        </div>
        <div class="hs">
          <div class="k">本月省下</div>
          <div class="v">${Math.round(inc.money)}<small>元</small></div>
        </div>
      </div>
    </div>`;
  }

  function cooldownBar(ms) {
    if (ms <= 0) return '';
    const total = COOL;
    const pct = ms / total;
    const r = 16, circ = 2 * Math.PI * r;
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    return `
    <div class="cd-bar" id="cd-bar">
      <div class="cd-ring">
        <svg width="34" height="34" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="3"/>
          <circle cx="20" cy="20" r="16" fill="none" stroke="#d8a054" stroke-width="3" stroke-linecap="round"
            stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - pct)}"/>
        </svg>
        <span id="cd-ring-txt">${Math.max(0, Math.ceil(ms / 60000))}′</span>
      </div>
      <div class="cd-main">
        <div class="cd-t"><b>再想想</b> 已生效 · 还剩 <span id="cd-txt">${mm}:${String(ss).padStart(2, '0')}</span></div>
        <div class="cd-s">到点再问你一次，现在不用决定</div>
      </div>
      <button class="cd-x" data-go="record" title="直接去记录">提前去喝</button>
    </div>`;
  }

  let cdTimer = null;
  function tickHomeCooldown() {
    if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    if (!db.cooldown) return;
    cdTimer = setInterval(() => {
      const ms = remainMs();
      const bar = document.getElementById('cd-bar');
      if (!bar) { clearInterval(cdTimer); cdTimer = null; return; }
      if (ms <= 0) {
        clearInterval(cdTimer); cdTimer = null;
        db.cooldown = null; save();
        // 冷却结束：自动回到询问并高亮
        const barPh = document.getElementById('home-cooldown');
        if (barPh) barPh.innerHTML = '';
        refreshHomeButtons();
        toast('十分钟到了，再问你一次：今晚喝点吗？', { icon: 'clock' });
        const h = document.querySelector('.ask');
        if (h) { h.style.transition = 'color .3s'; h.style.color = 'var(--wk-amber-2)'; setTimeout(() => { h.style.color = ''; }, 1400); }
        return;
      }
      const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
      const txt = document.getElementById('cd-txt');
      const ring = document.getElementById('cd-ring-txt');
      const cir = bar.querySelector('circle:nth-child(2)');
      if (txt) txt.textContent = `${mm}:${String(ss).padStart(2, '0')}`;
      if (ring) ring.textContent = Math.max(0, Math.ceil(ms / 60000)) + '′';
      if (cir) cir.setAttribute('stroke-dashoffset', String(2 * Math.PI * 16 * (1 - ms / COOL)));
    }, 250);
  }
  function refreshHomeButtons() {
    const sober = document.querySelector('[data-act="sober"]');
    if (sober) { sober.style.opacity = ''; sober.style.pointerEvents = ''; }
  }

  /* ============================================================
     结果页（记录后反馈 / 不喝反馈 / 分享）
     ============================================================ */
  function pageResult(q) {
    const t = today();
    const inc = C.incentives(db.logs, db.user);
    const st = C.calcStreak(db.logs, C.addDays(t, -1));
    const isSober = q.type === 'sober';
    const grams = +(q.g || 0);
    const d = C.dayTotals(db.logs, t);
    let body;
    if (isSober) {
      const line = pick(['好的。今晚的酒钱，记在你未来的体检报告里。', '今晚零克。明天你会有两个酒量：一个真酒量，一个自律。', '这杯白开水，敬你没喝的那一杯。']);
      body = `
        ${icon('check', 26)}
        <div class="result-kicker" style="margin-top:26px">今 晚 不 喝</div>
        <div class="result-big">0<small>g</small></div>
        <div class="result-line">${esc(line)}</div>
        <div class="result-detail">无酒连击 <b>${st.current} 天</b> · 本月无酒 <b>${C.monthStats(db.logs, monthKey(t)).soberDays} 天</b><br>本月已省下 <b>¥${Math.round(inc.money)}</b>，约 <b>${inc.milktea.toFixed(1)} 杯奶茶</b></div>
        <div class="result-stats">
          <div><div class="k">连击</div><div class="v">${st.current} 天</div></div>
          <div><div class="k">本月无酒</div><div class="v">${C.monthStats(db.logs, monthKey(t)).soberDays} 天</div></div>
          <div><div class="k">本月无酒日</div><div class="v">${C.monthStats(db.logs, monthKey(t)).soberDays} 天</div></div>
        </div>`;
    } else {
      const pct = Math.round(inc.pct * 100);
      const kind = q.k || 'pct';
      let bigV, unit, kicker, line, kpi;
      if (kind === 'money') {
        bigV = Math.round(inc.money); unit = '元'; kicker = '本 月 省 下';
        line = `省下 ¥${Math.round(inc.money)}，够买 6 串烤串了——但是别配酒。`;
        kpi = ['单杯均价', '¥' + db.user.pricePerDrink];
      } else if (kind === 'kcal') {
        bigV = inc.milktea.toFixed(1); unit = '杯奶茶'; kicker = '本 月 省 下 热 量';
        line = `折合 ${inc.milktea.toFixed(1)} 杯奶茶，人生第一次赢过奶茶。`;
        kpi = ['折算热量', Math.round(inc.kcal) + ' kcal'];
      } else {
        bigV = pct; unit = '%'; kicker = '本 月 少 喝';
        line = `本月你少喝了 ${pct}%，啤酒肚还在震惊中。`;
        kpi = ['基准 / 本月', `${Math.round(inc.base)} / ${Math.round(inc.cur)} g`];
      }
      body = `
        ${icon('glass', 26)}
        <div class="result-kicker" style="margin-top:26px">${kicker}</div>
        <div class="result-big">${bigV}<small>${unit}</small></div>
        <div class="result-line">${esc(line)}</div>
        <div class="result-detail">本次 <b>${grams.toFixed(1)} g</b> · 今日累计 <b>${Math.round(d.grams)} g</b>（${d.std.toFixed(1)} 标准杯）<br>${d.grams > 60 ? '已超过 <b>60 g</b> 单日提示线，日历会以细红边标出这一格。' : '今天还在提示线以内。'}</div>
        <div class="result-stats">
          <div><div class="k">${kpi[0]}</div><div class="v">${kpi[1]}</div></div>
          <div><div class="k">无酒连击</div><div class="v">${st.current} 天</div></div>
          <div><div class="k">本月饮酒次数</div><div class="v">${C.monthStats(db.logs, monthKey(t)).count} 次</div></div>
        </div>`;
    }
    return `
    <div class="pg pg-result">
      <button class="result-close" data-act="close-result">${icon('x', 16)}</button>
      <div class="result-body">
        <div class="result-badge ${isSober ? 'good' : 'wine'}">${isSober ? icon('check', 40) : icon('glass', 40)}</div>
        ${body}
      </div>
      <div class="result-foot">
        <button class="btn-wk solid" data-act="open-calendar">${icon('calendar', 18)} 去日历看今天的酒局</button>
        <div class="share-row">
          <button class="btn-wk grow" data-act="share">${icon('share', 17)} 生成分享图</button>
          <button class="btn-wk grow ghost" data-act="again">${icon('plus', 17)} 再记一杯</button>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     记录页 · 30 秒快速记录
     ============================================================ */
  const recDraft = { cat: 'beer', brandId: '', brand: '', abv: 4.5, size: 500, qty: 1, placeId: 'p6', scene: 'relax', mood: '微醺', time: '', date: '' };
  let draft = null;
  function newDraft(q) {
    draft = C.deepClone(recDraft);
    const last = db.logs.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
    if (last && q.reuse) {
      draft.cat = last.cat; draft.brandId = last.brandId; draft.brand = last.brand; draft.abv = last.abv; draft.size = last.ml;
      draft.placeId = last.placeId; draft.scene = last.scene; draft.mood = last.mood;
    }
    if (q.date) draft.date = q.date;
    if (q.time) draft.time = q.time;
    draft.lastBrand = last ? `${last.brand} · ${last.ml}ml` : '';
  }

  function pageRecord(q) {
    if (!draft) newDraft(q);
    refreshDraftCat();
    const cat = M.CATS.find(c => c.id === draft.cat);
    const scenes = M.SCENES;
    const moods = M.MOODS;
    const d = C.dayTotals(db.logs, today());
    const grams = C.alcoholG(draft.size * draft.qty, draft.abv);
    return `
    <div class="pg pg-record pg-noTab" style="padding-bottom:150px">
      <div class="rec-head">
        <button class="back" data-act="rec-close">${icon('chevronLeft', 18)}</button>
        <div class="rec-title">
          <div class="t">记一杯</div>
          <div class="s">≤ 30 秒，只填 2 项</div>
        </div>
        <span class="chip" style="margin-right:0">今天 ${d.std.toFixed(1)} 杯</span>
      </div>
      ${draft.lastBrand ? `<div style="padding:0 18px"><button class="rec-reuse" data-act="rec-reuse">${icon('loop', 14)} 和上次一样：${esc(draft.lastBrand)}</button></div>` : ''}

      <div class="section" style="margin-top:14px">
        <div class="sec-title"><span>① 酒类</span><span class="dim" style="letter-spacing:0">必填</span></div>
        <div class="cat-grid">
          ${M.CATS.map(c => `<button class="cat ${draft.cat === c.id ? 'on' : ''}" data-cat="${c.id}">${icon(c.icon, 26)}<span>${c.name}</span></button>`).join('')}
          <button class="cat" data-act="rec-cat-other">${icon('plus', 24)}<span>自定义</span></button>
        </div>
      </div>

      <div class="section" style="margin-top:14px">
        <div class="sec-title"><span>② 饮用量</span><span class="dim" style="letter-spacing:0">必填</span></div>
        <div class="field">
          <div class="field-label"><span>数量</span><span>${cat.name} · 默认 ${cat.size} ml / ${cat.unit}</span></div>
          <div class="stepper">
            <button data-qty="-1">${icon('minus', 18)}</button>
            <div class="val"><b id="qty-v">${draft.qty}</b><span>${cat.unit}</span></div>
            <button data-qty="1">${icon('plus', 18)}</button>
          </div>
          <div class="presets">
            ${[0.5, 1, 2, 3, 6].map(n => `<button class="preset ${draft.qty === n ? 'on' : ''}" data-qty-set="${n}">${n % 1 ? '半' + cat.unit : n + ' ' + cat.unit}</button>`).join('')}
          </div>
          <div class="gcalc" style="margin-top:14px">
            <div><span id="g-ml">${draft.size * draft.qty} ml × ${draft.abv}%vol</span><small>酒精克数 = 量 × 酒精度 ÷ 100 × 0.789</small></div>
            <b id="g-val">${grams.toFixed(1)} g</b>
          </div>
        </div>
      </div>

      <div class="section" style="margin-top:14px">
        <div class="sec-title"><span>③ 酒款（选填）</span><button class="dim" style="letter-spacing:0;font-size:11px" data-act="rec-abv">修改酒精度</button></div>
        <div class="brand-line" data-act="rec-brand">
          ${icon(cat.icon, 18)}
          <div class="grow">
            <div id="brand-n">${esc(draft.brand || '选择酒款 · ' + cat.name)}</div>
            <div class="dim" id="brand-m">${draft.abv}%vol · ${draft.size} ml / ${cat.unit}</div>
          </div>
          ${icon('chevronRight', 16)}
        </div>
        <div class="abv-edit hidden" id="abv-edit">
          <input id="abv-input" type="number" min="0" max="96" step="0.1" value="${draft.abv}" placeholder="酒精度 %vol">
          <input id="ml-input" type="number" min="10" max="3000" step="10" value="${draft.size}" placeholder="单份容量 ml">
          <button class="btn-wk" style="height:auto;padding:0 14px;font-size:13px" data-act="rec-abv-ok">确定</button>
        </div>
      </div>

      <div class="section" style="margin-top:14px">
        <div class="sec-title"><span>④ 在哪喝（选填）</span><span class="dim" style="letter-spacing:0;font-size:11px">仅你可见</span></div>
        <div class="tagrow">
          ${db.places.filter(p => p.count > 0).slice(0, 6).map(p => `<button class="tag ${draft.placeId === p.id ? 'on' : ''}" data-place="${p.id}">${icon('pin', 12)} ${esc(p.name)}</button>`).join('')}
          <button class="tag pin ${draft.placeId === '' ? 'on' : ''}" data-place="">不记录地点</button>
        </div>
      </div>

      <div class="section">
        <div class="sec-title"><span>⑤ 场景（选填）</span></div>
        <div class="tagrow">${scenes.map(s => `<button class="tag ${draft.scene === s.id ? 'on' : ''}" data-scene="${s.id}">${s.name}</button>`).join('')}</div>
      </div>
      <div class="section">
        <div class="sec-title"><span>⑥ 心情（选填）</span></div>
        <div class="tagrow">${moods.map(s => `<button class="tag ${draft.mood === s ? 'on' : ''}" data-mood="${s}">${s}</button>`).join('')}</div>
      </div>

      <div class="rec-foot">

        <button class="btn-wk solid" style="width:100%" data-act="rec-submit">记下这一杯 · ${grams.toFixed(1)} g</button>
      </div>
    </div>`;
  }

  function refreshDraftCat() {
    const cat = M.CATS.find(c => c.id === draft.cat);
    if (!draft.brandId) { draft.abv = cat.abv; draft.size = cat.size; }
  }

  function updateGramsUI() {
    const cat = M.CATS.find(c => c.id === draft.cat);
    const g = C.alcoholG(draft.size * draft.qty, draft.abv);
    const el = document.getElementById('g-val');
    const ml = document.getElementById('g-ml');
    if (el) el.textContent = g.toFixed(1) + ' g';
    if (ml) ml.textContent = `${draft.size * draft.qty} ml × ${draft.abv}%vol`;
    const sub = document.querySelector('[data-act="rec-submit"]');
    if (sub) sub.textContent = `记下这一杯 · ${g.toFixed(1)} g`;
  }

  function openSkuSheet(filterCat) {
    const cat = M.CATS.find(c => c.id === filterCat) || M.CATS.find(c => c.id === draft.cat);
    const list = M.BRANDS.filter(b => !filterCat || b.cat === filterCat);
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML = `
      <div class="sheet">
        <div class="sheet-head"><span class="t">酒库 · ${cat.name}</span><button style="color:var(--wk-text-3)" data-close>${icon('x', 18)}</button></div>
        <div class="sheet-search">${icon('search', 16)}<input id="sku-q" placeholder="搜索酒款 / 品牌（2,318 条酒库）" /></div>
        <div class="sheet-list" id="sku-list"></div>
      </div>`;
    root.appendChild(mask);
    const input = mask.querySelector('#sku-q');
    const listEl = mask.querySelector('#sku-list');
    function paint() {
      const kw = input.value.trim();
      const items = list.filter(b => !kw || b.name.includes(kw));
      if (!items.length) {
        listEl.innerHTML = `<div class="sheet-empty">酒库里没有「${esc(kw)}」<br>可自定义录入，仅用于换算，不会进入酒库公开检索。
          <button class="btn-wk" data-custom>${icon('plus', 15)} 自定义酒款</button></div>`;
      } else {
        listEl.innerHTML = items.map(b => `
          <div class="sku" data-sku="${b.id}">
            ${icon(cat.icon, 20)}
            <div class="grow"><div class="n">${esc(b.name)}${b.hot ? '<span class="hot">常用</span>' : ''}</div>
              <div class="m">${b.abv}%vol · ${b.size} ml / ${b.unit}</div></div>
            ${draft.brandId === b.id ? icon('check', 16, 'chk') : ''}
          </div>`).join('');
      }
    }
    input.addEventListener('input', paint);
    paint();
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) { mask.remove(); return; }
      const sku = e.target.closest('[data-sku]');
      if (sku) {
        const b = M.BRANDS.find(x => x.id === sku.dataset.sku);
        draft.brandId = b.id; draft.brand = b.name; draft.abv = b.abv; draft.size = b.size;
        mask.remove();
        render();
        toast('已选择 ' + b.name, { icon: 'check' });
      }
      if (e.target.closest('[data-custom]')) {
        mask.remove();
        C.modal({ title: '自定义酒款', width: 420, body: `
          <div style="display:flex;flex-direction:column;gap:10px;padding:6px 0">
            <input id="cu-name" placeholder="酒款名称，如：自制杨梅酒" style="height:38px;border:1px solid #d3dad7;border-radius:8px;padding:0 12px;font-size:13px;outline:none">
            <div style="display:flex;gap:10px">
              <input id="cu-abv" type="number" value="15" placeholder="酒精度 %vol" style="flex:1;height:38px;border:1px solid #d3dad7;border-radius:8px;padding:0 12px;font-size:13px">
              <input id="cu-size" type="number" value="100" placeholder="单份容量 ml" style="flex:1;height:38px;border:1px solid #d3dad7;border-radius:8px;padding:0 12px;font-size:13px">
            </div>
            <div style="font-size:12px;color:#8c968f">自定义酒款将进入「待审核」池，供后台酒库审核（原型中不改变已审核状态）。</div>
          </div>`, actions: [
          { label: '取消' },
          { label: '确定', cls: 'primary', keepOpen: true, onClick: (m, close) => {
            const name = m.querySelector('#cu-name').value.trim() || '自定义酒款';
            draft.brand = name; draft.brandId = ''; draft.abv = +m.querySelector('#cu-abv').value || 10;
            draft.size = +m.querySelector('#cu-size').value || 100;
            close(); render(); toast('已自定义：' + name, { icon: 'check' });
          } },
        ] });
      }
    });
  }

  /* ============================================================
     酒局日历
     ============================================================ */
  let calMonth = null;
  function pageCalendar(q) {
    const t = today();
    const mk = q.m || calMonth || monthKey(t);
    calMonth = mk;
    const [y, m] = mk.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay();
    const stats = C.monthStats(db.logs, mk);
    // 连击口径：以“昨天”为最近可计入的无酒日（今天尚未结束，不提前计入）
    const st = C.calcStreak(db.logs, C.addDays(t, -1));
    const overLimit = db.user.gender === 'female' ? 40 : 60;
    const selDate = q.d || '';
    const cards = [];
    for (let i = 0; i < firstDow; i++) cards.push('<div class="day empty"></div>');
    for (let dd = 1; dd <= last; dd++) {
      const ds = `${mk}-${String(dd).padStart(2, '0')}`;
      const day = C.dayTotals(db.logs, ds);
      const soberRec = db.soberLogs.find(s => s.date === ds);
      let cls = 'day';
      if (ds > t) cls += ' future';
      if (day.grams > 0) {
        const g = day.grams;
        cls += g <= 10 ? ' l1' : g <= 25 ? ' l2' : g <= 60 ? ' l3' : ' l4';
        if (g > overLimit) cls += ' over';
      }
      if (ds === t) cls += ' today';
      if (ds === selDate) cls += ' sel';
      const gTxt = day.grams > 0 ? `<span class="d-g">${Math.round(day.grams)}</span>` : '';
      const dot = soberRec ? '<span class="d-dot"></span>' : '';
      cards.push(`<button class="${cls}" data-day="${ds}" data-sober="${soberRec ? 1 : 0}">${dd}${gTxt}${dot}</button>`);
    }
    const weeks = ['日', '一', '二', '三', '四', '五', '六'];
    const isCur = mk === monthKey(t);
    const monthLabel = `${y} 年 ${m} 月`;
    const selDay = selDate ? C.dayTotals(db.logs, selDate) : null;
    const selSober = selDate ? db.soberLogs.find(s => s.date === selDate) : null;

    return `
    <div class="pg pg-calendar">
      <div class="cal-head between">
        <div>
          <div class="cal-title">${monthLabel}</div>
          <div class="dim" style="font-size:12px;margin-top:6px">留白是有意的：空格 = 没喝的那一天</div>
        </div>
        <div class="cal-nav">
          <button data-month="-1">${icon('chevronLeft', 16)}</button>
          <button data-month="1" ${isCur ? 'disabled style="opacity:.3"' : ''}>${icon('chevronRight', 16)}</button>
        </div>
      </div>

      <div class="cal-stats">
        <div><div class="k">本月酒精</div><div class="v">${Math.round(stats.grams)}<small>g</small></div></div>
        <div><div class="k">标准杯</div><div class="v">${stats.std.toFixed(0)}<small>杯</small></div></div>
        <div><div class="k">无酒天数</div><div class="v">${stats.soberDays}<small>天</small></div></div>
        <div><div class="k">当前连击</div><div class="v">${st.current}<small>天</small></div></div>
      </div>

      <div class="card cal-wrap">
        <div class="cal-week">${weeks.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="cal-grid">${cards.join('')}</div>
      </div>
      <div class="cal-legend">
        <span><i style="background:rgba(216,160,84,.09)"></i>≤10g</span>
        <span><i style="background:rgba(216,160,84,.2)"></i>10–25g</span>
        <span><i style="background:rgba(196,122,70,.38)"></i>25–60g</span>
        <span><i style="background:rgba(176,64,72,.58)"></i>&gt;60g</span>
        <span><i style="border:1.2px solid rgba(214,90,82,.85);background:none"></i>超量日（细红边）</span>
        <span><i style="background:var(--wk-green);width:3px;height:3px;border-radius:50%"></i>记录过「不喝」</span>
      </div>

      ${q.d ? `
      <div class="day-sheet">
        <div class="dh">
          <div class="t">${fmtDateFull(selDate)}</div>
          <div class="btns">
            <button class="chip" data-act="day-add">${icon('plus', 12)} 补录</button>
            ${selDay.count ? `<button class="chip" data-act="day-edit">${icon('edit', 12)} 修改本日总量</button>` : ''}
          </div>
        </div>
        <div class="card" style="padding:6px 16px">
          ${selDay.count ? selDay.list.map(l => dayRow(l)).join('') : `
            <div class="empty-day"><span class="big">${selSober ? '这一天你选择了不喝。' : '这一天什么都没有发生。'}</span>
              ${selSober ? '空白比什么都值钱，日历里它是最亮的一格。' : '没喝，或者还没记。'}${(selDate === t) ? '' : '<br><button class="btn-wk" style="height:38px;margin-top:14px;font-size:13px" data-act="day-add">补录这一天</button>'}</div>`}
        </div>
        ${selDay.count ? `<div class="dim" style="font-size:11.5px;margin-top:10px;line-height:1.7;padding:0 4px">当日合计 ${Math.round(selDay.grams)} g · ${selDay.std.toFixed(1)} 标准杯${selDay.grams > overLimit ? ' · 超过单日提示线' : ''}</div>` : ''}
      </div>` : `
      <div class="section" style="margin-top:16px">
        <div class="card" style="padding:16px;display:flex;align-items:center;gap:12px;cursor:pointer" data-act="go-today">
          ${icon('target', 22)}
          <div class="grow"><div style="font-size:13.5px">今天 ${fmtDateCN(t)}</div>
            <div class="dim" style="font-size:11.5px;margin-top:3px">${C.dayTotals(db.logs, t).count ? `已记 ${C.dayTotals(db.logs, t).count} 条 · ${Math.round(C.dayTotals(db.logs, t).grams)} g` : '还没有记录'} · 点击查看日明细</div></div>
          ${icon('chevronRight', 16)}
        </div>
      </div>`}
    </div>`;
  }

  function dayRow(l) {
    const cat = M.CATS.find(c => c.id === l.cat) || M.CATS[0];
    const place = db.places.find(p => p.id === l.placeId);
    const scene = M.SCENES.find(s => s.id === l.scene);
    return `<div class="dl">
      <div class="ic-wrap">${icon(cat.icon, 18)}</div>
      <div class="grow">
        <div class="n">${esc(l.brand || cat.name)}</div>
        <div class="m">${l.time} · ${l.ml}ml · ${l.abv}%vol${place ? ' · ' + esc(place.name) : ''}${scene ? ' · ' + scene.name : ''}${l.mood ? ' · ' + l.mood : ''}</div>
      </div>
      <div class="r">${l.grams.toFixed(1)} g<small>${(l.grams / 10).toFixed(1)} 标准杯</small></div>
    </div>`;
  }

  /* ============================================================
     克制地图
     ============================================================ */
  function pinStyle(p) {
    // 次数越多越灰 / 越空心
    const n = p.count;
    const warm = (a) => `rgba(216,160,84,${a})`;
    if (n >= 10) return { bg: 'transparent', label: '老地方', old: true };
    if (n >= 5) return { bg: 'rgba(150,132,116,.75)', label: '老地方', old: false };
    if (n >= 3) return { bg: 'rgba(180,140,92,.85)', label: '', old: false };
    return { bg: warm(0.95), label: '', old: false };
  }
  const QUOTES = {
    2: ['来过 2 次了。', '这里的记录比你想的多。'],
    3: ['来过 3 次了。', '老地方，老朋友，老毛病。'],
    4: ['来过 4 次了。', '这里的记录比你想的多。'],
    5: ['老地方，老朋友，老毛病。', '来过 5 次了。'],
  };
  function quoteFor(p) {
    if (p.count >= 10) return '老地方，老朋友，老毛病。';
    const arr = QUOTES[Math.min(4, Math.max(2, Math.round(p.count / 2) + 1))] || [];
    return arr.length ? arr[p.count % arr.length] : '来过 ' + p.count + ' 次了。';
  }

  const PIN_AREA_H = 560; // 地图可点击区域高度（px），与 .map-sheet 顶部对齐
  function pageMap(q) {
    const sel = q.p ? db.places.find(p => p.id === q.p) : null;
    const sorted = db.places.filter(p => p.count > 0).sort((a, b) => b.count - a.count);
    const maxC = Math.max(1, ...sorted.map(p => p.count));
    const total = sorted.reduce((s, p) => s + p.count, 0);
    // 说明：pin 模板单独拼装，避免与整页模板的内嵌反引号/美元符同时出现导致解析歧义
    // 说明：点位逐个直接挂在 .pg-map 上（不设包裹层）。实测「绝对定位容器 + 多个绝对定位子项」
    // 在大量环境下只会绘制其中两三个子项，去掉包裹层后渲染稳定。
    const pinsHTML = sorted.map(function (p) {
      const sty = pinStyle(p);
      const cls = 'pin' + (sty.old ? ' old' : '') + (sel && sel.id === p.id ? ' sel' : '');
      const lbl = esc(sty.label ? sty.label + ' · ' + p.count + ' 次' : p.count + ' 次');
      return '<div class="' + cls + '" data-pin="' + p.id + '" style="transform:translate(' + Math.round(p.x * 3.35) + 'px,' + (Math.round((400 - 50) * p.y / 100 + 50)) + 'px)">' +
             '<span class="dot" style="background:' + sty.bg + '"></span>' +
             '<span class="lbl">' + lbl + '</span></div>';
    }).join('');
    return `
    <div class="pg pg-map" style="overflow:hidden">
      ${pinsHTML}
      <div class="map-head">
        <div class="map-seg">
          <button class="on">足迹</button>
          <button data-act="map-share">分享（脱敏）</button>
        </div>
        <button class="map-round" data-act="map-refresh" title="刷新定位">${icon('locate', 18)}</button>
      </div>

      <div class="map-sheet">
        <div class="map-grab"></div>
        ${sel ? `
          <div class="place-card" style="border:none;padding-top:0">
            <div class="pt">
              <div>
                <div class="pn">${esc(sel.name)}</div>
                <div class="pc">${sel.type} · 最近一次 ${sel.lastDate ? fmtDateCN(sel.lastDate) : '—'} · 仅本人可见</div>
              </div>
              <div class="cnt">${sel.count}<small>次</small></div>
            </div>
            <div class="quote">「${quoteFor(sel)}」</div>
            <div class="bar"><i style="width:${Math.min(100, sel.count / maxC * 100)}%;background:${sel.count >= 5 ? '#8c837a' : '#d8a054'}"></i></div>
            <div class="dim" style="font-size:11px;margin-top:8px">这里占了你全部记录的 ${Math.round(sel.count / Math.max(1, total) * 100)}%。标记越灰，说明来得越多。</div>
          </div>
          <button class="btn-wk" style="height:40px;font-size:13px;margin-top:10px" data-act="map-back">${icon('chevronLeft', 15)} 返回全部地点</button>
        ` : `
          <div class="between" style="margin-bottom:6px">
            <div><div style="font-family:var(--serif);font-size:19px">克制地图</div>
              <div class="dim" style="font-size:11.5px;margin-top:4px">${sorted.length} 个地点 · 累计 ${total} 次 · 坐标 12 个月后降级为城市级</div></div>
            ${icon('shield', 22)}
          </div>
          ${sorted.map(p => `
            <div class="place-card">
              <div class="pt" data-pin="${p.id}" style="cursor:pointer">
                <div>
                  <div class="pn">${esc(p.name)}</div>
                  <div class="pc">${p.type} · 最近一次 ${p.lastDate ? fmtDateCN(p.lastDate) : '—'}</div>
                </div>
                <div class="cnt">${p.count}<small>次</small></div>
              </div>
              <div class="bar"><i style="width:${p.count / maxC * 100}%;background:${p.count >= 5 ? '#8c837a' : '#d8a054'}"></i></div>
            </div>`).join('')}
        `}
        <div class="map-note">${icon('info', 14)} ${sel ? '分享时默认只显示城市级粒度与次数，隐藏店名与精确坐标。' : '这里没有打卡成就，也没有“最爱酒吧”。只有次数。'}</div>
      </div>
    </div>`;
  }

  /* ============================================================
     酒桌小游戏
     ============================================================ */
  let game = { tab: 'dice', dice: [0, 0], rolled: false, verified: false, players: ['我', '老张', '小王'], winnerPlans: false, flip: false, card: 0 };
  const RISK_CARDS = [
    { q: '明天 09:00 有个 powerpoint 要讲。', risk: 'high', a: '建议：今晚换无醇，或者现在就点一杯气泡水把杯子占住。' },
    { q: '你今晚开车回家吗？', risk: 'high', a: '建议：开车就不喝。这条没有商量空间，也不构成医学判断。' },
    { q: '这周已经喝了 4 次了。', risk: 'mid', a: '建议：今晚算一次“不喝”，连击会替你记住。' },
    { q: '你在吃头孢 / 布洛芬。', risk: 'high', a: '建议：服药期间不饮酒。这里不做限制，只做提醒。' },
    { q: '今天心情不太好。', risk: 'mid', a: '建议：心情差的时候，酒的效果通常比想象中差。换成散步试试？' },
    { q: '明早 6 点跑步，配速 5:30。', risk: 'mid', a: '建议：今晚最多一杯，且换成无醇精酿。' },
    { q: '只是同事小聚，气氛很好。', risk: 'low', a: '建议：可以喝，但给自己定个上限——两杯，然后换无醇。' },
  ];

  function pageGame(q) {
    const tab = q.t || game.tab;
    game.tab = tab;
    const startY = +q.y || 2004;
    const today06 = new Date(); today06.setHours(6, 0, 0, 0);
    const msLeft = today06 - Date.now();
    const hLeft = Math.max(0, msLeft / 3600000);
    const d = C.dayTotals(db.logs, today());
    const card = RISK_CARDS[game.card % RISK_CARDS.length];
    const riskColor = { high: '#e59b92', mid: '#e3b36c', low: '#8fc9a0' }[card.risk];
    const riskLabel = { high: '高风险命中', mid: '中等风险', low: '低风险' }[card.risk];

    let body = '';
    if (tab === 'dice') {
      const [a, b] = game.dice;
      body = `
        <div class="dice-area">
          <div class="players">
            ${game.players.map((p, i) => `<div class="pl ${i === 0 ? 'me' : ''} ${game.verified && i === game.loserIdx ? 'loser' : ''}">
              <div class="av">${esc(p[0])}</div><span>${esc(p)}</span><span class="st">${game.verified && i === game.loserIdx ? '下一杯无醇' : ''}</span></div>`).join('')}
          </div>
          <div class="dice-row">
            ${[0, 1].map(i => `<div class="die ${game.rolling ? 'rolling' : ''}" id="die${i}">${a && i === 0 ? diceDots(a) : b && i === 1 ? diceDots(b) : ''}</div>`).join('')}
          </div>
          <div class="caption" id="dice-cap">${game.verified
            ? `点数最高者 <b>${esc(game.highestName)}</b> 本轮免饮；最低者 <b>${esc(game.loserName)}</b> 下一杯为<b>无醇</b>。`
            : (game.rolled ? `掷出 <b>${a + b}</b> 点（${a} + ${b}）。` : '两颗骰子代表两个人。最高免饮，最低换无醇——没有惩罚。')}</div>
          <button class="btn-wk solid" style="width:100%;margin-top:14px" data-act="dice-roll" ${game.rolling ? 'disabled' : ''}>${game.rolled ? '再掷一次' : '掷骰子'}</button>
        </div>
        <div class="game-card">
          <b>骰子 · 劝退局</b> <span class="rule">FR-6-01</span><br>
          输家落到「少喝 / 换无醇 / 延后」，不设任何强制饮酒规则。结果自动回写饮酒记录。
        </div>`;
    } else if (tab === 'bac') {
      const g = d.grams;
      const r = db.user.gender === 'female' ? 0.55 : 0.68;
      const brAC = g > 0 ? (g / (db.user.weight * r) * 1000) / 1000 : 0; // mg/L 近似
      const bac = brAC * 2.1;
      const hours = g / 10;
      body = `
        <div class="game-card" style="margin-top:18px">
          <b>酒精代谢推算</b> <span class="rule">FR-6-02</span><br>
          <span class="rule">BrAC(mg/L) ≈ 酒精克数 ÷ (体重 × r) × 1000 · r 男 0.68 / 女 0.55；BAC(‰) ≈ BrAC × 2.1；按 10 g/h 代谢。</span>
          <div class="gs">
            <div class="slider-row"><span class="dim" style="width:64px;font-size:12px">体重 kg</span>
              <input type="range" id="wt" min="40" max="120" value="${db.user.weight}" data-val="weight">
              <b class="mono" id="wt-v" style="width:36px;text-align:right">${db.user.weight}</b></div>
            <div class="slider-row"><span class="dim" style="width:64px;font-size:12px">今日已喝</span>
              <input type="range" id="gg" min="0" max="200" value="${Math.round(g)}" data-val="grams">
              <b class="mono" id="gg-v" style="width:52px;text-align:right">${Math.round(g)} g</b></div>
            <div class="slider-row"><span class="dim" style="width:64px;font-size:12px">性别系数</span>
              <span class="chip">${db.user.gender === 'female' ? '女性 r=0.55' : '男性 r=0.68'}</span></div>
          </div>
        </div>
        <div class="big-out">
          <div class="k">当 前 约</div>
          <div class="v" id="bac-v">${bac.toFixed(2)}‰</div>
          <div class="d" id="bac-d">${g > 0 ? `约需 <b>${hours.toFixed(1)} 小时</b>降至 0（仅供参考）。这期间：<b>不要开车</b>，明早状态会打折。` : '现在还是零克。保持住。'}</div>
        </div>
        <div class="disclaimer">${icon('alert', 13)} 结果仅为估算，不构成医学判断，也不作为“是否可驾车”的判定依据。饮酒后请勿驾车。</div>
        <div class="section" style="padding:0 18px">
          <button class="btn-wk" style="width:100%;height:44px;margin-top:14px;font-size:13.5px" data-act="bac-stop">${icon('check', 16)} 就到这儿，记一条「不喝」</button>
        </div>`;
    } else {
      body = `
        <div class="card-flip" id="card-flip">
          <div class="card-face card-front">
            <div class="qmark">?</div>
            <div class="hint">今晚，能不能喝？<br>抽一张卡，看今晚的场景</div>
          </div>
          <div class="card-face card-back">
            <span class="tag-risk" style="background:${riskColor}22;color:${riskColor};border:1px solid ${riskColor}55">${riskLabel}</span>
            <div class="q">${esc(card.q)}</div>
            <div class="a">${esc(card.a)}</div>
            <div class="acts">
              <button class="btn-wk ghost" data-act="card-next">换一张</button>
              ${card.risk === 'low' ? '<button class="btn-wk" data-act="card-drink">去记一杯</button>' : '<button class="btn-wk solid" data-act="card-sober">今晚不喝</button>'}
            </div>
          </div>
        </div>
        <div class="game-card">
          <b>今晚能不能喝</b> <span class="rule">FR-6-03</span><br>
          抽卡式情景问答：命中高风险项 → 推荐「不喝 / 换无醇」，可一键记无酒。规则由后台文案库配置。
        </div>`;
    }

    return `
    <div class="pg pg-game">
      <div class="game-head">
        <div style="font-family:var(--serif);font-size:24px">酒桌小游戏</div>
        <div class="dim" style="font-size:12px;margin-top:5px">每局 10 秒 · 输赢都落在“少喝”上</div>
      </div>
      <div class="game-tabs">
        <button class="${tab === 'dice' ? 'on' : ''}" data-t="dice">骰子·劝退局</button>
        <button class="${tab === 'bac' ? 'on' : ''}" data-t="bac">酒精代谢</button>
        <button class="${tab === 'card' ? 'on' : ''}" data-t="card">能不能喝</button>
      </div>
      ${body}
    </div>`;
  }

  function diceDots(n) {
    const pos = {
      1: [[50, 50]],
      2: [[30, 30], [70, 70]],
      3: [[30, 30], [50, 50], [70, 70]],
      4: [[30, 30], [70, 30], [30, 70], [70, 70]],
      5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
      6: [[30, 26], [70, 26], [30, 50], [70, 50], [30, 74], [70, 74]],
    }[n] || [];
    return pos.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join('');
  }

  /* ============================================================
     我的
     ============================================================ */
  function pageMe() {
    const t = today();
    const st = C.calcStreak(db.logs, C.addDays(t, -1));
    const inc = C.incentives(db.logs, db.user);
    const ms = C.monthStats(db.logs, monthKey(t));
    const coupon = db.coupons.find(c => c.month === monthKey(t) && !c.used);
    const joinDays = C.daysBetween(db.user.joinDate, t);
    return `
    <div class="pg pg-me">
      <div class="me-head">
        <div class="me-av">康</div>
        <div class="grow">
          <div class="me-name">阿康<span class="me-badge">${db.user.gender === 'female' ? '女' : '男'} · ${db.user.weight}kg</span></div>
          <div class="me-sub">加入第 ${joinDays} 天 · 已记录 ${db.logs.length} 次饮酒 / ${db.soberLogs.length} 次不喝</div>
        </div>
        <button class="pc-dots" style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center" data-go="settings">${icon('settings', 18)}</button>
      </div>

      <div class="me-hero">
        <div class="best">${ms.soberDays ? '本月 ' + ms.soberDays + ' 天没喝' : '本月还没开始'}</div>
        <div class="k">无 酒 连 击</div>
        <div class="v">${st.current}<small>天</small></div>
        <div class="desc">${st.current > 0 ? '连续没喝的日子，是这段时间最硬的战绩。' : '连击已经清零了。下一次从今晚开始也可以。'}</div>
      </div>

      <div class="me-grid">
        <div class="me-cell"><div class="k">本月少喝</div><div class="v">${Math.round(inc.pct * 100)}<small>%</small></div></div>
        <div class="me-cell"><div class="k">省下金额</div><div class="v">¥${Math.round(inc.money)}</div></div>
        <div class="me-cell"><div class="k">折合奶茶</div><div class="v">${inc.milktea.toFixed(1)}<small>杯</small></div></div>
      </div>

      <div class="me-coupon">
        ${icon('coupon', 26)}
        <div class="grow">
          <div class="t">复活券 <b style="color:var(--wk-amber-2)">${db.coupons.filter(c => c.month === monthKey(t) && !c.used).length} 张</b> 可用
            <small>${coupon ? `本月 1 日发放 · 诚实补记少量饮酒而不断连击 · 本月用完即止` : '本月已使用，下次 1 日重新发放。'}</small></div>
        </div>
        ${coupon ? `<button class="chip" data-act="use-coupon" style="border:1px solid rgba(239,193,131,.5);color:var(--wk-amber-2)">使用</button>` : ''}
      </div>

      <div class="me-list">
        <button class="me-item" data-go="calendar">${icon('calendar', 19)} 酒局日历 <span class="r">本月 ${ms.count} 次 ${icon('chevronRight', 14)}</span></button>
        <button class="me-item" data-go="map">${icon('map', 19)} 克制地图 <span class="r">${db.places.filter(p => p.count > 0).length} 个地点 ${icon('chevronRight', 14)}</span></button>
        <button class="me-item" data-go="game">${icon('dice', 19)} 酒桌小游戏 <span class="r">3 个玩法 ${icon('chevronRight', 14)}</span></button>
        <button class="me-item" data-act="export-data">${icon('download', 19)} 导出我的数据 <span class="r">CSV / JSON ${icon('chevronRight', 14)}</span></button>
        <button class="me-item" data-go="settings">${icon('settings', 19)} 设置与提醒 <span class="r">${icon('chevronRight', 14)}</span></button>
        <button class="me-item" data-act="privacy">${icon('shield', 19)} 隐私与权限 <span class="r">位置仅本人可见 ${icon('chevronRight', 14)}</span></button>
        <button class="me-item danger" data-act="logout">${icon('logout', 19)} 注销账号 <span class="r">${icon('chevronRight', 14)}</span></button>
      </div>
      <div class="dim" style="text-align:center;font-size:10.5px;margin:18px 0 8px;line-height:1.8">今晚喝点吗 V1.0 · 不卖酒，不接酒类广告<br>本产品不构成任何医疗建议，如存在酒精依赖请寻求专业帮助</div>
    </div>`;
  }

  /* ============================================================
     设置
     ============================================================ */
  function pageSettings() {
    const s = db.settings;
    return `
    <div class="pg pg-settings">
      <div class="rec-head">
        <button class="back" data-go="me">${icon('chevronLeft', 18)}</button>
        <div class="grow"><div class="t">设置与提醒</div><div class="s">提醒默认全关 · 22:00–08:00 不发任何消息</div></div>
      </div>
      <div class="set-group">
        <div class="sgt">情 景 提 醒</div>
        <div class="set-row"><div class="grow">周五 18:00 提醒<div class="s">“今晚喝点吗”——最常见的高危时机</div></div>
          <button class="sw ${s.remindFriday ? 'on' : ''}" data-sw="remindFriday"></button></div>
        <div class="set-row"><div class="grow">发薪日后一天<div class="s">每月 1 次，可在设置中关闭</div></div>
          <button class="sw ${s.remindPayday ? 'on' : ''}" data-sw="remindPayday"></button></div>
        <div class="set-row"><div class="grow">固定酒局前 1 小时<div class="s">需要在日历里标记过酒局</div></div>
          <button class="sw ${s.remindParty ? 'on' : ''}" data-sw="remindParty"></button></div>
      </div>
      <div class="set-group">
        <div class="sgt">偏 好</div>
        <div class="set-row"><div class="grow">单杯均价<div class="s">用于计算“省下的钱”，默认 ¥45 / 标准杯</div></div>
          <span class="mono">¥${db.user.pricePerDrink}</span></div>
        <div class="set-row"><div class="grow">体重 / 性别<div class="s">用于酒精代谢推算，仅本机与服务器可见</div></div>
          <button class="chip" data-act="edit-profile">${db.user.weight}kg · ${db.user.gender === 'female' ? '女' : '男'} ${icon('chevronRight', 12)}</button></div>
        <div class="set-row"><div class="grow">夜间免打扰<div class="s">22:00–08:00 不发送任何提醒（平台强制）</div></div>
          <button class="sw on dis" title="合规要求，不可关闭"></button></div>
      </div>
      <div class="set-group">
        <div class="sgt">数 据</div>
        <button class="set-row" style="width:100%;text-align:left;color:var(--wk-text)" data-act="export-data"><div class="grow">导出全部数据<div class="s">CSV / JSON · 24 小时有效的下载链接</div></div>${icon('download', 16)}</button>
        <button class="set-row" style="width:100%;text-align:left;color:#e59b92" data-act="logout"><div class="grow">注销账号<div class="s">15 日内完成物理删除</div></div>${icon('chevronRight', 16)}</button>
      </div>
      <div class="section" style="margin-top:20px;text-align:center">
        <button class="chip" data-act="reset-demo" style="color:var(--wk-text-3)">重置演示数据</button>
      </div>
    </div>`;
  }

  /* ============================================================
     首次使用 · 年龄门
     ============================================================ */
  function pageGate(q) {
    const reWelcome = isYouth();
    return `
    <div class="pg pg-gate">
      <div class="gate-inner">
        <div class="logo">今晚喝点吗</div>
        <div class="tag">外 表 劲 浪 · 内 核 清 醒</div>
        <p>${reWelcome ? '当前账号处于青年模式。<br>年龄信息可在「我的」中更正。' : '这是一个只做记录、不卖酒的少喝工具。<br>开始前，请先确认你的年龄。'}</p>
      </div>
      <div class="gate-actions">
        <button class="btn-wk solid" data-act="gate-adult">${reWelcome ? '进入青年模式' : '我已满 18 周岁，开始'}</button>
        <button class="btn-wk ghost" data-act="gate-minor">${reWelcome ? '更正年龄：我已满 18 周岁' : '我未满 18 周岁'}</button>
        <div class="note">按合规要求，未满 18 周岁将进入青年模式：不开放酒类内容、地图与游戏，仅保留“不喝”记录与健康提示。</div>
      </div>
    </div>`;
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindPage(path) {
    const pg = root.querySelector('.pg');
    if (!pg) return;
    pg.addEventListener('scroll', () => {
      window.__scrollSave = window.__scrollSave || {};
      window.__scrollSave['scroll_' + path] = pg.scrollTop;
    }, { passive: true });

    /* ---- 通用 tab / 返回 ---- */
    C.qsa('.tab', root).forEach(b => b.addEventListener('click', () => {
      C.setHash(b.dataset.tab === 'home' ? 'home' : b.dataset.tab);
    }));
    C.qsa('[data-go]', pg).forEach(b => b.addEventListener('click', () => {
      draft = null;
      C.setHash(b.dataset.go);
    }));

    /* ---- 首页 ---- */
    if (path === 'home' || (!db.user.ageOk && false)) {
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'drink') {
          db.decisions.push({ id: C.uid('dc'), date: today(), type: 'drink', time: C.nowStr(), gramsAtTime: C.dayTotals(db.logs, today()).grams });
          save();
          draft = null;
          C.setHash('record', { from: 'home' });
        } else if (act === 'sober') {
          recordSober('choice');
        } else if (act === 'later') {
          startCooldown();
        } else if (act === 'cd-cancel') {
          db.cooldown = null; save();
          toast('已结束这次拖延', { icon: 'check' });
          render();
        }
      }));
    }

    /* ---- 结果页 ---- */
    if (path === 'result') {
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'close-result' || act === 'open-calendar') {
          const todayQs = (window.__lastResultDate || today());
          if (act === 'close-result') C.setHash('home');
          else C.setHash('calendar', { d: todayQs, m: monthKey(todayQs) });
        } else if (act === 'again') {
          draft = null; C.setHash('record', {});
        } else if (act === 'share') {
          openShare();
        }
      }));
    }

    /* ---- 记录页 ---- */
    if (path === 'record') {
      C.qsa('[data-cat]', pg).forEach(b => b.addEventListener('click', () => {
        draft.cat = b.dataset.cat;
        const c = M.CATS.find(x => x.id === draft.cat);
        const def = M.BRANDS.find(x => x.cat === draft.cat);
        if (def) { draft.brandId = def.id; draft.brand = def.name; draft.abv = def.abv; draft.size = def.size; }
        else { draft.brandId = ''; draft.brand = ''; draft.abv = c.abv; draft.size = c.size; }
        render();
      }));
      C.qsa('[data-qty]', pg).forEach(b => b.addEventListener('click', () => {
        draft.qty = Math.max(0.5, +(draft.qty + (+b.dataset.qty) * (draft.qty < 1 ? 0.5 : 1)).toFixed(1));
        refreshQtyUI();
      }));
      C.qsa('[data-qty-set]', pg).forEach(b => b.addEventListener('click', () => {
        draft.qty = +b.dataset.qtySet;
        C.qsa('[data-qty-set]', pg).forEach(x => x.classList.toggle('on', x === b));
        refreshQtyUI();
      }));
      C.qsa('[data-place]', pg).forEach(b => b.addEventListener('click', () => {
        draft.placeId = b.dataset.place;
        C.qsa('[data-place]', pg).forEach(x => x.classList.toggle('on', x === b));
      }));
      C.qsa('[data-scene]', pg).forEach(b => b.addEventListener('click', () => {
        draft.scene = draft.scene === b.dataset.scene ? '' : b.dataset.scene;
        C.qsa('[data-scene]', pg).forEach(x => x.classList.toggle('on', x.dataset.scene === draft.scene));
      }));
      C.qsa('[data-mood]', pg).forEach(b => b.addEventListener('click', () => {
        draft.mood = b.dataset.mood;
        C.qsa('[data-mood]', pg).forEach(x => x.classList.toggle('on', x === b));
      }));
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'rec-close') { draft = null; C.setHash('home'); }
        else if (act === 'rec-reuse') {
          const last = db.logs.slice().sort((a, b2) => (b2.createdAt || '').localeCompare(a.createdAt || ''))[0];
          if (last) {
            Object.assign(draft, { cat: last.cat, brandId: last.brandId, brand: last.brand, abv: last.abv, size: last.ml, placeId: last.placeId, scene: last.scene, mood: last.mood });
            render();
            toast('已填入上次的记录：' + last.brand, { icon: 'loop' });
          }
        }
        else if (act === 'rec-brand') openSkuSheet('');
        else if (act === 'rec-cat-other') openSkuSheet('other');
        else if (act === 'rec-abv') {
          const e = document.getElementById('abv-edit');
          e.classList.toggle('hidden');
        }
        else if (act === 'rec-abv-ok') {
          const abv = +document.getElementById('abv-input').value;
          const ml = +document.getElementById('ml-input').value;
          if (!(abv > 0 && abv <= 96)) { toast('酒精度需在 0–96 %vol 之间'); return; }
          if (!(ml >= 10)) { toast('单份容量至少 10 ml'); return; }
          draft.abv = abv; draft.size = ml;
          if (!draft.brand) draft.brand = '自定义';
          document.getElementById('abv-edit').classList.add('hidden');
          updateBrandUI(); updateGramsUI();
          toast('已覆盖酒精度与容量', { icon: 'check' });
        }
        else if (act === 'rec-submit') submitRecord();
      }));
    }

    /* ---- 日历 ---- */
    if (path === 'calendar') {
      C.qsa('[data-month]', pg).forEach(b => b.addEventListener('click', () => {
        const [y, m] = calMonth.split('-').map(Number);
        const nm = new Date(y, m - 1 + (+b.dataset.month), 1);
        calMonth = nm.getFullYear() + '-' + String(nm.getMonth() + 1).padStart(2, '0');
        window.__scrollSave = {};
        C.setHash('calendar', { m: calMonth });
      }));
      C.qsa('[data-day]', pg).forEach(b => b.addEventListener('click', () => {
        const ds = b.dataset.day;
        C.setHash('calendar', { m: calMonth, d: ds === route().query.d ? '' : ds });
      }));
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        const sel = route().query.d || today();
        if (act === 'day-add') { draft = null; C.setHash('record', { date: sel }); }
        else if (act === 'day-edit') openDayEdit(sel);
        else if (act === 'go-today') C.setHash('calendar', { d: today(), m: monthKey(today()) });
      }));
    }

    /* ---- 地图 ---- */
    if (path === 'map') {
      C.qsa('[data-pin]', pg).forEach(b => b.addEventListener('click', () => {
        C.setHash('map', { p: b.dataset.pin });
      }));
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        if (b.dataset.act === 'map-back') C.setHash('map', {});
        else if (b.dataset.act === 'map-share') openShare('map');
        else if (b.dataset.act === 'map-refresh') {
          toast('定位已刷新（腾讯位置服务 · 城市级）', { icon: 'locate' });
        }
      }));
    }

    /* ---- 游戏 ---- */
    if (path === 'game') {
      C.qsa('[data-t]', pg).forEach(b => b.addEventListener('click', () => {
        game.flip = false;
        C.setHash('game', { t: b.dataset.t });
      }));
      const roll = pg.querySelector('[data-act="dice-roll"]');
      if (roll) roll.addEventListener('click', () => {
        game.rolling = true;
        roll.disabled = true;
        document.getElementById('dice0').classList.add('rolling');
        document.getElementById('dice1').classList.add('rolling');
        setTimeout(() => {
          const a = rndInt(1, 6), b = rndInt(1, 6);
          game.dice = [a, b]; game.rolling = false; game.rolled = true; game.verified = true;
          const scores = [a, b, rndInt(1, 6)];
          const hi = Math.max(...scores), lo = Math.min(...scores);
          game.highestName = game.players[scores.indexOf(hi)];
          game.loserName = game.players[scores.indexOf(lo)];
          game.loserIdx = scores.indexOf(lo);
          render();
          const cap = document.getElementById('dice-cap');
          if (cap) cap.innerHTML = `点数最高者 <b>${esc(game.highestName)}</b> 本轮免饮；最低者 <b>${esc(game.loserName)}</b> 下一杯为<b>无醇</b>。结果已写入记录。`;
          // 游戏即记录：写入一条“本轮免饮/换无醇”的说明记录（不计酒量）
          db.decisions.push({ id: C.uid('dc'), date: today(), type: 'game', time: C.nowStr(), gramsAtTime: C.dayTotals(db.logs, today()).grams });
          save();
        }, 520);
      });
      const wt = pg.querySelector('#wt');
      if (wt) {
        wt.addEventListener('input', () => {
          const w = +wt.value;
          document.getElementById('wt-v').textContent = w;
          db.user.weight = w; save();
          recalcBac();
        });
      }
      const gg = pg.querySelector('#gg');
      if (gg) {
        gg.addEventListener('input', () => {
          document.getElementById('gg-v').textContent = gg.value + ' g';
          recalcBac(+gg.value);
        });
      }
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'bac-stop' || act === 'card-sober') recordSober('game');
        else if (act === 'card-drink') { draft = null; C.setHash('record', {}); }
        else if (act === 'card-next') {
          game.card++;
          const flip = document.getElementById('card-flip');
          flip.classList.remove('flipped');
          setTimeout(() => render(), 240);
        }
      }));
      const flip = document.getElementById('card-flip');
      if (flip && !game.flip) {
        flip.addEventListener('click', () => {
          game.flip = true;
          flip.classList.add('flipped');
        });
      } else if (flip && game.flip) {
        flip.classList.add('flipped');
      }
    }

    /* ---- 我的 ---- */
    if (path === 'me') {
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'export-data') exportData();
        else if (act === 'use-coupon') useCoupon();
        else if (act === 'privacy') openPrivacy();
        else if (act === 'logout') logout();
      }));
    }

    /* ---- 设置 ---- */
    if (path === 'settings') {
      C.qsa('[data-sw]', pg).forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.sw;
        db.settings[k] = !db.settings[k];
        save();
        b.classList.toggle('on', db.settings[k]);
        if (db.settings[k]) toast('已开启。需要授权微信订阅消息（原型已自动模拟授权）', { icon: 'bell' });
      }));
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        const act = b.dataset.act;
        if (act === 'export-data') exportData();
        else if (act === 'logout') logout();
        else if (act === 'edit-profile') editProfile();
        else if (act === 'reset-demo') resetDemo();
      }));
    }

    /* ---- 年龄门 ---- */
    if (path === 'gate') {
      C.qsa('[data-act]', pg).forEach(b => b.addEventListener('click', () => {
        if (b.dataset.act === 'gate-adult' && isYouth()) { C.setHash('home'); return; }
        if (b.dataset.act === 'gate-minor' && isYouth()) {
          db.user.youth = false; db.user.ageOk = true; save();
          C.setHash('home'); toast('年龄信息已更正，青年模式限制已解除', { icon: 'check' });
          return;
        }
        if (b.dataset.act === 'gate-adult') {
          db.user.ageOk = true; save(); C.setHash('home'); toast('欢迎。今晚的第一次询问，从现在开始。', { icon: 'glass' });
        } else {
          C.modal({
            title: '青年模式', width: 300,
            body: '未满 18 周岁用户将进入青年模式：不开放酒类内容、地图与游戏，仅保留「不喝」记录与健康提示。如需继续，请由监护人了解本产品用途。',
            actions: [
              { label: '返回' },
              { label: '进入青年模式', cls: 'primary', onClick() {
                db.user.youth = true; db.user.ageOk = true; save();
                C.setHash('home');
                toast('已进入青年模式：仅保留「不喝」记录与健康提示', { icon: 'shield' });
              } },
            ],
          });
        }
      }));
    }
  }

  function updateBrandUI() {
    const b = document.getElementById('brand-n'), m = document.getElementById('brand-m');
    const cat = M.CATS.find(c => c.id === draft.cat);
    if (b) b.textContent = draft.brand || '选择酒款 · ' + cat.name;
    if (m) m.textContent = `${draft.abv}%vol · ${draft.size} ml / ${cat.unit}`;
  }
  function refreshQtyUI() {
    const q = document.getElementById('qty-v');
    if (q) q.textContent = draft.qty;
    C.qsa('[data-qty-set]').forEach(x => x.classList.toggle('on', +x.dataset.qtySet === draft.qty));
    updateGramsUI();
  }

  function recalcBac(overrideG) {
    const g = overrideG != null ? overrideG : C.dayTotals(db.logs, today()).grams;
    const r = db.user.gender === 'female' ? 0.55 : 0.68;
    const brAC = g > 0 ? (g / (db.user.weight * r) * 1000) / 1000 : 0;
    const v = document.getElementById('bac-v'), d = document.getElementById('bac-d');
    if (v) v.textContent = (brAC * 2.1).toFixed(2) + '‰';
    if (d) d.innerHTML = g > 0
      ? `约需 <b>${(g / 10).toFixed(1)} 小时</b>降至 0（仅供参考）。这期间：<b>不要开车</b>，明早状态会打折。`
      : '现在还是零克。保持住。';
  }

  /* ============================================================
     业务动作
     ============================================================ */
  function submitRecord() {
    const t = draft.date || today();
    const cat = M.CATS.find(c => c.id === draft.cat);
    const ml = +(draft.size * draft.qty).toFixed(0);
    const grams = +C.alcoholG(ml, draft.abv).toFixed(1);
    const brand = draft.brand || cat.name;
    if (!(ml > 0) || !(draft.abv > 0)) { toast('请先选择酒类与饮用量'); return; }
    // 处于拖延冷却中饮酒：放行但标记
    const afterDelay = !!db.cooldown;
    db.logs.push({
      id: C.uid('lg'), date: t, time: C.nowStr(), cat: draft.cat, brandId: draft.brandId, brand,
      ml, abv: draft.abv, grams, placeId: draft.placeId, scene: draft.scene, mood: draft.mood,
      note: afterDelay ? '经拖延后饮酒' : '', source: 'manual', createdAt: C.stamp(),
    });
    // 更新地点次数
    const day = C.dayTotals(db.logs, t);
    if (draft.placeId) {
      const p = db.places.find(x => x.id === draft.placeId);
      if (p) { p.count += 1; p.lastDate = t; }
    } else {
      const p = M.PLACES[(db.logs.length) % M.PLACES.length];
      const np = db.places.find(x => x.id === p.id);
      if (np && t === today()) { np.lastDate = t; }
    }
    // 记录当日"喝"决策
    db.decisions.push({ id: C.uid('dc'), date: t, type: 'drink', time: C.nowStr(), gramsAtTime: day.grams, afterDelay });
    if (afterDelay) {
      db.cooldown = null;
    }
    const kind = db.feedbackIdx % 3;
    db.feedbackIdx++;
    save();
    window.__lastResultDate = t;
    draft = null;
    // 进入反馈页；用时间戳强制刷新 hash 以重新渲染
    C.setHash('result', { type: 'drink', g: grams, k: ['pct', 'money', 'kcal'][kind], ts: Date.now() });
    toast(afterDelay ? '已记录（标记为“经拖延后饮酒”）' : '记录成功 · 这次的酒量也算数', { icon: 'check' });
  }

  function recordSober(source) {
    const t = today();
    const exist = db.soberLogs.find(s => s.date === t);
    if (!exist) db.soberLogs.push({ id: C.uid('sb'), date: t, type: 'sober', source, time: C.nowStr() });
    db.decisions.push({ id: C.uid('dc'), date: t, type: 'sober', time: C.nowStr(), gramsAtTime: C.dayTotals(db.logs, t).grams });
    const cd = db.cooldown;
    db.cooldown = null;
    save();
    window.__lastResultDate = today();
    C.setHash('result', { type: 'sober', ts: Date.now() });
  }

  function startCooldown() {
    if (db.cooldown) { toast('已经在拖延中了：' + Math.ceil(remainMs() / 60000) + ' 分钟后会再问你'); return; }
    db.cooldown = { start: Date.now(), end: Date.now() + COOL };
    db.decisions.push({ id: C.uid('dc'), date: today(), type: 'later', time: C.nowStr(), gramsAtTime: C.dayTotals(db.logs, today()).grams });
    save();
    toast('好，那就十分钟后再问一次。', { icon: 'clock' });
    render();
    // 模拟订阅消息授权提示
    setTimeout(() => {
      if (remainMs() > 0) toast('订阅消息已授权：冷却结束时会再提醒你一次（每晚最多 1 条）', { icon: 'bell' });
    }, 1600);
  }

  function openShare(kind) {
    const t = today();
    const ms = C.monthStats(db.logs, monthKey(t));
    const inc = C.incentives(db.logs, db.user);
    const isMap = kind === 'map';
    const mask = document.createElement('div');
    mask.className = 'share-mask';
    mask.innerHTML = `
      <div class="share-card">
        <div class="sck">${isMap ? 'CITY · 脱敏地图' : 'MONTHLY · ' + t.slice(0, 7)}</div>
        <div class="scv">${isMap ? db.places.filter(p => p.count > 0).length : ms.count}</div>
        <div class="scl">${isMap ? '个地方，我留下过记录' : `次饮酒，少喝了 ${Math.round(inc.pct * 100)}%`}</div>
        <div class="scd">${isMap ? '已隐藏店名与坐标' : `省下约 ¥${Math.round(inc.money)} · 折合 ${inc.milktea.toFixed(1)} 杯奶茶`}</div>
        <div class="scf">${icon('glass', 12)} 今晚喝点吗 · 外表劲浪，内核清醒</div>
      </div>
      <div class="tip">${isMap ? '默认仅显示城市级与次数，已隐藏店名与坐标' : '默认脱敏 · 不含地点与精确时间'}</div>
      <div style="display:flex;gap:10px;width:260px">
        <button class="btn-wk grow" style="height:44px;font-size:13px" data-close>取消</button>
        <button class="btn-wk solid grow" style="height:44px;font-size:13px" data-save>保存图片</button>
      </div>`;
    root.appendChild(mask);
    mask.addEventListener('click', (e) => {
      if (e.target === mask || e.target.closest('[data-close]')) mask.remove();
      if (e.target.closest('[data-save]')) {
        mask.remove();
        toast('分享图已保存（原型模拟）。分享前请确认信息已脱敏。', { icon: 'check' });
      }
    });
  }

  function openDayEdit(date) {
    const d = C.dayTotals(db.logs, date);
    C.modal({
      title: '修改本日总量',
      body: `<div style="padding:6px 0">
        <div style="font-size:13px;color:#5b6661;line-height:1.8">发薪日之后的记录经常是“吹牛版”。<b style="color:#1d2321">是今天总共只喝了这些吗？</b></div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:16px">
          <input id="de-g" type="number" value="${Math.round(d.grams)}" min="0" step="1" style="flex:1;height:40px;border:1px solid #d3dad7;border-radius:8px;padding:0 12px;font-size:16px;font-variant-numeric:tabular-nums">
          <span style="color:#5b6661">g（当前 ${d.list.length} 条记录合计 ${Math.round(d.grams)} g）</span>
        </div>
        <div style="font-size:12px;color:#8c968f;margin-top:14px;line-height:1.7">按比例缩放当日的 ${d.list.length} 条记录。允许改小——少喝产品的诚信机制，不惩罚诚实。</div>
      </div>`,
      actions: [
        { label: '取消' },
        { label: '按比例修改', cls: 'primary', keepOpen: true, onClick: (m, close) => {
          const nv = +m.querySelector('#de-g').value;
          if (!(nv >= 0)) { toast('请输入合法数值'); return; }
          if (!d.grams) { close(); return; }
          const k = nv / d.grams;
          d.list.forEach(l => { l.grams = +(l.grams * k).toFixed(1); l.ml = +(l.ml * k).toFixed(0); });
          d.list = [];
          save();
          close();
          render();
          toast(`已将 ${date} 的总量调整为 ${Math.round(nv)} g，日历与统计已重算`, { icon: 'check' });
        } },
      ],
    });
  }

  function exportData() {
    C.modal({
      title: '导出我的数据 / 二次身份校验',
      body: '<div style="line-height:1.9">按隐私合规要求，导出前需二次校验。<br>原型中点击「确认导出」将生成一份包含全部饮酒记录、无酒记录、地点与统计结果的 JSON 文件。<br><span style="color:#8c968f;font-size:12px">下载链接 24 小时内有效。</span></div>',
      actions: [
        { label: '取消' },
        { label: '确认导出', cls: 'primary', keepOpen: true, onClick: (m, close) => {
          setTimeout(() => {
            const payload = {
              exportAt: C.stamp(), user: db.user, logs: db.logs, soberLogs: db.soberLogs,
              places: db.places.map(p => ({ name: p.name, type: p.type, count: p.count })), decisions: db.decisions,
              stats: { month: C.monthStats(db.logs, monthKey(today())), incentive: C.incentives(db.logs, db.user), streak: C.calcStreak(db.logs, today()) },
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `JVHD_export_${today()}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 3000);
            close();
            toast('导出完成 · 数据请求 5 分钟内完成（P0 验收项）', { icon: 'download' });
          }, 900);
          toast('正在生成导出文件…', { icon: 'clock' });
        } },
      ],
    });
  }

  function useCoupon() {
    C.modal({
      title: '使用复活券',
      body: '<div style="line-height:1.9">复活券用于“诚实补记少量饮酒而断开连击”的场景：<br>· 须如实补记当日饮酒量（不得为 0）；<br>· 连击保留，但不增加；<br>· 每月 1 张，不可购买，当月不结转。</div>',
      actions: [
        { label: '取消' },
        { label: '确认使用', cls: 'primary', onClick: () => {
          const cp = db.coupons.find(c => c.month === monthKey(today()) && !c.used);
          if (cp) { cp.used = true; cp.date = today(); save(); toast('复活券已使用 · 连击保留', { icon: 'coupon' }); render(); }
        } },
      ],
    });
  }

  function openPrivacy() {
    C.modal({
      title: '隐私与权限',
      body: `<div style="line-height:1.95">
        <b>位置信息</b>：仅在记录饮水地点时使用，需单独授权；拒绝授权不影响记录主流程。<br>
        <b>可见范围</b>：所有地点与次数仅本人可见，不进入任何公开聚合与社区。<br>
        <b>坐标保留</b>：精确坐标保留 12 个月后自动降级为城市级。<br>
        <b>分享</b>：默认脱敏至城市级，隐藏店名与门牌号。<br>
        <b>提醒</b>：22:00–08:00 不发送任何消息；每周最多 3 条。
      </div>`,
      actions: [{ label: '知道了', cls: 'primary' }],
    });
  }

  function editProfile() {
    C.modal({
      title: '体重 / 性别',
      body: `<div style="display:flex;gap:10px;padding:4px 0">
        <input id="pf-w" type="number" value="${db.user.weight}" style="flex:1;height:38px;border:1px solid #d3dad7;border-radius:8px;padding:0 12px">
        <select id="pf-g" style="flex:1;height:38px;border:1px solid #d3dad7;border-radius:8px;padding:0 8px">
          <option value="male" ${db.user.gender === 'male' ? 'selected' : ''}>男</option>
          <option value="female" ${db.user.gender === 'female' ? 'selected' : ''}>女</option>
        </select></div>
        <div style="font-size:12px;color:#8c968f;margin-top:10px">用于代谢推算与超量阈值（男 60g / 女 40g）。</div>`,
      actions: [{ label: '取消' }, { label: '保存', cls: 'primary', keepOpen: true, onClick: (m, close) => {
        db.user.weight = +m.querySelector('#pf-w').value || db.user.weight;
        db.user.gender = m.querySelector('#pf-g').value;
        save(); close(); render(); toast('已保存', { icon: 'check' });
      } }],
    });
  }

  function logout() {
    C.modal({
      title: '注销账号',
      body: '<div style="line-height:1.9">注销后：<br>· 个人数据 15 日内完成物理删除，仅保留不可溯源的匿名统计；<br>· 连击、复活券、地图记录将不可恢复；<br>· 提供删除确认凭证。<br><br>原型中注销仅回到首次使用的年龄确认页。</div>',
      actions: [
        { label: '再想想' },
        { label: '确认注销', cls: 'danger', onClick: () => {
          db.user.ageOk = false; save(); C.setHash('gate');
        } },
      ],
    });
  }

  function resetDemo() {
    db = M.resetMini();
    draft = null;
    C.setHash('home');
    toast('已重置为初始演示数据', { icon: 'refresh' });
    render();
  }

  /* ============================================================
     舞台导航 / 时钟 / 启动
     ============================================================ */
  function buildNav() {
    const nav = document.getElementById('stage-nav');
    nav.innerHTML = NAV.map((n, i) => `<a href="#/${n.path}" data-path="${n.path}">${icon(n.icon, 17)}<span>${n.name}</span><span class="no">0${i + 1}</span></a>`).join('');
  }

  function clock() {
    const d = new Date();
    const s = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    sbTime.textContent = s;
  }

  document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click', async () => {
    const s = b.dataset.scene;
    document.querySelectorAll('[data-scene]').forEach(x => x.classList.toggle('armed', x === b));
    if (s === 'drink') { draft = null; C.setHash('record', {}); }
    else if (s === 'cooldown') {
      db.user.ageOk = true;
      if (!db.cooldown) { db.cooldown = { start: Date.now(), end: Date.now() + COOL }; save(); }
      C.setHash('home');
      toast('已启动 10 分钟拖延冷却（服务端计时）', { icon: 'clock' });
    } else if (s === 'fuel') {
      frequent = true;
      db.cooldown = { start: Date.now() - (COOL - 10000), end: Date.now() + 10000 };
      save(); C.setHash('home');
      toast('加速演示已开启：冷却将在 10 秒内结束', { icon: 'sparkle' });
      b.querySelector('b').textContent = '×60 演示中';
    } else if (s === 'newuser') {
      C.storageSet('mini', M.seedMini());
      reload();
      db.user.ageOk = false;
      save();
      C.setHash('gate');
      toast('已切换为「新用户首次使用」场景', { icon: 'user' });
    }
    setTimeout(() => b.classList.remove('armed'), 600);
  }));

  document.querySelectorAll('[data-reset]').forEach(a => a.addEventListener('click', (e) => {
    e.preventDefault();
    resetDemo();
  }));

  pcMenu.addEventListener('click', () => {
    C.qsa('.menu-pop').forEach(x => x.remove());
    const pop = document.createElement('div');
    pop.className = 'menu-pop';
    pop.style.cssText = 'position:absolute;right:14px;top:86px;z-index:50;background:#1d1a19;border:1px solid rgba(255,236,214,.16);border-radius:12px;padding:6px;width:150px;box-shadow:0 20px 40px -20px #000';
    const items = [['转发给朋友', 'share'], ['添加到我的小程序', 'star'], ['设置', 'settings'], ['打开调试', 'sliders']];
    pop.innerHTML = items.map(([n, ic]) => `<button style="display:flex;gap:10px;align-items:center;width:100%;padding:10px 12px;border-radius:8px;color:#f2e8dc;font-size:13px" data-mi="${n}">${icon(ic, 16)}${n}</button>`).join('');
    document.querySelector('.phone-body').appendChild(pop);
    pop.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-mi]');
      if (!btn) return;
      pop.remove();
      if (btn.dataset.mi === '设置') C.setHash('settings');
      else if (btn.dataset.mi === '转发给朋友') toast('已打开转发面板（原型模拟）', { icon: 'share' });
      else toast('已添加到我的小程序（原型模拟）', { icon: 'star' });
    });
    setTimeout(() => document.addEventListener('click', function once(ev) { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', once); } }), 0);
  });

  buildNav();
  clock();
  setInterval(clock, 20000);
  window.addEventListener('hashchange', () => { render(); });
  // 初始路由
  if (!location.hash) C.setHash(db.user.ageOk ? 'home' : 'gate');
  render();
  window.__mini = { get db() { return db; }, render, reload };
})();
