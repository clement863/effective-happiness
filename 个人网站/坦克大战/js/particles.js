// particles.js —— 粒子特效 / 光束 / 屏幕震动
// 加载方式：普通 <script>，暴露 window.FX
// 发光粒子统一 globalCompositeOperation='lighter' 叠加，营造霓虹科技感。

window.FX = (function () {
  "use strict";
  const particles = [];
  const beams = [];
  let shakeIntensity = 0, shakeTime = 0;
  let shakeX = 0, shakeY = 0;

  function spawn(x, y, o) {
    particles.push({
      x, y,
      vx: o.vx || 0,
      vy: o.vy || 0,
      drag: o.drag !== undefined ? o.drag : 0.9,
      life: o.life || 0.5,
      maxLife: o.life || 0.5,
      size: o.size || 3,
      color: o.color || '#ffffff',
      shrink: o.shrink !== undefined ? o.shrink : true,
    });
  }

  function spawnExplosion(x, y, color, count) {
    count = count || 26;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      spawn(x, y, {
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.5,
        size: 2 + Math.random() * 4,
        color: Math.random() < 0.5 ? color : '#ffffff',
      });
    }
  }

  function spawnMuzzle(x, y, angle, color) {
    for (let i = 0; i < 7; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9;
      const sp = 80 + Math.random() * 160;
      spawn(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2, size: 2.5, color: color });
    }
  }

  function spawnSparks(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      spawn(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.25, size: 2, color: color || '#00e5ff' });
    }
  }

  function addBeam(x, y, angle, range, color, ms) {
    beams.push({
      x, y,
      dirX: Math.cos(angle), dirY: Math.sin(angle),
      range, color: color || '#00e5ff',
      life: ms, maxLife: ms,
    });
  }

  function shake(intensity, duration) {
    shakeIntensity = Math.max(shakeIntensity, intensity);
    shakeTime = Math.max(shakeTime, duration);
  }

  function update(dt) {
    // 粒子
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // 光束
    for (let i = beams.length - 1; i >= 0; i--) {
      beams[i].life -= dt * 1000;
      if (beams[i].life <= 0) beams.splice(i, 1);
    }
    // 屏幕震动
    if (shakeTime > 0) {
      shakeTime -= dt * 1000;
      const k = shakeIntensity;
      shakeX = (Math.random() * 2 - 1) * k;
      shakeY = (Math.random() * 2 - 1) * k;
      if (shakeTime <= 0) { shakeIntensity = 0; shakeX = 0; shakeY = 0; }
    }
  }

  function render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 光束（先画，位于弹体之下）
    for (const b of beams) {
      const a = b.life / b.maxLife;
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(b.x, b.y, b.x + b.dirX * b.range, b.y + b.dirY * b.range);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, b.color);
      g.addColorStop(1, 'rgba(255,46,200,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.dirX * b.range, b.y + b.dirY * b.range);
      ctx.stroke();
    }
    // 粒子
    for (const p of particles) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.shrink ? p.size * a : p.size;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function getOffset() { return { x: shakeX, y: shakeY }; }
  function clear() { particles.length = 0; beams.length = 0; }

  return { spawn, spawnExplosion, spawnMuzzle, spawnSparks, addBeam, shake, update, render, getOffset, clear };
})();