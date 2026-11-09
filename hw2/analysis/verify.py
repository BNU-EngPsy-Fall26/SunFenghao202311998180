"""Independent CSV/JSON and numerical audit; never uploads or changes raw data."""
from pathlib import Path
import csv
import hashlib
import itertools
import json
import math
import statistics

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/final-2026-11-09"
data = json.loads((RAW / "hw2_W2UGHD_2026-11-09_194056.json").read_text("utf-8"))
summary = json.loads((ROOT / "data/summary/analysis.json").read_text("utf-8"))
with (RAW / "hw2_W2UGHD_2026-11-09_194054.csv").open(encoding="utf-8-sig", newline="") as f:
    rows = list(csv.DictReader(f))
lookup = {(int(r["record_id"]), int(r["trial_index"])): r for r in rows}
assert len(lookup) == len(rows) == 1500
checked_fields = 0
for record in data["records"]:
    for i, trial in enumerate(record["trials"], 1):
        row = lookup[(record["record_id"], i)]
        for key in ("experiment", "condition", "participant", "created_at"):
            assert row[key] == record[key], (record["record_id"], i, key)
        if i == 1:
            assert json.loads(row["meta"]) == record["meta"]
        else:
            assert row["meta"] == ""  # Teacher export writes meta once per record.
        for key, value in trial.items():
            text = row["trial.trial_index" if key == "trial_index" else key]
            if value is None:
                assert text == ""
            elif isinstance(value, bool):
                assert text.lower() == str(value).lower()
            elif isinstance(value, (int, float)):
                assert math.isclose(float(text), value, abs_tol=1e-12, rel_tol=1e-12)
            elif isinstance(value, (dict, list)):
                assert json.loads(text) == value
            else:
                assert text == value
            checked_fields += 1

close = lambda a, b: math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-10)
conditions = {(r["participant"], r["variant"]): r for r in summary["conditionRows"]}
curves = {(r["participant"], r["variant"], r["size"]): r
          for r in summary["curveRows"] if r["present"]}
effect_values = {key: {} for key in ("S-R", "S-I", "G-R", "G-I")}
bad_cells = []
for record in data["records"]:
    p = record["participant"]
    variants = sorted({t["variant"] for t in record["trials"]})
    metrics = {}
    accuracy = sum(t.get("correct", 0) for t in record["trials"]
                   if not t["interrupted"]) / len(
                       [t for t in record["trials"] if not t["interrupted"]])
    for variant in variants:
        a = [t for t in record["trials"] if t["variant"] == variant]
        observed = conditions[(p, variant)]
        if record["experiment"] == "visual_search":
            valid = [t for t in a if not t["interrupted"] and not t["timeout"]
                     and t["correct"] == 1 and t["rt"] is not None
                     and 150 <= t["rt"] <= 5000]
            means = []
            counts = []
            sizes = (1, 5, 15, 30)
            for size in sizes:
                ts = [t for t in valid if t["present"] and t["set_size"] == size]
                means.append(statistics.mean(t["rt"] for t in ts))
                counts.append(len(ts))
                assert curves[(p, variant, size)]["n"] == len(ts)
                assert close(curves[(p, variant, size)]["rt"], means[-1])
                if len(ts) < 8:
                    bad_cells.append({"participant": p, "variant": variant,
                                      "set_size": size, "valid_correct": len(ts)})
            mx, my = statistics.mean(sizes), statistics.mean(means)
            b = sum((x-mx)*(y-my) for x, y in zip(sizes, means)) / sum(
                (x-mx)**2 for x in sizes)
            metrics[variant] = b if min(counts) >= 8 and accuracy >= .6 else None
            if observed["metric"] is None:
                assert min(counts) < 8 or accuracy < .6
            else:
                assert close(observed["metric"], metrics[variant])
            assert close(observed["accuracy"],
                         sum(t["correct"] for t in a if not t["interrupted"]) /
                         len([t for t in a if not t["interrupted"]]))
        else:
            valid = [t for t in a if not t["interrupted"] and not t["timeout"]
                     and t["estimate_pct"] is not None and 0 <= t["estimate_pct"] <= 100]
            metric = statistics.mean(math.log2(abs(t["estimate_pct"] - t["true_pct"]) + .125)
                                     for t in valid)
            metrics[variant] = metric if len(valid) >= 16 else None
            assert close(observed["metric"], metric)
            assert close(observed["mae"],
                         statistics.mean(abs(t["estimate_pct"] - t["true_pct"]) for t in valid))
        assert close(observed["rt"], statistics.mean(t["rt"] for t in valid))
    for key, left, right in (
        ("S-R", "conjunction_original", "feature_original"),
        ("S-I", "conjunction_original", "conjunction_grouped"),
        ("G-R", "pie_original", "bar_original"),
        ("G-I", "pie_original", "pie_aligned_aid"),
    ):
        if left in metrics and right in metrics and metrics[left] is not None and metrics[right] is not None:
            effect_values[key][p] = metrics[left] - metrics[right]

# Port the frozen RNG to cross-check all bootstrap interval endpoints.
MASK = 0xffffffff
def rng(text):
    h = 2166136261
    for ch in text:
        h = ((h ^ ord(ch)) * 16777619) & MASK
    s = h
    while True:
        s = (s + 0x6d2b79f5) & MASK
        t = ((s ^ (s >> 15)) * (s | 1)) & MASK
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & MASK)) & MASK)) & MASK
        yield ((t ^ (t >> 14)) & MASK) / 4294967296

def quantile(a, p):
    a = sorted(a)
    pos = (len(a)-1)*p
    lo, hi = math.floor(pos), math.ceil(pos)
    return a[lo] + (a[hi]-a[lo])*(pos-lo)

ps = []
for e in summary["all"]["effects"]:
    values = [effect_values[e["key"]][p] for p in e["participants"]]
    assert len(values) == e["n"]
    assert all(close(a, b) for a, b in zip(values, e["values"]))
    assert close(statistics.mean(values), e["mean"])
    assert close(statistics.stdev(values), e["sd"])
    gen = rng(e["key"])
    draws = [statistics.mean(values[int(next(gen)*len(values))]
                             for _ in values) for _ in range(2500)]
    assert all(close(a, b) for a, b in zip(
        [quantile(draws, .025), quantile(draws, .975)], e["ci"]))
    if len(values) >= 5:
        observed = abs(sum(values))
        perm = [abs(sum(x*s for x, s in zip(values, signs)))
                for signs in itertools.product((-1, 1), repeat=len(values))]
        pval = sum(x >= observed-1e-9 for x in perm) / len(perm)
        assert pval == e["p"]
    else:
        assert e["p"] is None
    ps.append(e["p"])
last = 0
for rank, (i, p) in enumerate(sorted(((i, p) for i, p in enumerate(ps) if p is not None),
                                    key=lambda x: x[1])):
    last = max(last, min(1, p*(4-rank)))
    assert close(last, summary["all"]["effects"][i]["adjusted"])
for file in summary["manifest"]["files"]:
    assert hashlib.sha256((RAW / file["name"]).read_bytes()).hexdigest() == file["sha256"]
result = {
    "status": "pass", "csv_rows": len(rows), "json_records": len(data["records"]),
    "trial_fields_compared": checked_fields,
    "csv_json_mismatches": 0, "bad_search_cells": bad_cells,
    "independent_statistics": "means, slopes, SD, 2500-draw CI, exact sign flip, four-test Holm",
    "note": "Integrity checks establish file agreement, not independent verification of participant identity.",
}
(ROOT / "data/summary/verification.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
