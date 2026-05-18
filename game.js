const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const HALF_H = H / 2;
const FOV = Math.PI / 3;
const RAYS = 240;
const MAX_DEPTH = 18;
const TILE = 64;
const TURN_SPEED = 2.35;
const MOVE_SPEED = 3.15;

const map = [
  "####################",
  "#........##........#",
  "#........##........#",
  "#........##........#",
  "#..................#",
  "#........##........#",
  "#........##........#",
  "########.######.####",
  "########.######.####",
  "#.................B#",
  "#..................#",
  "#..................#",
  "#..................#",
  "#.................B#",
  "####################",
];

const player = {
  x: 4.5,
  y: 4.5,
  angle: 0,
  hp: 100,
  hurt: 0,
};

const enemies = [
  enemy("orc", 3.2, 2.4),
  enemy("orc", 6.7, 5.7),
  enemy("orc", 12.4, 2.7),
  enemy("orc", 15.7, 5.4),
  enemy("orc", 17.2, 2.8),
  enemy("boss", 17.2, 11.4),
];

const keys = new Set();
const depths = new Array(RAYS).fill(MAX_DEPTH);
let last = performance.now();
let kills = 0;
let swing = 0;
let swingCooldown = 0;
let gameState = "play";
let mouseActive = false;
let messagePulse = 0;
let started = false;

function enemy(type, x, y) {
  return {
    type,
    x,
    y,
    hp: type === "boss" ? 8 : 2,
    maxHp: type === "boss" ? 8 : 2,
    radius: type === "boss" ? 0.42 : 0.32,
    speed: type === "boss" ? 0.88 : 1.12,
    damage: type === "boss" ? 18 : 10,
    attackTimer: 0,
    hitFlash: 0,
    dead: false,
  };
}

function isWall(x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  return my < 0 || my >= map.length || mx < 0 || mx >= map[0].length || map[my][mx] === "#";
}

function normAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function moveActor(actor, dx, dy, radius = 0.18) {
  const nx = actor.x + dx;
  const ny = actor.y + dy;
  if (!isWall(nx + Math.sign(dx) * radius, actor.y) && !isWall(nx, actor.y - radius) && !isWall(nx, actor.y + radius)) {
    actor.x = nx;
  }
  if (!isWall(actor.x, ny + Math.sign(dy) * radius) && !isWall(actor.x - radius, ny) && !isWall(actor.x + radius, ny)) {
    actor.y = ny;
  }
}

function castRay(angle) {
  const step = 0.025;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  let dist = 0;
  while (dist < MAX_DEPTH) {
    const x = player.x + cos * dist;
    const y = player.y + sin * dist;
    if (isWall(x, y)) {
      const shadeSeed = (Math.floor(x) + Math.floor(y)) % 2;
      return { dist, x, y, shadeSeed };
    }
    dist += step;
  }
  return { dist: MAX_DEPTH, x: player.x + cos * MAX_DEPTH, y: player.y + sin * MAX_DEPTH, shadeSeed: 0 };
}

function update(dt) {
  if (gameState !== "play") {
    messagePulse += dt;
    return;
  }

  const moveStep = MOVE_SPEED * dt;
  const turnStep = TURN_SPEED * dt;
  if (keys.has("ArrowLeft")) player.angle -= turnStep;
  if (keys.has("ArrowRight")) player.angle += turnStep;

  let forward = 0;
  let side = 0;
  if (keys.has("KeyW")) forward += 1;
  if (keys.has("KeyS")) forward -= 1;
  if (keys.has("KeyA")) side -= 1;
  if (keys.has("KeyD")) side += 1;

  if (forward || side) {
    const len = Math.hypot(forward, side);
    forward /= len;
    side /= len;
    const ca = Math.cos(player.angle);
    const sa = Math.sin(player.angle);
    moveActor(player, (ca * forward - sa * side) * moveStep, (sa * forward + ca * side) * moveStep);
  }

  player.angle = normAngle(player.angle);
  swing = Math.max(0, swing - dt * 3.4);
  swingCooldown = Math.max(0, swingCooldown - dt);
  player.hurt = Math.max(0, player.hurt - dt * 3);

  for (const e of enemies) {
    if (e.dead) continue;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    if (!started) continue;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.65) {
      const speed = e.speed * dt;
      moveActor(e, (dx / dist) * speed, (dy / dist) * speed, e.radius);
    } else if (e.attackTimer <= 0) {
      player.hp = Math.max(0, player.hp - e.damage);
      player.hurt = 1;
      e.attackTimer = e.type === "boss" ? 1.05 : 0.82;
      if (player.hp <= 0) gameState = "over";
    }
  }

  if (enemies.every((e) => e.dead)) {
    gameState = "clear";
  }
}

