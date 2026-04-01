"use strict";

const MODES = {
  CLASSIC: "classic",
  AI_VS_HUMAN: "ai_vs_human",
};

const STORAGE_KEYS = {
  HIGH_SCORE: "fruitchop.pwa.high_score",
  SETTINGS: "fruitchop.pwa.settings",
};

const SETTINGS_DEFAULTS = {
  mode: MODES.CLASSIC,
  aiDifficulty: "medium",
};

const GAME_CONFIG = {
  fps: 60,
  startingLives: 3,
  maxLives: 5,
  skipsPerLifeLoss: 5,
  aiRoundSeconds: 60,
  aiBombPenalty: 2,
  baseSpawnInterval: 0.9,
};

const AI_DIFFICULTY = {
  easy: {
    label: "Easy",
    fruitHitChanceRange: [0.45, 0.55],
    reactionDelayRange: [0.4, 0.7],
    comboChanceRange: [0.1, 0.15],
    bombAvoidance: 0.6,
  },
  medium: {
    label: "Medium",
    fruitHitChanceRange: [0.6, 0.7],
    reactionDelayRange: [0.25, 0.45],
    comboChanceRange: [0.2, 0.3],
    bombAvoidance: 0.8,
  },
  hard: {
    label: "Hard",
    fruitHitChanceRange: [0.75, 0.85],
    reactionDelayRange: [0.12, 0.25],
    comboChanceRange: [0.35, 0.45],
    bombAvoidance: 0.92,
  },
};

const FRUIT_TYPES = [
  { name: "apple", color: "#de3345" },
  { name: "banana", color: "#f3dc64" },
  { name: "watermelon", color: "#45bf72" },
  { name: "pineapple", color: "#f2b550" },
  { name: "orange", color: "#f99f3d" },
];

const OUT_CODES = {
  LEFT: 1,
  RIGHT: 2,
  TOP: 4,
  BOTTOM: 8,
};

let nextObjectId = 1;

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function formatTime(seconds) {
  const clampedSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(clampedSeconds / 60);
  const remaining = clampedSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function comboBonusForHits(hits) {
  if (hits === 2) {
    return 1;
  }
  if (hits === 3) {
    return 2;
  }
  if (hits === 4) {
    return 4;
  }
  if (hits > 4) {
    return 4 + (hits - 4) * 2;
  }
  return 0;
}

function humanComboText(hits, bonus) {
  if (hits === 2) {
    return `Combo x2  +${bonus}`;
  }
  if (hits === 3) {
    return `Great Slice! Combo x3  +${bonus}`;
  }
  if (hits === 4) {
    return `Awesome Combo! x4  +${bonus}`;
  }
  return `Legendary Combo x${hits}  +${bonus}`;
}

function aiComboText(hits, bonus) {
  if (hits === 2) {
    return `AI Combo x2  +${bonus}`;
  }
  if (hits === 3) {
    return `AI Great Slice! x3  +${bonus}`;
  }
  if (hits === 4) {
    return `AI Awesome Combo! x4  +${bonus}`;
  }
  return `AI Legendary Combo x${hits}  +${bonus}`;
}

const Storage = {
  loadSettings() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) {
        return { ...SETTINGS_DEFAULTS };
      }
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === MODES.AI_VS_HUMAN ? MODES.AI_VS_HUMAN : MODES.CLASSIC,
        aiDifficulty: AI_DIFFICULTY[parsed.aiDifficulty] ? parsed.aiDifficulty : SETTINGS_DEFAULTS.aiDifficulty,
      };
    } catch {
      return { ...SETTINGS_DEFAULTS };
    }
  },

  saveSettings(settings) {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // Storage failure should not block gameplay.
    }
  },

  loadHighScore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
      if (!raw) {
        return 0;
      }
      const value = Number.parseInt(raw, 10);
      if (Number.isNaN(value) || value < 0) {
        return 0;
      }
      return value;
    } catch {
      return 0;
    }
  },

  saveHighScore(score) {
    try {
      const safeScore = Math.max(0, Math.floor(score));
      window.localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(safeScore));
    } catch {
      // Ignore write failures.
    }
  },
};

function getOutCode(x, y, bounds) {
  let code = 0;
  if (x < bounds.left) {
    code |= OUT_CODES.LEFT;
  } else if (x > bounds.right) {
    code |= OUT_CODES.RIGHT;
  }

  if (y < bounds.top) {
    code |= OUT_CODES.TOP;
  } else if (y > bounds.bottom) {
    code |= OUT_CODES.BOTTOM;
  }
  return code;
}

function clipSegmentToBounds(start, end, bounds) {
  let x0 = start.x;
  let y0 = start.y;
  let x1 = end.x;
  let y1 = end.y;

  while (true) {
    const code0 = getOutCode(x0, y0, bounds);
    const code1 = getOutCode(x1, y1, bounds);

    if (!(code0 | code1)) {
      return [{ x: x0, y: y0 }, { x: x1, y: y1 }];
    }

    if (code0 & code1) {
      return null;
    }

    const outCode = code0 || code1;
    let x = 0;
    let y = 0;

    if (outCode & OUT_CODES.BOTTOM) {
      if (y1 === y0) {
        return null;
      }
      x = x0 + ((x1 - x0) * (bounds.bottom - y0)) / (y1 - y0);
      y = bounds.bottom;
    } else if (outCode & OUT_CODES.TOP) {
      if (y1 === y0) {
        return null;
      }
      x = x0 + ((x1 - x0) * (bounds.top - y0)) / (y1 - y0);
      y = bounds.top;
    } else if (outCode & OUT_CODES.RIGHT) {
      if (x1 === x0) {
        return null;
      }
      y = y0 + ((y1 - y0) * (bounds.right - x0)) / (x1 - x0);
      x = bounds.right;
    } else {
      if (x1 === x0) {
        return null;
      }
      y = y0 + ((y1 - y0) * (bounds.left - x0)) / (x1 - x0);
      x = bounds.left;
    }

    if (outCode === code0) {
      x0 = x;
      y0 = y;
    } else {
      x1 = x;
      y1 = y;
    }
  }
}

