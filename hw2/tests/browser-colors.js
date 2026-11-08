/* Playwright CLI：隔离浏览器中的本地QA，不能替代真人辨色确认。 */
async function browserColors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://127.0.0.1:8772/");
  await page.locator("#participant").fill("QA_COLOR_01");
  await page.locator("#scope").selectOption("visual_search");
  await page.locator(".start-button").click();
  await page.locator("#consent-check").check();
  await page.locator("#accept-consent").click();
  if (!(await page.locator("#continue-color-check").isDisabled()))
    throw Error("未确认辨色不应开始搜索");
  const pixelCounts = await page.evaluate(() => {
    const canvas = document.querySelector("#color-check-canvas");
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    return Object.fromEntries(
      ["blue", "orange", "magenta"].map((key) => {
        const rgb = LabCore.SEARCH_PALETTE[key]
          .slice(1)
          .match(/../g)
          .map((s) => parseInt(s, 16));
        let count = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (rgb.every((v, j) => pixels[i + j] === v)) count++;
        return [key, count];
      }),
    );
  });
  if (Object.values(pixelCounts).some((n) => n < 50))
    throw Error("三色样本未完整绘制");
  await page.screenshot({
    path: "output/playwright/color-check-v02.png",
    fullPage: true,
  });
  await page.locator('input[name="color-check"][value="no"]').check();
  if (
    !(await page.locator("#continue-color-check").isDisabled()) ||
    !(await page.locator("#color-check-message").isVisible())
  )
    throw Error("分不清时应停止并给出退出指引");
  await page.locator("#exit-run").click();
  await page.reload();
  await page.locator("#resume").click();
  if (!(await page.locator("#continue-color-check").isDisabled()))
    throw Error("刷新后不能跳过未通过的辨色确认");
  await page.locator('input[name="color-check"][value="yes"]').check();
  await page.locator("#continue-color-check").click();
  if (!(await page.locator("#begin-practice").count()))
    throw Error("辨色确认后未进入指导语");
  if (!(await page.locator(".guide-panel").innerText()).includes("紫红色"))
    throw Error("目标指导语仍是旧配色");
  await page.locator("#begin-practice").click();
  await page.waitForFunction(
    () => !!document.querySelector(".response-key:not(:disabled)"),
  );
  await page.screenshot({
    path: "output/playwright/search-v02.png",
    fullPage: true,
  });
  await page.locator("#exit-run").click();
  await page.locator("#resume").click();
  if (await page.locator("#continue-color-check").count())
    throw Error("同一会话已通过确认后不应重复询问");
  await page.locator("#exit-run").click();
  const oldPreserved = await page.evaluate(() => {
    const s = LabStore.all().find((x) => x.participant === "QA_COLOR_01");
    s.status = "abandoned";
    LabStore.save(s);
    LabStore.save({
      ...s,
      id: "QA_OLD_PALETTE",
      protocol: "attention-v1.0",
      status: "in_progress",
    });
    return LabStore.all().some((x) => x.id === "QA_OLD_PALETTE");
  });
  await page.reload();
  if (await page.locator("#resume").count()) throw Error("不应恢复旧配色会话");
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
  await page.locator("#participant").fill("QA_COLOR_FILE");
  await page.locator("#scope").selectOption("visual_search");
  await page.locator(".start-button").click();
  await page.locator("#consent-check").check();
  await page.locator("#accept-consent").click();
  if (!(await page.locator("#color-check-canvas").count()))
    throw Error("file://辨色确认未加载");
  if (errors.length) throw Error(errors.join("; "));
  return {
    pixelCounts,
    cannotDistinguishBlocked: true,
    confirmedResume: true,
    oldPreserved,
    oldResumeBlocked: true,
    fileProtocol: true,
    pageErrors: errors.length,
  };
}
