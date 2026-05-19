const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;
const HALF_H = H / 2;
const FOV = Math.PI / 3;
const RAYS = 240;
const MAX_DEPTH = 18;
const TILE = 64;
const TURN_SPEED = 1.95;
const MOVE_SPEED = 2.45;

const BASE_MAP = [
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
  maxHp: 100,
  rage: 0,
  maxRage: 100,
  weaponLevel: 1,
};

const MAX_STAGE = 10;
let stage = 1;
let map = buildMap(stage);
let enemies = buildEnemies(stage);
let items = [];

const keys = new Set();
const depths = new Array(RAYS).fill(MAX_DEPTH);
let last = performance.now();
let kills = 0;
let swing = 0;
let swingCooldown = 0;
let swingType = "normal";
let gameState = "start";
let mouseActive = false;
let messagePulse = 0;
let started = false;
let hitSpark = 0;
let screenShake = 0;
let damagePops = [];
let notice = "STAGE 1";
let noticeTimer = 0;

function enemy(type, x, y) {
  const stageBonus = stage - 1;
  return {
    type,
    x,
    y,
    hp: type === "boss" ? 8 + stageBonus * 4 : 2 + stageBonus,
    maxHp: type === "boss" ? 8 + stageBonus * 4 : 2 + stageBonus,
    radius: type === "boss" ? 0.42 : 0.32,
    speed: type === "boss" ? 0.62 + stageBonus * 0.045 : 0.78 + stageBonus * 0.055,
    damage: type === "boss" ? 18 + stageBonus * 4 : 10 + stageBonus * 2,
    attackTimer: 0,
    attackWindup: 0,
    hitFlash: 0,
    stun: 0,
    knockX: 0,
    knockY: 0,
    step: Math.random() * Math.PI * 2,
    moving: false,
    attackPose: 0,
    dead: false,
  };
}

function buildEnemies(nextStage) {
  const previousStage = stage;
  stage = nextStage;
  const pool = [
    ["orc", 14.2, 2.0],
    ["orc", 17.0, 2.5],
    ["orc", 15.4, 5.9],
    ["orc", 17.4, 5.5],
    ["orc", 13.6, 6.0],
    ["orc", 12.2, 2.1],
    ["orc", 14.8, 3.3],
    ["orc", 18.0, 4.6],
  ];
  const count = Math.min(pool.length, 4 + Math.ceil(nextStage / 2));
  const offset = (nextStage - 1) % pool.length;
  const layout = [];
  for (let i = 0; i < count; i += 1) {
    layout.push(pool[(offset + i) % pool.length]);
  }
  layout.push(["boss", nextStage % 2 ? 17.2 : 16.4, 11.1]);
  const built = layout.map(([type, x, y]) => enemy(type, x, y));
  stage = previousStage;
  return built;
}

function spawnItem(type, x, y) {
  items.push({
    type,
    x,
    y,
    bob: Math.random() * Math.PI * 2,
  });
}

function spawnDamagePop(x, y, value, boss) {
  damagePops.push({
    x,
    y,
    value,
    boss,
    life: 0.72,
    rise: 0,
  });
}

function addRage(amount) {
  player.rage = Math.min(player.maxRage, player.rage + amount);
}

