(function () {
  function shadeColor(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, r + amt));
    g = Math.max(0, Math.min(255, g + amt));
    b = Math.max(0, Math.min(255, b + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  class Enemy {
    constructor(type, x, y) {
      const c = CONFIG.ENEMIES[type];
      this.type = type;
      this.x = x;
      this.y = y;
      this.radius = c.radius;
      this.hp = this.maxHp = c.hp;
      this.speed = c.speed;
      this.score = c.score;
      this.color = c.color;
      this.dead = false;
      this.id = 0;
      this.hitFlash = 0;
      this.t = Math.random() * Math.PI * 2;
      this.shootTimer = Utils.rand(1, 2.5);
      this.vx = 0;
      if (type === 'dive') {
        this.vx = Utils.rand(-30, 30);
      } else if (type === 'side') {
        this.amp = 70;
        this.freq = 2;
      }
    }

    update(dt) {
      this.t += dt;
      this.hitFlash = Math.max(0, this.hitFlash - dt);

      if (this.type === 'side') {
        this.vx = Math.sin(this.t * this.freq) * this.amp;
      }

      if (this.type === 'hunter') {
        const g = window.game;
        if (g && g.player && !g.player.dead) {
          const a = Utils.angleTo(this.x, this.y, g.player.x, g.player.y);
          this.x += Math.cos(a) * this.speed * dt;
          this.y += Math.sin(a) * this.speed * dt;
        } else {
          this.y += this.speed * dt;
        }
      } else {
        this.x += this.vx * dt;
        this.y += this.speed * dt;
      }

      if (this.type === 'side' || this.type === 'elite' || this.type === 'hunter') {
        const fireMult = window.game ? window.game.enemyFireMult : 1;
        this.shootTimer -= dt * fireMult;
        if (this.shootTimer <= 0) {
          if (this.type === 'elite') this.shootTimer = 1.6;
          else if (this.type === 'hunter') this.shootTimer = 2.0;
          else this.shootTimer = 2.2;
          this.fire();
        }
      }

      if (this.y > CONFIG.H + 50 || this.x < -60 || this.x > CONFIG.W + 60) {
        this.dead = true;
      }
    }

    fire() {
      const g = window.game;
      if (this.type === 'side') {
        g.spawnEnemyBullet(this.x, this.y, Math.PI / 2, 200);
      } else if (this.type === 'elite') {
        const base = Utils.angleTo(this.x, this.y, g.player.x, g.player.y);
        for (let i = -2; i <= 2; i++) {
          g.spawnEnemyBullet(this.x, this.y, base + i * 0.3, 160);
        }
      } else if (this.type === 'hunter') {
        const base = Utils.angleTo(this.x, this.y, g.player.x, g.player.y);
        g.spawnEnemyBullet(this.x, this.y, base, 220);
      }
    }

    render(ctx) {
      const s = this.radius;
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
      const main = this.hitFlash > 0 ? '#ffffff' : this.color;
      const wing = this.hitFlash > 0 ? '#ffffff' : shadeColor(this.color, -35);

      // 引擎喷焰（尾部向上拖出，随节奏闪烁）
      const flicker = 0.6 + 0.4 * Math.sin(this.t * 24);
      ctx.fillStyle = '#ffb24d';
      ctx.globalAlpha = flicker;
      ctx.fillRect(this.x - s * 0.3, this.y - s * 1.2, s * 0.17, s * 0.5);
      ctx.fillRect(this.x + s * 0.13, this.y - s * 1.2, s * 0.17, s * 0.5);
      ctx.globalAlpha = 1;

      // 后掠机翼
      ctx.fillStyle = wing;
      ctx.beginPath();
      ctx.moveTo(this.x - s * 0.45, this.y - s * 0.05);
      ctx.lineTo(this.x - s * 1.05, this.y - s * 0.8);
      ctx.lineTo(this.x - s * 0.32, this.y - s * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.x + s * 0.45, this.y - s * 0.05);
      ctx.lineTo(this.x + s * 1.05, this.y - s * 0.8);
      ctx.lineTo(this.x + s * 0.32, this.y - s * 0.95);
      ctx.closePath();
      ctx.fill();

      // 机身（机头朝下）
      ctx.fillStyle = main;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y + s * 1.15);
      ctx.lineTo(this.x - s * 0.5, this.y - s * 0.05);
      ctx.lineTo(this.x - s * 0.4, this.y - s * 0.9);
      ctx.lineTo(this.x + s * 0.4, this.y - s * 0.9);
      ctx.lineTo(this.x + s * 0.5, this.y - s * 0.05);
      ctx.closePath();
      ctx.fill();

      // 精英机：中央装甲舱
      if (this.type === 'elite') {
        ctx.fillStyle = shadeColor(this.color, -55);
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - s * 0.2, s * 0.3, s * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 座舱
      ctx.fillStyle = '#eaf7ff';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + s * 0.12, s * 0.16, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();

      // 高级敌机：脉冲光环标记
      if (this.type === 'hunter') {
        const ring = s * 1.3 * (1 + Math.sin(this.t * 5) * 0.08);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(this.x, this.y, ring, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }
  }

  window.Enemy = Enemy;
})();