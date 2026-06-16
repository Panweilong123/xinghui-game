const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreEl = document.querySelector("#score");
const bestEl = document.querySelector("#best");
const livesEl = document.querySelector("#lives");
const levelEl = document.querySelector("#level");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const soundButton = document.querySelector("#soundButton");
const fingerTip = document.querySelector("#fingerTip");

const MAX_DPR = 1.5;
const backgroundCache = document.createElement("canvas");
const backgroundCtx = backgroundCache.getContext("2d");
const backgroundImage = new Image();
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const state = {
  running: false,
  paused: false,
  score: 0,
  scoreFloat: 0,
  best: Number(localStorage.getItem("stardash-mobile-best") || 0),
  lives: 3,
  level: 1,
  lastTime: 0,
  spawnTimer: 0,
  coreTimer: 0,
  meteors: [],
  cores: [],
  particles: [],
  stars: [],
  pointer: null,
  keys: new Set(),
  hud: {
    score: null,
    best: null,
    lives: null,
    level: null,
  },
};

const audio = {
  enabled: localStorage.getItem("stardash-mobile-audio") !== "off",
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  musicTimer: null,
  step: 0,
  voiceLastAt: 0,
};

const ship = {
  x: 190,
  y: 560,
  radius: 14,
  safe: 0,
};

const enemyDesigns = [
  { hair: "#2b2030", skin: "#8e6d87", dress: "#4b2b5f", accent: "#ef5f70", horn: "#fff0c2", mood: "fang" },
  { hair: "#31404a", skin: "#9a7a6f", dress: "#2d6471", accent: "#ffb24d", horn: "#37251f", mood: "mask" },
  { hair: "#562d42", skin: "#7f8a5f", dress: "#5b3650", accent: "#c7f06b", horn: "#e3d2a1", mood: "fang" },
  { hair: "#161b2b", skin: "#9c8f9f", dress: "#3e3b70", accent: "#8df0ff", horn: "#f5e7ff", mood: "mask" },
  { hair: "#5d2a21", skin: "#ae6b5c", dress: "#65312a", accent: "#ff7b3d", horn: "#322018", mood: "fang" },
  { hair: "#253b25", skin: "#73915f", dress: "#31472d", accent: "#ffd766", horn: "#f0f4c1", mood: "mask" },
  { hair: "#3c2549", skin: "#816c9c", dress: "#40215f", accent: "#ff77c8", horn: "#f7dcff", mood: "fang" },
  { hair: "#4a3a2d", skin: "#a48a77", dress: "#5a463a", accent: "#73d2ff", horn: "#251c17", mood: "mask" },
  { hair: "#193146", skin: "#768eb0", dress: "#263b68", accent: "#9cf2ff", horn: "#eefcff", mood: "fang" },
  { hair: "#5b1f34", skin: "#9b6675", dress: "#7a2941", accent: "#ffd1e2", horn: "#4b1d23", mood: "mask" },
];

const beautyDesigns = [
  { hair: "#f0b45f", dress: "#ffca42", accent: "#241812", aura: "#fff0a8", flower: "#fff7dc" },
  { hair: "#ffd36e", dress: "#101014", accent: "#ffb72f", aura: "#ffe58b", flower: "#ffffff" },
  { hair: "#d98e42", dress: "#ffe071", accent: "#332016", aura: "#fff2b6", flower: "#ffd1ec" },
  { hair: "#ffbd77", dress: "#2a1c18", accent: "#ffc943", aura: "#ffdf75", flower: "#fff4b0" },
  { hair: "#e0a85c", dress: "#f7b922", accent: "#1e1b22", aura: "#ffeda5", flower: "#ffffff" },
  { hair: "#ffc96d", dress: "#17131c", accent: "#ffd15c", aura: "#fff4c7", flower: "#ffe0a3" },
  { hair: "#cb7d45", dress: "#ffdd6a", accent: "#3b2517", aura: "#ffe69a", flower: "#fff8df" },
  { hair: "#f6a94f", dress: "#231817", accent: "#ffbc35", aura: "#ffd978", flower: "#ffd5ed" },
  { hair: "#f9d082", dress: "#ffbd32", accent: "#21150f", aura: "#fff0b4", flower: "#ffffff" },
  { hair: "#e9a35d", dress: "#14131a", accent: "#f6c247", aura: "#ffe186", flower: "#fff1c4" },
];

backgroundImage.addEventListener("load", () => {
  drawStaticBackground();
  draw();
});
backgroundImage.src = "assets/open-world-bg.png";

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initAudio() {
  if (!AudioContextClass || audio.ctx) return;
  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  const musicGain = ctx.createGain();
  const sfxGain = ctx.createGain();

  master.gain.value = audio.enabled ? 0.82 : 0;
  musicGain.gain.value = 0.28;
  sfxGain.gain.value = 0.62;
  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(ctx.destination);

  audio.ctx = ctx;
  audio.master = master;
  audio.musicGain = musicGain;
  audio.sfxGain = sfxGain;
}

function setAudioEnabled(enabled) {
  audio.enabled = enabled;
  localStorage.setItem("stardash-mobile-audio", enabled ? "on" : "off");
  soundButton.textContent = enabled ? "声音开" : "声音关";
  soundButton.setAttribute("aria-pressed", String(enabled));

  if (enabled && (state.running || audio.ctx)) initAudio();
  if (audio.master) {
    audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
    audio.master.gain.setTargetAtTime(enabled ? 0.82 : 0, audio.ctx.currentTime, 0.025);
  }
  if (enabled && state.running && !state.paused) startMusic();
  if (!enabled) {
    stopMusic();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }
}

