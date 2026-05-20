const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const W = canvas.width;
const H = canvas.height;
const HALF_H = H / 2;
const FOV = Math.PI / 3;
const RAYS = 240;
const MAX_DEPTH = 18;
const TILE = 64;
const TURN_SPEED = 1.95;
const MOVE_SPEED = 2.1;
const SPECIAL_RAGE_COST = 40;
const BERSERK_DRAIN_PER_SECOND = 7.5;
const DEATH_RESPAWN_SECONDS = 5;

const BASE_MAP = [
  "################################################",
  "#.......#.....#.............#.......#.....#....#",
  "#...........#.#.###########.#.###.#.#.###.#.#..#",
  "#...........#.....#.#.......#.#.......#...#.#..#",
  "#..........##...#.#.#...#######.#...###...#.#..#",
  "#.......#.....#...#...#.........#.....#.#...#..#",
  "#..###..#.#####.###.###.###########.###.#.###..#",
  "#......##...#.......#...#...........#...#.#....#",
  "#.####.####.#.#...#####.#.#...#.###.#...###.#..#",
  "#....#..#.#.#.#.......#...#.#...#.....#.....#..#",
  "###..##.#.#.#.#.###.#.#####.#.#.#####.#.#####..#",
  "#....#..#.#...#.#...#.......#.#.#.....#.#...#..#",
  "#.##.####.#...#.###.###...###.###.#...#.#...#..#",
  "#.......#.#...#...#.#...#...#.....#.#.#.#...#..#",
  "#.#####.#.#######.#.#.#.###.#.#####.#.#.###.#..#",
  "#.......#.......#.....#...#.#.......#.......#..#",
  "#.....#..##.###.#...#####.#.#...###.###...###..#",
  "#.###.#.....#...#.#.#.....#...#...#.......#....#",
  "#...#.#...#####.#.#.#.#####.#####.#########.##.#",
  "###.#.#.......#.#.#.#.....#.....#.....#.....#..#",
  "#...#.#...#...#.#.#####...#####.#...#.#.#...#..#",
  "#.###.#...#...#.....#.....#...#.....#...#......#",
  "#.....#...#.#######.#.#####.#.#####...#####....#",
  "#######...#...........#.....#................B.#",
  "#.........#.....#.....#.....#.....#.....#......#",
  "################################################",
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
  level: 1,
  xp: 0,
  nextXp: 60,
  weaponLevel: 0,
};

let stage = 1;
let map = buildMap(stage);
let enemies = [];
let items = [];
let projectiles = [];

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
let notice = "던전 필드";
let noticeTimer = 0;
let dialogueText = "";
let dialogueSpeaker = "";
let dialogueTimer = 0;
let berserk = false;
let deathTimer = 0;

const SPAWN_POINTS = [
  { type: "skeleton", x: 13.5, y: 1.5 },
  { type: "skeleton", x: 19.5, y: 1.5 },
  { type: "orc", x: 25.5, y: 1.5 },
  { type: "skeleton", x: 35.5, y: 1.5 },
  { type: "orc", x: 43.5, y: 1.5 },
  { type: "orc", x: 15.5, y: 3.5 },
  { type: "warlock", x: 23.5, y: 3.5 },
  { type: "skeleton", x: 33.5, y: 3.5 },
  { type: "orc", x: 39.5, y: 3.5 },
  { type: "skeleton", x: 13.5, y: 5.5 },
  { type: "orc", x: 21.5, y: 5.5 },
  { type: "warlock", x: 31.5, y: 5.5 },
  { type: "ogre", x: 39.5, y: 5.5 },
  { type: "skeleton", x: 11.5, y: 7.5 },
  { type: "orc", x: 19.5, y: 7.5 },
  { type: "skeleton", x: 25.5, y: 7.5 },
  { type: "warlock", x: 35.5, y: 7.5 },
  { type: "orc", x: 43.5, y: 7.5 },
  { type: "skeleton", x: 15.5, y: 9.5 },
  { type: "ogre", x: 23.5, y: 9.5 },
  { type: "orc", x: 35.5, y: 9.5 },
  { type: "warlock", x: 41.5, y: 9.5 },
  { type: "deathKnight", x: 17.5, y: 11.5 },
  { type: "skeleton", x: 25.5, y: 11.5 },
  { type: "orc", x: 35.5, y: 11.5 },
  { type: "skeleton", x: 43.5, y: 11.5 },
  { type: "orc", x: 15.5, y: 13.5 },
  { type: "warlock", x: 21.5, y: 13.5 },
  { type: "ogre", x: 29.5, y: 13.5 },
  { type: "skeletonKing", x: 37.5, y: 13.5 },
  { type: "skeleton", x: 11.5, y: 15.5 },
  { type: "orc", x: 19.5, y: 15.5 },
  { type: "warlock", x: 29.5, y: 15.5 },
  { type: "ogreLord", x: 39.5, y: 15.5 },
  { type: "orc", x: 13.5, y: 17.5 },
  { type: "skeleton", x: 21.5, y: 17.5 },
  { type: "ogre", x: 35.5, y: 17.5 },
  { type: "warlock", x: 43.5, y: 17.5 },
  { type: "skeleton", x: 13.5, y: 19.5 },
  { type: "orc", x: 25.5, y: 19.5 },
  { type: "warlockLord", x: 35.5, y: 19.5 },
  { type: "ogre", x: 41.5, y: 19.5 },
  { type: "skeleton", x: 15.5, y: 21.5 },
  { type: "orc", x: 23.5, y: 21.5 },
  { type: "skeletonKing", x: 33.5, y: 21.5 },
  { type: "boss", x: 43.5, y: 21.5 },
  { type: "orc", x: 46.4, y: 2.5 },
  { type: "skeleton", x: 46.4, y: 5.5 },
  { type: "warlock", x: 46.4, y: 9.5 },
  { type: "orc", x: 46.4, y: 13.5 },
  { type: "ogre", x: 46.4, y: 17.5 },
  { type: "skeleton", x: 46.4, y: 21.5 },
  { type: "orc", x: 5.5, y: 24.5 },
  { type: "skeleton", x: 15.5, y: 24.5 },
  { type: "warlock", x: 25.5, y: 24.5 },
  { type: "ogre", x: 35.5, y: 24.5 },
  { type: "orc", x: 43.5, y: 24.5 },
  { type: "balrog", x: 45.5, y: 23.5 },
];

