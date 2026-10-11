// The hero: a slight, stone-faced fellow in a porkpie hat, drawn in the inked rubber-hose manner
// of 1920s cartoons: a big head so the face reads on a phone, a three-quarter face with pie-cut
// eyes under one heavy level brow, a thick even outline and flat fills. Every part is posed from
// the fields skate.js sets (crouch, arms, tilt, board, hat...), so he can skate, flip and flop.
(function () {
  const ctx = G.ctx;
  const SKIN = '#f1e6cf', TROUSERS = '#504739', VEST = '#1d1812', SHIRT = '#f4ecd9', LINE = 1.7;

  // Flat porkpie: wide flat brim, low crown with a telescoped top and a dark ribbon band.
  G.drawHat = function (x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#2a241b'; ctx.strokeStyle = G.INK; ctx.lineWidth = LINE;
    ctx.beginPath();
    ctx.moveTo(-9, 0); ctx.lineTo(-8.6, -6.6); ctx.quadraticCurveTo(0, -8.2, 8.6, -6.6); ctx.lineTo(9, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = G.INK;
    ctx.beginPath(); ctx.ellipse(0, 0, 15, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(-9, -3.1, 18, 2.4);
    ctx.strokeStyle = 'rgba(239,230,208,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6.5, -5.9); ctx.quadraticCurveTo(0, -7, 6.5, -5.9); ctx.stroke();
    ctx.restore();
  };

  // Board in local space: deck centre at y = -6, wheels touching y = 0.
  function drawBoard(flip, spin, dy) {
    ctx.save();
    ctx.translate(0, -6 + (dy || 0));
    const sy = Math.cos(flip || 0), sx = Math.cos(spin || 0);
    ctx.scale(Math.abs(sx) < 0.05 ? 0.05 : sx, Math.abs(sy) < 0.08 ? 0.08 : sy);
    ctx.fillStyle = G.INK;
    ctx.fillRect(-17, 1.5, 7, 2); ctx.fillRect(10, 1.5, 7, 2);
    for (const wx of [-13.5, 13.5]) {
      ctx.fillStyle = G.INK; ctx.beginPath(); ctx.arc(wx, 4.6, 2.8, 0, 7); ctx.fill();
      ctx.fillStyle = G.MID; ctx.beginPath(); ctx.arc(wx, 4.6, 1, 0, 7); ctx.fill();
    }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = G.INK; ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(-24, -3.5); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(24, -3.5); ctx.stroke();
    ctx.strokeStyle = sy >= 0 ? '#8a7a5c' : G.LIGHT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-23, -3.2); ctx.lineTo(-18, 0); ctx.lineTo(18, 0); ctx.lineTo(23, -3.2); ctx.stroke();
    ctx.restore();
  }
  G.drawLooseBoard = function (x, y, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); drawBoard(0, 0, 0); ctx.restore();
  };

  // A soft shadow on whatever he is above, shrinking and fading with height.
  G.drawShadow = function (x, floorY, height) {
    const k = G.clamp(1 - height / 260, 0.25, 1);
    ctx.fillStyle = 'rgba(23,19,13,' + (0.28 * k) + ')';
    ctx.beginPath(); ctx.ellipse(x, floorY + 1, 20 * k + 4, 3.2 * k + 1, 0, 0, Math.PI * 2); ctx.fill();
  };

  // A bendy limb from a through the joint b to c: an ink outline with a flat fill.
  function hose(ax, ay, bx, by, cx, cy, width, color) {
    const qx = 2 * bx - (ax + cx) / 2, qy = 2 * by - (ay + cy) / 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(qx, qy, cx, cy);
    ctx.strokeStyle = G.INK; ctx.lineWidth = width + LINE * 2; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function shoe(fx, fy, lift) {
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(-(lift || 0));
    ctx.fillStyle = G.INK;
    ctx.beginPath();
    ctx.moveTo(-6, -4.5); ctx.lineTo(5, -4.5); ctx.quadraticCurveTo(10.5, -4.5, 10.5, -1.5);
    ctx.quadraticCurveTo(10.5, 0.3, 8, 0.3); ctx.lineTo(-6, 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(239,230,208,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-5, -0.8); ctx.lineTo(8, -0.8); ctx.stroke();
    ctx.restore();
  }
  function leg(fx, fy, hx, hy, bend, lift) {
    const kx = (fx + hx) / 2 + bend, ky = (fy + hy) / 2 + 1;
    hose(hx, hy, kx, ky, fx, fy - 2.5, 7.5, TROUSERS);
    shoe(fx, fy, lift);
  }
  function hand(x, y) {
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = LINE * 0.85;
    ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 2.6, y - 2.2, 1.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  function arm(sx, sy, hx, hy, droop) {
    const ex = (sx + hx) / 2 - 1.5, ey = (sy + hy) / 2 + droop;
    hose(sx, sy, ex, ey, hx, hy, 4.4, SHIRT);
    hand(hx, hy);
  }

  // Hand targets (relative to the shoulder) for each arm pose: [backX, backY, frontX, frontY].
  const ARM_POSES = {
    relaxed: [-4, 19, 7, 18],
    out: [-22, 2, 22, -4],
    flail: [-16, -18, 17, -15],
    grab: [-19, -7, 9, 36],
    push: [-13, 15, 13, 9],
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
      const fs = h.faceScale === undefined ? 1 : h.faceScale;      // turning round in the half-pipe
      if (fs !== 1) ctx.scale(Math.abs(fs) < 0.06 ? (fs < 0 ? -0.06 : 0.06) : fs, 1);
      if (h.state === 'manual') { ctx.translate(-14, 0); ctx.rotate(-0.24); ctx.translate(14, 0); }
      drawBoard(h.board.flip, h.board.spin, h.board.dy);
    }

    // A touch of squash and stretch, pivoting at the feet.
    const c = h.crouch + (pushing ? 0.3 * Math.sin(h.push * Math.PI) : 0);
    const stretch = h.state === 'air' ? G.clamp(-h.vy / 9000, -0.04, 0.05) : 0;
    const sy = 1 - c * 0.07 + stretch;
    ctx.scale(1 / Math.sqrt(sy), sy);

    const lift = h.board.dy ? -h.board.dy * 0.7 : 0;
    const bob = h.state === 'ground' ? Math.sin(t * 7) * 0.5 : 0;
    const footY = -9 + lift;
    const lean = (h.lean || 0) + (pushing ? 3 * Math.sin(h.push * Math.PI) : 0);
    const hipX = 0, hipY = -37 + c * 12 + lift + bob;
    const bend = 5 + c * 9;

    // Back foot: on the board, or kicking the street when pushing along.
    let bfx = -9, bfy = footY, bfl = 0;
    if (pushing) {
      const p = h.push;
      if (p < 0.25) { bfx = G.lerp(-9, -4, p / 0.25); bfy = G.lerp(footY, 0, p / 0.25); }
      else if (p < 0.7) { bfx = G.lerp(-4, -30, (p - 0.25) / 0.45); bfy = 0; }
      else { const q = (p - 0.7) / 0.3; bfx = G.lerp(-30, -9, q); bfy = G.lerp(0, footY, q) - Math.sin(q * Math.PI) * 6; bfl = Math.sin(q * Math.PI) * 0.5; }
    }

    const shx = hipX + 2.5 + lean, shy = hipY - 19;
    const pose = ARM_POSES[pushing && h.arms === 'relaxed' ? 'push' : h.arms] || ARM_POSES.relaxed;
    const wob = Math.sin(t * (h.arms === 'flail' ? 17 : 6)) * (h.arms === 'relaxed' ? 1.2 : 3) + (h.bal || 0) * 6;
    if (!h.hands) h.hands = pose.slice();
    for (let i = 0; i < 4; i++) h.hands[i] = G.lerp(h.hands[i], pose[i], 0.25);

    // Back to front: far arm, far leg, torso, near leg, head, near arm, hat.
    arm(shx - 2, shy + 4, shx + h.hands[0], shy + h.hands[1] + wob, 3);
    leg(bfx, bfy, hipX - 2, hipY, pushing ? 2 : bend, bfl);

    // Torso: white shirt under a dark waistcoat, with a stiff collar and a bow tie.
    ctx.fillStyle = SHIRT; ctx.strokeStyle = G.INK; ctx.lineWidth = LINE;
    ctx.beginPath();
    ctx.moveTo(hipX - 7.5, hipY + 3); ctx.lineTo(hipX + 7.5, hipY + 3);
    ctx.quadraticCurveTo(shx + 9, hipY - 6, shx + 8.5, shy);
    ctx.lineTo(shx - 8, shy);
    ctx.quadraticCurveTo(hipX - 9, hipY - 6, hipX - 7.5, hipY + 3);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = VEST;
    ctx.beginPath();
    ctx.moveTo(hipX - 7, hipY + 2.5); ctx.lineTo(hipX + 7, hipY + 2.5);
    ctx.quadraticCurveTo(shx + 8, hipY - 6, shx + 7.5, shy + 1);
    ctx.lineTo(shx + 4.5, shy + 1); ctx.lineTo(shx + 1.5, shy + 9); ctx.lineTo(shx - 1.5, shy + 1);
    ctx.lineTo(shx - 7.5, shy + 1);
    ctx.quadraticCurveTo(hipX - 8.5, hipY - 6, hipX - 7, hipY + 2.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = G.MID;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.arc(G.lerp(shx + 2.2, hipX + 1.5, (k + 1) / 4), G.lerp(shy + 9, hipY + 2, (k + 1) / 4), 0.9, 0, 7); ctx.fill();
    }

    leg(10, footY, hipX + 2, hipY, bend, 0);

    // Neck, collar and bow tie.
    const hx = shx + 2.5, hy = shy - 13.5;
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = LINE;
    ctx.fillRect(hx - 4, hy + 6, 7, 8);
    ctx.fillStyle = SHIRT;
    ctx.beginPath(); ctx.moveTo(shx - 5, shy); ctx.lineTo(shx + 5.5, shy); ctx.lineTo(shx + 2.5, shy + 4); ctx.lineTo(shx - 1, shy + 4); ctx.closePath();
    ctx.fill(); ctx.stroke();
    const tw = Math.sin(t * 22) * (h.state === 'air' ? 1 : 0.2);
    ctx.fillStyle = G.INK;
    ctx.beginPath();
    ctx.moveTo(shx + 1, shy + 2); ctx.lineTo(shx - 3, shy + 0.3 + tw); ctx.lineTo(shx - 3, shy + 3.7 + tw);
    ctx.lineTo(shx + 1, shy + 2); ctx.lineTo(shx + 5, shy + 0.3 - tw); ctx.lineTo(shx + 5, shy + 3.7 - tw);
    ctx.closePath(); ctx.fill();

    // Head in three-quarter view: an egg with a small chin, slicked hair at the back, one ear.
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = LINE;
    ctx.beginPath();
    ctx.moveTo(hx - 9.5, hy - 1);
    ctx.bezierCurveTo(hx - 9.5, hy - 11.5, hx + 9.5, hy - 11.5, hx + 9.8, hy - 1.5);
    ctx.bezierCurveTo(hx + 10, hy + 5, hx + 6, hy + 10.5, hx + 1, hy + 10.5);
    ctx.bezierCurveTo(hx - 5, hy + 10.5, hx - 9.5, hy + 6, hx - 9.5, hy - 1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d1812';                                                      // hair
    ctx.beginPath();
    ctx.moveTo(hx - 9.3, hy - 2);
    ctx.bezierCurveTo(hx - 9.5, hy - 10, hx + 2, hy - 12, hx + 7, hy - 9);
    ctx.lineTo(hx + 7.5, hy - 7.2); ctx.lineTo(hx + 4.5, hy - 8.2);
    ctx.bezierCurveTo(hx, hy - 9.6, hx - 6.5, hy - 8, hx - 7.2, hy - 1.5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = SKIN; ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2;                // ear
    ctx.beginPath(); ctx.ellipse(hx - 8.6, hy + 1.2, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // The Great Stone Face: two pie-cut eyes, half-lidded, under one heavy level brow; a small
    // nose on the contour; a short straight mouth. He blinks now and then and eyes the hat.
    const blink = (t % 3.7) < 0.12 && h.state !== 'bail';
    const look = h.hatLift > 4 ? -1.3 : 0;
    const eyes = [[hx + 5.6, hy - 0.6, 2.4, 3.1], [hx + 0.4, hy - 0.6, 2, 2.9]];
    for (const [ex, ey, rx, ry] of eyes) {
      if (blink) {
        ctx.strokeStyle = G.INK; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ex - rx, ey + 0.6); ctx.lineTo(ex + rx, ey + 0.6); ctx.stroke();
        continue;
      }
      ctx.fillStyle = G.INK;
      ctx.beginPath(); ctx.ellipse(ex, ey + look * 0.4, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = SKIN;                                                       // the heavy lid
      ctx.beginPath(); ctx.ellipse(ex, ey - ry - 0.9 + look * 0.4, rx + 1, ry * 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fbf6ea';                                                  // pie cut
      ctx.beginPath(); ctx.ellipse(ex + rx * 0.4, ey - 0.6 + look * 0.4, 0.8, 1, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = G.INK; ctx.lineWidth = 2.1; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(hx - 2.4, hy - 4.6); ctx.lineTo(hx + 8.6, hy - 4.6); ctx.stroke();
    ctx.lineCap = 'round'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(hx + 9.3, hy + 0.5); ctx.quadraticCurveTo(hx + 12, hy + 2.5, hx + 9.4, hy + 3.6); ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(hx + 3, hy + 6.3); ctx.lineTo(hx + 7.6, hy + 6.3); ctx.stroke();

    arm(shx + 2, shy + 4, shx + h.hands[2], shy + h.hands[3] - wob, 2.5);   // near arm, in front

    if (h.hatOn) G.drawHat(hx + 1, hy - 9.6 - h.hatLift, -0.05 + h.hatSpin);
    ctx.restore();
  };

  // Where the hat sits when the hero stands upright (relative to his feet), for the hat-drop gag.
  G.HAT_SPOT = { x: 8, y: -80 };
})();
