const socket = io();

let myId = null, myName = "", roomCode = "", hostId = null;
let isDrawer = false, currentMovie = "", currentRound = 1, totalRounds = 5, currentTime = 60;
let drawing = false, lastX = 0, lastY = 0, drawMode = "pen", choicePending = false;

const $ = id => document.getElementById(id);

const homeScreen = $("homeScreen");
const lobbyScreen = $("lobbyScreen");
const gameScreen = $("gameScreen");
const gameOverScreen = $("gameOverScreen");

const nameInput = $("nameInput");
const roomInput = $("roomInput");
const createRoomBtn = $("createRoomBtn");
const joinRoomBtn = $("joinRoomBtn");
const homeError = $("homeError");

const roomCodeEl = $("roomCode");
const copyRoomBtn = $("copyRoomBtn");
const shareInviteBtn = $("shareInviteBtn");
const lobbyPlayers = $("lobbyPlayers");
const startBtn = $("startBtn");
const lobbyError = $("lobbyError");
const lobbyInfo = $("lobbyInfo");

const roundDuration = $("roundDuration");
const totalRoundsSelect = $("totalRounds");
const hostSettings = $("hostSettings");

const gameRoomCode = $("gameRoomCode");
const roundText = $("roundText");
const timerEl = $("timer");
const movieStatus = $("movieStatus");
const drawerInfo = $("drawerInfo");
const scoreboard = $("scoreboard");

const canvas = $("drawingCanvas");
const ctx = canvas.getContext("2d");
const canvasEmpty = $("canvasEmpty");

const penBtn = $("penBtn");
const eraserBtn = $("eraserBtn");
const clearBtn = $("clearBtn");
const colorPicker = $("colorPicker");
const brushSize = $("brushSize");

const chatMessages = $("chatMessages");
const chatForm = $("chatForm");
const chatInput = $("chatInput");
const guessFeedback = $("guessFeedback");

const roundResults = $("roundResults");
const revealedMovie = $("revealedMovie");
const roundWinner = $("roundWinner");
const nextRoundBtn = $("nextRoundBtn");
const nextRoundInfo = $("nextRoundInfo");
const roundScoreboard = $("roundScoreboard");
const resultHeadline = $("resultHeadline");

const finalScoreboard = $("finalScoreboard");
const playAgainBtn = $("playAgainBtn");
const returnLobbyBtn = $("returnLobbyBtn");

const choiceModal = $("choiceModal");
const movieChoices = $("movieChoices");
const choiceWait = $("choiceWait");

function showScreen(screen) {
    [homeScreen, lobbyScreen, gameScreen, gameOverScreen]
        .forEach(s => s.classList.remove("active"));
    screen.classList.add("active");
}

function showError(el, msg) {
    el.textContent = msg || "";
    if (msg) {
        setTimeout(() => {
            if (el.textContent === msg) el.textContent = "";
        }, 4000);
    }
}

function setVisible(el, yes) {
    if (el) el.style.display = yes ? "" : "none";
}

function addSystem(message) {
    const d = document.createElement("div");
    d.className = "system-line";
    d.textContent = message;
    chatMessages.appendChild(d);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChat(name, message, kind = "") {
    const d = document.createElement("div");
    d.className = "chat-message " + kind;

    const strong = document.createElement("strong");
    strong.textContent = name ? name + ": " : "";

    const span = document.createElement("span");
    span.textContent = message;

    d.append(strong, span);
    chatMessages.appendChild(d);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function clearLocalCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvasEmpty.classList.remove("is-hidden");
}

function resizeCanvas() {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const old = document.createElement("canvas");
    old.width = canvas.width;
    old.height = canvas.height;

    if (old.width && old.height) {
        old.getContext("2d").drawImage(canvas, 0, 0);
    }

    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (old.width && old.height) {
        ctx.drawImage(
            old, 0, 0, old.width, old.height,
            0, 0, canvas.width, canvas.height
        );
    }
}

function pointerPos(event) {
    const r = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - r.left) * canvas.width / r.width,
        y: (event.clientY - r.top) * canvas.height / r.height
    };
}

