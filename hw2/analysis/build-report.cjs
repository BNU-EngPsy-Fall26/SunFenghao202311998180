/* Build both the standalone report and the offline in-app report from one snapshot. */
const fs = require("node:fs");
const path = require("node:path");
const C = require("../src/core.js");
const ROOT = path.resolve(__dirname, "..");
const d = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/summary/analysis.json"), "utf8"),
);
const verified = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/summary/verification.json"), "utf8"),
);
if (verified.status !== "pass")
  throw new Error("Run independent verification first.");
const f = (x, digits = 2) => (Number.isFinite(x) ? x.toFixed(digits) : "—");
const e = Object.fromEntries(d.all.effects.map((x) => [x.key, x]));
const names = {
  feature_original: "特征搜索",
  conjunction_original: "原联合搜索",
  conjunction_grouped: "分区联合搜索",
  bar_original: "柱图",
  pie_original: "原饼图",
  pie_aligned_aid: "饼图＋对照尺",
};
const titles = {
  "S-R": "搜索复现",
  "S-I": "分区改进",
  "G-R": "图形复现",
  "G-I": "对照尺改进",
};
const m = (variant, key, participants) =>
  C.mean(
    d.conditionRows
      .filter(
        (r) =>
          r.variant === variant &&
          (!participants || participants.includes(r.participant)),
      )
      .map((r) => r[key]),
  );
const avgSD = (variant, key, digits = 2) => {
  const a = d.conditionRows
    .filter((r) => r.variant === variant)
    .map((r) => r[key]);
  return `${f(C.mean(a), digits)} (${f(C.sd(a), digits)})`;
};
const table = (caption, headers, rows, note = "") =>
  `<div class="study-table-wrap"><table><caption>${caption}</caption><thead><tr>${headers
    .map((h) => `<th scope="col">${h}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((v, i) =>
            i === 0 ? `<th scope="row">${v}</th>` : `<td>${v}</td>`,
          )
          .join("")}</tr>`,
    )
    .join(
      "",
    )}</tbody></table></div>${note ? `<p class="study-note">${note}</p>` : ""}`;
const effectTable = (summary, caption) =>
  table(
    caption,
    ["比较", "有效N", "平均差 (SD)", "95% bootstrap CI", "原始p", "Holm p"],
    summary.effects.map((x) => [
      x.key + " " + titles[x.key],
      x.n,
      `${f(x.mean)} (${f(x.sd)})`,
      x.ci ? x.ci.map((z) => f(z)).join(" 至 ") : "—",
      Number.isFinite(x.p) ? f(x.p, 4) : "—",
      Number.isFinite(x.adjusted) ? f(x.adjusted, 3) : "—",
    ]),
    "正值均符合预定方向。S项单位为ms/item，G项为log₂误差单位。所有区间按人重采样2500次；N＝2的区间只能描述这两人的重采样范围。四项属于同一Holm校正族，无法检验的搜索项仍保留在四项族的计数中。N＜5不作符号翻转检验。",
  );
const aux = (key, field) =>
  d.auxiliary.find((x) => x.key === key && x.field === field);
