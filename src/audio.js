// Sound: Scott Joplin's "The Entertainer" (1902, public domain) on a synthesized upright piano
// in a small picture house, soft projector clatter, and slapstick sound effects. Everything is
// generated with Web Audio from the note data below; nothing is downloaded.
(function () {
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('trt-muted') === '1'; } catch (e) { /* storage unavailable */ }

  // ---- The tune. 2/4 time, eight sixteenth-note steps per bar. Each bar is
  // [[first-half chord, second-half chord], melody, flag]. Melody values are MIDI notes;
  // 0 is a rest and _ holds the previous note (across bar lines too). Flags: 'solo' plays the
  // right hand in octaves with no left hand (the introduction); 'oct' doubles the melody an
  // octave below, as Joplin asks on repeats.
  const _ = -1;
  const CH = {   // stride left hand: bass note, alternate bass, chord, and the chord's pitch classes
    C: { root: 36, alt: 43, tones: [52, 55, 60], pcs: [0, 4, 7] },
    G7: { root: 31, alt: 38, tones: [53, 59, 62], pcs: [7, 11, 2, 5] },
    D7: { root: 38, alt: 45, tones: [54, 60, 62], pcs: [2, 6, 9, 0] },
  };
  const A_STRAIN = [
    [['C', 'C'], [76, 84, _, 76, 84, _, 76, 84]],      // E C' . E C' . E C'
    [['C', 'C'], [_, _, _, _, _, 84, 86, 87]],         // (held) C' D' D#'
    [['C', 'G7'], [88, 84, 86, 88, _, 83, 86, 84]],    // E' C' D' E' . B D' C'
    [['C', 'C'], [_, _, _, _, 0, 0, 74, 75]],          // (held) . . D D#
    [['C', 'C'], [76, 84, _, 76, 84, _, 76, 84]],
    [['C', 'C'], [_, _, _, _, _, 81, 79, 78]],         // (held) A G F#
    [['D7', 'D7'], [81, 84, 88, 86, _, 84, 81, 86]],   // A C' E' D' . C' A D'
    [['G7', 'G7'], [_, _, _, _, 0, 0, 74, 75]],
    [['C', 'C'], [76, 84, _, 76, 84, _, 76, 84]],
    [['C', 'C'], [_, _, _, _, _, 84, 86, 87]],
    [['C', 'G7'], [88, 84, 86, 88, _, 83, 86, 84]],
    [['C', 'C'], [_, _, _, _, 0, 0, 74, 75]],
    [['C', 'C'], [76, 84, _, _, _, 84, 86, 88]],       // E C' (held) C' D' E'
    [['C', 'C'], [84, 86, 88, 84, 86, 88, 84, 86]],    // the tumbling figure, three notes against two
    [['C', 'G7'], [88, 84, 86, 88, _, 83, 86, 84]],
    [['C', 'C'], [_, _, _, _, 0, 0, 74, 75]],
  ];
  const INTRO = [
    [['C', 'C'], [74, 76, 72, 69, _, 71, 67, _], 'solo'],   // D E C A . B G, in octaves,
    [['C', 'C'], [62, 64, 60, 57, _, 59, 55, _], 'solo'],   // falling an octave each time
    [['C', 'C'], [50, 52, 48, 45, _, 47, 43, _], 'solo'],
    [['C', 'C'], [43, _, _, _, 0, 0, 74, 75], 'solo'],
  ];
  const SONG = INTRO.concat(A_STRAIN, A_STRAIN.map((b) => [b[0], b[1], 'oct']));
  const LOOP_FROM = INTRO.length;   // after the first time through, the introduction is not repeated
  const LOOP_LEN = SONG.length - LOOP_FROM;

  let bpm = 84, step = 0, nextTime = 0, timer = null, clatterOn = false;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const stepDur = () => 60 / bpm / 4;

  // An upright piano note: a hammer click, then a few slightly stretched partials, the higher
  // ones dying away first. Bass notes ring longer than treble.
  function piano(m, t, dur, vol) {
    const f = freq(m);
    const ring = Math.min(dur, f < 200 ? 2.4 : f < 600 ? 1.6 : 0.9);
    const partials = f > 900 ? [[1, 1], [2.004, 0.18]]
      : f > 350 ? [[1, 1], [2.004, 0.35], [3.012, 0.12]]
        : [[1, 1], [2.004, 0.5], [3.012, 0.25], [4.03, 0.1]];
    const out = ac.createGain();
    out.gain.value = vol;
    out.connect(musicBus);
    partials.forEach(([ratio, lvl], i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f * ratio;
      if (i === 0) o.detune.value = 3;
      const tail = ring / (1 + i * 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lvl, t + 0.004);
      g.gain.exponentialRampToValueAtTime(lvl * 0.35, t + 0.09 + tail * 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + tail);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + tail + 0.02);
    });
    if (f < 900) {                                   // a second, slightly detuned string
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = -4;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.6, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + ring + 0.02);
    }
    noise(t, 0.018, vol * 0.9, 'bandpass', 2600, 1.2, musicBus);   // the hammer
  }

  function noise(t, dur, vol, type, f, q, bus) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const filt = ac.createBiquadFilter();
    filt.type = type; filt.frequency.value = f; filt.Q.value = q || 1;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  function bar(i) {
    const n = Math.floor(i / 8);
    return n < SONG.length ? SONG[n] : SONG[LOOP_FROM + (n - LOOP_FROM) % LOOP_LEN];
  }
  const melodyAt = (i) => bar(i)[1][i % 8];

  // A chord tone a third or a sixth below the melody, for the long notes.
  function harmonyBelow(m, chord) {
    for (const gap of [4, 3, 9, 8]) if (chord.pcs.includes(((m - gap) % 12 + 12) % 12)) return m - gap;
    return null;
  }

  function scheduleStep(i, t) {
    const b = bar(i), s = i % 8, flag = b[2];
    const chord = CH[b[0][s < 4 ? 0 : 1]];
    const solo = flag === 'solo';
    if (!solo && s % 4 === 0) piano(s === 0 ? chord.root : chord.alt, t, 1.2, 0.13);      // oom
    if (!solo && s % 4 === 2) chord.tones.forEach((m) => piano(m, t, 0.3, 0.032));         // pah
    const m = b[1][s];
    if (m > 0) {
      let len = 1;
      while (len < 16 && melodyAt(i + len) === _) len++;
      const dur = Math.max(0.35, len * stepDur() * 1.3);
      const vol = s === 0 ? 0.17 : 0.14;
      piano(m, t, dur, vol);
      if (solo) piano(m - 12, t, dur, vol * 0.8);
      else if (flag === 'oct') piano(m - 12, t, dur, vol * 0.55);
      else if (len >= 3) { const h = harmonyBelow(m, chord); if (h) piano(h, t, dur, vol * 0.5); }
    }
  }

  // Schedules well ahead so a busy frame can't make the music stumble, and if the page was
  // throttled it skips forward rather than playing the missed notes in a heap.
  function scheduler() {
    const now = ac.currentTime;
    if (nextTime < now - 0.05) nextTime = now + 0.05;
    while (nextTime < now + 0.6) {
      scheduleStep(step, nextTime);
      if (clatterOn) for (let k = 0; k < 2; k++) noise(nextTime + k * stepDur() / 2, 0.01, 0.01, 'bandpass', 1100, 1.5, musicBus);
      nextTime += stepDur();
      step++;
    }
  }

  // A short, dark room: a decaying burst of noise as the impulse response.
  function makeRoom() {
    const len = Math.floor(ac.sampleRate * 1.3), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, 2.6);
        lp += 0.18 * ((Math.random() * 2 - 1) - lp);      // dull the tail
        d[i] = lp * env;
      }
    }
    const conv = ac.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  G.audio = {
    get muted() { return muted; },
    start() {
      if (!ac) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ac = new Ctx();
        master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
        const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
        master.connect(lp); lp.connect(hp); hp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        musicBus = ac.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
        const room = makeRoom(), wet = ac.createGain(); wet.gain.value = 0.3;
        musicBus.connect(room); room.connect(wet); wet.connect(master);
        sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
      }
      if (ac.state === 'suspended') ac.resume();
      if (!timer) { nextTime = ac.currentTime + 0.1; timer = setInterval(scheduler, 100); }
    },
    setTempo(b) { bpm = b; },
    setClatter(on) { clatterOn = on; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('trt-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ac.currentTime, 0.05);
    },
  };

  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else { ac.resume(); nextTime = ac.currentTime + 0.1; }
  });

  G.sfx = function (name) {
    if (!ac || muted) return;
    const t = ac.currentTime;
    if (name === 'ollie') {
      noise(t, 0.05, 0.6, 'bandpass', 1800, 3);
    } else if (name === 'land') {
      noise(t, 0.12, 0.7, 'lowpass', 500, 1);
    } else if (name === 'grind') {
      noise(t, 0.25, 0.25, 'highpass', 4000, 1);
    } else if (name === 'whistleUp' || name === 'whistleDown') {
      const o = ac.createOscillator(), g = ac.createGain();
      const up = name === 'whistleUp';
      o.type = 'sine';
      o.frequency.setValueAtTime(up ? 500 : 1500, t);
      o.frequency.exponentialRampToValueAtTime(up ? 1500 : 260, t + (up ? 0.35 : 0.6));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (up ? 0.4 : 0.7));
      o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.75);
    } else if (name === 'bail') {
      G.sfx('whistleDown');
      noise(t + 0.3, 0.25, 0.9, 'lowpass', 300, 1);
    } else if (name === 'bank') {
      [72, 76, 79, 84].forEach((m, i) => piano(m, t + i * 0.06, 0.6, 0.14));
    } else if (name === 'whistle') {          // police whistle: a shrill warbling trill
      const o = ac.createOscillator(), lfo = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = 2100;
      lfo.frequency.value = 26; depth.gain.value = 140;
      lfo.connect(depth); depth.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
      g.gain.setValueAtTime(0.06, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g); g.connect(sfxBus);
      o.start(t); lfo.start(t); o.stop(t + 0.75); lfo.stop(t + 0.75);
    } else if (name === 'creak') {            // timber groaning before the house goes over
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(90, t); o.frequency.linearRampToValueAtTime(55, t + 0.9);
      f.type = 'lowpass'; f.frequency.value = 600;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(f); f.connect(g); g.connect(sfxBus);
      o.start(t); o.stop(t + 1.05);
    } else if (name === 'crash') {
      noise(t, 0.9, 1.0, 'lowpass', 250, 1);
      noise(t + 0.02, 0.5, 0.5, 'bandpass', 1200, 0.8);
      for (let k = 1; k < 6; k++) noise(t + k * 0.07, 0.08, 0.4, 'bandpass', 2000 + k * 300, 3);
    } else if (name === 'tick') {
      noise(t, 0.03, 0.4, 'bandpass', 3000, 4);
    }
  };
})();
