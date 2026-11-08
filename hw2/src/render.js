/* 刺激全部本地绘制；实验画布内没有动画、鼠标提示或答案数字。 */
(function (root) {
  "use strict";
  function context(canvas, height = 420) {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = 800 * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 800, height);
    return ctx;
  }
  function fixation(canvas) {
    const ctx = context(canvas);
    ctx.strokeStyle = "#596460";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(390, 210);
    ctx.lineTo(410, 210);
    ctx.moveTo(400, 200);
    ctx.lineTo(400, 220);
    ctx.stroke();
  }
  function search(canvas, trial) {
    const ctx = context(canvas),
      stim = root.LabCore.searchStimulus(trial),
      colors = root.LabCore.SEARCH_PALETTE;
    ctx.font = '600 34px "Arial", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const item of stim.items) {
      ctx.fillStyle = colors[item.color];
      ctx.fillText(item.letter, 400 + item.x, 210 + item.y);
    }
    return stim;
  }
  function colorSamples(canvas) {
    const ctx = context(canvas, 220),
      colors = root.LabCore.SEARCH_PALETTE;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ["blue", "orange", "magenta"].forEach((color, i) => {
      const x = 180 + i * 220;
      ctx.fillStyle = colors[color];
      ctx.font = '600 34px "Arial", sans-serif';
      ctx.fillText("T X S", x, 80);
      ctx.fillStyle = "#24302B";
      ctx.font = '16px "Microsoft YaHei", sans-serif';
      ctx.fillText(["蓝色", "橙色", "紫红色"][i], x, 135);
    });
  }
  function graph(canvas, trial) {
    const ctx = context(canvas),
      v = trial.values,
      ref = trial.reference,
      target = trial.target;
    const labels = Object.fromEntries(
      trial.order.map((idx, i) => [
        idx,
        idx === ref ? "X" : idx === target ? "A" : ["B", "C", "D", "E", "F"][i],
      ]),
    );
    ctx.font = '600 17px "Microsoft YaHei", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fills = v.map((x, i) =>
      i === target ? "#255E54" : i === ref ? "#586B65" : "#E0E5E1",
    );
    if (trial.variant === "bar_original") {
      const left = 135,
        width = 310,
        base = 337,
        maxHeight = 260;
      ctx.strokeStyle = "#66736E";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left - 18, base);
      ctx.lineTo(left + width + 18, base);
      ctx.stroke();
      trial.order.forEach((idx, i) => {
        const h = (v[idx] / 40) * maxHeight,
          x = left + i * 65;
        ctx.fillStyle = fills[idx];
        ctx.fillRect(x, base - h, 38, h);
        ctx.fillStyle = "#24302B";
        ctx.fillText(labels[idx], x + 19, base + 27);
      });
    } else {
      const cx = 280,
        cy = 210,
        r = 140;
      let angle = -Math.PI / 2 + trial.rotation;
      trial.order.forEach((idx) => {
        const next = angle + (v[idx] / 100) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, next);
        ctx.closePath();
        ctx.fillStyle = fills[idx];
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        const mid = (angle + next) / 2;
        ctx.fillStyle = "#24302B";
        ctx.fillText(
          labels[idx],
          cx + Math.cos(mid) * (r + 24),
          cy + Math.sin(mid) * (r + 24),
        );
        angle = next;
      });
    }
    // 在所有条件保留同样的侧栏空间；只有新增条件表达辅助尺。
    if (trial.variant === "pie_aligned_aid") {
      const x = 525,
        width = 190;
      ctx.textAlign = "left";
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = "#647069";
      ctx.fillText("共同起点 · 两项对照", x, 130);
      for (const [idx, y, label] of [
        [ref, 185, "X"],
        [target, 260, "A"],
      ]) {
        const w = (v[idx] / v[ref]) * width;
        ctx.fillStyle = idx === target ? "#255E54" : "#586B65";
        ctx.fillRect(x, y, w, 22);
        ctx.fillStyle = "#24302B";
        ctx.font = '600 15px "Microsoft YaHei", sans-serif';
        ctx.fillText(label, x, y - 17);
      }
      ctx.strokeStyle = "#67746C";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 160);
      ctx.lineTo(x, 296);
      ctx.stroke();
    }
  }
  root.LabRender = { fixation, search, colorSamples, graph, blank: context };
})(window);