function drawLine(x1, y1, x2, y2, color, size, mode = "pen") {
    ctx.save();

    ctx.lineWidth = size * Math.max(1, window.devicePixelRatio || 1);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalCompositeOperation =
        mode === "eraser" ? "destination-out" : "source-over";

    ctx.strokeStyle =
        mode === "eraser" ? "rgba(0,0,0,1)" : color;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.restore();
}

function drawFromData(data) {
    if (!data) return;

    drawLine(
        data.x1 * canvas.width,
        data.y1 * canvas.height,
        data.x2 * canvas.width,
        data.y2 * canvas.height,
        data.color,
        data.size,
        data.mode
    );

    canvasEmpty.classList.add("is-hidden");
}

function startDrawing(event) {
    if (!isDrawer || !currentMovie ||
        !roundResults.classList.contains("hidden")) return;

    event.preventDefault();

    if (canvas.setPointerCapture && event.pointerId !== undefined) {
        try {
            canvas.setPointerCapture(event.pointerId);
        } catch {}
    }

    const p = pointerPos(event);

    drawing = true;
    lastX = p.x;
    lastY = p.y;

    canvasEmpty.classList.add("is-hidden");
}

function moveDrawing(event) {
    if (!drawing || !isDrawer) return;

    event.preventDefault();

    const samples = typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : [event];

    for (const sample of samples) {
        const p = pointerPos(sample);
        const color = colorPicker.value;
        const size = Number(brushSize.value);

        drawLine(lastX, lastY, p.x, p.y, color, size, drawMode);

        socket.emit("draw", {
            x1: lastX / canvas.width,
            y1: lastY / canvas.height,
            x2: p.x / canvas.width,
            y2: p.y / canvas.height,
            color,
            size,
            mode: drawMode
        });

        lastX = p.x;
        lastY = p.y;
    }
}

function stopDrawing() {
    drawing = false;
}

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", moveDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("lostpointercapture", stopDrawing);

function updateDrawingTools() {
    [penBtn, eraserBtn, clearBtn, colorPicker, brushSize]
        .forEach(el => setVisible(el, isDrawer));

    chatInput.disabled = isDrawer;
    chatInput.placeholder = isDrawer
        ? "You're drawing this round"
        : "Type your guess...";
}

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

function getName() {
    const name = nameInput.value.trim();

    if (!name) {
        showError(homeError, "Enter your name first.");
        nameInput.focus();
        return null;
    }

    return name;
}

createRoomBtn.addEventListener("click", () => {
    const name = getName();
    if (!name) return;

    myName = name;
    socket.emit("createRoom", { name });
});

joinRoomBtn.addEventListener("click", () => {
    const name = getName();
    const code = roomInput.value.trim().toUpperCase();

    if (!name) return;

    if (!/^[A-Z0-9]{4}$/.test(code)) {
        showError(homeError, "Enter a valid 4-character room code.");
        roomInput.focus();
        return;
    }

    myName = name;
    roomCode = code;

    socket.emit("joinRoom", { name, roomCode: code });
});

nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") createRoomBtn.click();
});

roomInput.addEventListener("input", () => {
    roomInput.value = roomInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
});

roomInput.addEventListener("keydown", event => {
    if (event.key === "Enter") joinRoomBtn.click();
});

$("backHomeBtn").addEventListener("click", () => {
    showScreen(homeScreen);
});

socket.on("roomCreated", data => {
    roomCode = data.roomCode;
    showScreen(lobbyScreen);
    roomCodeEl.textContent = roomCode;
    showError(lobbyError, "");
});

socket.on("roomJoined", data => {
    roomCode = data.roomCode;
    showScreen(lobbyScreen);
    roomCodeEl.textContent = roomCode;
    showError(lobbyError, "");
});

