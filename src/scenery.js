// Scenery: a 1920s main street in parallax layers with some life in it. Sky, a far skyline,
// the buildings along the street, sidewalk props, strolling pedestrians, pigeons on the road,
// clouds, birds and chimney smoke. Buildings are drawn once into offscreen images and reused.
(function () {
  const ctx = G.ctx, GR = G.GROUND, WALK = GR - 16;
  const hash = (i, k) => { const s = Math.sin(i * 127.1 + (k || 0) * 311.7 + 74.3) * 43758.5453; return s - Math.floor(s); };
  const pick = (arr, i, k) => arr[Math.floor(hash(i, k) * arr.length)];

  // ---- Offscreen cache. Each piece is rendered at the device scale and blitted thereafter.
  const cache = new Map();
  let cacheScale = 0;
  function piece(key, w, h, draw) {
    if (cacheScale !== G.scale) { cache.clear(); cacheScale = G.scale; }
    let c = cache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(w * G.scale); c.height = Math.ceil(h * G.scale);
      const g = c.getContext('2d');
      g.setTransform(G.scale, 0, 0, G.scale, 0, 0);
      g.lineCap = 'round'; g.lineJoin = 'round';
      draw(g, w, h);
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      cache.set(key, c);
    }
    return c;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => cache.clear());

  // ---- Sky
  const clouds = [0, 1, 2, 3].map((i) => ({ x: i * 420 + hash(i, 9) * 200, y: 40 + hash(i, 3) * 70, s: 0.7 + hash(i, 5) * 0.8 }));
  function drawSky(camX, t) {
    const W = G.viewW;
    const sky = ctx.createLinearGradient(0, 0, 0, WALK);
    sky.addColorStop(0, '#f1e9d6'); sky.addColorStop(0.7, '#e2d8bf'); sky.addColorStop(1, '#d9ceb3');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, WALK);
    // A pale sun low over the rooftops, with a haze.
    const sx = W * 0.72 - camX * 0.02, sy = 92;
    const halo = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150);
    halo.addColorStop(0, 'rgba(255,250,232,0.55)'); halo.addColorStop(1, 'rgba(255,250,232,0)');
    ctx.fillStyle = halo; ctx.fillRect(sx - 150, sy - 150, 300, 300);
    ctx.fillStyle = 'rgba(255,252,240,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy, 22, 0, 7); ctx.fill();
    // Clouds drift slowly on their own as well as with the camera.
    for (const c of clouds) {
      const span = 1680, x = ((c.x - camX * 0.06 - t * 4) % span + span) % span - 140;
      if (x > W + 160) continue;
      ctx.save(); ctx.translate(x, c.y); ctx.scale(c.s, c.s * 0.75);
      ctx.fillStyle = 'rgba(250,246,236,0.8)';
      for (const [dx, dy, r] of [[0, 0, 34], [-40, 8, 26], [42, 6, 28], [-14, -16, 24], [20, -14, 22], [70, 14, 18]]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(205,196,172,0.35)';
      ctx.beginPath(); ctx.ellipse(10, 20, 72, 9, 0, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  // ---- Far skyline (parallax 0.15): silhouettes with a little rooftop character.
  const FAR_SLOT = 150;
  function farPiece(i) {
    const type = pick(['tenement', 'tenement', 'steeple', 'factory', 'tower', 'billboard', 'gasworks', 'tenement'], i, 1);
    const h = 70 + hash(i, 2) * 80, W = FAR_SLOT, H = 230;
    return piece('far' + i, W, H, (g) => {
      const top = H - h, bw = W - 10;
      g.fillStyle = '#c6baa0';
      g.fillRect(0, top, bw, h);
      g.fillStyle = '#b9ad93';
      for (let r = 0; r < Math.floor((h - 14) / 18); r++) {
        for (let c = 0; c < 4; c++) g.fillRect(10 + c * 32, top + 10 + r * 18, 9, 11);
      }
      g.fillStyle = '#c6baa0';
      if (type === 'steeple') {
        g.fillRect(bw / 2 - 16, top - 50, 32, 50);
        g.beginPath(); g.moveTo(bw / 2 - 20, top - 50); g.lineTo(bw / 2, top - 110); g.lineTo(bw / 2 + 20, top - 50); g.fill();
        g.fillStyle = '#eee6d2'; g.beginPath(); g.arc(bw / 2, top - 30, 8, 0, 7); g.fill();
        g.fillStyle = '#c6baa0'; g.fillRect(bw / 2 - 1, top - 118, 2, 10); g.fillRect(bw / 2 - 4, top - 115, 8, 2);
      } else if (type === 'factory') {
        g.fillRect(bw - 30, top - 90, 12, 90);
        g.beginPath();
        for (let k = 0; k < 4; k++) { g.moveTo(k * 30, top); g.lineTo(k * 30, top - 16); g.lineTo(k * 30 + 22, top); }
        g.fill();
      } else if (type === 'tower') {
        g.fillRect(bw / 2 - 18, top - 36, 36, 22); g.fillRect(bw / 2 - 12, top - 14, 3, 14); g.fillRect(bw / 2 + 9, top - 14, 3, 14);
        g.beginPath(); g.moveTo(bw / 2 - 20, top - 36); g.lineTo(bw / 2, top - 48); g.lineTo(bw / 2 + 20, top - 36); g.fill();
      } else if (type === 'billboard') {
        g.fillRect(12, top - 44, bw - 24, 32); g.fillRect(20, top - 12, 3, 12); g.fillRect(bw - 23, top - 12, 3, 12);
        g.fillStyle = '#e9e1cc'; g.fillRect(16, top - 40, bw - 32, 24);
        g.fillStyle = '#b9ad93'; g.font = '11px ' + G.TITLE_FONT; g.textAlign = 'center';
        g.fillText(pick(['CIGARS 5¢', 'SODA', 'ROOMS', 'DRUGS', 'TONIC', 'BEST FLOUR'], i, 4), bw / 2, top - 23);
      } else if (type === 'gasworks') {
        g.beginPath(); g.arc(bw / 2, top + 8, 56, Math.PI, 0); g.fill();
        g.fillStyle = '#b9ad93'; g.fillRect(bw / 2 - 58, top + 2, 116, 2);
      }
    });
  }
  function drawFar(camX) {
    const off = camX * 0.15;
    for (let i = Math.floor(off / FAR_SLOT) - 1; i < (off + G.viewW) / FAR_SLOT + 1; i++) {
      ctx.drawImage(farPiece(i), i * FAR_SLOT - off, WALK - 230, FAR_SLOT, 230);
    }
  }

  // ---- The street's buildings (parallax 0.5).
  const SLOT = 230;
  const SIGNS = ['HOTEL', 'BARBER', 'DRY GOODS', 'CAFE', 'HARDWARE', 'BAKERY', 'TAILOR', 'SODA FOUNTAIN',
    'PHARMACY', 'POOL HALL', 'LAUNDRY', 'GENERAL STORE', 'FEED & SEED', 'TELEGRAPH', 'BOOTS & SHOES', 'CIGARS', 'PHOTOGRAPHS', 'NOTIONS'];
  const TONES = ['#b7ac91', '#a89d82', '#c1b69b', '#948a74', '#ad9f84'];

  function windows(g, x, top, w, rows, arched, shade) {
    for (let r = 0; r < rows; r++) {
      const cols = Math.max(2, Math.floor((w - 24) / 34));
      for (let c = 0; c < cols; c++) {
        const wx = x + 14 + c * ((w - 28) / cols) + ((w - 28) / cols - 16) / 2, wy = top + 20 + r * 36;
        g.fillStyle = shade;
        if (arched) { g.beginPath(); g.moveTo(wx, wy + 22); g.lineTo(wx, wy + 8); g.arc(wx + 8, wy + 8, 8, Math.PI, 0); g.lineTo(wx + 16, wy + 22); g.closePath(); g.fill(); }
        else g.fillRect(wx, wy, 16, 22);
        g.fillStyle = 'rgba(239,230,208,0.22)'; g.fillRect(wx + 2, wy + 3, 5, 17);
        g.fillStyle = G.LIGHT; g.fillRect(wx - 2, wy + 22, 20, 2);
        if (hash(x + c, r) > 0.7) { g.fillStyle = G.SHADOW; g.fillRect(wx, wy, 16, 7); }   // a drawn blind
      }
    }
  }
  function cornice(g, x, top, w) {
    g.fillStyle = G.SHADOW; g.fillRect(x - 4, top, w + 8, 6); g.fillRect(x, top + 6, w, 2);
    for (let k = x + 6; k < x + w; k += 14) g.fillRect(k, top + 8, 4, 4);
  }
  function awning(g, x, y, w, i) {
    const style = pick(['stripes', 'stripes', 'scallop', 'plain'], i, 7);
    for (let s = 0; s < w; s += 12) {
      g.fillStyle = style === 'plain' ? G.MID : (s / 12) % 2 ? G.PAPER : G.DARK;
      g.beginPath();
      g.moveTo(x + s, y); g.lineTo(x + Math.min(s + 12, w), y);
      g.lineTo(x + Math.min(s + 14, w + 2), y + 12); g.lineTo(x + s - 2, y + 12);
      g.closePath(); g.fill();
    }
    if (style === 'scallop') {
      g.fillStyle = G.DARK;
      for (let s = 0; s < w; s += 12) { g.beginPath(); g.arc(x + s + 5, y + 12, 6, 0, Math.PI); g.fill(); }
    }
    g.fillStyle = 'rgba(23,19,13,0.22)'; g.fillRect(x - 2, y + 12, w + 4, 6);   // shade under it
  }
  function shopfront(g, x, w, i) {
    const y = WALK;
    const signStyle = pick(['board', 'board', 'hanging', 'glass'], i, 8);
    const sign = pick(SIGNS, i, 11);
    g.font = '11px ' + G.BODY_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (signStyle !== 'glass') {
      g.fillStyle = G.INK; g.fillRect(x + 8, y - 66, w - 16, 16);
      g.fillStyle = G.PAPER; g.fillText(sign, x + w / 2, y - 57.5);
    }
    awning(g, x + 4, y - 48, w - 8, i);
    g.fillStyle = G.SHADOW; g.fillRect(x + 12, y - 34, w - 52, 32);
    g.strokeStyle = 'rgba(239,230,208,0.3)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(x + 18, y - 6); g.lineTo(x + 34, y - 30); g.stroke();
    if (signStyle === 'glass') {
      g.fillStyle = 'rgba(239,230,208,0.85)'; g.font = '10px ' + G.BODY_FONT;
      g.fillText(sign, x + 12 + (w - 52) / 2, y - 18);
    }
    g.fillStyle = G.INK; g.fillRect(x + w - 32, y - 36, 18, 36);
    g.fillStyle = G.MID; g.fillRect(x + w - 19, y - 20, 2, 3);
    if (signStyle === 'hanging') {                       // a bracket sign out over the walk
      g.strokeStyle = G.INK; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + w - 2, y - 78); g.lineTo(x + w + 22, y - 78); g.lineTo(x + w - 2, y - 90); g.stroke();
      g.fillStyle = G.PAPER; g.fillRect(x + w + 2, y - 76, 18, 12);
      g.strokeStyle = G.INK; g.lineWidth = 1; g.strokeRect(x + w + 2, y - 76, 18, 12);
      g.fillStyle = G.INK; g.font = '7px ' + G.BODY_FONT; g.fillText(pick(['SHOES', 'ROOMS', 'EATS', 'DRUGS'], i, 12), x + w + 11, y - 70);
    }
    g.textBaseline = 'alphabetic';
  }

  function buildingPiece(i) {
    const type = pick(['shop', 'shop', 'shop', 'tenement', 'bank', 'theatre', 'shop', 'lot', 'tenement', 'shop'], i, 1);
    const w = SLOT - 14 - hash(i, 2) * 24;
    const stories = type === 'bank' ? 2 : type === 'lot' ? 0 : 2 + Math.floor(hash(i, 3) * 2.6);
    const H = 260;
    return piece('bld' + i, SLOT, H, (g) => {
      const x = 4, bottom = H - (G.VIEW_H - WALK);      // y of the walk inside the piece
      const yoff = bottom - WALK;                        // shift so the shop code can use WALK
      g.translate(0, yoff);
      if (type === 'lot') {                              // a vacant lot behind a fence, with a billboard
        g.fillStyle = '#a89d82';
        for (let k = 0; k < w; k += 9) { g.fillRect(x + k, WALK - 36, 7, 36); }
        g.fillStyle = G.SHADOW; g.fillRect(x, WALK - 30, w, 2); g.fillRect(x, WALK - 12, w, 2);
        g.fillStyle = G.INK; g.fillRect(x + 20, WALK - 120, 4, 90); g.fillRect(x + w - 24, WALK - 120, 4, 90);
        g.fillStyle = G.PAPER; g.fillRect(x + 10, WALK - 150, w - 20, 54);
        g.strokeStyle = G.INK; g.lineWidth = 2; g.strokeRect(x + 10, WALK - 150, w - 20, 54);
        g.fillStyle = G.INK; g.textAlign = 'center';
        g.font = '15px ' + G.TITLE_FONT; g.fillText(pick(['THE THRILL RAMP', 'TWO REEL TRICKY', 'SEE OUR HERO'], i, 5), x + w / 2, WALK - 126);
        g.font = '9px ' + G.BODY_FONT; g.fillText(pick(['Now Showing  ·  Admission 10¢', 'A Photoplay in Two Reels', 'Thrills! Spills! Pratfalls!'], i, 6), x + w / 2, WALK - 108);
        return;
      }
      const h = 76 + stories * 44 + (type === 'theatre' ? 30 : 0), top = WALK - h;
      g.fillStyle = pick(TONES, i, 4);
      g.fillRect(x, top, w, h);
      if (type === 'tenement') {                          // brick courses
        g.strokeStyle = 'rgba(23,19,13,0.12)'; g.lineWidth = 1;
        for (let yy = top + 10; yy < WALK; yy += 7) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
      }
      cornice(g, x, top, w);
      if (type === 'bank') {
        g.fillStyle = G.SHADOW;
        g.beginPath(); g.moveTo(x - 6, top); g.lineTo(x + w / 2, top - 26); g.lineTo(x + w + 6, top); g.closePath(); g.fill();
        g.fillStyle = G.LIGHT;
        for (let k = 0; k < 4; k++) { const cx = x + 22 + k * ((w - 44) / 3); g.fillRect(cx - 6, top + 10, 12, h - 10); }
        g.fillStyle = G.SHADOW; g.fillRect(x + 8, top + 10, w - 16, 14);
        g.fillStyle = G.PAPER; g.font = '11px ' + G.BODY_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('FIRST NATIONAL BANK', x + w / 2, top + 17); g.textBaseline = 'alphabetic';
        g.fillStyle = G.INK; g.fillRect(x + w / 2 - 14, WALK - 44, 28, 44);
        g.fillStyle = G.LIGHT; g.fillRect(x + w / 2 - 20, WALK - 48, 40, 4);
        return;
      }
      if (type === 'theatre') {
        windows(g, x, top, w, stories - 1, true, G.SHADOW);
        const my = WALK - 84;                             // the marquee
        g.fillStyle = G.INK; g.fillRect(x - 8, my, w + 16, 26);
        g.fillStyle = G.PAPER; g.fillRect(x - 4, my + 4, w + 8, 18);
        g.fillStyle = G.INK; g.font = '11px ' + G.TITLE_FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(pick(['PHOTOPLAYS TONITE', 'THE GENERAL', 'SHERLOCK JR.', 'STEAMBOAT BILL JR.'], i, 9), x + w / 2, my + 13.5);
        g.textBaseline = 'alphabetic';
        g.fillStyle = '#f6efdc';
        for (let k = x - 4; k < x + w + 6; k += 8) { g.beginPath(); g.arc(k, my + 2, 1.6, 0, 7); g.arc(k, my + 24, 1.6, 0, 7); g.fill(); }
        g.fillStyle = G.SHADOW; g.fillRect(x + 20, WALK - 50, w - 40, 50);
        g.fillStyle = G.INK; g.fillRect(x + w / 2 - 12, WALK - 46, 24, 46);
        g.fillStyle = G.PAPER; g.fillRect(x + 26, WALK - 44, 12, 18); g.fillRect(x + w - 38, WALK - 44, 12, 18);
        return;
      }
      windows(g, x, top, w, stories - 1, hash(i, 13) > 0.6, G.SHADOW);
      if (type === 'tenement') {                          // a fire escape and a stoop
        g.strokeStyle = G.INK; g.lineWidth = 1.5;
        const fx = x + w - 54;
        for (let s = 0; s < stories - 1; s++) {
          const fy = top + 42 + s * 36;
          g.strokeRect(fx, fy, 40, 10);
          g.beginPath(); for (let k = 4; k < 40; k += 6) { g.moveTo(fx + k, fy); g.lineTo(fx + k, fy + 10); } g.stroke();
          g.beginPath(); g.moveTo(fx + 36, fy + 10); g.lineTo(fx + 8, fy + 36); g.stroke();
        }
        g.fillStyle = G.INK; g.fillRect(x + 20, WALK - 42, 22, 42);
        g.fillStyle = G.LIGHT; g.fillRect(x + 12, WALK - 8, 38, 8); g.fillRect(x + 15, WALK - 14, 32, 6);
        g.fillStyle = G.SHADOW; g.fillRect(x + 60, WALK - 40, 16, 22); g.fillRect(x + w - 90, WALK - 40, 16, 22);
        return;
      }
      shopfront(g, x, w, i);
    });
  }
  function drawBuildings(camX) {
    const off = camX * 0.5;
    for (let i = Math.floor(off / SLOT) - 1; i < (off + G.viewW) / SLOT + 1; i++) {
      ctx.drawImage(buildingPiece(i), i * SLOT - off, G.VIEW_H - 260, SLOT, 260);
    }
  }

  // ---- Telegraph poles and wires (parallax 0.8).
  function drawWires(camX) {
    const po = camX * 0.8, gap = 340;
    ctx.strokeStyle = G.SHADOW;
    for (let i = Math.floor(po / gap) - 1; i < (po + G.viewW) / gap + 1; i++) {
      const x = i * gap - po;
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, WALK); ctx.lineTo(x, 40); ctx.stroke();
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 18, 52); ctx.lineTo(x + 18, 52); ctx.stroke();
      ctx.lineWidth = 0.8;
      for (const dx of [-15, 15]) {
        ctx.beginPath(); ctx.moveTo(x + dx, 52); ctx.quadraticCurveTo(x + dx + gap / 2, 76, x + dx + gap, 52); ctx.stroke();
      }
    }
  }

  // ---- Sidewalk props (parallax 1, on the walk behind the action).
  const PROP_SLOT = 320;
  function drawProps(camX, t) {
    for (let i = Math.floor(camX / PROP_SLOT) - 1; i < (camX + G.viewW) / PROP_SLOT + 1; i++) {
      const type = pick(['hydrant', 'none', 'mailbox', 'barber', 'none', 'newsstand', 'trough', 'clock', 'none', 'auto'], i, 21);
      if (type === 'none') continue;
      const x = i * PROP_SLOT + 60 + hash(i, 22) * 160 - camX, y = WALK;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (type === 'hydrant') {
        ctx.fillStyle = G.DARK; G.roundRect(x - 5, y - 20, 10, 20, 3); ctx.fill();
        ctx.fillRect(x - 8, y - 14, 16, 4); ctx.beginPath(); ctx.arc(x, y - 21, 4, 0, 7); ctx.fill();
      } else if (type === 'mailbox') {
        ctx.fillStyle = G.SHADOW; G.roundRect(x - 7, y - 34, 14, 22, 5); ctx.fill(); ctx.fillRect(x - 3, y - 12, 6, 12);
        ctx.fillStyle = G.LIGHT; ctx.fillRect(x - 4, y - 28, 8, 2);
      } else if (type === 'barber') {
        ctx.fillStyle = G.INK; ctx.fillRect(x - 2, y - 62, 4, 62);
        ctx.save(); ctx.beginPath(); ctx.rect(x - 5, y - 58, 10, 28); ctx.clip();
        for (let k = -2; k < 8; k++) {
          const yy = y - 58 + ((k * 7 + t * 14) % 28);
          ctx.fillStyle = k % 2 ? G.PAPER : G.DARK;
          ctx.beginPath(); ctx.moveTo(x - 5, yy); ctx.lineTo(x + 5, yy - 4); ctx.lineTo(x + 5, yy); ctx.lineTo(x - 5, yy + 4); ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = G.INK; ctx.fillRect(x - 6, y - 60, 12, 3); ctx.fillRect(x - 6, y - 31, 12, 3);
      } else if (type === 'newsstand') {
        ctx.fillStyle = G.DARK; ctx.fillRect(x - 22, y - 30, 44, 30);
        ctx.fillStyle = G.PAPER; for (let k = 0; k < 4; k++) ctx.fillRect(x - 18 + k * 10, y - 26, 7, 9);
        ctx.fillStyle = G.INK; ctx.fillRect(x - 24, y - 34, 48, 5);
        ctx.fillStyle = G.PAPER; ctx.font = '7px ' + G.BODY_FONT; ctx.textAlign = 'center'; ctx.fillText('NEWS', x, y - 8);
      } else if (type === 'trough') {
        ctx.fillStyle = G.DARK; G.roundRect(x - 26, y - 16, 52, 16, 4); ctx.fill();
        ctx.fillStyle = 'rgba(239,230,208,0.5)'; ctx.fillRect(x - 22, y - 13, 44, 3);
      } else if (type === 'clock') {
        ctx.fillStyle = G.INK; ctx.fillRect(x - 2, y - 70, 4, 70);
        ctx.beginPath(); ctx.arc(x, y - 76, 12, 0, 7); ctx.fill();
        ctx.fillStyle = G.PAPER; ctx.beginPath(); ctx.arc(x, y - 76, 9.5, 0, 7); ctx.fill();
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y - 76); ctx.lineTo(x, y - 83); ctx.moveTo(x, y - 76); ctx.lineTo(x + 5, y - 73); ctx.stroke();
      } else if (type === 'auto') {                         // a parked tin lizzie
        ctx.fillStyle = G.INK;
        G.roundRect(x - 40, y - 28, 50, 16, 4); ctx.fill();
        G.roundRect(x - 34, y - 48, 34, 24, 5); ctx.fill();
        ctx.fillRect(x + 8, y - 24, 30, 12);
        ctx.fillStyle = 'rgba(239,230,208,0.35)'; ctx.fillRect(x - 30, y - 44, 26, 12);
        ctx.fillStyle = G.INK;
        for (const wx of [x - 28, x + 24]) { ctx.beginPath(); ctx.arc(wx, y - 8, 9, 0, 7); ctx.fill(); }
        ctx.fillStyle = G.PAPER;
        for (const wx of [x - 28, x + 24]) { ctx.beginPath(); ctx.arc(wx, y - 8, 4, 0, 7); ctx.fill(); }
        ctx.fillStyle = G.INK; ctx.fillRect(x + 36, y - 30, 3, 8); ctx.fillRect(x - 44, y - 22, 6, 3);
      }
    }
  }

  // ---- Pedestrians strolling on the walk, and pigeons on the road that scatter.
  const folk = [], pigeons = [], puffs = [], birds = [];
  let folkTimer = 2, pigeonTimer = 5, birdTimer = 20, puffTimer = 0, lastCam = 0;
  const FOLK = ['lady', 'gent', 'newsboy', 'lady', 'gent', 'granny'];

  function drawPerson(p, x, t) {
    const y = WALK, step = Math.sin(t * 7 + p.seed * 6) * (p.dir ? 1 : -1);
    ctx.save(); ctx.translate(x, y); if (p.dir < 0) ctx.scale(-1, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = G.INK; ctx.fillStyle = G.INK;
    if (p.type === 'lady' || p.type === 'granny') {                       // long skirt, parasol or cane
      ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.lineTo(4, -30); ctx.lineTo(-4, -30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = p.type === 'granny' ? G.SHADOW : G.DARK; ctx.fillRect(-5, -44, 10, 15);
      ctx.fillStyle = SKIN_TONE; ctx.beginPath(); ctx.arc(0, -50, 5, 0, 7); ctx.fill();
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(-1, -53, 5, Math.PI, 0); ctx.fill();
      if (p.type === 'lady') {
        ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4, -38); ctx.lineTo(10, -62); ctx.stroke();
        ctx.fillStyle = G.PAPER; ctx.beginPath(); ctx.arc(10, -62, 13, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(10, -62, 13, Math.PI, 0); ctx.stroke();
      } else {
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(6, -36); ctx.lineTo(9 + step, 0); ctx.stroke();
      }
    } else if (p.type === 'gent') {                                        // bowler, coat and cane
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(-4 - step * 4, -2); ctx.moveTo(2, -28); ctx.lineTo(4 + step * 4, -2); ctx.stroke();
      ctx.fillStyle = G.INK; G.roundRect(-7, -48, 14, 24, 3); ctx.fill();
      ctx.fillStyle = SKIN_TONE; ctx.beginPath(); ctx.arc(0, -54, 5, 0, 7); ctx.fill();
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(0, -57, 5.5, Math.PI, 0); ctx.fill(); ctx.fillRect(-8, -57, 16, 2);
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, -36); ctx.lineTo(12 - step * 3, 0); ctx.stroke();
    } else {                                                               // newsboy with a satchel
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-2, -22); ctx.lineTo(-4 - step * 4, -2); ctx.moveTo(2, -22); ctx.lineTo(4 + step * 4, -2); ctx.stroke();
      ctx.fillStyle = G.DARK; G.roundRect(-6, -38, 12, 18, 3); ctx.fill();
      ctx.fillStyle = G.SHADOW; ctx.fillRect(2, -30, 9, 10);
      ctx.fillStyle = SKIN_TONE; ctx.beginPath(); ctx.arc(0, -43, 4.5, 0, 7); ctx.fill();
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(0, -45, 5, Math.PI, 0); ctx.fill(); ctx.fillRect(0, -45, 8, 1.5);
      ctx.fillStyle = G.PAPER; ctx.fillRect(-10, -36, 7, 9);
    }
    ctx.restore();
  }
  const SKIN_TONE = '#f1e6cf';

  function drawPigeon(p) {
    const x = p.x - p.camX, y = p.y;
    ctx.fillStyle = G.SHADOW;
    if (p.flying) {
      const flap = Math.sin(p.t * 30) * 5;
      ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = G.SHADOW; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 7, y - flap); ctx.lineTo(x, y); ctx.lineTo(x + 7, y - flap); ctx.stroke();
    } else {
      const peck = Math.sin(p.t * 5 + p.seed) > 0.8 ? 1.5 : 0;
      ctx.beginPath(); ctx.ellipse(x, y - 3, 4.5, 3, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 4 * p.dir, y - 5.5 + peck, 2, 0, 7); ctx.fill();
      ctx.fillRect(x - 1, y - 1, 1, 1.5); ctx.fillRect(x + 1, y - 1, 1, 1.5);
    }
  }

  G.updateScenery = function (dt, camX, t) {
    lastCam = camX;
    const W = G.viewW, hx = G.hero ? G.hero.x : camX + W * 0.3;
    folkTimer -= dt;
    if (folkTimer <= 0) {
      folkTimer = G.rand(2.5, 6);
      const dir = Math.random() < 0.6 ? -1 : 1;
      folk.push({ type: pick(FOLK, folk.length, Math.random() * 100), x: camX + W + 60, dir, v: G.rand(18, 34), seed: Math.random() });
    }
    for (let i = folk.length - 1; i >= 0; i--) {
      const p = folk[i];
      p.x += p.dir * p.v * dt;
      if (p.x < camX - 80 || p.x > camX + W + 400) folk.splice(i, 1);
    }
    pigeonTimer -= dt;
    if (pigeonTimer <= 0) {
      pigeonTimer = G.rand(7, 14);
      const bx = camX + W + 120, n = 3 + Math.floor(Math.random() * 3);
      const blocked = G.world.list.some((o) => bx + 60 > o.x - 60 && bx - 30 < o.x + o.w + 60);
      if (!blocked) for (let k = 0; k < n; k++) pigeons.push({ x: bx + k * 16 + G.rand(-6, 6), y: GR + 4 + G.rand(0, 20), dir: Math.random() < 0.5 ? -1 : 1, t: 0, seed: Math.random() * 7, flying: false, vx: 0, vy: 0 });
    }
    for (let i = pigeons.length - 1; i >= 0; i--) {
      const p = pigeons[i];
      p.t += dt; p.camX = camX;
      if (!p.flying && Math.abs(p.x - hx) < 130 && G.hero && G.hero.state !== 'pipe') {
        p.flying = true; p.vx = G.rand(60, 160) * (p.x > hx ? 1 : -1) + 40; p.vy = -G.rand(160, 260);
      }
      if (p.flying) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 60 * dt; }
      if (p.y < -30 || p.x < camX - 60) pigeons.splice(i, 1);
    }
    birdTimer -= dt;
    if (birdTimer <= 0) {
      birdTimer = G.rand(14, 30);
      const n = 3 + Math.floor(Math.random() * 4), by = 30 + Math.random() * 60;
      for (let k = 0; k < n; k++) birds.push({ x: camX * 0.12 + W + 40 + k * 14, y: by + (k % 2) * 8, v: G.rand(28, 40), seed: Math.random() * 7 });
    }
    for (let i = birds.length - 1; i >= 0; i--) {
      birds[i].x -= birds[i].v * dt;
      if (birds[i].x < camX * 0.12 - 40) birds.splice(i, 1);
    }
    // Chimney smoke from the factory stacks on the skyline.
    puffTimer -= dt;
    if (puffTimer <= 0) {
      puffTimer = 0.35;
      const off = camX * 0.15;
      for (let i = Math.floor(off / FAR_SLOT) - 1; i < (off + W) / FAR_SLOT + 1; i++) {
        if (pick(['tenement', 'tenement', 'steeple', 'factory', 'tower', 'billboard', 'gasworks', 'tenement'], i, 1) !== 'factory') continue;
        const h = 70 + hash(i, 2) * 80;
        puffs.push({ fx: i * FAR_SLOT + FAR_SLOT - 34, y: WALK - h - 90, t: 0, seed: Math.random() * 7 });
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.t += dt; p.y -= 9 * dt; p.fx -= 6 * dt;
      if (p.t > 7) puffs.splice(i, 1);
    }
  };

  G.drawBackground = function (camX, t) {
    const W = G.viewW;
    drawSky(camX, t || 0);
    for (const b of birds) {                                               // far away, tiny
      const x = b.x - camX * 0.12, f = Math.sin((t || 0) * 9 + b.seed) * 2.5;
      ctx.strokeStyle = 'rgba(59,53,43,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 4, b.y - f); ctx.lineTo(x, b.y); ctx.lineTo(x + 4, b.y - f); ctx.stroke();
    }
    drawFar(camX);
    for (const p of puffs) {
      const k = p.t / 7;
      ctx.fillStyle = 'rgba(214,206,186,' + (0.45 * (1 - k)) + ')';
      ctx.beginPath(); ctx.arc(p.fx - camX * 0.15, p.y, 5 + k * 22, 0, 7); ctx.fill();
    }
    drawBuildings(camX);
    drawWires(camX);
    // Sidewalk with its paving lines, then the props and the people on it.
    ctx.fillStyle = '#c9bea3'; ctx.fillRect(0, WALK, W, GR - WALK);
    ctx.strokeStyle = 'rgba(59,53,43,0.4)'; ctx.lineWidth = 1;
    for (let x = -(camX % 40); x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, WALK); ctx.lineTo(x - 6, GR); ctx.stroke(); }
    drawProps(camX, t || 0);
    for (const p of folk) drawPerson(p, p.x - camX, t || 0);
    // The cobbled street with its trolley tracks.
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
    for (const p of pigeons) drawPigeon(p);
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
})();
