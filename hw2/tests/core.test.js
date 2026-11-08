/* 全部为合成单元测试数据，不写入浏览器或老师平台，不作为真实研究记录。 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const C = require("../src/core.js");
function searchRows() {
  return C.SEARCH_MODES.flatMap((variant, i) =>
    C.searchPlan("synthetic", variant, "pilot").map((t) => ({
      ...t,
      phase: "main",
      correct: 1,
      rt: 400 + [3, 30, 15][i] * t.set_size,
      interrupted: false,
      timeout: false,
    })),
  );
}
function graphRows() {
  return C.GRAPH_MODES.flatMap((variant, i) =>
    C.graphPlan("synthetic", variant, "pilot", "P01").map((t) => ({
      ...t,
      phase: "main",
      estimate_pct: t.true_pct + [1, 6, 2][i],
      rt: 1400,
      interrupted: false,
      timeout: false,
    })),
  );
}
test("随机数与试次计划按种子精确重现", () => {
  assert.deepEqual(
    C.searchPlan("seed", "conjunction_original", "pilot"),
    C.searchPlan("seed", "conjunction_original", "pilot"),
  );
  assert.notDeepEqual(
    C.searchPlan("seed", "conjunction_original", "pilot"),
    C.searchPlan("other", "conjunction_original", "pilot"),
  );
});
test("正式搜索为240次，24个条件格各10次", () => {
  let total = 0;
  for (const mode of C.SEARCH_MODES) {
    const plan = C.searchPlan("seed", mode, "formal");
    total += plan.length;
    for (const size of C.SIZES)
      for (const present of [true, false])
        assert.equal(
          plan.filter((t) => t.set_size === size && t.present === present)
            .length,
          10,
        );
  }
  assert.equal(total, 240);
});
test("快速体验搜索24次、判断12次，与300次完整试运行隔离", () => {
  assert.equal(
    C.SEARCH_MODES.flatMap((m) => C.searchPlan("seed", m, "preview")).length,
    24,
  );
  assert.equal(
    C.GRAPH_MODES.flatMap((m) => C.graphPlan("seed", m, "preview", "P01"))
      .length,
    12,
  );
  assert.equal(
    C.GRAPH_MODES.flatMap((m) => C.graphPlan("seed", m, "formal", "P01"))
      .length,
    60,
  );
});
test("搜索刺激的字母数、目标存在性与坐标边界正确", () => {
  for (let seed = 0; seed < 20; seed++)
    for (const variant of C.SEARCH_MODES)
      for (const t of C.searchPlan(String(seed), variant, "pilot")) {
        const { items } = C.searchStimulus(t);
        assert.equal(items.length, t.set_size);
        const targets = items.filter((i) =>
          variant === "feature_original"
            ? i.color === "magenta" || i.letter === "S"
            : i.color === "blue" && i.letter === "T",
        );
        assert.equal(targets.length, t.present ? 1 : 0);
        items.forEach((p) =>
          assert.ok(Math.abs(p.x) < 300 && Math.abs(p.y) < 160),
        );
      }
});
test("原联合/分区联合共享坐标、目标位置、颜色计数和字母集合", () => {
  for (let seed = 0; seed < 10; seed++)
    for (const t of C.searchPlan(
      String(seed),
      "conjunction_original",
      "pilot",
    )) {
      const a = C.searchStimulus(t),
        b = C.searchStimulus({ ...t, variant: "conjunction_grouped" });
      assert.deepEqual(
        a.items.map((i) => [i.x, i.y]),
        b.items.map((i) => [i.x, i.y]),
      );
      assert.equal(a.targetIndex, b.targetIndex);
      assert.deepEqual(
        a.items.map((i) => i.color + i.letter).sort(),
        b.items.map((i) => i.color + i.letter).sort(),
      );
    }
});
test("颜色分区在空间x排序中只有一次颜色边界", () => {
  for (const t of C.searchPlan("grouping", "conjunction_grouped", "pilot")) {
    const items = C.searchStimulus(t)
      .items.slice()
      .sort((a, b) => a.x - b.x || a.y - b.y);
    let changes = 0;
    for (let i = 1; i < items.length; i++)
      if (items[i].color !== items[i - 1].color) changes++;
    assert.ok(changes <= 1);
  }
});
test("特征练习同时包含紫红色和S目标，并含无目标试次", () => {
  const p = C.practicePlan(
    "seed",
    "visual_search",
    "feature_original",
    "pilot",
    "P01",
  );
  const kinds = p.map((t) => C.searchStimulus(t).targetKind);
  assert.ok(kinds.includes("magenta"));
  assert.ok(kinds.includes("shape_S"));
  assert.ok(kinds.includes("none"));
});
test("快速体验特征目标两种各2次，完整协议每种各20次", () => {
  for (const [mode, count] of [
    ["preview", 2],
    ["formal", 20],
  ]) {
    const kinds = C.searchPlan("coverage", "feature_original", mode)
      .filter((t) => t.present)
      .map((t) => C.searchStimulus(t).targetKind);
    assert.equal(kinds.filter((k) => k === "magenta").length, count);
    assert.equal(kinds.filter((k) => k === "shape_S").length, count);
  }
});
test("前10个编号两实验顺序5:5，三条件覆盖六排列且首位接近平衡", () => {
  const a = Array.from({ length: 10 }, (_, i) =>
    C.assignment(`P${String(i + 1).padStart(2, "0")}`),
  );
  assert.equal(a.filter((x) => x.experiments[0] === "visual_search").length, 5);
  for (const exp of ["visual_search", "graphical_judgment"]) {
    assert.equal(new Set(a.map((x) => x[exp].join(","))).size, 6);
    const counts = getCounts(a.map((x) => x[exp][0]));
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
  }
});
function getCounts(a) {
  return [...new Set(a)].map((v) => a.filter((x) => x === v).length);
}
test("2000组图形族均满足原文范围、总和、值间差，且三版本不重复", () => {
  for (let i = 0; i < 2000; i++) {
    const family = C.graphFamily(i);
    assert.equal(new Set(family.map((x) => JSON.stringify(x.values))).size, 3);
    for (const t of family) {
      assert.ok(C.validValues(t.values));
      assert.equal(t.values[t.reference], Math.max(...t.values));
      assert.ok(t.true_pct > 0 && t.true_pct < 100);
      assert.ok(
        Math.abs(
          t.true_pct - (100 * t.values[t.target]) / t.values[t.reference],
        ) < 1e-8,
      );
    }
    assert.ok(Math.abs(family[0].true_pct - family[2].true_pct) < 1e-8);
  }
});
test("图形各模式20次、目标大小排序平衡，比率分布相同，五值不完全重复", () => {
  for (const id of ["P01", "P02", "P03"]) {
    const plans = C.GRAPH_MODES.map((m) =>
      C.graphPlan("seed", m, "formal", id),
    );
    plans.forEach((p) => {
      assert.equal(p.length, 20);
      for (let rank = 0; rank < 4; rank++)
        assert.equal(p.filter((t) => t.targetRank === rank).length, 5);
    });
    const sets = plans.map((p) =>
      p.slice().sort((a, b) => a.family.localeCompare(b.family)),
    );
    for (let i = 0; i < 20; i++) {
      assert.ok(Math.abs(sets[0][i].true_pct - sets[1][i].true_pct) < 1e-8);
      assert.notDeepEqual(sets[0][i].values, sets[1][i].values);
    }
  }
});
test("线性搜索斜率及两个主效应使用个人RT格均值", () => {
  const s = C.summarizeSearch(searchRows());
  assert.equal(s.variants.feature_original.slope, 3);
  assert.equal(s.variants.conjunction_original.slope, 30);
  assert.equal(s.effects["S-R"], 27);
  assert.equal(s.effects["S-I"], 15);
});
test("RT清洗保留错误率，条件格不足8个正确有效反应时不算主斜率", () => {
  const rows = searchRows();
  let changed = 0;
  for (const r of rows)
    if (
      r.variant === "feature_original" &&
      r.set_size === 30 &&
      r.present &&
      changed++ < 3
    ) {
      r.correct = 0;
    }
  const s = C.summarizeSearch(rows);
  assert.equal(s.variants.feature_original.slope, null);
  assert.equal(s.effects["S-R"], null);
  assert.ok(s.accuracy < 1);
  assert.equal(rows.length, 240);
  assert.equal(C.validRT({ rt: 149, correct: 1 }), false);
  assert.equal(C.validRT({ rt: 300, correct: 1, interrupted: true }), false);
});
test("低准确率主效应无效；不存在试次不混入目标存在主斜率", () => {
  const rows = searchRows();
  rows.forEach((r) => {
    if (!r.present) r.rt = 4500;
  });
  assert.equal(C.summarizeSearch(rows).effects["S-R"], 27);
  rows.forEach((r, i) => (r.correct = i % 2));
  assert.equal(C.summarizeSearch(rows).effects["S-R"], null);
});
test("log误差使用百分点+0.125，完美判断可为负", () => {
  assert.equal(C.logError(50, 50), -3);
  assert.equal(C.logError(51, 50), Math.log2(1.125));
  assert.equal(C.logError(null, 50), null);
});
test("图形主效应和16次阈值计算正确；不因误差大而删记录", () => {
  const rows = graphRows(),
    s = C.summarizeGraph(rows);
  assert.ok(
    Math.abs(s.effects["G-R"] - (Math.log2(6.125) - Math.log2(1.125))) < 1e-9,
  );
  assert.ok(s.effects["G-I"] > 0);
  let changed = 0;
  rows.forEach((t) => {
    if (t.variant === "pie_original" && changed++ < 5) t.interrupted = true;
  });
  assert.equal(C.summarizeGraph(rows).effects["G-R"], null);
});
test("按编号保留首次完整会话，半途退出、预览和试运行不混入正式", () => {
  const session = (id, mode, complete, date) => ({
    id,
    participant: "P01",
    mode,
    protocol: C.PROTOCOL,
    createdAt: date,
    tasks: { visual_search: { trials: searchRows(), complete } },
  });
  const a = session("a", "formal", false, "2026-10-01"),
    b = session("b", "formal", true, "2026-10-02"),
    c = session("c", "formal", true, "2026-10-03"),
    d = session("d", "preview", true, "2026-09-01");
  assert.deepEqual(
    C.firstComplete([a, b, c, d], "visual_search", "formal").map((s) => s.id),
    ["b"],
  );
  assert.equal(C.groupSummary([d], "formal").searchN, 0);
  assert.equal(
    C.groupSummary([{ ...b, protocol: "attention-v1.0" }], "formal").searchN,
    0,
  );
});
test("bootstrap可复现；单人不制造置信区间；符号翻转与Holm正确", () => {
  assert.equal(C.interval([1]), null);
  assert.deepEqual(
    C.interval([1, 2, 3, 4], "fixed"),
    C.interval([1, 2, 3, 4], "fixed"),
  );
  assert.equal(C.signFlip([1, 1, 1, 1]), null);
  assert.equal(C.signFlip([1, 1, 1, 1, 1]), 0.0625);
  assert.equal(C.signFlip(Array(10).fill(1)), 0.001953125);
  assert.deepEqual(C.holm([0.001, 0.01, 0.03, 0.2]), [0.004, 0.03, 0.06, 0.2]);
  assert.deepEqual(C.holm([0.01, null, 0.02, null]), [0.04, null, 0.06, null]);
});

test("平台可从试次标记读取协议/模式，排除未知和非正式记录，不依赖顶层meta", () => {
  const trial = {
    protocol: C.PROTOCOL,
    mode: "formal",
    session_id: "synthetic-session",
    variant: "bar_original",
    estimate_pct: 50,
    true_pct: 52,
  };
  const good = {
    participant: "P01",
    experiment: "graphical_judgment",
    created_at: "2026-10-28",
    trials: [trial],
  };
  const pilot = {
    ...good,
    participant: "QA_PILOT",
    trials: [{ ...trial, mode: "pilot" }],
  };
  const unknown = {
    ...good,
    participant: "P03",
    trials: [{ ...trial, protocol: "unknown" }],
  };
  const mixed = {
    ...good,
    participant: "P04",
    trials: [trial, { ...trial, mode: "preview" }],
  };
  const out = C.remoteRecordsToSessions([good, pilot, unknown, mixed]);
  assert.equal(out.length, 1);
  assert.equal(out[0].participant, "P01");
  assert.equal(out[0].tasks.graphical_judgment.trials.length, 1);
  assert.equal(
    C.remoteRecordsToSessions([
      {
        ...good,
        meta: JSON.stringify({ protocol: C.PROTOCOL, mode: "formal" }),
      },
    ]).length,
    1,
  );
});
test("群体汇总以10个人而非2400个试次为N", () => {
  const sessions = Array.from({ length: 10 }, (_, i) => ({
    id: `test-${i}`,
    participant: `P${i}`,
    mode: "formal",
    protocol: C.PROTOCOL,
    createdAt: `2026-10-${String(i + 1).padStart(2, "0")}`,
    tasks: {
      visual_search: { complete: true, trials: searchRows() },
      graphical_judgment: { complete: true, trials: graphRows() },
    },
  }));
  const group = C.groupSummary(sessions);
  assert.equal(group.searchN, 10);
  assert.equal(group.graphN, 10);
  assert.ok(group.effects.every((e) => e.n === 10 && e.mean > 0));
});
test("CSV保留中文/逗号/引号并防止文本公式执行，不更改负数指标", () => {
  const csv = C.csv([
    { participant: '=HYPERLINK("x")', rt: 300, effect: -2, note: '中文,引号"' },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"-2"'));
  assert.ok(csv.includes('中文,引号""'));
});
test("入口引用均为本地文件，老师模板保持原始哈希，开放时必须配置真实预登记", () => {
  const root = path.join(__dirname, ".."),
    html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  for (const [, file] of html.matchAll(
    /(?:src|href)="((?:src|assets)\/[^"#]+)"/g,
  ))
    assert.ok(fs.existsSync(path.join(root, file)), file);
  assert.ok(!/https?:\/\//.test(html));
  const template = fs.readFileSync(
    path.join(root, "references/teacher/hw2_template.html"),
  );
  assert.equal(
    crypto.createHash("sha256").update(template).digest("hex"),
    "67f1a8d4668b29ccf1a68f801a8396bc1cbdfdbfe741fa10d6a00d6ef1337209",
  );
  const context = {};
  require("node:vm").runInNewContext(
    fs.readFileSync(path.join(root, "src/config.js"), "utf8"),
    context,
  );
  const cfg = context.LAB_CONFIG;
  assert.equal(cfg.protocol, C.PROTOCOL);
  assert.equal(cfg.recruitmentTarget, 5);
  if (cfg.collectionEnabled) {
    assert.match(cfg.project, /^[A-Z0-9]{6}$/);
    assert.match(cfg.preregistrationCommit, /^[a-f0-9]{40}$/);
  }
});
test("平台警告和结构化改写保留；截断与普通转换分开", () => {
  const warning = C.submissionReceipt({
    record_id: 4,
    warnings: ["field changed"],
    warning_details: [
      { field: "values", kind: "array_truncated", n_trials: 2 },
    ],
  });
  assert.equal(warning.status, "uploaded");
  assert.equal(warning.needsReview, true);
  assert.equal(warning.possibleDataLoss, true);
  assert.equal(warning.warning_details[0].n_trials, 2);
  assert.equal(
    C.submissionReceipt({ warning_details: [{ kind: "converted_to_json" }] })
      .possibleDataLoss,
    false,
  );
  assert.equal(C.submissionReceipt({ record_id: 5 }).needsReview, false);
});
