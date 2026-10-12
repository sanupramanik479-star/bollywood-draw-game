const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static("public"));

const movies = [
  "3 Idiots","Dangal","Dil Chahta Hai","Zindagi Na Milegi Dobara","Yeh Jawaani Hai Deewani",
  "Kabhi Khushi Kabhie Gham","Kuch Kuch Hota Hai","Bhool Bhulaiyaa","Gully Boy","Chennai Express",
  "Bajrangi Bhaijaan","Queen","Barfi!","Andhadhun","Stree","Drishyam","War","Pathaan","Jawan",
  "Lagaan","Don","Om Shanti Om","Rockstar","Tamasha","PK","Munna Bhai M.B.B.S.","Taare Zameen Par",
  "Kabir Singh","Raazi","Uri: The Surgical Strike","Shershaah","Badhaai Ho","Hera Pheri","Welcome",
  "Golmaal","Kahaani","Piku","Swades","Rang De Basanti","Dilwale Dulhania Le Jayenge","Kal Ho Naa Ho",
  "Mohabbatein","Devdas","Gangubai Kathiawadi","Bhaag Milkha Bhaag","Rocky Aur Rani Kii Prem Kahaani",
  "Krrish","Main Hoon Na","Partner","Ready","Housefull","Bhool Bhulaiyaa 2","JugJugg Jeeyo",
  "Tu Jhoothi Main Makkaar","Animal","Stree 2","Bhediya","Mimi","Luka Chuppi","Bareilly Ki Barfi",
  "Dream Girl","Dream Girl 2","Chak De! India","Koi... Mil Gaya","Jab We Met","Singham","Ra.One",
  "Kaho Naa... Pyaar Hai","Bunty Aur Babli","Fukrey","Badhaai Do","OMG 2","12th Fail"
];
const rooms = {};
const durations = [30, 45, 60, 90, 120];

