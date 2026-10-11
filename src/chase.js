// Slapstick set pieces: a squad of cops giving chase, and the house front that falls on our hero.
(function () {
  const ctx = G.ctx, GR = G.GROUND, WALK = GR - 16;
  const WOBBLE = 0.6, FALL = 1.0;     // seconds the house teeters, then topples
  const SQUAD = 4;

  const cops = {};
  function reset() {
    Object.assign(cops, { dist: 1, shown: 1, nabT: -1, warned: false, trips: [0, 0, 0, 0], nextTrip: 4 });
  }
  reset();

  // ---- The falling house front (after Steamboat Bill, Jr.)
  function updateFacade(o, dt) {
    const h = G.hero;
    if (!o.phase) { o.phase = 'stand'; o.t = 0; o.ang = 0; }
    if (o.phase === 'stand') {
      const lead = (o.x + o.w / 2 - h.x) / Math.max(h.speed, 1);
      if (h.state !== 'bail' && lead > 0 && lead <= WOBBLE + FALL) {
        o.phase = 'wobble'; o.t = 0;
        G.play.say('LOOK OUT ABOVE!', 'Stand perfectly still...', true);
        G.sfx('creak');
      }
    } else if (o.phase === 'wobble' || o.phase === 'fall') {
      o.t += dt;
      const left = WOBBLE + FALL - o.t;
      // Ease the house along so its open window meets him exactly where he'll be.
      if (h.state !== 'bail') o.x = G.lerp(o.x, h.x + h.speed * Math.max(0, left) - o.w / 2, 0.25);
      if (o.phase === 'wobble') {
        o.ang = Math.sin(o.t * 28) * 0.05 * (o.t / WOBBLE);
        if (o.t >= WOBBLE) o.phase = 'fall';
      } else {
        const p = (o.t - WOBBLE) / FALL;
        o.ang = p * p * Math.PI / 2;
      }
      if (left <= 0) impact(o);
    }
  }

  function impact(o) {
    const h = G.hero;
    o.phase = 'down'; o.ang = Math.PI / 2;
    G.shake = 14;
    G.sfx('crash');
    for (let k = 0; k <= 10; k++) G.emit('dust', o.x - 10 + k * (o.w + 20) / 10, GR + G.rand(-12, 22), 3, 70);
    if (h.state === 'bail') return;
    const inWindow = Math.abs(h.x - (o.x + o.w / 2)) < o.w * 0.14;
    if (inWindow && (h.state === 'ground' || h.state === 'manual')) {
      G.play.award(2500, 'STEAMBOAT SAVE!', 'Not a hair out of place.');
      cops.dist = Math.min(1, cops.dist + 0.25);
    } else {
      o.squash = true;
      G.play.bail(null);
      G.play.say('FLATTENED!', 'He should have stood still.', true, true);
    }
  }

  // Projects the house front as it rotates about its base toward the camera: upright it is a
  // tall wall; flat, it is a slab lying across the street in front of him.
  function drawFacade(o, x) {
    const base = WALK + 2, D = 40, ang = o.ang || 0;
    const topY = base - o.h * Math.cos(ang) + D * Math.sin(ang);
    const widen = 0.22 * Math.max(0, Math.sin(ang));
    const cx = x + o.w / 2, half = o.w / 2;
    const P = (u, v) => [cx + (u * 2 - 1) * half * (1 + widen * v), base + (topY - base) * v];
    const quad = (u0, v0, u1, v1) => {
      const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
    };
    const fillQuad = (u0, v0, u1, v1, color) => { ctx.beginPath(); quad(u0, v0, u1, v1); ctx.fillStyle = color; ctx.fill(); };

    if (ang > 0.15) {        // its shadow sweeping over the street
      ctx.fillStyle = 'rgba(23,19,13,' + (0.35 * Math.sin(ang)) + ')';
      ctx.beginPath(); ctx.ellipse(cx, GR + 10, half * 1.2, 6 + 18 * Math.sin(ang), 0, 0, 7); ctx.fill();
    }

    // Wall with the open upstairs window cut clean through it, plus a gable on top.
    ctx.beginPath();
    quad(0, 0, 1, 0.8);
    quad(0.36, 0.3, 0.64, 0.62);
    ctx.fillStyle = '#b9ae93';
    ctx.fill('evenodd');
    const g0 = P(-0.04, 0.8), g1 = P(1.04, 0.8), g2 = P(0.5, 1);
    ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.closePath();
    ctx.fillStyle = G.DARK; ctx.fill();
    ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2; ctx.stroke();

    ctx.strokeStyle = 'rgba(23,19,13,0.35)'; ctx.lineWidth = 0.8;     // clapboard siding
    for (let v = 0.05; v < 0.8; v += 0.05) {
      if (v > 0.3 && v < 0.62) {
        let a = P(0, v), b = P(0.36, v); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        a = P(0.64, v); b = P(1, v); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      } else {
        const a = P(0, v), b = P(1, v); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
    }
    fillQuad(0.42, 0, 0.58, 0.27, G.SHADOW);                    // door
    fillQuad(0.1, 0.08, 0.3, 0.25, G.SHADOW);                   // downstairs windows
    fillQuad(0.7, 0.08, 0.9, 0.25, G.SHADOW);
    fillQuad(0.09, 0.36, 0.27, 0.58, G.SHADOW);                 // upstairs windows, shutters closed
    fillQuad(0.73, 0.36, 0.91, 0.58, G.SHADOW);
    fillQuad(0.17, 0.36, 0.19, 0.58, G.MID);
    fillQuad(0.81, 0.36, 0.83, 0.58, G.MID);
    ctx.beginPath(); quad(0.36, 0.3, 0.64, 0.62);              // the lucky open window's frame
    ctx.strokeStyle = G.INK; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); quad(0, 0, 1, 0.8);
    ctx.lineWidth = 1.5; ctx.stroke();
  }

  // ---- The cops
  function drawCop(x, t, i, trip) {
    const ph = t * 13 + i * 1.7;
    const bob = Math.abs(Math.sin(ph)) * 3;
    ctx.save();
    ctx.translate(x, GR - bob);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (trip > 0) { ctx.translate(0, -4); ctx.rotate(Math.min(1.45, (0.9 - trip) * 6)); }
    else ctx.rotate(0.12);

    ctx.strokeStyle = G.INK; ctx.lineWidth = 6;
    for (const s of [1, -1]) {
      const sw = Math.sin(ph) * s;
      ctx.beginPath(); ctx.moveTo(0, -32); ctx.lineTo(sw * 9 + 3, -17); ctx.lineTo(sw * 14, -2); ctx.stroke();
    }
    ctx.fillStyle = '#221d16';
    ctx.beginPath(); ctx.moveTo(-11, -24); ctx.lineTo(10, -24); ctx.lineTo(7, -62); ctx.lineTo(-6, -62); ctx.closePath(); ctx.fill();
    ctx.fillStyle = G.LIGHT;
    for (const by of [-56, -48, -40]) { ctx.beginPath(); ctx.arc(3.5, by, 1.2, 0, 7); ctx.fill(); }

    const sx = 2, sy = -58, wave = -1.4 + Math.sin(ph * 0.5 + i) * 0.9;
    const hx = sx + Math.cos(wave) * 15, hy = sy + Math.sin(wave) * 15;
    ctx.strokeStyle = G.INK; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(sx - 2, sy); ctx.lineTo(sx - 10, sy + 8 - Math.sin(ph) * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(wave - 0.7) * 16, hy + Math.sin(wave - 0.7) * 16); ctx.stroke();
    ctx.fillStyle = G.PAPER; ctx.beginPath(); ctx.arc(hx, hy, 2.4, 0, 7); ctx.fill();

    ctx.fillStyle = G.PAPER; ctx.strokeStyle = G.INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(3, -70, 6.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(6.5, -66.5, 5, 1.8, 0.1, 0, 7); ctx.fill();          // walrus moustache
    ctx.fillRect(5.5, -72.5, 1.6, 1.8);
    ctx.beginPath();                                                                  // tall helmet
    ctx.moveTo(-6, -74); ctx.quadraticCurveTo(-6, -92, 2, -92); ctx.quadraticCurveTo(10, -92, 10, -74);
    ctx.closePath(); ctx.fill();
    ctx.fillRect(-8, -75, 20, 2.5);
    ctx.fillStyle = G.LIGHT; ctx.beginPath(); ctx.arc(3, -82, 1.8, 0, 7); ctx.fill();
    ctx.restore();
  }

  // The classic dust-cloud dogpile, with limbs, truncheons and one porkpie hat poking out.
  function drawPile(x, t) {
    const cx = x + 14, cy = GR - 30, k = Math.floor(t * 12);
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(k * 1.7 + i * 3.1) * 0.5;
      ctx.strokeStyle = G.INK; ctx.lineWidth = i % 2 ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 15);
      ctx.lineTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 34);
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + t * 4;
      ctx.fillStyle = i % 2 ? G.LIGHT : G.PAPER;
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 20, cy + Math.sin(a) * 12, 19 + Math.sin(t * 9 + i) * 3, 0, 7);
      ctx.fill(); ctx.stroke();
    }
    G.drawHat(cx - 10 + Math.sin(t * 7) * 8, cy - 40 - Math.abs(Math.sin(t * 9)) * 12, Math.sin(t * 5) * 0.6);
  }

  function update(dt) {
    for (const o of G.world.list) if (o.kind === 'facade') updateFacade(o, dt);
    if (cops.nabT >= 0) {
      cops.nabT += dt;
      if (Math.random() < 0.4) G.emit('dust', G.hero.x + G.rand(-30, 40), GR - G.rand(0, 40), 1, 60);
      return;
    }
    if (G.hero.state !== 'bail') cops.dist = Math.min(1, cops.dist + 0.02 * dt);
    cops.shown = G.lerp(cops.shown, cops.dist, Math.min(1, dt * 1.8));
    if (cops.dist <= 0 && cops.shown < 0.08) { cops.nabT = 0; G.shake = 8; G.sfx('whistle'); }
    if (!cops.warned && cops.dist < 0.5 && G.hero.state !== 'bail') {
      cops.warned = G.play.say('THE LAW IS GAINING!', 'Land some tricks to stay ahead.');
    }
    cops.nextTrip -= dt;
    if (cops.nextTrip <= 0) { cops.trips[(Math.random() * SQUAD) | 0] = 0.9; cops.nextTrip = G.rand(3, 7); }
    for (let i = 0; i < SQUAD; i++) cops.trips[i] = Math.max(0, cops.trips[i] - dt);
  }

  function squashed(o) { return o.kind === 'facade' && o.squash && G.hero.state === 'bail'; }

  // Behind the hero: house fronts, then the squad.
  function draw(camX, heroSX, t) {
    for (const o of G.world.list) if (o.kind === 'facade' && !squashed(o)) drawFacade(o, o.x - camX);
    if (cops.nabT >= 0 || cops.shown > 0.92) return;
    for (let i = SQUAD - 1; i >= 0; i--) {
      const lag = cops.trips[i] > 0 ? (0.9 - cops.trips[i]) * 50 : 0;
      const x = heroSX - 48 - cops.shown * 320 - i * 24 - lag;
      if (x > -30) drawCop(x, t, i, cops.trips[i]);
    }
  }
  // In front of the hero: a house that has flattened him, or the dogpile.
  function drawOver(camX, heroSX, t) {
    for (const o of G.world.list) if (squashed(o)) drawFacade(o, o.x - camX);
    if (cops.nabT >= 0) drawPile(heroSX, t);
  }

  G.chase = {
    reset, update, draw, drawOver,
    onBail() {
      cops.dist = Math.max(0, cops.dist - (G.clock && G.clock.reel === 2 ? 0.36 : 0.3));
      if (cops.dist < 0.5) G.sfx('whistle');
    },
    onBank(total) { cops.dist = Math.min(1, cops.dist + Math.min(0.2, total / 6000)); },
    nabT: () => cops.nabT,
    cops,
  };
})();
