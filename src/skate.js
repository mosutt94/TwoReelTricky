// Skating rules. Hold to crouch, let go to ollie. Keep holding as you come down on a rail or
// ledge to grind it, and let go to pop off. Swipe in the air to flip (swipe the same way again
// for a double or triple), swipe up for the Hat Trick, or swipe up and hold to grab. Land while
// holding to manual. Grinds and manuals need balance: slide the finger to keep the needle up.
(function () {
  const GR = G.GROUND, GRAVITY = 1800;
  const input = G.input;

  const FLIPS = {
    left: { names: ['Kickflip', 'Double Kickflip', 'Triple Kickflip'], pts: [100, 250, 500], kind: 'flip', sign: 1 },
    right: { names: ['Heelflip', 'Double Heelflip', 'Triple Heelflip'], pts: [100, 250, 500], kind: 'flip', sign: -1 },
    down: { names: ['Pop Shove-It', '360 Shove-It', '540 Shove-It'], pts: [120, 300, 600], kind: 'spin', sign: 1 },
  };
  const FIRST_SPIN = 0.34, EXTRA_SPIN = 0.26;
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
      flip: null, queued: null, hat: null, grab: null, upPending: -1,
      bal: 0, balV: 0, balT: 0,
      hatOn: true, hatLift: 0, hatSpin: 0, board: { flip: 0, spin: 0, dy: 0 },
      arms: 'relaxed', bailT: 0, bailRot: 0, floor: GR, floorObj: null,
    });
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
    for (const o of list()) if (o.kind === 'kicker' && x >= o.x && x <= o.x + o.w) return o;
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
    hero.flip = null; hero.queued = null; hero.hat = null; hero.grab = null; hero.upPending = -1;
    hero.hatLift = hero.hatSpin = 0;
    resetBoard();
  }
  function startFlip(dir) {
    const def = FLIPS[dir], f = hero.flip;
    if (f && f.dir === dir && f.spins < 3) {           // same flick again: one more rotation
      f.spins++;
      f.dur += EXTRA_SPIN;
      upgradeCombo(f.idx, def.names[f.spins - 1], def.pts[f.spins - 1]);
      return;
    }
    if (f) { hero.queued = dir; return; }
    hero.flip = { dir, kind: def.kind, sign: def.sign, spins: 1, t: 0, dur: FIRST_SPIN, idx: addToCombo(def.names[0], def.pts[0]) };
  }
  function startHat() {
    if (hero.hat) return;
    hero.hat = { t: 0, dur: 0.55 };
    addToCombo('Hat Trick', 200);
    G.sfx('whistleUp');
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
    if (hero.hat) {
      const h = hero.hat;
      h.t += dt;
      const p = Math.min(1, h.t / h.dur);
      hero.hatLift = Math.sin(p * Math.PI) * 50;
      hero.hatSpin = p * Math.PI * 4;
      if (p >= 1) { hero.hat = null; hero.hatLift = hero.hatSpin = 0; }
    }
    // A flick up becomes a Hat Trick if the finger lifts, or a grab if it stays down.
    if (hero.upPending >= 0 && (hero.upPending += dt) > 0.16) {
      hero.upPending = -1;
      if (input.down) startGrab(); else startHat();
    }
    if (hero.grab) {
      hero.grab.t += dt;
      combo.base += 260 * dt;
      if (!input.down) hero.grab = null;
    }
  }
  // Why a landing right now would go wrong, if it would.
  function unsafe() {
    if (hero.flip && hero.flip.t < hero.flip.dur - 0.07) return 'Landed mid-flip.';
    if (hero.hat && hero.hat.t < hero.hat.dur - 0.1) return 'The hat was still up there.';
    return null;
  }

  // ---- Moves
  function pop() {
    let v;
    if (hero.state === 'ground') {
      const held = G.clamp((performance.now() - input.t) / 1000, 0, 0.35);
      v = 560 + (held / 0.35) * 260 + (hero.onRamp ? 250 : 0);
    } else {
      v = 620;                                   // popping off a rail or out of a manual
    }
    hero.vy = -v;
    hero.state = 'air';
    hero.grind = null; hero.support = null; hero.onRamp = null;
    G.emit('dust', hero.x - 8, hero.y, 3, 30);
    G.sfx('ollie');
  }
  function startBalance() {
    hero.bal = G.rand(-0.1, 0.1);
    hero.balV = (Math.random() < 0.5 ? -1 : 1) * 0.25;
    hero.balT = 0;
    input.anchor = input.cx;
  }
  // Grinds and manuals tip over unless the finger leans the other way; longer is harder.
  function balance(dt) {
    hero.balT += dt;
    const ctrl = G.balanceInput();
    const tip = hero.bal * (1.2 + hero.balT * 0.5);
    const wobble = Math.sin(time * 3.1 + hero.x * 0.013) * 0.25 * (0.5 + hero.balT * 0.15);
    hero.balV += (tip + wobble - ctrl * 3.2) * dt;
    hero.balV *= Math.pow(0.6, dt);
    hero.bal += hero.balV * dt;
    return Math.abs(hero.bal) < 1;
  }
  function startGrind(o) {
    clearAir();
    hero.state = 'grind'; hero.grind = o; hero.support = null;
    hero.y = o.top; hero.vy = 0;
    startBalance();
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
      return bad ? bail(o, bad) : startGrind(o);
    }
    if (o && !k.flat) {
      if (o.kind === 'line') return;               // a rope: without holding on, he drops right through
      hero.y = o.top;
      return bail(o, 'Should have held on to grind it.', 'RACKED!');
    }
    hero.y = o ? o.top : sy;
    const bad = unsafe() || (hero.grab ? 'Let go of the grab too late.' : null);
    if (bad) return bail(o, bad);
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

  G.handlers.press = () => {};
  G.handlers.release = () => {
    if (hero.state === 'ground' || hero.state === 'manual' || hero.state === 'grind') pop();
    else if (hero.state === 'air' && hero.upPending >= 0) { hero.upPending = -1; startHat(); }
  };
  G.handlers.swipe = (dir) => {
    if (hero.state === 'ground') { pop(); hero.vy -= 60; }      // flick from the ground: ollie straight into the trick
    if (hero.state !== 'air') return;                         // on rails and manuals, sliding is for balance
    if (dir === 'up') { if (!hero.hat && !hero.grab && hero.upPending < 0) hero.upPending = 0; }
    else startFlip(dir);
  };

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
        hero.onRamp = null; hero.state = 'air'; hero.vy = -(420 + hero.speed * 1.5);
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
    if (h.state !== 'bail') h.speed = Math.min(target, h.speed + 260 * dt);
    h.x += h.speed * dt;
    G.updateWorld(h.x - G.viewW * 0.3);

    if (h.state === 'ground' || h.state === 'manual') {
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
      if (!balance(dt)) bail(o, 'Lost his balance.');
      else if (h.x > o.x + o.w) { h.state = 'air'; h.vy = -60; h.grind = null; }   // ran off the end
    } else {
      updateBail(dt);
    }

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
      crouch = 0.35; arms = 'out'; tilt = h.bal * 0.35;
    } else {
      arms = h.bailT < 0.4 ? 'flail' : 'relaxed';
    }
    // Every so often on the open street he kicks along with his back foot.
    const pc = time % 2.6;
    h.push = h.state === 'ground' && !input.down && !h.onRamp && !h.support && pc < 0.6 ? pc / 0.6 : -1;
    h.tilt = G.lerp(h.tilt, tilt, Math.min(1, dt * 12));
    h.crouch = G.lerp(h.crouch, crouch, Math.min(1, dt * 14));
    h.arms = arms;

    G.chase.update(dt);
    G.updateParticles(dt);
    tickText(dt);
  }

  function draw(t, withHUD) {
    const heroSX = G.viewW * 0.3;
    const camX = hero.x - heroSX;
    G.drawBackground(camX);
    G.drawObstacles(camX, t);
    G.drawParticles(camX);
    G.chase.draw(camX, heroSX, t);
    if (looseBoard.active) G.drawLooseBoard(looseBoard.x - camX, looseBoard.y, looseBoard.rot);
    G.drawHero(hero, heroSX, t);
    if (looseHat.active) G.drawHat(looseHat.x - camX, looseHat.y, looseHat.rot);
    G.chase.drawOver(camX, heroSX, t);
    G.drawForeground(camX);
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