function attack() {
  if (gameState !== "play" || swingCooldown > 0) return;
  started = true;
  swing = 1;
  swingCooldown = 0.42;

  let target = null;
  let best = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const delta = Math.abs(normAngle(angle - player.angle));
    if (dist < 1.55 && delta < 0.34 && hasLineOfSight(e) && dist < best) {
      target = e;
      best = dist;
    }
  }

  if (target) {
    target.hp -= 1;
    target.hitFlash = 1;
    if (target.hp <= 0) {
      target.dead = true;
      kills += 1;
    }
  }
}

function hasLineOfSight(e) {
  const dx = e.x - player.x;
  const dy = e.y - player.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(3, Math.ceil(dist / 0.08));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isWall(player.x + dx * t, player.y + dy * t)) return false;
  }
  return true;
}

function draw() {
  drawWorld();
  drawSprites();
  drawWeapon();
  drawHud();
  if (gameState !== "play") drawEndScreen();
}

function drawWorld() {
  const sky = ctx.createLinearGradient(0, 0, 0, HALF_H);
  sky.addColorStop(0, "#16111b");
  sky.addColorStop(1, "#2b1d22");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HALF_H);

  const floor = ctx.createLinearGradient(0, HALF_H, 0, H);
  floor.addColorStop(0, "#2b251e");
  floor.addColorStop(1, "#0c0907");
  ctx.fillStyle = floor;
  ctx.fillRect(0, HALF_H, W, HALF_H);

  for (let r = 0; r < RAYS; r += 1) {
    const rayAngle = player.angle - FOV / 2 + (r / RAYS) * FOV;
    const hit = castRay(rayAngle);
    const fixedDist = hit.dist * Math.cos(rayAngle - player.angle);
    depths[r] = fixedDist;
    const wallH = Math.min(H * 1.8, H / Math.max(0.001, fixedDist));
    const x = (r / RAYS) * W;
    const colW = W / RAYS + 1;
    const y = HALF_H - wallH / 2;
    const light = Math.max(28, 175 - fixedDist * 18);
    const mortar = hit.shadeSeed ? 0.82 : 1;
    ctx.fillStyle = `rgb(${Math.floor(light * 0.65 * mortar)}, ${Math.floor(light * 0.42 * mortar)}, ${Math.floor(light * 0.28 * mortar)})`;
    ctx.fillRect(x, y, colW, wallH);

    ctx.fillStyle = `rgba(18, 12, 10, ${Math.min(0.55, fixedDist / 14)})`;
    ctx.fillRect(x, y, colW, wallH);

    if (r % 5 === 0) {
      ctx.fillStyle = "rgba(15, 9, 7, 0.28)";
      ctx.fillRect(x, y, 1, wallH);
    }
  }
}

