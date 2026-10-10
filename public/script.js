const socket = io();

let myId = null;
let myName = "";
let roomCode = "";
let hostId = null;

let isDrawer = false;
let currentMovie = "";
let currentRound = 1;
let totalRounds = 5;
let currentTime = 60;

let drawing = false;
let lastX = 0;
let lastY = 0;
let drawMode = "pen";

const socketId = () => socket.id;

const $ = (id) => document.getElementById(id);

// Screens
const homeScreen = $("homeScreen");
const lobbyScreen = $("lobbyScreen");
const gameScreen = $("gameScreen");
const gameOverScreen = $("gameOverScreen");

// Home
const nameInput = $("nameInput");
const roomInput = $("roomInput");
const createRoomBtn = $("createRoomBtn");
const joinRoomBtn = $("joinRoomBtn");
const homeError = $("homeError");

// Lobby
const roomCodeEl = $("roomCode");
const copyRoomBtn = $("copyRoomBtn");
const shareInviteBtn = $("shareInviteBtn");
const lobbyPlayers = $("lobbyPlayers");
const startBtn = $("startBtn");
const lobbyError = $("lobbyError");
const lobbyInfo = $("lobbyInfo");

// Game
const gameRoomCode = $("gameRoomCode");
const roundText = $("roundText");
const timerEl = $("timer");
const movieStatus = $("movieStatus");
const drawerInfo = $("drawerInfo");
const scoreboard = $("scoreboard");

// Canvas
const canvas = $("drawingCanvas");
const ctx = canvas.getContext("2d");

const penBtn = $("penBtn");
const eraserBtn = $("eraserBtn");
const clearBtn = $("clearBtn");
const colorPicker = $("colorPicker");
const brushSize = $("brushSize");

// Chat
const chatMessages = $("chatMessages");
const chatForm = $("chatForm");
const chatInput = $("chatInput");

// Round modal
const roundModal = $("roundModal");
const revealedMovie = $("revealedMovie");
const roundWinner = $("roundWinner");
const nextRoundBtn = $("nextRoundBtn");
const nextRoundInfo = $("nextRoundInfo");

// Game over
const finalScoreboard = $("finalScoreboard");
const playAgainBtn = $("playAgainBtn");

// -------------------------
// Utility
// -------------------------

function showScreen(screen) {
    [homeScreen, lobbyScreen, gameScreen, gameOverScreen].forEach((s) => {
        s.classList.remove("active");
    });

    screen.classList.add("active");
}

function showError(element, message) {
    element.textContent = message || "";

    if (message) {
        setTimeout(() => {
            element.textContent = "";
        }, 4000);
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
}

function setButtonVisible(button, visible) {
    if (!button) return;
    button.style.display = visible ? "" : "none";
}

// -------------------------
// Canvas
// -------------------------

function resizeCanvas() {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    const oldCanvas = document.createElement("canvas");
    oldCanvas.width = canvas.width;
    oldCanvas.height = canvas.height;

    if (canvas.width && canvas.height) {
        oldCanvas
            .getContext("2d")
            .drawImage(canvas, 0, 0);
    }

    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (oldCanvas.width && oldCanvas.height) {
        ctx.drawImage(
            oldCanvas,
            0,
            0,
            oldCanvas.width,
            oldCanvas.height,
            0,
            0,
            canvas.width,
            canvas.height
        );
    }
}

function clearLocalCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getPointerPosition(event) {
    const rect = canvas.getBoundingClientRect();

    let clientX;
    let clientY;

    if (event.touches && event.touches.length) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function drawLine(x1, y1, x2, y2, color, size, mode = "pen") {
    ctx.save();

    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = color;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
}

function drawFromData(data) {
    if (!data) return;

    const x1 = data.x1 * canvas.width;
    const y1 = data.y1 * canvas.height;
    const x2 = data.x2 * canvas.width;
    const y2 = data.y2 * canvas.height;

    drawLine(
        x1,
        y1,
        x2,
        y2,
        data.color,
        data.size,
        data.mode
    );
}

// -------------------------
// Drawing events
// -------------------------

function startDrawing(event) {
    if (!isDrawer) return;

    event.preventDefault();

    const pos = getPointerPosition(event);

    drawing = true;
    lastX = pos.x;
    lastY = pos.y;
}

function moveDrawing(event) {
    if (!drawing || !isDrawer) return;

    event.preventDefault();

    const pos = getPointerPosition(event);

    const x1 = lastX;
    const y1 = lastY;
    const x2 = pos.x;
    const y2 = pos.y;

    const color = colorPicker.value;
    const size = Number(brushSize.value);

    drawLine(
        x1,
        y1,
        x2,
        y2,
        color,
        size,
        drawMode
    );

    socket.emit("draw", {
        x1: x1 / canvas.width,
        y1: y1 / canvas.height,
        x2: x2 / canvas.width,
        y2: y2 / canvas.height,
        color,
        size,
        mode: drawMode
    });

    lastX = x2;
    lastY = y2;
}

function stopDrawing() {
    drawing = false;
}

canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mousemove", moveDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseleave", stopDrawing);

canvas.addEventListener(
    "touchstart",
    startDrawing,
    { passive: false }
);

canvas.addEventListener(
    "touchmove",
    moveDrawing,
    { passive: false }
);

canvas.addEventListener(
    "touchend",
    stopDrawing
);

// -------------------------
// Drawing tools
// -------------------------

penBtn.addEventListener("click", () => {
    drawMode = "pen";

    penBtn.classList.add("active");
    eraserBtn.classList.remove("active");
});

eraserBtn.addEventListener("click", () => {
    drawMode = "eraser";

    eraserBtn.classList.add("active");
    penBtn.classList.remove("active");
});

clearBtn.addEventListener("click", () => {
    if (!isDrawer) return;

    clearLocalCanvas();
    socket.emit("clearCanvas");
});

// -------------------------
// Create Room
// -------------------------

createRoomBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();

    if (!name) {
        showError(homeError, "Please enter your name.");
        nameInput.focus();
        return;
    }

    myName = name;

    socket.emit("createRoom", {
        name
    });
});

