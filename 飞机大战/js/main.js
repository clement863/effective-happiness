(function () {
  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = 'menu';
      this.score = 0;
      this.best = 0;
      try { this.best = Number(localStorage.getItem('plane_best') || 0); } catch (e) {}

      this.combo = 0;
      this.comboTimer = 0;
      this.scoreMult = 1;
      this.scoreMultTimer = 0;
      this.waveIndex = 0;
      this.time = 0;
      this.nextId = 1;
      this.difficulty = 'normal';
      this.mode = 'normal';
      this.fighter = 'default';
      this.enemyFireMult = 1;
      this.spawnMult = 1;
      this.endlessTime = 0;
      this.endlessSpawnTimer = 0;
      this.endlessUpgradeTimer = 0;
      this.endlessSpawnCount = 0;
      this.bossesDefeated = 0;
      this.clearIsFinal = false;

      this.boss = null;
      this.bossLevel = 1;
      this.bossWarningTimer = 0;
      this.flash = 0;
      this.screenShake = 0;

      this.playerBullets = [];
      this.enemyBullets = [];
      this.enemies = [];
      this.powerups = [];
      this.player = null;

      this.particles = new Particles(600);
      this.background = new Background(this.ctx);
      this.waveManager = new WaveManager();
      this.input = Input;
      this.input.init(canvas);
      this.ui = new UI(this);

      this.fighterImgs = {};
      for (const key of Object.keys(CONFIG.FIGHTERS)) {
        const img = new Image();
        img.src = 'assets/fighters/fighter_' + key + '.svg';
        this.fighterImgs[key] = img;
      }

      this.ui.showMenu();

      this.lastTime = null;
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }

    // ---------- 状态控制 ----------
    start() {
      this.score = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.scoreMult = 1;
      this.scoreMultTimer = 0;
      this.waveIndex = 0;
      this.time = 0;
      this.enemyFireMult = 1;
      this.spawnMult = 1;
      this.endlessTime = 0;
      this.endlessSpawnTimer = 0;
      this.endlessUpgradeTimer = CONFIG.ENDLESS.upgradeInterval;
      this.endlessSpawnCount = 0;
      this.bossesDefeated = 0;
      this.clearIsFinal = false;
      this.boss = null;
      this.bossLevel = 1;
      this.bossWarningTimer = 0;
      this.flash = 0;
      this.screenShake = 0;

      this.player = new Player(this.fighter);
      this.playerBullets.length = 0;
      this.enemyBullets.length = 0;
      this.enemies.length = 0;
      this.powerups.length = 0;
      this.particles.clear();
      this.waveManager.reset();

      this.state = 'playing';
      this.ui.showGame();
      if (this.mode === 'normal') this.onWaveCleared();
    }

    resume() {
      if (this.state === 'paused') {
        this.state = 'playing';
        this.ui.showPause(false);
      }
    }

    togglePause() {
      if (this.state === 'playing') { this.state = 'paused'; this.ui.showPause(true); }
      else if (this.state === 'paused') { this.state = 'playing'; this.ui.showPause(false); }
    }

    gameOver() {
      this.state = 'gameover';
      this.best = Math.max(this.best, this.score);
      try { localStorage.setItem('plane_best', String(this.best)); } catch (e) {}
      this.ui.showGameOver(this.score, this.best);
      AudioMgr.play('gameover');
    }

    advanceAfterBoss() {
      this.showUpgrade();
    }

    showUpgrade() {
      this.state = 'upgrade';
      this.ui.showUpgrade(this.rollUpgrades());
    }

    rollUpgrades() {
      const p = this.player;
      const pool = CONFIG.UPGRADES.filter((u) => {
        if (u.key === 'power' && p.power >= CONFIG.PLAYER.maxPower) return false;
        if (u.key === 'heal' && p.hp >= p.maxHp) return false;
        return true;
      });
      const src = pool.slice();
      const picks = [];
      while (picks.length < Math.min(3, src.length)) {
        const i = Utils.randInt(0, src.length - 1);
        picks.push(src.splice(i, 1)[0]);
      }
      return picks;
    }

    applyUpgrade(key) {
      const p = this.player;
      switch (key) {
        case 'power': p.power = Math.min(p.power + 1, CONFIG.PLAYER.maxPower); break;
        case 'rapid': p.fireInterval = Math.max(0.07, p.fireInterval * 0.9); break;
        case 'damage': p.damageMult += 0.1; break;
        case 'heal': p.hp = Math.min(p.hp + 30, p.maxHp); break;
        case 'shield': p.shield += 1; break;
        case 'bomb': p.bombs += 1; break;
        case 'speed': p.speed *= 1.12; break;
        case 'maxhp': p.maxHp += 20; p.hp += 20; break;
      }
      AudioMgr.play('powerup');
      this.state = 'playing';
      this.ui.showGame();
      if (this.mode === 'normal') this.onWaveCleared();
    }

    backToMenu() {
      this.state = 'menu';
      this.player = null;
      this.boss = null;
      this.enemies.length = 0;
      this.playerBullets.length = 0;
      this.enemyBullets.length = 0;
      this.powerups.length = 0;
      this.ui.showMenu();
    }

    // ---------- 生成 ----------
    spawnEnemy(type) {
      const e = new Enemy(type, Utils.rand(40, CONFIG.W - 40), -30);
      e.id = this.nextId++;
      this.enemies.push(e);
    }

    spawnPlayerBullet(x, y, angle, speed, damage, opts = {}) {
      const b = new Bullet('player', x, y, angle, speed, { damage, ...opts });
      this.playerBullets.push(b);
    }

    spawnEnemyBullet(x, y, angle, speed, opts = {}) {
      const b = new Bullet('enemy', x, y, angle, speed, { color: CONFIG.COLORS.enemyBullet, ...opts });
      this.enemyBullets.push(b);
    }

    spawnPowerup(x, y, type) {
      if (!type) type = CONFIG.POWERUPS[Utils.randInt(0, CONFIG.POWERUPS.length - 1)];
      this.powerups.push(new Powerup(type, x, y));
    }

    explode(x, y, color, count) {
      this.particles.spawn(x, y, { count, color, speed: 170, size: 3, life: 0.7 });
    }

    // ---------- 无尽模式 ----------
    _updateEndless(dt) {
      this.endlessTime += dt;
      const level = Math.floor(this.endlessTime / CONFIG.ENDLESS.rampInterval) + 1;
      this.spawnMult = Math.pow(CONFIG.ENDLESS.rampFactor, level - 1);
      this.enemyFireMult = this.spawnMult;

      this.endlessUpgradeTimer -= dt;
      if (this.endlessUpgradeTimer <= 0) {
        this.endlessUpgradeTimer = CONFIG.ENDLESS.upgradeInterval;
        this.showUpgrade();
        return;
      }

      this.endlessSpawnTimer -= dt;
      if (this.endlessSpawnTimer <= 0) {
        this.endlessSpawnTimer = CONFIG.ENDLESS.baseSpawnInterval / this.spawnMult;
        this.spawnEndlessEnemy();
      }
    }

    spawnEndlessEnemy() {
      const t = this.endlessTime;
      this.endlessSpawnCount++;
      // 高级敌机 : 普通敌机 = 1 : 2（每第 3 个出 1 个高级，10 秒后启用）
      if (t > 10 && this.endlessSpawnCount % 3 === 0) {
        this.spawnEnemy('hunter');
        return;
      }
      const r = Math.random();
      let type = 'small';
      if (t > 30 && r < 0.08) type = 'elite';
      else if (t > 15 && r < 0.25) type = 'side';
      else if (t > 8 && r < 0.4) type = 'dive';
      this.spawnEnemy(type);
    }

    // ---------- 关卡 / Boss ----------
    onWaveCleared() {
      this.waveIndex++;
      if (this.waveIndex % 3 === 0) {
        this.startBoss(this.waveIndex / 3);
      } else {
        this.waveManager.startWave(this.waveIndex);
      }
    }

    startBoss(level) {
      this.bossLevel = level;
      this.bossWarningTimer = 3;
      this.ui.showBossWarning(true);
      AudioMgr.play('warning');
    }

    spawnBoss(level) {
      const diff = CONFIG.DIFFICULTY[this.difficulty] || CONFIG.DIFFICULTY.normal;
      let attackSpeed = 1;
      if (this.difficulty === 'hell' && level === 3) attackSpeed = 1.5;
      this.boss = new Boss(level, diff.bossHpBonus, attackSpeed);
      AudioMgr.play('boss');
    }

    _onBossKilled() {
      const b = this.boss;
      this.addScore(b.level * 500);
      this.explode(b.x, b.y, CONFIG.COLORS.boss, 90);
      this.explode(b.x - 40, b.y, '#ff2d78', 50);
      this.explode(b.x + 40, b.y, '#ff8c00', 50);
      this.screenShake = 0.3;
      for (let i = 0; i < 6; i++) {
        this.spawnPowerup(b.x + Utils.rand(-70, 70), b.y + Utils.rand(-50, 50));
      }
      this.boss = null;
      this.clearEnemyBullets();

      this.bossesDefeated++;
      const isFinal = this.difficulty === 'hell' && b.level === 3;
      this.clearIsFinal = isFinal;
      this.state = 'clear';
      this.ui.showBossClear(b.level, this.score, isFinal);
      AudioMgr.play('victory');
    }

    // ---------- 计分 / 能量 ----------
    addScore(pts) {
      this.combo++;
      this.comboTimer = 1.6;
      const gained = Math.floor(pts * this.scoreMult * (1 + Math.min(this.combo, 50) * 0.05));
      this.score += gained;
    }

    addEnergy(n) {
      if (!this.player || this.player.dead) return;
      this.player.energy = Utils.clamp(this.player.energy + n, 0, this.player.maxEnergy);
    }

    // ---------- 技能 ----------
    useBomb() {
      if (this.state !== 'playing') return;
      const p = this.player;
      if (!p || p.dead || p.bombs <= 0) return;
      p.bombs--;
      this.damageAllEnemies(40);
      this.clearEnemyBullets();
      this.flash = 0.3;
      this.screenShake = 0.15;
      this.explode(CONFIG.W / 2, CONFIG.H / 2, '#00e5ff', 90);
      AudioMgr.play('explosion');
    }

    tryUltimate() {
      if (this.state !== 'playing') return;
      const p = this.player;
      if (!p || p.dead || p.energy < p.maxEnergy) return;
      p.energy = 0;
      p.invincible = Math.max(p.invincible, 2);
      this.damageAllEnemies(60);
      this.clearEnemyBullets();
      this.flash = 0.5;
      this.explode(CONFIG.W / 2, CONFIG.H / 2, '#6a5cff', 120);
      AudioMgr.play('ult');
    }

    clearEnemyBullets() {
      for (const b of this.enemyBullets) {
        if (!b.dead) { b.dead = true; this.explode(b.x, b.y, b.color, 2); }
      }
    }

    damageAllEnemies(dmg) {
      for (const e of this.enemies) this.damageEnemy(e, dmg);
      if (this.boss && !this.boss.dead && !this.boss.entering) this.damageBoss(dmg);
    }

    damageEnemy(e, dmg) {
      if (e.dead) return;
      e.hp -= dmg;
      e.hitFlash = 0.08;
      if (e.hp <= 0) {
        e.dead = true;
        this.onEnemyKilled(e);
      }
    }

    damageBoss(dmg) {
      if (!this.boss || this.boss.dead || this.boss.entering) return;
      this.boss.takeDamage(dmg);
      this.addEnergy(2);
    }

    onEnemyKilled(e) {
      this.addScore(e.score);
      this.explode(e.x, e.y, e.color, 14);
      this.addEnergy(4);
      if (e.type === 'hunter') this.spawnPowerup(e.x, e.y, 'heal');
      else if (Math.random() < 0.12) this.spawnPowerup(e.x, e.y);
    }

    applyPowerup(type) {
      const p = this.player;
      switch (type) {
        case 'power': p.power = Math.min(p.power + 1, CONFIG.PLAYER.maxPower); break;
        case 'missile': p.weapon = 'missile'; p.weaponTimer = CONFIG.PLAYER.weaponDuration; break;
        case 'laser': p.weapon = 'laser'; p.weaponTimer = CONFIG.PLAYER.weaponDuration; break;
        case 'bomb': p.bombs++; break;
        case 'heal': p.hp = Math.min(p.hp + 20, p.maxHp); break;
        case 'score': this.scoreMult = 2; this.scoreMultTimer = 10; break;
      }
      AudioMgr.play('powerup');
      this.explode(p.x, p.y, '#00e5ff', 8);
    }

    // ---------- 每帧逻辑 ----------
    _handlePressed() {
      for (const k of this.input.consumePressed()) {
        if (k === 'p' || k === 'P' || k === 'Escape') this.togglePause();
        else if (k === 'j' || k === 'J') this.tryUltimate();
        else if (k === 'k' || k === 'K' || k === ' ') this.useBomb();
      }
    }

    update(dt) {
      this.background.update(dt);
      this.particles.update(dt);

      if (this.state !== 'playing') return;

      this.time += dt;
      if (this.flash > 0) this.flash -= dt;
      if (this.screenShake > 0) this.screenShake -= dt;

      this._handlePressed();

      if (this.bossWarningTimer > 0) {
        this.bossWarningTimer -= dt;
        if (this.bossWarningTimer <= 0) {
          this.spawnBoss(this.bossLevel);
          this.ui.showBossWarning(false);
        }
      }

      if (this.player && !this.player.dead) this.player.update(dt);

      for (const b of this.playerBullets) b.update(dt);
      for (const b of this.enemyBullets) b.update(dt);
      for (const e of this.enemies) e.update(dt);
      if (this.boss && !this.boss.dead) this.boss.update(dt);
      for (const p of this.powerups) p.update(dt);

      if (this.mode === 'endless') {
        this._updateEndless(dt);
      } else if (!this.boss && this.bossWarningTimer <= 0) {
        this.waveManager.update(dt);
      }

      this.runCollisions();

      if (this.comboTimer > 0) {
        this.comboTimer -= dt;
        if (this.comboTimer <= 0) this.combo = 0;
      }
      if (this.scoreMultTimer > 0) {
        this.scoreMultTimer -= dt;
        if (this.scoreMultTimer <= 0) this.scoreMult = 1;
      }

      Utils.removeDead(this.playerBullets);
      Utils.removeDead(this.enemyBullets);
      Utils.removeDead(this.enemies);
      Utils.removeDead(this.powerups);

      if (this.boss && this.boss.dead) this._onBossKilled();

      this.ui.update();
    }

    runCollisions() {
      const p = this.player;
      if (!p) return;

      for (const b of this.playerBullets) {
        if (b.dead) continue;
        if (this.boss && !this.boss.dead && !this.boss.entering && Utils.circleHit(b, this.boss)) {
          this._bulletHit(b, null, this.boss);
          if (b.dead) continue;
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Utils.circleHit(b, e)) {
            this._bulletHit(b, e, null);
            if (b.dead) break;
          }
        }
      }

      if (!p.dead) {
        for (const b of this.enemyBullets) {
          if (b.dead) continue;
          if (Utils.circleHit(b, p)) {
            b.dead = true;
            p.takeDamage(b.damage);
          }
        }
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (Utils.circleHit(e, p)) {
            e.dead = true;
            this.onEnemyKilled(e);
            p.takeDamage(20);
          }
        }
        if (this.boss && !this.boss.dead && !this.boss.entering && Utils.circleHit(this.boss, p)) {
          p.takeDamage(20);
        }
      }

      for (const pw of this.powerups) {
        if (pw.dead) continue;
        if (Utils.circleHit(pw, p)) {
          pw.dead = true;
          this.applyPowerup(pw.type);
        }
      }
    }

    _bulletHit(b, enemy, boss) {
      const targetId = enemy ? enemy.id : 'boss';
      if (b.pierce && b.hitIds.has(targetId)) return;
      b.hitIds.add(targetId);
      if (enemy) this.damageEnemy(enemy, b.damage);
      else if (boss) this.damageBoss(b.damage);
      if (!b.pierce) b.dead = true;
    }

    // ---------- 渲染 ----------
    render() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, CONFIG.W, CONFIG.H);

      const shaking = this.screenShake > 0;
      if (shaking) {
        const s = this.screenShake * 9;
        ctx.save();
        ctx.translate(Utils.rand(-s, s), Utils.rand(-s, s));
      }

      this.background.render(ctx);

      for (const pw of this.powerups) pw.render(ctx);
      for (const e of this.enemies) e.render(ctx);
      if (this.boss) this.boss.render(ctx);
      for (const b of this.enemyBullets) b.render(ctx);
      for (const b of this.playerBullets) b.render(ctx);
      if (this.player && !this.player.dead) this.player.render(ctx);
      this.particles.render(ctx);

      if (this.boss && !this.boss.dead && this.state === 'playing') this._renderBossBar(ctx);

      if (shaking) ctx.restore();

      if (this.flash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.8).toFixed(3) + ')';
        ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);
      }
    }

    _renderBossBar(ctx) {
      const b = this.boss;
      const w = 300;
      const h = 10;
      const x = (CONFIG.W - w) / 2;
      const y = 18;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = '#ff2d78';
      ctx.fillRect(x, y, w * (b.hp / b.maxHp), h);
      ctx.strokeStyle = '#ff2d78';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    }

    _loop(ts) {
      requestAnimationFrame(this._loop);
      if (this.lastTime == null) this.lastTime = ts;
      const dt = Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this.update(dt);
      this.render();
    }
  }

  window.Game = Game;

  function resize() {
    const scale = Math.min(window.innerWidth / CONFIG.W, window.innerHeight / CONFIG.H);
    const c = document.getElementById('game-container');
    c.style.width = (CONFIG.W * scale) + 'px';
    c.style.height = (CONFIG.H * scale) + 'px';
  }
  window.addEventListener('resize', resize);

  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  window.game = game;
  resize();
})();