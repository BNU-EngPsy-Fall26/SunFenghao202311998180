/* 附加浏览器检查：仅本地QA记录，平台读取用拦截响应，无外部写入。 */
async function browserChecks(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://127.0.0.1:8772/");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw Error("手机首页横向溢出");
  await page.screenshot({
    path: "output/playwright/home-mobile.png",
    fullPage: true,
  });
  await page.locator("#participant").fill("QA_MOBILE");
  await page.locator(".start-button").click();
  if (await page.locator(".consent-modal").count())
    throw Error("手机不应进入键盘RT实验");
  await page.goto("http://127.0.0.1:8772/#report");
  if (
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  )
    throw Error("手机报告横向溢出");
  await page.screenshot({
    path: "output/playwright/report-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:8772/");
  await page.locator("#participant").fill("QA_VISUAL_03");
  await page.locator("#scope").selectOption("graphical_judgment");
  await page.locator(".start-button").click();
  await page.locator("#consent-check").check();
  await page.locator("#accept-consent").click();
  await page.screenshot({
    path: "output/playwright/graph-guide.png",
    fullPage: true,
  });
  await page.locator('input[name=quiz][value="50"]').check();
  await page.locator("#begin-practice").click();
  await page.waitForFunction(
    () => !!document.querySelector("#estimate:not(:disabled)"),
  );
  await page.screenshot({ path: "output/playwright/graph-stimulus.png" });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  if (!(await page.locator("#resume-paused").count()))
    throw Error("失焦没有暂停");
  await page.locator("#exit-run").click();
  await page.reload();
  if (!(await page.locator("#resume").count()))
    throw Error("退出后没有恢复入口");
  await page.locator("#resume").click();
  if (!(await page.locator("#begin-practice").count()))
    throw Error("未通过的练习应重新开始");
  await page.locator("#exit-run").click();
  await page.goto("http://127.0.0.1:8772/#manage");
  await page.locator("#project-code").fill("ABC234");
  await page.locator("#save-project").click();
  let readRequests = 0;
  await page.route(
    "https://attention-lab-production.up.railway.app/api/hw2/data?**",
    async (route) => {
      readRequests++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, records: [] }),
      });
    },
  );
  await page.locator("#load-remote").click();
  await page.waitForURL("**/#live-report");
  if (readRequests !== 2) throw Error("平台应分别读取两范式");
  if (!(await page.locator("#report-source").count()))
    throw Error("缺少平台/本机来源区分");
  if ((await page.locator("#report-source").inputValue()) !== "teacher")
    throw Error("平台读取后来源错误");
  if (!(await page.getByText("尚未收集正式数据", { exact: true }).count()))
    throw Error("空平台结果不应有正式数据");
  await page.goto("http://127.0.0.1:8772/");
  const ready = await page.evaluate(
    () =>
      LAB_CONFIG.collectionEnabled &&
      /^[a-f0-9]{40}$/.test(LAB_CONFIG.preregistrationCommit) &&
      /^[A-Z0-9]{6}$/.test(LAB_CONFIG.project),
  );
  if ((await page.locator("#formal-start").isDisabled()) === ready)
    throw Error("正式入口与预登记配置不一致");
  await page.goto(
    "file:///C:/Users/ASUS/Documents/学习/学科文件夹（作业）/D大四/工程心理学/作业2/code/index.html",
  );
  if (!(await page.getByRole("heading", { level: 1 }).count()))
    throw Error("file://入口未渲染");
  await page.locator("#participant").fill("QA_FILE");
  await page.locator("#scope").selectOption("graphical_judgment");
  await page.locator(".start-button").click();
  await page.locator("#consent-check").check();
  await page.locator("#accept-consent").click();
  if (!(await page.locator("#begin-practice").count()))
    throw Error("file://实验未进入指导语");
  await page.locator("#exit-run").click();
  if (errors.length) throw Error(errors.join("; "));
  return {
    mobileOverflow: false,
    mobileExperimentBlocked: true,
    focusPause: true,
    resume: true,
    platformReadMockRequests: readRequests,
    sourceIsolation: true,
    formalMatchesConfig: true,
    fileProtocol: true,
    pageErrors: errors.length,
  };
}
