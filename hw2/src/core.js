/* 无DOM的可测试研究逻辑。file://直接打开可用，不依赖模块服务器或CDN。 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LabCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const PROTOCOL = "attention-v1.1";
  const SEARCH_PALETTE = Object.freeze({
    id: "blue-orange-magenta-v1",
    blue: "#0072B2",
    orange: "#E69F00",
    magenta: "#882255",
  });
  const SEARCH_MODES = [
    "feature_original",
    "conjunction_original",
    "conjunction_grouped",
  ];
  const GRAPH_MODES = ["bar_original", "pie_original", "pie_aligned_aid"];
  const SIZES = [1, 5, 15, 30];
  const NAMES = {
    visual_search: "视觉搜索",
    graphical_judgment: "图形比例判断",
    feature_original: "特征搜索",
    conjunction_original: "联合搜索",
    conjunction_grouped: "分区联合搜索",
    bar_original: "共同基线柱图",
    pie_original: "原饼图",
    pie_aligned_aid: "饼图＋对照尺",
  };
  const COLORS = {
    feature_original: "#4E79A7",
    conjunction_original: "#7F7F7F",
    conjunction_grouped: "#D95F02",
    bar_original: "#4E79A7",
    pie_original: "#7F7F7F",
    pie_aligned_aid: "#D95F02",
  };
  const PERMS = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  function hash(value) {
    let h = 2166136261;
    for (const c of String(value)) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let s = typeof seed === "number" ? seed >>> 0 : hash(seed);
    return () => {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(values, random) {
    const a = values.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function mean(values) {
    const a = values.filter(Number.isFinite);
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
  }
  function sd(values) {
    const a = values.filter(Number.isFinite),
      m = mean(a);
    return a.length > 1
      ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
      : null;
  }
  function slope(xs, ys) {
    if (
      xs.length < 2 ||
      xs.length !== ys.length ||
      ys.some((v) => !Number.isFinite(v))
    )
      return null;
    const mx = mean(xs),
      my = mean(ys),
      den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
    return den
      ? xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den
      : null;
  }
  function assignment(participant) {
    const suffix = String(participant).match(/(\d+)$/);
    const index = suffix
      ? Math.max(0, Number(suffix[1]) - 1)
      : hash(participant) % 10000;
    const sequence = [0, 3, 4, 1, 2, 5];
    return {
      index,
      experiments:
        index % 2
          ? ["graphical_judgment", "visual_search"]
          : ["visual_search", "graphical_judgment"],
      visual_search: PERMS[sequence[index % 6]].map((i) => SEARCH_MODES[i]),
      graphical_judgment: PERMS[sequence[(index + 3) % 6]].map(
        (i) => GRAPH_MODES[i],
      ),
    };
  }
  function settings(mode) {
    return mode === "preview"
      ? {
          searchReps: 1,
          graphCount: 4,
          searchPractice: 4,
          graphPractice: 2,
          fixation: 350,
          feedback: 240,
          timeout: 5000,
        }
      : {
          searchReps: 10,
          graphCount: 20,
          searchPractice: 6,
          graphPractice: 3,
          fixation: 1000,
          feedback: 240,
          timeout: 5000,
        };
  }
  function searchPlan(seed, variant, mode) {
    const n = settings(mode).searchReps,
      trials = [];
    for (const size of SIZES)
      for (const present of [true, false])
        for (let rep = 0; rep < n; rep++)
          trials.push({
            variant,
            set_size: size,
            present,
            rep,
            feature_target:
              (mode === "preview" ? SIZES.indexOf(size) : rep) % 2
                ? "shape_S"
                : "magenta",
            seed: hash(`${seed}|search|${size}|${present}|${rep}`),
            family: `s-${size}-${Number(present)}-${rep}`,
          });
    return shuffle(trials, rng(`${seed}|order|${variant}`));
  }
  function searchStimulus(t) {
    const random = rng(t.seed),
      n = t.set_size;
    // 三模式用相同候选位置；原联合和分区联合共享目标位置与颜色计数。
    const grid = [];
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 6; x++)
        grid.push({
          x: (x - 2.5) * 108 + (random() - 0.5) * 16,
          y: (y - 2) * 68 + (random() - 0.5) * 12,
        });
    let slots = n === 1 ? [{ x: 0, y: 0 }] : shuffle(grid, random).slice(0, n);
    const blueCount =
      n === 1 ? 1 : Math.floor(n / 2) + (n % 2 && t.rep % 2 ? 1 : 0);
    const sorted = slots
      .map((p, i) => i)
      .sort((a, b) => slots[a].x - slots[b].x || slots[a].y - slots[b].y);
    const left = t.rep % 2 === 0;
    const groupedBlue = (left ? sorted : sorted.slice().reverse()).slice(
      0,
      blueCount,
    );
    const targetIndex = groupedBlue[t.rep % blueCount];
    const remainder = shuffle(
      slots.map((p, i) => i).filter((i) => i !== targetIndex),
      random,
    );
    const mixedBlue = [targetIndex, ...remainder.slice(0, blueCount - 1)];
    const blue = new Set(
      t.variant === "conjunction_grouped" ? groupedBlue : mixedBlue,
    );
    const items = slots.map((p, i) => ({
      x: p.x,
      y: p.y,
      color: blue.has(i) ? "blue" : "orange",
      letter: blue.has(i) ? "X" : "T",
    }));
    let targetKind = "none";
    if (t.present) {
      if (t.variant === "feature_original") {
        if (
          (t.feature_target || (t.rep % 2 ? "shape_S" : "magenta")) ===
          "magenta"
        ) {
          items[targetIndex].color = "magenta";
          items[targetIndex].letter = t.rep % 4 === 0 ? "X" : "T";
          targetKind = "magenta";
        } else {
          items[targetIndex].letter = "S";
          items[targetIndex].color = t.rep % 4 === 1 ? "blue" : "orange";
          targetKind = "shape_S";
        }
      } else {
        items[targetIndex].letter = "T";
        targetKind = "blue_T";
      }
    }
    return {
      items,
      targetIndex: t.present ? targetIndex : null,
      blueCount,
      side: left ? "left" : "right",
      targetKind,
    };
  }
  function validValues(v) {
    return (
      v.length === 5 &&
      Math.abs(v.reduce((a, b) => a + b, 0) - 100) < 1e-7 &&
      Math.min(...v) > 3 &&
      Math.max(...v) < 39 &&
      v.every((x, i) => v.every((y, j) => i === j || Math.abs(x - y) > 0.1))
    );
  }
  function graphFamily(family) {
    const random = rng(`graph-pool-v1|${family}`);
    let base;
    for (let attempt = 0; attempt < 10000; attempt++) {
      const raw = Array.from({ length: 5 }, () => 4 + random() * 31),
        total = raw.reduce((a, b) => a + b, 0);
      const v = raw.map((x) => (100 * x) / total);
      if (validValues(v)) {
        base = v;
        break;
      }
    }
    if (!base) throw new Error("图形刺激生成失败");
    const ranked = base.map((v, i) => i).sort((a, b) => base[a] - base[b]),
      reference = ranked[4],
      target = ranked[family % 4],
      targetRank = family % 4;
    const versions = [];
    for (let version = 0; version < 3; version++) {
      let chosen;
      for (let attempt = 0; attempt < 1000; attempt++) {
        const scale =
          version === 0
            ? 1
            : 1 +
              (version === 1 ? 1 : -1) *
                (0.5 + random() * 0.5) *
                0.03 *
                2 ** -Math.floor(attempt / 4);
        const values = base.slice();
        values[reference] *= scale;
        values[target] *= scale;
        const delta = (100 - values.reduce((a, b) => a + b, 0)) / 3;
        for (let i = 0; i < 5; i++)
          if (i !== reference && i !== target) values[i] += delta;
        const order = values
          .map((v, i) => i)
          .sort((a, b) => values[a] - values[b]);
        if (
          validValues(values) &&
          order[4] === reference &&
          order[targetRank] === target
        ) {
          chosen = values;
          break;
        }
      }
      if (!chosen) throw new Error("无法生成不重复的匹配刺激");
      versions.push({
        values: chosen,
        target,
        reference,
        true_pct: (100 * chosen[target]) / chosen[reference],
        targetRank,
      });
    }
    return versions;
  }
  function graphPlan(seed, variant, mode, participant) {
    const v = GRAPH_MODES.indexOf(variant),
      rotation = assignment(participant).index % 3,
      count = settings(mode).graphCount;
    const trials = Array.from({ length: count }, (_, family) => {
      const version = (v + rotation) % 3,
        f = graphFamily(family)[version];
      const order = shuffle(
        [0, 1, 2, 3, 4],
        rng(`${seed}|graph-layout|${family}`),
      );
      return {
        variant,
        family: `g-${family}`,
        dataset_id: `g${family}-v${version}`,
        seed: hash(`${seed}|graph|${family}`),
        ...f,
        order,
        rotation: ((family % 4) * Math.PI) / 2,
      };
    });
    return shuffle(trials, rng(`${seed}|graph-order|${variant}`));
  }
  function practicePlan(
    seed,
    experiment,
    variant,
    mode,
    participant,
    round = 0,
  ) {
    const count =
      experiment === "visual_search"
        ? settings(mode).searchPractice
        : settings(mode).graphPractice;
    if (experiment === "visual_search")
      return Array.from({ length: count }, (_, i) => ({
        variant,
        set_size: i % 2 ? 15 : 5,
        present: i < 2 || i % 3 === 0,
        rep: i + round * 8,
        seed: hash(`${seed}|practice|${variant}|${round}|${i}`),
        family: `practice-${i}`,
      }));
    return Array.from({ length: count }, (_, i) => {
      const f = graphFamily(100 + i + round * 10)[GRAPH_MODES.indexOf(variant)];
      return {
        variant,
        ...f,
        order: [0, 1, 2, 3, 4],
        rotation: (i * Math.PI) / 2,
        family: `practice-g${i}`,
        dataset_id: `practice-g${i}`,
        seed: hash(`${seed}|practice-g${i}`),
      };
    });
  }
  function logError(estimate, truth) {
    return Number.isFinite(estimate) && Number.isFinite(truth)
      ? Math.log2(Math.abs(estimate - truth) + 0.125)
      : null;
  }
  function validRT(t) {
    return (
      !t.interrupted &&
      !t.timeout &&
      t.correct === 1 &&
      Number.isFinite(t.rt) &&
      t.rt >= 150 &&
      t.rt <= 5000
    );
  }
  function summarizeSearch(trials, mode = "formal") {
    const minimum = mode === "preview" ? 1 : 8,
      variants = {};
    for (const variant of SEARCH_MODES) {
      const all = trials.filter((t) => t.variant === variant),
        scored = all.filter((t) => !t.interrupted);
      const curve = SIZES.map((size) => {
        const a = all.filter(
          (t) => t.set_size === size && t.present === true && validRT(t),
        );
        return { size, n: a.length, rt: mean(a.map((t) => t.rt)) };
      });
      variants[variant] = {
        n: all.length,
        accuracy: scored.length
          ? scored.filter((t) => t.correct === 1).length / scored.length
          : null,
        rt: mean(all.filter(validRT).map((t) => t.rt)),
        curve,
        slope: curve.every((p) => p.n >= minimum)
          ? slope(
              SIZES,
              curve.map((p) => p.rt),
            )
          : null,
      };
    }
    const scored = trials.filter((t) => !t.interrupted),
      accuracy = scored.length
        ? scored.filter((t) => t.correct === 1).length / scored.length
        : null;
    const eligible = accuracy !== null && accuracy >= 0.6;
    const diff = (a, b) =>
      eligible &&
      Number.isFinite(variants[a].slope) &&
      Number.isFinite(variants[b].slope)
        ? variants[a].slope - variants[b].slope
        : null;
    return {
      variants,
      accuracy,
      effects: {
        "S-R": diff("conjunction_original", "feature_original"),
        "S-I": diff("conjunction_original", "conjunction_grouped"),
      },
    };
  }
  function summarizeGraph(trials, mode = "formal") {
    const minimum = mode === "preview" ? 1 : 16,
      variants = {};
    for (const variant of GRAPH_MODES) {
      const all = trials.filter((t) => t.variant === variant),
        a = all.filter(
          (t) =>
            !t.interrupted &&
            !t.timeout &&
            Number.isFinite(t.estimate_pct) &&
            t.estimate_pct >= 0 &&
            t.estimate_pct <= 100 &&
            Number.isFinite(t.true_pct),
        );
      variants[variant] = {
        n: a.length,
        total: all.length,
        log: mean(a.map((t) => logError(t.estimate_pct, t.true_pct))),
        mae: mean(a.map((t) => Math.abs(t.estimate_pct - t.true_pct))),
        bias: mean(a.map((t) => t.estimate_pct - t.true_pct)),
        rt: mean(a.map((t) => t.rt)),
      };
    }
    const diff = (a, b) =>
      variants[a].n >= minimum && variants[b].n >= minimum
        ? variants[a].log - variants[b].log
        : null;
    return {
      variants,
      effects: {
        "G-R": diff("pie_original", "bar_original"),
        "G-I": diff("pie_original", "pie_aligned_aid"),
      },
    };
  }
  function quantile(values, p) {
    const a = values.slice().sort((a, b) => a - b),
      pos = (a.length - 1) * p,
      lo = Math.floor(pos);
    return a.length ? a[lo] + (a[Math.ceil(pos)] - a[lo]) * (pos - lo) : null;
  }
  function interval(values, seed = "ci", samples = 2500) {
    const a = values.filter(Number.isFinite);
    if (a.length < 2) return null;
    const random = rng(seed),
      draws = [];
    for (let i = 0; i < samples; i++) {
      let s = 0;
      for (let j = 0; j < a.length; j++)
        s += a[Math.floor(random() * a.length)];
      draws.push(s / a.length);
    }
    return [quantile(draws, 0.025), quantile(draws, 0.975)];
  }
  function signFlip(values) {
    const a = values.filter(Number.isFinite);
    if (a.length < 5) return null;
    const observed = Math.abs(a.reduce((s, v) => s + v, 0)),
      random = rng("sign-flip-v1"),
      exact = a.length <= 16,
      total = exact ? 2 ** a.length : 65536;
    let count = 0;
    for (let mask = 0; mask < total; mask++) {
      let s = 0;
      for (let i = 0; i < a.length; i++)
        s +=
          a[i] * (exact ? ((mask >> i) & 1 ? 1 : -1) : random() < 0.5 ? 1 : -1);
      if (Math.abs(s) >= observed - 1e-9) count++;
    }
    return exact ? count / total : (count + 1) / (total + 1);
  }
  function holm(ps) {
    const entries = ps
      .map((p, i) => ({ p, i }))
      .filter((x) => Number.isFinite(x.p))
      .sort((a, b) => a.p - b.p);
    const result = ps.map(() => null);
    let running = 0;
    entries.forEach((x, rank) => {
      running = Math.max(running, Math.min(1, x.p * (ps.length - rank)));
      result[x.i] = running;
    });
    return result;
  }
  function firstComplete(sessions, experiment, mode) {
    const seen = new Set();
    return sessions
      .filter(
        (s) =>
          s.mode === mode &&
          s.protocol === PROTOCOL &&
          s.tasks?.[experiment]?.complete,
      )
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .filter((s) => {
        if (seen.has(s.participant)) return false;
        seen.add(s.participant);
        return true;
      });
  }
  function groupSummary(sessions, mode = "formal") {
    const search = firstComplete(sessions, "visual_search", mode).map((s) => ({
      participant: s.participant,
      ...summarizeSearch(s.tasks.visual_search.trials, mode),
    }));
    const graph = firstComplete(sessions, "graphical_judgment", mode).map(
      (s) => ({
        participant: s.participant,
        ...summarizeGraph(s.tasks.graphical_judgment.trials, mode),
      }),
    );
    const keys = ["S-R", "S-I", "G-R", "G-I"],
      effects = keys.map((key) => {
        const rows = (key[0] === "S" ? search : graph).filter((r) =>
            Number.isFinite(r.effects[key]),
          ),
          values = rows.map((r) => r.effects[key]);
        return {
          key,
          n: values.length,
          values,
          participants: rows.map((r) => r.participant),
          mean: mean(values),
          sd: sd(values),
          ci: interval(values, key),
          p: mode === "formal" ? signFlip(values) : null,
        };
      });
    const adjusted = holm(effects.map((x) => x.p));
    effects.forEach((x, i) => (x.adjusted = adjusted[i]));
    return {
      search,
      graph,
      effects,
      mode,
      searchN: search.length,
      graphN: graph.length,
    };
  }
  function remoteRecordsToSessions(records, experiment, protocol = PROTOCOL) {
    const grouped = new Map();
    if (!Array.isArray(records)) return [];
    for (const record of records) {
      if (!record || !Array.isArray(record.trials) || !record.trials.length)
        continue;
      let meta = record.meta;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          meta = null;
        }
      }
      const first = record.trials[0];
      if (
        (meta?.protocol || first?.protocol) !== protocol ||
        (meta?.mode || first?.mode) !== "formal"
      )
        continue;
      if (
        record.trials.some(
          (t) =>
            !t ||
            typeof t !== "object" ||
            (t.protocol && t.protocol !== protocol) ||
            (t.mode && t.mode !== "formal"),
        )
      )
        continue;
      const exp = experiment || record.experiment;
      if (!["visual_search", "graphical_judgment"].includes(exp)) continue;
      const participant = String(record.participant || "anonymous"),
        id = String(
          meta?.session_id ||
            first.session_id ||
            record.id ||
            record.record_id ||
            `${participant}-${record.created_at}`,
        ),
        key = id + "|" + participant;
      if (!grouped.has(key))
        grouped.set(key, {
          id: "remote-" + id,
          participant,
          mode: "formal",
          protocol,
          createdAt:
            record.created_at ||
            record.submitted_at ||
            new Date().toISOString(),
          tasks: {},
          done: true,
          source: "teacher",
        });
      grouped.get(key).tasks[exp] = {
        complete: true,
        trials: record.trials,
        upload: { status: "uploaded" },
      };
    }
    return [...grouped.values()];
  }
  function submissionReceipt(data) {
    const warnings = (
      Array.isArray(data.warnings)
        ? data.warnings
        : data.warnings
          ? [data.warnings]
          : []
    ).map(String);
    const details = Array.isArray(data.warning_details)
      ? data.warning_details
      : [];
    const lossy = new Set([
      "string_truncated",
      "array_truncated",
      "converted_truncated",
      "non_finite",
      "too_many_fields",
    ]);
    return {
      status: "uploaded",
      record_id: data.record_id,
      warnings,
      warning_details: details,
      needsReview: warnings.length > 0 || details.length > 0,
      possibleDataLoss: details.some((d) => lossy.has(d.kind)),
      at: new Date().toISOString(),
    };
  }
  function csv(rows) {
    if (!rows.length) return "\uFEFF";
    const keys = [...new Set(rows.flatMap(Object.keys))];
    const cell = (v) => {
      let s = v == null ? "" : Array.isArray(v) ? JSON.stringify(v) : String(v);
      if (typeof v === "string" && /^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return (
      "\uFEFF" +
      [
        keys.map(cell).join(","),
        ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
      ].join("\r\n")
    );
  }
  return {
    PROTOCOL,
    SEARCH_PALETTE,
    SEARCH_MODES,
    GRAPH_MODES,
    SIZES,
    NAMES,
    COLORS,
    hash,
    rng,
    shuffle,
    mean,
    sd,
    slope,
    assignment,
    settings,
    searchPlan,
    searchStimulus,
    graphFamily,
    graphPlan,
    practicePlan,
    validValues,
    logError,
    validRT,
    summarizeSearch,
    summarizeGraph,
    interval,
    signFlip,
    holm,
    firstComplete,
    groupSummary,
    remoteRecordsToSessions,
    submissionReceipt,
    csv,
  };
});
