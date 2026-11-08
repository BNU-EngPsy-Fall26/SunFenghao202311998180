(function (root) {
  "use strict";
  const C = root.LabCore;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "—");
  function shell(title, body, width = 670, height = 320) {
    return `<svg class="research-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title><rect width="100%" height="100%" fill="white"/>${body}</svg>`;
  }
  function empty(label) {
    return `<div class="chart-empty"><span>＋</span><p>${esc(label)}</p></div>`;
  }
  function lines(rows) {
    if (!rows.length) return empty("完成实验后，这里展示反应时间曲线");
    const data = C.SEARCH_MODES.map((variant) => ({
      variant,
      points: C.SIZES.map((size) => ({
        size,
        rt: C.mean(
          rows.map(
            (row) =>
              row.variants[variant].curve.find((p) => p.size === size)?.rt,
          ),
        ),
      })),
    }));
    const max =
        Math.max(500, ...data.flatMap((d) => d.points.map((p) => p.rt || 0))) *
        1.15,
      left = 70,
      right = 635,
      top = 25,
      bottom = 245,
      x = (s) => left + ((s - 1) / 29) * (right - left),
      y = (v) => bottom - (v / max) * (bottom - top);
    let body = "";
    for (let i = 0; i <= 4; i++) {
      const value = (max * i) / 4,
        yy = y(value);
      body += `<line x1="${left}" x2="${right}" y1="${yy}" y2="${yy}" stroke="#e6e9e7"/><text x="${left - 12}" y="${yy + 4}" text-anchor="end">${Math.round(value)}</text>`;
    }
    C.SIZES.forEach(
      (size) =>
        (body += `<text x="${x(size)}" y="267" text-anchor="middle">${size}</text>`),
    );
    body += `<text x="16" y="16">RT / ms</text><text x="355" y="309" text-anchor="middle">集合大小 / 项</text>`;
    data.forEach((d, i) => {
      const pts = d.points.filter((p) => Number.isFinite(p.rt));
      body += `<polyline points="${pts.map((p) => `${x(p.size)},${y(p.rt)}`).join(" ")}" fill="none" stroke="${C.COLORS[d.variant]}" stroke-width="2.4" ${i === 1 ? 'stroke-dasharray="6 4"' : ""}/>`;
      pts.forEach(
        (p) =>
          (body += `<circle cx="${x(p.size)}" cy="${y(p.rt)}" r="4" fill="${C.COLORS[d.variant]}"/>`),
      );
    });
    return shell("目标存在试次的反应时间随集合大小变化", body);
  }
  function paired(rows, kind) {
    if (!rows.length) return empty("完成实验后，这里展示个人与条件的比较");
    const modes = kind === "search" ? C.SEARCH_MODES : C.GRAPH_MODES,
      field = kind === "search" ? "slope" : "log",
      values = rows
        .flatMap((r) => modes.map((m) => r.variants[m][field]))
        .filter(Number.isFinite);
    if (!values.length) return empty("有效试次数不足，暂不能估计主指标");
    const min = Math.min(0, ...values),
      max = Math.max(...values),
      pad = Math.max((max - min) * 0.15, kind === "search" ? 3 : 0.4),
      lo = min - pad,
      hi = max + pad,
      top = 25,
      bottom = 240,
      x = (i) => 125 + i * 210,
      y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    let body = "";
    for (let i = 0; i <= 4; i++) {
      const value = lo + ((hi - lo) * i) / 4,
        yy = y(value);
      body += `<line x1="65" x2="635" y1="${yy}" y2="${yy}" stroke="#e6e9e7"/><text x="52" y="${yy + 4}" text-anchor="end">${f(value)}</text>`;
    }
    body += `<text x="14" y="15">${kind === "search" ? "斜率 / ms·item⁻¹" : "log₂ 绝对误差"}</text>`;
    rows.forEach((r, index) => {
      const vals = modes.map((m) => r.variants[m][field]),
        jitter = ((index % 7) - 3) * 2;
      if (vals.every(Number.isFinite))
        body += `<polyline points="${vals.map((v, i) => `${x(i) + jitter},${y(v)}`).join(" ")}" fill="none" stroke="#bcc5c0" opacity=".6"/>`;
      vals.forEach((v, i) => {
        if (Number.isFinite(v))
          body += `<circle cx="${x(i) + jitter}" cy="${y(v)}" r="3" fill="${C.COLORS[modes[i]]}" opacity=".6"><title>${esc(r.participant)}：${f(v)}</title></circle>`;
      });
    });
    modes.forEach((m, i) => {
      const vals = rows
          .map((r) => r.variants[m][field])
          .filter(Number.isFinite),
        avg = C.mean(vals),
        ci = C.interval(vals, m, 1200);
      if (ci)
        body += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(ci[0])}" y2="${y(ci[1])}" stroke="${C.COLORS[m]}" stroke-width="2"/>`;
      if (Number.isFinite(avg))
        body += `<circle cx="${x(i)}" cy="${y(avg)}" r="6" fill="${C.COLORS[m]}" stroke="white" stroke-width="2"/>`;
      body += `<text x="${x(i)}" y="272" text-anchor="middle">${esc(C.NAMES[m])}</text>`;
    });
    return shell(
      kind === "search"
        ? "个人搜索斜率及条件均值"
        : "个人图形判断误差及条件均值",
      body,
    );
  }
  function legend(modes) {
    return `<div class="chart-legend">${modes.map((m) => `<span><i style="background:${C.COLORS[m]}"></i>${C.NAMES[m]}</span>`).join("")}</div>`;
  }
  root.LabCharts = { esc, f, lines, paired, legend };
})(window);
