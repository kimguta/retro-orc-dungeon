const http = require("http");
const cors = require("cors");
const express = require("express");
const { Server } = require("socket.io");

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS_PER_ROOM = Number(process.env.MAX_PLAYERS_PER_ROOM) || 20;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.get("/health", (_, res) => {
  res.json({ ok: true, rooms: rooms.size, players: players.size });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS },
});

const rooms = new Map();
const players = new Map();
let nextRoomNumber = 1;

io.on("connection", (socket) => {
  const joined = joinRoom(socket, socket.handshake.auth?.name);
  socket.emit("room:joined", {
    roomId: joined.roomId,
    players: roomPlayers(joined.roomId).filter((player) => player.id !== socket.id),
  });
  publishPlayers(joined.roomId);

  socket.on("player:update", (state = {}) => {
    const player = players.get(socket.id);
    if (!player) return;
    Object.assign(player, sanitizeState(state));
    publishPlayers(player.roomId);
  });

  socket.on("player:action", ({ action } = {}) => {
    const player = players.get(socket.id);
    if (!player) return;
    player.action = action === "specialAttack" ? "specialAttack" : "attack";
    socket.to(player.roomId).emit("player:action", { id: socket.id, action: player.action });
  });

  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    if (!player) return;
    const room = rooms.get(player.roomId);
    room?.players.delete(socket.id);
    players.delete(socket.id);
    socket.to(player.roomId).emit("player:left", { id: socket.id });
    publishPlayers(player.roomId);
    if (room && room.players.size === 0) rooms.delete(room.id);
  });
});

function joinRoom(socket, rawName) {
  const room = findRoom();
  const name = sanitizeName(rawName);
  const player = {
    id: socket.id,
    roomId: room.id,
    name,
    displayName: name.endsWith("_test") ? name.slice(0, -5) : name,
    x: 4.5,
    y: 4.5,
    angle: 0,
    hp: 100,
    maxHp: 100,
    level: 1,
    weaponLevel: 0,
    armorLevel: 0,
    moving: false,
    berserk: false,
    action: "idle",
  };
  room.players.add(socket.id);
  players.set(socket.id, player);
  socket.join(room.id);
  return { roomId: room.id, player };
}

function findRoom() {
  for (const room of rooms.values()) {
    if (room.players.size < MAX_PLAYERS_PER_ROOM) return room;
  }
  const room = { id: `room-${nextRoomNumber++}`, players: new Set() };
  rooms.set(room.id, room);
  return room;
}

function roomPlayers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return [...room.players].map((id) => players.get(id)).filter(Boolean);
}

function publishPlayers(roomId) {
  if (!rooms.has(roomId)) return;
  io.to(roomId).emit("players:update", roomPlayers(roomId));
}

function sanitizeName(value) {
  const name = String(value || "전사").replace(/\s+/g, " ").trim().slice(0, 18);
  return name || "전사";
}

function sanitizeState(state) {
  return {
    x: finite(state.x, 4.5),
    y: finite(state.y, 4.5),
    angle: finite(state.angle, 0),
    hp: Math.max(0, finite(state.hp, 0)),
    maxHp: Math.max(1, finite(state.maxHp, 100)),
    level: Math.max(1, Math.floor(finite(state.level, 1))),
    weaponLevel: Math.max(0, Math.floor(finite(state.weaponLevel, 0))),
    armorLevel: Math.max(0, Math.floor(finite(state.armorLevel, 0))),
    moving: Boolean(state.moving),
    berserk: Boolean(state.berserk),
    action: state.action === "specialAttack" || state.action === "attack" ? state.action : "idle",
  };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

httpServer.listen(PORT, () => {
  console.log(`Paper Citadel multiplayer server listening on ${PORT}`);
});
