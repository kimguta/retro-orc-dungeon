const fs = require("fs");
const path = require("path");
const http = require("http");
const cors = require("cors");
const express = require("express");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const ROOM_ID = "citadel";
const MAP_W = 64;
const MAP_H = 36;
const BALROG_RESPAWN_MS = 150000;
const users = loadUsers();
const players = new Map();
const room = createRoom();

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get("/health", (_, res) => {
  res.json({ ok: true, rooms: 1, players: players.size, tier: room.dungeonTier, balrogRespawnAt: room.balrogRespawnAt });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGINS } });

io.on("connection", (socket) => {
  const player = joinPlayer(socket, socket.handshake.auth?.name);
  socket.join(ROOM_ID);
  socket.emit("room:joined", {
    roomId: ROOM_ID,
    players: publicPlayers().filter((remote) => remote.id !== socket.id),
    character: publicCharacter(player),
    resumed: player.resumed,
    dungeon: publicDungeon(),
  });
  publishPlayers();

  socket.on("player:update", (state = {}) => {
    const current = players.get(socket.id);
    if (!current) return;
    Object.assign(current, sanitizeState(state));
    persistCharacter(current);
  });

  socket.on("player:action", ({ action } = {}) => {
    const current = players.get(socket.id);
    if (!current) return;
    current.action = action === "specialAttack" ? "specialAttack" : "attack";
    socket.to(ROOM_ID).emit("player:action", { id: socket.id, action: current.action });
  });

  socket.on("dungeon:attack", (attack = {}) => attackEnemies(socket, attack));

  socket.on("test:boost", ({ enabled } = {}) => {
    const current = players.get(socket.id);
    if (!current?.isTestAccount) return;
    if (enabled) applyTestBoost(current);
    else restoreNormalTest(current);
    persistCharacter(current);
    socket.emit("character:update", publicCharacter(current));
    publishPlayers();
  });

  socket.on("test:resetTier", () => {
    const current = players.get(socket.id);
    if (!current?.isTestAccount) return;
    resetDungeon();
  });

  socket.on("test:resetCharacters", () => {
    const current = players.get(socket.id);
    if (!current?.isTestAccount) return;
    resetCharacters();
  });

  socket.on("disconnect", () => {
    const current = players.get(socket.id);
    if (!current) return;
    persistCharacter(current);
    players.delete(socket.id);
    socket.to(ROOM_ID).emit("player:left", { id: socket.id });
    publishPlayers();
  });
});

setInterval(() => {
  tickDungeon(0.1);
  io.to(ROOM_ID).emit("dungeon:update", publicDungeon());
}, 100);
setInterval(publishPlayers, 120);
setInterval(saveUsers, 3000);

function joinPlayer(socket, rawName) {
  const name = sanitizeName(rawName);
  evictDuplicatePlayers(name, socket.id);
  const saved = users[name];
  const character = saved || newCharacter(name);
  const player = {
    id: socket.id,
    roomId: ROOM_ID,
    name,
    displayName: character.displayName,
    isTestAccount: character.isTestAccount,
    resumed: Boolean(saved),
    x: 4.5,
    y: 4.5,
    angle: 0,
    moving: false,
    berserk: false,
    action: "idle",
    testBoosted: false,
    normalSnapshot: null,
    ...character,
  };
  players.set(socket.id, player);
  users[name] = serializeCharacter(player);
  saveUsers();
  ensureMonsterPopulation();
  return player;
}

function evictDuplicatePlayers(name, incomingId) {
  for (const current of [...players.values()]) {
    if (current.id === incomingId || current.name !== name) continue;
    persistCharacter(current);
    players.delete(current.id);
    io.to(ROOM_ID).emit("player:left", { id: current.id });
    io.sockets.sockets.get(current.id)?.disconnect(true);
  }
}

