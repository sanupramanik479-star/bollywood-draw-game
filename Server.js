const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const movies = [
  "3 Idiots",
  "Dangal",
  "Dil Chahta Hai",
  "Zindagi Na Milegi Dobara",
  "Yeh Jawaani Hai Deewani",
  "Kabhi Khushi Kabhie Gham",
  "Kuch Kuch Hota Hai",
  "Bhool Bhulaiyaa",
  "Gully Boy",
  "Chennai Express",
  "Bajrangi Bhaijaan",
  "Queen",
  "Barfi!",
  "Andhadhun",
  "Stree",
  "Drishyam",
  "War",
  "Pathaan",
  "Jawan",
  "Lagaan",
  "Don",
  "Om Shanti Om",
  "Rockstar",
  "Tamasha",
  "PK",
  "Munna Bhai M.B.B.S.",
  "Taare Zameen Par",
  "Kabir Singh",
  "Raazi",
  "Uri: The Surgical Strike",
  "Shershaah",
  "Badhaai Ho",
  "Hera Pheri",
  "Welcome",
  "Golmaal",
  "Kahaani",
  "Piku",
  "Swades",
  "Rang De Basanti",
  "Dilwale Dulhania Le Jayenge",
  "Kal Ho Naa Ho",
  "Mohabbatein",
  "Devdas",
  "Gangubai Kathiawadi",
  "Bhaag Milkha Bhaag",
  "Rocky Aur Rani Kii Prem Kahaani",
  "Krrish",
  "Main Hoon Na",
  "Partner",
  "Ready",
  "Housefull",
  "Bhool Bhulaiyaa 2",
  "JugJugg Jeeyo",
  "Tu Jhoothi Main Makkaar",
  "Animal",
  "Stree 2",
  "Bhediya",
  "Mimi",
  "Luka Chuppi",
  "Bareilly Ki Barfi",
  "Dream Girl",
  "Dream Girl 2"
];

const rooms = {};

function makeRoomCode() {
  let code;

  do {
    code = Math.random().toString(36).substring(2, 6).toUpperCase();
  } while (rooms[code]);

  return code;
}

function publicPlayers(room) {
  return room.players.map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score
  }));
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomMovie() {
  return movies[Math.floor(Math.random() * movies.length)];
}

function sendLobby(roomCode) {
  const room = rooms[roomCode];

  if (!room) return;

  io.to(roomCode).emit("lobbyUpdate", {
    players: publicPlayers(room),
    hostId: room.hostId
  });
}

function startRound(roomCode) {
  const room = rooms[roomCode];

  if (!room || room.gameOver) return;

  if (room.round > room.totalRounds) {
    endGame(roomCode);
    return;
  }

  room.drawerIndex =
    room.drawerIndex % room.players.length;

  room.drawerId = room.players[room.drawerIndex].id;
  room.movie = randomMovie();
  room.timeLeft = 60;
  room.roundWinner = null;

  io.to(roomCode).emit("roundStart", {
    round: room.round,
    totalRounds: room.totalRounds,
    drawerId: room.drawerId,
    timeLeft: room.timeLeft
  });

  const drawerSocket = io.sockets.sockets.get(room.drawerId);

  if (drawerSocket) {
    drawerSocket.emit("drawerStatus", {
      isDrawer: true,
      movie: room.movie
    });
  }

  room.players.forEach((player) => {
    if (player.id !== room.drawerId) {
      const socket = io.sockets.sockets.get(player.id);

      if (socket) {
        socket.emit("drawerStatus", {
          isDrawer: false
        });
      }
    }
  });

  clearInterval(room.timer);

  room.timer = setInterval(() => {
    room.timeLeft--;

    io.to(roomCode).emit("timer", {
      timeLeft: room.timeLeft
    });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);
      finishRound(roomCode, null);
    }
  }, 1000);
}

function finishRound(roomCode, winnerId) {
  const room = rooms[roomCode];

  if (!room || room.roundWinner !== null) return;

  room.roundWinner = winnerId;

  clearInterval(room.timer);

  let winnerName = null;

  if (winnerId) {
    const winner = room.players.find(
      (p) => p.id === winnerId
    );

    if (winner) {
      const bonus = Math.floor(room.timeLeft / 5);
      winner.score += 10 + bonus;
      winnerName = winner.name;
    }
  }

  io.to(roomCode).emit("roundEnd", {
    movie: room.movie,
    winnerId,
    winnerName,
    players: publicPlayers(room),
    round: room.round
  });
}