const body = (prefix, embedded = false) => {
  const fig = (name, alt, caption, no) =>
    `<figure id="fig-${no}"><a href="${prefix}figures/${name}.svg" target="_blank" rel="noopener" aria-label="打开图${no}大图"><img src="${prefix}figures/${name}.svg" alt="${alt}" loading="lazy" width="1200" height="${name === "04_graph_time" ? 703 : 530}"></a><figcaption>图${no}．${caption} <span class="figure-downloads"><a href="${prefix}figures/${name}.png" download>600dpi PNG</a> · <a href="${prefix}figures/${name}.pdf" download>矢量PDF</a></span></figcaption></figure>`;
  return `<article class="final-study" aria-labelledby="study-title">
  <header class="study-cover">
    <p class="study-kicker">注意有迹 · 工程心理学作业二 · 2026年11月9日固定快照</p>
    <h1 id="study-title">排列方式和共同基线，<br>能让判断更容易吗？</h1>
    <p class="study-subtitle">两个经典实验的浏览器适配复现与改进</p>
    <div class="study-sample"><div><strong>5</strong><span>完成两实验（人）</span></div><div><strong>2</strong><span>搜索主分析（人）</span></div><div><strong>5</strong><span>图形主分析（人）</span></div></div>
    <p class="study-deck">搜索的两名可用参与者都呈现了预期方向，但证据还很有限。比例判断中，五人的柱图和辅助饼图误差都低于原饼图；这一小样本模式值得保留，尚不足以作稳定的总体推断。</p>
    <div class="study-actions"><button type="button" class="study-print" onclick="document.querySelectorAll('.final-study details').forEach(d=>d.open=true);window.print()">打印 / 另存为PDF</button><a href="${prefix}research-report.pdf" download>下载完整报告PDF</a><a href="${embedded ? "report/index.html" : "../index.html#home"}">${embedded ? "独立阅读报告 ↗" : "回到实验网页 →"}</a>${embedded ? '<a href="#live-report">本机 / 平台数据工具 →</a>' : ""}</div>
  </header>
  <nav class="study-toc" aria-label="报告目录"><a href="${embedded ? "report/index.html" : ""}#study-data">样本与质量</a><a href="${embedded ? "report/index.html" : ""}#study-design">设计与分析</a><a href="${embedded ? "report/index.html" : ""}#study-search">搜索结果</a><a href="${embedded ? "report/index.html" : ""}#study-graph">比例判断结果</a><a href="${embedded ? "report/index.html" : ""}#study-conclusion">讨论</a><a href="${embedded ? "report/index.html" : ""}#study-appendix">附录</a></nav>
  <section id="study-data"><h2>样本齐了，可用人数仍要分开算</h2>
    <p>研究者共招募5名他人，以P01–P05记录。同一人完成两个实验，各有240次搜索判断、60次比例估计，共1500条正式试次。练习和程序测试未进入分析。没有收集年龄、性别等人口学信息，也没有事后补填。参加前须知情同意；搜索还需自报能分辨统一的蓝、橙、紫红三色，这项确认只说明本人觉得任务可做。</p>
    <p>最终CSV和JSON的1500条试次、30000个试次字段一致。10条范式记录对应5个会话，无重复正式记录；协议均为attention-v1.1，均指向收数前版本89c427c。原始刺激可由记录中的种子重新生成并与试次核对。完整备份在本地保留，公开页面只用匿名汇总。</p>
    <p class="study-note">本报告将最终导出的P01–P05作为同一研究样本。样本范围较收数前草案作了调整；试次质量标准、主指标和四项比较保持原定口径，各项有效人数分别报告。</p>
    ${table(
      "表1．从完成数据到可用主分析",
      ["参与者", "搜索试次", "搜索主分析", "图形有效判断 / 60"],
      [
        ["P01", "240", "可用", "60"],
        ["P02", "240", "可用", "60"],
        ["P03", "240", "原联合 / 30项：7次有效正确", "60"],
        ["P04", "240", "原联合 / 30项：7次有效正确", "59"],
        ["P05", "240", "原联合 / 30项：6次有效正确", "60"],
      ],
      "搜索每个目标存在格预定10次，至少8次有效正确RT才可估计主斜率。P03–P05的同一格未达门槛，两项搜索主对比均缺失；其余试次保留作描述。P04辅助饼图有1次失焦，剔除该次后19/20次有效，仍达16次门槛。",
    )}
    <p>搜索共有4次超时、0次失焦、0次小于150ms的提前反应；${d.quality.filter((r) => r.experiment === "visual_search").reduce((n, r) => n + r.valid, 0)}/1200次为有效正确反应。图形判断有1次失焦、0次超时，299/300次有效。所有人的整体搜索正确率都高于60%。缺失主斜率的原因是局部条件格正确反应不足，不能用整体高正确率代替该门槛。</p>
  </section>
  <section id="study-design"><h2>我们具体改了什么</h2>
    <p>两个实验分别对应W6视觉搜索和W7显示设计。每个实验都先比较经典条件，再增加一个可实际操作的改进条件。问题、预测、清洗口径于2026年11月8日22:31提交，早于最早一人的知情同意时间23:33；Git快照和记录中的40位版本号一致。</p>
    ${table(
      "表2．条件、操纵和收数前预测",
      ["实验", "经典比较", "改进条件", "预定差值；预测均＞0"],
      [
        [
          "搜索",
          "特征目标 vs 联合目标",
          "联合目标不变，按颜色空间分区",
          "S-R＝原联合斜率−特征斜率<br>S-I＝原联合斜率−分区联合斜率",
        ],
        [
          "比例判断",
          "柱图 vs 饼图",
          "饼图增加共同基线对照尺",
          "G-R＝原饼图log误差−柱图log误差<br>G-I＝原饼图log误差−辅助饼图log误差",
        ],
      ],
    )}
    <h3>搜索：保留任务，只调整空间组织</h3>
    <p>依据Treisman和Gelade（1980）的Experiment I，橙色T与蓝色X作干扰项。特征条件寻找紫红色字母或S，联合条件寻找蓝色T，回答有无目标。每条件包含集合大小1、5、15、30，目标存在和不存在各10次，共80次；三条件240次。分区联合与原联合共享坐标、目标位置和字母、颜色计数，只改变非目标项目的空间组织。</p>
    <p>特征整合理论（FIT）与子集搜索研究提示，按颜色聚集可能让人先选出相关子集，再确认字母。我们因此预测分区降低联合搜索斜率（Treisman &amp; Gelade, 1980；Theeuwes, 1996）。分区也改变了局部邻近关系，本实验无法把分组、拥挤和策略逐一拆开。</p>
    <h3>比例判断：给角度比较加一条长度参照</h3>
    <p>依据Cleveland和McGill（1984）的位置—角度任务，每图5个值，标出最大项X，估计指定项A相当于X的百分之几。每条件20张独立图，共60次；三条件匹配比率和大小排序，五值数据不完全重复。辅助条件保留饼图，将A、X另画为共同起点的两条长度，不显示答案数字。按原研究的图形感知解释，位置和长度比较有望减轻角度估计负担。</p>
    <p>两实验均为被试内设计，顺序由匿名编号分配：3人先搜索、2人先判断，每实验覆盖六种条件排列中的五种。练习为每个搜索条件6次、每个图形条件3次，共27次，可重练。搜索注视1000ms、刺激最长5000ms；图形最长30000ms。程序用performance.now()记录反应时间，并标记页面失焦。未测量各设备的真实显示延迟。</p>
    <h3>比较按人配对，条件格不足就保留缺失</h3>
    <p>搜索主指标只用目标存在、正确、未超时或失焦、150–5000ms的RT。每人每条件先算四个集合大小的均值，再拟合RT随集合大小变化的线性斜率。各格须至少8次有效正确反应，且整体正确率至少60%。图形主指标沿用原文的log₂(|估计百分数−真实百分数|＋0.125)，先逐次计算，再求每人的条件均值；每条件至少16个有效判断。大误差不作为删数据的理由。</p>
    <p>各差值报告均值、SD和2500次被试级bootstrap百分位区间，种子固定为比较编号。N≥5时作双侧精确配对符号翻转检验，四项统一Holm校正；检验依赖差值的对称性／符号可交换性假设。五人时即使差值全同向，双侧最小p也只能到0.0625。试次数不增加独立被试数，本文不把1500条记录当作1500个人。</p>
  </section>
  <section id="study-search"><h2>搜索：两人的方向一致，结论暂时停在这里</h2>
    <p>在符合预定规则的P01、P02中，原联合搜索的斜率都高于特征搜索，也高于分区联合搜索（图1）。平均原联合−特征差为${f(e["S-R"].mean)} ms/item，原联合−分区差为${f(e["S-I"].mean)} ms/item。两人呈现了预期模式，人数不足以支撑稳定的复现或改进结论。</p>
    ${fig("01_search", "两名有效参与者的目标存在RT曲线和搜索斜率；原联合均高于特征与分区联合", "仅用主分析可用的P01、P02。左侧浅线为个人条件均值，粗线为两人均值；右侧每条线对应一人。不把P03–P05的可用单条件均值混进主比较曲线。", 1)}
    <p>原研究表1的目标存在斜率为特征3.1、联合28.7 ms/item；本样本两人的对应均值为${f(m("feature_original", "metric", ["P01", "P02"]))}、${f(m("conjunction_original", "metric", ["P01", "P02"]))} ms/item。联合更陡的方向一致，绝对数值不完全相同。原实验使用速示器和大量练习，本项目改用浏览器，统一替换了配色，也缩短了练习，数值不能当作严格等效检验。</p>
    ${fig("02_search_quality", "五名参与者的搜索正确率及最小有效条件格次数，P03至P05原联合少于8次", "左图纵轴从88%开始，用于看正确率差异，非数量柱图。右图数字为四个目标存在格中的最少有效正确RT数；浅橙格未达8次门槛。", 2)}
    <p>把五人的准确率作为辅助描述，分区比原联合平均高${f(-aux("S-I", "accuracy").mean * 100)}个百分点，五人均同向；并未出现平均准确率下降的表面代价。但五人的正确RT差并不一致，其中两人在分区条件反而更慢。这个辅助结果不能填补三人缺失的主要斜率，也不足以宣布搜索改进已被验证。</p>
  </section>
  <section id="study-graph"><h2>比例判断：误差下降比较一致，时间收益因人而异</h2>
    <p>五名参与者的柱图、辅助饼图误差都低于原饼图，两项配对差值全部为正（图3）。柱图与原饼图的比较回答经典效应是否出现，原饼图与辅助饼图的比较回答对照尺是否有帮助。以下分析均按这五人等权汇总。</p>
    ${fig("03_graph_error", "五名参与者在柱图、原饼图、辅助饼图的log误差和绝对百分点误差配对图", "每个小点代表一人的条件均值，细线连接同一人；深色菱形为五人均值。两种误差均越低越好。P04辅助条件基于19次，其余条件20次；先算个人均值，五人等权。", 3)}
    <p>原饼图−柱图的平均log误差差为${f(e["G-R"].mean)}，95%CI为${e["G-R"].ci.map((z) => f(z)).join("至")}；原饼图−辅助饼图为${f(e["G-I"].mean)}，95%CI为${e["G-I"].ci.map((z) => f(z)).join("至")}。换成直观的绝对误差，对照尺平均减少${f(aux("G-I", "mae").mean)}个百分点。两项双侧精确p均为0.0625，四项族Holm校正后均为0.250，未达到0.05。</p>
    <p>bootstrap区间没有跨0和精确检验未达显著可以同时出现：它们采用不同计算方式，且五人的重采样分布很离散。当前可以说这五人都呈现了预期方向，不能据此把区间解释为总体效果已得到确认。辅助饼图与柱图谁更好没有预定主检验，本文不另挑一个有利比较作结论。</p>
    ${table(
      "表3．五名参与者的比例判断表现",
      ["条件", "平均log误差", "平均绝对误差（百分点）", "平均回答时间（ms）"],
      C.GRAPH_MODES.map((v) => [
        names[v],
        avgSD(v, "metric"),
        avgSD(v, "mae"),
        avgSD(v, "rt", 0),
      ]),
      "各列为个人均值的M (SD)，并非把所有试次混合后的SD。log误差允许负值；百分点误差与log误差不可直接互换。",
    )}
    ${fig("04_graph_time", "五个人的比例判断平均回答时间，P04辅助条件比原饼图更慢", "细线与小点为个人，深色菱形为五人均值。P04使用对照尺时变慢约1831ms，其余四人变快。回答时间来自有效判断，含阅读和输入，不能直接解释为纯知觉耗时。", 4)}
    <p>原饼图到辅助饼图，平均回答时间缩短${f(aux("G-I", "rt").mean, 0)}ms，但P04多用了约1831ms（图4）。因此，平均精度收益没有伴随平均时间增加，个体层面的代价却仍在。共同基线可能改变了判断策略，也可能让部分人花时间检查两种表达；本实验没有眼动或过程访谈来区分这些解释。</p>
  </section>
  <section><h2>四项预测放在一起看</h2>
    ${fig("05_effects", "四项预定比较的个人配对差值，搜索2人，图形5人，正值符合预测", "符号区分参与者，橙色菱形为均值，虚线为零差。两面板单位不同。搜索主比较仅P01、P02可用，图形主比较五人均可用。这里不以星号或颜色宣告显著。", 5)}
    ${effectTable(d.all, "表4．全体样本中四项预定对比的实际可用结果")}
  </section>
  <section id="study-conclusion"><h2>这次结果能支持到哪一步</h2>
    <p>对照收数前四项预测：搜索复现和分区改进都只有两人的方向支持，证据不足；图形复现和对照尺改进均在五人中同向，呈现了预期模式，但精确检验未达显著。这里将“本样本有这一模式”和“总体效果已得到确认”分开判断。</p>
    <p>搜索部分只在两名可用参与者身上看到联合比特征更费时、分区斜率更低的模式。原联合30项格的缺失集中在另外三人，留下的两人可能更擅长这类任务。这个选择限制很具体，不能只写一句“小样本有局限”就带过。后续若继续研究，应在新的收数前版本中增加每格试次数或重新论证质量门槛，现有数据仍按原规则保留。</p>
    <p>比例判断与Cleveland和McGill报告的柱图优势方向一致。原文按判断单元跨人使用中均值等稳健汇总，本作业采用个人条件均值配对，不能直接把两者数值作等效比较。共同基线对照尺在五人中一致降低误差，符合位置／长度参照有助于比例比较的预期。它额外提供了冗余表达，收益可以来自使用长度线索；这项结果不能证明参与者的角度知觉本身得到改善，也不能排除多看一处信息带来的策略变化。</p>
    <p>五人的条件顺序只近似平衡，练习、疲劳和迁移仍可能参与结果；设备与显示尺寸未统一，刺激也未作个体等亮度标定。年龄、性别和招募背景没有记录，无法判断样本代表性。当前最清楚的发现是这五人中比例判断的误差方向一致，搜索的总体复现与改进问题仍缺少足够可用数据。</p>
  </section>
  <section id="study-appendix"><h2>附录：核验与复算</h2>
    <details><summary>每人每条件的分析指标</summary>
      ${table(
        "附表A．个人条件均值",
        [
          "编号",
          "条件",
          "主指标",
          "正确率",
          "正确RT / 判断RT（ms）",
          "绝对误差（百分点）",
        ],
        d.conditionRows.map((r) => [
          r.participant,
          names[r.variant],
          f(r.metric),
          r.accuracy === null ? "—" : f(r.accuracy * 100, 2) + "%",
          f(r.rt, 0),
          f(r.mae),
        ]),
        "搜索主指标为ms/item，图形主指标为log₂误差。搜索RT含目标存在和不存在的有效正确试次；主斜率只用目标存在。缺失主指标不补值。",
      )}
    </details>
    <details><summary>顺序与数据时间</summary>
      ${table(
        "附表B．实际任务安排",
        ["编号", "先做", "搜索条件顺序", "图形条件顺序"],
        ["P01", "P02", "P03", "P04", "P05"].map((p) => {
          const a = C.assignment(p);
          return [
            p,
            a.experiments[0] === "visual_search" ? "搜索" : "图形判断",
            a.visual_search.map((v) => names[v]).join(" → "),
            a.graphical_judgment.map((v) => names[v]).join(" → "),
          ];
        }),
      )}
      <p>数据快照：2026年11月9日19:40:56（北京时间），项目W2UGHD。最后一条记录接收于当日19:21:31；CSV、JSON导出相隔2秒，记录与试次一致。全量原件不包含在公开网站中。</p>
    </details>
    <h3>分析材料</h3>
    <p>公开匿名<a href="${prefix}../data/summary/conditions.csv" download>条件汇总CSV</a>、<a href="${prefix}../data/summary/paired-effects.csv" download>个人配对效应CSV</a>、<a href="${prefix}../data/summary/analysis.json" download>完整汇总JSON</a>及<a href="${prefix}../data/summary/verification.json">独立核验记录</a>。分析使用项目原有JavaScript统计核心，Python独立核验均值、斜率、SD、区间和检验，R＋ggplot2绘图。图件使用统一配色、形状和微软雅黑，提供SVG、矢量PDF及600dpi PNG。</p>
    <p class="study-note">下载链接不依赖老师平台或浏览器本机记录。原始导出带会话与设备信息，仅留本地data/raw备份及老师平台；网页不包含下载密钥。完整方法与改动见项目docs，预登记文件保留原样。</p>
    <h3>AI使用说明与作者复核</h3>
    <p>AI协助整理文献、比较方案、编程、排错、统计复算、绘图及起草文字；humanizer-chinese用于删去套话、调整句子节奏，report-doctor用于核对结论和证据是否相称。研究问题、四项预测和设计已由学生在收数前讨论确认。本文数值来自真实导出，未用模拟或体验数据补样本。2026年11月10日学生授权最终提交；数据解释与设计取舍由学生负责，AI及程序核验不替代个人理解。</p>
    <h3>参考文献</h3>
    <ol class="study-references">
      <li>Treisman, A. M., &amp; Gelade, G. (1980). A feature-integration theory of attention. <em>Cognitive Psychology, 12</em>(1), 97–136. <a href="https://doi.org/10.1016/0010-0285(80)90005-5">doi:10.1016/0010-0285(80)90005-5</a>。方法和量级参照：Experiment I、表1，102–105页。</li>
      <li>Theeuwes, J. (1996). Parallel search for a conjunction of color and orientation: The effect of spatial proximity. <em>Acta Psychologica, 94</em>(3), 291–307. <a href="https://doi.org/10.1016/S0001-6918(96)00003-0">doi:10.1016/S0001-6918(96)00003-0</a>。分组依据核查到原始摘要，其颜色×朝向操作与本项目字母操作不同。</li>
      <li>Cleveland, W. S., &amp; McGill, R. (1984). Graphical perception: Theory, experimentation, and application to the development of graphical methods. <em>Journal of the American Statistical Association, 79</em>(387), 531–554. <a href="https://doi.org/10.1080/01621459.1984.10478080">doi:10.1080/01621459.1984.10478080</a>。位置—角度实验：图3、4.2–4.5节；原研究该实验分析51人、每类10图×4次判断，本项目每类20图×1次判断。</li>
    </ol>
  </section>
  <footer class="study-footer">注意有迹 · 数据固定于2026年11月9日 · 2026年11月10日课程提交版</footer>
</article>`;
};
// Prefix is relative to the app root or standalone report folder respectively.
const standalone = body("");
const embedded = body("report/", true).replaceAll(
  'href="report/../data/',
  'href="data/',
);
fs.writeFileSync(
  path.join(ROOT, "report/index.html"),
  `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="注意有迹研究报告：5名参与者，搜索有效N=2、比例判断有效N=5。">
<title>注意有迹 · 研究报告</title><link rel="icon" href="../assets/favicon.svg"><link rel="stylesheet" href="report.css"></head>
<body><a class="study-skip" href="#study-title">跳到报告正文</a><main>${standalone}</main></body></html>\n`,
);
fs.writeFileSync(
  path.join(ROOT, "src/final-report.js"),
  "/* Generated by analysis/build-report.cjs. Anonymous fixed report; no raw trials. */\n" +
    "window.LAB_FINAL_REPORT = " +
    JSON.stringify({
      snapshot: d.manifest.snapshot,
      body: embedded,
      verified: true,
    }) +
    ";\n",
);
console.log(
  "Built report/index.html and src/final-report.js from verified fixed summary.",
);