function lineCircleCollision(start, end, center, radius) {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSq = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSq === 0) {
    const dx = start.x - center.x;
    const dy = start.y - center.y;
    return dx * dx + dy * dy <= radius * radius;
  }

  let projection = ((center.x - start.x) * segmentX + (center.y - start.y) * segmentY) / segmentLengthSq;
  projection = clamp(projection, 0, 1);
  const closestX = start.x + segmentX * projection;
  const closestY = start.y + segmentY * projection;
  const dx = closestX - center.x;
  const dy = closestY - center.y;
  return dx * dx + dy * dy <= radius * radius;
}

class BladeTrail {
  constructor(maxPoints = 30, trailLifetime = 0.18) {
    this.maxPoints = maxPoints;
    this.trailLifetime = trailLifetime;
    this.points = [];
    this.isSwiping = false;
    this.swipeHits = 0;
    this.releasedHits = 0;
  }

  reset() {
    this.points = [];
    this.isSwiping = false;
    this.swipeHits = 0;
    this.releasedHits = 0;
  }

  rescale(scaleX, scaleY) {
    this.points = this.points.map((entry) => ({
      ...entry,
      x: entry.x * scaleX,
      y: entry.y * scaleY,
    }));
  }

  update(pointerPos, pointerPressed, now, bounds) {
    this.trim(now);
    const boundedPoint = this.clampPoint(pointerPos, bounds);
    const inside = this.pointInBounds(pointerPos, bounds);

    if (!pointerPressed) {
      this.endSwipe();
      return;
    }

    if (!inside) {
      if (this.isSwiping) {
        this.pushPointIfFar(boundedPoint, now);
        this.endSwipe();
      }
      return;
    }

    if (!this.isSwiping) {
      this.isSwiping = true;
      this.swipeHits = 0;
      this.points = [];
      this.points.push({ x: boundedPoint.x, y: boundedPoint.y, t: now });
      return;
    }

    this.pushPointIfFar(boundedPoint, now);
  }

  registerSlice() {
    if (this.isSwiping) {
      this.swipeHits += 1;
    }
  }

  consumeComboHits() {
    const hits = this.releasedHits;
    this.releasedHits = 0;
    return hits;
  }

  getSegments(bounds) {
    if (this.points.length < 2) {
      return [];
    }

    const segments = [];
    for (let i = 1; i < this.points.length; i += 1) {
      const start = { x: this.points[i - 1].x, y: this.points[i - 1].y };
      const end = { x: this.points[i].x, y: this.points[i].y };
      const clipped = clipSegmentToBounds(start, end, bounds);
      if (clipped) {
        segments.push({ start: clipped[0], end: clipped[1] });
      }
    }
    return segments;
  }