// -------------------------
// Join Room
// -------------------------

joinRoomBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const code = roomInput.value.trim().toUpperCase();

    if (!name) {
        showError(homeError, "Please enter your name.");
        nameInput.focus();
        return;
    }

    if (!code || code.length !== 4) {
        showError(homeError, "Enter a valid 4-character room code.");
        roomInput.focus();
        return;
    }

    myName = name;
    roomCode = code;

    socket.emit("joinRoom", {
        name,
        roomCode: code
    });
});

// Enter key
nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        createRoomBtn.click();
    }
});

roomInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        joinRoomBtn.click();
    }
});

// -------------------------
// Room Created
// -------------------------

socket.on("roomCreated", (data) => {
    roomCode = data.roomCode;

    showScreen(lobbyScreen);

    roomCodeEl.textContent = roomCode;
    lobbyInfo.textContent = "Share this room code with your friends.";

    showError(lobbyError, "");
});

// -------------------------
// Room Joined
// -------------------------

socket.on("roomJoined", (data) => {
    roomCode = data.roomCode;

    showScreen(lobbyScreen);

    roomCodeEl.textContent = roomCode;

    lobbyInfo.textContent =
        "Waiting for the host to start the game...";

    showError(lobbyError, "");
});

// -------------------------
// Lobby Update
// -------------------------

socket.on("lobbyUpdate", (data) => {
    hostId = data.hostId;

    roomCode = data.roomCode || roomCode;

    roomCodeEl.textContent = roomCode;

    lobbyPlayers.innerHTML = "";

    data.players.forEach((player) => {
        const playerDiv = document.createElement("div");

        playerDiv.className = "player-item";

        const hostText =
            player.id === hostId ? " 👑 Host" : "";

        playerDiv.innerHTML = `
            <span>🎬 ${escapeHtml(player.name)}</span>
            <span>${hostText}</span>
        `;

        lobbyPlayers.appendChild(playerDiv);
    });

    const isHost = socketId() === hostId;

    setButtonVisible(startBtn, isHost);

    if (isHost) {
        if (data.players.length >= 2) {
            startBtn.disabled = false;
            lobbyInfo.textContent =
                "You are the host. Start the game when everyone is ready.";
        } else {
            startBtn.disabled = true;
            lobbyInfo.textContent =
                "Waiting for at least 2 players...";
        }
    } else {
        startBtn.disabled = true;
        lobbyInfo.textContent =
            "Waiting for the host to start the game...";
    }
});

// -------------------------
// Copy Room Code
// -------------------------

