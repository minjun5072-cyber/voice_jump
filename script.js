import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC81ohde3CabZYlwl22fRheWrnIZ2iEXQg",
  authDomain: "voice-jump.firebaseapp.com",
  projectId: "voice-jump",
  storageBucket: "voice-jump.firebasestorage.app",
  messagingSenderId: "1082743184775",
  appId: "1:1082743184775:web:b8edf25cd4cb226948c722",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const rankBtn = document.getElementById("rankBtn");

const player = document.getElementById("player");
const obstacle = document.getElementById("obstacle");

const statusText = document.getElementById("status");
const scoreText = document.getElementById("score");
const bestScoreText = document.getElementById("bestScore");

const rankingBox = document.getElementById("rankingBox");
const rankingList = document.getElementById("rankingList");

const playerNameInput = document.getElementById("playerName");
const countdownText = document.getElementById("countdown");

const jumpSound = new Audio("./jump.mp3");
jumpSound.volume = 0.5;

startBtn.addEventListener("click", async () => {
  await jumpSound.play().catch(() => {});
  jumpSound.pause();
  jumpSound.currentTime = 0;
});

const rankModal = document.getElementById("rankModal");
const closeRankBtn = document.getElementById("closeRankBtn");

let playerY = 0;
let velocityY = 0;
let gravity = 0.7;
let isGameOver = false;
let isJumping = false;
let gameStarted = false;

let score = 0;
let obstacleSpeed = 4;

let bestScore = localStorage.getItem("bestScore") || 0;
bestScoreText.innerText = bestScore;

let savedName = localStorage.getItem("savedPlayerName");

if (savedName) {
  playerNameInput.value = savedName;
  playerNameInput.disabled = true;
}

function updatePlayer() {
  velocityY -= gravity;
  playerY += velocityY;

  if (playerY < 0) {
    playerY = 0;
    velocityY = 0;
    isJumping = false;
    player.style.transform = "scale(1)";
  }

  player.style.bottom = playerY + "px";
}

function jump(power) {
  if (!isJumping && gameStarted) {
    velocityY = power;
    isJumping = true;

    player.style.transform = "scale(1.1) rotate(-8deg)";

    jumpSound.currentTime = 0;
    jumpSound.play();
  }
}

function moveObstacle() {
  let obstacleX = parseInt(window.getComputedStyle(obstacle).right);

  obstacleX += obstacleSpeed;

  if (obstacleX > window.innerWidth) {
    obstacleX = -300;

    const randomHeight = Math.floor(Math.random() * 80) + 40;
    obstacle.style.height = randomHeight + "px";

    score++;
    scoreText.innerText = score;

    if (score % 5 === 0) {
      obstacleSpeed += 1;
    }
  }

  obstacle.style.right = obstacleX + "px";

  checkCollision();
}

async function saveScore() {
  const name = playerNameInput.value.trim();
if (!savedName) {
  localStorage.setItem("savedPlayerName", name);
}
  if (!name) return;

  const userRef = doc(db, "rankings", name);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      name: name,
      score: score,
    });
    return;
  }

  const oldScore = userSnap.data().score;

  if (score > oldScore) {
    await setDoc(userRef, {
      name: name,
      score: score,
    });
  }
}

async function loadRanking() {
  rankingList.innerHTML = "";

  const myName = playerNameInput.value.trim();

  const q = query(
    collection(db, "rankings"),
    orderBy("score", "desc"),
    limit(10),
  );

  const snapshot = await getDocs(q);

  let rank = 1;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();

    const li = document.createElement("li");

    let medal = "";

    if (rank === 1) {
      medal = "🥇 ";
    } else if (rank === 2) {
      medal = "🥈 ";
    } else if (rank === 3) {
      medal = "🥉 ";
    }

    li.innerText = `${medal}${rank}. ${data.name} - ${data.score}`;

    if (data.name === myName) {
      li.classList.add("my-rank");
    }

    rankingList.appendChild(li);
    rank++;
  });

  rankModal.style.display = "block";
}

async function checkCollision() {
  const playerRect = player.getBoundingClientRect();
  const obstacleRect = obstacle.getBoundingClientRect();

  if (
    playerRect.left < obstacleRect.right &&
    playerRect.right > obstacleRect.left &&
    playerRect.bottom > obstacleRect.top
  ) {
    isGameOver = true;
    statusText.innerText = "게임 오버";

    if (score > bestScore) {
      localStorage.setItem("bestScore", score);
      bestScoreText.innerText = score;
    }

    await saveScore();

    restartBtn.style.display = "inline-block";
  }
}

function gameLoop() {
  if (isGameOver || !gameStarted) return;

  updatePlayer();
  moveObstacle();

  requestAnimationFrame(gameLoop);
}

async function startMic() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();

  source.connect(analyser);

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function detectSound() {
    if (isGameOver) return;

    analyser.getByteFrequencyData(dataArray);

    const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    if (gameStarted) {
      statusText.innerText = "소리 크기: " + Math.floor(volume);

      if (volume > 20) {
        const jumpPower = Math.min(volume * 0.6, 40);
        jump(jumpPower);
      }
    }

    requestAnimationFrame(detectSound);
  }

  detectSound();
}

function startCountdown() {
  let count = 3;

  countdownText.style.display = "block";
  countdownText.innerText = count;

  const timer = setInterval(() => {
    count--;

    if (count > 0) {
      countdownText.innerText = count;
    } else if (count === 0) {
      countdownText.innerText = "START!";
    } else {
      clearInterval(timer);
      countdownText.style.display = "none";
      gameStarted = true;
      statusText.innerText = "게임 시작!";
      gameLoop();
    }
  }, 1000);
}

startBtn.addEventListener("click", async () => {
  const name = playerNameInput.value.trim();

  if (!name) {
    alert("이름을 입력하세요");
    return;
  }

  startBtn.style.display = "none";
  statusText.innerText = "마이크 연결 중...";

  await startMic();
  startCountdown();
});

restartBtn.addEventListener("click", () => {
  location.reload();
});

rankBtn.addEventListener("click", () => {
  loadRanking();
});

closeRankBtn.addEventListener("click", () => {
  rankModal.style.display = "none";
});