// audio.js — every sound is synthesised with WebAudio: no audio files, no
// network, nothing to load. The context only starts after a first gesture,
// so a quiet page load stays quiet.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  // One short tone: an oscillator with an attack/decay envelope.
  tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // A sound that cannot play is never worth crashing the game over.
    }
  }

  // A soft thud: filtered noise, quieter when sneaking.
  footstep(sneaking) {
    if (!this.ctx || this.muted) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.07);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = this.ctx.createGain();
      gain.gain.value = sneaking ? 0.04 : 0.12;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
    } catch {
      // ignore
    }
  }

  // Two rising notes when a guard spots you.
  alertSting() {
    this.tone(392, 0.16, 'square', 0.1);
    this.tone(587, 0.28, 'square', 0.12, 0.12);
  }

  // A low falling note when a guard gives up the search.
  lostSting() {
    this.tone(330, 0.2, 'triangle', 0.09, 0, 196);
  }

  // A bright three-note chime for a sealed document.
  pickupChime() {
    this.tone(660, 0.14, 'sine', 0.14);
    this.tone(880, 0.14, 'sine', 0.14, 0.09);
    this.tone(1320, 0.3, 'sine', 0.12, 0.18);
  }

  // The coin's high ping, heard across the room.
  coinPing() {
    this.tone(2093, 0.5, 'sine', 0.12, 0, 1568);
    this.tone(2637, 0.35, 'sine', 0.06, 0.02);
  }

  // The door swinging open when the last document is found.
  doorOpen() {
    this.tone(110, 0.5, 'sawtooth', 0.06, 0, 220);
    this.tone(440, 0.3, 'sine', 0.1, 0.15);
  }

  // A harsh buzz for being caught, then a low thud.
  caughtSting() {
    this.tone(220, 0.4, 'sawtooth', 0.14, 0, 110);
    this.tone(55, 0.6, 'sine', 0.16, 0.1);
  }

  // A warm little fanfare for slipping out unseen.
  winChime() {
    this.tone(523, 0.18, 'sine', 0.13);
    this.tone(659, 0.18, 'sine', 0.13, 0.12);
    this.tone(784, 0.18, 'sine', 0.13, 0.24);
    this.tone(1047, 0.5, 'sine', 0.13, 0.36);
  }
}
