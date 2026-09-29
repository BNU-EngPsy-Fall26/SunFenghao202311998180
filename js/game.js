/*
 * Ember Watch game engine and procedural satellite renderer.
 * Signal and noise trials share the same renderer; only sampled evidence differs.
 */
(function attachGame(globalScope) {
  "use strict";

  var SDT = globalScope.EmberSDT;

  function mulberry32(seed) {
    return function random() {
      var value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildBaseMap(width, height, seed) {
    var surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    var ctx = surface.getContext("2d");
    var random = mulberry32(seed);

    var gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#173f36");
    gradient.addColorStop(0.5, "#244c3d");
    gradient.addColorStop(1, "#0c302c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Pixel-like multispectral ground patches.
    var cols = 18;
    var rows = 11;
    var cellW = width / cols;
    var cellH = height / rows;
    for (var row = 0; row < rows; row += 1) {
      for (var col = 0; col < cols; col += 1) {
        var tone = Math.floor(26 + random() * 35);
        var alpha = 0.08 + random() * 0.16;
        ctx.fillStyle = "rgba(" + tone + "," + (tone + 35) + "," + (tone + 18) + "," + alpha.toFixed(2) + ")";
        ctx.fillRect(col * cellW, row * cellH, cellW + 1, cellH + 1);
      }
    }

    // Terrain contours make the view feel like a monitoring instrument, not an illustration.
    ctx.lineWidth = 1.2;
    for (var line = 0; line < 15; line += 1) {
      var baseY = random() * height;
      var amplitude = 12 + random() * 40;
      ctx.beginPath();
      for (var x = -20; x <= width + 20; x += 18) {
        var y = baseY + Math.sin(x / (45 + random() * 30) + line) * amplitude + (random() - 0.5) * 8;
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(178, 221, 190," + (0.05 + random() * 0.1).toFixed(2) + ")";
      ctx.stroke();
    }

    // River or road-like corridor.
    ctx.save();
    ctx.strokeStyle = "rgba(126, 180, 176, 0.22)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-20, height * (0.25 + random() * 0.2));
    ctx.bezierCurveTo(width * 0.24, height * 0.05, width * 0.58, height * 0.8, width + 20, height * 0.58);
    ctx.stroke();
    ctx.strokeStyle = "rgba(201, 234, 219, 0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // Diffuse cloud cover acts as realistic visual noise.
    for (var cloud = 0; cloud < 9; cloud += 1) {
      var cx = random() * width;
      var cy = random() * height;
      var rx = 40 + random() * 100;
      var ry = 18 + random() * 45;
      var cloudGradient = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      cloudGradient.addColorStop(0, "rgba(224, 235, 228," + (0.08 + random() * 0.11).toFixed(2) + ")");
      cloudGradient.addColorStop(1, "rgba(224, 235, 228,0)");
      ctx.save();
      ctx.scale(1, ry / rx);
      ctx.fillStyle = cloudGradient;
      ctx.beginPath();
      ctx.arc(cx, cy * rx / ry, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Instrument grid.
    ctx.strokeStyle = "rgba(225, 244, 236, 0.075)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= width; gx += width / 10) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
    for (var gy = 0; gy <= height; gy += height / 6) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }

    // Harmless industrial heat sources and bright rocks.
    for (var decoy = 0; decoy < 13; decoy += 1) {
      var dx = 30 + random() * (width - 60);
      var dy = 30 + random() * (height - 60);
      var radius = 2 + random() * 5;
      ctx.fillStyle = "rgba(238, 167, 87," + (0.11 + random() * 0.16).toFixed(2) + ")";
      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    return surface;
  }

  function drawCandidate(ctx, x, y, evidence, scanProgress) {
    var intensity = SDT.clamp((evidence + 1.8) / 4.8, 0.08, 0.98);
    var scanX = scanProgress * ctx.canvas.width;
    var scanBoost = Math.max(0, 1 - Math.abs(scanX - x) / 130);
    var alpha = SDT.clamp(intensity * (0.62 + scanBoost * 0.74), 0.08, 1);
    var radius = 14 + intensity * 26;

    ctx.save();
    var halo = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.4);
    halo.addColorStop(0, "rgba(255, 219, 130," + (0.55 * alpha).toFixed(3) + ")");
    halo.addColorStop(0.22, "rgba(239, 103, 54," + (0.66 * alpha).toFixed(3) + ")");
    halo.addColorStop(1, "rgba(239, 103, 54,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 230, 155," + alpha.toFixed(3) + ")";
    ctx.beginPath();
    ctx.arc(x, y, 2.5 + intensity * 4, 0, Math.PI * 2);
    ctx.fill();

    // A faint plume is visible only at stronger evidence values.
    if (intensity > 0.48) {
      ctx.strokeStyle = "rgba(224, 231, 225," + ((intensity - 0.35) * 0.42).toFixed(3) + ")";
      ctx.lineWidth = 4 + intensity * 5;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 5);
      ctx.bezierCurveTo(x + 16, y - 28, x - 20, y - 46, x + 8, y - 75);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFrame(ctx, visual, scanProgress, showCandidate) {
    var width = ctx.canvas.width;
    var height = ctx.canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(visual.baseMap, 0, 0);

    if (showCandidate) {
      drawCandidate(ctx, visual.x, visual.y, visual.evidence, scanProgress);
    }

    ctx.fillStyle = "rgba(6, 26, 24, 0.12)";
    ctx.fillRect(0, 0, width, height);

    // Moving orbital scan line.
    var scanX = scanProgress * width;
    var scanGradient = ctx.createLinearGradient(scanX - 42, 0, scanX + 42, 0);
    scanGradient.addColorStop(0, "rgba(120, 244, 199,0)");
    scanGradient.addColorStop(0.48, "rgba(120, 244, 199,0.08)");
    scanGradient.addColorStop(0.5, "rgba(194, 255, 231,0.62)");
    scanGradient.addColorStop(0.52, "rgba(120, 244, 199,0.08)");
    scanGradient.addColorStop(1, "rgba(120, 244, 199,0)");
    ctx.fillStyle = scanGradient;
    ctx.fillRect(scanX - 42, 0, 84, height);

    ctx.fillStyle = "rgba(235, 246, 241, 0.72)";
    ctx.font = "13px Consolas, monospace";
    ctx.textAlign = "left";
    ctx.fillText("THERMAL CHANNEL / 3.9 μm", 28, 34);
    ctx.fillText(visual.coordinates, 28, height - 24);
    ctx.textAlign = "right";
    ctx.fillText("PASS " + visual.passCode, width - 28, 34);
    ctx.fillText("CLOUD MASK: ACTIVE", width - 28, height - 24);
  }

  function drawHiddenFrame(ctx, visual) {
    drawFrame(ctx, visual, 1, false);
    ctx.fillStyle = "rgba(4, 22, 20, 0.68)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 24px 'Microsoft YaHei UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("扫描窗口已关闭", ctx.canvas.width / 2, ctx.canvas.height / 2 - 4);
    ctx.fillStyle = "rgba(255,255,255,0.46)";
    ctx.font = "13px 'Microsoft YaHei UI', sans-serif";
    ctx.fillText("请根据刚才的卫星画面完成判断", ctx.canvas.width / 2, ctx.canvas.height / 2 + 28);
  }

  function createVisual(canvas, evidence, seed) {
    var random = mulberry32(seed + 91);
    return {
      baseMap: buildBaseMap(canvas.width, canvas.height, seed),
      evidence: evidence,
      x: canvas.width * (0.22 + random() * 0.56),
      y: canvas.height * (0.22 + random() * 0.55),
      coordinates: (24 + random() * 12).toFixed(2) + "°N / " + (98 + random() * 18).toFixed(2) + "°E",
      passCode: String(seed % 97).padStart(2, "0")
    };
  }

  function outcomeFor(signalPresent, responseSignal) {
    var countKey = SDT.classifyOutcome(signalPresent, responseSignal);
    if (countKey === "hits") {
      return { key: countKey, code: "H / HIT", title: "火点确认", text: "预警链已启动 · +100", points: 100, negative: false };
    }
    if (countKey === "misses") {
      return { key: countKey, code: "M / MISS", title: "火情漏报", text: "响应窗口缩短 · −220", points: -220, negative: true };
    }
    if (countKey === "falseAlarms") {
      return { key: countKey, code: "FA / FALSE ALARM", title: "环境干扰", text: "复核资源占用 · −60", points: -60, negative: true };
    }
    return { key: countKey, code: "CR / CORRECT REJECTION", title: "干扰排除", text: "监测继续 · +25", points: 25, negative: false };
  }

  function EmberGame(canvas, callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.callbacks = callbacks || {};
    this.phase = "idle";
    this.trialIndex = -1;
    this.timer = null;
    this.animationFrame = null;
    this.visual = null;
    this.config = null;
    this.trials = [];
    this.score = 0;
    this.counts = { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };
    this.reactionTimes = [];
    this.responseStartedAt = 0;
  }

  EmberGame.prototype.start = function start(config) {
    this.stop();
    this.config = {
      totalTrials: config.totalTrials || 30,
      prevalence: config.prevalence,
      dPrime: config.dPrime,
      stimulusMs: config.stimulusMs || 1500,
      feedbackMs: config.feedbackMs || 900
    };
    this.trials = SDT.buildTrialPlan(this.config.totalTrials, this.config.prevalence);
    this.trialIndex = -1;
    this.score = 0;
    this.counts = { hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 };
    this.reactionTimes = [];
    this.nextTrial();
  };

  EmberGame.prototype.stop = function stop() {
    if (this.timer) window.clearTimeout(this.timer);
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
    this.timer = null;
    this.animationFrame = null;
    this.phase = "idle";
  };

  EmberGame.prototype.nextTrial = function nextTrial() {
    var self = this;
    this.trialIndex += 1;

    if (this.trialIndex >= this.trials.length) {
      this.phase = "complete";
      var stats = SDT.calculateStats(this.counts);
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete({
          counts: Object.assign({}, this.counts),
          score: this.score,
          stats: stats,
          reactionTimes: this.reactionTimes.slice(),
          config: Object.assign({}, this.config)
        });
      }
      return;
    }

    var trial = this.trials[this.trialIndex];
    var evidence = SDT.sampleNormal(trial.signal ? this.config.dPrime : 0, 1);
    var seed = Math.floor(Math.random() * 900000) + this.trialIndex * 101;
    this.visual = createVisual(this.canvas, evidence, seed);
    this.phase = "stimulus";

    if (this.callbacks.onTrialStart) {
      this.callbacks.onTrialStart({
        number: this.trialIndex + 1,
        total: this.trials.length,
        counts: Object.assign({}, this.counts),
        score: this.score
      });
    }

    var startAt = performance.now();
    function animate(now) {
      var progress = SDT.clamp((now - startAt) / self.config.stimulusMs, 0, 1);
      drawFrame(self.ctx, self.visual, progress, true);
      if (progress < 1 && self.phase === "stimulus") {
        self.animationFrame = window.requestAnimationFrame(animate);
      }
    }
    this.animationFrame = window.requestAnimationFrame(animate);

    this.timer = window.setTimeout(function openResponse() {
      if (self.animationFrame) window.cancelAnimationFrame(self.animationFrame);
      drawHiddenFrame(self.ctx, self.visual);
      self.phase = "response";
      self.responseStartedAt = performance.now();
      if (self.callbacks.onResponseReady) self.callbacks.onResponseReady();
    }, this.config.stimulusMs);
  };

  EmberGame.prototype.respond = function respond(responseSignal) {
    var self = this;
    if (this.phase !== "response") return false;
    this.phase = "feedback";
    var trial = this.trials[this.trialIndex];
    var outcome = outcomeFor(trial.signal, Boolean(responseSignal));
    this.counts[outcome.key] += 1;
    this.score += outcome.points;
    this.reactionTimes.push(Math.max(0, performance.now() - this.responseStartedAt));

    if (this.callbacks.onDecision) {
      this.callbacks.onDecision({
        outcome: outcome,
        counts: Object.assign({}, this.counts),
        score: this.score,
        truth: trial.signal,
        responseSignal: Boolean(responseSignal)
      });
    }

    this.timer = window.setTimeout(function continueGame() {
      self.nextTrial();
    }, this.config.feedbackMs);
    return true;
  };

  function startHeroPreview(canvas) {
    if (!canvas) return function noop() {};
    var ctx = canvas.getContext("2d");
    var visual = createVisual(canvas, 1.65, 270927);
    var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var frameId = null;
    var startAt = performance.now();

    function render(now) {
      var progress = reducedMotion ? 0.58 : ((now - startAt) % 4800) / 4800;
      drawFrame(ctx, visual, progress, true);
      if (!reducedMotion) frameId = window.requestAnimationFrame(render);
    }
    frameId = window.requestAnimationFrame(render);
    return function stopPreview() {
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }

  globalScope.EmberGame = EmberGame;
  globalScope.EmberRenderer = {
    startHeroPreview: startHeroPreview,
    drawFrame: drawFrame,
    drawHiddenFrame: drawHiddenFrame
  };
}(window));
