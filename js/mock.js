/* ============================================================
   今晚喝点吗 · 演示数据（酒库 / 用户 / 饮酒记录 / 地点 / 后台运营数据）
   ============================================================ */
(function (global) {
  'use strict';
  const C = global.Core;
  const { ymd, addDays, today, rndInt, rnd, pick, alcoholG } = C;

  /* ---------------- 酒库（酒铺类型） ---------------- */
  const CATS = [
    { id: 'beer', name: '啤酒', icon: 'beer', abv: 4.5, size: 500, unit: '听' },
    { id: 'wine', name: '葡萄酒', icon: 'wine', abv: 13, size: 150, unit: '杯' },
    { id: 'huangjiu', name: '黄酒', icon: 'cup', abv: 15, size: 150, unit: '碗' },
    { id: 'baijiu', name: '白酒', icon: 'whisky', abv: 52, size: 50, unit: '杯' },
    { id: 'yangjiu', name: '洋酒', icon: 'bottle', abv: 40, size: 45, unit: '杯' },
    { id: 'cocktail', name: '鸡尾酒', icon: 'cocktail', abv: 12, size: 200, unit: '杯' },
    { id: 'other', name: '其他', icon: 'glass2', abv: 10, size: 250, unit: '份' },
  ];

  const BRANDS = [
    { id: 'b01', cat: 'beer', name: '青岛啤酒 经典', abv: 4.5, size: 500, unit: '听', hot: true },
    { id: 'b02', cat: 'beer', name: '雪花 勇闯天涯', abv: 4.0, size: 500, unit: '听', hot: true },
    { id: 'b03', cat: 'beer', name: '百威 经典', abv: 4.5, size: 330, unit: '瓶' },
    { id: 'b04', cat: 'beer', name: 'Corona 科罗娜', abv: 4.5, size: 330, unit: '瓶' },
    { id: 'b05', cat: 'beer', name: '精酿 IPA（本地）', abv: 6.5, size: 330, unit: '瓶' },
    { id: 'b06', cat: 'beer', name: '生啤（扎）', abv: 4.2, size: 500, unit: '扎', hot: true },
    { id: 'b07', cat: 'beer', name: '乌苏啤酒', abv: 4.3, size: 620, unit: '瓶' },
    { id: 'w01', cat: 'wine', name: '长城 干红', abv: 12, size: 150, unit: '杯', hot: true },
    { id: 'w02', cat: 'wine', name: '奔富 BIN389', abv: 14.5, size: 150, unit: '杯' },
    { id: 'w03', cat: 'wine', name: '桃红起泡酒', abv: 11, size: 150, unit: '杯' },
    { id: 'h01', cat: 'huangjiu', name: '古越龙山 花雕', abv: 15, size: 150, unit: '碗' },
    { id: 'h02', cat: 'huangjiu', name: '女儿红 五年陈', abv: 16, size: 150, unit: '碗' },
    { id: 'j01', cat: 'baijiu', name: '茅台 飞天', abv: 53, size: 50, unit: '杯', hot: true },
    { id: 'j02', cat: 'baijiu', name: '五粮液 普五', abv: 52, size: 50, unit: '杯', hot: true },
    { id: 'j03', cat: 'baijiu', name: '泸州老窖 特曲', abv: 52, size: 50, unit: '杯' },
    { id: 'j04', cat: 'baijiu', name: '汾酒 青花20', abv: 53, size: 50, unit: '杯' },
    { id: 'j05', cat: 'baijiu', name: '洋河 海之蓝', abv: 42, size: 50, unit: '杯' },
    { id: 'y01', cat: 'yangjiu', name: '芝华士 12 年', abv: 40, size: 45, unit: '杯' },
    { id: 'y02', cat: 'yangjiu', name: '百龄坛 特醇', abv: 40, size: 45, unit: '杯' },
    { id: 'y03', cat: 'yangjiu', name: '金酒 汤力水', abv: 10, size: 250, unit: '杯' },
    { id: 'y04', cat: 'yangjiu', name: '人头马 VSOP', abv: 40, size: 45, unit: '杯' },
    { id: 'c01', cat: 'cocktail', name: '长岛冰茶', abv: 20, size: 250, unit: '杯', hot: true },
    { id: 'c02', cat: 'cocktail', name: '莫吉托', abv: 10, size: 250, unit: '杯' },
    { id: 'c03', cat: 'cocktail', name: '威士忌酸', abv: 15, size: 150, unit: '杯' },
    { id: 'c04', cat: 'cocktail', name: '马天尼', abv: 28, size: 90, unit: '杯' },
    { id: 'o01', cat: 'other', name: '自酿米酒', abv: 12, size: 200, unit: '碗' },
    { id: 'o02', cat: 'other', name: '果酒（青梅）', abv: 8, size: 200, unit: '杯' },
  ];

  const SCENES = [
    { id: 'banquet', name: '应酬', tone: '#c98a2e' },
    { id: 'party', name: '聚会', tone: '#8e2a33' },
    { id: 'solo', name: '独酌', tone: '#6c7f9b' },
    { id: 'celebrate', name: '庆祝', tone: '#79b58a' },
    { id: 'relax', name: '解压', tone: '#9a7bb0' },
  ];

  const MOODS = ['一般', '高兴', '微醺', '上头', '后悔'];

  /* ---------------- 地点 ---------------- */
  const PLACES = [
    { id: 'p1', name: '老张家（聚餐）', type: '朋友家', x: 24, y: 58 },
    { id: 'p2', name: '巷子里·小酒馆', type: '酒吧', x: 70, y: 36 },
    { id: 'p3', name: '南门涮肉（国贸店）', type: '餐厅', x: 38, y: 60 },
    { id: 'p4', name: '家', type: '家', x: 14, y: 56 },
    { id: 'p5', name: 'Blue Note 爵士吧', type: '酒吧', x: 84, y: 66 },
    { id: 'p6', name: '公司楼下·烤串摊', type: '其他', x: 52, y: 30 },
    { id: 'p7', name: '望京 SOHO 后巷居酒屋', type: '餐厅', x: 86, y: 86 },
  ];

  /* ---------------- 小程序演示数据 ---------------- */
  function seedMini() {
    const t = today();
    const logs = [];
    let n = 0;
    const push = (date, catId, brandId, ml, when, placeId, scene, mood) => {
      const brand = BRANDS.find(b => b.id === brandId);
      const cat = CATS.find(c => c.id === catId);
      logs.push({
        id: 'lg' + (++n),
        date, time: when,
        cat: catId,
        brandId: brand ? brand.id : '',
        brand: brand ? brand.name : (cat ? cat.name : '其他'),
        ml, abv: brand ? brand.abv : (cat ? cat.abv : 10),
        grams: +alcoholG(ml, brand ? brand.abv : (cat ? cat.abv : 10)).toFixed(1),
        placeId: placeId || '', scene: scene || '', mood: mood || '微醺',
        note: '', source: 'manual',
        createdAt: date + ' ' + when + ':00',
      });
    };
    // 今天：用户下午已喝
    push(t, 'beer', 'b01', 1000, '13:10', 'p6', 'relax', '微醺');
    push(t, 'beer', 'b01', 500, '15:40', 'p6', 'relax', '一般');
    // 昨天
    const y1 = addDays(t, -1);
    push(y1, 'baijiu', 'j02', 150, '19:30', 'p3', 'banquet', '上头');
    push(y1, 'baijiu', 'j02', 150, '20:50', 'p3', 'banquet', '上头');
    push(y1, 'beer', 'b06', 1000, '21:40', 'p3', 'banquet', '上头');
    // 前天（今天的前 1 天已用；-2 无酒）
    const d2 = addDays(t, -4);
    push(d2, 'cocktail', 'c01', 250, '22:10', 'p2', 'party', '高兴');
    push(d2, 'cocktail', 'c02', 250, '23:20', 'p2', 'party', '高兴');
    const d3 = addDays(t, -6);
    push(d3, 'wine', 'w01', 300, '20:15', 'p1', 'party', '微醺');
    const d4 = addDays(t, -9);
    push(d4, 'baijiu', 'j01', 200, '19:00', 'p3', 'banquet', '高兴');
    push(d4, 'beer', 'b06', 750, '21:00', 'p3', 'banquet', '上头');
    const d5 = addDays(t, -12);
    push(d5, 'beer', 'b05', 660, '18:40', 'p2', 'solo', '一般');
    push(d5, 'beer', 'b05', 330, '19:30', 'p2', 'solo', '微醺');
    const d6 = addDays(t, -14);
    push(d6, 'yangjiu', 'y01', 90, '22:00', 'p5', 'solo', '微醺');
    push(d6, 'cocktail', 'c03', 150, '23:10', 'p5', 'solo', '微醺');
    const d7 = addDays(t, -17);
    push(d7, 'huangjiu', 'h01', 450, '18:20', 'p4', 'celebrate', '高兴');
    const d8 = addDays(t, -21);
    push(d8, 'baijiu', 'j03', 100, '19:40', 'p7', 'banquet', '一般');
    push(d8, 'beer', 'b03', 660, '21:10', 'p7', 'banquet', '上头');
    const d9 = addDays(t, -24);
    push(d9, 'beer', 'b07', 620, '17:30', 'p4', 'relax', '微醺');
    push(d9, 'cocktail', 'c04', 180, '23:40', 'p5', 'party', '上头');
    const d10 = addDays(t, -27);
    push(d10, 'wine', 'w02', 300, '20:00', 'p1', 'party', '高兴');
    const d11 = addDays(t, -31);
    push(d11, 'beer', 'b02', 1500, '18:00', 'p6', 'party', '上头');
    push(d11, 'baijiu', 'j05', 150, '21:30', 'p6', 'banquet', '上头');

    const soberLogs = [
      { id: 'sb1', date: addDays(t, -2), type: 'sober', source: 'choice', time: '18:30' },
      { id: 'sb2', date: addDays(t, -3), type: 'cooldown', source: 'cooldown', time: '20:10' },
      { id: 'sb3', date: addDays(t, -5), type: 'sober', source: 'choice', time: '19:02' },
      { id: 'sb4', date: addDays(t, -15), type: 'sober', source: 'game', time: '21:00' },
    ];

    const decisions = [
      { id: 'dc1', date: t, type: 'drink', time: '13:10', gramsAtTime: 17.8 },
      { id: 'dc2', date: t, type: 'later', time: '16:02', gramsAtTime: 35.5 },
      { id: 'dc3', date: addDays(t, -1), type: 'drink', time: '19:30', gramsAtTime: 0 },
      { id: 'dc4', date: addDays(t, -2), type: 'sober', time: '18:30', gramsAtTime: 0 },
      { id: 'dc5', date: addDays(t, -3), type: 'later', time: '20:10', gramsAtTime: 0 },
      { id: 'dc6', date: addDays(t, -3), type: 'sober', time: '20:16', gramsAtTime: 0 },
      { id: 'dc7', date: addDays(t, -5), type: 'sober', time: '19:02', gramsAtTime: 0 },
      { id: 'dc8', date: addDays(t, -6), type: 'drink', time: '20:15', gramsAtTime: 0 },
    ];

    // 地图地点次数（由日志推导 + 部分历史）
    const placeCount = {};
    logs.forEach(l => { if (l.placeId) placeCount[l.placeId] = (placeCount[l.placeId] || 0) + 1; });
    // 模拟历史累计
    placeCount.p2 = (placeCount.p2 || 0) + 7;
    placeCount.p3 = (placeCount.p3 || 0) + 4;
    placeCount.p1 = (placeCount.p1 || 0) + 3;
    placeCount.p6 = (placeCount.p6 || 0) + 9;
    placeCount.p4 = (placeCount.p4 || 0) + 4;
    placeCount.p5 = (placeCount.p5 || 0) + 2;

    return {
      version: 5,
      user: {
        nick: '阿康', name: '阿康', gender: 'male', weight: 72, ageOk: true, minorMode: false,
        joinDate: addDays(t, -88), pricePerDrink: 45, baselineGrams: 812,
        soberBase: 900, openid: 'oJVHD_8f2a9c7d1e',
      },
      logs,
      soberLogs,
      decisions,
      // v2：点位坐标随新版地图区域调整，旧版本地缓存会在初始化时自动迁移
      places: PLACES.map(p => ({ id: p.id, name: p.name, type: p.type, x: p.x, y: p.y, count: placeCount[p.id] || 0,
        lastDate: logs.filter(l => l.placeId === p.id).map(l => l.date).sort().pop() || '' })),
      coupons: [{ id: 'cp1', month: C.monthKey(t), used: false, date: '' }],
      cooldown: null,
      lastFeedback: null,
      settings: {
        remindFriday: false, remindPayday: false, remindParty: false,
        discreet: true, nightQuiet: true,
      },
      feedbackIdx: 0,
    };
  }

  /* ---------------- 后台演示数据 ---------------- */
  function seedAdmin() {
    const t = today();
    const users = [
      { id: 'U100238', nick: '阿康', gender: 'male', age: 29, weight: 72, city: '北京', minorMode: false,
        joinDate: addDays(t, -88), lastActive: t + ' 17:12', streak: 0, bestStreak: 9, monthGrams: 0,
        status: 'active', grade: '克制型白领', logs: 0, places: 6, channel: '小红书', device: 'iOS 18' },
      { id: 'U100241', nick: '一杯就倒的鹿', gender: 'female', age: 26, weight: 51, city: '上海', minorMode: false,
        joinDate: addDays(t, -76), lastActive: t + ' 21:40', streak: 12, bestStreak: 18, monthGrams: 0,
        status: 'active', grade: '自省型微醺', logs: 0, places: 3, channel: '好友邀请', device: 'Android 15' },
      { id: 'U100255', nick: '王总（应酬版）', gender: 'male', age: 41, weight: 86, city: '深圳', minorMode: false,
        joinDate: addDays(t, -64), lastActive: addDays(t, -1) + ' 22:31', streak: 1, bestStreak: 6, monthGrams: 0,
        status: 'active', grade: '应酬型商务', logs: 0, places: 11, channel: '公众号', device: 'iOS 17' },
      { id: 'U100262', nick: '清流本流', gender: 'female', age: 23, weight: 48, city: '成都', minorMode: false,
        joinDate: addDays(t, -58), lastActive: t + ' 09:02', streak: 27, bestStreak: 27, monthGrams: 0,
        status: 'active', grade: '自省型微醺', logs: 0, places: 2, channel: '小红书', device: 'Android 14' },
      { id: 'U100270', nick: '老张', gender: 'male', age: 36, weight: 79, city: '北京', minorMode: false,
        joinDate: addDays(t, -54), lastActive: addDays(t, -2) + ' 19:55', streak: 2, bestStreak: 4, monthGrams: 0,
        status: 'active', grade: '应酬型商务', logs: 0, places: 8, channel: '好友邀请', device: 'iOS 18' },
      { id: 'U100281', nick: '李工', gender: 'male', age: 33, weight: 75, city: '杭州', minorMode: false,
        joinDate: addDays(t, -43), lastActive: addDays(t, -9) + ' 20:10', streak: 0, bestStreak: 3, monthGrams: 0,
        status: 'silent', grade: '克制型白领', logs: 0, places: 4, channel: '应用商店', device: 'Android 13' },
      { id: 'U100290', nick: '小酌怡情', gender: 'female', age: 31, weight: 55, city: '广州', minorMode: false,
        joinDate: addDays(t, -38), lastActive: t + ' 20:15', streak: 5, bestStreak: 11, monthGrams: 0,
        status: 'active', grade: '克制型白领', logs: 0, places: 5, channel: '公众号', device: 'iOS 18' },
      { id: 'U100301', nick: '今天不喝', gender: 'male', age: 28, weight: 68, city: '北京', minorMode: false,
        joinDate: addDays(t, -30), lastActive: t + ' 12:20', streak: 30, bestStreak: 30, monthGrams: 0,
        status: 'active', grade: '克制型白领', logs: 0, places: 1, channel: '好友邀请', device: 'iOS 17' },
      { id: 'U100318', nick: '夜跑的人', gender: 'female', age: 24, weight: 50, city: '上海', minorMode: false,
        joinDate: addDays(t, -22), lastActive: addDays(t, -3) + ' 23:01', streak: 0, bestStreak: 5, monthGrams: 0,
        status: 'active', grade: '自省型微醺', logs: 0, places: 4, channel: '小红书', device: 'Android 15' },
      { id: 'U100326', nick: '青年用户A', gender: 'male', age: 17, weight: 60, city: '武汉', minorMode: true,
        joinDate: addDays(t, -18), lastActive: t + ' 10:11', streak: 8, bestStreak: 8, monthGrams: 0,
        status: 'active', grade: '青年模式', logs: 0, places: 0, channel: '应用商店', device: 'Android 14' },
      { id: 'U100340', nick: '微醺的猫', gender: 'female', age: 29, weight: 53, city: '成都', minorMode: false,
        joinDate: addDays(t, -12), lastActive: addDays(t, -6) + ' 21:30', streak: 0, bestStreak: 2, monthGrams: 0,
        status: 'churn', grade: '自省型微醺', logs: 0, places: 3, channel: '应用商店', device: 'iOS 17' },
      { id: 'U100355', nick: '戒酒观察员', gender: 'male', age: 45, weight: 80, city: '上海', minorMode: false,
        joinDate: addDays(t, -7), lastActive: t + ' 08:30', streak: 4, bestStreak: 4, monthGrams: 0,
        status: 'active', grade: '应酬型商务', logs: 0, places: 2, channel: '公众号', device: 'iOS 18' },
    ];
    // 为每个后台用户生成当月饮酒克数与记录数（确定性伪随机）
    let seed = 7;
    function rand() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    const acts = [];
    users.forEach(u => {
      if (u.minorMode) { u.monthGrams = 0; u.logs = 3; return; }
      const base = { '应酬型商务': 620, '克制型白领': 380, '自省型微醺': 240 }[u.grade] || 300;
      u.monthGrams = Math.round(base * (0.5 + rand()) * (u.streak > 20 ? 0.25 : 1));
      u.logs = Math.round(u.monthGrams / 35) + 2;
      acts.push(u);
    });

    // 用户详情（用户管理 · 脱敏视图）：某用户近 60 天记录 + 操作流水
    const detailLogs = [];
    [
      [-1, 'j01', '茅台 飞天', 53, 50, 4, '应酬', 'p3', '南门涮肉（国贸店）', '北京'],
      [-2, 'b01', '青岛啤酒 经典', 4.5, 500, 3, '聚会', 'p2', '巷子里·小酒馆', '北京'],
      [-4, 'b05', '精酿 IPA（本地）', 6.5, 330, 2, '独酌', 'p4', '家', '北京'],
      [-5, 'j02', '五粮液 普五', 52, 50, 3, '应酬', 'p3', '南门涮肉（国贸店）', '北京'],
      [-8, 'w01', '长城 干红', 12, 150, 2, '庆祝', 'p1', '老张家（聚餐）', '北京'],
      [-9, 'b06', '生啤（扎）', 4.2, 500, 2, '解压', 'p6', '公司楼下·烤串摊', '北京'],
      [-12, 'c01', '长岛冰茶', 20, 250, 1, '聚会', 'p5', 'Blue Note 爵士吧', '北京'],
      [-15, 'j03', '泸州老窖 特曲', 52, 50, 2, '应酬', 'p3', '南门涮肉（国贸店）', '北京'],
      [-17, 'b03', '百威 经典', 4.5, 330, 4, '聚会', 'p2', '巷子里·小酒馆', '北京'],
      [-21, 'h01', '古越龙山 花雕', 15, 150, 2, '聚会', 'p1', '老张家（聚餐）', '北京'],
      [-24, 'b01', '青岛啤酒 经典', 4.5, 500, 2, '独酌', 'p4', '家', '北京'],
      [-28, 'y01', '芝华士 12 年', 40, 45, 2, '解压', 'p5', 'Blue Note 爵士吧', '北京'],
      [-33, 'b07', '乌苏啤酒', 4.3, 620, 3, '聚会', 'p7', '望京 SOHO 后巷居酒屋', '北京'],
      [-40, 'j05', '洋河 海之蓝', 42, 50, 2, '应酬', 'p3', '南门涮肉（国贸店）', '北京'],
    ].forEach(([dOff, skuId, name, abv, ml, qty, scene, placeId, place, city], i) => {
      detailLogs.push({ id: 'dl' + i, date: addDays(t, dOff), skuId, name, abv, ml, qty,
        grams: +(alcoholG(ml, abv) * qty).toFixed(1), scene, placeId, place, city, createdAt: addDays(t, dOff) + ' 19:40' });
    });
    const userDetail = {
      id: 'U100238',
      logs: detailLogs,
      actions: [
        { ts: t + ' 17:12', action: '提交饮酒记录', target: '青岛啤酒 ×2（31.0g）', source: '小程序' },
        { ts: t + ' 17:11', action: '点击「再想想」', target: '进入 10 分钟冷却', source: '小程序' },
        { ts: addDays(t, -1) + ' 21:05', action: '提交饮酒记录', target: '茅台 飞天 ×4（83.2g）', source: '小程序' },
        { ts: addDays(t, -2) + ' 22:40', action: '选择「不喝」', target: '获得 1 天无酒', source: '小程序' },
        { ts: addDays(t, -6) + ' 10:02', action: '导出个人数据', target: 'CSV · 86KB', source: '小程序' },
        { ts: addDays(t, -12) + ' 18:20', action: '同意位置授权', target: '仅前台使用，城市级分享', source: '小程序' },
      ],
    };

    const skus = BRANDS.map((b, i) => ({
      ...b,
      status: 'online',
      catName: (CATS.find(c => c.id === b.cat) || {}).name,
      votes: Math.round(rnd(3, 1200)),
      createdAt: addDays(t, -rndInt(5, 200)),
      updatedAt: addDays(t, -rndInt(0, 20)),
      custom: false,
    }));
    skus.push(
      { id: 'pj01', cat: 'baijiu', name: '某地散装白酒', abv: 60, size: 50, unit: '杯', status: 'pending', catName: '白酒', votes: 0, createdAt: addDays(t, -3), updatedAt: addDays(t, -3), custom: true },
      { id: 'pj02', cat: 'beer', name: '精酿·梅子艾尔', abv: 5.2, size: 330, unit: '瓶', status: 'pending', catName: '啤酒', votes: 0, createdAt: addDays(t, -2), updatedAt: addDays(t, -2), custom: true },
      { id: 'pj03', cat: 'other', name: '自制杨梅酒', abv: 18, size: 100, unit: '杯', status: 'pending', catName: '其他', votes: 0, createdAt: addDays(t, -1), updatedAt: addDays(t, -1), custom: true }
    );

    const copy = [
      { id: 'cy01', key: 'feedback.pct', title: '本月少喝百分比', content: '本月你少喝了 {pct}%，啤酒肚还在震惊中。', scene: '反馈卡', status: 'online', weight: 34, updatedAt: addDays(t, -4) },
      { id: 'cy02', key: 'feedback.money', title: '本月省下金额', content: '省下 ¥{money}，够买 6 串烤串了——但是别配酒。', scene: '反馈卡', status: 'online', weight: 33, updatedAt: addDays(t, -4) },
      { id: 'cy03', key: 'feedback.kcal', title: '本月省下热量', content: '折合 {milktea} 杯奶茶，人生第一次赢过奶茶。', scene: '反馈卡', status: 'online', weight: 33, updatedAt: addDays(t, -12) },
      { id: 'cy04', key: 'sober.thanks', title: '不喝回复', content: '好的。今晚的酒钱，记在你未来的体检报告里。', scene: '不喝反馈', status: 'online', weight: 50, updatedAt: addDays(t, -6) },
      { id: 'cy05', key: 'sober.thanks2', title: '不喝回复 2', content: '今晚零克。明天你会有两个酒量：一个真酒量，一个自律。', scene: '不喝反馈', status: 'online', weight: 50, updatedAt: addDays(t, -6) },
      { id: 'cy06', key: 'cooldown.start', title: '拖延提示', content: '好，那就十分钟后再问一次。', scene: '拖延机制', status: 'online', weight: 100, updatedAt: addDays(t, -20) },
      { id: 'cy07', key: 'place.neutral', title: '地图中性评语', content: '老地方，老朋友，老毛病。', scene: '克制地图', status: 'online', weight: 40, updatedAt: addDays(t, -9) },
      { id: 'cy08', key: 'place.neutral2', title: '地图中性评语 2', content: '来过 {n} 次了。', scene: '克制地图', status: 'online', weight: 35, updatedAt: addDays(t, -9) },
      { id: 'cy09', key: 'place.neutral3', title: '地图中性评语 3', content: '这里的记录比你想的多。', scene: '克制地图', status: 'online', weight: 25, updatedAt: addDays(t, -9) },
      { id: 'cy10', key: 'game.penalty', title: '骰子·劝退局惩罚', content: '点数最低的下一杯换无醇。', scene: '小游戏', status: 'online', weight: 100, updatedAt: addDays(t, -1) },
      { id: 'cy11', key: 'share.title', title: '月度分享图标题', content: '{year} 年 {month} 月，我喝了 {count} 次。', scene: '分享图', status: 'draft', weight: 100, updatedAt: addDays(t, -1) },
      { id: 'cy12', key: 'sober.cheer', title: '不喝庆祝', content: '干了——这杯白开水。', scene: '不喝反馈', status: 'paused', weight: 100, updatedAt: addDays(t, -30) },
    ];

    const alts = [
      { id: 'a1', name: '无醇啤酒（0.0%）', match: '啤酒', desc: '麦芽香接近，口感略薄，适合场合中的碰杯动作', status: 'online' },
      { id: 'a2', name: '0.0% 金酒 + 汤力水', match: '洋酒', desc: '苦味与杜松子香保留，兑比例 1:3', status: 'online' },
      { id: 'a3', name: '康普茶（无糖）', match: '鸡尾酒', desc: '微酸带气泡，替代酸味鸡尾酒的仪式感', status: 'online' },
      { id: 'a4', name: '无酒精莫吉托（薄荷苏打）', match: '鸡尾酒', desc: '薄荷 + 青柠 + 苏打，视觉完全接近', status: 'online' },
      { id: 'a5', name: '气泡水 + 咖啡（无醇内格罗尼）', match: '洋酒', desc: '苦味替代方案，适合餐后', status: 'draft' },
      { id: 'a6', name: '无醇起泡葡萄汁', match: '葡萄酒', desc: '包装接近起泡酒，庆祝场景适用', status: 'online' },
      { id: 'a7', name: '低度米酿（0.5%）', match: '黄酒', desc: '温热饮用，用于替代黄酒仪式', status: 'paused' },
    ];

    const thresholds = [
      { id: 'th1', key: 'dailyMale', name: '男性单日超量提示阈值', value: '60', unit: 'g', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th2', key: 'dailyFemale', name: '女性单日超量提示阈值', value: '40', unit: 'g', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th3', key: 'guideMale', name: '膳食指南男性建议上限', value: '25', unit: 'g', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th4', key: 'guideFemale', name: '膳食指南女性建议上限', value: '15', unit: 'g', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th5', key: 'cooldownMinutes', name: '拖延冷却时长', value: '10', unit: 'min', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th6', key: 'pricePerDrink', name: '单杯均价（折算默认值）', value: '45', unit: '元', scope: '用户可改', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th7', key: 'baselineMale', name: '新用户基准值（男）', value: '900', unit: 'g/月', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th8', key: 'baselineFemale', name: '新用户基准值（女）', value: '500', unit: 'g/月', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th9', key: 'remindMaxPerWeek', name: '情景提醒每周上限', value: '3', unit: '次', scope: '全局', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th10', key: 'quietStart', name: '免打扰开始时间', value: '22:00', unit: '', scope: '合规强制', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th11', key: 'quietEnd', name: '免打扰结束时间', value: '08:00', unit: '', scope: '合规强制', updatedAt: addDays(t, -40), by: '何康' },
      { id: 'th12', key: 'locationDowngrade', name: '精确坐标降级周期', value: '12', unit: '月', scope: '隐私', updatedAt: addDays(t, -40), by: '何康' },
    ];

    const roles = [
      { id: 'admin', name: '超级管理员', users: 1, perms: ['全部模块', '阈值配置', '数据导出', '账号管理'], desc: '可配置全部规则与人员权限' },
      { id: 'operator', name: '运营', users: 3, perms: ['文案库', '酒库审核', '替代推荐', '用户查看（脱敏）'], desc: '禁止查看精确坐标与导出原始数据' },
      { id: 'compliance', name: '合规审核', users: 1, perms: ['文案审核', '分享图检查', '日志审计'], desc: '拥有推送内容一票否决权' },
      { id: 'analyst', name: '数据分析', users: 2, perms: ['看板', '报表导出（聚合）'], desc: '只能访问聚合数据' },
    ];

    const admins = [
      { id: 'A01', name: '何康', account: 'hekang', role: '超级管理员', lastLogin: t + ' 09:12', lastIp: '10.24.x.x', status: 'active' },
      { id: 'A02', name: '林晓', account: 'linxiao', role: '运营', lastLogin: addDays(t, -1) + ' 18:40', lastIp: '10.24.x.x', status: 'active' },
      { id: 'A03', name: '周昶', account: 'zhouchang', role: '合规审核', lastLogin: addDays(t, -3) + ' 11:05', lastIp: '10.31.x.x', status: 'active' },
      { id: 'A04', name: '陈米', account: 'chenmi', role: '数据分析', lastLogin: addDays(t, -6) + ' 16:22', lastIp: '10.31.x.x', status: 'paused' },
    ];

    const auditLog = [
      { ts: t + ' 09:12:31', user: '何康', role: '超级管理员', action: '登录', target: '后台管理系统', ip: '10.24.8.31', result: 'success' },
      { ts: addDays(t, -1) + ' 18:42:10', user: '林晓', role: '运营', action: '审核酒库', target: 'SKU pj01（某地散装白酒）', ip: '10.24.8.44', result: 'success' },
      { ts: addDays(t, -1) + ' 15:20:02', user: '林晓', role: '运营', action: '修改文案', target: 'cy01 本月少喝百分比', ip: '10.24.8.44', result: 'success' },
      { ts: addDays(t, -2) + ' 10:03:55', user: '周昶', role: '合规审核', action: '驳回文案', target: 'cy12 不喝庆祝（含“干了”）', ip: '10.31.2.9', result: 'success' },
      { ts: addDays(t, -2) + ' 09:44:12', user: '刘一凡', role: '运营', action: '尝试导出原始坐标', target: '用户明细导出', ip: '10.24.8.51', result: 'denied' },
      { ts: addDays(t, -3) + ' 11:06:40', user: '周昶', role: '合规审核', action: '创建订阅提醒模板', target: '周五 18:00 今晚喝点吗', ip: '10.31.2.9', result: 'success' },
      { ts: addDays(t, -5) + ' 08:59:02', user: '系统', role: '定时任务', action: '月度复活券发放', target: '全部活跃用户', ip: '—', result: 'success' },
      { ts: addDays(t, -6) + ' 16:20:11', user: '陈米', role: '数据分析', action: '导出聚合报表', target: '2026 年 10 月留存', ip: '10.31.4.2', result: 'success' },
      { ts: addDays(t, -8) + ' 23:31:09', user: '系统', role: '定时任务', action: '拦截夜间推送', target: '提醒任务 #RN-2211（23:31）', ip: '—', result: 'blocked' },
      { ts: addDays(t, -12) + ' 14:12:00', user: '何康', role: '超级管理员', action: '修改阈值', target: 'dailyMale 60g（原 50g）', ip: '10.24.8.31', result: 'success' },
    ];

    // 近 30 日趋势
    const trend = [];
    let g = 3.2, r = 0.61, d7 = 0.29, d7b = 0.19;
    for (let i = 29; i >= 0; i--) {
      g = Math.max(1.1, g + (Math.random() - 0.46) * 0.22);
      r = Math.max(0.45, Math.min(0.78, r + (Math.random() - 0.5) * 0.03));
      d7 = Math.max(0.18, Math.min(0.38, d7 + (Math.random() - 0.5) * 0.012));
      trend.push({ date: addDays(t, -i), dau: +g.toFixed(2), recordRate: +r.toFixed(3), d7: +d7.toFixed(3), baseline: +d7b.toFixed(3),
        soberRatio: +(0.41 + (29 - i) * 0.0032 + Math.random() * 0.02).toFixed(3) });
    }

    const funnel = [
      { label: '打开首页', value: 12480 },
      { label: '点“喝”', value: 5210 },
      { label: '进入记录页', value: 4680 },
      { label: '提交记录成功', value: 3410 },
    ];
    const decisions = [
      { label: '喝', value: 5210, tone: '#8e2a33' },
      { label: '不喝', value: 2840, tone: '#79b58a' },
      { label: '再想想', value: 2060, tone: '#c98a2e' },
    ];
    const cooldown = {
      later: 2060, soberAfter: 742, drinkAfter: 590, noResponse: 728,
    };

    const hotspots = [
      { id: 'h1', city: '北京', area: '国贸 / 望京', count: 3841, users: 742, trend: 0.06 },
      { id: 'h2', city: '上海', area: '静安 / 徐汇', count: 3129, users: 611, trend: 0.04 },
      { id: 'h3', city: '深圳', area: '南山 / 福田', count: 2704, users: 508, trend: 0.09 },
      { id: 'h4', city: '成都', area: '玉林 / 太古里', count: 1988, users: 402, trend: 0.12 },
      { id: 'h5', city: '杭州', area: '滨江 / 西湖', count: 1602, users: 337, trend: -0.02 },
      { id: 'h6', city: '广州', area: '天河南 / 珠江新城', count: 1501, users: 318, trend: 0.03 },
    ];

    const exports = [
      { id: 'EX20261110', user: 'U100238', type: '全部个人数据', format: 'CSV', status: 'done', createdAt: addDays(t, -8) + ' 10:20', expires: addDays(t, -7) + ' 10:20', size: '86 KB' },
      { id: 'EX20261114', user: 'U100241', type: '全部个人数据', format: 'JSON', status: 'done', createdAt: addDays(t, -4) + ' 21:03', expires: addDays(t, -3) + ' 21:03', size: '124 KB' },
      { id: 'EX20261117', user: 'U100355', type: '全部个人数据', format: 'CSV', status: 'processing', createdAt: addDays(t, -1) + ' 08:44', expires: '', size: '—' },
    ];

    const notices = [
      { id: 'nt1', title: '周五 18:00 · 今晚喝点吗', scene: '情景提醒', status: 'online', reach: 3420, limit: 3, lastSend: addDays(t, -3) + ' 18:00' },
      { id: 'nt2', title: '发薪日后一天 · 今晚喝点吗', scene: '情景提醒', status: 'paused', reach: 1870, limit: 1, lastSend: addDays(t, -12) + ' 09:00' },
      { id: 'nt3', title: '拖延冷却结束 · 再问一次', scene: '拖延机制', status: 'online', reach: 2060, limit: 1, lastSend: t + ' 16:12' },
    ];

    return {
      version: 3,
      session: null,
      users, userDetail, skus, copy, alts, thresholds, roles, admins, auditLog, trend, funnel, decisions, cooldown, hotspots, exports, notices,
      config: { minorGate: true, targetUp: false, nightQuiet: true, exportNeed2fa: true, locationEncrypt: true },
    };
  }

  // 运营审核后「免发版生效」：后台 SKU 状态回写到小程序酒库（BRANDS 是两端共用的同一份酒库）
  function syncMiniFromAdmin(A) {
    try {
      (A.skus || []).forEach(s => {
        const k = BRANDS.findIndex(b => b.id === s.id);
        if (s.status === 'online') {
          const item = {
            id: s.id, cat: s.cat, name: s.name, abv: s.abv, size: s.size, unit: s.unit,
            custom: !!s.custom, source: s.custom ? '用户自定义（已审核）' : '系统公库',
          };
          if (k >= 0) BRANDS[k] = Object.assign({}, BRANDS[k], item);
          else BRANDS.push(item);
        } else if (k >= 0 && BRANDS[k].custom) {
          BRANDS.splice(k, 1);
        }
      });
      const m = C.useStore('mini', seedMini);
      m.librarySyncAt = new Date().toISOString();
      saveMini(m);
    } catch (e) { /* 原型容错 */ }
  }

  /**
   * 初始化小程序数据。若后台已同步过酒库（librarySyncAt 在本次会话内更新），
   * 则重新套用一次 SKU 同步，保证「新开标签页 / 刷新页面」后已审核的酒品依然可见（NFR-09）。
   */
  const MINI_DATA_VERSION = 5;
  function migrateMini(m) {
    if (!m || typeof m !== 'object') return m;
    if ((m.version || 1) >= MINI_DATA_VERSION) return m;
    // 旧缓存：只补齐坐标等展示字段，保留用户已有记录
    (m.places || []).forEach(pl => {
      const base = PLACES.find(x => x.id === pl.id);
      if (base) { pl.x = base.x; pl.y = base.y; pl.name = base.name; pl.type = base.type; }
    });
    if (m.user) m.cooldown = null; // 旧演示数据里的冷却早已过期，清掉避免首页倒计时错乱
    m.version = MINI_DATA_VERSION;
    C.save('mini', m);
    return m;
  }

  function initMini() {
    const m = migrateMini(C.useStore('mini', seedMini));
    try {
      if (m.librarySyncAt) {
        const A = C.useStore('admin', seedAdmin);
        if (A && A.session) syncMiniFromAdmin(A);
      }
    } catch (e) { /* 原型容错 */ }
    return C.useStore('mini', seedMini);
  }
  function saveMini(m) { C.save('mini', m); return m; }
  function resetMini() { C.storageSet('mini', seedMini()); delete window.__miniCache; return C.useStore('mini', seedMini); }
  function initAdmin() { return C.useStore('admin', seedAdmin); }
  function saveAdmin(a) { syncMiniFromAdmin(a); C.save('admin', a); return a; }
  function resetAdmin() { C.storageSet('admin', seedAdmin()); return C.useStore('admin', seedAdmin); }

  window.Mock = {
    CATS, BRANDS, SCENES, MOODS, PLACES,
    seedMini, seedAdmin, initMini, saveMini, resetMini, initAdmin, saveAdmin, resetAdmin,
  };
})(window);
