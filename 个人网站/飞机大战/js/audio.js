(function () {
  const AudioMgr = {
    ctx: null,
    enabled: true,

    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    },

    _now() {
      return this.ctx.currentTime;
    },

    tone(freq, dur, type, gain) {
      if (!this.ctx || !this.enabled) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      g.gain.value = gain || 0.06;
      g.gain.exponentialRampToValueAtTime(0.0001, this._now() + dur);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start();
      osc.stop(this._now() + dur);
    },

    noise(dur, gain) {
      if (!this.ctx || !this.enabled) return;
      const bufferSize = this.ctx.sampleRate * dur;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const g = this.ctx.createGain();
      g.gain.value = gain || 0.15;
      g.gain.exponentialRampToValueAtTime(0.0001, this._now() + dur);
      src.connect(g);
      g.connect(this.ctx.destination);
      src.start();
    },

    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'shoot': this.tone(720, 0.06, 'square', 0.03); break;
        case 'hit': this.tone(180, 0.08, 'sawtooth', 0.05); break;
        case 'explosion': this.noise(0.4, 0.2); break;
        case 'powerup': this.tone(880, 0.12, 'sine', 0.08); break;
        case 'warning': this.tone(160, 0.6, 'sawtooth', 0.1); break;
        case 'boss': this.tone(90, 0.8, 'sawtooth', 0.12); break;
        case 'ult': this.tone(1200, 0.4, 'sine', 0.12); break;
        case 'victory':
          this.tone(523, 0.5, 'sine', 0.08);
          this.tone(659, 0.5, 'sine', 0.08);
          this.tone(784, 0.6, 'sine', 0.08);
          break;
        case 'gameover': this.tone(300, 0.9, 'sine', 0.1); break;
      }
    },
  };

  window.AudioMgr = AudioMgr;
})();