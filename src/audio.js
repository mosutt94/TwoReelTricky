// Sound: Scott Joplin's "The Entertainer" (1902, public domain) on a warm synthesized piano
// with a little picture-house echo, soft projector clatter, and slapstick sound effects.
// Everything is generated with Web Audio from the note data below; nothing is downloaded.
(function () {
  let ac = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('trt-muted') === '1'; } catch (e) { /* storage unavailable */ }

  // Stride left hand: bass note on each beat, chord on each off-beat.
  const CH = {
    C: { root: 48, alt: 43, tones: [52, 55, 60] },
    G7: { root: 43, alt: 50, tones: [53, 59, 62] },
    D7: { root: 50, alt: 45, tones: [54, 60, 62] },
  };
  // Each bar of 2/4 is eight sixteenth-note steps: [[first-half chord, second-half chord], melody, 'solo'?].
  // Melody values are MIDI notes; 0 is a rest and _ holds the previous note (across bars too).
  const _ = -1;
  const PHRASE_1 = [['C', 'C'], [76, 84, _, 76, 84, _, 76, 84]];          // E C' . E C' . E C'
  const PHRASE_2 = [['C', 'C'], [_, _, _, _, 0, 84, 86, 87]];             // ...held, then C' D' D#'
  const PHRASE_3 = [['C', 'G7'], [88, 84, 86, 88, _, 83, 86, _]];         // E' C' D' E' . B D' .
  const SONG = [
    // Introduction, in octaves without the left hand.
    [['G7', 'G7'], [86, 88, 84, 81, _, 83, 79, _], 'solo'],
    [['G7', 'G7'], [74, 76, 72, 69, _, 71, 67, _], 'solo'],
    [['C', 'C'], [72, _, _, _, 0, 0, 74, 75]],
    // The A strain.
    PHRASE_1, PHRASE_2, PHRASE_3,
    [['C', 'C'], [84, _, _, _, 0, 0, 74, 75]],
    PHRASE_1,
    [['C', 'D7'], [_, _, _, _, 0, 81, 79, 78]],                          // ...held, then A G F#
    [['D7', 'D7'], [81, 84, 88, 86, _, 84, 81, 86]],                     // A C' E' D' . C' A D'
    [['G7', 'G7'], [_, _, _, _, 0, 0, 74, 75]],
    PHRASE_1, PHRASE_2, PHRASE_3,
    [['C', 'C'], [84, _, _, _, 0, 84, 86, 88]],
    [['C', 'C'], [84, 86, 88, 84, 86, 88, 84, 86]],                      // the tumbling C' D' E' run
    [['C', 'C'], [84, 88, 84, 86, 88, 84, 86, 84]],
    PHRASE_3,
    [['C', 'C'], [84, _, _, _, 0, 0, 0, 0]],
  ];

  let bpm = 150, step = 0, nextTime = 0, timer = null, clatterOn = false;
  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // A struck string: a quick bright attack that settles and darkens as it rings.
  function piano(m, t, dur, vol) {
    const f = freq(m);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vol * 0.4, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(Math.min(3200, f * 5), t);
    tone.frequency.exponentialRampToValueAtTime(Math.max(250, f * 1.4), t + dur);
    tone.connect(g); g.connect(musicBus);
    [[f, 'triangle', 0.9], [f * 1.0012, 'sine', 0.5], [f * 2, 'sine', 0.1]].forEach(([fr, type, lvl]) => {
      const o = ac.createOscillator(), og = ac.createGain();
      o.type = type; o.frequency.value = fr; og.gain.value = lvl;
      o.connect(og); og.connect(tone);
      o.start(t); o.stop(t + dur + 0.05);
    });
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

  const melodyAt = (i) => SONG[Math.floor(i / 8) % SONG.length][1][i % 8];
  function scheduleStep(i, t) {
    const bar = SONG[Math.floor(i / 8) % SONG.length], s = i % 8;
    const chord = CH[bar[0][s < 4 ? 0 : 1]];
    const stepDur = 60 / bpm / 2, solo = bar[2] === 'solo';
    if (!solo && s % 4 === 0) piano(s === 0 ? chord.root : chord.alt, t, 0.6, 0.15);   // oom
    if (!solo && s % 4 === 2) chord.tones.forEach((m) => piano(m, t, 0.35, 0.045));     // pah
    const m = bar[1][s];
    if (m > 0) {
      let len = 1;
      while (len < 16 && melodyAt(i + len) === _) len++;
      const dur = Math.max(0.3, len * stepDur * 1.4);
      piano(m, t, dur, s === 0 ? 0.12 : 0.1);
      if (solo) piano(m - 12, t, dur, 0.09);
    }
  }

  function scheduler() {
    while (nextTime < ac.currentTime + 0.15) {
      scheduleStep(step, nextTime);
      if (clatterOn) for (let k = 0; k < 3; k++) noise(nextTime + k * (60 / bpm / 6), 0.01, 0.012, 'bandpass', 1100, 1.5, musicBus);
      nextTime += 60 / bpm / 2;
      step++;
    }
  }

  const A = G.audio = {
    get muted() { return muted; },
    start() {
      if (!ac) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ac = new Ctx();
        master = ac.createGain(); master.gain.value = muted ? 0 : 0.9;
        const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
        master.connect(lp); lp.connect(ac.destination);
        musicBus = ac.createGain(); musicBus.gain.value = 0.4; musicBus.connect(master);
        // A soft echo, like a piano in a small picture house.
        const echo = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), dark = ac.createBiquadFilter();
        echo.delayTime.value = 0.13; fb.gain.value = 0.28; wet.gain.value = 0.22;
        dark.type = 'lowpass'; dark.frequency.value = 1600;
        musicBus.connect(echo); echo.connect(dark); dark.connect(fb); fb.connect(echo); dark.connect(wet); wet.connect(master);
        sfxBus = ac.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      if (!timer) { nextTime = ac.currentTime + 0.05; timer = setInterval(scheduler, 30); }
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
    if (document.hidden) ac.suspend(); else { ac.resume(); nextTime = ac.currentTime + 0.05; }
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
      [72, 76, 79, 84].forEach((m, i) => piano(m, t + i * 0.06, 0.5, 0.12));
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
