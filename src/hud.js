// On-screen cards: score, combo, reel clock, trick names, banners, the balance needle,
// first-run tips, and "hold to grind" labels over the first few rails.
(function () {
  const ctx = G.ctx, GR = G.GROUND, ui = G.ui;
  const TIPS = [
    'HOLD to crouch  ·  LET GO to ollie',
    'SWIPE in the air to flip  ·  swipe again for a double',
    'Keep HOLDING as you land on a rail to grind  ·  LET GO to pop',
    'On a rail, FLICK to pop off into a trick  ·  slide slowly to balance',
    'Land while HOLDING to manual  ·  it keeps the combo going',
    'Swipe UP for the Hat Trick  ·  swipe up and hold to grab',
  ];

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

  // A little gauge over his head: keep the needle out of the dark ends.
  function balanceMeter(x, y, bal) {
    const r = 24, span = Math.PI / 3;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(23,19,13,0.75)';
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2 - span, -Math.PI / 2 + span); ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = G.PAPER;
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2 - span * 0.7, -Math.PI / 2 + span * 0.7); ctx.stroke();
    const a = -Math.PI / 2 + G.clamp(bal, -1, 1) * span;
    ctx.strokeStyle = G.INK; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5)); ctx.stroke();
    ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
  }

  G.drawHUD = function (heroSX, camX, t) {
    const W = G.viewW, h = ui.hero, combo = ui.combo, time = ui.time;
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';

    // "Hold to grind" over the first few rails and clotheslines of a run.
    ctx.font = '11px ' + G.BODY_FONT; ctx.textAlign = 'center';
    for (const o of G.world.list) {
      if (!o.hint) continue;
      const x = o.x - camX + Math.min(o.w / 2, 60);
      if (x < -60 || x > W + 60) continue;
      const y = o.top - 16 + Math.sin(t * 5) * 2;
      plate(x - 46, y - 13, 92, 20);
      ctx.fillStyle = G.PAPER; ctx.fillText('HOLD TO GRIND', x, y + 1);
    }

    plate(12, 12, 132, 44);
    ctx.fillStyle = G.PAPER; ctx.textAlign = 'left';
    ctx.font = '10px ' + G.BODY_FONT; ctx.fillText('SCORE', 22, 28);
    ctx.font = G.NUM_FONT.replace('{s}', 20); ctx.fillText(G.fmt(ui.score), 22, 49);

    if (combo.mult) {
      let names = combo.names.slice(-3).join(' + ');
      if (combo.names.length > 3) names = '... + ' + names;
      ctx.font = '12px ' + G.BODY_FONT;
      const w = Math.min(W - 280, Math.max(ctx.measureText(names).width, 90) + 28);
      const cx = W / 2;
      plate(cx - w / 2, 12, w, 48);
      ctx.textAlign = 'center'; ctx.fillStyle = G.PAPER;
      ctx.fillText(names, cx, 30, w - 16);
      ctx.font = G.NUM_FONT.replace('{s}', 17);
      ctx.fillText(G.fmt(combo.base) + '  x  ' + combo.mult, cx, 51);
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

    if (h.state === 'grind' || h.state === 'manual') balanceMeter(heroSX + 4, h.y - 96, h.bal);

    ctx.textAlign = 'center';
    ctx.font = '14px ' + G.BODY_FONT;
    ui.popups.forEach((p, i) => {
      ctx.globalAlpha = 1 - p.t / 0.9;
      outlined(p.text, heroSX + 10, Math.min(h.y, GR) - 120 - p.t * 40 - (ui.popups.length - 1 - i) * 16);
    });
    ctx.globalAlpha = 1;

    const banner = ui.banner;
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

    // How-to tips cycle through during the opening of the first reel.
    if (time < 4.5 * TIPS.length && G.clock && G.clock.reel === 1) {
      const i = Math.floor(time / 4.5), k = time - i * 4.5;
      ctx.globalAlpha = Math.min(1, k * 4, (4.5 - k) * 4);
      const w = Math.min(W - 24, 470);
      plate(W / 2 - w / 2, G.VIEW_H - 44, w, 32);
      ctx.fillStyle = G.PAPER; ctx.font = '13px ' + G.BODY_FONT;
      ctx.fillText(TIPS[i], W / 2, G.VIEW_H - 23, w - 20);
      ctx.globalAlpha = 1;
    }
  };
})();
