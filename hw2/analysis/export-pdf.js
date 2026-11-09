/* Playwright CLI run-code function. Open the local standalone report first.
   Produces the fixed submission PDF without platform requests or raw records. */
async function exportReportPDF(page) {
  await page.locator("#study-title").waitFor();
  await page.locator(".final-study").evaluate((article) => {
    article.querySelectorAll("details").forEach((el) => (el.open = true));
    article.querySelectorAll("img").forEach((el) => (el.loading = "eager"));
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".final-study img")].every(
      (el) => el.complete && el.naturalWidth > 0,
    ),
  );
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: "report/research-report.pdf",
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;text-align:center;font-size:8px;color:#666">' +
      '<span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  return { pdf: "report/research-report.pdf", images: 5, rawDataIncluded: false };
}