copyRoomBtn.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(roomCode);

        const oldText = copyRoomBtn.textContent;

        copyRoomBtn.textContent = "✅ Copied!";

        setTimeout(() => {
            copyRoomBtn.textContent = oldText;
        }, 1500);

    } catch (error) {
        alert("Room Code: " + roomCode);
    }
});

// -------------------------
// Share Invite Link
// -------------------------

function getInviteLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    url.hash = "";
    return url.toString();
}

shareInviteBtn.addEventListener("click", async () => {
    if (!roomCode) return;

    const inviteLink = getInviteLink();

    try {
        if (navigator.share) {
            await navigator.share({
                title: "Bollywood Draw & Guess",
                text: "Join my Bollywood movie guessing game!",
                url: inviteLink
            });
        } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(inviteLink);
            alert("Invite link copied! Share it on WhatsApp.");
        } else {
            window.prompt("Copy and share this invite link:", inviteLink);
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            window.prompt("Copy and share this invite link:", inviteLink);
        }
    }
});

// -------------------------
// Start Game
// -------------------------

startBtn.addEventListener("click", () => {
    if (socketId() !== hostId) return;

    socket.emit("startGame");
});

// -------------------------
// Round Start
// -------------------------

socket.on("roundStart", (data) => {
    showScreen(gameScreen);

    currentRound = data.round;
    totalRounds = data.totalRounds;
    currentTime = data.timeLeft;

    isDrawer = data.drawerId === socketId();

    gameRoomCode.textContent = roomCode;

    roundText.textContent =
        `Round ${currentRound} / ${totalRounds}`;

    timerEl.textContent = currentTime;

    clearLocalCanvas();

    roundModal.classList.add("hidden");

    if (isDrawer) {
        movieStatus.textContent =
            "🎬 Your movie is loading...";

        drawerInfo.textContent =
            "You are drawing! Make others guess the movie.";

        canvas.style.cursor = "crosshair";
    } else {
        movieStatus.textContent =
            "🎭 Guess the Bollywood movie!";

        drawerInfo.textContent =
            "Watch the drawing and type your guess.";

        canvas.style.cursor = "default";
    }

    updateDrawingTools();
});

// -------------------------
// Drawer Status
// -------------------------

socket.on("drawerStatus", (data) => {
    isDrawer = data.isDrawer;

    if (isDrawer) {
        currentMovie = data.movie || "";

        movieStatus.innerHTML =
            `🎬 <strong>Your movie:</strong> ${escapeHtml(currentMovie)}`;

        drawerInfo.textContent =
            "Draw clues without writing the movie name.";

        chatInput.placeholder =
            "Chat with players...";

        canvas.style.cursor = "crosshair";

    } else {
        currentMovie = "";

        movieStatus.textContent =
            "🎭 Guess the Bollywood movie!";

        drawerInfo.textContent =
            "Type your guess in the chat.";

        chatInput.placeholder =
            "Guess the movie...";

        canvas.style.cursor = "default";
    }

    updateDrawingTools();
});

function updateDrawingTools() {
    const visible = isDrawer;

    setButtonVisible(penBtn, visible);
    setButtonVisible(eraserBtn, visible);
    setButtonVisible(clearBtn, visible);
    setButtonVisible(colorPicker, visible);
    setButtonVisible(brushSize, visible);
}

// -------------------------
// Timer
// -------------------------

socket.on("timer", (time) => {
    currentTime = time;

    timerEl.textContent = time;

    if (time <= 10) {
        timerEl.classList.add("danger");
    } else {
        timerEl.classList.remove("danger");
    }
});

// -------------------------
// Drawing received
// -------------------------

socket.on("draw", (data) => {
    drawFromData(data);
});

// -------------------------
// Clear Canvas
// -------------------------

socket.on("clearCanvas", () => {
    clearLocalCanvas();
});

// -------------------------
// Chat
// -------------------------

chatForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const message = chatInput.value.trim();

    if (!message) return;

    socket.emit("chatMessage", {
        message
    });

    chatInput.value = "";
    chatInput.focus();
});

socket.on("chatMessage", (data) => {
    const messageDiv = document.createElement("div");

    messageDiv.className = "chat-message";

    messageDiv.innerHTML = `
        <strong>${escapeHtml(data.name)}:</strong>
        <span>${escapeHtml(data.message)}</span>
    `;

    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop =
        chatMessages.scrollHeight;
});

