/*
 * Signal Detection Theory utilities for Ember Watch.
 * This file has no DOM dependency so the formulas can be tested with Node.js.
 */
(function attachSDT(globalScope) {
  "use strict";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalPDF(x, mean, sd) {
    var mu = mean == null ? 0 : mean;
    var sigma = sd == null ? 1 : sd;
    var z = (x - mu) / sigma;
    return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
  }

  // Abramowitz-Stegun approximation; absolute error is small enough for display.
  function normalCDF(x) {
    var sign = x < 0 ? -1 : 1;
    var value = Math.abs(x) / Math.sqrt(2);
    var t = 1 / (1 + 0.3275911 * value);
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-value * value);
    return 0.5 * (1 + sign * erf);
  }

  // Peter J. Acklam's inverse-normal approximation.
  function inverseNormalCDF(probability) {
    var p = clamp(probability, 1e-12, 1 - 1e-12);
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
      138.357751867269, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
      66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
      -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
      3.754408661907416];
    var lower = 0.02425;
    var upper = 1 - lower;
    var q;
    var r;

    if (p < lower) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    if (p <= upper) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }

    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  function validateCounts(counts) {
    ["hits", "misses", "falseAlarms", "correctRejections"].forEach(function checkKey(key) {
      if (!Number.isFinite(counts[key]) || counts[key] < 0 || Math.floor(counts[key]) !== counts[key]) {
        throw new Error("SDT count '" + key + "' must be a non-negative integer.");
      }
    });
  }

  function calculateStats(counts) {
    validateCounts(counts);
    var signalTrials = counts.hits + counts.misses;
    var noiseTrials = counts.falseAlarms + counts.correctRejections;
    var totalTrials = signalTrials + noiseTrials;

    if (signalTrials === 0 || noiseTrials === 0) {
      throw new Error("SDT calculation requires at least one signal and one noise trial.");
    }

    var hitRate = counts.hits / signalTrials;
    var falseAlarmRate = counts.falseAlarms / noiseTrials;

    // Hautus / log-linear correction prevents z(0) and z(1) from becoming infinite.
    var correctedHitRate = (counts.hits + 0.5) / (signalTrials + 1);
    var correctedFalseAlarmRate = (counts.falseAlarms + 0.5) / (noiseTrials + 1);
    var zHit = inverseNormalCDF(correctedHitRate);
    var zFalseAlarm = inverseNormalCDF(correctedFalseAlarmRate);
    var dPrime = zHit - zFalseAlarm;
    var criterion = -0.5 * (zHit + zFalseAlarm);
    var accuracy = (counts.hits + counts.correctRejections) / totalTrials;
    var beta = Math.exp(dPrime * criterion);
    var auc = normalCDF(dPrime / Math.sqrt(2));

    return {
      hits: counts.hits,
      misses: counts.misses,
      falseAlarms: counts.falseAlarms,
      correctRejections: counts.correctRejections,
      signalTrials: signalTrials,
      noiseTrials: noiseTrials,
      totalTrials: totalTrials,
      hitRate: hitRate,
      falseAlarmRate: falseAlarmRate,
      correctedHitRate: correctedHitRate,
      correctedFalseAlarmRate: correctedFalseAlarmRate,
      zHit: zHit,
      zFalseAlarm: zFalseAlarm,
      dPrime: dPrime,
      criterion: criterion,
      beta: beta,
      auc: auc,
      accuracy: accuracy
    };
  }

  function buildTrialPlan(totalTrials, prevalence, randomFn) {
    if (!Number.isInteger(totalTrials) || totalTrials < 2) {
      throw new Error("totalTrials must be an integer of at least 2.");
    }
    if (!Number.isFinite(prevalence) || prevalence <= 0 || prevalence >= 1) {
      throw new Error("prevalence must be between 0 and 1.");
    }

    var rng = typeof randomFn === "function" ? randomFn : Math.random;
    var signalCount = clamp(Math.round(totalTrials * prevalence), 1, totalTrials - 1);
    var trials = [];
    var index;
    for (index = 0; index < totalTrials; index += 1) {
      trials.push({ signal: index < signalCount });
    }

    for (index = trials.length - 1; index > 0; index -= 1) {
      var swapIndex = Math.floor(rng() * (index + 1));
      var temp = trials[index];
      trials[index] = trials[swapIndex];
      trials[swapIndex] = temp;
    }

    return trials;
  }

  function sampleNormal(mean, sd, randomFn) {
    var rng = typeof randomFn === "function" ? randomFn : Math.random;
    var u = Math.max(rng(), 1e-12);
    var v = Math.max(rng(), 1e-12);
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function projectedRates(dPrime, criterion) {
    var threshold = dPrime / 2 + criterion;
    return {
      hitRate: 1 - normalCDF(threshold - dPrime),
      falseAlarmRate: 1 - normalCDF(threshold),
      threshold: threshold
    };
  }

  function classifyOutcome(signalPresent, responseSignal) {
    if (signalPresent && responseSignal) return "hits";
    if (signalPresent && !responseSignal) return "misses";
    if (!signalPresent && responseSignal) return "falseAlarms";
    return "correctRejections";
  }

  function interpretStrategy(criterion) {
    if (criterion > 0.25) {
      return {
        key: "conservative",
        label: "谨慎型",
        text: "你的判定标准偏高：较少发布误报，但也更容易错过微弱火情。"
      };
    }
    if (criterion < -0.25) {
      return {
        key: "liberal",
        label: "宽松型",
        text: "你的判定标准偏低：更愿意发布预警，击中率可能更高，但会占用更多复核资源。"
      };
    }
    return {
      key: "balanced",
      label: "平衡型",
      text: "你的判定标准接近中性，在漏报风险与误报成本之间保持了相对平衡。"
    };
  }

  var api = {
    clamp: clamp,
    normalPDF: normalPDF,
    normalCDF: normalCDF,
    inverseNormalCDF: inverseNormalCDF,
    calculateStats: calculateStats,
    buildTrialPlan: buildTrialPlan,
    sampleNormal: sampleNormal,
    projectedRates: projectedRates,
    classifyOutcome: classifyOutcome,
    interpretStrategy: interpretStrategy
  };

  globalScope.EmberSDT = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
}(typeof window !== "undefined" ? window : globalThis));