function endGame(roomCode) {
  const room = rooms[roomCode];

  if (!room) return;

  room.gameOver = true;

  clearInterval(room.timer);

  const finalPlayers = [...room.players].sort(
    (a, b) => b.score - a.score
  );

  io.to(roomCode).emit("gameOver", {
    players: publicPlayers({
      players: finalPlayers
    })
  });
}

io.on("connection", (socket) => {
  socket.on("createRoom", ({ name }) => {
    if (!name || !name.trim()) return;

    const roomCode = makeRoomCode();

    rooms[roomCode] = {
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name: name.trim(),
          score: 0
        }
      ],
      round: 1,
      totalRounds: 5,
      drawerIndex: 0,
      drawerId: null,
      movie: null,
      timeLeft: 60,
      roundWinner: null,
      gameStarted: false,
      gameOver: false,
      timer: null
    };

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit("roomCreated", {
      roomCode
    });

    sendLobby(roomCode);
  });

  socket.on("joinRoom", ({ name, roomCode }) => {
    if (!name || !name.trim() || !roomCode) return;

    roomCode = roomCode.trim().toUpperCase();

    const room = rooms[roomCode];

    if (!room) {
      socket.emit("errorMessage", "Room not found.");
      return;
    }

    if (room.gameStarted) {
      socket.emit("errorMessage", "Game already started.");
      return;
    }

    if (room.players.length >= 12) {
      socket.emit("errorMessage", "Room is full.");
      return;
    }

    room.players.push({
      id: socket.id,
      name: name.trim(),
      score: 0
    });

    socket.join(roomCode);
    socket.roomCode = roomCode;

    socket.emit("roomJoined", {
      roomCode
    });

    sendLobby(roomCode);
  });

  socket.on("startGame", () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room) return;
    if (room.hostId !== socket.id) return;
    if (room.players.length < 2) return;
    if (room.gameStarted) return;

    room.gameStarted = true;
    room.round = 1;
    room.drawerIndex = 0;

    startRound(roomCode);
  });

  socket.on("draw", (data) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room || !room.gameStarted) return;
    if (room.drawerId !== socket.id) return;

    socket.to(roomCode).emit("draw", data);
  });

  socket.on("clearCanvas", () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room || room.drawerId !== socket.id) return;

    socket.to(roomCode).emit("clearCanvas");
  });

  socket.on("chatMessage", ({ message }) => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room || !message) return;

    const player = room.players.find(
      (p) => p.id === socket.id
    );

    if (!player) return;

    const text = message.trim().slice(0, 200);

    if (!text) return;

    if (
      room.gameStarted &&
      socket.id !== room.drawerId &&
      normalize(text) === normalize(room.movie)
    ) {
      finishRound(roomCode, socket.id);
      return;
    }

    io.to(roomCode).emit("chatMessage", {
      name: player.name,
      message: text,
      isSystem: false
    });
  });

  socket.on("nextRound", () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room) return;
    if (room.hostId !== socket.id) return;

    if (room.round >= room.totalRounds) {
      endGame(roomCode);
      return;
    }

    room.round++;
    room.drawerIndex =
      (room.drawerIndex + 1) % room.players.length;

    startRound(roomCode);
  });

  socket.on("playAgain", () => {
    const roomCode = socket.roomCode;
    const room = rooms[roomCode];

    if (!room) return;
    if (room.hostId !== socket.id) return;

    room.players.forEach((player) => {
      player.score = 0;
    });

    room.round = 1;
    room.drawerIndex = 0;
    room.gameStarted = true;
    room.gameOver = false;

    startRound(roomCode);
  });

  socket.on("disconnect", () => {
    const roomCode = socket.roomCode;

    if (!roomCode || !rooms[roomCode]) return;

    const room = rooms[roomCode];

    room.players = room.players.filter(
      (p) => p.id !== socket.id
    );

    if (room.players.length === 0) {
      clearInterval(room.timer);
      delete rooms[roomCode];
      return;
    }

    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    if (
      room.gameStarted &&
      room.drawerId === socket.id
    ) {
      clearInterval(room.timer);

      room.drawerIndex =
        room.drawerIndex % room.players.length;

      room.drawerId =
        room.players[room.drawerIndex].id;

      startRound(roomCode);
    }

    sendLobby(roomCode);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
