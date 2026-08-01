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
const AMBU_SPEED = 13;    // ambulance zoom speed (faster than traffic)
const AMBU_W = 96;
const AMBU_H = 48;

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
function siren() {
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime;
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = "sawtooth";
  for (let i = 0; i < 11; i++) {
    osc.frequency.setValueAtTime(i % 2 ? 880 : 660, t + i * 0.18);
  }
  gain.gain.setValueAtTime(0.18, t);
  gain.gain.setValueAtTime(0.18, t + 1.85);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
  osc.connect(gain).connect(actx.destination);
  osc.start(t);
  osc.stop(t + 2.05);
}
const crashSound = () => beep(150, 0.4, "sawtooth", 0.22);
const boomSound = () => beep(90, 0.25, "square", 0.25);
function honk() {
  // fun, loud two-tone car horn
  if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
  const t = actx.currentTime;
  [440, 554].forEach((f) => {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
    gain.gain.setValueAtTime(0.45, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    osc.connect(gain).connect(actx.destination);
    osc.start(t);
    osc.stop(t + 0.65);
  });
}

let car, obstacles, score, state, roadOffset;
let ambulance = null, frame = 0;
let up = false, down = false;

function reset() {
  car = { y: H / 2 };
  obstacles = [];
  score = 0;
  state = "ready";
  roadOffset = 0;
  ambulance = null;
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

  frame++;
  roadOffset = (roadOffset + SCROLL) % 60;

  // ambulance zooms by from behind every once in a while
  if (!ambulance && Math.random() < 0.0013) {
    ambulance = { x: -AMBU_W - 40, y: 40 + Math.random() * (H - AMBU_H - 80), warn: 120 };
    siren();  // siren wails ~2s before it arrives
  }
  if (ambulance) {
    if (ambulance.warn > 0) {
      ambulance.warn--;              // warning phase: not on the road yet
    } else {
      ambulance.x += AMBU_SPEED;
      // blow away any car the ambulance plows into
      for (const o of obstacles) {
        if (o.hit) continue;
        const oxHit = ambulance.x + AMBU_W > o.x && ambulance.x < o.x + OB_W;
        const oyHit = ambulance.y + AMBU_H > o.y && ambulance.y < o.y + OB_H;
        if (oxHit && oyHit) {
          o.hit = true;
          o.vx = AMBU_SPEED + 5 + Math.random() * 4;
          o.vy = (o.y < ambulance.y ? -1 : 1) * (6 + Math.random() * 6);
          o.spin = 0;
          o.dspin = (Math.random() - 0.5) * 0.6;
          boomSound();
        }
      }
      const hitX = CAR_X + CAR_W > ambulance.x && CAR_X < ambulance.x + AMBU_W;
      const hitY = car.y + CAR_H / 2 > ambulance.y && car.y - CAR_H / 2 < ambulance.y + AMBU_H;
      if (hitX && hitY) { crash(); return; }
      if (ambulance.x > W + 60) ambulance = null;
    }
  }

  if (up) car.y -= STEER;
  if (down) car.y += STEER;
  car.y = Math.max(CAR_H / 2, Math.min(H - CAR_H / 2, car.y));

  // move cars: normal cars scroll left; knocked cars fly along their velocity
  for (const o of obstacles) {
    if (o.hit) { o.x += o.vx; o.y += o.vy; o.spin += o.dspin; }
    else o.x -= SCROLL;
  }
  // spawn based on the rightmost normal (non-knocked) car
  let lastX = -Infinity;
  for (const o of obstacles) if (!o.hit) lastX = Math.max(lastX, o.x);
  if (lastX === -Infinity) addObstacle(W + 100);
  else if (lastX < W - OB_SPACING) addObstacle(lastX + OB_SPACING);
  // drop cars that have left the screen (any side)
  obstacles = obstacles.filter((o) => o.x + OB_W > -60 && o.x < W + 200 && o.y > -160 && o.y < H + 160);

  for (const o of obstacles) {
    if (o.hit) continue;  // flying cars don't score or hit the player
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

function drawCar(x, y, color, angle) {
  if (angle) {
    ctx.save();
    ctx.translate(x + CAR_W / 2, y + CAR_H / 2);
    ctx.rotate(angle);
    ctx.translate(-(x + CAR_W / 2), -(y + CAR_H / 2));
  }
  ctx.fillStyle = color;
  ctx.fillRect(x, y, CAR_W, CAR_H);
  ctx.fillStyle = "#cfefff";
  ctx.fillRect(x + CAR_W * 0.55, y + 6, CAR_W * 0.28, CAR_H - 12); // windshield
  ctx.fillStyle = "#222";
  ctx.fillRect(x + 8, y - 4, 14, 6);
  ctx.fillRect(x + 8, y + CAR_H - 2, 14, 6);
  ctx.fillRect(x + CAR_W - 22, y - 4, 14, 6);
  ctx.fillRect(x + CAR_W - 22, y + CAR_H - 2, 14, 6);
  if (angle) ctx.restore();
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

  for (const o of obstacles) drawCar(o.x, o.y, "#e2483b", o.spin || 0);   // oncoming cars
  drawCar(CAR_X, car.y - CAR_H / 2, "#2ecc71");              // your car
  if (ambulance) {
    if (ambulance.warn > 0) drawWarning(ambulance.y);
    else drawAmbulance(ambulance.x, ambulance.y);
  }
}

function drawWarning(y) {
  const cy = y + AMBU_H / 2;
  const on = (frame % 12) < 6;
  // flashing arrow at the left edge pointing right, in the ambulance's lane
  ctx.fillStyle = on ? "#ff2d2d" : "#2d6bff";
  ctx.beginPath();
  ctx.moveTo(12, cy - 22);
  ctx.lineTo(52, cy);
  ctx.lineTo(12, cy + 22);
  ctx.closePath();
  ctx.fill();
  ctx.font = "bold 28px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("🚑", 60, cy + 10);
}

function drawAmbulance(x, y) {
  // white body + red stripe + cross
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, AMBU_W, AMBU_H);
  ctx.fillStyle = "#e2483b";
  ctx.fillRect(x, y + AMBU_H / 2 - 4, AMBU_W, 8);
  ctx.fillRect(x + AMBU_W * 0.62, y + AMBU_H / 2 - 12, 8, 24);
  ctx.fillRect(x + AMBU_W * 0.62 - 8, y + AMBU_H / 2 - 4, 24, 8);
  // windshield
  ctx.fillStyle = "#cfefff";
  ctx.fillRect(x + AMBU_W - 20, y + 6, 14, AMBU_H - 12);
  // flashing roof lights (alternate red / blue)
  const on = (frame % 12) < 6;
  ctx.fillStyle = on ? "#ff2d2d" : "#7a7a7a";
  ctx.fillRect(x + 14, y - 8, 16, 8);
  ctx.fillStyle = on ? "#7a7a7a" : "#2d6bff";
  ctx.fillRect(x + 36, y - 8, 16, 8);
  // glow when lit
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = on ? "#ff2d2d" : "#2d6bff";
  ctx.beginPath();
  ctx.arc(x + (on ? 22 : 44), y - 4, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// --- two inputs: UP and DOWN (held) ---
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); honk(); }
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