function newCharacter(name) {
  const isTestAccount = name.toLowerCase().endsWith("_test");
  return {
    displayName: isTestAccount ? name.slice(0, -5) : name,
    isTestAccount,
    level: 1,
    xp: 0,
    nextXp: 60,
    hp: 100,
    maxHp: 100,
    rage: 0,
    maxRage: 100,
    attackPower: 5,
    weaponLevel: 0,
    armorLevel: 0,
    weaponScrolls: 0,
    armorScrolls: 0,
    kills: 0,
    deaths: 0,
    lastLoginAt: Date.now(),
  };
}

function createRoom() {
  return {
    id: ROOM_ID,
    dungeonTier: 1,
    balrogDefeatedCount: 0,
    mapPattern: 0,
    map: buildMap(0),
    enemies: baseSpawns(0).map((spawn, index) => makeEnemy(spawn, index, 1)),
    balrogRespawnAt: 0,
    nextEnemyId: 1000,
  };
}

function resetDungeon() {
  room.dungeonTier = 1;
  room.balrogDefeatedCount = 0;
  room.mapPattern = 0;
  room.map = buildMap(0);
  room.balrogRespawnAt = 0;
  room.enemies = baseSpawns(0).map((spawn, index) => makeEnemy(spawn, index, 1));
  ensureMonsterPopulation();
  io.to(ROOM_ID).emit("dungeon:update", publicDungeon());
  io.to(ROOM_ID).emit("dungeon:notice", { text: "테스트 성채 초기화 - 1단계" });
}

function resetCharacters() {
  for (const key of Object.keys(users)) delete users[key];
  for (const player of players.values()) {
    const reset = newCharacter(player.name);
    Object.assign(player, reset, {
      x: player.x,
      y: player.y,
      angle: player.angle,
      roomId: ROOM_ID,
      testBoosted: false,
      normalSnapshot: null,
      berserk: false,
    });
    users[player.name] = serializeCharacter(player);
    io.to(player.id).emit("character:update", publicCharacter(player));
  }
  saveUsers();
  publishPlayers();
  io.to(ROOM_ID).emit("dungeon:notice", { text: "캐릭터 데이터 초기화" });
}

function publicDungeon() {
  return {
    roomId: ROOM_ID,
    dungeonTier: room.dungeonTier,
    balrogDefeatedCount: room.balrogDefeatedCount,
    balrogRespawnAt: room.balrogRespawnAt,
    mapPattern: room.mapPattern,
    playerCount: players.size,
    enemies: room.enemies.map(publicEnemy),
  };
}

function publicEnemy(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    level: enemy.level,
    x: enemy.x,
    y: enemy.y,
    spawnX: enemy.spawnX,
    spawnY: enemy.spawnY,
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    radius: enemy.radius,
    speed: enemy.speed,
    damage: enemy.damage,
    xp: enemy.xp,
    attackRange: enemy.attackRange,
    projectile: enemy.projectile,
    boss: enemy.boss,
    moving: enemy.moving,
    attackPose: enemy.attackPose,
    hitFlash: enemy.hitFlash,
    dead: enemy.dead,
    respawnTimer: Math.max(0, Math.ceil((enemy.respawnAt - Date.now()) / 1000)),
  };
}

function publicCharacter(player) {
  return serializeCharacter(player);
}

function publicPlayers() {
  return [...players.values()].map((player) => ({
    id: player.id,
    name: player.name,
    displayName: player.displayName,
    x: player.x,
    y: player.y,
    angle: player.angle,
    hp: player.hp,
    maxHp: player.maxHp,
    level: player.level,
    weaponLevel: player.weaponLevel,
    armorLevel: player.armorLevel,
    hop: player.hop || 0,
    moving: player.moving,
    berserk: player.berserk,
    action: player.action,
  }));
}

function publishPlayers() {
  io.to(ROOM_ID).emit("players:update", publicPlayers());
}