  draw(ctx, bounds) {
    const segments = this.getSegments(bounds);
    if (!segments.length) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.clip();

    const segmentCount = segments.length;
    segments.forEach((segment, index) => {
      const strength = (index + 1) / Math.max(1, segmentCount);
      const width = Math.max(2, Math.floor(12 * strength));
      const r = Math.floor(85 + 155 * strength);
      const g = Math.floor(185 + 55 * strength);
      const color = `rgb(${r} ${g} 255)`;

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(segment.end.x, segment.end.y);
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(segment.end.x, segment.end.y, Math.max(1, Math.floor(width / 3)), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  trim(now) {
    this.points = this.points.filter((entry) => now - entry.t <= this.trailLifetime);
  }

  endSwipe() {
    if (!this.isSwiping) {
      return;
    }
    this.releasedHits = this.swipeHits;
    this.isSwiping = false;
  }

  pushPointIfFar(point, now) {
    const last = this.points[this.points.length - 1];
    if (last) {
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      if (dx * dx + dy * dy < 4) {
        return;
      }
    }
    this.points.push({ x: point.x, y: point.y, t: now });
    if (this.points.length > this.maxPoints) {
      this.points.splice(0, this.points.length - this.maxPoints);
    }
  }

  pointInBounds(point, bounds) {
    return (
      point.x >= bounds.left &&
      point.x <= bounds.right &&
      point.y >= bounds.top &&
      point.y <= bounds.bottom
    );
  }

  clampPoint(point, bounds) {
    return {
      x: clamp(point.x, bounds.left, bounds.right),
      y: clamp(point.y, bounds.top, bounds.bottom),
    };
  }
}

class AISlashEffect {
  constructor(maxTrails = 14) {
    this.maxTrails = maxTrails;
    this.trails = [];
  }

  clear() {
    this.trails = [];
  }

  addSlash(start, end, color, width = 8, duration = 0.24) {
    this.trails.push({
      start: { ...start },
      end: { ...end },
      color,
      width: Math.max(2, width),
      life: Math.max(0.06, duration),
      maxLife: Math.max(0.06, duration),
    });
    if (this.trails.length > this.maxTrails) {
      this.trails.splice(0, this.trails.length - this.maxTrails);
    }
  }

  update(dt) {
    this.trails = this.trails
      .map((trail) => ({ ...trail, life: trail.life - dt }))
      .filter((trail) => trail.life > 0);
  }

  draw(ctx, bounds) {
    if (!this.trails.length) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
    ctx.clip();

    this.trails.forEach((trail) => {
      const age = 1 - trail.life / trail.maxLife;
      const travelProgress = clamp(age / 0.35, 0, 1);
      const alpha = Math.floor(255 * clamp(1 - age, 0, 1));
      const width = Math.max(2, Math.floor(trail.width * (1 - age * 0.45)));
      const visibleEnd = {
        x: trail.start.x + (trail.end.x - trail.start.x) * travelProgress,
        y: trail.start.y + (trail.end.y - trail.start.y) * travelProgress,
      };

      ctx.strokeStyle = `rgba(${trail.color.r}, ${trail.color.g}, ${trail.color.b}, ${alpha / 255})`;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(trail.start.x, trail.start.y);
      ctx.lineTo(visibleEnd.x, visibleEnd.y);
      ctx.stroke();

      ctx.fillStyle = `rgba(${trail.color.r}, ${trail.color.g}, ${trail.color.b}, ${alpha / 255})`;
      ctx.beginPath();
      ctx.arc(visibleEnd.x, visibleEnd.y, Math.max(2, Math.floor(width / 2)), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  rescale(scaleX, scaleY) {
    this.trails = this.trails.map((trail) => ({
      ...trail,
      start: { x: trail.start.x * scaleX, y: trail.start.y * scaleY },
      end: { x: trail.end.x * scaleX, y: trail.end.y * scaleY },
    }));
  }
}

class AIController {
  constructor(level = "medium") {
    this.score = 0;
    this.comboText = "";
    this.comboTimer = 0;
    this.statusText = "";
    this.statusTimer = 0;
    this.difficultyLevel = level;
    this.profile = AI_DIFFICULTY[level] || AI_DIFFICULTY.medium;
    this.nextActionAt = 0;
    this.visibleSince = new Map();
    this.reactionDelayByObject = new Map();
    this.slashEffect = new AISlashEffect(12);
  }

  setDifficulty(level) {
    this.difficultyLevel = AI_DIFFICULTY[level] ? level : "medium";
    this.profile = AI_DIFFICULTY[this.difficultyLevel];
  }

  reset(now) {
    this.score = 0;
    this.comboText = "";
    this.comboTimer = 0;
    this.statusText = "";
    this.statusTimer = 0;
    this.nextActionAt = now + randomRange(...this.profile.reactionDelayRange);
    this.visibleSince.clear();
    this.reactionDelayByObject.clear();
    this.slashEffect.clear();
  }

  get difficultyLabel() {
    return this.profile.label;
  }

  update(dt) {
    this.slashEffect.update(dt);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
    }
    if (this.statusTimer > 0) {
      this.statusTimer = Math.max(0, this.statusTimer - dt);
    }
  }

  decide(now, objects, bounds, roundProgress) {
    this.syncVisibility(now, objects, bounds);
    if (now < this.nextActionAt) {
      return null;
    }

    const reactableObjects = objects.filter(
      (obj) => this.isFullyVisible(obj, bounds) && this.reactionReady(obj, now),
    );

    const regularFruits = reactableObjects.filter((obj) => obj.kind === "fruit");
    const hearts = reactableObjects.filter((obj) => obj.kind === "heart");
    const bombs = reactableObjects.filter((obj) => obj.kind === "bomb");

    if (!regularFruits.length && !hearts.length && !bombs.length) {
      this.nextActionAt = now + Math.min(0.16, randomRange(...this.profile.reactionDelayRange) * 0.45);
      return null;
    }

    const pressure = (roundProgress - 0.5) * 0.06;
    const fruitHitChance = clamp(randomRange(...this.profile.fruitHitChanceRange) + pressure, 0.15, 0.96);
    const comboChance = clamp(randomRange(...this.profile.comboChanceRange) + pressure * 0.8, 0, 0.88);

    const targets = this.pickTargets([...regularFruits, ...hearts], comboChance, bounds);
    const slicedTargets = targets.filter(() => Math.random() < fruitHitChance);
    const scoredTargets = slicedTargets.filter((obj) => obj.kind === "fruit");

    let comboBonus = 0;
    let pointsGained = 0;
    if (scoredTargets.length) {
      pointsGained = scoredTargets.length;
      if (scoredTargets.length > 1) {
        comboBonus = comboBonusForHits(scoredTargets.length);
        pointsGained += comboBonus;
        this.comboText = aiComboText(scoredTargets.length, comboBonus);
        this.comboTimer = 1;
      } else {
        this.statusText = "AI Slice";
        this.statusTimer = 0.55;
      }
      this.score += pointsGained;
      this.spawnSlashTrail(slicedTargets, true, false, bounds);
    } else if (slicedTargets.length) {
      this.statusText = "AI Slice";
      this.statusTimer = 0.45;
      this.spawnSlashTrail(slicedTargets, true, false, bounds);
    } else if (targets.length) {
      this.spawnSlashTrail([targets[0]], false, false, bounds);
    }

    let bombTarget = null;
    if (bombs.length && this.shouldMakeBombMistake()) {
      bombTarget = bombs[Math.floor(Math.random() * bombs.length)];
      this.spawnSlashTrail([bombTarget], false, true, bounds);
    }

    this.nextActionAt = now + randomRange(...this.profile.reactionDelayRange);
    if (!slicedTargets.length && !bombTarget) {
      this.nextActionAt = now + Math.max(0.08, randomRange(...this.profile.reactionDelayRange) * 0.7);
    }

    if (!slicedTargets.length && !bombTarget) {
      return null;
    }

    return { slicedTargets, bombTarget, pointsGained, comboBonus };
  }

  applyBombPenalty(penalty) {
    const amount = Math.max(0, penalty);
    this.score = Math.max(0, this.score - amount);
    this.statusText = `AI Mistake -${amount}`;
    this.statusTimer = 1;
  }

  draw(ctx, bounds) {
    this.slashEffect.draw(ctx, bounds);
  }

  rescale(scaleX, scaleY) {
    this.slashEffect.rescale(scaleX, scaleY);
  }

  syncVisibility(now, objects, bounds) {
    const activeIds = new Set(objects.map((obj) => obj.id));
    [...this.visibleSince.keys()].forEach((id) => {
      if (!activeIds.has(id)) {
        this.visibleSince.delete(id);
        this.reactionDelayByObject.delete(id);
      }
    });

    objects.forEach((obj) => {
      if (!this.isFullyVisible(obj, bounds)) {
        this.visibleSince.delete(obj.id);
        this.reactionDelayByObject.delete(obj.id);
        return;
      }
      if (!this.visibleSince.has(obj.id)) {
        this.visibleSince.set(obj.id, now);
        this.reactionDelayByObject.set(obj.id, randomRange(...this.profile.reactionDelayRange));
      }
    });
  }

  isFullyVisible(obj, bounds) {
    const left = obj.x - obj.radius;
    const right = obj.x + obj.radius;
    const top = obj.y - obj.radius;
    const bottom = obj.y + obj.radius;
    return left >= bounds.left && right <= bounds.right && top >= bounds.top && bottom <= bounds.bottom;
  }

  reactionReady(obj, now) {
    if (!this.visibleSince.has(obj.id)) {
      return false;
    }
    const delay = this.reactionDelayByObject.get(obj.id) ?? 0;
    return now - this.visibleSince.get(obj.id) >= delay;
  }

  pickTargets(candidates, comboChance, bounds) {
    if (!candidates.length) {
      return [];
    }
    const centerX = (bounds.left + bounds.right) * 0.5;
    const sorted = [...candidates].sort((a, b) => a.y - b.y || Math.abs(a.x - centerX) - Math.abs(b.x - centerX));
    if (sorted.length === 1) {
      return [sorted[0]];
    }

    if (Math.random() >= comboChance) {
      return [sorted[0]];
    }

    const seed = sorted[0];
    const nearby = [...sorted].sort((a, b) => {
      const da = (a.x - seed.x) ** 2 + (a.y - seed.y) ** 2;
      const db = (b.x - seed.x) ** 2 + (b.y - seed.y) ** 2;
      return da - db;
    });

    let targetCount = 2;
    if (nearby.length >= 3 && Math.random() < 0.36) {
      targetCount = 3;
    }
    return nearby.slice(0, targetCount);
  }

  shouldMakeBombMistake() {
    const mistakeBase = Math.max(0.02, (1 - this.profile.bombAvoidance) * 0.5);
    return Math.random() < mistakeBase;
  }

  spawnSlashTrail(targets, success, bomb, bounds) {
    if (!targets.length) {
      return;
    }
    const first = targets[0];
    const last = targets[targets.length - 1];
    let dirX = last.x - first.x;
    let dirY = last.y - first.y;
    const length = Math.hypot(dirX, dirY);
    if (length <= 1e-4) {
      dirX = 1;
      dirY = -0.2;
    } else {
      dirX /= length;
      dirY /= length;
    }
    const normalX = -dirY;
    const normalY = dirX;

    const start = {
      x: clamp(first.x - dirX * 62 + normalX * 8, bounds.left, bounds.right),
      y: clamp(first.y - dirY * 62 + normalY * 8, bounds.top, bounds.bottom),
    };
    const end = {
      x: clamp(last.x + dirX * 62 - normalX * 8, bounds.left, bounds.right),
      y: clamp(last.y + dirY * 62 - normalY * 8, bounds.top, bounds.bottom),
    };

    let color = { r: 70, g: 170, b: 255 };
    if (bomb) {
      color = { r: 255, g: 105, b: 105 };
    } else if (!success) {
      color = { r: 110, g: 130, b: 170 };
    }

    this.slashEffect.addSlash(start, end, color, success ? 9 : 7, success ? 0.28 : 0.22);
  }
}

class GameApp {
  constructor() {
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.hudEl = document.getElementById("hud");
    this.menuOverlay = document.getElementById("menu-overlay");
    this.resultOverlay = document.getElementById("result-overlay");
    this.startBtn = document.getElementById("start-btn");
    this.installBtn = document.getElementById("install-btn");
    this.restartBtn = document.getElementById("restart-btn");
    this.backMenuBtn = document.getElementById("back-menu-btn");
    this.modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
    this.difficultyButtons = Array.from(document.querySelectorAll(".difficulty-btn"));
    this.difficultyGroup = document.getElementById("difficulty-group");

    this.hudHumanScore = document.getElementById("hud-human-score");
    this.hudAiScore = document.getElementById("hud-ai-score");
    this.hudMode = document.getElementById("hud-mode");
    this.hudTimer = document.getElementById("hud-timer");
    this.hudLives = document.getElementById("hud-lives");
    this.hudDifficulty = document.getElementById("hud-difficulty");
    this.hudHighScore = document.getElementById("hud-high-score");

    this.resultTitle = document.getElementById("result-title");
    this.resultOutcome = document.getElementById("result-outcome");
    this.resultHumanScore = document.getElementById("result-human-score");
    this.resultAiScore = document.getElementById("result-ai-score");
    this.resultHighScore = document.getElementById("result-high-score");
    this.resultNewHigh = document.getElementById("result-new-high");

    this.bounds = { left: 0, top: 0, right: 0, bottom: 0 };
    this.dpr = 1;
    this.lastFrameTime = 0;

    this.settings = Storage.loadSettings();
    this.mode = this.settings.mode;
    this.highScore = Storage.loadHighScore();
    this.newHighScoreAchieved = false;

    this.state = "menu";
    this.pendingEndReason = "";
    this.objects = [];
    this.particles = [];
    this.blastCenter = { x: 0, y: 0 };
    this.blastTimer = 0;
    this.blastDuration = 0.5;

    this.blade = new BladeTrail();
    this.aiController = new AIController(this.settings.aiDifficulty);

    this.pointer = {
      x: 0,
      y: 0,
      pressed: false,
      pointerId: null,
    };

    this.humanScore = 0;
    this.aiScore = 0;
    this.lives = GAME_CONFIG.startingLives;
    this.skippedFruits = 0;
    this.roundTimeRemaining = GAME_CONFIG.aiRoundSeconds;
    this.elapsedTime = 0;
    this.spawnCooldown = 0;
    this.spawnInterval = GAME_CONFIG.baseSpawnInterval;
    this.speedMultiplier = 1;
    this.heartSpawnCooldown = randomRange(4.5, 7);

    this.humanComboText = "";
    this.humanComboTimer = 0;

    this.installPromptEvent = null;

    this.bindEvents();
    this.applySettingsToUI();
    this.resizeCanvas();
    this.backToMenu();
    requestAnimationFrame(this.gameLoop);
  }

  bindEvents() {
    this.gameLoop = this.gameLoop.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    window.addEventListener("resize", () => this.resizeCanvas());
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("lostpointercapture", this.onPointerUp);

    this.startBtn.addEventListener("click", () => this.startGame());
    this.restartBtn.addEventListener("click", () => this.startGame());
    this.backMenuBtn.addEventListener("click", () => this.backToMenu());

    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === MODES.AI_VS_HUMAN ? MODES.AI_VS_HUMAN : MODES.CLASSIC;
        this.settings.mode = nextMode;
        this.mode = nextMode;
        Storage.saveSettings(this.settings);
        this.applySettingsToUI();
      });
    });

    this.difficultyButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextDifficulty = button.dataset.difficulty;
        if (!AI_DIFFICULTY[nextDifficulty]) {
          return;
        }
        this.settings.aiDifficulty = nextDifficulty;
        this.aiController.setDifficulty(nextDifficulty);
        Storage.saveSettings(this.settings);
        this.applySettingsToUI();
      });
    });