function makeRoomCode() {
  let code;
  do { code = Math.random().toString(36).substring(2, 6).toUpperCase(); } while (rooms[code]);
  return code;
}
function publicPlayers(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
}
function normalize(text) {
  return String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function sendLobby(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit("lobbyUpdate", {
    roomCode: code, players: publicPlayers(room), hostId: room.hostId,
    roundDuration: room.roundDuration, totalRounds: room.totalRounds
  });
}
function stopTimer(room) {
  if (room && room.timer) clearInterval(room.timer);
  if (room) room.timer = null;
}
function startRound(code) {
  const room = rooms[code];
  if (!room || room.gameOver) return;
  if (room.round > room.totalRounds) return endGame(code);
  if (!room.players.length) return;
  room.drawerIndex = room.drawerIndex % room.players.length;
  room.drawerId = room.players[room.drawerIndex].id;
  room.movie = null;
  room.choices = [...movies].sort(() => Math.random() - 0.5).slice(0, 3);
  room.timeLeft = room.roundDuration;
  room.roundWinner = null;
  room.roundActive = false;

  io.to(code).emit("roundStart", {
    round: room.round, totalRounds: room.totalRounds, drawerId: room.drawerId,
    timeLeft: room.timeLeft, roundDuration: room.roundDuration
  });
  room.players.forEach(player => {
    const s = io.sockets.sockets.get(player.id);
    if (s) s.emit("drawerStatus", { isDrawer: player.id === room.drawerId });
  });
  const drawer = io.sockets.sockets.get(room.drawerId);
  if (drawer) drawer.emit("movieChoices", { choices: room.choices });
}
function chooseMovie(code, socket, movie) {
  const room = rooms[code];
  if (!room || room.drawerId !== socket.id || room.roundActive || room.roundWinner !== null) return;
  if (!room.choices.includes(movie)) return;
  room.movie = movie;
  room.roundActive = true;
  room.timeLeft = room.roundDuration;
  io.to(code).emit("movieChosen", { hint: movie.replace(/[A-Za-z0-9]/g, "_").split("").join(" ") });
  socket.emit("drawerStatus", { isDrawer: true, movie });
  io.to(code).emit("systemMessage", { message: `${room.players.find(p => p.id === socket.id)?.name || "The drawer"} is drawing!` });
  stopTimer(room);
  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(code).emit("timer", { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) finishRound(code, null);
  }, 1000);
}
function finishRound(code, winnerId) {
  const room = rooms[code];
  if (!room || room.roundWinner !== null) return;
  room.roundWinner = winnerId || false;
  room.roundActive = false;
  stopTimer(room);
  let winnerName = null;
  if (winnerId) {
    const winner = room.players.find(p => p.id === winnerId);
    if (winner) {
      winner.score += 10 + Math.floor(Math.max(0, room.timeLeft) / 5);
      winnerName = winner.name;
    }
  }
  io.to(code).emit("roundEnd", {
    movie: room.movie || "No movie selected", winnerId, winnerName,
    players: publicPlayers(room), round: room.round, totalRounds: room.totalRounds
  });
}
function endGame(code) {
  const room = rooms[code];
  if (!room) return;
  room.gameOver = true;
  room.gameStarted = false;
  stopTimer(room);
  io.to(code).emit("gameOver", { players: publicPlayers(room), totalRounds: room.totalRounds });
}
io.on("connection", socket => {
  socket.on("createRoom", ({ name }) => {
    if (!name || !name.trim()) return;
    const roomCode = makeRoomCode();
    rooms[roomCode] = {
      hostId: socket.id, players: [{ id: socket.id, name: name.trim().slice(0, 20), score: 0 }],
      round: 1, totalRounds: 5, roundDuration: 60, drawerIndex: 0, drawerId: null,
      movie: null, choices: [], timeLeft: 60, roundWinner: null, roundActive: false,
      gameStarted: false, gameOver: false, timer: null
    };
    socket.join(roomCode); socket.roomCode = roomCode;
    socket.emit("roomCreated", { roomCode }); sendLobby(roomCode);
  });
  socket.on("joinRoom", ({ name, roomCode }) => {
    if (!name || !name.trim() || !roomCode) return;
    roomCode = roomCode.trim().toUpperCase();
    const room = rooms[roomCode];
    if (!room) return socket.emit("errorMessage", "Room not found. Check the code and try again.");
    if (room.gameStarted) return socket.emit("errorMessage", "Game already started.");
    if (room.players.length >= 12) return socket.emit("errorMessage", "Room is full (12 players maximum).");
    room.players.push({ id: socket.id, name: name.trim().slice(0, 20), score: 0 });
    socket.join(roomCode); socket.roomCode = roomCode;
    socket.emit("roomJoined", { roomCode }); sendLobby(roomCode);
  });
  socket.on("setGameSettings", ({ roundDuration, totalRounds }) => {
    const room = rooms[socket.roomCode];
    if (!room || room.hostId !== socket.id || room.gameStarted) return;
    if (durations.includes(Number(roundDuration))) room.roundDuration = Number(roundDuration);
    const rounds = Number(totalRounds);
    if ([3, 5, 7, 10].includes(rounds)) room.totalRounds = rounds;
    sendLobby(socket.roomCode);
  });
  socket.on("startGame", () => {
    const code = socket.roomCode, room = rooms[code];
    if (!room || room.hostId !== socket.id || room.players.length < 2 || room.gameStarted) return;
    room.gameStarted = true; room.gameOver = false; room.round = 1; room.drawerIndex = 0;
    room.players.forEach(p => p.score = 0);
    startRound(code);
  });
  socket.on("chooseMovie", ({ movie }) => chooseMovie(socket.roomCode, socket, movie));
  socket.on("draw", data => {
    const room = rooms[socket.roomCode];
    if (!room || !room.roundActive || room.drawerId !== socket.id) return;
    const values = ["x1","y1","x2","y2"].map(k => Number(data?.[k]));
    if (values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) return;
    socket.to(socket.roomCode).emit("draw", {
      x1: values[0], y1: values[1], x2: values[2], y2: values[3],
      color: /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : "#111111",
      size: Math.max(1, Math.min(40, Number(data.size) || 5)),
      mode: data.mode === "eraser" ? "eraser" : "pen"
    });
  });
  socket.on("clearCanvas", () => {
    const room = rooms[socket.roomCode];
    if (room && room.roundActive && room.drawerId === socket.id) io.to(socket.roomCode).emit("clearCanvas");
  });
  socket.on("chatMessage", ({ message }) => {
    const code = socket.roomCode, room = rooms[code];
    if (!room || !message) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const text = String(message).trim().slice(0, 200);
    if (!text) return;
    if (room.roundActive && socket.id !== room.drawerId && normalize(text) === normalize(room.movie)) {
      finishRound(code, socket.id);
      io.to(code).emit("correctGuess", { name: player.name, playerId: socket.id });
      return;
    }
    if (room.roundActive && socket.id === room.drawerId) {
      socket.emit("guessFeedback", { message: "You're drawing—chat is disabled for the drawer." });
      return;
    }
    io.to(code).emit("chatMessage", { name: player.name, message: text, playerId: socket.id });
    if (room.roundActive && socket.id !== room.drawerId) {
      socket.emit("guessFeedback", { message: "Not quite—try another guess!" });
    }
  });
  socket.on("nextRound", () => {
    const code = socket.roomCode, room = rooms[code];
    if (!room || room.hostId !== socket.id || room.roundWinner === null) return;
    if (room.round >= room.totalRounds) return endGame(code);
    room.round++; room.drawerIndex = (room.drawerIndex + 1) % room.players.length;
    startRound(code);
  });
  socket.on("playAgain", () => {
    const code = socket.roomCode, room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.players.forEach(p => p.score = 0);
    room.round = 1; room.drawerIndex = 0; room.gameStarted = true; room.gameOver = false;
    startRound(code);
  });
  socket.on("backToLobby", () => {
    const code = socket.roomCode, room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    room.gameStarted = false; room.gameOver = false; room.roundWinner = null;
    stopTimer(room); sendLobby(code);
    io.to(code).emit("returnedToLobby");
  });
  socket.on("disconnect", () => {
    const code = socket.roomCode, room = rooms[code];
    if (!code || !room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    if (!room.players.length) { stopTimer(room); delete rooms[code]; return; }
    if (room.hostId === socket.id) room.hostId = room.players[0].id;
    if (room.gameStarted && room.drawerId === socket.id) {
      stopTimer(room); room.roundWinner = null;
      room.drawerIndex = room.drawerIndex % room.players.length;
      startRound(code);
    }
    sendLobby(code);
  });
});
server.listen(PORT, () => console.log(`CineDraw server running on port ${PORT}`));
      