function tickDungeon(dt) {
  ensureMonsterPopulation();
  const now = Date.now();
  for (const enemy of room.enemies) {
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 5);
    enemy.attackPose = Math.max(0, enemy.attackPose - dt * 3);
    if (enemy.dead) {
      if (enemy.respawnAt && now >= enemy.respawnAt) respawnEnemy(enemy);
      continue;
    }
    const target = nearestPlayer(enemy);
    if (!target || inSafeZone(target.x, target.y)) {
      wanderEnemy(enemy, dt, now);
      continue;
    }
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const aggro = enemy.type === "balrog" ? 23 : enemy.projectile ? 15 : enemy.boss ? 14 : 12;
    if (dist > aggro || !lineOfSight(room.map, enemy.x, enemy.y, target.x, target.y)) {
      wanderEnemy(enemy, dt, now);
      continue;
    }
    const reach = enemy.attackRange + enemy.radius * 0.65 + 0.18;
    if (dist > reach) {
      moveOnMap(enemy, (dx / dist) * enemy.speed * dt, (dy / dist) * enemy.speed * dt, enemy.radius);
      enemy.moving = true;
      continue;
    }
    enemy.moving = false;
    if (now >= enemy.nextAttackAt) {
      enemy.nextAttackAt = now + Math.floor((enemy.type === "balrog" ? 1250 : enemy.boss ? 1100 : 950));
      enemy.attackPose = 1;
      damagePlayerFromEnemy(target, enemy);
    }
  }
  separateEnemies(dt);
}

function separateEnemies(dt) {
  const alive = room.enemies.filter((enemy) => !enemy.dead);
  for (let i = 0; i < alive.length; i += 1) {
    const a = alive[i];
    for (let j = i + 1; j < alive.length; j += 1) {
      const b = alive[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      const minDist = (a.radius + b.radius) * 0.92 + (a.boss || b.boss ? 0.08 : 0.04);
      if (dist >= minDist) continue;
      if (dist < 0.001) {
        const angle = ((i * 31 + j * 17) % 16) * Math.PI / 8;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 0.001;
      }
      const ux = dx / dist;
      const uy = dy / dist;
      const overlap = Math.min(minDist - Math.min(dist, minDist), 0.1 + dt * 0.6);
      const aMass = enemySeparationMass(a);
      const bMass = enemySeparationMass(b);
      const totalMass = aMass + bMass;
      moveOnMap(a, -ux * overlap * (bMass / totalMass), -uy * overlap * (bMass / totalMass), a.radius);
      moveOnMap(b, ux * overlap * (aMass / totalMass), uy * overlap * (aMass / totalMass), b.radius);
    }
  }
}

function wanderEnemy(enemy, dt, now) {
  if (enemy.type === "balrog") {
    enemy.moving = false;
    return;
  }
  const leash = enemy.boss ? 2.4 : 4.2;
  const fromSpawn = Math.hypot(enemy.x - enemy.spawnX, enemy.y - enemy.spawnY);
  if (fromSpawn > leash) {
    const homeX = enemy.spawnX - enemy.x;
    const homeY = enemy.spawnY - enemy.y;
    const homeDist = Math.hypot(homeX, homeY) || 1;
    moveOnMap(enemy, homeX / homeDist * enemy.speed * dt * 0.56, homeY / homeDist * enemy.speed * dt * 0.56, enemy.radius);
    enemy.moving = true;
    return;
  }
  if (!enemy.wanderUntil || now >= enemy.wanderUntil) {
    enemy.wanderUntil = now + 850 + Math.floor(Math.random() * 1750);
    enemy.wanderAngle += (Math.random() - 0.5) * Math.PI * 1.45;
  }
  const pace = enemy.boss ? 0.22 : 0.4;
  moveOnMap(enemy, Math.cos(enemy.wanderAngle) * enemy.speed * dt * pace, Math.sin(enemy.wanderAngle) * enemy.speed * dt * pace, enemy.radius);
  enemy.moving = true;
}

function enemySeparationMass(enemy) {
  if (enemy.type === "balrog") return 5;
  if (enemy.boss) return 2.4;
  if (enemy.type === "ogre") return 1.5;
  return 1;
}

function damagePlayerFromEnemy(player, enemy) {
  const mitigation = Math.min(0.82, player.armorLevel / (player.armorLevel + 90));
  const damage = Math.max(1, Math.ceil(enemy.damage * (1 - mitigation)));
  player.hp = Math.max(0, player.hp - damage);
  if (player.hp === 0) player.deaths += 1;
  persistCharacter(player);
  io.to(player.id).emit("player:damaged", { damage, hp: player.hp, sourceX: enemy.x, sourceY: enemy.y });
}

function attackEnemies(socket, attack) {
  const player = players.get(socket.id);
  if (!player) return;
  const kind = attack.kind === "special" ? "special" : "normal";
  const range = kind === "special" ? 3.05 : 2.15;
  const arc = kind === "special" ? 0.62 : 0.38;
  const base = Math.max(1, player.attackPower + player.weaponLevel + Math.floor((player.level - 1) / 2));
  const damage = Math.ceil((kind === "special" ? base * 2 + 2 : base) * (player.berserk ? 1.5 : 1));
  const hits = room.enemies
    .filter((enemy) => !enemy.dead)
    .map((enemy) => {
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      return { enemy, dist: Math.hypot(dx, dy), delta: Math.abs(normAngle(Math.atan2(dy, dx) - player.angle)) };
    })
    .filter((hit) =>
      hit.dist < range + hit.enemy.radius * 0.78
      && hit.delta < arc
      && lineOfSight(room.map, player.x, player.y, hit.enemy.x, hit.enemy.y))
    .sort((a, b) => a.dist - b.dist);
  const targets = kind === "special" ? hits : hits.slice(0, 1);
  for (const hit of targets) applyEnemyDamage(socket, player, hit.enemy, damage);
}

function applyEnemyDamage(socket, player, enemy, damage) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.hitFlash = 1;
  io.to(ROOM_ID).emit("enemy:hit", { id: enemy.id, x: enemy.x, y: enemy.y, damage, boss: enemy.boss, attackerId: player.id });
  if (enemy.hp > 0) return;
  enemy.dead = true;
  enemy.respawnAt = Date.now() + respawnDelay(enemy);
  player.kills += 1;
  grantXp(player, enemy.xp);
  persistCharacter(player);
  socket.emit("player:reward", { xp: enemy.xp, kills: player.kills, enemyId: enemy.id });
  io.to(ROOM_ID).emit("enemy:defeated", { enemy: publicEnemy(enemy), killerId: player.id });
  if (enemy.type === "balrog") onBalrogDefeated();
}

