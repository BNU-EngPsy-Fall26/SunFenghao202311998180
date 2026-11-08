/* Owner-only cleanup of this release's explicitly synthetic browser QA bucket. */
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, ".."),
  endpoint = "https://attention-lab-production.up.railway.app";
const lines = fs
  .readFileSync(path.join(root, "private/teacher-project.txt"), "utf8")
  .trim()
  .split(/\r?\n/);
const project = lines.join("\n").match(/\b[A-Z0-9]{6}\b/)?.[0];
const key = lines
  .map((x) => x.replace(/^.*[:：]\s*/, "").trim())
  .find((x) => /^[A-Za-z0-9_-]{16,}$/.test(x));
const experiment = "test_attention_browser_v11";
async function request(route, options = {}) {
  const response = await fetch(endpoint + route, {
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  const data = await response.json();
  assert.equal(data.ok, true);
  return data;
}
async function main() {
  assert.ok(key && project, "Private credentials were not recognized");
  const route = `/api/hw2/data?project=${project}&experiment=${experiment}`;
  const before = await request(route);
  assert.ok(
    before.records.every(
      (record) =>
        record.experiment === experiment &&
        record.trials.every(
          (t) =>
            t.mode === "qa" &&
            t.session_id === "QA_BROWSER_CORS" &&
            t.synthetic === true,
        ),
    ),
    "Refusing to delete non-QA data",
  );
  if (before.records.length)
    await request("/api/hw2/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, experiment }),
    });
  assert.equal((await request(route)).records.length, 0);
  const all = await request(`/api/hw2/data?project=${project}`);
  const receipt = {
    checkedAt: new Date().toISOString(),
    project,
    experiment,
    removed: before.records.map((r) => r.record_id),
    remainingInTest: 0,
    remainingInProject: all.records.length,
    syntheticOnly: true,
  };
  const output = path.join(root, "output/platform-check");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    path.join(output, `browser-cleanup-${Date.now()}.json`),
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
}
main().catch((e) => {
  console.error(
    key
      ? String(e.message).split(key).join("[REDACTED]")
      : "Private credentials were not recognized",
  );
  process.exitCode = 1;
});