socket.on("lobbyUpdate", data => {
    hostId = data.hostId;
    roomCode = data.roomCode || roomCode;
    roomCodeEl.textContent = roomCode;

    lobbyPlayers.innerHTML = "";
    $("playerCount").textContent = `${data.players.length} / 12`;

    data.players.forEach((player, i) => {
        const row = document.createElement("div");
        row.className = "player-item";

        const left = document.createElement("span");
        left.textContent = `${i === 0 ? "🎬" : "🎭"} ${player.name}`;

        const right = document.createElement("span");
        right.className = "player-role";
        right.textContent = player.id === hostId ? "👑 HOST" : "READY";

        row.append(left, right);
        lobbyPlayers.appendChild(row);
    });

    const isHost = socket.id === hostId;

    setVisible(startBtn, isHost);
    setVisible(hostSettings, isHost);

    if (isHost) {
        if (data.players.length >= 2) {
            startBtn.disabled = false;
            lobbyInfo.textContent =
                "Your room is ready. Start when your crew is here.";
        } else {
            startBtn.disabled = true;
            lobbyInfo.textContent =
                "Invite at least one friend to start playing.";
        }
    } else {
        startBtn.disabled = true;
        lobbyInfo.textContent = "You're in! Waiting for the host to start.";
    }

    if (data.roundDuration) roundDuration.value = String(data.roundDuration);
    if (data.totalRounds) totalRoundsSelect.value = String(data.totalRounds);
});

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

copyRoomBtn.addEventListener("click", async () => {
    if (await copyText(roomCode)) {
        copyRoomBtn.textContent = "✓";
        setTimeout(() => copyRoomBtn.textContent = "▣", 1400);
    } else {
        window.prompt("Copy room code:", roomCode);
    }
});

function inviteLink() {
    const url = new URL(location.href);
    url.searchParams.set("room", roomCode);
    url.hash = "";
    return url.toString();
}

shareInviteBtn.addEventListener("click", async () => {
    if (!roomCode) return;

    const url = inviteLink();

    try {
        if (navigator.share) {
            await navigator.share({
                title: "CineDraw",
                text: "Join my CineDraw Bollywood guessing game!",
                url
            });
        } else if (await copyText(url)) {
            shareInviteBtn.textContent = "✓ Link copied!";
            setTimeout(() => {
                shareInviteBtn.textContent = "🔗 Share invite link";
            }, 1600);
        } else {
            window.prompt("Copy invite link:", url);
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            window.prompt("Copy invite link:", url);
        }
    }
});

function updateSettings() {
    socket.emit("setGameSettings", {
        roundDuration: Number(roundDuration.value),
        totalRounds: Number(totalRoundsSelect.value)
    });
}

roundDuration.addEventListener("change", updateSettings);
totalRoundsSelect.addEventListener("change", updateSettings);

startBtn.addEventListener("click", () => {
    if (socket.id === hostId) socket.emit("startGame");
});

socket.on("roundStart", data => {
    showScreen(gameScreen);

    currentRound = data.round;
    totalRounds = data.totalRounds;
    currentTime = data.timeLeft;
    isDrawer = data.drawerId === socket.id;
    currentMovie = "";

    gameRoomCode.textContent = roomCode;
    roundText.textContent = `ROUND ${currentRound} / ${totalRounds}`;
    timerEl.textContent = currentTime;
    timerEl.classList.remove("danger");

    roundResults.classList.add("hidden");
    choiceModal.classList.add("hidden");
    choicePending = false;

    clearLocalCanvas();
    chatMessages.innerHTML = "";
    guessFeedback.textContent = "";
    guessFeedback.classList.remove("visible");

    movieStatus.textContent = isDrawer
        ? "Choose your movie below"
        : "🎭 Guess the Bollywood movie!";

    drawerInfo.textContent = isDrawer
        ? "Pick one of three films, then draw clues."
        : "Watch the canvas and type your guess.";

    updateDrawingTools();
    renderScoreboard([]);

    if (isDrawer) {
        choicePending = true;
        choiceWait.textContent = "";
        choiceModal.classList.remove("hidden");
        movieChoices.innerHTML =
            "<p class='choice-loading'>Loading movie choices…</p>";
    } else {
        addSystem("A new round has started. Good luck!");
    }

    setTimeout(resizeCanvas, 40);
});