function onBalrogDefeated() {
  room.balrogDefeatedCount += 1;
  room.dungeonTier += 1;
  room.balrogRespawnAt = Date.now() + BALROG_RESPAWN_MS;
  io.to(ROOM_ID).emit("dungeon:notice", { text: `발록 처치 - 성채 ${room.dungeonTier}단계 준비` });
}

function respawnEnemy(enemy) {
  if (enemy.type === "balrog") {
    if (Date.now() < room.balrogRespawnAt) return;
    room.mapPattern = (room.mapPattern + 1) % 4;
    room.map = buildMap(room.mapPattern);
    const next = balrogSpawn(room.mapPattern);
    enemy.spawnX = next.x;
    enemy.spawnY = next.y;
    room.balrogRespawnAt = 0;
    io.to(ROOM_ID).emit("dungeon:notice", { text: `발록 재등장 - 성채 ${room.dungeonTier}단계` });
  }
  Object.assign(enemy, makeEnemy({ type: enemy.type, x: enemy.spawnX, y: enemy.spawnY }, enemy.id, room.dungeonTier));
}

function ensureMonsterPopulation() {
  const desiredExtras = Math.max(0, Math.min(72, players.size * 4 + Math.max(0, players.size - 1) * 5));
  const extras = room.enemies.filter((enemy) => enemy.extra).length;
  if (extras >= desiredExtras) return;
  const candidates = baseSpawns(room.mapPattern).filter((spawn) => spawn.type !== "balrog" && !isBossType(spawn.type));
  for (let index = extras; index < desiredExtras; index += 1) {
    const base = candidates[(index * 7 + room.dungeonTier) % candidates.length];
    const shift = ((index % 3) - 1) * 0.42;
    const enemy = makeEnemy({ type: base.type, x: base.x + shift, y: base.y - shift }, room.nextEnemyId++, room.dungeonTier);
    enemy.extra = true;
    room.enemies.push(enemy);
  }
}

