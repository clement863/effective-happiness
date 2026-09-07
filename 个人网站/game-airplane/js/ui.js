(function () {
  class UI {
    constructor(game) {
      this.game = game;
      this.el = {
        hud: document.getElementById('hud'),
        score: document.getElementById('score'),
        wave: document.getElementById('wave'),
        combo: document.getElementById('combo'),
        bombs: document.getElementById('bombs'),
        hpFill: document.getElementById('hp-fill'),
        hpText: document.getElementById('hp-text'),
        energyFill: document.getElementById('energy-fill'),
        power: document.getElementById('power'),
        menu: document.getElementById('menu'),
        guide: document.getElementById('guide'),
        pause: document.getElementById('pause'),
        gameover: document.getElementById('gameover'),
        clear: document.getElementById('clear'),
        upgrade: document.getElementById('upgrade'),
        upgradeOptions: document.getElementById('upgrade-options'),
        clearTitle: document.getElementById('clear-title'),
        clearSub: document.getElementById('clear-sub'),
        clearScore: document.getElementById('clear-score'),
        clearBtn: document.getElementById('clear-btn'),
        bossWarning: document.getElementById('boss-warning'),
        finalScore: document.getElementById('final-score'),
        bestScore: document.getElementById('best-score'),
      };
      this.diffBtns = Array.from(document.querySelectorAll('.diff-btn'));
      this.modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
      this.fighterBtns = Array.from(document.querySelectorAll('.fighter-btn'));
      this.bind();
    }

    bind() {
      document.getElementById('btn-start').addEventListener('click', () => {
        AudioMgr.init();
        this.game.start();
      });
      document.getElementById('btn-restart').addEventListener('click', () => {
        this.game.start();
      });
      document.getElementById('btn-resume').addEventListener('click', () => {
        this.game.resume();
      });
      this.el.clearBtn.addEventListener('click', () => {
        if (this.game.clearIsFinal) this.game.backToMenu();
        else this.game.advanceAfterBoss();
      });
      this.diffBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.game.difficulty = btn.dataset.diff;
          this.diffBtns.forEach((b) => b.classList.toggle('active', b === btn));
        });
      });
      this.modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.game.mode = btn.dataset.mode;
          this.modeBtns.forEach((b) => b.classList.toggle('active', b === btn));
        });
      });
      this.fighterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          this.game.fighter = btn.dataset.fighter;
          this.fighterBtns.forEach((b) => b.classList.toggle('active', b === btn));
        });
      });
      document.getElementById('btn-guide').addEventListener('click', () => {
        this.show(this.el.guide, true);
      });
      document.getElementById('btn-guide-back').addEventListener('click', () => {
        this.show(this.el.guide, false);
      });
    }

    show(el, on) {
      el.classList.toggle('hidden', !on);
    }

    showMenu() {
      this.show(this.el.hud, false);
      this.show(this.el.menu, true);
      this.show(this.el.guide, false);
      this.show(this.el.pause, false);
      this.show(this.el.gameover, false);
      this.show(this.el.clear, false);
      this.show(this.el.upgrade, false);
      this.show(this.el.bossWarning, false);
    }

    showGame() {
      this.show(this.el.menu, false);
      this.show(this.el.guide, false);
      this.show(this.el.pause, false);
      this.show(this.el.gameover, false);
      this.show(this.el.clear, false);
      this.show(this.el.upgrade, false);
      this.show(this.el.bossWarning, false);
      this.show(this.el.hud, true);
    }

    showPause(on) {
      this.show(this.el.pause, on);
    }

    showGameOver(score, best) {
      this.el.finalScore.textContent = score;
      this.el.bestScore.textContent = best;
      this.show(this.el.hud, false);
      this.show(this.el.gameover, true);
    }

    showBossClear(level, score, isFinal) {
      this.el.clearTitle.textContent = isFinal ? '地 狱 通 关' : '您 已 通 关';
      this.el.clearSub.textContent = isFinal ? '成功征服地狱难度！' : '第 ' + level + ' 位 Boss 已被击破';
      this.el.clearScore.textContent = score;
      this.el.clearBtn.textContent = isFinal ? '返 回 主 菜 单' : '继 续';
      this.show(this.el.hud, false);
      this.show(this.el.clear, true);
    }

    showBossWarning(on) {
      this.show(this.el.bossWarning, on);
    }

    showUpgrade(options) {
      this.el.upgradeOptions.innerHTML = '';
      options.forEach((o) => {
        const card = document.createElement('button');
        card.className = 'upgrade-card';
        const name = document.createElement('div');
        name.className = 'up-name';
        name.textContent = o.name;
        const desc = document.createElement('div');
        desc.className = 'up-desc';
        desc.textContent = o.desc;
        card.appendChild(name);
        card.appendChild(desc);
        card.addEventListener('click', () => this.game.applyUpgrade(o.key));
        this.el.upgradeOptions.appendChild(card);
      });
      this.show(this.el.hud, false);
      this.show(this.el.clear, false);
      this.show(this.el.upgrade, true);
    }

    update() {
      const g = this.game;
      const p = g.player;
      this.el.score.textContent = g.score;
      this.el.wave.textContent = g.mode === 'endless' ? '∞' : g.waveIndex;
      this.el.combo.textContent = g.combo;
      this.el.bombs.textContent = p.bombs;
      this.el.power.textContent = p.power;
      this.el.hpFill.style.width = Math.max(0, p.hp / p.maxHp * 100).toFixed(1) + '%';
      this.el.hpText.textContent = Math.max(0, Math.ceil(p.hp));
      this.el.energyFill.style.width = Math.max(0, p.energy / p.maxEnergy * 100).toFixed(1) + '%';
    }
  }

  window.UI = UI;
})();