const TOWN_NPCS = [
  {
    name: "마을 장로",
    x: 2.2,
    y: 2.25,
    hp: 30,
    maxHp: 30,
    line: "안녕하세요. 밖은 위험하니 검을 잃으면 꼭 다시 찾아오세요.",
  },
];

const TOWN_PROPS = [
  { type: "lantern", x: 4.1, y: 3.15 },
  { type: "sign", x: 5.9, y: 3.05 },
  { type: "crate", x: 3.35, y: 4.85 },
  { type: "well", x: 5.05, y: 2.65 },
];

enemies = buildEnemies(stage);

function enemy(type, x, y) {
  const stageBonus = Math.max(stage - 1, Math.floor((player.level - 1) / 2));
  const stats = enemyStats(type, stageBonus);
  const level = enemyLevel(type, stageBonus);
  const levelBonus = Math.max(0, level - 1);
  const hpScale = type === "balrog" ? 4.4 : stats.boss ? 1.2 : 0.65;
  const hp = Math.max(1, stats.hp + Math.floor(levelBonus * hpScale));
  return {
    type,
    level,
    x,
    y,
    spawnX: x,
    spawnY: y,
    hp,
    maxHp: hp,
    radius: stats.radius,
    speed: stats.speed,
    damage: stats.damage + Math.floor(levelBonus * (type === "balrog" ? 1.45 : 0.7)),
    xp: stats.xp + levelBonus * 4,
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
    dead: false,
    respawnTimer: 0,
    respawns: 0,
  };
}

function enemyLevel(type, stageBonus) {
  const base = {
    skeleton: 1,
    orc: 2,
    warlock: 4,
    ogre: 5,
    skeletonKing: 9,
    boss: 10,
    deathKnight: 12,
    ogreLord: 14,
    warlockLord: 15,
    balrog: 35,
  }[type] || 2;
  const variance = type === "balrog" ? 7 : isMidBossType(type) ? 6 : (type === "skeletonKing" || type === "boss") ? 5 : 4;
  return base + stageBonus + Math.floor(Math.random() * variance);
}

function enemyStats(type, stageBonus) {
  const stats = {
    skeleton: { hp: 1 + Math.floor(stageBonus * 0.7), speed: 1.02 + stageBonus * 0.06, damage: 7 + stageBonus, radius: 0.27, xp: 12 + stageBonus * 3, attackRange: 1.15, windup: 0.28, cooldown: 0.72 },
    orc: { hp: 2 + stageBonus, speed: 0.78 + stageBonus * 0.055, damage: 10 + stageBonus * 2, radius: 0.32, xp: 18 + stageBonus * 4, attackRange: 1.28, windup: 0.36, cooldown: 0.95 },
    ogre: { hp: 7 + stageBonus * 2, speed: 0.46 + stageBonus * 0.03, damage: 22 + stageBonus * 3, radius: 0.48, xp: 42 + stageBonus * 7, attackRange: 1.6, windup: 0.62, cooldown: 1.35 },
    warlock: { hp: 3 + stageBonus, speed: 0.54 + stageBonus * 0.035, damage: 12 + stageBonus * 2, radius: 0.3, xp: 34 + stageBonus * 6, attackRange: 4.75, windup: 0.55, cooldown: 1.45, projectile: true },
    skeletonKing: { hp: 12 + stageBonus * 4, speed: 0.56 + stageBonus * 0.035, damage: 18 + stageBonus * 3, radius: 0.42, xp: 90 + stageBonus * 12, attackRange: 1.58, windup: 0.5, cooldown: 1.1, boss: true },
    boss: { hp: 8 + stageBonus * 4, speed: 0.62 + stageBonus * 0.045, damage: 18 + stageBonus * 4, radius: 0.42, xp: 80 + stageBonus * 12, attackRange: 1.5, windup: 0.48, cooldown: 1.15, boss: true },
    deathKnight: { hp: 24 + stageBonus * 4, speed: 0.68 + stageBonus * 0.035, damage: 24 + stageBonus * 3, radius: 0.43, xp: 130 + stageBonus * 16, attackRange: 1.65, windup: 0.48, cooldown: 1.02, boss: true },
    ogreLord: { hp: 42 + stageBonus * 6, speed: 0.42 + stageBonus * 0.025, damage: 34 + stageBonus * 4, radius: 0.58, xp: 190 + stageBonus * 20, attackRange: 1.85, windup: 0.66, cooldown: 1.28, boss: true },
    warlockLord: { hp: 28 + stageBonus * 4, speed: 0.48 + stageBonus * 0.03, damage: 24 + stageBonus * 3, radius: 0.36, xp: 170 + stageBonus * 18, attackRange: 5.35, windup: 0.62, cooldown: 1.18, projectile: true, boss: true },
    balrog: { hp: 170 + stageBonus * 12, speed: 0.5 + stageBonus * 0.025, damage: 55 + stageBonus * 6, radius: 0.72, xp: 900 + stageBonus * 50, attackRange: 2.75, windup: 0.68, cooldown: 1.18, boss: true },
  };
  return stats[type] || stats.orc;
}

function isMidBossType(type) {
  return type === "deathKnight" || type === "ogreLord" || type === "warlockLord";
}

function buildEnemies(nextStage) {
  const previousStage = stage;
  stage = nextStage;
  const built = SPAWN_POINTS.map(({ type, x, y }) => enemy(type, x, y));
  stage = previousStage;
  return built;
}