function nearestPlayer(enemy) {
  let best = null;
  for (const player of players.values()) {
    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (!best || dist < best.dist) best = { ...player, dist };
  }
  return best;
}

function makeEnemy(spawn, id, tier) {
  const stats = enemyStats(spawn.type, tier);
  const level = enemyLevel(spawn.type, tier);
  return {
    id: typeof id === "string" ? id : `monster-${id}`,
    type: spawn.type,
    level,
    x: spawn.x,
    y: spawn.y,
    spawnX: spawn.x,
    spawnY: spawn.y,
    hp: stats.hp,
    maxHp: stats.hp,
    radius: stats.radius,
    speed: stats.speed,
    damage: stats.damage,
    xp: stats.xp,
    attackRange: stats.attackRange,
    projectile: Boolean(stats.projectile),
    boss: Boolean(stats.boss),
    dead: false,
    respawnAt: 0,
    nextAttackAt: 0,
    moving: false,
    attackPose: 0,
    hitFlash: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    wanderUntil: 0,
  };
}

function enemyStats(type, tier) {
  const growth = Math.max(0, tier - 1);
  const hpScale = 1 + growth * 0.22 + growth * growth * 0.018;
  const damageScale = 1 + growth * 0.14 + growth * growth * 0.008;
  const base = {
    skeleton: { hp: 10, speed: 0.94, damage: 4, radius: 0.27, xp: 24, attackRange: 1.15 },
    orc: { hp: 16, speed: 0.74, damage: 6, radius: 0.32, xp: 42, attackRange: 1.28 },
    ogre: { hp: 34, speed: 0.44, damage: 14, radius: 0.48, xp: 108, attackRange: 1.6 },
    warlock: { hp: 20, speed: 0.52, damage: 7, radius: 0.3, xp: 82, attackRange: 4.75, projectile: true },
    skeletonKing: { hp: 150, speed: 0.56, damage: 18, radius: 0.42, xp: 420, attackRange: 1.58, boss: true },
    boss: { hp: 140, speed: 0.62, damage: 18, radius: 0.42, xp: 390, attackRange: 1.5, boss: true },
    deathKnight: { hp: 220, speed: 0.68, damage: 24, radius: 0.43, xp: 620, attackRange: 1.65, boss: true },
    ogreLord: { hp: 310, speed: 0.42, damage: 34, radius: 0.58, xp: 820, attackRange: 1.85, boss: true },
    warlockLord: { hp: 250, speed: 0.48, damage: 24, radius: 0.36, xp: 760, attackRange: 5.35, projectile: true, boss: true },
    balrog: { hp: 1300, speed: 0.5, damage: 55, radius: 0.9, xp: 4200, attackRange: 2.45, boss: true },
  }[type] || { hp: 16, speed: 0.74, damage: 6, radius: 0.32, xp: 42, attackRange: 1.28 };
  const bossHp = type === "balrog" ? 4.2 : base.boss ? 1.9 : 1.25;
  const bossDamage = type === "balrog" ? 1.65 : base.boss ? 1.28 : 1.08;
  return {
    ...base,
    hp: Math.ceil(base.hp * hpScale * bossHp),
    damage: Math.ceil(base.damage * damageScale * bossDamage),
    xp: Math.ceil(base.xp * (1 + growth * 0.35)),
  };
}