socket.on("drawerStatus", data => {
    isDrawer = Boolean(data.isDrawer);

    if (isDrawer && data.movie) {
        currentMovie = data.movie;
        movieStatus.textContent = `🎬 Your movie: ${currentMovie}`;
        drawerInfo.textContent = "Draw clues without writing the title.";
        chatInput.placeholder = "You're drawing this round";
    } else if (!isDrawer) {
        currentMovie = "";
        movieStatus.textContent = "🎭 Guess the Bollywood movie!";
        drawerInfo.textContent = "Type your guess in the chat.";
    }

    updateDrawingTools();
});

socket.on("movieChoices", data => {
    if (!isDrawer) return;

    movieChoices.innerHTML = "";

    (data.choices || []).forEach(title => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "movie-choice";
        button.textContent = title;

        button.addEventListener("click", () => {
            if (!choicePending) return;

            choicePending = false;
            currentMovie = title;
            choiceModal.classList.add("hidden");

            movieStatus.textContent = `🎬 Your movie: ${title}`;
            drawerInfo.textContent = "Draw clues without writing the title.";

            socket.emit("chooseMovie", { movie: title });
            updateDrawingTools();
        });

        movieChoices.appendChild(button);
    });
});

socket.on("movieChosen", data => {
    if (!isDrawer) {
        movieStatus.textContent = `🎭 Movie title: ${data.hint}`;
        drawerInfo.textContent = "Guess the movie from the drawing!";
    }
});

socket.on("timer", data => {
    currentTime = typeof data === "number"
        ? data
        : Number(data?.timeLeft ?? 60);

    timerEl.textContent = currentTime;
    timerEl.classList.toggle("danger", currentTime <= 10);
});

socket.on("draw", data => drawFromData(data));

socket.on("clearCanvas", clearLocalCanvas);

chatForm.addEventListener("submit", event => {
    event.preventDefault();

    const message = chatInput.value.trim();
    if (!message || isDrawer) return;

    socket.emit("chatMessage", { message });
    chatInput.value = "";
    chatInput.focus();
});

socket.on("chatMessage", data => {
    addChat(data.name, data.message);
});

socket.on("systemMessage", data => {
    addSystem(data.message);
});

socket.on("guessFeedback", data => {
    guessFeedback.textContent = data.message || "";
    guessFeedback.classList.add("visible");

    setTimeout(() => {
        guessFeedback.classList.remove("visible");
        guessFeedback.textContent = "";
    }, 2200);
});

socket.on("correctGuess", data => {
    addChat("🎉", `${data.name} guessed the movie!`, "correct-message");
    guessFeedback.textContent = "Correct guess!";
    guessFeedback.classList.add("visible");
});

function renderScoreboard(players) {
    scoreboard.innerHTML = "";

    [...(players || [])]
        .sort((a, b) => b.score - a.score)
        .forEach((player, i) => {
            const row = document.createElement("div");
            row.className = "score-item";

            const name = document.createElement("span");
            name.textContent =
                `${i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} ${player.name}`;

            const score = document.createElement("strong");
            score.textContent = player.score;

            row.append(name, score);
            scoreboard.appendChild(row);
        });
}

