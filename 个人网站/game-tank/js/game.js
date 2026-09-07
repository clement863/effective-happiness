// game.js —— 核心游戏逻辑（地图 / 坦克 / 子弹 / 武器 / AI / 场景 / 循环 / HUD）
// 加载方式：普通 <script>，暴露 window.Game
// 依赖（按加载顺序）：config.js → input.js → audio.js → particles.js → tank.js → 本文件

(function () {
  "use strict";
  const { roundRect, ellipse, lighten, darken, clamp, lerpAngle, drawTank } = window.TankRender;
  const C = window.CONFIG;

  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  cv.width = C.canvas.width;
  cv.height = C.canvas.height;

  /* ================= 场景与模式 ================= */
  let scene = 'menu';            // menu | controls | modeselect | mapselect | game | gameover
  let mode = null;               // single | double | triple | coop
  let mapType = 'plain';         // plain | desert | island | volcano | jungle
  let pendingMode = null;        // 选完模式后，等待选择地图
  let playerNames = ['1P', '2P', '3P'];

  /* ================= 运行时实体 ================= */
  let tanks = [];
  let bullets = [];
  let mines = [];
  let powerups = [];
  let weaponDrops = [];
  let walls = [];                // 实体墙 {x,y,w,h,type,hp}  type: steel|brick
  let bushes = [];               // 草丛（不阻挡）
  let blockedGrid = [];          // A* 用的格子障碍表
  let spawnPoints = [];

  let timer = 0;                 // 模式倒计时（秒）
  let powerupTimer = 0;
  let weaponTimer = 0;
  let godMode = { 1: false, 2: false, 3: false }; // 各玩家隐藏无敌开挂开关（程序员专用）
  let mapHazard = { type: null, timer: 0, windAngle: 0, windVec: { x: 0, y: 0 } }; // 地图机制（沙尘暴/火山）

  // 地图主题配色（视觉相关，集中在渲染层）
  const MAP_THEME = {
    plain:   { bg: '#0a0e1a', grid: '#0e1a30', steel: '#1a2a44', steelLine: '#3a7bd5', brickHi: '#8a4a22', brickLo: '#5a3a1a', brickLine: '#d98a3a', bush: '60,160,90' },
    desert:  { bg: '#161108', grid: '#2a2010', steel: '#2a2414', steelLine: '#c9a34a', brickHi: '#c98f3a', brickLo: '#8a5a1a', brickLine: '#f0c060', bush: '150,140,60' },
    island:  { bg: '#042029', grid: '#0a3242', steel: '#12323e', steelLine: '#3adfdf', brickHi: '#7a5a3a', brickLo: '#4a3a22', brickLine: '#c9a060', bush: '40,140,100' },
    volcano: { bg: '#160a0a', grid: '#2a1210', steel: '#2a1512', steelLine: '#d5482a', brickHi: '#6a3a2a', brickLo: '#3a1a12', brickLine: '#ff7040', bush: '120,70,40' },
    jungle:  { bg: '#06150c', grid: '#0e2a18', steel: '#1a2a1e', steelLine: '#3ac94a', brickHi: '#7a5a2a', brickLo: '#4a3a18', brickLine: '#c9a040', bush: '60,180,80' },
  };

  /* ================= 工具 ================= */
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // 实体墙类型判断（steel/brick 可破坏挡弹，water 不可破坏但同样阻挡）
  function isSolidWall(type) { return type === 'steel' || type === 'brick' || type === 'water'; }

  /* ================= 地图 ================= */
  function buildMap() {
    walls = []; bushes = []; spawnPoints = [];
    const T = C.tiles;
    const cols = Math.floor(C.canvas.width / T);
    const rows = Math.floor(C.canvas.height / T);
    blockedGrid = Array.from({ length: rows }, () => Array(cols).fill(false));

    function addWall(cx, cy, type) {
      const hp = type === 'brick' ? C.walls.brickHp : Infinity;
      walls.push({ x: cx * T, y: cy * T, w: T, h: T, type, hp, maxHp: type === 'brick' ? hp : Infinity });
      blockedGrid[cy][cx] = true;
    }
    function addBush(cx, cy) {
      bushes.push({ x: cx * T, y: cy * T, w: T, h: T });
    }

    // 左上象限蓝图，镜像到四个象限保证对称
    const q = [];
    const steel = [[7, 4], [8, 4], [7, 5], [8, 5], [4, 7], [4, 8], [5, 8], [6, 8]];
    const brick = [[11, 3], [12, 3], [11, 4], [12, 4], [9, 6], [10, 6], [9, 7], [12, 6], [12, 7], [13, 6]];
    const bush = [[1, 2], [2, 2], [3, 2], [2, 1], [1, 6], [2, 6], [3, 6]];

    const placed = new Set();
    function place(c, r, type) {
      const k = c + ',' + r;
      if (placed.has(k)) return;
      placed.add(k);
      if (type === 'steel') addWall(c, r, 'steel');
      else if (type === 'brick') addWall(c, r, 'brick');
      else addBush(c, r);
    }
    function mirror(c, r, type) {
      place(c, r, type);
      place(cols - 1 - c, r, type);
      place(c, rows - 1 - r, type);
      place(cols - 1 - c, rows - 1 - r, type);
    }
    steel.forEach(([c, r]) => mirror(c, r, 'steel'));
    brick.forEach(([c, r]) => mirror(c, r, 'brick'));
    bush.forEach(([c, r]) => mirror(c, r, 'bush'));

    // 中心小钢块
    addWall(15, 8, 'steel');
    addWall(16, 8, 'steel');

    // 出生点（四角，保持空位）
    spawnPoints = [
      { x: 4 * T + T / 2, y: 4 * T + T / 2 },    // 左上 P1
      { x: 27 * T + T / 2, y: 13 * T + T / 2 },  // 右下 P2
      { x: 4 * T + T / 2, y: 13 * T + T / 2 },   // 左下 P3
      { x: 27 * T + T / 2, y: 4 * T + T / 2 },   // 右上 AI
    ];

    // —— 地图差异化 ——
    if (mapType === 'jungle') {
      // 丛林：更多可破坏砖块 + 更多草丛掩体
      const extraBrick = [[5, 5], [6, 5], [5, 6], [9, 9], [10, 9], [9, 10], [14, 5], [15, 5], [14, 12], [15, 12]];
      extraBrick.forEach(([c, r]) => mirror(c, r, 'brick'));
      const extraBush = [[3, 3], [3, 5], [3, 7], [5, 3], [6, 3]];
      extraBush.forEach(([c, r]) => mirror(c, r, 'bush'));
    } else if (mapType === 'island') {
      // 海岛：水塘（不可破坏、不可通行）
      const water = [[6, 6], [7, 6], [6, 7], [7, 7], [13, 10], [14, 10], [13, 11], [14, 11]];
      water.forEach(([c, r]) => { if (!placed.has(c + ',' + r)) addWall(c, r, 'water'); });
    }
  }

  function pointInSolidWall(x, y) {
    for (const w of walls) {
      if (isSolidWall(w.type)) {
        if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
      }
    }
    return false;
  }

  // 射线检测是否有实体墙遮挡
  function lineOfSight(a, b) {
    const d = dist(a, b);
    const steps = Math.max(2, Math.ceil(d / 12));
    for (let i = 1; i < steps; i++) {
      const x = a.x + (b.x - a.x) * (i / steps);
      const y = a.y + (b.y - a.y) * (i / steps);
      if (pointInSolidWall(x, y)) return false;
    }
    return true;
  }

  /* ================= A* 寻路（格子） ================= */
  function blockedCell(cx, cy) {
    if (cx < 0 || cy < 0 || cy >= blockedGrid.length || cx >= blockedGrid[0].length) return true;
    return blockedGrid[cy][cx];
  }

  function astar(sx, sy, tx, ty) {
    const T = C.tiles;
    const cols = blockedGrid[0].length, rows = blockedGrid.length;
    const sc = clamp(Math.floor(sx / T), 0, cols - 1), sr = clamp(Math.floor(sy / T), 0, rows - 1);
    const ec = clamp(Math.floor(tx / T), 0, cols - 1), er = clamp(Math.floor(ty / T), 0, rows - 1);
    if (blockedCell(ec, er)) return null;
    if (sc === ec && sr === er) return null;
    const key = (c, r) => r * cols + c;
    const start = { c: sc, r: sr, g: 0, h: 0, f: 0, p: null };
    start.h = Math.abs(ec - sc) + Math.abs(er - sr);
    start.f = start.h;
    const open = [start];
    const closed = new Set();
    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const n = open.shift();
      const k = key(n.c, n.r);
      if (closed.has(k)) continue;
      closed.add(k);
      if (n.c === ec && n.r === er) {
        const path = [];
        let cur = n;
        while (cur.p) { path.push({ c: cur.c, r: cur.r }); cur = cur.p; }
        path.reverse();
        return path;
      }
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dc, dr] of dirs) {
        const nc = n.c + dc, nr = n.r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (blockedCell(nc, nr)) continue;
        const nk = key(nc, nr);
        if (closed.has(nk)) continue;
        const g = n.g + 1;
        const h = Math.abs(ec - nc) + Math.abs(er - nr);
        const exist = open.find(o => o.c === nc && o.r === nr);
        if (exist) { if (g < exist.g) { exist.g = g; exist.f = g + exist.h; exist.p = n; } }
        else open.push({ c: nc, r: nr, g, h, f: g + h, p: n });
      }
    }
    return null;
  }

  /* ================= 坦克 ================= */
  class Tank {
    constructor(x, y, color, team, opts) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.angle = (opts && opts.angle) || -Math.PI / 2;
      this.baseColor = color;
      this.color = color;
      this.team = team;
      this.size = C.tank.size;
      this.isAI = !!(opts && opts.isAI);
      this.boss = !!(opts && opts.boss);
      this.maxHp = (opts && opts.maxHp) || C.tank.maxHp;
      this.hp = this.maxHp;
      this.armor = C.tank.armor;
      this.speed = (opts && opts.speed) || (this.boss ? C.boss.speed : C.tank.speed);
      this.baseFireCooldown = (opts && opts.fireCooldown) || (this.boss ? C.boss.fireCooldown : C.tank.fireCooldown);

      this.alive = true;
      this.respawns = !!(opts && opts.respawns);
      this.respawnTimer = 0;
      this.invincible = 0;
      this.pIndex = (opts && opts.pIndex) || null;

      this.treadOffset = 0;
      this.recoil = 0;
      this.flash = 0;
      this.phase = Math.random() * 6.283;
      this.cooldown = 0;

      this.score = 0;
      this.kills = 0;

      // buffs
      this.weapon = null;          // {type, remaining, cooldown}
      this.shieldHits = 0;
      this.speedBoost = 0;
      this.rapidBoost = 0;
      this.stealthBoost = 0;
      this.freezeBuff = 0;
      this.slowTimer = 0;
      this.slowFactor = 1;
      this.skillCooldown = 0;
      this.skillBoost = 0;

      this.ai = { state: 'patrol', path: null, pathIndex: 0, repathTimer: 0, reposTimer: 0, strafe: 1, waypoint: null };
    }

    get effectiveSpeed() {
      let s = this.speed;
      if (this.speedBoost > 0) s *= C.powerupEffects.speed.mult;
      if (this.skillBoost > 0) s *= 1.7;
      if (this.slowTimer > 0) s *= this.slowFactor;
      return s;
    }
    get fireInterval() {
      let c = this.weapon ? this.weapon.cooldown : this.baseFireCooldown;
      if (this.rapidBoost > 0) c *= C.powerupEffects.rapid.mult;
      return c;
    }
    get stealth() { return this.stealthBoost > 0; }
  }

  function enemiesOf(t) {
    return tanks.filter(x => x !== t && x.alive && x.team !== t.team && !x.stealth);
  }
  function nearestEnemy(t) {
    let best = null, bd = Infinity;
    for (const e of enemiesOf(t)) { const d = dist(t, e); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function nearestPickup(t) {
    let best = null, bd = Infinity;
    for (const p of powerups) { const d = dist(t, p); if (d < bd) { bd = d; best = p; } }
    for (const w of weaponDrops) { const d = dist(t, w); if (d < bd) { bd = d; best = w; } }
    return best;
  }

  /* ================= 子弹与武器 ================= */
  class Bullet {
    constructor(x, y, angle, shooter, opts) {
      opts = opts || {};
      this.x = x; this.y = y; this.angle = angle;
      this.speed = opts.speed || C.bullet.speed;
      this.damage = opts.damage || C.bullet.damage;
      this.radius = opts.radius || C.bullet.radius;
      this.life = opts.life || C.bullet.life;
      this.team = shooter.team;
      this.shooter = shooter;
      this.kind = opts.kind || 'normal';   // normal | pierce | missile
      this.slows = !!opts.slows;
      this.turnRate = opts.turnRate || 0;
      this.trail = [];
      this.dead = false;
      this.hitWallDamage = 0;
      this.wallHit = null;
    }
    update(dt) {
      if (this.kind === 'missile') {
        const t = nearestEnemyMissile(this);
        if (t) {
          const desired = Math.atan2(t.y - this.y, t.x - this.x);
          this.angle = steer(this.angle, desired, this.turnRate * dt);
        }
      }
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.life -= dt * 1000;
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 6) this.trail.shift();

      if (this.kind !== 'pierce') {
        const w = this.hitWall();
        if (w) {
          if (this.kind === 'missile') {
            FX.spawnExplosion(this.x, this.y, '#ff7a00', 24); AudioFX.play('explode'); FX.shake(8, 0.2);
            if (w.type === 'brick') damageBrick(w, this.x, this.y);
          } else if (w.type === 'brick') {
            damageBrick(w, this.x, this.y);
          } else if (w.type === 'steel') {
            FX.spawnSparks(this.x, this.y, '#cfe0ff'); AudioFX.play('hit');
          } else if (w.type === 'water') {
            FX.spawnSparks(this.x, this.y, '#3adfdf');
          }
          this.dead = true; return;
        }
      }
      const hit = this.hitTank();
      if (hit) { this.resolveHit(hit); this.dead = true; return; }
      if (this.life <= 0) this.dead = true;
    }
    hitTank() {
      for (const t of tanks) {
        if (t === this.shooter || t.team === this.team || !t.alive) continue;
        if (Math.abs(this.x - t.x) < t.size / 2 + this.radius && Math.abs(this.y - t.y) < t.size / 2 + this.radius) return t;
      }
      return null;
    }
    hitWall() {
      for (const w of walls) {
        if (this.x >= w.x && this.x <= w.x + w.w && this.y >= w.y && this.y <= w.y + w.h) return w;
      }
      return null;
    }
    resolveHit(t) {
      dealDamage(t, this.damage, this.shooter);
      if (this.slows) { t.slowTimer = C.powerupEffects.freeze.slowDuration; t.slowFactor = C.powerupEffects.freeze.slow; }
      FX.spawnSparks(this.x, this.y, this.shooter ? this.shooter.color : '#fff');
      AudioFX.play('hit');
    }
  }

  function nearestEnemyMissile(b) {
    let best = null, bd = Infinity;
    for (const t of tanks) {
      if (t === b.shooter || t.team === b.team || !t.alive) continue;
      const d = dist(b, t); if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  function steer(cur, target, maxStep) {
    let d = (target - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return cur + clamp(d, -maxStep, maxStep);
  }
  function removeWall(w) {
    const i = walls.indexOf(w);
    if (i >= 0) walls.splice(i, 1);
    // 同步解除 A* 障碍标记，使 AI 可在砖块被摧毁后穿行
    const cx = Math.floor(w.x / C.tiles), cy = Math.floor(w.y / C.tiles);
    if (blockedGrid[cy] && blockedGrid[cy][cx] !== undefined) blockedGrid[cy][cx] = false;
  }

  // 砖块受击：逐步损坏，摧毁时溅出碎片并轻微震动
  function damageBrick(w, hx, hy) {
    w.hp--;
    const th = MAP_THEME[mapType] || MAP_THEME.plain;
    if (w.hp <= 0) {
      removeWall(w);
      const cx = w.x + w.w / 2, cy = w.y + w.h / 2;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 170;
        FX.spawn(cx, cy, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.3 + Math.random() * 0.4,
          size: 2 + Math.random() * 3,
          color: Math.random() < 0.5 ? th.brickHi : th.brickLo,
          drag: 0.9,
        });
      }
      FX.shake(4, 0.15);
      AudioFX.play('explode');
    } else {
      FX.spawnSparks(hx, hy, th.brickLine);
      AudioFX.play('hit');
    }
  }

  function spawnBullet(tank, opts) {
    opts = opts || {};
    const angle = opts.angle !== undefined ? opts.angle : tank.angle;
    const bx = tank.x + Math.cos(angle) * (tank.size / 2 + 4);
    const by = tank.y + Math.sin(angle) * (tank.size / 2 + 4);
    const b = new Bullet(bx, by, angle, tank, opts);
    if (tank.freezeBuff > 0) b.slows = true;
    bullets.push(b);
    FX.spawnMuzzle(bx, by, angle, tank.color);
  }

  function spawnMissile(tank) {
    const opts = {
      kind: 'missile',
      speed: C.weapon.missile.speed,
      turnRate: C.weapon.missile.turnRate,
      life: C.weapon.missile.life,
      damage: C.weapon.missile.damage,
      radius: 6,
    };
    spawnBullet(tank, opts);
  }

  function fireLaser(tank) {
    const w = C.weapon.laser;
    const dx = Math.cos(tank.angle), dy = Math.sin(tank.angle);
    const hits = tanks
      .filter(t => t !== tank && t.team !== tank.team && t.alive)
      .filter(t => segmentCircle(tank.x, tank.y, dx, dy, w.range, t.x, t.y, t.size / 2))
      .sort((a, b) => dist2(tank, a) - dist2(tank, b));
    for (const t of hits) { dealDamage(t, w.damage, tank); FX.spawnSparks(t.x, t.y, '#ff2ec8'); }
    FX.addBeam(tank.x, tank.y, tank.angle, w.range, '#00e5ff', w.beamMs);
    FX.shake(6, 0.15);
    AudioFX.play('laser');
  }

  function segmentCircle(ox, oy, dx, dy, len, cx, cy, r) {
    let t = (cx - ox) * dx + (cy - oy) * dy;
    t = clamp(t, 0, len);
    const px = ox + dx * t, py = oy + dy * t;
    const ddx = cx - px, ddy = cy - py;
    return ddx * ddx + ddy * ddy <= r * r;
  }

  function fireSpread(tank) {
    const w = C.weapon.spread;
    const spreadRad = w.spreadAngle * Math.PI / 180;
    const step = spreadRad / (w.pellets - 1);
    const base = tank.angle - spreadRad / 2;
    for (let i = 0; i < w.pellets; i++) {
      spawnBullet(tank, { speed: w.speed, damage: w.damage, life: 1600, angle: base + step * i });
    }
  }

  class Mine {
    constructor(x, y, team) {
      this.x = x; this.y = y; this.team = team;
      this.armed = false; this.armTimer = 800;
      this.life = C.weapon.mine.mineLife;
      this.r = C.weapon.mine.triggerRadius;
      this.dead = false;
    }
    update(dt) {
      this.life -= dt * 1000;
      if (this.life <= 0) { this.dead = true; return; }
      if (!this.armed) { this.armTimer -= dt * 1000; if (this.armTimer <= 0) this.armed = true; }
      if (this.armed) {
        for (const t of tanks) {
          if (t.team === this.team || !t.alive) continue;
          if (dist(this, t) <= this.r) { this.explode(t); break; }
        }
      }
    }
    explode(t) {
      dealDamage(t, C.weapon.mine.damage, null);
      FX.spawnExplosion(this.x, this.y, '#ff2e2e', 30);
      FX.shake(10, 0.3);
      AudioFX.play('explode');
      this.dead = true;
    }
  }

  function placeMine(tank) {
    const mineCount = mines.filter(m => m.team === tank.team).length;
    if (mineCount >= C.weapon.mine.maxCount) return;
    const bx = tank.x - Math.cos(tank.angle) * (tank.size / 2 + 10);
    const by = tank.y - Math.sin(tank.angle) * (tank.size / 2 + 10);
    mines.push(new Mine(bx, by, tank.team));
    AudioFX.play('mine');
  }

  function tankFire(tank) {
    if (tank.cooldown > 0) return;
    tank.cooldown = tank.fireInterval;
    tank.recoil = 3;
    const w = tank.weapon;
    if (!w) { spawnBullet(tank); AudioFX.play('fire'); return; }
    switch (w.type) {
      case 'missile': spawnMissile(tank); AudioFX.play('missile'); break;
      case 'laser': fireLaser(tank); break;
      case 'spread': fireSpread(tank); AudioFX.play('fire'); break;
      case 'mine': placeMine(tank); break;
      case 'pierce': spawnBullet(tank, { kind: 'pierce', speed: C.weapon.pierce.speed, damage: C.weapon.pierce.damage, life: 2000 }); AudioFX.play('pierce'); break;
    }
  }

  /* ================= 伤害 / 死亡 / 复活 ================= */
  function dealDamage(target, dmg, source) {
    if (!target.alive || target.invincible > 0) return;
    if (godMode[target.pIndex] && !target.isAI) return;  // 隐藏无敌：对应玩家免伤
    if (source && source.team === target.team) return;   // 队友免伤（双人 vs AI 联手模式）
    if (target.shieldHits > 0) { target.shieldHits--; FX.spawnSparks(target.x, target.y, '#00e5ff'); AudioFX.play('shield'); return; }
    const real = Math.max(0, dmg - target.armor);
    target.hp -= real;
    target.flash = 1;
    if (source && source !== target) AudioFX.play('hurt'); else if (!source) AudioFX.play('hurt');
    if (target.hp <= 0) onDeath(target, source);
  }

  function onDeath(t, killer) {
    t.alive = false;
    t.hp = 0;
    FX.spawnExplosion(t.x, t.y, t.color, 40);
    FX.shake(14, 0.4);
    AudioFX.play('die');
    if (killer && killer !== t) {
      killer.kills++;
      killer.score += C.score.kill;
      t.score += C.score.death;
      AudioFX.play('kill');
    }
    if (t.respawns) t.respawnTimer = C.tank.respawnDelay;
    checkVictory();
  }

  function respawn(t) {
    t.x = t.spawnX; t.y = t.spawnY;
    t.hp = t.maxHp;
    t.alive = true;
    t.invincible = C.tank.invincibleTime;
    t.weapon = null;
  }

  /* ================= 道具与武器掉落 ================= */
  const POWERUP_TYPES = ['speed', 'shield', 'rapid', 'freeze', 'stealth', 'heal'];
  const WEAPON_TYPES = ['missile', 'laser', 'spread', 'mine', 'pierce'];

  function randomFreeCell() {
    const cols = blockedGrid[0].length, rows = blockedGrid.length;
    for (let i = 0; i < 60; i++) {
      const cx = Math.floor(rnd(1, cols - 1)), cy = Math.floor(rnd(2, rows - 2));
      if (blockedCell(cx, cy)) continue;
      const x = cx * C.tiles + C.tiles / 2, y = cy * C.tiles + C.tiles / 2;
      if (tanks.some(t => t.alive && dist({ x, y }, t) < 120)) continue;
      return { x, y };
    }
    return { x: C.canvas.width / 2, y: C.canvas.height / 2 };
  }

  function spawnPowerup() {
    if (powerups.length >= C.powerup.maxCount) return;
    const p = randomFreeCell();
    powerups.push({ x: p.x, y: p.y, type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)], r: 16 });
  }
  function spawnWeaponDrop() {
    if (weaponDrops.length >= C.weapon.maxCount) return;
    const p = randomFreeCell();
    weaponDrops.push({ x: p.x, y: p.y, type: WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)], life: C.weapon.lifetime, r: 18 });
  }

  function applyPowerup(t, type) {
    switch (type) {
      case 'speed': t.speedBoost = C.powerupEffects.speed.duration; break;
      case 'shield': t.shieldHits = C.powerupEffects.shield.hits; break;
      case 'rapid': t.rapidBoost = C.powerupEffects.rapid.duration; break;
      case 'freeze': t.freezeBuff = C.powerupEffects.freeze.duration; break;
      case 'stealth': t.stealthBoost = C.powerupEffects.stealth.duration; break;
      case 'heal': t.hp = Math.min(t.maxHp, t.hp + C.powerupEffects.heal.amount); break;
    }
    if (t.pIndex) t.score += C.score.pickup;
    AudioFX.play('powerup');
  }
  function applyWeapon(t, type) {
    t.weapon = { type, remaining: C.weapon.useDuration, cooldown: C.weapon[type].cooldown };
    AudioFX.play('pickup');
  }

  function checkPickups() {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      for (const t of tanks) {
        if (!t.alive) continue;
        if (dist(t, p) <= p.r + t.size / 2) { applyPowerup(t, p.type); powerups.splice(i, 1); break; }
      }
    }
    for (let i = weaponDrops.length - 1; i >= 0; i--) {
      const w = weaponDrops[i];
      for (const t of tanks) {
        if (!t.alive) continue;
        if (dist(t, w) <= w.r + t.size / 2) { applyWeapon(t, w.type); weaponDrops.splice(i, 1); break; }
      }
    }
  }

  /* ================= AI ================= */
  function nearestThreat(t) {
    let best = null, bestT = Infinity;
    for (const b of bullets) {
      if (b.team === t.team) continue;
      const dx = t.x - b.x, dy = t.y - b.y;
      const d = Math.hypot(dx, dy);
      if (d > 240) continue;
      const vx = Math.cos(b.angle) * b.speed, vy = Math.sin(b.angle) * b.speed;
      const dot = dx * vx + dy * vy;
      if (dot <= 0) continue;
      const tc = d * d / Math.max(1, dot);
      if (tc < bestT) { bestT = tc; best = b; }
    }
    return best;
  }

  function driveToward(t, tx, ty, dt) {
    const ai = t.ai;
    let dirX, dirY;
    const los = lineOfSight(t, { x: tx, y: ty });
    if (los) {
      dirX = tx - t.x; dirY = ty - t.y;
    } else {
      ai.repathTimer -= dt;
      if (ai.repathTimer <= 0 || !ai.path || ai.pathIndex >= ai.path.length) {
        ai.path = astar(t.x, t.y, tx, ty);
        ai.pathIndex = 0;
        ai.repathTimer = 0.4;
      }
      if (ai.path && ai.pathIndex < ai.path.length) {
        const wp = ai.path[ai.pathIndex];
        const wx = wp.c * C.tiles + C.tiles / 2;
        const wy = wp.r * C.tiles + C.tiles / 2;
        dirX = wx - t.x; dirY = wy - t.y;
        if (Math.hypot(dirX, dirY) < 14) ai.pathIndex++;
        if (dirX === 0 && dirY === 0) { dirX = tx - t.x; dirY = ty - t.y; }
      } else { dirX = tx - t.x; dirY = ty - t.y; }
    }
    const len = Math.hypot(dirX, dirY) || 1;
    return { x: dirX / len, y: dirY / len };
  }

  function aiThink(t, dt) {
    const ai = t.ai;
    ai.reposTimer -= dt;

    // BOSS 阶段变色与射速
    if (t.boss) {
      const ratio = t.hp / t.maxHp;
      t.color = ratio < C.boss.enrageThreshold ? '#ff2e2e' : '#ff9f00';
      if (ratio < C.boss.enrageThreshold) t.baseFireCooldown = C.boss.enrageFireCooldown;
      else t.baseFireCooldown = C.boss.fireCooldown;
    }

    const target = nearestEnemy(t);
    const threat = nearestThreat(t);
    const pick = nearestPickup(t);
    const d = target ? dist(t, target) : Infinity;
    const los = target ? lineOfSight(t, target) : false;

    let state = 'patrol';
    if (threat) state = 'evade';
    else if (target) {
      if (los && d < 340) state = 'attack';
      else if (pick && (t.hp < t.maxHp * 0.5 || !t.weapon) && !los) state = 'seek';
      else if (t.boss && ai.reposTimer <= 0) state = 'reposition';
      else state = 'chase';
    }

    if (state !== 'attack') { ai.path = null; ai.pathIndex = 0; }
    ai.state = state;

    let mvx = 0, mvy = 0;
    switch (state) {
      case 'patrol': {
        if (!ai.waypoint || dist(t, ai.waypoint) < 40) {
          const p = randomFreeCell();
          ai.waypoint = { x: p.x, y: p.y };
        }
        const v = driveToward(t, ai.waypoint.x, ai.waypoint.y, dt);
        mvx = v.x; mvy = v.y;
        break;
      }
      case 'chase': {
        const v = driveToward(t, target.x, target.y, dt);
        mvx = v.x; mvy = v.y;
        if (los && d < 300 && t.cooldown <= 0) { aimAndFire(t, target); }
        break;
      }
      case 'attack': {
        aimAndFire(t, target);
        // 轻微横向走位
        ai.strafe = Math.sin(ai.reposTimer * 3) > 0 ? 1 : -1;
        const ax = -(target.y - t.y), ay = (target.x - t.x);
        const al = Math.hypot(ax, ay) || 1;
        mvx = (ax / al) * ai.strafe * 0.5;
        mvy = (ay / al) * ai.strafe * 0.5;
        break;
      }
      case 'evade': {
        const bx = Math.cos(threat.angle), by = Math.sin(threat.angle);
        const side = (t.x + t.y) % 2 < 1 ? 1 : -1;
        mvx = -by * side; mvy = bx * side;
        break;
      }
      case 'seek': {
        const v = driveToward(t, pick.x, pick.y, dt);
        mvx = v.x; mvy = v.y;
        break;
      }
      case 'reposition': {
        ai.reposTimer = 3;
        const p = randomFreeCell();
        const v = driveToward(t, p.x, p.y, dt);
        mvx = v.x; mvy = v.y;
        break;
      }
    }

    // 朝向跟随移动方向
    if (mvx || mvy) {
      const ang = Math.atan2(mvy, mvx);
      t.angle = lerpAngle(t.angle, ang, dt * 8);
    }
    moveEntity(t, mvx, mvy, dt);
  }

  function aimAndFire(t, target) {
    const ts = Math.max(0.05, dist(t, target) / C.bullet.speed);
    const ax = target.x + target.vx * ts;
    const ay = target.y + target.vy * ts;
    const want = Math.atan2(ay - t.y, ax - t.x);
    t.angle = lerpAngle(t.angle, want, 0.6);
    if (Math.abs(normalizeDelta(want - t.angle)) < 0.15 && t.cooldown <= 0) tankFire(t);
  }
  function normalizeDelta(d) { d = d % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  /* ================= 移动与碰撞 ================= */
  function moveEntity(t, dx, dy, dt) {
    const sp = t.effectiveSpeed;
    const vx = dx * sp, vy = dy * sp;
    const X = clamp(t.x + vx * dt, t.size / 2, C.canvas.width - t.size / 2);
    if (!collidesWalls(X, t.y, t)) t.x = X;
    const Y = clamp(t.y + vy * dt, t.size / 2, C.canvas.height - t.size / 2);
    if (!collidesWalls(t.x, Y, t)) t.y = Y;
    // 记录速度（供 AI 预判）
    const nx = t.x, ny = t.y;
    t.vx = (nx - t.x) / Math.max(0.001, dt) * 0; // 占位，下面用位移近似
    t.vx = vx; t.vy = vy;
    return { moved: (nx !== t.x || ny !== t.y) };
  }

  function collidesWalls(x, y, t) {
    const h = t.size / 2;
    for (const w of walls) {
      if (isSolidWall(w.type)) {
        if (aabb(x - h, y - h, t.size, t.size, w.x, w.y, w.w, w.h)) return true;
      }
    }
    return false;
  }

  /* ================= 玩家控制 ================= */
  function playerControl(t, dt) {
    const key = C.keys['p' + t.pIndex];
    let dx = 0, dy = 0;
    if (Input.isDown(key.up)) dy -= 1;
    if (Input.isDown(key.down)) dy += 1;
    if (Input.isDown(key.left)) dx -= 1;
    if (Input.isDown(key.right)) dx += 1;
    let mvx = 0, mvy = 0;
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      mvx = dx / l; mvy = dy / l;
      moveEntity(t, mvx, mvy, dt);
      t.treadOffset += t.effectiveSpeed * dt * 0.5;
    } else {
      t.vx = 0; t.vy = 0;
    }

    // 隐藏无敌开挂：血量无限 + 自动锁敌激光连射（程序员专用，见 config.cheat）
    if (godMode[t.pIndex]) { godUpdate(t, dt); return; }

    // 自动锁敌：有敌人时炮塔自动指向最近敌人，否则跟随移动方向
    const e = C.player.autoLock ? nearestEnemy(t) : null;
    if (e) {
      t.angle = lerpAngle(t.angle, Math.atan2(e.y - t.y, e.x - t.x), dt * 14);
    } else if (dx || dy) {
      t.angle = lerpAngle(t.angle, Math.atan2(mvy, mvx), dt * 10);
    }

    if (Input.consumePress(key.fire)) tankFire(t);
    if (Input.consumePress(key.skill) && t.skillCooldown <= 0) {
      t.skillBoost = 2000; t.skillCooldown = 6000;
      AudioFX.play('powerup');
    }
  }

  // 隐藏无敌模式：锁血 + 自动锁敌 + 激光连射
  function godUpdate(t, dt) {
    t.hp = t.maxHp;
    t.invincible = 0;
    t.cooldown -= dt * 1000;
    const e = nearestEnemy(t);
    if (!e) return;
    t.angle = lerpAngle(t.angle, Math.atan2(e.y - t.y, e.x - t.x), dt * 16);
    if (t.cooldown <= 0) {
      t.cooldown = C.cheat.laserInterval;
      t.recoil = 2;
      fireLaser(t);
    }
  }

  /* ================= 建局 ================= */
  function buildTanks(m) {
    tanks = [];
    const c = C.colors;
    const mk = (x, y, color, team, isAI, boss, pIndex, respawns) => new Tank(x, y, color, team, { isAI, boss, pIndex, respawns });
    if (m === 'single') {
      tanks.push(mk(spawnPoints[0].x, spawnPoints[0].y, c.p1, 0, false, false, 1, false));
      tanks.push(mk(spawnPoints[3].x, spawnPoints[3].y, c.ai, 1, true, false, null, false));
    } else if (m === 'double') {
      tanks.push(mk(spawnPoints[0].x, spawnPoints[0].y, c.p1, 0, false, false, 1, true));
      tanks.push(mk(spawnPoints[1].x, spawnPoints[1].y, c.p2, 1, false, false, 2, true));
    } else if (m === 'triple') {
      tanks.push(mk(spawnPoints[0].x, spawnPoints[0].y, c.p1, 0, false, false, 1, true));
      tanks.push(mk(spawnPoints[1].x, spawnPoints[1].y, c.p2, 1, false, false, 2, true));
      tanks.push(mk(spawnPoints[2].x, spawnPoints[2].y, c.p3, 2, false, false, 3, true));
    } else if (m === 'coop') {
      tanks.push(mk(spawnPoints[0].x, spawnPoints[0].y, c.p1, 0, false, false, 1, true));
      tanks.push(mk(spawnPoints[1].x, spawnPoints[1].y, c.p2, 0, false, false, 2, true));
      const boss = new Tank(spawnPoints[3].x, spawnPoints[3].y, c.ai, 1, { isAI: true, boss: true, maxHp: C.boss.maxHp, speed: C.boss.speed, fireCooldown: C.boss.fireCooldown, respawns: false });
      tanks.push(boss);
    }
    for (const t of tanks) { t.spawnX = t.x; t.spawnY = t.y; }
  }

  function startMode(m, map) {
    mode = m;
    if (map) mapType = map;
    godMode = { 1: false, 2: false, 3: false };
    const hzType = (C.maps[mapType] && C.maps[mapType].hazard) || null;
    const windAngle = Math.random() * Math.PI * 2;
    mapHazard = {
      type: hzType,
      timer: 0,
      windAngle,
      windVec: hzType === 'sandstorm' ? { x: Math.cos(windAngle), y: Math.sin(windAngle) } : { x: 0, y: 0 },
    };
    buildMap();
    buildTanks(m);
    bullets = []; mines = []; powerups = []; weaponDrops = [];
    timer = C.score.roundTime;
    powerupTimer = 2;
    weaponTimer = 4;
    FX.clear();
    Input.clear();
    scene = 'game';
    showOverlay(null);
    if (AI_clock === null) { /* noop */ }
  }

  /* ================= 胜负判定 ================= */
  function checkVictory() {
    if (scene !== 'game') return;
    if (mode === 'single') {
      const ai = tanks.find(t => t.isAI);
      const p = tanks.find(t => !t.isAI);
      if (ai && !ai.alive) gameOver('挑战成功！', '你击败了 AI');
      else if (p && !p.alive) gameOver('挑战失败', '你被 AI 击败了');
    } else if (mode === 'double') {
      const p1 = tanks[0], p2 = tanks[1];
      if (p1.kills >= C.score.winKills) gameOver('1P 获胜！', p1.kills + ' : ' + p2.kills);
      else if (p2.kills >= C.score.winKills) gameOver('2P 获胜！', p1.kills + ' : ' + p2.kills);
    } else if (mode === 'coop') {
      const boss = tanks.find(t => t.boss);
      const humans = tanks.filter(t => !t.isAI);
      if (boss && !boss.alive) gameOver('击败 BOSS，胜利！', '双人联手成功');
      else if (humans.every(t => !t.alive)) gameOver('挑战失败', '两名玩家全部阵亡');
    }
  }

  function checkTimeVictory() {
    if (timer > 0) return;
    if (mode === 'double') {
      const p1 = tanks[0], p2 = tanks[1];
      gameOver(p1.kills === p2.kills ? '平局' : (p1.kills > p2.kills ? '1P 获胜！' : '2P 获胜！'), p1.kills + ' : ' + p2.kills);
    } else if (mode === 'triple') {
      const sorted = tanks.slice().sort((a, b) => b.score - a.score);
      const names = sorted.map(t => (t.pIndex ? t.pIndex + 'P' : 'AI') + ' ' + t.score + '分');
      gameOver('3P 获胜！', names.join('  /  '));
    }
  }

  function gameOver(title, subtitle) {
    scene = 'gameover';
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultSub').textContent = subtitle || '';
    showOverlay('gameover');
  }

  /* ================= 覆盖层显示 ================= */
  function showOverlay(name) {
    for (const id of ['menu', 'controls', 'modeselect', 'mapselect', 'gameover']) {
      document.getElementById(id).classList.toggle('active', id === name);
    }
  }

  /* ================= 更新 ================= */
  function update(dt) {
    // 隐藏无敌模式切换键（各玩家 keys.pN.cheat，不出现在操作说明）
    if (C.cheat.enabled) {
      for (let pi = 1; pi <= 3; pi++) {
        const ck = C.keys['p' + pi] && C.keys['p' + pi].cheat;
        if (ck && Input.consumePress(ck)) {
          godMode[pi] = !godMode[pi];
          AudioFX.play(godMode[pi] ? 'powerup' : 'click');
        }
      }
    }

    if (timer > 0 && (mode === 'double' || mode === 'triple')) {
      timer -= dt;
      if (timer <= 0) { timer = 0; checkTimeVictory(); }
    }

    powerupTimer -= dt;
    if (powerupTimer <= 0) { spawnPowerup(); powerupTimer = C.powerup.spawnInterval / 1000; }
    weaponTimer -= dt;
    if (weaponTimer <= 0) { spawnWeaponDrop(); weaponTimer = C.weapon.dropInterval / 1000; }

    // 道具/装备倒计时
    for (let i = weaponDrops.length - 1; i >= 0; i--) {
      weaponDrops[i].life -= dt * 1000;
      if (weaponDrops[i].life <= 0) weaponDrops.splice(i, 1);
    }

    // 坦克
    for (const t of tanks) {
      if (!t.alive) {
        if (t.respawns && t.respawnTimer > 0) {
          t.respawnTimer -= dt * 1000;
          if (t.respawnTimer <= 0) respawn(t);
        }
        continue;
      }
      t.cooldown -= dt * 1000;
      t.flash = Math.max(0, t.flash - dt * 4);
      t.recoil = Math.max(0, t.recoil - dt * 30);
      t.invincible = Math.max(0, t.invincible - dt * 1000);
      t.speedBoost = Math.max(0, t.speedBoost - dt * 1000);
      t.rapidBoost = Math.max(0, t.rapidBoost - dt * 1000);
      t.stealthBoost = Math.max(0, t.stealthBoost - dt * 1000);
      t.freezeBuff = Math.max(0, t.freezeBuff - dt * 1000);
      t.slowTimer = Math.max(0, t.slowTimer - dt * 1000);
      t.skillCooldown = Math.max(0, t.skillCooldown - dt * 1000);
      t.skillBoost = Math.max(0, t.skillBoost - dt * 1000);
      if (t.weapon) {
        t.weapon.remaining -= dt * 1000;
        if (t.weapon.remaining <= 0) t.weapon = null;
      }

      if (t.isAI) aiThink(t, dt);
      else playerControl(t, dt);
    }

    // 子弹
    for (let i = bullets.length - 1; i >= 0; i--) {
      bullets[i].update(dt);
      if (bullets[i].dead) bullets.splice(i, 1);
    }
    // 地雷
    for (let i = mines.length - 1; i >= 0; i--) {
      mines[i].update(dt);
      if (mines[i].dead) mines.splice(i, 1);
    }

    updateHazards(dt);
    checkPickups();
    FX.update(dt);
  }

  /* ================= 地图机制（沙尘暴 / 火山灼烧） ================= */
  function updateHazards(dt) {
    const cfg = C.maps[mapType];
    const hz = mapHazard;
    if (!cfg || !cfg.hazard) return;
    hz.timer -= dt * 1000;

    if (cfg.hazard === 'sandstorm') {
      // 风向周期性切换 + 沙尘粒子
      if (hz.timer <= 0) {
        hz.timer = cfg.sandstorm.switchEvery;
        hz.windAngle = Math.random() * Math.PI * 2;
        hz.windVec = { x: Math.cos(hz.windAngle), y: Math.sin(hz.windAngle) };
        AudioFX.play('wind');
      }
      // 风力推动：卷入玩家/坦克，随风向位移
      const push = cfg.sandstorm.push;
      for (const t of tanks) {
        if (!t.alive) continue;
        const nx = clamp(t.x + hz.windVec.x * push * dt, t.size / 2, C.canvas.width - t.size / 2);
        if (!collidesWalls(nx, t.y, t)) t.x = nx;
        const ny = clamp(t.y + hz.windVec.y * push * dt, t.size / 2, C.canvas.height - t.size / 2);
        if (!collidesWalls(t.x, ny, t)) t.y = ny;
      }
      if (Math.random() < dt * 8) {
        FX.spawn(rnd(0, C.canvas.width), rnd(0, C.canvas.height), {
          vx: hz.windVec.x * rnd(120, 260),
          vy: hz.windVec.y * rnd(120, 260),
          life: rnd(0.6, 1.2),
          size: rnd(2, 4),
          color: '#d9b87a',
          drag: 0.96,
        });
      }
    } else if (cfg.hazard === 'lava') {
      if (hz.timer <= 0) {
        hz.timer = cfg.lava.interval;
        lavaBurst();
      }
    }
  }

  function lavaBurst() {
    FX.shake(4, 0.25);
    AudioFX.play('lava');
    // 上升灰烬粒子
    for (let i = 0; i < 26; i++) {
      FX.spawn(rnd(0, C.canvas.width), C.canvas.height - rnd(0, 60), {
        vx: rnd(-25, 25),
        vy: -rnd(80, 180),
        life: rnd(0.7, 1.5),
        size: rnd(2, 4),
        color: Math.random() < 0.5 ? '#ff7040' : '#ff2e2e',
        drag: 0.98,
      });
    }
    // 灼烧：所有存活单位受到少量伤害（无敌玩家在 dealDamage 中豁免）
    for (const t of tanks) {
      if (!t.alive) continue;
      dealDamage(t, C.maps.volcano.lava.damage, null);
    }
  }

  /* ================= 渲染 ================= */
  function drawGrid() {
    const th = MAP_THEME[mapType] || MAP_THEME.plain;
    ctx.clearRect(0, 0, C.canvas.width, C.canvas.height);
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, C.canvas.width, C.canvas.height);
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    const T = C.tiles;
    for (let x = 0; x <= C.canvas.width; x += T) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, C.canvas.height); ctx.stroke(); }
    for (let y = 0; y <= C.canvas.height; y += T) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(C.canvas.width, y); ctx.stroke(); }
  }

  // 砖块渲染：2×2 砖面 + 随耐久下降叠加裂纹
  function drawBrickTile(w, th) {
    const bw = w.w / 2, bh = w.h / 2, gap = 2;
    // 砖缝底色
    ctx.fillStyle = th.brickLine;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    // 四块砖（颜色交错，模拟真实砌砖）
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? th.brickHi : th.brickLo;
        ctx.fillRect(w.x + c * bw + gap / 2, w.y + r * bh + gap / 2, bw - gap, bh - gap);
      }
    }
    // 裂纹：耐久越低越密集（hp 1/3 时轻裂，2/3 时重裂）
    const ratio = w.maxHp ? w.hp / w.maxHp : 1;
    const dmg = 1 - ratio;
    if (dmg > 0 && dmg < 1) {
      ctx.strokeStyle = 'rgba(15,8,4,0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(w.x + w.w * 0.25, w.y + 1);
      ctx.lineTo(w.x + w.w * 0.45, w.y + w.h * 0.45);
      ctx.lineTo(w.x + w.w * 0.28, w.y + w.h - 1);
      ctx.stroke();
      if (dmg >= 0.5) {
        ctx.beginPath();
        ctx.moveTo(w.x + w.w * 0.78, w.y + 1);
        ctx.lineTo(w.x + w.w * 0.58, w.y + w.h * 0.5);
        ctx.lineTo(w.x + w.w * 0.82, w.y + w.h - 1);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }

  function drawWalls() {
    const th = MAP_THEME[mapType] || MAP_THEME.plain;
    for (const w of walls) {
      if (w.type === 'steel') {
        ctx.fillStyle = th.steel;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = th.steelLine;
        ctx.lineWidth = 2;
        ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(w.x + 4, w.y + 8); ctx.lineTo(w.x + w.w - 4, w.y + 8); ctx.stroke();
        // 铆钉点缀，强化“钢板”质感
        ctx.fillStyle = th.steelLine;
        const rr = 2.5, off = 6;
        [[off, off], [w.w - off, off], [off, w.h - off], [w.w - off, w.h - off]].forEach(([px, py]) => {
          ctx.beginPath(); ctx.arc(w.x + px, w.y + py, rr, 0, Math.PI * 2); ctx.fill();
        });
      } else if (w.type === 'water') {
        const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
        g.addColorStop(0, '#1a5a7a');
        g.addColorStop(1, '#0e3a52');
        ctx.fillStyle = g;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeStyle = 'rgba(80,220,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
        ctx.beginPath(); ctx.moveTo(w.x, w.y + 6); ctx.lineTo(w.x + w.w, w.y + 6); ctx.stroke();
      } else if (w.type === 'brick') {
        drawBrickTile(w, th);
      }
    }
    // 草丛（半透明，画在墙后、坦克前）
    const bushRGB = th.bush;
    ctx.fillStyle = 'rgba(' + bushRGB + ',0.35)';
    for (const b of bushes) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(' + bushRGB + ',0.30)';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(' + bushRGB + ',0.35)';
    }
  }

  function drawPowerups() {
    for (const p of powerups) {
      const info = POWERUP_ICON[p.type];
      const pulse = 1 + Math.sin(performance.now() * 0.005) * 0.12;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.shadowColor = info.color; ctx.shadowBlur = 12;
      ctx.fillStyle = info.color;
      ctx.globalAlpha = 0.9;
      ellipse(ctx, 0, 0, 13 * pulse, 13 * pulse);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0e1a';
      ctx.font = 'bold 13px Consolas';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.label, 0, 1);
      ctx.restore();
    }
  }

  function drawWeaponDrops() {
    for (const w of weaponDrops) {
      const info = WEAPON_ICON[w.type];
      const blink = w.life < 3000 && Math.floor(performance.now() / 200) % 2 === 0;
      if (blink) ctx.globalAlpha = 0.4;
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.shadowColor = info.color; ctx.shadowBlur = 14;
      ctx.fillStyle = '#0a0e1a';
      roundRect(ctx, -16, -16, 32, 32, 6);
      ctx.fill();
      ctx.strokeStyle = info.color; ctx.lineWidth = 2;
      roundRect(ctx, -16, -16, 32, 32, 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = info.color;
      ctx.font = 'bold 16px Consolas';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(info.label, 0, 1);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function drawMines() {
    for (const m of mines) {
      const color = m.armed ? '#ff2e2e' : '#ff9f00';
      const pulse = m.armed ? 1 + Math.sin(performance.now() * 0.01) * 0.2 : 0.7;
      ctx.globalAlpha = m.armed ? 0.9 : 0.5;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(m.x, m.y, 6 * pulse, 0, Math.PI * 2); ctx.fill();
      if (m.armed) {
        ctx.strokeStyle = 'rgba(255,46,46,0.4)';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawBullets() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bullets) {
      for (let i = 0; i < b.trail.length; i++) {
        const tr = b.trail[i];
        const a = (i / b.trail.length) * 0.4;
        ctx.globalAlpha = a;
        ctx.fillStyle = b.shooter ? b.shooter.color : '#fff';
        ctx.beginPath(); ctx.arc(tr.x, tr.y, b.radius * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.shooter ? b.shooter.color : '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const POWERUP_ICON = {
    speed: { label: 'S', color: '#ffe14d' },
    shield: { label: 'D', color: '#00e5ff' },
    rapid: { label: 'R', color: '#ff9f00' },
    freeze: { label: 'F', color: '#7fd4ff' },
    stealth: { label: 'X', color: '#b07fff' },
    heal: { label: '+', color: '#3cff8f' },
  };
  const WEAPON_ICON = {
    missile: { label: 'M', color: '#ff7a00' },
    laser: { label: 'L', color: '#ff2ec8' },
    spread: { label: 'W', color: '#ffd54d' },
    mine: { label: 'B', color: '#ff2e2e' },
    pierce: { label: 'P', color: '#ff2ec8' },
  };

  /* ================= HUD ================= */
  function drawHUD() {
    // 顶部模式名 + 地图名 + 计时
    ctx.fillStyle = '#a8c8ff';
    ctx.font = '13px Consolas';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const names = { single: '单人挑战', double: '双人对战', triple: '三人混战', coop: '双人联手战人机' };
    const mapName = (C.maps[mapType] && C.maps[mapType].name) || '';
    ctx.fillText((names[mode] || '') + ' · ' + mapName, 16, 12);
    if (mode === 'double' || mode === 'triple') {
      ctx.textAlign = 'right';
      ctx.fillText('时间 ' + Math.ceil(timer) + 's', C.canvas.width - 16, 12);
      ctx.textAlign = 'left';
    }
    // 隐藏无敌模式提示（角落小标识，不写入操作说明）
    const godOn = [1, 2, 3].filter(i => godMode[i]);
    if (godOn.length) {
      ctx.fillStyle = '#ff2ec8';
      ctx.font = 'bold 12px Consolas';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('GOD: ' + godOn.map(i => i + 'P').join(' '), C.canvas.width - 16, C.canvas.height - 12);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
    }

    // 玩家卡片
    let py = 36;
    for (const t of tanks) {
      if (t.isAI && !t.boss) continue;
      drawHealthBar(t, py, t);
      py += 26;
    }
    // BOSS 大血条
    const boss = tanks.find(t => t.boss);
    if (boss && boss.alive) {
      const bw = 400, bx = (C.canvas.width - bw) / 2, by = 12;
      ctx.fillStyle = '#1a1a1a';
      roundRect(ctx, bx - 2, by - 2, bw + 4, 18, 4); ctx.fill();
      const ratio = Math.max(0, boss.hp / boss.maxHp);
      ctx.fillStyle = '#ff2e2e';
      roundRect(ctx, bx, by, bw * ratio, 14, 3); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Consolas';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('BOSS', bx + bw / 2, by + 7);
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    }
  }

  function drawHealthBar(t, py, tank) {
    const x = 16, w = 180, h = 20;
    ctx.fillStyle = 'rgba(10,14,26,0.7)';
    roundRect(ctx, x, py, w, h, 4); ctx.fill();
    const ratio = Math.max(0, tank.hp / tank.maxHp);
    ctx.fillStyle = tank.color;
    roundRect(ctx, x + 2, py + 2, (w - 4) * ratio, h - 4, 3); ctx.fill();
    ctx.strokeStyle = tank.color;
    ctx.lineWidth = 1;
    roundRect(ctx, x, py, w, h, 4); ctx.stroke();
    ctx.fillStyle = '#e8f0ff';
    ctx.font = '12px Consolas';
    ctx.fillText((tank.pIndex ? tank.pIndex + 'P' : 'AI') + (tank.isAI ? '' : '') + '  ' + Math.ceil(tank.hp), x + 6, py + 4);
    if (tank.pIndex) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd54d';
      ctx.fillText((mode === 'triple' ? '分 ' + tank.score : '击杀 ' + tank.kills), x + w - 6, py + 4);
      ctx.textAlign = 'left';
    }
    // 武器倒计时 / 护盾
    let tag = '';
    if (tank.weapon) tag = '武器 ' + tank.weapon.type.toUpperCase() + ' ' + (tank.weapon.remaining / 1000).toFixed(1) + 's';
    else if (tank.shieldHits > 0) tag = '护盾 x' + tank.shieldHits;
    if (tag) { ctx.fillStyle = '#9ff'; ctx.fillText(tag, x + 6, py + h - 13); }
  }

  function render() {
    drawGrid();
    if (scene !== 'game') return;
    const off = FX.getOffset();
    ctx.save();
    ctx.translate(off.x, off.y);
    drawWalls();
    drawPowerups();
    drawWeaponDrops();
    drawMines();
    // 坦克（隐身半透明）
    for (const t of tanks) {
      if (!t.alive) continue;
      if (t.invincible > 0 && Math.floor(t.invincible / 120) % 2 === 0) continue; // 无敌闪烁
      ctx.save();
      if (t.stealth) ctx.globalAlpha = 0.35;
      drawTank(ctx, t);
      ctx.restore();
    }
    drawBullets();
    FX.render(ctx);
    ctx.restore();
    drawHUD();
  }

  /* ================= 主循环 ================= */
  let last = performance.now();
  let AI_clock = null;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (scene === 'game') update(dt);
    render();
    requestAnimationFrame(loop);
  }

  /* ================= 按钮绑定 ================= */
  function bindUI() {
    document.getElementById('btnStart').addEventListener('click', () => { AudioFX.ensure(); AudioFX.play('click'); showOverlay('modeselect'); });
    document.getElementById('btnControls').addEventListener('click', () => { AudioFX.ensure(); AudioFX.play('click'); showOverlay('controls'); });
    document.getElementById('btnSound').addEventListener('click', (e) => { const on = AudioFX.toggle(); e.target.textContent = on ? '音效：开' : '音效：关'; });
    document.getElementById('btnBack').addEventListener('click', () => { AudioFX.play('click'); showOverlay('menu'); });
    document.getElementById('btnBackMode').addEventListener('click', () => { AudioFX.play('click'); showOverlay('menu'); });
    document.getElementById('btnBackMap').addEventListener('click', () => { AudioFX.play('click'); showOverlay('modeselect'); });
    // 选模式 → 选地图 → 开局
    document.querySelectorAll('.mode-card').forEach((el) => {
      el.addEventListener('click', () => { AudioFX.ensure(); AudioFX.play('click'); pendingMode = el.dataset.mode; showOverlay('mapselect'); });
    });
    document.querySelectorAll('.map-card').forEach((el) => {
      el.addEventListener('click', () => { AudioFX.ensure(); AudioFX.play('click'); startMode(pendingMode || 'single', el.dataset.map); });
    });
    document.getElementById('btnRestart').addEventListener('click', () => { AudioFX.ensure(); AudioFX.play('click'); startMode(mode, mapType); });
    document.getElementById('btnMenu').addEventListener('click', () => { AudioFX.play('click'); showOverlay('menu'); });
  }

  /* ================= 初始化 ================= */
  function init() {
    bindUI();
    showOverlay('menu');
    requestAnimationFrame(loop);
  }

  // 暴露接口（供 index.html 或控制台调试）
  window.Game = {
    startMode, toMenu: () => showOverlay('menu'),
    toControls: () => showOverlay('controls'),
    toModeSelect: () => showOverlay('modeselect'),
    toMapSelect: () => showOverlay('mapselect'),
    restart: () => startMode(mode, mapType),
    toggleSound: AudioFX.toggle,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();