function buildMap(nextStage) {
  const rows = BASE_MAP.map((row) => row.split(""));
  const variants = [
    [[12, 2], [12, 3], [16, 5], [3, 11], [4, 11]],
    [[14, 2], [15, 2], [12, 5], [13, 5], [11, 11], [12, 11]],
    [[17, 3], [17, 4], [11, 2], [6, 10], [6, 11], [14, 12]],
    [[13, 3], [14, 4], [15, 5], [4, 12], [10, 10], [15, 10]],
  ];
  const chosen = variants[(nextStage - 1) % variants.length];
  for (const [x, y] of chosen) {
    if (nextStage === 1 && y < 7) continue;
    if (rows[y] && rows[y][x] === ".") rows[y][x] = "#";
  }
  if (nextStage >= 4) {
    for (const [x, y] of [[10, 3], [18, 6], [9, 10], [16, 12]]) {
      if (rows[y] && rows[y][x] === ".") rows[y][x] = "#";
    }
  }
  rows[4][9] = ".";
  rows[7][8] = ".";
  rows[8][8] = ".";
  rows[7][15] = ".";
  rows[8][15] = ".";
  return rows.map((row) => row.join(""));
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
  swing = Math.max(0, swing - dt * 2.55);
  swingCooldown = Math.max(0, swingCooldown - dt);
  player.hurt = Math.max(0, player.hurt - dt * 3);
  hitSpark = Math.max(0, hitSpark - dt * 5);
  screenShake = Math.max(0, screenShake - dt * 5);
  noticeTimer = Math.max(0, noticeTimer - dt);
  for (const item of items) {
    item.bob += dt * 4;
  }
  for (let i = damagePops.length - 1; i >= 0; i -= 1) {
    damagePops[i].life -= dt;
    damagePops[i].rise += dt * 0.28;
    if (damagePops[i].life <= 0) damagePops.splice(i, 1);
  }

  for (const e of enemies) {
    if (e.dead) continue;
    e.moving = false;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    e.attackPose = Math.max(0, e.attackPose - dt * 5);
    e.stun = Math.max(0, e.stun - dt);
    if (Math.abs(e.knockX) > 0.01 || Math.abs(e.knockY) > 0.01) {
      moveActor(e, e.knockX * dt, e.knockY * dt, e.radius);
      e.knockX *= Math.pow(0.04, dt);
      e.knockY *= Math.pow(0.04, dt);
    }
    if (!started) continue;
    if (e.type === "orc" && player.x < 9.5) continue;
    if (e.type === "boss" && player.y < 8.7) continue;
    if (e.stun > 0) continue;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const attackRange = e.type === "boss" ? 0.82 : 0.72;
    if (e.attackWindup > 0) {
      e.attackWindup = Math.max(0, e.attackWindup - dt);
      e.step += dt * (e.type === "boss" ? 3.2 : 4.4);
      e.attackPose = Math.max(e.attackPose, 0.45);
      if (e.attackWindup === 0) {
        if (dist <= attackRange + 0.12) {
          player.hp = Math.max(0, player.hp - e.damage);
          player.hurt = 1;
          addRage(e.type === "boss" ? 12 : 7);
          e.attackPose = 1;
          screenShake = Math.max(screenShake, e.type === "boss" ? 1 : 0.55);
          if (player.hp <= 0) gameState = "over";
        }
        e.attackTimer = e.type === "boss" ? 1.15 : 0.95;
      }
      continue;
    }
    if (dist > attackRange) {
      const speed = e.speed * dt;
      moveActor(e, (dx / dist) * speed, (dy / dist) * speed, e.radius);
      e.step += dt * (e.type === "boss" ? 5.3 : 6.2);
      e.moving = true;
    } else if (e.attackTimer <= 0) {
      e.attackWindup = e.type === "boss" ? 0.48 : 0.36;
      e.attackPose = 0.65;
    }
  }

  collectItems();
}

function attack(kind = "normal") {
  if (gameState !== "play" || swingCooldown > 0) return;
  if (kind === "special" && player.rage < player.maxRage) {
    notice = "RAGE NOT READY";
    noticeTimer = 1;
    return;
  }
  started = true;
  swing = 1;
  swingType = kind;
  swingCooldown = kind === "special" ? 0.78 : 0.54;
  if (kind === "special") player.rage = 0;

  const hitRange = kind === "special" ? 2.3 : 1.55;
  const hitAngle = kind === "special" ? 0.58 : 0.34;
  const damage = kind === "special" ? player.weaponLevel * 2 + 2 : player.weaponLevel;
  const hits = [];
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const delta = Math.abs(normAngle(angle - player.angle));
    if (dist < hitRange && delta < hitAngle && hasLineOfSight(e)) {
      hits.push({ e, dist });
    }
  }
  hits.sort((a, b) => a.dist - b.dist);
  const targets = kind === "special" ? hits.map((hit) => hit.e) : hits.slice(0, 1).map((hit) => hit.e);

  if (targets.length) {
    for (const target of targets) {
      damageEnemy(target, damage, kind);
    }
    hitSpark = 1;
    screenShake = kind === "special" ? 1.6 : 1;
  }
}

function damageEnemy(target, damage, kind) {
  target.hp -= damage;
  target.hitFlash = 1;
  target.attackWindup = 0;
  const pushAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const pushPower = target.type === "boss" ? (kind === "special" ? 2.1 : 1.35) : (kind === "special" ? 4.1 : 2.55);
  target.knockX = Math.cos(pushAngle) * pushPower;
  target.knockY = Math.sin(pushAngle) * pushPower;
  target.stun = target.type === "boss" ? (kind === "special" ? 0.42 : 0.25) : (kind === "special" ? 0.68 : 0.42);
  spawnDamagePop(target.x, target.y, damage, target.type === "boss");
  if (kind !== "special") addRage(target.type === "boss" ? 16 : 22);
  if (target.hp <= 0) {
    target.dead = true;
    kills += 1;
    if (kind !== "special") addRage(target.type === "boss" ? 30 : 16);
    if (target.type === "boss") {
      spawnItem("relic", target.x, target.y);
      notice = stage < MAX_STAGE ? "BOSS DROPPED A GATE RELIC" : "BOSS DROPPED THE CHIEF TOKEN";
      noticeTimer = 3;
    } else if (Math.random() < 0.45) {
      spawnItem("health", target.x, target.y);
    }
  }
}

