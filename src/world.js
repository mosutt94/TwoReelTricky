// The world: a 1920s main street in parallax layers, plus the things to skate on and over.
(function () {
  const ctx = G.ctx, GR = G.GROUND, WALK = GR - 16;

  function hash(i) { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

  const SIGNS = ['HOTEL', 'BARBER', 'DRY GOODS', 'BANK', 'CAFE', 'PHOTOPLAYS', 'HARDWARE', 'BAKERY',
    'TAILOR', 'SODA FOUNTAIN', 'PHARMACY', 'POOL HALL', 'LAUNDRY', 'GENERAL STORE', 'FEED & SEED', 'TELEGRAPH'];

  function farSkyline(off) {
    ctx.fillStyle = '#cbbfa3';
    const slot = 46;
    for (let i = Math.floor(off / slot) - 1; i < (off + G.viewW) / slot + 1; i++) {
      const x = i * slot - off, h = 40 + hash(i) * 70;
      ctx.fillRect(x, WALK - 60 - h, slot - 4, h + 60);
      if (hash(i + 50) > 0.8) {          // water tower
        ctx.fillRect(x + 8, WALK - 60 - h - 26, 22, 16);
        ctx.fillRect(x + 11, WALK - 60 - h - 10, 2, 10);
        ctx.fillRect(x + 25, WALK - 60 - h - 10, 2, 10);
        ctx.beginPath(); ctx.moveTo(x + 6, WALK - 60 - h - 26); ctx.lineTo(x + 19, WALK - 60 - h - 34); ctx.lineTo(x + 32, WALK - 60 - h - 26); ctx.fill();
      } else if (hash(i + 90) > 0.6) {   // chimney
        ctx.fillRect(x + 28, WALK - 60 - h - 14, 6, 14);
      }
    }
  }

  function storefront(i, x, w) {
    const h = 120 + hash(i + 3) * 80, top = WALK - h;
    const tones = ['#b5aa8f', '#9f9479', '#c2b79c', '#8e8470'];
    ctx.fillStyle = tones[(hash(i + 7) * tones.length) | 0];
    ctx.fillRect(x, top, w, h);
    ctx.fillStyle = G.SHADOW;
    ctx.fillRect(x - 3, top, w + 6, 6);                       // cornice
    ctx.fillRect(x, top + 6, w, 2);

    const rows = Math.floor((h - 70) / 34);                    // upper windows
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        const wx = x + 16 + c * ((w - 32) / 3), wy = top + 18 + r * 34;
        ctx.fillStyle = G.SHADOW; ctx.fillRect(wx, wy, 16, 22);
        ctx.fillStyle = 'rgba(239,230,208,0.25)'; ctx.fillRect(wx + 2, wy + 2, 5, 18);
        ctx.fillStyle = G.LIGHT; ctx.fillRect(wx - 2, wy + 22, 20, 2);
      }
    }

    // Shop sign, striped awning, plate-glass window and door.
    const signY = WALK - 66;
    ctx.fillStyle = G.INK; ctx.fillRect(x + 8, signY, w - 16, 16);
    ctx.fillStyle = G.PAPER;
    ctx.font = '11px ' + G.BODY_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(SIGNS[(hash(i + 11) * SIGNS.length) | 0], x + w / 2, signY + 8.5);
    ctx.textBaseline = 'alphabetic';
    const aw = WALK - 48;
    for (let s = 0; s < w - 8; s += 12) {
      ctx.fillStyle = (s / 12) % 2 ? G.PAPER : G.DARK;
      ctx.beginPath();
      ctx.moveTo(x + 4 + s, aw); ctx.lineTo(x + 16 + s, aw);
      ctx.lineTo(x + 18 + s, aw + 12); ctx.lineTo(x + 2 + s, aw + 12);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = G.SHADOW; ctx.fillRect(x + 12, aw + 14, w - 52, 32);
    ctx.strokeStyle = 'rgba(239,230,208,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 18, aw + 42); ctx.lineTo(x + 34, aw + 18); ctx.stroke();
    ctx.fillStyle = G.INK; ctx.fillRect(x + w - 32, aw + 12, 18, 36);
  }

  G.drawBackground = function (camX) {
    const W = G.viewW;
    const sky = ctx.createLinearGradient(0, 0, 0, WALK);
    sky.addColorStop(0, '#f4edda'); sky.addColorStop(1, '#ddd3b9');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, WALK);

    farSkyline(camX * 0.15);

    const off = camX * 0.5, slot = 190;
    for (let i = Math.floor(off / slot) - 1; i < (off + W) / slot + 1; i++) {
      storefront(i, i * slot - off + 6, slot - 12 - hash(i + 21) * 20);
    }

    // Telegraph poles and sagging wires.
    const po = camX * 0.8, gap = 320;
    ctx.strokeStyle = G.SHADOW;
    for (let i = Math.floor(po / gap) - 1; i < (po + W) / gap + 1; i++) {
      const x = i * gap - po;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, WALK); ctx.lineTo(x, 40); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 18, 52); ctx.lineTo(x + 18, 52); ctx.stroke();
      ctx.lineWidth = 0.8;
      for (const dx of [-15, 15]) {
        ctx.beginPath(); ctx.moveTo(x + dx, 52); ctx.quadraticCurveTo(x + dx + gap / 2, 74, x + dx + gap, 52); ctx.stroke();
      }
    }

    // Sidewalk, curb, cobbled street with trolley tracks.
    ctx.fillStyle = '#c9bea3';
    ctx.fillRect(0, WALK, W, GR - WALK);
    ctx.strokeStyle = 'rgba(59,53,43,0.4)'; ctx.lineWidth = 1;
    for (let x = -(camX % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, WALK); ctx.lineTo(x - 6, GR); ctx.stroke(); }
    ctx.fillStyle = G.DARK; ctx.fillRect(0, GR, W, G.VIEW_H - GR);
    ctx.fillStyle = G.INK; ctx.fillRect(0, GR, W, 2.5);
    ctx.fillStyle = G.SHADOW;
    for (let row = 0; row < 5; row++) {
      const y = GR + 6 + row * 11, par = 1 + row * 0.12, stag = row % 2 ? 9 : 0;
      for (let x = -((camX * par + stag) % 18); x < W; x += 18) G.roundRect(x, y, 15, 8, 3), ctx.fill();
    }
    ctx.fillStyle = G.LIGHT;
    ctx.fillRect(0, GR + 24, W, 1.5);
    ctx.fillRect(0, GR + 36, W, 1.5);
  };

  // Gas lamps that sweep past in front of the action.
  G.drawForeground = function (camX) {
    const fo = camX * 1.35, gap = 900;
    for (let i = Math.floor(fo / gap) - 1; i < (fo + G.viewW) / gap + 1; i++) {
      const x = i * gap - fo + 300;
      ctx.fillStyle = G.INK;
      ctx.fillRect(x - 3, 90, 6, G.VIEW_H - 90);
      ctx.fillRect(x - 9, G.VIEW_H - 24, 18, 24);
      ctx.beginPath(); ctx.moveTo(x - 11, 90); ctx.lineTo(x + 11, 90); ctx.lineTo(x + 7, 64); ctx.lineTo(x - 7, 64); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(239,230,208,0.55)'; ctx.fillRect(x - 6, 70, 12, 16);
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.moveTo(x - 10, 64); ctx.lineTo(x, 54); ctx.lineTo(x + 10, 64); ctx.fill();
    }
  };

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
    kicker: {},
    facade: {},
  };

  const world = G.world = { list: [], nextX: 700, wantFacade: false, hints: 0 };
  world.reset = function () {
    world.list.length = 0; world.nextX = 700; world.wantFacade = false; world.hints = 0;
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

  G.updateWorld = function (camX) {
    while (world.nextX < camX + G.viewW + 500) {
      let end;
      if (world.wantFacade) {                  // a falling house gets the street to itself
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
      ctx.fillRect(x + w / 2 - 44, top + 13, 88, 16);
      ctx.fillStyle = G.PAPER; ctx.font = '11px ' + G.BODY_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('FREIGHT', x + w / 2, top + 21.5);
      ctx.textBaseline = 'alphabetic';
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
