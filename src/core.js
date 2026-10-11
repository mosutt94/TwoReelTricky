// Shared setup: the film-frame canvas, tap/swipe input, particles and the old-film overlay.
window.G = (function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const G = {
    canvas, ctx,
    VIEW_H: 360, GROUND: 300,
    INK: '#17130d', PAPER: '#efe6d0', LIGHT: '#d8cdb3', MID: '#a39880', DARK: '#665c4b', SHADOW: '#3b352b',
    TITLE_FONT: 'Limelight, Georgia, serif',
    BODY_FONT: '"IM Fell English SC", Georgia, serif',
    NUM_FONT: '700 {s}px "Playfair Display", Georgia, serif',
    shake: 0,
  };

  // The picture is a fixed-height film frame; its width follows the screen within limits,
  // so a phone held upright gets a letterboxed "movie screen" in the middle.
  const MIN_W = 540, MAX_W = 760;
  function resize() {
    const dpr = G.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    G.scale = Math.min(canvas.height / G.VIEW_H, canvas.width / MIN_W);
    G.viewW = Math.min(canvas.width / G.scale, MAX_W);
    G.offX = (canvas.width - G.viewW * G.scale) / 2;
    G.offY = (canvas.height - G.VIEW_H * G.scale) / 2;
    G.portrait = h > w * 1.1;
  }
  window.addEventListener('resize', resize);
  resize();

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.fmt = (n) => Math.round(n).toLocaleString('en-US');

  G.roundRect = function (x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // ---- Input. One finger does everything: holding (crouch / grind / manual), letting go (pop),
  // quick flicks (swipes, which re-arm so you can flick again without lifting), and sliding
  // side to side for balance. Keyboard: Space = hold, arrows = swipes and balance.
  const input = { down: false, consumed: false, sx: 0, sy: 0, cx: 0, anchor: 0, t: 0, keyBal: 0 };
  G.input = input;
  G.handlers = { press() {}, release() {}, swipe() {} };

  function press(x, y) {
    input.down = true; input.consumed = false;
    input.sx = input.cx = input.anchor = input.px = x; input.sy = input.py = y;
    input.t = input.st = input.lastMove = performance.now();
    input.fx = (x * G.dpr - G.offX) / G.scale;   // position inside the film frame
    input.fy = (y * G.dpr - G.offY) / G.scale;
    G.handlers.press();
  }
  function release() {
    if (!input.down) return;
    input.down = false;
    if (!input.consumed) G.handlers.release();
  }
  // How far the finger (or arrow keys) is leaning the hero, from -1 to 1.
  G.balanceInput = () => input.keyBal || G.clamp((input.cx - input.anchor) / 45, -1, 1);

  window.addEventListener('pointerdown', (e) => { e.preventDefault(); press(e.clientX, e.clientY); }, { passive: false });
  // A swipe is a quick flick: 22px covered within 180ms of the finger starting to move.
  // Slower slides (balancing on a rail) never count as swipes.
  window.addEventListener('pointermove', (e) => {
    if (!input.down) return;
    const now = performance.now();
    input.cx = e.clientX;
    if (input.consumed) return;
    // After a pause, measure the new movement from where the finger was resting.
    if (now - input.lastMove > 60) { input.sx = input.px; input.sy = input.py; input.st = now - 16; }
    input.lastMove = now;
    input.px = e.clientX; input.py = e.clientY;
    const dx = e.clientX - input.sx, dy = e.clientY - input.sy;
    if (dx * dx + dy * dy > 22 * 22) {
      const quick = now - input.st < 180;
      input.sx = e.clientX; input.sy = e.clientY; input.st = now;
      if (quick) G.handlers.swipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }
  });
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  const KEY_DIRS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') { e.preventDefault(); press(0, 0); }
    else if (KEY_DIRS[e.code]) {
      e.preventDefault();
      if (e.code === 'ArrowLeft') input.keyBal = -1;
      if (e.code === 'ArrowRight') input.keyBal = 1;
      G.handlers.swipe(KEY_DIRS[e.code], true);
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') release();
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') input.keyBal = 0;
  });

  // ---- Particles (world coordinates): dust puffs, grind sparks, crate splinters.
  const parts = [];
  G.emit = function (kind, x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      parts.push({
        kind, x, y,
        vx: G.rand(-1, 1) * spread,
        vy: kind === 'spark' ? G.rand(-170, -50) : kind === 'chip' ? G.rand(-320, -120) : G.rand(-35, -5),
        life: 0,
        max: kind === 'spark' ? G.rand(0.15, 0.35) : G.rand(0.45, 0.9),
        r: G.rand(3, 7), rot: G.rand(0, 6), vr: G.rand(-10, 10),
      });
    }
  };
  G.updateParticles = function (dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life > p.max) { parts.splice(i, 1); continue; }
      if (p.kind !== 'dust') p.vy += 900 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
  };
  G.drawParticles = function (camX) {
    for (const p of parts) {
      const k = 1 - p.life / p.max, x = p.x - camX;
      if (p.kind === 'dust') {
        ctx.fillStyle = 'rgba(163,152,128,' + (0.55 * k) + ')';
        ctx.beginPath(); ctx.arc(x, p.y, p.r * (1.6 - k), 0, 7); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.strokeStyle = 'rgba(255,252,240,' + k + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, p.y); ctx.lineTo(x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
      } else {
        ctx.save(); ctx.translate(x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = G.DARK; ctx.fillRect(-4, -1.5, 8, 3);
        ctx.restore();
      }
    }
  };

  // ---- Old-film look: grain, flicker, scratches, dust specks, vignette and a weaving gate.
  const grain = [];
  for (let k = 0; k < 4; k++) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const img = g.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < 0.55 ? 0 : 18 + Math.random() * 40;
    }
    g.putImageData(img, 0, 0);
    grain.push(ctx.createPattern(c, 'repeat'));
  }
  const scratches = [];

  G.beginFrame = function (t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0a08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const wx = Math.sin(t * 1.7) * 0.4 + (Math.random() - 0.5) * 0.5 + (Math.random() - 0.5) * G.shake;
    const wy = Math.sin(t * 2.3) * 0.3 + (Math.random() - 0.5) * 0.5 + (Math.random() - 0.5) * G.shake;
    ctx.setTransform(G.scale, 0, 0, G.scale, G.offX + wx * G.scale, G.offY + wy * G.scale);
    ctx.save();
    G.roundRect(0, 0, G.viewW, G.VIEW_H, 12);
    ctx.clip();
  };

  G.endFrame = function (t, dt) {
    const W = G.viewW, H = G.VIEW_H;
    G.shake = Math.max(0, G.shake - dt * 30);

    ctx.save();
    ctx.translate(-Math.random() * 128, -Math.random() * 128);
    ctx.fillStyle = grain[(Math.random() * grain.length) | 0];
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();

    ctx.fillStyle = Math.random() < 0.5
      ? 'rgba(20,14,6,' + Math.random() * 0.07 + ')'
      : 'rgba(255,248,230,' + Math.random() * 0.05 + ')';
    ctx.fillRect(0, 0, W, H);

    if (Math.random() < 0.03) scratches.push({ x: Math.random() * W, life: G.rand(0.1, 0.7), dark: Math.random() < 0.6 });
    for (let i = scratches.length - 1; i >= 0; i--) {
      const s = scratches[i];
      s.life -= dt;
      if (s.life <= 0) { scratches.splice(i, 1); continue; }
      s.x += G.rand(-1.5, 1.5);
      ctx.strokeStyle = s.dark ? 'rgba(20,14,6,0.35)' : 'rgba(255,250,235,0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x + G.rand(-2, 2), H); ctx.stroke();
    }
    if (Math.random() < 0.2) {
      ctx.fillStyle = Math.random() < 0.6 ? 'rgba(20,14,6,0.6)' : 'rgba(255,250,235,0.7)';
      ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, G.rand(0.5, 2.2), 0, 7); ctx.fill();
    }

    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.72);
    v.addColorStop(0, 'rgba(10,8,4,0)');
    v.addColorStop(1, 'rgba(10,8,4,0.7)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    if (G.portrait) {
      ctx.setTransform(G.scale, 0, 0, G.scale, G.offX, G.offY);
      ctx.fillStyle = 'rgba(239,230,208,0.7)';
      ctx.font = '15px ' + G.BODY_FONT;
      ctx.textAlign = 'center';
      ctx.fillText('Turn your phone sideways for the big picture', G.viewW / 2, H + 34);
    }
  };

  return G;
})();