    this.installBtn.addEventListener("click", async () => {
      if (!this.installPromptEvent) {
        return;
      }
      this.installPromptEvent.prompt();
      await this.installPromptEvent.userChoice;
      this.installPromptEvent = null;
      this.installBtn.classList.add("hidden");
    });

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.installPromptEvent = event;
      this.installBtn.classList.remove("hidden");
    });

    window.addEventListener("appinstalled", () => {
      this.installPromptEvent = null;
      this.installBtn.classList.add("hidden");
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        if (this.state === "menu") {
          this.startGame();
        } else if (this.state === "result") {
          this.startGame();
        }
      }

      if (event.key === "Escape" && this.state === "running") {
        this.backToMenu();
      }

      if (event.key === "m" && this.state === "result") {
        this.backToMenu();
      }
    });
  }

  applySettingsToUI() {
    this.modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === this.settings.mode);
    });

    this.difficultyButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.difficulty === this.settings.aiDifficulty);
    });

    this.difficultyGroup.classList.toggle("hidden", this.settings.mode !== MODES.AI_VS_HUMAN);
  }

  resizeCanvas() {
    const oldWidth = this.bounds.right - this.bounds.left;
    const oldHeight = this.bounds.bottom - this.bounds.top;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(window.innerWidth));
    const height = Math.max(1, Math.floor(window.innerHeight));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.bounds = { left: 0, top: 0, right: width, bottom: height };

    const newWidth = width;
    const newHeight = height;
    if (oldWidth > 0 && oldHeight > 0) {
      const scaleX = newWidth / oldWidth;
      const scaleY = newHeight / oldHeight;
      this.rescaleRuntimeObjects(scaleX, scaleY);
    }
  }

  rescaleRuntimeObjects(scaleX, scaleY) {
    this.objects.forEach((obj) => {
      obj.x *= scaleX;
      obj.y *= scaleY;
      obj.vx *= scaleX;
      obj.vy *= scaleY;
      obj.radius *= Math.min(scaleX, scaleY);
      obj.x = clamp(obj.x, obj.radius, this.bounds.right - obj.radius);
    });

    this.particles.forEach((particle) => {
      particle.x *= scaleX;
      particle.y *= scaleY;
      particle.vx *= scaleX;
      particle.vy *= scaleY;
    });

    this.blastCenter.x *= scaleX;
    this.blastCenter.y *= scaleY;
    this.blade.rescale(scaleX, scaleY);
    this.aiController.rescale(scaleX, scaleY);
  }

  getPointFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * (this.bounds.right - this.bounds.left);
    const y = ((event.clientY - rect.top) / rect.height) * (this.bounds.bottom - this.bounds.top);
    return { x, y };
  }

  isInsideBounds(point) {
    return (
      point.x >= this.bounds.left &&
      point.x <= this.bounds.right &&
      point.y >= this.bounds.top &&
      point.y <= this.bounds.bottom
    );
  }

  onPointerDown(event) {
    const point = this.getPointFromEvent(event);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.pointerId = event.pointerId;
    this.pointer.pressed = this.isInsideBounds(point);
    if (this.pointer.pressed) {
      this.canvas.setPointerCapture(event.pointerId);
    }
  }

  onPointerMove(event) {
    if (this.pointer.pointerId !== event.pointerId) {
      return;
    }
    const point = this.getPointFromEvent(event);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
  }

  onPointerUp(event) {
    if (this.pointer.pointerId !== null && event.pointerId !== this.pointer.pointerId) {
      return;
    }
    this.pointer.pressed = false;
    this.pointer.pointerId = null;
  }

  startGame() {
    const now = performance.now() / 1000;
    this.mode = this.settings.mode;
    this.state = "running";
    this.pendingEndReason = "";
    this.newHighScoreAchieved = false;

    this.humanScore = 0;
    this.aiScore = 0;
    this.lives = GAME_CONFIG.startingLives;
    this.skippedFruits = 0;
    this.roundTimeRemaining = GAME_CONFIG.aiRoundSeconds;
    this.elapsedTime = 0;
    this.spawnCooldown = 0.35;
    this.spawnInterval = GAME_CONFIG.baseSpawnInterval;
    this.speedMultiplier = 1;
    this.heartSpawnCooldown = randomRange(4.5, 7);

    this.humanComboText = "";
    this.humanComboTimer = 0;
    this.blastTimer = 0;

    this.objects = [];
    this.particles = [];
    this.blade.reset();
    this.aiController.setDifficulty(this.settings.aiDifficulty);
    this.aiController.reset(now);

    this.menuOverlay.classList.add("hidden");
    this.resultOverlay.classList.add("hidden");
    this.hudEl.classList.remove("hidden");
  }

  backToMenu() {
    this.state = "menu";
    this.objects = [];
    this.particles = [];
    this.blade.reset();
    this.pendingEndReason = "";
    this.menuOverlay.classList.remove("hidden");
    this.resultOverlay.classList.add("hidden");
    this.hudEl.classList.add("hidden");
  }

  gameLoop(timestamp) {
    const now = timestamp / 1000;
    if (!this.lastFrameTime) {
      this.lastFrameTime = now;
    }
    const dt = Math.min(1 / 30, now - this.lastFrameTime);
    this.lastFrameTime = now;

    this.update(now, dt);
    this.draw();
    requestAnimationFrame(this.gameLoop);
  }

  update(now, dt) {
    this.blade.update(
      { x: this.pointer.x, y: this.pointer.y },
      this.pointer.pressed,
      now,
      this.bounds,
    );
    this.updateParticles(dt);
    this.aiController.update(dt);

    if (this.humanComboTimer > 0) {
      this.humanComboTimer = Math.max(0, this.humanComboTimer - dt);
    }

    if (this.state === "bomb_blast") {
      this.blastTimer = Math.max(0, this.blastTimer - dt);
      if (this.blastTimer <= 0) {
        this.finishGame(this.pendingEndReason || "bomb_blast");
      }
      this.refreshHud();
      return;
    }

    if (this.state !== "running") {
      this.refreshHud();
      return;
    }

    if (this.mode === MODES.AI_VS_HUMAN) {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
      if (this.roundTimeRemaining <= 0) {
        this.finishGame("time_up");
        return;
      }
    }

    this.updateDifficulty(dt);
    this.updateSpawning(dt);
    this.updateObjects(dt);
    this.handleHumanSlicing();

    if (this.state === "running" && this.mode === MODES.AI_VS_HUMAN) {
      this.handleAiTurn(now);
    }

    if (this.state === "running") {
      this.handleMissedObjects();
      this.handleHumanComboBonus();
    }

    this.refreshHud();
  }

  updateDifficulty(dt) {
    this.elapsedTime += dt;
    const progressScore =
      this.mode === MODES.AI_VS_HUMAN ? (this.humanScore + this.aiScore) * 0.5 : this.humanScore;

    let targetSpeed = 1;
    let targetInterval = GAME_CONFIG.baseSpawnInterval;
    if (progressScore <= 20) {
      targetSpeed = 1;
      targetInterval = 0.9;
    } else if (progressScore <= 50) {
      const mid = (progressScore - 20) / 30;
      targetSpeed = 1 + 0.28 * mid;
      targetInterval = 0.9 - 0.13 * mid;
    } else {
      const high = progressScore - 50;
      targetSpeed = clamp(1.28 + high * 0.008, 1.28, 1.85);
      targetInterval = clamp(0.77 - high * 0.0025, 0.34, 0.77);
    }

    const smoothing = Math.min(1, dt * 4);
    this.speedMultiplier += (targetSpeed - this.speedMultiplier) * smoothing;
    this.spawnInterval += (targetInterval - this.spawnInterval) * smoothing;
  }

  updateSpawning(dt) {
    this.heartSpawnCooldown = Math.max(0, this.heartSpawnCooldown - dt);
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) {
      return;
    }
    this.spawnWave();
    this.spawnCooldown = this.spawnInterval * randomRange(0.85, 1.15);
  }

  spawnWave() {
    const progressScore =
      this.mode === MODES.AI_VS_HUMAN ? (this.humanScore + this.aiScore) * 0.5 : this.humanScore;
    const difficulty = Math.min(1, progressScore / 85);
    let objectCount = 1;
    if (Math.random() < 0.45 + difficulty * 0.35) {
      objectCount += 1;
    }
    if (Math.random() < 0.15 + difficulty * 0.3) {
      objectCount += 1;
    }
    for (let i = 0; i < objectCount; i += 1) {
      this.spawnObject();
    }
  }

  spawnObject() {
    const baseX = this.bounds.right * 0.5;
    const baseY = this.bounds.bottom + Math.max(55, this.bounds.bottom * 0.1);
    const launch = this.buildLaunchProfile();

    if (this.shouldSpawnHeart()) {
      this.spawnHeart(baseX, baseY, launch);
      return;
    }

    const progressScore =
      this.mode === MODES.AI_VS_HUMAN ? (this.humanScore + this.aiScore) * 0.5 : this.humanScore;
    const bombChance = Math.min(0.24, 0.1 + progressScore * 0.0018);
    if (Math.random() < bombChance) {
      this.spawnBomb(baseX, baseY, launch);
      return;
    }
    this.spawnFruit(baseX, baseY, launch);
  }

  shouldSpawnHeart() {
    if (this.heartSpawnCooldown > 0) {
      return false;
    }
    if (Math.random() >= 0.03) {
      return false;
    }
    this.heartSpawnCooldown = randomRange(7, 12);
    return true;
  }

  buildLaunchProfile() {
    const height = this.bounds.bottom - this.bounds.top;
    const width = this.bounds.right - this.bounds.left;
    const motionScale = clamp(height / 720, 0.75, 1.7);
    const difficultyScale = 1 + (this.speedMultiplier - 1) * 0.9;
    const riseRatio = randomRange(0.3, 1.08);
    const riseDistance = height * riseRatio;

    const gravity = randomRange(820, 1120) * motionScale * difficultyScale;
    let vy = -Math.sqrt(Math.max(1, 2 * gravity * riseDistance));
    vy *= randomRange(0.97, 1.05);

    const horizontalRange = Math.max(85, width * 0.11) * motionScale;
    const horizontalBoost = 1 + (this.speedMultiplier - 1) * 0.35;
    const vx = randomRange(-horizontalRange, horizontalRange) * horizontalBoost;

    const sizeScale = clamp(Math.min(width / 1280, height / 720), 0.72, 1.35);
    const scale = randomRange(0.78, 1.08) * sizeScale;
    return { vx, vy, gravity, scale };
  }

  spawnFruit(x, y, launch) {
    const fruit = FRUIT_TYPES[Math.floor(Math.random() * FRUIT_TYPES.length)];
    const radius = 34 * launch.scale;
    this.objects.push({
      id: nextObjectId++,
      kind: "fruit",
      name: fruit.name,
      color: fruit.color,
      x: randomRange(radius, this.bounds.right - radius),
      y,
      vx: launch.vx,
      vy: launch.vy,
      gravity: launch.gravity,
      radius,
      pulse: randomRange(0, Math.PI * 2),
    });
  }

  spawnBomb(x, y, launch) {
    const radius = 31 * launch.scale;
    this.objects.push({
      id: nextObjectId++,
      kind: "bomb",
      name: "bomb",
      color: "#272a2f",
      x: randomRange(radius, this.bounds.right - radius),
      y,
      vx: launch.vx,
      vy: launch.vy,
      gravity: launch.gravity,
      radius,
      pulse: randomRange(0, Math.PI * 2),
    });
  }

  spawnHeart(x, y, launch) {
    const radius = 29 * launch.scale;
    this.objects.push({
      id: nextObjectId++,
      kind: "heart",
      name: "heart",
      color: "#ff5f87",
      x: randomRange(radius, this.bounds.right - radius),
      y,
      vx: launch.vx,
      vy: launch.vy,
      gravity: launch.gravity,
      radius,
      pulse: randomRange(0, Math.PI * 2),
    });
  }

  updateObjects(dt) {
    this.objects.forEach((obj) => {
      obj.vy += obj.gravity * dt;
      obj.x += obj.vx * dt;
      obj.y += obj.vy * dt;
      obj.pulse += dt * 6;

      const leftBound = obj.radius;
      const rightBound = Math.max(leftBound, this.bounds.right - obj.radius);
      if (obj.x < leftBound) {
        obj.x = leftBound;
        if (obj.vx < 0) {
          obj.vx = 0;
        }
      } else if (obj.x > rightBound) {
        obj.x = rightBound;
        if (obj.vx > 0) {
          obj.vx = 0;
        }
      }
    });
  }

  handleHumanSlicing() {
    const segments = this.blade.getSegments(this.bounds);
    if (!segments.length) {
      return;
    }

    const survivors = [];
    for (const obj of this.objects) {
      const hit = segments.some((segment) =>
        lineCircleCollision(segment.start, segment.end, { x: obj.x, y: obj.y }, obj.radius * 0.95),
      );
      if (!hit) {
        survivors.push(obj);
        continue;
      }

      if (obj.kind === "bomb") {
        this.triggerBombBlast({ x: obj.x, y: obj.y }, "human_bomb");
        return;
      }

      if (obj.kind === "heart") {
        this.collectHeart(obj);
        continue;
      }

      this.sliceFruit(obj);
    }
    this.objects = survivors;
  }

  sliceFruit(fruit) {
    this.humanScore += 1;
    this.blade.registerSlice();
    this.spawnJuiceSplash({ x: fruit.x, y: fruit.y }, fruit.color);
  }

  collectHeart(heart) {
    this.lives = Math.min(GAME_CONFIG.maxLives, this.lives + 1);
    this.spawnJuiceSplash({ x: heart.x, y: heart.y }, heart.color);
  }

  handleAiTurn(now) {
    const decision = this.aiController.decide(now, this.objects, this.bounds, this.roundProgress());
    if (!decision) {
      this.aiScore = this.aiController.score;
      return;
    }

    const removedIds = new Set();
    decision.slicedTargets.forEach((target) => {
      removedIds.add(target.id);
      const splashColor = target.kind === "heart" ? "#ff80a4" : "#62b0ff";
      this.spawnJuiceSplash({ x: target.x, y: target.y }, splashColor);
    });

    if (decision.bombTarget) {
      removedIds.add(decision.bombTarget.id);
      this.aiController.applyBombPenalty(GAME_CONFIG.aiBombPenalty);
      this.spawnJuiceSplash({ x: decision.bombTarget.x, y: decision.bombTarget.y }, "#ff7373");
      this.spawnJuiceSplash({ x: decision.bombTarget.x, y: decision.bombTarget.y }, "#ff7373");
    }

    if (removedIds.size > 0) {
      this.objects = this.objects.filter((obj) => !removedIds.has(obj.id));
    }

    this.aiScore = this.aiController.score;
  }

  handleMissedObjects() {
    const remaining = [];
    for (const obj of this.objects) {
      const offScreen = obj.y - obj.radius > this.bounds.bottom + 120;
      if (!offScreen) {
        remaining.push(obj);
        continue;
      }

      if (obj.kind === "fruit") {
        this.skippedFruits += 1;
        if (this.skippedFruits >= GAME_CONFIG.skipsPerLifeLoss) {
          this.skippedFruits = 0;
          this.lives -= 1;
          if (this.lives <= 0) {
            this.finishGame(this.mode === MODES.AI_VS_HUMAN ? "human_out_of_lives" : "classic_lives_depleted");
            return;
          }
        }
      }
    }
    this.objects = remaining;
  }

  handleHumanComboBonus() {
    const hits = this.blade.consumeComboHits();
    if (hits <= 1) {
      return;
    }
    const bonus = comboBonusForHits(hits);
    this.humanScore += bonus;
    this.humanComboText = humanComboText(hits, bonus);
    this.humanComboTimer = 1;
  }

  triggerBombBlast(position, reason) {
    this.state = "bomb_blast";
    this.pendingEndReason = reason;
    this.blastCenter = { ...position };
    this.blastTimer = this.blastDuration;
    this.objects = [];
    this.blade.reset();
    for (let i = 0; i < 3; i += 1) {
      this.spawnJuiceSplash(position, "#ff5f52");
    }
  }

  finishGame(reason) {
    if (this.state === "result") {
      return;
    }
    this.state = "result";

    if (this.humanScore > this.highScore) {
      this.highScore = this.humanScore;
      this.newHighScoreAchieved = true;
      Storage.saveHighScore(this.highScore);
    } else {
      this.newHighScoreAchieved = false;
    }

    let title = "Game Over";
    let outcome = "Try Again!";
    let winner = "none";

    if (this.mode === MODES.AI_VS_HUMAN) {
      title = "Match Over";
      if (reason === "human_bomb") {
        outcome = "AI Wins! Bomb Hit";
        winner = "ai";
      } else if (reason === "human_out_of_lives") {
        outcome = "AI Wins! Out Of Lives";
        winner = "ai";
      } else if (this.humanScore > this.aiScore) {
        outcome = "You Win!";
        winner = "human";
      } else if (this.humanScore < this.aiScore) {
        outcome = "AI Wins!";
        winner = "ai";
      } else {
        outcome = "Draw!";
        winner = "draw";
      }
    }

    this.resultTitle.textContent = title;
    this.resultOutcome.textContent = outcome;
    this.resultOutcome.style.color =
      winner === "human" ? "#f4e87a" : winner === "ai" ? "#84c4ff" : winner === "draw" ? "#d7dee9" : "#ffffff";
    this.resultHumanScore.textContent = String(this.humanScore);
    this.resultAiScore.textContent = this.mode === MODES.AI_VS_HUMAN ? String(this.aiScore) : "-";
    this.resultHighScore.textContent = String(this.highScore);
    this.resultNewHigh.classList.toggle("hidden", !this.newHighScoreAchieved);

    this.menuOverlay.classList.add("hidden");
    this.resultOverlay.classList.remove("hidden");
    this.hudEl.classList.add("hidden");
    this.objects = [];
    this.blade.reset();
  }

  roundProgress() {
    if (this.mode !== MODES.AI_VS_HUMAN) {
      return 0;
    }
    const elapsed = GAME_CONFIG.aiRoundSeconds - this.roundTimeRemaining;
    return clamp(elapsed / GAME_CONFIG.aiRoundSeconds, 0, 1);
  }

  spawnJuiceSplash(position, color) {
    const count = Math.floor(randomRange(13, 21));
    for (let i = 0; i < count; i += 1) {
      this.particles.push({
        x: position.x,
        y: position.y,
        vx: randomRange(-260, 260),
        vy: randomRange(-360, 10),
        radius: randomRange(3, 7),
        life: randomRange(0.35, 0.6),
        maxLife: 1,
        color,
      });
      this.particles[this.particles.length - 1].maxLife = this.particles[this.particles.length - 1].life;
    }
  }

  updateParticles(dt) {
    this.particles = this.particles
      .map((particle) => {
        const life = particle.life - dt;
        if (life <= 0) {
          return null;
        }
        return {
          ...particle,
          life,
          vy: particle.vy + 700 * dt,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          radius: Math.max(0.4, particle.radius - dt * 13),
        };
      })
      .filter(Boolean);
  }

  drawBackground() {
    const width = this.bounds.right;
    const height = this.bounds.bottom;
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#8cc9f5");
    gradient.addColorStop(0.55, "#bde2ff");
    gradient.addColorStop(1, "#d9efff");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    const cloudLayer = this.ctx.createLinearGradient(0, 0, width, 0);
    cloudLayer.addColorStop(0, "rgba(255,255,255,0.25)");
    cloudLayer.addColorStop(1, "rgba(255,255,255,0)");
    this.ctx.fillStyle = cloudLayer;
    this.ctx.fillRect(0, 0, width, height * 0.45);
  }

  drawObjects() {
    this.objects.forEach((obj) => {
      if (obj.kind === "fruit") {
        this.drawFruit(obj);
      } else if (obj.kind === "bomb") {
        this.drawBomb(obj);
      } else {
        this.drawHeart(obj);
      }
    });
  }

  drawFruit(fruit) {
    this.ctx.fillStyle = fruit.color;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x, fruit.y, fruit.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "rgba(255,255,255,0.25)";
    this.ctx.beginPath();
    this.ctx.arc(fruit.x - fruit.radius * 0.3, fruit.y - fruit.radius * 0.3, fruit.radius * 0.22, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBomb(bomb) {
    const pulse = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(bomb.pulse));
    this.ctx.fillStyle = "#1f1f1f";
    this.ctx.beginPath();
    this.ctx.arc(bomb.x, bomb.y, bomb.radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "#f4f4f4";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(bomb.x, bomb.y, bomb.radius + 3, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.strokeStyle = "#d03d3d";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(bomb.x, bomb.y, bomb.radius + 8 + pulse * 4, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawHeart(heart) {
    const r = heart.radius;
    const x = heart.x;
    const y = heart.y;
    this.ctx.fillStyle = "#ff658f";
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + r * 0.92);
    this.ctx.bezierCurveTo(x + r * 1.2, y + r * 0.2, x + r * 0.75, y - r * 0.95, x, y - r * 0.25);
    this.ctx.bezierCurveTo(x - r * 0.75, y - r * 0.95, x - r * 1.2, y + r * 0.2, x, y + r * 0.92);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawParticles() {
    this.particles.forEach((particle) => {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      this.ctx.fillStyle = this.withAlpha(particle.color, alpha);
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  withAlpha(hexColor, alpha) {
    const normalized = hexColor.replace("#", "");
    const bigint = Number.parseInt(normalized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  drawFloatingTexts() {
    if (this.humanComboTimer > 0 && this.humanComboText) {
      const alpha = clamp(this.humanComboTimer, 0, 1);
      this.ctx.fillStyle = `rgba(255, 220, 120, ${alpha})`;
      this.ctx.font = "700 32px 'Segoe UI', sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.fillText(this.humanComboText, this.bounds.right * 0.5, Math.max(58, this.bounds.bottom * 0.14));
    }

    if (this.mode === MODES.AI_VS_HUMAN) {
      if (this.aiController.comboTimer > 0 && this.aiController.comboText) {
        const alpha = clamp(this.aiController.comboTimer, 0, 1);
        this.ctx.fillStyle = `rgba(140, 210, 255, ${alpha})`;
        this.ctx.font = "600 24px 'Segoe UI', sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillText(this.aiController.comboText, this.bounds.right * 0.5, Math.max(96, this.bounds.bottom * 0.22));
      }

      if (this.aiController.statusTimer > 0 && this.aiController.statusText) {
        const alpha = clamp(this.aiController.statusTimer, 0, 1);
        this.ctx.fillStyle = `rgba(170, 220, 255, ${alpha})`;
        this.ctx.font = "600 20px 'Segoe UI', sans-serif";
        this.ctx.textAlign = "right";
        this.ctx.fillText(this.aiController.statusText, this.bounds.right * 0.92, Math.max(92, this.bounds.bottom * 0.16));
      }
    }
  }

  drawBombBlast() {
    if (this.blastTimer <= 0) {
      return;
    }
    const progress = clamp(1 - this.blastTimer / this.blastDuration, 0, 1);
    const shake = Math.floor((1 - progress) * 22);
    const centerX = this.blastCenter.x + randomRange(-shake, shake);
    const centerY = this.blastCenter.y + randomRange(-shake, shake);

    const maxRadius = Math.max(this.bounds.right, this.bounds.bottom) * 0.55;
    const outerRadius = Math.max(24, progress * maxRadius);
    const coreRadius = Math.max(10, outerRadius * 0.45);
    const ringRadius = Math.max(coreRadius + 10, outerRadius * 1.18);

    this.ctx.fillStyle = `rgba(255, 235, 210, ${0.85 * (1 - progress)})`;
    this.ctx.fillRect(0, 0, this.bounds.right, this.bounds.bottom);
    this.ctx.fillStyle = "rgba(255, 145, 82, 0.68)";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = "rgba(255, 88, 72, 0.82)";
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.strokeStyle = "rgba(255, 240, 220, 0.78)";
    this.ctx.lineWidth = Math.max(2, Math.floor(8 * (1 - progress)));
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  draw() {
    this.drawBackground();
    this.drawParticles();
    this.drawObjects();
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.aiController.draw(this.ctx, this.bounds);
    }
    this.blade.draw(this.ctx, this.bounds);
    this.drawFloatingTexts();

    if (this.state === "bomb_blast") {
      this.drawBombBlast();
    }
  }

  refreshHud() {
    this.hudHumanScore.textContent = String(this.humanScore);
    this.hudAiScore.textContent = this.mode === MODES.AI_VS_HUMAN ? String(this.aiScore) : "-";
    this.hudMode.textContent = this.mode === MODES.AI_VS_HUMAN ? "Mode: AI vs Human" : "Mode: Classic";
    this.hudTimer.textContent = this.mode === MODES.AI_VS_HUMAN ? formatTime(this.roundTimeRemaining) : "--:--";
    this.hudLives.textContent = `Lives: ${"❤ ".repeat(Math.max(0, this.lives)).trim() || "0"}`;
    this.hudDifficulty.textContent =
      this.mode === MODES.AI_VS_HUMAN ? `AI Difficulty: ${this.aiController.difficultyLabel}` : "";
    this.hudHighScore.textContent = `Best: ${this.highScore}`;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      // eslint-disable-next-line no-console
      console.warn("Service worker registration failed:", error);
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  registerServiceWorker();
  // eslint-disable-next-line no-new
  new GameApp();
});