function enemyLevel(type, tier) {
  const base = { skeleton: 1, orc: 3, warlock: 6, ogre: 8, skeletonKing: 8, boss: 10, deathKnight: 12, warlockLord: 12, ogreLord: 14, balrog: 15 }[type] || 1;
  return base + (tier - 1) * (type === "balrog" ? 5 : isBossType(type) ? 4 : 3);
}

function grantXp(player, amount) {
  player.xp += Math.floor(amount);
  while (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.level += 1;
    player.nextXp = Math.floor(player.nextXp * 1.27 + 24 + player.level * 2.4);
    player.maxHp += 14;
    player.hp = player.maxHp;
    player.attackPower += 1;
    player.maxRage = Math.min(220, player.maxRage + 8);
  }
}

function applyTestBoost(player) {
  if (!player.testBoosted) player.normalSnapshot = serializeCharacter(player);
  player.testBoosted = true;
  player.level = 9999;
  player.weaponLevel = 9999;
  player.armorLevel = 9999;
  player.attackPower = 9999;
  player.maxHp = 999999;
  player.hp = player.maxHp;
  player.maxRage = 9999;
  player.rage = player.maxRage;
  player.xp = 0;
  player.nextXp = 999999999;
  player.berserk = true;
}

function restoreNormalTest(player) {
  const snapshot = player.normalSnapshot && player.normalSnapshot.level < 9999
    ? player.normalSnapshot
    : newCharacter(player.name);
  Object.assign(player, snapshot, { testBoosted: false, berserk: false, normalSnapshot: null });
}

function serializeCharacter(player) {
  return {
    name: player.name,
    displayName: player.displayName,
    isTestAccount: Boolean(player.isTestAccount),
    level: Math.max(1, Math.floor(player.level || 1)),
    xp: Math.max(0, Math.floor(player.xp || 0)),
    nextXp: Math.max(60, Math.floor(player.nextXp || 60)),
    hp: Math.max(0, Math.floor(player.hp || 0)),
    maxHp: Math.max(100, Math.floor(player.maxHp || 100)),
    rage: Math.max(0, Math.floor(player.rage || 0)),
    maxRage: Math.max(100, Math.floor(player.maxRage || 100)),
    attackPower: Math.max(5, Math.floor(player.attackPower || 5)),
    weaponLevel: Math.max(0, Math.floor(player.weaponLevel || 0)),
    armorLevel: Math.max(0, Math.floor(player.armorLevel || 0)),
    weaponScrolls: Math.max(0, Math.floor(player.weaponScrolls || 0)),
    armorScrolls: Math.max(0, Math.floor(player.armorScrolls || 0)),
    kills: Math.max(0, Math.floor(player.kills || 0)),
    deaths: Math.max(0, Math.floor(player.deaths || 0)),
    lastLoginAt: Date.now(),
  };
}

function persistCharacter(player) {
  users[player.name] = player.testBoosted && player.normalSnapshot
    ? { ...player.normalSnapshot, lastLoginAt: Date.now() }
    : serializeCharacter(player);
}

function sanitizeState(state) {
  return {
    x: finite(state.x, 4.5),
    y: finite(state.y, 4.5),
    angle: finite(state.angle, 0),
    hp: Math.max(0, finite(state.hp, 0)),
    maxHp: Math.max(1, finite(state.maxHp, 100)),
    rage: Math.max(0, finite(state.rage, 0)),
    maxRage: Math.max(1, finite(state.maxRage, 100)),
    level: Math.max(1, Math.floor(finite(state.level, 1))),
    xp: Math.max(0, Math.floor(finite(state.xp, 0))),
    nextXp: Math.max(60, Math.floor(finite(state.nextXp, 60))),
    attackPower: Math.max(5, Math.floor(finite(state.attackPower, 5))),
    weaponLevel: Math.max(0, Math.floor(finite(state.weaponLevel, 0))),
    armorLevel: Math.max(0, Math.floor(finite(state.armorLevel, 0))),
    weaponScrolls: Math.max(0, Math.floor(finite(state.weaponScrolls, 0))),
    armorScrolls: Math.max(0, Math.floor(finite(state.armorScrolls, 0))),
    kills: Math.max(0, Math.floor(finite(state.kills, 0))),
    hop: Math.max(0, Math.min(0.7, finite(state.hop, 0))),
    moving: Boolean(state.moving),
    berserk: Boolean(state.berserk),
    action: state.action === "specialAttack" || state.action === "attack" ? state.action : "idle",
  };
}

