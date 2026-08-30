// tank.js —— 坦克绘制模块（玩家 / AI 共用）
// 对应文档 §9.5「坦克外观设计（绘制规范）」
// 加载方式：普通 <script> 标签（无需服务器，双击 HTML 即跑）
// 使用方式：window.TankRender.drawTank(ctx, tank) 等
//
// 依赖约定：调用 drawTank(ctx, tank) 时，tank 对象需提供以下字段：
//   x, y          中心坐标
//   angle         朝向（弧度）
//   color         主色（hex，如 '#00e5ff'）
//   treadOffset   履带累计滚动位移（供纹齿滚动）
//   recoil        开火后坐偏移（0..3，衰减由调用方负责）
//   flash         受伤闪白强度（0..1）
//   phase         能量核心呼吸相位偏移（可选，默认 0）

(function (global) {
  "use strict";

  /* ===================== 颜色工具 ===================== */

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  // amt 0..1，越接近 1 越接近白色
  function lighten(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const f = (c) => Math.min(255, Math.round(c + (255 - c) * amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  // amt 0..1，越接近 1 越接近黑色
  function darken(hex, amt) {
    const { r, g, b } = hexToRgb(hex);
    const f = (c) => Math.round(c * (1 - amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  /* ===================== 图形工具 ===================== */

  // 圆角矩形（不依赖 ctx.roundRect，兼容性更好）
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  // 角度平滑插值（处理 -PI/PI 回绕）
  function lerpAngle(a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  /* ===================== 分层绘制 ===================== */

  // 履带（含滚动纹齿）
  function drawTrack(ctx, x, y, offset, color) {
    ctx.save();
    ctx.translate(x, y);

    // 履带主体
    roundRect(ctx, -4.5, -19, 9, 38, 4.5);
    ctx.fillStyle = '#0a0f18';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 纹齿：沿移动方向循环滚动
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    const m = offset % 6;
    for (let d = -17 + m; d < 19; d += 6) {
      ctx.beginPath();
      ctx.moveTo(-4.5, d);
      ctx.lineTo(4.5, d);
      ctx.stroke();
    }

    ctx.restore();
  }

  // 坦克整体（§9.5 七层结构：阴影→履带→车体→装饰→炮塔炮管→能量核心→闪白）
  function drawTank(ctx, tank) {
    const phase = tank.phase || 0;
    ctx.save();
    ctx.translate(tank.x, tank.y);

    // 1. 底盘阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ellipse(ctx, 0, 4, 21, 18);

    // 2. 左右履带
    drawTrack(ctx, -16, 0, tank.treadOffset, tank.color);
    drawTrack(ctx, 16, 0, tank.treadOffset, tank.color);

    // 3. 车体（纵向渐变 + 发光描边）
    const hull = ctx.createLinearGradient(0, -17, 0, 17);
    hull.addColorStop(0, lighten(tank.color, 0.25));
    hull.addColorStop(1, darken(tank.color, 0.45));
    roundRect(ctx, -13, -17, 26, 34, 6);
    ctx.fillStyle = hull;
    ctx.fill();
    ctx.shadowColor = tank.color;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = tank.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 车体前缘装饰（两条斜切线，科技格栅）
    ctx.shadowBlur = 0;
    ctx.strokeStyle = lighten(tank.color, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -15); ctx.lineTo(9, -15);
    ctx.moveTo(-7, -11); ctx.lineTo(7, -11);
    ctx.stroke();

    // 4. 炮塔 + 炮管（随朝向旋转，含后坐）
    ctx.save();
    ctx.rotate(tank.angle);
    const recoil = tank.recoil || 0;
    roundRect(ctx, -2, -18 - recoil, 4, 18, 2);       // 炮管
    ctx.fillStyle = '#0d1420';
    ctx.fill();
    ctx.strokeStyle = tank.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = lighten(tank.color, 0.6);         // 炮口高亮
    ctx.fillRect(-2, -20 - recoil, 4, 3);
    ctx.beginPath();                                   // 炮塔
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fillStyle = tank.color;
    ctx.fill();
    ctx.strokeStyle = '#0d1420';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 5. 顶部能量核心（呼吸发光）
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.005 + phase);
    ctx.shadowColor = tank.color;
    ctx.shadowBlur = 8 + 10 * pulse;
    ctx.beginPath();
    ctx.arc(0, 0, 3 + 0.8 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 6. 受伤闪白（叠加高亮）
    if (tank.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = tank.flash;
      roundRect(ctx, -13, -17, 26, 34, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // 对外暴露统一命名空间
  global.TankRender = {
    hexToRgb, lighten, darken,
    roundRect, ellipse, clamp, lerpAngle,
    drawTrack, drawTank,
  };
})(window);