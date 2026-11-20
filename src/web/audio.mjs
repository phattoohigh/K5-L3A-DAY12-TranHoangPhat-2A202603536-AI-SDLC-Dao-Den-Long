// Procedural Web Audio engine — Vietnamese pentatonic ambient pad + crisp gameplay SFX.
// Purely browser-side; never imported by src/sim.mjs or headless mode.

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];

export function createAudio(initialVolume = 0.35) {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let volume = initialVolume;
  let chordTimer = null;
  let chordStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.14;
    musicGain.connect(master);

    // Gentle midnight drone + slow breath LFO
    const droneA = ctx.createOscillator();
    const droneB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    droneA.type = "sine";
    droneB.type = "triangle";
    droneA.frequency.value = 130.81; // C3
    droneB.frequency.value = 196.0;  // G3
    filter.type = "lowpass";
    filter.frequency.value = 420;
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const droneMix = ctx.createGain();
    droneMix.gain.value = 0.22;
    droneA.connect(filter);
    droneB.connect(filter);
    filter.connect(droneMix);
    droneMix.connect(musicGain);
    droneA.start();
    droneB.start();
    lfo.start();

    // Soft pentatonic plucked notes every 2.8 s
    const pattern = [0, 2, 4, 3, 5, 4, 2, 1];
    chordTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== "running" || volume <= 0.001) return;
      const now = ctx.currentTime;
      const freq = PENTATONIC[pattern[chordStep % pattern.length]];
      chordStep++;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      o.connect(g);
      g.connect(musicGain);
      o.start(now);
      o.stop(now + 2.3);
    }, 2800);
    return true;
  }

  function tone(freq, duration = 0.14, type = "sine", gainLevel = 0.22, freqEnd = null, delay = 0) {
    if (!ctx || volume <= 0.001) return;
    const now = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(gainLevel, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + duration + 0.02);
  }

  function noiseBurst(duration = 0.12, cutoff = 1200, gainLevel = 0.12) {
    if (!ctx || volume <= 0.001) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gainLevel;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    start: ensure,
    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (master) master.gain.value = volume;
    },
    playEvent(e) {
      if (!ctx) return;
      switch (e.name) {
        case "mote_picked": {
          const idx = Math.min(PENTATONIC.length - 1, Math.max(0, (e.data?.carried ?? 1) - 1));
          tone(PENTATONIC[idx], 0.13, "sine", 0.22, PENTATONIC[idx] * 1.15);
          break;
        }
        case "deposit":
          tone(440, 0.12, "triangle", 0.2, 587.33);
          break;
        case "refuel":
          tone(523.25, 0.14, "triangle", 0.22, 659.25);
          tone(783.99, 0.18, "sine", 0.14, null, 0.06);
          break;
        case "lantern_lit":
          tone(392.0, 0.45, "triangle", 0.24);
          tone(523.25, 0.5, "sine", 0.22, null, 0.07);
          tone(659.25, 0.55, "sine", 0.2, null, 0.14);
          tone(783.99, 0.65, "sine", 0.18, null, 0.21);
          break;
        case "lantern_out":
          tone(220, 0.4, "sawtooth", 0.16, 92);
          noiseBurst(0.22, 420, 0.14);
          break;
        case "fuel_drain":
          tone(155, 0.1, "sawtooth", 0.08, 128);
          break;
        case "pulse":
          tone(280, 0.26, "triangle", 0.28, 720);
          tone(140, 0.3, "sine", 0.24, 65);
          noiseBurst(0.18, 900, 0.12);
          break;
        case "dash":
          noiseBurst(0.14, 1800, 0.16);
          tone(340, 0.1, "sine", 0.14, 580);
          break;
        case "jump":
          tone(290, 0.1, "sine", 0.16, 460);
          break;
        case "charm_picked":
          tone(587.33, 0.16, "sine", 0.2);
          tone(783.99, 0.2, "sine", 0.2, null, 0.07);
          tone(1046.5, 0.28, "triangle", 0.18, null, 0.14);
          break;
        case "drifter_steal":
          tone(620, 0.16, "sawtooth", 0.15, 280);
          break;
        case "drifter_drop":
          tone(523.25, 0.14, "sine", 0.2);
          tone(659.25, 0.18, "sine", 0.2, null, 0.06);
          break;
        case "player_hit":
          tone(170, 0.26, "sawtooth", 0.26, 75);
          noiseBurst(0.18, 350, 0.18);
          break;
        case "shade_spawned":
          tone(118, 0.28, "sawtooth", 0.1, 88);
          break;
        case "game_over":
          if (e.data?.result === "won") {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.65, "triangle", 0.22, null, i * 0.1));
          } else {
            [293.66, 261.63, 220.0, 174.61].forEach((f, i) => tone(f, 0.5, "triangle", 0.2, null, i * 0.12));
          }
          break;
        default:
          break;
      }
    },
    tickCountdown(secs) {
      tone(660 - (10 - secs) * 28, 0.1, "sine", 0.15);
    },
    dispose() {
      if (chordTimer) clearInterval(chordTimer);
    },
  };
}
