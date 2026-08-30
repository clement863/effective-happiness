// input.js —— 多玩家输入管理
// 加载方式：普通 <script>，暴露 window.Input
// 提供 isDown(code) / consumePress(code)（按下瞬间触发一次，用于射击、技能）。

window.Input = (function () {
  "use strict";
  const down = new Set();
  const pressed = new Set();
  const PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  window.addEventListener('keydown', (e) => {
    if (PREVENT.includes(e.code)) e.preventDefault();
    if (!e.repeat && !down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', (e) => { down.delete(e.code); });
  window.addEventListener('blur', () => { down.clear(); pressed.clear(); });

  function isDown(code) { return down.has(code); }
  function consumePress(code) {
    if (pressed.has(code)) { pressed.delete(code); return true; }
    return false;
  }
  function clear() { down.clear(); pressed.clear(); }

  return { isDown, consumePress, clear };
})();