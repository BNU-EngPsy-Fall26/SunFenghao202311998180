# Fixed report figures. Run from the project root after analyze.cjs and verify.py.
library(ggplot2)
library(patchwork)
library(jsonlite)
dir.create("report/figures", recursive = TRUE, showWarnings = FALSE)
dir.create("output/analysis", recursive = TRUE, showWarnings = FALSE)
d <- fromJSON("data/summary/analysis.json")
conditions <- read.csv("data/summary/conditions.csv", na.strings = c("", "NA"))
curves <- read.csv("data/summary/search-curves.csv", na.strings = c("", "NA"))
quality <- read.csv("data/summary/quality.csv", na.strings = c("", "NA"))
paired <- read.csv("data/summary/paired-effects.csv", na.strings = c("", "NA"))
colors <- c("#4E79A7", "#7F7F7F", "#D95F02")
theme_set(theme_minimal(base_size = 11, base_family = "Microsoft YaHei") +
  theme(panel.grid.minor = element_blank(),
        panel.grid.major = element_line(color = "#e6e9e7", linewidth = .35),
        panel.grid.major.x = element_blank(),
        axis.title = element_text(size = 11),
        axis.text = element_text(size = 10, color = "#374740"),
        plot.title = element_text(size = 12, face = "bold", margin = margin(b = 12)),
        plot.margin = margin(14, 18, 10, 10),
        legend.position = "bottom",
        legend.title = element_blank(),
        legend.text = element_text(size = 10),
        strip.text = element_text(size = 11, hjust = 0),
        strip.background = element_blank()))
export <- function(p, name, width = 9.6, height = 4.4) {
  base <- paste0("report/figures/", name)
  ggsave(paste0(base, ".svg"), p, width = width, height = height, bg = "white",
         device = svglite::svglite)
  ggsave(paste0(base, ".png"), p, width = width, height = height, dpi = 600,
         bg = "white", device = ragg::agg_png)
  ggsave(paste0(base, ".pdf"), p, width = width, height = height,
         bg = "white", device = cairo_pdf)
}
smodes <- c("feature_original", "conjunction_original", "conjunction_grouped")
gmodes <- c("bar_original", "pie_original", "pie_aligned_aid")
slabels <- c("特征", "原联合", "分区联合")
glabels <- c("柱图", "原饼图", "饼图＋对照尺")
scale_cond <- function(labels) list(
  scale_color_manual(values = colors, labels = labels),
  scale_shape_manual(values = c(16, 17, 15), labels = labels))
set_variant <- function(df, modes) {
  df$variant <- factor(df$variant, levels = modes)
  df
}
sc <- set_variant(subset(curves, present == "true" &
  participant %in% c("P01", "P02")), smodes)
scmean <- aggregate(rt ~ variant + size, sc, mean)
p1 <- ggplot(sc, aes(size, rt, color = variant, shape = variant)) +
  geom_line(aes(group = interaction(participant, variant)), alpha = .28,
            linewidth = .5) +
  geom_point(alpha = .48, size = 1.4) +
  geom_line(data = scmean, aes(group = variant), linewidth = .85) +
  geom_point(data = scmean, size = 2.5) +
  scale_x_continuous(breaks = c(1, 5, 15, 30)) +
  scale_cond(slabels) + labs(x = "集合大小（项）", y = "目标存在的正确RT（ms）",
                            title = "随集合大小变化的反应时间")
ss <- set_variant(subset(conditions, experiment == "visual_search" &
  participant %in% c("P01", "P02")), smodes)
p2 <- ggplot(ss, aes(variant, metric, group = participant)) +
  geom_line(color = "#b9c2bd", linewidth = .6) +
  geom_point(aes(color = variant, shape = variant), size = 2.5) +
  geom_text(data = subset(ss, variant == "conjunction_grouped"),
            aes(label = participant), nudge_x = .18, hjust = 0, size = 3.2) +
  scale_cond(slabels) + scale_x_discrete(labels = slabels, expand = expansion(add = .65)) +
  labs(x = NULL, y = "个人搜索斜率（ms/item）", title = "两名可用参与者的斜率") +
  theme(legend.position = "none")
export(p1 + p2 + plot_layout(widths = c(1.25, 1)), "01_search", 10.2, 4.5)