function spawnItem(type, x, y, value = 0) {
  items.push({
    type,
    x,
    y,
    value,
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
  if (!berserk && player.rage >= player.maxRage) {
    berserk = true;
    notice = "광폭화";
    noticeTimer = 1.8;
    screenShake = Math.max(screenShake, 0.8);
  }
}

function gainXp(amount) {
  player.xp += amount;
  while (player.xp >= player.nextXp) {
    player.xp -= player.nextXp;
    player.level += 1;
    player.nextXp = Math.floor(player.nextXp * 1.34 + 18);
    player.maxHp += 12;
    player.hp = player.maxHp;
    player.maxRage = Math.min(160, player.maxRage + 8);
    notice = `레벨 ${player.level}`;
    noticeTimer = 2.2;
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
  const respawns = (e.respawns || 0) + 1;
  const revived = enemy(e.type, e.spawnX, e.spawnY);
  if (revived.boss) {
    const extraLevel = respawns * (revived.type === "balrog" ? 7 : 3);
    const hpBoost = extraLevel * (revived.type === "balrog" ? 13 : 5);
    revived.level += extraLevel;
    revived.maxHp += hpBoost;
    revived.hp = revived.maxHp;
    revived.damage += extraLevel * (revived.type === "balrog" ? 2 : 1);
    revived.xp += extraLevel * 10;
  }
  revived.respawns = respawns;
  Object.assign(e, revived);
  if (e.boss) {
    notice = `${enemyLabel(e)} 더 강하게 부활`;
    noticeTimer = 2.2;
  }
}

function respawnDelay(e) {
  if (e.type === "balrog") return 180;
  if (e.boss) return 42;
  if (e.type === "ogre") return 24;
  if (e.type === "warlock") return 20;
  return 12;
}

function startPlayerDeath() {
  if (gameState === "dead") return;
  if (player.weaponLevel > 0) {
    spawnItem("weapon", player.x, player.y, player.weaponLevel);
  }
  gameState = "dead";
  deathTimer = DEATH_RESPAWN_SECONDS;
  player.hp = 0;
  player.hurt = 1;
  berserk = false;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  projectiles = [];
  damagePops = [];
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
  player.weaponLevel = 0;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  projectiles = [];
  damagePops = [];
  started = false;
  dialogueText = "";
  dialogueSpeaker = "";
  dialogueTimer = 0;
  berserk = false;
  deathTimer = 0;
  gameState = "play";
  notice = "마을에서 부활 - 검을 되찾으세요";
  noticeTimer = 3.2;
}

function dropLoot(target) {
  if (target.type === "balrog") {
    spawnItem("legendScroll", target.x, target.y);
    spawnItem("scroll", target.x + 0.35, target.y);
    spawnItem("health", target.x - 0.35, target.y);
    spawnItem("rage", target.x, target.y + 0.35);
    spawnItem("xp", target.x, target.y - 0.35);
    return;
  }
  if (target.boss) {
    spawnItem("scroll", target.x, target.y);
    if (Math.random() < 0.75) spawnItem("health", target.x + 0.25, target.y);
    return;
  }

  const roll = Math.random();
  if (target.type === "ogre" || target.type === "warlock") {
    if (roll < 0.12) spawnItem("scroll", target.x, target.y);
    else if (roll < 0.34) spawnItem("rage", target.x, target.y);
    else if (roll < 0.54) spawnItem("xp", target.x, target.y);
    else if (roll < 0.7) spawnItem("health", target.x, target.y);
    return;
  }

  if (roll < 0.05) spawnItem("scroll", target.x, target.y);
  else if (roll < 0.23) spawnItem("rage", target.x, target.y);
  else if (roll < 0.4) spawnItem("xp", target.x, target.y);
  else if (roll < 0.58) spawnItem("health", target.x, target.y);
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
  if (item.type === "legendScroll") return "#ff4a24";
  if (item.type === "weapon") return "#fff1bd";
  return "#e3c75b";
}

function lostWeapon() {
  return items.find((item) => item.type === "weapon");
}

function balrogEnemy() {
  return enemies.find((e) => e.type === "balrog" && !e.dead);
}

function directionTo(x, y) {
  const dx = x - player.x;
  const dy = y - player.y;
  const ew = dx > 1.2 ? "동" : dx < -1.2 ? "서" : "";
  const ns = dy > 1.2 ? "남" : dy < -1.2 ? "북" : "";
  return ns + ew || "근처";
}

function buildMap() {
  return BASE_MAP.slice();
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
  return x < 8 && y < 6;
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
    notice = isTown() ? "대화할 사람이 가까이 없습니다" : "마을 사람은 마을에 있습니다";
    noticeTimer = 1.6;
    return;
  }
  dialogueSpeaker = nearby.npc.name;
  dialogueText = nearby.npc.line;
  dialogueTimer = 4.2;
  noticeTimer = 0;
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

  const moveStep = MOVE_SPEED * (berserk ? 1.5 : 1) * dt;
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
  if (swing === 0) swingType = "normal";
  swingCooldown = Math.max(0, swingCooldown - dt);
  player.hurt = Math.max(0, player.hurt - dt * 3);
  hitSpark = Math.max(0, hitSpark - dt * 5);
  screenShake = Math.max(0, screenShake - dt * 5);
  noticeTimer = Math.max(0, noticeTimer - dt);
  dialogueTimer = Math.max(0, dialogueTimer - dt);
  for (const item of items) {
    item.bob += dt * 4;
  }
  for (let i = damagePops.length - 1; i >= 0; i -= 1) {
    damagePops[i].life -= dt;
    damagePops[i].rise += dt * 0.28;
    if (damagePops[i].life <= 0) damagePops.splice(i, 1);
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
      player.hp = Math.max(0, player.hp - p.damage);
      player.hurt = 1;
      addRage(6);
      screenShake = Math.max(screenShake, p.type === "fire" ? 1.2 : 0.6);
      projectiles.splice(i, 1);
      if (player.hp <= 0) startPlayerDeath();
    }
  }

  for (const e of enemies) {
    if (e.dead) {
      e.respawnTimer = Math.max(0, e.respawnTimer - dt);
      if (e.respawnTimer === 0 && Math.hypot(player.x - e.spawnX, player.y - e.spawnY) > 6) {
        reviveEnemy(e);
      }
      continue;
    }
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
    if (!started || isTown()) continue;
    if (e.stun > 0) continue;

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const attackRange = meleeReach(e);
    if (e.attackWindup > 0) {
      e.attackWindup = Math.max(0, e.attackWindup - dt);
      e.step += dt * (e.boss ? 3.2 : 4.4);
      e.attackPose = Math.max(e.attackPose, 0.45);
      if (e.attackWindup === 0) {
        if (e.type === "balrog") {
          if (dist <= attackRange + 0.6) {
            balrogSlam(e, dist);
          } else if (dist <= 5.2 && hasLineOfSight(e)) {
            spawnProjectile(e, dx / dist, dy / dist);
            e.attackPose = 1;
          }
        } else if (e.projectile && dist <= attackRange + 0.6 && hasLineOfSight(e)) {
          spawnProjectile(e, dx / dist, dy / dist);
          e.attackPose = 1;
        } else if (!e.projectile && dist <= attackRange + 0.18) {
          player.hp = Math.max(0, player.hp - e.damage);
          player.hurt = 1;
          addRage(e.boss ? 12 : 7);
          e.attackPose = 1;
          screenShake = Math.max(screenShake, e.boss ? 1 : 0.55);
          if (player.hp <= 0) startPlayerDeath();
        }
        e.attackTimer = e.cooldown;
      }
      continue;
    }
    if (e.type === "balrog" && dist < 5.1 && dist > attackRange + 0.4 && hasLineOfSight(e) && e.attackTimer <= 0) {
      e.attackWindup = e.windup * 1.1;
      e.attackPose = 0.85;
    } else if (e.projectile && dist < 2.4) {
      const speed = e.speed * dt;
      moveActor(e, -(dx / dist) * speed, -(dy / dist) * speed, e.radius);
      e.step += dt * 4.2;
      e.moving = true;
    } else if (dist > attackRange || (e.projectile && !hasLineOfSight(e))) {
      const speed = e.speed * dt;
      moveActor(e, (dx / dist) * speed, (dy / dist) * speed, e.radius);
      e.step += dt * (e.boss ? 5.3 : 6.2);
      e.moving = true;
    } else if (e.attackTimer <= 0) {
      e.attackWindup = e.windup;
      e.attackPose = 0.65;
    }
  }

  collectItems();
}

function meleeReach(e) {
  if (e.projectile) return e.attackRange;
  return e.attackRange + (e.radius || 0) * 0.65 + 0.18;
}

function balrogSlam(e, dist) {
  const falloff = Math.max(0.62, 1 - Math.max(0, dist - 0.9) * 0.18);
  const damage = Math.ceil(e.damage * 1.25 * falloff);
  player.hp = Math.max(0, player.hp - damage);
  player.hurt = 1;
  addRage(18);
  e.attackPose = 1;
  screenShake = Math.max(screenShake, 2.2);
  hitSpark = Math.max(hitSpark, 0.8);
  notice = "발록의 화염 강타";
  noticeTimer = 1.2;
  if (player.hp <= 0) startPlayerDeath();
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
  const baseCooldown = kind === "special" ? 0.82 : 0.62;
  swingCooldown = berserk ? baseCooldown * 0.42 : baseCooldown;
  if (kind === "special" && !berserk) player.rage = Math.max(0, player.rage - SPECIAL_RAGE_COST);

  const hitRange = kind === "special" ? 3.05 : 2.15;
  const hitAngle = kind === "special" ? 0.62 : 0.38;
  const baseDamage = 1 + player.weaponLevel + Math.floor((player.level - 1) / 2);
  const rageDamage = berserk ? 1.5 : 1;
  const damage = Math.ceil((kind === "special" ? baseDamage * 2 + 2 : baseDamage) * rageDamage);
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
    target.dead = true;
    target.respawnTimer = respawnDelay(target);
    target.attackWindup = 0;
    target.knockX = 0;
    target.knockY = 0;
    kills += 1;
    gainXp(target.xp);
    if (kind !== "special") addRage(target.boss ? 30 : 16);
    dropLoot(target);
    notice = `${enemyLabel(target)} 처치`;
    noticeTimer = 2.4;
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
      player.hp = Math.min(player.maxHp, player.hp + 28);
      notice = "체력 회복";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "rage") {
      addRage(45);
      notice = "분노 충전";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "xp") {
      gainXp(35 + player.level * 6);
      notice = "경험치 획득";
      noticeTimer = 1.6;
      items.splice(i, 1);
    } else if (item.type === "scroll") {
      player.weaponLevel += 1;
      notice = `강화 주문서 - 검 +${player.weaponLevel}`;
      noticeTimer = 2.2;
      items.splice(i, 1);
    } else if (item.type === "legendScroll") {
      player.weaponLevel += 3;
      player.maxRage = Math.min(220, player.maxRage + 25);
      addRage(player.maxRage);
      notice = `발록의 전리품 - 검 +${player.weaponLevel}`;
      noticeTimer = 3.2;
      items.splice(i, 1);
    } else if (item.type === "weapon") {
      player.weaponLevel = Math.max(player.weaponLevel, item.value);
      notice = `검 +${item.value} 회수`;
      noticeTimer = 2.4;
      items.splice(i, 1);
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
  ctx.save();
  if (screenShake > 0) {
    const wobble = Math.sin(performance.now() * 0.08) * screenShake * 4;
    ctx.translate(wobble, -wobble * 0.45);
  }
  drawWorld();
  drawSprites();
  drawTownSprites();
  drawProjectiles();
  drawDamagePops();
  drawItems();
  drawWeapon();
  drawHud();
  if (gameState !== "play") drawEndScreen();
  ctx.restore();
}

function drawWorld() {
  const townView = isTown();
  const sky = ctx.createLinearGradient(0, 0, 0, HALF_H);
  sky.addColorStop(0, townView ? "#40304a" : "#2a2031");
  sky.addColorStop(1, townView ? "#6a4a45" : "#4a3340");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HALF_H);

  const floor = ctx.createLinearGradient(0, HALF_H, 0, H);
  floor.addColorStop(0, townView ? "#6b5f47" : "#4b4437");
  floor.addColorStop(1, townView ? "#2a2118" : "#1d1712");
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
    const hitTown = isTown(hit.x, hit.y);
    const wallR = hitTown ? 0.78 : 0.65;
    const wallG = hitTown ? 0.52 : 0.42;
    const wallB = hitTown ? 0.33 : 0.28;
    ctx.fillStyle = `rgb(${Math.floor(light * wallR * mortar)}, ${Math.floor(light * wallG * mortar)}, ${Math.floor(light * wallB * mortar)})`;
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

    ctx.fillStyle = `rgba(18, 12, 10, ${Math.min(townView ? 0.22 : 0.34, fixedDist / 18)})`;
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
    const size = Math.min(H * 1.45, (H / s.dist) * spriteScale(s.e));
    const depthIndex = Math.floor((screenX / W) * RAYS);
    if (depthIndex < 0 || depthIndex >= RAYS || depths[depthIndex] < s.dist - 0.2) continue;
    const y = HALF_H - size * 0.55;
    drawEnemy(s.e, screenX - size / 2, y, size, s.dist);
    if (gameState === "play") {
      drawNameplate(screenX, y - Math.max(22, size * 0.08), Math.max(58, Math.min(118, size * 0.5)), enemyLabel(s.e), s.e.hp / s.e.maxHp, s.e.boss ? "#d33a32" : "#d8bd76");
    }
  }
}

