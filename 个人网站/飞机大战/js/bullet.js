(function () {
  class Bullet {
    constructor(owner, x, y, angle, speed, opts = {}) {
      this.owner = owner; // 'player' | 'enemy'
      this.x = x;
      this.y = y;
      const v = Utils.vectorFromAngle(angle, speed);
      this.vx = v.x;
      this.vy = v.y;
      this.damage = opts.damage || 10;
      this.radius = opts.radius || (owner === 'player' ? 4 : 5);
      this.color = opts.color || (owner === 'player' ? CONFIG.COLORS.playerBullet : CONFIG.COLORS.enemyBullet);
      this.type = opts.type || 'normal'; // normal | missile | laser
      this.pierce = opts.pierce || this.type === 'laser';
      this.homing = opts.homing || false;
      this.turnRate = opts.turnRate || 6;
      this.life = opts.life || 5;
      this.dead = false;
      this.hitIds = new Set();
    }

    findTarget() {
      let best = null;
      let bestD = Infinity;
      const g = window.game;
      if (g.boss && !g.boss.dead) {
        const dist = (g.boss.x - this.x) ** 2 + (g.boss.y - this.y) ** 2;
        if (dist < bestD) { bestD = dist; best = g.boss; }
      }
      for (const e of g.enemies) {
        const dist = (e.x - this.x) ** 2 + (e.y - this.y) ** 2;
        if (dist < bestD) { bestD = dist; best = e; }
      }
      return best;
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) { this.dead = true; return; }

      if (this.homing) {
        const target = this.findTarget();
        if (target) {
          const desired = Math.atan2(target.y - this.y, target.x - this.x);
          const cur = Math.atan2(this.vy, this.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Utils.clamp(diff, -this.turnRate * dt, this.turnRate * dt);
          const sp = Math.hypot(this.vx, this.vy);
          const na = cur + turn;
          this.vx = Math.cos(na) * sp;
          this.vy = Math.sin(na) * sp;
        }
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      if (this.x < -50 || this.x > CONFIG.W + 50 || this.y < -80 || this.y > CONFIG.H + 80) {
        this.dead = true;
      }
    }

    render(ctx) {
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = this.type === 'normal' ? 6 : 14;

      if (this.type === 'laser') {
        const len = 28;
        const a = Math.atan2(this.vy, this.vx) + Math.PI / 2;
        ctx.translate(this.x, this.y);
        ctx.rotate(a);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.radius, -len, this.radius * 2, len * 2);
        ctx.restore();
        return;
      }

      if (this.type === 'missile') {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        const a = Math.atan2(this.vy, this.vx);
        ctx.beginPath();
        ctx.moveTo(this.x - 4, this.y);
        ctx.lineTo(this.x + Math.cos(a) * 5, this.y + Math.sin(a) * 5);
        ctx.stroke();
      }

      // 玩家普通弹：能量弹带拖尾光效
      if (this.owner === 'player' && this.type === 'normal') {
        const a = Math.atan2(this.vy, this.vx);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.radius;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(this.x - Math.cos(a) * 12, this.y - Math.sin(a) * 12);
        ctx.lineTo(this.x, this.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      if (this.owner === 'player' && this.type === 'normal') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  window.Bullet = Bullet;
})();