sq <- set_variant(subset(quality, experiment == "visual_search"), smodes)
sq$participant <- factor(sq$participant, levels = rev(paste0("P0", 1:5)))
p3 <- ggplot(sq, aes(variant, accuracy * 100, group = participant)) +
  geom_line(color = "#c4ccc7", linewidth = .5) +
  geom_point(aes(color = variant, shape = variant), size = 2.5) +
  scale_cond(slabels) + scale_x_discrete(labels = slabels) +
  scale_y_continuous(limits = c(88, 100), breaks = c(90, 95, 100)) +
  labs(x = NULL, y = "正确率（%）", title = "五人的搜索正确率") +
  theme(legend.position = "none")
p4 <- ggplot(sq, aes(variant, participant)) +
  geom_point(aes(size = minimum_present_cell, color = main_metric_available), shape = 15) +
  geom_text(aes(label = minimum_present_cell), color = "#233a32", size = 3.6) +
  scale_x_discrete(labels = slabels) +
  scale_size_continuous(range = c(11, 15), guide = "none") +
  scale_color_manual(values = c("false" = "#f3d7be", "true" = "#dfe9e3"), guide = "none") +
  labs(x = NULL, y = NULL, title = "四个目标存在格中的最少有效次数") +
  theme(panel.grid = element_blank())
export(p3 + p4, "02_search_quality", 9.6, 4.1)

gg <- set_variant(subset(conditions, experiment == "graphical_judgment"), gmodes)
graph_panel <- function(field, ylabel, title, label = FALSE) {
  p <- ggplot(gg, aes(variant, .data[[field]], group = participant)) +
    geom_line(color = "#c3cbc6", linewidth = .5) +
    geom_point(aes(color = variant, shape = variant), size = 2.4) +
    stat_summary(aes(group = variant), fun = mean, geom = "point",
                 color = "#263e35", shape = 18, size = 3.6) +
    scale_cond(glabels) + scale_x_discrete(labels = glabels,
      expand = expansion(add = c(.45, if (label) .8 else .45))) +
    labs(x = NULL, y = ylabel, title = title) +
    theme(legend.position = "none")
  if (label) {
    label_data <- subset(gg, variant == "pie_aligned_aid")
    label_data <- label_data[order(label_data[[field]]), ]
    label_data$label_y <- label_data[[field]]
    for (i in 2:nrow(label_data))
      label_data$label_y[i] <- max(label_data$label_y[i],
                                   label_data$label_y[i - 1] + 240)
    p <- p + geom_segment(data = label_data,
      aes(x = 3.05, xend = 3.15, y = .data[[field]], yend = label_y),
      color = "#9aa9a1", linewidth = .35) +
      geom_text(data = label_data, aes(y = label_y, label = participant),
                nudge_x = .19, hjust = 0, size = 3.1)
  }
  p
}
export(graph_panel("metric", "个人平均log₂误差", "预定主要指标") +
         graph_panel("mae", "个人平均绝对误差（百分点）", "直观的辅助指标"),
       "03_graph_error", 9.6, 4.3)
export(graph_panel("rt", "个人平均回答时间（ms）", "精度收益有没有时间代价？", TRUE),
       "04_graph_time", 7, 4.1)

ef <- subset(paired, cohort == "all" & !is.na(value))
ef$key <- factor(ef$key, levels = c("S-R", "S-I", "G-R", "G-I"))
ef$participant <- factor(ef$participant, levels = paste0("P0", 1:5))
effect_panel <- function(keys, title, ylabel) {
  a <- subset(ef, key %in% keys)
  ggplot(a, aes(key, value)) + geom_hline(yintercept = 0, color = "#697a72",
    linetype = 2, linewidth = .5) +
    geom_point(aes(shape = participant), position = position_dodge(width = .45),
               size = 2.4, color = "#3f6256") +
    stat_summary(fun = mean, geom = "point", color = "#D95F02", shape = 18, size = 4) +
    labs(x = NULL, y = ylabel, title = title) +
    scale_shape_manual(values = c(16, 17, 15, 1, 2), drop = FALSE) +
    theme(legend.position = "bottom")
}
export((effect_panel(c("S-R", "S-I"), "搜索：有效N＝2", "个人差值（ms/item）") +
          theme(legend.position = "none")) +
         effect_panel(c("G-R", "G-I"), "比例判断：有效N＝5", "个人差值（log单位）") +
         plot_layout(guides = "collect"),
       "05_effects", 9.6, 4.1)
writeLines(capture.output(sessionInfo()), "output/analysis/R-sessionInfo.txt")
cat("Saved five figure sets: SVG, vector PDF and 600-dpi PNG.\n")
