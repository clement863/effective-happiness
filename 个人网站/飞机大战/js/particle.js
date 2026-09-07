(function () {
  class Particles {
    constructor(max) {
      this.max = max;
      this.list = [];
    }

    clear() {
      this.list.length = 0;
    }

    spawn(x, y, opts = {}) {
      const count = opts.count || 20;
      const color = opts.color || '#ffffff';
      const speed = opts.speed || 140;
      const size = opts.size || 3;
      const life = opts.life || 0.6;
      for (let i = 0; i < count; i++) {
        if (this.list.length >= this.max) this.list.shift();
        const a = Math.random() * Math.PI * 2;
        const s = Utils.rand(speed * 0.2, speed);
        this.list.push({
          x, y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: Utils.rand(life * 0.4, life),
          maxLife: life,
          size: Utils.rand(size * 0.4, size),
          color,
          drag: opts.drag != null ? opts.drag : 0.92,
        });
      }
    }

    // 单个光点（用于拖尾）
    trail(x, y, color, size) {
      if (this.list.length >= this.max) this.list.shift();
      this.list.push({
        x, y,
        vx: Utils.rand(-20, 20),
        vy: Utils.rand(20, 80),
        life: 0.35,
        maxLife: 0.35,
        size: size || 3,
        color,
        drag: 0.96,
      });
    }

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life -= dt;
        if (p.life <= 0) { this.list.splice(i, 1); continue; }
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    render(ctx) {
      for (const p of this.list) {
        const a = Utils.clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  }

  window.Particles = Particles;
})();