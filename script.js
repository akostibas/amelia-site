// Amelia's one-input runner (Flappy Bird style). Simple mechanics to start:
// gravity pulls the bird down, one input flaps it up, pipes scroll left,
// pass through the gaps. Hit something -> reset.

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const msgEl = document.getElementById("message");

let W, H;
function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// --- tunable mechanics ---
const GRAVITY = 0.5;
const FLAP = -8.5;
const SCROLL = 3.2;      // pipe speed (px/frame)
const GAP = 190;         // vertical gap size
const PIPE_W = 70;
const PIPE_SPACING = 300; // horizontal distance between pipes
const BIRD_X = 140;
const BIRD_R = 20;

let bird, pipes, score, state; // state: "ready" | "play" | "dead"

function reset() {
  bird = { y: H / 2, v: 0 };
  pipes = [];
  score = 0;
  state = "ready";
  scoreEl.textContent = "0";
  msgEl.textContent = "Tap / Space to flap";
  msgEl.style.display = "block";
}

function addPipe(x) {
  const margin = 80;
  const gapY = margin + Math.random() * (H - GAP - margin * 2);
  pipes.push({ x, gapY, passed: false });
}

function flap() {
  if (state === "ready") {
    state = "play";
    msgEl.style.display = "none";
    addPipe(W + 100);
  }
  if (state === "play") {
    bird.v = FLAP;
  } else if (state === "dead") {
    reset();
  }
}

function die() {
  state = "dead";
  msgEl.textContent = "Game over — tap to try again";
  msgEl.style.display = "block";
}

function update() {
  if (state !== "play") return;

  bird.v += GRAVITY;
  bird.y += bird.v;

  // ground / ceiling
  if (bird.y + BIRD_R > H || bird.y - BIRD_R < 0) {
    bird.y = Math.max(BIRD_R, Math.min(H - BIRD_R, bird.y));
    die();
    return;
  }

  // move pipes, spawn new ones
  for (const p of pipes) p.x -= SCROLL;
  const last = pipes[pipes.length - 1];
  if (last && last.x < W - PIPE_SPACING) addPipe(last.x + PIPE_SPACING);
  if (pipes.length && pipes[0].x + PIPE_W < 0) pipes.shift();

  // score + collisions
  for (const p of pipes) {
    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      score++;
      scoreEl.textContent = score;
    }
    const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
    const inGap = bird.y - BIRD_R > p.gapY && bird.y + BIRD_R < p.gapY + GAP;
    if (inX && !inGap) { die(); return; }
  }
}

function draw() {
  // sky
  ctx.fillStyle = "#4ec0ff";
  ctx.fillRect(0, 0, W, H);

  // pipes
  ctx.fillStyle = "#3aa54a";
  for (const p of pipes) {
    ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
    ctx.fillRect(p.x, p.gapY + GAP, PIPE_W, H - p.gapY - GAP);
  }

  // bird
  ctx.beginPath();
  ctx.arc(BIRD_X, bird.y, BIRD_R, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd93b";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#d9a400";
  ctx.stroke();
  // eye
  ctx.beginPath();
  ctx.arc(BIRD_X + 7, bird.y - 6, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#222";
  ctx.fill();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// one input, several bindings
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") { e.preventDefault(); flap(); }
});
window.addEventListener("mousedown", flap);
window.addEventListener("touchstart", (e) => { e.preventDefault(); flap(); }, { passive: false });

reset();
loop();
