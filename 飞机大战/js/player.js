(function () {
  class Player {
    constructor(fighterKey) {
      const f = CONFIG.FIGHTERS[fighterKey] || CONFIG.FIGHTERS.default;
      this.fighterKey = fighterKey;
      this.x = CONFIG.W / 2;
      this.y = CONFIG.H - 80;
      this.radius = f.radius;
      this.speed = f.speed;
      this.hp = f.hp;
      this.maxHp = f.hp;
      this.damageMult = f.damage;
      this.color = f.color;
      this.bulletColor = f.bulletColor;
      this.bulletRadius = f.bulletRadius;
      this.fireInterval = f.fireInterval;
      this.power = 1;
      this.weapon = 'none'; // none | missile | laser
      this.weaponTimer = 0;
      this.shield = 0;
      this.energy = 0;
      this.maxEnergy = CONFIG.PLAYER.maxEnergy;
      this.bombs = CONFIG.PLAYER.startBombs;
      this.fireTimer = 0;
      this.missileTimer = 0;
      this.invincible = 0;
      this.dead = false;
    }

    update(dt) {
      if (this.invincible > 0) this.invincible -= dt;

      this._move(dt);

      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireInterval;
        this.fire();
      }

      if (this.missileTimer > 0) this.missileTimer -= dt;

      if (this.weapon !== 'none') {
        this.weaponTimer -= dt;
        if (this.weaponTimer <= 0) this.weapon = 'none';
      }

      // 引擎拖尾
      const g = window.game;
      g.particles.trail(this.x + Utils.rand(-2, 2), this.y + 16, this.color, 2.5);
    }

    _move(dt) {
      const g = window.game;
      const m = g.input.getMove();
      if (m.x !== 0 || m.y !== 0) {
        const len = Math.hypot(m.x, m.y) || 1;
        this.x += (m.x / len) * this.speed * dt;
        this.y += (m.y / len) * this.speed * dt;
      } else if (g.input.pointer.dragging) {
        const k = Utils.clamp(dt * 12, 0, 1);
        this.x = Utils.lerp(this.x, g.input.pointer.x, k);
        this.y = Utils.lerp(this.y, g.input.pointer.y, k);
      }
      this.x = Utils.clamp(this.x, 22, CONFIG.W - 22);
      this.y = Utils.clamp(this.y, CONFIG.H - 180, CONFIG.H - 26);
    }

    fire() {
      const g = window.game;
      const w = CONFIG.WEAPONS[this.power];
      if (!w) return;
      const dmg = Math.max(1, Math.round(w.damage * this.damageMult));
      for (const s of w.shots) {
        const ang = -Math.PI / 2 + Utils.rad(s.angle);
        g.spawnPlayerBullet(this.x + s.dx, this.y - 12, ang, 540, dmg, { color: this.bulletColor, radius: this.bulletRadius });
      }

      if (this.weapon === 'missile' && this.missileTimer <= 0) {
        this.missileTimer = 0.35;
        const mdmg = Math.max(1, Math.round(8 * this.damageMult));
        g.spawnPlayerBullet(this.x - 12, this.y, -Math.PI / 2, 240, mdmg, { type: 'missile', homing: true, color: CONFIG.COLORS.missile });
        g.spawnPlayerBullet(this.x + 12, this.y, -Math.PI / 2, 240, mdmg, { type: 'missile', homing: true, color: CONFIG.COLORS.missile });
      }

      if (this.weapon === 'laser') {
        const ldmg = Math.max(1, Math.round(6 * this.damageMult));
        g.spawnPlayerBullet(this.x, this.y - 20, -Math.PI / 2, 640, ldmg, { type: 'laser', radius: 9, color: CONFIG.COLORS.laser });
      }
    }

    takeDamage(dmg) {
      if (this.invincible > 0) return;
      const g = window.game;
      if (this.shield > 0) {
        this.shield--;
        this.invincible = 0.4;
        g.explode(this.x, this.y, CONFIG.COLORS.player, 8);
        return;
      }
      this.hp -= dmg;
      this.invincible = CONFIG.PLAYER.invincibleTime;
      g.explode(this.x, this.y, CONFIG.COLORS.player, 14);
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        g.gameOver();
      }
    }

    render(ctx) {
      if (this.invincible > 0 && Math.floor(this.invincible * 18) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      const img = window.game.fighterImgs[this.fighterKey];
      if (img && img.complete && img.naturalWidth > 0) {
        const size = Math.round(this.radius * 2.6);
        ctx.drawImage(img, this.x - size / 2, this.y - size / 2, size, size);
      } else {
        ctx.save();
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 18;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - 17);
        ctx.lineTo(this.x - 13, this.y + 13);
        ctx.lineTo(this.x, this.y + 6);
        ctx.lineTo(this.x + 13, this.y + 13);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y - 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (this.shield > 0) {
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.shield;
        ctx.shadowColor = CONFIG.COLORS.player;
        ctx.shadowBlur = 12;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  window.Player = Player;
})();