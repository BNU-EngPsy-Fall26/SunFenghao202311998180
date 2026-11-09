/* Offline analysis of the fixed owner export. No network requests or API keys. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const C = require("../src/core.js");
const ROOT = path.resolve(__dirname, "..");
const RAW = path.join(ROOT, "data/raw/final-2026-11-09");
const JSON_FILE = "hw2_W2UGHD_2026-11-09_194056.json";
const CSV_FILE = "hw2_W2UGHD_2026-11-09_194054.csv";
const SHA = "89c427c9b7fbb3895d49f36e48bd8c7e2daca2d5";
const SNAPSHOT = "2026-11-09T19:40:56+08:00";
const read = (name) => fs.readFileSync(path.join(RAW, name), "utf8");
const digest = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const write = (name, value) => {
  const file = path.join(ROOT, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
};
const json = (name, data) => write(name, JSON.stringify(data, null, 2) + "\n");
const table = (name, rows) => write(name, C.csv(rows) + "\n");
const owner = JSON.parse(read(JSON_FILE));
assert.equal(owner.project, "W2UGHD");
assert.ok(Array.isArray(owner.records));
const seen = new Set();
const selected = [];
const privateAudit = [];
const quality = [];
const timeOf = (r) =>
  r.meta.original_completed_at || r.created_at.replace(" ", "T") + "+08:00";
const asSession = (r) => ({
  participant: r.participant,
  protocol: C.PROTOCOL,
  mode: "formal",
  createdAt: r.meta.consent,
  tasks: { [r.experiment]: { complete: true, trials: r.trials } },
});

// Select the first structurally complete, protocol-consistent record per person/task.
// Incomplete/duplicate records remain in the private audit, never silently overwrite.
for (const r of owner.records
  .slice()
  .sort(
    (a, b) =>
      String(a.meta?.consent || a.created_at).localeCompare(
        String(b.meta?.consent || b.created_at),
      ) || a.record_id - b.record_id,
  )) {
  const search = r.experiment === "visual_search";
  const modes = search ? C.SEARCH_MODES : C.GRAPH_MODES;
  const key = `${r.participant}|${r.experiment}`;
  const complete =
    r.trials?.length === (search ? 240 : 60) &&
    modes.every(
      (m) =>
        r.trials.filter((t) => t.variant === m).length === (search ? 80 : 20),
    );
  const consistent =
    r.meta?.mode === "formal" &&
    r.meta?.protocol === C.PROTOCOL &&
    r.meta?.preregistration === SHA &&
    ["visual_search", "graphical_judgment"].includes(r.experiment) &&
    /^P0[1-5]$/.test(r.participant) &&
    r.trials.every(
      (t) =>
        t.phase === "main" &&
        t.mode === "formal" &&
        t.protocol === C.PROTOCOL &&
        t.session_id === r.meta.session_id,
    );
  const retain = complete && consistent && !seen.has(key);
  privateAudit.push({
    record_id: r.record_id,
    participant: r.participant,
    experiment: r.experiment,
    complete,
    consistent,
    retain,
    session_id: r.meta?.session_id,
    received_at: r.created_at,
    completion_time_basis: r.meta?.original_completed_at
      ? "original backup completion"
      : "platform receipt (upper bound)",
    completion_or_receipt: timeOf(r),
  });
  if (!retain) continue;
  seen.add(key);
  selected.push(r);
  const seq = r.trials.map((t) => t.trial_index);
  assert.deepEqual(
    seq,
    Array.from({ length: seq.length }, (_, i) => i + 1),
  );
  assert.equal(
    r.meta.order,
    C.assignment(r.participant)[r.experiment].join(","),
  );
  const planned = modes.flatMap((m) =>
    search
      ? C.searchPlan(r.meta.seed, m, "formal")
      : C.graphPlan(r.meta.seed, m, "formal", r.participant),
  );
  for (const t of r.trials) {
    const expected = planned.find(
      (p) =>
        p.variant === t.variant && p.seed === t.seed && p.family === t.family,
    );
    assert.ok(expected, `Unmatched stimulus ${key}/${t.trial_index}`);
    if (search) {
      assert.equal(t.present, expected.present);
      assert.equal(t.set_size, expected.set_size);
      assert.equal(t.palette, C.SEARCH_PALETTE.id);
      assert.equal(t.color_check, "self_report_pass");
      assert.equal(
        t.correct,
        !t.interrupted &&
          !t.timeout &&
          t.response === (t.present ? "yes" : "no")
          ? 1
          : 0,
      );
    } else {
      assert.deepEqual(t.values, expected.values);
      assert.deepEqual(t.display_order, expected.order);
      assert.ok(
        Math.abs(
          t.true_pct - (100 * t.values[t.target]) / t.values[t.reference],
        ) < 1e-9,
      );
      assert.ok(C.validValues(t.values));
      if (!t.interrupted && !t.timeout)
        assert.ok(
          Math.abs(t.log_error - C.logError(t.estimate_pct, t.true_pct)) < 1e-9,
        );
    }
  }
  for (const variant of modes) {
    const a = r.trials.filter((t) => t.variant === variant);
    const summary = search
      ? C.summarizeSearch(r.trials)
      : C.summarizeGraph(r.trials);
    if (search)
      for (const size of C.SIZES)
        for (const present of [true, false])
          assert.equal(
            a.filter((t) => t.set_size === size && t.present === present)
              .length,
            10,
          );
    quality.push({
      participant: r.participant,
      experiment: r.experiment,
      variant,
      trials: a.length,
      interrupted: a.filter((t) => t.interrupted).length,
      timeout: a.filter((t) => t.timeout).length,
      early_rt: a.filter((t) => Number.isFinite(t.rt) && t.rt < 150).length,
      valid: search ? a.filter(C.validRT).length : summary.variants[variant].n,
      accuracy: search ? summary.variants[variant].accuracy : null,
      minimum_present_cell: search
        ? Math.min(...summary.variants[variant].curve.map((x) => x.n))
        : null,
      main_metric_available: search
        ? Number.isFinite(summary.variants[variant].slope) &&
          summary.accuracy >= 0.6
        : summary.variants[variant].n >= 16,
    });
  }
}
assert.equal(selected.length, 10, "Expected ten complete task records");
assert.equal(new Set(selected.map((r) => r.participant)).size, 5);
const all = C.groupSummary(selected.map(asSession));
const conditionRows = [];
const curveRows = [];
const auxiliary = [];
for (const r of selected) {
  const search = r.experiment === "visual_search";
  const s = search ? C.summarizeSearch(r.trials) : C.summarizeGraph(r.trials);
  for (const [variant, v] of Object.entries(s.variants)) {
    conditionRows.push({
      participant: r.participant,
      experiment: r.experiment,
      variant,
      metric: search ? v.slope : v.log,
      accuracy: v.accuracy ?? null,
      rt: v.rt,
      mae: v.mae ?? null,
      bias: v.bias ?? null,
    });
    if (search) {
      for (const present of [true, false])
        for (const size of C.SIZES) {
          const ts = r.trials.filter(
            (t) =>
              t.variant === variant &&
              t.present === present &&
              t.set_size === size,
          );
          const valid = ts.filter(C.validRT);
          curveRows.push({
            participant: r.participant,
            variant,
            present,
            size,
            n: valid.length,
            rt: C.mean(valid.map((t) => t.rt)),
          });
        }
    }
  }
}
const pairedRows = [];
for (const exp of ["search", "graph"])
  for (const person of all[exp])
    for (const [key, value] of Object.entries(person.effects))
      pairedRows.push({
        cohort: "all",
        participant: person.participant,
        key,
        value,
      });
for (const [key, a, b, fields] of [
  ["S-I", "conjunction_original", "conjunction_grouped", ["accuracy", "rt"]],
  ["G-R", "pie_original", "bar_original", ["mae", "rt"]],
  ["G-I", "pie_original", "pie_aligned_aid", ["mae", "rt"]],
])
  for (const field of fields) {
    const vals = ["P01", "P02", "P03", "P04", "P05"].map((p) => {
      const va = conditionRows.find(
        (r) => r.participant === p && r.variant === a,
      );
      const vb = conditionRows.find(
        (r) => r.participant === p && r.variant === b,
      );
      return va[field] - vb[field];
    });
    auxiliary.push({
      key,
      field,
      n: vals.filter(Number.isFinite).length,
      values: vals,
      mean: C.mean(vals),
      sd: C.sd(vals),
      ci: C.interval(vals, `${key}-${field}-aux`),
    });
  }
const manifest = {
  project: owner.project,
  snapshot: SNAPSHOT,
  protocol: C.PROTOCOL,
  preregistration: SHA,
  files: [JSON_FILE, CSV_FILE].map((name) => ({
    name,
    bytes: fs.statSync(path.join(RAW, name)).size,
    sha256: digest(path.join(RAW, name)),
  })),
  records: owner.records.length,
  retained_records: selected.length,
  participants: 5,
  trial_count: selected.reduce((n, r) => n + r.trials.length, 0),
  search_trials: 1200,
  graph_trials: 300,
  participant_ids: ["P01", "P02", "P03", "P04", "P05"],
  bootstrap: {
    samples: 2500,
    seed: "effect key S-R/S-I/G-R/G-I",
    algorithm: "src/core.js rng/interval; percentile linear interpolation",
  },
  interpretation:
    "All five participants in the final export form one study sample. Sample scope was revised from the collection plan; trial-quality criteria and primary contrasts remain unchanged.",
};
json("data/summary/manifest.json", manifest);
json("data/raw/final-2026-11-09/selection-audit.json", privateAudit);
json("data/summary/analysis.json", {
  manifest,
  all,
  quality,
  conditionRows,
  curveRows,
  pairedRows,
  auxiliary,
});
table("data/summary/conditions.csv", conditionRows);
table("data/summary/search-curves.csv", curveRows);
table("data/summary/paired-effects.csv", pairedRows);
table("data/summary/quality.csv", quality);
table(
  "data/summary/effects.csv",
  all.effects.map((e) => ({
    cohort: "all",
    key: e.key,
    n: e.n,
    mean: e.mean,
    sd: e.sd,
    ci_low: e.ci?.[0] ?? null,
    ci_high: e.ci?.[1] ?? null,
    p: e.p,
    holm_p: e.adjusted,
  })),
);
console.log(
  JSON.stringify(
    { manifest, effects: all.effects, quality, auxiliary },
    null,
    2,
  ),
);