function spriteScale(e) {
  if (e.type === "balrog") return 2.08;
  if (e.type === "ogreLord") return 1.35;
  if (e.type === "deathKnight" || e.type === "warlockLord") return 1.32;
  if (e.type === "ogre") return 1.05;
  if (e.boss) return 1.25;
  if (e.type === "skeleton") return 0.62;
  return 0.72;
}

function drawEnemy(e, x, y, size, dist) {
  if (e.type === "balrog") drawBalrog(e, x, y, size, dist);
  else if (e.type === "skeleton" || e.type === "skeletonKing" || e.type === "deathKnight") drawSkeleton(e, x, y, size, dist);
  else if (e.type === "warlock" || e.type === "warlockLord") drawWarlock(e, x, y, size, dist);
  else drawOrc(e, x, y, size, dist);
}

function drawTownSprites() {
  const sprites = [
    ...TOWN_PROPS.map((prop) => ({ kind: "prop", data: prop })),
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
      const y = HALF_H - size * 0.38;
      drawTownNpc(s.data, screenX - size / 2, y, size, s.dist);
      if (gameState === "play") {
        drawNameplate(screenX, y - Math.max(24, size * 0.1), Math.max(64, Math.min(112, size * 0.55)), s.data.name, s.data.hp / s.data.maxHp, "#6bcf77");
      }
    } else {
      const size = Math.min(150, (H / s.dist) * propScale(s.data.type));
      drawTownProp(s.data, screenX - size / 2, HALF_H + H / Math.max(1, s.dist) * 0.25 - size, size);
    }
  }
}

