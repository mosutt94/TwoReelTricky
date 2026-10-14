// Skating rules. Hold to crouch, let go to ollie. Keep holding as you come down on a rail or
// ledge to grind it, and let go to pop off. Swipe in the air to flip (swipe the same way again
// for a double or triple), swipe up for the Hat Trick, or swipe up and hold to grab. Land while
// holding to manual, which keeps the combo alive between obstacles but needs balancing: the
// needle drifts faster the longer you ride and the more tricks are stacked in the combo.
(function () {
  const GR = G.GROUND, GRAVITY = 1550;
  const input = G.input;

  const FLIPS = {
    left: { names: ['Kickflip', 'Double Kickflip', 'Triple Kickflip'], pts: [150, 350, 700], kind: 'flip', sign: 1 },
    right: { names: ['Heelflip', 'Double Heelflip', 'Triple Heelflip'], pts: [150, 350, 700], kind: 'flip', sign: -1 },
    down: { names: ['Pop Shove-It', '360 Shove-It', '540 Shove-It'], pts: [150, 350, 700], kind: 'spin', sign: 1 },
  };
  const FIRST_SPIN = 0.25, EXTRA_SPIN = 0.2;
  const GRINDS = {
    rail: '50-50 Grind', bench: 'Boardslide', ledge: '5-0 Grind', crate: 'Crate Slide',
    line: 'Tightrope Walk', pad: 'Curb Grind', dock: 'Dock Grind', trolley: 'Trolley Roof Grind',
  };
  const BAIL_LINES = ['Not a flicker of expression.', 'He meant to do that.', 'Dignity: temporarily misplaced.',
    'A face of perfect calm.', 'The pavement wins this round.'];

  const hero = G.hero = {};
  const looseBoard = { active: false }, looseHat = { active: false };
  const combo = { names: [], entries: [], base: 0, mult: 0, counts: {} };
  const popups = [];
  const stats = G.stats = { bestCombo: 0, bails: 0 };
  let banner = null, score = 0, time = 0;
  G.getScore = () => score;
  G.combo = combo;

  function reset() {
    Object.assign(hero, {
      x: 0, y: GR, vy: 0, state: 'ground', speed: 120, crouch: 0.1, tilt: 0, lean: 2,
      support: null, onRamp: null, grind: null, ghost: false,
      flip: null, queued: null, hat: null, grab: null, grabPending: -1,
      hatOn: true, hatLift: 0, hatSpin: 0, board: { flip: 0, spin: 0, dy: 0 },
      arms: 'relaxed', bailT: 0, bailRot: 0, floor: GR, floorObj: null,
      pipe: null, pAir: false, pumping: false, popped: false, pipeH: 60, faceScale: 1, airPress: false,
      bal: 0, balV: 0, balT: 0,
    });
    camPipe = null; camBlend = 0; camY = 0; G.camY = 0;
    looseBoard.active = looseHat.active = false;
    clearCombo();
    popups.length = 0;
    banner = null; score = 0; time = 0;
    stats.bestCombo = 0; stats.bails = 0;
    G.world.reset();
    if (G.chase) G.chase.reset();
  }

  // ---- World queries
  const kind = (o) => G.KINDS[o.kind] || {};
  const list = () => G.world.list;
  function rampAt(x) {
    for (const o of list()) if (kind(o).ramp && x >= o.x && x <= o.x + o.w) return o;
    return null;
  }
  function streetY(x) { const r = rampAt(x); return r ? GR - r.h * (x - r.x) / r.w : GR; }
  const overlapping = (o, pad) => hero.x + pad > o.x && hero.x - pad < o.x + o.w;
  function hitSide() {
    if (hero.ghost) return null;
    for (const o of list()) {
      if (!kind(o).solid) continue;
      if (overlapping(o, 7) && hero.y > o.top + 5 && hero.y <= o.base + 2) return o;
    }
    return null;
  }
  // The highest grindable or flat top he came down through this frame.
  function landingTarget(prevY) {
    let best = null;
    for (const o of list()) {
      const k = kind(o);
      if (!k.grind && !k.flat) continue;
      if (hero.x >= o.x - 6 && hero.x <= o.x + o.w && prevY <= o.top + 3 && hero.y >= o.top) {
        if (!best || o.top < best.top) best = o;
      }
    }
    return best;
  }
  // What he lands on if he falls flat right here: the highest flat top under his feet, or the street.
  function floorAt(x, y) {
    let floor = GR, obj = null;
    for (const o of list()) {
      if (kind(o).flat && x >= o.x && x <= o.x + o.w && o.top >= y - 2 && o.top < floor) { floor = o.top; obj = o; }
    }
    return { floor, obj };
  }

  // ---- Combos
  function addToCombo(name, pts) {
    const n = (combo.counts[name] = (combo.counts[name] || 0) + 1);
    const factor = Math.pow(0.5, n - 1);      // repeating a trick in one combo is worth less
    combo.entries.push({ pts, factor });
    combo.names.push(name);
    combo.base += pts * factor;
    combo.mult += 1;
    popups.push({ text: name, t: 0 });
    return combo.names.length - 1;
  }
  function upgradeCombo(i, name, pts) {
    const e = combo.entries[i];
    combo.base += (pts - e.pts) * e.factor;
    e.pts = pts;
    combo.names[i] = name;
    popups.push({ text: name, t: 0 });
  }
  function clearCombo() {
    combo.names = []; combo.entries = []; combo.base = 0; combo.mult = 0; combo.counts = {};
  }
  function bankCombo() {
    if (!combo.mult) return;
    const total = Math.round(combo.base) * combo.mult;
    score += total;
    stats.bestCombo = Math.max(stats.bestCombo, total);
    if (G.chase) G.chase.onBank(total);
    G.sfx('bank');
    banner = { text: '+' + G.fmt(total), sub: combo.mult > 1 ? combo.mult + '-trick combo!' : combo.names[0], t: 0 };
    clearCombo();
  }

  // ---- Tricks in the air
  function resetBoard() { hero.board.flip = hero.board.spin = hero.board.dy = 0; }
  function clearAir() {
    hero.flip = null; hero.queued = null; hero.grab = null; hero.grabPending = -1;
    resetBoard();
  }
  // Seconds of air left before he comes down on whatever is under him.
  function airLeft() {
    let g = GRAVITY, land = streetY(hero.x);
    if (hero.pipe) { g = 1450; land = GR - hero.pipe.R; }
    else for (const o of list()) {
      const k = kind(o);
      if ((k.grind || k.flat) && hero.x >= o.x - 6 && hero.x <= o.x + o.w && o.top >= hero.y && o.top < land) land = o.top;
    }
    const h = Math.max(0, land - hero.y), vy = hero.vy;
    return (-vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
  }
  // A flick with too little air left to finish the rotation is waved off rather than punished.
  function startFlip(dir) {
    const def = FLIPS[dir], f = hero.flip;
    const need = (f && f.dir === dir ? EXTRA_SPIN : FIRST_SPIN) - 0.1;
    if (airLeft() < need) {
      if (!popups.some((p) => p.text === 'Late!')) popups.push({ text: 'Late!', t: 0.2 });
      return;
    }
    if (f && f.dir === dir && f.spins < 3) {           // same flick again: one more rotation
      f.spins++;
      f.dur += EXTRA_SPIN;
      upgradeCombo(f.idx, def.names[f.spins - 1], def.pts[f.spins - 1]);
      return;
    }
    if (f) { hero.queued = dir; return; }
    hero.flip = { dir, kind: def.kind, sign: def.sign, spins: 1, t: 0, dur: FIRST_SPIN, idx: addToCombo(def.names[0], def.pts[0]) };
  }
  // The Hat Trick is pure showmanship: it never costs him a fall, so it is a flourish worth a
  // little on its own and never a rung in the combo.
  function startHat() {
    if (hero.hat) return;
    hero.hat = { t: 0, dur: 0.6 };
    G.sfx('whistleUp');
  }
  function updateHat(dt) {
    const h = hero.hat;
    if (!h) return;
    h.t += dt;
    const p = Math.min(1, h.t / h.dur);
    hero.hatLift = Math.sin(p * Math.PI) * 56;
    hero.hatSpin = p * Math.PI * 4;
    if (p < 1) return;
    hero.hat = null; hero.hatLift = hero.hatSpin = 0;
    G.emit('dust', hero.x + 8, hero.y - 84, 4, 40);
    if (combo.mult) combo.base += 50; else score += 50;
    popups.push({ text: 'Hat Trick  +50', t: 0 });
  }
  function startGrab() {
    hero.grab = { t: 0 };
    addToCombo('Porkpie Grab', 150);
  }
  function updateTricks(dt) {
    const f = hero.flip;
    if (f) {
      f.t += dt;
      const p = Math.min(1, f.t / f.dur), turn = p * f.spins * Math.PI * 2;
      hero.board.flip = f.kind === 'flip' ? turn * f.sign : 0;
      hero.board.spin = f.kind === 'spin' ? turn : 0;
      hero.board.dy = Math.sin(p * Math.PI) * 7;
      if (p >= 1) {
        hero.flip = null; resetBoard();
        if (hero.queued) { const q = hero.queued; hero.queued = null; startFlip(q); }
      }
    }
    // Flick up and keep holding: he grabs the board as well.
    if (hero.grabPending >= 0 && (hero.grabPending += dt) > 0.18) {
      hero.grabPending = -1;
      if (input.down) startGrab();
    }
    if (hero.grab) {
      hero.grab.t += dt;
      combo.base += 260 * dt;
      if (!input.down) hero.grab = null;
    }
  }
  // Why a landing right now would go wrong, if it would.
  function unsafe() {
    if (hero.flip && hero.flip.t < hero.flip.dur - 0.12) return 'Landed mid-flip.';
    return null;
  }
  // Coming down just as the board finishes turning is allowed, but it isn't pretty.
  function noteSketchy() {
    if (hero.flip) popups.push({ text: 'Sketchy!', t: 0 });
  }

  // ---- Moves
  function pop() {
    let v;
    if (hero.state === 'ground') {
      const held = G.clamp((performance.now() - input.t) / 1000, 0, 0.35);
      v = 560 + (held / 0.35) * 260 + (hero.onRamp ? 250 : 0);
    } else {
      v = 660;                                   // popping off a rail or out of a manual
    }
    hero.vy = -v;
    hero.state = 'air';
    hero.grind = null; hero.support = null; hero.onRamp = null;
    G.emit('dust', hero.x - 8, hero.y, 3, 30);
    G.sfx('ollie');
  }
  // Manual balance. Slide the finger toward the needle to catch it. It tips faster with time and
  // with the size of the combo riding on it, up to a cap so it never becomes impossible.
  function startBalance() {
    hero.bal = G.rand(-0.1, 0.1);
    hero.balV = (Math.random() < 0.5 ? -1 : 1) * 0.25;
    hero.balT = 0;
    input.anchor = input.cx;
  }
  function balance(dt) {
    hero.balT += dt;
    const stack = Math.min(8, combo.mult);
    const ctrl = G.balanceInput();
    const tip = hero.bal * (1.1 + hero.balT * 0.45 + stack * 0.28);
    const wobble = Math.sin(time * 3.1 + hero.x * 0.013) * 0.25 * (0.5 + hero.balT * 0.15 + stack * 0.1);
    hero.balV += (tip + wobble - ctrl * 3.2) * dt;
    hero.balV *= Math.pow(0.6, dt);
    hero.bal += hero.balV * dt;
    return Math.abs(hero.bal) < 1;
  }
  function startGrind(o) {
    clearAir();
    hero.state = 'grind'; hero.grind = o; hero.support = null;
    hero.y = o.top; hero.vy = 0;
    addToCombo(GRINDS[o.kind] || 'Grind', 100);
    G.sfx('grind');
  }
  function startManual() {
    clearAir();
    hero.state = 'manual';
    startBalance();
    addToCombo('Manual', 50);
  }
  function land() {
    clearAir();
    hero.state = 'ground'; hero.vy = 0; hero.crouch = 0.95;
    G.emit('dust', hero.x - 6, hero.y, 6, 60);
    G.sfx('land');
    bankCombo();
  }
  function touchDown(o, sy) {
    const holding = input.down && !input.consumed;
    const k = o ? kind(o) : null;
    if (o && holding && k.grind) {
      hero.y = o.top;
      const bad = unsafe();
      if (bad) return bail(o, bad);
      noteSketchy();
      return startGrind(o);
    }
    if (o && !k.flat) {
      if (o.kind === 'line') return;               // a rope: without holding on, he drops right through
      hero.y = o.top;
      return bail(o, 'Should have held on to grind it.', 'RACKED!');
    }
    hero.y = o ? o.top : sy;
    const bad = unsafe() || (hero.grab ? 'Let go of the grab too late.' : null);
    if (bad) return bail(o, bad);
    noteSketchy();
    hero.support = o; hero.vy = 0;
    if (holding) startManual(); else land();
  }

  function bail(o, why, title) {
    if (hero.state === 'bail') return;
    const f = floorAt(hero.x + 30, hero.y);
    hero.floor = f.floor; hero.floorObj = f.obj;
    hero.state = 'bail';
    hero.bailT = 0; hero.bailRot = 0;
    hero.grind = null; hero.onRamp = null; hero.support = null;
    hero.vy = Math.max(hero.vy, -100);
    clearAir();
    hero.hat = null; hero.hatLift = hero.hatSpin = 0;
    clearCombo();
    banner = { text: title || 'BAILED!', sub: why || BAIL_LINES[(Math.random() * BAIL_LINES.length) | 0], t: 0, bail: true };
    hero.hatOn = false;
    Object.assign(looseHat, { active: true, x: hero.x + 5, y: hero.y - 72, vx: hero.speed * 0.4 + 30, vy: -650, rot: 0, vr: 9 });
    Object.assign(looseBoard, { active: true, returning: false, x: hero.x, y: hero.y, vx: hero.speed * 1.1 + 60, vy: -220, rot: 0, vr: 14 });
    G.shake = 7;
    stats.bails++;
    G.sfx('bail');
    if (G.chase) G.chase.onBail();
    if (o && o.kind === 'crate') G.emit('chip', hero.x + 12, o.top + 8, 9, 140);
    G.emit('dust', hero.x + 30, hero.floor, 8, 80);
  }

  G.handlers.press = () => { hero.airPress = hero.state === 'air' || (hero.state === 'pipe' && hero.pAir); };
  G.handlers.release = () => {
    if (hero.state === 'ground' || hero.state === 'manual' || hero.state === 'grind') pop();
    else if (hero.state === 'pipe' && !hero.pAir) pipePop();
    hero.grabPending = -1;
  };
  // A quick flick on the ground, a rail or a manual pops straight into the trick; in the air it
  // starts one.
  // A grab needs a fresh press in the air, so a finger held over from a grind or a pump never
  // turns a hat trick into one by accident.
  G.handlers.swipe = (dir, fromKey) => {
    const riding = hero.state === 'grind' || hero.state === 'manual';
    if (hero.state === 'manual' && fromKey && (dir === 'left' || dir === 'right')) return;   // arrow keys steer balance
    if (hero.state === 'ground' || riding) { pop(); hero.vy -= 60; }
    if (hero.state !== 'air' && !(hero.state === 'pipe' && hero.pAir)) return;
    if (dir === 'up') { startHat(); if (!hero.grab && hero.airPress) hero.grabPending = 0; }
    else startFlip(dir);
  };

  // ---- The Thrill Ramp. He rides a profile of two quarter-circle walls joined by a flat, with
  // gravity pulling him along the curve. Holding on the way down a wall pumps for height, and
  // letting go near the top pops for a burst more. Off each lip he flies straight up, turns, and
  // comes back down the same wall. The combo runs for the whole session and banks on the way out.
  const PIPE_TIME = 12, AIR_MIN = 60, AIR_MAX = 140, PUMP_RATE = 110, POP_BONUS = 40, G_AIR = 1450;
  G.PIPE = { AIR_MIN, AIR_MAX };
  const pipeLen = (o) => Math.PI * o.R + o.F;
  function pipeAt(o, s) {                       // point on the profile, and its tangent toward +s
    const R = o.R, F = o.F, a = Math.PI * R / 2, cy = GR - R;
    if (s <= a) { const p = s / R; return { x: o.x + R - R * Math.cos(p), y: cy + R * Math.sin(p), tx: Math.sin(p), ty: Math.cos(p) }; }
    if (s <= a + F) return { x: o.x + R + (s - a), y: GR, tx: 1, ty: 0 };
    const q = (s - a - F) / R;
    return { x: o.x + R + F + R * Math.sin(q), y: cy + R * Math.cos(q), tx: Math.cos(q), ty: -Math.sin(q) };
  }
  function pipeSAt(o, x) {
    const R = o.R, F = o.F, a = Math.PI * R / 2;
    if (x <= o.x + R) return R * Math.acos(G.clamp((o.x + R - x) / R, -1, 1));
    if (x <= o.x + R + F) return a + (x - o.x - R);
    return a + F + R * Math.asin(G.clamp((x - o.x - R - F) / R, -1, 1));
  }
  const wallSpeed = () => Math.sqrt(2 * GRAVITY * (hero.pipe.R + hero.pipeH));

  function enterPipe(o, s, v) {
    clearAir();
    o.done = true;
    Object.assign(hero, {
      state: 'pipe', pipe: o, ps: s, pv: v, pAir: false, pumping: false, popped: false, pipeT: 0, pipeH: AIR_MIN, pExit: false,
      support: null, onRamp: null, grind: null, speed: 0, vy: 0,
    });
    say('THE THRILL RAMP!', 'HOLD down the wall to pump  ·  LET GO at the top to pop', true);
  }
  // Coming down onto the half-pipe from the deck or out of the air.
  function pipeEntry() {
    for (const o of list()) {
      if (o.kind !== 'pipe' || o.done || hero.x < o.x || hero.x > o.x + o.w) continue;
      const s = pipeSAt(o, hero.x), p = pipeAt(o, s);
      if (hero.state === 'air') {
        if (hero.y < p.y) return false;
        hero.y = p.y;
        const bad = unsafe() || (hero.grab ? 'Let go of the grab too late.' : null);
        if (bad) { hero.pipe = o; o.done = true; bail(null, bad); return true; }
        noteSketchy();
      }
      enterPipe(o, s, Math.max(150, hero.speed * 0.6));
      return true;
    }
    return false;
  }
  // Letting go on the way up a wall, near the lip: a pop for extra air.
  function pipePop() {
    const o = hero.pipe, L = pipeLen(o), a = Math.PI * o.R / 2;
    const up = (hero.ps < a && hero.pv < 0) || (hero.ps > a + o.F && hero.pv > 0);
    const near = hero.ps < a * 0.5 || hero.ps > L - a * 0.5;
    if (up && near && !hero.popped) {
      hero.popped = true;
      hero.crouch = 0.1;
      popups.push({ text: 'Pop!', t: 0 });
      G.sfx('ollie');
    }
  }
  function exitPipe() {
    const o = hero.pipe, launch = Math.min(Math.sqrt(2 * GRAVITY * (hero.pipeH + 70)), 780);
    hero.pipe = null; hero.pAir = false; hero.pumping = false;
    hero.state = 'air';
    hero.x = o.x + o.w + 4; hero.y = GR - o.R;
    hero.vy = -launch;
    hero.speed = 230;
    G.sfx('ollie');
  }
  function updatePipe(dt) {
    const o = hero.pipe, L = pipeLen(o), a = Math.PI * o.R / 2;
    hero.pipeT += dt;
    if (hero.pipeT > PIPE_TIME && !hero.pExit) { hero.pExit = true; say('LAST AIR!', 'Out over the far deck next time', true); }

    if (hero.pAir) {                                       // up above the lip
      hero.vy += G_AIR * dt;
      hero.y += hero.vy * dt;
      hero.pAirT += dt;
      updateTricks(dt);
      if (hero.vy > 0 && hero.y >= GR - o.R) {
        hero.y = GR - o.R;
        const bad = unsafe() || (hero.grab ? 'Let go of the grab too late.' : null);
        if (bad) return bail(null, bad);
        noteSketchy();
        clearAir();
        hero.pAir = false; hero.popped = false;
        hero.ps = hero.pLip > 0 ? L : 0;
        hero.pv = -hero.pLip * 40;                         // back down the wall; gravity does the rest
        G.emit('dust', hero.x, hero.y, 4, 40);
        G.sfx('land');
      }
      return;
    }

    // Riding the walls. Holding while heading down a wall is a pump; the swing's energy is set
    // afresh at the bottom from the height he has built.
    const prev = hero.ps;
    const onWall = hero.ps < a || hero.ps > a + o.F;
    const down = (hero.ps < a && hero.pv > 0) || (hero.ps > a + o.F && hero.pv < 0);
    hero.pumping = onWall && down && input.down;
    if (hero.pumping) {
      hero.pipeH = Math.min(AIR_MAX, hero.pipeH + PUMP_RATE * dt);
      if (Math.random() < 0.5) G.emit('dust', hero.x, hero.y, 1, 40);
    }
    hero.pv += GRAVITY * pipeAt(o, hero.ps).ty * dt;
    hero.ps += hero.pv * dt;
    if ((prev - L / 2) * (hero.ps - L / 2) <= 0) hero.pv = Math.sign(hero.pv || 1) * wallSpeed();
    if (hero.ps >= L || hero.ps <= 0) {
      hero.pLip = hero.ps >= L ? 1 : -1;
      hero.ps = hero.pLip > 0 ? L : 0;
      const lip = pipeAt(o, hero.ps);
      hero.x = lip.x; hero.y = lip.y;
      if (hero.pExit && hero.pLip > 0) return exitPipe();
      const H = hero.pipeH + (hero.popped ? POP_BONUS : 0);
      hero.pAir = true; hero.pAirT = 0; hero.pv = 0;
      hero.vy = -Math.sqrt(2 * G_AIR * H);
      hero.pAirDur = 2 * Math.sqrt(2 * H / G_AIR);
      hero.pipeH = Math.max(AIR_MIN, hero.pipeH - 12);     // a little is lost each swing unless he pumps
      return;
    }
    const p = pipeAt(o, hero.ps);
    hero.x = p.x; hero.y = p.y;
  }
  function resumePipe() {
    Object.assign(hero, {
      state: 'pipe', pAir: false, pumping: false, popped: false, ps: pipeLen(hero.pipe) / 2, pipeH: AIR_MIN,
      pv: (Math.random() < 0.5 ? -1 : 1) * 400, x: hero.pipe.x + hero.pipe.w / 2, y: GR,
    });
  }

  // ---- Simulation
  function updateRolling(dt) {
    const s = hero.support;
    if (s) {
      if (hero.x > s.x + s.w + 4) { hero.support = null; hero.state = 'air'; hero.vy = 0; return; }   // rolled off the end
      hero.y = s.top;
    } else {
      const r = rampAt(hero.x);
      if (r) {
        hero.onRamp = r; hero.y = GR - r.h * (hero.x - r.x) / r.w;
      } else if (hero.onRamp) {
        const r0 = hero.onRamp;
        hero.onRamp = null;
        if (r0.kind === 'slope') {               // a slope leads onto a deck rather than launching
          const deck = list().find((o) => kind(o).flat && Math.abs(o.x - (r0.x + r0.w)) < 3);
          if (deck) { hero.support = deck; hero.y = deck.top; return; }
        }
        hero.state = 'air'; hero.vy = -(420 + hero.speed * 1.5);
        G.sfx('ollie');
        return;
      } else {
        hero.y = GR;
      }
    }
    if (hero.ghost && !list().some((o) => kind(o).solid && overlapping(o, 16))) hero.ghost = false;
    const o = hitSide();
    if (o) bail(o, 'Ran smack into it.');
  }

  function updateBail(dt) {
    const bt = (hero.bailT += dt), F = hero.floor;
    hero.speed = Math.max(0, hero.speed - 520 * dt);
    if (hero.pipe) hero.x = G.lerp(hero.x, hero.pipe.x + hero.pipe.w / 2, Math.min(1, dt * 3));   // tumbles down into the pipe
    if (hero.y < F) { hero.vy += GRAVITY * dt; hero.y = Math.min(F, hero.y + hero.vy * dt); }

    // Falls flat like a plank, bounces once, lies there, then springs back up.
    if (bt < 0.32) hero.bailRot = Math.pow(bt / 0.32, 2) * Math.PI / 2;
    else if (bt < 0.5) hero.bailRot = Math.PI / 2 - Math.sin((bt - 0.32) / 0.18 * Math.PI) * 0.14;
    else if (bt < 1.05) hero.bailRot = Math.PI / 2;
    else if (bt < 1.3) hero.bailRot = (Math.PI / 2) * (1 - (bt - 1.05) / 0.25);
    else hero.bailRot = 0;

    const b = looseBoard;                 // the board scoots off, then rolls back under his feet
    if (bt < 1.0) {
      b.vx = Math.max(0, b.vx - 260 * dt);
      b.vy += GRAVITY * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y >= GR) { b.y = GR; b.vy = b.vy > 200 ? -b.vy * 0.3 : 0; b.vr *= 0.5; }
      b.rot = b.y >= GR ? G.lerp(b.rot % (Math.PI * 2), 0, 0.2) : b.rot + b.vr * dt;
    } else {
      if (!b.returning) { b.returning = true; b.x0 = b.x; b.y0 = b.y; }
      const p = Math.min(1, (bt - 1.0) / 0.3);
      b.x = G.lerp(b.x0, hero.x, p);
      b.y = G.lerp(b.y0, F, p) - Math.sin(p * Math.PI) * 26;
      b.rot = (1 - p) * -Math.PI * 2;
    }

    const hat = looseHat;                 // the hat sails out of the picture and drops back on his head
    if (bt < 0.75) {
      hat.vy += 900 * dt; hat.x += hat.vx * dt; hat.y += hat.vy * dt; hat.rot += hat.vr * dt;
      hat.fromX = hat.x; hat.fromY = hat.y;
    } else {
      const p = Math.min(1, (bt - 0.75) / 0.75);
      hat.x = G.lerp(hat.fromX, hero.x + G.HAT_SPOT.x, Math.min(1, p * 1.6));
      hat.y = G.lerp(Math.min(hat.fromY, -30), F + G.HAT_SPOT.y, p * p);
      hat.rot = G.lerp(hat.rot, -0.06, 0.15);
    }

    if (bt >= 1.55) {
      hero.state = 'ground'; hero.y = F; hero.vy = 0; hero.ghost = true;
      hero.support = hero.floorObj;
      hero.hatOn = true; looseHat.active = false; looseBoard.active = false;
      if (hero.pipe) resumePipe();
    }
  }

  function tickText(dt) {
    for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].t += dt) > 0.9) popups.splice(i, 1);
    if (banner && (banner.t += dt) > 1.6) banner = null;
  }

  function update(dt) {
    time += dt;
    const h = hero;
    if (G.chase.nabT() >= 0) {        // collared: the world holds still for the dogpile
      G.chase.update(dt); G.updateParticles(dt); tickText(dt);
      return;
    }
    const target = 250 + Math.min(time, 120) * 0.6 + (G.clock && G.clock.reel === 2 ? 20 : 0);
    if (!h.pipe) {
      if (h.state !== 'bail') h.speed = Math.min(target, h.speed + 260 * dt);
      h.x += h.speed * dt;
    }
    G.updateWorld(h.x - G.viewW * 0.3);
    G.updateScenery(dt, h.x - G.viewW * 0.3, time);

    if ((h.state === 'ground' || h.state === 'manual' || h.state === 'air') && pipeEntry()) {
      // dropped into the half-pipe this frame
    } else if (h.state === 'pipe') {
      updatePipe(dt);
    } else if (h.state === 'ground' || h.state === 'manual') {
      updateRolling(dt);
      if (h.state === 'manual') {
        combo.base += 120 * dt;
        if (!balance(dt)) bail(null, 'Lost his balance.');
      }
    } else if (h.state === 'air') {
      const prevY = h.y;
      h.vy += GRAVITY * dt;
      h.y += h.vy * dt;
      updateTricks(dt);
      const o = h.vy > 0 ? landingTarget(prevY) : null;
      if (o) touchDown(o);
      if (h.state === 'air') {
        const sy = streetY(h.x);
        if (h.y >= sy) touchDown(null, sy);
        else { const hit = hitSide(); if (hit) bail(hit, 'Ran smack into it.'); }
      }
    } else if (h.state === 'grind') {
      const o = h.grind;
      h.y = o.top;
      combo.base += 150 * dt;
      if (o.kind !== 'line' && Math.random() < 0.7) G.emit('spark', h.x + G.rand(-14, 10), o.top, 1, 140);
      if (h.x > o.x + o.w) { h.state = 'air'; h.vy = -60; h.grind = null; }   // ran off the end
    } else {
      updateBail(dt);
    }

    if (h.state !== 'bail') updateHat(dt);

    // Pose: tilt, crouch and arms.
    let crouch = 0.1, arms = 'relaxed', tilt = 0;
    if (h.state === 'ground') {
      crouch = input.down ? 1 : 0.1;
      if (h.onRamp) tilt = -Math.atan2(h.onRamp.h, h.onRamp.w);
    } else if (h.state === 'air') {
      crouch = h.flip ? 0.85 : 0.5;
      arms = h.grab ? 'grab' : 'flail';
      tilt = G.clamp(h.vy / 4000, -0.12, 0.18);
    } else if (h.state === 'grind' || h.state === 'manual') {
      crouch = 0.35; arms = 'out'; tilt = h.state === 'manual' ? h.bal * 0.35 : Math.sin(time * 9) * 0.03;
    } else if (h.state === 'pipe') {
      crouch = h.pumping ? 1 : h.popped ? 0.15 : 0.45; arms = 'relaxed';
    } else {
      arms = h.bailT < 0.4 ? 'flail' : 'relaxed';
    }
    // Every so often on the open street he kicks along with his back foot.
    const pc = time % 2.6;
    h.push = h.state === 'ground' && !input.down && !h.onRamp && !h.support && pc < 0.6 ? pc / 0.6 : -1;
    if (h.state === 'pipe') {
      // Follow the curve; above the lip, turn upright and spin round to come back down facing in.
      if (h.pAir) {
        const p = G.clamp(h.pAirT / h.pAirDur, 0, 1), lipAngle = h.pLip > 0 ? -Math.PI / 2 : Math.PI / 2;
        h.tilt = lipAngle * 0.35 * Math.pow(Math.abs(Math.cos(Math.PI * p)), 1.5);   // a lean at the lips, upright in between
        h.faceScale = h.pLip * Math.cos(Math.PI * p);
        crouch = h.flip ? 0.85 : 0.55; arms = h.grab ? 'grab' : 'flail';
      } else {
        const g = pipeAt(h.pipe, h.ps);
        h.tilt = Math.atan2(g.ty, g.tx);
        h.faceScale = h.pv >= 0 ? 1 : -1;
      }
    } else {
      h.faceScale = 1;
      h.tilt = G.lerp(h.tilt, tilt, Math.min(1, dt * 12));
    }
    h.crouch = G.lerp(h.crouch, crouch, Math.min(1, dt * 14));
    h.arms = arms;

    G.chase.update(dt);
    G.updateParticles(dt);
    tickText(dt);
  }

  // The camera follows him along the street, and eases over to hold the whole half-pipe in view.
  let camPipe = null, camBlend = 0, lastDraw = 0, camY = 0;
  G.camY = 0;
  function draw(t, withHUD) {
    const dt = Math.min(0.05, Math.max(0, t - lastDraw));
    lastDraw = t;
    if (hero.pipe) camPipe = hero.pipe;
    camBlend = G.clamp(camBlend + (hero.pipe ? dt : -dt) * 1.8, 0, 1);
    const follow = hero.x - G.viewW * 0.3;
    const ease = camBlend * camBlend * (3 - 2 * camBlend);
    const camX = camPipe ? G.lerp(follow, camPipe.x + camPipe.w / 2 - G.viewW / 2, ease) : follow;
    const heroSX = hero.x - camX;
    // On the ramp the view tilts up to keep him in the picture at the top of a big air.
    camY = G.lerp(camY, hero.pipe ? G.clamp(150 - hero.y, 0, 170) : 0, Math.min(1, dt * 7));
    G.camY = camY;
    G.ctx.save();
    G.ctx.translate(0, camY);
    G.drawBackground(camX, t);
    G.drawObstacles(camX, t);
    G.drawParticles(camX);
    G.chase.draw(camX, heroSX, t);
    if (looseBoard.active) G.drawLooseBoard(looseBoard.x - camX, looseBoard.y, looseBoard.rot);
    if (hero.state !== 'bail' && hero.state !== 'pipe') {
      const f = hero.state === 'air' ? floorAt(hero.x, hero.y).floor : Math.max(hero.y, floorAt(hero.x, hero.y).floor);
      G.drawShadow(heroSX, f, f - hero.y);
    }
    G.drawHero(hero, heroSX, t);
    if (looseHat.active) G.drawHat(looseHat.x - camX, looseHat.y, looseHat.rot);
    G.chase.drawOver(camX, heroSX, t);
    if (camBlend < 0.3) G.drawForeground(camX);      // keep lamp posts out of the way at the Thrill Ramp
    G.ctx.restore();
    if (withHUD) G.drawHUD(heroSX, camX, t);
    return heroSX;
  }

  // Banner cards for the set pieces. say() won't talk over another card unless forced.
  function say(text, sub, force, isBail) {
    if (banner && !force) return false;
    banner = { text, sub, t: 0, bail: !!isBail };
    return true;
  }
  function award(pts, text, sub) {
    score += pts;
    G.sfx('bank');
    say(text, sub, true);
  }

  G.ui = { hero, combo, popups, get banner() { return banner; }, get score() { return score; }, get time() { return time; } };
  G.play = {
    reset, update, draw, say, award, bail,
    settled: () => hero.state === 'ground',
    bank: bankCombo,
  };
  reset();
})();
