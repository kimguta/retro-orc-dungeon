const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nameScreen = document.getElementById("name-screen");
const nameInput = document.getElementById("character-name");
const nameStatus = document.getElementById("name-status");
const DPR = Math.min(2, window.devicePixelRatio || 1);
const W = Math.max(1280, Math.round(window.innerWidth || canvas.width));
const H = Math.max(720, Math.round(window.innerHeight || canvas.height));
canvas.width = Math.round(W * DPR);
canvas.height = Math.round(H * DPR);
ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
ctx.imageSmoothingEnabled = false;
const HALF_H = H / 2;
const FOV = Math.PI / 3;
const RAYS = 960;
const MAX_DEPTH = 18;
const TILE = 64;
const TURN_SPEED = 1.95;
const MOVE_SPEED = 2.1;
const SPECIAL_RAGE_COST = 40;
const BERSERK_DRAIN_PER_SECOND = 7.5;
const DEATH_RESPAWN_SECONDS = 5;
const SAVE_KEY = "paperCitadelProgressV1";
const LEGACY_SAVE_KEY = "shadowCitadelProgressV1";
const LAST_NAME_KEY = "paperCitadelLastNameV1";
const SOCKET_SERVER_URL =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : (window.PAPER_CITADEL_SOCKET_URL || "https://paper-citadel-server.onrender.com");

const MAP_W = 64;
const MAP_H = 36;
const BASE_MAP = buildBaseMap();

const player = {
  x: 4.5,
  y: 4.5,
  angle: 0,
  hp: 100,
  hurt: 0,
  maxHp: 100,
  rage: 0,
  maxRage: 100,
  level: 1,
  xp: 0,
  nextXp: 60,
  attackPower: 5,
  weaponLevel: 0,
  armorLevel: 0,
  weaponScrolls: 0,
  armorScrolls: 0,
};

const roomState = {
  dungeonTier: 1,
  balrogDefeatedCount: 0,
};
let map = buildMap();
let enemies = [];
let items = [];
let projectiles = [];

const keys = new Set();
const depths = new Array(RAYS).fill(MAX_DEPTH);
let last = performance.now();
let kills = 0;
if (!SOCKET_SERVER_URL) loadProgress();
let swing = 0;
let swingCooldown = 0;
let swingType = "normal";
let gameState = "start";
let mouseActive = false;
let messagePulse = 0;
let started = false;
let hitSpark = 0;
let screenShake = 0;
let jumpLift = 0;
let jumpVelocity = 0;
let damagePops = [];
let deathParticles = [];
let deathBursts = [];
let notice = "던전 필드";
let noticeTimer = 0;
let dialogueText = "";
let dialogueSpeaker = "";
let dialogueTimer = 0;
let berserk = false;
let deathTimer = 0;
let hurtDirection = 0;
let hurtDirectionTimer = 0;
let characterName = "";
let multiplayerSocket = null;
let multiplayerRoomId = "";
let networkTimer = 0;
let serverDungeonLive = false;
let serverPlayerCount = 1;
let balrogRespawnAt = 0;
let mapPattern = 0;
let testBoosted = false;
const remotePlayers = new Map();

const SPAWN_POINTS = [
  { type: "skeleton", x: 15.5, y: 3.5 },
  { type: "skeleton", x: 16.5, y: 5.5 },
  { type: "skeleton", x: 17.5, y: 9.5 },
  { type: "skeleton", x: 20.5, y: 11.5 },
  { type: "skeleton", x: 21.5, y: 13.5 },
  { type: "orc", x: 23.5, y: 5.5 },
  { type: "orc", x: 28.5, y: 3.5 },
  { type: "skeleton", x: 18.5, y: 8.5 },
  { type: "skeleton", x: 25.5, y: 10.5 },
  { type: "orc", x: 29.5, y: 6.5 },
  { type: "orc", x: 25.5, y: 12.5 },
  { type: "skeleton", x: 31.5, y: 11.5 },
  { type: "skeleton", x: 5.5, y: 17.5 },
  { type: "skeleton", x: 4.5, y: 16.5 },
  { type: "skeleton", x: 9.5, y: 18.5 },
  { type: "skeleton", x: 14.5, y: 18.5 },
  { type: "skeleton", x: 4.5, y: 22.5 },
  { type: "skeleton", x: 10.5, y: 23.5 },
  { type: "skeleton", x: 8.5, y: 24.5 },
  { type: "skeleton", x: 16.5, y: 22.5 },
  { type: "skeleton", x: 18.5, y: 17.5 },
  { type: "skeleton", x: 6.5, y: 27.5 },
  { type: "skeleton", x: 13.5, y: 27.5 },
  { type: "orc", x: 18.5, y: 25.5 },
  { type: "orc", x: 20.5, y: 23.5 },
  { type: "orc", x: 6.5, y: 20.5 },
  { type: "orc", x: 17.5, y: 20.5 },
  { type: "skeletonKing", x: 14.5, y: 24.5 },
  { type: "orc", x: 25.5, y: 19.5 },
  { type: "orc", x: 30.5, y: 19.5 },
  { type: "orc", x: 24.5, y: 21.5 },
  { type: "orc", x: 28.5, y: 17.5 },
  { type: "orc", x: 36.5, y: 19.5 },
  { type: "orc", x: 26.5, y: 23.5 },
  { type: "orc", x: 33.5, y: 23.5 },
  { type: "orc", x: 37.5, y: 27.5 },
  { type: "orc", x: 24.5, y: 26.5 },
  { type: "orc", x: 32.5, y: 27.5 },
  { type: "orc", x: 40.5, y: 18.5 },
  { type: "orc", x: 39.5, y: 24.5 },
  { type: "ogre", x: 29.5, y: 25.5 },
  { type: "boss", x: 38.5, y: 22.5 },
  { type: "orc", x: 40.5, y: 26.5 },
  { type: "warlock", x: 43.5, y: 4.5 },
  { type: "warlock", x: 48.5, y: 5.5 },
  { type: "warlock", x: 42.5, y: 8.5 },
  { type: "warlock", x: 57.5, y: 5.5 },
  { type: "warlock", x: 50.5, y: 8.5 },
  { type: "warlock", x: 45.5, y: 10.5 },
  { type: "warlock", x: 52.5, y: 11.5 },
  { type: "warlock", x: 42.5, y: 14.5 },
  { type: "warlock", x: 58.5, y: 14.5 },
  { type: "warlock", x: 58.5, y: 10.5 },
  { type: "warlock", x: 48.5, y: 13.5 },
  { type: "warlock", x: 41.5, y: 12.5 },
  { type: "ogre", x: 56.5, y: 8.5 },
  { type: "warlockLord", x: 55.5, y: 13.5 },
  { type: "ogre", x: 47.5, y: 19.5 },
  { type: "ogre", x: 45.5, y: 22.5 },
  { type: "ogre", x: 53.5, y: 19.5 },
  { type: "ogre", x: 58.5, y: 20.5 },
  { type: "ogre", x: 60.5, y: 18.5 },
  { type: "ogre", x: 49.5, y: 24.5 },
  { type: "orc", x: 47.5, y: 25.5 },
  { type: "ogre", x: 56.5, y: 25.5 },
  { type: "ogre", x: 47.5, y: 27.5 },
  { type: "ogre", x: 53.5, y: 27.5 },
  { type: "orc", x: 51.5, y: 22.5 },
  { type: "ogre", x: 61.5, y: 27.5 },
  { type: "orc", x: 60.5, y: 23.5 },
  { type: "ogreLord", x: 58.5, y: 27.5 },
  { type: "deathKnight", x: 31.5, y: 31.5 },
  { type: "warlock", x: 34.5, y: 30.5 },
  { type: "deathKnight", x: 38.5, y: 30.5 },
  { type: "deathKnight", x: 29.5, y: 33.5 },
  { type: "warlock", x: 42.5, y: 32.5 },
  { type: "warlock", x: 40.5, y: 34.5 },
  { type: "ogre", x: 47.5, y: 31.5 },
  { type: "deathKnight", x: 49.5, y: 33.5 },
  { type: "deathKnight", x: 52.5, y: 31.5 },
  { type: "deathKnight", x: 55.5, y: 33.5 },
  { type: "warlockLord", x: 44.5, y: 33.5 },
  { type: "balrog", x: 58.5, y: 31.5 },
];

const TOWN_NPCS = [
  {
    name: "안전지대 관리인",
    x: 2.2,
    y: 2.25,
    hp: 30,
    maxHp: 30,
    line: "안녕하세요. 체력을 회복해드릴게요.",
  },
];

const TOWN_PROPS = [
  { type: "lantern", x: 4.1, y: 3.15 },
  { type: "sign", x: 5.9, y: 3.05 },
  { type: "banner", x: 1.55, y: 3.65 },
  { type: "crate", x: 3.35, y: 4.85 },
  { type: "well", x: 5.05, y: 2.65 },
];
const ZONE_PROPS = [
  { type: "grave", x: 6.5, y: 17.5 },
  { type: "grave", x: 17.5, y: 21.5 },
  { type: "grave", x: 9.5, y: 27.5 },
  { type: "grave", x: 13.5, y: 18.5 },
  { type: "banner", x: 25.5, y: 18.5 },
  { type: "banner", x: 34.5, y: 21.5 },
  { type: "rack", x: 40.5, y: 25.5 },
  { type: "crate", x: 31.5, y: 26.5 },
  { type: "rack", x: 26.5, y: 24.5 },
  { type: "altar", x: 43.5, y: 5.5 },
  { type: "lantern", x: 56.5, y: 13.5 },
  { type: "altar", x: 58.5, y: 11.5 },
  { type: "obelisk", x: 49.5, y: 10.5 },
  { type: "boulder", x: 48.5, y: 19.5 },
  { type: "boulder", x: 60.5, y: 27.5 },
  { type: "lantern", x: 52.5, y: 24.5 },
  { type: "ember", x: 35.5, y: 33.5 },
  { type: "obelisk", x: 46.5, y: 31.5 },
  { type: "ember", x: 55.5, y: 30.5 },
  { type: "obelisk", x: 61.5, y: 33.5 },
];
const WORLD_PROPS = [...TOWN_PROPS, ...ZONE_PROPS];

enemies = buildEnemies();

function enemy(type, x, y, tier = roomState.dungeonTier) {
  const tierBonus = Math.max(0, tier - 1);
  const stats = enemyStats(type, tierBonus);
  const level = enemyLevel(type, tier, x, y);
  const levelBonus = Math.max(0, level - 1);
  const hpScale = type === "balrog" ? 18 : stats.boss ? 8.5 : 2.2;
  const hp = Math.max(1, stats.hp + Math.floor(levelBonus * hpScale));
  return {
    type,
    dungeonTier: tier,
    level,
    x,
    y,
    spawnX: x,
    spawnY: y,
    hp,
    maxHp: hp,
    radius: stats.radius,
    speed: stats.speed,
    damage: stats.damage + Math.floor(levelBonus * (type === "balrog" ? 1.85 : stats.boss ? 0.92 : 0.42)),
    xp: stats.xp + Math.floor(Math.pow(level + 2, stats.boss ? 1.38 : 1.28) * (type === "balrog" ? 12 : stats.boss ? 5 : 1.5)),
    attackRange: stats.attackRange,
    windup: stats.windup,
    cooldown: stats.cooldown,
    projectile: stats.projectile,
    boss: stats.boss,
    attackTimer: 0,
    attackWindup: 0,
    hitFlash: 0,
    stun: 0,
    knockX: 0,
    knockY: 0,
    step: Math.random() * Math.PI * 2,
    moving: false,
    attackPose: 0,
    alert: 0,
    dead: false,
    respawnTimer: 0,
  };
}

function enemyLevel(type, tier, x, y) {
  const base = {
    skeleton: 1,
    orc: 3,
    warlock: 6,
    ogre: 8,
    skeletonKing: 8,
    boss: 10,
    deathKnight: 12,
    ogreLord: 14,
    warlockLord: 12,
    balrog: 15,
  }[type] || 2;
  const step = type === "balrog" ? 5 : isBossType(type) ? 4 : 3;
  const variance = type === "balrog" ? 1 : isBossType(type) ? 3 : 3;
  return base + (tier - 1) * step + spawnVariance(type, x, y, variance);
}

function spawnVariance(type, x, y, variance) {
  if (variance <= 1) return 0;
  const code = [...type].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return Math.abs(Math.floor(x * 19 + y * 31 + code)) % variance;
}

function enemyStats(type, tierBonus) {
  const growth = tierPower(tierBonus, type === "balrog" ? 0.38 : isBossType(type) ? 0.24 : 0.11);
  const speedTier = Math.min(8, tierBonus);
  const stats = {
    skeleton: { hp: 13 + growth * 2.8, speed: 0.94 + speedTier * 0.035, damage: 5 + growth * 0.52, radius: 0.27, xp: 18 + growth * 6, attackRange: 1.15, windup: 0.32, cooldown: 0.8 },
    orc: { hp: 22 + growth * 3.7, speed: 0.74 + speedTier * 0.035, damage: 8 + growth * 0.9, radius: 0.32, xp: 28 + growth * 8, attackRange: 1.28, windup: 0.4, cooldown: 1.02 },
    ogre: { hp: 48 + growth * 6.4, speed: 0.44 + speedTier * 0.022, damage: 17 + growth * 1.35, radius: 0.48, xp: 72 + growth * 14, attackRange: 1.6, windup: 0.66, cooldown: 1.42 },
    warlock: { hp: 28 + growth * 4.2, speed: 0.52 + speedTier * 0.024, damage: 9 + growth * 0.96, radius: 0.3, xp: 54 + growth * 12, attackRange: 4.75, windup: 0.58, cooldown: 1.5, projectile: true },
    skeletonKing: { hp: 150 + growth * 23, speed: 0.56 + speedTier * 0.026, damage: 18 + growth * 1.55, radius: 0.42, xp: 260 + growth * 38, attackRange: 1.58, windup: 0.5, cooldown: 1.1, boss: true },
    boss: { hp: 140 + growth * 22, speed: 0.62 + speedTier * 0.03, damage: 18 + growth * 1.72, radius: 0.42, xp: 240 + growth * 36, attackRange: 1.5, windup: 0.48, cooldown: 1.15, boss: true },
    deathKnight: { hp: 220 + growth * 31, speed: 0.68 + speedTier * 0.026, damage: 24 + growth * 1.9, radius: 0.43, xp: 360 + growth * 50, attackRange: 1.65, windup: 0.48, cooldown: 1.02, boss: true },
    ogreLord: { hp: 310 + growth * 42, speed: 0.42 + speedTier * 0.02, damage: 34 + growth * 2.25, radius: 0.58, xp: 470 + growth * 64, attackRange: 1.85, windup: 0.66, cooldown: 1.28, boss: true },
    warlockLord: { hp: 250 + growth * 35, speed: 0.48 + speedTier * 0.022, damage: 24 + growth * 1.95, radius: 0.36, xp: 430 + growth * 60, attackRange: 5.35, windup: 0.62, cooldown: 1.18, projectile: true, boss: true },
    balrog: { hp: 4200 + growth * 310, speed: 0.5 + speedTier * 0.018, damage: 88 + growth * 5.4, radius: 0.9, xp: 2400 + growth * 210, attackRange: 2.45, windup: 0.68, cooldown: 1.18, boss: true },
  };
  return stats[type] || stats.orc;
}

function tierPower(tierBonus, curve) {
  return tierBonus + tierBonus * tierBonus * curve;
}

function isMidBossType(type) {
  return type === "deathKnight" || type === "ogreLord" || type === "warlockLord";
}

function isBossType(type) {
  return type === "skeletonKing" || type === "boss" || isMidBossType(type);
}

function buildEnemies() {
  return SPAWN_POINTS.map(({ type, x, y }) => enemy(zoneSpawnType(type, x, y), x, y));
}

function zoneSpawnType(original) {
  return original;
}

function saveProgress() {
  if (SOCKET_SERVER_URL) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      level: player.level,
      xp: player.xp,
      nextXp: player.nextXp,
      maxHp: player.maxHp,
      maxRage: player.maxRage,
      attackPower: player.attackPower,
      weaponLevel: player.weaponLevel,
      armorLevel: player.armorLevel,
      weaponScrolls: player.weaponScrolls,
      armorScrolls: player.armorScrolls,
      kills,
      roomState,
    }));
  } catch (_) {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    player.level = Math.max(1, Number(data.level) || player.level);
    player.xp = Math.max(0, Math.floor(Number(data.xp) || 0));
    player.nextXp = Math.max(60, Math.floor(Number(data.nextXp) || player.nextXp));
    player.maxHp = Math.max(100, Number(data.maxHp) || player.maxHp);
    player.hp = player.maxHp;
    player.maxRage = Math.max(100, Number(data.maxRage) || player.maxRage);
    player.attackPower = Math.max(5, Number(data.attackPower) || (5 + Math.floor((player.level - 1) * 1.2)));
    player.weaponLevel = Math.max(0, Number(data.weaponLevel) || 0);
    player.armorLevel = Math.max(0, Number(data.armorLevel) || 0);
    player.weaponScrolls = Math.max(0, Number(data.weaponScrolls) || 0);
    player.armorScrolls = Math.max(0, Number(data.armorScrolls) || 0);
    kills = Math.max(0, Number(data.kills) || 0);
    const savedRoom = data.roomState || data;
    roomState.balrogDefeatedCount = Math.max(0, Number(savedRoom.balrogDefeatedCount) || 0);
    roomState.dungeonTier = Math.max(1, Number(savedRoom.dungeonTier) || roomState.balrogDefeatedCount + 1);
  } catch (_) {
    localStorage.removeItem(SAVE_KEY);
  }
}

