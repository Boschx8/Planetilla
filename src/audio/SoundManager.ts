/**
 * SoundManager — Web Audio API synthesis, no external files needed.
 * All sounds are generated programmatically.
 */
export class SoundManager {
  private ctx: AudioContext | null = null
  private masterGain!: GainNode
  private musicGain!: GainNode
  private sfxGain!: GainNode
  private musicNodes: AudioNode[] = []
  private musicRunning = false
  private muted = false

  init() {
    if (this.ctx) return
    this.ctx = new AudioContext()

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7
    this.masterGain.connect(this.ctx.destination)

    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.25
    this.musicGain.connect(this.masterGain)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 1.0
    this.sfxGain.connect(this.masterGain)

    this.startAmbientMusic()
  }

  // ─── Resume ctx after user gesture ───────────────────────────────────────
  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume()
  }

  toggleMute() {
    if (!this.ctx) return
    this.muted = !this.muted
    this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.1)
    return this.muted
  }

  // ─── Ambient space music ─────────────────────────────────────────────────
  // G major, 120 BPM, I–IV–vi–V progression (G / C / Am / D)
  // Four layers: bass pulse, pad chords, sparkly arpeggio, lead melody
  private startAmbientMusic() {
    if (!this.ctx || this.musicRunning) return
    this.musicRunning = true
    this.scheduleLoop(this.ctx.currentTime + 0.1)
  }

  private scheduleLoop(t0: number) {
    if (!this.ctx || !this.musicRunning) return
    const ctx  = this.ctx
    const beat = 0.5        // 120 BPM → 0.5 s/beat
    const loop = beat * 32  // 16-second, 32-beat loop

    const play = (freq: number, t: number, dur: number, type: OscillatorType, vol: number) => {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.type = type
      osc.frequency.value = freq
      const atk = Math.min(0.04, dur * 0.15)
      const rel = Math.min(0.15, dur * 0.3)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(vol, t + atk)
      g.gain.setValueAtTime(vol, t + dur - rel)
      g.gain.linearRampToValueAtTime(0, t + dur)
      osc.connect(g)
      g.connect(this.musicGain)
      osc.start(t)
      osc.stop(t + dur + 0.01)
    }

    // ── Bass: triangle, root + fifth, every 2 beats ───────────────
    const bass: [number, number][] = [
      [0, 98],    [2, 98],    [4, 146.83], [6, 98],      // G2 G2 D3 G2
      [8, 130.81],[10, 130.81],[12, 196],  [14, 130.81], // C3 C3 G3 C3
      [16, 110],  [18, 110],  [20, 164.81],[22, 110],    // A2 A2 E3 A2
      [24, 146.83],[26, 146.83],[28, 220], [30, 146.83], // D3 D3 A3 D3
    ]
    for (const [b, f] of bass) play(f, t0 + b * beat, beat * 1.6, 'triangle', 0.20)

    // ── Pad chords: sine, 8-beat sustained notes ─────────────────
    const pads: [number, number[]][] = [
      [0,  [196, 246.94, 293.66]],  // G3 B3 D4
      [8,  [261.63, 329.63, 392]],  // C4 E4 G4
      [16, [220, 261.63, 329.63]], // A3 C4 E4
      [24, [293.66, 369.99, 440]], // D4 F#4 A4
    ]
    for (const [b, freqs] of pads)
      for (const f of freqs) play(f, t0 + b * beat, beat * 7.5, 'sine', 0.038)

    // ── Arpeggio: sine, 8th-note sparkle (16 notes × 4 chords) ──
    const arps = [
      [392, 493.88, 587.33, 493.88],    // G4 B4 D5 B4
      [523.25, 659.25, 783.99, 659.25], // C5 E5 G5 E5
      [440, 523.25, 659.25, 523.25],    // A4 C5 E5 C5
      [587.33, 739.99, 880, 739.99],    // D5 F#5 A5 F#5
    ]
    for (let chord = 0; chord < 4; chord++) {
      const pat = arps[chord]
      for (let i = 0; i < 16; i++) {
        const t = t0 + chord * beat * 8 + i * beat / 2
        play(pat[i % 4], t, beat * 0.38, 'sine', 0.022)
      }
    }

    // ── Melody: triangle, half-note (2-beat) phrases ──────────────
    const mel: [number, number][] = [
      [0, 493.88], [2, 440],    [4, 392],    [6, 493.88],   // B4 A4 G4 B4
      [8, 523.25], [10, 659.25],[12, 587.33],[14, 523.25],  // C5 E5 D5 C5
      [16, 659.25],[18, 587.33],[20, 523.25],[22, 493.88],  // E5 D5 C5 B4
      [24, 440],   [26, 392],   [28, 440],   [30, 587.33],  // A4 G4 A4 D5
    ]
    for (const [b, f] of mel) play(f, t0 + b * beat, beat * 1.85, 'triangle', 0.055)

    // ── Reschedule 1 s before loop end ────────────────────────────
    const delay = Math.max(50, (t0 + loop - 1.0 - ctx.currentTime) * 1000)
    setTimeout(() => this.scheduleLoop(t0 + loop), delay)
  }

  // ─── Sound effects ────────────────────────────────────────────────────────

  playMerge(planetId: number) {
    if (!this.ctx) return
    const t = this.ctx.currentTime

    // Pitch goes higher with planet level
    const baseFreq = 280 + planetId * 55
    const osc  = this.ctx.createOscillator()
    const gain = this.ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(baseFreq * 1.3, t)
    osc.frequency.exponentialRampToValueAtTime(baseFreq, t + 0.08)

    gain.gain.setValueAtTime(0.45, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.4)

    // Harmonic overtone
    if (planetId >= 3) {
      const osc2  = this.ctx.createOscillator()
      const gain2 = this.ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.value = baseFreq * 2
      gain2.gain.setValueAtTime(0.2, t)
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc2.connect(gain2)
      gain2.connect(this.sfxGain)
      osc2.start(t)
      osc2.stop(t + 0.3)
    }
  }

  playDrop() {
    if (!this.ctx) return
    const t = this.ctx.currentTime

    const osc  = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.12)
    gain.gain.setValueAtTime(0.22, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.15)
  }

  playExplosion() {
    if (!this.ctx) return
    const t = this.ctx.currentTime

    // Noise burst
    const bufSize  = this.ctx.sampleRate * 0.6
    const buffer   = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate)
    const data     = buffer.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1)

    const noise = this.ctx.createBufferSource()
    noise.buffer = buffer

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 150
    filter.Q.value = 0.8

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.7, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55)

    noise.connect(filter)
    filter.connect(gain)
    gain.connect(this.sfxGain)
    noise.start(t)

    // Sub boom
    const sub  = this.ctx.createOscillator()
    const subG = this.ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(80, t)
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.4)
    subG.gain.setValueAtTime(0.55, t)
    subG.gain.exponentialRampToValueAtTime(0.001, t + 0.45)
    sub.connect(subG)
    subG.connect(this.sfxGain)
    sub.start(t)
    sub.stop(t + 0.5)
  }

  playSun() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // Ascending sparkle arpeggio
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5]
    notes.forEach((freq, i) => {
      const osc  = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const st = t + i * 0.09
      gain.gain.setValueAtTime(0, st)
      gain.gain.linearRampToValueAtTime(0.35, st + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(st)
      osc.stop(st + 0.55)
    })
  }

  playGameOver() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    // Sad descending notes
    const notes = [392, 349.23, 329.63, 261.63]
    notes.forEach((freq, i) => {
      const osc  = this.ctx!.createOscillator()
      const gain = this.ctx!.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const st = t + i * 0.28
      gain.gain.setValueAtTime(0.3, st)
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5)
      osc.connect(gain)
      gain.connect(this.sfxGain)
      osc.start(st)
      osc.stop(st + 0.55)
    })
  }

  playWarning() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc  = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 440
    gain.gain.setValueAtTime(0.08, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(gain)
    gain.connect(this.sfxGain)
    osc.start(t)
    osc.stop(t + 0.13)
  }
}

export const soundManager = new SoundManager()
