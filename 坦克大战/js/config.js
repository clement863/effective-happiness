// config.js —— 全局配置（所有可调参数集中地）
// 加载方式：普通 <script>，暴露 window.CONFIG
// 所有魔数一律写在这里，禁止散落硬编码。

window.CONFIG = {
  // 画布与固定逻辑步长
  canvas: { width: 1280, height: 720 },
  tick: 1000 / 60,            // 固定逻辑步长（毫秒）
  tiles: 40,                  // 单格像素，障碍对齐用

  // 坦克基础属性
  tank: {
    size: 36,                 // 碰撞盒边长
    speed: 160,               // 移动速度 px/s
    maxHp: 100,
    armor: 0,                 // 减伤
    fireCooldown: 600,        // 默认射击间隔 ms
    invincibleTime: 2000,     // 复活无敌 ms
    respawnDelay: 3000,       // 复活等待 ms
  },

  // 子弹
  bullet: { speed: 420, radius: 5, damage: 20, life: 2000 },

  // 墙体与障碍物
  walls: { brickHp: 3 },   // 砖块耐久：完好→轻裂→重裂→摧毁（3 段裂纹表现）

  // AI BOSS（双人联手战人机）
  boss: {
    maxHp: 600,
    speed: 150,
    fireCooldown: 800,
    enrageThreshold: 0.4,     // 血量 < 40% 狂暴
    enrageFireCooldown: 450,
  },

  // 玩家辅助与隐藏调试（程序员专用，不出现在操作说明）
  player: {
    autoLock: true,           // 自动锁敌：炮塔自动指向最近敌人（设为 false 可关闭）
  },
  cheat: {
    enabled: true,            // 是否启用隐藏无敌模式（总开关）
    laserInterval: 150,       // 无敌模式激光连射间隔 ms
  },

  // 地图主题与地图专属机制
  maps: {
    plain:   { name: '平原', hazard: null },
    desert:  { name: '沙漠', hazard: 'sandstorm', sandstorm: { push: 80, switchEvery: 5000 } },
    island:  { name: '海岛', hazard: null },
    volcano: { name: '火山', hazard: 'lava', lava: { interval: 5000, damage: 6 } },
    jungle:  { name: '丛林', hazard: null },
  },

  // 增益道具
  powerup: { spawnInterval: 6000, maxCount: 4 },
  powerupEffects: {
    speed:   { duration: 5000, mult: 1.5 },
    shield:  { hits: 3 },
    rapid:   { duration: 6000, mult: 0.4 },
    freeze:  { duration: 4000, slow: 0.5, slowDuration: 4000 },
    stealth: { duration: 4000 },
    heal:    { amount: 30 },
  },

  // 限时武器掉落（装备）
  weapon: {
    dropInterval: 8000,
    maxCount: 3,
    lifetime: 15000,          // 掉落物停留 15s 未拾取即消失
    useDuration: 15000,       // 拾取后生效 15s
    missile: { speed: 320, turnRate: 3.0, life: 3000, damage: 50, cooldown: 900 },
    laser:   { range: 900, damage: 40, beamMs: 100, cooldown: 1200 },
    spread:  { pellets: 3, spreadAngle: 30, damage: 18, speed: 420, cooldown: 700 },
    mine:    { damage: 80, placeCooldown: 1000, maxCount: 3, triggerRadius: 28, mineLife: 20000 },
    pierce:  { damage: 30, speed: 480, cooldown: 550 },
  },

  // 键盘映射（P3 用小键盘，笔记本可用 I/J/K/L + H 备选）
  // cheat 为各玩家的隐藏无敌开挂键（程序员专用，不在操作说明中标出）
  keys: {
    p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'KeyF', skill: 'KeyG', cheat: 'KeyQ' },
    p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'KeyL', skill: 'KeyK', cheat: 'KeyO' },
    p3: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', fire: 'Numpad0', skill: 'NumpadAdd', cheat: 'NumpadMultiply' },
  },

  // 计分与胜负
  score: { kill: 100, death: -20, pickup: 10, winKills: 5, roundTime: 120 },

  // 队伍配色（霓虹主色）
  colors: {
    p1: '#00e5ff',   // 霓虹青
    p2: '#ff2ec8',   // 品红
    p3: '#3cff8f',   // 霓虹绿
    ai: '#ff9f00',   // 警示橙（BOSS 狂暴渐变红）
  },
};