function spawnItem(type, x, y, value = 0) {
  items.push({
    type,
    x,
    y,
    value,
    bob: Math.random() * Math.PI * 2,
    expiresAt: performance.now() + 30000,
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

function spawnDeathBurst(target) {
  const palette = deathPalette(target.type);
  const count = target.type === "balrog" ? 176 : target.boss ? 116 : target.type === "ogre" ? 88 : 68;
  deathBursts.push({
    x: target.x,
    y: target.y,
    z: target.type === "balrog" ? 0.62 : target.boss ? 0.48 : 0.34,
    life: target.type === "balrog" ? 0.72 : target.boss ? 0.56 : 0.42,
    maxLife: target.type === "balrog" ? 0.72 : target.boss ? 0.56 : 0.42,
    boss: Boolean(target.boss),
    balrog: target.type === "balrog",
    palette,
  });
  screenShake = Math.max(screenShake, target.type === "balrog" ? 3.1 : target.boss ? 1.95 : 1.2);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.6 + Math.random() * (target.boss ? 2.8 : 1.9);
    const spark = i % 6 === 0;
    const puff = i % 13 === 0;
    const confetti = !spark && !puff && i % 2 === 0;
    deathParticles.push({
      x: target.x + (Math.random() - 0.5) * target.radius,
      y: target.y + (Math.random() - 0.5) * target.radius,
      z: 0.2 + Math.random() * (target.boss ? 1.15 : 0.85),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: 1.05 + Math.random() * (target.boss ? 3.1 : 2.55),
      life: 0.52 + Math.random() * (target.boss ? 0.82 : 0.52),
      maxLife: 0,
      size: 0.038 + Math.random() * (target.boss ? 0.11 : 0.068),
      kind: spark ? "spark" : puff ? "puff" : confetti ? "confetti" : "shard",
      color: palette[Math.floor(Math.random() * palette.length)],
    });
    deathParticles[deathParticles.length - 1].maxLife = deathParticles[deathParticles.length - 1].life;
  }
}

function deathPalette(type) {
  if (type === "balrog") return ["#ff5a22", "#d11e12", "#2a0907", "#ffd25a", "#111"];
  if (type === "skeleton" || type === "skeletonKing" || type === "deathKnight") return ["#f2e8c9", "#cfc3a3", "#6b6251", "#2a2b32"];
  if (type === "warlock" || type === "warlockLord") return ["#b75cff", "#53258c", "#241334", "#efc9ff"];
  if (type === "ogre" || type === "ogreLord") return ["#9aaa55", "#4e5f29", "#202412", "#6f1414"];
  return ["#5fc765", "#2f9c45", "#145b28", "#262728", "#f0d447"];
}

function addRage(amount) {
  player.rage = Math.min(player.maxRage, player.rage + amount * rageGainMultiplier());
  if (!berserk && player.rage >= player.maxRage) {
    berserk = true;
    notice = "광폭화";
    noticeTimer = 1.8;
    screenShake = Math.max(screenShake, 0.8);
  }
}

function levelAttackBonus() {
  return Math.floor((player.level - 1) / 2);
}

function levelSpeedMultiplier() {
  return 1 + Math.min(0.16, (player.level - 1) * 0.012);
}

function rageGainMultiplier() {
  return 1 + Math.min(0.3, (player.level - 1) * 0.025);
}

function gainXp(amount) {
  player.xp += Math.floor(amount);
  while (player.xp >= player.nextXp) {
    player.xp = Math.max(0, Math.floor(player.xp - player.nextXp));
    player.level += 1;
    player.nextXp = Math.floor(player.nextXp * 1.27 + 24 + player.level * 2.4);
    player.maxHp += 14;
    player.hp = player.maxHp;
    player.attackPower += 1;
    player.maxRage = Math.min(180, player.maxRage + 8);
    notice = `LEVEL UP! Lv.${player.level} 능력치 상승`;
    noticeTimer = 3.2;
    saveProgress();
  }
}

function spawnProjectile(e, ux, uy) {
  const fire = e.type === "balrog";
  projectiles.push({
    x: e.x + ux * 0.35,
    y: e.y + uy * 0.35,
    vx: ux * (fire ? 4.1 : 3.2),
    vy: uy * (fire ? 4.1 : 3.2),
    damage: fire ? Math.ceil(e.damage * 0.72) : e.damage,
    life: fire ? 1.8 : 2.6,
    radius: fire ? 0.48 : 0.34,
    type: fire ? "fire" : "magic",
    bob: Math.random() * Math.PI * 2,
  });
}

function reviveEnemy(e) {
  const revived = enemy(e.type, e.spawnX, e.spawnY, roomState.dungeonTier);
  Object.assign(e, revived);
  if (e.boss) {
    notice = `${enemyLabel(e)} 재등장 - 성채 ${roomState.dungeonTier}단계`;
    noticeTimer = 3.2;
  }
}

function respawnDelay(e) {
  if (e.type === "balrog") return 150;
  if (e.boss) return 26;
  if (e.type === "ogre") return 12;
  if (e.type === "warlock") return 10;
  return 6;
}

function startPlayerDeath() {
  if (gameState === "dead") return;
  gameState = "dead";
  deathTimer = DEATH_RESPAWN_SECONDS;
  player.hp = 0;
  player.hurt = 1;
  berserk = false;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  jumpLift = 0;
  jumpVelocity = 0;
  projectiles = [];
  damagePops = [];
  deathParticles = [];
  deathBursts = [];
  dialogueText = "";
  dialogueSpeaker = "";
  dialogueTimer = 0;
  notice = "죽었습니다";
  noticeTimer = DEATH_RESPAWN_SECONDS;
}

function respawnPlayer() {
  player.x = 4.5;
  player.y = 4.5;
  player.angle = 0;
  player.hp = player.maxHp;
  player.hurt = 0;
  player.rage = 0;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  jumpLift = 0;
  jumpVelocity = 0;
  projectiles = [];
  damagePops = [];
  deathParticles = [];
  deathBursts = [];
  started = false;
  dialogueText = "";
  dialogueSpeaker = "";
  dialogueTimer = 0;
  berserk = false;
  deathTimer = 0;
  gameState = "play";
  notice = "세이프티 존에서 부활 - 다시 발록 트라이";
  noticeTimer = 3.2;
}

function dropLoot(target) {
  if (target.type === "balrog") {
    scatterBossLoot(target, 16 + Math.floor(Math.random() * 5), true);
    return;
  }
  if (target.boss) {
    scatterBossLoot(target, 10 + Math.floor(Math.random() * 11), false);
    return;
  }

  const roll = Math.random();
  if (target.type === "ogre" || target.type === "warlock") {
    if (roll < 0.035) spawnItem(Math.random() < 0.5 ? "scroll" : "armorScroll", target.x, target.y);
    else if (roll < 0.4) spawnItem("rage", target.x, target.y);
    else if (roll < 0.56) spawnItem("xp", target.x, target.y, Math.max(55, Math.floor((target.xp || 55) * 0.62)));
    else if (roll < 0.82) spawnItem("health", target.x, target.y);
    return;
  }

  if (roll < 0.02) spawnItem(Math.random() < 0.55 ? "scroll" : "armorScroll", target.x, target.y);
  else if (roll < 0.32) spawnItem("rage", target.x, target.y);
  else if (roll < 0.46) spawnItem("xp", target.x, target.y, Math.max(35, Math.floor((target.xp || 35) * 0.55)));
  else if (roll < 0.72) spawnItem("health", target.x, target.y);
}

function scatterBossLoot(target, count, legendary) {
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.24;
    const radius = 0.35 + Math.random() * (legendary ? 1.2 : 0.82);
    const x = target.x + Math.cos(angle) * radius;
    const y = target.y + Math.sin(angle) * radius;
    const roll = Math.random();
    let type = roll < 0.34 ? "scroll" : roll < 0.68 ? "armorScroll" : roll < 0.82 ? "health" : roll < 0.92 ? "xp" : "rage";
    if (legendary && i < 2) type = "legendScroll";
    if (!legendary && i < 2) type = i % 2 ? "bossArmorScroll" : "bossScroll";
    if (!isWall(x, y)) spawnItem(type, x, y, type === "xp" ? Math.max(80, Math.floor((target.xp || 80) * 0.7)) : 0);
  }
}

function enemyLabel(e) {
  const names = {
    skeleton: "스켈레톤",
    skeletonKing: "스켈레톤 킹",
    deathKnight: "데스 나이트",
    ogre: "오우거",
    ogreLord: "오우거 군주",
    warlock: "워록",
    warlockLord: "워록 군주",
    boss: "오크 대장",
    balrog: "발록",
    orc: "오크",
  };
  return `Lv.${e.level || 1} ${names[e.type] || "적"}`;
}

function miniMapEnemyColor(e) {
  if (e.type === "balrog") return "#ff3b1f";
  if (isMidBossType(e.type)) return "#ff9a3d";
  if (e.type === "skeleton" || e.type === "skeletonKing") return "#d8d0ad";
  if (e.type === "ogre" || e.type === "ogreLord") return "#9aaa55";
  if (e.type === "warlock" || e.type === "warlockLord") return "#b75cff";
  if (e.boss) return "#d33";
  return "#45ba58";
}

function itemColor(item) {
  if (item.type === "health") return "#e33b32";
  if (item.type === "rage") return "#e47c25";
  if (item.type === "xp") return "#45a8ff";
  if (item.type === "scroll") return "#f2d58a";
  if (item.type === "armorScroll") return "#76e6ff";
  if (item.type === "legendScroll") return "#ff4a24";
  return "#e3c75b";
}

function balrogEnemy() {
  return enemies.find((e) => e.type === "balrog" && !e.dead);
}

function balrogRespawnSeconds() {
  if (balrogRespawnAt) return Math.max(0, Math.ceil((balrogRespawnAt - Date.now()) / 1000));
  const balrog = enemies.find((e) => e.type === "balrog" && e.dead);
  return balrog ? Math.max(0, Math.ceil(balrog.respawnTimer || 0)) : 0;
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.ceil(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remain = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function directionTo(x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const ew = dx > 1.2 ? "동" : dx < -1.2 ? "서" : "";
  const ns = dy > 1.2 ? "남" : dy < -1.2 ? "북" : "";
  return ns + ew || "근처";
}

function setNameStatus(text) {
  if (nameStatus) nameStatus.textContent = text;
}

function beginNamedRun(name) {
  characterName = name.trim().slice(0, 18);
  if (!characterName) {
    setNameStatus("캐릭터명을 입력해주세요.");
    return;
  }
  try {
    localStorage.setItem(LAST_NAME_KEY, characterName);
  } catch (_) {}
  if (nameScreen) nameScreen.classList.add("is-hidden");
  startGame();
  if (isTestCharacter()) {
    notice = "테스트 계정: 1 무적 토글 / 2 성채 초기화 / 3 전체 캐릭터 초기화";
    noticeTimer = 3.2;
  }
  connectMultiplayer();
}

function isTestCharacter() {
  return characterName.toLowerCase().endsWith("_test");
}

function applyTestBoost() {
  testBoosted = !testBoosted;
  if (multiplayerSocket?.connected) {
    multiplayerSocket.emit("test:boost", { enabled: testBoosted });
    player.rage = testBoosted ? player.maxRage : player.rage;
    notice = testBoosted ? "테스트 무적 모드" : "테스트 노멀 모드";
    noticeTimer = 2.4;
    return;
  }
  if (!testBoosted) {
    resetGame();
    beginNamedRun(characterName);
    notice = "테스트 노멀 모드";
    noticeTimer = 2.4;
    return;
  }
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
  berserk = true;
  notice = "테스트 초고스탯 - Lv.9999 / 검 +9999 / 갑옷 +9999";
  noticeTimer = 3.4;
  saveProgress();
}

function resetTestDungeonTier() {
  if (multiplayerSocket?.connected) {
    multiplayerSocket.emit("test:resetTier");
    return;
  }
  roomState.dungeonTier = 1;
  roomState.balrogDefeatedCount = 0;
  items = [];
  projectiles = [];
  damagePops = [];
  deathParticles = [];
  deathBursts = [];
  enemies = buildEnemies();
  notice = "테스트 성채 초기화 - 1단계";
  noticeTimer = 3.2;
  saveProgress();
}

function resetTestCharacters() {
  if (multiplayerSocket?.connected) {
    multiplayerSocket.emit("test:resetCharacters");
    notice = "전체 캐릭터 저장 데이터 초기화 요청";
    noticeTimer = 3.2;
    return;
  }
  resetGame();
}

function connectMultiplayer() {
  if (!SOCKET_SERVER_URL || typeof io !== "function") {
    setNameStatus("싱글 모드로 시작합니다.");
    return;
  }
  if (multiplayerSocket) multiplayerSocket.disconnect();
  multiplayerSocket = io(SOCKET_SERVER_URL, {
    auth: { name: characterName },
    transports: ["websocket", "polling"],
  });
  multiplayerSocket.on("connect", () => setNameStatus("성채에 접속했습니다."));
  multiplayerSocket.on("room:joined", ({ roomId, players = [], character, resumed, dungeon }) => {
    multiplayerRoomId = roomId;
    remotePlayers.clear();
    for (const remote of players) upsertRemotePlayer(remote);
    if (character) applyServerCharacter(character);
    if (dungeon) applyServerDungeon(dungeon);
    const loaded = resumed ? "저장 캐릭터를 이어서 불러왔습니다." : "새 캐릭터가 서버에 저장됩니다.";
    setNameStatus(loaded);
    notice = resumed ? `${character.displayName} 이어하기` : `${roomId} 입장`;
    noticeTimer = 2.6;
  });
  multiplayerSocket.on("players:update", (players = []) => {
    const seen = new Set();
    for (const remote of players) {
      if (remote.id === multiplayerSocket.id) continue;
      seen.add(remote.id);
      upsertRemotePlayer(remote);
    }
    for (const id of remotePlayers.keys()) {
      if (!seen.has(id)) remotePlayers.delete(id);
    }
  });
  multiplayerSocket.on("player:left", ({ id }) => remotePlayers.delete(id));
  multiplayerSocket.on("player:action", ({ id, action }) => {
    const remote = remotePlayers.get(id);
    if (remote) remote.action = action || "attack";
  });
  multiplayerSocket.on("character:update", (character) => applyServerCharacter(character));
  multiplayerSocket.on("dungeon:update", (dungeon) => applyServerDungeon(dungeon));
  multiplayerSocket.on("dungeon:notice", ({ text }) => {
    notice = text;
    noticeTimer = 3.2;
  });
  multiplayerSocket.on("enemy:hit", ({ id, x, y, damage, boss, attackerId }) => {
    const target = enemies.find((enemy) => enemy.id === id);
    if (target) target.hitFlash = 1;
    spawnDamagePop(x, y, damage, boss);
    if (attackerId === multiplayerSocket.id) hitSpark = 1;
  });
  multiplayerSocket.on("enemy:defeated", ({ enemy }) => {
    const target = enemies.find((entry) => entry.id === enemy.id) || enemy;
    spawnDeathBurst(target);
    dropLoot(target);
  });
  multiplayerSocket.on("player:reward", ({ xp, kills: savedKills }) => {
    if (Number.isFinite(savedKills)) kills = savedKills;
    gainXp(xp || 0);
  });
  multiplayerSocket.on("player:damaged", ({ damage, hp, sourceX, sourceY }) => {
    player.hp = hp;
    addRage(Math.max(7, Math.min(22, Math.ceil((damage || 0) * 0.42))));
    showPlayerHit(sourceX, sourceY);
    if (player.hp <= 0) startPlayerDeath();
  });
  multiplayerSocket.on("connect_error", () => setNameStatus("멀티 서버 연결 대기 중입니다. 싱글 플레이는 계속됩니다."));
  multiplayerSocket.on("disconnect", () => {
    multiplayerRoomId = "";
    remotePlayers.clear();
  });
}

function upsertRemotePlayer(remote) {
  if (!remote || !remote.id) return;
  const previous = remotePlayers.get(remote.id) || {};
  remotePlayers.set(remote.id, {
    ...previous,
    ...remote,
    x: previous.x ?? (Number(remote.x) || 4.5),
    y: previous.y ?? (Number(remote.y) || 4.5),
    targetX: Number(remote.x) || previous.targetX || 4.5,
    targetY: Number(remote.y) || previous.targetY || 4.5,
    angle: Number(remote.angle) || 0,
    action: remote.action || previous.action || "idle",
  });
}

function emitPlayerState(dt) {
  if (!multiplayerSocket || !multiplayerSocket.connected || gameState !== "play") return;
  networkTimer -= dt;
  if (networkTimer > 0) return;
  networkTimer = 0.08;
  multiplayerSocket.emit("player:update", {
    x: player.x,
    y: player.y,
    angle: player.angle,
    hp: player.hp,
    maxHp: player.maxHp,
    rage: player.rage,
    maxRage: player.maxRage,
    level: player.level,
    xp: player.xp,
    nextXp: player.nextXp,
    attackPower: player.attackPower,
    weaponLevel: player.weaponLevel,
    armorLevel: player.armorLevel,
    weaponScrolls: player.weaponScrolls,
    armorScrolls: player.armorScrolls,
    kills,
    berserk,
    hop: jumpLift,
    moving: keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD"),
    action: swing > 0 ? swingType === "special" ? "specialAttack" : "attack" : "idle",
  });
}

function applyServerCharacter(character) {
  player.level = character.level;
  player.xp = character.xp;
  player.nextXp = character.nextXp;
  player.hp = character.hp || character.maxHp;
  player.maxHp = character.maxHp;
  player.rage = character.rage || 0;
  player.maxRage = character.maxRage;
  player.attackPower = character.attackPower;
  player.weaponLevel = character.weaponLevel;
  player.armorLevel = character.armorLevel;
  player.weaponScrolls = character.weaponScrolls || 0;
  player.armorScrolls = character.armorScrolls || 0;
  if (character.level < 9999) testBoosted = false;
  kills = character.kills || 0;
}

function applyServerDungeon(dungeon) {
  serverDungeonLive = true;
  serverPlayerCount = dungeon.playerCount || 1;
  roomState.dungeonTier = dungeon.dungeonTier || 1;
  roomState.balrogDefeatedCount = dungeon.balrogDefeatedCount || 0;
  balrogRespawnAt = dungeon.balrogRespawnAt || 0;
  if (mapPattern !== (dungeon.mapPattern || 0)) {
    mapPattern = dungeon.mapPattern || 0;
    map = buildMap(mapPattern);
  }
  const previous = new Map(enemies.map((enemy) => [enemy.id, enemy]));
  enemies = (dungeon.enemies || []).map((enemy) => ({
    step: Math.random() * Math.PI * 2,
    attackTimer: 0,
    attackWindup: 0,
    stun: 0,
    knockX: 0,
    knockY: 0,
    alert: 0,
    ...previous.get(enemy.id),
    ...enemy,
  }));
}

function buildBaseMap() {
  const grid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill("#"));
  carveArea(grid, 1, 1, 9, 8); // Safe zone.
  carveArea(grid, 9, 4, 8, 3); // Safe zone exit.
  carveArea(grid, 15, 2, 17, 12); // Central hub.
  carveArea(grid, 17, 12, 4, 5);
  carveArea(grid, 3, 15, 18, 11); // Skeleton graveyard.
  carveArea(grid, 5, 25, 12, 5); // Graveyard lower crypt.
  carveArea(grid, 16, 23, 3, 5);
  carveArea(grid, 27, 12, 4, 7);
  carveArea(grid, 23, 17, 19, 11); // Orc barracks.
  carveArea(grid, 30, 6, 12, 3);
  carveArea(grid, 40, 2, 19, 14); // Warlock altar.
  carveArea(grid, 40, 21, 7, 3);
  carveArea(grid, 45, 17, 17, 12); // Ogre den.
  carveArea(grid, 34, 26, 4, 5);
  carveArea(grid, 49, 25, 4, 6);
  carveArea(grid, 28, 29, 23, 6); // Abyss gate.
  carveArea(grid, 49, 31, 6, 3);
  carveArea(grid, 53, 28, 10, 7); // Balrog chamber.

  wallLine(grid, 21, 5, 21, 8);
  wallLine(grid, 26, 6, 26, 10);
  wallLine(grid, 7, 19, 10, 19);
  wallLine(grid, 13, 17, 13, 20);
  wallLine(grid, 14, 23, 18, 23);
  wallLine(grid, 28, 21, 31, 21);
  wallLine(grid, 35, 18, 35, 20);
  wallLine(grid, 36, 25, 39, 25);
  wallLine(grid, 46, 6, 46, 9);
  wallLine(grid, 52, 4, 55, 4);
  wallLine(grid, 53, 11, 57, 11);
  wallLine(grid, 50, 21, 50, 23);
  wallLine(grid, 56, 18, 56, 21);
  wallLine(grid, 58, 25, 60, 25);
  wallLine(grid, 34, 32, 37, 32);
  wallLine(grid, 44, 30, 44, 32);
  wallLine(grid, 56, 30, 56, 32);
  wallLine(grid, 60, 31, 60, 33);
  return grid.map((row) => row.join(""));
}

function carveArea(grid, x, y, w, h) {
  for (let cy = y; cy < y + h; cy += 1) {
    for (let cx = x; cx < x + w; cx += 1) {
      if (cx > 0 && cx < MAP_W - 1 && cy > 0 && cy < MAP_H - 1) grid[cy][cx] = ".";
    }
  }
}

function wallLine(grid, x1, y1, x2, y2) {
  const dx = Math.sign(x2 - x1);
  const dy = Math.sign(y2 - y1);
  let x = x1;
  let y = y1;
  while (true) {
    grid[y][x] = "#";
    if (x === x2 && y === y2) break;
    x += dx;
    y += dy;
  }
}

function buildMap(pattern = 0) {
  const grid = BASE_MAP.map((row) => row.split(""));
  if (pattern === 1) {
    carveArea(grid, 36, 9, 8, 3);
    carveArea(grid, 47, 10, 12, 5);
    carveArea(grid, 41, 15, 6, 4);
    wallLine(grid, 55, 8, 55, 11);
    wallLine(grid, 48, 13, 51, 13);
    wallLine(grid, 40, 12, 44, 12);
  }
  if (pattern === 2) {
    carveArea(grid, 22, 28, 11, 6);
    carveArea(grid, 20, 30, 5, 3);
    carveArea(grid, 17, 27, 8, 4);
    wallLine(grid, 27, 30, 27, 33);
    wallLine(grid, 31, 32, 34, 32);
    wallLine(grid, 22, 27, 22, 29);
  }
  if (pattern === 3) {
    carveArea(grid, 50, 15, 13, 10);
    carveArea(grid, 40, 18, 12, 3);
    carveArea(grid, 52, 24, 8, 4);
    wallLine(grid, 47, 21, 50, 21);
    wallLine(grid, 55, 18, 55, 22);
    wallLine(grid, 60, 24, 60, 27);
  }
  return grid.map((row) => row.join(""));
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

function isTown(x = player.x, y = player.y) {
  return x < 9.8 && y < 8.8;
}

function zoneAt(x = player.x, y = player.y) {
  if (isTown(x, y)) return { name: "세이프티 존", short: "SAFE ZONE", sky: ["#49364f", "#805651"], floor: ["#857151", "#312318"], wall: [0.69, 0.62, 0.5] };
  if (x < 23 && y >= 14) return { name: "해골 묘역", short: "묘역", sky: ["#252633", "#4c4248"], floor: ["#5a5547", "#201b18"], wall: [0.56, 0.54, 0.48] };
  if (x >= 22 && x < 43 && y >= 16 && y < 29) return { name: "오크 병영", short: "병영", sky: ["#34262d", "#68423b"], floor: ["#66513b", "#241811"], wall: [0.64, 0.54, 0.42] };
  if (x >= 39 && y < 17) return { name: "워록 제단", short: "제단", sky: ["#241a38", "#56385f"], floor: ["#46384d", "#1b1320"], wall: [0.5, 0.43, 0.62] };
  if (x >= 44 && y >= 16 && y < 30) return { name: "오우거 굴", short: "굴", sky: ["#332923", "#5c4532"], floor: ["#65543f", "#251a12"], wall: [0.58, 0.5, 0.4] };
  if (x >= 53 && y >= 28) return { name: "발록의 방", short: "발록방", sky: ["#310c10", "#6d251d"], floor: ["#5e291d", "#190807"], wall: [0.62, 0.34, 0.28] };
  if (y >= 28) return { name: "심연의 문", short: "심연", sky: ["#17151f", "#33273c"], floor: ["#3a3340", "#120f16"], wall: [0.42, 0.4, 0.52] };
  return { name: "중앙 허브", short: "허브", sky: ["#2d2336", "#57373d"], floor: ["#5b4b3a", "#211711"], wall: [0.58, 0.54, 0.46] };
}

function nearestTownNpc(range = 1.35) {
  let best = null;
  for (const npc of TOWN_NPCS) {
    const dist = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (dist <= range && (!best || dist < best.dist)) best = { npc, dist };
  }
  return best;
}

function interact() {
  const nearby = nearestTownNpc();
  if (!nearby) {
    notice = isTown() ? "대화할 사람이 가까이 없습니다" : "관리인은 세이프티 존에 있습니다";
    noticeTimer = 1.6;
    return;
  }
  dialogueSpeaker = nearby.npc.name;
  dialogueText = nearby.npc.line;
  dialogueTimer = 4.2;
  player.hp = player.maxHp;
  player.hurt = 0;
  notice = "HP가 모두 회복되었습니다";
  noticeTimer = 2;
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
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      const edgeX = Math.min(fx, 1 - fx);
      const edgeY = Math.min(fy, 1 - fy);
      const side = edgeX < edgeY ? "x" : "y";
      const wallU = side === "x" ? fy : fx;
      return { dist, x, y, shadeSeed, side, wallU };
    }
    dist += step;
  }
  return { dist: MAX_DEPTH, x: player.x + cos * MAX_DEPTH, y: player.y + sin * MAX_DEPTH, shadeSeed: 0, side: "x", wallU: 0 };
}

function update(dt) {
  if (gameState === "dead") {
    messagePulse += dt;
    deathTimer = Math.max(0, deathTimer - dt);
    noticeTimer = Math.max(0, noticeTimer - dt);
    player.hurt = Math.max(0.5, player.hurt - dt * 0.25);
    if (deathTimer <= 0) respawnPlayer();
    return;
  }

  if (gameState !== "play") {
    messagePulse += dt;
    return;
  }

  if (berserk) {
    player.rage = Math.max(0, player.rage - BERSERK_DRAIN_PER_SECOND * dt);
    if (player.rage <= 0) {
      berserk = false;
      notice = "광폭화 종료";
      noticeTimer = 1.4;
    }
  }

  const moveStep = MOVE_SPEED * levelSpeedMultiplier() * (berserk ? 1.5 : 1) * dt;
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
  updateJump(dt);
  swing = Math.max(0, swing - dt * (swingType === "special" ? 3.55 : 2.85));
  if (swing === 0) swingType = "normal";
  swingCooldown = Math.max(0, swingCooldown - dt);
  player.hurt = Math.max(0, player.hurt - dt * 3);
  hurtDirectionTimer = Math.max(0, hurtDirectionTimer - dt);
  hitSpark = Math.max(0, hitSpark - dt * 5);
  screenShake = Math.max(0, screenShake - dt * 5);
  noticeTimer = Math.max(0, noticeTimer - dt);
  dialogueTimer = Math.max(0, dialogueTimer - dt);
  for (const item of items) {
    item.bob += dt * 4;
  }
  for (let i = items.length - 1; i >= 0; i -= 1) {
    if (items[i].expiresAt && performance.now() >= items[i].expiresAt) items.splice(i, 1);
  }
  for (const remote of remotePlayers.values()) {
    remote.x += ((remote.targetX ?? remote.x) - remote.x) * Math.min(1, dt * 12);
    remote.y += ((remote.targetY ?? remote.y) - remote.y) * Math.min(1, dt * 12);
  }
  if (serverDungeonLive) {
    for (const e of enemies) {
      if (e.dead) continue;
      const cadence = e.moving ? (e.boss ? 4.8 : 6.4) : 1.35;
      e.step = (e.step || 0) + dt * cadence;
    }
  }
  for (let i = damagePops.length - 1; i >= 0; i -= 1) {
    damagePops[i].life -= dt;
    damagePops[i].rise += dt * 0.28;
    if (damagePops[i].life <= 0) damagePops.splice(i, 1);
  }
  for (let i = deathParticles.length - 1; i >= 0; i -= 1) {
    const p = deathParticles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vx *= Math.pow(0.18, dt);
    p.vy *= Math.pow(0.18, dt);
    p.vz -= 4.8 * dt;
    p.life -= dt;
    if (p.life <= 0 || isWall(p.x, p.y)) deathParticles.splice(i, 1);
  }
  for (let i = deathBursts.length - 1; i >= 0; i -= 1) {
    deathBursts[i].life -= dt;
    if (deathBursts[i].life <= 0) deathBursts.splice(i, 1);
  }
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (isWall(p.x, p.y) || p.life <= 0) {
      projectiles.splice(i, 1);
      continue;
    }
    if (Math.hypot(player.x - p.x, player.y - p.y) < (p.radius || 0.34)) {
      damagePlayer(p.damage, p.x, p.y);
      addRage(6);
      screenShake = Math.max(screenShake, p.type === "fire" ? 1.2 : 0.6);
      projectiles.splice(i, 1);
      if (player.hp <= 0) startPlayerDeath();
    }
  }

  if (!serverDungeonLive) for (const e of enemies) {
    if (e.dead) {
      e.respawnTimer = Math.max(0, e.respawnTimer - dt);
      if (e.respawnTimer === 0 && (e.boss || Math.hypot(player.x - e.spawnX, player.y - e.spawnY) > 6)) {
        reviveEnemy(e);
      }
      continue;
    }
    e.moving = false;
    e.hitFlash = Math.max(0, e.hitFlash - dt * 6);
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    e.attackPose = Math.max(0, e.attackPose - dt * 5);
    e.stun = Math.max(0, e.stun - dt);
    e.alert = Math.max(0, (e.alert || 0) - dt);
    if (Math.abs(e.knockX) > 0.01 || Math.abs(e.knockY) > 0.01) {
      moveActor(e, e.knockX * dt, e.knockY * dt, e.radius);
      e.knockX *= Math.pow(0.04, dt);
      e.knockY *= Math.pow(0.04, dt);
    }
    if (!started || isTown()) continue;
    if (e.stun > 0) continue;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const attackRange = meleeReach(e);
    const visible = hasLineOfSight(e);
    const aware = e.alert > 0 || (dist <= aggroRange(e) && visible);
    if (!aware) continue;
    if (visible) e.alert = Math.max(e.alert, e.boss ? 4 : 2.4);
    if (e.attackWindup > 0) {
      e.attackWindup = Math.max(0, e.attackWindup - dt);
      e.step += dt * (e.boss ? 3.2 : 4.4);
      e.attackPose = Math.max(e.attackPose, 0.45);
      if (e.attackWindup === 0) {
        if (e.type === "balrog") {
          if (dist <= attackRange + 0.6) {
            balrogSlam(e, dist);
          } else if (dist <= 7.2 && visible) {
            spawnProjectile(e, dx / dist, dy / dist);
            e.attackPose = 1;
          }
        } else if (e.projectile && dist <= attackRange + 0.6 && visible) {
          spawnProjectile(e, dx / dist, dy / dist);
          e.attackPose = 1;
        } else if (!e.projectile && dist <= attackRange + 0.18 && visible) {
          damagePlayer(e.damage, e.x, e.y);
          addRage(e.boss ? 12 : 7);
          e.attackPose = 1;
          screenShake = Math.max(screenShake, e.boss ? 1 : 0.55);
          if (player.hp <= 0) startPlayerDeath();
        }
        e.attackTimer = e.cooldown;
      }
      continue;
    }
    if (e.type === "balrog" && dist < 7.1 && dist > attackRange + 0.4 && visible && e.attackTimer <= 0) {
      e.attackWindup = e.windup * 1.1;
      e.attackPose = 0.85;
    } else if (e.projectile && dist < 2.4) {
      const speed = e.speed * dt;
      moveActor(e, -(dx / dist) * speed, -(dy / dist) * speed, e.radius);
      e.step += dt * 4.2;
      e.moving = true;
    } else if (dist > attackRange || !visible) {
      const speed = e.speed * dt;
      moveActor(e, (dx / dist) * speed, (dy / dist) * speed, e.radius);
      e.step += dt * (e.boss ? 5.3 : 6.2);
      e.moving = true;
    } else if (e.attackTimer <= 0 && visible) {
      e.attackWindup = e.windup;
      e.attackPose = 0.65;
    }
  }

  collectItems();
  emitPlayerState(dt);
}

