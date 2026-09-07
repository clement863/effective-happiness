(function () {
  class Boss {
    constructor(level, hpBonus = 0, attackSpeed = 1) {
      this.level = level;
      this.x = CONFIG.W / 2;
      this.y = -90;
      this.radius = 56;
      this.maxHp = 600 + level * 500 + hpBonus;
      this.hp = this.maxHp;
      this.attackSpeed = attackSpeed;
      this.enterY = 160;
      this.entering = true;
      this.phase = 1;
      this.dead = false;
      this.hitFlash = 0;
      this.timer = 0;
      this.spiralOffset = 0;
      this.t = 0;
      this.laserTimer = 2.5;
      this.laserTelegraph = false;
      this.laserCharge = 0;
      this.laserAngle = 0;
    }

    ratio() {
      return this.hp / this.maxHp;
    }

    updatePhase() {
      const r = this.ratio();
      let p = 1;
      if (r < 0.33) p = 3;
      else if (r < 0.66) p = 2;
      if (p !== this.phase) {
        this.phase = p;
        this.hitFlash = 0.5;
        const g = window.game;
        g.clearEnemyBullets();
        g.explode(this.x, this.y, CONFIG.COLORS.boss, 40);
        this.pulseRing = 0;
      }
    }

    update(dt) {
      this.t += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);

      if (this.entering) {
        this.y += 90 * dt;
        if (this.y >= this.enterY) {
          this.y = this.enterY;
          this.entering = false;
        }
        return;
      }

      this.updatePhase();
      this.fight(dt);
    }

    fight(dt) {
      this.spiralOffset += dt * 0.9;
      const interval = (this.phase === 3 ? 0.7 : this.phase === 2 ? 0.9 : 1.1) / this.attackSpeed;
      this.timer += dt;
      if (this.timer >= interval) {
        this.timer = 0;
        this.firePattern();
      }

      if (this.phase >= 2) {
        this.laserTimer -= dt * this.attackSpeed;
        if (!this.laserTelegraph && this.laserTimer <= 0) {
          this.laserTelegraph = true;
          this.laserCharge = 0.7;
          this.laserAngle = Utils.angleTo(this.x, this.y, window.game.player.x, window.game.player.y);
        }
        if (this.laserTelegraph) {
          this.laserCharge -= dt;
          if (this.laserCharge <= 0) {
            window.game.spawnEnemyBullet(this.x, this.y, this.laserAngle, 340, {
              type: 'laser', radius: 12, damage: 20, color: '#ff2244',
            });
            this.laserTelegraph = false;
            this.laserTimer = this.phase === 3 ? 3.2 : 4.2;
          }
        }
      }
    }

    firePattern() {
      const g = window.game;
      const roll = Math.random();
      if (this.phase === 1) {
        if (roll < 0.6) this.fireFan(g, 5);
        else this.fireRing(g, 20, 110);
      } else if (this.phase === 2) {
        if (roll < 0.4) this.fireSpiral(g);
        else if (roll < 0.7) this.fireFan(g, 7);
        else this.fireRing(g, 24, 130);
      } else {
        if (roll < 0.35) this.fireSpiral(g);
        else if (roll < 0.65) this.fireFan(g, 9);
        else this.fireRing(g, 30, 150);
      }
    }

    fireFan(g, n) {
      const base = Utils.angleTo(this.x, this.y, g.player.x, g.player.y);
      const spread = Utils.rad(90);
      for (let i = 0; i < n; i++) {
        const a = n === 1 ? base : base - spread / 2 + spread * i / (n - 1);
        g.spawnEnemyBullet(this.x, this.y, a, 170);
      }
    }

    fireRing(g, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 / n) * i + this.spiralOffset;
        g.spawnEnemyBullet(this.x, this.y, a, speed);
      }
    }

    fireSpiral(g) {
      for (let i = 0; i < 4; i++) {
        const a = this.spiralOffset + (Math.PI / 2) * i;
        g.spawnEnemyBullet(this.x, this.y, a, 150);
      }
    }

    takeDamage(dmg) {
      this.hp -= dmg;
      this.hitFlash = 0.08;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    }

    render(ctx) {
      const s = this.radius;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.shadowColor = CONFIG.COLORS.boss;
      ctx.shadowBlur = 30;

      const flash = this.hitFlash > 0;
      const hull = flash ? '#ffffff' : '#241238';
      const hullEdge = flash ? '#ffffff' : '#3a1d5e';
      const accent = flash ? '#ffffff' : CONFIG.COLORS.boss;

      // 旋转能量环（背景）
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.35, this.t, this.t + Math.PI * 1.7);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // 三喷口引擎尾焰（向上）
      const flicker = 0.6 + 0.4 * Math.sin(this.t * 22);
      ctx.fillStyle = '#ff9a3d';
      ctx.globalAlpha = flicker;
      ctx.fillRect(-s * 0.6, -s * 1.4, s * 0.3, s * 0.75);
      ctx.fillRect(-s * 0.15, -s * 1.4, s * 0.3, s * 0.75);
      ctx.fillRect(s * 0.3, -s * 1.4, s * 0.3, s * 0.75);
      ctx.globalAlpha = 1;

      // 大后掠主翼
      ctx.fillStyle = hullEdge;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, s * 0.05);
      ctx.lineTo(-s * 1.35, -s * 0.6);
      ctx.lineTo(-s * 0.42, -s * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.5, s * 0.05);
      ctx.lineTo(s * 1.35, -s * 0.6);
      ctx.lineTo(s * 0.42, -s * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 翼尖炮舱
      ctx.fillStyle = hull;
      ctx.strokeStyle = accent;
      ctx.fillRect(-s * 1.42, -s * 0.74, s * 0.22, s * 0.46);
      ctx.fillRect(s * 1.2, -s * 0.74, s * 0.22, s * 0.46);

      // 机身（机头朝下）
      ctx.fillStyle = hull;
      ctx.strokeStyle = accent;
      ctx.beginPath();
      ctx.moveTo(0, s * 1.18);
      ctx.lineTo(-s * 0.62, s * 0.05);
      ctx.lineTo(-s * 0.5, -s * 0.95);
      ctx.lineTo(s * 0.5, -s * 0.95);
      ctx.lineTo(s * 0.62, s * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 中央能量核心
      const pulse = 1 + Math.sin(this.t * 4) * 0.1;
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(0, -s * 0.02, s * 0.44 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -s * 0.02, s * 0.18 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // 舰桥座舱
      ctx.fillStyle = '#eaf7ff';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.32, s * 0.13, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 激光预警线
      if (this.laserTelegraph) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 40, 80, 0.6)';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 10]);
        ctx.shadowColor = '#ff2244';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.laserAngle) * 500, this.y + Math.sin(this.laserAngle) * 500);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.Boss = Boss;
})();