/* Owner-only integration check. All synthetic records use test_ names and are removed. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const C = require("../src/core.js");
const root = path.resolve(__dirname, ".."),
  base = "https://attention-lab-production.up.railway.app";
const lines = fs
  .readFileSync(path.join(root, "private/teacher-project.txt"), "utf8")
  .trim()
  .split(/\r?\n/);
const project = lines.join("\n").match(/\b[A-Z0-9]{6}\b/)?.[0];
const key = lines
  .map((line) => line.replace(/^.*[:：]\s*/, "").trim())
  .find((line) => /^[A-Za-z0-9_-]{16,}$/.test(line));
if (!project || !key)
  throw Error(
    "Private project file format not recognized; contents were not printed.",
  );
const output = path.join(root, "output/platform-check");
fs.mkdirSync(output, { recursive: true });
async function request(route, options = {}) {
  const response = await fetch(base + route, {
    ...options,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(`Platform returned HTTP ${response.status}`);
  return response;
}
async function records(experiment) {
  const data = await (
    await request(
      `/api/hw2/data?project=${project}${experiment ? `&experiment=${experiment}` : ""}`,
    )
  ).json();
  assert.equal(data.ok, true);
  return data.records;
}
function parseCSV(text) {
  const rows = [],
    row = [];
  let cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push([...row]);
      row.length = 0;
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
  return rows;
}
const tests = [
  [
    "test_attention_search_v11",
    C.SEARCH_MODES.flatMap((variant) =>
      C.searchPlan("QA_PLATFORM", variant, "formal").map((t, i) => ({
        phase: "qa",
        protocol: C.PROTOCOL,
        mode: "qa",
        session_id: "QA_PLATFORM_SEARCH",
        variant,
        trial_index: i + 1,
        variant_trial: i + 1,
        seed: t.seed,
        family: t.family,
        rt: 400 + t.set_size * 12,
        interrupted: false,
        timeout: false,
        set_size: t.set_size,
        present: t.present,
        response: t.present ? "yes" : "no",
        correct: 1,
        target_kind: C.searchStimulus(t).targetKind,
        palette: C.SEARCH_PALETTE.id,
        color_check: "synthetic_qa",
        group_side:
          variant === "conjunction_grouped"
            ? C.searchStimulus(t).side
            : "mixed",
      })),
    ),
  ],
  [
    "test_attention_graph_v11",
    C.GRAPH_MODES.flatMap((variant) =>
      C.graphPlan("QA_PLATFORM", variant, "formal", "QA_PLATFORM_01").map(
        (t, i) => ({
          phase: "qa",
          protocol: C.PROTOCOL,
          mode: "qa",
          session_id: "QA_PLATFORM_GRAPH",
          variant,
          trial_index: i + 1,
          variant_trial: i + 1,
          seed: t.seed,
          family: t.family,
          rt: 1400,
          interrupted: false,
          timeout: false,
          estimate_pct: t.true_pct + 2,
          true_pct: t.true_pct,
          values: t.values,
          display_order: t.order,
          dataset_id: t.dataset_id,
          target: t.target,
          reference: t.reference,
          log_error: C.logError(t.true_pct + 2, t.true_pct),
        }),
      ),
    ),
  ],
];
async function main() {
  const baseline = await records();
  for (const [experiment] of tests)
    assert.equal(
      (await records(experiment)).length,
      0,
      "Test experiment already contains records; will not overwrite them.",
    );
  const receipt = {
    project,
    checkedAt: new Date().toISOString(),
    synthetic: true,
    submissions: [],
    baselineRecords: baseline.length,
  };
  const created = [];
  try {
    for (const [experiment, trials] of tests) {
      created.push(experiment);
      const payload = {
        project,
        experiment,
        participant: "QA_PLATFORM_ONLY",
        condition: "synthetic_qa",
        trials,
        meta: { mode: "qa", protocol: C.PROTOCOL, synthetic: true },
      };
      assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 256 * 1024);
      const accepted = await (
        await request("/api/hw2/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      ).json();
      assert.equal(accepted.ok, true);
      assert.equal(
        (accepted.warnings || []).length,
        0,
        "Platform returned field warnings.",
      );
      assert.equal((accepted.warning_details || []).length, 0);
      const returned = await records(experiment);
      assert.equal(returned.length, 1);
      assert.deepEqual(
        returned[0].trials,
        trials,
        "Anonymous JSON changed trial values.",
      );
      receipt.submissions.push({
        experiment,
        trials: trials.length,
        bytes: Buffer.byteLength(JSON.stringify(payload)),
        record_id: accepted.record_id,
        warnings: 0,
        jsonExact: true,
      });
    }
    const csvText = await (
      await request(`/api/hw2/export?key=${encodeURIComponent(key)}&format=csv`)
    ).text();
    fs.writeFileSync(path.join(output, "synthetic-check.csv"), csvText);
    const [headers, ...rows] = parseCSV(csvText);
    assert.deepEqual(headers.slice(0, 6), [
      "record_id",
      "created_at",
      "experiment",
      "condition",
      "participant",
      "trial_index",
    ]);
    for (const [experiment, trials] of tests) {
      const actual = rows.filter(
        (row) => row[headers.indexOf("experiment")] === experiment,
      );
      assert.equal(actual.length, trials.length);
      actual.forEach((row, i) => {
        for (const [field, value] of Object.entries(trials[i])) {
          const column = headers.indexOf(
            headers.slice(0, 6).includes(field) ? `trial.${field}` : field,
          );
          assert.ok(column >= 0, `CSV field missing: ${field}`);
          const raw = row[column];
          if (Array.isArray(value)) assert.deepEqual(JSON.parse(raw), value);
          else if (typeof value === "number") assert.equal(Number(raw), value);
          else if (typeof value === "boolean")
            assert.ok(
              value
                ? /^(true|True|1)$/.test(raw)
                : /^(false|False|0)$/.test(raw),
            );
          else assert.equal(raw, value);
        }
      });
    }
    receipt.csvExact = true;
  } finally {
    for (const experiment of created) {
      const removed = await (
        await request("/api/hw2/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, experiment }),
        })
      ).json();
      assert.equal(removed.ok, true, "Test cleanup failed.");
      assert.equal((await records(experiment)).length, 0);
    }
    receipt.testRecordsRemoved = true;
    receipt.finalRecords = (await records()).length;
    assert.equal(
      receipt.finalRecords,
      baseline.length,
      "Platform count differs from initial state after QA cleanup.",
    );
    fs.writeFileSync(
      path.join(output, "receipt.json"),
      JSON.stringify(receipt, null, 2),
    );
    console.log(JSON.stringify(receipt));
  }
}
main().catch((error) => {
  console.error(String(error.message).split(key).join("[REDACTED]"));
  process.exitCode = 1;
});