function startJump() {
  if (gameState !== "play" || jumpLift > 0.01) return;
  jumpVelocity = 3.65;
}

function updateJump(dt) {
  if (jumpLift <= 0 && jumpVelocity <= 0) return;
  jumpLift = Math.max(0, jumpLift + jumpVelocity * dt);
  jumpVelocity -= 10.8 * dt;
  if (jumpLift === 0 && jumpVelocity < 0) jumpVelocity = 0;
}

function meleeReach(e) {
  if (e.projectile) return e.attackRange;
  return e.attackRange + (e.radius || 0) * 0.65 + 0.18;
}

function aggroRange(e) {
  if (e.type === "balrog") return 23;
  if (e.projectile) return e.boss ? 17.6 : 14.8;
  if (e.boss) return 14.4;
  if (e.type === "ogre") return 12.8;
  return 11.6;
}

function balrogSlam(e, dist) {
  const falloff = Math.max(0.62, 1 - Math.max(0, dist - 0.9) * 0.18);
  const damage = Math.ceil(e.damage * 1.25 * falloff);
  damagePlayer(damage, e.x, e.y);
  addRage(18);
  e.attackPose = 1;
  screenShake = Math.max(screenShake, 2.2);
  hitSpark = Math.max(hitSpark, 0.8);
  notice = "발록의 화염 강타";
  noticeTimer = 1.2;
  if (player.hp <= 0) startPlayerDeath();
}

function damagePlayer(rawDamage, sourceX, sourceY) {
  const mitigation = Math.min(0.82, player.armorLevel / (player.armorLevel + 90));
  const damage = Math.max(1, Math.ceil(rawDamage * (1 - mitigation)));
  player.hp = Math.max(0, player.hp - damage);
  showPlayerHit(sourceX, sourceY);
}

function showPlayerHit(sourceX, sourceY) {
  player.hurt = 1;
  hurtDirection = normAngle(Math.atan2(sourceY - player.y, sourceX - player.x) - player.angle);
  hurtDirectionTimer = 0.62;
}

function attack(kind = "normal") {
  if (gameState !== "play" || swingCooldown > 0) return;
  if (kind === "special" && !berserk && player.rage < SPECIAL_RAGE_COST) {
    notice = `분노 부족 (${SPECIAL_RAGE_COST} 필요)`;
    noticeTimer = 1;
    return;
  }
  started = true;
  swing = 1;
  swingType = kind;
  if (multiplayerSocket && multiplayerSocket.connected) {
    multiplayerSocket.emit("player:action", { action: kind === "special" ? "specialAttack" : "attack" });
  }
  const baseCooldown = kind === "special" ? 0.64 : 0.58;
  const levelCooldown = Math.max(0.88, 1 - (player.level - 1) * 0.008);
  swingCooldown = (berserk ? baseCooldown * 0.42 : baseCooldown) * levelCooldown;
  if (kind === "special" && !berserk) player.rage = Math.max(0, player.rage - SPECIAL_RAGE_COST);

  const hitRange = kind === "special" ? 3.05 : 2.15;
  const hitAngle = kind === "special" ? 0.62 : 0.38;
  const baseDamage = player.attackPower + player.weaponLevel + levelAttackBonus();
  const rageDamage = berserk ? 1.5 : 1;
  const damage = Math.ceil((kind === "special" ? baseDamage * 2 + 2 : baseDamage) * rageDamage);
  if (serverDungeonLive && multiplayerSocket?.connected) {
    multiplayerSocket.emit("dungeon:attack", { kind });
    return;
  }
  const hits = getAttackHits(hitRange, hitAngle);
  const targets = kind === "special" ? hits.map((hit) => hit.e) : hits.slice(0, 1).map((hit) => hit.e);

  if (targets.length) {
    for (const target of targets) {
      damageEnemy(target, damage, kind);
    }
    if (targets.some((target) => !target.dead)) hitSpark = 1;
    screenShake = kind === "special" ? 1.6 : 1;
  }
}

function getAttackHits(hitRange, hitAngle) {
  const hits = [];
  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const delta = Math.abs(normAngle(angle - player.angle));
    const bodyReach = hitRange + (e.radius || 0) * 0.78;
    if (dist < bodyReach && delta < hitAngle && hasLineOfSight(e)) {
      hits.push({ e, dist: Math.max(0, dist - (e.radius || 0)) });
    }
  }
  hits.sort((a, b) => a.dist - b.dist);
  return hits;
}

function damageEnemy(target, damage, kind) {
  target.hp -= damage;
  target.hitFlash = 1;
  target.alert = target.boss ? 12 : 7;
  alertNearbyEnemies(target, target.type === "balrog" ? 10 : target.boss ? 6.8 : 4.2);
  const pushAngle = Math.atan2(target.y - player.y, target.x - player.x);
  const stunned = Math.random() < stunChance(target, kind);
  const pushPower = target.boss ? (kind === "special" ? 1.65 : 0.95) : (kind === "special" ? 3.25 : 1.9);
  target.knockX = Math.cos(pushAngle) * pushPower;
  target.knockY = Math.sin(pushAngle) * pushPower;
  if (stunned) {
    target.attackWindup = 0;
    target.stun = target.boss ? (kind === "special" ? 0.36 : 0.18) : (kind === "special" ? 0.58 : 0.34);
  }
  spawnDamagePop(target.x, target.y, damage, target.boss);
  if (kind !== "special") addRage(target.boss ? 16 : 22);
  if (target.hp <= 0) {
    spawnDeathBurst(target);
    target.dead = true;
    target.respawnTimer = respawnDelay(target);
    target.attackWindup = 0;
    target.knockX = 0;
    target.knockY = 0;
    kills += 1;
    gainXp(target.xp);
    if (kind !== "special") addRage(target.boss ? 30 : 16);
    dropLoot(target);
    if (target.type === "balrog") onBalrogDefeated();
    saveProgress();
    notice = target.type === "balrog"
      ? `발록 처치 - 성채 ${roomState.dungeonTier}단계 시작`
      : `${enemyLabel(target)} 처치`;
    noticeTimer = 3.4;
  }
}

function onBalrogDefeated() {
  roomState.balrogDefeatedCount += 1;
  roomState.dungeonTier += 1;
}

function alertNearbyEnemies(source, radius) {
  for (const e of enemies) {
    if (e.dead || e === source) continue;
    const dist = Math.hypot(e.x - source.x, e.y - source.y);
    if (dist <= radius && (hasLineOfSight(e) || dist < radius * 0.55)) {
      e.alert = Math.max(e.alert || 0, e.boss ? 7 : 4.6);
    }
  }
}

function stunChance(target, kind) {
  const levelGap = player.level - (target.level || 1);
  const base = kind === "special" ? 0.36 : 0.17;
  const bossPenalty = target.type === "balrog" ? 0.24 : target.boss ? 0.12 : 0;
  const min = target.type === "balrog" ? 0.025 : target.boss ? 0.045 : 0.08;
  return Math.max(min, Math.min(0.82, base + levelGap * 0.035 - bossPenalty));
}

function collectItems() {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    const dist = Math.hypot(item.x - player.x, item.y - player.y);
    if (dist > 0.58) continue;
    if (item.type === "health") {
      const healAmount = Math.max(30, Math.floor(player.maxHp * 0.4));
      player.hp = Math.min(player.maxHp, player.hp + healAmount);
      notice = `체력 ${healAmount} 회복`;
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "rage") {
      addRage(45);
      notice = "분노 충전";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "xp") {
      gainXp(item.value || 35 + player.level * 6);
      notice = "경험치 획득";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "scroll" || item.type === "bossScroll") {
      applyUpgradeScroll("weapon", item.type === "bossScroll" ? 1 : 0);
      noticeTimer = 2.2;
      saveProgress();
      items.splice(i, 1);
    } else if (item.type === "armorScroll" || item.type === "bossArmorScroll") {
      applyUpgradeScroll("armor", item.type === "bossArmorScroll" ? 1 : 0);
      noticeTimer = 2.2;
      saveProgress();
      items.splice(i, 1);
    } else if (item.type === "legendScroll") {
      player.weaponLevel += 3;
      player.armorLevel += 2;
      player.maxRage = Math.min(220, player.maxRage + 25);
      addRage(player.maxRage);
      notice = `발록의 전리품 - 검 +${player.weaponLevel}`;
      noticeTimer = 3.2;
      saveProgress();
      items.splice(i, 1);
    }
  }
}

function upgradeScrollCost(level) {
  if (level < 10) return 1;
  if (level < 20) return 3;
  if (level < 40) return 6;
  if (level < 80) return 12;
  if (level < 120) return 24;
  if (level < 200) return 48;
  return 80;
}

function applyUpgradeScroll(kind, guaranteedLevels = 0) {
  const levelKey = kind === "armor" ? "armorLevel" : "weaponLevel";
  const scrollKey = kind === "armor" ? "armorScrolls" : "weaponScrolls";
  const label = kind === "armor" ? "갑옷" : "검";
  if (guaranteedLevels > 0) {
    player[levelKey] += guaranteedLevels;
    notice = `${label} 강화 +${guaranteedLevels} - ${label} +${player[levelKey]}`;
    return;
  }
  player[scrollKey] += 1;
  let cost = upgradeScrollCost(player[levelKey]);
  if (player[scrollKey] >= cost) {
    player[scrollKey] -= cost;
    player[levelKey] += 1;
    cost = upgradeScrollCost(player[levelKey]);
    notice = `강화 성공 - ${label} +${player[levelKey]}`;
    return;
  }
  notice = `${label} 주문서 ${player[scrollKey]}/${cost}`;
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
  ctx.save();
  if (jumpLift > 0) ctx.translate(0, jumpLift * 54);
  drawWorld();
  drawTownSprites();
  drawSprites();
  drawRemotePlayers();
  drawProjectiles();
  drawDeathBursts();
  drawDeathParticles();
  drawDamagePops();
  drawItems();
  drawVignette();
  drawWeapon();
  ctx.restore();
  drawHud();
  if (gameState !== "play") drawEndScreen();
  ctx.restore();
}

function drawWorld() {
  const zone = zoneAt();
  const townView = isTown();
  const sky = ctx.createLinearGradient(0, -72, 0, HALF_H);
  sky.addColorStop(0, zone.sky[0]);
  sky.addColorStop(1, zone.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, -72, W, HALF_H + 72);
  drawCeilingDetails(townView);

  const floor = ctx.createLinearGradient(0, HALF_H, 0, H + 96);
  floor.addColorStop(0, zone.floor[0]);
  floor.addColorStop(1, zone.floor[1]);
  ctx.fillStyle = floor;
  ctx.fillRect(0, HALF_H, W, HALF_H + 96);
  drawFloorDetails(townView);

  for (let r = 0; r < RAYS; r += 1) {
    const rayAngle = player.angle - FOV / 2 + (r / RAYS) * FOV;
    const hit = castRay(rayAngle);
    const fixedDist = hit.dist * Math.cos(rayAngle - player.angle);
    depths[r] = fixedDist;
    const wallH = Math.min(H * 1.8, H / Math.max(0.001, fixedDist));
    const x = (r / RAYS) * W;
    const colW = W / RAYS + 1;
    const y = HALF_H - wallH / 2;
    const light = Math.max(78, 238 - fixedDist * 11);
    const mortar = 1;
    const hitZone = zoneAt(hit.x, hit.y);
    const hitTown = isTown(hit.x, hit.y);
    const faceShade = hit.side === "x" ? 1 : 0.84;
    const [wallR, wallG, wallB] = hitZone.wall;
    ctx.fillStyle = `rgb(${Math.floor(light * wallR * mortar)}, ${Math.floor(light * wallG * mortar)}, ${Math.floor(light * wallB * mortar)})`;
    ctx.fillRect(x, y, colW, wallH);

    ctx.fillStyle = `rgba(0, 0, 0, ${1 - faceShade})`;
    ctx.fillRect(x, y, colW, wallH);

    const blockH = Math.max(48, wallH / 3.8);
    const row = Math.floor((hit.y + hit.x) * 2.1);
    const offsetU = row % 2 ? 0.14 : 0;
    const joint = Math.max(2, wallH / 72);
    const edgeAlpha = Math.min(0.62, 0.34 + fixedDist / 42);
    ctx.fillStyle = `rgba(24, 13, 8, ${edgeAlpha})`;
    ctx.fillRect(x, y, colW, Math.max(2, wallH / 34));
    ctx.fillRect(x, y + wallH - Math.max(2, wallH / 42), colW, Math.max(2, wallH / 42));
    for (let by = y + blockH * 0.28; by < y + wallH; by += blockH) {
      ctx.fillStyle = `rgba(24, 13, 9, ${edgeAlpha * 0.72})`;
      ctx.fillRect(x, by - joint, colW, joint * 2);
      ctx.fillStyle = hitTown ? "rgba(255, 230, 178, 0.18)" : "rgba(255, 232, 178, 0.14)";
      ctx.fillRect(x, by, colW, joint);
    }
    const u = (hit.wallU + offsetU) % 1;
    if (u < 0.035 || u > 0.965 || Math.abs(u - 0.5) < 0.018) {
      ctx.fillStyle = `rgba(20, 10, 6, ${edgeAlpha})`;
      ctx.fillRect(x, y + wallH * 0.04, colW, wallH * 0.9);
    }
    if (u > 0.08 && u < 0.2) {
      ctx.fillStyle = "rgba(255, 238, 188, 0.1)";
      ctx.fillRect(x, y + wallH * 0.08, colW, wallH * 0.78);
    }
    if ((r + Math.floor(hit.x * 13 + hit.y * 17)) % 31 === 0) {
      const nickY = y + (0.22 + ((Math.floor(hit.x * 7 + hit.y * 9) % 5) * 0.12)) * wallH;
      ctx.fillStyle = "rgba(255, 243, 197, 0.16)";
      ctx.fillRect(x, nickY, colW, Math.max(2, wallH / 72));
    }
    if (wallH > 90 && u > 0.18 && u < 0.82 && (r + Math.floor(hit.x * 3 + hit.y * 5)) % 9 === 0) {
      ctx.fillStyle = "rgba(255, 246, 211, 0.065)";
      ctx.fillRect(x, y + wallH * 0.12, colW, wallH * 0.18);
    }
    if (wallH > 64 && (u < 0.035 || u > 0.965)) {
      ctx.fillStyle = "rgba(21, 12, 9, 0.3)";
      ctx.fillRect(x, y + wallH * 0.06, colW, wallH * 0.88);
    }

    ctx.fillStyle = "rgba(18, 10, 7, 0.32)";
    ctx.fillRect(x, y, colW, Math.max(2, wallH / 34));
    ctx.fillStyle = "rgba(255, 238, 188, 0.12)";
    ctx.fillRect(x, y + wallH * 0.06, colW, Math.max(1, wallH / 40));
    ctx.fillStyle = "rgba(255, 241, 199, 0.045)";
    ctx.fillRect(x, y + wallH * 0.1, colW, wallH * 0.38);

    ctx.fillStyle = `rgba(18, 16, 14, ${Math.min(townView ? 0.16 : 0.27, fixedDist / 22)})`;
    ctx.fillRect(x, y, colW, wallH);
  }

  ctx.fillStyle = "rgba(255, 196, 94, 0.08)";
  for (let i = 0; i < 9; i += 1) {
    const tx = ((i * 137 + 53) % W);
    const ty = HALF_H + ((i * 71 + 41) % (H - HALF_H));
    ctx.fillRect(tx, ty, 2, 2);
  }
}

function drawCeilingDetails(townView) {
  ctx.save();
  ctx.globalAlpha = townView ? 0.16 : 0.18;
  ctx.fillStyle = townView ? "rgba(255, 230, 171, 0.08)" : "rgba(255, 211, 142, 0.055)";
  ctx.fillRect(0, 0, W, HALF_H);
  ctx.globalAlpha = townView ? 0.12 : 0.1;
  ctx.fillStyle = "rgba(255, 243, 203, 0.18)";
  for (let i = 0; i < 24; i += 1) {
    const x = (i * 211 + 37) % W;
    const y = (i * 83 + 19) % Math.max(1, HALF_H - 20);
    ctx.fillRect(x, y, 2, 1);
  }
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "rgba(10, 7, 8, 0.2)";
  ctx.fillRect(0, 0, W, Math.max(10, H * 0.028));
  ctx.restore();
}

function drawFloorDetails(townView) {
  ctx.save();
  const lineColor = townView ? "rgba(255, 225, 159, 0.18)" : "rgba(238, 192, 126, 0.13)";
  const darkLine = townView ? "rgba(55, 31, 18, 0.28)" : "rgba(19, 10, 6, 0.35)";
  for (let i = 0; i < 18; i += 1) {
    const t = i / 18;
    const y = HALF_H + Math.pow(t, 1.75) * HALF_H;
    ctx.globalAlpha = 0.04 + t * 0.12;
    ctx.fillStyle = i % 2 ? lineColor : darkLine;
    ctx.fillRect(0, y, W, Math.max(1, 1 + t * 2));
  }
  ctx.globalAlpha = townView ? 0.16 : 0.12;
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1;
  for (let i = -9; i <= 9; i += 1) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 82, H);
    ctx.lineTo(W / 2 + i * 8, HALF_H + 12);
    ctx.stroke();
  }
  ctx.globalAlpha = townView ? 0.12 : 0.08;
  ctx.strokeStyle = townView ? "rgba(153, 234, 255, 0.24)" : "rgba(255, 219, 151, 0.16)";
  for (let i = 0; i < 6; i += 1) {
    const y = HALF_H + 44 + i * i * 12;
    ctx.beginPath();
    ctx.moveTo(W * 0.12, y);
    ctx.quadraticCurveTo(W * 0.5, y + 10 + i * 2, W * 0.88, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawVignette() {
  const gradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.22, W / 2, H / 2, Math.max(W, H) * 0.68);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.72, "rgba(0, 0, 0, 0.1)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.26)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
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

  const projected = [];
  for (const s of visible) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const size = Math.min(H * 1.45, (H / s.dist) * spriteScale(s.e));
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.2) continue;
    const groundY = HALF_H + H / Math.max(1, s.dist) * 0.27;
    const y = groundY - size * 0.95;
    projected.push({ ...s, screenX, size, y, renderX: screenX, renderY: y });
  }

  spreadProjectedEnemies(projected);
  for (const s of projected) {
    drawEnemy(s.e, s.renderX - s.size / 2, s.renderY, s.size, s.dist);
    if (gameState === "play") {
      drawNameplate(
        s.renderX,
        s.nameplateY,
        s.nameplateWidth,
        enemyLabel(s.e),
        s.e.hp / s.e.maxHp,
        s.e.boss ? "#d33a32" : "#d8bd76",
      );
    }
  }
}