function collectItems() {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist > 0.58) continue;
    if (item.type === "health") {
      player.hp = Math.min(player.maxHp, player.hp + 28);
      notice = "HEALTH RESTORED";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "relic") {
      items.splice(i, 1);
      if (stage < MAX_STAGE) {
        gameState = "stageClear";
        messagePulse = 0;
        notice = `STAGE ${stage} COMPLETE`;
        noticeTimer = 2;
      } else {
        player.weaponLevel += 1;
        notice = "CHIEF TOKEN CLAIMED";
        noticeTimer = 2;
        gameState = "clear";
      }
    }
  }
}

function advanceStage() {
  stage += 1;
  player.x = 4.5;
  player.y = 4.5;
  player.angle = 0;
  player.hp = Math.min(player.maxHp, player.hp + 45);
  player.rage = Math.min(player.maxRage, player.rage + 35);
  player.weaponLevel += 1;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  damagePops = [];
  started = false;
  map = buildMap(stage);
  enemies = buildEnemies(stage);
  items = [];
  notice = `STAGE ${stage} - SWORD UPGRADED`;
  noticeTimer = 3;
  gameState = "play";
  messagePulse = 0;
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
  ctx.save();
  if (screenShake > 0) {
    const wobble = Math.sin(performance.now() * 0.08) * screenShake * 4;
    ctx.translate(wobble, -wobble * 0.45);
  }
  drawWorld();
  drawSprites();
  drawDamagePops();
  drawItems();
  drawWeapon();
  drawHud();
  if (gameState !== "play") drawEndScreen();
  ctx.restore();
}

function drawWorld() {
  const sky = ctx.createLinearGradient(0, 0, 0, HALF_H);
  sky.addColorStop(0, "#2a2031");
  sky.addColorStop(1, "#4a3340");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HALF_H);

  const floor = ctx.createLinearGradient(0, HALF_H, 0, H);
  floor.addColorStop(0, "#4b4437");
  floor.addColorStop(1, "#1d1712");
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
    const light = Math.max(58, 232 - fixedDist * 13);
    const mortar = hit.shadeSeed ? 0.82 : 1;
    ctx.fillStyle = `rgb(${Math.floor(light * 0.65 * mortar)}, ${Math.floor(light * 0.42 * mortar)}, ${Math.floor(light * 0.28 * mortar)})`;
    ctx.fillRect(x, y, colW, wallH);

    const block = Math.max(10, wallH / 7);
    const brickY = y + (Math.floor(hit.y * 5 + hit.x * 2) % 6) * block;
    ctx.fillStyle = "rgba(255, 217, 145, 0.11)";
    ctx.fillRect(x, brickY, colW, Math.max(1, wallH / 42));
    ctx.fillStyle = "rgba(31, 18, 12, 0.18)";
    ctx.fillRect(x, y, colW, Math.max(1, wallH / 36));
    if (r % 10 === 0) {
      ctx.fillStyle = "rgba(255, 226, 160, 0.07)";
      ctx.fillRect(x, y + wallH * 0.1, colW, wallH * 0.72);
    }

    ctx.fillStyle = `rgba(18, 12, 10, ${Math.min(0.34, fixedDist / 18)})`;
    ctx.fillRect(x, y, colW, wallH);

    if (r % 5 === 0) {
      ctx.fillStyle = "rgba(15, 9, 7, 0.28)";
      ctx.fillRect(x, y, 1, wallH);
    }
  }

  ctx.fillStyle = "rgba(255, 196, 94, 0.08)";
  for (let i = 0; i < 9; i += 1) {
    const tx = ((i * 137 + 53) % W);
    const ty = HALF_H + ((i * 71 + 41) % (H - HALF_H));
    ctx.fillRect(tx, ty, 2, 2);
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

function drawDamagePops() {
  for (const pop of damagePops) {
    const dx = pop.x - player.x;
    const dy = pop.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normAngle(Math.atan2(dy, dx) - player.angle);
    if (Math.abs(angle) > FOV * 0.65 || !hasLineOfSight(pop)) continue;
    const screenX = W / 2 + Math.tan(angle) * (W / FOV);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < dist - 0.2) continue;
    const alpha = Math.max(0, pop.life / 0.72);
    const y = HALF_H - H / Math.max(1, dist) * (0.34 + pop.rise);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    drawText(`-${pop.value}`, screenX, y, pop.boss ? 20 : 16, pop.boss ? "#ffd34d" : "#fff1bd");
    ctx.textAlign = "left";
    ctx.restore();
  }
}