function sanitizeName(value) {
  const name = String(value || "전사").replace(/\s+/g, " ").trim().slice(0, 18);
  return name || "전사";
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
  } catch (_) {
    return {};
  }
}

function saveUsers() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function respawnDelay(enemy) {
  if (enemy.type === "balrog") return BALROG_RESPAWN_MS;
  if (enemy.boss) return 26000;
  if (enemy.type === "ogre") return 12000;
  if (enemy.type === "warlock") return 10000;
  return 6000;
}

function baseSpawns(pattern = 0) {
  const balrog = balrogSpawn(pattern);
  return [
    ["skeleton", 15.5, 3.5], ["skeleton", 16.5, 5.5], ["skeleton", 17.5, 9.5], ["skeleton", 20.5, 11.5],
    ["skeleton", 21.5, 13.5], ["orc", 23.5, 5.5], ["orc", 28.5, 3.5], ["orc", 29.5, 6.5],
    ["skeleton", 25.5, 10.5], ["skeleton", 31.5, 11.5], ["orc", 25.5, 12.5],
    ["skeleton", 5.5, 17.5], ["skeleton", 9.5, 18.5], ["skeleton", 14.5, 18.5], ["skeleton", 10.5, 23.5],
    ["skeleton", 8.5, 24.5], ["skeleton", 16.5, 22.5], ["skeleton", 6.5, 27.5], ["skeleton", 13.5, 27.5],
    ["orc", 18.5, 25.5], ["orc", 20.5, 23.5], ["orc", 25.5, 19.5], ["orc", 30.5, 19.5],
    ["orc", 24.5, 21.5], ["orc", 28.5, 17.5], ["orc", 36.5, 19.5], ["orc", 33.5, 23.5],
    ["orc", 37.5, 27.5], ["orc", 40.5, 26.5], ["ogre", 29.5, 25.5], ["skeletonKing", 14.5, 24.5],
    ["boss", 38.5, 22.5], ["warlock", 43.5, 4.5], ["warlock", 48.5, 5.5], ["warlock", 42.5, 8.5],
    ["warlock", 57.5, 5.5], ["warlock", 50.5, 8.5], ["warlock", 45.5, 10.5], ["warlock", 52.5, 11.5],
    ["warlockLord", 55.5, 13.5], ["ogre", 47.5, 19.5], ["ogre", 45.5, 22.5], ["ogre", 53.5, 19.5],
    ["ogre", 58.5, 20.5], ["ogre", 49.5, 24.5], ["ogre", 56.5, 25.5], ["ogre", 47.5, 27.5],
    ["ogreLord", 58.5, 27.5], ["deathKnight", 31.5, 31.5], ["deathKnight", 38.5, 30.5],
    ["warlock", 34.5, 30.5], ["warlock", 42.5, 32.5], ["deathKnight", 49.5, 33.5],
    ["deathKnight", 52.5, 31.5], ["deathKnight", 55.5, 33.5], ["warlockLord", 44.5, 33.5],
    ["balrog", balrog.x, balrog.y],
  ].map(([type, x, y]) => ({ type, x, y }));
}

function balrogSpawn(pattern) {
  return [
    { x: 58.5, y: 31.5 },
    { x: 49.5, y: 12.5 },
    { x: 31.5, y: 33.5 },
    { x: 58.5, y: 20.5 },
  ][pattern % 4];
}