function spreadProjectedEnemies(projected) {
  const occupiedSprites = [];
  const occupiedLabels = [];
  const offsets = [
    [0, 0],
    [-0.68, -0.26],
    [0.72, -0.44],
    [-0.44, 0.34],
    [0.5, 0.28],
    [-0.92, -0.66],
    [0.96, -0.72],
  ];

  for (const sprite of projected) {
    const overlaps = occupiedSprites.filter((other) => projectedSpriteOverlap(sprite, other)).length;
    const spread = Math.max(5, Math.min(24, sprite.size * 0.075));
    const offset = offsets[Math.min(overlaps, offsets.length - 1)];
    const bossSpread = sprite.e.boss ? 0.52 : 1;
    sprite.renderX = sprite.screenX + offset[0] * spread * bossSpread;
    sprite.renderY = sprite.y + offset[1] * spread * bossSpread * 0.18;
    sprite.nameplateWidth = Math.max(58, Math.min(118, sprite.size * 0.5));
    sprite.nameplateY = sprite.renderY - Math.max(22, sprite.size * 0.08);
    while (nameplateOverlap(sprite, occupiedLabels)) sprite.nameplateY -= 24;
    occupiedSprites.push(sprite);
    occupiedLabels.push(sprite);
  }
}

function projectedSpriteOverlap(a, b) {
  const width = Math.min(a.size, b.size) * 0.44;
  const height = Math.min(a.size, b.size) * 0.48;
  return Math.abs(a.screenX - b.renderX) < width && Math.abs(a.y - b.renderY) < height;
}

function nameplateOverlap(sprite, labels) {
  return labels.some((other) =>
    Math.abs(sprite.renderX - other.renderX) < (sprite.nameplateWidth + other.nameplateWidth) * 0.52
    && Math.abs(sprite.nameplateY - other.nameplateY) < 23);
}

function drawRemotePlayers() {
  const visible = [...remotePlayers.values()]
    .map((remote) => {
      const dx = remote.x - player.x;
      const dy = remote.y - player.y;
      return { remote, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((entry) => entry.dist > 0.22 && Math.abs(entry.angle) < FOV * 0.72 && hasLineOfSight(entry.remote))
    .sort((a, b) => b.dist - a.dist);

  for (const entry of visible) {
    const screenX = W / 2 + Math.tan(entry.angle) * (W / FOV);
    const size = Math.min(H * 0.82, (H / entry.dist) * 0.72);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < entry.dist - 0.2) continue;
    const hopLift = Math.min(size * 0.34, Math.max(0, entry.remote.hop || 0) * 118);
    const groundY = HALF_H + H / Math.max(1, entry.dist) * 0.27;
    const y = groundY - size * 0.94 - hopLift;
    drawFloorContact(screenX, y + size * 0.94, size, "#71d4ff", 0.3);
    drawRemoteWarrior(entry.remote, screenX - size / 2, y, size, remoteBackView(entry.remote));
    drawNameplate(
      screenX,
      y - Math.max(22, size * 0.08),
      Math.max(78, Math.min(152, size * 0.64)),
      `Lv.${entry.remote.level || 1} ${entry.remote.displayName || entry.remote.name || "전사"}`,
      (entry.remote.hp || 0) / Math.max(1, entry.remote.maxHp || 1),
      "#64d6ff",
    );
  }
}

function remoteBackView(remote) {
  const bearing = Math.atan2(remote.y - player.y, remote.x - player.x);
  return Math.abs(normAngle((remote.angle || 0) - bearing)) < Math.PI * 0.48;
}

function drawRemoteWarrior(remote, x, y, size, backView = false) {
  const px = Math.max(2, Math.floor(size / 18));
  const moving = Boolean(remote.moving);
  const attack = remote.action === "attack" || remote.action === "specialAttack";
  const bob = moving ? Math.abs(Math.sin(performance.now() * 0.012 + remote.x * 2)) * px : 0;
  const palette = swordPalette(remote.weaponLevel || 0);
  const armor = armorPalette(remote.armorLevel || 0);
  y += bob - (attack ? 2 * px : 0);
  if (backView) {
    drawRemoteWarriorBack(remote, x, y, px, palette, armor, attack, moving);
    return;
  }
  rect(x + 3 * px, y + 2 * px, 12 * px, 22 * px, "#140d0b");
  rect(x + 5 * px, y + 1 * px, 8 * px, 8 * px, "#d4ab73");
  rect(x + 4 * px, y + 0 * px, 10 * px, 3 * px, "#60432d");
  rect(x + 6 * px, y + 1 * px, 6 * px, 1 * px, "#e0ad63");
  rect(x + 4 * px, y + 4 * px, 1 * px, 3 * px, "#f5c48f");
  rect(x + 13 * px, y + 4 * px, 1 * px, 3 * px, "#f5c48f");
  rect(x + 6 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e");
  rect(x + 10 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e");
  rect(x + 7 * px, y + 7 * px, 4 * px, 1 * px, "#7e4021");
  rect(x + 3 * px, y + 9 * px, 12 * px, 11 * px, remote.berserk ? "#7f241e" : armor.body);
  rect(x + 4 * px, y + 10 * px, 10 * px, 2 * px, armor.light);
  rect(x + 6 * px, y + 13 * px, 6 * px, 1 * px, armor.glint);
  rect(x + 8 * px, y + 12 * px, 2 * px, 7 * px, "#1d2833");
  rect(x + 1 * px, y + 10 * px, 4 * px, 8 * px, armor.edge);
  rect(x + 13 * px, y + 10 * px, 4 * px, 8 * px, armor.edge);
  rect(x + 2 * px, y + 11 * px, 2 * px, 6 * px, armor.glint);
  rect(x + 14 * px, y + 11 * px, 2 * px, 6 * px, armor.glint);
  rect(x + 5 * px, y + 19 * px, 4 * px, 5 * px, "#211b18");
  rect(x + 10 * px, y + 19 * px, 4 * px, 5 * px, "#211b18");
  rect(x + 5 * px, y + 23 * px, 4 * px, 1 * px, "#0e0a09");
  rect(x + 10 * px, y + 23 * px, 4 * px, 1 * px, "#0e0a09");
  drawRemoteSword(x, y, px, palette, attack);
  if (remote.berserk) {
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "#ff542a";
    ctx.beginPath();
    ctx.ellipse(x + 9.5 * px, y + 13 * px, 10 * px, 14 * px, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawRemoteWarriorBack(remote, x, y, px, palette, armor, attack, moving) {
  const step = moving ? Math.sin(performance.now() * 0.012 + remote.y * 2.4) : 0;
  rect(x + 3 * px, y + 2 * px, 12 * px, 22 * px, "#140d0b");
  rect(x + 5 * px, y + 1 * px, 8 * px, 8 * px, "#5b412e");
  rect(x + 4 * px, y + 1 * px, 10 * px, 3 * px, "#704f36");
  rect(x + 6 * px, y + 4 * px, 6 * px, 4 * px, "#3c2b21");
  rect(x + 3 * px, y + 9 * px, 12 * px, 11 * px, remote.berserk ? "#7f241e" : armor.body);
  rect(x + 4 * px, y + 10 * px, 10 * px, 2 * px, armor.light);
  rect(x + 6 * px, y + 12 * px, 6 * px, 7 * px, "#253341");
  rect(x + 1 * px, y + 10 * px, 4 * px, 8 * px, armor.edge);
  rect(x + 13 * px, y + 10 * px, 4 * px, 8 * px, armor.edge);
  rect(x + 5 * px, y + 19 * px, 4 * px, 5 * px, "#211b18");
  rect(x + 10 * px, y + 19 * px, 4 * px, 5 * px, "#211b18");
  rect(x + (5 - Math.max(0, step)) * px, y + 23 * px, 4 * px, 1 * px, "#110d0c");
  rect(x + (10 + Math.max(0, step)) * px, y + 23 * px, 4 * px, 1 * px, "#110d0c");
  drawRemoteSword(x - px * 0.8, y + px * 0.8, px, palette, attack);
  if (remote.berserk) {
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = "#ff542a";
    ctx.beginPath();
    ctx.ellipse(x + 9.5 * px, y + 13 * px, 10 * px, 14 * px, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function armorPalette(level) {
  const stops = [
    { at: 0, body: "#354d65", light: "#688eab", glint: "#9fc1d6", edge: "#8b949d" },
    { at: 30, body: "#40576a", light: "#86a7bc", glint: "#d4ecf7", edge: "#b6d7ea" },
    { at: 80, body: "#2f6971", light: "#59a9b8", glint: "#bdf8ff", edge: "#8feaff" },
    { at: 140, body: "#5d3e67", light: "#9f6fb1", glint: "#efd0ff", edge: "#d4a7ff" },
    { at: 220, body: "#493823", light: "#b18b45", glint: "#ffedab", edge: "#ffd36b" },
  ];
  const upper = stops.find((stop) => level <= stop.at) || stops[stops.length - 1];
  const lower = stops[Math.max(0, stops.indexOf(upper) - 1)];
  const t = upper === lower ? 0 : Math.max(0, Math.min(1, (level - lower.at) / (upper.at - lower.at)));
  return {
    body: mixColor(lower.body, upper.body, t),
    light: mixColor(lower.light, upper.light, t),
    glint: mixColor(lower.glint, upper.glint, t),
    edge: mixColor(lower.edge, upper.edge, t),
  };
}

function drawRemoteSword(x, y, px, palette, attack) {
  const hiltX = x + (attack ? 14 : 15) * px;
  const hiltY = y + (attack ? 14 : 14) * px;
  const tipX = x + (attack ? 24 : 23) * px;
  const tipY = y + (attack ? 7 : 6) * px;
  ctx.save();
  ctx.strokeStyle = "#20110a";
  ctx.lineWidth = Math.max(3, px * 3.4);
  ctx.lineCap = "square";
  ctx.beginPath();
  ctx.moveTo(hiltX, hiltY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.strokeStyle = palette.shadow;
  ctx.lineWidth = Math.max(2, px * 2.25);
  ctx.beginPath();
  ctx.moveTo(hiltX, hiltY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.strokeStyle = palette.blade;
  ctx.lineWidth = Math.max(1, px * 1.28);
  ctx.beginPath();
  ctx.moveTo(hiltX + px * 0.3, hiltY - px * 0.2);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.strokeStyle = palette.highlight;
  ctx.lineWidth = Math.max(1, px * 0.45);
  ctx.beginPath();
  ctx.moveTo(hiltX + px * 0.45, hiltY - px * 0.3);
  ctx.lineTo(tipX - px * 0.5, tipY + px * 0.25);
  ctx.stroke();
  ctx.strokeStyle = "#2a170d";
  ctx.lineWidth = Math.max(3, px * 2.2);
  ctx.beginPath();
  ctx.moveTo(hiltX - px * 1.35, hiltY - px * 0.9);
  ctx.lineTo(hiltX + px * 1.65, hiltY + px * 0.9);
  ctx.stroke();
  ctx.strokeStyle = palette.guard;
  ctx.lineWidth = Math.max(2, px * 1.35);
  ctx.beginPath();
  ctx.moveTo(hiltX - px * 1.2, hiltY - px * 0.8);
  ctx.lineTo(hiltX + px * 1.5, hiltY + px * 0.8);
  ctx.stroke();
  ctx.restore();
}

function spriteScale(e) {
  if (e.type === "balrog") return 2.05;
  if (e.type === "ogreLord") return 1.58;
  if (e.type === "deathKnight" || e.type === "warlockLord") return 1.48;
  if (e.type === "ogre") return 1.05;
  if (e.boss) return 1.42;
  if (e.type === "skeleton") return 0.62;
  return 0.72;
}

function drawEnemy(e, x, y, size, dist) {
  drawFloorContact(x + size / 2, y + size * 0.95, size, e.type === "balrog" ? "#ff5a22" : e.boss ? "#ffb65c" : "#d8bd76", e.boss ? 0.36 : 0.24);
  if (e.type === "balrog") drawBalrog(e, x, y, size, dist);
  else if (e.type === "skeleton" || e.type === "skeletonKing" || e.type === "deathKnight") drawSkeleton(e, x, y, size, dist);
  else if (e.type === "warlock" || e.type === "warlockLord") drawWarlock(e, x, y, size, dist);
  else drawOrc(e, x, y, size, dist);
}

function drawFloorContact(cx, baseY, size, color, alpha = 0.24) {
  const w = Math.max(10, size * 0.34);
  const h = Math.max(3, size * 0.055);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#110a07";
  ctx.fillRect(Math.round(cx - w * 0.58), Math.round(baseY), Math.ceil(w * 1.16), Math.ceil(h));
  ctx.globalAlpha = alpha * 0.84;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - w * 0.42), Math.round(baseY + h * 0.18), Math.ceil(w * 0.84), Math.max(1, Math.ceil(h * 0.32)));
  ctx.restore();
}

function drawTownSprites() {
  const sprites = [
    ...WORLD_PROPS.map((prop) => ({ kind: "prop", data: prop })),
    ...TOWN_NPCS.map((npc) => ({ kind: "npc", data: npc })),
  ]
    .map((sprite) => {
      const dx = sprite.data.x - player.x;
      const dy = sprite.data.y - player.y;
      return { ...sprite, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((s) => Math.abs(s.angle) < FOV * 0.72 && hasLineOfSight(s.data))
    .sort((a, b) => b.dist - a.dist);

  for (const s of sprites) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.2) continue;
    if (s.kind === "npc") {
      const size = Math.min(180, (H / s.dist) * 0.36);
      const groundY = HALF_H + H / Math.max(1, s.dist) * 0.27;
      const y = groundY - size * 0.94;
      drawFloorContact(screenX, y + size * 0.94, size, "#8feaff", 0.26);
      drawTownNpc(s.data, screenX - size / 2, y, size, s.dist);
      if (gameState === "play") {
        drawNameplate(screenX, y - Math.max(24, size * 0.1), Math.max(64, Math.min(112, size * 0.55)), s.data.name, s.data.hp / s.data.maxHp, "#6bcf77");
      }
    } else {
      const size = Math.min(150, (H / s.dist) * propScale(s.data.type));
      const groundY = HALF_H + H / Math.max(1, s.dist) * 0.27;
      drawTownProp(s.data, screenX - size / 2, groundY - size, size);
    }
  }
}

function propScale(type) {
  if (type === "well") return 0.42;
  if (type === "obelisk") return 0.44;
  if (type === "altar" || type === "boulder") return 0.38;
  if (type === "rack" || type === "grave") return 0.32;
  if (type === "banner") return 0.34;
  if (type === "sign") return 0.3;
  if (type === "lantern") return 0.26;
  return 0.24;
}

function drawTownNpc(npc, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 18));
  const edge = "#25150e";
  paperRect(x + 5 * px, y + 2 * px, 8 * px, 7 * px, "#bd9a68", edge, 0.25);
  paperRect(x + 4 * px, y + 1 * px, 10 * px, 3 * px, "#59402f", edge, 0.18);
  paperRect(x + 3 * px, y + 8 * px, 12 * px, 9 * px, "#456b82", edge, 0.2);
  paperRect(x + 4 * px, y + 10 * px, 10 * px, 5 * px, "#5a83a0", edge, 0.24);
  paperRect(x + 2 * px, y + 9 * px, 3 * px, 7 * px, "#314756", edge, 0.15);
  paperRect(x + 14 * px, y + 9 * px, 3 * px, 7 * px, "#314756", edge, 0.15);
  paperRect(x + 6 * px, y + 17 * px, 3 * px, 4 * px, "#2a241d", edge, 0.1);
  paperRect(x + 11 * px, y + 17 * px, 3 * px, 4 * px, "#2a241d", edge, 0.1);
  paperRect(x + 7 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e", edge, 0.08);
  paperRect(x + 11 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e", edge, 0.08);
  paperRect(x + 8 * px, y + 7 * px, 4 * px, 1 * px, "#704020", edge, 0.1);
  paperRect(x + 6 * px, y + 12 * px, 8 * px, 1 * px, "#d6b06d", "#5b341d", 0.2);
  paperRect(x + 1 * px, y + 8 * px, 1.4 * px, 13 * px, "#7a4e27", "#2d190d", 0.1);
  paperRect(x + 0 * px, y + 7 * px, 3 * px, 2 * px, "#d6b06d", "#5b341d", 0.2);
}

function drawNameplate(cx, y, width, name, pct, fill) {
  const w = Math.round(width);
  const h = 8;
  const x = Math.round(cx - w / 2);
  const clamped = Math.max(0, Math.min(1, pct || 0));
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "500 14px Trebuchet MS, Noto Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(5, 3, 2, 0.98)";
  ctx.lineWidth = 3;
  ctx.strokeText(name, Math.round(cx), Math.round(y - 9));
  ctx.fillStyle = "#fff7dc";
  ctx.fillText(name, Math.round(cx), Math.round(y - 9));
  ctx.fillStyle = "rgba(5, 3, 2, 0.92)";
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#24130d";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamped), h - 2);
  ctx.fillStyle = "rgba(255, 248, 218, 0.34)";
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamped), 2);
  ctx.restore();
}

function drawTownProp(prop, x, y, size) {
  const px = Math.max(2, Math.floor(size / 14));
  const edge = "#2b170d";
  if (prop.type === "lantern") {
    paperRect(x + 6 * px, y + 2 * px, 2 * px, 12 * px, "#3a2114", edge, 0.12);
    paperRect(x + 4 * px, y + 4 * px, 6 * px, 5 * px, "#684020", edge, 0.18);
    paperRect(x + 5 * px, y + 5 * px, 4 * px, 3 * px, "#ffc85a", "#6d3c13", 0.34);
    paperRect(x + 3 * px, y + 13 * px, 8 * px, 2 * px, "#21140e", edge, 0.08);
    return;
  } else if (prop.type === "sign") {
    paperRect(x + 6 * px, y + 5 * px, 2 * px, 10 * px, "#3c2515", edge, 0.1);
    paperRect(x + 2 * px, y + 2 * px, 10 * px, 5 * px, "#8d5a34", edge, 0.22);
    paperRect(x + 3 * px, y + 3 * px, 8 * px, 1.2 * px, "#d6a35b", "#5a351d", 0.18);
    paperRect(x + 3 * px, y + 5 * px, 6 * px, 1 * px, "#2c1a10", edge, 0.08);
    return;
  } else if (prop.type === "banner") {
    paperRect(x + 6 * px, y + 1 * px, 2 * px, 14 * px, "#2f1a10", edge, 0.1);
    paperRect(x + 2 * px, y + 2 * px, 10 * px, 2 * px, "#7a4424", edge, 0.16);
    paperPoly([[x + 3 * px, y + 4 * px], [x + 11 * px, y + 4 * px], [x + 11 * px, y + 12 * px], [x + 7 * px, y + 15 * px], [x + 3 * px, y + 12 * px]], "#a94734", "#421a12", 0.18);
    paperRect(x + 5 * px, y + 6 * px, 4 * px, 1 * px, "#ffd27c", "#6a331b", 0.18);
    paperRect(x + 6 * px, y + 7 * px, 2 * px, 3 * px, "#f6e3ac", "#6a331b", 0.16);
    return;
  } else if (prop.type === "grave") {
    paperRect(x + 3 * px, y + 7 * px, 9 * px, 6 * px, "#29261f", "#16120e", 0.1);
    paperRect(x + 5 * px, y + 2 * px, 5 * px, 8 * px, "#8c8775", "#363229", 0.22);
    paperRect(x + 6 * px, y + 3 * px, 3 * px, 1 * px, "#d7ceb2", "#514c41", 0.16);
    paperRect(x + 6 * px, y + 6 * px, 3 * px, 1 * px, "#514c41", "#2a261f", 0.08);
    return;
  } else if (prop.type === "rack") {
    paperRect(x + 2 * px, y + 2 * px, 2 * px, 13 * px, "#3a2113", edge, 0.1);
    paperRect(x + 10 * px, y + 2 * px, 2 * px, 13 * px, "#3a2113", edge, 0.1);
    paperRect(x + 2 * px, y + 4 * px, 10 * px, 2 * px, "#7a4b25", edge, 0.16);
    paperRect(x + 4 * px, y + 6 * px, 1 * px, 7 * px, "#b9b1a0", "#4a443b", 0.14);
    paperRect(x + 8 * px, y + 6 * px, 1 * px, 7 * px, "#b9b1a0", "#4a443b", 0.14);
    return;
  } else if (prop.type === "altar") {
    paperRect(x + 2 * px, y + 9 * px, 11 * px, 5 * px, "#24152e", "#120918", 0.14);
    paperRect(x + 4 * px, y + 5 * px, 7 * px, 5 * px, "#62457f", "#24152e", 0.2);
    paperRect(x + 6 * px, y + 2 * px, 3 * px, 4 * px, "#d672ff", "#5a1d78", 0.28);
    return;
  } else if (prop.type === "boulder") {
    paperPoly([[x + 2 * px, y + 8 * px], [x + 5 * px, y + 4 * px], [x + 12 * px, y + 5 * px], [x + 13 * px, y + 12 * px], [x + 4 * px, y + 13 * px]], "#75614a", "#2b2118", 0.18);
    paperRect(x + 5 * px, y + 5 * px, 4 * px, 1 * px, "#aa9170", "#4b3a29", 0.12);
    return;
  } else if (prop.type === "ember") {
    paperRect(x + 4 * px, y + 8 * px, 7 * px, 4 * px, "#2d100a", "#130604", 0.12);
    paperTri(x + 5 * px, y + 9 * px, x + 7 * px, y + 2 * px, x + 9 * px, y + 9 * px, "#ff5a22", "#601408");
    paperTri(x + 6 * px, y + 9 * px, x + 7 * px, y + 5 * px, x + 8 * px, y + 9 * px, "#ffd25a", "#8d3c0c");
    return;
  } else if (prop.type === "obelisk") {
    paperRect(x + 4 * px, y + 3 * px, 7 * px, 12 * px, "#1f1722", "#0d0910", 0.12);
    paperTri(x + 4 * px, y + 3 * px, x + 7.5 * px, y - 1 * px, x + 11 * px, y + 3 * px, "#42314d", "#0d0910");
    paperRect(x + 6 * px, y + 5 * px, 3 * px, 5 * px, "#b72421", "#3d0707", 0.18);
    return;
  } else if (prop.type === "well") {
    paperRect(x + 2 * px, y + 8 * px, 12 * px, 5 * px, "#75675a", "#2c241d", 0.18);
    paperRect(x + 4 * px, y + 4 * px, 8 * px, 2 * px, "#6b4329", edge, 0.16);
    paperRect(x + 5 * px, y + 2 * px, 6 * px, 2 * px, "#8a5933", edge, 0.16);
    paperRect(x + 3 * px, y + 5 * px, 2 * px, 5 * px, "#2d2118", edge, 0.08);
    paperRect(x + 11 * px, y + 5 * px, 2 * px, 5 * px, "#2d2118", edge, 0.08);
    return;
  }
  if (prop.type === "lantern") {
    rect(x + 6 * px, y + 2 * px, 2 * px, 12 * px, "#2b1b12");
    rect(x + 4 * px, y + 4 * px, 6 * px, 5 * px, "#4b2a16");
    rect(x + 5 * px, y + 5 * px, 4 * px, 3 * px, "#ffc85a");
    rect(x + 3 * px, y + 13 * px, 8 * px, 2 * px, "#21140e");
  } else if (prop.type === "sign") {
    rect(x + 6 * px, y + 5 * px, 2 * px, 10 * px, "#3c2515");
    rect(x + 2 * px, y + 2 * px, 10 * px, 5 * px, "#7b4b2b");
    rect(x + 3 * px, y + 3 * px, 8 * px, 1 * px, "#d6a35b");
    rect(x + 3 * px, y + 5 * px, 6 * px, 1 * px, "#2c1a10");
  } else if (prop.type === "banner") {
    rect(x + 6 * px, y + 1 * px, 2 * px, 14 * px, "#2f1a10");
    rect(x + 2 * px, y + 2 * px, 10 * px, 2 * px, "#6b3b1e");
    rect(x + 3 * px, y + 4 * px, 8 * px, 8 * px, "#9f4330");
    tri(x + 3 * px, y + 12 * px, x + 7 * px, y + 15 * px, x + 11 * px, y + 12 * px, "#9f4330");
    rect(x + 5 * px, y + 6 * px, 4 * px, 1 * px, "#ffd27c");
    rect(x + 6 * px, y + 7 * px, 2 * px, 3 * px, "#f6e3ac");
  } else if (prop.type === "grave") {
    rect(x + 3 * px, y + 7 * px, 9 * px, 6 * px, "#29261f");
    rect(x + 5 * px, y + 2 * px, 5 * px, 8 * px, "#8c8775");
    rect(x + 6 * px, y + 3 * px, 3 * px, 1 * px, "#d7ceb2");
    rect(x + 6 * px, y + 6 * px, 3 * px, 1 * px, "#514c41");
  } else if (prop.type === "rack") {
    rect(x + 2 * px, y + 2 * px, 2 * px, 13 * px, "#3a2113");
    rect(x + 10 * px, y + 2 * px, 2 * px, 13 * px, "#3a2113");
    rect(x + 2 * px, y + 4 * px, 10 * px, 2 * px, "#7a4b25");
    rect(x + 4 * px, y + 6 * px, 1 * px, 7 * px, "#b9b1a0");
    rect(x + 8 * px, y + 6 * px, 1 * px, 7 * px, "#b9b1a0");
  } else if (prop.type === "altar") {
    rect(x + 2 * px, y + 9 * px, 11 * px, 5 * px, "#24152e");
    rect(x + 4 * px, y + 5 * px, 7 * px, 5 * px, "#62457f");
    rect(x + 6 * px, y + 2 * px, 3 * px, 4 * px, "#d672ff");
    rect(x + 6 * px, y + 3 * px, 3 * px, 1 * px, "#fff0ff");
  } else if (prop.type === "boulder") {
    rect(x + 2 * px, y + 7 * px, 11 * px, 6 * px, "#33291e");
    rect(x + 4 * px, y + 4 * px, 8 * px, 7 * px, "#75614a");
    rect(x + 5 * px, y + 5 * px, 4 * px, 1 * px, "#aa9170");
  } else if (prop.type === "ember") {
    rect(x + 4 * px, y + 8 * px, 7 * px, 4 * px, "#2d100a");
    tri(x + 5 * px, y + 9 * px, x + 7 * px, y + 2 * px, x + 9 * px, y + 9 * px, "#ff5a22");
    tri(x + 6 * px, y + 9 * px, x + 7 * px, y + 5 * px, x + 8 * px, y + 9 * px, "#ffd25a");
  } else if (prop.type === "obelisk") {
    rect(x + 4 * px, y + 3 * px, 7 * px, 12 * px, "#1f1722");
    tri(x + 4 * px, y + 3 * px, x + 7.5 * px, y - 1 * px, x + 11 * px, y + 3 * px, "#42314d");
    rect(x + 6 * px, y + 5 * px, 3 * px, 5 * px, "#b72421");
  } else if (prop.type === "well") {
    rect(x + 2 * px, y + 8 * px, 12 * px, 5 * px, "#4a4038");
    rect(x + 3 * px, y + 9 * px, 10 * px, 3 * px, "#75675a");
    rect(x + 4 * px, y + 4 * px, 8 * px, 2 * px, "#4a2d1c");
    rect(x + 5 * px, y + 2 * px, 6 * px, 2 * px, "#7b4b2b");
    rect(x + 3 * px, y + 5 * px, 2 * px, 5 * px, "#2d2118");
    rect(x + 11 * px, y + 5 * px, 2 * px, 5 * px, "#2d2118");
  } else {
    rect(x + 2 * px, y + 6 * px, 10 * px, 7 * px, "#4b2f1c");
    rect(x + 3 * px, y + 7 * px, 8 * px, 5 * px, "#8b5a32");
    rect(x + 2 * px, y + 9 * px, 10 * px, 1 * px, "#2c1a10");
    rect(x + 6 * px, y + 6 * px, 1 * px, 7 * px, "#2c1a10");
  }
}

function drawProjectiles() {
  const visible = projectiles
    .map((p) => {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      return { p, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((s) => Math.abs(s.angle) < FOV * 0.72)
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const fire = s.p.type === "fire";
    const size = Math.min(fire ? 62 : 42, (H / s.dist) * (fire ? 0.22 : 0.14));
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.15) continue;
    const y = HALF_H - size / 2 + Math.sin(s.p.bob + performance.now() * 0.01) * 3;
    ctx.save();
    ctx.globalAlpha = Math.max(0.4, 1 - s.dist / 12);
    rect(screenX - size / 2, y, size, size, fire ? "#6d1208" : "#53258c");
    rect(screenX - size * 0.28, y + size * 0.18, size * 0.56, size * 0.56, fire ? "#ff5a22" : "#b75cff");
    rect(screenX - size * 0.12, y + size * 0.32, size * 0.24, size * 0.24, fire ? "#ffd25a" : "#f0c8ff");
    ctx.restore();
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

function drawDeathParticles() {
  const visible = deathParticles
    .map((p) => {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      return { p, dist: Math.hypot(dx, dy), angle: normAngle(Math.atan2(dy, dx) - player.angle) };
    })
    .filter((s) => Math.abs(s.angle) < FOV * 0.72 && hasLineOfSight(s.p))
    .sort((a, b) => b.dist - a.dist);

  for (const s of visible) {
    const screenX = W / 2 + Math.tan(s.angle) * (W / FOV);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.18) continue;
    const lift = (H / Math.max(0.45, s.dist)) * s.p.z * 0.34;
    const size = Math.max(3, Math.min(18, (H / Math.max(0.3, s.dist)) * s.p.size));
    const alpha = Math.max(0, s.p.life / s.p.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    const py = HALF_H - lift - size / 2;
    if (s.p.kind === "spark") {
      drawParticleSpark(screenX, py + size / 2, size, s.p.color);
    } else if (s.p.kind === "puff") {
      drawParticlePuff(screenX, py + size / 2, size, s.p.color);
    } else if (s.p.kind === "confetti") {
      drawParticleConfetti(screenX, py + size / 2, size, s.p.color, s.p.vx + s.p.vy);
    } else {
      drawParticleShard(screenX, py + size / 2, size, s.p.color);
    }
    ctx.restore();
  }
}

function drawDeathBursts() {
  for (const burst of deathBursts) {
    const dx = burst.x - player.x;
    const dy = burst.y - player.y;
    const dist = Math.hypot(dx, dy);
    const angle = normAngle(Math.atan2(dy, dx) - player.angle);
    if (Math.abs(angle) > FOV * 0.72 || !hasLineOfSight(burst)) continue;
    const screenX = W / 2 + Math.tan(angle) * (W / FOV);
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < dist - 0.18) continue;
    const progress = 1 - burst.life / burst.maxLife;
    const size = Math.min(H * (burst.balrog ? 0.72 : 0.42), (H / Math.max(0.38, dist)) * (burst.balrog ? 0.78 : burst.boss ? 0.54 : 0.38));
    const y = HALF_H - (H / Math.max(0.45, dist)) * burst.z * 0.26;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - progress) * 0.9;
    drawComicBurst(screenX, y, size * (0.52 + progress * 0.6), burst.palette, burst.balrog);
    ctx.restore();
  }
}

function drawComicBurst(cx, cy, size, palette, huge = false) {
  const outer = size * 0.52;
  const inner = size * (huge ? 0.18 : 0.22);
  ctx.fillStyle = palette[palette.length - 1] || "#20110d";
  ctx.beginPath();
  for (let i = 0; i < 20; i += 1) {
    const angle = (Math.PI * 2 * i) / 20;
    const radius = i % 2 ? inner : outer;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette[0] || "#ff5a22";
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16 + 0.12;
    const radius = i % 2 ? inner * 0.72 : outer * 0.66;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette[3] || "#fff0a8";
  ctx.fillRect(Math.round(cx - size * 0.09), Math.round(cy - size * 0.035), Math.ceil(size * 0.18), Math.max(2, Math.ceil(size * 0.07)));
}

function drawParticleSpark(cx, cy, size, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.24);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.72, cy);
  ctx.lineTo(cx + size * 0.72, cy);
  ctx.moveTo(cx, cy - size * 0.72);
  ctx.lineTo(cx, cy + size * 0.72);
  ctx.stroke();
}

function drawParticlePuff(cx, cy, size, color) {
  ctx.fillStyle = "#140c09";
  ctx.fillRect(Math.round(cx - size * 0.6), Math.round(cy - size * 0.32), Math.ceil(size * 1.2), Math.ceil(size * 0.64));
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(cx - size * 0.44), Math.round(cy - size * 0.44), Math.ceil(size * 0.88), Math.ceil(size * 0.88));
}

function drawParticleShard(cx, cy, size, color) {
  tri(cx - size * 0.58, cy + size * 0.38, cx + size * 0.64, cy, cx - size * 0.18, cy - size * 0.56, color);
}

function drawParticleConfetti(cx, cy, size, color, spin = 0) {
  const w = Math.max(3, size * 0.78);
  const h = Math.max(2, size * 0.34);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin * 1.7);
  ctx.fillStyle = "rgba(35, 20, 12, 0.55)";
  ctx.fillRect(Math.round(-w / 2 + 1), Math.round(-h / 2 + 1), Math.ceil(w), Math.ceil(h));
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(-w / 2), Math.round(-h / 2), Math.ceil(w), Math.ceil(h));
  ctx.fillStyle = "rgba(255, 247, 209, 0.42)";
  ctx.fillRect(Math.round(-w / 2), Math.round(-h / 2), Math.ceil(w * 0.45), Math.max(1, Math.ceil(h * 0.42)));
  ctx.restore();
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
    drawFloorContact(screenX, HALF_H + H / Math.max(1, s.dist) * 0.27, size * 0.92, itemColor(s.item), 0.28);
    drawItemSprite(s.item, screenX - size / 2, y, size);
  }
}

function drawItemSprite(item, x, y, size) {
  const px = Math.max(2, Math.floor(size / 10));
  const itemPaper = {
    health: ["#c9332b", "#fff0bf", "#2b1010"],
    rage: ["#d66a21", "#ffcf62", "#3a102b"],
    xp: ["#45a8ff", "#bfe8ff", "#102642"],
    scroll: ["#f2d58a", "#9d5a22", "#3d2b12"],
    bossScroll: ["#ffd56f", "#fff4c2", "#52250c"],
    armorScroll: ["#76e6ff", "#e6fcff", "#112a35"],
    bossArmorScroll: ["#bff6ff", "#ffffff", "#113440"],
    legendScroll: ["#ff4a24", "#ffd25a", "#3d0f0a"],
  }[item.type];
  if (itemPaper) {
    const [main, light, edge] = itemPaper;
    paperRect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, main, edge, 0.24);
    paperRect(x + 3 * px, y + 2 * px, 4 * px, 2 * px, light, edge, 0.26);
    if (item.type.includes("Scroll")) paperRect(x + 4 * px, y + 4 * px, 2 * px, 3 * px, light, edge, 0.18);
    else if (item.type === "health") {
      paperRect(x + 4 * px, y + 3 * px, 2 * px, 4 * px, light, edge, 0.18);
      paperRect(x + 3 * px, y + 4 * px, 4 * px, 2 * px, light, edge, 0.18);
    } else {
      paperTri(x + 5 * px, y + 1 * px, x + 2 * px, y + 6 * px, x + 8 * px, y + 6 * px, light, edge);
    }
    return;
  }
  if (item.type === "health") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#2b1010");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#c9332b");
    rect(x + 4 * px, y + 3 * px, 2 * px, 4 * px, "#fff0bf");
    rect(x + 3 * px, y + 4 * px, 4 * px, 2 * px, "#fff0bf");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  } else if (item.type === "rage") {
    rect(x + 2 * px, y + 2 * px, 6 * px, 6 * px, "#3a102b");
    rect(x + 3 * px, y + 1 * px, 4 * px, 8 * px, "#d66a21");
    rect(x + 4 * px, y + 2 * px, 2 * px, 6 * px, "#ffcf62");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  } else if (item.type === "xp") {
    rect(x + 2 * px, y + 2 * px, 6 * px, 6 * px, "#102642");
    rect(x + 3 * px, y + 3 * px, 4 * px, 4 * px, "#45a8ff");
    rect(x + 4 * px, y + 1 * px, 2 * px, 8 * px, "#bfe8ff");
    rect(x + 1 * px, y + 4 * px, 8 * px, 2 * px, "#45a8ff");
  } else if (item.type === "scroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#3d2b12");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#f2d58a");
    rect(x + 4 * px, y + 3 * px, 2 * px, 1 * px, "#9d5a22");
    rect(x + 4 * px, y + 5 * px, 2 * px, 1 * px, "#9d5a22");
    rect(x + 1 * px, y + 1 * px, 2 * px, 2 * px, "#fff2b8");
  } else if (item.type === "bossScroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#52250c");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#ffd56f");
    rect(x + 4 * px, y + 2 * px, 2 * px, 5 * px, "#fff4c2");
    rect(x + 1 * px, y + 4 * px, 8 * px, 1 * px, "#a03119");
  } else if (item.type === "armorScroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#112a35");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#76e6ff");
    rect(x + 4 * px, y + 3 * px, 2 * px, 4 * px, "#e6fcff");
    rect(x + 2 * px, y + 4 * px, 6 * px, 1 * px, "#1c738e");
    rect(x + 1 * px, y + 1 * px, 2 * px, 2 * px, "#c8f8ff");
  } else if (item.type === "bossArmorScroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#113440");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#bff6ff");
    rect(x + 4 * px, y + 2 * px, 2 * px, 5 * px, "#ffffff");
    rect(x + 1 * px, y + 4 * px, 8 * px, 1 * px, "#1c738e");
  } else if (item.type === "legendScroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#3d0f0a");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#ff4a24");
    rect(x + 4 * px, y + 1 * px, 2 * px, 8 * px, "#ffd25a");
    rect(x + 2 * px, y + 4 * px, 6 * px, 2 * px, "#7a0e09");
    rect(x + 1 * px, y + 1 * px, 2 * px, 2 * px, "#fff0a8");
  } else {
    rect(x + 2 * px, y + 2 * px, 6 * px, 6 * px, "#21160f");
    rect(x + 3 * px, y + 1 * px, 4 * px, 8 * px, "#d0ae52");
    rect(x + 4 * px, y + 2 * px, 2 * px, 6 * px, "#fff0a8");
    rect(x + 1 * px, y + 4 * px, 8 * px, 2 * px, "#8b1f1f");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  }
}