function drawItems() {
  const visible = items
    .map((item) => {
      const dx = item.x - player.x;
      const dy = item.y - player.y;
      return { item, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((s) => Math.abs(s.angle) < FOV * 0.72 && hasLineOfSight(s.item))
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const size = Math.min(96, (H / s.dist) * 0.28);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.2) continue;
    const y = HALF_H + H / Math.max(1, s.dist) * 0.24 - size + Math.sin(s.item.bob) * 5;
    drawItemSprite(s.item, screenX - size / 2, y, size);
  }
}

function drawItemSprite(item, x, y, size) {
  const px = Math.max(2, Math.floor(size / 10));
  if (item.type === "health") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#2b1010");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#c9332b");
    rect(x + 4 * px, y + 3 * px, 2 * px, 4 * px, "#fff0bf");
    rect(x + 3 * px, y + 4 * px, 4 * px, 2 * px, "#fff0bf");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  } else {
    rect(x + 2 * px, y + 2 * px, 6 * px, 6 * px, "#21160f");
    rect(x + 3 * px, y + 1 * px, 4 * px, 8 * px, "#d0ae52");
    rect(x + 4 * px, y + 2 * px, 2 * px, 6 * px, "#fff0a8");
    rect(x + 1 * px, y + 4 * px, 8 * px, 2 * px, "#8b1f1f");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  }
}

