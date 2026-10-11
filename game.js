// Two Reel Tricky - step 1: a skater who rolls along and jumps on tap.
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const VIEW_H = 360;          // logical height; width follows the screen shape
  const GROUND = 300;          // y of the road surface
  const GRAVITY = 1800;
  const JUMP_V = 700;

  let viewW = 640, scale = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    scale = canvas.height / VIEW_H;
    viewW = canvas.width / scale;
  }
  window.addEventListener('resize', resize);
  resize();

  const hero = { x: 0, y: GROUND, vy: 0, onGround: true, speed: 260 };

  function jump() {
    if (hero.onGround) {
      hero.vy = -JUMP_V;
      hero.onGround = false;
    }
  }
  window.addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });

  function update(dt) {
    hero.x += hero.speed * dt;
    if (!hero.onGround) {
      hero.vy += GRAVITY * dt;
      hero.y += hero.vy * dt;
      if (hero.y >= GROUND) { hero.y = GROUND; hero.vy = 0; hero.onGround = true; }
    }
  }

  // Sepia-toned silent-film palette.
  const INK = '#1c1812', PAPER = '#e9dfc8', MID = '#9c917c', DARK = '#5a5244';

  function drawBackground(camX) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, viewW, VIEW_H);

    // Far rooftops (slow parallax).
    ctx.fillStyle = MID;
    const far = camX * 0.3;
    for (let i = Math.floor(far / 90) - 1; i < (far + viewW) / 90 + 1; i++) {
      const h = 60 + ((i * 37) % 5) * 18;
      ctx.fillRect(i * 90 - far, GROUND - 40 - h, 80, h + 40);
    }

    // Road.
    ctx.fillStyle = DARK;
    ctx.fillRect(0, GROUND, viewW, VIEW_H - GROUND);
    ctx.fillStyle = INK;
    ctx.fillRect(0, GROUND, viewW, 3);
    ctx.fillStyle = MID;
    for (let x = -(camX % 60); x < viewW; x += 60) ctx.fillRect(x, GROUND + 26, 30, 3);
  }

  function drawHero(sx, y) {
    ctx.save();
    ctx.translate(sx, y);
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'round';

    // Board and wheels.
    ctx.fillRect(-20, -8, 40, 4);
    ctx.beginPath(); ctx.arc(-13, -2, 3, 0, 7); ctx.arc(13, -2, 3, 0, 7); ctx.fill();

    // Legs, body, arms.
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, -9); ctx.lineTo(-4, -28);
    ctx.moveTo(8, -9); ctx.lineTo(3, -28);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, -52); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -48); ctx.lineTo(-14, -38);
    ctx.moveTo(0, -48); ctx.lineTo(14, -40);
    ctx.stroke();

    // Pale deadpan face.
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.arc(0, -62, 8, 0, 7); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(2, -64, 2, 2);
    ctx.fillRect(1, -58, 5, 1);

    // Flat porkpie hat.
    ctx.fillRect(-11, -70, 22, 3);
    ctx.fillRect(-7, -76, 14, 6);
    ctx.restore();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const heroScreenX = viewW * 0.3;
    drawBackground(hero.x - heroScreenX);
    drawHero(heroScreenX, hero.y);

    ctx.fillStyle = INK;
    ctx.font = '16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAP TO JUMP', viewW / 2, 40);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
