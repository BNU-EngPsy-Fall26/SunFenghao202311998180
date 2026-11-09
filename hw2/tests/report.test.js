const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const C = require("../src/core.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const data = JSON.parse(read("data/summary/analysis.json"));

test("固定快照统一纳入五人，完成N和有效N不混淆", () => {
  assert.equal(data.manifest.participants, 5);
  assert.equal(data.manifest.trial_count, 1500);
  assert.deepEqual(data.manifest.participant_ids, [
    "P01", "P02", "P03", "P04", "P05",
  ]);
  assert.deepEqual(
    data.all.effects.map((e) => e.n),
    [2, 2, 5, 5],
  );
  assert.equal(new Set(data.conditionRows.map((r) => r.participant)).size, 5);
  assert.ok(data.pairedRows.every((r) => r.cohort === "all"));
  assert.ok(!("ontime" in data) && !("late" in data));
  assert.deepEqual(
    data.all.effects.map((e) => e.mean),
    [
      30.540972360903073,
      22.234892036944576,
      1.0407048859896926,
      1.224056029297706,
    ],
  );
});
test("两项可检验p仍属于四项Holm族，不缩小检验族", () => {
  assert.deepEqual(C.holm([null, null, 0.0625, 0.0625]), [
    null,
    null,
    0.25,
    0.25,
  ]);
  for (const e of data.all.effects) {
    assert.equal(e.mean, C.mean(e.values));
    assert.deepEqual(e.ci, C.interval(e.values, e.key));
  }
});
test("公开汇总不包含会话、设备、密钥或原始逐试次记录", () => {
  const text = read("data/summary/analysis.json") + read("src/final-report.js");
  assert.doesNotMatch(
    text,
    /session_id|userAgent|recovery_reason|download_key|"trials"\s*:\s*\[/,
  );
  assert.doesNotMatch(
    text,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  );
  assert.equal(
    JSON.parse(read("data/summary/verification.json")).csv_json_mismatches,
    0,
  );
});
test("固定报告本机无数据也可阅读，图件和下载链接存在", () => {
  const ctx = { window: {} };
  vm.runInNewContext(read("src/final-report.js"), ctx);
  assert.equal(ctx.window.LAB_FINAL_REPORT.verified, true);
  for (const file of ["report/index.html", "src/final-report.js"]) {
    const html = file.endsWith(".js")
      ? ctx.window.LAB_FINAL_REPORT.body
      : read(file);
    assert.match(html, /搜索主分析/);
    assert.match(html, /最终导出的P01–P05作为同一研究样本/);
    assert.doesNotMatch(html, /截止前|截止后|补充分析|延期|迟交|扩展快照/);
    assert.match(html, /0\.250/);
    assert.match(html, /2026年11月10日课程提交版/);
    assert.doesNotMatch(html, /待作者审阅稿|尚未作为最终版本提交/);
    assert.equal((html.match(/<img /g) || []).length, 5);
    for (const [, target] of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
      if (/^https?:|^javascript:/.test(target)) continue;
      const resolved = path.resolve(
        root,
        file.endsWith(".js") ? "" : "report",
        target.split("#")[0],
      );
      assert.ok(fs.existsSync(resolved), `Missing report link: ${target}`);
    }
    assert.doesNotMatch(html, /不是[^。！？]{0,100}而是|赋能|抓手|综上所述/);
  }
});
test("提交阅读材料有完整PDF，README首行给出公开实验与报告入口", () => {
  const pdf = fs.readFileSync(path.join(root, "report/research-report.pdf"));
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 20000);
  const firstLine = read("README.md").split(/\r?\n/)[0];
  assert.match(firstLine, /https:\/\/bnu-engpsy-fall26\.github\.io\/SunFenghao202311998180\/hw2\//);
  assert.match(firstLine, /\/hw2\/report\//);
  assert.ok(fs.existsSync(path.join(root, "docs/10_课程要求与最终提交核查.md")));
});
