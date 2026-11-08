/* Playwright CLI run-code 文件。
   只生成QA_前缀的体验/试运行记录；绝不向老师平台写入。
   ?qa=pilot 时加速浏览器时钟验证300次状态流；默认preview使用真实时钟。
   这些机器答案不能作为研究结果。 */
async function browserFlow(page) {
  const mode =
    new URL(page.url()).searchParams.get("qa") === "pilot"
      ? "pilot"
      : "preview";
  const fast = mode === "pilot",
    participant = fast ? "QA_FULL_01" : "QA_PREVIEW_01",
    errors = [],
    external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(
    "https://attention-lab-production.up.railway.app/**",
    async (route) => {
      external.push(route.request().url());
      await route.abort();
    },
  );
  if (fast) await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#participant").fill(participant);
  await page.locator(`input[name=mode][value=${mode}]`).check({ force: true });
  await page.getByRole("button", { name: "阅读参与说明" }).click();
  if (!(await page.locator("#accept-consent").isDisabled()))
    throw Error("未同意时应不能开始");
  await page.locator("#consent-check").check();
  await page.locator("#accept-consent").click();
  let steps = 0,
    pauseChecked = false,
    graphInputChecked = false;
  while (steps++ < 1800) {
    if (await page.locator("#continue-color-check").count()) {
      await page.locator('input[name="color-check"][value="yes"]').check();
      await page.locator("#continue-color-check").click();
      continue;
    }
    if (await page.locator("#view-session-report").count()) break;
    if (await page.locator("#begin-practice").count()) {
      if (await page.locator('input[name=quiz][value="50"]').count())
        await page.locator('input[name=quiz][value="50"]').check();
      await page.locator("#begin-practice").click();
      continue;
    }
    for (const selector of [
      "#after-practice",
      "#begin-block",
      "#continue-rest",
      "#continue-experiment",
    ]) {
      if (await page.locator(selector).count()) {
        await page.locator(selector).click();
        break;
      }
    }
    if (await page.locator("#view-session-report").count()) break;
    if (await page.locator("#stimulus").count()) {
      const state = await page.evaluate((pid) => {
        const s = LabStore.all()
          .filter((x) => x.participant === pid)
          .at(-1);
        const exp = s.selected[s.cursor.experiment];
        if (!exp) return null;
        const variant = s.assignment[exp][s.cursor.variant];
        if (!variant) return null;
        const label =
          document.querySelector(".condition-label")?.textContent || "";
        const practice = label.includes("练习");
        const index = practice
          ? Number(label.match(/(\d+)/)[1]) - 1
          : s.cursor.trial;
        const list = practice
          ? LabCore.practicePlan(s.seed, exp, variant, s.mode, s.participant)
          : exp === "visual_search"
            ? LabCore.searchPlan(s.seed, variant, s.mode)
            : LabCore.graphPlan(s.seed, variant, s.mode, s.participant);
        const trial = list[index];
        return {
          exp,
          practice,
          trial,
          ready: !!document.querySelector(
            ".response-panel button:not(:disabled)",
          ),
        };
      }, participant);
      if (!state) continue;
      if (!state.ready) {
        if (fast) await page.clock.fastForward(1100);
        else await page.waitForTimeout(40);
        continue;
      }
      if (!pauseChecked && !fast && !state.practice) {
        await page.locator("#pause-run").click();
        if (!(await page.locator("#resume-paused").count()))
          throw Error("暂停画面缺失");
        await page.locator("#resume-paused").click();
        pauseChecked = true;
        continue;
      }
      if (fast) await page.clock.fastForward(240);
      else await page.waitForTimeout(220);
      if (state.exp === "visual_search")
        await page.keyboard.press(state.trial.present ? "f" : "j");
      else {
        if (!graphInputChecked) {
          await page.locator("#estimate").fill("101");
          await page.locator("#submit-estimate").click();
          if (!(await page.locator("#estimate").isEnabled()))
            throw Error("越界答案不应完成试次");
          graphInputChecked = true;
        }
        await page
          .locator("#estimate")
          .fill(String(Math.round(state.trial.true_pct * 10) / 10));
        await page.keyboard.press("Enter");
      }
      if (fast) await page.clock.fastForward(state.practice ? 1350 : 260);
      else await page.waitForTimeout(40);
    } else {
      if (fast) await page.clock.fastForward(300);
      else await page.waitForTimeout(50);
    }
  }
  if (!(await page.locator("#view-session-report").count()))
    throw Error("完整流程未结束，steps=" + steps);
  const result = await page.evaluate((pid) => {
    const s = LabStore.all()
      .filter((x) => x.participant === pid)
      .at(-1);
    return {
      done: s.done,
      mode: s.mode,
      search: s.tasks.visual_search.trials.length,
      graph: s.tasks.graphical_judgment.trials.length,
      interruptions: s.tasks.visual_search.trials.filter((t) => t.interrupted)
        .length,
      searchSummary: LabCore.summarizeSearch(
        s.tasks.visual_search.trials,
        s.mode,
      ).effects,
      graphSummary: LabCore.summarizeGraph(
        s.tasks.graphical_judgment.trials,
        s.mode,
      ).effects,
      uploads: Object.values(s.tasks).map((t) => t.upload.status),
    };
  }, participant);
  const expected = fast ? [240, 60] : [24, 12];
  if (
    !result.done ||
    result.search !== expected[0] ||
    result.graph !== expected[1]
  )
    throw Error("试次计数异常：" + JSON.stringify(result));
  if (external.length)
    throw Error("非正式模式发生外部请求：" + external.join(","));
  if (errors.length) throw Error("浏览器异常：" + errors.join(","));
  const download = page.waitForEvent("download");
  await page.locator("#export-finished").click();
  const file = await download;
  await file.saveAs(`output/playwright/${mode}-QA-backup.json`);
  await page.locator("#view-session-report").click();
  if (
    !(await page
      .locator(".report-status")
      .innerText()
      .then((t) => t.includes("不进入作业结论")))
  )
    throw Error("报告缺少非正式数据标记");
  await page.screenshot({
    path: `output/playwright/${mode}-report.png`,
    fullPage: true,
  });
  await page.locator("#report-mode").selectOption("formal");
  if (!(await page.getByText("尚未收集正式数据", { exact: true }).count()))
    throw Error("体验数据混入正式报告");
  return {
    mode,
    steps,
    pauseChecked,
    graphInputChecked,
    externalRequests: external.length,
    pageErrors: errors.length,
    ...result,
  };
}
