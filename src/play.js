// The rules: skating physics, tricks, grinds, combos, bails, and the intertitle-style score cards.
(function () {
  const ctx = G.ctx, GR = G.GROUND;
  const GRAVITY = 1800;

  const TRICKS = {
    left: { name: 'Kickflip', pts: 100, dur: 0.42, kind: 'flip' },
    right: { name: 'Heelflip', pts: 100, dur: 0.42, kind: 'flip' },
    down: { name: '360 Shove-It', pts: 150, dur: 0.45, kind: 'spin' },
    up: { name: 'Hat Trick', pts: 200, dur: 0.55, kind: 'hat' },
    tap: { name: 'Stone Face Grab', pts: 120, dur: 0.4, kind: 'grab' },
  };
  const GRINDS = { bench: 'Boardslide', rail: '50-50 Grind', ledge: '5-0 Grind', crate: 'Crate Slide', line: 'Clothesline Grind' };
  const BAIL_LINES = ['Not a flicker of expression.', 'He meant to do that.', 'The hat, as ever, survives.',
    'Dignity: temporarily misplaced.', 'A face of perfect calm.', 'The pavement wins this round.'];

  const hero = G.hero = {};
  const looseBoard = { active: false }, looseHat = { active: false };
  const combo = { names: [], base: 0, mult: 0, counts: {} };
  const popups = [];
  const stats = G.stats = { bestCombo: 0, bails: 0 };
  let banner = null, score = 0, time = 0;
  G.getScore = () => score;
  G.combo = combo;

  function reset() {
    Object.assign(hero, {
      x: 0, y: GR, vy: 0, state: 'ground', speed: 120, crouch: 0.1, tilt: 0, lean: 2,
      trick: null, queued: null, grind: null, onRamp: null, charging: false, ghost: false,
      hatOn: true, hatLift: 0, hatSpin: 0, board: { flip: 0, spin: 0, dy: 0 },
      arms: 'relaxed', bailT: 0, bailRot: 0,
    });
    looseBoard.active = looseHat.active = false;
    clearCombo();
    popups.length = 0;
    banner = null; score = 0; time = 0;
    stats.bestCombo = 0; stats.bails = 0;
    G.world.list.length = 0;
    G.world.nextX = 760;
    G.world.wantFacade = false;
    if (G.chase) G.chase.reset();
  }

  // ---- Helpers
  function rampAt(x) {
    for (const o of G.world.list) if (o.kind === 'kicker' && x >= o.x && x <= o.x + o.w) return o;
    return null;
  }
  function surfaceAt(x) {
    const r = rampAt(x);
    return r ? GR - r.h * (x - r.x) / r.w : GR;
  }
  function overlapping(o, pad) { return hero.x + pad > o.x && hero.x - pad < o.x + o.w; }
  function hitSide() {
    if (hero.ghost) return null;
    for (const o of G.world.list) {
      if (o.kind === 'kicker' || o.kind === 'line' || o.kind === 'facade') continue;
      if (overlapping(o, 7) && hero.y > o.top + 5) return o;
    }
    return null;
  }
  function grindTarget(prevY) {
    for (const o of G.world.list) {
      if (o.kind === 'kicker' || o.kind === 'facade') continue;
      if (hero.x >= o.x - 8 && hero.x <= o.x + o.w - 4 && prevY <= o.top + 3 && hero.y >= o.top) return o;
    }
    return null;
  }
  function midTrick() { return hero.trick && hero.trick.t < hero.trick.def.dur - 0.09; }
  function resetPose() {
    hero.board.flip = hero.board.spin = hero.board.dy = 0;
    hero.hatLift = hero.hatSpin = 0;
  }

  // ---- Combos
  function addToCombo(name, pts) {
    const n = (combo.counts[name] = (combo.counts[name] || 0) + 1);
    combo.base += pts * Math.pow(0.5, n - 1);   // repeating a trick in one combo is worth less
    combo.mult += 1;
    combo.names.push(name);
    popups.push({ text: name, t: 0 });
  }
  function clearCombo() { combo.names = []; combo.base = 0; combo.mult = 0; combo.counts = {}; }
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

  // ---- Actions
  function doTrick(key) {
    if (hero.state !== 'air') return;
    if (hero.trick) { hero.queued = key; return; }
    const def = TRICKS[key];
    hero.trick = { def, t: 0 };
    addToCombo(def.name, def.pts);
    if (def.kind === 'hat') G.sfx('whistleUp');
  }

  function ollie(dir) {
    if (hero.state === 'air') return doTrick(dir || 'tap');
    if (hero.state !== 'ground' && hero.state !== 'grind') return;
    const held = G.clamp((performance.now() - G.input.t) / 1000, 0, 0.3);
    hero.vy = -(600 + (held / 0.3) * 200) - (hero.onRamp ? 250 : 0);
    hero.state = 'air';
    hero.grind = null; hero.onRamp = null; hero.charging = false;
    G.emit('dust', hero.x - 8, hero.y, 3, 30);
    G.sfx('ollie');
    if (dir) doTrick(dir);
  }

  function startGrind(o) {
    if (midTrick()) { hero.y = o.top; return bail(o); }
    hero.trick = null; hero.queued = null; resetPose();
    hero.state = 'grind'; hero.grind = o; hero.y = o.top; hero.vy = 0;
    addToCombo(GRINDS[o.kind], 100);
    G.sfx('grind');
  }

  function land(sy) {
    hero.y = sy;
    if (midTrick()) return bail(null);
    hero.trick = null; hero.queued = null; resetPose();
    hero.state = 'ground'; hero.vy = 0; hero.crouch = 0.95;
    G.emit('dust', hero.x - 6, sy, 6, 60);
    G.sfx('land');
    bankCombo();
  }

  function bail(o) {
    if (hero.state === 'bail') return;
    hero.state = 'bail';
    hero.bailT = 0; hero.bailRot = 0;
    hero.trick = null; hero.queued = null; hero.grind = null; hero.onRamp = null; hero.charging = false;
    hero.vy = Math.max(hero.vy, -100);
    resetPose();
    clearCombo();
    banner = { text: 'BAILED!', sub: BAIL_LINES[(Math.random() * BAIL_LINES.length) | 0], t: 0, bail: true };

    hero.hatOn = false;
    Object.assign(looseHat, { active: true, x: hero.x + 5, y: hero.y - 72, vx: hero.speed * 0.4 + 30, vy: -650, rot: 0, vr: 9 });
    Object.assign(looseBoard, { active: true, returning: false, x: hero.x, y: hero.y, vx: hero.speed * 1.1 + 60, vy: -220, rot: 0, vr: 14 });
    G.shake = 7;
    stats.bails++;
    G.sfx('bail');
    if (G.chase) G.chase.onBail();
    if (o && o.kind === 'crate') G.emit('chip', hero.x + 12, o.top + 8, 9, 140);
    G.emit('dust', hero.x + 30, GR, 8, 80);
  }

  G.handlers.press = () => {
    if (hero.state === 'ground' || hero.state === 'grind') hero.charging = true;
  };
  G.handlers.release = () => { hero.charging = false; ollie(null); };
  G.handlers.swipe = (dir) => { hero.charging = false; ollie(dir); };

  // ---- Simulation
  function updateTrick(dt) {
    const tk = hero.trick;
    if (!tk) return;
    tk.t += dt;
    const p = Math.min(1, tk.t / tk.def.dur), kind = tk.def.kind;
    hero.board.flip = kind === 'flip' ? p * Math.PI * 2 : 0;
    hero.board.spin = kind === 'spin' ? p * Math.PI * 2 : 0;
    hero.board.dy = kind === 'flip' || kind === 'spin' ? Math.sin(p * Math.PI) * 7 : 0;
    hero.hatLift = kind === 'hat' ? Math.sin(p * Math.PI) * 44 : 0;
    hero.hatSpin = kind === 'hat' ? p * Math.PI * 4 : 0;
    if (p >= 1) {
      hero.trick = null;
      resetPose();
      if (hero.queued) { const q = hero.queued; hero.queued = null; doTrick(q); }
    }
  }

  function updateBail(dt) {
    const bt = (hero.bailT += dt);
    hero.speed = Math.max(0, hero.speed - 520 * dt);
    if (hero.y < GR) { hero.vy += GRAVITY * dt; hero.y = Math.min(GR, hero.y + hero.vy * dt); }

    // Falls flat like a plank, bounces once, lies there, then springs back up.
    if (bt < 0.32) hero.bailRot = Math.pow(bt / 0.32, 2) * Math.PI / 2;
    else if (bt < 0.5) hero.bailRot = Math.PI / 2 - Math.sin((bt - 0.32) / 0.18 * Math.PI) * 0.14;
    else if (bt < 1.05) hero.bailRot = Math.PI / 2;
    else if (bt < 1.3) hero.bailRot = (Math.PI / 2) * (1 - (bt - 1.05) / 0.25);
    else hero.bailRot = 0;

    // The board scoots off, then rolls back and flips itself under his feet.
    const b = looseBoard;
    if (bt < 1.0) {
      b.vx = Math.max(0, b.vx - 260 * dt);
      b.vy += GRAVITY * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y >= GR) { b.y = GR; b.vy = b.vy > 200 ? -b.vy * 0.3 : 0; b.vr *= 0.5; }
      b.rot = b.y >= GR ? G.lerp(b.rot % (Math.PI * 2), 0, 0.2) : b.rot + b.vr * dt;
    } else {
      if (!b.returning) { b.returning = true; b.x0 = b.x; }
      const p = Math.min(1, (bt - 1.0) / 0.3);
      b.x = G.lerp(b.x0, hero.x, p);
      b.y = GR - Math.sin(p * Math.PI) * 26;
      b.rot = (1 - p) * -Math.PI * 2;
    }

    // The hat sails up out of the picture and drops neatly back onto his head.
    const hat = looseHat;
    if (bt < 0.75) {
      hat.vy += 900 * dt; hat.x += hat.vx * dt; hat.y += hat.vy * dt; hat.rot += hat.vr * dt;
      hat.fromX = hat.x; hat.fromY = hat.y;
    } else {
      const p = Math.min(1, (bt - 0.75) / 0.75);
      hat.x = G.lerp(hat.fromX, hero.x + G.HAT_SPOT.x, Math.min(1, p * 1.6));
      hat.y = G.lerp(Math.min(hat.fromY, -30), GR + G.HAT_SPOT.y, p * p);
      hat.rot = G.lerp(hat.rot, -0.06, 0.15);
    }

    if (bt >= 1.55) {
      hero.state = 'ground'; hero.y = GR; hero.vy = 0; hero.ghost = true;
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
    const target = 250 + Math.min(time, 120) * 0.6;
    if (h.state !== 'bail') h.speed = Math.min(target, h.speed + 260 * dt);
    h.x += h.speed * dt;
    G.updateWorld(h.x - G.viewW * 0.3);

    if (h.state === 'ground') {
      const r = rampAt(h.x);
      if (r) {
        h.onRamp = r; h.y = GR - r.h * (h.x - r.x) / r.w; h.tilt = -Math.atan2(r.h, r.w);
      } else if (h.onRamp) {
        h.state = 'air'; h.vy = -(380 + h.speed * 1.6); h.onRamp = null;
        G.sfx('ollie');
      } else {
        h.y = GR; h.tilt = G.lerp(h.tilt, 0, 0.3);
      }
      if (h.ghost && !G.world.list.some((o) => overlapping(o, 16))) h.ghost = false;
      if (h.state === 'ground') { const o = hitSide(); if (o) bail(o); }
    } else if (h.state === 'air') {
      const prevY = h.y;
      h.vy += GRAVITY * dt;
      h.y += h.vy * dt;
      h.tilt = G.lerp(h.tilt, G.clamp(h.vy / 4000, -0.12, 0.18), 0.15);
      updateTrick(dt);
      if (h.vy > 0) { const o = grindTarget(prevY); if (o) startGrind(o); }
      if (h.state === 'air') {
        const sy = surfaceAt(h.x);
        if (h.y >= sy) land(sy);
        else { const o = hitSide(); if (o) bail(o); }
      }
    } else if (h.state === 'grind') {
      const o = h.grind;
      h.y = o.top;
      h.tilt = Math.sin(time * 11) * 0.05;
      combo.base += 90 * dt;
      if (o.kind !== 'line' && Math.random() < 0.7) G.emit('spark', h.x + G.rand(-14, 10), o.top, 1, 140);
      if (h.x > o.x + o.w) { h.state = 'air'; h.vy = -160; h.grind = null; }
    } else {
      updateBail(dt);
    }

    // Pose: how low he crouches and what his arms are doing.
    let crouch = 0.1, arms = 'relaxed';
    if (h.state === 'ground') crouch = h.charging ? 1 : 0.1;
    else if (h.state === 'air') {
      crouch = h.trick ? 0.85 : 0.5;
      arms = h.trick && h.trick.def.kind === 'grab' ? 'grab' : 'flail';
    } else if (h.state === 'grind') { crouch = 0.35; arms = 'out'; }
    else { crouch = 0.1; arms = h.bailT < 0.4 ? 'flail' : 'relaxed'; }
    h.crouch = G.lerp(h.crouch, crouch, Math.min(1, dt * 14));
    h.arms = arms;

    G.chase.update(dt);
    G.updateParticles(dt);
    tickText(dt);
  }

  // ---- Drawing
  function plate(x, y, w, h) {
    ctx.fillStyle = 'rgba(23,19,13,0.88)';
    G.roundRect(x, y, w, h, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(239,230,208,0.8)'; ctx.lineWidth = 1;
    G.roundRect(x + 3, y + 3, w - 6, h - 6, 2); ctx.stroke();
  }
  function outlined(text, x, y) {
    ctx.lineWidth = 4; ctx.strokeStyle = G.INK; ctx.strokeText(text, x, y);
    ctx.fillStyle = G.PAPER; ctx.fillText(text, x, y);
  }

  function drawHUD(heroSX) {
    const W = G.viewW;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    plate(12, 12, 132, 44);
    ctx.fillStyle = G.PAPER; ctx.textAlign = 'left';
    ctx.font = '10px ' + G.BODY_FONT; ctx.fillText('SCORE', 22, 28);
    ctx.font = G.NUM_FONT.replace('{s}', 20); ctx.fillText(G.fmt(score), 22, 49);

    if (combo.mult) {
      let names = combo.names.slice(-3).join(' + ');
      if (combo.names.length > 3) names = '... + ' + names;
      ctx.font = '12px ' + G.BODY_FONT;
      const w = Math.min(W - 180, Math.max(ctx.measureText(names).width, 90) + 28);
      const cx = Math.max(W / 2, 156 + w / 2);
      plate(cx - w / 2, 12, w, 48);
      ctx.textAlign = 'center'; ctx.fillStyle = G.PAPER;
      ctx.fillText(names, cx, 30, w - 16);
      ctx.font = G.NUM_FONT.replace('{s}', 17);
      ctx.fillText(G.fmt(combo.base) + '  x  ' + combo.mult, cx, 51);
    }

    ctx.textAlign = 'center';
    ctx.font = '14px ' + G.BODY_FONT;
    popups.forEach((p, i) => {
      ctx.globalAlpha = 1 - p.t / 0.9;
      outlined(p.text, heroSX + 10, GR - 100 - p.t * 40 - (popups.length - 1 - i) * 16 + (hero.y - GR) * 0.6);
    });
    ctx.globalAlpha = 1;

    if (banner) {
      const a = banner.t < 1.2 ? 1 : 1 - (banner.t - 1.2) / 0.4;
      const s = 1 + Math.max(0, 0.2 - banner.t) * 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(W / 2, 112);
      ctx.scale(s, s);
      if (banner.bail) ctx.rotate(-0.06);
      ctx.font = banner.bail ? '34px ' + G.TITLE_FONT : G.NUM_FONT.replace('{s}', 32);
      ctx.lineWidth = 6; ctx.strokeStyle = G.INK; ctx.strokeText(banner.text, 0, 0);
      ctx.fillStyle = G.PAPER; ctx.fillText(banner.text, 0, 0);
      ctx.font = '14px ' + G.BODY_FONT;
      outlined(banner.sub, 0, 22);
      ctx.restore();
    }

    if (G.clock) {
      const left = Math.max(0, Math.ceil(G.clock.left));
      plate(W - 112, 12, 100, 44);
      ctx.textAlign = 'center'; ctx.fillStyle = G.PAPER;
      ctx.font = '10px ' + G.BODY_FONT;
      ctx.fillText('REEL ' + (G.clock.reel === 1 ? 'ONE' : 'TWO'), W - 62, 28);
      ctx.font = G.NUM_FONT.replace('{s}', 20);
      if (left <= 5 && left > 0) ctx.fillStyle = (Math.floor(time * 4) % 2) ? G.PAPER : G.MID;
      ctx.fillText(Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), W - 62, 49);
    }

    if (time < 10) {
      ctx.globalAlpha = time < 8 ? 1 : 1 - (time - 8) / 2;
      const w = Math.min(W - 40, 430);
      plate(W / 2 - w / 2, G.VIEW_H - 50, w, 42);
      ctx.fillStyle = G.PAPER; ctx.font = '12px ' + G.BODY_FONT;
      ctx.fillText('TAP to ollie (hold for a bigger leap)', W / 2, G.VIEW_H - 32, w - 20);
      ctx.fillText('SWIPE for tricks  ·  LAND on rails & benches to grind', W / 2, G.VIEW_H - 16, w - 20);
      ctx.globalAlpha = 1;
    }
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
    if (withHUD) drawHUD(heroSX);
    return heroSX;
  }

  // Safe to end a reel: not mid-air, mid-grind or mid-fall.
  function settled() { return hero.state === 'ground'; }

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

  G.play = { reset, update, draw, settled, bank: bankCombo, say, award, bail };
  reset();
})();
