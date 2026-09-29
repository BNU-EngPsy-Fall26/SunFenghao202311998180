"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SDT = require("../js/sdt.js");

const root = path.resolve(__dirname, "..");
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

function approx(actual, expected, tolerance = 1e-3) {
  assert.ok(Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`);
}

test("inverse normal returns expected common quantiles", () => {
  approx(SDT.inverseNormalCDF(0.5), 0, 1e-7);
  approx(SDT.inverseNormalCDF(0.975), 1.95996, 1e-4);
  approx(SDT.inverseNormalCDF(0.025), -1.95996, 1e-4);
});

test("all-yes pattern produces d-prime 0 and a liberal criterion", () => {
  const stats = SDT.calculateStats({ hits: 10, misses: 0, falseAlarms: 10, correctRejections: 0 });
  approx(stats.dPrime, 0, 1e-9);
  assert.ok(stats.criterion < -1.6);
  approx(stats.accuracy, 0.5, 1e-9);
});

test("perfect observed performance remains finite after log-linear correction", () => {
  const stats = SDT.calculateStats({ hits: 10, misses: 0, falseAlarms: 0, correctRejections: 10 });
  assert.ok(Number.isFinite(stats.dPrime));
  assert.ok(stats.dPrime > 3.2 && stats.dPrime < 3.5);
  approx(stats.criterion, 0, 1e-9);
});

test("chance performance gives d-prime 0 and neutral criterion", () => {
  const stats = SDT.calculateStats({ hits: 5, misses: 5, falseAlarms: 5, correctRejections: 5 });
  approx(stats.dPrime, 0, 1e-9);
  approx(stats.criterion, 0, 1e-9);
  approx(stats.auc, 0.5, 1e-6);
});

test("known asymmetric counts calculate coherent rates and criterion", () => {
  const stats = SDT.calculateStats({ hits: 8, misses: 2, falseAlarms: 2, correctRejections: 8 });
  approx(stats.hitRate, 0.8, 1e-9);
  approx(stats.falseAlarmRate, 0.2, 1e-9);
  assert.ok(stats.dPrime > 1.45 && stats.dPrime < 1.55);
  approx(stats.criterion, 0, 1e-9);
});

test("trial plan has exact length and fixed rounded signal prevalence", () => {
  let n = 0;
  const deterministic = () => ((n += 1) % 10) / 10;
  const trials = SDT.buildTrialPlan(30, 0.3, deterministic);
  assert.equal(trials.length, 30);
  assert.equal(trials.filter((trial) => trial.signal).length, 9);
});

test("projected rates trade off when criterion becomes stricter", () => {
  const liberal = SDT.projectedRates(1.6, -0.8);
  const strict = SDT.projectedRates(1.6, 0.8);
  assert.ok(liberal.hitRate > strict.hitRate);
  assert.ok(liberal.falseAlarmRate > strict.falseAlarmRate);
});

test("all four decisions map to the exact statistics field names", () => {
  assert.equal(SDT.classifyOutcome(true, true), "hits");
  assert.equal(SDT.classifyOutcome(true, false), "misses");
  assert.equal(SDT.classifyOutcome(false, true), "falseAlarms");
  assert.equal(SDT.classifyOutcome(false, false), "correctRejections");
});

test("invalid counts fail loudly instead of generating misleading metrics", () => {
  assert.throws(() => SDT.calculateStats({ hits: -1, misses: 2, falseAlarms: 1, correctRejections: 2 }));
  assert.throws(() => SDT.calculateStats({ hits: 0, misses: 0, falseAlarms: 1, correctRejections: 2 }));
});

test("all local files referenced by index.html exist", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith("#"));
  references.forEach((reference) => {
    assert.ok(!/^https?:/i.test(reference), `external dependency found: ${reference}`);
    assert.ok(fs.existsSync(path.join(root, reference)), `missing local dependency: ${reference}`);
  });
});

test("rubric terms and at least 20 trials are visible in the project", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ["击中 H", "漏报 M", "误报 FA", "正确拒斥 CR", "P(H)", "P(FA)", "d′", "准确率"]
    .forEach((term) => assert.ok(html.includes(term), `missing rubric term: ${term}`));
  assert.match(html, /试次数<\/dt><dd>30/);
});

test("source contains no copied teacher role names or institutional branding", () => {
  const files = ["index.html", "css/styles.css", "js/app.js", "js/game.js"];
  const source = files.map((file) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  ["雷达哨兵", "影像科医生", "安检员", "北京师范大学心理学部"]
    .forEach((term) => assert.ok(!source.includes(term), `reference-site wording found: ${term}`));
});

console.log(`\n${passed} tests passed.`);
