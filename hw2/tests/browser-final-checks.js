/* 最终静态/导出验收。只读取此前QA会话，不产生正式数据。 */
async function browserFinalChecks(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8772/#manage");
  const csvEvent = page.waitForEvent("download");
  await page.locator("#export-all-csv").click();
  const csv = await csvEvent;
  await csv.saveAs("output/playwright/QA-all.csv");
  await page.goto("http://127.0.0.1:8772/#live-report");
  await page.locator("#report-mode").selectOption("pilot");
  const htmlEvent = page.waitForEvent("download");
  await page.locator("#download-report").click();
  const html = await htmlEvent;
  await html.saveAs("output/playwright/QA-report.html");
  await page.screenshot({
    path: "output/playwright/report-desktop-final.png",
    fullPage: true,
  });
  await page.goto(
    "file:///C:/Users/ASUS/Documents/学习/学科文件夹（作业）/D大四/工程心理学/作业2/code/output/playwright/QA-report.html",
  );
  if (await page.locator("script").count())
    throw Error("报告导出应自包含且无脚本");
  if (
    !(await page
      .getByText("体验/试运行报告 · 不进入作业结论", { exact: true })
      .count())
  )
    throw Error("导出报告缺少模式标记");
  if (!(await page.locator("svg").count())) throw Error("导出报告丢失图形");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:8772/");
  await page.screenshot({
    path: "output/playwright/home-mobile-final.png",
    fullPage: true,
  });
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("最终手机首页溢出");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:8772/");
  await page.screenshot({
    path: "output/playwright/home-desktop-final.png",
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join(";"));
  return {
    csvDownloaded: true,
    standaloneHTML: true,
    reportHasSVG: true,
    mobileOverflow: false,
    pageErrors: errors.length,
  };
}