function renderRoundScoreboard(players) {
    roundScoreboard.innerHTML = "";

    [...(players || [])]
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .forEach((player, i) => {
            const row = document.createElement("div");
            row.className = "round-score-row";

            const name = document.createElement("span");
            name.textContent = `${i + 1}. ${player.name}`;

            const score = document.createElement("strong");
            score.textContent = `${player.score} pts`;

            row.append(name, score);
            roundScoreboard.appendChild(row);
        });
}

socket.on("roundEnd", data => {
    isDrawer = false;
    drawing = false;
    updateDrawingTools();
    currentMovie = "";

    revealedMovie.textContent = data.movie || "Unknown";
    resultHeadline.textContent = data.winnerName
        ? "Someone cracked the code!"
        : "Time's up!";

    roundWinner.textContent = data.winnerName
        ? `🎉 ${data.winnerName} guessed correctly.`
        : "No correct guesses this round.";

    renderScoreboard(data.players || []);
    renderRoundScoreboard(data.players || []);

    roundResults.classList.remove("hidden");
    nextRoundBtn.disabled = false;

    if (socket.id === hostId) {
        nextRoundBtn.style.display = "";
        nextRoundBtn.textContent =
            data.round >= data.totalRounds
                ? "See final scores →"
                : "Next round →";

        nextRoundInfo.textContent = "You're the host. Continue when ready.";
    } else {
        nextRoundBtn.style.display = "none";
        nextRoundInfo.textContent = "Waiting for the host to continue…";
    }

    addSystem(
        data.winnerName
            ? `${data.winnerName} guessed it! The movie was ${data.movie}.`
            : `Time's up! The movie was ${data.movie}.`
    );
});

nextRoundBtn.addEventListener("click", () => {
    if (socket.id !== hostId) return;

    nextRoundBtn.disabled = true;
    socket.emit("nextRound");

    setTimeout(() => {
        nextRoundBtn.disabled = false;
    }, 1200);
});

socket.on("gameOver", data => {
    roundResults.classList.add("hidden");
    showScreen(gameOverScreen);
    finalScoreboard.innerHTML = "";

    [...(data.players || [])]
        .sort((a, b) => b.score - a.score)
        .forEach((player, i) => {
            const row = document.createElement("div");
            row.className = "final-player";

            const name = document.createElement("span");
            name.textContent =
                `${i === 0 ? "🏆" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`} ${player.name}`;

            const score = document.createElement("strong");
            score.textContent = `${player.score} pts`;

            row.append(name, score);
            finalScoreboard.appendChild(row);
        });

    setVisible(playAgainBtn, socket.id === hostId);
    setVisible(returnLobbyBtn, socket.id === hostId);
});

playAgainBtn.addEventListener("click", () => {
    if (socket.id !== hostId) return;

    playAgainBtn.disabled = true;
    socket.emit("playAgain");

    setTimeout(() => {
        playAgainBtn.disabled = false;
    }, 1200);
});

returnLobbyBtn.addEventListener("click", () => {
    if (socket.id === hostId) socket.emit("backToLobby");
});

socket.on("returnedToLobby", () => {
    showScreen(lobbyScreen);
});

socket.on("errorMessage", message => {
    const text = typeof message === "string"
        ? message
        : message?.message || "Something went wrong.";

    if (lobbyScreen.classList.contains("active")) {
        showError(lobbyError, text);
    } else {
        showError(homeError, text);
    }
});

socket.on("connect", () => {
    myId = socket.id;
});

socket.on("disconnect", () => {
    if (gameScreen.classList.contains("active")) {
        addSystem("Connection lost. Reconnect to continue.");
    }
});

window.addEventListener("resize", resizeCanvas);

const inviteRoomCode = new URLSearchParams(location.search).get("room");

if (inviteRoomCode && /^[A-Z0-9]{4}$/i.test(inviteRoomCode)) {
    roomInput.value = inviteRoomCode.toUpperCase();
    showError(homeError, "Invite link detected — enter your name, then join.");
}

setTimeout(resizeCanvas, 120);
updateDrawingTools();