function drawPaperSkeletonSprite(e, x, y, px, bone, shade, eye, walk, hurt) {
  const edge = "#3a3327";
  paperRect(x + 6 * px, y + 1 * px, 6 * px, 2 * px, "#f6eccb", edge, 0.2);
  paperRect(x + 3 * px, y + 3 * px, 11 * px, 9 * px, bone, edge);
  paperRect(x + 4 * px, y + 4 * px, 9 * px, 2 * px, "#fff3d3", edge, 0.32);
  paperRect(x + 5 * px, y + (hurt ? 7 : 8) * px, 2 * px, hurt ? 1 * px : 2 * px, eye, "#17313e", 0.15);
  paperRect(x + 11 * px, y + (hurt ? 7 : 8) * px, 2 * px, hurt ? 1 * px : 2 * px, eye, "#17313e", 0.15);
  paperRect(x + 8 * px, y + 8 * px, 1 * px, 3 * px, shade, edge, 0.1);
  paperRect(x + 6 * px, y + 11 * px, 6 * px, 1.6 * px, "#2c241c", edge, 0.12);
  paperRect(x + 5 * px, y + 14 * px, 8 * px, 2 * px, shade, edge);
  paperRect(x + 6 * px, y + 16 * px, 6 * px, 6 * px, bone, edge);
  paperRect(x + 7 * px, y + 16 * px, 1.4 * px, 5 * px, "#fff3d3", edge, 0.16);
  paperRect(x + 3 * px, y + 13 * px, 3 * px, 8 * px, bone, edge);
  paperRect(x + 12 * px, y + 13 * px, 3 * px, 8 * px, bone, edge);
  paperRect(x + (5 - Math.max(0, walk)) * px, y + 22 * px, 3 * px, 5 * px, bone, edge);
  paperRect(x + (10 + Math.max(0, walk)) * px, y + 22 * px, 3 * px, 5 * px, bone, edge);
  paperRect(x + 4 * px, y + 26 * px, 4.5 * px, 1.5 * px, shade, edge, 0.12);
  paperRect(x + 9.5 * px, y + 26 * px, 4.5 * px, 1.5 * px, shade, edge, 0.12);
}

function drawPaperOrcSprite(e, x, y, px, skin, skinLight, shadow, deepShadow, armor, armorLight, eye, walk, attack, winding, hurt) {
  const edge = deepShadow;
  paperTri(x + 1 * px, y + 7 * px, x - 2 * px, y + 3 * px, x + 4 * px, y + 9 * px, skinLight, edge);
  paperTri(x + 17 * px, y + 7 * px, x + 19 * px, y + 3 * px, x + 13 * px, y + 9 * px, skinLight, edge);
  paperRect(x + 2.5 * px, y + 4 * px, 13 * px, 10 * px, skin, edge);
  paperRect(x + 5 * px, y + 3 * px, 8 * px, 3 * px, skinLight, edge, 0.32);
  paperRect(x + 4 * px, y + 6 * px, 10 * px, 1 * px, deepShadow, edge, 0.1);
  const eyeH = attack > 0 ? 2 : 1;
  paperRect(x + 5 * px, y + (hurt ? 7 : 8) * px, 3 * px, eyeH * px, eye, "#3c2b0a", 0.14);
  paperRect(x + 10 * px, y + (hurt ? 7 : 8) * px, 3 * px, eyeH * px, eye, "#3c2b0a", 0.14);
  if (winding) {
    paperRect(x + 5 * px, y + 7 * px, 3 * px, 1 * px, deepShadow, edge, 0.1);
    paperRect(x + 10 * px, y + 7 * px, 3 * px, 1 * px, deepShadow, edge, 0.1);
  }
  paperRect(x + 8 * px, y + 9 * px, 2 * px, 2 * px, deepShadow, edge, 0.1);
  paperRect(x + 5 * px, y + 11 * px, 7 * px, hurt ? 1 * px : 2 * px, "#2a120d", edge, 0.12);
  paperRect(x + 6 * px, y + 12 * px, 1 * px, 3 * px, "#fff2d4", "#695844", 0.22);
  paperRect(x + 10 * px, y + 12 * px, 1 * px, 3 * px, "#fff2d4", "#695844", 0.22);
  paperRect(x + 2 * px, y + 13 * px, 13 * px, 9.5 * px, armor, "#111", 0.18);
  paperRect(x + 3 * px, y + 13 * px, 10 * px, 2 * px, armorLight, "#181818", 0.24);
  paperRect(x + 1 * px, y + 12 * px, 5 * px, 4 * px, armorLight, "#181818", 0.2);
  paperRect(x + 11 * px, y + 12 * px, 5 * px, 4 * px, armorLight, "#181818", 0.2);
  paperRect(x + 5 * px, y + 16 * px, 7 * px, 1.2 * px, "#9f8650", "#3c2c19", 0.18);
  const armSwing = walk > 0 ? 1 : -1;
  const leftArmY = y + (winding ? 12 * px : attack > 0 ? 16 * px : (14 + armSwing) * px);
  const rightArmY = y + (winding ? 17 * px : attack > 0 ? 13 * px : (14 - armSwing) * px);
  paperRect(x + 1 * px, leftArmY, 4 * px, 8 * px, shadow, edge, 0.2);
  paperRect(x + 13 * px, rightArmY, 4 * px, 8 * px, shadow, edge, 0.2);
  if (winding || attack > 0) {
    paperRect(x + 15 * px, rightArmY + 2 * px, 5 * px, 2 * px, "#b6975d", "#4a2a16", 0.2);
    paperRect(x + 18 * px, rightArmY - 2 * px, 2 * px, 8 * px, "#5a351b", "#2b170b", 0.16);
  }
  const legA = walk > 0 ? 1 : 0;
  paperRect(x + (5 - legA) * px, y + 21.5 * px, 3.5 * px, 4 * px, "#191818", "#090909", 0.1);
  paperRect(x + (9.5 + legA) * px, y + 21.5 * px, 3.5 * px, 4 * px, "#191818", "#090909", 0.1);
  paperRect(x + (4.5 - legA) * px, y + 25 * px, 4.5 * px, 1.2 * px, "#0e0d0c", "#050505", 0.06);
  paperRect(x + (9.2 + legA) * px, y + 25 * px, 4.5 * px, 1.2 * px, "#0e0d0c", "#050505", 0.06);
}

function drawPaperSkeletonBossSprite(e, x, y, px, bone, shade, eye, walk, hurt, deathKnight) {
  const edge = deathKnight ? "#10141d" : "#30291e";
  const crown = deathKnight ? "#aeb6c2" : "#ffd467";
  paperRect(x + 3 * px, y + 2 * px, 12 * px, 10 * px, bone, edge, 0.24);
  paperRect(x + 4 * px, y + 1 * px, 10 * px, 2 * px, crown, "#5b3a15", 0.28);
  paperRect(x + 5 * px, y + (hurt ? 6 : 7) * px, 3 * px, hurt ? 1 * px : 2 * px, eye, "#24140f", 0.12);
  paperRect(x + 10 * px, y + (hurt ? 6 : 7) * px, 3 * px, hurt ? 1 * px : 2 * px, eye, "#24140f", 0.12);
  paperRect(x + 6 * px, y + 11 * px, 6 * px, hurt ? 1.2 * px : 2 * px, "#20140f", edge, 0.1);
  paperRect(x + 4 * px, y + 14 * px, 11 * px, 8 * px, deathKnight ? "#202838" : "#34354b", edge, 0.18);
  paperRect(x + 5 * px, y + 14 * px, 9 * px, 2 * px, deathKnight ? "#7d8796" : "#737aa6", edge, 0.22);
  paperRect(x + 2 * px, y + 13 * px, 4 * px, 9 * px, bone, edge, 0.16);
  paperRect(x + 13 * px, y + 13 * px, 4 * px, 9 * px, bone, edge, 0.16);
  paperRect(x + 14 * px, y + 10 * px, 2 * px, 15 * px, deathKnight ? "#cfd6df" : "#ccb98a", "#4b3517", 0.18);
  paperRect(x + (5 - Math.max(0, walk)) * px, y + 22 * px, 3 * px, 6 * px, bone, edge, 0.14);
  paperRect(x + (11 + Math.max(0, walk)) * px, y + 22 * px, 3 * px, 6 * px, bone, edge, 0.14);
}