function drawSprites() {
  const visible = enemies
    .filter((e) => !e.dead)
    .map((e) => {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      return { e, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((s) => Math.abs(s.angle) < FOV * 0.72 && hasLineOfSight(s.e))
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const size = Math.min(H * 1.45, (H / s.dist) * (s.e.type === "boss" ? 1.25 : 0.72));
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.2) continue;
    drawOrc(s.e, screenX - size / 2, HALF_H - size * 0.55, size, s.dist);
  }
}

function drawOrc(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const dark = e.type === "boss";
  const flash = e.hitFlash > 0;
  const skin = flash ? "#f6e9b8" : dark ? "#1d5f32" : "#2f9c45";
  const skinLight = flash ? "#fff6cf" : dark ? "#3a8745" : "#5fc765";
  const shadow = dark ? "#0e2817" : "#145b28";
  const deepShadow = dark ? "#07130b" : "#0a3317";
  const armor = dark ? "#181818" : "#262728";
  const armorLight = dark ? "#3b3b3b" : "#46494a";
  const eye = dark ? "#e12621" : "#f0d447";

  ctx.globalAlpha = Math.max(0.35, 1 - dist / 16);

  rect(x + 5 * px, y + 4 * px, 7 * px, 1 * px, skinLight);
  rect(x + 4 * px, y + 5 * px, 9 * px, 7 * px, skin);
  rect(x + 5 * px, y + 11 * px, 7 * px, 2 * px, shadow);
  rect(x + 3 * px, y + 7 * px, 3 * px, 2 * px, skin);
  rect(x + 11 * px, y + 7 * px, 3 * px, 2 * px, skin);
  rect(x + 2 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 13 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 4 * px, y + 6 * px, 9 * px, 1 * px, deepShadow);
  rect(x + 6 * px, y + 8 * px, 2 * px, 1 * px, eye);
  rect(x + 10 * px, y + 8 * px, 2 * px, 1 * px, eye);
  rect(x + 8 * px, y + 9 * px, 2 * px, 2 * px, deepShadow);
  rect(x + 6 * px, y + 11 * px, 6 * px, 1 * px, "#1b0c0a");
  rect(x + 7 * px, y + 11 * px, 1 * px, 3 * px, "#efe8ca");
  rect(x + 10 * px, y + 11 * px, 1 * px, 3 * px, "#efe8ca");

  rect(x + 4 * px, y + 13 * px, 9 * px, 8 * px, armor);
  rect(x + 5 * px, y + 13 * px, 6 * px, 1 * px, armorLight);
  rect(x + 6 * px, y + 15 * px, 5 * px, 1 * px, "#806a49");
  rect(x + 7 * px, y + 16 * px, 1 * px, 4 * px, "#141414");
  rect(x + 2 * px, y + 14 * px, 3 * px, 3 * px, armorLight);
  rect(x + 12 * px, y + 14 * px, 3 * px, 3 * px, armorLight);
  rect(x + 2 * px, y + 17 * px, 2 * px, 5 * px, shadow);
  rect(x + 13 * px, y + 17 * px, 2 * px, 5 * px, shadow);
  rect(x + 5 * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
  rect(x + 10 * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
  rect(x + 4 * px, y + 24 * px, 4 * px, 1 * px, "#0b0b0b");
  rect(x + 10 * px, y + 24 * px, 4 * px, 1 * px, "#0b0b0b");
  rect(x + 12 * px, y + 5 * px, 1 * px, 8 * px, "rgba(0, 0, 0, 0.2)");

  if (dark) {
    rect(x + 3 * px, y + 1 * px, 2 * px, 5 * px, "#c7b98f");
    rect(x + 12 * px, y + 1 * px, 2 * px, 5 * px, "#c7b98f");
    rect(x + 3 * px, y + 1 * px, 1 * px, 2 * px, "#fff0bd");
    rect(x + 13 * px, y + 1 * px, 1 * px, 2 * px, "#fff0bd");
    rect(x + 1 * px, y + 12 * px, 5 * px, 4 * px, "#111");
    rect(x + 11 * px, y + 12 * px, 5 * px, 4 * px, "#111");
    rect(x + 4 * px, y + 14 * px, 9 * px, 1 * px, "#6f1414");
    rect(x + 6 * px, y + 3 * px, 6 * px, 1 * px, "#111");
  }

  ctx.globalAlpha = 1;
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function drawWeapon() {
  const progress = swing > 0 ? 1 - swing : 0;
  const power = swing > 0 ? Math.sin(progress * Math.PI) : 0;
  const pivotX = W * 0.66;
  const pivotY = H * 1.08;
  const angle = -0.2 + power * 1.25;

  if (power > 0.42) {
    ctx.strokeStyle = "rgba(237, 211, 132, 0.28)";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(pivotX - 30, pivotY - 80, 190, -1.25, -0.18);
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(angle);

  rect(-17, -175, 36, 165, "#513019");
  rect(-12, -170, 12, 150, "#7a4a24");
  rect(6, -166, 8, 136, "#2d190d");
  rect(-20, -176, 42, 13, "#3b2313");
  rect(-23, -158, 47, 16, "#65401f");
  rect(-14, -139, 32, 12, "#4a2b17");
  rect(-21, -111, 39, 10, "#5c361d");
  rect(-11, -86, 29, 8, "#8b5b2f");
  rect(-22, -55, 38, 9, "#442512");
  rect(-13, -33, 30, 7, "#6b4220");
  rect(-4, -166, 5, 136, "rgba(255, 218, 132, 0.18)");
  rect(13, -151, 7, 11, "#1b0d07");
  rect(-23, -126, 6, 9, "#2a150a");
  rect(10, -96, 5, 5, "#d8c08a");
  rect(-17, -72, 5, 5, "#d8c08a");
  rect(-11, -15, 29, 34, "#3b2416");
  rect(-8, -9, 22, 8, "#6e4a2d");
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "rgba(8, 6, 5, 0.82)";
  ctx.fillRect(0, H - 66, W, 66);
  drawBar(24, H - 48, 220, 20, player.hp / 100, "#b92828", "#3b1414");
  ctx.fillStyle = "#eadca4";
  ctx.font = "20px Courier New";
  ctx.fillText(`HP ${player.hp}`, 34, H - 31);
  ctx.fillText(`KILLS ${kills}/6`, 292, H - 31);

  const boss = enemies.find((e) => e.type === "boss" && !e.dead);
  if (boss) {
    drawBar(W - 292, 24, 260, 18, boss.hp / boss.maxHp, "#8e1212", "#241010");
    ctx.fillStyle = "#e9c46a";
    ctx.font = "15px Courier New";
    ctx.fillText("ORC CHIEF", W - 286, 39);
  }

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(155, 0, 0, ${player.hurt * 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawBar(x, y, w, h, pct, fill, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * pct), h - 6);
  ctx.strokeStyle = "#d6c083";
  ctx.strokeRect(x, y, w, h);
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(4, 3, 2, 0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = gameState === "clear" ? "#e6c766" : "#b52626";
  ctx.font = "54px Courier New";
  ctx.fillText(gameState === "clear" ? "DUNGEON CLEARED" : "GAME OVER", W / 2, H / 2 - 28);
  ctx.fillStyle = "#d9c99a";
  ctx.font = "22px Courier New";
  ctx.fillText("Press Enter to restart", W / 2, H / 2 + 28);
  ctx.textAlign = "left";
}

function resetGame() {
  player.x = 4.5;
  player.y = 4.5;
  player.angle = 0;
  player.hp = 100;
  player.hurt = 0;
  kills = 0;
  swing = 0;
  swingCooldown = 0;
  gameState = "play";
  started = false;
  const fresh = [
    ["orc", 3.2, 2.4],
    ["orc", 6.7, 5.7],
    ["orc", 12.4, 2.7],
    ["orc", 15.7, 5.4],
    ["orc", 17.2, 2.8],
    ["boss", 17.2, 11.4],
  ];
  enemies.splice(0, enemies.length, ...fresh.map(([type, x, y]) => enemy(type, x, y)));
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    started = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    attack();
  }
  if (event.code === "Enter" && gameState !== "play") resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (!mouseActive) {
    canvas.requestPointerLock?.();
  }
  attack();
});

document.addEventListener("pointerlockchange", () => {
  mouseActive = document.pointerLockElement === canvas;
});

document.addEventListener("mousemove", (event) => {
  if (mouseActive && gameState === "play") {
    started = true;
    player.angle = normAngle(player.angle + event.movementX * 0.0022);
  }
});

requestAnimationFrame(frame);
