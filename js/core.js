/* ============================================================
   今晚喝点吗 · 原型公共核心：存储 / 日期 / 计算 / 图标 / Toast / 弹窗
   ============================================================ */
(function (global) {
  'use strict';

  const STORE_PREFIX = 'jvhd_proto_';
  const state = {};

  function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------------- 存储（localStorage 包一层，异常时降级内存） ---------------- */
  function storageGet(key) {
    try { const raw = localStorage.getItem(STORE_PREFIX + key); return raw ? JSON.parse(raw) : null; }
    catch (e) { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }
  function storageDel(key) { try { localStorage.removeItem(STORE_PREFIX + key); } catch (e) { } }

  /**
   * 读取持久化状态；不存在时用 factory 生成种子数据。
   */
  function useStore(name, factory) {
    if (state[name]) return state[name];
    const saved = storageGet(name);
    if (saved) { state[name] = saved; return saved; }
    const fresh = factory();
    state[name] = fresh;
    storageSet(name, fresh);
    return fresh;
  }
  function save(name, value) { state[name] = value; storageSet(name, value); }
  function resetAll() { ['mini', 'admin', 'probe'].forEach(k => storageDel(k)); Object.keys(state).forEach(k => delete state[k]); }

  /* ---------------- 日期工具（Asia/Shanghai 本地时区） ---------------- */
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  function ymd(d) {
    d = d || new Date();
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  function ymdObj(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function addDays(s, n) { const d = ymdObj(s); d.setDate(d.getDate() + n); return ymd(d); }
  function daysBetween(a, b) { return Math.round((ymdObj(b) - ymdObj(a)) / 86400000); }
  function monthKey(s) { return s.slice(0, 7); }
  function today() { return ymd(new Date()); }
  function nowStr() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  function stamp() {
    const d = new Date();
    return ymd(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
  }
  function fmtDateCN(s) {
    if (!s) return '';
    if (s.length === 10) { const d = ymdObj(s); return `${d.getMonth() + 1} 月 ${d.getDate()} 日`; }
    return s.slice(5, 16);
  }
  function fmtDateFull(s) {
    const d = ymdObj(s);
    return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${WEEK[d.getDay()]}`;
  }
  function greet() {
    const h = new Date().getHours();
    if (h < 5) return '还没睡';
    if (h < 11) return '早上好';
    if (h < 14) return '午安';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function relTime(ts) {
    if (!ts) return '从未';
    const diff = (Date.now() - new Date(ts.replace(/\//g, '-').replace(' ', 'T')).getTime()) / 1000;
    if (isNaN(diff) || diff < 0) return ts.slice(5, 16);
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
    return ts.slice(5, 10);
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function rnd(min, max) { return min + Math.random() * (max - min); }
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function fmtNum(n) { return Number(n || 0).toLocaleString('zh-CN'); }

  /* ---------------- 业务计算 ---------------- */
  const ETHANOL_DENSITY = 0.789;
  const STD_DRINK_G = 10;

  /** 酒精克数 = 量(ml) × 酒精度(%vol) ÷ 100 × 0.789 */
  function alcoholG(ml, abv) { return Math.max(0, ml * abv / 100 * ETHANOL_DENSITY); }
  function toStd(grams) { return grams / STD_DRINK_G; }
  function dayTotals(logs, date) {
    const list = logs.filter(l => l.date === date);
    const g = list.reduce((s, l) => s + l.grams, 0);
    return { grams: g, std: toStd(g), count: list.length, list };
  }
  function sumGrams(logs, pred) {
    return logs.reduce((s, l) => (pred && !pred(l) ? s : s + l.grams), 0);
  }
  /** 无酒连击：自最近一次饮酒记录次日 0 点起连续无酒天数 */
  function calcStreak(logs, d) {
    d = d || today();
    const drank = new Set(logs.map(l => l.date));
    let cur = 0;
    let p = d;
    // 今天不扣：今天没喝则今天算第一天
    for (let i = 0; i < 30; i++) {
      if (drank.has(p)) break;
      cur++;
      p = addDays(p, -1);
    }
    // 最长连击：只统计「最近一次饮酒之后」的无酒日，避免把无记录的历史也算成连击
    const drankAll = [...drank].sort();
    // 只看 d 之前（或当天）的最后一次饮酒
    const before = drankAll.filter(x => x <= d);
    const lastDrink = before.length ? before[before.length - 1] : null;
    let pos = d;
    if (lastDrink) pos = addDays(lastDrink, 1);
    if (pos < addDays(d, -364)) pos = addDays(d, -364);
    let best = 0, run = 0, iter = 0;
    while (pos < d && iter++ < 400) {
      if (drank.has(pos)) { if (run > best) best = run; run = 0; } else run++;
      pos = addDays(pos, 1);
    }
    if (run > best) best = run;
    if (!lastDrink) best = cur;
    // 无酒总天数：近 365 天里没有饮酒记录的天数 + 「不喝」记录的父子项之和
    let totalSober = 0;
    for (let i = 0; i < 365; i++) { if (!drank.has(addDays(d, -i))) totalSober++; }
    return { current: cur, best: Math.max(best, cur), totalSober };
  }
  function monthStats(logs, mkey) {
    const list = logs.filter(l => String(l.date).startsWith(mkey));
    const grams = list.reduce((s, l) => s + l.grams, 0);
    const days = [...new Set(list.map(l => l.date))];
    const daysInMonth = new Date(+mkey.slice(0, 4), +mkey.slice(5, 7), 0).getDate();
    const isCur = mkey === monthKey(today());
    const elapsedDays = isCur ? +today().slice(8, 10) : daysInMonth;
    return {
      grams, std: toStd(grams), count: list.length,
      drinkDays: days.length,
      soberDays: Math.max(0, elapsedDays - days.length),
      avg: elapsedDays ? grams / elapsedDays : 0,
      list
    };
  }

  /** 权益计算：少喝百分比 / 省下金额 / 省下热量（SRS 5.3） */
  function incentives(logs, cfg) {
    const mk = monthKey(today());
    const cur = monthStats(logs, mk).grams;
    const base = cfg.baselineGrams || 800; // 近 3 个月月均基准
    const saved = Math.max(0, base - cur);
    const pct = base > 0 ? saved / base : 0;
    const std = saved / STD_DRINK_G;
    const money = std * (cfg.pricePerDrink || 45);
    const kcal = saved * 7;
    const milktea = Math.round((kcal / 650) * 10) / 10; // 650 kcal ≈ 1 杯奶茶
    return { base, cur, saved, pct, std, money, kcal, milktea };
  }

  /* ---------------- 图标：一元 SVG 路径集（stroke，24 视口） ---------------- */
  const ICONS = {
    glass: '<path d="M6 4h12l-1.4 13.2a1.6 1.6 0 0 1-1.6 1.4H9a1.6 1.6 0 0 1-1.6-1.4L6 4Z"/><path d="M6.7 9.5h10.6"/><path d="M12 18.6V21"/>',
    beer: '<path d="M7 3.5h9v4h1.8a1.7 1.7 0 0 1 1.7 1.7v4.1a1.7 1.7 0 0 1-1.7 1.7H16v5.5H7V3.5Z"/><path d="M10 7v10"/><path d="M13 7v10"/>',
    wine: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Z"/><path d="M8 6.2h8"/><path d="M12 13v6.5"/><path d="M8.5 21h7"/>',
    cup: '<path d="M5 5h11v11a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V5Z"/><path d="M16 8h2.2a1.8 1.8 0 0 1 0 3.6H16"/><path d="M8 2.5c.8 1 .8 1.5 0 2.5"/><path d="M11.5 2.5c.8 1 .8 1.5 0 2.5"/>',
    whisky: '<path d="M5.5 4h13l-1.6 8.4A6 6 0 0 1 11 17.4a6 6 0 0 1-5.9-5L5.5 4Z"/><path d="M6.4 8.2h11.2"/>',
    cocktail: '<path d="M3.5 4h17l-8.5 8.5L3.5 4Z"/><path d="M12 12.5V20"/><path d="M8 20h8"/><path d="M17.5 2.2 15.6 4.1"/><circle cx="17.9" cy="1.9" r=".9"/>',
    bottle: '<path d="M10 2.5h4v4l1.6 2.4V20a1.5 1.5 0 0 1-1.5 1.5h-4.2A1.5 1.5 0 0 1 8.4 20V8.9L10 6.5v-4Z"/><path d="M8.4 11h7.2"/><path d="M8.4 16h7.2"/>',
    glass2: '<path d="M7 21V6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v15"/><path d="M7 10h10"/><path d="M6 21h12"/>',
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1v-9.5Z"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    map: '<path d="M9 4 3.5 6.2v14L9 18l6 2 5.5-2.2v-14L15 6 9 4Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="8.6" cy="15.4" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8" r="3.6"/><path d="M2.8 20.5a6.2 6.2 0 0 1 12.4 0"/><path d="M16 4.6a3.6 3.6 0 0 1 0 6.8"/><path d="M17.6 14.6a6.2 6.2 0 0 1 3.6 5.9"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="12" width="3" height="5" rx="1"/><rect x="12.5" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1" opacity=".5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3 1.8"/>',
    clock2: '<path d="M12 7.5V12l3 1.8"/><circle cx="12" cy="12" r="8.6" stroke-dasharray="2 3"/>',
    flame: '<path d="M12 3c.5 3.2-2.2 4.2-2.2 7 0 1.1.7 2 1.7 2.3-.2-1.6.6-2.8 1.7-3.9.2 1.9 2.6 3.2 2.6 5.6a3.8 3.8 0 0 1-7.6 0c0-2.4 1.2-4 2.2-5.6C10.9 6.6 11.7 4.8 12 3Z"/><path d="M12 15.8c0 2-1.6 2.6-1.6 4.2a1.6 1.6 0 0 0 3.2 0c0-1.4-1.1-2.3-1.1-4"/>',
    coin: '<ellipse cx="12" cy="7" rx="7.5" ry="3.2"/><path d="M4.5 7v10c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2V7"/><path d="M4.5 12c0 1.8 3.4 3.2 7.5 3.2s7.5-1.4 7.5-3.2"/>',
    chevronLeft: '<path d="M15 5 8 12l7 7"/>',
    chevronRight: '<path d="M9 5l7 7-7 7"/>',
    chevronDown: '<path d="M5 9l7 7 7-7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    share: '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.8 10.8 15.2 6.8"/><path d="M8.8 13.2l6.4 4"/>',
    pin: '<path d="M12 21s-6.6-5.9-6.6-10.4a6.6 6.6 0 0 1 13.2 0C18.6 15.1 12 21 12 21Z"/><circle cx="12" cy="10.4" r="2.4"/>',
    locate: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M12 2v3.2"/><path d="M12 18.8V22"/><path d="M2 12h3.2"/><path d="M18.8 12H22"/>',
    car: '<path d="M5 17h14"/><path d="M6.5 17V11l1.8-4.2A2 2 0 0 1 10.1 5.5h3.8a2 2 0 0 1 1.8 1.3L17.5 11v6"/><path d="M6.5 11h11"/><circle cx="8" cy="17.5" r="1.6"/><circle cx="16" cy="17.5" r="1.6"/>',
    shield: '<path d="M12 3 4.8 6v6c0 4.4 3 8.2 7.2 9 4.2-.8 7.2-4.6 7.2-9V6L12 3Z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    bell: '<path d="M6 10a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 15 6 10Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sparkle: '<path d="M12 3.5c.6 3.6 1.9 5 5.5 5.6-3.6.6-5 1.9-5.5 5.5-.6-3.6-1.9-5-5.6-5.5 3.6-.6 5-2 5.6-5.6Z"/><path d="M18 14.5c.3 1.7.9 2.3 2.6 2.6-1.7.3-2.3.9-2.6 2.6-.3-1.7-.9-2.3-2.6-2.6 1.7-.3 2.3-.9 2.6-2.6Z"/>',
    coupon: '<path d="M3.5 8.5V6a1.5 1.5 0 0 1 1.5-1.5h14A1.5 1.5 0 0 1 20.5 6v2.5a3.5 3.5 0 0 0 0 7V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-2.5a3.5 3.5 0 0 0 0-7Z"/><path d="M13 9.5v1"/><path d="M13 12.8v1"/>',
    leaf: '<path d="M4.5 19.5C3 13 6.5 5 19.5 4.5c.5 13-7.5 16.5-14 14.5"/><path d="M4.5 19.5C7 15 11 11 16 8.5"/>',
    list: '<path d="M8 6.5h12"/><path d="M8 12h12"/><path d="M8 17.5h12"/><path d="M4 6.5h.01"/><path d="M4 12h.01"/><path d="M4 17.5h.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    download: '<path d="M12 4v11"/><path d="M7.5 10.8 12 15.3l4.5-4.5"/><path d="M5 19.5h14"/>',
    upload: '<path d="M12 15V4"/><path d="M7.5 8.2 12 3.8l4.5 4.4"/><path d="M5 19.5h14"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3V7"/><path d="M6.5 7l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7"/>',
    edit: '<path d="M16.4 4.2a2 2 0 0 1 2.8 2.8L7.8 18.4 4 19.5l1.1-3.8L16.4 4.2Z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4.5h-4.5"/>',
    dots: '<circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    filter: '<path d="M4 5h16l-6.2 7.5V19l-3.6 1.8v-8.3L4 5Z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7"/><path d="M12 16.5v4"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 5.2h3"/>',
    logout: '<path d="M14.5 4.5H18a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3.5"/><path d="M10 16.5 5.5 12 10 7.5"/><path d="M5.5 12h9"/>',
    loop: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.6"/><path d="M12 8v4.2l2.8 1.6"/>',
    heart: '<path d="M12 20s-7.5-4.4-7.5-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20Z"/>',
    dashboard: '<rect x="3.5" y="3.5" width="7.5" height="9" rx="1.8"/><rect x="13" y="3.5" width="7.5" height="5" rx="1.8"/><rect x="3.5" y="14.5" width="7.5" height="6" rx="1.8"/><rect x="13" y="10.5" width="7.5" height="10" rx="1.8"/>',
    ledger: '<path d="M5 4.5h13a1.5 1.5 0 0 1 1.5 1.5v13.5H6.5A1.5 1.5 0 0 1 5 18V4.5Z"/><path d="M5 17c0-1 .7-1.5 1.5-1.5H19.5"/><path d="M9 8h7"/><path d="M9 11.5h5"/>',
    flag: '<path d="M5.5 21V3.5"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
    sliders: '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="9" cy="17" r="2"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/><path d="M17 6l2 2"/><path d="M14.5 8.5l2 2"/>',
    server: '<rect x="3.5" y="4" width="17" height="6.5" rx="1.8"/><rect x="3.5" y="13.5" width="17" height="6.5" rx="1.8"/><path d="M7 7.2h.01"/><path d="M7 16.8h.01"/>',
    book: '<path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v15h-13a2 2 0 0 0-2 2v-15Z"/><path d="M8.5 7.5h7"/><path d="M8.5 11h4"/>',
    megaphone: '<path d="M4 10v4l4 1.5V8.5L4 10Z"/><path d="M8 8.5 18.5 4.5v15L8 15.5v-7Z"/><path d="M7 16v3.5"/>',
    alert: '<path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>',
    star: '<path d="m12 3.8 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 10l5.9-.9L12 3.8Z"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7L12.5 17"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    waves: '<path d="M3 8c2 0 2-1.6 4-1.6S9 8 11 8s2-1.6 4-1.6S17 8 19 8s2-1.6 2-1.6"/><path d="M3 13c2 0 2-1.6 4-1.6S9 13 11 13s2-1.6 4-1.6S17 13 19 13s2-1.6 2-1.6"/><path d="M3 18c2 0 2-1.6 4-1.6S9 18 11 18s2-1.6 4-1.6S17 18 19 18s2-1.6 2-1.6"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4.5h4.5"/>',
    doc: '<path d="M13.5 3.5H6.5A1.5 1.5 0 0 0 5 5v14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V9l-5.5-5.5Z"/><path d="M13.5 3.5V9H19"/><path d="M8.5 13h7"/><path d="M8.5 16.5h4"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2.5v2.5H14z"/><path d="M19.5 14v2"/><path d="M14 19.5h2"/><path d="M18.5 18.5h1.5v1.5"/>',
  };

  function icon(name, size, cls) {
    const p = ICONS[name] || ICONS.info;
    return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, opts) {
    opts = opts || {};
    // 小程序：提示挂在手机壳内部，保证在截图/投屏里也能看到
    const host = document.querySelector('.phone') || document.body;
    let wrap = host.querySelector(':scope > .toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      if (host !== document.body) wrap.classList.add('in-phone');
      host.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = (opts.icon ? icon(opts.icon, 16, 'ti') : '') + `<span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  /* ---------------- 通用弹窗（后台/小程序共用，浅色皮肤） ---------------- */
  function modal(opts) {
    // 小程序端：弹窗挂进手机壳内部，避免溢出到舞台外
    opts = opts || {};
    const host = document.querySelector('.phone') || document.body;
    const mask = document.createElement('div');
    mask.className = 'modal-mask ' + (opts.dark ? 'dark' : '');
    mask.innerHTML = `
      <div class="modal" style="${opts.width ? 'width:' + opts.width + 'px' : ''}">
        <div class="modal-header"><span>${esc(opts.title || '')}</span>${opts.closable === false ? '' : '<button class="btn ghost sm" data-close>' + icon('x', 16) + '</button>'}</div>
        <div class="modal-body">${opts.body || ''}</div>
        <div class="modal-footer">${(opts.actions || []).map((a, i) => `<button class="btn ${a.cls || ''}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div>
      </div>`;
    host.appendChild(mask);
    const nClose = document.getElementById('mini-modal-n');
    if (nClose) nClose.textContent = String(+nClose.textContent + 1);
    function close() {
      mask.remove();
      const n = document.getElementById('mini-modal-n');
      if (n) n.textContent = String(Math.max(0, +n.textContent - 1));
      if (opts.onClose) opts.onClose();
    }
    mask.addEventListener('click', (e) => {
      if (e.target === mask && opts.closable !== false) return close();
      if (e.target.closest('[data-close]')) return close();
      const btn = e.target.closest('[data-act]');
      if (btn) {
        const act = (opts.actions || [])[+btn.dataset.act];
        if (act && act.onClick) { const keep = act.onClick(mask, close); if (keep === false) return; }
        if (act && !act.keepOpen) close();
      }
    });
    if (opts.onMount) opts.onMount(mask, close);
    return { el: mask, close };
  }

  /* ---------------- 路由（hash 状态，便于演示时分享页面） ---------------- */
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const query = {};
    (qs || '').split('&').filter(Boolean).forEach(kv => {
      const [k, v] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { path: path || '', query };
  }
  function setHash(path, query) {
    const qs = query ? Object.keys(query).filter(k => query[k] !== undefined && query[k] !== '').map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`).join('&') : '';
    const next = '#/' + path + (qs ? '?' + qs : '');
    if (location.hash === next) return;
    location.hash = next;
  }
  function onRoute(fn) {
    window.addEventListener('hashchange', fn);
    fn();
  }

  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function on(root, evt, sel, fn) {
    root.addEventListener(evt, (e) => {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) fn(e, t);
    });
  }

  global.Core = {
    useStore, save, resetAll, storageGet, storageSet,
    ymd, ymdObj, addDays, daysBetween, monthKey, today, nowStr, stamp, fmtDateCN, fmtDateFull, greet, relTime, WEEK,
    esc, uid, clamp, rnd, rndInt, pick, fmtNum, deepClone,
    alcoholG, toStd, dayTotals, sumGrams, calcStreak, monthStats, incentives,
    icon, ICONS, toast, modal, parseHash, setHash, onRoute, qs, qsa, on,
    STD_DRINK_G, ETHANOL_DENSITY,
  };
})(window);
