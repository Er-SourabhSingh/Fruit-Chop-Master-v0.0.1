"use strict";

const MODES = {
  CLASSIC: "classic",
  AI_VS_HUMAN: "ai_vs_human",
};

const STORAGE_KEYS = {
  HIGH_SCORE: "fruitchop.pwa.high_score",
  SETTINGS: "fruitchop.pwa.settings",
};

const HIGH_SCORE_SYNC = {
  timeoutMs: 1800,
  readEndpoints: [
    "http://127.0.0.1:3000/high_score",
    "http://localhost:3000/high_score",
    "./data/highscore.json",
  ],
};

const SETTINGS_DEFAULTS = {
  mode: MODES.CLASSIC,
  aiDifficulty: "hard",
};

const AI_MODE_DIFFICULTY = "hard";

const GAME_CONFIG = {
  fps: 60,
  startingLives: 3,
  aiModeLives: 1,
  maxLives: 5,
  skipsPerLifeLoss: 5,
  aiRoundSeconds: 60,
  aiBombPenalty: 2,
  aiMinFruitCount: 5,
  aiMaxFruitCount: 15,
  baseSpawnInterval: 0.9,
};

const ROUND_FLOW = {
  startDelaySeconds: 0.24,
  countdownStepSeconds: 0.72,
  countdownSequence: ["3", "2", "1", "START"],
  postCountdownSpawnDelaySeconds: 0.18,
  aiOpeningLockSeconds: 0.2,
  humanFirstReactionWindowSeconds: 0.2,
};

const AI_DIFFICULTY = {
  easy: {
    label: "Easy",
    fruitHitChanceRange: [0.48, 0.61],
    reactionDelayRange: [0.32, 0.58],
    comboChanceRange: [0.12, 0.2],
    bombAvoidance: 0.68,
    tripleComboChance: 0.15,
    quadComboChance: 0.05,
    quintComboChance: 0.01,
    maxComboTargets: 3,
    primaryHitBoost: 0.05,
    recoveryHitChance: 0.14,
    urgencyWeight: 3.2,
    centerPenaltyWeight: 0.35,
    riskyPenaltyWeight: 0.34,
    progressPressureBoost: 0.06,
    catchupAggression: 0.008,
    catchupReactionScale: 0.016,
    heartPriority: 2,
  },
  medium: {
    label: "Medium",
    fruitHitChanceRange: [0.8, 0.9],
    reactionDelayRange: [0.07, 0.14],
    comboChanceRange: [0.46, 0.66],
    bombAvoidance: 0.94,
    tripleComboChance: 0.62,
    quadComboChance: 0.18,
    quintComboChance: 0.05,
    maxComboTargets: 3,
    primaryHitBoost: 0.08,
    recoveryHitChance: 0.35,
    urgencyWeight: 4.25,
    centerPenaltyWeight: 0.24,
    riskyPenaltyWeight: 0.72,
    progressPressureBoost: 0.12,
    catchupAggression: 0.015,
    catchupReactionScale: 0.032,
    heartPriority: 1.65,
  },
  hard: {
    label: "Hard",
    fruitHitChanceRange: [0.965, 0.999],
    reactionDelayRange: [0.012, 0.04],
    comboChanceRange: [0.82, 0.98],
    bombAvoidance: 0.985,
    tripleComboChance: 0.92,
    quadComboChance: 0.78,
    quintComboChance: 0.52,
    maxComboTargets: 7,
    primaryHitBoost: 0.16,
    recoveryHitChance: 0.86,
    urgencyWeight: 6.2,
    centerPenaltyWeight: 0.17,
    riskyPenaltyWeight: 1.05,
    progressPressureBoost: 0.18,
    catchupAggression: 0.03,
    catchupReactionScale: 0.065,
    heartPriority: 1.3,
  },
};

const AI_MATCH_PACING = {
  easy: {
    speedScale: 0.98,
    spawnIntervalScale: 1.03,
    waveDensity: 0.95,
  },
  medium: {
    speedScale: 1.08,
    spawnIntervalScale: 0.9,
    waveDensity: 1.2,
  },
  hard: {
    speedScale: 1.18,
    spawnIntervalScale: 0.82,
    waveDensity: 1.35,
  },
};

const AI_TIME_SCALING = [
  { until: 15, speedMultiplier: 1, spawnIntervalMultiplier: 1 },
  { until: 30, speedMultiplier: 1.2, spawnIntervalMultiplier: 0.88 },
  { until: 45, speedMultiplier: 1.35, spawnIntervalMultiplier: 0.78 },
  { until: GAME_CONFIG.aiRoundSeconds, speedMultiplier: 1.5, spawnIntervalMultiplier: 0.68 },
];

const AI_ADAPTIVE_TRACKING = {
  windowSeconds: 6,
  cleanupSlackSeconds: 2,
  streakGraceSeconds: 0.9,
  expectations: {
    easy: {
      cutRate: 1.05,
      comboRate: 0.12,
      scoreRate: 1.05,
    },
    medium: {
      cutRate: 1.35,
      comboRate: 0.2,
      scoreRate: 1.35,
    },
    hard: {
      cutRate: 1.55,
      comboRate: 0.26,
      scoreRate: 1.55,
    },
  },
};

const AI_ADAPTIVE_STAGES = [1, 2, 4, 6, 10];

const FRUIT_TYPES = [
  { name: "apple", color: "#de3345" },
  { name: "banana", color: "#f3dc64" },
  { name: "watermelon", color: "#45bf72" },
  { name: "pineapple", color: "#f2b550" },
  { name: "orange", color: "#f99f3d" },
];

const FRUIT_STYLE = {
  apple: {
    body: ["#cb233b", "#e4485c"],
    shadow: "#8e1828",
    highlight: "rgba(255, 238, 240, 0.8)",
    stem: "#7a4e2d",
    leaf: "#5ea559",
  },
  orange: {
    body: ["#e28720", "#f7a93d"],
    shadow: "#c36e15",
    highlight: "rgba(255, 236, 196, 0.78)",
    stem: "#7f6a33",
    leaf: "#6cae64",
  },
  watermelon: {
    rindDark: "#286933",
    rindMid: "#6ba35e",
    flesh: "#de4e5b",
    seed: "#281718",
    highlight: "rgba(255, 218, 224, 0.42)",
  },
  pineapple: {
    bodyDark: "#d08a2f",
    body: "#e8ad45",
    groove: "#af6f22",
    crown: "#4c9f58",
    crownDark: "#2c7438",
    highlight: "rgba(255, 232, 182, 0.62)",
  },
  banana: {
    peelDark: "#d0b03b",
    peel: "#f0d567",
    underside: "#b28f26",
    tip: "#70562e",
    highlight: "rgba(255, 243, 176, 0.65)",
  },
};

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

function currentViewportHeight() {
  if (window.visualViewport && Number.isFinite(window.visualViewport.height)) {
    return Math.max(1, Math.floor(window.visualViewport.height));
  }
  return Math.max(1, Math.floor(window.innerHeight));
}

