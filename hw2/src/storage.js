(function (root) {
  "use strict";
  const KEY = "attention-field-sessions-v1",
    SETTINGS = "attention-field-settings-v1";
  let warning = "";
  function get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch (e) {
      warning = "浏览器本地存储不可用。请及时导出备份。";
      return fallback;
    }
  }
  const loaded = get(KEY, []);
  let cache = Array.isArray(loaded) ? loaded : [];
  // 重新打开时，旧请求不可能仍由本页面等待；先核对平台，避免盲目重发。
  for (const session of cache)
    for (const task of Object.values(session.tasks || {})) {
      if (task.upload?.status === "uploading")
        task.upload = {
          status: "uncertain",
          message:
            "网页曾在发送中关闭，结果未获确认。请先核对老师平台再决定重试。",
        };
    }
  function all() {
    return cache.slice();
  }
  function save(session) {
    const i = cache.findIndex((s) => s.id === session.id);
    session.updatedAt = new Date().toISOString();
    if (i >= 0) cache[i] = session;
    else cache.push(session);
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {
      warning = "本地存储已满或不可用，当前数据暂存在内存，请立即导出备份。";
    }
    return session;
  }
  function settings(value) {
    if (value) {
      try {
        localStorage.setItem(SETTINGS, JSON.stringify(value));
      } catch (e) {
        warning = "设置无法保存到本机。";
      }
      return value;
    }
    return get(SETTINGS, {});
  }
  function download(name, content, type = "application/json") {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  function rows(sessions) {
    return sessions.flatMap((s) =>
      Object.entries(s.tasks || {}).flatMap(([experiment, task]) =>
        (task.trials || []).map((t) => ({
          session_id: s.id,
          participant: s.participant,
          mode: s.mode,
          protocol: s.protocol,
          experiment,
          ...t,
        })),
      ),
    );
  }
  root.LabStore = {
    all,
    save,
    settings,
    download,
    rows,
    warning: () => warning,
  };
})(window);
