(function () {
  const Utils = {
    rand(min, max) {
      return Math.random() * (max - min) + min;
    },

    randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    clamp(v, min, max) {
      return v < min ? min : (v > max ? max : v);
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    angleTo(x1, y1, x2, y2) {
      return Math.atan2(y2 - y1, x2 - x1);
    },

    rad(deg) {
      return deg * Math.PI / 180;
    },

    deg(rad) {
      return rad * 180 / Math.PI;
    },

    vectorFromAngle(angle, speed) {
      return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
    },

    circleHit(a, b) {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const r = a.radius + b.radius;
      return dx * dx + dy * dy <= r * r;
    },

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    },

    // 原地移除标记为 dead 的对象
    removeDead(arr) {
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].dead) arr.splice(i, 1);
      }
    },

    // 绘制正多边形
    polygon(ctx, x, y, radius, sides, rotation) {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = rotation + (Math.PI * 2 / sides) * i;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    },
  };

  window.Utils = Utils;
})();