function resumeAudio() {
  if (!audio.enabled) return;
  initAudio();
  if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
}

function speakMagic(lines, { rate = 1.22, pitch = 1.45, volume = 0.72, cooldown = 900 } = {}) {
  if (!audio.enabled || !window.speechSynthesis) return;
  const now = Date.now();
  if (now - audio.voiceLastAt < cooldown) return;
  audio.voiceLastAt = now;

  const text = Array.isArray(lines) ? lines[Math.floor(Math.random() * lines.length)] : lines;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = rate + random(-0.08, 0.08);
  utterance.pitch = pitch + random(-0.18, 0.22);
  utterance.volume = volume;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function playTone({
  frequency,
  duration,
  type = "sine",
  gain = 0.2,
  destination,
  when = 0,
  slideTo = null,
  detune = 0,
}) {
  if (!audio.enabled || !audio.ctx) return;
  const ctx = audio.ctx;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  osc.detune.value = detune;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.018);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(destination || audio.sfxGain);
  osc.start(start);
  osc.stop(start + duration + 0.04);
}

function playNoise({ duration = 0.22, gain = 0.16, when = 0, tone = 900 }) {
  if (!audio.enabled || !audio.ctx) return;
  const ctx = audio.ctx;
  const start = ctx.currentTime + when;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = tone;
  filter.Q.value = 0.9;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(audio.sfxGain);
  source.start(start);
  source.stop(start + duration);
}

