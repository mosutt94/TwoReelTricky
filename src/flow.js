// Scenes: title card, film-leader countdown, reel intertitles, the run itself, iris-out and THE END.
(function () {
  const ctx = G.ctx, H = G.VIEW_H;
  const REEL_SECONDS = 60;
  const W = () => G.viewW;
  const play = G.play;
  const playHandlers = Object.assign({}, G.handlers);

  let scene = 'title', sceneT = 0, reel = 1, titleCam = 0, lastCount = 0;
  let best = 0, newBest = false, nabbed = false;
  // When the falling houses turn up, in seconds into each reel.
  const FACADES = { 1: [24], 2: [12, 40] };
  try { best = +localStorage.getItem('trt-best') || 0; } catch (e) { /* storage unavailable */ }
  G.clock = null;

  const CARDS = {
    1: ['REEL ONE', 'In which our hero borrows', 'a plank on wheels.'],
    2: ['REEL TWO', 'In which matters grow', 'considerably worse.'],
  };

  function go(name) { scene = name; sceneT = 0; }
  function startRun() {
    play.reset();
    G.clock = null; newBest = false; lastCount = 0; nabbed = false;
    G.audio.setTempo(100);
    go('leader');
  }
  function showCard(r) { reel = r; go('card'); }
  function beginReel() {
    G.clock = { reel, left: REEL_SECONDS, facades: FACADES[reel].slice() };
    G.audio.setTempo(reel === 1 ? 100 : 112);
    G.audio.setClatter(true);
    go('play');
  }
  function finish() {
    const s = G.getScore();
    if (s > best) {
      best = s; newBest = true;
      try { localStorage.setItem('trt-best', String(best)); } catch (e) { /* ignore */ }
    }
    G.audio.setClatter(false);
    G.audio.setTempo(92);
    go('end');
  }

  // ---- Input: the mute button and scene changes come first; everything else goes to the skater.
  function muteRect() { return { x: W() - 46, y: scene === 'play' ? 62 : 14, w: 34, h: 28 }; }
  function muteHit() {
    const r = muteRect(), i = G.input;
    return i.fx > r.x - 6 && i.fx < r.x + r.w + 6 && i.fy > r.y - 6 && i.fy < r.y + r.h + 6;
  }
  G.handlers.press = () => {
    G.audio.start();
    if (muteHit()) { G.audio.toggleMute(); G.input.consumed = true; return; }
    if (scene === 'play') return playHandlers.press();
    if (scene === 'title') startRun();
    else if (scene === 'card' && sceneT > 0.6) beginReel();
    else if (scene === 'end' && sceneT > 1.2) startRun();
    G.input.consumed = true;   // a tap that changes the scene shouldn't also make him jump
  };
  G.handlers.release = () => { if (scene === 'play') playHandlers.release(); };
  G.handlers.swipe = (d) => { if (scene === 'play') playHandlers.swipe(d); };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') { G.audio.start(); G.audio.toggleMute(); }
  });

  // ---- Update
  function update(dt) {
    sceneT += dt;
    if (scene === 'title') {
      titleCam += dt * 70;
    } else if (scene === 'leader') {
      const n = 3 - Math.floor(sceneT / 0.8);
      if (n !== lastCount && n > 0) { lastCount = n; G.sfx('tick'); }
      if (sceneT >= 2.4) showCard(1);
    } else if (scene === 'card') {
      if (sceneT > 3.4) beginReel();
    } else if (scene === 'play') {
      play.update(dt);
      G.clock.left -= dt;
      const c = G.clock;
      if (c.facades.length && REEL_SECONDS - c.left >= c.facades[0]) { c.facades.shift(); G.world.wantFacade = true; }
      if (G.chase.nabT() > 1.8) { nabbed = true; go('iris'); return; }
      // Let a trick in progress finish before the reel runs out.
      if (G.clock.left <= 0 && (play.settled() || G.clock.left < -3)) {
        play.bank();
        if (G.clock.reel === 1) showCard(2);
        else go('iris');
      }
    } else if (scene === 'iris') {
      if (sceneT > 1.7) finish();
    }
  }

  // ---- Drawing helpers
  function decoCard(x, y, w, h) {
    ctx.fillStyle = 'rgba(23,19,13,0.94)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = G.PAPER; ctx.lineWidth = 1.6;
    ctx.strokeRect(x + 7, y + 7, w - 14, h - 14);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + 11, y + 11, w - 22, h - 22);
    // Art-deco fans in the corners and diamonds on the long edges.
    [[x + 11, y + 11, 0], [x + w - 11, y + 11, 1], [x + w - 11, y + h - 11, 2], [x + 11, y + h - 11, 3]].forEach(([cx, cy, k]) => {
      for (let r = 6; r <= 18; r += 6) {
        ctx.beginPath(); ctx.arc(cx, cy, r, k * Math.PI / 2, (k + 1) * Math.PI / 2); ctx.stroke();
      }
    });
    ctx.fillStyle = G.PAPER;
    [[x + w / 2, y + 9], [x + w / 2, y + h - 9]].forEach(([cx, cy]) => {
      ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 7, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 7, cy); ctx.closePath(); ctx.fill();
    });
  }
  function divider(cx, y, half) {
    ctx.strokeStyle = G.PAPER; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 8, y); ctx.moveTo(cx + 8, y); ctx.lineTo(cx + half, y); ctx.stroke();
    ctx.fillStyle = G.PAPER;
    ctx.beginPath(); ctx.arc(cx, y, 2.5, 0, 7); ctx.fill();
  }
  function text(str, x, y, font, color, maxW) {
    ctx.font = font; ctx.fillStyle = color || G.PAPER;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y, maxW);
  }
  const blink = (t) => (Math.floor(t * 2.2) % 2 === 0);

  function iris(cx, cy, r) {
    ctx.fillStyle = '#0b0a08';
    ctx.beginPath();
    ctx.rect(-10, -10, W() + 20, H + 20);
    ctx.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2, true);
    ctx.fill();
  }

  function drawMute() {
    const r = muteRect();
    ctx.fillStyle = 'rgba(23,19,13,0.8)';
    G.roundRect(r.x, r.y, r.w, r.h, 4); ctx.fill();
    const x = r.x + 9, y = r.y + r.h / 2;
    ctx.fillStyle = G.PAPER;
    ctx.beginPath(); ctx.moveTo(x - 3, y - 3); ctx.lineTo(x, y - 3); ctx.lineTo(x + 5, y - 8); ctx.lineTo(x + 5, y + 8); ctx.lineTo(x, y + 3); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = G.PAPER; ctx.lineWidth = 1.5;
    if (G.audio.muted) {
      ctx.beginPath(); ctx.moveTo(x + 9, y - 4); ctx.lineTo(x + 16, y + 4); ctx.moveTo(x + 16, y - 4); ctx.lineTo(x + 9, y + 4); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x + 6, y, 5, -0.8, 0.8); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 6, y, 9, -0.8, 0.8); ctx.stroke();
    }
  }

  // ---- Scenes
  function drawTitle(t) {
    const w = W();
    G.drawBackground(titleCam);
    G.drawForeground(titleCam);
    ctx.fillStyle = 'rgba(11,10,8,0.3)'; ctx.fillRect(0, 0, w, H);

    // On a wide screen the card sits to the right so our hero can be seen rolling along.
    const wide = w >= 700;
    const cw = wide ? 440 : Math.min(w - 50, 470), ch = 236, y = 16;
    const x = wide ? w - cw - 58 : w / 2 - cw / 2;
    decoCard(x, y, cw, ch);
    text('TWO REEL', x + cw / 2, y + 66, '34px ' + G.TITLE_FONT);
    text('TRICKY', x + cw / 2, y + 118, '54px ' + G.TITLE_FONT);
    divider(x + cw / 2, y + 136, Math.min(150, cw / 2 - 30));
    text('A Photoplay in Two Reels', x + cw / 2, y + 160, '15px ' + G.BODY_FONT);
    text('featuring Our Hero, His Hat, and a Plank on Wheels', x + cw / 2, y + 180, '12px ' + G.BODY_FONT, G.LIGHT, cw - 40);
    if (blink(t)) text('TAP TO ROLL FILM', x + cw / 2, y + 210, '15px ' + G.BODY_FONT);
    G.hero.push = (t % 2.6) < 0.6 ? (t % 2.6) / 0.6 : -1;
    G.drawHero(G.hero, w * 0.3, t);
    if (best > 0) {
      ctx.fillStyle = 'rgba(23,19,13,0.85)';
      G.roundRect(w / 2 - 80, H - 40, 160, 26, 4); ctx.fill();
      text('BEST SCORE  ' + G.fmt(best), w / 2, H - 22, G.NUM_FONT.replace('{s}', 13));
    }
  }

  function drawLeader() {
    const w = W(), cx = w / 2, cy = H / 2;
    const n = Math.max(1, 3 - Math.floor(sceneT / 0.8)), p = (sceneT % 0.8) / 0.8;
    ctx.fillStyle = '#bfb59c'; ctx.fillRect(0, 0, w, H);
    ctx.fillStyle = '#8c836c';
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, w, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = G.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, 7); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 104, 0, 7); ctx.stroke();
    ctx.font = G.NUM_FONT.replace('{s}', 130); ctx.fillStyle = G.INK;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(n), cx, cy + 4);
    ctx.textBaseline = 'alphabetic';
  }

  function drawCard() {
    const w = W(), lines = CARDS[reel];
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, w, H);
    decoCard(16, 16, w - 32, H - 32);
    text(lines[0], w / 2, H / 2 - 34, '46px ' + G.TITLE_FONT);
    divider(w / 2, H / 2 - 12, 110);
    text(lines[1], w / 2, H / 2 + 24, '21px ' + G.BODY_FONT);
    text(lines[2], w / 2, H / 2 + 50, '21px ' + G.BODY_FONT);
    if (sceneT > 0.6) text('tap to continue', w / 2, H - 34, '12px ' + G.BODY_FONT, G.MID);
  }

  function drawEnd(t) {
    const w = W(), s = G.getScore();
    ctx.fillStyle = '#0b0a08'; ctx.fillRect(0, 0, w, H);
    decoCard(16, 16, w - 32, H - 32);
    text(nabbed ? 'NABBED!' : 'THE END', w / 2, 96, '54px ' + G.TITLE_FONT);
    if (nabbed) text('Collared by the constabulary.', w / 2, 124, '14px ' + G.BODY_FONT, G.LIGHT);
    else divider(w / 2, 118, 120);
    text('FINAL SCORE', w / 2, 150, '14px ' + G.BODY_FONT, G.LIGHT);
    text(G.fmt(s), w / 2, 190, G.NUM_FONT.replace('{s}', 38));
    if (newBest && s > 0) { if (blink(t)) text('A NEW RECORD!', w / 2, 218, '17px ' + G.BODY_FONT); }
    else text('BEST  ' + G.fmt(best), w / 2, 218, G.NUM_FONT.replace('{s}', 14), G.LIGHT);
    text('Biggest combo  ' + G.fmt(G.stats.bestCombo) + '     ·     Pratfalls  ' + G.stats.bails,
      w / 2, 252, G.NUM_FONT.replace('{s}', 13), G.LIGHT, w - 80);
    if (sceneT > 1.2 && blink(t)) text('TAP TO ROLL IT AGAIN', w / 2, H - 46, '16px ' + G.BODY_FONT);
  }

  function render(t, dt) {
    G.beginFrame(t);
    if (scene === 'title') drawTitle(t);
    else if (scene === 'leader') drawLeader();
    else if (scene === 'card') drawCard();
    else if (scene === 'end') drawEnd(t);
    else {
      const hx = play.draw(t, scene === 'play'), hy = G.hero.y - 40;
      if (scene === 'play' && sceneT < 0.9) iris(hx, hy, Math.pow(sceneT / 0.9, 2) * W());
      if (scene === 'iris') {
        iris(hx, hy, Math.pow(Math.max(0, 1 - sceneT / 1.1), 2) * W());
        if (sceneT > 1.1) text(nabbed ? 'NABBED!' : 'THE END', W() / 2, H / 2 + 14, '40px ' + G.TITLE_FONT, G.PAPER);
      }
    }
    if (scene === 'title' || scene === 'play') drawMute();
    G.endFrame(t, dt);
  }

  // If anything ever breaks mid-picture, say so and offer a fresh reload instead of freezing.
  function jammed(err) {
    const card = document.getElementById('jammed');
    card.querySelector('small').textContent = String(err && err.message || err);
    card.hidden = false;
    card.addEventListener('pointerup', () => { location.href = location.pathname + '?r=' + Date.now(); });
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 30);
    last = now;
    try {
      update(dt);
      render(now / 1000, dt);
    } catch (err) {
      jammed(err);
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  G.flow = { get scene() { return scene; }, skipTo(name) { if (name === 'end') { finish(); } } };
})();