function propScale(type) {
  if (type === "well") return 0.42;
  if (type === "sign") return 0.3;
  if (type === "lantern") return 0.26;
  return 0.24;
}

function drawTownNpc(npc, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 18));
  const near = nearestTownNpc()?.npc === npc;

  rect(x + 5 * px, y + 2 * px, 8 * px, 7 * px, "#bd9a68");
  rect(x + 4 * px, y + 1 * px, 10 * px, 3 * px, "#59402f");
  rect(x + 3 * px, y + 8 * px, 12 * px, 9 * px, "#3f5d70");
  rect(x + 4 * px, y + 10 * px, 10 * px, 5 * px, "#4f7690");
  rect(x + 2 * px, y + 9 * px, 3 * px, 7 * px, "#2d3f4c");
  rect(x + 14 * px, y + 9 * px, 3 * px, 7 * px, "#2d3f4c");
  rect(x + 6 * px, y + 17 * px, 3 * px, 4 * px, "#2a241d");
  rect(x + 11 * px, y + 17 * px, 3 * px, 4 * px, "#2a241d");
  rect(x + 7 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e");
  rect(x + 11 * px, y + 5 * px, 2 * px, 1 * px, "#1a130e");
  rect(x + 8 * px, y + 7 * px, 4 * px, 1 * px, "#704020");
  rect(x + 6 * px, y + 12 * px, 8 * px, 1 * px, "#d6b06d");

  if (near && dist < 1.45) {
    ctx.textAlign = "center";
    drawText("E 대화", x + size / 2, y - 8, Math.max(12, Math.floor(size / 8)), "#ffe39a");
    ctx.textAlign = "left";
  }
}

function drawNameplate(cx, y, width, name, pct, fill) {
  const w = Math.round(width);
  const h = 7;
  const x = Math.round(cx - w / 2);
  const clamped = Math.max(0, Math.min(1, pct || 0));
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(7, 5, 4, 0.7)";
  ctx.fillRect(x - 4, y - 18, w + 8, 27);
  drawText(name, cx, y - 7, 12, "#fff1bd");
  ctx.fillStyle = "#21120d";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamped), h - 2);
  ctx.strokeStyle = "#0c0806";
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawTownProp(prop, x, y, size) {
  const px = Math.max(2, Math.floor(size / 14));
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
  } else if (item.type === "legendScroll") {
    rect(x + 2 * px, y + 1 * px, 6 * px, 8 * px, "#3d0f0a");
    rect(x + 3 * px, y + 2 * px, 4 * px, 6 * px, "#ff4a24");
    rect(x + 4 * px, y + 1 * px, 2 * px, 8 * px, "#ffd25a");
    rect(x + 2 * px, y + 4 * px, 6 * px, 2 * px, "#7a0e09");
    rect(x + 1 * px, y + 1 * px, 2 * px, 2 * px, "#fff0a8");
  } else if (item.type === "weapon") {
    const palette = swordPalette(item.value);
    rect(x + 4 * px, y + 1 * px, 2 * px, 7 * px, palette.blade);
    rect(x + 5 * px, y + 1 * px, 1 * px, 7 * px, palette.highlight);
    rect(x + 2 * px, y + 6 * px, 6 * px, 1 * px, palette.guard);
    rect(x + 4 * px, y + 7 * px, 2 * px, 3 * px, "#9b6333");
  } else {
    rect(x + 2 * px, y + 2 * px, 6 * px, 6 * px, "#21160f");
    rect(x + 3 * px, y + 1 * px, 4 * px, 8 * px, "#d0ae52");
    rect(x + 4 * px, y + 2 * px, 2 * px, 6 * px, "#fff0a8");
    rect(x + 1 * px, y + 4 * px, 8 * px, 2 * px, "#8b1f1f");
    rect(x + 2 * px, y + 8 * px, 6 * px, 1 * px, "#0b0504");
  }
}

