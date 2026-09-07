(function () {
  const Input = {
    keys: {},
    pressed: [],
    pointer: { active: false, x: 0, y: 0, dragging: false },

    init(canvas) {
      this.canvas = canvas;

      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
        if (!this.keys[e.key]) this.pressed.push(e.key);
        this.keys[e.key] = true;
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.key] = false;
      });

      canvas.addEventListener('mousedown', (e) => this._setPointer(e, true));
      window.addEventListener('mousemove', (e) => this._setPointer(e, false));
      window.addEventListener('mouseup', () => { this.pointer.dragging = false; });

      canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        this._setPointer(t, true);
      }, { passive: false });
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        this._setPointer(t, false);
      }, { passive: false });
      canvas.addEventListener('touchend', () => { this.pointer.dragging = false; });
    },

    _setPointer(e, down) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.active = true;
      this.pointer.x = (e.clientX - rect.left) / rect.width * CONFIG.W;
      this.pointer.y = (e.clientY - rect.top) / rect.height * CONFIG.H;
      if (down) this.pointer.dragging = true;
    },

    isDown(key) {
      return !!this.keys[key];
    },

    consumePressed() {
      const p = this.pressed;
      this.pressed = [];
      return p;
    },

    getMove() {
      let x = 0, y = 0;
      if (this.isDown('ArrowLeft') || this.isDown('a') || this.isDown('A')) x -= 1;
      if (this.isDown('ArrowRight') || this.isDown('d') || this.isDown('D')) x += 1;
      if (this.isDown('ArrowUp') || this.isDown('w') || this.isDown('W')) y -= 1;
      if (this.isDown('ArrowDown') || this.isDown('s') || this.isDown('S')) y += 1;
      return { x, y };
    },
  };

  window.Input = Input;
})();