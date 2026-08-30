(function () {
  class Background {
    constructor(ctx) {
      this.ctx = ctx;
      this.stars = [];
      this.gridOffset = 0;
      this.spacing = 48;
      for (let i = 0; i < 90; i++) {
        this.stars.push(this._makeStar());
      }
    }

    _makeStar(randomY) {
      return {
        x: Utils.rand(0, CONFIG.W),
        y: randomY ? Utils.rand(0, CONFIG.H) : Utils.rand(-CONFIG.H, 0),
        size: Utils.rand(0.5, 2.2),
        speed: Utils.rand(30, 140),
        alpha: Utils.rand(0.3, 1),
        twinkle: Utils.rand(0, Math.PI * 2),
      };
    }

    update(dt) {
      this.gridOffset = (this.gridOffset + 60 * dt) % this.spacing;
      for (const s of this.stars) {
        s.y += s.speed * dt;
        s.twinkle += dt * 3;
        if (s.y > CONFIG.H + 4) {
          Object.assign(s, this._makeStar(false));
          s.y = -4;
        }
      }
    }

    render(ctx) {
      // 渐变底色
      const g = ctx.createLinearGradient(0, 0, 0, CONFIG.H);
      g.addColorStop(0, CONFIG.COLORS.bgTop);
      g.addColorStop(1, CONFIG.COLORS.bgBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CONFIG.W, CONFIG.H);

      // 滚动网格
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= CONFIG.W; x += this.spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CONFIG.H);
        ctx.stroke();
      }
      for (let y = -this.spacing; y < CONFIG.H + this.spacing; y += this.spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y + this.gridOffset);
        ctx.lineTo(CONFIG.W, y + this.gridOffset);
        ctx.stroke();
      }

      // 星空
      for (const s of this.stars) {
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twinkle));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#9fd8ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  window.Background = Background;
})();