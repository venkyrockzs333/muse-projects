// Audio: optional music (from config, after a tap — autoplay-safe),
// soft synthesized footsteps, and a UI blip. No audio files are
// required; footsteps are a filtered noise burst, so a missing music
// file never blocks the experience.
export class AudioMan {
  constructor() {
    this.ctx = null; this.master = null; this.musicEl = null; this.muted = false;
  }
  init(musicPath) {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      if (musicPath) {
        this.musicEl = new Audio(musicPath); this.musicEl.loop = true; this.musicEl.volume = 0.5;
        this.musicEl.play().catch(() => {});
      }
    } catch (_) { /* audio is optional */ }
  }
  setMuted(m) {
    this.muted = m;
    if (this.musicEl) { if (m) this.musicEl.pause(); else this.musicEl.play().catch(() => {}); }
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }
  blip() {
    if (!this.ctx || this.muted) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 660;
      g.gain.setValueAtTime(0.08, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + 0.13);
    } catch (_) {}
  }
  footstep() {
    if (!this.ctx || this.muted) return;
    try {
      const len = this.ctx.sampleRate * 0.08;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = this.ctx.createGain(); g.gain.value = 0.12;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
    } catch (_) {}
  }
}
