// Amelia's top-view racing game. Two inputs: UP and DOWN.
// Your car stays on the left; the road scrolls past and other cars come at
// you from the right. Steer up/down to dodge them. No gravity.

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
const SCROLL = 5;         // road / traffic speed (how fast you race forward)
const STEER = 6;          // how fast your car moves up/down
const CAR_X = 150;        // your car's fixed left position
const CAR_W = 70;
const CAR_H = 40;
const OB_W = 70;
const OB_H = 44;
const OB_SPACING = 340;   // gap between oncoming cars

// --- sound ---
let actx = null;
function beep(freq, dur, type, peak) {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}
const pointSound = () => beep(660, 0.12, "triangle", 0.18);
const crashSound = () => beep(150, 0.4, "sawtooth", 0.22);

let car, obstacles, score, state, roadOffset;
let up = false, down = false;

function reset() {
  car = { y: H / 2 };
  obstacles = [];
  score = 0;
  state = "ready";
  roadOffset = 0;
  scoreEl.textContent = "0";
  msgEl.textContent = "Up / Down to steer";
  msgEl.style.display = "block";
}

function addObstacle(x) {
  const margin = 40;
  const y = margin + Math.random() * (H - OB_H - margin * 2);
  obstacles.push({ x, y, passed: false });
}

function start() {
  state = "play";
  msgEl.style.display = "none";
  addObstacle(W + 100);
}

function crash() {
  state = "dead";
  crashSound();
  msgEl.textContent = "Crash! Tap to race again";
  msgEl.style.display = "block";
}

function press() {
  if (state === "ready") start();
  else if (state === "dead") reset();
}

function update() {
  if (state !== "play") return;

  roadOffset = (roadOffset + SCROLL) % 60;

  if (up) car.y -= STEER;
  if (down) car.y += STEER;
  car.y = Math.max(CAR_H / 2, Math.min(H - CAR_H / 2, car.y));

  for (const o of obstacles) o.x -= SCROLL;
  const last = obstacles[obstacles.length - 1];
  if (last && last.x < W - OB_SPACING) addObstacle(last.x + OB_SPACING);
  if (obstacles.length && obstacles[0].x + OB_W < 0) obstacles.shift();

  for (const o of obstacles) {
    if (!o.passed && o.x + OB_W < CAR_X) {
      o.passed = true;
      score++;
      scoreEl.textContent = score;
      pointSound();
    }
    const hitX = CAR_X + CAR_W > o.x && CAR_X < o.x + OB_W;
    const hitY = car.y + CAR_H / 2 > o.y && car.y - CAR_H / 2 < o.y + OB_H;
    if (hitX && hitY) { crash(); return; }
  }
}

function drawCar(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CAR_W, CAR_H);
  ctx.fillStyle = "#cfefff";
  ctx.fillRect(x + CAR_W * 0.55, y + 6, CAR_W * 0.28, CAR_H - 12); // windshield
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 8, y - 4, 14, 6);
  ctx.fillRect(x + 8, y + CAR_H - 2, 14, 6);
  ctx.fillRect(x + CAR_W - 22, y - 4, 14, 6);
  ctx.fillRect(x + CAR_W - 22, y + CAR_H - 2, 14, 6);
}

function draw() {
  ctx.fillStyle = "#3b3f46";        // asphalt
  ctx.fillRect(0, 0, W, H);

  // scrolling dashed lane lines
  ctx.fillStyle = "#f4d03f";
  for (let lane = 1; lane <= 2; lane++) {
    const ly = (H / 3) * lane;
    for (let x = -roadOffset; x < W; x += 60) ctx.fillRect(x, ly - 3, 34, 6);
  }
  // road edges
  ctx.fillStyle = "#e6e6e6";
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);

  for (const o of obstacles) drawCar(o.x, o.y, "#e2483b");   // oncoming cars
  drawCar(CAR_X, car.y - CAR_H / 2, "#2ecc71");              // your car
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- two inputs: UP and DOWN (held) ---
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); up = true; press(); }
  if (e.code === "ArrowDown" || e.code === "KeyS") { e.preventDefault(); down = true; press(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") down = false;
});

// pointer/touch: top half = up, bottom half = down (hold)
function pointerDown(y) {
  press();
  if (y < H / 2) up = true; else down = true;
}
function pointerUp() { up = false; down = false; }
window.addEventListener("mousedown", (e) => pointerDown(e.clientY));
window.addEventListener("mouseup", pointerUp);
window.addEventListener("touchstart", (e) => { e.preventDefault(); pointerDown(e.touches[0].clientY); }, { passive: false });
window.addEventListener("touchend", (e) => { e.preventDefault(); pointerUp(); }, { passive: false });

reset();
loop();