function drawPaperWarlockSprite(e, x, y, px, lord, flash, hurt) {
  const edge = lord ? "#100416" : "#190b21";
  const robe = flash ? "#a982d8" : lord ? "#271032" : "#312044";
  const hood = flash ? "#d7b6ff" : lord ? "#572069" : "#53356c";
  paperTri(x + 1 * px, y + 24 * px, x + 8.5 * px, y + 4 * px, x + 17 * px, y + 24 * px, robe, edge);
  paperRect(x + 3 * px, y + 7 * px, 12 * px, 17 * px, robe, edge, 0.18);
  paperRect(x + 5 * px, y + 14 * px, 8 * px, 2 * px, lord ? "#7a3ba4" : "#6c4b86", edge, 0.16);
  paperRect(x + 4 * px, y + 2 * px, 10 * px, 8 * px, hood, edge, 0.22);
  if (lord) {
    paperRect(x + 4 * px, y + 0 * px, 10 * px, 3 * px, "#e2a84a", "#5d3510", 0.25);
  }
  const eye = lord ? "#ff7cff" : "#d86aff";
  paperRect(x + 6 * px, y + (hurt ? 7 : 6) * px, hurt ? 3 * px : 2 * px, 1.4 * px, eye, "#120616", 0.14);
  paperRect(x + 10 * px, y + (hurt ? 7 : 6) * px, hurt ? 3 * px : 2 * px, 1.4 * px, eye, "#120616", 0.14);
  paperRect(x + 6 * px, y + 11 * px, 7 * px, hurt ? 1 * px : 2 * px, "#120c14", edge, 0.1);
  paperRect(x + 2 * px, y + 13 * px, 4 * px, 9 * px, "#3c2454", edge, 0.16);
  paperRect(x + 12 * px, y + (e.attackPose > 0 ? 15 : 13) * px, 4 * px, 9 * px, "#3c2454", edge, 0.16);
  paperRect(x + 1 * px, y + 8 * px, 1.4 * px, 17 * px, "#5f3b21", "#261509", 0.12);
  paperRect(x + 0 * px, y + 6 * px, 3.5 * px, 3.5 * px, lord ? "#ff7cff" : "#b75cff", "#271036", 0.22);
  if (e.attackWindup > 0) {
    paperRect(x + 13 * px, y + 15 * px, 5 * px, 5 * px, "#efc9ff", "#6d2eb2", 0.3);
  }
  paperRect(x + 6 * px, y + 23 * px, 3 * px, 3 * px, "#120b18", edge, 0.08);
  paperRect(x + 10 * px, y + 23 * px, 3 * px, 3 * px, "#120b18", edge, 0.08);
}