function drawSkeleton(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 16));
  const deathKnight = e.type === "deathKnight";
  const king = e.type === "skeletonKing" || deathKnight;
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px : 0;
  const bone = flash ? "#fff4c8" : deathKnight ? "#a8a29a" : "#d8d0ad";
  const shade = deathKnight ? "#20222b" : king ? "#8e7b55" : "#8f8870";
  const eye = deathKnight ? "#ff6a22" : king ? "#e12621" : "#5ed1ff";
  y += bob - e.attackPose * 3 * px;
  x += walk * px * 0.3;
  ctx.globalAlpha = Math.max(0.35, 1 - dist / 16);
  if (king) {
    rect(x + 4 * px, y + 1 * px, 8 * px, 2 * px, "#d6b14d");
    rect(x + 5 * px, y - 1 * px, 2 * px, 3 * px, "#ffe28a");
    rect(x + 10 * px, y - 1 * px, 2 * px, 3 * px, "#ffe28a");
  }
  rect(x + 4 * px, y + 4 * px, 9 * px, 8 * px, bone);
  rect(x + 5 * px, y + 5 * px, 7 * px, 1 * px, "#f5edce");
  rect(x + 5 * px, y + 8 * px, 2 * px, 2 * px, eye);
  rect(x + 10 * px, y + 8 * px, 2 * px, 2 * px, eye);
  rect(x + 7 * px, y + 10 * px, 3 * px, 1 * px, "#221a17");
  rect(x + 6 * px, y + 13 * px, 5 * px, 2 * px, shade);
  rect(x + 7 * px, y + 15 * px, 3 * px, 7 * px, bone);
  rect(x + 4 * px, y + 17 * px, 9 * px, 1 * px, bone);
  rect(x + 3 * px, y + 14 * px, 2 * px, 8 * px, bone);
  rect(x + 12 * px, y + 14 * px, 2 * px, 8 * px, bone);
  rect(x + (5 - Math.max(0, walk)) * px, y + 22 * px, 2 * px, 5 * px, bone);
  rect(x + (10 + Math.max(0, walk)) * px, y + 22 * px, 2 * px, 5 * px, bone);
  if (king) {
    rect(x + 2 * px, y + 13 * px, 12 * px, 4 * px, deathKnight ? "#141820" : "#292a36");
    rect(x + 3 * px, y + 14 * px, 10 * px, 1 * px, deathKnight ? "#6e7482" : "#5f6485");
    rect(x + 13 * px, y + 13 * px, 2 * px, 13 * px, "#44351d");
    rect(x + 14 * px, y + 10 * px, 1 * px, 7 * px, deathKnight ? "#d9dde4" : "#cfc6ad");
    if (deathKnight) {
      rect(x + 1 * px, y + 18 * px, 14 * px, 3 * px, "#0c1017");
      rect(x + 3 * px, y + 17 * px, 10 * px, 1 * px, "#9aa3b4");
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
  y += bob - e.attackPose * 2 * px;
  x += walk * px * 0.22;
  ctx.globalAlpha = Math.max(0.35, 1 - dist / 16);
  rect(x + 3 * px, y + 5 * px, 11 * px, 18 * px, flash ? "#a982d8" : lord ? "#170824" : "#241334");
  rect(x + 5 * px, y + 3 * px, 7 * px, 7 * px, flash ? "#d7b6ff" : lord ? "#4b1465" : "#3a1e58");
  if (lord) {
    rect(x + 4 * px, y + 1 * px, 9 * px, 3 * px, "#68430c");
    rect(x + 6 * px, y + 0 * px, 5 * px, 2 * px, "#f0b84a");
  }
  rect(x + 6 * px, y + 7 * px, 2 * px, 1 * px, lord ? "#ff6aff" : "#d669ff");
  rect(x + 10 * px, y + 7 * px, 2 * px, 1 * px, lord ? "#ff6aff" : "#d669ff");
  rect(x + 5 * px, y + 11 * px, 8 * px, 2 * px, "#111014");
  rect(x + 2 * px, y + 13 * px, 4 * px, 9 * px, "#321b49");
  rect(x + 12 * px, y + 13 * px, 4 * px, 9 * px, "#321b49");
  rect(x + 13 * px, y + 18 * px, 3 * px, 3 * px, lord ? "#ff7cff" : "#b75cff");
  rect(x + 6 * px, y + 23 * px, 3 * px, 3 * px, "#100b16");
  rect(x + 10 * px, y + 23 * px, 3 * px, 3 * px, "#100b16");
  if (e.attackWindup > 0) {
    rect(x + 12 * px, y + 16 * px, 5 * px, 5 * px, "#6d2eb2");
    rect(x + 13 * px, y + 17 * px, 3 * px, 3 * px, "#efc9ff");
  }
  ctx.globalAlpha = 1;
}

function drawBalrog(e, x, y, size, dist) {
  const px = Math.max(2, Math.floor(size / 18));
  const flash = e.hitFlash > 0;
  const walk = e.moving ? Math.sin(e.step) : 0;
  const bob = e.moving ? Math.abs(Math.sin(e.step)) * px * 0.7 : 0;
  const attack = e.attackPose;
  const winding = e.attackWindup > 0;
  y += bob - attack * 4 * px + (winding ? 2 * px : 0);
  x += walk * px * 0.22;
  ctx.globalAlpha = Math.max(0.45, 1 - dist / 18);

  rect(x + 2 * px, y + 7 * px, 14 * px, 12 * px, flash ? "#ffcf9a" : "#2a0907");
  rect(x + 4 * px, y + 5 * px, 10 * px, 9 * px, flash ? "#ffd7a8" : "#5a1110");
  rect(x + 1 * px, y + 9 * px, 4 * px, 3 * px, "#1a0504");
  rect(x + 13 * px, y + 9 * px, 4 * px, 3 * px, "#1a0504");
  tri(x + 4 * px, y + 5 * px, x + 1 * px, y - 1 * px, x + 7 * px, y + 3 * px, "#d9b46a");
  tri(x + 14 * px, y + 5 * px, x + 17 * px, y - 1 * px, x + 11 * px, y + 3 * px, "#d9b46a");
  rect(x + 5 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f");
  rect(x + 10 * px, y + 9 * px, 3 * px, 2 * px, "#ff3b1f");
  rect(x + 6 * px, y + 8 * px, 2 * px, 1 * px, "#ffd25a");
  rect(x + 11 * px, y + 8 * px, 2 * px, 1 * px, "#ffd25a");
  rect(x + 7 * px, y + 12 * px, 4 * px, 2 * px, "#0b0303");
  rect(x + 6 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0");
  rect(x + 11 * px, y + 14 * px, 2 * px, 3 * px, "#f4dfc0");

  rect(x + 3 * px, y + 18 * px, 12 * px, 12 * px, "#171010");
  rect(x + 4 * px, y + 18 * px, 10 * px, 2 * px, "#6f1c13");
  rect(x + 5 * px, y + 22 * px, 8 * px, 2 * px, "#d63a1d");
  rect(x + 1 * px, y + 20 * px, 5 * px, 7 * px, "#210808");
  rect(x + 12 * px, y + 20 * px, 5 * px, 7 * px, "#210808");
  rect(x + 0 * px, y + 24 * px, 4 * px, 3 * px, "#6f1c13");
  rect(x + 14 * px, y + 24 * px, 4 * px, 3 * px, "#6f1c13");
  rect(x + 5 * px, y + 30 * px, 4 * px, 7 * px, "#130706");
  rect(x + 10 * px, y + 30 * px, 4 * px, 7 * px, "#130706");
  rect(x + 4 * px, y + 36 * px, 5 * px, 2 * px, "#070303");
  rect(x + 10 * px, y + 36 * px, 5 * px, 2 * px, "#070303");

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
  const attack = e.attackPose;
  const winding = e.attackWindup > 0;
  const hurt = e.hitFlash > 0.1;
  y += bob - attack * 3 * px + (winding ? 2 * px : 0);
  x += walk * px * 0.35 + (winding ? Math.sin(e.step + 1.2) * px * 0.2 : 0);
  const skin = flash ? "#f6e9b8" : ogreLord ? "#4e5f29" : ogre ? "#6b7f38" : dark ? "#1d5f32" : "#2f9c45";
  const skinLight = flash ? "#fff6cf" : ogreLord ? "#839448" : ogre ? "#9aaa55" : dark ? "#3a8745" : "#5fc765";
  const shadow = ogreLord ? "#252d17" : ogre ? "#323d1d" : dark ? "#0e2817" : "#145b28";
  const deepShadow = ogreLord ? "#11150c" : ogre ? "#181e10" : dark ? "#07130b" : "#0a3317";
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
  const special = swingType === "special" && swing > 0;
  if (special) {
    drawSpecialSword(progress);
    if (hitSpark > 0) drawHitSpark();
    return;
  }
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

function drawSpecialSword(progress) {
  const palette = swordPalette();
  const arc = Math.sin(progress * Math.PI);
  const returnEase = progress < 0.62 ? progress / 0.62 : Math.max(0, 1 - (progress - 0.62) / 0.38);
  const sweep = Math.sin(returnEase * Math.PI);
  const hiltX = W * (0.82 - sweep * 0.08);
  const hiltY = H * (1.12 - sweep * 0.04);
  const tipX = W * (0.6 - sweep * 0.22);
  const tipY = H * (0.74 - sweep * 0.24);
  drawForwardPole(hiltX, hiltY, tipX, tipY, 0.82 + sweep * 0.36, false, false);

  if (progress > 0.18 && progress < 0.58) {
    ctx.save();
    ctx.globalAlpha = 0.16 + arc * 0.18;
    ctx.strokeStyle = palette.specialTrail;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(W * 0.36, H * 0.64);
    ctx.quadraticCurveTo(W * 0.52, H * 0.46, W * 0.72, H * 0.6);
    ctx.stroke();
    ctx.restore();
  }
}

function drawForwardPole(nearX, nearY, farX, farY, lunge, special = false, showTrail = true) {
  const dx = farX - nearX;
  const dy = farY - nearY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const palette = swordPalette();
  const upgradeScale = Math.min(12, player.weaponLevel) * 1.25;
  const nearW = 34 + upgradeScale + lunge * 10;
  const midW = 24 + upgradeScale * 0.7 + lunge * 4;
  const farW = 17 + upgradeScale * 0.4 + lunge * 2;
  const tipLen = 18 + upgradeScale * 0.6 + lunge * 8;
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
  ctx.lineTo(farX + dx / len * tipLen, farY + dy / len * tipLen);
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
  if (level >= 8) {
    return { blade: "#f8f6d8", highlight: "#ffffff", shadow: "#6e5a1e", guard: "#f1c232", trail: "rgba(255, 245, 180, 0.5)", specialTrail: "rgba(255, 245, 180, 0.72)" };
  }
  if (level >= 5) {
    return { blade: "#f1c232", highlight: "#fff0a6", shadow: "#5b4315", guard: "#c18a24", trail: "rgba(255, 220, 72, 0.45)", specialTrail: "rgba(255, 235, 92, 0.72)" };
  }
  if (level >= 3) {
    return { blade: "#7c53d9", highlight: "#ddcfff", shadow: "#211046", guard: "#6b42b8", trail: "rgba(150, 96, 255, 0.42)", specialTrail: "rgba(166, 110, 255, 0.68)" };
  }
  if (level >= 2) {
    return { blade: "#c83b34", highlight: "#ffd0c0", shadow: "#4a1511", guard: "#91302a", trail: "rgba(255, 90, 70, 0.42)", specialTrail: "rgba(255, 74, 45, 0.68)" };
  }
  if (level >= 1) {
    return { blade: "#a7d8f0", highlight: "#ffffff", shadow: "#28485a", guard: "#5c8da8", trail: "rgba(160, 220, 255, 0.34)", specialTrail: "rgba(180, 230, 255, 0.64)" };
  }
  return { blade: "#d8d8d2", highlight: "#ffffff", shadow: "#686860", guard: "#9a8b68", trail: "rgba(255, 255, 255, 0.34)", specialTrail: "rgba(255, 238, 186, 0.64)" };
}

function swordName() {
  return `검 +${player.weaponLevel}`;
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
  if (berserk) {
    ctx.fillStyle = "rgba(170, 18, 8, 0.18)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255, 68, 42, 0.12)";
    ctx.fillRect(0, 0, W, HALF_H);
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
  drawText(isTown() ? "마을" : "필드", 580, H - 28, 14, isTown() ? "#ffe39a" : "#d7c27b");
  drawText(swordName(), W - 184, H - 28, 14, "#d7c27b");
  if (berserk) drawText("광폭화: 공속/공격력/이속 +50%, 특수공격 무제한", W - 390, H - 52, 13, "#ffb199");
  else if (player.rage >= SPECIAL_RAGE_COST) drawText(`우클릭 특수공격 - 분노 ${SPECIAL_RAGE_COST}`, W - 290, H - 52, 13, "#ffe39a");

  const droppedSword = lostWeapon();
  if (droppedSword) {
    drawText(`잃어버린 검: ${directionTo(droppedSword.x, droppedSword.y)}`, 760, H - 28, 13, "#fff1bd");
  } else {
    const balrog = balrogEnemy();
    drawText(balrog ? `목표: ${directionTo(balrog.x, balrog.y)}쪽 발록 처치` : "목표 완료: 발록 처치", 760, H - 28, 13, balrog ? "#ffb199" : "#ffe39a");
  }

  const boss = balrogEnemy() || enemies.find((e) => e.boss && !e.dead);
  if (boss && (Math.hypot(player.x - boss.x, player.y - boss.y) < 8 || boss.hp < boss.maxHp)) {
    drawBar(W - 260, 26, 220, 18, boss.hp / boss.maxHp, "#b91818", "#2a0c0c");
    drawText(enemyLabel(boss), W - 252, 40, 13, "#ffe08a");
  }

  if (player.hurt > 0) {
    ctx.fillStyle = `rgba(155, 0, 0, ${player.hurt * 0.25})`;
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

function drawInteractionHud() {
  const nearby = nearestTownNpc();
  if (!nearby || dialogueTimer > 0) return;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(10, 7, 4, 0.72)";
  ctx.fillRect(W / 2 - 140, H - 126, 280, 30);
  ctx.strokeStyle = "#d8bd76";
  ctx.strokeRect(W / 2 - 140, H - 126, 280, 30);
  drawText("E 대화하기", W / 2, H - 106, 14, "#ffe39a");
  ctx.textAlign = "left";
}

function drawDialogue() {
  if (dialogueTimer <= 0) return;
  const x = 250;
  const y = H - 170;
  const w = W - 500;
  const h = 82;
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

  for (const item of items) {
    if (item.type === "weapon") {
      ctx.fillStyle = pulse ? "#fff7c2" : "#f1c232";
      ctx.fillRect(x0 + item.x * cell - 3, y0 + item.y * cell - 3, 7, 7);
      ctx.strokeStyle = "#ffffff";
      ctx.strokeRect(x0 + item.x * cell - 4, y0 + item.y * cell - 4, 9, 9);
    } else {
      ctx.fillStyle = itemColor(item);
      ctx.fillRect(x0 + item.x * cell - 1, y0 + item.y * cell - 1, 3, 3);
    }
  }

  for (const prop of TOWN_PROPS) {
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

function drawBar(x, y, w, h, pct, fill, bg, label = "") {
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
  if (label) {
    ctx.textAlign = "center";
    drawText(label, x + w / 2, y + h - 4, Math.max(10, Math.min(12, h - 2)), "#fff7d6");
    ctx.textAlign = "left";
  }
}

function drawText(text, x, y, size, color) {
  ctx.font = `500 ${size}px Noto Sans KR, Malgun Gothic, Apple SD Gothic Neo, sans-serif`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawEndScreen() {
  ctx.fillStyle = "rgba(4, 3, 2, 0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = gameState === "over" ? "#b52626" : "#e6c766";
  ctx.font = gameState === "start" ? "600 48px Noto Sans KR, Malgun Gothic, sans-serif" : "600 54px Noto Sans KR, Malgun Gothic, sans-serif";
  let title = "게임 오버";
  if (gameState === "start") title = "그림자 성채";
  if (gameState === "clear") title = "성채 정복";
  if (gameState === "dead") title = "죽었습니다";
  ctx.fillText(title, W / 2, H / 2 - 72);
  ctx.fillStyle = "#d9c99a";
  ctx.font = "500 20px Noto Sans KR, Malgun Gothic, sans-serif";
  if (gameState === "start") {
    ctx.fillText("좌클릭 / 스페이스: 공격", W / 2, H / 2 - 18);
    ctx.fillText(`분노 최대치: 자동 광폭화`, W / 2, H / 2 + 14);
    ctx.fillText("사냥하고, 성장하고, 던전에서 버티세요", W / 2, H / 2 + 48);
    ctx.fillText("Enter 또는 클릭으로 시작", W / 2, H / 2 + 84);
  } else if (gameState === "dead") {
    ctx.fillText(`${Math.ceil(deathTimer)}초 후 마을에서 부활합니다`, W / 2, H / 2 + 12);
    ctx.fillText("강화된 검은 죽은 자리에 떨어졌습니다", W / 2, H / 2 + 48);
  } else {
    ctx.fillText("Enter로 다시 시작", W / 2, H / 2 + 12);
  }
  ctx.textAlign = "left";
}

function startGame() {
  gameState = "play";
  messagePulse = 0;
  notice = "마을";
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
  player.maxHp = 100;
  player.maxRage = 100;
  player.level = 1;
  player.xp = 0;
  player.nextXp = 60;
  player.weaponLevel = 0;
  berserk = false;
  deathTimer = 0;
  kills = 0;
  swing = 0;
  swingCooldown = 0;
  swingType = "normal";
  damagePops = [];
  projectiles = [];
  hitSpark = 0;
  screenShake = 0;
  dialogueText = "";
  dialogueSpeaker = "";
  dialogueTimer = 0;
  gameState = "start";
  started = false;
  items = [];
  map = buildMap(stage);
  enemies = buildEnemies(stage);
  notice = "던전 필드";
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
  if (event.code === "KeyE" && gameState === "play") {
    event.preventDefault();
    interact();
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
  if (event.code === "Enter" && gameState !== "play" && gameState !== "dead") resetGame();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("click", () => {
  if (gameState === "start") {
    startGame();
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
