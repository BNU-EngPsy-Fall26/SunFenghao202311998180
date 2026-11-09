/* Fixed report QA in a fresh context; no participant data and no external writes. */
async function browserReport(page) {
  const context = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 1000 },
    });
  const p = await context.newPage();
  const errors = [],
    external = [],
    missing = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("response", (r) => {
    if (r.status() >= 400) missing.push(r.url());
  });
  await context.route("https://**", async (route) => {
    external.push(route.request().url());
    await route.abort();
  });
  const base = "http://127.0.0.1:8772/";
  const file =
    "file:///C:/Users/ASUS/Documents/学习/学科文件夹（作业）/D大四/工程心理学/作业2/code/";
  try {
    const assertReport = async () => {
      if (!(await p.locator("#study-title").count()))
        throw Error("Fixed report absent");
      if (
        (await p.locator(".study-sample strong").allTextContents()).join(
          ",",
        ) !== "5,2,5"
      )
        throw Error("Completion and effective N conflated");
      await p
        .locator(".final-study")
        .evaluate((el) =>
          el
            .querySelectorAll('img[loading="lazy"]')
            .forEach((i) => (i.loading = "eager")),
        );
      await p.waitForFunction(() =>
        [...document.querySelectorAll(".final-study img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      if (await p.locator("#report-mode").count())
        throw Error("Default route shows local tool");
      if (!(await p.locator(".final-study").innerText()).includes("0.250"))
        throw Error("Corrected result absent");
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        throw Error("Report body overflows");
    };
    await p.goto(base + "#report");
    await assertReport();
    if (await p.evaluate(() => localStorage.length))
      throw Error("Fixed report wrote local data");
    await p.screenshot({ path: "output/playwright/report-desktop.png" });
    await p.locator("#fig-3").scrollIntoViewIfNeeded();
    await p.screenshot({ path: "output/playwright/report-graph-desktop.png" });
    await p.getByRole("link", { name: "本机 / 平台数据工具 →" }).click();
    if (!(await p.locator("#report-mode").count()))
      throw Error("Live data tool inaccessible");
    await p.getByRole("link", { name: "研究报告", exact: true }).click();
    await assertReport();
    await p.getByRole("link", { name: "独立阅读报告 ↗" }).click();
    await assertReport();
    await p.getByRole("link", { name: "搜索结果", exact: true }).click();
    if (!p.url().endsWith("#study-search"))
      throw Error("Standalone TOC failed");
    const downloads = p.waitForEvent("download");
    await p.getByRole("link", { name: "条件汇总CSV", exact: true }).click();
    await (await downloads).saveAs("output/playwright/report-conditions.csv");
    for (const href of await p
      .locator("a[download]")
      .evaluateAll((a) => a.map((e) => e.href))) {
      const response = await p.request.get(href);
      if (!response.ok()) throw Error("Report download failed: " + href);
    }
    await p.goto(base + "report/index.html");
    await p
      .locator("details")
      .evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
    await assertReport();
    await p.pdf({
      path: "output/analysis/report-print-QA.pdf",
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    await p.setViewportSize({ width: 390, height: 844 });
    for (const url of [base + "#report", base + "report/index.html"]) {
      await p.goto(url);
      await assertReport();
    }
    await p.screenshot({ path: "output/playwright/report-mobile.png" });
    await p.locator("#fig-3").scrollIntoViewIfNeeded();
    await p.screenshot({ path: "output/playwright/report-graph-mobile.png" });
    await p.setViewportSize({ width: 1440, height: 1000 });
    await context.setOffline(true);
    for (const url of [
      file + "index.html#report",
      file + "report/index.html",
    ]) {
      await p.goto(url);
      await assertReport();
    }
    if (errors.length || external.length || missing.length)
      throw Error(JSON.stringify({ errors, external, missing }));
    return {
      fixedReportFreshBrowser: true,
      counts: [5, 2, 5],
      standalone: true,
      toc: true,
      download: true,
      mobileOverflow: false,
      fileProtocolOffline: true,
      images: 5,
      printPDF: true,
      pageErrors: 0,
      externalRequests: 0,
    };
  } finally {
    await context.close();
  }
}
