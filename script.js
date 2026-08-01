// A cheerful looping dance tune, synthesized in the browser (no files to load).
// Browsers block autoplay, so the music starts when Amelia clicks the button.

const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
};

// melody: [note name, beats]  (one beat = one eighth note)
const MELODY = [
  ["G4", 1], ["G4", 1], ["A4", 1], ["G4", 1], ["C5", 2], ["B4", 2],
  ["G4", 1], ["G4", 1], ["A4", 1], ["G4", 1], ["D5", 2], ["C5", 2],
  ["E5", 1], ["C5", 1], ["G4", 1], ["C5", 1], ["E5", 2], ["D5", 2],
  ["F4", 1], ["A4", 1], ["C5", 1], ["A4", 1], ["G4", 2], ["G4", 2],
];
const BASS = ["C4", "C4", "G4", "C4", "F4", "C4", "G4", "C4"]; // one per 2 beats

const BEAT = 0.20; // seconds per eighth note (~150 bpm feel)

let audioCtx = null;
let playing = false;
let loopTimer = null;

function tone(freq, start, dur, type, peak) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function scheduleLoop() {
  const t0 = audioCtx.currentTime + 0.05;
  // melody
  let t = t0;
  for (const [name, beats] of MELODY) {
    tone(NOTE[name], t, beats * BEAT * 0.9, "triangle", 0.22);
    t += beats * BEAT;
  }
  const total = t - t0;
  // bass: one note every 2 beats
  let bt = t0;
  for (const name of BASS) {
    tone(NOTE[name] / 2, bt, BEAT * 1.8, "sine", 0.18);
    bt += 2 * BEAT;
  }
  // reschedule right when this loop ends
  loopTimer = setTimeout(scheduleLoop, total * 1000);
}

function startMusic(btn) {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  playing = true;
  btn.textContent = "🔇 Stop music";
  btn.classList.add("playing");
  scheduleLoop();
}

function stopMusic(btn) {
  playing = false;
  clearTimeout(loopTimer);
  if (audioCtx) audioCtx.close();
  audioCtx = null;
  btn.textContent = "🎵 Play music";
  btn.classList.remove("playing");
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.createElement("button");
  btn.className = "music-btn";
  btn.textContent = "🎵 Play music";
  btn.addEventListener("click", () => (playing ? stopMusic(btn) : startMusic(btn)));
  document.body.appendChild(btn);
});
