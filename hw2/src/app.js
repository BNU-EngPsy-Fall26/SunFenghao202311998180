(function () {
  "use strict";
  const C = window.LabCore,
    S = window.LabStore,
    R = window.LabRender,
    G = window.LabCharts,
    CFG = window.LAB_CONFIG;
  const $ = (s) => document.querySelector(s),
    esc = G.esc,
    f = G.f,
    main = $("#main");
  const modeNames = {
    preview: "快速体验",
    pilot: "完整试运行",
    formal: "正式收数",
  };
  let active = null,
    timer = null,
    frame = null,
    epoch = 0,
    toastTimer,
    reportMode = "formal",
    remoteSessions = [],
    reportSource = "local",
    lastReport = "";
  const project = () =>
    String(CFG.project || S.settings().project || "")
      .trim()
      .toUpperCase();
  const collectionReady = () =>
    CFG.collectionEnabled &&
    /^[a-f0-9]{40}$/i.test(CFG.preregistrationCommit) &&
    /^[A-Z0-9]{6}$/.test(project());
  const isDesktop = () =>
    matchMedia("(pointer:fine)").matches && innerWidth >= 800;
  const icon = (type) =>
    type === "arrow" ? "↗" : type === "check" ? "✓" : "＋";
  function toast(text) {
    $("#toast").textContent = text;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      4200,
    );
  }
  function bind(selector, event, fn) {
    const el = $(selector);
    if (el) el.addEventListener(event, fn);
  }
  function navigate(hash) {
    location.hash = hash;
  }
  function badge(mode) {
    return `<span class="mode-badge ${mode}">${modeNames[mode]}</span>`;
  }
  function getModes(experiment) {
    return experiment === "visual_search" ? C.SEARCH_MODES : C.GRAPH_MODES;
  }
  function plans(session, experiment, variant) {
    return experiment === "visual_search"
      ? C.searchPlan(session.seed, variant, session.mode)
      : C.graphPlan(session.seed, variant, session.mode, session.participant);
  }
  function number(v, d = 1, suffix = "") {
    return Number.isFinite(v) ? `${f(v, d)}${suffix}` : "—";
  }
  function drawHomePreviews() {
    document.querySelectorAll("canvas[data-preview]").forEach((canvas) => {
      const type = canvas.dataset.preview;
      if (type === "search")
        R.search(canvas, {
          variant: "conjunction_grouped",
          set_size: 15,
          present: true,
          rep: 0,
          seed: 828,
        });
      else {
        const trial = C.graphPlan(
          "home",
          "pie_aligned_aid",
          "preview",
          "P01",
        )[0];
        R.graph(canvas, trial);
      }
    });
  }
  function home() {
    const query = new URLSearchParams(location.search),
      recruitment = query.get("mode") === "formal";
    const saved = S.all()
      .filter(
        (s) =>
          s.protocol === CFG.protocol &&
          !s.done &&
          s.status !== "abandoned" &&
          (!recruitment ||
            (s.mode === "formal" &&
              (!query.get("participant") ||
                s.participant === query.get("participant")))),
      )
      .slice(-1)[0];
    const next =
      "P" + String(S.all().filter((s) => s.done).length + 1).padStart(2, "0");
    main.innerHTML = `<section class="hero"><div class="hero-copy"><p class="eyebrow"><span class="tiny-dot"></span> FIELD STUDY 02 / 工程心理学</p><h1>看见，<br>不止于<span>看见。</span></h1><p class="hero-lead">找一个目标，读一张图。<br>让注意的过程，留下可观察的证据。</p><a href="#start-panel" class="text-link">开始一段观察 <span>↓</span></a></div><div class="hero-art" aria-hidden="true"><div class="art-caption">A SMALL ATLAS OF ATTENTION</div><div class="letter-field"><b>T</b><b>X</b><b>T</b><b>X</b><b>X</b><b>T</b><b class="found">T<span>目标 / TARGET</span></b><b>X</b><b>T</b><b>X</b><b>T</b><b>X</b></div><div class="art-note"><span>01 / FIND</span><i></i><span>02 / COMPARE</span></div></div></section>
    <section class="experiment-overview"><div class="section-intro"><p class="eyebrow">TWO EXPERIMENTS, ONE QUESTION</p><h2>信息怎样组织，<br>会让判断更容易？</h2><p>从经典范式出发，比较原有条件与新的显示设计。</p></div><article class="experiment-card"><div class="card-top"><span class="card-no">01</span><span class="label">W6 · 选择与搜索</span></div><canvas data-preview="search" class="card-preview" aria-label="颜色分区搜索示意"></canvas><h3>在众多之中，找到一个。</h3><p>特征搜索 / 联合搜索 / 颜色空间分区</p><div class="card-foot"><span>240 次正式判断</span><span>反应时间 × 准确率</span></div></article><article class="experiment-card"><div class="card-top"><span class="card-no">02</span><span class="label">W7 · 显示与判断</span></div><canvas data-preview="graph" class="card-preview" aria-label="饼图与共同基线对照尺示意"></canvas><h3>看起来，究竟差多少？</h3><p>柱图 / 饼图 / 饼图＋共同基线对照尺</p><div class="card-foot"><span>60 次正式估计</span><span>估计误差 × 回答时间</span></div></article></section>
    <section id="start-panel" class="start-panel"><div><p class="eyebrow">TAKE YOUR PLACE</p><h2>准备好，开始观察。</h2><p>无需登录。使用匿名编号，在安静的环境中完成。</p><div class="start-notes"><span>01　先读说明与练习</span><span>02　电脑与键盘体验更佳</span><span>03　可暂停，也可分两次完成</span></div>${saved ? `<button class="button secondary resume-button" id="resume">继续 ${esc(saved.participant)} 的未完成${modeNames[saved.mode]} ↗</button>` : ""}</div><form id="start-form"><label class="field-label" for="participant">匿名编号 <small>仅英文字母、数字、下划线或短横线</small></label><input id="participant" name="participant" pattern="(?:[A-Za-z0-9_]|-){2,24}" maxlength="24" value="${next}" autocomplete="off" required aria-describedby="participant-help"><p class="field-hint" id="participant-help">例如 P01。同一个人分次参加，请沿用同一编号。</p><fieldset class="segmented"><legend>选择模式</legend><label><input type="radio" name="mode" value="preview" checked><span>快速体验<small>36 次 · 了解流程</small></span></label><label><input type="radio" name="mode" value="pilot"><span>完整试运行<small>300 次 · 原协议长度</small></span></label></fieldset><label class="field-label" for="scope">本次完成</label><select id="scope"><option value="both">两个实验（顺序按编号平衡）</option><option value="visual_search">只做视觉搜索</option><option value="graphical_judgment">只做图形比例判断</option></select><button class="button primary start-button" type="submit">阅读参与说明 <span>→</span></button><p class="field-hint mode-note">体验和试运行数据只保存在本机，不上传到老师平台、不计入正式研究。</p><button type="button" id="formal-start" class="text-link formal-entry" ${!collectionReady() || !isDesktop() ? "disabled" : ""}>${collectionReady() ? "进入正式参与流程 →" : "正式收数 · 待体验确认与预登记提交后开放"}</button></form></section>
    <section class="quiet-note"><span class="cross-mark">＋</span><p>每一种设计，都值得被认真检验。<br><small>结果可以支持预测，也可以提出新的问题。</small></p><a href="#about" class="text-link">阅读研究依据 ↗</a></section>`;
    drawHomePreviews();
    if (recruitment) {
      [
        ".hero",
        ".experiment-overview",
        ".quiet-note",
        ".segmented",
        ".formal-entry",
      ].forEach((selector) => {
        $(selector).hidden = true;
      });
      $(".start-panel h2").textContent = "参加正式实验";
      $(".start-panel > div > p:not(.eyebrow)").textContent =
        "使用研究者分配的匿名编号，在电脑上完成两个实验。";
      $(".mode-note").textContent =
        "共300次判断，另有练习，可中途休息。每完成一个实验会上传一次，请等到显示平台已确认。";
      $("#participant").value = /^[A-Za-z0-9_-]{2,24}$/.test(
        query.get("participant") || "",
      )
        ? query.get("participant")
        : "";
      $("#participant").placeholder = "研究者分配的编号，例如 P01";
      $("#participant-help").textContent =
        "每人使用不同编号；再次打开或分次完成请沿用原编号。";
      if (!collectionReady()) {
        $(".start-button").disabled = true;
        $(".mode-note").textContent = "正式收数尚未开放，请稍后再来。";
      }
    }
    bind("#start-form", "submit", (e) => {
      e.preventDefault();
      openConsent(
        $("#participant").value.trim(),
        recruitment ? "formal" : $("input[name=mode]:checked").value,
        $("#scope").value,
      );
    });
    bind("#formal-start", "click", () =>
      openConsent($("#participant").value.trim(), "formal", $("#scope").value),
    );
    bind("#resume", "click", () => {
      if (!isDesktop()) {
        toast("请在电脑浏览器中继续实验，保持原有输入方式。");
        return;
      }
      startRun(saved);
    });
  }
  function openConsent(participant, mode, scope) {
    if (!/^[A-Za-z0-9_-]{2,24}$/.test(participant)) {
      toast("请使用2–24位匿名编号，例如 P01。");
      return;
    }
    if (!isDesktop()) {
      toast(
        "反应时实验需要电脑、键盘及至少800px宽的窗口。手机可以阅读报告和研究说明。",
      );
      return;
    }
    if (mode === "formal" && !collectionReady()) {
      toast("正式收数尚未开放。");
      return;
    }
    const modal = $("#modal-root");
    modal.innerHTML = `<div class="modal-backdrop"><section class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title" tabindex="-1"><p class="eyebrow">BEFORE WE BEGIN</p><h2 id="consent-title">参与说明与知情同意</h2>${badge(mode)}<p>你将进行视觉搜索或图形比例判断。请按照说明作答，过程中可以休息、暂停或退出。</p><ul class="consent-list"><li>仅记录匿名编号、答案、反应时间、实验条件及基本设备信息。不需要姓名、学号、摄像头或麦克风。</li><li>${mode === "formal" ? "完成一个实验后，数据会上传到课程注意实验室。项目管理者及教师可核验记录；匿名记录也可按项目码读取并用于本研究报告。" : "本次是体验或试运行。记录保存在当前浏览器，不向老师平台发送；你可以自行导出。"}</li><li>退出不受惩罚。若需撤回已上传数据，可用匿名编号联系研究者；本机记录可在浏览器存储中管理。</li><li>浏览器计时不能完全消除屏幕、键盘与设备延迟，研究采用同一人条件间比较。</li></ul><label class="consent-check"><input type="checkbox" id="consent-check">我已阅读，自愿参与，并理解数据的保存与使用方式。</label><div class="button-row"><button class="button secondary" id="cancel-consent">返回</button><button class="button primary" id="accept-consent" disabled>同意并继续 →</button></div></section></div>`;
    const previous = document.activeElement;
    $(".consent-modal").focus();
    const close = () => {
      modal.innerHTML = "";
      previous?.focus();
    };
    bind("#cancel-consent", "click", close);
    bind(
      "#consent-check",
      "change",
      (e) => ($("#accept-consent").disabled = !e.target.checked),
    );
    bind("#accept-consent", "click", () => {
      const assign = C.assignment(participant),
        selected = scope === "both" ? assign.experiments : [scope],
        id = crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const session = {
        id,
        participant,
        mode,
        protocol: CFG.protocol,
        build: CFG.build,
        seed: id,
        createdAt: new Date().toISOString(),
        consentAt: new Date().toISOString(),
        selected,
        assignment: assign,
        tasks: {},
        cursor: { experiment: 0, variant: 0, trial: 0 },
        practiceDone: {},
        practiceSummary: [],
        device: {
          ua: navigator.userAgent.slice(0, 80),
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio || 1,
        },
        done: false,
        status: "in_progress",
      };
      selected.forEach(
        (exp) =>
          (session.tasks[exp] = {
            trials: [],
            complete: false,
            upload: { status: mode === "formal" ? "pending" : "local_only" },
          }),
      );
      S.save(session);
      close();
      startRun(session);
    });
    $(".consent-modal").addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const focusable = [
          ...modal.querySelectorAll("button:not(:disabled),input"),
        ];
        if (e.shiftKey && document.activeElement === focusable[0]) {
          e.preventDefault();
          focusable.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === focusable.at(-1)) {
          e.preventDefault();
          focusable[0].focus();
        }
      }
    });
  }
  function cancelTimers() {
    epoch++;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
  }
  function startRun(session) {
    if (session.protocol !== CFG.protocol) {
      toast("实验配色已更新，请开始一次新体验。旧记录仍可导出备份。");
      return;
    }
    cancelTimers();
    active = {
      session,
      phase: "guide",
      locked: true,
      practice: false,
      practiceRound: 0,
      practiceResponses: [],
      practiceIndex: 0,
    };
    document.body.classList.add("running");
    history.pushState(null, "", "#run");
    setNav("run");
    nextBlock();
  }
  function runnerHeader(experiment, variant, practice = false) {
    const s = active.session,
      task = s.tasks[experiment],
      total =
        experiment === "visual_search"
          ? C.settings(s.mode).searchReps * 24
          : C.settings(s.mode).graphCount * 3,
      progress = (task.trials.length / total) * 100;
    return `<div class="run-topbar"><a class="run-brand" href="#home" id="exit-run">← 暂存并退出</a><span>${esc(C.NAMES[experiment])} <i>/</i> ${esc(C.NAMES[variant])}</span>${badge(s.mode)}</div><div class="run-progress"><div style="width:${progress}%"></div></div><div class="run-meta"><span>${esc(s.participant)} · ${practice ? "练习，不计入正式记录" : "判断记录"}</span><span>${task.trials.length} / ${total}</span></div>`;
  }
  function bindExit() {
    bind("#exit-run", "click", (e) => {
      e.preventDefault();
      exitRun();
    });
  }
  function exitRun() {
    if (!active) return;
    if (active.phase === "stimulus") finishTrial({ interrupted: true }, true);
    cancelTimers();
    S.save(active.session);
    active = null;
    document.body.classList.remove("running");
    navigate("home");
  }
  function showColorCheck() {
    const a = active;
    a.phase = "color_check";
    a.locked = true;
    main.innerHTML =
      runnerHeader(a.experiment, a.variant) +
      `
      <section class="guide-panel color-check-panel">
        <p class="eyebrow">BEFORE VISUAL SEARCH</p>
        <h1>先确认，颜色能否分清。</h1>
        <p>请看下面三组字母。你能在当前屏幕上清楚区分它们的颜色吗？<br>无需猜测；这只是本任务的适用性确认，不是色觉诊断。</p>
        <canvas id="color-check-canvas" aria-label="蓝色、橙色、紫红色三组相同字母样本"></canvas>
        <fieldset class="color-check-options"><legend>请选择最符合实际感受的一项</legend>
          <label><input type="radio" name="color-check" value="yes">三种颜色都能清楚区分</label>
          <label><input type="radio" name="color-check" value="no">有颜色分不清，或不确定</label>
        </fieldset>
        <p id="color-check-message" class="color-check-message" role="status" hidden>请先暂停视觉搜索，不需要勉强作答。可以暂存退出，再从首页单独体验图形比例判断。</p>
        <button class="button primary" id="continue-color-check" disabled>确认并继续 →</button>
      </section>`;
    R.colorSamples($("#color-check-canvas"));
    bindExit();
    document.querySelectorAll('input[name="color-check"]').forEach((input) => {
      input.addEventListener("change", () => {
        $("#continue-color-check").disabled = input.value !== "yes";
        $("#color-check-message").hidden = input.value !== "no";
      });
    });
    bind("#continue-color-check", "click", () => {
      if ($('input[name="color-check"]:checked')?.value !== "yes") return;
      a.session.colorCheck = {
        palette: C.SEARCH_PALETTE.id,
        confirmedAt: new Date().toISOString(),
      };
      S.save(a.session);
      nextBlock();
    });
  }
  function nextBlock() {
    cancelTimers();
    const a = active;
    if (!a) return;
    const s = a.session,
      cur = s.cursor;
    if (cur.experiment >= s.selected.length) {
      s.done = true;
      s.status = "complete";
      S.save(s);
      endSession();
      return;
    }
    a.experiment = s.selected[cur.experiment];
    a.variants = s.assignment[a.experiment];
    if (cur.variant >= a.variants.length) {
      finishExperiment();
      return;
    }
    a.variant = a.variants[cur.variant];
    if (
      a.experiment === "visual_search" &&
      s.colorCheck?.palette !== C.SEARCH_PALETTE.id
    ) {
      showColorCheck();
      return;
    }
    a.plan = plans(s, a.experiment, a.variant);
    if (cur.trial >= a.plan.length) {
      cur.variant++;
      cur.trial = 0;
      S.save(s);
      nextBlock();
      return;
    }
    a.phase = "guide";
    a.locked = true;
    const search = a.experiment === "visual_search",
      feature = a.variant === "feature_original",
      practiced = s.practiceDone[`${a.experiment}|${a.variant}`];
    main.innerHTML =
      runnerHeader(a.experiment, a.variant) +
      `<section class="guide-panel"><p class="eyebrow">${cur.experiment + 1} / ${s.selected.length} EXPERIMENT · ${cur.variant + 1} / 3 CONDITION</p><h1>${search ? (feature ? "看到紫红色，或看到 S。" : "只找，蓝色的 T。") : "A，大约是 X 的多少？"}</h1>${search ? `<div class="target-examples">${feature ? `<span style="color:${C.SEARCH_PALETTE.magenta}">X</span><b>或</b><span style="color:${C.SEARCH_PALETTE.blue}">S</span>` : `<span style="color:${C.SEARCH_PALETTE.blue}">T</span>`}</div><p>${feature ? "任意紫红色字母，或任意颜色的 S，出现一个就算有目标。" : "只有蓝色的 T 算目标。蓝色 X、橙色 T 都不是目标。"}<br>请又快又准地判断，不需要记住字母位置。</p><div class="key-guide"><span><kbd>F</kbd> 有目标</span><span><kbd>J</kbd> 无目标</span></div>` : `<div class="ratio-example"><span>A</span><i></i><strong>÷</strong><span>X</span><i></i><strong>× 100%</strong></div><p>X 已标明最大项。估计指定项 A 是 X 的百分之几。<br>请作目测判断，不用尺子、不精确计算。输入 0–100，按 Enter 提交。</p><div class="guide-callout">例如 A = 20，X = 40，应回答 <b>50</b>。<br><small>分母是最大项 X，不是五项之和。</small></div>`}<p class="guide-length">本段 ${a.plan.length} 次${s.mode === "preview" ? "体验" : s.mode === "formal" ? "正式" : "正式长度试运行"}判断 · ${search ? "每40次可休息" : "每段结束可休息"}</p>${practiced ? `<p class="field-hint">该条件练习已完成。将从第 ${cur.trial + 1} 次判断继续。</p><button class="button primary" id="begin-block">继续这一段 →</button>` : `${!search ? '<fieldset class="comprehension"><legend>开始前确认：A = 20，X = 40，应填？</legend><label><input type="radio" name="quiz" value="20">20</label><label><input type="radio" name="quiz" value="50">50</label><label><input type="radio" name="quiz" value="60">60</label></fieldset>' : ""}<button class="button primary" id="begin-practice">先练习 ${search ? C.settings(s.mode).searchPractice : C.settings(s.mode).graphPractice} 次 →</button><p class="field-hint">练习可看反馈，记录不会混入主实验。</p>`}</section>`;
    bindExit();
    bind("#begin-block", "click", () => {
      a.practice = false;
      nextTrial(true);
    });
    bind("#begin-practice", "click", () => {
      if (!search && $("input[name=quiz]:checked")?.value !== "50") {
        toast("请确认分母：20÷40×100%=50，而不是20。");
        return;
      }
      a.practice = true;
      a.practiceIndex = 0;
      a.practiceResponses = [];
      a.practicePlan = C.practicePlan(
        s.seed,
        a.experiment,
        a.variant,
        s.mode,
        s.participant,
        a.practiceRound,
      );
      nextTrial(true);
    });
  }
  function nextTrial(skipBreak = false) {
    cancelTimers();
    const a = active;
    if (!a) return;
    const s = a.session,
      index = a.practice ? a.practiceIndex : s.cursor.trial,
      list = a.practice ? a.practicePlan : a.plan;
    if (index >= list.length) {
      if (a.practice) {
        practiceComplete();
        return;
      }
      s.cursor.variant++;
      s.cursor.trial = 0;
      S.save(s);
      nextBlock();
      return;
    }
    if (!a.practice && !skipBreak && index > 0 && index % 40 === 0) {
      restScreen();
      return;
    }
    a.trial = list[index];
    a.phase = "fixation";
    a.locked = true;
    a.onset = null;
    const search = a.experiment === "visual_search";
    main.innerHTML =
      runnerHeader(a.experiment, a.variant, a.practice) +
      `<section class="trial-workspace"><div class="trial-heading"><span class="condition-label">${a.practice ? `练习 ${index + 1} / ${list.length}` : `本段 ${index + 1} / ${list.length}`}</span><p>${search ? (a.variant === "feature_original" ? "紫红色或 S · F 有 / J 无" : "蓝色 T · F 有 / J 无") : "估计 A 是 X 的百分之几"}</p><button class="pause-button" id="pause-run" aria-label="暂停本次实验">Ⅱ 暂停</button></div><div class="stimulus-wrap"><canvas id="stimulus" aria-label="${search ? "视觉搜索刺激，请按F或J判断目标存在" : "比例判断刺激，请估计A相对X的百分比"}"></canvas></div><div class="response-panel">${search ? '<button class="response-key" data-response="yes" disabled><kbd>F</kbd><span>有目标</span></button><button class="response-key" data-response="no" disabled><kbd>J</kbd><span>无目标</span></button>' : '<label for="estimate">A / X =</label><input type="number" id="estimate" min="0" max="100" step="0.1" inputmode="decimal" placeholder="0–100" autocomplete="off" disabled><span>%</span><button class="button primary" id="submit-estimate" disabled>记录 <kbd>↵</kbd></button>'}</div><p class="trial-feedback" id="trial-feedback" aria-live="polite">注视中央，准备下一次判断。</p></section>`;
    bindExit();
    bind("#pause-run", "click", () => pauseRun());
    document
      .querySelectorAll("[data-response]")
      .forEach(
        (b) => (b.onclick = () => respondSearch(b.dataset.response === "yes")),
      );
    bind("#submit-estimate", "click", respondGraph);
    R.fixation($("#stimulus"));
    const token = epoch;
    timer = setTimeout(() => {
      if (!active || epoch !== token) return;
      frame = requestAnimationFrame(() => {
        if (!active || epoch !== token) return;
        if (search) R.search($("#stimulus"), a.trial);
        else R.graph($("#stimulus"), a.trial);
        // 在同一rAF回调绘制并记录计时起点。浏览器/设备延迟仍是研究限制。
        a.onset = performance.now();
        a.phase = "stimulus";
        a.locked = false;
        document
          .querySelectorAll(".response-panel button,.response-panel input")
          .forEach((el) => (el.disabled = false));
        if (!search) $("#estimate").focus({ preventScroll: true });
        $("#trial-feedback").textContent = search
          ? "请又快又准地判断。"
          : "输入估计值，按 Enter 记录。";
        timer = setTimeout(
          () => finishTrial({ timeout: true }),
          search ? C.settings(s.mode).timeout : 30000,
        );
      });
    }, C.settings(s.mode).fixation);
  }
  function respondSearch(present) {
    if (
      active?.phase !== "stimulus" ||
      active.locked ||
      active.experiment !== "visual_search"
    )
      return;
    finishTrial({ present });
  }
  function respondGraph() {
    if (
      active?.phase !== "stimulus" ||
      active.locked ||
      active.experiment !== "graphical_judgment"
    )
      return;
    const input = $("#estimate"),
      raw = input?.value.trim(),
      estimate = Number(raw);
    if (!raw || !Number.isFinite(estimate) || estimate < 0 || estimate > 100) {
      toast("请输入0到100之间的估计值。");
      input?.focus();
      return;
    }
    finishTrial({ estimate });
  }
  function finishTrial(response, quiet = false) {
    const a = active;
    if (!a || a.phase !== "stimulus" || a.locked) return;
    const measured = performance.now() - a.onset;
    a.locked = true;
    cancelTimers();
    a.phase = "feedback";
    const t = a.trial,
      search = a.experiment === "visual_search",
      interrupted = !!response.interrupted,
      timeout = !!response.timeout;
    const row = {
      phase: "main",
      protocol: a.session.protocol,
      mode: a.session.mode,
      session_id: a.session.id,
      variant: a.variant,
      trial_index: a.session.tasks[a.experiment].trials.length + 1,
      variant_trial:
        (a.practice ? a.practiceIndex : a.session.cursor.trial) + 1,
      seed: t.seed,
      family: t.family,
      rt: interrupted || timeout ? null : Math.round(measured * 10) / 10,
      interrupted,
      timeout,
    };
    if (search) {
      const stim = C.searchStimulus(t);
      Object.assign(row, {
        set_size: t.set_size,
        present: t.present,
        response:
          interrupted || timeout ? "none" : response.present ? "yes" : "no",
        correct:
          !interrupted && !timeout && response.present === t.present ? 1 : 0,
        target_kind: stim.targetKind,
        palette: C.SEARCH_PALETTE.id,
        color_check: a.session.colorCheck ? "self_report_pass" : "missing",
        group_side: a.variant === "conjunction_grouped" ? stim.side : "mixed",
      });
    } else
      Object.assign(row, {
        estimate_pct: interrupted || timeout ? null : response.estimate,
        true_pct: t.true_pct,
        values: t.values,
        display_order: t.order,
        dataset_id: t.dataset_id,
        target: t.target,
        reference: t.reference,
        log_error:
          interrupted || timeout
            ? null
            : C.logError(response.estimate, t.true_pct),
      });
    if (a.practice) {
      a.practiceResponses.push(row);
      a.practiceIndex++;
    } else {
      a.session.tasks[a.experiment].trials.push(row);
      a.session.cursor.trial++;
      S.save(a.session);
    }
    if (quiet) return;
    R.blank($("#stimulus"));
    document
      .querySelectorAll(".response-panel button,.response-panel input")
      .forEach((el) => (el.disabled = true));
    const feedback = $("#trial-feedback");
    feedback.className =
      "trial-feedback " +
      (search ? (row.correct ? "correct" : "incorrect") : "");
    if (interrupted) {
      showPause(true);
      return;
    }
    if (a.practice) {
      feedback.textContent = search
        ? row.correct
          ? "✓ 正确"
          : `${timeout ? "超时" : "这次判断不正确"} · ${t.present ? "有目标，按 F" : "无目标，按 J"}`
        : `${timeout ? "超时。" : "已记录。"}练习参考：A 约为 X 的 ${f(t.true_pct, 1)}%。`;
    } else
      feedback.textContent = search
        ? timeout
          ? "超时，已记录"
          : row.correct
            ? "✓ 正确，已记录"
            : "判断有误，已记录"
        : timeout
          ? "超时，已记录"
          : "✓ 已记录";
    timer = setTimeout(
      () => nextTrial(),
      a.practice ? 1300 : C.settings(a.session.mode).feedback,
    );
  }
  function practiceComplete() {
    const a = active;
    a.phase = "practice_result";
    const search = a.experiment === "visual_search",
      correct = a.practiceResponses.filter((t) => t.correct === 1).length,
      total = a.practiceResponses.length,
      passed = !search || correct >= Math.ceil(total * 0.75);
    if (passed) {
      const key = `${a.experiment}|${a.variant}`;
      a.session.practiceDone[key] = true;
      a.session.practiceSummary.push({
        experiment: a.experiment,
        variant: a.variant,
        total,
        correct: search ? correct : null,
        round: a.practiceRound,
        passed: true,
      });
      S.save(a.session);
    }
    main.innerHTML =
      runnerHeader(a.experiment, a.variant, true) +
      `<section class="guide-panel"><div class="large-symbol">${passed ? "✓" : "↺"}</div><p class="eyebrow">PRACTICE ${passed ? "COMPLETE" : "AGAIN"}</p><h1>${passed ? "已经准备好了。" : "再熟悉一下规则。"}</h1><p>${search ? `练习中答对 ${correct} / ${total} 次。${passed ? "按相同规则进入下一段。" : "至少答对四分之三后继续，练习可以重来。"}` : "请记住：A 是 X 的百分之几，X 是最大项。"}</p><button class="button primary" id="after-practice">${passed ? "开始本段判断 →" : "重新练习 →"}</button><p class="field-hint">${modeNames[a.session.mode]} · 练习记录不会进入主分析。</p></section>`;
    bindExit();
    bind("#after-practice", "click", () => {
      if (passed) {
        a.practice = false;
        nextTrial(true);
      } else {
        a.practiceRound++;
        nextBlock();
      }
    });
  }
  function restScreen() {
    const a = active;
    a.phase = "rest";
    main.innerHTML =
      runnerHeader(a.experiment, a.variant) +
      `<section class="guide-panel"><p class="eyebrow">TAKE A BREATH</p><h1>给注意力，<br>留一点空白。</h1><p>本段已完成 ${a.session.cursor.trial} 次判断。<br>可以放松双手、看看远处，准备好再继续。</p><button class="button primary" id="continue-rest">继续这一段 →</button></section>`;
    bindExit();
    bind("#continue-rest", "click", () => nextTrial(true));
  }
  function pauseRun() {
    if (!active) return;
    if (active.phase === "stimulus") {
      finishTrial({ interrupted: true });
      return;
    }
    if (active.phase === "fixation") {
      cancelTimers();
      showPause(false);
    }
  }
  function showPause(recorded) {
    const a = active;
    a.phase = "paused";
    main.innerHTML =
      runnerHeader(a.experiment, a.variant, a.practice) +
      `<section class="guide-panel"><p class="eyebrow">PAUSED</p><h1>已暂停。</h1><p>${recorded ? "刚才的刺激因中断被保留为无效记录，不进入反应时间或判断误差分析。" : "刺激尚未开始，本次不会生成反应记录。"}<br>准备好后继续，或暂存并退出。</p><button class="button primary" id="resume-paused">继续 →</button></section>`;
    bindExit();
    bind("#resume-paused", "click", () => nextTrial(true));
  }
  function finishExperiment() {
    const a = active,
      s = a.session,
      experiment = a.experiment,
      task = s.tasks[experiment];
    task.complete = true;
    task.completedAt = new Date().toISOString();
    s.cursor.experiment++;
    s.cursor.variant = 0;
    s.cursor.trial = 0;
    S.save(s);
    a.phase = "experiment_result";
    if (s.mode === "formal" && collectionReady())
      upload(s, experiment)
        .then(() => {})
        .catch(() => {});
    const summary =
      experiment === "visual_search"
        ? C.summarizeSearch(task.trials, s.mode)
        : C.summarizeGraph(task.trials, s.mode);
    main.innerHTML =
      runnerHeader(experiment, a.variant) +
      `<section class="experiment-finish"><p class="eyebrow">EXPERIMENT COMPLETE</p><h1>${C.NAMES[experiment]}<br>记录完成。</h1><p>${task.trials.length} 次判断已保存在当前浏览器。${s.mode !== "formal" ? "本次记录为体验/试运行，不用于正式结论。" : "请确认上传状态并导出一份备份。"}</p>${individualTable(summary, experiment)}<div class="button-row"><button class="button primary" id="continue-experiment">${s.cursor.experiment < s.selected.length ? "继续下一个实验 →" : "查看本次完成情况 →"}</button><button class="button secondary" id="export-current">导出本次 JSON</button></div><p class="field-hint">这些是个人描述性结果，不代表群体研究结论。</p></section>`;
    $(".experiment-finish .button-row").insertAdjacentHTML(
      "beforebegin",
      uploadReceiptHTML(s, experiment),
    );
    bindExit();
    bind("#continue-experiment", "click", nextBlock);
    bind("#export-current", "click", () => exportSession(s));
  }
  function individualTable(summary, experiment) {
    const search = experiment === "visual_search";
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>条件</th><th>${search ? "正确率" : "绝对误差 / 百分点"}</th><th>${search ? "正确RT / ms" : "平均log误差"}</th><th>${search ? "斜率 / ms·item⁻¹" : "有效判断数"}</th></tr></thead><tbody>${getModes(
      experiment,
    )
      .map((m) => {
        const v = summary.variants[m];
        return `<tr><th><span class="series-dot" style="background:${C.COLORS[m]}"></span>${C.NAMES[m]}</th><td>${search ? number(v.accuracy * 100, 1, "%") : number(v.mae)}</td><td>${search ? number(v.rt) : number(v.log, 2)}</td><td>${search ? number(v.slope) : v.n}</td></tr>`;
      })
      .join("")}</tbody></table></div>`;
  }
  function exportSession(session) {
    S.download(
      `attention-${session.participant}-${session.mode}-${session.id.slice(0, 8)}.json`,
      JSON.stringify(
        {
          format: "attention-lab-backup-v1",
          exportedAt: new Date().toISOString(),
          sessions: [session],
        },
        null,
        2,
      ),
    );
  }
  function endSession() {
    const s = active.session;
    active.phase = "done";
    main.innerHTML = `<section class="session-finish"><div class="finish-mark">✓</div><p class="eyebrow">OBSERVATION RECORDED</p><h1>谢谢你的认真观察。</h1><p>${esc(s.participant)} · ${badge(s.mode)}<br>本次完成 ${s.selected.length} 个实验，共 ${S.rows([s]).length} 次判断。</p><div class="local-receipt"><span>本地保存</span><strong>${S.warning() ? "请导出备份" : "已完成"}</strong><span>老师平台</span><strong>${s.mode === "formal" ? "在研究者入口核对上传状态" : "本次不上传"}</strong></div><div class="button-row"><button class="button primary" id="view-session-report">查看${s.mode === "formal" ? "研究" : "体验"}报告 →</button><button class="button secondary" id="export-finished">导出 JSON 备份</button><button class="button secondary" id="export-csv">导出逐试次 CSV</button></div><p class="field-hint">${s.mode === "formal" ? "结果是否支持预测，需要结合全体参与者数据。" : "体验数据和正式研究严格区分，任何模拟记录都不会成为真实被试。"}</p><button class="text-link" id="back-home">回到实验台 ↗</button></section>`;
    if (s.mode === "formal") {
      $(".session-finish .button-row").insertAdjacentHTML(
        "beforebegin",
        Object.keys(s.tasks)
          .map((exp) => uploadReceiptHTML(s, exp))
          .join(""),
      );
      refreshUploadReceipts();
    }
    bind("#view-session-report", "click", () => {
      reportMode = s.mode;
      active = null;
      document.body.classList.remove("running");
      navigate("report");
    });
    bind("#export-finished", "click", () => exportSession(s));
    bind("#export-csv", "click", () =>
      S.download(
        `attention-${s.participant}-${s.mode}.csv`,
        C.csv(S.rows([s])),
        "text/csv;charset=utf-8",
      ),
    );
    bind("#back-home", "click", () => {
      active = null;
      document.body.classList.remove("running");
      navigate("home");
    });
  }
  function uploadReceiptHTML(session, experiment) {
    if (session.mode !== "formal") return "";
    const u = session.tasks[experiment].upload || {},
      messages = (u.warnings || []).map((w) => `<li>${esc(w)}</li>`).join(""),
      details = (u.warning_details || [])
        .map(
          (d) =>
            `<li>${esc(d.field || "字段")}：${esc(d.kind || "改写")}（${esc(d.n_trials ?? "?")}次）</li>`,
        )
        .join("");
    return `<section class="platform-receipt ${u.needsReview || ["failed", "uncertain"].includes(u.status) ? "receipt-warning" : ""}" data-upload-session="${esc(session.id)}" data-upload-experiment="${experiment}" role="status" aria-live="polite"><strong>${C.NAMES[experiment]} · ${u.needsReview ? "平台已接收，字段需要核对" : esc(uploadLabel(u.status))}</strong>${u.record_id ? `<p>记录号：${esc(u.record_id)}</p>` : ""}${u.message ? `<p>${esc(u.message)}</p>` : ""}${u.needsReview ? `<p>${u.possibleDataLoss ? "平台提示可能有数据损失。" : "平台对字段作了处理。"}请导出JSON备份并联系研究者核对，不要重复提交。</p><ul>${messages}${details}</ul>` : ""}${u.status === "uploaded" && !u.needsReview ? "<p>本实验已获得平台回执。</p>" : ""}${["failed", "uncertain"].includes(u.status) ? "<p>请保留JSON备份，联系研究者核对；可在研究者入口查看后重试。</p>" : ""}</section>`;
  }
  function refreshUploadReceipts() {
    document.querySelectorAll("[data-upload-session]").forEach((element) => {
      const s = S.all().find((x) => x.id === element.dataset.uploadSession);
      if (s)
        element.outerHTML = uploadReceiptHTML(
          s,
          element.dataset.uploadExperiment,
        );
    });
    if (active?.session.mode === "formal" && $(".local-receipt")) {
      const uploads = Object.values(active.session.tasks).map((t) => t.upload);
      $(".local-receipt strong:last-child").textContent = uploads.every(
        (u) => u.status === "uploaded",
      )
        ? uploads.some((u) => u.needsReview)
          ? "已接收，字段需核对"
          : "两个实验均已确认"
        : "请查看下方各实验上传状态";
    }
  }
  async function upload(session, experiment, retry = false) {
    if (
      session.mode !== "formal" ||
      !collectionReady() ||
      !session.tasks[experiment].complete
    )
      throw new Error("仅开放后的正式完整实验可上传。");
    const task = session.tasks[experiment];
    if (task.upload.status === "uploaded") return task.upload;
    if (task.upload.status === "uploading") return;
    if (task.upload.status === "uncertain" && !retry)
      throw new Error("上次响应不确定，请先核对老师平台。");
    const payload = {
      project: project(),
      experiment,
      participant: session.participant,
      condition: "",
      trials: task.trials,
      meta: {
        protocol: session.protocol,
        build: session.build,
        mode: session.mode,
        session_id: session.id,
        seed: session.seed,
        consent: session.consentAt,
        order: session.assignment[experiment].join(","),
        ua: session.device.ua,
        w: session.device.width,
        h: session.device.height,
        preregistration: CFG.preregistrationCommit,
      },
    };
    const body = JSON.stringify(payload);
    if (new TextEncoder().encode(body).length > 256 * 1024)
      throw new Error("数据超过老师平台单次256KB限制，请导出并联系研究者。");
    task.upload = {
      status: "uploading",
      attemptedAt: new Date().toISOString(),
    };
    S.save(session);
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(CFG.endpoint + "/api/hw2/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        task.upload = {
          status: "failed",
          message: String(data.msg || `HTTP ${response.status}`),
        };
        S.save(session);
        throw new Error(task.upload.message);
      }
      task.upload = C.submissionReceipt(data);
      S.save(session);
      toast(
        task.upload.needsReview
          ? "平台已接收但返回字段警告，请保留备份并联系研究者。"
          : `${C.NAMES[experiment]}已上传，平台记录已确认。`,
      );
      return task.upload;
    } catch (e) {
      if (task.upload.status !== "failed")
        task.upload = {
          status: "uncertain",
          message: "请求未获确认，可能已被平台接收。请先核对平台后再决定重试。",
        };
      S.save(session);
      toast(task.upload.message);
      throw e;
    } finally {
      clearTimeout(timeout);
      refreshUploadReceipts();
    }
  }
  function effectInterpretation(effect, mode) {
    if (!effect.n) return "有效配对数据不足，暂不判断。";
    if (mode !== "formal") return "仅为体验或试运行描述，不用于正式假设判断。";
    if (effect.n < 5) return "尚不足5名有效配对参与者，先保留描述。";
    if (effect.ci && effect.ci[0] > 0)
      return "差异方向与预测一致；结合效应区间、校正检验及辅助指标判断。";
    if (effect.ci && effect.ci[1] < 0) return "当前差异方向与预测相反。";
    return "区间包含0，当前证据不足以确定差异方向。";
  }
  function report() {
    // 平台会重匿名编号，不能与本机编号直接混合去重；两来源分别分析。
    const useRemote = reportMode === "formal" && reportSource === "teacher";
    const sessions = useRemote ? remoteSessions : S.all(),
      summary = C.groupSummary(sessions, reportMode),
      formal = reportMode === "formal",
      count = summary.searchN + summary.graphN,
      empty = count === 0;
    const effectNames = {
      "S-R": "经典搜索效应",
      "S-I": "空间分区收益",
      "G-R": "经典图形效应",
      "G-I": "对照尺收益",
    };
    const source = useRemote ? "本次读取的平台匿名记录" : "当前浏览器本地记录";
    const body = `<div class="report-toolbar"><div><p class="eyebrow">RESEARCH NOTE / ${esc(CFG.protocol)}</p><h1>观察之后，<br>让证据说话。</h1></div><div class="report-controls"><label for="report-mode">数据范围</label><select id="report-mode"><option value="formal" ${formal ? "selected" : ""}>正式研究</option><option value="pilot" ${reportMode === "pilot" ? "selected" : ""}>完整试运行（非正式）</option><option value="preview" ${reportMode === "preview" ? "selected" : ""}>快速体验（非正式）</option></select><button class="button secondary" id="download-report" ${empty ? "disabled" : ""}>导出本页报告 ↗</button></div></div>
      <div class="report-status ${formal ? "" : "warning"}"><span class="status-dot"></span><div><strong>${formal ? (empty ? "尚未收集正式数据" : "正式数据分析快照") : "体验/试运行报告 · 不进入作业结论"}</strong><p>${formal ? "正式结果只使用协议一致、每范式首次完整的正式会话；有效配对人数按各项比较单独计算。" : "本页只说明流程和计算方式。简短体验的试次数不足以支持正式研究结论。"}</p></div></div>
      <div class="report-metrics"><div><span>视觉搜索完整参与者</span><strong>${summary.searchN}<small>人</small></strong></div><div><span>图形判断完整参与者</span><strong>${summary.graphN}<small>人</small></strong></div><div><span>正式目标</span><strong>${CFG.recruitmentTarget}<small>名他人 / 实验</small></strong></div><div><span>分析时间</span><strong class="date-metric">${new Date().toLocaleDateString("zh-CN")}<small>${esc(source)}</small></strong></div></div>
      ${empty ? '<section class="report-empty"><span>∅</span><h2>这里为真实结果留白。</h2><p>尚无可用于当前范围的完整记录。体验实验后可切换到“快速体验”；正式收数后再检验预测。</p><a class="button secondary" href="#home">去实验台 →</a></section>' : ""}
      <section class="report-section"><div class="report-section-head"><span>01</span><div><p class="eyebrow">VISUAL SEARCH</p><h2>集合变大，搜索需要多长时间？</h2><p>先比较特征与联合搜索，再检查颜色空间分区是否降低搜索斜率。</p></div></div><div class="report-two-col"><figure>${G.lines(summary.search)}${G.legend(C.SEARCH_MODES)}<figcaption>图1. 目标存在时的正确反应RT。先计算个人条件均值，再汇总；不同大小的有效N可能不同，完整口径见数据表。</figcaption></figure><figure>${G.paired(summary.search, "search")}<figcaption>图2. 每名参与者的搜索斜率。小点与细线为个人；大点为均值，区间为被试级bootstrap 95%CI。有效N不足2不绘区间。</figcaption></figure></div>${effectParagraph(summary.effects[0], effectNames["S-R"])}${effectParagraph(summary.effects[1], effectNames["S-I"])}${groupTable(summary.search, "visual_search")}<p class="report-note">原文表1中，目标存在时联合/特征斜率为28.7/3.1 ms/item，仅作原研究参照。浏览器设备、刺激配色、练习量和试次数不同，当前比较不能仅凭斜率证明唯一加工机制。</p></section>
      <section class="report-section"><div class="report-section-head"><span>02</span><div><p class="eyebrow">GRAPHICAL JUDGMENT</p><h2>共同基线，能帮助目测吗？</h2><p>保持“A占最大项X多少”的问题，比较柱图、饼图及辅助饼图。</p></div></div><figure class="wide-figure">${G.paired(summary.graph, "graph")}<figcaption>图3. 个人平均log₂绝对误差，越低越准确；0.125为原文的误差偏移量。图形规则与图2相同。此指标可为负，不是计算错误。</figcaption></figure>${effectParagraph(summary.effects[2], effectNames["G-R"])}${effectParagraph(summary.effects[3], effectNames["G-I"])}${groupTable(summary.graph, "graphical_judgment")}<p class="report-note">辅助尺提供同一数据的冗余长度表达。若误差下降同时回答变慢，应共同报告精度与时间；不能据此声称角度知觉本身被改善。</p></section>
      <section class="report-section"><p class="eyebrow">FOUR PLANNED COMPARISONS</p><h2>预测与证据，对照着看。</h2><div class="table-scroll"><table class="data-table"><thead><tr><th>预定比较</th><th>有效配对N</th><th>平均差</th><th>95%CI</th><th>校正p</th></tr></thead><tbody>${summary.effects.map((e) => `<tr><th>${e.key} ${effectNames[e.key]}</th><td>${e.n}</td><td>${number(e.mean, 2)}</td><td>${e.ci ? e.ci.map((v) => f(v, 2)).join(" ～ ") : "—"}</td><td>${Number.isFinite(e.adjusted) ? (e.adjusted < 0.001 ? "< .001" : f(e.adjusted, 3)) : "—"}</td></tr>`).join("")}</tbody></table></div><p class="report-note">全部差值定义为“原条件减参照/改进条件”，正值符合方向性预测。S项单位为ms/item，G项为log误差。正式有效N≥5时计算双侧配对符号翻转检验，并对可估计的四项比较作Holm校正；该检验依赖差值的对称/可交换性假设。区间以被试为单位重采样2500次，不把试次当作独立被试。</p></section>
      <section class="report-section report-method"><h2>读这些结果时，请保留边界。</h2><div><p>搜索仅用150–5000ms的有效正确反应。每个目标存在条件格须至少8次有效正确RT；整体准确率低于60%时不估计主效应。判断实验每条件须至少16次有效回答。体验模式使用较低门槛，仅作演示。</p><p>相同匿名编号、相同协议、同一范式仅保留首次完整会话。正式模式与体验/试运行隔离；不同范式和对比可能有不同有效样本量。图中RT均值不等于四个对比都具备有效数据。</p><p>“未达到显著”不表示没有效应，也不表示两条件等效。10人是招募目标，不是功效保证。最终文字讨论仍需结合实际参与者情况、顺序与数据质量，由研究者完成。</p></div><p class="report-note">完整出处、适配差异与预测见“研究说明”及仓库docs。报告是当前数据快照；正式成文时固定数据截止时间，保留原始导出与分析版本。</p></section>`;
    lastReport = body;
    main.innerHTML = `<article class="research-report">${body}</article>`;
    if (formal && (reportSource === "teacher" || remoteSessions.length)) {
      const label = document.createElement("label");
      label.htmlFor = "report-source";
      label.textContent = "数据来源（分别分析，避免重复人数）";
      const select = document.createElement("select");
      select.id = "report-source";
      select.innerHTML = `<option value="local">本机记录</option><option value="teacher">老师平台匿名记录</option>`;
      select.value = reportSource;
      select.onchange = () => {
        reportSource = select.value;
        report();
      };
      $(".report-controls").append(label, select);
    }
    bind("#report-mode", "change", (e) => {
      reportMode = e.target.value;
      report();
    });
    bind("#download-report", "click", downloadReport);
  }
  function effectParagraph(e, title) {
    return `<p class="result-paragraph"><strong>${title}。</strong>${e.n ? `有效配对 ${e.n} 人，平均差 ${number(e.mean, 2)}${e.key[0] === "S" ? " ms/item" : " log单位"}。` : ""}${effectInterpretation(e, reportMode)}</p>`;
  }
  function groupTable(rows, experiment) {
    const search = experiment === "visual_search",
      pct = (m) => {
        const value = C.mean(rows.map((r) => r.variants[m].accuracy));
        return Number.isFinite(value) ? number(value * 100, 1, "%") : "—";
      };
    return `<details class="detail-table"><summary>查看条件汇总与有效数据口径</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>条件</th><th>完整记录人数</th><th>${search ? "平均正确率" : "平均绝对误差 / 百分点"}</th><th>${search ? "有效正确RT / ms" : "平均回答时间 / ms"}</th></tr></thead><tbody>${getModes(
      experiment,
    )
      .map(
        (m) =>
          `<tr><th>${C.NAMES[m]}</th><td>${rows.length}</td><td>${search ? pct(m) : number(C.mean(rows.map((r) => r.variants[m].mae)))}</td><td>${number(C.mean(rows.map((r) => r.variants[m].rt)))}</td></tr>`,
      )
      .join(
        "",
      )}</tbody></table></div><p class="report-note">各指标先在被试内计算，再按可用值汇总；完整记录人数不等于每项有效配对N。中断、超时与提前反应保留原始记录。</p></details>`;
  }
  function downloadReport() {
    const div = document.createElement("div");
    div.innerHTML = lastReport;
    div.querySelectorAll(".report-controls").forEach((el) => el.remove());
    const styles =
      'body{font-family:"Microsoft YaHei",sans-serif;color:#26322e;background:#fff;max-width:1040px;margin:45px auto;padding:0 24px;line-height:1.8}h1{font-size:38px;line-height:1.3}h2{font-size:23px}p{font-size:14px}.eyebrow,figcaption,.report-note{font-size:12px;color:#67736e}.report-section{border-top:1px solid #ccd5cf;margin-top:40px;padding-top:30px}.report-metrics{display:flex;gap:25px}.report-metrics>div{flex:1}.report-metrics strong{display:block;font-size:24px}.report-metrics small{display:block;font-size:12px}.research-chart{width:100%;font-family:"Microsoft YaHei",sans-serif;font-size:12px;fill:#53605a}.report-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:20px 0}.wide-figure{max-width:700px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:9px;text-align:left;border-bottom:1px solid #dde3df}thead{border-top:2px solid #4c5a53;border-bottom:1px solid #4c5a53}.report-status{padding:15px;border:1px solid #cad2cc}.warning{background:#fff6df}.chart-legend{display:flex;gap:15px;font-size:12px}.chart-legend i{display:inline-block;width:8px;height:8px;margin-right:5px}.mode-badge{font-size:12px}.chart-empty{text-align:center;padding:45px;color:#78867d}@media print{body{margin:0}.report-section{break-inside:avoid}.detail-table{display:block}}';
    S.download(
      `attention-report-${reportMode}-${new Date().toISOString().slice(0, 10)}.html`,
      `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>注意有迹研究报告</title><style>${styles}</style><body>${div.innerHTML}</body></html>`,
      "text/html;charset=utf-8",
    );
  }
  function about() {
    main.innerHTML = `<article class="about-page"><p class="eyebrow">METHODS & ORIGINS</p><h1>从经典出发，<br>把改进交给检验。</h1><p class="page-lead">两个浏览器适配实验，四项预定比较。这里说明依据、改变与解释边界。</p><section class="about-grid"><div><span class="card-no">01</span><h2>特征与联合搜索</h2><p>根据 Treisman 与 Gelade（1980）Experiment I，保留特征与联合搜索的比较结构。当前统一使用橙色T、蓝色X干扰项，比较“紫红色或S”的特征目标与“蓝色T”的联合目标。集合大小为1、5、15、30。为处理体验中的辨色困难，刺激颜色已替换，未沿用原文的棕、绿、蓝配色；开始搜索前需确认能区分当前三色。</p><p>新增条件按颜色进行空间分区，目标位置与颜色计数与原联合条件匹配。依据分组与子集搜索研究，预测分区降低联合搜索斜率。</p><a class="text-link" href="https://doi.org/10.1016/0010-0285(80)90005-5" target="_blank" rel="noopener">Treisman & Gelade, 1980 ↗</a><a class="text-link" href="https://doi.org/10.1016/S0001-6918(96)00003-0" target="_blank" rel="noopener">空间分组依据 · Theeuwes, 1996 ↗</a></div><div><span class="card-no">02</span><h2>位置与角度判断</h2><p>根据 Cleveland 与 McGill（1984）的位置—角度实验，比较五项数据的柱图与饼图。问题是“A占最大项X多少”，不是A占整体多少。</p><p>新增条件保留饼图并增加共同基线对照尺，不给出答案数字。预测辅助显示降低估计误差；同时检查回答时间是否增加。</p><a class="text-link" href="https://doi.org/10.1080/01621459.1984.10478080" target="_blank" rel="noopener">Cleveland & McGill, 1984 ↗</a></div></section><section class="about-section"><h2>四项预测，先写下来。</h2><div class="prediction-grid"><div><span>S-R / 复现</span><p>联合搜索的目标存在RT斜率，高于特征搜索。</p></div><div><span>S-I / 改进</span><p>分区联合搜索的斜率，低于原联合搜索。</p></div><div><span>G-R / 复现</span><p>原饼图判断误差，高于共同基线柱图。</p></div><div><span>G-I / 改进</span><p>辅助饼图判断误差，低于原饼图。</p></div></div><p class="report-note">${collectionReady() ? `收数前预测已提交，预登记版本：${esc(CFG.preregistrationCommit)}。正式收数开放，目标每实验${CFG.recruitmentTarget}名他人。` : "设计与预测已确认；正式收数须在预测提交、项目码配置和接口验证后开放。"}</p></section><section class="about-section"><h2>适配与分析边界</h2><p>这是基于原研究的浏览器适配复现：使用电脑显示和键盘、缩短练习与题量；图形实验每图只判断一个指定项。图形刺激的值满足原研究范围约束；不同模式比率分布相同，五值数据不完全重复。</p><p>正式采用被试内比较，同一批人可分次完成两实验。顺序按匿名编号近似平衡，不把所有试次当成独立被试。空间分区也会改变局部组织，不能仅凭收益确定唯一心理机制。</p><p>实验区域不使用动画、倒计时奖励或提示答案。报告将模式、效应与不确定性共同呈现，接受不支持预测的结果。</p></section><section class="about-section"><h2>AI 使用与数据说明</h2><p>AI辅助文献核对、候选设计整理、编程、测试与图表实现；研究问题、预测和设计由学生理解并确认，正式数据解释由学生结合实际结果完成。测试、体验和试运行记录不冒充正式参与者数据。</p><p>记录使用匿名编号。项目码可公开，下载密钥不进入源码。网站无第三方脚本、字体或统计追踪。平台匿名读取接口可按项目码访问，因此不承诺所有形式的数据只对研究者可见。</p></section><a class="button primary" href="#home">回到实验台 →</a></article>`;
  }
  function manage() {
    const sessions = S.all(),
      completed = sessions.filter((s) => s.done).length;
    main.innerHTML = `<section class="manage-page"><p class="eyebrow">RESEARCH DESK</p><h1>把过程，也记录好。</h1><p class="page-lead">项目配置、数据备份与上传状态。下载密钥始终留在老师平台，不在这里填写。</p><div class="manage-grid"><section class="desk-card"><h2>01　老师平台连接</h2><label class="field-label" for="project-code">6 位公开项目码</label><div class="inline-form"><input id="project-code" value="${esc(project())}" placeholder="例如 ABC234" maxlength="6" autocomplete="off"><button class="button primary" id="save-project">保存</button></div><p class="field-hint">这里只保存公开项目码。正式收数还需体验确认与预登记提交；仅填项目码不会自动开放正式入口。</p><div class="config-status"><span class="status-dot ${collectionReady() ? "" : "pending"}"></span>${collectionReady() ? "正式收数条件已满足" : "当前：体验与试运行阶段"}</div><a class="text-link" href="${CFG.endpoint}/hw2" target="_blank" rel="noopener">打开老师的项目管理页面 ↗</a><button class="button secondary" id="load-remote">读取平台匿名结果</button><p class="field-hint">读取不会提交新数据。只纳入本协议、正式模式的记录；未知协议会跳过。</p></section><section class="desk-card"><h2>02　记录与备份</h2><div class="mini-metrics"><div><strong>${sessions.length}</strong><span>本机会话</span></div><div><strong>${completed}</strong><span>完整会话</span></div></div><p>本地存储只属于当前浏览器。换设备前请导出，原始文件保留供后续核验。</p><div class="button-row"><button class="button secondary" id="export-all-json">导出全部 JSON</button><button class="button secondary" id="export-all-csv">导出全部 CSV</button></div><label class="file-import">导入本工具 JSON 备份 / 平台 JSON<input type="file" id="import-json" accept=".json,application/json"></label><p class="field-hint">导入不会自动上传。仅支持有协议与模式标记的数据，避免测试记录混入正式结果。</p>${S.warning() ? `<p class="warning-text">${esc(S.warning())}</p>` : ""}</section></div><section class="desk-card records-card"><h2>03　本机数据清单</h2><p class="field-hint">相同编号的重复完整会话，主分析只取最早一次。记录在本机保留，不自动删除或覆盖。</p>${sessions.length ? `<div class="table-scroll"><table class="data-table"><thead><tr><th>匿名编号 / 日期</th><th>模式</th><th>实验</th><th>判断数</th><th>状态 / 上传</th><th>操作</th></tr></thead><tbody>${sessions.flatMap((s) => Object.entries(s.tasks).map(([exp, task]) => `<tr><th>${esc(s.participant)}<small class="table-small">${esc(new Date(s.createdAt).toLocaleString("zh-CN"))}</small></th><td>${badge(s.mode)}</td><td>${C.NAMES[exp]}</td><td>${task.trials.length}</td><td>${task.complete ? "完整" : "未完成"}<small class="table-small">${esc(uploadLabel(task.upload?.status))}</small></td><td><button class="table-action" data-export="${esc(s.id)}">导出</button>${s.mode === "formal" && task.complete && task.upload?.status !== "uploaded" ? `<button class="table-action" data-retry="${esc(s.id)}" data-exp="${exp}">核对后重试上传</button>` : ""}</td></tr>`)).join("")}</tbody></table></div>` : '<div class="desk-empty">还没有本机记录。先去实验台体验一次。</div>'}</section><section class="desk-card"><h2>04　正式收数前清单</h2><ul class="checklist"><li class="done">两实验、改进条件与预测已确认</li><li>本地体验与完整试运行验收</li><li>预测、分析规则和代码 commit 并推送</li><li>创建一个老师项目，配置项目码并核验接口</li><li>记录预登记commit，开放正式收数</li></ul><p class="field-hint">${collectionReady() ? `已记录收数前commit：${esc(CFG.preregistrationCommit)}。正式收数已开放；完成后仍需核对真实数据与补齐报告。` : "正式收数须在体验确认、预登记提交和接口核验后开放。"}</p></section></section>`;
    const warningReceipts = sessions
      .flatMap((s) =>
        Object.entries(s.tasks)
          .filter(([, t]) => t.upload?.needsReview)
          .map(([exp]) => uploadReceiptHTML(s, exp)),
      )
      .join("");
    if (warningReceipts)
      $(".records-card").insertAdjacentHTML("beforeend", warningReceipts);
    bind("#save-project", "click", () => {
      const value = $("#project-code").value.trim().toUpperCase();
      if (value && !/^[A-Z0-9]{6}$/.test(value)) {
        toast("项目码应是6位英文字母或数字。");
        return;
      }
      if (CFG.project && value !== CFG.project) {
        toast("本发布版本固定使用已预登记的项目码，不能在本机改到其他项目。");
        return;
      }
      S.settings({ ...S.settings(), project: value });
      toast("公开项目码已保存在本机。");
      manage();
    });
    bind("#export-all-json", "click", () =>
      S.download(
        "attention-all-backup.json",
        JSON.stringify(
          {
            format: "attention-lab-backup-v1",
            exportedAt: new Date().toISOString(),
            sessions: S.all(),
          },
          null,
          2,
        ),
      ),
    );
    bind("#export-all-csv", "click", () =>
      S.download(
        "attention-all-trials.csv",
        C.csv(S.rows(S.all())),
        "text/csv;charset=utf-8",
      ),
    );
    bind("#import-json", "change", importJSON);
    bind("#load-remote", "click", loadRemote);
    document
      .querySelectorAll("[data-export]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            exportSession(S.all().find((s) => s.id === b.dataset.export))),
      );
    document.querySelectorAll("[data-retry]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!collectionReady()) {
            toast("正式上传尚未开放。");
            return;
          }
          const s = S.all().find((s) => s.id === b.dataset.retry),
            exp = b.dataset.exp;
          if (
            s.tasks[exp].upload?.status === "uncertain" &&
            !confirm(
              "请先在老师平台核对：若这条记录已存在，不要重试。确认平台没有该会话后，是否重试？",
            )
          )
            return;
          try {
            await upload(s, exp, true);
          } catch (e) {
            toast(e.message);
          }
          manage();
        }),
    );
  }
  function uploadLabel(status) {
    return (
      {
        local_only: "本机保存 · 不上传",
        pending: "等待上传",
        uploading: "正在上传",
        uploaded: "平台已确认",
        failed: "平台拒绝，请检查",
        uncertain: "响应未确认，请先核对平台",
      }[status] || "本机保存"
    );
  }
  function remoteToSessions(records, experiment) {
    return C.remoteRecordsToSessions(records, experiment, CFG.protocol);
  }
  async function loadRemote() {
    if (!/^[A-Z0-9]{6}$/.test(project())) {
      toast("请先保存老师平台的项目码。");
      return;
    }
    const button = $("#load-remote");
    button.disabled = true;
    button.textContent = "正在读取…";
    try {
      const batches = await Promise.all(
        ["visual_search", "graphical_judgment"].map(async (exp) => {
          const controller = new AbortController(),
            timeout = setTimeout(() => controller.abort(), 12000);
          try {
            const res = await fetch(
              `${CFG.endpoint}/api/hw2/data?project=${encodeURIComponent(project())}&experiment=${exp}`,
              { signal: controller.signal },
            );
            const data = await res.json();
            if (!res.ok || !data.ok || !Array.isArray(data.records))
              throw new Error(data.msg || "平台返回格式不符");
            return remoteToSessions(data.records, exp);
          } finally {
            clearTimeout(timeout);
          }
        }),
      );
      remoteSessions = batches.flat();
      reportSource = "teacher";
      reportMode = "formal";
      toast(`已读取${remoteSessions.length}条兼容的正式实验记录。`);
      navigate("report");
    } catch (e) {
      toast("读取失败：" + (e.name === "AbortError" ? "请求超时" : e.message));
      button.disabled = false;
      button.textContent = "读取平台匿名结果";
    }
  }
  async function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("文件超过10MB，请按项目分开导入。");
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      if (
        data.format === "attention-lab-backup-v1" &&
        Array.isArray(data.sessions)
      ) {
        let count = 0;
        for (const s of data.sessions) {
          if (
            s.protocol !== CFG.protocol ||
            !["preview", "pilot", "formal"].includes(s.mode) ||
            typeof s.participant !== "string" ||
            typeof s.id !== "string" ||
            !s.tasks
          )
            continue;
          const valid = Object.entries(s.tasks).every(
            ([exp, t]) =>
              ["visual_search", "graphical_judgment"].includes(exp) &&
              Array.isArray(t.trials) &&
              t.trials.length <= 2000,
          );
          if (!valid) continue;
          const existing = S.all().find((x) => x.id === s.id);
          if (existing) {
            if (existing.updatedAt >= s.updatedAt) continue;
          }
          S.save(s);
          count++;
        }
        toast(`已导入${count}个新会话，保留原模式标记。`);
        manage();
      } else {
        const records = Array.isArray(data) ? data : data.records;
        if (!Array.isArray(records)) throw new Error("不支持的JSON结构");
        const converted = remoteToSessions(records);
        if (!converted.length) throw new Error("没有与本协议兼容的正式记录");
        remoteSessions = converted;
        reportSource = "teacher";
        reportMode = "formal";
        toast(`已读取${converted.length}条正式实验记录，仅用于当前报告。`);
        navigate("report");
      }
    } catch (e) {
      toast("导入失败：" + e.message);
    }
  }
  function setNav(page) {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === page);
      if (a.dataset.nav === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }
  function route() {
    const hash = location.hash.slice(1) || "home";
    if (active && active.phase !== "done") {
      if (hash !== "run") {
        history.replaceState(null, "", "#run");
        toast("请先暂存并退出，或完成本次实验。");
      }
      return;
    }
    if (hash === "run" && !active) {
      navigate("home");
      return;
    }
    document.body.classList.remove("running");
    setNav(hash);
    if (hash === "report") report();
    else if (hash === "about") about();
    else if (hash === "manage") manage();
    else home();
    if (hash !== "start-panel") scrollTo({ top: 0, behavior: "instant" });
  }
  document.addEventListener("keydown", (e) => {
    if (!active || e.repeat) return;
    if (e.code === "Escape") {
      pauseRun();
      return;
    }
    if (active.phase !== "stimulus" || active.locked) return;
    if (
      active.experiment === "visual_search" &&
      ["KeyF", "KeyJ"].includes(e.code)
    ) {
      e.preventDefault();
      respondSearch(e.code === "KeyF");
    } else if (
      active.experiment === "graphical_judgment" &&
      e.code === "Enter"
    ) {
      e.preventDefault();
      respondGraph();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active) pauseRun();
  });
  window.addEventListener("blur", () => {
    if (active) pauseRun();
  });
  window.addEventListener("beforeunload", (e) => {
    if (active && !active.session.done) {
      S.save(active.session);
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("hashchange", route);
  route();
})();
