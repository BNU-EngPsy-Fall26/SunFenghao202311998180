/* Canvas charts used by the final report. No chart library or network asset is required. */
(function attachCharts(globalScope) {
  "use strict";

  var SDT = globalScope.EmberSDT;
  var COLORS = {
    ink: "#17232b",
    soft: "#63727a",
    line: "#d7e0dd",
    grid: "#e8eeec",
    pine: "#1d6b59",
    blue: "#3d718b",
    ember: "#ed693c",
    amber: "#f2b44a",
    cloud: "#f5f8f7"
  };

  function prepareCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    return ctx;
  }

  function drawAxes(ctx, plot, xLabel, yLabel) {
    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();

    ctx.fillStyle = COLORS.soft;
    ctx.font = "12px 'Microsoft YaHei UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(xLabel, (plot.left + plot.right) / 2, plot.bottom + 34);
    ctx.save();
    ctx.translate(17, (plot.top + plot.bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
    ctx.restore();
  }

  function drawDistribution(canvas, dPrime, criterion, options) {
    var ctx = prepareCanvas(canvas);
    var width = canvas.width;
    var height = canvas.height;
    var compact = options && options.compact;
    var plot = {
      left: compact ? 46 : 62,
      right: width - 28,
      top: compact ? 20 : 30,
      bottom: height - (compact ? 34 : 52)
    };
    var minX = -3.6;
    var maxX = Math.max(4.6, dPrime + 3.2);
    var maxY = 0.44;
    var threshold = dPrime / 2 + criterion;

    function xToPx(x) {
      return plot.left + (x - minX) / (maxX - minX) * (plot.right - plot.left);
    }

    function yToPx(y) {
      return plot.bottom - y / maxY * (plot.bottom - plot.top);
    }

    ctx.fillStyle = COLORS.cloud;
    ctx.fillRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);

    if (!compact) {
      drawAxes(ctx, plot, "内部感觉证据", "概率密度");
    } else {
      ctx.strokeStyle = COLORS.line;
      ctx.beginPath();
      ctx.moveTo(plot.left, plot.bottom);
      ctx.lineTo(plot.right, plot.bottom);
      ctx.stroke();
    }

    // Shade the false-alarm side under the noise distribution.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(xToPx(threshold), plot.bottom);
    for (var x = threshold; x <= maxX; x += 0.04) {
      ctx.lineTo(xToPx(x), yToPx(SDT.normalPDF(x, 0, 1)));
    }
    ctx.lineTo(plot.right, plot.bottom);
    ctx.closePath();
    ctx.fillStyle = "rgba(237, 105, 60, 0.13)";
    ctx.fill();
    ctx.restore();

    // Shade the miss side under the signal distribution.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.bottom);
    for (var sx = minX; sx <= threshold; sx += 0.04) {
      ctx.lineTo(xToPx(sx), yToPx(SDT.normalPDF(sx, dPrime, 1)));
    }
    ctx.lineTo(xToPx(threshold), plot.bottom);
    ctx.closePath();
    ctx.fillStyle = "rgba(188, 62, 53, 0.10)";
    ctx.fill();
    ctx.restore();

    function drawCurve(mean, color) {
      ctx.beginPath();
      for (var value = minX; value <= maxX; value += 0.04) {
        var px = xToPx(value);
        var py = yToPx(SDT.normalPDF(value, mean, 1));
        if (value === minX) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = compact ? 2.5 : 3;
      ctx.stroke();
    }

    drawCurve(0, COLORS.blue);
    drawCurve(dPrime, COLORS.ember);

    var thresholdX = xToPx(threshold);
    ctx.save();
    ctx.strokeStyle = COLORS.pine;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(thresholdX, plot.top);
    ctx.lineTo(thresholdX, plot.bottom);
    ctx.stroke();
    ctx.restore();

    ctx.font = "bold 12px Consolas, monospace";
    var peaksOverlap = Math.abs(dPrime) < 0.65;
    ctx.fillStyle = COLORS.blue;
    ctx.textAlign = peaksOverlap ? "right" : "center";
    ctx.fillText("噪音 N", xToPx(0) + (peaksOverlap ? -8 : 0), yToPx(SDT.normalPDF(0, 0, 1)) - 12);
    ctx.fillStyle = COLORS.ember;
    ctx.textAlign = peaksOverlap ? "left" : "center";
    ctx.fillText("信号 SN", xToPx(dPrime) + (peaksOverlap ? 8 : 0), yToPx(SDT.normalPDF(dPrime, dPrime, 1)) - (peaksOverlap ? 28 : 12));
    ctx.fillStyle = COLORS.pine;
    ctx.textAlign = thresholdX > plot.right - 80 ? "right" : "left";
    ctx.fillText("c = " + criterion.toFixed(2), thresholdX + (ctx.textAlign === "left" ? 8 : -8), plot.top + 16);

    if (!compact) {
      ctx.fillStyle = COLORS.soft;
      ctx.font = "11px 'Microsoft YaHei UI', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("漏报区", plot.left + 8, plot.bottom - 12);
      ctx.textAlign = "right";
      ctx.fillText("误报区", plot.right - 8, plot.bottom - 12);
    }
  }

  function drawROC(canvas, dPrime, point) {
    var ctx = prepareCanvas(canvas);
    var width = canvas.width;
    var height = canvas.height;
    var plot = { left: 70, right: width - 34, top: 26, bottom: height - 58 };

    function xToPx(value) {
      return plot.left + value * (plot.right - plot.left);
    }

    function yToPx(value) {
      return plot.bottom - value * (plot.bottom - plot.top);
    }

    ctx.fillStyle = COLORS.cloud;
    ctx.fillRect(plot.left, plot.top, plot.right - plot.left, plot.bottom - plot.top);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (var grid = 0; grid <= 1.0001; grid += 0.25) {
      ctx.beginPath();
      ctx.moveTo(xToPx(grid), plot.top);
      ctx.lineTo(xToPx(grid), plot.bottom);
      ctx.moveTo(plot.left, yToPx(grid));
      ctx.lineTo(plot.right, yToPx(grid));
      ctx.stroke();

      ctx.fillStyle = COLORS.soft;
      ctx.font = "10px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText(grid.toFixed(2), xToPx(grid), plot.bottom + 18);
      ctx.textAlign = "right";
      ctx.fillText(grid.toFixed(2), plot.left - 9, yToPx(grid) + 3);
    }

    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.top);
    ctx.stroke();
    ctx.restore();

    var curve = [];
    for (var threshold = -4.5; threshold <= 4.5; threshold += 0.05) {
      curve.push({
        fa: 1 - SDT.normalCDF(threshold),
        hit: 1 - SDT.normalCDF(threshold - dPrime)
      });
    }

    ctx.beginPath();
    curve.forEach(function drawPoint(item, index) {
      if (index === 0) ctx.moveTo(xToPx(item.fa), yToPx(item.hit));
      else ctx.lineTo(xToPx(item.fa), yToPx(item.hit));
    });
    ctx.strokeStyle = COLORS.pine;
    ctx.lineWidth = 3;
    ctx.stroke();

    if (point) {
      var pointX = xToPx(point.falseAlarmRate);
      var pointY = yToPx(point.hitRate);
      ctx.fillStyle = "rgba(237, 105, 60, 0.18)";
      ctx.beginPath();
      ctx.arc(pointX, pointY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(pointX, pointY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.ink;
      ctx.font = "bold 11px 'Microsoft YaHei UI', sans-serif";
      ctx.textAlign = pointX > plot.right - 100 ? "right" : "left";
      ctx.fillText("你的表现", pointX + (ctx.textAlign === "left" ? 12 : -12), pointY - 12);
    }

    drawAxes(ctx, plot, "误报率 P(FA)", "击中率 P(H)");
  }

  var api = {
    drawDistribution: drawDistribution,
    drawROC: drawROC
  };

  globalScope.EmberCharts = api;
}(window));