function playKick(when = 0) {
  if (!audio.enabled || !audio.ctx) return;
  const ctx = audio.ctx;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(128, start);
  osc.frequency.exponentialRampToValueAtTime(42, start + 0.16);
  amp.gain.setValueAtTime(0.28, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
  osc.connect(amp);
  amp.connect(audio.musicGain);
  osc.start(start);
  osc.stop(start + 0.2);
}

function playSfx(name) {
  resumeAudio();
  if (!audio.ctx) return;

  if (name === "start") {
    playKick();
    playTone({ frequency: 523.25, duration: 0.1, type: "square", gain: 0.18 });
    playTone({ frequency: 783.99, duration: 0.14, type: "sawtooth", gain: 0.14, when: 0.07 });
    playTone({ frequency: 1567.98, duration: 0.22, type: "triangle", gain: 0.15, when: 0.16 });
    speakMagic(["芜湖，蜂男孩起飞！", "小蜜蜂，冲冲冲！", "这把很魔性！"], { cooldown: 300 });
  }

  if (name === "core") {
    playTone({ frequency: 987.77, duration: 0.08, type: "square", gain: 0.18 });
    playTone({ frequency: 1567.98, duration: 0.12, type: "triangle", gain: 0.14, when: 0.04 });
    playTone({ frequency: 2093, duration: 0.1, type: "sine", gain: 0.1, when: 0.1 });
    if (Math.random() < 0.32) {
      speakMagic(["仙姬入队！", "漂亮，继续收集！", "叮！魅力加一！"], {
        rate: 1.32,
        pitch: 1.7,
        volume: 0.68,
        cooldown: 1400,
      });
    }
  }

  if (name === "hit") {
    playKick();
    playTone({ frequency: 246.94, duration: 0.26, type: "sawtooth", gain: 0.22, slideTo: 61.74 });
    playTone({ frequency: 92.5, duration: 0.22, type: "square", gain: 0.16, when: 0.04, slideTo: 46.25 });
    playNoise({ duration: 0.32, gain: 0.28, tone: 460 });
    speakMagic(["哎呀，女妖别贴脸！", "痛！但还没寄！", "古怪女妖来了！"], {
      rate: 1.18,
      pitch: 0.85,
      volume: 0.8,
      cooldown: 600,
    });
  }

  if (name === "level") {
    playKick();
    playTone({ frequency: 659.25, duration: 0.08, type: "square", gain: 0.16 });
    playTone({ frequency: 987.77, duration: 0.1, type: "sawtooth", gain: 0.16, when: 0.07 });
    playTone({ frequency: 1975.53, duration: 0.16, type: "triangle", gain: 0.14, when: 0.14 });
    speakMagic(["升级！节奏拉满！", "速度上来了，别眨眼！", "进入上头模式！"], {
      rate: 1.28,
      pitch: 1.5,
      volume: 0.74,
      cooldown: 800,
    });
  }

  if (name === "gameover") {
    playTone({ frequency: 392, duration: 0.16, type: "sawtooth", gain: 0.16 });
    playTone({ frequency: 293.66, duration: 0.22, type: "square", gain: 0.15, when: 0.14 });
    playTone({ frequency: 196, duration: 0.42, type: "sine", gain: 0.18, when: 0.34 });
    playNoise({ duration: 0.46, gain: 0.18, when: 0.12, tone: 260 });
    speakMagic(["寄！但是很优雅。", "本局下饭，再来一碗！", "别慌，重开才是精髓！"], {
      rate: 1.05,
      pitch: 0.78,
      volume: 0.82,
      cooldown: 300,
    });
  }
}

function playMusicStep() {
  if (!audio.enabled || !audio.ctx || state.paused || !state.running) return;
  const melody = [783.99, 987.77, 1174.66, 987.77, 1318.51, 1174.66, 987.77, 1567.98];
  const bass = [130.81, 146.83, 164.81, 196];
  const index = audio.step % melody.length;
  const swing = audio.step % 2 ? 0.018 : 0;

  if (audio.step % 4 === 0) playKick();
  if (audio.step % 2 === 1) playNoise({ duration: 0.045, gain: 0.055, tone: 5200 });

  playTone({
    frequency: melody[index],
    duration: 0.1,
    type: index % 3 === 0 ? "sawtooth" : "square",
    gain: index % 2 ? 0.05 : 0.07,
    destination: audio.musicGain,
    when: swing,
    detune: index % 2 ? -8 : 8,
  });

  if (audio.step % 2 === 0) {
    playTone({
      frequency: bass[Math.floor(audio.step / 2) % bass.length],
      duration: 0.16,
      type: "sawtooth",
      gain: 0.08,
      destination: audio.musicGain,
    });
  }

  audio.step += 1;
}

function startMusic() {
  if (!audio.enabled || audio.musicTimer) return;
  resumeAudio();
  if (!audio.ctx) return;
  playMusicStep();
  audio.musicTimer = window.setInterval(playMusicStep, 145);
}

function stopMusic() {
  if (!audio.musicTimer) return;
  window.clearInterval(audio.musicTimer);
  audio.musicTimer = null;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  canvas.logicWidth = rect.width;
  canvas.logicHeight = rect.height;
  backgroundCache.width = Math.max(1, Math.floor(rect.width));
  backgroundCache.height = Math.max(1, Math.floor(rect.height));
  drawStaticBackground();
}

function width() {
  return canvas.logicWidth || canvas.clientWidth || 390;
}

function height() {
  return canvas.logicHeight || canvas.clientHeight || 720;
}

function resetStars() {
  const w = width();
  const h = height();
  const count = clamp(Math.floor((w * h) / 3600), 55, 90);
  state.stars = Array.from({ length: count }, () => ({
    x: random(0, w),
    y: random(0, h),
    r: random(0.55, 1.9),
    speed: random(20, 78),
    alpha: random(0.28, 0.82),
    tint: Math.random() < 0.55 ? "#ffffff" : Math.random() < 0.5 ? "#ffe8a8" : "#9ee8ff",
    layer: Math.random() < 0.16 ? 1 : 0,
  }));
}

function resetGame() {
  const w = width();
  const h = height();
  state.running = false;
  state.paused = false;
  state.score = 0;
  state.scoreFloat = 0;
  state.lives = 3;
  state.level = 1;
  state.spawnTimer = 0.35;
  state.coreTimer = 0.25;
  state.meteors = [];
  state.cores = [];
  state.particles = [];
  state.pointer = null;
  ship.x = w * 0.5;
  ship.y = h * 0.76;
  ship.safe = 1.2;
  overlay.classList.add("hidden");
  fingerTip.classList.remove("hidden");
  pauseButton.textContent = "暂停";
  updateHud();
  state.running = true;
  playSfx("start");
  startMusic();
}

function updateHud() {
  if (state.hud.score !== state.score) {
    state.hud.score = state.score;
    scoreEl.textContent = state.score;
  }
  if (state.hud.best !== state.best) {
    state.hud.best = state.best;
    bestEl.textContent = state.best;
  }
  if (state.hud.lives !== state.lives) {
    state.hud.lives = state.lives;
    livesEl.textContent = state.lives;
  }
  if (state.hud.level !== state.level) {
    if (state.running && state.hud.level !== null) playSfx("level");
    state.hud.level = state.level;
    levelEl.textContent = state.level;
  }
}

function setOverlay(title, text, buttonText) {
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = text;
  startButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function addBurst(x, y, color, count) {
  const amount = Math.min(count, 18);
  for (let i = 0; i < amount; i += 1) {
    state.particles.push({
      x,
      y,
      vx: random(-120, 120),
      vy: random(-120, 120),
      life: random(0.28, 0.7),
      maxLife: 0.7,
      size: random(2, 4.5),
      color,
    });
  }
  if (state.particles.length > 90) {
    state.particles.splice(0, state.particles.length - 90);
  }
}

function spawnMeteor() {
  if (state.meteors.length >= 18) return;
  const w = width();
  const h = height();
  const radius = random(17, 30);
  const sideSpawn = Math.random() < 0.34;
  const fromLeft = Math.random() < 0.5;
  state.meteors.push({
    x: sideSpawn ? (fromLeft ? -radius : w + radius) : random(radius, w - radius),
    y: sideSpawn ? random(radius + 10, h * 0.56) : -radius,
    radius,
    vx: sideSpawn ? (fromLeft ? 1 : -1) * (random(70, 118) + state.level * 7) : random(-38, 38),
    vy: random(105, 168) + state.level * 9,
    rotation: random(0, Math.PI * 2),
    spin: random(-2.2, 2.2),
    design: Math.floor(random(0, enemyDesigns.length)),
  });
}

function spawnCore() {
  if (state.cores.length >= 7) return;
  const w = width();
  state.cores.push({
    x: random(34, w - 34),
    y: -20,
    radius: 13,
    vy: 82 + state.level * 7,
    drift: random(-22, 22),
    pulse: random(0, Math.PI * 2),
    design: Math.floor(random(0, beautyDesigns.length)),
  });
}

function updateShip(dt) {
  const w = width();
  const h = height();
  const speed = 260 + state.level * 7;
  let dx = 0;
  let dy = 0;

  if (state.keys.has("arrowleft") || state.keys.has("a")) dx -= 1;
  if (state.keys.has("arrowright") || state.keys.has("d")) dx += 1;
  if (state.keys.has("arrowup") || state.keys.has("w")) dy -= 1;
  if (state.keys.has("arrowdown") || state.keys.has("s")) dy += 1;

  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    ship.x += (dx / length) * speed * dt;
    ship.y += (dy / length) * speed * dt;
  } else if (state.pointer) {
    ship.x += (state.pointer.x - ship.x) * Math.min(1, dt * 10);
    ship.y += (state.pointer.y - ship.y) * Math.min(1, dt * 10);
  }

  ship.x = clamp(ship.x, ship.radius + 8, w - ship.radius - 8);
  ship.y = clamp(ship.y, ship.radius + 8, h - ship.radius - 8);
  ship.safe = Math.max(0, ship.safe - dt);
}

function updateWorld(dt) {
  const w = width();
  const h = height();
  state.level = Math.floor(state.score / 300) + 1;
  state.spawnTimer -= dt;
  state.coreTimer -= dt;

  if (state.spawnTimer <= 0) {
    spawnMeteor();
    state.spawnTimer = Math.max(0.33, 0.95 - state.level * 0.035);
  }

  if (state.coreTimer <= 0) {
    spawnCore();
    state.coreTimer = random(0.8, 1.45);
  }

  for (const star of state.stars) {
    star.y += star.speed * dt * (1 + state.level * 0.02);
    if (star.y > h + 4) {
      star.x = random(0, w);
      star.y = -4;
    }
  }

  for (const meteor of state.meteors) {
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    meteor.rotation += meteor.spin * dt;
  }

  for (const core of state.cores) {
    core.x += core.drift * dt;
    core.y += core.vy * dt;
    core.pulse += dt * 6;
  }

  for (const particle of state.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  }

  state.meteors = state.meteors.filter((meteor) => meteor.x > -80 && meteor.x < w + 80 && meteor.y < h + 80);
  state.cores = state.cores.filter((core) => core.y < h + 45);
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function collide(a, b, padding = 0) {
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius + padding;
}

function resolveCollisions() {
  for (let i = state.cores.length - 1; i >= 0; i -= 1) {
    const core = state.cores[i];
    if (collide(ship, core, 5)) {
      state.cores.splice(i, 1);
      state.scoreFloat += 60;
      state.score = Math.floor(state.scoreFloat);
      addBurst(core.x, core.y, "#45d6ff", 16);
      playSfx("core");
    }
  }

  if (ship.safe > 0) return;

  for (let i = state.meteors.length - 1; i >= 0; i -= 1) {
    const meteor = state.meteors[i];
    if (collide(ship, meteor, -4)) {
      state.meteors.splice(i, 1);
      state.lives -= 1;
      ship.safe = 1.1;
      addBurst(ship.x, ship.y, "#ff5a68", 26);
      playSfx("hit");
      if (state.lives <= 0) endGame();
      return;
    }
  }
}

function endGame() {
  state.running = false;
  stopMusic();
  state.best = Math.max(state.best, state.score);
  localStorage.setItem("stardash-mobile-best", String(state.best));
  updateHud();
  fingerTip.classList.add("hidden");
  setOverlay("冒险结束", `本局 ${state.score} 分。稳住小蜜蜂，下一次多收集几位发光仙姬。`, "再来一局");
  playSfx("gameover");
}

function drawBackground() {
  const w = width();
  const h = height();
  ctx.drawImage(backgroundCache, 0, 0, w, h);

  for (const star of state.stars) {
    const shimmer = 0.72 + Math.sin((star.y + state.scoreFloat) * 0.04) * 0.22;
    ctx.globalAlpha = star.alpha * shimmer;
    ctx.fillStyle = star.tint;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r * (star.layer ? 1.25 : 1), 0, Math.PI * 2);
    ctx.fill();
    if (star.layer) {
      ctx.strokeStyle = star.tint;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(star.x - star.r * 3, star.y);
      ctx.lineTo(star.x + star.r * 3, star.y);
      ctx.moveTo(star.x, star.y - star.r * 3);
      ctx.lineTo(star.x, star.y + star.r * 3);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function drawStaticBackground() {
  const w = backgroundCache.width;
  const h = backgroundCache.height;
  if (backgroundImage.complete && backgroundImage.naturalWidth) {
    drawCoverImage(backgroundCtx, backgroundImage, 0, 0, w, h);
    const sunlight = backgroundCtx.createRadialGradient(w * 0.78, h * 0.1, 0, w * 0.78, h * 0.1, w * 0.58);
    sunlight.addColorStop(0, "rgba(255, 246, 196, 0.3)");
    sunlight.addColorStop(0.5, "rgba(255, 246, 196, 0.08)");
    sunlight.addColorStop(1, "rgba(255, 246, 196, 0)");
    backgroundCtx.fillStyle = sunlight;
    backgroundCtx.fillRect(0, 0, w, h);
    backgroundCtx.fillStyle = "rgba(55, 132, 105, 0.16)";
    backgroundCtx.fillRect(0, h * 0.72, w, h * 0.28);
    drawRuneDetails(backgroundCtx, w, h);
    return;
  }

  const gradient = backgroundCtx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "#65c7ff");
  gradient.addColorStop(0.42, "#b9ecff");
  gradient.addColorStop(0.72, "#84d7bf");
  gradient.addColorStop(1, "#407c83");
  backgroundCtx.fillStyle = gradient;
  backgroundCtx.fillRect(0, 0, w, h);

  backgroundCtx.save();
  backgroundCtx.globalAlpha = 0.45;
  backgroundCtx.fillStyle = "#fff7d6";
  backgroundCtx.beginPath();
  backgroundCtx.arc(w * 0.82, h * 0.13, Math.min(w, h) * 0.11, 0, Math.PI * 2);
  backgroundCtx.fill();
  backgroundCtx.restore();

  drawCloud(backgroundCtx, w * 0.18, h * 0.16, w * 0.2, 0.75);
  drawCloud(backgroundCtx, w * 0.72, h * 0.23, w * 0.24, 0.58);
  drawCloud(backgroundCtx, w * 0.43, h * 0.08, w * 0.16, 0.45);
  drawFloatingIsland(backgroundCtx, w * 0.2, h * 0.32, Math.min(w, h) * 0.18);
  drawFloatingIsland(backgroundCtx, w * 0.78, h * 0.38, Math.min(w, h) * 0.14);
  drawCastleTown(backgroundCtx, w, h);
  drawFestivalFlags(backgroundCtx, w, h);
  drawDistantLand(backgroundCtx, w, h);
  drawFlowerField(backgroundCtx, w, h);
  drawRuneDetails(backgroundCtx, w, h);
}

function drawCoverImage(target, image, x, y, w, h) {
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (image.naturalWidth - sw) * 0.5;
  const sy = (image.naturalHeight - sh) * 0.5;
  target.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

function drawCloud(target, x, y, size, alpha) {
  target.save();
  target.globalAlpha = alpha;
  target.fillStyle = "#ffffff";
  target.beginPath();
  target.arc(x - size * 0.28, y + size * 0.04, size * 0.18, 0, Math.PI * 2);
  target.arc(x - size * 0.06, y - size * 0.03, size * 0.26, 0, Math.PI * 2);
  target.arc(x + size * 0.2, y + size * 0.02, size * 0.2, 0, Math.PI * 2);
  target.arc(x + size * 0.38, y + size * 0.08, size * 0.14, 0, Math.PI * 2);
  target.rect(x - size * 0.38, y, size * 0.82, size * 0.18);
  target.fill();
  target.restore();
}

function drawDistantLand(target, w, h) {
  target.save();
  target.globalAlpha = 0.78;
  const y = h * 0.7;
  const hill = target.createLinearGradient(0, y - 120, 0, h);
  hill.addColorStop(0, "#4ea77f");
  hill.addColorStop(1, "#245c68");
  target.fillStyle = hill;
  target.beginPath();
  target.moveTo(0, y);
  target.bezierCurveTo(w * 0.15, y - 58, w * 0.25, y - 26, w * 0.42, y - 72);
  target.bezierCurveTo(w * 0.62, y - 122, w * 0.74, y - 18, w, y - 84);
  target.lineTo(w, h);
  target.lineTo(0, h);
  target.closePath();
  target.fill();

  target.globalAlpha = 0.24;
  target.strokeStyle = "#f8ffe1";
  target.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const x = w * (0.08 + i * 0.2);
    target.beginPath();
    target.moveTo(x, h);
    target.quadraticCurveTo(x + 46, y + 25, x + 120, y - 12);
    target.stroke();
  }
  target.restore();
}

function drawFloatingIsland(target, x, y, size) {
  target.save();
  target.globalAlpha = 0.8;
  target.fillStyle = "#6ab07a";
  target.beginPath();
  target.ellipse(x, y, size, size * 0.28, -0.08, 0, Math.PI * 2);
  target.fill();
  target.fillStyle = "#7d6046";
  target.beginPath();
  target.moveTo(x - size * 0.62, y + size * 0.12);
  target.lineTo(x - size * 0.15, y + size * 0.74);
  target.lineTo(x + size * 0.12, y + size * 0.52);
  target.lineTo(x + size * 0.58, y + size * 0.12);
  target.closePath();
  target.fill();
  target.strokeStyle = "rgba(255, 255, 255, 0.42)";
  target.lineWidth = 2;
  target.beginPath();
  target.arc(x - size * 0.18, y - size * 0.1, size * 0.09, 0, Math.PI * 2);
  target.moveTo(x + size * 0.18, y - size * 0.14);
  target.lineTo(x + size * 0.18, y - size * 0.44);
  target.lineTo(x + size * 0.3, y - size * 0.32);
  target.stroke();
  target.restore();
}

function drawCastleTown(target, w, h) {
  target.save();
  const baseY = h * 0.58;
  target.globalAlpha = 0.72;
  for (let i = 0; i < 8; i += 1) {
    const houseW = w * random(0.06, 0.1);
    const houseH = h * random(0.045, 0.08);
    const x = w * (0.12 + i * 0.105);
    const y = baseY + Math.sin(i * 1.7) * h * 0.025;
    target.fillStyle = i % 2 ? "#f7dfad" : "#fff0c5";
    target.fillRect(x, y - houseH, houseW, houseH);
    target.fillStyle = i % 3 ? "#d96d4a" : "#4f8fd4";
    target.beginPath();
    target.moveTo(x - 4, y - houseH);
    target.lineTo(x + houseW * 0.5, y - houseH - houseH * 0.52);
    target.lineTo(x + houseW + 4, y - houseH);
    target.closePath();
    target.fill();
    target.fillStyle = "#5f7a96";
    target.fillRect(x + houseW * 0.22, y - houseH * 0.58, houseW * 0.16, houseH * 0.22);
    target.fillRect(x + houseW * 0.62, y - houseH * 0.52, houseW * 0.16, houseH * 0.2);
  }

  target.fillStyle = "#dde8ee";
  target.fillRect(w * 0.52, baseY - h * 0.16, w * 0.06, h * 0.16);
  target.fillRect(w * 0.59, baseY - h * 0.22, w * 0.07, h * 0.22);
  target.fillStyle = "#5175b8";
  target.beginPath();
  target.moveTo(w * 0.515, baseY - h * 0.16);
  target.lineTo(w * 0.55, baseY - h * 0.24);
  target.lineTo(w * 0.585, baseY - h * 0.16);
  target.moveTo(w * 0.585, baseY - h * 0.22);
  target.lineTo(w * 0.625, baseY - h * 0.32);
  target.lineTo(w * 0.67, baseY - h * 0.22);
  target.fill();
  target.restore();
}

function drawFestivalFlags(target, w, h) {
  target.save();
  target.globalAlpha = 0.76;
  target.strokeStyle = "rgba(92, 73, 48, 0.42)";
  target.lineWidth = 1.5;
  target.beginPath();
  target.moveTo(w * 0.04, h * 0.22);
  target.quadraticCurveTo(w * 0.48, h * 0.31, w * 0.96, h * 0.2);
  target.stroke();
  const colors = ["#ff6b6b", "#ffd66b", "#52c7ff", "#8ee37e", "#c995ff"];
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const x = w * (0.04 + t * 0.92);
    const y = h * (0.22 + Math.sin(t * Math.PI) * 0.075);
    target.fillStyle = colors[i % colors.length];
    target.beginPath();
    target.moveTo(x, y);
    target.lineTo(x + 7, y + 16);
    target.lineTo(x - 7, y + 16);
    target.closePath();
    target.fill();
  }
  target.restore();
}

function drawFlowerField(target, w, h) {
  target.save();
  const ground = target.createLinearGradient(0, h * 0.68, 0, h);
  ground.addColorStop(0, "rgba(118, 209, 139, 0.52)");
  ground.addColorStop(1, "rgba(56, 134, 97, 0.84)");
  target.fillStyle = ground;
  target.beginPath();
  target.moveTo(0, h * 0.78);
  target.bezierCurveTo(w * 0.22, h * 0.72, w * 0.48, h * 0.86, w, h * 0.75);
  target.lineTo(w, h);
  target.lineTo(0, h);
  target.closePath();
  target.fill();

  target.strokeStyle = "rgba(255, 243, 185, 0.45)";
  target.lineWidth = 9;
  target.beginPath();
  target.moveTo(w * 0.52, h);
  target.bezierCurveTo(w * 0.44, h * 0.9, w * 0.54, h * 0.8, w * 0.48, h * 0.68);
  target.stroke();

  const flowers = ["#fff4b5", "#ff9fc6", "#8df0ff", "#ffffff"];
  for (let i = 0; i < 70; i += 1) {
    const x = random(0, w);
    const y = random(h * 0.72, h * 0.98);
    target.fillStyle = flowers[i % flowers.length];
    target.beginPath();
    target.arc(x, y, random(1.2, 2.8), 0, Math.PI * 2);
    target.fill();
  }
  target.restore();
}

function drawRuneDetails(target, w, h) {
  target.save();
  target.globalAlpha = 0.42;
  target.strokeStyle = "#dffaff";
  target.lineWidth = 1.4;
  for (let i = 0; i < 10; i += 1) {
    const x = w * random(0.06, 0.94);
    const y = h * random(0.18, 0.68);
    const r = random(5, 13);
    target.beginPath();
    target.arc(x, y, r, 0, Math.PI * 2);
    target.moveTo(x - r * 0.65, y);
    target.lineTo(x + r * 0.65, y);
    target.moveTo(x, y - r * 0.65);
    target.lineTo(x, y + r * 0.65);
    target.stroke();
  }
  target.restore();
}

function drawShip() {
  const flicker = ship.safe > 0 && Math.floor(ship.safe * 12) % 2 === 0;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.globalAlpha = flicker ? 0.5 : 1;

  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.strokeStyle = "rgba(91, 166, 210, 0.52)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(-13, -2, 13, 22, -0.45, 0, Math.PI * 2);
  ctx.ellipse(13, -2, 13, 22, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#3a2f22";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-5, -24);
  ctx.quadraticCurveTo(-15, -39, -25, -31);
  ctx.moveTo(5, -24);
  ctx.quadraticCurveTo(15, -39, 25, -31);
  ctx.stroke();
  ctx.fillStyle = "#ffd955";
  ctx.beginPath();
  ctx.arc(-25, -31, 4, 0, Math.PI * 2);
  ctx.arc(25, -31, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f2c13e";
  ctx.strokeStyle = "#4a3424";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 7, 13, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#403025";
  ctx.fillRect(-10, -1, 20, 5);
  ctx.fillRect(-9, 10, 18, 5);

  ctx.fillStyle = "#f8d8b7";
  ctx.strokeStyle = "#4a3424";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -17, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2b241f";
  ctx.beginPath();
  ctx.moveTo(-11, -22);
  ctx.quadraticCurveTo(-3, -35, 11, -23);
  ctx.quadraticCurveTo(4, -27, -2, -20);
  ctx.quadraticCurveTo(-6, -24, -11, -22);
  ctx.fill();

  ctx.fillStyle = "#1f2a44";
  ctx.beginPath();
  ctx.arc(-4, -16, 1.7, 0, Math.PI * 2);
  ctx.arc(4, -16, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7b4335";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -11, 3.2, 0.18, Math.PI - 0.18);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha *= 0.8;
  ctx.beginPath();
  ctx.arc(-7, -18, 1.2, 0, Math.PI * 2);
  ctx.arc(2, -18, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = flicker ? 0.5 : 1;

  ctx.strokeStyle = "#3a2f22";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, 20);
  ctx.lineTo(-15, 29);
  ctx.moveTo(8, 20);
  ctx.lineTo(15, 29);
  ctx.stroke();

  ctx.fillStyle = "#ffe66f";
  ctx.beginPath();
  ctx.arc(0, 31 + Math.sin(state.scoreFloat * 0.08) * 2, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMeteor(meteor) {
  const design = enemyDesigns[meteor.design % enemyDesigns.length] || enemyDesigns[0];
  const r = meteor.radius;
  ctx.save();
  ctx.translate(meteor.x, meteor.y);
  ctx.rotate(Math.sin(meteor.rotation) * 0.18);
  ctx.fillStyle = "rgba(83, 36, 72, 0.2)";
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = design.hair;
  ctx.beginPath();
  for (let i = 0; i < 16; i += 1) {
    const angle = (Math.PI * 2 * i) / 16;
    const size = r * (i % 2 ? 1.18 : 0.92);
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size - r * 0.04;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = design.horn;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.72);
  ctx.lineTo(-r * 0.92, -r * 1.34);
  ctx.lineTo(-r * 0.2, -r * 0.92);
  ctx.moveTo(r * 0.5, -r * 0.72);
  ctx.lineTo(r * 0.92, -r * 1.34);
  ctx.lineTo(r * 0.2, -r * 0.92);
  ctx.fill();

  ctx.fillStyle = design.dress;
  ctx.beginPath();
  ctx.moveTo(-r * 0.58, r * 0.35);
  ctx.quadraticCurveTo(0, r * 1.4, r * 0.58, r * 0.35);
  ctx.lineTo(r * 0.35, r * 1.05);
  ctx.lineTo(0, r * 0.72);
  ctx.lineTo(-r * 0.35, r * 1.05);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = design.skin;
  ctx.strokeStyle = "#2b1a28";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.12, r * 0.66, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#17101a";
  ctx.beginPath();
  ctx.arc(-r * 0.24, -r * 0.18, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.24, -r * 0.18, r * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (design.mood === "fang") {
    ctx.arc(0, r * 0.08, r * 0.25, 0.12, Math.PI - 0.12);
    ctx.moveTo(-r * 0.08, r * 0.18);
    ctx.lineTo(-r * 0.02, r * 0.34);
    ctx.moveTo(r * 0.08, r * 0.18);
    ctx.lineTo(r * 0.02, r * 0.34);
  } else {
    ctx.moveTo(-r * 0.34, r * 0.04);
    ctx.quadraticCurveTo(0, r * 0.22, r * 0.34, r * 0.04);
    ctx.moveTo(-r * 0.44, -r * 0.35);
    ctx.lineTo(-r * 0.08, -r * 0.28);
    ctx.moveTo(r * 0.44, -r * 0.35);
    ctx.lineTo(r * 0.08, -r * 0.28);
  }
  ctx.stroke();

  ctx.fillStyle = design.accent;
  ctx.beginPath();
  ctx.arc(-r * 0.62, r * 0.18, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.62, r * 0.18, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCore(core) {
  const design = beautyDesigns[core.design % beautyDesigns.length] || beautyDesigns[0];
  const glow = 5 + Math.sin(core.pulse) * 3;
  const r = core.radius;
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.rotate(Math.sin(core.pulse) * 0.08);

  ctx.fillStyle = design.aura;
  ctx.globalAlpha = 0.32;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.0 + glow * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    const x = Math.cos(angle) * r * 1.38;
    const y = Math.sin(angle) * r * 1.38;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.strokeStyle = "rgba(255, 198, 52, 0.72)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(-r * 0.72, -r * 0.08, r * 0.42, r * 0.95, -0.58, 0, Math.PI * 2);
  ctx.ellipse(r * 0.72, -r * 0.08, r * 0.42, r * 0.95, 0.58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -r * 0.94);
  ctx.quadraticCurveTo(-r * 0.48, -r * 1.42, -r * 0.82, -r * 1.18);
  ctx.moveTo(r * 0.16, -r * 0.94);
  ctx.quadraticCurveTo(r * 0.48, -r * 1.42, r * 0.82, -r * 1.18);
  ctx.stroke();
  ctx.fillStyle = "#ffd86a";
  ctx.beginPath();
  ctx.arc(-r * 0.82, -r * 1.18, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.82, -r * 1.18, r * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2a1b14";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.28);
  ctx.lineTo(r * 1.12, r * 0.82);
  ctx.stroke();
  ctx.fillStyle = "#e6a528";
  ctx.strokeStyle = "#fff1a4";
  ctx.beginPath();
  ctx.arc(r * 1.18, r * 0.94, r * 0.24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 229, 117, 0.72)";
  ctx.beginPath();
  ctx.arc(r * 1.18, r * 0.94, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = design.accent;
  ctx.strokeStyle = "#f6d063";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.48, -r * 0.05);
  ctx.lineTo(r * 0.48, -r * 0.05);
  ctx.lineTo(r * 0.32, r * 0.58);
  ctx.lineTo(0, r * 0.88);
  ctx.lineTo(-r * 0.32, r * 0.58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = design.dress;
  ctx.strokeStyle = design.accent;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.48);
  ctx.quadraticCurveTo(0, r * 1.35, r * 0.62, r * 0.48);
  ctx.lineTo(r * 0.4, r * 1.08);
  ctx.lineTo(0, r * 0.86);
  ctx.lineTo(-r * 0.4, r * 1.08);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f7d7bd";
  ctx.beginPath();
  ctx.arc(0, -r * 0.58, r * 0.43, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = design.hair;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.66);
  ctx.quadraticCurveTo(-r * 0.25, -r * 1.32, r * 0.48, -r * 0.94);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.18, r * 0.42, r * 0.55);
  ctx.quadraticCurveTo(r * 0.16, r * 0.0, -r * 0.08, -r * 0.22);
  ctx.quadraticCurveTo(-r * 0.34, r * 0.24, -r * 0.74, r * 0.54);
  ctx.quadraticCurveTo(-r * 0.54, -r * 0.06, -r * 0.55, -r * 0.66);
  ctx.fill();

  ctx.fillStyle = design.flower;
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.ellipse(-r * 0.42 + Math.cos(angle) * r * 0.11, -r * 0.9 + Math.sin(angle) * r * 0.08, r * 0.07, r * 0.04, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ffc233";
  ctx.beginPath();
  ctx.arc(-r * 0.42, -r * 0.9, r * 0.055, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#23304c";
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.58, r * 0.045, 0, Math.PI * 2);
  ctx.arc(r * 0.15, -r * 0.58, r * 0.045, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8d4935";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -r * 0.46, r * 0.12, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 238, 150, 0.78)";
  ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.18, r * 0.02);
    ctx.lineTo(i * r * 0.28, r * 0.52);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles() {
  for (const particle of state.particles) {
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.moveTo(particle.x, particle.y - particle.size * 1.6);
    ctx.lineTo(particle.x + particle.size * 0.55, particle.y - particle.size * 0.55);
    ctx.lineTo(particle.x + particle.size * 1.6, particle.y);
    ctx.lineTo(particle.x + particle.size * 0.55, particle.y + particle.size * 0.55);
    ctx.lineTo(particle.x, particle.y + particle.size * 1.6);
    ctx.lineTo(particle.x - particle.size * 0.55, particle.y + particle.size * 0.55);
    ctx.lineTo(particle.x - particle.size * 1.6, particle.y);
    ctx.lineTo(particle.x - particle.size * 0.55, particle.y - particle.size * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  for (const core of state.cores) drawCore(core);
  for (const meteor of state.meteors) drawMeteor(meteor);
  drawParticles();
  drawShip();

  if (state.paused) {
    ctx.fillStyle = "rgba(18, 37, 56, 0.52)";
    ctx.fillRect(0, 0, width(), height());
    ctx.fillStyle = "#fff7dd";
    ctx.font = "800 36px Microsoft YaHei, sans-serif";
    ctx.textAlign = "center";
    ctx.shadowColor = "#2b68bf";
    ctx.shadowBlur = 12;
    ctx.fillText("已暂停", width() / 2, height() / 2);
    ctx.shadowBlur = 0;
  }
}

function loop(timestamp) {
  if (document.hidden) {
    state.lastTime = timestamp;
    requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000 || 0);
  state.lastTime = timestamp;

  if (state.running && !state.paused) {
    updateShip(dt);
    updateWorld(dt);
    resolveCollisions();
    state.scoreFloat += 16 * dt;
    state.score = Math.floor(state.scoreFloat);
    updateHud();
  }

  if (state.running || state.paused || overlay.classList.contains("hidden")) {
    draw();
  }
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "继续" : "暂停";
  if (state.paused) stopMusic();
  else startMusic();
}

function setPointerFromEvent(event) {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const point = event.touches ? event.touches[0] : event;
  if (!point) {
    state.pointer = null;
    return;
  }
  state.pointer = {
    x: point.clientX - rect.left,
    y: point.clientY - rect.top,
  };
  fingerTip.classList.add("hidden");
}

function clearPointer(event) {
  event.preventDefault();
  state.pointer = null;
}

startButton.addEventListener("click", resetGame);
restartButton.addEventListener("click", resetGame);
pauseButton.addEventListener("click", togglePause);
soundButton.addEventListener("click", () => {
  setAudioEnabled(!audio.enabled);
  if (audio.enabled) playSfx("start");
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === " ") {
    event.preventDefault();
    togglePause();
    return;
  }
  state.keys.add(key);
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.key.toLowerCase());
});

if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", setPointerFromEvent);
  canvas.addEventListener("pointermove", (event) => {
    if (event.buttons || event.pointerType === "touch") setPointerFromEvent(event);
  });
  canvas.addEventListener("pointerup", clearPointer);
  canvas.addEventListener("pointercancel", clearPointer);
  canvas.addEventListener("pointerleave", clearPointer);
} else {
  canvas.addEventListener("touchstart", setPointerFromEvent, { passive: false });
  canvas.addEventListener("touchmove", setPointerFromEvent, { passive: false });
  canvas.addEventListener("touchend", clearPointer, { passive: false });
  canvas.addEventListener("touchcancel", clearPointer, { passive: false });
}

window.addEventListener("resize", () => {
  resizeCanvas();
  resetStars();
  ship.x = clamp(ship.x, 20, width() - 20);
  ship.y = clamp(ship.y, 20, height() - 20);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopMusic();
  } else if (state.running && !state.paused) {
    startMusic();
  }
});

setAudioEnabled(audio.enabled);
resizeCanvas();
resetStars();
updateHud();
draw();
requestAnimationFrame(loop);