function applyViewportHeightVar() {
  const height = currentViewportHeight();
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  return height;
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isAppleMobilePlatform() {
  const ua = window.navigator.userAgent.toLowerCase();
  const touchCapableMac = ua.includes("macintosh") && "ontouchend" in window;
  return /iphone|ipad|ipod/.test(ua) || touchCapableMac;
}

function toSafeHighScore(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      return null;
    }
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

function parseHighScorePayload(payload) {
  const direct = toSafeHighScore(payload);
  if (direct !== null) {
    return direct;
  }
  if (payload && typeof payload === "object") {
    const fromSnakeCase = toSafeHighScore(payload.high_score);
    if (fromSnakeCase !== null) {
      return fromSnakeCase;
    }
    const fromCamelCase = toSafeHighScore(payload.highScore);
    if (fromCamelCase !== null) {
      return fromCamelCase;
    }
    const fromScore = toSafeHighScore(payload.score);
    if (fromScore !== null) {
      return fromScore;
    }
  }
  return null;
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? HIGH_SCORE_SYNC.timeoutMs;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
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
        aiDifficulty: AI_MODE_DIFFICULTY,
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
      const value = toSafeHighScore(raw);
      if (value === null) {
        return 0;
      }
      return value;
    } catch {
      return 0;
    }
  },

  saveHighScore(score) {
    try {
      const safeScore = toSafeHighScore(score);
      if (safeScore === null) {
        return;
      }
      window.localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, String(safeScore));
    } catch {
      // Ignore write failures.
    }
  },

  async syncHighScoreFromRemote(localScore = 0) {
    const safeLocalScore = toSafeHighScore(localScore) ?? 0;
    for (const endpoint of HIGH_SCORE_SYNC.readEndpoints) {
      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          continue;
        }
        const payload = await response.json();
        const remoteScore = parseHighScorePayload(payload);
        if (remoteScore === null) {
          continue;
        }

        if (remoteScore > safeLocalScore) {
          this.saveHighScore(remoteScore);
          return remoteScore;
        }
        return safeLocalScore;
      } catch {
        // Keep trying other endpoints/fallbacks.
      }
    }
    return safeLocalScore;
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

  getTimedSegments(bounds) {
    if (this.points.length < 2) {
      return [];
    }

    const segments = [];
    for (let i = 1; i < this.points.length; i += 1) {
      const startPoint = this.points[i - 1];
      const endPoint = this.points[i];
      const start = { x: startPoint.x, y: startPoint.y };
      const end = { x: endPoint.x, y: endPoint.y };
      const clipped = clipSegmentToBounds(start, end, bounds);
      if (clipped) {
        segments.push({
          start: clipped[0],
          end: clipped[1],
          time: endPoint.t,
        });
      }
    }
    return segments;
  }

  getSegments(bounds) {
    return this.getTimedSegments(bounds).map((segment) => ({
      start: segment.start,
      end: segment.end,
    }));
  }

  draw(ctx, bounds) {
    const segments = this.getTimedSegments(bounds);
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
    this.adaptiveStageIndex = 0;
    this.nextAdaptiveUpgradeAt = 0;
    this.currentAdaptiveBoost = this.defaultAdaptiveBoost();
    this.frameCompensation = 1;
    this.lastFrameDt = 1 / 60;
  }

  setDifficulty(level) {
    this.difficultyLevel = AI_DIFFICULTY[level] ? level : "medium";
    this.profile = AI_DIFFICULTY[this.difficultyLevel];
    this.adaptiveStageIndex = 0;
    this.nextAdaptiveUpgradeAt = 0;
    this.currentAdaptiveBoost = this.defaultAdaptiveBoost();
  }

  reset(now) {
    this.comboText = "";
    this.comboTimer = 0;
    this.statusText = "";
    this.statusTimer = 0;
    this.adaptiveStageIndex = 0;
    this.nextAdaptiveUpgradeAt = now;
    this.currentAdaptiveBoost = this.defaultAdaptiveBoost();
    this.nextActionAt = now + this.actionDelay(0, 1, this.currentAdaptiveBoost);
    this.visibleSince.clear();
    this.reactionDelayByObject.clear();
    this.slashEffect.clear();
  }

  get difficultyLabel() {
    return this.profile.label;
  }

  get adaptiveStageLabel() {
    return `x${this.currentStageMultiplier()}`;
  }

  update(dt) {
    const safeDt = clamp(dt || 1 / 60, 1 / 120, 1 / 15);
    this.lastFrameDt = safeDt;
    this.frameCompensation = clamp(safeDt / (1 / 60), 1, 2.6);
    this.slashEffect.update(safeDt);
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - safeDt);
    }
    if (this.statusTimer > 0) {
      this.statusTimer = Math.max(0, this.statusTimer - safeDt);
    }
  }

  decide(
    now,
    objects,
    bounds,
    roundProgress,
    scoreGap = 0,
    humanPerformance = null,
    allowBombTargets = true,
  ) {
    this.currentAdaptiveBoost = this.buildAdaptiveBoost(now, roundProgress, scoreGap, humanPerformance);
    this.pullActionForward(now, this.currentAdaptiveBoost);
    this.syncVisibility(now, objects, bounds);
    if (now < this.nextActionAt) {
      return null;
    }

    const reactableObjects = objects.filter(
      (obj) => this.isSliceableVisible(obj, bounds) && this.reactionReady(obj, now),
    );

    const regularFruits = reactableObjects.filter((obj) => obj.kind === "fruit");
    const hearts = reactableObjects.filter((obj) => obj.kind === "heart");
    const bombs = allowBombTargets ? reactableObjects.filter((obj) => obj.kind === "bomb") : [];

    if (!regularFruits.length && !hearts.length && !bombs.length) {
      this.nextActionAt =
        now + Math.min(0.1, this.actionDelay(scoreGap, 0.5, this.currentAdaptiveBoost));
      return null;
    }

    // Adaptive pressure: score catch-up, human momentum, and round intensity.
    const pressure =
      roundProgress * (this.profile.progressPressureBoost || 0.1) * this.currentAdaptiveBoost.targetingMultiplier;
    const catchupPressure = clamp(
      scoreGap * (this.profile.catchupAggression || 0.012),
      -0.04,
      0.14,
    );
    const fruitHitChance = clamp(
      randomRange(...this.profile.fruitHitChanceRange) +
        pressure +
        catchupPressure +
        this.currentAdaptiveBoost.hitChanceBoost,
      0.2,
      0.998,
    );
    const comboChance = clamp(
      (randomRange(...this.profile.comboChanceRange) +
        pressure * 0.72 +
        Math.max(0, catchupPressure) * 0.6) *
        this.currentAdaptiveBoost.comboChanceMultiplier,
      0.05,
      0.99,
    );

    const prioritizedFruits = this.prioritizeFruits(
      regularFruits,
      bombs,
      bounds,
      this.currentAdaptiveBoost.targetingMultiplier,
    );
    const prioritizedHearts = this.prioritizeHearts(hearts, bounds);
    const targets = this.pickTargets(
      [...prioritizedFruits, ...prioritizedHearts],
      comboChance,
      bombs,
      bounds,
      this.currentAdaptiveBoost,
    );
    const slicedTargets = [];
    targets.forEach((target, index) => {
      const bonus = index === 0 ? this.profile.primaryHitBoost || 0 : 0;
      const targetHitChance = clamp(fruitHitChance + bonus, 0.2, 0.998);
      if (Math.random() < targetHitChance) {
        slicedTargets.push(target);
      }
    });
    if (!slicedTargets.length && targets.length && Math.random() < (this.profile.recoveryHitChance || 0)) {
      slicedTargets.push(targets[0]);
    }

    if (slicedTargets.length) {
      this.spawnSlashTrail(slicedTargets, true, false, bounds);
    } else if (targets.length) {
      this.spawnSlashTrail([targets[0]], false, false, bounds);
    }

    let bombTarget = null;
    if (allowBombTargets && bombs.length && this.shouldMakeBombMistake(this.currentAdaptiveBoost)) {
      bombTarget = bombs[Math.floor(Math.random() * bombs.length)];
      this.spawnSlashTrail([bombTarget], false, true, bounds);
    }

    this.nextActionAt = now + this.actionDelay(scoreGap, 1, this.currentAdaptiveBoost);
    if (!slicedTargets.length && !bombTarget) {
      this.nextActionAt =
        now + Math.max(0.012, this.actionDelay(scoreGap, 0.55, this.currentAdaptiveBoost));
    }

    if (!slicedTargets.length && !bombTarget) {
      return null;
    }

    return { slicedTargets, bombTarget };
  }

  defaultAdaptiveBoost() {
    const stageMultiplier = this.currentStageMultiplier();
    return {
      stageMultiplier,
      reactionMultiplier: stageMultiplier,
      targetingMultiplier: 1,
      comboChanceMultiplier: 1,
      hitChanceBoost: 0,
      hesitationScale: 1,
      bombMistakeScale: 1,
      comboTargetBonus: 0,
    };
  }

  currentStageMultiplier() {
    return AI_ADAPTIVE_STAGES[this.adaptiveStageIndex] || AI_ADAPTIVE_STAGES[0];
  }

  adaptiveUpgradeCooldown(roundProgress) {
    return clamp(8 - roundProgress * 6, 2, 8);
  }

  shouldUpgradeAdaptiveStage(humanPerformance) {
    if (!humanPerformance) {
      return false;
    }
    const hasCompetitionData =
      humanPerformance.humanScore > 0 ||
      humanPerformance.aiScore > 0 ||
      humanPerformance.cutCount > 0 ||
      humanPerformance.aiCutCount > 0;
    if (!hasCompetitionData) {
      return false;
    }
    return (
      humanPerformance.humanScore >= humanPerformance.aiScore ||
      humanPerformance.cutCount >= humanPerformance.aiCutCount
    );
  }

  updateAdaptiveStage(now, roundProgress, humanPerformance) {
    if (this.adaptiveStageIndex >= AI_ADAPTIVE_STAGES.length - 1) {
      return;
    }
    if (now < this.nextAdaptiveUpgradeAt) {
      return;
    }
    if (!this.shouldUpgradeAdaptiveStage(humanPerformance)) {
      return;
    }
    this.adaptiveStageIndex += 1;
    this.nextAdaptiveUpgradeAt = now + this.adaptiveUpgradeCooldown(roundProgress);
  }

  buildAdaptiveBoost(now, roundProgress, scoreGap, humanPerformance) {
    const base = this.defaultAdaptiveBoost();
    if (!humanPerformance) {
      return base;
    }

    this.updateAdaptiveStage(now, roundProgress, humanPerformance);
    const stageMultiplier = this.currentStageMultiplier();
    const difficultyScale =
      this.difficultyLevel === "hard" ? 1.28 : this.difficultyLevel === "medium" ? 1.05 : 0.8;
    const leadActive =
      humanPerformance.humanScore >= humanPerformance.aiScore ||
      humanPerformance.cutCount >= humanPerformance.aiCutCount;
    const cutRateRatio = clamp(
      humanPerformance.recentCutRate / Math.max(0.01, humanPerformance.expectedCutRate),
      0,
      8,
    );
    const comboRateRatio = clamp(
      humanPerformance.recentComboRate / Math.max(0.01, humanPerformance.expectedComboRate),
      0,
      8,
    );
    const momentumRatio = clamp(
      humanPerformance.scoreMomentum / Math.max(0.01, humanPerformance.expectedScoreMomentum),
      0,
      8,
    );
    const growthRatio = clamp(humanPerformance.cutGrowthRatio, 0, 8);
    const scoreProgressRatio = clamp(humanPerformance.scoreProgressRatio, 0, 8);
    const streakPressure = clamp(humanPerformance.cutStreak / 5, 0, 3);
    const leadPressure = leadActive
      ? this.difficultyLevel === "hard"
        ? 2.15
        : this.difficultyLevel === "medium"
          ? 1.35
          : 0.8
      : 0;
    const rawPressure =
      cutRateRatio * 0.34 +
      momentumRatio * 0.24 +
      comboRateRatio * 0.15 +
      growthRatio * 0.11 +
      scoreProgressRatio * 0.08 +
      streakPressure * 0.08 +
      leadPressure +
      Math.max(0, scoreGap) * 0.24 +
      roundProgress * 0.2;
    const pressure = rawPressure * difficultyScale;

    const overdrive = clamp((pressure - 1) * 0.05, 0, 0.45);
    let reactionMultiplier = stageMultiplier * (1 + overdrive);
    if (leadActive) {
      reactionMultiplier *= 1.06;
    }
    if (this.difficultyLevel === "hard") {
      reactionMultiplier *= 1.15;
    } else if (this.difficultyLevel === "medium") {
      reactionMultiplier *= 1.04;
    }
    reactionMultiplier = clamp(reactionMultiplier, 1, 10);

    return {
      stageMultiplier,
      reactionMultiplier,
      targetingMultiplier: clamp(1 + (reactionMultiplier - 1) * 0.28, 1, 3.8),
      comboChanceMultiplier: clamp(1 + (reactionMultiplier - 1) * 0.2, 1, 3.1),
      hitChanceBoost: clamp(
        (reactionMultiplier - 1) * 0.013 + Math.max(0, scoreGap) * 0.005 + (leadActive ? 0.01 : 0),
        0,
        0.18,
      ),
      hesitationScale: clamp(1 - (reactionMultiplier - 1) * 0.085, 0.12, 1),
      bombMistakeScale: clamp(1 - (reactionMultiplier - 1) * 0.08, 0.2, 1),
      comboTargetBonus:
        stageMultiplier >= 10
          ? this.difficultyLevel === "hard"
            ? 2
            : 1
          : stageMultiplier >= 6
            ? 1
            : 0,
    };
  }

  pullActionForward(now, adaptiveBoost) {
    if (now >= this.nextActionAt) {
      return;
    }
    const multiplier = clamp(adaptiveBoost.reactionMultiplier || 1, 1, 10);
    if (multiplier <= 1) {
      return;
    }
    const remaining = this.nextActionAt - now;
    const acceleratedRemaining = remaining / multiplier;
    this.nextActionAt = now + Math.max(this.minActionDelay() * 0.65, acceleratedRemaining);
  }

  applyBombPenalty(penalty) {
    const amount = Math.max(0, penalty);
    this.statusText = `AI Mistake -${amount}`;
    this.statusTimer = 1;
    return amount;
  }

  setComboFeedback(hits) {
    const safeHits = Math.max(0, Math.floor(hits));
    if (safeHits <= 1) {
      return 0;
    }
    const bonus = comboBonusForHits(safeHits);
    this.comboText = aiComboText(safeHits, bonus);
    this.comboTimer = 1;
    return bonus;
  }

  setSliceStatus(text = "AI Slice", duration = 0.55) {
    this.statusText = text;
    this.statusTimer = duration;
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
      if (!this.isSliceableVisible(obj, bounds)) {
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

  isSliceableVisible(obj, bounds) {
    const overlapX = obj.radius * 0.35;
    const overlapY = obj.radius * 0.35;
    const left = obj.x + overlapX >= bounds.left;
    const right = obj.x - overlapX <= bounds.right;
    const top = obj.y + overlapY >= bounds.top;
    const bottom = obj.y - overlapY <= bounds.bottom;
    return left && right && top && bottom;
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
    const frameScale = clamp(this.frameCompensation || 1, 1, 2.6);
    const reactionMultiplier = clamp(this.currentAdaptiveBoost.reactionMultiplier || 1, 1, 10);
    const effectiveDelay = Math.max(
      this.minReactionDelay() / frameScale,
      delay / (reactionMultiplier * frameScale),
    );
    return now - this.visibleSince.get(obj.id) >= effectiveDelay;
  }

  actionDelay(scoreGap = 0, scale = 1, adaptiveBoost = this.currentAdaptiveBoost) {
    const baseDelay = randomRange(...this.profile.reactionDelayRange);
    const catchupScale =
      scoreGap > 0
        ? clamp(1 - scoreGap * (this.profile.catchupReactionScale || 0.02), 0.55, 1)
        : 1;
    const frameScale = clamp(this.frameCompensation || 1, 1, 2.6);
    const reactionMultiplier = clamp((adaptiveBoost && adaptiveBoost.reactionMultiplier) || 1, 1, 10);
    const hesitationScale = clamp((adaptiveBoost && adaptiveBoost.hesitationScale) || 1, 0.2, 1);
    return Math.max(
      this.minActionDelay() / frameScale,
      (baseDelay * catchupScale * scale * hesitationScale) / (reactionMultiplier * frameScale),
    );
  }

  minReactionDelay() {
    if (this.difficultyLevel === "hard") {
      return 0.055;
    }
    if (this.difficultyLevel === "medium") {
      return 0.09;
    }
    return 0.125;
  }

  minActionDelay() {
    if (this.difficultyLevel === "hard") {
      return 0.03;
    }
    if (this.difficultyLevel === "medium") {
      return 0.06;
    }
    return 0.09;
  }

  prioritizeFruits(fruits, bombs, bounds, targetingMultiplier = 1) {
    if (!fruits.length) {
      return [];
    }
    const filtered = fruits.filter((fruit) => this.shouldAttemptFruit(fruit, bombs));
    const base = filtered.length ? filtered : fruits;
    return [...base].sort(
      (a, b) =>
        this.fruitPriorityScore(b, bombs, bounds, targetingMultiplier) -
        this.fruitPriorityScore(a, bombs, bounds, targetingMultiplier),
    );
  }

  prioritizeHearts(hearts, bounds) {
    if (!hearts.length) {
      return [];
    }
    return [...hearts].sort((a, b) => this.objectUrgencyScore(b, bounds) - this.objectUrgencyScore(a, bounds));
  }

  pickTargets(candidates, comboChance, bombs, bounds, adaptiveBoost = this.currentAdaptiveBoost) {
    if (!candidates.length) {
      return [];
    }
    const sorted = [...candidates].sort(
      (a, b) =>
        this.generalPriorityScore(b, bombs, bounds, adaptiveBoost.targetingMultiplier || 1) -
        this.generalPriorityScore(a, bombs, bounds, adaptiveBoost.targetingMultiplier || 1),
    );
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

    const comboTargetBonus = Math.max(0, Math.floor(adaptiveBoost.comboTargetBonus || 0));
    const maxComboTargets = Math.max(
      2,
      Math.floor(this.profile.maxComboTargets || 3) + comboTargetBonus,
    );
    let targetCount = 2;
    if ((adaptiveBoost.stageMultiplier || 1) >= 4 && nearby.length >= 3) {
      targetCount = 3;
    }
    if (nearby.length >= 3 && Math.random() < (this.profile.tripleComboChance || 0.3)) {
      targetCount = 3;
    }
    if (
      maxComboTargets >= 4 &&
      nearby.length >= 4 &&
      targetCount >= 3 &&
      Math.random() < (this.profile.quadComboChance || 0.22)
    ) {
      targetCount = 4;
    }
    if (
      maxComboTargets >= 5 &&
      nearby.length >= 5 &&
      targetCount >= 4 &&
      Math.random() < (this.profile.quintComboChance || 0.1)
    ) {
      targetCount = 5;
    }
    targetCount = Math.min(targetCount, maxComboTargets, nearby.length);
    return nearby.slice(0, targetCount);
  }

  shouldMakeBombMistake(adaptiveBoost = this.currentAdaptiveBoost) {
    const mistakeBase = clamp((1 - this.profile.bombAvoidance) * 0.35, 0.002, 0.2);
    const mistakeScale = clamp((adaptiveBoost && adaptiveBoost.bombMistakeScale) || 1, 0.2, 1);
    return Math.random() < mistakeBase * mistakeScale;
  }

  shouldAttemptFruit(fruit, bombs) {
    if (!bombs.length) {
      return true;
    }
    const risky = this.isRiskyNearBomb(fruit, bombs);
    if (!risky) {
      return true;
    }

    if (this.difficultyLevel === "hard") {
      return Math.random() < 0.025;
    }
    if (this.difficultyLevel === "medium") {
      return Math.random() < 0.08;
    }
    return Math.random() < 0.48;
  }

  isRiskyNearBomb(target, bombs) {
    const baseBuffer =
      this.difficultyLevel === "hard" ? 42 : this.difficultyLevel === "medium" ? 30 : 18;
    return bombs.some((bomb) => {
      const dx = target.x - bomb.x;
      const dy = target.y - bomb.y;
      const minSafeDistance = target.radius + bomb.radius + baseBuffer;
      return dx * dx + dy * dy <= minSafeDistance * minSafeDistance;
    });
  }

  objectUrgencyScore(obj, bounds) {
    const timeToExit = this.estimateTimeToBottomExit(obj, bounds);
    const baseUrgency = 1 / (0.12 + timeToExit);
    const descentBoost = obj.vy > 0 ? clamp(obj.vy / 900, 0, 1.15) * 0.55 : 0;
    return baseUrgency + descentBoost;
  }

  estimateTimeToBottomExit(obj, bounds) {
    const distance = Math.max(0, bounds.bottom + obj.radius - obj.y);
    if (obj.vy > 0) {
      return distance / Math.max(45, obj.vy);
    }
    return 1.7 + Math.abs(obj.vy) / 520;
  }

  fruitPriorityScore(fruit, bombs, bounds, targetingMultiplier = 1) {
    const urgency = this.objectUrgencyScore(fruit, bounds);
    const centerX = (bounds.left + bounds.right) * 0.5;
    const centerPenalty = Math.abs(fruit.x - centerX) / Math.max(1, bounds.right - bounds.left);
    const urgencyWeight = (this.profile.urgencyWeight || 3.4) * clamp(targetingMultiplier, 1, 3.4);
    const centerPenaltyWeight = this.profile.centerPenaltyWeight || 0.35;
    const riskyPenalty = this.isRiskyNearBomb(fruit, bombs) ? this.profile.riskyPenaltyWeight || 0.46 : 0;
    return urgency * urgencyWeight - centerPenalty * centerPenaltyWeight - riskyPenalty;
  }

  generalPriorityScore(obj, bombs, bounds, targetingMultiplier = 1) {
    if (obj.kind === "fruit") {
      return this.fruitPriorityScore(obj, bombs, bounds, targetingMultiplier);
    }
    if (obj.kind === "heart") {
      return this.objectUrgencyScore(obj, bounds) * (this.profile.heartPriority || 2.1);
    }
    return this.objectUrgencyScore(obj, bounds) * 0.6;
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
    this.appShell = document.getElementById("app-shell");
    this.canvas = document.getElementById("game-canvas");
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    this.hudEl = document.getElementById("hud");
    this.menuOverlay = document.getElementById("menu-overlay");
    this.resultOverlay = document.getElementById("result-overlay");
    this.startBtn = document.getElementById("start-btn");
    this.restartBtn = document.getElementById("restart-btn");
    this.backMenuBtn = document.getElementById("back-menu-btn");
    this.installBtn = document.getElementById("install-btn");
    this.installHint = document.getElementById("install-hint");
    this.modeButtons = Array.from(document.querySelectorAll(".mode-btn"));

    this.hudHumanScore = document.getElementById("hud-human-score");
    this.hudHumanLabel = document.getElementById("hud-human-label");
    this.hudAiScore = document.getElementById("hud-ai-score");
    this.hudAiLabel = document.getElementById("hud-ai-label");
    this.hudAiSection = document.getElementById("hud-ai-section");
    this.hudAiStatus = document.getElementById("hud-ai-status");
    this.hudCenterSection = document.getElementById("hud-center-section");
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
    this.settings.aiDifficulty = AI_MODE_DIFFICULTY;
    this.mode = this.settings.mode;
    this.highScore = Storage.loadHighScore();
    this.newHighScoreAchieved = false;

    this.state = "menu";
    this.roundPhase = "idle";
    this.roundCountdownText = "";
    this.roundStartDelayRemaining = 0;
    this.roundCountdownStepRemaining = 0;
    this.roundCountdownStepIndex = 0;
    this.aiCanActAt = 0;
    this.firstPlayableFruitAt = null;
    this.hasSpawnedOpeningFruit = false;
    this.pendingEndReason = "";
    this.objects = [];
    this.particles = [];
    this.blastCenter = { x: 0, y: 0 };
    this.blastTimer = 0;
    this.blastDuration = 0.5;

    this.blade = new BladeTrail();
    this.aiController = new AIController(AI_MODE_DIFFICULTY);

    this.pointer = {
      x: 0,
      y: 0,
      pressed: false,
      pointerId: null,
      touchId: null,
      capturedPointerId: null,
    };
    this.hasPointerEvents = Boolean(window.PointerEvent);
    this.isCoarsePointer = window.matchMedia("(pointer: coarse)").matches || window.navigator.maxTouchPoints > 0;
    this.renderFruitShadows = true;
    this.deferredInstallPrompt = null;
    this.viewportResizeFrame = null;

    this.humanScore = 0;
    this.aiScore = 0;
    this.aiCutCount = 0;
    this.lives = this.mode === MODES.AI_VS_HUMAN ? GAME_CONFIG.aiModeLives : GAME_CONFIG.startingLives;
    this.skippedFruits = 0;
    this.roundTimeRemaining = GAME_CONFIG.aiRoundSeconds;
    this.elapsedTime = 0;
    this.spawnCooldown = 0;
    this.spawnInterval = GAME_CONFIG.baseSpawnInterval;
    this.speedMultiplier = 1;
    this.heartSpawnCooldown = randomRange(4.5, 7);

    this.humanComboText = "";
    this.humanComboTimer = 0;
    this.humanCutCount = 0;
    this.humanComboCount = 0;
    this.humanHitStreak = 0;
    this.lastHumanHitAt = -Infinity;
    this.humanPerformanceEvents = [];
    this.resetHumanPerformanceTracking();

    this.bindEvents();
    this.applySettingsToUI();
    this.updateHudLayout();
    this.updateInstallUi();
    applyViewportHeightVar();
    this.resizeCanvas();
    this.backToMenu();
    void this.bootstrapHighScore();
    requestAnimationFrame(this.gameLoop);
  }

  bindEvents() {
    this.gameLoop = this.gameLoop.bind(this);
    this.onViewportChange = this.onViewportChange.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onBeforeInstallPrompt = this.onBeforeInstallPrompt.bind(this);
    this.onAppInstalled = this.onAppInstalled.bind(this);
    this.onWindowBlur = this.onWindowBlur.bind(this);

    window.addEventListener("resize", this.onViewportChange);
    window.addEventListener("orientationchange", this.onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", this.onViewportChange);
      window.visualViewport.addEventListener("scroll", this.onViewportChange);
    }

    if (this.hasPointerEvents) {
      this.canvas.addEventListener("pointerdown", this.onPointerDown);
      this.canvas.addEventListener("pointermove", this.onPointerMove);
      this.canvas.addEventListener("pointerup", this.onPointerUp);
      this.canvas.addEventListener("pointercancel", this.onPointerUp);
      this.canvas.addEventListener("pointerleave", this.onPointerUp);
      window.addEventListener("pointerup", this.onPointerUp);
      window.addEventListener("pointercancel", this.onPointerUp);
    } else {
      this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
      this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
      this.canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
      this.canvas.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
      this.canvas.addEventListener("mousedown", this.onMouseDown);
      window.addEventListener("mousemove", this.onMouseMove);
      window.addEventListener("mouseup", this.onMouseUp);
    }

    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("beforeinstallprompt", this.onBeforeInstallPrompt);
    window.addEventListener("appinstalled", this.onAppInstalled);

    this.startBtn.addEventListener("click", () => this.startGame());
    this.restartBtn.addEventListener("click", () => this.startGame());
    this.backMenuBtn.addEventListener("click", () => this.backToMenu());
    if (this.installBtn) {
      this.installBtn.addEventListener("click", () => {
        void this.promptInstall();
      });
    }

    this.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode === MODES.AI_VS_HUMAN ? MODES.AI_VS_HUMAN : MODES.CLASSIC;
        this.settings.mode = nextMode;
        this.settings.aiDifficulty = AI_MODE_DIFFICULTY;
        this.mode = nextMode;
        this.aiController.setDifficulty(AI_MODE_DIFFICULTY);
        Storage.saveSettings(this.settings);
        this.applySettingsToUI();
        this.updateHudLayout();
      });
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
      const isActive = button.dataset.mode === this.settings.mode;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-checked", isActive ? "true" : "false");
    });
  }

  updateHudLayout() {
    const aiMode = this.mode === MODES.AI_VS_HUMAN;
    this.hudEl.classList.toggle("hud--ai", aiMode);
    this.hudEl.classList.toggle("hud--classic", !aiMode);
    if (this.hudAiSection) {
      this.hudAiSection.classList.toggle("hidden", !aiMode);
    }
    if (this.hudCenterSection) {
      this.hudCenterSection.classList.add("hidden");
    }
    if (this.hudHumanLabel) {
      this.hudHumanLabel.textContent = aiMode ? "Human" : "Player";
    }
    if (this.hudAiLabel) {
      this.hudAiLabel.textContent = "AI";
    }
  }

  shouldRenderFruitShadows(width, height) {
    const mobileViewport = Math.min(width, height) <= 900 || width <= 1024;
    if (this.isCoarsePointer || isStandaloneDisplay() || mobileViewport) {
      return false;
    }
    return true;
  }

  onViewportChange() {
    if (this.viewportResizeFrame !== null) {
      cancelAnimationFrame(this.viewportResizeFrame);
    }
    this.viewportResizeFrame = requestAnimationFrame(() => {
      this.viewportResizeFrame = null;
      applyViewportHeightVar();
      this.resizeCanvas();
    });
  }

  resizeCanvas() {
    const oldWidth = this.bounds.right - this.bounds.left;
    const oldHeight = this.bounds.bottom - this.bounds.top;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const shellRect = this.appShell.getBoundingClientRect();
    const width = Math.max(1, Math.floor(shellRect.width || window.innerWidth));
    const height = Math.max(1, Math.floor(shellRect.height || currentViewportHeight()));
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.bounds = { left: 0, top: 0, right: width, bottom: height };
    this.renderFruitShadows = this.shouldRenderFruitShadows(width, height);

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
    if (!rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }
    const x = ((event.clientX - rect.left) / rect.width) * (this.bounds.right - this.bounds.left);
    const y = ((event.clientY - rect.top) / rect.height) * (this.bounds.bottom - this.bounds.top);
    return { x, y };
  }

  getPointFromTouch(touch) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { x: 0, y: 0 };
    }
    const x = ((touch.clientX - rect.left) / rect.width) * (this.bounds.right - this.bounds.left);
    const y = ((touch.clientY - rect.top) / rect.height) * (this.bounds.bottom - this.bounds.top);
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
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
    }
    const point = this.getPointFromEvent(event);
    const isInside = this.isInsideBounds(point);
    if (!isInside) {
      return;
    }
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.pointerId = event.pointerId;
    this.pointer.touchId = null;
    this.pointer.pressed = true;
    if (this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(event.pointerId);
        this.pointer.capturedPointerId = event.pointerId;
      } catch {
        this.pointer.capturedPointerId = null;
      }
    }
  }

  onPointerMove(event) {
    if (this.pointer.pointerId !== event.pointerId) {
      return;
    }
    if (event.cancelable) {
      event.preventDefault();
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
    if (
      this.pointer.capturedPointerId !== null &&
      this.canvas.releasePointerCapture &&
      this.canvas.hasPointerCapture &&
      this.canvas.hasPointerCapture(this.pointer.capturedPointerId)
    ) {
      try {
        this.canvas.releasePointerCapture(this.pointer.capturedPointerId);
      } catch {
        // Ignore capture release edge cases.
      }
    }
    this.pointer.capturedPointerId = null;
    this.pointer.pointerId = null;
  }

  onTouchStart(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    if (this.pointer.touchId !== null) {
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    const point = this.getPointFromTouch(touch);
    if (!this.isInsideBounds(point)) {
      return;
    }
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.touchId = touch.identifier;
    this.pointer.pointerId = null;
    this.pointer.capturedPointerId = null;
    this.pointer.pressed = true;
  }

  onTouchMove(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    if (this.pointer.touchId === null) {
      return;
    }
    const touch = Array.from(event.touches).find((item) => item.identifier === this.pointer.touchId);
    if (!touch) {
      return;
    }
    const point = this.getPointFromTouch(touch);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
  }

  onTouchEnd(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    if (this.pointer.touchId === null) {
      return;
    }
    const released = Array.from(event.changedTouches).some(
      (item) => item.identifier === this.pointer.touchId,
    );
    if (!released) {
      return;
    }
    this.pointer.pressed = false;
    this.pointer.pointerId = null;
    this.pointer.touchId = null;
    this.pointer.capturedPointerId = null;
  }

  onMouseDown(event) {
    if (event.button !== 0) {
      return;
    }
    const point = this.getPointFromEvent(event);
    if (!this.isInsideBounds(point)) {
      return;
    }
    this.pointer.x = point.x;
    this.pointer.y = point.y;
    this.pointer.pointerId = "mouse";
    this.pointer.touchId = null;
    this.pointer.capturedPointerId = null;
    this.pointer.pressed = true;
  }

  onMouseMove(event) {
    if (this.pointer.pointerId !== "mouse") {
      return;
    }
    const point = this.getPointFromEvent(event);
    this.pointer.x = point.x;
    this.pointer.y = point.y;
  }

  onMouseUp(event) {
    if (event.button !== 0 || this.pointer.pointerId !== "mouse") {
      return;
    }
    this.pointer.pressed = false;
    this.pointer.pointerId = null;
    this.pointer.capturedPointerId = null;
  }

  onBeforeInstallPrompt(event) {
    event.preventDefault();
    this.deferredInstallPrompt = event;
    this.updateInstallUi("Install for full-screen play and offline launch from your home screen.");
  }

  onAppInstalled() {
    this.deferredInstallPrompt = null;
    this.updateInstallUi("App installed. Launch it from your home screen.");
  }

  async promptInstall() {
    if (!this.deferredInstallPrompt || !this.installBtn) {
      return;
    }

    this.installBtn.disabled = true;
    try {
      await this.deferredInstallPrompt.prompt();
      await this.deferredInstallPrompt.userChoice;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("Install prompt failed:", error);
    } finally {
      this.deferredInstallPrompt = null;
      this.installBtn.disabled = false;
      this.updateInstallUi();
    }
  }

  updateInstallUi(message = "") {
    if (!this.installBtn || !this.installHint) {
      return;
    }

    if (isStandaloneDisplay()) {
      this.installBtn.classList.add("hidden");
      this.installHint.textContent = message || "Installed app mode active.";
      this.installHint.classList.remove("hidden");
      return;
    }

    if (this.deferredInstallPrompt) {
      this.installBtn.classList.remove("hidden");
      this.installHint.textContent =
        message || "Install for full-screen play and offline launch from your home screen.";
      this.installHint.classList.remove("hidden");
      return;
    }

    this.installBtn.classList.add("hidden");
    if (isAppleMobilePlatform()) {
      this.installHint.textContent = "On iPhone/iPad, use Share -> Add to Home Screen to install.";
      this.installHint.classList.remove("hidden");
      return;
    }

    if (message) {
      this.installHint.textContent = message;
      this.installHint.classList.remove("hidden");
      return;
    }

    this.installHint.textContent = "";
    this.installHint.classList.add("hidden");
  }

  onWindowBlur() {
    this.pointer.pressed = false;
    this.pointer.pointerId = null;
    this.pointer.touchId = null;
    this.pointer.capturedPointerId = null;
  }

  async bootstrapHighScore() {
    const syncedHighScore = await Storage.syncHighScoreFromRemote(this.highScore);
    if (syncedHighScore === this.highScore) {
      return;
    }
    this.highScore = syncedHighScore;
    this.refreshHud();
    if (this.state === "result") {
      this.resultHighScore.textContent = String(this.highScore);
    }
  }

  startGame() {
    const now = performance.now() / 1000;
    this.mode = this.settings.mode;
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.settings.aiDifficulty = AI_MODE_DIFFICULTY;
    }
    this.state = "running";
    this.roundPhase = "countdown";
    this.roundCountdownText = "";
    this.roundStartDelayRemaining = ROUND_FLOW.startDelaySeconds;
    this.roundCountdownStepRemaining = ROUND_FLOW.countdownStepSeconds;
    this.roundCountdownStepIndex = 0;
    this.aiCanActAt = Number.POSITIVE_INFINITY;
    this.firstPlayableFruitAt = null;
    this.hasSpawnedOpeningFruit = false;
    this.pendingEndReason = "";
    this.newHighScoreAchieved = false;

    this.humanScore = 0;
    this.aiScore = 0;
    this.aiCutCount = 0;
    this.lives = this.mode === MODES.AI_VS_HUMAN ? GAME_CONFIG.aiModeLives : GAME_CONFIG.startingLives;
    this.skippedFruits = 0;
    this.roundTimeRemaining = GAME_CONFIG.aiRoundSeconds;
    this.elapsedTime = 0;
    this.spawnCooldown = ROUND_FLOW.postCountdownSpawnDelaySeconds;
    this.spawnInterval = GAME_CONFIG.baseSpawnInterval;
    this.speedMultiplier = 1;
    this.heartSpawnCooldown = randomRange(4.5, 7);

    this.humanComboText = "";
    this.humanComboTimer = 0;
    this.blastTimer = 0;
    this.resetHumanPerformanceTracking(now);

    this.objects = [];
    this.particles = [];
    this.blade.reset();
    this.aiController.setDifficulty(AI_MODE_DIFFICULTY);
    this.aiController.reset(now);

    this.updateHudLayout();
    this.menuOverlay.classList.add("hidden");
    this.resultOverlay.classList.add("hidden");
    this.hudEl.classList.remove("hidden");
  }

  backToMenu() {
    this.state = "menu";
    this.roundPhase = "idle";
    this.roundCountdownText = "";
    this.roundStartDelayRemaining = 0;
    this.roundCountdownStepRemaining = 0;
    this.roundCountdownStepIndex = 0;
    this.aiCanActAt = 0;
    this.firstPlayableFruitAt = null;
    this.hasSpawnedOpeningFruit = false;
    this.objects = [];
    this.particles = [];
    this.blade.reset();
    this.resetHumanPerformanceTracking();
    this.pendingEndReason = "";
    this.updateHudLayout();
    this.menuOverlay.classList.remove("hidden");
    this.resultOverlay.classList.add("hidden");
    this.hudEl.classList.add("hidden");
    this.updateInstallUi();
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

    if (this.roundPhase === "countdown") {
      this.updateRoundCountdown(now, dt);
      this.refreshHud();
      return;
    }

    if (this.mode === MODES.AI_VS_HUMAN) {
      this.roundTimeRemaining = Math.max(0, this.roundTimeRemaining - dt);
      if (this.roundTimeRemaining <= 0) {
        this.finishGame("time_up");
        return;
      }
      this.purgeAiModeNonFruitObjects();
    }

    this.updateDifficulty(dt);
    this.updateSpawning(dt);
    this.updateObjects(dt);
    this.trackFirstPlayableFruit(now);
    const humanClaims = this.collectHumanSliceClaims();
    const humanPerformance =
      this.mode === MODES.AI_VS_HUMAN ? this.buildHumanPerformanceSnapshot(now) : null;
    const aiDecision =
      this.state === "running" && this.mode === MODES.AI_VS_HUMAN && this.canAiAct(now)
        ? this.aiController.decide(
            now,
            this.objects,
            this.bounds,
            this.roundProgress(),
            this.humanScore - this.aiScore,
            humanPerformance,
            false,
          )
        : null;
    this.resolveSliceClaims(now, humanClaims, aiDecision);

    if (this.state === "running") {
      this.handleMissedObjects();
      this.handleHumanComboBonus();
    }

    this.refreshHud();
  }

  updateRoundCountdown(now, dt) {
    if (this.roundPhase !== "countdown") {
      return;
    }

    if (this.roundStartDelayRemaining > 0) {
      this.roundStartDelayRemaining = Math.max(0, this.roundStartDelayRemaining - dt);
      if (this.roundStartDelayRemaining > 0) {
        this.roundCountdownText = "";
        return;
      }
      this.roundCountdownText = ROUND_FLOW.countdownSequence[0];
      this.roundCountdownStepRemaining = ROUND_FLOW.countdownStepSeconds;
      this.roundCountdownStepIndex = 0;
      return;
    }

    this.roundCountdownStepRemaining = Math.max(0, this.roundCountdownStepRemaining - dt);
    if (this.roundCountdownStepRemaining > 0) {
      return;
    }

    this.roundCountdownStepIndex += 1;
    if (this.roundCountdownStepIndex >= ROUND_FLOW.countdownSequence.length) {
      this.roundPhase = "active";
      this.roundCountdownText = "";
      this.aiCanActAt = now + ROUND_FLOW.aiOpeningLockSeconds;
      return;
    }

    this.roundCountdownText = ROUND_FLOW.countdownSequence[this.roundCountdownStepIndex];
    this.roundCountdownStepRemaining = ROUND_FLOW.countdownStepSeconds;
  }

  trackFirstPlayableFruit(now) {
    if (this.mode !== MODES.AI_VS_HUMAN || this.roundPhase !== "active" || this.firstPlayableFruitAt !== null) {
      return;
    }

    const hasVisibleFruit = this.objects.some(
      (obj) => obj.kind === "fruit" && this.aiController.isSliceableVisible(obj, this.bounds),
    );
    if (!hasVisibleFruit) {
      return;
    }

    this.firstPlayableFruitAt = now;
    this.aiCanActAt = Math.max(
      this.aiCanActAt,
      now + ROUND_FLOW.humanFirstReactionWindowSeconds,
    );
  }

  canAiAct(now) {
    if (this.mode !== MODES.AI_VS_HUMAN || this.roundPhase !== "active") {
      return false;
    }
    if (now < this.aiCanActAt) {
      return false;
    }
    if (
      this.firstPlayableFruitAt !== null &&
      now - this.firstPlayableFruitAt < ROUND_FLOW.humanFirstReactionWindowSeconds
    ) {
      return false;
    }
    return true;
  }

  updateDifficulty(dt) {
    this.elapsedTime += dt;
    let targetSpeed = 1;
    let targetInterval = GAME_CONFIG.baseSpawnInterval;

    if (this.mode === MODES.AI_VS_HUMAN) {
      const elapsed = clamp(
        GAME_CONFIG.aiRoundSeconds - this.roundTimeRemaining,
        0,
        GAME_CONFIG.aiRoundSeconds,
      );
      const timePacing = this.getAiTimePacing(elapsed);
      const aiPacing = AI_MATCH_PACING[AI_MODE_DIFFICULTY] || AI_MATCH_PACING.hard;

      targetSpeed = clamp(timePacing.speedMultiplier * aiPacing.speedScale, 0.88, 2.5);
      targetInterval = clamp(
        GAME_CONFIG.baseSpawnInterval *
          timePacing.spawnIntervalMultiplier *
          aiPacing.spawnIntervalScale,
        0.2,
        1.15,
      );
    } else {
      const progressScore = this.humanScore;
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
    }

    const smoothing = Math.min(1, dt * 5);
    this.speedMultiplier += (targetSpeed - this.speedMultiplier) * smoothing;
    this.spawnInterval += (targetInterval - this.spawnInterval) * smoothing;
  }

  getAiTimePacing(elapsedSeconds) {
    const elapsed = clamp(elapsedSeconds, 0, GAME_CONFIG.aiRoundSeconds);
    for (const stage of AI_TIME_SCALING) {
      if (elapsed < stage.until) {
        return stage;
      }
    }
    return AI_TIME_SCALING[AI_TIME_SCALING.length - 1];
  }

  purgeAiModeNonFruitObjects() {
    if (this.mode !== MODES.AI_VS_HUMAN || !this.objects.length) {
      return;
    }
    if (!this.objects.some((obj) => obj.kind !== "fruit")) {
      return;
    }
    this.objects = this.objects.filter((obj) => obj.kind === "fruit");
  }

  updateSpawning(dt) {
    if (this.roundPhase !== "active") {
      return;
    }
    this.heartSpawnCooldown = Math.max(0, this.heartSpawnCooldown - dt);
    this.spawnCooldown -= dt;
    if (this.spawnCooldown > 0) {
      return;
    }
    this.spawnWave();
    this.spawnCooldown = this.spawnInterval * randomRange(0.85, 1.15);
  }

  spawnWave() {
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.purgeAiModeNonFruitObjects();
      const progress = this.roundProgress();
      const aiPacing = AI_MATCH_PACING[AI_MODE_DIFFICULTY] || AI_MATCH_PACING.hard;
      const targetFruitCount = Math.round(
        GAME_CONFIG.aiMinFruitCount +
          (GAME_CONFIG.aiMaxFruitCount - GAME_CONFIG.aiMinFruitCount) * progress,
      );
      const activeFruitCount = this.objects.reduce(
        (count, obj) => count + (obj.kind === "fruit" ? 1 : 0),
        0,
      );

      let objectCount = Math.max(0, targetFruitCount - activeFruitCount);
      if (activeFruitCount === 0) {
        objectCount = Math.max(objectCount, GAME_CONFIG.aiMinFruitCount);
      }

      const burstChance = clamp(0.24 + progress * 0.4 + (aiPacing.waveDensity - 1) * 0.18, 0.15, 0.88);
      if (objectCount > 0 && Math.random() < burstChance) {
        objectCount += 1;
      }

      objectCount = clamp(objectCount, 0, 8);
      for (let i = 0; i < objectCount; i += 1) {
        this.spawnObject();
      }
      return;
    }

    const difficulty = Math.min(1, this.humanScore / 85);
    let objectCount = 1;
    const secondFruitChance = 0.45 + difficulty * 0.35;
    const thirdFruitChance = 0.15 + difficulty * 0.3;
    if (Math.random() < secondFruitChance) {
      objectCount += 1;
    }
    if (Math.random() < thirdFruitChance) {
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

    if (this.mode === MODES.AI_VS_HUMAN) {
      this.purgeAiModeNonFruitObjects();
      if (!this.hasSpawnedOpeningFruit) {
        this.hasSpawnedOpeningFruit = true;
      }
      this.spawnFruit(baseX, baseY, launch);
      return;
    }

    if (this.shouldSpawnHeart()) {
      this.spawnHeart(baseX, baseY, launch);
      return;
    }

    const progressScore = this.humanScore;
    const bombChance = Math.min(0.24, 0.1 + progressScore * 0.0018);
    if (Math.random() < bombChance) {
      this.spawnBomb(baseX, baseY, launch);
      return;
    }
    this.spawnFruit(baseX, baseY, launch);
  }

  shouldSpawnHeart() {
    if (this.mode === MODES.AI_VS_HUMAN) {
      return false;
    }
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
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.hasSpawnedOpeningFruit = true;
    }
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
    if (this.mode === MODES.AI_VS_HUMAN) {
      return;
    }
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

  collectHumanSliceClaims() {
    const timedSegments = this.blade.getTimedSegments(this.bounds);
    const claims = new Map();
    if (!timedSegments.length) {
      return claims;
    }

    timedSegments.forEach((segment, segmentIndex) => {
      this.objects.forEach((obj) => {
        const collided = lineCircleCollision(
          segment.start,
          segment.end,
          { x: obj.x, y: obj.y },
          obj.radius * 0.95,
        );
        if (!collided) {
          return;
        }

        // Segment timestamps preserve first-slice ordering inside fast swipes.
        const claimTime = segment.time + segmentIndex * 0.000001;
        const existing = claims.get(obj.id);
        if (!existing || claimTime < existing.time) {
          claims.set(obj.id, {
            objectId: obj.id,
            owner: "human",
            time: claimTime,
            order: segmentIndex,
          });
        }
      });
    });

    return claims;
  }

  collectHeart(heart) {
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.spawnJuiceSplash({ x: heart.x, y: heart.y }, heart.color);
      return;
    }
    this.lives = Math.min(GAME_CONFIG.maxLives, this.lives + 1);
    this.spawnJuiceSplash({ x: heart.x, y: heart.y }, heart.color);
  }

  buildAiSliceClaims(now, aiDecision) {
    const claims = new Map();
    if (!aiDecision) {
      return claims;
    }

    let order = 0;
    aiDecision.slicedTargets.forEach((target) => {
      const claim = {
        objectId: target.id,
        owner: "ai",
        time: now + order * 0.000001,
        order: 1000 + order,
      };
      const existing = claims.get(target.id);
      if (!existing || claim.time < existing.time) {
        claims.set(target.id, claim);
      }
      order += 1;
    });

    if (aiDecision.bombTarget) {
      const claim = {
        objectId: aiDecision.bombTarget.id,
        owner: "ai",
        time: now + order * 0.000001,
        order: 1000 + order,
      };
      const existing = claims.get(aiDecision.bombTarget.id);
      if (!existing || claim.time < existing.time) {
        claims.set(aiDecision.bombTarget.id, claim);
      }
    }

    return claims;
  }

  resolveSliceClaims(now, humanClaims, aiDecision) {
    const aiClaims = this.buildAiSliceClaims(now, aiDecision);
    if (!humanClaims.size && !aiClaims.size) {
      return;
    }

    const winningClaims = new Map();
    const registerClaim = (claim) => {
      const previous = winningClaims.get(claim.objectId);
      if (!previous) {
        winningClaims.set(claim.objectId, claim);
        return;
      }

      if (claim.time < previous.time) {
        winningClaims.set(claim.objectId, claim);
        return;
      }

      if (claim.time === previous.time && claim.order < previous.order) {
        winningClaims.set(claim.objectId, claim);
      }
    };

    humanClaims.forEach((claim) => registerClaim(claim));
    aiClaims.forEach((claim) => registerClaim(claim));

    let humanFruitHits = 0;
    let aiFruitHits = 0;
    let aiBombHits = 0;
    const removeIds = new Set();

    for (const obj of this.objects) {
      const winner = winningClaims.get(obj.id);
      if (!winner) {
        continue;
      }

      removeIds.add(obj.id);
      if (winner.owner === "human") {
        if (obj.kind === "bomb") {
          if (this.mode === MODES.AI_VS_HUMAN) {
            this.spawnJuiceSplash({ x: obj.x, y: obj.y }, "#ff8f8f");
            continue;
          }
          this.triggerBombBlast({ x: obj.x, y: obj.y }, "human_bomb");
          return;
        }

        if (obj.kind === "heart") {
          this.collectHeart(obj);
          continue;
        }

        humanFruitHits += 1;
        this.spawnJuiceSplash({ x: obj.x, y: obj.y }, obj.color);
        continue;
      }

      if (obj.kind === "bomb") {
        if (this.mode === MODES.AI_VS_HUMAN) {
          continue;
        }
        aiBombHits += 1;
        this.spawnJuiceSplash({ x: obj.x, y: obj.y }, "#ff7373");
        this.spawnJuiceSplash({ x: obj.x, y: obj.y }, "#ff7373");
        continue;
      }

      if (obj.kind === "heart") {
        this.spawnJuiceSplash({ x: obj.x, y: obj.y }, "#ff80a4");
        continue;
      }

      aiFruitHits += 1;
      this.spawnJuiceSplash({ x: obj.x, y: obj.y }, "#62b0ff");
    }

    if (removeIds.size > 0) {
      this.objects = this.objects.filter((obj) => !removeIds.has(obj.id));
    }

    if (humanFruitHits > 0) {
      this.humanScore += humanFruitHits;
      this.recordHumanPerformance(now, humanFruitHits);
      for (let i = 0; i < humanFruitHits; i += 1) {
        this.blade.registerSlice();
      }
    }

    if (aiFruitHits > 0) {
      this.aiCutCount += aiFruitHits;
      this.aiScore += aiFruitHits;
      if (aiFruitHits > 1) {
        if (this.mode === MODES.AI_VS_HUMAN) {
          this.aiController.setSliceStatus(`AI Combo x${aiFruitHits}`, 0.72);
        } else {
          const comboBonus = this.aiController.setComboFeedback(aiFruitHits);
          this.aiScore += comboBonus;
        }
      } else {
        this.aiController.setSliceStatus("AI Slice", 0.55);
      }
    }

    if (aiBombHits > 0 && this.mode !== MODES.AI_VS_HUMAN) {
      for (let i = 0; i < aiBombHits; i += 1) {
        const penalty = this.aiController.applyBombPenalty(GAME_CONFIG.aiBombPenalty);
        this.aiScore = Math.max(0, this.aiScore - penalty);
      }
    }
  }

  handleMissedObjects() {
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.purgeAiModeNonFruitObjects();
    }
    const remaining = [];
    for (const obj of this.objects) {
      const offScreen = obj.y - obj.radius > this.bounds.bottom + 120;
      if (!offScreen) {
        remaining.push(obj);
        continue;
      }

      if (obj.kind === "fruit" && this.mode !== MODES.AI_VS_HUMAN) {
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
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.humanComboText = `Combo x${hits}`;
      this.humanComboTimer = 0.85;
      return;
    }
    const bonus = comboBonusForHits(hits);
    this.humanScore += bonus;
    this.humanComboText = humanComboText(hits, bonus);
    this.humanComboTimer = 1;
  }

  triggerBombBlast(position, reason) {
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.purgeAiModeNonFruitObjects();
      this.spawnJuiceSplash(position, "#ff8f8f");
      return;
    }
    this.state = "bomb_blast";
    this.roundPhase = "active";
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
    const safeReason =
      this.mode === MODES.AI_VS_HUMAN && reason === "human_bomb" ? "time_up" : reason;
    this.state = "result";
    this.roundPhase = "idle";

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
      if (safeReason === "human_out_of_lives") {
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

  resetHumanPerformanceTracking(now = 0) {
    this.humanCutCount = 0;
    this.humanComboCount = 0;
    this.humanHitStreak = 0;
    this.lastHumanHitAt = now - 1000;
    this.humanPerformanceEvents = [];
  }

  trimHumanPerformanceEvents(now) {
    const oldestAllowed =
      now - (AI_ADAPTIVE_TRACKING.windowSeconds + AI_ADAPTIVE_TRACKING.cleanupSlackSeconds);
    this.humanPerformanceEvents = this.humanPerformanceEvents.filter((entry) => entry.time >= oldestAllowed);
  }

  recordHumanPerformance(now, hitCount) {
    const hits = Math.max(0, Math.floor(hitCount));
    if (hits <= 0) {
      return;
    }

    const streakGrace = AI_ADAPTIVE_TRACKING.streakGraceSeconds;
    if (now - this.lastHumanHitAt <= streakGrace) {
      this.humanHitStreak += hits;
    } else {
      this.humanHitStreak = hits;
    }
    this.lastHumanHitAt = now;
    this.humanCutCount += hits;
    if (hits >= 2) {
      this.humanComboCount += 1;
    }

    this.humanPerformanceEvents.push({
      time: now,
      cuts: hits,
      score: hits,
      comboEvents: hits >= 2 ? 1 : 0,
    });
    this.trimHumanPerformanceEvents(now);
  }

  buildHumanPerformanceSnapshot(now) {
    this.trimHumanPerformanceEvents(now);
    if (now - this.lastHumanHitAt > AI_ADAPTIVE_TRACKING.streakGraceSeconds) {
      this.humanHitStreak = 0;
    }

    const expected = AI_ADAPTIVE_TRACKING.expectations[AI_MODE_DIFFICULTY];
    const sampleWindow = AI_ADAPTIVE_TRACKING.windowSeconds;
    const cutoff = now - sampleWindow;
    let recentCuts = 0;
    let recentScore = 0;
    let recentComboEvents = 0;
    this.humanPerformanceEvents.forEach((entry) => {
      if (entry.time < cutoff) {
        return;
      }
      recentCuts += entry.cuts;
      recentScore += entry.score;
      recentComboEvents += entry.comboEvents;
    });

    const effectiveWindow = Math.max(1, Math.min(sampleWindow, this.elapsedTime || sampleWindow));
    const recentCutRate = recentCuts / effectiveWindow;
    const scoreMomentum = recentScore / effectiveWindow;
    const recentComboRate = recentComboEvents / effectiveWindow;
    const elapsedRoundSeconds = clamp(
      GAME_CONFIG.aiRoundSeconds - this.roundTimeRemaining,
      0,
      GAME_CONFIG.aiRoundSeconds,
    );
    const expectedCutsByNow = Math.max(1, elapsedRoundSeconds * expected.cutRate);
    const expectedScoreByNow = Math.max(1, elapsedRoundSeconds * expected.scoreRate);

    return {
      humanScore: this.humanScore,
      aiScore: this.aiScore,
      cutCount: this.humanCutCount,
      aiCutCount: this.aiCutCount,
      recentCutRate,
      recentComboRate,
      scoreMomentum,
      cutStreak: this.humanHitStreak,
      cutGrowthRatio: this.humanCutCount / expectedCutsByNow,
      scoreProgressRatio: this.humanScore / expectedScoreByNow,
      expectedCutRate: expected.cutRate,
      expectedComboRate: expected.comboRate,
      expectedScoreMomentum: expected.scoreRate,
    };
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
        if (this.mode === MODES.AI_VS_HUMAN) {
          return;
        }
        this.drawBomb(obj);
      } else {
        this.drawHeart(obj);
      }
    });
  }

  drawFruit(fruit) {
    this.ctx.save();
    if (this.renderFruitShadows) {
      this.drawFruitShadow(fruit);
    }
    switch (fruit.name) {
      case "banana":
        this.drawBananaFruit(fruit);
        break;
      case "watermelon":
        this.drawWatermelonFruit(fruit);
        break;
      case "pineapple":
        this.drawPineappleFruit(fruit);
        break;
      case "orange":
        this.drawOrangeFruit(fruit);
        break;
      case "apple":
      default:
        this.drawAppleFruit(fruit);
        break;
    }
    this.ctx.restore();
  }

  drawFruitShadow(fruit) {
    const speedFactor = clamp(Math.abs(fruit.vy) / 1200, 0, 0.25);
    const radiusX = Math.max(2, fruit.radius * (0.72 - speedFactor * 0.2));
    const radiusY = Math.max(1.8, fruit.radius * (0.48 - speedFactor * 0.08));
    const yOffset = fruit.radius * (0.2 + speedFactor * 0.16);
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    this.ctx.beginPath();
    this.ctx.ellipse(
      fruit.x,
      fruit.y + yOffset,
      radiusX,
      radiusY,
      0,
      0,
      Math.PI * 2,
    );
    this.ctx.fill();
  }

  drawAppleFruit(fruit) {
    const style = FRUIT_STYLE.apple;
    const r = fruit.radius;
    const g = this.ctx.createRadialGradient(
      fruit.x - r * 0.35,
      fruit.y - r * 0.34,
      r * 0.18,
      fruit.x,
      fruit.y,
      r * 1.15,
    );
    g.addColorStop(0, style.body[1]);
    g.addColorStop(1, style.body[0]);

    if (this.renderFruitShadows) {
      this.ctx.fillStyle = style.shadow;
      this.ctx.beginPath();
      this.ctx.ellipse(fruit.x, fruit.y + r * 0.02, r * 0.97, r * 1.02, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x, fruit.y, r * 0.92, r * 0.98, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = style.stem;
    this.ctx.fillRect(fruit.x - r * 0.08, fruit.y - r * 1.02, r * 0.16, r * 0.44);
    this.ctx.fillStyle = style.leaf;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x + r * 0.28, fruit.y - r * 0.84, r * 0.24, r * 0.13, -0.4, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = style.highlight;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x - r * 0.36, fruit.y - r * 0.36, r * 0.21, r * 0.16, -0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawOrangeFruit(fruit) {
    const style = FRUIT_STYLE.orange;
    const r = fruit.radius;
    const g = this.ctx.createRadialGradient(
      fruit.x - r * 0.3,
      fruit.y - r * 0.3,
      r * 0.2,
      fruit.x,
      fruit.y,
      r,
    );
    g.addColorStop(0, style.body[1]);
    g.addColorStop(1, style.body[0]);

    if (this.renderFruitShadows) {
      this.ctx.fillStyle = style.shadow;
      this.ctx.beginPath();
      this.ctx.arc(fruit.x, fruit.y, r * 0.96, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x, fruit.y, r * 0.9, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = style.leaf;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x + r * 0.11, fruit.y - r * 0.9, r * 0.19, r * 0.1, -0.25, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = style.stem;
    this.ctx.fillRect(fruit.x - r * 0.03, fruit.y - r * 0.9, r * 0.06, r * 0.2);

    this.ctx.fillStyle = "rgba(193, 109, 21, 0.45)";
    const dimples = [
      [-0.34, -0.08],
      [-0.18, 0.21],
      [0.2, 0.19],
      [0.32, -0.12],
      [0.05, -0.22],
    ];
    dimples.forEach(([dx, dy]) => {
      this.ctx.beginPath();
      this.ctx.arc(fruit.x + r * dx, fruit.y + r * dy, r * 0.08, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.fillStyle = style.highlight;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x - r * 0.3, fruit.y - r * 0.34, r * 0.2, r * 0.14, -0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawWatermelonFruit(fruit) {
    const style = FRUIT_STYLE.watermelon;
    const r = fruit.radius;

    this.ctx.fillStyle = style.rindDark;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x, fruit.y, r * 0.95, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = style.rindMid;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x, fruit.y, r * 0.82, 0, Math.PI * 2);
    this.ctx.fill();

    const flesh = this.ctx.createRadialGradient(
      fruit.x - r * 0.28,
      fruit.y - r * 0.3,
      r * 0.22,
      fruit.x,
      fruit.y,
      r * 0.76,
    );
    flesh.addColorStop(0, "#f07f8d");
    flesh.addColorStop(1, style.flesh);
    this.ctx.fillStyle = flesh;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x, fruit.y, r * 0.72, 0, Math.PI * 2);
    this.ctx.fill();

    const seeds = [
      [-0.34, -0.08],
      [-0.1, -0.24],
      [0.15, -0.16],
      [0.34, -0.03],
      [-0.18, 0.14],
      [0.11, 0.2],
      [0.28, 0.15],
    ];
    this.ctx.fillStyle = style.seed;
    seeds.forEach(([dx, dy]) => {
      this.ctx.beginPath();
      this.ctx.ellipse(fruit.x + r * dx, fruit.y + r * dy, r * 0.06, r * 0.09, 0, 0, Math.PI * 2);
      this.ctx.fill();
    });

    this.ctx.fillStyle = style.highlight;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x - r * 0.22, fruit.y - r * 0.33, r * 0.2, r * 0.12, -0.35, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawPineappleFruit(fruit) {
    const style = FRUIT_STYLE.pineapple;
    const r = fruit.radius;

    this.ctx.fillStyle = style.bodyDark;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x, fruit.y + r * 0.06, r * 0.75, r * 1.02, 0, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = style.body;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x, fruit.y + r * 0.04, r * 0.66, r * 0.92, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = style.groove;
    this.ctx.lineWidth = Math.max(1.5, r * 0.06);
    for (let offset = -0.52; offset <= 0.52; offset += 0.24) {
      this.ctx.beginPath();
      this.ctx.moveTo(fruit.x - r * 0.55, fruit.y - r * 0.52 + r * offset);
      this.ctx.lineTo(fruit.x + r * 0.55, fruit.y + r * 0.52 + r * offset);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(fruit.x + r * 0.55, fruit.y - r * 0.52 + r * offset);
      this.ctx.lineTo(fruit.x - r * 0.55, fruit.y + r * 0.52 + r * offset);
      this.ctx.stroke();
    }

    this.ctx.fillStyle = style.crownDark;
    const crown = [
      [0, -1.42],
      [0.2, -0.74],
      [0.04, -0.74],
      [0.38, -1.16],
      [0.3, -0.66],
      [0.55, -0.94],
      [0.47, -0.58],
      [-0.55, -0.94],
      [-0.3, -0.66],
      [-0.38, -1.16],
      [-0.04, -0.74],
      [-0.2, -0.74],
    ];
    this.ctx.beginPath();
    crown.forEach(([dx, dy], index) => {
      const px = fruit.x + r * dx;
      const py = fruit.y + r * dy;
      if (index === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    });
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = style.crown;
    this.ctx.beginPath();
    this.ctx.moveTo(fruit.x, fruit.y - r * 1.3);
    this.ctx.lineTo(fruit.x + r * 0.26, fruit.y - r * 0.74);
    this.ctx.lineTo(fruit.x - r * 0.26, fruit.y - r * 0.74);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = style.highlight;
    this.ctx.beginPath();
    this.ctx.ellipse(fruit.x - r * 0.2, fruit.y - r * 0.25, r * 0.2, r * 0.14, -0.4, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawBananaFruit(fruit) {
    const style = FRUIT_STYLE.banana;
    const r = fruit.radius;
    const outerRadius = r * 0.92;
    const innerRadius = r * 0.58;
    const start = 0.26 * Math.PI;
    const end = 0.96 * Math.PI;

    this.ctx.strokeStyle = style.peelDark;
    this.ctx.lineWidth = Math.max(5, r * 0.42);
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.arc(fruit.x - r * 0.05, fruit.y + r * 0.1, outerRadius, start, end);
    this.ctx.stroke();

    this.ctx.strokeStyle = style.peel;
    this.ctx.lineWidth = Math.max(4, r * 0.34);
    this.ctx.beginPath();
    this.ctx.arc(fruit.x - r * 0.05, fruit.y + r * 0.1, outerRadius, start, end);
    this.ctx.stroke();

    this.ctx.strokeStyle = style.underside;
    this.ctx.lineWidth = Math.max(2, r * 0.14);
    this.ctx.beginPath();
    this.ctx.arc(fruit.x + r * 0.03, fruit.y + r * 0.03, innerRadius, start + 0.08, end - 0.08);
    this.ctx.stroke();

    this.ctx.fillStyle = style.tip;
    this.ctx.beginPath();
    this.ctx.arc(fruit.x - r * 0.82, fruit.y + r * 0.27, r * 0.09, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(fruit.x + r * 0.66, fruit.y - r * 0.2, r * 0.09, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.strokeStyle = style.highlight;
    this.ctx.lineWidth = Math.max(1.5, r * 0.09);
    this.ctx.beginPath();
    this.ctx.arc(fruit.x - r * 0.03, fruit.y + r * 0.04, r * 0.73, start + 0.1, end - 0.2);
    this.ctx.stroke();
  }

  drawBomb(bomb) {
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(bomb.pulse * 1.4));
    const fuseBaseX = bomb.x + bomb.radius * 0.34;
    const fuseBaseY = bomb.y - bomb.radius * 0.86;
    const sparkX = fuseBaseX + bomb.radius * 0.38;
    const sparkY = fuseBaseY - bomb.radius * 0.8;

    this.ctx.fillStyle = "#20242a";
    this.ctx.beginPath();
    this.ctx.ellipse(bomb.x, bomb.y, bomb.radius * 0.98, bomb.radius * 0.94, 0, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = "#161a20";
    this.ctx.beginPath();
    this.ctx.ellipse(
      bomb.x - bomb.radius * 0.14,
      bomb.y + bomb.radius * 0.08,
      bomb.radius * 0.56,
      bomb.radius * 0.5,
      0,
      0,
      Math.PI * 2,
    );
    this.ctx.fill();

    this.ctx.strokeStyle = "#69717c";
    this.ctx.lineWidth = Math.max(2, bomb.radius * 0.1);
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(fuseBaseX, fuseBaseY);
    this.ctx.lineTo(sparkX, sparkY);
    this.ctx.stroke();

    this.ctx.fillStyle = `rgba(255, 146, 80, ${0.55 + pulse * 0.35})`;
    this.ctx.beginPath();
    this.ctx.arc(sparkX, sparkY, bomb.radius * (0.11 + pulse * 0.07), 0, Math.PI * 2);
    this.ctx.fill();
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

  drawCountdownOverlay() {
    if (this.state !== "running" || this.roundPhase !== "countdown") {
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = "rgba(8, 14, 24, 0.22)";
    this.ctx.fillRect(0, 0, this.bounds.right, this.bounds.bottom);
    this.ctx.restore();
  }

  draw() {
    this.drawBackground();
    this.drawParticles();
    this.drawObjects();
    if (this.mode === MODES.AI_VS_HUMAN) {
      this.aiController.draw(this.ctx, this.bounds);
    }
    this.blade.draw(this.ctx, this.bounds);

    if (this.state === "bomb_blast") {
      this.drawBombBlast();
    }
    if (this.state === "running" && this.roundPhase === "countdown") {
      this.drawCountdownOverlay();
    }
  }

  refreshHud() {
    this.updateHudLayout();
    const aiMode = this.mode === MODES.AI_VS_HUMAN;
    const timerText = aiMode ? formatTime(this.roundTimeRemaining) : "Arcade";

    this.hudHumanScore.textContent = String(this.humanScore);
    this.hudAiScore.textContent = String(this.aiScore);
    this.hudMode.textContent = aiMode ? "Mode: AI vs Human" : "Mode: Classic";
    this.hudTimer.textContent = timerText;

    if (aiMode) {
      this.hudLives.textContent = `Time: ${timerText}`;
      this.hudLives.classList.remove("hidden");

      let aiStatus = "";
      if (this.aiController.statusTimer > 0 && this.aiController.statusText) {
        aiStatus = this.aiController.statusText;
      } else if (this.aiController.comboTimer > 0 && this.aiController.comboText) {
        aiStatus = this.aiController.comboText;
      } else if (this.roundPhase === "countdown") {
        aiStatus = this.roundCountdownText ? `Starting: ${this.roundCountdownText}` : "Get Ready";
      } else {
        const boostLabel = this.aiController.adaptiveStageLabel;
        aiStatus = boostLabel === "x1" ? "Keep Slicing" : `Boost ${boostLabel}`;
      }

      if (this.hudAiStatus) {
        this.hudAiStatus.textContent = aiStatus;
      }
      this.hudDifficulty.textContent = aiStatus;
    } else {
      const classicInfo =
        this.humanComboTimer > 0 && this.humanComboText
          ? `${this.humanComboText}  |  Best: ${this.highScore}`
          : `Lives: ${this.lives}  |  Best: ${this.highScore}`;
      this.hudLives.textContent = classicInfo;
      this.hudLives.classList.remove("hidden");

      if (this.hudAiStatus) {
        this.hudAiStatus.textContent = "";
      }
      this.hudDifficulty.textContent = "";
    }

    this.hudHighScore.textContent = `Best: ${this.highScore}`;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  let hasReloadedAfterControllerChange = false;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .then((registration) => {
        const requestActivate = (worker) => {
          if (worker) {
            worker.postMessage("SKIP_WAITING");
          }
        };

        if (registration.waiting) {
          requestActivate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) {
            return;
          }
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              requestActivate(installing);
            }
          });
        });
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.warn("Service worker registration failed:", error);
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloadedAfterControllerChange) {
      return;
    }
    hasReloadedAfterControllerChange = true;
    window.location.reload();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  applyViewportHeightVar();
  registerServiceWorker();
  window.__fruitChopApp = new GameApp();
});
