// The hero: a stone-faced fellow in a flat porkpie hat, built from simple shapes so he can be posed.
(function () {
  const ctx = G.ctx;

  // Flat porkpie: wide flat brim, low crown with a telescoped top and a ribbon band.
  G.drawHat = function (x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(0, 0, 12.5, 1.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b251c';
    ctx.fillRect(-6.5, -6.2, 13, 6.2);
    ctx.fillStyle = G.INK;
    ctx.fillRect(-6.5, -2.6, 13, 1.9);
    ctx.fillStyle = G.MID;
    ctx.fillRect(-5, -6.2, 10, 0.9);
    ctx.restore();
  };

  // Board in local space: deck centre at y = -6, wheels touching y = 0.
  // flip = kickflip angle (spins about its long axis), spin = shove-it angle (about the vertical).
  function drawBoard(flip, spin, dy) {
    ctx.save();
    ctx.translate(0, -6 + (dy || 0));
    const sy = Math.cos(flip || 0), sx = Math.cos(spin || 0);
    ctx.scale(Math.abs(sx) < 0.05 ? 0.05 : sx, Math.abs(sy) < 0.08 ? 0.08 : sy);
    ctx.fillStyle = G.INK;
    ctx.fillRect(-17, 1.5, 7, 2);
    ctx.fillRect(10, 1.5, 7, 2);
    ctx.beginPath(); ctx.arc(-13.5, 4.6, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(13.5, 4.6, 2.6, 0, 7); ctx.fill();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = G.INK; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(-24, -3.5); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(24, -3.5); ctx.stroke();
    ctx.strokeStyle = sy >= 0 ? G.DARK : G.LIGHT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-23, -3.2); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(23, -3.2); ctx.stroke();
    ctx.restore();
  }
  G.drawLooseBoard = function (x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); drawBoard(0, 0, 0); ctx.restore();
  };

  function leg(fx, fy, hx, hy, bend) {
    const kx = (fx + hx) / 2 + bend, ky = (fy + hy) / 2;
    ctx.strokeStyle = G.SHADOW; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy - 2); ctx.stroke();
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(fx + 2, fy - 1.5, 5, 2.3, 0, 0, Math.PI * 2); ctx.fill();
  }

  function arm(sx, sy, hx, hy) {
    const ex = (sx + hx) / 2 - 1, ey = (sy + hy) / 2 + 3;
    ctx.strokeStyle = G.INK; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = G.PAPER; ctx.strokeStyle = G.INK; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(hx, hy, 2.3, 0, 7); ctx.fill(); ctx.stroke();
  }

  // Hand targets (relative to the shoulder) for each arm pose: [backX, backY, frontX, frontY].
  const ARM_POSES = {
    relaxed: [-6, 17, 8, 15],
    out: [-19, 2, 19, -2],
    flail: [-14, -15, 15, -12],
    grab: [-17, -4, 6, 30],
  };

  // Draws the hero with feet on the board at (sx, h.y). Reads pose fields set by the game rules.
  G.drawHero = function (h, sx, t) {
    ctx.save();
    ctx.translate(sx, h.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    if (h.state === 'bail') {
      ctx.rotate(h.bailRot);   // falls flat like a plank, pivoting at the feet
    } else {
      ctx.rotate(h.tilt);
      if (h.state === 'manual') {           // nose up, balanced on the back wheels
        ctx.translate(-14, 0); ctx.rotate(-0.24); ctx.translate(14, 0);
      }
      drawBoard(h.board.flip, h.board.spin, h.board.dy);
    }

    const c = h.crouch;
    const lift = h.board.dy ? -h.board.dy * 0.6 : 0;
    const footY = -9 + lift;
    const hipX = -1, hipY = -37 + c * 12 + lift;
    const bend = 3 + c * 8;
    leg(-10, footY, hipX, hipY, bend);
    leg(9, footY, hipX + 1, hipY, bend);

    const shx = hipX + 4 + h.lean, shy = hipY - 21;
    ctx.fillStyle = G.INK;
    ctx.beginPath();
    ctx.moveTo(hipX - 6, hipY + 3); ctx.lineTo(hipX + 6, hipY + 3);
    ctx.lineTo(shx + 6, shy + 1); ctx.lineTo(shx - 6, shy + 1);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = G.PAPER;
    ctx.beginPath(); ctx.moveTo(shx, shy + 1); ctx.lineTo(shx + 5, shy + 1); ctx.lineTo(shx + 3, shy + 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(shx + 2.6, shy + 1); ctx.lineTo(shx + 3, shy + 7); ctx.stroke();

    // Arms ease toward the current pose's targets, with a little wobble.
    const pose = ARM_POSES[h.arms] || ARM_POSES.relaxed;
    const wob = Math.sin(t * (h.arms === 'flail' ? 18 : 6)) * (h.arms === 'relaxed' ? 1.5 : 3);
    if (!h.hands) h.hands = pose.slice();
    for (let i = 0; i < 4; i++) h.hands[i] = G.lerp(h.hands[i], pose[i], 0.25);
    arm(shx - 1, shy + 3, shx + h.hands[0], shy + h.hands[1] + wob);
    arm(shx + 1, shy + 3, shx + h.hands[2], shy + h.hands[3] - wob);

    // Head in profile facing right: slicked hair, pale face, flat brow, flat mouth.
    const hx = shx + 2, hy = shy - 9;
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(hx - 1.2, hy - 1.2, 6.4, 7.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = G.PAPER; ctx.strokeStyle = G.INK; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(hx + 1, hy, 6, 7.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = G.INK;
    ctx.fillRect(hx + 3, hy - 1.6, 1.8, 2);
    ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(hx + 1.5, hy - 3.6); ctx.lineTo(hx + 5.8, hy - 3.4); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(hx + 2.8, hy + 3.6); ctx.lineTo(hx + 5.6, hy + 3.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hx + 6.7, hy - 1.2); ctx.lineTo(hx + 8, hy + 1.6); ctx.lineTo(hx + 6.6, hy + 1.9); ctx.stroke();
    ctx.strokeStyle = G.MID;
    ctx.beginPath(); ctx.arc(hx - 1.2, hy + 0.5, 1.6, -1.2, 1.6); ctx.stroke();

    if (h.hatOn) G.drawHat(hx + 0.5, hy - 6.6 - h.hatLift, -0.06 + h.hatSpin);
    ctx.restore();
  };

  // Where the hat sits when the hero stands upright (relative to his feet), for the hat-drop gag.
  G.HAT_SPOT = { x: 5.5, y: -72.5 };
})();
