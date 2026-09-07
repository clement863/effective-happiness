// audio.js —— Web Audio 程序化合成音效
// 加载方式：普通 <script>，暴露 window.AudioFX
// 无需音频文件；首次用户交互后创建 AudioContext（浏览器自动播放策略）。

window.AudioFX = (function () {
  "use strict";
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // 单个振荡器：type, f0, f1(结束频率), dur(秒), gain(峰值), delay(秒)
  function tone(type, f0, f1, dur, gain, delay) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // 噪声：dur(秒), gain, filterFreq(低通)
  function noise(dur, gain, filterFreq) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(50, filterFreq * 0.2), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0);
  }

  function play(name) {
    if (!enabled) return;
    ensure();
    if (!ctx) return;
    switch (name) {
      case 'fire':     tone('square', 700, 180, 0.09, 0.22); break;
      case 'hit':      tone('triangle', 320, 150, 0.1, 0.28); break;
      case 'explode':  noise(0.45, 0.6, 900); tone('sine', 90, 30, 0.45, 0.5); break;
      case 'pickup':   tone('sine', 520, 900, 0.12, 0.3); break;
      case 'powerup':  tone('sine', 300, 620, 0.2, 0.32); break;
      case 'laser':    tone('sawtooth', 1000, 4000, 0.12, 0.22); break;
      case 'missile':  tone('sawtooth', 400, 120, 0.25, 0.28); break;
      case 'mine':     tone('square', 800, 300, 0.05, 0.3); break;
      case 'pierce':   tone('square', 2000, 1400, 0.06, 0.2); break;
      case 'hurt':     tone('sawtooth', 200, 80, 0.2, 0.4); break;
      case 'kill':     tone('sine', 400, 1200, 0.15, 0.4); break;
      case 'die':      tone('sawtooth', 300, 60, 0.5, 0.5); break;
      case 'shield':   tone('triangle', 600, 200, 0.15, 0.3); break;
      case 'click':    tone('sine', 800, 500, 0.06, 0.2); break;
      case 'wind':     noise(0.6, 0.22, 600); break;
      case 'lava':     noise(0.3, 0.35, 400); tone('sawtooth', 140, 60, 0.3, 0.22); break;
    }
  }

  function toggle() { enabled = !enabled; return enabled; }

  return { play, ensure, toggle, get enabled() { return enabled; } };
})();