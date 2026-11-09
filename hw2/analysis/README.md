# 固定快照的复算

本目录只做离线处理，不访问平台、不读取密钥、不修改原件。

## 输入与输出

输入：`data/raw/final-2026-11-09/`中的原始CSV和JSON，文件名与SHA-256见`data/summary/manifest.json`。原件Git忽略，公开克隆不会带原始记录。

输出：

- `data/summary/`：匿名个人条件均值、配对差、曲线、质量和核验清单。
- `report/index.html`：固定研究报告，直接双击可读。
- `report/research-report.pdf`：完整报告的固定A4阅读版，含展开的附录。
- `report/figures/`：五组SVG、600dpi PNG和矢量PDF。
- `src/final-report.js`：同一份报告的离线网页嵌入内容。
- `output/analysis/`：R环境等检查产物，Git忽略。

## 顺序

在项目根目录执行：

```powershell
npm run analyze
npm run verify:data
& 'C:\Program Files\R\R-4.4.3\bin\Rscript.exe' analysis/figures.R
npm run report:build
# 可选：用Playwright CLI打开本地report/index.html，
# 再以run-code --filename analysis/export-pdf.js导出A4 PDF。
npm test
```

网页运行只需要浏览器。复算额外需要Node.js、Python 3（核验脚本只用标准库）、R及ggplot2、patchwork、jsonlite、svglite、ragg；Windows图件使用Microsoft YaHei。可按实际安装位置调整Rscript路径。已验证R 4.4.3、Node 24、Python 3.12。

公开仓库中的汇总文件足够重画图和重建报告；重新核对CSV/JSON或从试次重算需研究者本地原始备份，或从老师平台合法下载的同一快照。不要把下载密钥提交到仓库。

修改报告后如需更新固定PDF，先执行`npm run report:build`，运行`npm start`，再在另一终端执行：

```powershell
npx --yes --package @playwright/cli playwright-cli -s=hw2-pdf open http://127.0.0.1:8772/report/index.html
npx --yes --package @playwright/cli playwright-cli -s=hw2-pdf run-code --filename analysis/export-pdf.js
npx --yes --package @playwright/cli playwright-cli -s=hw2-pdf close
```

导出后逐页检查PDF；这一步仅更新阅读材料，不发送任何实验数据。普通网页运行不需要安装Playwright。

## 冻结口径

`analyze.cjs`复用收数前的`src/core.js`，不改阈值。每个范式按匿名编号取首次完整、协议一致的记录；本快照恰好10条，没有重复。核验试次连续编号、条件数、既定顺序、原始种子生成的刺激、颜色确认、图形比率和误差。

`verify.py`独立读CSV与JSON，核对所有试次字段（平台CSV只在每条记录第一行填写meta，其余meta留空）。另行实现有效反应判定、均值、回归斜率、SD、随机数、2500次bootstrap、精确符号翻转和四项Holm，容许浮点运算1e-10级舍入差异，不放宽数据质量门槛。

四个bootstrap种子依次为`S-R`、`S-I`、`G-R`、`G-I`，使用收数前Mulberry32实现及线性分位数插值。附加准确率、MAE和RT的种子见脚本，属于辅助描述。原始p仅N≥5时计算。Holm族大小固定4，缺少p的搜索项不将族缩成2。

## 样本和结论

本报告将最终导出的P01–P05统一作为研究样本，公开汇总只保留全体样本的`all`结果。样本范围较收数前草案作了调整；试次质量标准、主指标、四项比较及统计方法不变。收数前草案保留原样，原始作答、补传和接收时间仍保留在本地记录中。

搜索主效应仅2人可用，不能写成“5人复现成功”。图形主效应5人可用、方向全同，但双侧精确p最小0.0625，两项实际Holm p均0.250。正向bootstrap区间不等同于检验显著或总体已确认。
