(function () {
  const META = {
    power:  { label: 'S', color: '#00e5ff' },
    missile:{ label: 'M', color: '#ffb300' },
    laser:  { label: 'L', color: '#7df9ff' },
    bomb:   { label: 'B', color: '#ff5c5c' },
    heal:   { label: '+', color: '#5cff7a' },
    score:  { label: '★', color: '#f5d0ff' },
  };

  class Powerup {
    constructor(type, x, y) {
      this.type = type;
      this.x = x;
      this.y = y;
      this.vy = 90;
      this.radius = 14;
      this.dead = false;
      this.t = 0;
      this.meta = META[type];
    }

    update(dt) {
      this.t += dt;
      this.x += Math.sin(this.t * 3) * 30 * dt;
      this.y += this.vy * dt;
      if (this.y > CONFIG.H + 30) this.dead = true;
    }

    render(ctx) {
      ctx.save();
      ctx.shadowColor = this.meta.color;
      ctx.shadowBlur = 14;
      const pulse = 1 + Math.sin(this.t * 6) * 0.1;

      ctx.strokeStyle = this.meta.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(4, 8, 20, 0.85)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * pulse - 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = this.meta.color;
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.meta.label, this.x, this.y + 1);
      ctx.restore();
    }
  }

  window.Powerup = Powerup;
})();