// -------------------------
// Scoreboard
// -------------------------

function renderScoreboard(players) {
    scoreboard.innerHTML = "";

    const sortedPlayers = [...players].sort(
        (a, b) => b.score - a.score
    );

    sortedPlayers.forEach((player, index) => {
        const div = document.createElement("div");

        div.className = "score-item";

        let medal = "";

        if (index === 0) medal = "🥇";
        else if (index === 1) medal = "🥈";
        else if (index === 2) medal = "🥉";
        else medal = `${index + 1}.`;

        div.innerHTML = `
            <span>
                ${medal} ${escapeHtml(player.name)}
            </span>
            <strong>${player.score}</strong>
        `;

        scoreboard.appendChild(div);
    });
}

// -------------------------
// Round End
// -------------------------

socket.on("roundEnd", (data) => {
    isDrawer = false;

    updateDrawingTools();

    revealedMovie.textContent =
        data.movie || "Unknown";

    if (data.winnerName) {
        roundWinner.textContent =
            `🎉 ${escapeHtml(data.winnerName)} guessed it!`;
    } else {
        roundWinner.textContent =
            "😢 Nobody guessed the movie.";
    }

    renderScoreboard(data.players || []);

    roundModal.classList.remove("hidden");

    const isHost = socketId() === hostId;

    if (isHost) {
        nextRoundBtn.style.display = "";
        nextRoundInfo.textContent =
            "As host, click Next Round to continue.";
    } else {
        nextRoundBtn.style.display = "none";
        nextRoundInfo.textContent =
            "Waiting for the host...";
    }
});

// -------------------------
// Next Round
// -------------------------

nextRoundBtn.addEventListener("click", () => {
    if (socketId() !== hostId) return;

    nextRoundBtn.disabled = true;

    socket.emit("nextRound");

    setTimeout(() => {
        nextRoundBtn.disabled = false;
    }, 1500);
});

// -------------------------
// Game Over
// -------------------------

socket.on("gameOver", (data) => {
    roundModal.classList.add("hidden");

    showScreen(gameOverScreen);

    finalScoreboard.innerHTML = "";

    const players = [...data.players].sort(
        (a, b) => b.score - a.score
    );

    players.forEach((player, index) => {
        const div = document.createElement("div");

        div.className = "final-player";

        let position = "";

        if (index === 0) position = "🏆";
        else if (index === 1) position = "🥈";
        else if (index === 2) position = "🥉";
        else position = `${index + 1}`;

        div.innerHTML = `
            <span>
                ${position} ${escapeHtml(player.name)}
            </span>
            <strong>${player.score} pts</strong>
        `;

        finalScoreboard.appendChild(div);
    });

    const isHost = socketId() === hostId;

    setButtonVisible(playAgainBtn, isHost);
});

// -------------------------
// Play Again
// -------------------------

playAgainBtn.addEventListener("click", () => {
    if (socketId() !== hostId) return;

    playAgainBtn.disabled = true;

    socket.emit("playAgain");

    setTimeout(() => {
        playAgainBtn.disabled = false;
    }, 1500);
});

// -------------------------
// Error From Server
// -------------------------

socket.on("errorMessage", (message) => {
    const text =
        typeof message === "string"
            ? message
            : message?.message || "Something went wrong.";

    if (lobbyScreen.classList.contains("active")) {
        showError(lobbyError, text);
    } else {
        showError(homeError, text);
    }
});

// -------------------------
// Connection
// -------------------------

socket.on("connect", () => {
    myId = socket.id;
});

socket.on("disconnect", () => {
    console.log("Disconnected from server.");
});

// -------------------------
// Window Resize
// -------------------------

window.addEventListener("resize", () => {
    resizeCanvas();
});

// -------------------------
// Initial Setup
// -------------------------
// -------------------------
// Join from Invite Link
// -------------------------

const inviteRoomCode = new URLSearchParams(
    window.location.search
).get("room");

if (inviteRoomCode) {
    const code = inviteRoomCode.trim().toUpperCase();

    if (/^[A-Z0-9]{4}$/.test(code)) {
        roomInput.value = code;
        nameInput.focus();
        showError(homeError, "Invite link detected! Enter your name and tap Join Room.");
    }
}
setTimeout(() => {
    resizeCanvas();
}, 100);

updateDrawingTools();
