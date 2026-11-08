/* Run with Playwright CLI after opening the release URL. All API writes are mocked.
   Synthetic QA sessions stay in an isolated browser context, never in the platform. */
async function browserRelease(page) {
  const base = new URL(".", page.url()).href;
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await context.newPage(),
    errors = [],
    requests = [];
  let response = "success";
  p.on("pageerror", (e) => errors.push(e.message));
  await context.route(
    "https://attention-lab-production.up.railway.app/**",
    async (route) => {
      if (route.request().method() !== "POST") return route.abort();
      requests.push(route.request().postDataJSON());
      if (response === "offline") return route.abort("failed");
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          record_id: 900000 + requests.length,
          ...(response === "warning"
            ? {
                warnings: ["QA field was truncated <script>"],
                warning_details: [
                  { field: "qa", kind: "string_truncated", n_trials: 1 },
                ],
              }
            : {}),
        }),
      });
    },
  );
  try {
    await p.goto(base + "?mode=formal");
    if (await p.locator("#participant").inputValue())
      throw Error("Generic recruitment URL assigned P01 to everyone");
    if (await p.locator(".segmented").isVisible())
      throw Error("Recruitment must not show preview selection");
    if (await p.locator(".start-button").isDisabled())
      throw Error("Release recruitment is not open");
    await p.goto(base + "?mode=formal&participant=P01");
    if ((await p.locator("#participant").inputValue()) !== "P01")
      throw Error("Assigned participant missing");
    await p.screenshot({
      path: "output/playwright/recruitment-desktop.png",
      fullPage: true,
    });
    await p.locator(".start-button").click();
    await p.locator("#consent-check").check();
    await p.locator("#accept-consent").click();
    const actual = await p.evaluate(() => {
      const s = LabStore.all().at(-1);
      return {
        mode: s.mode,
        selected: s.selected,
        sha: LAB_CONFIG.preregistrationCommit,
        protocol: s.protocol,
      };
    });
    if (
      actual.mode !== "formal" ||
      actual.selected.length !== 2 ||
      !/^[a-f0-9]{40}$/.test(actual.sha)
    )
      throw Error("Formal consent/configuration incorrect");
    await p.locator("#exit-run").click();
    // Each case enters through real consent and resumes at the experiment boundary.
    for (const [state, experiment, expected] of [
      ["success", "visual_search", 240],
      ["warning", "graphical_judgment", 60],
      ["offline", "graphical_judgment", 60],
    ]) {
      response = state;
      await p.goto(base + "?mode=formal&participant=QA_RELEASE_" + state);
      if (await p.locator("#resume").count())
        throw Error("An assigned link offered another person's session");
      await p.locator("#scope").selectOption(experiment);
      await p.locator(".start-button").click();
      await p.locator("#consent-check").check();
      await p.locator("#accept-consent").click();
      await p.evaluate((exp) => {
        const C = LabCore,
          s = LabStore.all().at(-1);
        const modes = exp === "visual_search" ? C.SEARCH_MODES : C.GRAPH_MODES;
        s.tasks[exp].trials = modes.flatMap((variant) =>
          (exp === "visual_search"
            ? C.searchPlan(s.seed, variant, "formal")
            : C.graphPlan(s.seed, variant, "formal", s.participant)
          ).map((t, i) => ({
            protocol: s.protocol,
            mode: "formal",
            phase: "main",
            session_id: s.id,
            variant,
            trial_index: i + 1,
            variant_trial: i + 1,
            rt: 600,
            interrupted: false,
            timeout: false,
            ...(exp === "visual_search"
              ? {
                  set_size: t.set_size,
                  present: t.present,
                  correct: 1,
                  response: t.present ? "yes" : "no",
                  palette: C.SEARCH_PALETTE.id,
                  color_check: "synthetic_qa",
                }
              : {
                  true_pct: t.true_pct,
                  estimate_pct: t.true_pct + 1,
                  log_error: C.logError(t.true_pct + 1, t.true_pct),
                  values: t.values,
                  display_order: t.order,
                  dataset_id: t.dataset_id,
                }),
          })),
        );
        s.cursor.variant = 3;
        LabStore.save(s);
      }, experiment);
      await p.locator("#exit-run").click();
      await p.locator("#resume").click();
      await p.waitForFunction((state) => {
        const s = LabStore.all().at(-1),
          u = Object.values(s.tasks)[0].upload;
        return u.status === (state === "offline" ? "uncertain" : "uploaded");
      }, state);
      const receipt = await p.locator(".platform-receipt").innerText();
      if (state === "success" && !receipt.includes("平台已确认"))
        throw Error("Success receipt missing");
      if (
        state === "warning" &&
        (!receipt.includes("字段需要核对") ||
          !receipt.includes("可能有数据损失"))
      )
        throw Error("Lossy warnings hidden");
      if (state === "offline" && !receipt.includes("响应未确认"))
        throw Error("Uncertain request mislabeled");
      if (state !== "offline") {
        const payload = requests.at(-1);
        if (
          payload.project !== "W2UGHD" ||
          payload.experiment !== experiment ||
          payload.trials.length !== expected ||
          payload.meta.preregistration !== actual.sha
        )
          throw Error("Actual browser payload mismatch");
      }
      const previous = requests.length;
      await p.locator("#continue-experiment").click();
      if (!(await p.locator("#export-finished").count()))
        throw Error("Backup unavailable");
      await p.screenshot({
        path: `output/playwright/upload-${state}.png`,
        fullPage: true,
      });
      if (requests.length !== previous)
        throw Error("Completion duplicated an upload");
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto(base + "?mode=formal&participant=QA_MOBILE");
    if (
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    )
      throw Error("Mobile recruitment overflow");
    await p.locator(".start-button").click();
    if (await p.locator(".consent-modal").count())
      throw Error("Mobile entered formal RT task");
    await p.screenshot({
      path: "output/playwright/recruitment-mobile.png",
      fullPage: true,
    });
    if (errors.length) throw Error(errors.join("; "));
    return {
      base,
      formal: true,
      bothExperiments: true,
      preregistration: actual.sha,
      payloadCounts: requests.map((r) => r.trials.length),
      successWarningOffline: true,
      noDuplicateUpload: true,
      participantIsolation: true,
      mobileBlocked: true,
      pageErrors: 0,
      realExternalWrites: 0,
    };
  } finally {
    await context.close();
  }
}