function buildMap(pattern = 0) {
  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill("#"));
  const carve = (x, y, w, h) => {
    for (let cy = y; cy < y + h; cy += 1) for (let cx = x; cx < x + w; cx += 1) if (cx > 0 && cx < MAP_W - 1 && cy > 0 && cy < MAP_H - 1) grid[cy][cx] = ".";
  };
  const wall = (x1, y1, x2, y2) => {
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    for (let x = x1, y = y1; ; x += dx, y += dy) {
      grid[y][x] = "#";
      if (x === x2 && y === y2) break;
    }
  };
  [[1, 1, 9, 8], [9, 4, 8, 3], [15, 2, 17, 12], [17, 12, 4, 5], [3, 15, 18, 11],
    [5, 25, 12, 5], [16, 23, 3, 5], [27, 12, 4, 7], [23, 17, 19, 11], [30, 6, 12, 3],
    [40, 2, 19, 14], [40, 21, 7, 3], [45, 17, 17, 12], [34, 26, 4, 5], [49, 25, 4, 6],
    [28, 29, 23, 6], [49, 31, 6, 3], [53, 28, 10, 7]].forEach((area) => carve(...area));
  [[21, 5, 21, 8], [26, 6, 26, 10], [7, 19, 10, 19], [13, 17, 13, 20], [14, 23, 18, 23],
    [28, 21, 31, 21], [35, 18, 35, 20], [36, 25, 39, 25], [46, 6, 46, 9], [52, 4, 55, 4],
    [53, 11, 57, 11], [50, 21, 50, 23], [56, 18, 56, 21], [58, 25, 60, 25],
    [34, 32, 37, 32], [44, 30, 44, 32], [56, 30, 56, 32], [60, 31, 60, 33]].forEach((line) => wall(...line));
  if (pattern === 1) {
    carve(36, 9, 8, 3); carve(47, 10, 12, 5); carve(41, 15, 6, 4);
    wall(55, 8, 55, 11); wall(48, 13, 51, 13); wall(40, 12, 44, 12);
  }
  if (pattern === 2) {
    carve(22, 28, 11, 6); carve(20, 30, 5, 3); carve(17, 27, 8, 4);
    wall(27, 30, 27, 33); wall(31, 32, 34, 32); wall(22, 27, 22, 29);
  }
  if (pattern === 3) {
    carve(50, 15, 13, 10); carve(40, 18, 12, 3); carve(52, 24, 8, 4);
    wall(47, 21, 50, 21); wall(55, 18, 55, 22); wall(60, 24, 60, 27);
  }
  return grid.map((row) => row.join(""));
}

function lineOfSight(map, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, dist = Math.hypot(dx, dy);
  for (let i = 1, steps = Math.max(3, Math.ceil(dist / 0.08)); i < steps; i += 1) {
    if (isWall(map, x1 + dx * i / steps, y1 + dy * i / steps)) return false;
  }
  return true;
}

function moveOnMap(actor, dx, dy, radius) {
  const nx = actor.x + dx, ny = actor.y + dy;
  if (!isWall(room.map, nx + Math.sign(dx) * radius, actor.y) && !isWall(room.map, nx, actor.y - radius) && !isWall(room.map, nx, actor.y + radius)) actor.x = nx;
  if (!isWall(room.map, actor.x, ny + Math.sign(dy) * radius) && !isWall(room.map, actor.x - radius, ny) && !isWall(room.map, actor.x + radius, ny)) actor.y = ny;
}

function isWall(map, x, y) {
  const mx = Math.floor(x), my = Math.floor(y);
  return my < 0 || my >= map.length || mx < 0 || mx >= map[0].length || map[my][mx] === "#";
}

function inSafeZone(x, y) {
  return x < 9.8 && y < 8.8;
}

function isBossType(type) {
  return ["skeletonKing", "boss", "deathKnight", "ogreLord", "warlockLord", "balrog"].includes(type);
}

function normAngle(angle) {
  while (angle < -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

server.listen(PORT, () => {
  console.log(`Paper Citadel multiplayer server listening on ${PORT}`);
});
