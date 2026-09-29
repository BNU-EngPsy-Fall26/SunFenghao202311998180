/* Application controller for Ember Watch. */
(function initialiseEmberWatch() {
  "use strict";

  var SDT = window.EmberSDT;
  var Charts = window.EmberCharts;
  var Game = window.EmberGame;
  var totalTrials = 30;
  var selectedPrevalence = 0.3;
  var currentResult = null;
  var historyKey = "ember_watch_rounds_v1";
  var roundHistory = loadHistory();

  function byId(id) {
    return document.getElementById(id);
  }

  function loadHistory() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(historyKey) || "[]");
      return Array.isArray(stored) ? stored.slice(0, 5) : [];
    } catch (error) {
      return [];
    }
  }

  function persistHistory() {
    try {
      window.localStorage.setItem(historyKey, JSON.stringify(roundHistory.slice(0, 5)));
    } catch (error) {
      // file:// privacy settings can disable storage. Session comparison still works in memory.
    }
  }

  function showScreen(name) {
    document.querySelectorAll(".screen").forEach(function hideScreen(screen) {
      screen.classList.remove("is-active");
    });
    var target = byId("screen-" + name);
    if (!target) return;
    target.classList.add("is-active");
    window.scrollTo(0, 0);
  }

  function formatDecimal(value, digits) {
    return Number.isFinite(value) ? value.toFixed(digits == null ? 2 : digits) : "—";
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? Math.round(value * 100) + "%" : "—";
  }

  function updatePrevalenceHelp() {
    var count = Math.round(totalTrials * selectedPrevalence);
    byId("prevalenceHelp").textContent = totalTrials + " 次中固定安排 " + count + " 次真实火情，再随机打乱。";
  }

  function setPrevalence(value, clickedButton) {
    selectedPrevalence = value;
    document.querySelectorAll("[data-prevalence]").forEach(function update(button) {
      button.classList.toggle("is-selected", button === clickedButton);
      button.setAttribute("aria-pressed", button === clickedButton ? "true" : "false");
    });
    updatePrevalenceHelp();
  }

  function updateLiveCounts(counts) {
    byId("liveH").textContent = counts.hits;
    byId("liveM").textContent = counts.misses;
    byId("liveFA").textContent = counts.falseAlarms;
    byId("liveCR").textContent = counts.correctRejections;
  }

  var game = new Game(byId("gameCanvas"), {
    onTrialStart: function onTrialStart(state) {
      byId("trialCurrent").textContent = state.number;
      byId("gameScore").textContent = state.score;
      byId("progressFill").style.width = ((state.number - 1) / state.total * 100).toFixed(1) + "%";
      byId("phaseChip").textContent = "扫描中 · 记住候选区域";
      byId("feedbackOverlay").classList.remove("is-visible", "is-negative");
      byId("decisionDock").classList.remove("is-ready");
      byId("decisionDock").setAttribute("aria-hidden", "true");
      document.querySelector(".game-stage").classList.remove("is-scanning");
      // Restart the CSS scan animation even when trials follow quickly.
      void document.querySelector(".game-stage").offsetWidth;
      document.querySelector(".game-stage").classList.add("is-scanning");
      updateLiveCounts(state.counts);
    },
    onResponseReady: function onResponseReady() {
      document.querySelector(".game-stage").classList.remove("is-scanning");
      byId("phaseChip").textContent = "等待判断 · F / J";
      byId("decisionDock").classList.add("is-ready");
      byId("decisionDock").setAttribute("aria-hidden", "false");
      document.querySelector("[data-response='signal']").focus();
    },
    onDecision: function onDecision(state) {
      var overlay = byId("feedbackOverlay");
      byId("decisionDock").classList.remove("is-ready");
      byId("decisionDock").setAttribute("aria-hidden", "true");
      byId("feedbackCode").textContent = state.outcome.code;
      byId("feedbackTitle").textContent = state.outcome.title;
      byId("feedbackText").textContent = state.outcome.text;
      overlay.classList.toggle("is-negative", state.outcome.negative);
      overlay.classList.add("is-visible");
      byId("phaseChip").textContent = "反馈已记录";
      byId("gameScore").textContent = state.score;
      byId("progressFill").style.width = ((game.trialIndex + 1) / game.trials.length * 100).toFixed(1) + "%";
      updateLiveCounts(state.counts);
    },
    onComplete: function onComplete(result) {
      currentResult = result;
      roundHistory.unshift({
        date: new Date().toISOString(),
        prevalence: result.config.prevalence,
        systemDPrime: result.config.dPrime,
        observedDPrime: result.stats.dPrime,
        criterion: result.stats.criterion,
        accuracy: result.stats.accuracy,
        score: result.score
      });
      roundHistory = roundHistory.slice(0, 5);
      persistHistory();
      renderReport(result);
      showScreen("report");
      window.requestAnimationFrame(function drawReportCharts() {
        Charts.drawDistribution(byId("distributionChart"), result.stats.dPrime, result.stats.criterion);
        Charts.drawROC(byId("rocChart"), result.stats.dPrime, {
          hitRate: result.stats.correctedHitRate,
          falseAlarmRate: result.stats.correctedFalseAlarmRate
        });
        updateCriterionLab();
      });
    }
  });

  function startGame() {
    var dPrime = parseFloat(byId("difficultySlider").value);
    byId("gamePrevalence").textContent = Math.round(selectedPrevalence * 100) + "%";
    byId("trialCurrent").textContent = "0";
    byId("gameScore").textContent = "0";
    byId("progressFill").style.width = "0%";
    updateLiveCounts({ hits: 0, misses: 0, falseAlarms: 0, correctRejections: 0 });
    showScreen("game");
    game.start({
      totalTrials: totalTrials,
      prevalence: selectedPrevalence,
      dPrime: dPrime,
      stimulusMs: 1500,
      feedbackMs: 900
    });
  }

  function renderReport(result) {
    var stats = result.stats;
    var config = result.config;
    var strategy = SDT.interpretStrategy(stats.criterion);
    var medianReaction = median(result.reactionTimes);

    byId("reportSubtitle").textContent = config.totalTrials + " 次判断 · P(S)=" + config.prevalence.toFixed(2) +
      " · 系统 d′=" + config.dPrime.toFixed(1) + " · 中位反应 " + Math.round(medianReaction) + " ms";
    byId("strategyLabel").textContent = strategy.label;
    byId("strategyNarrative").textContent = strategy.text + " 你的观察 d′=" + stats.dPrime.toFixed(2) +
      "，系统设定 d′=" + config.dPrime.toFixed(1) + "。";
    byId("reportScore").textContent = result.score;

    byId("metricPH").textContent = formatDecimal(stats.hitRate);
    byId("metricPFA").textContent = formatDecimal(stats.falseAlarmRate);
    byId("metricD").textContent = formatDecimal(stats.dPrime);
    byId("metricC").textContent = formatDecimal(stats.criterion);
    byId("metricAccuracy").textContent = formatPercent(stats.accuracy);

    byId("countH").textContent = stats.hits;
    byId("countM").textContent = stats.misses;
    byId("countFA").textContent = stats.falseAlarms;
    byId("countCR").textContent = stats.correctRejections;

    byId("correctedPH").textContent = formatDecimal(stats.correctedHitRate, 3);
    byId("correctedPFA").textContent = formatDecimal(stats.correctedFalseAlarmRate, 3);
    byId("formulaD").textContent = formatDecimal(stats.dPrime);
    byId("formulaC").textContent = formatDecimal(stats.criterion);
    byId("aucLabel").textContent = "AUC " + formatDecimal(stats.auc, 3);

    byId("criterionSlider").value = SDT.clamp(stats.criterion, -1.5, 1.5).toFixed(2);
    renderHistory();
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function sortAscending(a, b) { return a - b; });
    var middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function updateCriterionLab() {
    if (!currentResult) return;
    var criterion = parseFloat(byId("criterionSlider").value);
    var dPrime = currentResult.config.dPrime;
    var rates = SDT.projectedRates(dPrime, criterion);
    byId("simC").textContent = formatDecimal(criterion);
    byId("simPH").textContent = formatDecimal(rates.hitRate);
    byId("simPFA").textContent = formatDecimal(rates.falseAlarmRate);
    Charts.drawDistribution(byId("criterionChart"), dPrime, criterion, { compact: true });
  }

  function renderHistory() {
    var body = byId("historyBody");
    body.textContent = "";
    roundHistory.forEach(function addRow(round, index) {
      var row = document.createElement("tr");
      var values = [
        "第 " + (roundHistory.length - index) + " 轮" + (index === 0 ? " · 当前" : ""),
        Math.round(round.prevalence * 100) + "%",
        formatDecimal(round.systemDPrime, 1),
        formatDecimal(round.observedDPrime),
        formatDecimal(round.criterion),
        formatPercent(round.accuracy),
        String(round.score)
      ];
      values.forEach(function addCell(value) {
        var cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
  }

  document.addEventListener("click", function handleClick(event) {
    var actionTarget = event.target.closest("[data-action]");
    if (actionTarget) {
      event.preventDefault();
      var action = actionTarget.dataset.action;
      if (action === "home") {
        game.stop();
        showScreen("home");
      } else if (action === "open-briefing" || action === "change-params") {
        game.stop();
        showScreen("briefing");
      } else if (action === "start-game" || action === "restart-same") {
        startGame();
      } else if (action === "open-method") {
        byId("methodDialog").showModal();
      } else if (action === "close-method") {
        byId("methodDialog").close();
      } else if (action === "dialog-to-briefing") {
        byId("methodDialog").close();
        showScreen("briefing");
      }
      return;
    }

    var prevalenceButton = event.target.closest("[data-prevalence]");
    if (prevalenceButton) {
      setPrevalence(parseFloat(prevalenceButton.dataset.prevalence), prevalenceButton);
      return;
    }

    var responseButton = event.target.closest("[data-response]");
    if (responseButton) {
      game.respond(responseButton.dataset.response === "signal");
    }
  });

  document.addEventListener("keydown", function handleKeyboard(event) {
    if (!byId("screen-game").classList.contains("is-active")) return;
    if (event.repeat) return;
    if (event.key.toLowerCase() === "f") game.respond(true);
    if (event.key.toLowerCase() === "j") game.respond(false);
  });

  byId("difficultySlider").addEventListener("input", function updateDifficulty() {
    byId("difficultyValue").textContent = parseFloat(this.value).toFixed(1);
  });

  byId("criterionSlider").addEventListener("input", updateCriterionLab);

  document.querySelectorAll("[data-prevalence]").forEach(function initialisePressedState(button) {
    button.setAttribute("aria-pressed", button.classList.contains("is-selected") ? "true" : "false");
  });

  updatePrevalenceHelp();
  renderHistory();
  window.EmberRenderer.startHeroPreview(byId("heroCanvas"));
}());
