export type SfxName =
  | 'spin'
  | 'reelStop'
  | 'win'
  | 'wild'
  | 'scatter'
  | 'bonus'
  | 'freespins'
  | 'bigwin'
  | 'coin'
  | 'click'
  | 'lock'
  | 'multiplier'
  | 'anticipation';

export interface AudioSettings {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
}

type MusicMode = 'BASE' | 'FREE' | 'OFF';

/**
 * Audio Engine.
 *
 * Every sound is synthesised at runtime with the Web Audio API — no sample files,
 * therefore nothing to license, nothing to preload and a tiny bundle. Music and SFX
 * have independent buses so the SOUND panel can mute them separately.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private settings: AudioSettings = {
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.35,
    sfxVolume: 0.6,
  };

  private musicMode: MusicMode = 'OFF';
  private schedulerId: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private anticipationOsc: OscillatorNode | null = null;
  private anticipationGain: GainNode | null = null;

  get isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /** must be called from a user gesture (browser autoplay policy) */
  async unlock(): Promise<void> {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume();
  }

  private init(): void {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.settings.musicEnabled ? this.settings.musicVolume : 0;
    this.musicBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfxEnabled ? this.settings.sfxVolume : 0;
    this.sfxBus.connect(this.master);

    // shared noise buffer for whooshes and impacts
    const length = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  setMusicEnabled(enabled: boolean): void {
    this.settings.musicEnabled = enabled;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(enabled ? this.settings.musicVolume : 0, this.ctx.currentTime, 0.1);
    }
  }

  setSfxEnabled(enabled: boolean): void {
    this.settings.sfxEnabled = enabled;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(enabled ? this.settings.sfxVolume : 0, this.ctx.currentTime, 0.05);
    }
  }

  setMusicVolume(volume: number): void {
    this.settings.musicVolume = volume;
    if (this.settings.musicEnabled) this.setMusicEnabled(true);
  }

  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = volume;
    if (this.settings.sfxEnabled) this.setSfxEnabled(true);
  }

  /* ------------------------------------------------------------ *
   *  SFX
   * ------------------------------------------------------------ */

  play(name: SfxName): void {
    if (!this.ctx || !this.sfxBus || !this.settings.sfxEnabled) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'spin':
        this.whoosh(t, 0.45, 180, 900);
        this.tone(t, { freq: 320, type: 'triangle', dur: 0.12, gain: 0.14 });
        break;
      case 'reelStop':
        this.thud(t);
        break;
      case 'win':
        [523.25, 659.25, 783.99].forEach((f, i) =>
          this.tone(t + i * 0.07, { freq: f, type: 'triangle', dur: 0.22, gain: 0.16 }),
        );
        break;
      case 'wild':
        [880, 1174.66, 1567.98, 2093].forEach((f, i) =>
          this.tone(t + i * 0.05, { freq: f, type: 'sine', dur: 0.3, gain: 0.1 }),
        );
        break;
      case 'scatter':
        [659.25, 987.77].forEach((f, i) =>
          this.tone(t + i * 0.09, { freq: f, type: 'square', dur: 0.35, gain: 0.09 }),
        );
        this.whoosh(t, 0.5, 400, 2400);
        break;
      case 'bonus':
        [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) =>
          this.tone(t + i * 0.1, { freq: f, type: 'sawtooth', dur: 0.5, gain: 0.11 }),
        );
        break;
      case 'freespins':
        [392, 523.25, 659.25, 1046.5].forEach((f, i) =>
          this.tone(t + i * 0.12, { freq: f, type: 'triangle', dur: 0.6, gain: 0.13 }),
        );
        break;
      case 'bigwin':
        [261.63, 329.63, 392, 523.25].forEach((f) =>
          this.tone(t, { freq: f, type: 'sawtooth', dur: 1.1, gain: 0.09 }),
        );
        [1046.5, 1318.5, 1567.98].forEach((f, i) =>
          this.tone(t + 0.15 + i * 0.1, { freq: f, type: 'sine', dur: 0.7, gain: 0.12 }),
        );
        break;
      case 'coin':
        this.tone(t, { freq: 1200 + Math.random() * 500, type: 'square', dur: 0.08, gain: 0.05 });
        break;
      case 'lock':
        // metal clank + chain
        this.thud(t);
        this.tone(t + 0.04, { freq: 220, type: 'square', dur: 0.09, gain: 0.1 });
        this.tone(t + 0.12, { freq: 160, type: 'square', dur: 0.14, gain: 0.08 });
        this.whoosh(t + 0.05, 0.18, 3200, 900);
        break;
      case 'multiplier':
        // rising three-note stinger, lands bright
        [523.25, 659.25, 987.77].forEach((f, i) =>
          this.tone(t + i * 0.06, { freq: f, type: 'square', dur: 0.18, gain: 0.11 }),
        );
        this.tone(t + 0.18, { freq: 1318.5, type: 'triangle', dur: 0.4, gain: 0.12 });
        break;
      case 'click':
        this.tone(t, { freq: 520, type: 'square', dur: 0.05, gain: 0.07 });
        break;
      case 'anticipation':
        this.startAnticipation();
        break;
    }
  }

  startAnticipation(): void {
    if (!this.ctx || !this.sfxBus || !this.settings.sfxEnabled || this.anticipationOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(520, this.ctx.currentTime + 2.2);
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start();
    this.anticipationOsc = osc;
    this.anticipationGain = gain;
  }

  stopAnticipation(): void {
    if (!this.ctx || !this.anticipationOsc || !this.anticipationGain) return;
    const t = this.ctx.currentTime;
    this.anticipationGain.gain.cancelScheduledValues(t);
    this.anticipationGain.gain.setValueAtTime(this.anticipationGain.gain.value, t);
    this.anticipationGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    this.anticipationOsc.stop(t + 0.3);
    this.anticipationOsc = null;
    this.anticipationGain = null;
  }

  private tone(
    when: number,
    opts: { freq: number; type: OscillatorType; dur: number; gain: number; detune?: number },
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, when);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(opts.gain, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + opts.dur);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + opts.dur + 0.05);
  }

  private whoosh(when: number, dur: number, from: number, to: number): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, when);
    filter.frequency.exponentialRampToValueAtTime(to, when + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.09, when + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  private thud(when: number): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, when);
    osc.frequency.exponentialRampToValueAtTime(60, when + 0.13);
    gain.gain.setValueAtTime(0.18, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.15);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(when);
    osc.stop(when + 0.2);
    this.whoosh(when, 0.09, 2200, 400);
  }

  /* ------------------------------------------------------------ *
   *  Background music — a small step sequencer
   * ------------------------------------------------------------ */

  private static readonly PATTERNS: Record<'BASE' | 'FREE', { bass: number[]; lead: number[]; tempo: number }> = {
    BASE: {
      // A minor synthwave loop
      bass: [55, 55, 82.41, 55, 65.41, 65.41, 49, 49],
      lead: [440, 523.25, 659.25, 523.25, 392, 440, 587.33, 523.25],
      tempo: 0.26,
    },
    FREE: {
      // brighter, faster, a fourth up
      bass: [73.42, 73.42, 98, 73.42, 87.31, 87.31, 65.41, 65.41],
      lead: [587.33, 739.99, 880, 739.99, 659.25, 783.99, 987.77, 880],
      tempo: 0.2,
    },
  };

  startMusic(mode: 'BASE' | 'FREE'): void {
    if (!this.ctx) return;
    this.musicMode = mode;
    if (this.schedulerId) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.schedulerId = setInterval(() => this.scheduler(), 60);
  }

  switchMusic(mode: 'BASE' | 'FREE'): void {
    this.musicMode = mode;
    this.step = 0;
  }

  stopMusic(): void {
    this.musicMode = 'OFF';
    if (this.schedulerId) {
      clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  private scheduler(): void {
    if (!this.ctx || !this.musicBus || this.musicMode === 'OFF') return;
    const pattern = AudioManager.PATTERNS[this.musicMode];
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const i = this.step % pattern.bass.length;
      this.musicNote(pattern.bass[i], this.nextNoteTime, pattern.tempo * 1.8, 'sawtooth', 0.16, 220);
      if (this.step % 2 === 0) {
        this.musicNote(pattern.lead[i], this.nextNoteTime, pattern.tempo * 0.9, 'triangle', 0.07, 3000);
      }
      if (this.step % 4 === 0) this.musicHat(this.nextNoteTime);
      this.nextNoteTime += pattern.tempo;
      this.step += 1;
    }
  }

  private musicNote(
    freq: number,
    when: number,
    dur: number,
    type: OscillatorType,
    gainValue: number,
    cutoff: number,
  ): void {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(gainValue, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  private musicHat(when: number): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.06);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    src.start(when);
    src.stop(when + 0.1);
  }

  dispose(): void {
    this.stopMusic();
    this.stopAnticipation();
    void this.ctx?.close();
    this.ctx = null;
  }
}

export const audioManager = new AudioManager();
