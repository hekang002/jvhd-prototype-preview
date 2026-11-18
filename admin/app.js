/* ============================================================
   今晚喝点吗 · 运营后台原型
   模块：登录 / 看板 / 用户 / 酒库 / 文案 / 替代 / 阈值 / 提醒 / 地图 / 合规 / 权限 / 审计
   ============================================================ */
(function () {
  'use strict';
  const C = window.Core, M = window.Mock;
  const { esc, fmtNum, icon, toast, modal, qs, qsa, on, addDays, today } = C;

  const S = { A: null, session: null, path: 'dashboard', q: {} };
  let store = null;
  function A() { return store; }
  function saveA() { M.saveAdmin(store); }

  /* ============================================================
     小工具
     ============================================================ */
  const STATUS = {
    online: ['已上线', 'tb-green'], draft: ['草稿', 'tb-gray'], paused: ['已暂停', 'tb-amber'],
    pending: ['待审核', 'tb-amber'], rejected: ['已驳回', 'tb-red'], offline: ['已下线', 'tb-gray'],
    active: ['正常', 'tb-green'], silent: ['沉默', 'tb-amber'], churn: ['流失预警', 'tb-red'],
    done: ['已完成', 'tb-green'], processing: ['处理中', 'tb-blue'], success: ['成功', 'tb-green'],
    denied: ['已拒绝', 'tb-red'], blocked: ['已拦截', 'tb-amber'],
  };
  function badge(st) {
    const [t, cls] = STATUS[st] || [st, 'tb-gray'];
    return `<span class="tag-badge ${cls}">${esc(t)}</span>`;
  }
  function roleName() { return S.session ? S.session.role : ''; }
  function can(perm) {
    const role = A().roles.find(r => r.name === roleName());
    if (!role) return false;
    if (role.name === '超级管理员') return true;
    return role.perms.some(p => p.indexOf(perm) >= 0);
  }
  function guard(perm, action) {
    if (can(perm)) return true;
    modal({
      title: '权限不足', width: 400,
      body: `<div class="hint-bar warn" style="margin:0">${icon('shield', 18)}<div>当前角色「${esc(roleName())}」没有「${esc(action || perm)}」权限。<br>该操作已按 NFR-05 最小必要原则拦截，并记入操作日志。</div></div>`,
      actions: [{ label: '知道了', cls: 'btn primary' }],
    });
    logOp('denied', '权限拦截', action || perm);
    return false;
  }
  function logOp(action, target, result) {
    A().auditLog.unshift({
      ts: C.stamp(), user: (S.session || {}).name || '未登录', role: roleName() || '—',
      action, target, ip: '10.24.8.31', result: typeof result === 'string' ? result : 'success',
    });
    saveA();
  }
  function relDate(d) {
    const n = C.daysBetween(d, today());
    if (n <= 0) return '今天';
    if (n === 1) return '昨天';
    if (n < 30) return n + ' 天前';
    return Math.round(n / 30) + ' 个月前';
  }
  function pct(v) { return (v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0) + '%'; }
  function deltaEl(v, invert) {
    const up = v >= 0;
    const good = invert ? !up : up;
    const cls = Math.abs(v) < 0.0005 ? 'flat' : (good ? 'up' : 'down');
    return `<span class="delta ${cls}">${up ? '↑' : '↓'} ${(Math.abs(v) * 100).toFixed(1)}%</span>`;
  }

  /* ---------------- 图表（纯 SVG） ---------------- */
  function lineChart(data, opt) {
    opt = opt || {};
    const W = opt.w || 760, H = opt.h || 220, P = { l: 34, r: 14, t: 14, b: 26 };
    const series = opt.series; // [{key,label,color,dashed}]
    const n = data.length;
    const vals = series.flatMap(s => data.map(d => d[s.key]));
    let min = opt.min != null ? opt.min : Math.min(...vals), max = opt.max != null ? opt.max : Math.max(...vals);
    if (max === min) max = min + 1;
    if (opt.min != null && opt.max != null) { /* 显式区间 */ }
    else {
      const pad = (max - min) * 0.12 || 1;
      min -= pad; max += pad;
      // 轴刻度取整：负半轴归零，上界对齐到 4 的整数倍
      const step = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, max - min))));
      if (opt.min == null) min = min <= 0 ? 0 : Math.floor(min / step) * step;
      max = Math.max(Math.ceil(max / step) * step, min + step);
    }
    const x = i => P.l + (W - P.l - P.r) * (n <= 1 ? 0.5 : i / (n - 1));
    const y = v => H - P.b - (H - P.t - P.b) * (v - min) / (max - min);
    let g = '';
    for (let k = 0; k <= 4; k++) {
      const v = min + (max - min) * k / 4, yy = y(v);
      g += `<line x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}" stroke="#eef1ef" stroke-width="1"/>
            <text x="${P.l - 8}" y="${yy + 4}" font-size="10" fill="#98a49e" text-anchor="end">${opt.fmtY ? opt.fmtY(v) : Math.round(v * 100) / 100}</text>`;
    }
    let paths = '';
    series.forEach(s => {
      const d = data.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join(' ');
      const area = `${d} L${x(n - 1)},${H - P.b} L${x(0)},${H - P.b} Z`;
      if (s.fill) paths += `<path d="${area}" fill="${s.color}" opacity=".08"/>`;
      paths += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.dashed ? 'stroke-dasharray="5 4"' : ''}/>`;
      paths += data.map((p, i) => (opt.dots === false ? '' : `<circle cx="${x(i)}" cy="${y(p[s.key])}" r="2.4" fill="#fff" stroke="${s.color}" stroke-width="1.6"/>`)).join('');
    });
    let xl = '';
    data.forEach((p, i) => {
      if (i % Math.ceil(n / 8) === 0 || i === n - 1) xl += `<text x="${x(i)}" y="${H - 8}" font-size="10" fill="#98a49e" text-anchor="middle">${p.date.slice(5)}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">
      ${g}${paths}${xl}
      <line x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}" stroke="#e3e8e5"/></svg>`;
  }

  function barChart(items, opt) {
    opt = opt || {};
    const W = 420, H = opt.h || 180, P = { l: 8, r: 8, t: 20, b: 30 };
    const max = Math.max(...items.map(i => i.value));
    const bw = (W - P.l - P.r) / items.length;
    let out = '';
    items.forEach((it, i) => {
      const h = (H - P.t - P.b) * it.value / max;
      const x = P.l + bw * i + bw * 0.18, w = bw * 0.64;
      out += `<rect x="${x}" y="${H - P.b - h}" width="${w}" height="${h}" rx="4" fill="${it.tone || '#2f6d58'}"/>
        <text x="${x + w / 2}" y="${H - P.b - h - 6}" font-size="10.5" fill="#5d6a64" text-anchor="middle">${opt.showValue === false ? '' : it.value}</text>
        <text x="${x + w / 2}" y="${H - P.b + 15}" font-size="11" fill="#5d6a64" text-anchor="middle">${it.label}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">${out}</svg>`;
  }

  function donut(items, opt) {
    opt = opt || {};
    const size = opt.size || 150, R = size / 2 - 12, r = R - 16, cx = size / 2, cy = size / 2;
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    let a0 = -Math.PI / 2, out = '';
    items.forEach(it => {
      const a1 = a0 + Math.PI * 2 * it.value / total;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
      const [x0, y0] = p(a0, R), [x1, y1] = p(a1, R), [x2, y2] = p(a1, r), [x3, y3] = p(a0, r);
      out += `<path d="M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z" fill="${it.tone}"/>`;
      a0 = a1;
    });
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${out}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="18" font-weight="600" fill="#24312c">${opt.center || ''}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="10.5" fill="#98a49e">${opt.centerSub || ''}</text></svg>`;
  }

  function funnelChart(steps) {
    const W = 560, H = 210;
    let out = '';
    steps.forEach((s, i) => {
      const w = 460 * s.value / steps[0].value;
      const x = (W - w) / 2, y = 12 + i * 48;
      const conv = i ? (s.value / steps[i - 1].value * 100).toFixed(1) + '%' : '100%';
      out += `<rect x="${x}" y="${y}" width="${w}" height="34" rx="6" fill="#2f6d58" opacity="${1 - i * 0.19}"/>
        <text x="${x + 12}" y="${y + 22}" font-size="11.5" fill="#fff">${s.label}</text>
        <text x="${W / 2 + 0}" y="${y + 22}" font-size="11.5" fill="#fff" text-anchor="middle">${fmtNum(s.value)}</text>
        <text x="${W - 4}" y="${y + 22}" font-size="11" fill="#5d6a64" text-anchor="end">${conv}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" style="height:${H}px">${out}</svg>`;
  }

  function spark(data, key, color) {
    const W = 74, H = 28;
    const vs = data.map(d => d[key]);
    const min = Math.min(...vs), max = Math.max(...vs) || 1;
    const d = vs.map((v, i) => `${i ? 'L' : 'M'}${(i / (vs.length - 1) * W).toFixed(1)},${(H - 3 - (H - 6) * (v - min) / (max - min || 1)).toFixed(1)}`).join(' ');
    return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" opacity=".85"/></svg>`;
  }

  /* ---------------- 分页 ---------------- */
  function pager(total, page, size, onGo) {
    const pages = Math.max(1, Math.ceil(total / size));
    let btns = '';
    for (let p = 1; p <= pages; p++) {
      if (pages > 7 && p > 2 && p < pages - 1 && Math.abs(p - page) > 1) { if (p === 3 || p === pages - 2) btns += `<span style="padding:0 4px;color:#98a49e">…</span>`; continue; }
      btns += `<button class="${p === page ? 'on' : ''}" data-pg="${p}">${p}</button>`;
    }
    return `<div class="pager"><span>共 ${total} 条 · 每页 ${size} 条</span>
      <div class="pgs"><button data-pg="${Math.max(1, page - 1)}">‹</button>${btns}<button data-pg="${Math.min(pages, page + 1)}">›</button></div></div>`;
  }
  function bindPager(root, cb) {
    qsa('[data-pg]', root).forEach(b => b.addEventListener('click', () => cb(+b.dataset.pg)));
  }

  /* ---------------- 抽屉 ---------------- */
  function drawer(opts) {
    closeDrawer();
    const mask = document.createElement('div');
    mask.className = 'drawer-mask';
    const el = document.createElement('div');
    el.className = 'drawer';
    el.style.width = (opts.width || 520) + 'px';
    el.innerHTML = `
      <div class="drawer-h"><div><div class="t">${opts.title}</div>${opts.sub ? `<div class="s">${opts.sub}</div>` : ''}</div>
        <button class="btn ghost" data-close style="padding:4px">${icon('x', 18)}</button></div>
      <div class="drawer-b">${opts.body}</div>
      ${opts.footer ? `<div class="drawer-f">${opts.footer}</div>` : ''}`;
    document.body.appendChild(mask); document.body.appendChild(el);
    mask.addEventListener('click', closeDrawer);
    qsa('[data-close]', el).forEach(b => b.addEventListener('click', closeDrawer));
    if (opts.onMount) opts.onMount(el, closeDrawer);
  }
  function closeDrawer() {
    qsa('.drawer-mask,.drawer').forEach(n => n.remove());
  }

  /* ============================================================
     导航
     ============================================================ */
  const NAV = [
    { grp: '总览' },
    { id: 'dashboard', name: '运营看板', ic: 'dashboard' },
    { id: 'users', name: '用户管理', ic: 'users' },
    { grp: '内容配置' },
    { id: 'sku', name: '酒库管理', ic: 'beer', badge: () => A().skus.filter(s => s.status === 'pending').length },
    { id: 'copy', name: '文案库', ic: 'megaphone' },
    { id: 'alts', name: '无醇替代', ic: 'leaf' },
    { id: 'thresholds', name: '阈值与规则', ic: 'sliders' },
    { id: 'notices', name: '提醒与推送', ic: 'bell' },
    { grp: '数据与合规' },
    { id: 'map', name: '地点聚合', ic: 'map' },
    { id: 'compliance', name: '合规中心', ic: 'shield' },
    { id: 'roles', name: '角色权限', ic: 'key' },
    { id: 'audit', name: '操作日志', ic: 'ledger' },
  ];
  const TITLES = {
    dashboard: ['运营看板', '核心指标 · 决策分流 · 留存与克制趋势（全部为脱敏聚合数据）'],
    users: ['用户管理', '仅展示脱敏信息；精确坐标与原始导出需超管 + 二次验证'],
    sku: ['酒库管理', '约 2000+ SKU；用户自定义酒品先进入待审核池，审核通过后进入公库（NFR-09 免发版生效）'],
    copy: ['文案库', '反馈卡 / 不喝回复 / 地图评语 / 小游戏旁白。发布前自动跑合规词库校验'],
    alts: ['无醇替代推荐', '记录后按酒类推荐无醇替代方案，不出现任何购买链接与价格'],
    thresholds: ['阈值与规则', '改动即时下发至小程序，无需发版；合规强制项不可关闭'],
    notices: ['提醒与推送', '静默时段 22:00–08:00 强制拦截，每用户每周 ≤ 3 次（FR-5-03）'],
    map: ['地点聚合', '仅下沉至城市 / 商圈级；原始坐标不进入任何后台查询（FR-4-02 · NFR-05）'],
    compliance: ['合规中心', '文案词库 / 数据请求 / 年龄门与夜间静默开关'],
    roles: ['角色权限', '按岗位最小必要授权，权限矩阵不可自行越权修改'],
    audit: ['操作日志', '全部后台操作留痕，含被拦截的越权与违规请求'],
  };

  function shell(inner) {
    const pending = A().skus.filter(s => s.status === 'pending').length;
    const [title, sub] = TITLES[S.path] || ['', ''];
    return `
    <div class="shell">
      <aside class="side" id="side">
        <div class="side-brand">
          <div class="lg">${icon('cup', 18)}</div>
          <div class="t">今晚喝点吗 · 运营后台<small>JVHD ADMIN CONSOLE</small></div>
        </div>
        <nav class="side-nav">
          ${NAV.map(n => n.grp ? `<div class="nav-grp">${n.grp}</div>` : `
            <button class="nav-item ${S.path === n.id ? 'on' : ''} ${allowed(n.id) ? '' : 'off'}" data-nav="${n.id}"${allowed(n.id) ? '' : ' title="当前角色无此模块权限"'}${allowed(n.id) ? '' : ' style="opacity:.34"'}>
              ${icon(n.ic, 17)}<span>${n.name}</span>
              ${typeof n.badge === 'function' && n.badge() ? `<span class="badge">${n.badge()}</span>` : ''}
            </button>`).join('')}
        </nav>
        <div class="side-user">
          <div class="av">${esc((S.session.name || '?').slice(0, 1))}</div>
          <div><div class="n">${esc(S.session.name)}</div><div class="r">${esc(S.session.role)}</div></div>
          <button class="out" id="logout" title="退出登录">${icon('logout', 17)}</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost side-fold" id="fold" style="padding:4px">${icon('grid', 18)}</button>
          <div class="crumb">运营后台 <span>/</span> <b>${title}</b></div>
          <span class="env">演示环境 · 数据已脱敏</span>
          <div class="top-search">${icon('search', 15)}<input id="gsearch" placeholder="搜索用户 / SKU / 文案" /></div>
          <button class="top-ico" title="待办" id="todo">${icon('flag', 18)}${pending ? '<span class="dot"></span>' : ''}</button>
          <button class="top-ico" title="帮助" id="help">${icon('info', 18)}</button>
          <div class="top-user"><div class="av">${esc((S.session.name || '?').slice(0, 1))}</div>${esc(S.session.name)}</div>
        </header>
        <main class="content" id="content">
          <div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div>${pageActions()}</div>
          ${inner}
        </main>
      </div>
    </div>`;
  }

  let actionsHTML = '';
  function pageActions() { const h = actionsHTML; actionsHTML = ''; return h; }

  /* ============================================================
     页面：登录
     ============================================================ */
  function viewLogin(err) {
    const accs = A().admins.filter(a => a.status === 'active');
    return `
    <div class="login">
      <div class="login-left">
        <div class="ll-brand"><div class="lg">${icon('cup', 20)}</div>
          <div><div class="t">今晚喝点吗</div><div class="s">反差型少喝 · 运营管理控制台</div></div></div>
        <div class="ll-mid">
          <h1>让每一次「今晚喝点吗」<br>都有<em>数据</em>可循。</h1>
          <p>后台只做四件事：配置规则、审核内容、看见克制、守住合规。<br>所有个体数据脱敏呈现，精确坐标不进入后台。</p>
          <div class="ll-feats">
            <div class="ll-feat"><div class="k">2,060</div><div class="d">本月「再想想」次数</div></div>
            <div class="ll-feat"><div class="k">36.0%</div><div class="d">拖延后最终选择不喝</div></div>
            <div class="ll-feat"><div class="k">14.4 万 g</div><div class="d">本月为用户省下的酒精</div></div>
            <div class="ll-feat"><div class="k">0</div><div class="d">购酒链接 / 广告位</div></div>
          </div>
        </div>
        <div class="ll-foot"><span>NFR-05 隐私最小必要</span><span>NFR-09 配置免发版</span><span>v1.0 原型</span></div>
      </div>
      <div class="login-right">
        <div class="login-box">
          <h2>登录运营后台</h2>
          <div class="sub">使用内部账号登录，操作全员留痕</div>
          <form class="frm" id="loginForm" autocomplete="off">
            <div><label>账号</label><input id="acc" value="${esc((accs[0] || {}).account || 'hekang')}" /></div>
            <div><label>密码</label><div class="pw"><input id="pwd" type="password" value="jvhd@2026" /><button type="button" id="eye">${icon('eye', 16)}</button></div></div>
            <div class="frm-row">
              <label class="chk"><input type="checkbox" checked />记住账号</label>
              <span style="color:var(--ad-primary-2);cursor:pointer" id="forgot">忘记密码？</span>
            </div>
            ${err ? `<div class="check-item err" style="margin-top:-4px">${icon('alert', 16)}<div>${esc(err)}</div></div>` : ''}
            <button class="login-btn" type="submit">登 录</button>
          </form>
          <div class="login-demo">
            <div class="t">演示账号（点击快速填入 · 不同角色看到的菜单不同）</div>
            <div class="demo-acc">
              ${accs.map(a => `<button type="button" data-acc="${a.account}">
                <span class="an">${esc(a.name.slice(0, 1))}</span><span>${esc(a.name)}</span>
                <span class="role">${esc(a.role)}</span></button>`).join('')}
            </div>
          </div>
          <div class="login-tip">演示密码统一为 <b>jvhd@2026</b>。此为原型环境，所有数据为本地模拟数据，不连接真实服务器。</div>
        </div>
      </div>
    </div>`;
  }

  function bindLogin(root) {
    const form = qs('#loginForm', root);
    qsa('[data-acc]', root).forEach(b => b.addEventListener('click', () => {
      const acc = A().admins.find(a => a.account === b.dataset.acc);
      qs('#acc', root).value = acc.account;
      qs('#pwd', root).value = 'jvhd@2026';
      qsa('[data-acc]', root).forEach(x => x.style.borderColor = '');
      b.style.borderColor = 'var(--ad-primary)';
    }));
    qs('#eye', root).addEventListener('click', () => {
      const p = qs('#pwd', root); p.type = p.type === 'password' ? 'text' : 'password';
    });
    qs('#forgot', root).addEventListener('click', () => toast('已向内部邮箱发送重置链接（模拟）', { icon: 'check' }));
    form.addEventListener('submit', e => {
      e.preventDefault();
      const account = qs('#acc', root).value.trim();
      const pwd = qs('#pwd', root).value;
      const acc = A().admins.find(a => a.account === account);
      if (!acc) return render(loginHtml('账号不存在，请使用下方演示账号'));
      if (acc.status !== 'active') return render(loginHtml('该账号已被停用，请联系超级管理员'));
      if (pwd !== 'jvhd@2026') return render(loginHtml('密码不正确（演示密码：jvhd@2026）'));
      acc.lastLogin = C.stamp();
      S.session = { name: acc.name, account: acc.account, role: acc.role, loginAt: C.stamp() };
      A().session = S.session;
      saveA();
      logOp('登录', '后台管理系统', 'success');
      toast(`欢迎回来，${acc.name}`, { icon: 'check' });
      S.path = acc.role === '数据分析' ? 'dashboard' : 'dashboard';
      go(S.path);
    });
  }
  function loginHtml(err) { return viewLogin(err); }

  /* ============================================================
     页面：运营看板
     ============================================================ */
  function viewDashboard() {
    const a = A();
    const last = a.trend[a.trend.length - 1], prev = a.trend[a.trend.length - 8];
    const totalD = a.decisions.reduce((s, d) => s + d.value, 0);
    const soberRate = a.decisions[1].value / totalD;
    const laterRate = a.cooldown.later / totalD;
    const afterLater = (a.cooldown.soberAfter / a.cooldown.later);
    actionsHTML = `<button class="btn" data-act="export">${icon('download', 15)} 导出报表</button>
      <button class="btn primary" data-act="refresh">${icon('refresh', 15)} 刷新数据</button>`;
    return shell(`
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="k">${icon('users', 14)} 日活用户 DAU</div>
          <div class="v">${fmtNum(Math.round(last.dau * 10000))}</div>
          <div class="d">${deltaEl(last.dau / prev.dau - 1)} 对比 7 日前 ${spark(a.trend, 'dau', '#2f6d58')}</div></div>
        <div class="kpi"><div class="k">${icon('ledger', 14)} 记录提交率</div>
          <div class="v">${pct(last.recordRate)}</div>
          <div class="d">${deltaEl(last.recordRate / prev.recordRate - 1)} 对比 7 日前 ${spark(a.trend, 'recordRate', '#8e2a33')}</div></div>
        <div class="kpi"><div class="k">${icon('leaf', 14)} 选择「不喝」占比</div>
          <div class="v">${pct(last.soberRatio)}</div>
          <div class="d">${deltaEl(last.soberRatio / a.trend[a.trend.length - 15].soberRatio - 1)} 对比半月前 ${spark(a.trend, 'soberRatio', '#b08a2e')}</div></div>
        <div class="kpi"><div class="k">${icon('target', 14)} 7 日留存</div>
          <div class="v">${pct(last.d7)}</div>
          <div class="d">${deltaEl(last.d7 - last.baseline)} 对比行业基准 ${pct(last.baseline)} ${spark(a.trend, 'd7', '#2f6d58')}</div></div>
      </div>

      <div class="grid g32" style="margin-bottom:14px">
        <div class="card2">
          <div class="card2-h"><div class="t">核心趋势 <span class="s">近 30 日</span></div>
            <div class="tabs" id="trendTabs"><button class="on" data-k="dau">日活</button><button data-k="recordRate">记录率</button><button data-k="soberRatio">不喝占比</button></div></div>
          <div class="card2-b" id="trendBox">
            ${lineChart(a.trend, { series: [{ key: 'dau', color: '#2f6d58', fill: true }, { key: 'baseline', color: '#b9c6c1', dashed: true }], fmtY: v => v.toFixed(1) + '万' })}
            <div class="legend" style="margin-top:8px"><span><i style="background:#2f6d58"></i>日活（万人）</span><span><i class="line" style="background:#b9c6c1"></i>成长基线</span></div>
          </div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">三选一决策分流 <span class="s">本月 ${fmtNum(totalD)} 次</span></div></div>
          <div class="card2-b" style="display:flex;align-items:center;gap:18px">
            ${donut([{ value: a.decisions[1].value, tone: '#79b58a' }, { value: a.decisions[2].value, tone: '#c98a2e' }, { value: a.decisions[0].value, tone: '#8e2a33' }], { center: pct(soberRate), centerSub: '直接不喝' })}
            <div style="flex:1;display:flex;flex-direction:column;gap:10px">
              ${a.decisions.map(d => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px">
                <i class="dotb" style="background:${d.tone}"></i><span>${d.label}</span>
                <b style="margin-left:auto;font-variant-numeric:tabular-nums">${fmtNum(d.value)}</b>
                <span style="color:var(--ad-text-3);width:44px;text-align:right">${pct(d.value / totalD)}</span></div>`).join('')}
            </div>
          </div>
          <div style="border-top:1px solid var(--ad-line);padding:12px 16px;font-size:12px;color:var(--ad-text-2);line-height:1.9">
            拖延冷却触发 <b>${fmtNum(a.cooldown.later)}</b> 次（${pct(laterRate)}），10 分钟后：
            不喝 <b style="color:var(--ad-green)">${fmtNum(a.cooldown.soberAfter)}</b> ·
            仍喝 <b>${fmtNum(a.cooldown.drinkAfter)}</b> ·
            未响应 <b>${fmtNum(a.cooldown.noResponse)}</b>
            <div style="color:var(--ad-text-3)">拖延后最终不喝转化率 ${pct(afterLater)}，高于直接决策的 ${pct(a.decisions[1].value / (a.decisions[0].value + a.decisions[1].value))}</div>
          </div>
        </div>
      </div>

      <div class="grid g3">
        <div class="card2">
          <div class="card2-h"><div class="t">决策漏斗</div><span class="s">本月</span></div>
          <div class="card2-b">${funnelChart(a.funnel)}</div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">克制成果 <span class="s">平台累计（估算）</span></div></div>
          <div class="card2-b">
            <div class="dl2 one" style="font-size:13px">
              <div class="r"><span class="k">用户累计少喝酒精</span><span class="v"><b>144,082</b> g</span></div>
              <div class="r"><span class="k">折合标准杯</span><span class="v">14,408 杯</span></div>
              <div class="r"><span class="k">为用户省下金额</span><span class="v"><b>¥ 648,369</b></span></div>
              <div class="r"><span class="k">折合热量</span><span class="v">1,008,574 kcal</span></div>
              <div class="r"><span class="k">相当于奶茶</span><span class="v">1,552 杯</span></div>
            </div>
            <div class="hint-bar" style="margin:12px 0 0;padding:10px 12px">${icon('info', 15)}<div>口径：少喝克数 = 基准 − 实际；省下金额 = 少喝克数 ÷ 10 × 45 元。</div></div>
          </div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">待办事项</div><span class="tag-badge tb-amber">${A().skus.filter(s => s.status === 'pending').length + A().copy.filter(c => c.status === 'draft').length} 项</span></div>
          <div class="card2-b" style="padding:6px 0">
            ${[
              { t: '自定义酒品待审核', n: A().skus.filter(s => s.status === 'pending').length, go: 'sku', ic: 'beer' },
              { t: '文案草稿待发布', n: A().copy.filter(c => c.status === 'draft').length, go: 'copy', ic: 'megaphone' },
              { t: '夜间推送被拦截', n: 1, go: 'audit', ic: 'bell' },
              { t: '子账号越权请求', n: 1, go: 'audit', ic: 'shield' },
              { t: '数据导出请求处理中', n: A().exports.filter(e => e.status === 'processing').length, go: 'users', ic: 'download' },
            ].map(x => `<button class="nav-item" data-go="${x.go}" style="width:calc(100% - 16px);margin:2px 8px;color:var(--ad-text)">
              <span style="color:var(--ad-text-3)">${icon(x.ic, 16)}</span><span>${x.t}</span>
              <span class="tag-badge tb-gray" style="margin-left:auto">${x.n}</span></button>`).join('')}
          </div>
        </div>
      </div>`);
  }

  function bindDashboard(root) {
    qsa('[data-go]', root).forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
    qsa('[data-act]', root).forEach(b => b.addEventListener('click', () => {
      if (b.dataset.act === 'refresh') { toast('数据已刷新（模拟实时聚合）', { icon: 'refresh' }); render(); }
      if (b.dataset.act === 'export') {
        if (!guard('报表导出（聚合）', '导出看板报表')) return;
        downloadCSV('jvhd-dashboard-' + today() + '.csv',
          ['日期,日活(万),记录率,7日留存,不喝占比'].concat(A().trend.map(d => `${d.date},${d.dau},${d.recordRate},${d.d7},${d.soberRatio}`)));
        toast('聚合报表已导出', { icon: 'download' });
      }
    }));
    qsa('#trendTabs button', root).forEach(b => b.addEventListener('click', () => {
      qsa('#trendTabs button', root).forEach(x => x.classList.toggle('on', x === b));
      const k = b.dataset.k;
      const conf = {
        dau: { series: [{ key: 'dau', color: '#2f6d58', fill: true }, { key: 'baseline', color: '#b9c6c1', dashed: true }], fmtY: v => v.toFixed(1) + '万' },
        recordRate: { series: [{ key: 'recordRate', color: '#8e2a33', fill: true }], fmtY: v => (v * 100).toFixed(0) + '%' },
        soberRatio: { series: [{ key: 'soberRatio', color: '#b08a2e', fill: true }], fmtY: v => (v * 100).toFixed(0) + '%' },
      }[k];
      qs('#trendBox', root).innerHTML = lineChart(A().trend, conf);
    }));
  }

  function downloadCSV(name, rows) {
    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
  }

  /* ============================================================
     页面：用户管理
     ============================================================ */
  function viewUsers() {
    const a = A();
    const st = S.q.users || { tab: 'all', kw: '', page: 1 };
    let list = a.users.slice();
    if (st.tab !== 'all') list = list.filter(u => st.tab === 'minor' ? u.minorMode : u.status === st.tab);
    if (st.kw) list = list.filter(u => (u.nick + u.id + u.city).includes(st.kw));
    const size = 8, page = Math.min(st.page, Math.max(1, Math.ceil(list.length / size)));
    const pageList = list.slice((page - 1) * size, page * size);
    actionsHTML = `<button class="btn" data-act="exportUsers">${icon('download', 15)} 导出用户明细</button>`;
    return shell(`
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="k">${icon('users', 14)} 注册用户</div><div class="v">12,486</div><div class="d">${deltaEl(0.084)} 本月新增 1,043</div></div>
        <div class="kpi"><div class="k">${icon('refresh', 14)} 7 日留存</div><div class="v">29.4<small>%</small></div><div class="d">${deltaEl(0.021)} 高于基准 19%</div></div>
        <div class="kpi"><div class="k">${icon('leaf', 14)} 本月无酒天数占比</div><div class="v">53<small>%</small></div><div class="d">${deltaEl(0.06)} 中位数 16 天</div></div>
        <div class="kpi"><div class="k">${icon('shield', 14)} 青年模式</div><div class="v">${a.users.filter(u => u.minorMode).length}<small> 位</small></div><div class="d">未满 18 岁，功能已收敛</div></div>
      </div>
      <div class="card2">
        <div class="toolbar">
          <div class="tabs" id="uTabs">
            ${[['all', '全部'], ['active', '正常'], ['silent', '沉默 7 天+'], ['churn', '流失预警'], ['minor', '青年模式']].map(([k, n]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}
          </div>
          <div class="grow"></div>
          <div class="search-box">${icon('search', 14)}<input id="uKw" placeholder="昵称 / 用户ID / 城市" value="${esc(st.kw)}" /></div>
          <button class="btn" id="uReset">重置</button>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>用户</th><th>城市</th><th>画像</th><th class="num">本月酒精</th><th class="num">记录</th><th class="num">地点</th><th class="num">连击</th><th>最近活跃</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
            ${pageList.map(u => `<tr class="rowh" data-uid="${u.id}">
              <td><div>${esc(u.nick)} ${u.minorMode ? '<span class="tag-badge tb-purple">青年</span>' : ''}</div><div class="sub mono">${u.id}</div></td>
              <td>${esc(u.city)}</td>
              <td><span class="tag-badge tb-gray">${esc(u.grade)}</span></td>
              <td class="num">${u.minorMode ? '—' : fmtNum(u.monthGrams) + ' g'}</td>
              <td class="num">${u.minorMode ? '—' : u.logs}</td>
              <td class="num">${u.places}</td>
              <td class="num">${u.streak} 天</td>
              <td class="sub">${esc(relDate(u.lastActive.slice(0, 10)))} ${esc(u.lastActive.slice(11))}</td>
              <td>${badge(u.status)}</td>
              <td><div class="ops"><a data-view="${u.id}">详情</a><a class="danger" data-del="${u.id}">删除</a></div></td>
            </tr>`).join('') || `<tr><td colspan="10"><div class="tbl-empty">${icon('search', 28)}<div>没有符合条件的用户</div></div></td></tr>`}
            </tbody>
          </table>
        </div>
        ${pager(list.length, page, size, '')}
      </div>`);
  }
  function bindUsers(root) {
    const st = () => S.q.users;
    qsa('#uTabs button', root).forEach(b => b.addEventListener('click', () => { st().tab = b.dataset.tab; st().page = 1; render(); }));
    const kw = qs('#uKw', root);
    kw.addEventListener('input', () => { st().kw = kw.value; st().page = 1; const v = kw.value; render(); const n = qs('#uKw'); if (n) { n.focus(); n.setSelectionRange(v.length, v.length); } });
    qs('#uReset', root).addEventListener('click', () => { S.q.users = { tab: 'all', kw: '', page: 1 }; render(); });
    bindPager(root, p => { st().page = p; render(); });
    qsa('[data-view]', root).forEach(a => a.addEventListener('click', e => { e.stopPropagation(); openUser(a.dataset.view); }));
    qsa('tr[data-uid]', root).forEach(tr => tr.addEventListener('click', () => openUser(tr.dataset.uid)));
    qsa('[data-del]', root).forEach(a => a.addEventListener('click', e => {
      e.stopPropagation();
      if (!guard('用户查看', '删除用户数据')) return;
      confirmModal('删除该用户全部数据？', '将按 FR-2-04 执行个人数据删除，记录、地点与决策事件一并清除，7 天内不可恢复。', () => {
        const u = A().users.find(x => x.id === a.dataset.del);
        A().users = A().users.filter(x => x.id !== a.dataset.del);
        saveA(); logOp('删除用户数据', a.dataset.del + '（' + (u ? u.nick : '') + '）');
        toast('已发起删除，等待用户端确认', { icon: 'trash' }); render();
      });
    }));
    qsa('[data-act="exportUsers"]', root).forEach(b => b.addEventListener('click', () => {
      if (!guard('报表导出（聚合）', '导出用户明细')) return;
      downloadCSV('jvhd-users-aggregate-' + today() + '.csv',
        ['用户ID,昵称,城市,画像,本月酒精(g),记录数,地点数,连击,最近活跃,状态']
          .concat(A().users.map(u => [u.id, u.nick, u.city, u.grade, u.minorMode ? '-' : u.monthGrams, u.minorMode ? '-' : u.logs, u.places, u.streak, u.lastActive, u.status].join(','))));
      logOp('导出聚合报表', '用户列表（不含精确坐标）');
      toast('已导出脱敏明细', { icon: 'download' });
    }));
  }

  function openUser(uid) {
    const a = A();
    const u = a.users.find(x => x.id === uid) || a.users[0];
    const d = a.userDetail;
    const logs = d.logs;
    const totalG = logs.reduce((s, l) => s + l.grams, 0);
    const maxDay = logs.reduce((m, l) => { const m2 = logs.filter(x => x.date === l.date).reduce((s, x) => s + x.grams, 0); return Math.max(m, m2); }, 0);
    const past = logs.map(l => ({ date: l.date, g: l.grams })).sort((x, y) => x.date < y.date ? -1 : 1);
    drawer({
      title: esc(u.nick) + ' · ' + u.id,
      sub: `注册 ${C.daysBetween(u.joinDate, today())} 天 · 渠道：${u.channel} · ${u.device}`,
      width: 620,
      body: `
        <div class="hint-bar">${icon('shield', 16)}<div>当前为<b>脱敏视图</b>：仅显示城市级地点名，原始坐标已加密且不进入后台查询范围。</div></div>
        <div class="sec-h">基础画像</div>
        <div class="dl2">
          <div class="r"><span class="k">性别 / 年龄</span><span class="v">${u.gender === 'male' ? '男' : '女'} / ${u.age} 岁</span></div>
          <div class="r"><span class="k">体重</span><span class="v">${u.weight} kg</span></div>
          <div class="r"><span class="k">城市</span><span class="v">${esc(u.city)}</span></div>
          <div class="r"><span class="k">用户类型</span><span class="v">${esc(u.grade)}</span></div>
          <div class="r"><span class="k">本月酒精</span><span class="v">${u.minorMode ? '—— 青年模式不记录' : fmtNum(u.monthGrams) + ' g / ' + u.logs + ' 条'}</span></div>
          <div class="r"><span class="k">无酒连击</span><span class="v">${u.streak} 天（最佳 ${u.bestStreak} 天）</span></div>
        </div>
        <div class="sec-h">近 60 天记录 <span style="font-weight:400;color:var(--ad-text-3);font-size:11.5px">累计 ${totalG.toFixed(1)} g · 峰值日 ${maxDay.toFixed(1)} g</span></div>
        ${logs.length ? lineChart(past, { h: 150, series: [{ key: 'g', color: '#8e2a33', fill: true }], fmtY: v => Math.round(v) + 'g' }) : `<div class="tbl-empty">该用户为青年模式，不产生饮酒记录</div>`}
        <div class="sec-h">最近记录明细</div>
        <div class="tbl-wrap" style="border:1px solid var(--ad-line);border-radius:10px">
          <table class="tbl"><thead><tr><th>日期</th><th>酒品</th><th class="num">酒精</th><th>场景</th><th>地点（城市级）</th></tr></thead>
          <tbody>${logs.slice(0, 6).map(l => `<tr><td class="mono">${l.date.slice(5)}</td><td>${esc(l.name)} ×${l.qty}</td>
            <td class="num">${l.grams.toFixed(1)} g</td><td><span class="tag-badge tb-gray">${esc(l.scene)}</span></td>
            <td class="sub">${esc(l.city)} · ${esc(l.place)}</td></tr>`).join('') || '<tr><td colspan="5"><div class="tbl-empty">无记录</div></td></tr>'}</tbody></table>
        </div>
        <div class="sec-h">操作流水</div>
        <div class="logbox">${d.actions.map(x => `<span class="m">${esc(x.ts)}</span>  <span class="k">${esc(x.action)}</span>  ${esc(x.target)}`).join('\n')}</div>`,
      footer: `<button class="btn" data-dact="export">${icon('download', 15)} 导出个人数据</button>
        <button class="btn danger" data-dact="del">删除用户数据</button>`,
      onMount(el) {
        qs('[data-dact="export"]', el).addEventListener('click', () => {
          if (!guard('数据导出', '导出个人原始数据')) return;
          modal({
            title: '二次验证', width: 380,
            body: `<div class="fg"><label>请联系合规复核人获取动态口令</label>
              <input id="otp" placeholder="6 位动态口令（演示：任意 6 位数字）" maxlength="6" /></div>
              <div class="fg" style="margin-top:12px"><div class="hint">导出将记录请求人、复核人与用途，文件 24 小时后自动失效。</div></div>`,
            actions: [{ label: '取消' }, {
              label: '确认导出', cls: 'btn primary', onClick(mask, close) {
                const v = qs('#otp', mask).value.trim();
                if (!/^\d{6}$/.test(v)) { toast('请输入 6 位动态口令', { icon: 'alert' }); return false; }
                A().exports.unshift({ id: 'EX' + today().replace(/-/g, ''), user: u.id, type: '全部个人数据', format: 'CSV', status: 'processing', createdAt: C.stamp().slice(0, 16), expires: '', size: '—' });
                saveA(); logOp('导出个人数据', u.id + '（已二次验证）');
                toast('已生成导出任务，用户端可下载', { icon: 'check' }); close();
              },
            }],
          });
        });
        qs('[data-dact="del"]', el).addEventListener('click', () => {
          if (!guard('用户查看', '删除用户数据')) return;
          confirmModal('删除该用户全部数据？', '删除后不可恢复，将写入审计日志。', () => {
            A().users = A().users.filter(x => x.id !== u.id); saveA();
            logOp('删除用户数据', u.id); closeDrawer(); toast('已删除', { icon: 'trash' }); render();
          });
        });
      },
    });
  }

  function confirmModal(title, text, onOk) {
    modal({
      title, width: 420, body: `<div style="font-size:13px;line-height:1.8;color:var(--ad-text-2)">${esc(text)}</div>`,
      actions: [{ label: '取消' }, { label: '确认', cls: 'btn danger', onClick(m, close) { onOk(); close(); } }],
    });
  }

  /* ============================================================
     页面：酒库管理
     ============================================================ */
  function viewSku() {
    const a = A();
    const st = S.q.sku || { tab: 'all', cat: 'all', kw: '', page: 1 };
    let list = a.skus.slice();
    if (st.tab === 'pending') list = list.filter(s => s.status === 'pending');
    else if (st.tab === 'online') list = list.filter(s => s.status === 'online');
    else if (st.tab === 'custom') list = list.filter(s => s.custom);
    if (st.cat !== 'all') list = list.filter(s => s.cat === st.cat);
    if (st.kw) list = list.filter(s => (s.name + s.id).toLowerCase().includes(st.kw.toLowerCase()));
    const size = 10, page = Math.min(st.page, Math.max(1, Math.ceil(list.length / size)));
    const pageList = list.slice((page - 1) * size, page * size);
    const pend = a.skus.filter(s => s.status === 'pending');
    actionsHTML = `<button class="btn" data-act="new">${icon('plus', 15)} 新增 SKU</button>
      <button class="btn" data-act="import">${icon('upload', 15)} 批量导入</button>`;
    return shell(`
      <div class="meta-strip" style="margin-bottom:14px">
        <span>公库 SKU <b>${a.skus.length + 1981}</b></span>
        <span>自定义待审核 <b style="color:var(--ad-amber)">${pend.length}</b></span>
        <span>本月新增 <b>37</b></span>
        <span>换算方式 <b>ml × %vol ÷ 100 × 0.789</b></span>
        <span>最近同步 <b>今天 09:00</b></span>
      </div>
      ${pend.length ? `<div class="hint-bar warn">${icon('alert', 16)}<div>有 <b>${pend.length}</b> 条用户自定义酒品待审核。审核通过后立即进入用户端酒铺并同步到所有端（免发版）。</div></div>` : ''}
      <div class="card2">
        <div class="toolbar">
          <div class="tabs" id="sTabs">
            ${[['all', '全部'], ['pending', '待审核'], ['online', '已上线'], ['custom', '用户自定义']].map(([k, n]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${n}</button>`).join('')}
          </div>
          <select class="input-sm" id="sCat"><option value="all">全部酒类</option>
            ${M.CATS.map(c => `<option value="${c.id}" ${st.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
          <div class="grow"></div>
          <div class="search-box">${icon('search', 14)}<input id="sKw" placeholder="酒品名称 / ID" value="${esc(st.kw)}" /></div>
        </div>
        <div class="tbl-wrap">
          <table class="tbl">
            <thead><tr><th>酒品</th><th>酒类</th><th class="num">酒精度</th><th class="num">单份容量</th><th class="num">单份酒精</th><th class="num">使用次数</th><th>来源</th><th>状态</th><th>更新</th><th>操作</th></tr></thead>
            <tbody>
            ${pageList.map(s => {
              const g = C.alcoholG(s.size, s.abv);
              return `<tr data-sid="${s.id}">
                <td><div>${esc(s.name)}</div><div class="sub mono">${s.id}</div></td>
                <td><span class="tag-badge tb-gray">${esc(s.catName)}</span></td>
                <td class="num">${s.abv}%vol</td>
                <td class="num">${s.size} ml / ${esc(s.unit)}</td>
                <td class="num"><b>${g.toFixed(1)} g</b> <span class="sub">· ${(g / 10).toFixed(1)} 杯</span></td>
                <td class="num">${fmtNum(s.votes)}</td>
                <td>${s.custom ? '<span class="tag-badge tb-blue">用户提交</span>' : '<span class="sub">系统公库</span>'}</td>
                <td>${badge(s.status)}</td>
                <td class="sub">${esc(relDate(s.updatedAt))}</td>
                <td><div class="ops">${s.status === 'pending'
                  ? `<a data-pass="${s.id}">通过</a><a class="danger" data-rej="${s.id}">驳回</a>`
                  : `<a data-edit="${s.id}">编辑</a><a class="danger" data-off="${s.id}">下线</a>`}</div></td>
              </tr>`;
            }).join('') || `<tr><td colspan="10"><div class="tbl-empty">${icon('beer', 28)}<div>没有符合条件的酒品</div></div></td></tr>`}
            </tbody>
          </table>
        </div>
        ${pager(list.length, page, size)}
      </div>`);
  }
  function bindSku(root) {
    const getSt = () => {
      if (!S.q.sku) S.q.sku = { tab: 'all', cat: 'all', kw: '', page: 1 };
      return S.q.sku;
    };
    const st = getSt();
    qsa('#sTabs [data-tab]', root).forEach(b => b.addEventListener('click', () => {
      const cur = getSt();
      cur.tab = b.getAttribute('data-tab') || 'all'; cur.page = 1; render();
    }));
    qs('#sCat', root).addEventListener('change', e => { st.cat = e.target.value; st.page = 1; render(); });
    const kw = qs('#sKw', root);
    kw.addEventListener('input', () => { st.kw = kw.value; st.page = 1; render(); const n = qs('#sKw'); if (n) { n.focus(); n.setSelectionRange(kw.value.length, kw.value.length); } });
    bindPager(root, p => { st.page = p; render(); });
    qsa('[data-pass]', root).forEach(a => a.addEventListener('click', () => {
      if (!guard('酒库审核', '审核酒库')) return;
      const s = A().skus.find(x => x.id === a.dataset.pass);
      s.status = 'online'; s.updatedAt = today();
      saveA(); logOp('审核酒库', `SKU ${s.id}（${s.name}）通过`);
      toast(`「${s.name}」已上线，所有端即时可见`, { icon: 'check' }); render();
    }));
    qsa('[data-rej]', root).forEach(a => a.addEventListener('click', () => {
      if (!guard('酒库审核', '审核酒库')) return;
      const s = A().skus.find(x => x.id === a.dataset.rej);
      modal({
        title: '驳回自定义酒品', width: 440,
        body: `<div class="fg"><label>酒品</label><input value="${esc(s.name)}" disabled /></div>
          <div class="fg" style="margin-top:12px"><label>驳回原因（将通知提交用户）</label>
          <div class="radios" style="flex-direction:column;align-items:stretch">
            ${['名称不规范或含营销信息', '酒精度明显异常，无法换算', '疑似与他品重复', '其他'].map((r, i) => `<label><input type="radio" name="rj" ${i === 0 ? 'checked' : ''}/>${r}</label>`).join('')}
          </div></div>`,
        actions: [{ label: '取消' }, { label: '确认驳回', cls: 'btn danger', onClick(m, close) {
          s.status = 'rejected'; s.updatedAt = today(); saveA();
          logOp('驳回酒库', `SKU ${s.id}（${s.name}）`); toast('已驳回并通知用户', { icon: 'x' }); close(); render();
        } }],
      });
    }));
    qsa('[data-off]', root).forEach(a => a.addEventListener('click', () => {
      if (!guard('酒库审核', '下线酒品')) return;
      const s = A().skus.find(x => x.id === a.dataset.off);
      s.status = s.status === 'offline' ? 'online' : 'offline'; s.updatedAt = today(); saveA();
      logOp(s.status === 'offline' ? '下线酒库' : '上线酒库', `SKU ${s.id}`); render();
    }));
    qsa('[data-edit]', root).forEach(a => a.addEventListener('click', () => openSkuEdit(a.dataset.edit)));
    qs('[data-act="new"]', root).addEventListener('click', () => openSkuEdit(null));
    qs('[data-act="import"]', root).addEventListener('click', () => {
      if (!guard('酒库审核', '批量导入')) return;
      modal({ title: '批量导入 SKU', width: 460,
        body: `<div class="fg"><label>CSV 模板字段</label><div class="hint">name, cat, abv, size, unit —— 每行一个酒品，系统自动按 0.789 换算单份酒精量。</div></div>
          <div class="tbl-empty" style="border:1px dashed var(--ad-line-2);border-radius:10px;margin-top:12px;padding:28px">${icon('upload', 26)}<div>点击选择文件（演示环境：模拟导入 12 条）</div></div>`,
        actions: [{ label: '取消' }, { label: '模拟导入', cls: 'btn primary', onClick(m, close) { toast('导入完成：新增 12 条，0 条异常', { icon: 'check' }); logOp('批量导入', '酒库 SKU ×12'); close(); } }] });
    });
  }
  function openSkuEdit(id) {
    if (!guard('酒库审核', id ? '编辑酒品' : '新增酒品')) return;
    const s = id ? A().skus.find(x => x.id === id) : { id: '', cat: 'beer', name: '', abv: 4.5, size: 500, unit: '听' };
    const calc = (abv, size) => (Math.max(0, size * abv / 100 * 0.789)).toFixed(1);
    drawer({
      title: id ? '编辑酒品' : '新增酒品', sub: '保存后即时同步至小程序酒铺（免发版）', width: 480,
      body: `<div class="form-grid">
        <div class="fg full"><label>酒品名称 <span class="req">*</span></label><input id="f-name" value="${esc(s.name)}" placeholder="如：青岛啤酒 经典" /></div>
        <div class="fg"><label>酒类 <span class="req">*</span></label><select id="f-cat">${M.CATS.map(c => `<option value="${c.id}" ${c.id === s.cat ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div>
        <div class="fg"><label>单份单位</label><select id="f-unit">${['听', '瓶', '杯', '碗', '扎', '份'].map(u => `<option ${u === s.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="fg"><label>酒精度 %vol</label><input id="f-abv" type="number" step="0.1" value="${s.abv}" /></div>
        <div class="fg"><label>单份容量 ml</label><input id="f-size" type="number" value="${s.size}" /></div>
        <div class="fg full"><label>换算预览</label><div class="hint" style="padding:10px 12px;background:var(--ad-primary-soft);border-radius:8px" id="f-prev"></div></div>
      </div>`,
      footer: `<button class="btn" data-close>取消</button><button class="btn primary" id="f-save">保存并上线</button>`,
      onMount(el, close) {
        const prev = () => {
          const abv = +qs('#f-abv', el).value || 0, size = +qs('#f-size', el).value || 0;
          qs('#f-prev', el).innerHTML = `${size} ml × ${abv}%vol ÷ 100 × 0.789 = <b>${calc(abv, size)} g</b> 酒精 · 约 <b>${(calc(abv, size) / 10).toFixed(2)}</b> 标准杯`;
        };
        prev();
        qs('#f-abv', el).addEventListener('input', prev); qs('#f-size', el).addEventListener('input', prev);
        qs('#f-save', el).addEventListener('click', () => {
          const name = qs('#f-name', el).value.trim();
          if (!name) { qs('#f-name', el).classList.add('invalid'); return toast('请填写酒品名称', { icon: 'alert' }); }
          const cat = qs('#f-cat', el).value;
          const data = { name, cat, catName: M.CATS.find(c => c.id === cat).name, abv: +qs('#f-abv', el).value, size: +qs('#f-size', el).value, unit: qs('#f-unit', el).value, status: 'online', updatedAt: today() };
          if (id) Object.assign(s, data);
          else A().skus.unshift({ id: 'n' + Date.now().toString().slice(-6), votes: 0, createdAt: today(), custom: false, ...data });
          saveA(); logOp(id ? '编辑酒库' : '新增酒库', 'SKU ' + name);
          toast('已保存，用户端酒铺即时生效', { icon: 'check' }); close(); render();
        });
      },
    });
  }

  /* ============================================================
     页面：文案库
     ============================================================ */
  const BANNED = ['干了', '不醉不归', '拼酒', '罚酒', '斗酒', '感情深'];
  function checkCopy(text) {
    const errs = BANNED.filter(w => text.includes(w)).map(w => ({ level: 'err', text: `命中禁用词「${w}」：违反文案规范，请改写动作，不使用劝酒/斗酒表达。` }));
    if (/购买|下单|优惠|打折|￥|¥\d|扫码买/.test(text)) errs.push({ level: 'err', text: '含购酒/促销语，违反“不卖酒、无广告”底线。' });
    if (/你必须|你应该|你活该/.test(text)) errs.push({ level: 'warn', text: '含评价性指令，建议改为中性陈述（原则：不评判、不说教）。' });
    const vars = text.match(/\{[a-z]+\}/gi) || [];
    const allowed = ['pct', 'money', 'milktea', 'n', 'year', 'month', 'count', 'g'];
    vars.forEach(v => { if (allowed.indexOf(v.slice(1, -1)) < 0) errs.push({ level: 'err', text: `变量 ${v} 不在可用变量表（${allowed.map(x => '{' + x + '}').join(' ')}）。` }); });
    if (!errs.length) errs.push({ level: 'ok', text: '通过：未命中禁用词、导购语与非法变量，可提交合规审核。' });
    return errs;
  }
  function viewCopy() {
    const a = A();
    const st = S.q.copy || { scene: 'all', kw: '' };
    let list = a.copy.slice();
    if (st.scene !== 'all') list = list.filter(c => c.scene === st.scene);
    if (st.kw) list = list.filter(c => (c.title + c.content + c.key).includes(st.kw));
    const scenes = ['反馈卡', '不喝反馈', '拖延机制', '克制地图', '小游戏', '分享图'];
    actionsHTML = `<button class="btn primary" data-act="new">${icon('plus', 15)} 新建文案</button>`;
    return shell(`
      <div class="grid g23" style="align-items:start">
        <div class="card2">
          <div class="toolbar">
            <select class="input-sm" id="cScene"><option value="all">全部场景</option>${scenes.map(s => `<option ${st.scene === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <div class="grow"></div>
            <div class="search-box">${icon('search', 14)}<input id="cKw" placeholder="标题 / 内容 / key" value="${esc(st.kw)}" /></div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr><th>文案</th><th>场景</th><th class="num">权重</th><th>状态</th><th>更新</th><th>操作</th></tr></thead>
              <tbody>${list.map(c => `<tr data-cid="${c.id}">
                <td style="white-space:normal;max-width:360px"><div>${esc(c.title)}</div><div class="sub mono">${esc(c.key)}</div></td>
                <td><span class="tag-badge tb-gray">${esc(c.scene)}</span></td>
                <td class="num">${c.weight}</td>
                <td>${badge(c.status)}</td>
                <td class="sub">${esc(relDate(c.updatedAt))}</td>
                <td><div class="ops"><a data-cedit="${c.id}">编辑</a>${c.status === 'online' ? `<a class="danger" data-cpause="${c.id}">暂停</a>` : `<a data-cpub="${c.id}">发布</a>`}</div></td>
              </tr>`).join('') || `<tr><td colspan="6"><div class="tbl-empty">无匹配文案</div></td></tr>`}</tbody>
            </table>
          </div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">合规词库 <span class="s">实时生效</span></div><span class="tag-badge tb-red">${BANNED.length} 个禁用词</span></div>
          <div class="card2-b">
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">${BANNED.map(w => `<span class="tag-badge tb-red">${w}</span>`).join('')}</div>
            <div class="hint-bar warn" style="margin:0">${icon('alert', 15)}<div>文案原则：不劝酒、不评判、不说教；只用中性描述，避免“你应该”“活该”。</div></div>
            <div class="sec-h">命中统计（本月）</div>
            ${[['干了', 3], ['感情深', 1], ['购酒链接', 1], ['活该', 0]].map(([w, n]) => `<div style="display:flex;justify-content:space-between;font-size:12.5px;padding:6px 0;border-bottom:1px dashed #edf0ee"><span>${w}</span><b>${n}</b></div>`).join('')}
            <div class="sec-h">最近拦截</div>
            <div class="logbox" style="max-height:150px"><span class="e">11-10 14:22</span> 驳回 cy12「干了——这杯白开水。」
<span class="w">11-14 09:41</span> 提示：含「你应该」→ 已改写
<span class="e">11-16 20:05</span> 拦截：分享图含购酒二维码</div>
          </div>
        </div>
      </div>`);
  }
  function bindCopy(root) {
    const st = S.q.copy;
    qs('#cScene', root).addEventListener('change', e => { st.scene = e.target.value; render(); });
    const kw = qs('#cKw', root);
    kw.addEventListener('input', () => { st.kw = kw.value; render(); const n = qs('#cKw'); if (n) { n.focus(); n.setSelectionRange(kw.value.length, kw.value.length); } });
    qsa('[data-cedit]', root).forEach(a => a.addEventListener('click', () => openCopyEdit(a.dataset.cedit)));
    qsa('[data-cpub]', root).forEach(a => a.addEventListener('click', () => {
      const c = A().copy.find(x => x.id === a.dataset.cpub);
      const bad = checkCopy(c.content).some(e => e.level === 'err');
      if (bad) return toast('该文案未通过合规校验，请先修改', { icon: 'alert' });
      c.status = 'online'; c.updatedAt = today(); saveA(); logOp('发布文案', c.id + ' ' + c.title);
      toast('已发布', { icon: 'check' }); render();
    }));
    qsa('[data-cpause]', root).forEach(a => a.addEventListener('click', () => {
      const c = A().copy.find(x => x.id === a.dataset.cpause);
      c.status = 'paused'; c.updatedAt = today(); saveA(); logOp('暂停文案', c.id); render();
    }));
    qs('[data-act="new"]', root).addEventListener('click', () => openCopyEdit(null));
  }
  function openCopyEdit(id) {
    if (!can('文案库')) return guard('文案库', '编辑文案');
    const c = id ? A().copy.find(x => x.id === id) : { id: '', key: 'feedback.pct', title: '', content: '', scene: '反馈卡', status: 'draft', weight: 100 };
    drawer({
      title: id ? '编辑文案' : '新建文案', sub: '发布前自动跑合规校验，实时预览效果', width: 560,
      body: `<div class="form-grid">
        <div class="fg full"><label>标题 <span class="req">*</span></label><input id="c-title" value="${esc(c.title)}" /></div>
        <div class="fg"><label>文案 Key</label><input id="c-key" value="${esc(c.key)}" class="mono" /></div>
        <div class="fg"><label>场景</label><select id="c-scene">${['反馈卡', '不喝反馈', '拖延机制', '克制地图', '小游戏', '分享图'].map(s => `<option ${s === c.scene ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="fg full"><label>正文 <span class="req">*</span></label><textarea id="c-body" rows="4">${esc(c.content)}</textarea>
          <div class="hint">可用变量：{pct} {money} {milktea} {n} {year} {month} {count}</div></div>
        <div class="fg full"><label>小程序预览</label>
          <div id="c-prev" style="background:#12100f;color:#eee;border-radius:12px;padding:16px 16px 14px">
            <div style="font-size:11px;color:#d8a054;letter-spacing:.1em">今晚喝点吗 · ${esc(c.scene)}</div>
            <div id="c-prev-t" style="font-size:17px;line-height:1.6;margin-top:8px"></div>
          </div></div>
        <div class="fg full"><label>合规校验</label><div class="check-list" id="c-check"></div></div>
      </div>`,
      footer: `<button class="btn" id="c-draft">存草稿</button><button class="btn primary" id="c-publish">校验并发布</button>`,
      onMount(el, close) {
        const body = qs('#c-body', el);
        const render2 = () => {
          const vars = { pct: '58', money: '286', milktea: '3.1', n: '4', year: '2026', month: '11', count: '6', g: '128' };
          const t = body.value.replace(/\{([a-z]+)\}/gi, (m, k) => vars[k] != null ? vars[k] : m);
          qs('#c-prev-t', el).textContent = t || '（正文预览）';
          qs('#c-check', el).innerHTML = checkCopy(body.value).map(r => `<div class="check-item ${r.level}">${icon(r.level === 'ok' ? 'check' : r.level === 'warn' ? 'alert' : 'x', 15)}<div>${esc(r.text)}</div></div>`).join('');
        };
        render2();
        body.addEventListener('input', render2);
        qs('#c-draft', el).addEventListener('click', () => { commit('draft'); });
        qs('#c-publish', el).addEventListener('click', () => {
          const bad = checkCopy(body.value).some(r => r.level === 'err');
          if (bad) return toast('存在阻断项，无法发布', { icon: 'x' });
          if (!can('文案审核')) return guard('文案审核', '发布文案');
          commit('online');
        });
        function commit(status) {
          const d = { title: qs('#c-title', el).value.trim() || '未命名文案', key: qs('#c-key', el).value.trim(), content: body.value, scene: qs('#c-scene', el).value, status, weight: c.weight, updatedAt: today() };
          if (id) Object.assign(c, d); else A().copy.unshift({ id: 'cy' + (A().copy.length + 1).toString().padStart(2, '0'), ...d });
          saveA(); logOp(status === 'online' ? '发布文案' : '保存文案草稿', d.key);
          toast(status === 'online' ? '已发布并实时下发' : '已存为草稿', { icon: 'check' }); close(); render();
        }
      },
    });
  }

  /* ============================================================
     页面：无醇替代
     ============================================================ */
  function viewAlts() {
    const a = A();
    actionsHTML = `<button class="btn primary" data-act="newAlt">${icon('plus', 15)} 新增替代方案</button>`;
    return shell(`
      <div class="hint-bar">${icon('leaf', 16)}<div>无醇替代仅作为记录后的“换一杯”建议，<b>不展示购买渠道、价格与品牌广告</b>。</div></div>
      <div class="grid g3">
        ${M.CATS.filter(c => a.alts.some(t => t.match === c.name)).map(c => {
          const items = a.alts.filter(t => t.match === c.name);
          return `<div class="card2">
            <div class="card2-h"><div class="t">${icon(c.icon, 16)} ${c.name}</div><span class="s">${items.filter(i => i.status === 'online').length}/${items.length} 在线</span></div>
            <div class="card2-b" style="padding:8px 12px">
              ${items.map(i => `<div style="display:flex;gap:10px;padding:10px 2px;border-bottom:1px dashed #edf0ee">
                <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500">${esc(i.name)}</div>
                  <div class="sub" style="margin-top:3px;line-height:1.6;white-space:normal">${esc(i.desc)}</div></div>
                <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none">
                  ${badge(i.status)}
                  <button class="btn ghost" style="padding:2px 8px;font-size:11.5px" data-tog="${i.id}">${i.status === 'online' ? '停用' : '启用'}</button>
                </div></div>`).join('')}
            </div></div>`;
        }).join('')}
        <div class="card2">
          <div class="card2-h"><div class="t">替换效果</div><span class="s">近 30 日</span></div>
          <div class="card2-b">
            <div class="dl2 one" style="font-size:12.5px">
              <div class="r"><span class="k">记录后点击「换无醇」</span><span class="v"><b>1,284</b> 次</span></div>
              <div class="r"><span class="k">其中真实改喝无醇</span><span class="v"><b>412</b> 次（32.1%）</span></div>
              <div class="r"><span class="k">折算少喝酒精</span><span class="v">2,860 g</span></div>
              <div class="r"><span class="k">最常用替代</span><span class="v">无醇啤酒 0.0%</span></div>
            </div>
            ${barChart(a.alts.filter(i => i.status === 'online').slice(0, 4).map((i, k) => ({ label: i.name.slice(0, 6), value: [412, 286, 201, 133][k] || 60, tone: '#2f6d58' })), { h: 170 })}
          </div>
        </div>
      </div>`);
  }
  function bindAlts(root) {
    qsa('[data-tog]', root).forEach(b => b.addEventListener('click', () => {
      if (!can('替代推荐')) return guard('替代推荐', '调整替代方案');
      const it = A().alts.find(x => x.id === b.dataset.tog);
      it.status = it.status === 'online' ? 'paused' : 'online'; saveA(); logOp('调整替代推荐', it.name); render();
    }));
    qs('[data-act="newAlt"]', root).addEventListener('click', () => {
      if (!can('替代推荐')) return guard('替代推荐', '新增替代方案');
      modal({ title: '新增无醇替代', width: 460, body: `<div class="form-grid">
        <div class="fg full"><label>替代名称</label><input id="a-name" placeholder="如：无醇 IPA" /></div>
        <div class="fg"><label>对应酒类</label><select id="a-match">${M.CATS.map(c => `<option>${c.name}</option>`).join('')}</select></div>
        <div class="fg"><label>状态</label><select id="a-st"><option value="online">上线</option><option value="draft">草稿</option></select></div>
        <div class="fg full"><label>说明（不得含购买信息）</label><textarea id="a-desc" placeholder="口感/场景说明"></textarea></div></div>`,
        actions: [{ label: '取消' }, { label: '保存', cls: 'btn primary', onClick(m, close) {
          const name = qs('#a-name', m).value.trim(); if (!name) return toast('请填写名称', { icon: 'alert' });
          A().alts.push({ id: 'a' + Date.now(), name, match: qs('#a-match', m).value, desc: qs('#a-desc', m).value || '—', status: qs('#a-st', m).value });
          saveA(); logOp('新增替代推荐', name); close(); render();
        } }] });
    });
  }

  /* ============================================================
     页面：阈值与规则
     ============================================================ */
  function viewThresholds() {
    const a = A();
    actionsHTML = `<button class="btn" data-act="history">${icon('clock', 15)} 变更记录</button>`;
    return shell(`
      <div class="hint-bar warn">${icon('alert', 16)}<div>阈值改动保存后<b>立即下发</b>至全部在线小程序（无需发版）。标记为「合规强制 / 隐私」的项受保护，不可关闭、不可调大。</div></div>
      <div class="grid g2" style="align-items:start">
        <div class="card2">
          <div class="card2-h"><div class="t">健康与换算阈值</div></div>
          <div class="card2-b" style="padding:4px 16px 8px">
            ${a.thresholds.map(t => `<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f0f2f1">
              <div style="flex:1;min-width:0"><div style="font-size:13px">${esc(t.name)}</div>
                <div class="sub" style="margin-top:3px">${esc(t.key)} · <span class="mono">${esc(t.scope)}</span> · ${esc(t.by)} ${esc(relDate(t.updatedAt))} 更新</div></div>
              <div style="display:flex;align-items:center;gap:6px;flex:none">
                <input class="input-sm num" style="width:84px;text-align:right" data-th="${t.key}" value="${esc(t.value)}" ${t.scope === '合规强制' ? 'disabled' : ''} />
                <span class="sub" style="width:44px">${esc(t.unit) || '—'}</span>
                <button class="btn ghost" style="padding:3px 8px;font-size:11.5px" data-thsave="${t.key}">保存</button>
              </div>
            </div>`).join('')}
          </div>
        </div>
        <div>
          <div class="card2" style="margin-bottom:14px">
            <div class="card2-h"><div class="t">规则开关</div><span class="s">全局</span></div>
            <div class="card2-b">
              ${[['minorGate', '未满 18 岁进入青年模式', true], ['nightQuiet', '22:00–08:00 禁止推送', true], ['locationEncrypt', '地点坐标加密存储', true], ['exportNeed2fa', '个人数据导出需二次验证', true], ['targetUp', '开启广告位与购酒跳转', false]].map(([k, n, locked]) => `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0f2f1">
                  <div style="flex:1"><div style="font-size:13px">${n}</div>${locked ? '<div class="sub" style="margin-top:2px;color:var(--ad-red)">合规强制 · 不可关闭</div>' : '<div class="sub" style="margin-top:2px">与平台底线冲突，禁止开启</div>'}</div>
                  <div class="sw2 ${a.config[k] ? 'on' : ''} ${locked ? 'lock' : ''}" data-cfg="${k}" title="${locked ? '合规强制项，不可关闭' : '平台底线，不可开启'}"></div>
                </div>`).join('')}
            </div>
          </div>
          <div class="card2">
            <div class="card2-h"><div class="t">换算口径说明</div></div>
            <div class="card2-b">
              <div class="logbox" style="max-height:none"><span class="k">酒精克数</span> = ml × %vol ÷ 100 × <span class="w">0.789</span>
<span class="k">标准杯</span>   = 酒精克数 ÷ 10
<span class="k">省下金额</span> = 少喝克数 ÷ 10 × 单杯均价(45)
<span class="k">少喝%</span>    = (基准 − 本月) ÷ 基准</div>
              <div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ad-text-3);line-height:1.8">
                超量提示阈值：男 60g / 女 40g；膳食指南建议上限：男 25g / 女 15g。<br>
                每日 0 点按用户性别自动匹配，性别缺失时按女（更保守）处理。
              </div>
            </div>
          </div>
        </div>
      </div>`);
  }
  function bindThresholds(root) {
    qsa('[data-cfg]', root).forEach(s => s.addEventListener('click', () => {
      const k = s.dataset.cfg;
      A().config[k] = false; saveA();
      modal({ title: '操作被拒绝', width: 420,
        body: `<div class="check-item err" style="margin:0">${icon('x', 16)}<div>该开关属于平台合规底线，任何角色均不可修改。本次尝试已写入审计日志。</div></div>`,
        actions: [{ label: '知道了', cls: 'btn primary' }] });
      logOp('尝试修改合规配置', k, 'denied');
    }));
    qsa('[data-thsave]', root).forEach(b => b.addEventListener('click', () => {
      if (!can('阈值配置')) return guard('阈值配置', '修改阈值');
      const key = b.dataset.thsave;
      const t = A().thresholds.find(x => x.key === key);
      const input = qs(`[data-th="${key}"]`, root);
      const v = input.value.trim();
      if (!v || isNaN(+v) && !/\d\d:\d\d/.test(v)) { input.classList.add('invalid'); return toast('请输入合法数值', { icon: 'alert' }); }
      if (key === 'remindMaxPerWeek' && +v > 3) { input.classList.add('invalid'); return toast('每周提醒次数不得超过 3 次（合规强制）', { icon: 'alert' }); }
      if (key === 'cooldownMinutes' && (+v < 1 || +v > 60)) { input.classList.add('invalid'); return toast('冷却时长需在 1–60 分钟', { icon: 'alert' }); }
      input.classList.remove('invalid');
      const old = t.value;
      if (old === v) return toast('数值未变化', { icon: 'info' });
      modal({ title: '确认修改阈值', width: 440,
        body: `<div class="dl2 one"><div class="r"><span class="k">配置项</span><span class="v">${esc(t.name)}</span></div>
          <div class="r"><span class="k">变更</span><span class="v"><b>${esc(old)} ${esc(t.unit)}</b> → <b style="color:var(--ad-primary)">${esc(v)} ${esc(t.unit)}</b></span></div>
          <div class="r"><span class="k">生效范围</span><span class="v">全部在线设备，立即生效</span></div></div>
          <div class="hint-bar" style="margin:12px 0 0">${icon('info', 15)}<div>修改将影响 ${fmtNum(12486)} 位用户的提示口径，并写入操作日志。</div></div>`,
        actions: [{ label: '取消' }, { label: '确认下发', cls: 'btn primary', onClick(m, close) {
          t.value = v; t.updatedAt = today(); t.by = S.session.name; saveA();
          logOp('修改阈值', `${key} ${old} → ${v}`); toast('已下发至全部在线设备', { icon: 'check' }); close(); render();
        } }] });
    }));
    qs('[data-act="history"]', root).addEventListener('click', () => {
      drawer({ title: '阈值变更记录', sub: '全部改动留痕，可回滚', width: 520,
        body: `<div class="logbox" style="max-height:none">${A().auditLog.filter(l => /阈值|配置/.test(l.action)).map(l =>
          `<span class="m">${esc(l.ts)}</span> <span class="k">${esc(l.user)}</span> ${esc(l.action)} ${esc(l.target)} <span class="${l.result === 'denied' ? 'e' : 'w'}">${l.result}</span>`).join('\n') || '暂无记录'}</div>
          <div class="hint-bar" style="margin-top:14px">${icon('info', 15)}<div>阈值配置版本号 v2026.11.1 · 与小程序配置快照一致。</div></div>` });
    });
  }

  /* ============================================================
     页面：提醒与推送
     ============================================================ */
  function viewNotices() {
    const a = A();
    actionsHistoryReset();
    actionsHTML = `<button class="btn primary" data-act="newNotice">${icon('plus', 15)} 新建提醒</button>`;
    return shell(`
      <div class="grid g2" style="align-items:start;grid-template-columns:minmax(0,1.75fr) minmax(320px,.85fr)">
        <div class="card2">
          <div class="card2-h"><div class="t">订阅消息模板</div><span class="s">每周每用户 ≤ 3 次</span></div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr><th>模板</th><th>场景</th><th class="num">触达人数</th><th class="num">频控</th><th>最近发送</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>${a.notices.map(n => `<tr>
                <td>${esc(n.title)}<div class="sub">#${n.id}</div></td>
                <td><span class="tag-badge tb-gray">${esc(n.scene)}</span></td>
                <td class="num">${fmtNum(n.reach)}</td><td class="num">${n.limit} 次/周</td>
                <td class="sub mono" style="white-space:nowrap;font-size:11.5px">${esc(n.lastSend)}</td>
                <td>${badge(n.status)}</td>
                <td><div class="ops"><a data-ntog="${n.id}">${n.status === 'online' ? '暂停' : '启用'}</a><a data-ntest="${n.id}">测试</a></div></td>
              </tr>`).join('')}</tbody></table>
          </div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">禁止推送时段</div><span class="tag-badge tb-red">强制</span></div>
          <div class="card2-b">
            <div style="display:flex;align-items:center;gap:10px;font-size:13px;margin-bottom:12px">
              <span class="mono" style="padding:4px 10px;background:var(--ad-bg);border-radius:6px">22:00</span>
              <span style="flex:1;height:2px;background:linear-gradient(90deg,#17493b,#c8d3ce);position:relative"></span>
              <span class="mono" style="padding:4px 10px;background:var(--ad-bg);border-radius:6px">08:00</span>
            </div>
            <div class="hint-bar warn" style="margin:0">${icon('bell', 15)}<div>此时段内推送任务会被系统拦截并记录；用户可自愿关闭全部提醒。</div></div>
            <div class="sec-h">拦截记录（近 30 天）</div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:7px 0;border-bottom:1px dashed #edf0ee"><span>22:00–24:00</span><b>14 次</b></div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:7px 0;border-bottom:1px dashed #edf0ee"><span>00:00–06:00</span><b>0 次</b></div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;padding:7px 0"><span>06:00–08:00</span><b>3 次</b></div>
          </div>
        </div>
      </div>`);
  }
  function actionsHistoryReset() { /* noop，保留结构 */ }
  function bindNotices(root) {
    qsa('[data-ntog]', root).forEach(b => b.addEventListener('click', () => {
      const n = A().notices.find(x => x.id === b.dataset.ntog);
      if (n.status === 'online' && !can('文案审核')) return guard('文案审核', '暂停推送模板');
      n.status = n.status === 'online' ? 'paused' : 'online'; saveA(); logOp('调整提醒模板', n.title); render();
    }));
    qsa('[data-ntest]', root).forEach(b => b.addEventListener('click', () => {
      const n = A().notices.find(x => x.id === b.dataset.ntest);
      const hh = new Date().getHours();
      if (hh >= 22 || hh < 8) {
        modal({ title: '推送被拦截', width: 420,
          body: `<div class="check-item err" style="margin:0">${icon('bell', 16)}<div>当前时间 ${new Date().toTimeString().slice(0, 5)}，处于免打扰时段（22:00–08:00），系统已拦截本次测试推送。</div></div>`,
          actions: [{ label: '知道了', cls: 'btn primary' }] });
        logOp('拦截夜间推送', n.title, 'blocked');
        return;
      }
      const m = modal({ title: '推送预览', width: 400,
        body: `<div style="background:#f3f5f4;border-radius:12px;padding:14px">
          <div style="font-size:11px;color:var(--ad-text-3)">今晚喝点吗 · 服务通知</div>
          <div style="font-size:14px;font-weight:600;margin:6px 0 4px">${esc(n.title)}</div>
          <div style="font-size:12.5px;color:var(--ad-text-2)">点一下，回到那个问题：今晚喝点吗？</div></div>
          <div class="hint" style="margin-top:10px;font-size:11.5px;color:var(--ad-text-3)">测试消息已发送至当前账号（模拟）</div>`,
        actions: [{ label: '关闭', cls: 'btn primary' }] });
      logOp('测试推送', n.title);
    }));
    qs('[data-act="newNotice"]', root).addEventListener('click', () => {
      if (!can('文案审核')) return guard('文案审核', '新建提醒模板');
      modal({ title: '新建订阅提醒', width: 440,
        body: `<div class="form-grid"><div class="fg full"><label>模板标题</label><input id="n-t" placeholder="如：周三 20:00 · 今晚喝点吗" /></div>
          <div class="fg"><label>触发时段</label><input id="n-h" type="time" value="20:00" /></div>
          <div class="fg"><label>每周频控</label><select id="n-l"><option>1</option><option>2</option><option selected>3</option></select></div></div>
          <div class="hint-bar" style="margin-top:12px">${icon('info', 15)}<div>若触发时间落在 22:00–08:00，系统将在次日 08:00 后补发或直接丢弃。</div></div>`,
        actions: [{ label: '取消' }, { label: '创建', cls: 'btn primary', onClick(m, close) {
          const t = qs('#n-t', m).value.trim(); if (!t) return toast('请填写标题', { icon: 'alert' });
          A().notices.unshift({ id: 'nt' + Date.now(), title: t, scene: '情景提醒', status: 'online', reach: 0, limit: +qs('#n-l', m).value, lastSend: '—' });
          saveA(); logOp('创建订阅提醒模板', t); toast('已创建，待用户授权后生效', { icon: 'check' }); close(); render();
        } }] });
    });
  }

  /* ============================================================
     页面：地点聚合
     ============================================================ */
  function viewMap() {
    const a = A();
    const pos = { 北京: [58, 25], 上海: [74, 58], 深圳: [66, 82], 成都: [33, 55], 杭州: [71, 48], 广州: [52, 86] };
    const max = Math.max(...a.hotspots.map(h => h.count));
    actionsHTML = `<button class="btn" data-act="exportMap">${icon('download', 15)} 导出聚合数据</button>`;
    return shell(`
      <div class="hint-bar">${icon('shield', 16)}<div>后台<b>不返回任何个体坐标</b>，只返回城市 / 商圈级聚合计数；用户端「克制地图」为仅本人可见的私人视图（FR-4-02）。</div></div>
      <div class="grid g32" style="align-items:start">
        <div class="card2">
          <div class="card2-h"><div class="t">城市热度</div><span class="s">气泡面积 ∝ 记录量</span></div>
          <div class="card2-b">
            <div class="hm">
              ${a.hotspots.map(h => {
                const [x, y] = pos[h.city] || [50, 50];
                const d = 40 + 80 * h.count / max;
                return `<div class="city" style="left:${x}%;top:${y}%"><div class="b" style="width:${d}px;height:${d}px"></div><div class="nm">${h.city}</div></div>`;
              }).join('')}
            </div>
            <div class="agg-note">${icon('info', 14)}<div>坐标仅为城市级示意；原始坐标在写入时即加密，12 个月后降级为城市级（FR-4-02 / NFR-05）。</div></div>
          </div>
        </div>
        <div class="card2">
          <div class="card2-h"><div class="t">热门商圈 Top 6</div><span class="s">本月</span></div>
          <div class="card2-b" style="padding:6px 16px">
            ${a.hotspots.map((h, i) => `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #f0f2f1">
              <span style="width:18px;font-weight:600;color:${i < 3 ? 'var(--ad-primary)' : 'var(--ad-text-3)'}">${i + 1}</span>
              <div style="flex:1;min-width:0"><div style="font-size:13px">${h.city} · ${h.area}</div>
                <div class="sub">${fmtNum(h.users)} 位用户</div></div>
              <div style="text-align:right"><div class="num" style="font-size:13px;font-weight:500">${fmtNum(h.count)}</div>${deltaEl(h.trend)}</div>
            </div>`).join('')}
          </div>
        </div>
      </div>
      <div class="card2" style="margin-top:14px">
        <div class="card2-h"><div class="t">数据请求合规检查</div><span class="tag-badge tb-green">全部合规</span></div>
        <div class="card2-b">
          <div class="grid g3">
            ${[['请求来源', '运营分析 · 区域投放评估'], ['返回粒度', '城市 / 商圈级（≥ 50 用户才展示）'], ['坐标处理', '加密存储，不可逆索引'], ['个体可识别性', '已做 k-匿名（k=50）'], ['响应字段', 'city · area · count · users'], ['最近审查', '2026-11-06 合规审核 · 周昶']].map(([k, v]) => `
              <div style="border:1px solid var(--ad-line);border-radius:9px;padding:11px 12px"><div class="sub">${k}</div><div style="font-size:12.5px;margin-top:4px">${v}</div></div>`).join('')}
          </div>
        </div>
      </div>`);
  }
  function bindMap(root) {
    const b = qs('[data-act="exportMap"]', root);
    if (b) b.addEventListener('click', () => {
      if (!guard('报表导出（聚合）', '导出地点聚合')) return;
      downloadCSV('jvhd-hotspots-' + today() + '.csv', ['城市,商圈,记录数,用户数,环比'].concat(A().hotspots.map(h => [h.city, h.area, h.count, h.users, h.trend].join(','))));
      toast('已导出聚合数据（不含个体坐标）', { icon: 'download' });
    });
  }

  /* ============================================================
     页面：合规中心
      ============================================================ */
  function viewCompliance() {
    const a = A();
    const checks = [
      { t: '无购酒 / 广告素材', d: '已扫描 12,486 条分享图与 12 条文案，未发现购酒链接、价格或品牌广告。', ok: true },
      { t: '禁用词扫描', d: `命中 4 次（均在草稿态被拦截），线上文案 0 命中。词库：${BANNED.join(' / ')}`, ok: true },
      { t: '年龄门与青年模式', d: `${a.users.filter(u => u.minorMode).length} 位未成年用户已进入青年模式：不展示酒精换算、不推送、不开放分享。`, ok: true },
      { t: '夜间静默', d: '过去 30 天拦截 17 次夜间推送，无一漏网。', ok: true },
      { t: '位置授权与降级', d: '位置为独立授权项，可单次使用；坐标加密存储并于 12 个月后降级为城市级。', ok: true },
      { t: '个人数据导出 / 删除', d: '导出需二次验证，删除请求 7 日内完成并留痕。', ok: true },
    ];
    const bad = a.copy.filter(c => checkCopy(c.content).some(x => x.level === 'err'));
    actionsHTML = `<button class="btn" data-act="report">${icon('doc', 15)} 生成合规报告</button>`;
    return shell(`
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="k">自检项</div><div class="v">6<small> / 6 通过</small></div><div class="d">最近自检 今天 09:00</div></div>
        <div class="kpi"><div class="k">线上文案命中禁用词</div><div class="v">0</div><div class="d">草稿态拦截 4 次</div></div>
        <div class="kpi"><div class="k">被拦截的越权请求</div><div class="v">${a.auditLog.filter(l => l.result === 'denied').length}</div><div class="d">近 30 天</div></div>
        <div class="kpi"><div class="k">数据导出任务</div><div class="v">${a.exports.length}</div><div class="d">全部二次验证</div></div>
      </div>
      <div class="grid g23" style="align-items:start">
        <div class="card2">
          <div class="card2-h"><div class="t">合规自检清单</div><span class="s">依据 SRS 第 8 节</span></div>
          <div class="card2-b"><div class="check-list">
            ${checks.map(c => `<div class="check-item ${c.ok ? 'ok' : 'err'}">${icon(c.ok ? 'check' : 'x', 16)}<div><b>${c.t}</b><br>${c.d}</div></div>`).join('')}
          </div></div>
        </div>
        <div>
          <div class="card2" style="margin-bottom:14px">
            <div class="card2-h"><div class="t">高风险文案</div></div>
            <div class="card2-b">${bad.length ? bad.map(c => `<div class="check-item err" style="margin-bottom:8px">${icon('alert', 15)}<div><b>${esc(c.title)}</b>（${esc(c.key)}）<br>${checkCopy(c.content).filter(x => x.level === 'err').map(x => esc(x.text)).join('<br>')}</div></div>`).join('') : `<div class="check-item ok">${icon('check', 15)}<div>无高风险文案。</div></div>`}
              <button class="btn" style="margin-top:10px;width:100%" data-act="gotocopy">前往文案库处理</button>
            </div>
          </div>
          <div class="card2">
            <div class="card2-h"><div class="t">数据请求队列</div></div>
            <div class="card2-b" style="padding:6px 16px">
              ${a.exports.map(e => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f2f1">
                <div style="flex:1"><div style="font-size:12.5px" class="mono">${e.id}</div><div class="sub">${e.user} · ${e.type} · ${e.format}</div></div>
                ${badge(e.status)}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>`);
  }
  function bindCompliance(root) {
    qs('[data-act="gotocopy"]', root).addEventListener('click', () => go('copy'));
    qs('[data-act="report"]', root).addEventListener('click', () => {
      toast('合规报告已生成并归档（模拟）', { icon: 'doc' });
      logOp('生成合规报告', '2026 年 11 月');
    });
  }

  /* ============================================================
     页面：角色权限
     ============================================================ */
  const PERMS = ['运营看板', '用户查看（脱敏）', '数据导出', '酒库审核', '文案审核', '阈值配置', '地点聚合', '账号管理'];
  const MATRIX = {
    '超级管理员': [1, 1, 1, 1, 1, 1, 1, 1],
    '运营': [1, 1, 0, 1, 1, 0, 1, 0],
    '合规审核': [1, 1, 0, 0, 1, 0, 0, 0],
    '数据分析': [1, 0, 1, 0, 0, 0, 1, 0],
  };
  function viewRoles() {
    const a = A();
    actionsHTML = `<button class="btn primary" data-act="newAdmin">${icon('plus', 15)} 新增子账号</button>`;
    return shell(`
      <div class="grid g4" style="margin-bottom:14px">
        ${a.roles.map(r => `<div class="card2"><div class="card2-b">
          <div style="display:flex;align-items:center;gap:8px"><b style="font-size:14px">${esc(r.name)}</b><span class="tag-badge tb-gray">${r.users} 人</span></div>
          <div class="sub" style="margin-top:6px;line-height:1.7;min-height:38px">${esc(r.desc)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">${r.perms.map(p => `<span class="tag-badge tb-green">${esc(p)}</span>`).join('')}</div>
        </div></div>`).join('')}
      </div>
      <div class="card2" style="margin-bottom:14px">
        <div class="card2-h"><div class="t">权限矩阵</div><span class="s">✓ 可操作 · — 无权限</span></div>
        <div class="tbl-wrap"><table class="tbl matrix">
          <thead><tr><th class="t">权限 \ 角色</th>${a.roles.map(r => `<th>${esc(r.name)}</th>`).join('')}</tr></thead>
          <tbody>${PERMS.map((p, i) => `<tr><td class="t">${p}</td>${a.roles.map(r => `<td class="${MATRIX[r.name][i] ? 'perm-y' : 'perm-n'}">${MATRIX[r.name][i] ? icon('check', 15) : '—'}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card2">
        <div class="card2-h"><div class="t">子账号</div></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>最近登录</th><th>登录 IP</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>${a.admins.map(x => `<tr>
            <td>${esc(x.name)}${x.account === S.session.account ? ' <span class="tag-badge tb-blue">当前</span>' : ''}</td>
            <td class="mono">${esc(x.account)}</td>
            <td><span class="tag-badge tb-purple">${esc(x.role)}</span></td>
            <td class="sub mono">${esc(x.lastLogin)}</td>
            <td class="sub mono">${esc(x.lastIp)}</td>
            <td>${x.status === 'active' ? badge('active') : badge('offline')}</td>
            <td><div class="ops"><a data-reset="${x.id}">重置密码</a><a class="danger" data-stop="${x.id}">${x.status === 'active' ? '停用' : '启用'}</a></div></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>`);
  }
  function bindRoles(root) {
    qsa('[data-stop]', root).forEach(b => b.addEventListener('click', () => {
      if (!guard('账号管理')) return;
      const x = A().admins.find(v => v.id === b.dataset.stop);
      if (x.account === S.session.account) return toast('不能停用当前登录账号', { icon: 'alert' });
      x.status = x.status === 'active' ? 'paused' : 'active'; saveA(); logOp('账号状态变更', x.account + ' → ' + x.status); render();
    }));
    qsa('[data-reset]', root).forEach(b => b.addEventListener('click', () => {
      if (!guard('账号管理')) return;
      const x = A().admins.find(v => v.id === b.dataset.reset);
      logOp('重置后台密码', x.account); toast(`已向 ${x.name} 发送重置链接`, { icon: 'key' });
    }));
    qs('[data-act="newAdmin"]', root).addEventListener('click', () => {
      if (!guard('账号管理')) return;
      modal({ title: '新增子账号', width: 440,
        body: `<div class="form-grid"><div class="fg"><label>姓名</label><input id="ad-n" /></div>
          <div class="fg"><label>账号</label><input id="ad-a" placeholder="拼音" /></div>
          <div class="fg full"><label>角色</label><div class="radios">${A().roles.map((r, i) => `<label><input type="radio" name="rr" ${i === 1 ? 'checked' : ''}/>${r.name}</label>`).join('')}</div></div></div>
          <div class="hint-bar" style="margin-top:12px">${icon('info', 15)}<div>新账号默认强制 90 天内修改初始密码，并开启登录异地提醒。</div></div>`,
        actions: [{ label: '取消' }, { label: '创建', cls: 'btn primary', onClick(m, close) {
          const n = qs('#ad-n', m).value.trim(), acc = qs('#ad-a', m).value.trim();
          if (!n || !acc) return toast('请填写姓名与账号', { icon: 'alert' });
          const role = qs('input[name="rr"]:checked', m).parentElement.textContent.trim();
          A().admins.push({ id: 'A' + (A().admins.length + 1).toString().padStart(2, '0'), name: n, account: acc, role, lastLogin: '—', lastIp: '—', status: 'active' });
          saveA(); logOp('新增子账号', acc + ' / ' + role); toast('已创建', { icon: 'check' }); close(); render();
        } }] });
    });
  }

  /* ============================================================
     页面：操作日志
     ============================================================ */
  function viewAudit() {
    const a = A();
    const st = S.q.audit || { kw: '', result: 'all' };
    let list = a.auditLog.slice();
    if (st.result !== 'all') list = list.filter(l => l.result === st.result);
    if (st.kw) list = list.filter(l => (l.user + l.action + l.target).includes(st.kw));
    actionsHTML = `<button class="btn" data-act="exportLog">${icon('download', 15)} 导出日志</button>`;
    return shell(`
      <div class="grid g4" style="margin-bottom:14px">
        <div class="kpi"><div class="k">日志条数（近 30 天）</div><div class="v">${fmtNum(428)}</div><div class="d">全部不可篡改</div></div>
        <div class="kpi"><div class="k">被拒绝请求</div><div class="v">${a.auditLog.filter(l => l.result === 'denied').length}</div><div class="d">含 1 次原始坐标导出</div></div>
        <div class="kpi"><div class="k">被拦截推送</div><div class="v">${a.auditLog.filter(l => l.result === 'blocked').length}</div><div class="d">夜间静默生效</div></div>
        <div class="kpi"><div class="k">配置类变更</div><div class="v">${a.auditLog.filter(l => /阈值|配置/.test(l.action)).length}</div><div class="d">可回滚</div></div>
      </div>
      <div class="card2">
        <div class="toolbar">
          <div class="tabs" id="aTabs">${[['all', '全部'], ['success', '成功'], ['denied', '被拒绝'], ['blocked', '被拦截']].map(([k, n]) => `<button class="${st.result === k ? 'on' : ''}" data-r="${k}">${n}</button>`).join('')}</div>
          <div class="grow"></div>
          <div class="search-box">${icon('search', 14)}<input id="aKw" placeholder="操作人 / 动作 / 对象" value="${esc(st.kw)}" /></div>
        </div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>时间</th><th>操作人</th><th>角色</th><th>动作</th><th>对象</th><th>IP</th><th>结果</th></tr></thead>
          <tbody>${list.map(l => `<tr>
            <td class="sub mono">${esc(l.ts)}</td><td>${esc(l.user)}</td><td><span class="tag-badge tb-gray">${esc(l.role)}</span></td>
            <td>${esc(l.action)}</td><td class="sub">${esc(l.target)}</td><td class="sub mono">${esc(l.ip)}</td><td>${badge(l.result)}</td>
          </tr>`).join('') || `<tr><td colspan="7"><div class="tbl-empty">无匹配日志</div></td></tr>`}</tbody>
        </table></div>
        <div class="pager"><span>共 ${list.length} 条（演示环境仅保留最近记录）</span><div class="pgs"><button>‹</button><button class="on">1</button><button>›</button></div></div>
      </div>`);
  }
  function bindAudit(root) {
    const st = S.q.audit;
    qsa('#aTabs button', root).forEach(b => b.addEventListener('click', () => { st.result = b.dataset.r; render(); }));
    const kw = qs('#aKw', root);
    kw.addEventListener('input', () => { st.kw = kw.value; render(); const n = qs('#aKw'); if (n) { n.focus(); n.setSelectionRange(kw.value.length, kw.value.length); } });
    qs('[data-act="exportLog"]', root).addEventListener('click', () => {
      if (!guard('数据导出', '导出操作日志')) return;
      downloadCSV('jvhd-audit-' + today() + '.csv', ['时间,操作人,角色,动作,对象,IP,结果'].concat(A().auditLog.map(l => [l.ts, l.user, l.role, l.action, l.target, l.ip, l.result].join(','))));
      toast('日志已导出', { icon: 'download' });
    });
  }

  /* ============================================================
     路由与渲染
     ============================================================ */
  const VIEWS = {
    dashboard: [viewDashboard, bindDashboard],
    users: [viewUsers, bindUsers],
    sku: [viewSku, bindSku],
    copy: [viewCopy, bindCopy],
    alts: [viewAlts, bindAlts],
    thresholds: [viewThresholds, bindThresholds],
    notices: [viewNotices, bindNotices],
    map: [viewMap, bindMap],
    compliance: [viewCompliance, bindCompliance],
    roles: [viewRoles, bindRoles],
    audit: [viewAudit, bindAudit],
  };
  // 各角色可见模块（与「角色权限」页的矩阵保持一致）
  const ROLE_ALLOW = {
    '超级管理员': ['dashboard', 'users', 'sku', 'copy', 'alts', 'thresholds', 'notices', 'map', 'compliance', 'roles', 'audit'],
    '运营': ['dashboard', 'users', 'sku', 'copy', 'alts', 'notices', 'map', 'compliance'],
    '合规审核': ['dashboard', 'users', 'copy', 'notices', 'compliance', 'audit'],
    '数据分析': ['dashboard', 'map'],
  };
  function allowed(p) {
    const r = ROLE_ALLOW[roleName()];
    return !r || r.indexOf(p) >= 0;
  }

  function go(path) {
    if (!allowed(path)) {
      toast('当前角色无权访问该模块', { icon: 'shield' });
      path = 'dashboard';
    }
    S.path = path; S.q = S.q || {};
    // 地址栏始终规范为 #/<模块>，避免查询串里的 # 把后续 hash 截断成「当前页」
    const next = '#/' + path;
    if (location.hash !== next) { history.replaceState(null, '', next); }
    render();
  }

  function render(err) {
    const app = document.getElementById('app');
    if (!S.session) {
      app.innerHTML = viewLogin(err);
      bindLogin(app);
      return;
    }
    const v = VIEWS[S.path];
    if (!v) return go('dashboard');
    // 切页/刷新前清掉残留抽屉与遮罩，避免详情面板盖住新页面
    closeDrawer();
    app.innerHTML = v[0]();
    v[1](app);
    bindShell(app);
  }

  function bindShell(root) {
    qsa('[data-nav]', root).forEach(b => {
      b.classList.toggle('off', !allowed(b.dataset.nav));
      b.title = allowed(b.dataset.nav) ? '' : '当前角色无此模块权限';
      b.addEventListener('click', () => go(b.dataset.nav));
    });
    qs('#logout', root).addEventListener('click', () => {
      modal({ title: '退出登录', width: 380, body: '<div style="font-size:13px;color:var(--ad-text-2)">退出后需重新输入账号密码。演示数据会保留在本地。</div>',
        actions: [{ label: '取消' }, { label: '退出', cls: 'btn primary', onClick(m, close) { logOp('退出登录', '后台管理系统'); S.session = null; A().session = null; saveA(); close(); render(); } }] });
    });
    qs('#todo', root).addEventListener('click', () => go('sku'));
    qs('#help', root).addEventListener('click', () => modal({ title: '原型说明', width: 460,
      body: `<div style="font-size:12.5px;line-height:1.9;color:var(--ad-text-2)">
        这是「今晚喝点吗」运营后台的可交互原型，数据全部在浏览器本地模拟。<br><br>
        · 不同角色登录可见不同菜单，越权操作会被拦截并写入日志；<br>
        · 酒库 / 文案 / 阈值修改后会即时反映到小程序原型；<br>
        · 建议同时打开小程序原型对照体验。</div>`,
      actions: [{ label: '知道了', cls: 'btn primary' }] }));
    const gs = qs('#gsearch', root);
    gs.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const v = gs.value.trim(); if (!v) return;
      const hit = A().users.find(u => u.nick.includes(v) || u.id === v);
      if (hit) { go('users'); S.q.users = { tab: 'all', kw: hit.nick, page: 1 }; render(); return; }
      const sku = A().skus.find(s => s.name.includes(v));
      if (sku) { go('sku'); S.q.sku.kw = v; render(); return; }
      toast('未找到匹配结果', { icon: 'search' });
    });
    qs('#fold', root).addEventListener('click', () => qs('#side', root).classList.toggle('open'));
  }

  window.addEventListener('hashchange', () => {
    const raw = location.hash;
    // 查询串里带 #（例如调试用的 _=123#/sku）时，浏览器只把第一个 # 之前的部分当 hash，
    // 这里把后续的 #/xx 当作真正的路由，并规范地址
    if (raw && raw.indexOf('#/', 1) > 0) { location.replace(raw.slice(raw.indexOf('#/', 1))); return; }
    const p = C.parseHash().path || 'dashboard';
    S.q = S.q || {};
    const v = VIEWS[p];
    const def = v && v[2];
    // 保证每个模块的列表状态（页签/分页/搜索）在切换路由后依然存在
    if (p !== 'sku') S.q.sku = { tab: 'all', cat: 'all', kw: '', page: 1 };
    if (def && !S.q[p]) S.q[p] = Object.assign({}, def);
    S.path = p; render();
  });

  /* ============================================================
     启动
     ============================================================ */
  function init() {
    store = M.initAdmin();
    S.session = store.session && store.admins.some(a => a.account === store.session.account) ? store.session : null;
    const p = C.parseHash().path;
    S.path = p || 'dashboard';
    render();
  }
  document.addEventListener('DOMContentLoaded', init);
})();
