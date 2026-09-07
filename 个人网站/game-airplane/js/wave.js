(function () {
  class WaveManager {
    constructor() {
      this.wave = 0;
      this.active = false;
      this.timer = 0;
      this.spawnInterval = 0.9;
      this.queue = [];
    }

    reset() {
      this.wave = 0;
      this.active = false;
      this.timer = 0;
      this.queue = [];
    }

    startWave(w) {
      this.wave = w;
      this.queue = this.buildQueue(w);
      this.spawnInterval = Math.max(0.4, 0.9 - w * 0.03);
      this.timer = 0;
      this.active = true;
    }

    buildQueue(w) {
      const q = [];
      const nSmall = Math.min(6 + Math.floor(w / 2), 14);
      for (let i = 0; i < nSmall; i++) q.push('small');
      if (w >= 2) for (let i = 0; i < Math.min(w, 6); i++) q.push('dive');
      if (w >= 3) for (let i = 0; i < Math.min(Math.floor(w / 2), 5); i++) q.push('side');
      if (w >= 4) for (let i = 0; i < Math.min(Math.floor(w / 4), 3); i++) q.push('elite');

      // 高级敌机 : 普通敌机 = 1 : 2（第 2 波起，且简单难度不出）
      const g = window.game;
      const diff = g ? g.difficulty : 'normal';
      if (diff !== 'easy' && w >= 2) {
        const nHunter = Math.max(1, Math.round(q.length / 2));
        for (let i = 0; i < nHunter; i++) q.push('hunter');
      }
      return Utils.shuffle(q);
    }

    update(dt) {
      if (!this.active) return;
      this.timer += dt;
      if (this.queue.length && this.timer >= this.spawnInterval) {
        this.timer = 0;
        const type = this.queue.shift();
        window.game.spawnEnemy(type);
      }
      const g = window.game;
      if (this.queue.length === 0 && g.enemies.length === 0 && !g.boss) {
        this.active = false;
        g.onWaveCleared();
      }
    }
  }

  window.WaveManager = WaveManager;
})();