function drawPaperBalrogSprite(e, x, y, px, flash, walk, attack, winding) {
  const edge = "#170404";
  const body = flash ? "#ffbd85" : "#3a0b09";
  const bodyLight = flash ? "#ffd7a8" : "#7d1b16";
  paperTri(x + 4 * px, y + 15 * px, x - 4 * px, y + 5 * px, x + 0 * px, y + 30 * px, "#210707", edge);
  paperTri(x + 14 * px, y + 15 * px, x + 22 * px, y + 5 * px, x + 18 * px, y + 30 * px, "#210707", edge);
  paperTri(x + 4 * px, y + 17 * px, x - 1 * px, y + 10 * px, x + 1 * px, y + 24 * px, "#8e2518", edge);
  paperTri(x + 14 * px, y + 17 * px, x + 19 * px, y + 10 * px, x + 17 * px, y + 24 * px, "#8e2518", edge);
  paperTri(x + 4 * px, y + 5 * px, x + 1 * px, y - 1 * px, x + 7 * px, y + 4 * px, "#e0be74", "#583615");
  paperTri(x + 14 * px, y + 5 * px, x + 17 * px, y - 1 * px, x + 11 * px, y + 4 * px, "#e0be74", "#583615");
  paperRect(x + 2 * px, y + 7 * px, 14 * px, 12 * px, body, edge, 0.16);
  paperRect(x + 4 * px, y + 5 * px, 10 * px, 9 * px, bodyLight, edge, 0.18);
  paperRect(x + 5 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f", "#4a0804", 0.2);
  paperRect(x + 10 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f", "#4a0804", 0.2);
  paperRect(x + 6 * px, y + 13 * px, 6 * px, flash ? 1 * px : 2 * px, "#100303", edge, 0.08);
  paperRect(x + 6 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0", "#6d533b", 0.18);
  paperRect(x + 11 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0", "#6d533b", 0.18);
  paperRect(x + 3 * px, y + 18 * px, 12 * px, 12 * px, "#191010", edge, 0.12);
  paperRect(x + 4 * px, y + 18 * px, 10 * px, 2 * px, "#9e2a1b", edge, 0.18);
  paperRect(x + 5 * px, y + 22 * px, 8 * px, 2 * px, "#d63a1d", "#541008", 0.18);
  paperTri(x + 6 * px, y + 20 * px, x + 8 * px, y + 16 * px, x + 10 * px, y + 20 * px, "#ff6a22", "#5a1008");
  paperTri(x + 9 * px, y + 21 * px, x + 11 * px, y + 17 * px, x + 13 * px, y + 21 * px, "#ffd25a", "#8d3c0c");
  paperRect(x + 1 * px, y + (winding ? 19 : 20) * px, 5 * px, 8 * px, "#260909", edge, 0.12);
  paperRect(x + 12 * px, y + (attack > 0 ? 18 : 20) * px, 5 * px, 8 * px, "#260909", edge, 0.12);
  if (winding || attack > 0) {
    paperRect(x + 15 * px, y + 17 * px, 3 * px, 12 * px, "#ff5b22", "#5a1008", 0.22);
  }
  paperRect(x + (5 - Math.max(0, walk)) * px, y + 30 * px, 4 * px, 7 * px, "#160706", edge, 0.08);
  paperRect(x + (10 + Math.max(0, walk)) * px, y + 30 * px, 4 * px, 7 * px, "#160706", edge, 0.08);
}

function drawSkeleton(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const deathKnight = e.type === "deathKnight";
  const king = e.type === "skeletonKing" || deathKnight;
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px : 0;
  const idle = e.moving ? 0 : monsterIdle(e, 0.72);
  const bone = flash ? "#fff4c8" : deathKnight ? "#a8a29a" : "#d8d0ad";
  const shade = deathKnight ? "#20222b" : king ? "#8e7b55" : "#8f8870";
  const eye = deathKnight ? "#ff6a22" : king ? "#e12621" : "#5ed1ff";
  const hurt = e.hitFlash > 0.12;
  y += bob + idle * px * 0.5 - e.attackPose * 3 * px + (hurt ? Math.sin(performance.now() * 0.09) * px : 0);
  x += walk * px * 0.42 + idle * px * 0.12;
  ctx.globalAlpha = 1;
  if (!king) {
    drawPaperSkeletonSprite(e, x, y, px, bone, shade, eye, walk, hurt);
    ctx.globalAlpha = 1;
    return;
  }
  drawPaperSkeletonBossSprite(e, x, y, px, bone, shade, eye, walk, hurt, deathKnight);
  ctx.globalAlpha = 1;
  return;
  if (king) {
    rect(x + 4 * px, y + 1 * px, 8 * px, 2 * px, "#d6b14d");
    rect(x + 5 * px, y - 1 * px, 2 * px, 3 * px, "#ffe28a");
    rect(x + 10 * px, y - 1 * px, 2 * px, 3 * px, "#ffe28a");
  }
  rect(x + 2 * px, y + 3 * px, 13 * px, 10 * px, "#221b18");
  rect(x + 14 * px, y + 5 * px, 1 * px, 18 * px, "rgba(255, 241, 200, 0.2)");
  rect(x + 3 * px, y + 3 * px, 11 * px, 9 * px, bone);
  rect(x + 4 * px, y + 4 * px, 9 * px, 2 * px, "#f5edce");
  rect(x + 4 * px, y + 7 * px, 1 * px, 3 * px, shade);
  rect(x + 13 * px, y + 7 * px, 1 * px, 3 * px, shade);
  rect(x + 5 * px, y + (hurt ? 7 : 8) * px, 2 * px, hurt ? 1 * px : 2 * px, eye);
  rect(x + 11 * px, y + (hurt ? 7 : 8) * px, 2 * px, hurt ? 1 * px : 2 * px, eye);
  rect(x + 8 * px, y + 8 * px, 1 * px, 3 * px, shade);
  rect(x + 6 * px, y + 11 * px, 6 * px, hurt ? 2 * px : 1 * px, "#221a17");
  rect(x + 6 * px, y + 13 * px, 6 * px, 2 * px, shade);
  rect(x + 5 * px, y + 14 * px, 8 * px, 1 * px, bone);
  rect(x + 7 * px, y + 15 * px, 3 * px, 7 * px, bone);
  rect(x + 5 * px, y + 16 * px, 7 * px, 1 * px, bone);
  rect(x + 6 * px, y + 17 * px, 1 * px, 4 * px, shade);
  rect(x + 11 * px, y + 17 * px, 1 * px, 4 * px, shade);
  rect(x + 6 * px, y + 19 * px, 6 * px, 1 * px, "#f5edce");
  rect(x + 4 * px, y + 17 * px, 9 * px, 1 * px, bone);
  rect(x + 3 * px, y + (e.attackPose > 0 ? 12 : 14) * px, 2 * px, 8 * px, bone);
  rect(x + 12 * px, y + (e.attackPose > 0 ? 16 : 14) * px, 2 * px, 8 * px, bone);
  rect(x + (5 - Math.max(0, walk)) * px, y + 22 * px, 2 * px, 5 * px, bone);
  rect(x + (10 + Math.max(0, walk)) * px, y + 22 * px, 2 * px, 5 * px, bone);
  rect(x + 4 * px, y + 26 * px, 3 * px, 1 * px, shade);
  rect(x + 10 * px, y + 26 * px, 3 * px, 1 * px, shade);
  if (king) {
    rect(x + 2 * px, y + 13 * px, 12 * px, 4 * px, deathKnight ? "#141820" : "#292a36");
    rect(x + 3 * px, y + 14 * px, 10 * px, 1 * px, deathKnight ? "#6e7482" : "#5f6485");
    rect(x + 13 * px, y + 13 * px, 2 * px, 13 * px, "#44351d");
    rect(x + 14 * px, y + 10 * px, 1 * px, 7 * px, deathKnight ? "#d9dde4" : "#cfc6ad");
    if (deathKnight) {
      rect(x + 1 * px, y + 18 * px, 14 * px, 3 * px, "#0c1017");
      rect(x + 3 * px, y + 17 * px, 10 * px, 1 * px, "#9aa3b4");
      rect(x + 0 * px, y + 12 * px, 3 * px, 8 * px, "#121722");
      rect(x + 1 * px, y + 13 * px, 1 * px, 6 * px, "#8590a6");
    }
  }
  ctx.globalAlpha = 1;
}

function drawWarlock(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const lord = e.type === "warlockLord";
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px : 0;
  const idle = e.moving ? 0 : monsterIdle(e, 1.08);
  const hurt = e.hitFlash > 0.12;
  y += bob + idle * px * 0.7 - e.attackPose * 2 * px + (hurt ? Math.sin(performance.now() * 0.1) * px : 0);
  x += walk * px * 0.34 + idle * px * 0.1;
  ctx.globalAlpha = 1;
  drawPaperWarlockSprite(e, x, y, px, lord, flash, hurt);
  ctx.globalAlpha = 1;
  return;
  tri(x + 2 * px, y + 6 * px, x + 8 * px, y - 2 * px, x + 15 * px, y + 6 * px, lord ? "#0d0417" : "#160b24");
  tri(x + 1 * px, y + 23 * px, x + 8.5 * px, y + 6 * px, x + 17 * px, y + 23 * px, lord ? "#0e0619" : "#190d28");
  rect(x + 2 * px, y + 5 * px, 13 * px, 19 * px, flash ? "#a982d8" : lord ? "#170824" : "#241334");
  rect(x + 4 * px, y + 2 * px, 9 * px, 8 * px, flash ? "#d7b6ff" : lord ? "#4b1465" : "#3a1e58");
  rect(x + 5 * px, y + 4 * px, 7 * px, 1 * px, lord ? "#a66cff" : "#8054aa");
  rect(x + 14 * px, y + 6 * px, 1 * px, 18 * px, "rgba(234, 192, 255, 0.2)");
  if (lord) {
    rect(x + 4 * px, y + 1 * px, 9 * px, 3 * px, "#68430c");
    rect(x + 6 * px, y + 0 * px, 5 * px, 2 * px, "#f0b84a");
  }
  rect(x + 6 * px, y + (hurt ? 8 : 7) * px, hurt ? 3 * px : 2 * px, 1 * px, lord ? "#ff6aff" : "#d669ff");
  rect(x + 10 * px, y + (hurt ? 8 : 7) * px, hurt ? 3 * px : 2 * px, 1 * px, lord ? "#ff6aff" : "#d669ff");
  if (hurt) {
    rect(x + 5 * px, y + 7 * px, 4 * px, 1 * px, "#120b19");
    rect(x + 10 * px, y + 7 * px, 4 * px, 1 * px, "#120b19");
  }
  rect(x + 5 * px, y + 11 * px, 8 * px, hurt ? 1 * px : 2 * px, "#111014");
  rect(x + (hurt ? 6 : 7) * px, y + 13 * px, hurt ? 6 * px : 4 * px, 1 * px, lord ? "#7e33c5" : "#5b2c83");
  rect(x + 2 * px, y + (e.attackPose > 0 ? 11 : 13) * px, 4 * px, 9 * px, "#321b49");
  rect(x + 12 * px, y + (e.attackPose > 0 ? 16 : 13) * px, 4 * px, 9 * px, "#321b49");
  rect(x + 13 * px, y + 18 * px, 3 * px, 3 * px, lord ? "#ff7cff" : "#b75cff");
  rect(x + 1 * px, y + 8 * px, 1 * px, 17 * px, "#40261a");
  rect(x + 0 * px, y + 7 * px, 3 * px, 3 * px, lord ? "#ff7cff" : "#b75cff");
  rect(x + 1 * px, y + 8 * px, 1 * px, 1 * px, "#fff0ff");
  rect(x + 7 * px, y + 16 * px, 4 * px, 1 * px, lord ? "#a14be3" : "#684095");
  rect(x + 5 * px, y + 18 * px, 8 * px, 2 * px, lord ? "#3d1456" : "#362243");
  rect(x + 7 * px, y + 18 * px, 4 * px, 1 * px, lord ? "#ffb2ff" : "#b778d7");
  rect(x + 6 * px, y + 23 * px, 3 * px, 3 * px, "#100b16");
  rect(x + 10 * px, y + 23 * px, 3 * px, 3 * px, "#100b16");
  if (e.attackWindup > 0) {
    rect(x + 11 * px, y + 14 * px, 7 * px, 7 * px, "#6d2eb2");
    rect(x + 12 * px, y + 15 * px, 5 * px, 5 * px, "#efc9ff");
  }
  ctx.globalAlpha = 1;
}

function drawBalrog(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 30));
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px * 0.7 : 0;
  const idle = e.moving ? 0 : monsterIdle(e, 0.48);
  const attack = e.attackPose;
  const winding = e.attackWindup > 0;
  y += bob + idle * px * 0.34 - attack * 4 * px + (winding ? 2 * px : 0);
  x += walk * px * 0.28;
  ctx.globalAlpha = 1;
  drawPaperBalrogSprite(e, x, y, px, flash, walk, attack, winding);
  ctx.globalAlpha = 1;
  return;

  tri(x + 4 * px, y + 15 * px, x - 3 * px, y + 6 * px, x + 1 * px, y + 29 * px, "#150404");
  tri(x + 14 * px, y + 15 * px, x + 21 * px, y + 6 * px, x + 17 * px, y + 29 * px, "#150404");
  tri(x + 4 * px, y + 17 * px, x - 1 * px, y + 10 * px, x + 1 * px, y + 24 * px, "#6f1c13");
  tri(x + 14 * px, y + 17 * px, x + 19 * px, y + 10 * px, x + 17 * px, y + 24 * px, "#6f1c13");
  rect(x + 2 * px, y + 7 * px, 14 * px, 12 * px, flash ? "#ffcf9a" : "#2a0907");
  rect(x + 4 * px, y + 5 * px, 10 * px, 9 * px, flash ? "#ffd7a8" : "#5a1110");
  rect(x + 1 * px, y + 9 * px, 4 * px, 3 * px, "#1a0504");
  rect(x + 13 * px, y + 9 * px, 4 * px, 3 * px, "#1a0504");
  tri(x + 4 * px, y + 5 * px, x + 1 * px, y - 1 * px, x + 7 * px, y + 3 * px, "#d9b46a");
  tri(x + 14 * px, y + 5 * px, x + 17 * px, y - 1 * px, x + 11 * px, y + 3 * px, "#d9b46a");
  rect(x + 5 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f");
  rect(x + 10 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f");
  if (flash) {
    rect(x + 4 * px, y + 8 * px, 4 * px, 1 * px, "#240605");
    rect(x + 10 * px, y + 8 * px, 4 * px, 1 * px, "#240605");
  }
  rect(x + 6 * px, y + 8 * px, 2 * px, 1 * px, "#ffd25a");
  rect(x + 11 * px, y + 8 * px, 2 * px, 1 * px, "#ffd25a");
  rect(x + (flash ? 6 : 7) * px, y + 12 * px, flash ? 6 * px : 4 * px, flash ? 1 * px : 2 * px, "#0b0303");
  rect(x + 6 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0");
  rect(x + 11 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0");
  rect(x + 8 * px, y + 5 * px, 2 * px, 10 * px, "rgba(255, 108, 48, 0.18)");

  rect(x + 3 * px, y + 18 * px, 12 * px, 12 * px, "#171010");
  rect(x + 4 * px, y + 18 * px, 10 * px, 2 * px, "#6f1c13");
  rect(x + 2 * px, y + 18 * px, 14 * px, 1 * px, "#b13a20");
  rect(x + 5 * px, y + 22 * px, 8 * px, 2 * px, "#d63a1d");
  rect(x + 6 * px, y + 25 * px, 6 * px, 1 * px, "#ff7b2c");
  rect(x + 1 * px, y + 20 * px, 5 * px, 7 * px, "#210808");
  rect(x + 12 * px, y + 20 * px, 5 * px, 7 * px, "#210808");
  rect(x + 0 * px, y + 24 * px, 4 * px, 3 * px, "#6f1c13");
  rect(x + 14 * px, y + 24 * px, 4 * px, 3 * px, "#6f1c13");
  rect(x + 5 * px, y + 30 * px, 4 * px, 7 * px, "#130706");
  rect(x + 10 * px, y + 30 * px, 4 * px, 7 * px, "#130706");
  rect(x + 4 * px, y + 36 * px, 5 * px, 2 * px, "#070303");
  rect(x + 10 * px, y + 36 * px, 5 * px, 2 * px, "#070303");
  tri(x + 6 * px, y + 20 * px, x + 8 * px, y + 16 * px, x + 10 * px, y + 20 * px, "#ff5b22");
  tri(x + 9 * px, y + 21 * px, x + 11 * px, y + 17 * px, x + 13 * px, y + 21 * px, "#ffd25a");

  if (winding || attack > 0) {
    rect(x + 15 * px, y + 17 * px, 3 * px, 12 * px, "#ff5b22");
    rect(x + 16 * px, y + 18 * px, 1 * px, 10 * px, "#ffd25a");
  }
  ctx.globalAlpha = 1;
}

function drawOrc(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const ogreLord = e.type === "ogreLord";
  const dark = e.boss || e.type === "ogre" || ogreLord;
  const ogre = e.type === "ogre" || ogreLord;
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px : 0;
  const idle = e.moving ? 0 : monsterIdle(e, 0.82);
  const attack = e.attackPose;
  const winding = e.attackWindup > 0;
  const hurt = e.hitFlash > 0.1;
  y += bob + idle * px * 0.42 - attack * 3 * px + (winding ? 2 * px : 0) + (hurt ? Math.sin(performance.now() * 0.11) * px : 0);
  x += walk * px * 0.48 + idle * px * 0.14 + (winding ? Math.sin(e.step + 1.2) * px * 0.5 : 0) + (hurt ? Math.sin(performance.now() * 0.16) * px * 0.7 : 0);
  const skin = flash ? "#f6e9b8" : ogreLord ? "#4e5f29" : ogre ? "#6b7f38" : dark ? "#1d5f32" : "#2f9c45";
  const skinLight = flash ? "#fff6cf" : ogreLord ? "#839448" : ogre ? "#9aaa55" : dark ? "#3a8745" : "#5fc765";
  const shadow = ogreLord ? "#252d17" : ogre ? "#323d1d" : dark ? "#0e2817" : "#145b28";
  const deepShadow = ogreLord ? "#11150c" : ogre ? "#181e10" : dark ? "#07130b" : "#0a3317";
  const armor = dark ? "#181818" : "#262728";
  const armorLight = dark ? "#3b3b3b" : "#46494a";
  const eye = dark ? "#e12621" : "#f0d447";

  ctx.globalAlpha = 1;
  if (!dark && !ogre) {
    drawPaperOrcSprite(e, x, y, px, skin, skinLight, shadow, deepShadow, armor, armorLight, eye, walk, attack, winding, hurt);
    ctx.globalAlpha = 1;
    return;
  }
  drawPaperOrcSprite(e, x, y, px, skin, skinLight, shadow, deepShadow, armor, armorLight, eye, walk, attack, winding, hurt);
  if (ogre || dark) {
    paperTri(x + 4 * px, y + 4 * px, x + 2 * px, y - 1 * px, x + 7 * px, y + 3 * px, "#d8c99b", deepShadow);
    paperTri(x + 14 * px, y + 4 * px, x + 16 * px, y - 1 * px, x + 11 * px, y + 3 * px, "#d8c99b", deepShadow);
    if (e.boss || ogreLord) {
      paperRect(x + 3 * px, y + 13 * px, 12 * px, 2 * px, ogreLord ? "#d0aa48" : "#8f2b22", "#23130c", 0.22);
    }
  }
  ctx.globalAlpha = 1;
  return;

  rect(x + 2 * px, y + 4 * px, 13 * px, 21 * px, deepShadow);
  rect(x + 14 * px, y + 6 * px, 1 * px, 17 * px, "rgba(240, 230, 170, 0.18)");
  rect(x + 2 * px, y + 3 * px, 13 * px, 11 * px, deepShadow);
  rect(x + 4 * px, y + 2 * px, 9 * px, 3 * px, skinLight);
  rect(x + 3 * px, y + 5 * px, 11 * px, 8 * px, skin);
  rect(x + 5 * px, y + 12 * px, 7 * px, 2 * px, shadow);
  rect(x + 0 * px, y + 7 * px, 4 * px, 3 * px, skin);
  rect(x + 13 * px, y + 7 * px, 4 * px, 3 * px, skin);
  tri(x + 0 * px, y + 7 * px, x - 2 * px, y + 3 * px, x + 4 * px, y + 8 * px, skinLight);
  tri(x + 17 * px, y + 7 * px, x + 19 * px, y + 3 * px, x + 13 * px, y + 8 * px, skinLight);
  rect(x + 1 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 14 * px, y + 8 * px, 2 * px, 1 * px, skinLight);
  rect(x + 3 * px, y + 6 * px, 11 * px, 1 * px, deepShadow);
  rect(x + 4 * px, y + 5 * px, 2 * px, 1 * px, skinLight);
  rect(x + 11 * px, y + 5 * px, 2 * px, 1 * px, skinLight);
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

  rect(x + 2 * px, y + 13 * px, 13 * px, 9 * px, armor);
  rect(x + 3 * px, y + 13 * px, 10 * px, 2 * px, armorLight);
  rect(x + 1 * px, y + 12 * px, 5 * px, 4 * px, armorLight);
  rect(x + 11 * px, y + 12 * px, 5 * px, 4 * px, armorLight);
  rect(x + 3 * px, y + 13 * px, 2 * px, 1 * px, "#b7a06e");
  rect(x + 12 * px, y + 13 * px, 2 * px, 1 * px, "#b7a06e");
  rect(x + 5 * px, y + 15 * px, 1 * px, 1 * px, "#b7a06e");
  rect(x + 11 * px, y + 15 * px, 1 * px, 1 * px, "#b7a06e");
  rect(x + 8 * px, y + 18 * px, 3 * px, 1 * px, "#0a0a0a");
  rect(x + 5 * px, y + 16 * px, 7 * px, 1 * px, "#806a49");
  rect(x + 7 * px, y + 17 * px, 1 * px, 5 * px, "#141414");
  rect(x + 9 * px, y + 17 * px, 3 * px, 1 * px, "#5d4830");
  const armSwing = walk > 0 ? 1 : -1;
  const leftArmY = y + (winding ? 12 * px : attack > 0 ? 16 * px : (14 + armSwing) * px);
  const rightArmY = y + (winding ? 17 * px : attack > 0 ? 13 * px : (14 - armSwing) * px);
  rect(x + 1 * px, leftArmY, 4 * px, 4 * px, armorLight);
  rect(x + 12 * px, rightArmY, 4 * px, 4 * px, armorLight);
  rect(x + 1 * px, leftArmY + 4 * px, 3 * px, 5 * px, shadow);
  rect(x + 14 * px, rightArmY + 4 * px, 3 * px, 5 * px, shadow);
  rect(x + 15 * px, rightArmY + 5 * px, 3 * px, 1 * px, "#8f7a50");
  if (winding || attack > 0) {
    rect(x + 14 * px, rightArmY + (attack > 0 ? 1 : 3) * px, 5 * px, 2 * px, "#b6975d");
    rect(x + 17 * px, rightArmY + (attack > 0 ? -3 : 1) * px, 2 * px, 8 * px, "#3a2414");
  }
  const legA = walk > 0 ? 1 : 0;
  rect(x + (5 - legA) * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
  rect(x + (10 + legA) * px, y + 21 * px, 3 * px, 3 * px, dark ? "#111" : "#1a1b1b");
  rect(x + 4 * px, y + 24 * px, 4 * px, 1 * px, "#0b0b0b");
  rect(x + 10 * px, y + 24 * px, 4 * px, 1 * px, "#0b0b0b");
  rect(x + 12 * px, y + 5 * px, 1 * px, 8 * px, "rgba(0, 0, 0, 0.2)");

  if (ogre) {
    rect(x + 2 * px, y + 1 * px, 3 * px, 5 * px, "#c7b98f");
    rect(x + 11 * px, y + 1 * px, 3 * px, 5 * px, "#c7b98f");
    rect(x + 1 * px, y + 12 * px, 5 * px, 7 * px, "#222");
    rect(x + 11 * px, y + 12 * px, 5 * px, 7 * px, "#222");
    rect(x + 4 * px, y + 15 * px, 9 * px, 2 * px, ogreLord ? "#9b221a" : "#6f1414");
    if (ogreLord) {
      rect(x + 2 * px, y + 13 * px, 12 * px, 2 * px, "#d0aa48");
      rect(x + 6 * px, y + 2 * px, 6 * px, 1 * px, "#1a0c08");
    }
  } else if (dark) {
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

function monsterIdle(e, rate = 1) {
  const seed = (e.x || e.spawnX || 0) * 1.7 + (e.y || e.spawnY || 0) * 2.3;
  return Math.sin(performance.now() * 0.0024 * rate + seed);
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

function paperRect(x, y, w, h, fill, edge = "#2a1911", shine = 0.22) {
  const rx = Math.round(x);
  const ry = Math.round(y);
  const rw = Math.max(1, Math.ceil(w));
  const rh = Math.max(1, Math.ceil(h));
  ctx.fillStyle = "rgba(10, 6, 4, 0.28)";
  ctx.fillRect(rx + 1, ry + 1, rw, rh);
  ctx.fillStyle = edge;
  ctx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
  ctx.fillStyle = fill;
  ctx.fillRect(rx, ry, rw, rh);
  if (shine > 0 && rw > 2 && rh > 2) {
    ctx.fillStyle = `rgba(255, 248, 211, ${shine})`;
    ctx.fillRect(rx + 1, ry + 1, Math.max(1, Math.floor(rw * 0.45)), Math.max(1, Math.floor(rh * 0.22)));
    ctx.fillStyle = "rgba(58, 35, 22, 0.12)";
    ctx.fillRect(rx + Math.floor(rw * 0.62), ry + 1, 1, rh - 2);
  }
}

function paperTri(x1, y1, x2, y2, x3, y3, fill, edge = "#2a1911") {
  ctx.save();
  ctx.fillStyle = "rgba(10, 6, 4, 0.26)";
  ctx.translate(1, 1);
  drawPolyRaw([[x1, y1], [x2, y2], [x3, y3]]);
  ctx.restore();
  paperPoly([[x1, y1], [x2, y2], [x3, y3]], fill, edge, 0.16);
}

function paperPoly(points, fill, edge = "#2a1911", shine = 0.18) {
  ctx.fillStyle = edge;
  drawPolyRaw(points);
  const cx = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const inset = points.map(([x, y]) => [x + (cx - x) * 0.035, y + (cy - y) * 0.035]);
  ctx.fillStyle = fill;
  drawPolyRaw(inset);
  if (shine > 0 && points.length >= 4) {
    ctx.strokeStyle = `rgba(255, 248, 211, ${shine})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0][0] * 0.55 + points[3][0] * 0.45, points[0][1] * 0.55 + points[3][1] * 0.45);
    ctx.lineTo(points[1][0] * 0.55 + points[2][0] * 0.45, points[1][1] * 0.55 + points[2][1] * 0.45);
    ctx.stroke();
  }
}

function drawPolyRaw(points) {
  ctx.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) ctx.moveTo(Math.round(x), Math.round(y));
    else ctx.lineTo(Math.round(x), Math.round(y));
  });
  ctx.closePath();
  ctx.fill();
}

function drawWeapon() {
  const progress = swing > 0 ? 1 - swing : 0;
  const special = swingType === "special" && swing > 0;
  if (special) {
    drawSpecialSword(progress);
    if (hitSpark > 0) drawHitSpark();
    return;
  }
  const windup = progress < 0.18 ? progress / 0.18 : 1;
  const thrust = progress < 0.46 ? Math.sin((progress / 0.46) * Math.PI * 0.5) : Math.max(0, 1 - (progress - 0.46) / 0.36);
  const lunge = swing > 0 ? thrust : 0;
  const recoil = swing > 0 && progress > 0.58 ? Math.min(1, (progress - 0.58) / 0.32) : 0;
  const moving = keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD");
  const idleSway = Math.sin(performance.now() * 0.006) * 3;
  const walkSway = moving && swing === 0 ? Math.sin(performance.now() * 0.014) * 10 : 0;
  const walkBob = moving && swing === 0 ? Math.abs(Math.sin(performance.now() * 0.014)) * 8 : 0;
  const sway = swing > 0 ? 0 : idleSway + walkSway;
  const reach = lunge;

  const nearX = W * (0.88 + (1 - windup) * 0.05 - reach * 0.24 + recoil * 0.08) + sway;
  const nearY = H * (1.13 + (1 - windup) * 0.05 - reach * 0.24 + recoil * 0.09) + walkBob;
  const farX = W * (0.53 - reach * 0.02) + walkSway * 0.24;
  const farY = H * (0.8 - reach * 0.35) + walkBob * 0.36;
  drawForwardPole(nearX, nearY, farX, farY, reach * 2.18, false, true);

  if (hitSpark > 0) drawHitSpark();
}

function drawSpecialSword(progress) {
  const palette = swordPalette();
  const charge = progress < 0.18 ? progress / 0.18 : 1;
  const slashT = progress < 0.58 ? Math.max(0, (progress - 0.08) / 0.5) : Math.max(0, 1 - (progress - 0.58) / 0.26);
  const sweep = Math.sin(Math.min(1, slashT) * Math.PI);
  const settle = progress > 0.62 ? Math.min(1, (progress - 0.62) / 0.28) : 0;
  const hiltX = W * (0.84 - sweep * 0.34 + settle * 0.26 + (1 - charge) * 0.05);
  const hiltY = H * (1.13 - sweep * 0.18 + settle * 0.16);
  const tipX = W * (0.72 - sweep * 0.5 + settle * 0.32);
  const tipY = H * (0.76 - sweep * 0.44 + settle * 0.32);

  if (progress > 0.06 && progress < 0.62) {
    ctx.save();
    ctx.globalAlpha = 0.18 + sweep * 0.34;
    ctx.strokeStyle = palette.specialTrail;
    ctx.lineWidth = 28;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(W * 0.88, H * 0.9);
    ctx.quadraticCurveTo(W * 0.56, H * 0.26, W * 0.18, H * 0.52);
    ctx.stroke();
    ctx.globalAlpha *= 0.6;
    ctx.strokeStyle = "#fff8d0";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }
  drawForwardPole(hiltX, hiltY, tipX, tipY, 1.14 + sweep * 0.72, true, false);
}

function drawForwardPole(nearX, nearY, farX, farY, lunge, special = false, showTrail = true) {
  const dx = farX - nearX;
  const dy = farY - nearY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const palette = swordPalette();
  const upgradeScale = Math.min(12, player.weaponLevel) * 1.25;
  const nearW = 38 + upgradeScale + lunge * 13;
  const midW = 32 + upgradeScale * 0.72 + lunge * 6;
  const shoulderW = Math.max(15, 23 + upgradeScale * 0.35 - lunge * 7);
  const tipLen = 10 + upgradeScale * 0.18 + lunge * 8;
  const tipInset = 0.55;
  const hiltX = nearX - dx / len * 46;
  const hiltY = nearY - dy / len * 46;

  ctx.fillStyle = "rgba(8, 5, 4, 0.26)";
  drawPolyRaw([
    [nearX + nx * nearW + 4, nearY + ny * nearW + 4],
    [nearX - nx * nearW + 4, nearY - ny * nearW + 4],
    [farX - nx * shoulderW + 4, farY - ny * shoulderW + 4],
    [farX + nx * shoulderW + 4, farY + ny * shoulderW + 4],
  ]);
  ctx.fillStyle = "#1d1009";
  drawPolyRaw([
    [nearX + nx * (midW + 6), nearY + ny * (midW + 6)],
    [nearX - nx * (midW + 6), nearY - ny * (midW + 6)],
    [farX - nx * (shoulderW + 6), farY - ny * (shoulderW + 6)],
    [farX + dx / len * (tipLen + 4), farY + dy / len * (tipLen + 4)],
    [farX + nx * (shoulderW + 6), farY + ny * (shoulderW + 6)],
  ]);
  paperPoly([
    [nearX + nx * midW, nearY + ny * midW],
    [nearX - nx * midW, nearY - ny * midW],
    [farX - nx * shoulderW, farY - ny * shoulderW],
    [farX + dx / len * (tipLen * tipInset) - nx * shoulderW * 0.32, farY + dy / len * (tipLen * tipInset) - ny * shoulderW * 0.32],
    [farX + dx / len * tipLen, farY + dy / len * tipLen],
    [farX + dx / len * (tipLen * tipInset) + nx * shoulderW * 0.32, farY + dy / len * (tipLen * tipInset) + ny * shoulderW * 0.32],
    [farX + nx * shoulderW, farY + ny * shoulderW],
  ], palette.blade, palette.shadow, 0.14);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(nearX + nx * midW * 0.22, nearY + ny * midW * 0.22);
  ctx.lineTo(farX + dx / len * tipLen * 0.48 + nx * shoulderW * 0.05, farY + dy / len * tipLen * 0.48 + ny * shoulderW * 0.05);
  ctx.stroke();

  paperPoly([
    [nearX + nx * 66 + dx / len * 10, nearY + ny * 66 + dy / len * 10],
    [nearX - nx * 66 + dx / len * 10, nearY - ny * 66 + dy / len * 10],
    [nearX - nx * 54 - dx / len * 16, nearY - ny * 54 - dy / len * 16],
    [nearX + nx * 54 - dx / len * 16, nearY + ny * 54 - dy / len * 16],
  ], palette.guard, "#31200f", 0.2);

  paperPoly([
    [nearX + nx * 22, nearY + ny * 22],
    [nearX - nx * 22, nearY - ny * 22],
    [hiltX - nx * 16, hiltY - ny * 16],
    [hiltX + nx * 16, hiltY + ny * 16],
  ], "#70431f", "#2e190b", 0.16);

  paperPoly([
    [hiltX + nx * 26 - dx / len * 4, hiltY + ny * 26 - dy / len * 4],
    [hiltX - nx * 26 - dx / len * 4, hiltY - ny * 26 - dy / len * 4],
    [hiltX - nx * 20 - dx / len * 28, hiltY - ny * 20 - dy / len * 28],
    [hiltX + nx * 20 - dx / len * 28, hiltY + ny * 20 - dy / len * 28],
  ], "#b8773d", "#3c2111", 0.22);

  if (showTrail && (lunge > 0.42 || special)) {
    ctx.strokeStyle = special ? palette.specialTrail : palette.trail;
    ctx.lineWidth = special ? 8 : 4;
    ctx.beginPath();
    ctx.moveTo(nearX - dx * 0.32, nearY - dy * 0.32);
    ctx.lineTo(farX + dx / len * 28, farY + dy / len * 28);
    ctx.stroke();
  }
}

function swordPalette(level = player.weaponLevel) {
  const stops = [
    { at: 0, blade: "#d8d8d2", highlight: "#ffffff", shadow: "#686860", guard: "#9a8b68", trail: [255, 255, 255] },
    { at: 20, blade: "#c91f1f", highlight: "#ffd0c0", shadow: "#4a1111", guard: "#91302a", trail: [255, 74, 45] },
    { at: 40, blade: "#f1c232", highlight: "#fff0a6", shadow: "#5b4315", guard: "#c18a24", trail: [255, 224, 80] },
    { at: 60, blade: "#50d060", highlight: "#caffcf", shadow: "#17451e", guard: "#348d40", trail: [88, 255, 116] },
    { at: 80, blade: "#43c7ff", highlight: "#e8fbff", shadow: "#12425a", guard: "#2788b0", trail: [75, 205, 255] },
    { at: 100, blade: "#b56cff", highlight: "#f0dcff", shadow: "#3b145f", guard: "#7a40ba", trail: [185, 108, 255] },
    { at: 200, blade: "#080808", highlight: "#3a3a3a", shadow: "#000000", guard: "#171717", trail: [35, 35, 35] },
  ];
  const upper = stops.find((stop) => level <= stop.at) || stops[stops.length - 1];
  const lower = stops[Math.max(0, stops.indexOf(upper) - 1)];
  const t = upper === lower ? 0 : Math.max(0, Math.min(1, (level - lower.at) / (upper.at - lower.at)));
  const trail = [
    Math.round(lerp(lower.trail[0], upper.trail[0], t)),
    Math.round(lerp(lower.trail[1], upper.trail[1], t)),
    Math.round(lerp(lower.trail[2], upper.trail[2], t)),
  ];
  return {
    blade: mixColor(lower.blade, upper.blade, t),
    highlight: mixColor(lower.highlight, upper.highlight, t),
    shadow: mixColor(lower.shadow, upper.shadow, t),
    guard: mixColor(lower.guard, upper.guard, t),
    trail: `rgba(${trail[0]}, ${trail[1]}, ${trail[2]}, 0.42)`,
    specialTrail: `rgba(${trail[0]}, ${trail[1]}, ${trail[2]}, 0.72)`,
  };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(a, b, t) {
  const ac = hexToRgb(a);
  const bc = hexToRgb(b);
  return `rgb(${Math.round(lerp(ac[0], bc[0], t))}, ${Math.round(lerp(ac[1], bc[1], t))}, ${Math.round(lerp(ac[2], bc[2], t))})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function swordName() {
  return `검 +${player.weaponLevel}`;
}

function armorName() {
  return `갑옷 +${player.armorLevel}`;
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

function drawHudLegacyCompact() {
  drawMiniMap();
  drawCrosshair();
  if (berserk) {
    const pulse = 0.45 + Math.sin(performance.now() * 0.012) * 0.16;
    ctx.fillStyle = `rgba(180, 18, 8, ${0.16 + pulse * 0.08})`;
    ctx.fillRect(0, 0, W, H);
    const furyGlow = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.62);
    furyGlow.addColorStop(0, `rgba(255, 88, 36, ${0.08 * pulse})`);
    furyGlow.addColorStop(0.58, `rgba(190, 22, 12, ${0.16 * pulse})`);
    furyGlow.addColorStop(1, `rgba(80, 0, 0, ${0.38 * pulse})`);
    ctx.fillStyle = furyGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255, 118, 42, ${0.55 + pulse * 0.25})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }
  ctx.fillStyle = "rgba(8, 6, 5, 0.58)";
  ctx.fillRect(0, H - 82, W, 82);
  ctx.fillStyle = "rgba(255, 225, 140, 0.1)";
  ctx.fillRect(0, H - 82, W, 2);

  drawText("체력", 24, H - 45, 13, "#fff1bd");
  drawBar(70, H - 58, 150, 16, player.hp / player.maxHp, "#d42f2f", "#3f1212", `${player.hp}/${player.maxHp}`);
  drawText(berserk ? "광폭" : "분노", 24, H - 17, 13, berserk ? "#ffb199" : "#ffe39a");
  drawBar(70, H - 29, 150, 13, player.rage / player.maxRage, berserk ? "#f04a22" : "#d77b23", "#2d1609", `${Math.floor(player.rage)}/${player.maxRage}`);

  drawText(`처치 ${kills}`, 252, H - 28, 15, "#fff1bd");
  drawText(`레벨 ${player.level}`, 410, H - 50, 14, "#ffe39a");
  drawText(`경험치 ${player.xp}/${player.nextXp}`, 410, H - 28, 12, "#d7c27b");
  drawText(isTown() ? "세이프티 존" : "필드", 580, H - 28, 14, isTown() ? "#ffe39a" : "#d7c27b");
  drawText(swordName(), W - 184, H - 28, 14, "#d7c27b");
  if (berserk) drawText("광폭화: 공속/공격력/이속 +50%, 특수공격 무제한", W - 390, H - 52, 13, "#ffb199");
  else if (player.rage >= SPECIAL_RAGE_COST) drawText(`우클릭 특수공격 - 분노 ${SPECIAL_RAGE_COST}`, W - 290, H - 52, 13, "#ffe39a");

  const balrog = balrogEnemy();
  drawText(balrog ? `목표: ${directionTo(balrog.x, balrog.y)}쪽 발록 트라이` : "목표 완료: 발록 처치", 760, H - 28, 13, balrog ? "#ffb199" : "#ffe39a");

  const boss = balrogEnemy() || enemies.find((e) => e.boss && !e.dead);
  if (boss && (Math.hypot(player.x - boss.x, player.y - boss.y) < 8 || boss.hp < boss.maxHp)) {
    drawBar(W - 260, 26, 220, 18, boss.hp / boss.maxHp, "#b91818", "#2a0c0c");
    drawText(enemyLabel(boss), W - 252, 40, 13, "#ffe08a");
  }

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(255, 245, 220, ${player.hurt * 0.13})`;
    ctx.fillRect(0, 0, W, H);
    const hurtVignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.68);
    hurtVignette.addColorStop(0, "rgba(0,0,0,0)");
    hurtVignette.addColorStop(0.7, `rgba(90, 0, 0, ${player.hurt * 0.1})`);
    hurtVignette.addColorStop(1, `rgba(120, 0, 0, ${player.hurt * 0.42})`);
    ctx.fillStyle = hurtVignette;
    ctx.fillRect(0, 0, W, H);
  }

  drawInteractionHud();
  drawDialogue();

  if (noticeTimer > 0) {
    ctx.textAlign = "center";
    drawText(notice, W / 2, 82, 18, "#ffe39a");
    ctx.textAlign = "left";
  }
}

function drawHudLegacyPanel() {
  drawMiniMap();
  drawCrosshair();
  if (berserk) {
    const pulse = 0.5 + Math.sin(performance.now() * 0.0014) * 0.035;
    ctx.fillStyle = `rgba(188, 18, 10, ${0.18 + pulse * 0.035})`;
    ctx.fillRect(0, 0, W, H);
    const furyGlow = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.62);
    furyGlow.addColorStop(0, `rgba(255, 130, 42, ${0.055 + 0.025 * pulse})`);
    furyGlow.addColorStop(0.58, `rgba(190, 38, 18, ${0.15 + 0.04 * pulse})`);
    furyGlow.addColorStop(1, `rgba(90, 8, 5, ${0.34 + 0.05 * pulse})`);
    ctx.fillStyle = furyGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255, 118, 42, ${0.58 + pulse * 0.08})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }

  const hudH = 118;
  const panelY = H - hudH;
  ctx.fillStyle = "rgba(8, 6, 5, 0.78)";
  ctx.fillRect(0, panelY, W, hudH);
  ctx.fillStyle = "rgba(255, 225, 140, 0.14)";
  ctx.fillRect(0, panelY, W, 2);
  ctx.fillStyle = "rgba(255, 245, 190, 0.05)";
  ctx.fillRect(0, panelY + 2, W, 24);

  drawHudPanel(18, panelY + 16, 470, 86);
  drawText("체력", 38, panelY + 44, 15, "#fff1bd");
  drawBar(92, panelY + 27, 360, 22, player.hp / player.maxHp, "#d42f2f", "#3f1212", `${player.hp}/${player.maxHp}`);
  drawText(berserk ? "광폭" : "분노", 38, panelY + 78, 15, berserk ? "#ffb199" : "#ffe39a");
  drawBar(92, panelY + 61, 360, 22, player.rage / player.maxRage, berserk ? "#f04a22" : "#d77b23", "#2d1609", `${Math.floor(player.rage)}/${player.maxRage}`);

  drawHudPanel(508, panelY + 16, 276, 86);
  drawText(`레벨 ${player.level}`, 528, panelY + 42, 15, "#ffe39a");
  drawText(`경험치 ${player.xp}/${player.nextXp}`, 528, panelY + 72, 13, "#d7c27b");
  drawText(`처치 ${kills}`, 650, panelY + 42, 15, "#fff1bd");
  drawText(isTown() ? "세이프티 존" : "필드", 650, panelY + 72, 13, isTown() ? "#ffe39a" : "#d7c27b");

  drawHudPanel(W - 336, panelY + 16, 318, 86);
  drawText(swordName(), W - 316, panelY + 45, 16, "#ffe39a");
  if (berserk) drawText("광폭화: 특수공격 무제한", W - 316, panelY + 74, 13, "#ffb199");
  else if (player.rage >= SPECIAL_RAGE_COST) drawText("우클릭 특수공격", W - 316, panelY + 74, 13, "#ffe39a");
  else drawText(`특수공격 분노 ${SPECIAL_RAGE_COST}`, W - 316, panelY + 74, 13, "#a99363");

  const balrog = balrogEnemy();
  drawText(balrog ? `목표: ${directionTo(balrog.x, balrog.y)}쪽 발록 트라이` : "목표 완료: 발록 처치", 808, panelY + 70, 13, balrog ? "#ffb199" : "#ffe39a");

  const boss = balrogEnemy() || enemies.find((e) => e.boss && !e.dead);
  if (boss && (Math.hypot(player.x - boss.x, player.y - boss.y) < 8 || boss.hp < boss.maxHp)) {
    drawBar(W - 300, 26, 260, 20, boss.hp / boss.maxHp, "#b91818", "#2a0c0c");
    drawText(enemyLabel(boss), W - 292, 42, 13, "#ffe08a");
  }

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(255, 245, 220, ${player.hurt * 0.13})`;
    ctx.fillRect(0, 0, W, H);
    const hurtVignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.68);
    hurtVignette.addColorStop(0, "rgba(0,0,0,0)");
    hurtVignette.addColorStop(0.7, `rgba(90, 0, 0, ${player.hurt * 0.1})`);
    hurtVignette.addColorStop(1, `rgba(120, 0, 0, ${player.hurt * 0.42})`);
    ctx.fillStyle = hurtVignette;
    ctx.fillRect(0, 0, W, H);
  }

  drawInteractionHud();
  drawDialogue();

  if (noticeTimer > 0) {
    ctx.textAlign = "center";
    drawText(notice, W / 2, 82, 18, "#ffe39a");
    ctx.textAlign = "left";
  }
}

function drawHudPanel(x, y, w, h) {
  ctx.fillStyle = "#21150f";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255, 236, 178, 0.11)";
  ctx.fillRect(x + 1, y + 1, w - 2, Math.min(24, h - 2));
  ctx.fillStyle = "rgba(9, 5, 3, 0.62)";
  ctx.fillRect(x + 5, y + h - 7, w - 10, 3);
  ctx.strokeStyle = "#4b2a18";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255, 221, 142, 0.34)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  ctx.fillStyle = "rgba(255, 218, 117, 0.3)";
  ctx.fillRect(x + 10, y + 7, Math.min(46, w - 20), 2);
}

function drawHud() {
  drawMiniMap();
  drawCrosshair();
  if (berserk) {
    const pulse = 0.45 + Math.sin(performance.now() * 0.012) * 0.16;
    ctx.fillStyle = `rgba(188, 18, 10, ${0.16 + pulse * 0.12})`;
    ctx.fillRect(0, 0, W, H);
    const furyGlow = ctx.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, W * 0.62);
    furyGlow.addColorStop(0, `rgba(255, 130, 42, ${0.08 * pulse})`);
    furyGlow.addColorStop(0.58, `rgba(190, 38, 18, ${0.2 * pulse})`);
    furyGlow.addColorStop(1, `rgba(90, 8, 5, ${0.44 * pulse})`);
    ctx.fillStyle = furyGlow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `rgba(255, 118, 42, ${0.55 + pulse * 0.25})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, W - 8, H - 8);
  }

  const hudH = 122;
  const panelY = H - hudH;
  const barW = Math.min(500, Math.max(360, W * 0.3));
  ctx.fillStyle = "rgba(19, 12, 8, 0.94)";
  ctx.fillRect(0, panelY, W, hudH);
  ctx.fillStyle = "#5b341d";
  ctx.fillRect(0, panelY, W, 3);
  ctx.fillStyle = "rgba(255, 222, 144, 0.16)";
  ctx.fillRect(0, panelY + 3, W, 2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.fillRect(0, panelY - 6, W, 6);

  drawHudPanel(18, panelY + 14, barW + 116, 92);
  drawText("HP", 40, panelY + 45, 15, "#f4dfbd");
  drawBar(88, panelY + 27, barW, 22, player.hp / player.maxHp, "#c73b35", "#250b0b", `${player.hp}/${player.maxHp}`);
  drawText(berserk ? "FURY" : "RAGE", 40, panelY + 79, 13, berserk ? "#ffb199" : "#f3c46e");
  drawBar(88, panelY + 61, barW, 20, player.rage / player.maxRage, berserk ? "#ee5225" : "#cd7825", "#241006", `${Math.floor(player.rage)}/${player.maxRage}`);

  const statX = 150 + barW;
  drawHudPanel(statX, panelY + 14, 268, 92);
  drawText(`LV ${player.level}`, statX + 18, panelY + 43, 17, "#f3c46e");
  drawText(`KILL ${kills}`, statX + 144, panelY + 43, 14, "#f4dfbd");
  drawText("XP", statX + 18, panelY + 78, 12, "#8feaff");
  drawBar(statX + 50, panelY + 63, 192, 16, player.xp / player.nextXp, "#5ea9d3", "#09141a", `${compactNumber(player.xp)}/${compactNumber(player.nextXp)}`);

  const weaponX = Math.max(statX + 290, W - 336);
  drawHudPanel(weaponX, panelY + 14, 318, 92);
  drawText(swordName(), weaponX + 18, panelY + 43, 16, "#f3c46e");
  drawText(armorName(), weaponX + 174, panelY + 43, 16, "#8feaff");
  if (berserk) drawText("광폭화: 특수공격 무제한", weaponX + 18, panelY + 78, 12, "#ffb199");
  else if (player.rage >= SPECIAL_RAGE_COST) drawText("우클릭 특수공격 준비", weaponX + 18, panelY + 78, 12, "#f3c46e");
  else drawText(`특수공격 분노 ${SPECIAL_RAGE_COST}`, weaponX + 18, panelY + 78, 12, "#9f8a60");

  const balrogGoal = balrogEnemy();
  drawHudPanel(W - 248, 138, 210, 68);
  drawText(zoneAt().name, W - 228, 164, 14, isTown() ? "#f3c46e" : "#cdb681");
  drawText(balrogGoal ? `목표: ${directionTo(balrogGoal.x, balrogGoal.y)}쪽 발록` : "목표: 발록 재등장 대기", W - 228, 188, 12, balrogGoal ? "#ffb199" : "#8feaff");

  const boss = balrogEnemy() || enemies.find((e) => e.boss && !e.dead);
  if (boss && (Math.hypot(player.x - boss.x, player.y - boss.y) < 8 || boss.hp < boss.maxHp)) {
    drawBar(W - 320, 26, 280, 20, boss.hp / boss.maxHp, "#a91f1d", "#220909");
    drawText(enemyLabel(boss), W - 312, 42, 13, "#f3c46e");
  }
  drawHudPanel(W - 248, 58, 210, 72);
  const balrogRespawn = balrogRespawnSeconds();
  drawText(`성채 ${roomState.dungeonTier}단계`, W - 228, 84, 15, "#f3c46e");
  drawText(
    balrogEnemy() ? "발록 활성" : `발록 ${formatClock(balrogRespawn)}`,
    W - 228,
    106,
    13,
    balrogEnemy() ? "#ff8b74" : "#8feaff",
  );
  drawText(`처치 ${roomState.balrogDefeatedCount}회`, W - 118, 106, 13, "#cdb681");
  drawParticipantRoster(W - 248, 216, 210);

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(255, 245, 220, ${player.hurt * 0.13})`;
    ctx.fillRect(0, 0, W, H);
    const hurtVignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.2, W / 2, H / 2, W * 0.68);
    hurtVignette.addColorStop(0, "rgba(0,0,0,0)");
    hurtVignette.addColorStop(0.7, `rgba(90, 0, 0, ${player.hurt * 0.1})`);
    hurtVignette.addColorStop(1, `rgba(120, 0, 0, ${player.hurt * 0.42})`);
    ctx.fillStyle = hurtVignette;
    ctx.fillRect(0, 0, W, H);
  }
  drawHitDirection();

  drawInteractionHud();
  drawDialogue();

  if (noticeTimer > 0) {
    ctx.textAlign = "center";
    drawText(notice, W / 2, 118, 22, "#f3c46e");
    ctx.textAlign = "left";
  }
}

function compactNumber(value) {
  const number = Math.floor(Number(value) || 0);
  if (number >= 1000000000) return `${(number / 1000000000).toFixed(1)}B`;
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
  if (number >= 10000) return `${Math.floor(number / 1000)}K`;
  return `${number}`;
}

function drawParticipantRoster(x, y, w) {
  const members = [
    {
      displayName: displayCharacterName(characterName) || "나",
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      self: true,
    },
    ...remotePlayers.values(),
  ];
  const shown = members.slice(0, 10);
  const rowH = 25;
  const h = 42 + shown.length * rowH + (members.length > shown.length ? 18 : 0);
  drawHudPanel(x, y, w, h);
  drawText(`참가자 ${Math.max(serverPlayerCount, members.length)}명`, x + 16, y + 24, 14, "#8feaff");
  shown.forEach((member, index) => {
    const rowY = y + 38 + index * rowH;
    const name = trimRosterName(member.displayName || member.name || "전사");
    const hpPct = Math.max(0, Math.min(1, (member.hp || 0) / Math.max(1, member.maxHp || 1)));
    drawText(`${member.self ? "나 " : ""}Lv.${member.level || 1} ${name}`, x + 14, rowY + 10, 11, member.self ? "#f3c46e" : "#f4dfbd");
    drawRosterHpBar(x + 14, rowY + 16, w - 28, hpPct, member.self ? "#d53b35" : "#65b987");
  });
  if (members.length > shown.length) {
    drawText(`+${members.length - shown.length}명 더 참가 중`, x + 14, y + h - 11, 11, "#cdb681");
  }
}

function drawRosterHpBar(x, y, w, pct, fill) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
  ctx.fillRect(x, y, w, 8);
  ctx.fillStyle = "#24130d";
  ctx.fillRect(x + 1, y + 1, w - 2, 6);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * pct), 4);
  ctx.strokeStyle = "rgba(238, 198, 118, 0.45)";
  ctx.strokeRect(x, y, w, 8);
}

function displayCharacterName(name) {
  return `${name || ""}`.replace(/_test$/i, "");
}

function trimRosterName(name) {
  const text = `${name || ""}`;
  return text.length > 10 ? `${text.slice(0, 9)}.` : text;
}

function drawHitDirection() {
  if (hurtDirectionTimer <= 0) return;
  const a = Math.max(0, hurtDirectionTimer / 0.62);
  const cx = W / 2;
  const cy = H / 2;
  const front = Math.cos(hurtDirection);
  const side = Math.sin(hurtDirection);
  const vx = side;
  const vy = -front;
  const pad = 54;
  const sx = (cx - pad) / Math.max(0.001, Math.abs(vx));
  const sy = (cy - pad) / Math.max(0.001, Math.abs(vy));
  const edge = Math.min(sx, sy);
  const x = cx + vx * edge;
  const y = cy + vy * edge;
  ctx.save();
  ctx.globalAlpha = a * 0.72;
  ctx.translate(x, y);
  ctx.rotate(hurtDirection);
  ctx.fillStyle = "#ff4f4f";
  tri(-18, -13, 18, -13, 0, 16, "#ff4f4f");
  ctx.restore();
}

function drawInteractionHud() {
  const nearby = nearestTownNpc();
  if (!nearby || dialogueTimer > 0) return;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(10, 7, 4, 0.72)";
  const y = H - 168;
  ctx.fillRect(W / 2 - 140, y, 280, 30);
  ctx.strokeStyle = "#d8bd76";
  ctx.strokeRect(W / 2 - 140, y, 280, 30);
  drawText("E 대화하기", W / 2, y + 20, 14, "#ffe39a");
  ctx.textAlign = "left";
}

function drawDialogue() {
  if (dialogueTimer <= 0) return;
  const h = 82;
  const hudTop = H - 126;
  const w = Math.min(780, Math.max(420, W - 96));
  const x = Math.round((W - w) / 2);
  const y = Math.max(96, hudTop - h - 22);
  ctx.fillStyle = "rgba(8, 6, 5, 0.86)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#d8bd76";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 1;
  drawText(dialogueSpeaker, x + 18, y + 26, 15, "#ffe39a");
  drawText(dialogueText, x + 18, y + 58, 17, "#fff1bd");
}

function drawMiniMap() {
  const cell = 5;
  const x0 = 18;
  const y0 = 18;
  const pad = 5;
  const mw = map[0].length * cell;
  const mh = map.length * cell;
  const pulse = Math.sin(performance.now() * 0.008) > 0;
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

  const balrog = balrogEnemy();
  if (balrog) {
    ctx.fillStyle = pulse ? "rgba(255, 60, 28, 0.45)" : "rgba(120, 12, 8, 0.45)";
    ctx.fillRect(x0 + balrog.x * cell - 7, y0 + balrog.y * cell - 7, 14, 14);
    ctx.strokeStyle = "#ffb199";
    ctx.strokeRect(x0 + balrog.x * cell - 7, y0 + balrog.y * cell - 7, 14, 14);
  }

  for (const prop of WORLD_PROPS) {
    ctx.fillStyle = "#c89b58";
    ctx.fillRect(x0 + prop.x * cell - 1, y0 + prop.y * cell - 1, 2, 2);
  }

  for (const npc of TOWN_NPCS) {
    ctx.fillStyle = "#7fc9df";
    ctx.fillRect(x0 + npc.x * cell - 2, y0 + npc.y * cell - 2, 4, 4);
  }

  for (const p of projectiles) {
    ctx.fillStyle = p.type === "fire" ? "#ff5a22" : "#b75cff";
    ctx.fillRect(x0 + p.x * cell - 1, y0 + p.y * cell - 1, 2, 2);
  }

  for (const e of enemies) {
    if (e.dead) continue;
    ctx.fillStyle = miniMapEnemyColor(e);
    const size = e.type === "balrog" ? 7 : e.boss ? 5 : 3;
    const mx = x0 + e.x * cell - Math.floor(size / 2);
    const my = y0 + e.y * cell - Math.floor(size / 2);
    ctx.fillRect(mx, my, size, size);
    if (e.boss) {
      ctx.strokeStyle = e.type === "balrog" ? "#fff0a0" : "#ffd06a";
      ctx.strokeRect(mx - 1, my - 1, size + 2, size + 2);
    }
  }

  for (const remote of remotePlayers.values()) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(x0 + remote.x * cell - 3, y0 + remote.y * cell - 3, 6, 6);
    ctx.fillStyle = "#64d6ff";
    ctx.fillRect(x0 + remote.x * cell - 2, y0 + remote.y * cell - 2, 5, 5);
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
  ctx.beginPath();
  ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 4.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff3b0";
  ctx.beginPath();
  ctx.arc(x0 + player.x * cell, y0 + player.y * cell, 3.1, 0, Math.PI * 2);
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
  const normalTarget = getAttackHits(2.15, 0.38)[0];
  const specialTarget = normalTarget || getAttackHits(3.05, 0.62)[0];
  const strong = Boolean(normalTarget);
  const warm = Boolean(specialTarget);
  const size = strong ? 22 : warm ? 18 : 13;
  const gap = strong ? 7 : warm ? 8 : 10;
  ctx.strokeStyle = strong
    ? "rgba(51, 220, 255, 0.98)"
    : warm
      ? "rgba(255, 82, 98, 0.72)"
      : "rgba(110, 205, 255, 0.2)";
  ctx.lineWidth = strong ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(cx - size, cy);
  ctx.lineTo(cx - gap, cy);
  ctx.moveTo(cx + gap, cy);
  ctx.lineTo(cx + size, cy);
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx, cy - gap);
  ctx.moveTo(cx, cy + gap);
  ctx.lineTo(cx, cy + size);
  ctx.stroke();
  if (strong) {
    ctx.fillStyle = "rgba(75, 235, 255, 0.96)";
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
  }
}

function drawBar(x, y, w, h, pct, fill, bg, label = "") {
  ctx.fillStyle = "#120905";
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.fillStyle = "#4b2a18";
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * Math.max(0, Math.min(1, pct))), h - 6);
  ctx.fillStyle = "rgba(255, 238, 177, 0.22)";
  ctx.fillRect(x + 3, y + 3, Math.max(0, (w - 6) * Math.max(0, Math.min(1, pct))), Math.max(2, Math.floor((h - 6) / 3)));
  ctx.strokeStyle = "rgba(255, 222, 143, 0.7)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 1;
  if (label) {
    ctx.textAlign = "center";
    drawText(label, x + w / 2, y + h - 5, Math.max(11, Math.min(13, h - 2)), "#f6e7c2");
    ctx.textAlign = "left";
  }
}

