// The things to skate on and over: rails, benches, ledges, crates, curbs, a loading dock, a
// parked streetcar, kicker ramps, the Thrill Ramp half-pipe and the falling house front.
(function () {
  const ctx = G.ctx, GR = G.GROUND, WALK = GR - 16;

  // ---- Obstacles. Each stands on a base (the street, or the top of something else) and has a top.
  // grind: he can lock onto its top edge; flat: he can ride on top of it; solid: running into
  // its side is a bail.
  G.KINDS = {
    rail: { grind: true, solid: true },
    line: { grind: true },
    bench: { grind: true, flat: true, solid: true },
    ledge: { grind: true, flat: true, solid: true },
    crate: { grind: true, flat: true, solid: true },
    pad: { grind: true, flat: true, solid: true },
    dock: { grind: true, flat: true, solid: true },
    trolley: { grind: true, flat: true, solid: true },
    kicker: { ramp: true },
    slope: { ramp: true },        // a long plank up to a deck; it doesn't launch him
    pipe: {},                     // the half-pipe has its own rules in skate.js
    facade: {},
  };

  const world = G.world = { list: [], nextX: 700, wantFacade: false, wantPipe: false, hints: 0 };
  world.reset = function () {
    world.list.length = 0; world.nextX = 700; world.wantFacade = false; world.wantPipe = false; world.hints = 0;
  };
  function add(kind, x, w, h, variant, base) {
    base = base === undefined ? GR : base;
    const o = { kind, x, w, h, base, top: base - h, variant };
    // Label the first few rails and clotheslines so a new player knows to hold on.
    if ((kind === 'rail' || kind === 'line') && world.hints < 4) { o.hint = true; world.hints++; }
    world.list.push(o);
    return x + w;
  }

  // Lines of obstacles spaced so that a pop off one lands on the next. Each returns where it ends.
  const SECTIONS = [
    (x) => { let e = add('bench', x, 110, 26); e = add('bench', e + 95, 110, 26); return add('bench', e + 95, 110, 26); },
    (x) => add('rail', add('rail', x, 190, 40) + 115, 210, 40),
    (x) => add('rail', add('ledge', x, 170, 30) + 105, 200, 48),
    (x) => { let e = add('kicker', x, 64, 30); e = add('line', e + 50, 250, 104); return add('rail', e + 120, 220, 44); },
    (x) => {                                   // loading dock with a crate and a rail on top, then a bench
      const deck = GR - 44, e = add('dock', x, 400, 44);
      add('crate', x + 110, 30, 30, 'crate', deck);
      add('rail', x + 230, 130, 28, null, deck);
      return add('bench', e + 110, 110, 26);
    },
    (x) => { let e = add('pad', x, 160, 14); e = add('pad', e + 120, 160, 14); return add('pad', e + 120, 160, 14); },
    (x) => add('trolley', add('kicker', x, 64, 30) + 90, 380, 86),
    (x) => add('kicker', x, 70, 34) + 240,     // big air with room to land: try a double or triple
    (x) => { let e = add('crate', x, 30, 30, 'barrel'); e = add('ledge', e + 110, 150, 30); return add('crate', e + 110, 30, 30, 'crate'); },
    (x) => add('bench', add('pad', x, 180, 14) + 100, 110, 26),
  ];
  let lastSection = -1;

  // The Thrill Ramp: a plank slope up to a deck, the half-pipe itself, and a deck on the far side.
  const PIPE_R = 110, PIPE_FLAT = 170;
  function addPipe(x) {
    add('slope', x, 180, PIPE_R);
    add('dock', x + 180, 90, PIPE_R, 'deck');
    const px = x + 270, w = 2 * PIPE_R + PIPE_FLAT;
    world.list.push({ kind: 'pipe', x: px, w, h: PIPE_R, base: GR, top: GR - PIPE_R, R: PIPE_R, F: PIPE_FLAT });
    return add('dock', px + w, 330, PIPE_R, 'deck') + 80;
  }

  G.updateWorld = function (camX) {
    while (world.nextX < camX + G.viewW + 500) {
      let end;
      if (world.wantPipe) {
        world.wantPipe = false;
        end = addPipe(world.nextX + 80);
      } else if (world.wantFacade) {           // a falling house gets the street to itself
        world.wantFacade = false;
        end = add('facade', world.nextX + 260, 170, 200) + 380;
      } else {
        let i;
        do { i = (Math.random() * SECTIONS.length) | 0; } while (i === lastSection);
        lastSection = i;
        end = SECTIONS[i](world.nextX);
      }
      world.nextX = end + (G.clock && G.clock.reel === 2 ? G.rand(200, 320) : G.rand(240, 380));
    }
    while (world.list.length && world.list[0].x + world.list[0].w < camX - 300) world.list.shift();
  };

  function drawObstacle(o, x, t) {
    const top = o.top, w = o.w, base = o.base;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.kind === 'bench') {
      ctx.fillStyle = G.DARK;
      ctx.fillRect(x + 4, top - 18, w - 8, 4); ctx.fillRect(x + 4, top - 11, w - 8, 4);
      ctx.strokeStyle = G.INK; ctx.lineWidth = 3;
      for (const lx of [x + 10, x + w - 10]) {
        ctx.beginPath(); ctx.moveTo(lx, top - 20); ctx.lineTo(lx, base);
        ctx.moveTo(lx - 6, base); ctx.quadraticCurveTo(lx, top + 8, lx + 6, base); ctx.stroke();
      }
      ctx.fillStyle = '#7d705a'; ctx.fillRect(x, top, w, 5);
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, 5);
    } else if (o.kind === 'rail') {
      ctx.strokeStyle = G.INK; ctx.lineWidth = 3;
      const n = Math.max(1, Math.round((w - 12) / 60));
      for (let k = 0; k <= n; k++) {
        const px = x + 6 + (w - 12) * k / n;
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, base); ctx.stroke();
      }
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, top + o.h * 0.45); ctx.lineTo(x + w, top + o.h * 0.45); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + w, top); ctx.stroke();
      ctx.strokeStyle = G.MID; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, top - 1); ctx.lineTo(x + w - 2, top - 1); ctx.stroke();
    } else if (o.kind === 'ledge') {
      ctx.fillStyle = '#8b7c62'; ctx.fillRect(x, top + 4, w, o.h - 4);
      ctx.strokeStyle = 'rgba(23,19,13,0.45)'; ctx.lineWidth = 1;
      for (let r = 0; r * 9 + 4 < o.h; r++) {
        const y = top + 4 + r * 9;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
        for (let bx = x + (r % 2 ? 9 : 0); bx < x + w; bx += 18) { ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, Math.min(y + 9, base)); ctx.stroke(); }
      }
      ctx.fillStyle = G.LIGHT; ctx.fillRect(x - 3, top, w + 6, 5);
      ctx.strokeStyle = G.INK; ctx.strokeRect(x - 3, top, w + 6, 5);
    } else if (o.kind === 'crate') {
      if (o.variant === 'barrel') {
        ctx.fillStyle = '#7d705a'; G.roundRect(x, top, w, o.h, 7); ctx.fill();
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.lineWidth = 2;
        for (const yy of [top + 7, top + o.h - 7]) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#9a8a6a'; ctx.fillRect(x, top, w, o.h);
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1.5; ctx.strokeRect(x, top, w, o.h);
        ctx.beginPath(); ctx.moveTo(x + 3, top + 3); ctx.lineTo(x + w - 3, top + o.h - 3);
        ctx.moveTo(x + w - 3, top + 3); ctx.lineTo(x + 3, top + o.h - 3); ctx.stroke();
      }
    } else if (o.kind === 'pad') {             // stone curb, for manuals
      ctx.fillStyle = '#b5ab92'; ctx.fillRect(x, top, w, o.h);
      ctx.fillStyle = G.LIGHT; ctx.fillRect(x, top, w, 3);
      ctx.strokeStyle = 'rgba(23,19,13,0.4)'; ctx.lineWidth = 1;
      for (let jx = x + 40; jx < x + w; jx += 40) { ctx.beginPath(); ctx.moveTo(jx, top + 3); ctx.lineTo(jx, base); ctx.stroke(); }
      ctx.strokeStyle = G.INK; ctx.strokeRect(x, top, w, o.h);
    } else if (o.kind === 'dock') {            // wooden loading dock
      ctx.fillStyle = '#7f725b'; ctx.fillRect(x, top + 5, w, o.h - 5);
      ctx.strokeStyle = 'rgba(23,19,13,0.45)'; ctx.lineWidth = 1;
      for (let bx = x + 14; bx < x + w; bx += 14) { ctx.beginPath(); ctx.moveTo(bx, top + 5); ctx.lineTo(bx, base); ctx.stroke(); }
      ctx.fillStyle = G.INK;
      ctx.fillRect(x + 6, top + 6, 6, o.h - 6); ctx.fillRect(x + w - 12, top + 6, 6, o.h - 6);
      if (o.variant !== 'deck') {
        ctx.fillRect(x + w / 2 - 44, top + 13, 88, 16);
        ctx.fillStyle = G.PAPER; ctx.font = '11px ' + G.BODY_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('FREIGHT', x + w / 2, top + 21.5);
        ctx.textBaseline = 'alphabetic';
      }
      ctx.fillStyle = G.DARK; ctx.fillRect(x - 4, top, w + 8, 6);
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2; ctx.strokeRect(x - 4, top, w + 8, 6);
    } else if (o.kind === 'trolley') {         // a parked streetcar, roof and all
      const bodyTop = top + 6, bodyBot = base - 16;
      ctx.strokeStyle = G.INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + w * 0.35, top); ctx.lineTo(x + w * 0.55, 60); ctx.stroke();
      ctx.fillStyle = '#9b9077'; G.roundRect(x, bodyTop, w, bodyBot - bodyTop, 6); ctx.fill();
      ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = G.SHADOW; G.roundRect(x + 6, top, w - 12, 8, 4); ctx.fill();
      for (let wx = x + 18; wx < x + w - 30; wx += 34) {
        ctx.fillStyle = G.SHADOW; ctx.fillRect(wx, bodyTop + 10, 24, 24);
        ctx.fillStyle = 'rgba(239,230,208,0.25)'; ctx.fillRect(wx + 3, bodyTop + 12, 6, 20);
      }
      ctx.fillStyle = G.INK; ctx.fillRect(x, bodyTop + 40, w, 3);
      ctx.fillStyle = G.PAPER; ctx.font = '10px ' + G.BODY_FONT; ctx.textAlign = 'center';
      ctx.fillText('MAIN ST.  ·  CITY LINE', x + w / 2, bodyTop + 55);
      ctx.fillStyle = G.INK; ctx.fillRect(x + 10, base - 18, w - 20, 4);
      for (const wx of [x + 50, x + 90, x + w - 90, x + w - 50]) { ctx.beginPath(); ctx.arc(wx, base - 8, 8, 0, 7); ctx.fill(); }
    } else if (o.kind === 'slope') {           // plank ramp on timber legs
      ctx.fillStyle = '#8f8166';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w, top); ctx.lineTo(x + w, base); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(23,19,13,0.5)'; ctx.lineWidth = 2;
      for (let px = x + 30; px < x + w; px += 30) {
        ctx.beginPath(); ctx.moveTo(px, base); ctx.lineTo(px, base - o.h * (px - x) / w + 3); ctx.stroke();
      }
      ctx.strokeStyle = G.INK; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w, top); ctx.stroke();
      ctx.strokeStyle = '#a89878'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 2, base - 1.5); ctx.lineTo(x + w, top - 1); ctx.stroke();
    } else if (o.kind === 'pipe') {            // the Thrill Ramp: a wooden half-pipe on a timber trestle
      const R = o.R, F = o.F, x2 = x + 2 * R + F;
      const surface = () => {
        ctx.beginPath(); ctx.moveTo(x, top);
        ctx.arc(x + R, top, R, Math.PI, Math.PI / 2, true);
        ctx.lineTo(x + R + F, base);
        ctx.arc(x + R + F, top, R, Math.PI / 2, 0, true);
      };
      // Bunting, poles and the sign overhead.
      ctx.strokeStyle = G.SHADOW; ctx.lineWidth = 3;
      for (const px of [x - 40, x2 + 40]) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, 30); ctx.stroke(); }
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 40, 34); ctx.quadraticCurveTo((x + x2) / 2, 70, x2 + 40, 34); ctx.stroke();
      for (let k = 1; k < 14; k++) {
        const u = k / 14, bx = G.lerp(x - 40, x2 + 40, u), by = 34 + 4 * 36 * u * (1 - u) * 0.5 + Math.sin(t * 4 + k) * 0.6;
        ctx.fillStyle = k % 2 ? G.PAPER : G.DARK;
        ctx.beginPath(); ctx.moveTo(bx - 5, by); ctx.lineTo(bx + 5, by); ctx.lineTo(bx, by + 10); ctx.closePath(); ctx.fill();
      }
      const sx = (x + x2) / 2;
      ctx.fillStyle = G.INK; ctx.fillRect(sx - 62, 58, 124, 24);
      ctx.strokeStyle = G.PAPER; ctx.lineWidth = 1; ctx.strokeRect(sx - 58, 61, 116, 18);
      ctx.fillStyle = G.PAPER; ctx.font = '14px ' + G.TITLE_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('THRILL RAMP', sx, 70.5);
      ctx.textBaseline = 'alphabetic';
      // Timber under the curve.
      surface(); ctx.lineTo(x2, base); ctx.lineTo(x, base); ctx.closePath();
      ctx.fillStyle = '#8f8166'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = 'rgba(23,19,13,0.35)'; ctx.lineWidth = 1;
      for (let px = x + 12; px < x2; px += 12) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, base); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(23,19,13,0.55)'; ctx.lineWidth = 2;
      for (const [a, b] of [[x, x + R], [x2 - R, x2]]) {
        ctx.beginPath(); ctx.moveTo(a, top); ctx.lineTo(b, base); ctx.moveTo(b, top); ctx.lineTo(a, base); ctx.stroke();
      }
      ctx.restore();
      // Riding surface and steel coping.
      surface(); ctx.strokeStyle = G.INK; ctx.lineWidth = 5; ctx.stroke();
      surface(); ctx.strokeStyle = '#b3a483'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = G.INK;
      for (const cx of [x, x2]) { ctx.beginPath(); ctx.arc(cx, top, 3.5, 0, 7); ctx.fill(); }
    } else if (o.kind === 'kicker') {
      ctx.fillStyle = '#7d705a'; G.roundRect(x + w - 24, top + 4, 22, o.h - 4, 5); ctx.fill();
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = G.INK;
      ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + w, top); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = '#9a8a6a';
      ctx.beginPath(); ctx.moveTo(x + 2, base - 1); ctx.lineTo(x + w - 1, top + 0.5); ctx.stroke();
    } else if (o.kind === 'line') {
      ctx.strokeStyle = G.SHADOW; ctx.lineWidth = 4;
      for (const px of [x - 6, x + w + 6]) { ctx.beginPath(); ctx.moveTo(px, WALK); ctx.lineTo(px, top - 10); ctx.stroke(); }
      ctx.strokeStyle = G.INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 6, top); ctx.lineTo(x + w + 6, top); ctx.stroke();
      for (let lx = x + 18, k = 0; lx < x + w - 20; lx += 46, k++) {     // laundry, swaying
        const sway = Math.sin(t * 3 + k) * 2;
        ctx.save(); ctx.translate(lx, top); ctx.rotate(sway * 0.03);
        ctx.fillStyle = k % 3 === 1 ? G.LIGHT : G.PAPER;
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1;
        ctx.beginPath();
        if (k % 3 === 0) {          // long johns
          ctx.moveTo(0, 0); ctx.lineTo(20, 0); ctx.lineTo(19, 30); ctx.lineTo(13, 30); ctx.lineTo(10, 14); ctx.lineTo(7, 30); ctx.lineTo(1, 30);
        } else if (k % 3 === 1) {   // shirt
          ctx.moveTo(0, 0); ctx.lineTo(22, 0); ctx.lineTo(26, 8); ctx.lineTo(20, 9); ctx.lineTo(19, 22); ctx.lineTo(3, 22); ctx.lineTo(2, 9); ctx.lineTo(-4, 8);
        } else {                    // stockings
          ctx.moveTo(2, 0); ctx.lineTo(7, 0); ctx.lineTo(7, 18); ctx.lineTo(10, 21); ctx.lineTo(4, 22); ctx.lineTo(2, 18);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = G.INK; ctx.fillRect(3, -2, 2, 4); ctx.fillRect(15, -2, 2, 4);
        ctx.restore();
      }
    }
  }

  G.drawObstacles = function (camX, t) {
    for (const o of world.list) {
      const x = o.x - camX;
      if (x > G.viewW + 40 || x + o.w < -40) continue;
      drawObstacle(o, x, t);
    }
  };
})();