function drawOrc(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const dark = e.type === "boss";
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px : 0;
  const attack = e.attackPose;
  const winding = e.attackWindup > 0;
  const hurt = e.hitFlash > 0.1;
  y += bob - attack * 3 * px + (winding ? 2 * px : 0);
  x += walk * px * 0.35 + (winding ? Math.sin(e.step + 1.2) * px * 0.2 : 0);
  const skin = flash ? "#f6e9b8" : dark ? "#1d5f32" : "#2f9c45";
  const skinLight = flash ? "#fff6cf" : dark ? "#3a8745" : "#5fc765";
  const shadow = dark ? "#0e2817" : "#145b28";
  const deepShadow = dark ? "#07130b" : "#0a3317";
  const armor = dark ? "#181818" : "#262728";
  const armorLight = dark ? "#3b3b3b" : "#46494a";
  const eye = dark ? "#e12621" : "#f0d447";

  ctx.globalAlpha = Math.max(0.35, 1 - dist / 16);

  rect(x + 3 * px, y + 4 * px, 11 * px, 10 * px, deepShadow);
  rect(x + 5 * px, y + 3 * px, 7 * px, 2 * px, skinLight);
  rect(x + 4 * px, y + 5 * px, 9 * px, 8 * px, skin);
  rect(x + 5 * px, y + 12 * px, 7 * px, 2 * px, shadow);
  rect(x + 1 * px, y + 7 * px, 4 * px, 3 * px, skin);
  rect(x + 12 * px, y + 7 * px, 4 * px, 3 * px, skin);
  rect(x + 1 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 14 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 4 * px, y + 6 * px, 9 * px, 1 * px, deepShadow);
  if (hurt) {
    rect(x + 5 * px, y + 8 * px, 3 * px, 1 * px, "#1b0c0a");
    rect(x + 10 * px, y + 8 * px, 3 * px, 1 * px, "#1b0c0a");
    rect(x + 5 * px, y + 7 * px, 3 * px, 1 * px, eye);
    rect(x + 10 * px, y + 7 * px, 3 * px, 1 * px, eye);
  } else if (winding) {
    rect(x + 5 * px, y + 8 * px, 3 * px, 1 * px, eye);
    rect(x + 10 * px, y + 8 * px, 3 * px, 1 * px, eye);
    rect(x + 6 * px, y + 7 * px, 2 * px, 1 * px, deepShadow);
    rect(x + 9 * px, y + 7 * px, 2 * px, 1 * px, deepShadow);
  } else if (attack > 0) {
    rect(x + 5 * px, y + 8 * px, 3 * px, 2 * px, eye);
    rect(x + 10 * px, y + 8 * px, 3 * px, 2 * px, eye);
  } else {
    rect(x + 5 * px, y + 8 * px, 3 * px, 1 * px, eye);
    rect(x + 10 * px, y + 8 * px, 3 * px, 1 * px, eye);
  }
  rect(x + 8 * px, y + 9 * px, 2 * px, 2 * px, deepShadow);
  rect(x + 5 * px, y + 11 * px, 7 * px, hurt ? 1 * px : 2 * px, "#1b0c0a");
  if (hurt) rect(x + 7 * px, y + 12 * px, 4 * px, 1 * px, "#1b0c0a");
  rect(x + 6 * px, y + 12 * px, 1 * px, 3 * px, "#efe8ca");
  rect(x + 10 * px, y + 12 * px, 1 * px, 3 * px, "#efe8ca");

  rect(x + 3 * px, y + 13 * px, 11 * px, 9 * px, armor);
  rect(x + 4 * px, y + 13 * px, 8 * px, 1 * px, armorLight);
  rect(x + 5 * px, y + 16 * px, 7 * px, 1 * px, "#806a49");
  rect(x + 7 * px, y + 17 * px, 1 * px, 5 * px, "#141414");
  const armSwing = walk > 0 ? 1 : -1;
  const leftArmY = y + (winding ? 12 * px : attack > 0 ? 16 * px : (14 + armSwing) * px);
  const rightArmY = y + (winding ? 17 * px : attack > 0 ? 13 * px : (14 - armSwing) * px);
  rect(x + 1 * px, leftArmY, 4 * px, 4 * px, armorLight);
  rect(x + 12 * px, rightArmY, 4 * px, 4 * px, armorLight);
  rect(x + 1 * px, leftArmY + 4 * px, 3 * px, 5 * px, shadow);
  rect(x + 14 * px, rightArmY + 4 * px, 3 * px, 5 * px, shadow);
  rect(x + 15 * px, rightArmY + 5 * px, 3 * px, 1 * px, "#8f7a50");
  const legA = walk > 0 ? 1 : 0;
  rect(x + (5 - legA) * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
  rect(x + (10 + legA) * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
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

function tri(x1, y1, x2, y2, x3, y3, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.lineTo(Math.round(x3), Math.round(y3));
  ctx.closePath();
  ctx.fill();
}

function drawWeapon() {
  const progress = swing > 0 ? 1 - swing : 0;
  const special = swingType === "special";
  const lungeIn = Math.min(1, progress / (special ? 0.18 : 0.2));
  const lungeOut = progress > 0.56 ? Math.max(0, 1 - (progress - 0.56) / 0.38) : 1;
  const lunge = swing > 0 ? Math.min(lungeIn, lungeOut) : 0;
  const recoil = swing > 0 && progress > 0.72 ? (progress - 0.72) / 0.28 : 0;
  const sway = swing > 0 ? 0 : Math.sin(performance.now() * 0.006) * 3;
  const reach = special ? lunge * 1.35 : lunge;

  const nearX = W * (0.84 - reach * 0.19 + recoil * 0.05) + sway;
  const nearY = H * (1.12 + recoil * 0.05 - reach * 0.05);
  const farX = W * (0.59 - reach * 0.13);
  const farY = H * (0.75 - reach * 0.24);
  drawForwardPole(nearX, nearY, farX, farY, reach, special);

  if (hitSpark > 0) drawHitSpark();
}

function drawForwardPole(nearX, nearY, farX, farY, lunge, special = false) {
  const dx = farX - nearX;
  const dy = farY - nearY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const palette = swordPalette();
  const nearW = 34 + lunge * 10;
  const midW = 24 + lunge * 4;
  const farW = 17 + lunge * 2;
  const tipLen = 18 + lunge * 8;
  const hiltX = nearX - dx / len * 46;
  const hiltY = nearY - dy / len * 46;

  ctx.fillStyle = palette.shadow;
  ctx.beginPath();
  ctx.moveTo(nearX + nx * nearW, nearY + ny * nearW);
  ctx.lineTo(nearX - nx * nearW, nearY - ny * nearW);
  ctx.lineTo(farX - nx * farW, farY - ny * farW);
  ctx.lineTo(farX + nx * farW, farY + ny * farW);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.blade;
  ctx.beginPath();
  ctx.moveTo(nearX + nx * midW, nearY + ny * midW);
  ctx.lineTo(nearX - nx * midW, nearY - ny * midW);
  ctx.lineTo(farX - nx * farW, farY - ny * farW);
  ctx.lineTo(farX + nx * farW * 0.45 + dx / len * tipLen, farY + ny * farW * 0.45 + dy / len * tipLen);
  ctx.lineTo(farX + nx * farW, farY + ny * farW);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.highlight;
  ctx.beginPath();
  ctx.moveTo(nearX + nx * midW * 0.25, nearY + ny * midW * 0.25);
  ctx.lineTo(nearX + nx * midW * 0.02, nearY + ny * midW * 0.02);
  ctx.lineTo(farX + nx * farW * 0.18 + dx / len * 8, farY + ny * farW * 0.18 + dy / len * 8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.guard;
  ctx.beginPath();
  ctx.moveTo(nearX + nx * 66 + dx / len * 10, nearY + ny * 66 + dy / len * 10);
  ctx.lineTo(nearX - nx * 66 + dx / len * 10, nearY - ny * 66 + dy / len * 10);
  ctx.lineTo(nearX - nx * 54 - dx / len * 16, nearY - ny * 54 - dy / len * 16);
  ctx.lineTo(nearX + nx * 54 - dx / len * 16, nearY + ny * 54 - dy / len * 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#2a160d";
  ctx.beginPath();
  ctx.moveTo(nearX + nx * 22, nearY + ny * 22);
  ctx.lineTo(nearX - nx * 22, nearY - ny * 22);
  ctx.lineTo(hiltX - nx * 16, hiltY - ny * 16);
  ctx.lineTo(hiltX + nx * 16, hiltY + ny * 16);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#9b6333";
  ctx.beginPath();
  ctx.moveTo(hiltX + nx * 26 - dx / len * 4, hiltY + ny * 26 - dy / len * 4);
  ctx.lineTo(hiltX - nx * 26 - dx / len * 4, hiltY - ny * 26 - dy / len * 4);
  ctx.lineTo(hiltX - nx * 20 - dx / len * 28, hiltY - ny * 20 - dy / len * 28);
  ctx.lineTo(hiltX + nx * 20 - dx / len * 28, hiltY + ny * 20 - dy / len * 28);
  ctx.closePath();
  ctx.fill();

  if (lunge > 0.42 || special) {
    ctx.strokeStyle = special ? palette.specialTrail : palette.trail;
    ctx.lineWidth = special ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(nearX - dx * 0.32, nearY - dy * 0.32);
    ctx.lineTo(farX + dx / len * 28, farY + dy / len * 28);
    ctx.stroke();
  }
}

function swordPalette() {
  if (player.weaponLevel >= 5) {
    return { blade: "#f1c232", highlight: "#fff0a6", shadow: "#5b4315", guard: "#c18a24", trail: "rgba(255, 220, 72, 0.45)", specialTrail: "rgba(255, 235, 92, 0.72)" };
  }
  if (player.weaponLevel >= 2) {
    return { blade: "#c83b34", highlight: "#ffd0c0", shadow: "#4a1511", guard: "#91302a", trail: "rgba(255, 90, 70, 0.42)", specialTrail: "rgba(255, 74, 45, 0.68)" };
  }
  return { blade: "#d8d8d2", highlight: "#ffffff", shadow: "#686860", guard: "#9a8b68", trail: "rgba(255, 255, 255, 0.34)", specialTrail: "rgba(255, 238, 186, 0.64)" };
}

function swordName() {
  if (player.weaponLevel >= 5) return "GOLD SWORD";
  if (player.weaponLevel >= 2) return "RED SWORD";
  return "WHITE SWORD";
}

function drawThrustHead(cx, tipY, s, jab) {
  const cy = tipY + 58 * s;
  const barW = (88 + jab * 10) * s;
  rect(cx - barW / 2, cy + 20 * s, barW, 13 * s, "#1d1d1b");
  rect(cx - barW / 2, cy + 31 * s, barW, 7 * s, "#050505");
  rect(cx - 48 * s, cy + 38 * s, 96 * s, 15 * s, "#7c4d27");
  rect(cx - 38 * s, cy + 41 * s, 20 * s, 8 * s, "#ae7440");
  rect(cx - 10 * s, cy + 41 * s, 20 * s, 8 * s, "#ae7440");
  rect(cx + 18 * s, cy + 41 * s, 20 * s, 8 * s, "#ae7440");

  rect(cx - 32 * s, cy - 1 * s, 10 * s, 27 * s, "#858077");
  rect(cx - 5 * s, cy - 8 * s, 10 * s, 34 * s, "#a49b88");
  rect(cx + 22 * s, cy - 1 * s, 10 * s, 27 * s, "#858077");
  tri(cx - 39 * s, cy - 1 * s, cx - 27 * s, tipY + 12 * s, cx - 15 * s, cy - 1 * s, "#cfc6ad");
  tri(cx - 13 * s, cy - 8 * s, cx, tipY, cx + 13 * s, cy - 8 * s, "#ded4b7");
  tri(cx + 15 * s, cy - 1 * s, cx + 27 * s, tipY + 12 * s, cx + 39 * s, cy - 1 * s, "#cfc6ad");
  rect(cx - 27 * s, cy + 2 * s, 4 * s, 23 * s, "#5f5b54");
  rect(cx + 23 * s, cy + 2 * s, 4 * s, 23 * s, "#5f5b54");
  rect(cx - 1 * s, cy - 3 * s, 4 * s, 28 * s, "#6f695e");
}

function drawHitSpark() {
  const a = hitSpark;
  const cx = W / 2;
  const cy = H * 0.49;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#ffe78f";
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i += 1) {
    const ang = (Math.PI * 2 * i) / 8;
    const inner = 8 + (1 - a) * 8;
    const outer = 38 + (1 - a) * 18;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHud() {
  drawMiniMap();
  drawCrosshair();
  ctx.fillStyle = "rgba(8, 6, 5, 0.58)";
  ctx.fillRect(0, H - 70, W, 70);
  ctx.fillStyle = "rgba(255, 225, 140, 0.1)";
  ctx.fillRect(0, H - 70, W, 2);
  drawBar(24, H - 52, 196, 18, player.hp / 100, "#d42f2f", "#3f1212");
  drawText(`HP ${player.hp}`, 32, H - 38, 13, "#fff1bd");
  drawBar(24, H - 25, 196, 11, player.rage / player.maxRage, "#d77b23", "#2d1609");
  drawText(`RAGE ${Math.floor(player.rage)}`, 32, H - 15, 10, player.rage >= player.maxRage ? "#ffe39a" : "#d8b47b");
  drawText(`KILLS ${kills}`, 252, H - 25, 15, "#fff1bd");
  drawText(`STAGE ${stage}/10`, 410, H - 25, 14, "#d7c27b");
  drawText(swordName(), W - 184, H - 25, 14, "#d7c27b");
  if (player.rage >= player.maxRage) drawText("RMB SPECIAL READY", W - 230, H - 48, 12, "#ffe39a");

  const boss = enemies.find((e) => e.type === "boss" && !e.dead);
  if (boss && (player.y >= 8.7 || boss.hp < boss.maxHp)) {
    drawBar(W - 260, 26, 220, 18, boss.hp / boss.maxHp, "#b91818", "#2a0c0c");
    drawText("ORC CHIEF", W - 252, 40, 13, "#ffe08a");
  }

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(155, 0, 0, ${player.hurt * 0.25})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (noticeTimer > 0) {
    ctx.textAlign = "center";
    drawText(notice, W / 2, 82, 18, "#ffe39a");
    ctx.textAlign = "left";
  }
}

function drawMiniMap() {
  const cell = 5;
  const x0 = 18;
  const y0 = 18;
  const pad = 5;
  const mw = map[0].length * cell;
  const mh = map.length * cell;
  ctx.fillStyle = "rgba(5, 4, 3, 0.62)";
  ctx.fillRect(x0 - pad, y0 - pad, mw + pad * 2, mh + pad * 2);
  ctx.strokeStyle = "#d8bd76";
  ctx.strokeRect(x0 - pad, y0 - pad, mw + pad * 2, mh + pad * 2);

  for (let y = 0; y < map.length; y += 1) {
    for (let x = 0; x < map[y].length; x += 1) {
      ctx.fillStyle = map[y][x] === "#" ? "#6a4427" : "#181410";
      ctx.fillRect(x0 + x * cell, y0 + y * cell, cell - 1, cell - 1);
    }
  }

  for (const item of items) {
    ctx.fillStyle = item.type === "health" ? "#e33b32" : "#e3c75b";
    ctx.fillRect(x0 + item.x * cell - 1, y0 + item.y * cell - 1, 3, 3);
  }

  for (const e of enemies) {
    if (e.dead) continue;
    ctx.fillStyle = e.type === "boss" ? "#d33" : "#45ba58";
    ctx.fillRect(x0 + e.x * cell - 1, y0 + e.y * cell - 1, e.type === "boss" ? 4 : 3, e.type === "boss" ? 4 : 3);
  }

  ctx.fillStyle = "#fff3b0";
  ctx.beginPath();
  ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fff3b0";
  ctx.beginPath();
  ctx.moveTo(x0 + player.x * cell, y0 + player.y * cell);
  ctx.lineTo(x0 + player.x * cell + Math.cos(player.angle) * 6, y0 + player.y * cell + Math.sin(player.angle) * 6);
  ctx.stroke();
}

function drawCrosshair() {
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = "rgba(255, 232, 160, 0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 13, cy);
  ctx.lineTo(cx - 5, cy);
  ctx.moveTo(cx + 5, cy);
  ctx.lineTo(cx + 13, cy);
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx, cy - 5);
  ctx.moveTo(cx, cy + 5);
  ctx.lineTo(cx, cy + 13);
  ctx.stroke();
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

function drawBar(x, y, w, h, pct, fill, bg) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * pct), h - 6);
  ctx.fillStyle = "rgba(255, 238, 177, 0.24)";
  ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * pct), Math.max(2, Math.floor((h - 6) / 3)));
  ctx.strokeStyle = "#ffe39a";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 1;
}

function drawText(text, x, y, size, color) {
  ctx.font = `${size}px Courier New`;
  ctx.fillStyle = "#090604";
  ctx.fillText(text, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(4, 3, 2, 0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = gameState === "over" ? "#b52626" : "#e6c766";
  ctx.font = gameState === "start" ? "46px Courier New" : "54px Courier New";
  let title = "GAME OVER";
  if (gameState === "start") title = "RETRO ORC DUNGEON";
  if (gameState === "stageClear") title = `STAGE ${stage} COMPLETE`;
  if (gameState === "clear") title = "DUNGEON CLEARED";
  ctx.fillText(title, W / 2, H / 2 - 72);
  ctx.fillStyle = "#d9c99a";
  ctx.font = "18px Courier New";
  if (gameState === "start") {
    ctx.fillText("LEFT CLICK / SPACE: ATTACK", W / 2, H / 2 - 18);
    ctx.fillText("RIGHT CLICK: RAGE SPECIAL", W / 2, H / 2 + 12);
    ctx.fillText("PRESS ENTER OR CLICK TO START", W / 2, H / 2 + 58);
  } else if (gameState === "stageClear") {
    ctx.fillText(`STAGE ${stage + 1}/10 READY`, W / 2, H / 2 - 14);
    ctx.fillText("SWORD UPGRADED - HP RESTORED", W / 2, H / 2 + 16);
    ctx.fillText("PRESS ENTER OR CLICK FOR NEXT STAGE", W / 2, H / 2 + 58);
  } else {
    ctx.fillText("Press Enter to restart", W / 2, H / 2 + 12);
  }
  ctx.textAlign = "left";
}

function startGame() {
  gameState = "play";
  messagePulse = 0;
  notice = `STAGE ${stage}`;
  noticeTimer = 1.8;
}

function resetGame() {
  stage = 1;
  player.x = 4.5;
  player.y = 4.5;
  player.angle = 0;
  player.hp = 100;
  player.hurt = 0;
  player.rage = 0;
  player.weaponLevel = 1;
  kills = 0;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  damagePops = [];
  hitSpark = 0;
  screenShake = 0;
  gameState = "start";
  started = false;
  items = [];
  map = buildMap(stage);
  enemies = buildEnemies(stage);
  notice = "STAGE 1";
  noticeTimer = 0;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Enter" && gameState === "start") {
    event.preventDefault();
    startGame();
    return;
  }
  if (event.code === "Enter" && gameState === "stageClear") {
    event.preventDefault();
    advanceStage();
    return;
  }
  keys.add(event.code);
  if (gameState === "play" && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    started = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (gameState === "start") startGame();
    else attack("normal");
  }
  if (event.code === "Enter" && gameState !== "play") resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (gameState === "start") {
    startGame();
    return;
  }
  if (gameState === "stageClear") {
    advanceStage();
    return;
  }
  if (!mouseActive) {
    try {
      const lockRequest = canvas.requestPointerLock?.();
      if (lockRequest && typeof lockRequest.catch === "function") lockRequest.catch(() => {});
    } catch {
      mouseActive = false;
    }
  }
  attack("normal");
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

canvas.addEventListener("mousedown", (event) => {
  if (event.button !== 2) return;
  event.preventDefault();
  if (gameState === "start") {
    startGame();
    return;
  }
  if (gameState === "stageClear") {
    advanceStage();
    return;
  }
  attack("special");
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