function drawText(text, x, y, size, color) {
  ctx.font = `700 ${size}px Trebuchet MS, Noto Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif`;
  ctx.lineWidth = Math.max(2, Math.floor(size / 6));
  ctx.strokeStyle = "rgba(18, 9, 4, 0.82)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(4, 3, 2, 0.72)";
  ctx.fillRect(0, 0, W, H);
  if (gameState === "start" && nameScreen && !nameScreen.classList.contains("is-hidden")) return;
  ctx.textAlign = "center";
  ctx.fillStyle = gameState === "over" ? "#b52626" : "#e6c766";
  ctx.font = gameState === "start" ? "600 48px Noto Sans KR, Malgun Gothic, sans-serif" : "600 54px Noto Sans KR, Malgun Gothic, sans-serif";
  let title = "게임 오버";
  if (gameState === "start") title = "Paper Citadel";
  if (gameState === "clear") title = "종이성채 정복";
  if (gameState === "dead") title = "죽었습니다";
  ctx.fillText(title, W / 2, H / 2 - 72);
  ctx.fillStyle = "#d9c99a";
  ctx.font = "500 20px Noto Sans KR, Malgun Gothic, sans-serif";
  if (gameState === "start") {
    ctx.fillText("좌클릭 공격 / 스페이스 점프", W / 2, H / 2 - 18);
    ctx.fillText(`분노 최대치: 자동 광폭화`, W / 2, H / 2 + 14);
    ctx.fillText("종이성채에서 성장하고 발록을 반복 트라이하세요", W / 2, H / 2 + 48);
    ctx.fillText("Enter 또는 클릭으로 시작", W / 2, H / 2 + 84);
  } else if (gameState === "dead") {
    ctx.fillText(`${Math.ceil(deathTimer)}초 후 세이프티 존에서 부활합니다`, W / 2, H / 2 + 12);
    ctx.fillText("레벨과 검 강화는 유지됩니다. 다시 달려가세요", W / 2, H / 2 + 48);
  } else {
    ctx.fillText("Enter로 다시 시작", W / 2, H / 2 + 12);
  }
  ctx.textAlign = "left";
}

function startGame() {
  gameState = "play";
  messagePulse = 0;
  notice = "세이프티 존";
  noticeTimer = 1.8;
  if (nameScreen) nameScreen.classList.add("is-hidden");
}

function resetGame() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch (_) {}
  roomState.dungeonTier = 1;
  roomState.balrogDefeatedCount = 0;
  player.x = 4.5;
  player.y = 4.5;
  player.angle = 0;
  player.hp = 100;
  player.hurt = 0;
  player.rage = 0;
  player.maxHp = 100;
  player.maxRage = 100;
  player.level = 1;
  player.xp = 0;
  player.nextXp = 60;
  player.attackPower = 5;
  player.weaponLevel = 0;
  player.armorLevel = 0;
  player.weaponScrolls = 0;
  player.armorScrolls = 0;
  berserk = false;
  deathTimer = 0;
  kills = 0;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  damagePops = [];
  deathParticles = [];
  deathBursts = [];
  projectiles = [];
  hitSpark = 0;
  screenShake = 0;
  jumpLift = 0;
  jumpVelocity = 0;
  dialogueText = "";
  dialogueSpeaker = "";
  dialogueTimer = 0;
  gameState = "start";
  if (nameScreen) nameScreen.classList.remove("is-hidden");
  if (multiplayerSocket) multiplayerSocket.disconnect();
  multiplayerSocket = null;
  multiplayerRoomId = "";
  remotePlayers.clear();
  started = false;
  items = [];
  map = buildMap();
  enemies = buildEnemies();
  notice = "Paper Citadel";
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
    if (document.activeElement !== nameInput) {
      event.preventDefault();
      nameInput?.focus();
    }
    return;
  }
  if (event.code === "KeyE" && gameState === "play") {
    event.preventDefault();
    interact();
    return;
  }
  if (gameState === "play" && isTestCharacter() && (event.code === "Digit1" || event.code === "Numpad1")) {
    event.preventDefault();
    applyTestBoost();
    return;
  }
  if (gameState === "play" && isTestCharacter() && (event.code === "Digit2" || event.code === "Numpad2")) {
    event.preventDefault();
    resetTestDungeonTier();
    return;
  }
  if (gameState === "play" && isTestCharacter() && (event.code === "Digit3" || event.code === "Numpad3")) {
    event.preventDefault();
    resetTestCharacters();
    return;
  }
  keys.add(event.code);
  if (gameState === "play" && ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    started = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) startJump();
  }
  if (event.code === "Enter" && gameState !== "play" && gameState !== "dead") resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (gameState === "start") {
    nameInput?.focus();
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
    nameInput?.focus();
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

if (nameScreen) {
  try {
    nameInput.value = localStorage.getItem(LAST_NAME_KEY) || "";
  } catch (_) {}
  nameScreen.addEventListener("submit", (event) => {
    event.preventDefault();
    beginNamedRun(nameInput.value);
  });
  nameInput?.focus();
}

requestAnimationFrame(frame);
