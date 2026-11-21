// Synthesised sound effects and a quiet music bed, all WebAudio, no files.
// Footsteps tell you where a warden is: each guard's step pips from its side.
export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicOn = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
  }

  // A soft footstep; pan -1 (left) .. 1 (right) by the guard's screen side.
  footstep(pan = 0, heavy = false) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(heavy ? 95 : 140, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.09);
    gain.gain.setValueAtTime(heavy ? 0.16 : 0.09, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      osc.connect(gain).connect(panner).connect(ctx.destination);
    } else {
      osc.connect(gain).connect(ctx.destination);
    }
    osc.start(t0);
    osc.stop(t0 + 0.12);
  }

  alertSting() {
    this.tone(392, 0.16, 'square', 0.1);
    this.tone(311, 0.22, 'square', 0.1, 0.14);
    this.tone(466, 0.3, 'square', 0.08, 0.28);
  }

  suspiciousBlip() {
    this.tone(660, 0.12, 'triangle', 0.09, 0, 520);
  }

  pickup() {
    this.tone(880, 0.1, 'sine', 0.12);
    this.tone(1318, 0.16, 'sine', 0.1, 0.07);
  }

  coinToss() {
    this.noiseBurst(0.06, 0.14, 5200);
    this.tone(2093, 0.07, 'sine', 0.06, 0.05);
  }

  coinLand() {
    this.tone(1568, 0.09, 'sine', 0.1);
    this.tone(1175, 0.12, 'sine', 0.08, 0.08);
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 0.12, 0, 110);
    this.noiseBurst(0.3, 0.1, 900);
  }

  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.11, i * 0.09));
  }

  victory() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.11, i * 0.11));
  }

  unlock() {
    this.tone(784, 0.12, 'sine', 0.1);
    this.tone(1175, 0.2, 'sine', 0.1, 0.1);
  }

  startMusic() {
    if (this.musicOn || this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicOn = true;
    // A slow, low music bed: one soft note every two seconds, minor key.
    const notes = [110, 130.8, 98, 116.5, 110, 146.8, 130.8, 98];
    let i = 0;
    const play = () => {
      if (!this.musicOn) return;
      if (!this.muted) this.tone(notes[i % notes.length], 1.8, 'sine', 0.035);
      i += 1;
      this.musicTimer = setTimeout(play, 2000);
    };
    play();
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
  }
}
