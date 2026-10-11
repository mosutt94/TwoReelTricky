// The hero: a slim, stone-faced fellow in a flat porkpie hat, waistcoat and shirtsleeves, drawn
// in the bendy "rubber hose" manner of 1920s cartoons so every pose reads at a glance.
(function () {
  const ctx = G.ctx;
  const SKIN = '#f3e9d3', TROUSERS = '#4d4538', VEST = '#1f1a13';

  // Flat porkpie: wide flat brim, low crown with a telescoped top and a dark ribbon band.
  G.drawHat = function (x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(0, 0, 13.5, 2.1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d271e';
    ctx.beginPath();
    ctx.moveTo(-7.5, 0); ctx.lineTo(-7.2, -6.2); ctx.quadraticCurveTo(0, -7.6, 7.2, -6.2); ctx.lineTo(7.5, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = G.INK; ctx.fillRect(-7.5, -2.8, 15, 2.2);
    ctx.strokeStyle = G.MID; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-5.6, -5.4); ctx.quadraticCurveTo(0, -6.5, 5.6, -5.4); ctx.stroke();
    ctx.restore();
  };

  // Board in local space: deck centre at y = -6, wheels touching y = 0.
  // flip = kickflip angle (about its long axis), spin = shove-it angle (about the vertical).
  function drawBoard(flip, spin, dy) {
    ctx.save();
    ctx.translate(0, -6 + (dy || 0));
    const sy = Math.cos(flip || 0), sx = Math.cos(spin || 0);
    ctx.scale(Math.abs(sx) < 0.05 ? 0.05 : sx, Math.abs(sy) < 0.08 ? 0.08 : sy);
    ctx.fillStyle = G.INK;
    ctx.fillRect(-17, 1.5, 7, 2); ctx.fillRect(10, 1.5, 7, 2);
    for (const wx of [-13.5, 13.5]) {
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(wx, 4.6, 2.7, 0, 7); ctx.fill();
      ctx.fillStyle = G.MID; ctx.beginPath(); ctx.arc(wx, 4.6, 0.9, 0, 7); ctx.fill();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = G.INK; ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(-24, -3.5); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(24, -3.5); ctx.stroke();
    ctx.strokeStyle = sy >= 0 ? '#8a7a5c' : G.LIGHT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-23, -3.2); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(23, -3.2); ctx.stroke();
    ctx.restore();
  }
  G.drawLooseBoard = function (x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); drawBoard(0, 0, 0); ctx.restore();
  };

  // A smooth bendy limb from a through joint b to c, drawn as an inked outline with a fill.
  function hose(ax, ay, bx, by, cx, cy, outer, inner, color) {
    const qx = 2 * bx - (ax + cx) / 2, qy = 2 * by - (ay + cy) / 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, cx, cy);
    ctx.strokeStyle = G.INK; ctx.lineWidth = outer; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = inner; ctx.stroke();
  }
  function leg(fx, fy, hx, hy, bend, shade) {
    const kx = (fx + hx) / 2 + bend, ky = (fy + hy) / 2;
    hose(hx, hy, kx, ky, fx, fy - 3, 8.5, 6.2, shade ? '#3f382d' : TROUSERS);
    ctx.fillStyle = G.INK;                                     // long flat slap shoe
    ctx.beginPath(); ctx.ellipse(fx + 3, fy - 1.8, 7, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(239,230,208,0.35)';
    ctx.beginPath(); ctx.ellipse(fx + 5, fy - 2.8, 2.4, 0.7, 0, 0, Math.PI * 2); ctx.fill();
  }
  function arm(sx, sy, hx, hy, droop) {
    const ex = (sx + hx) / 2 - 1.5, ey = (sy + hy) / 2 + droop;
    hose(sx, sy, ex, ey, hx, hy, 5.6, 3.6, G.PAPER);           // white shirtsleeve
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(hx, hy, 2.5, 0, 7); ctx.fill(); ctx.stroke();
  }

  // Hand targets (relative to the shoulder) for each arm pose: [backX, backY, frontX, frontY].
  const ARM_POSES = {
    relaxed: [-5, 19, 7, 18],
    out: [-21, 3, 21, -3],
    flail: [-15, -17, 16, -14],
    grab: [-18, -6, 8, 34],
    push: [-12, 14, 12, 8],
  };

  // Draws the hero with feet on the board at (sx, h.y). Reads the pose fields set by skate.js.
  G.drawHero = function (h, sx, t) {
    ctx.save();
    ctx.translate(sx, h.y);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    const pushing = h.push >= 0 && h.state === 'ground';
    if (h.state === 'bail') {
      ctx.rotate(h.bailRot);                   // falls flat like a plank, pivoting at the feet
    } else {
      ctx.rotate(h.tilt);
      if (h.state === 'manual') { ctx.translate(-14, 0); ctx.rotate(-0.24); ctx.translate(14, 0); }
      drawBoard(h.board.flip, h.board.spin, h.board.dy);
    }

    const c = h.crouch + (pushing ? 0.3 * Math.sin(h.push * Math.PI) : 0);
    const lift = h.board.dy ? -h.board.dy * 0.7 : 0;
    const bob = h.state === 'ground' ? Math.sin(t * 7) * 0.5 : 0;
    const footY = -9 + lift;
    const lean = (h.lean || 0) + (pushing ? 3 * Math.sin(h.push * Math.PI) : 0);
    const hipX = 0, hipY = -38 + c * 13 + lift + bob;
    const bend = 4 + c * 9;

    // Back foot: on the board, or kicking the street when pushing along.
    let bfx = -10, bfy = footY;
    if (pushing) {
      const p = h.push;
      if (p < 0.25) { bfx = G.lerp(-10, -5, p / 0.25); bfy = G.lerp(footY, 0, p / 0.25); }
      else if (p < 0.7) { bfx = G.lerp(-5, -30, (p - 0.25) / 0.45); bfy = 0; }
      else { const q = (p - 0.7) / 0.3; bfx = G.lerp(-30, -10, q); bfy = G.lerp(0, footY, q) - Math.sin(q * Math.PI) * 6; }
    }
    leg(bfx, bfy, hipX - 1, hipY, pushing ? 2 : bend, true);

    // Torso: dark waistcoat over a white shirt, stiff collar and a skinny tie.
    const shx = hipX + 3 + lean, shy = hipY - 22;
    const pose = ARM_POSES[pushing && h.arms === 'relaxed' ? 'push' : h.arms] || ARM_POSES.relaxed;
    const wob = Math.sin(t * (h.arms === 'flail' ? 17 : 6)) * (h.arms === 'relaxed' ? 1.2 : 3) + (h.bal || 0) * 6;
    if (!h.hands) h.hands = pose.slice();
    for (let i = 0; i < 4; i++) h.hands[i] = G.lerp(h.hands[i], pose[i], 0.25);
    arm(shx - 2, shy + 3, shx + h.hands[0], shy + h.hands[1] + wob, 3);      // far arm, behind

    ctx.fillStyle = G.PAPER; ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hipX - 6, hipY + 2); ctx.lineTo(hipX + 6.5, hipY + 2);
    ctx.lineTo(shx + 6.5, shy + 1); ctx.lineTo(shx - 6, shy + 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = VEST;
    ctx.beginPath();
    ctx.moveTo(hipX - 6, hipY + 3); ctx.lineTo(hipX + 6.5, hipY + 3);
    ctx.lineTo(shx + 6, shy + 6); ctx.lineTo(shx + 2.5, shy + 2); ctx.lineTo(shx - 6, shy + 2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = G.LIGHT;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(G.lerp(shx + 4.6, hipX + 5, (k + 1) / 4), G.lerp(shy + 6, hipY + 3, (k + 1) / 4), 0.8, 0, 7); ctx.fill();
    }

    leg(9, footY, hipX + 1, hipY, bend, false);

    const flutter = h.state === 'air' ? 1 : h.state === 'grind' ? 0.6 : 0.2;
    const tw = Math.sin(t * 22) * flutter;
    ctx.strokeStyle = G.INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(shx + 3, shy + 1.5);
    ctx.quadraticCurveTo(shx + 3 - flutter * 3, shy + 6, shx + 3 - flutter * 7, shy + 9 + tw); ctx.stroke();
    ctx.fillStyle = G.PAPER; ctx.strokeStyle = G.INK; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(shx - 2, shy - 1); ctx.lineTo(shx + 5.5, shy - 1); ctx.lineTo(shx + 4, shy + 2.5); ctx.lineTo(shx - 1, shy + 2.5); ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Head in profile facing right: slicked hair, big solemn eye, flat brow, straight mouth.
    const hx = shx + 2, hy = shy - 12;
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(hx - 1.6, hy - 1.4, 7.6, 8.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy - 7.5);
    ctx.bezierCurveTo(hx + 6, hy - 9.5, hx + 8.5, hy - 3, hx + 8.2, hy + 0.5);   // brow to nose
    ctx.lineTo(hx + 9.6, hy + 2.6);
    ctx.lineTo(hx + 8.1, hy + 3.4);
    ctx.bezierCurveTo(hx + 8.4, hy + 6.5, hx + 6.5, hy + 9.6, hx + 2, hy + 9.4);   // chin
    ctx.bezierCurveTo(hx - 2.5, hy + 9, hx - 4.5, hy + 5, hx - 4.6, hy + 1);       // jaw
    ctx.lineTo(hx - 4, hy - 4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SKIN;                                                           // ear
    ctx.beginPath(); ctx.ellipse(hx - 3.6, hy + 0.8, 1.8, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const blink = (t % 3.7) < 0.12 && h.state !== 'bail';
    const look = h.hatLift > 4 ? -1.1 : 0;
    if (blink) {
      ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 2.4, hy - 0.6); ctx.lineTo(hx + 6.4, hy - 0.6); ctx.stroke();
    } else {
      ctx.fillStyle = '#fbf6ea';
      ctx.beginPath(); ctx.ellipse(hx + 4.4, hy - 0.6, 2.3, 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = G.INK;
      ctx.beginPath(); ctx.arc(hx + 5.1, hy - 0.4 + look, 1.45, 0, 7); ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(hx + 4.4, hy - 0.6, 2.4, 2, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    }
    ctx.lineWidth = 1.7;                                                             // heavy level brow
    ctx.beginPath(); ctx.moveTo(hx + 1.6, hy - 3.6); ctx.lineTo(hx + 7, hy - 3.4); ctx.stroke();
    ctx.lineWidth = 1.1;                                                             // not a hint of a smile
    ctx.beginPath(); ctx.moveTo(hx + 4.2, hy + 5.4); ctx.lineTo(hx + 7.4, hy + 5.4); ctx.stroke();

    arm(shx + 1, shy + 3, shx + h.hands[2], shy + h.hands[3] - wob, 2.5);   // near arm, in front

    if (h.hatOn) G.drawHat(hx + 0.5, hy - 8.5 - h.hatLift, -0.07 + h.hatSpin);
    ctx.restore();
  };

  // Where the hat sits when the hero stands upright (relative to his feet), for the hat-drop gag.
  G.HAT_SPOT = { x: 7.5, y: -80 };
})();
