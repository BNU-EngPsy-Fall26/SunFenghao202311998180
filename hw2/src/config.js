/* 公开配置：只填项目码，绝不能把下载密钥放在这里。 */
(function (root) {
  "use strict";
  root.LAB_CONFIG = Object.freeze({
    project: "W2UGHD",
    endpoint: "https://attention-lab-production.up.railway.app",
    collectionEnabled: false, // 体验确认、预登记commit、项目码配置后才改为true
    preregistrationCommit: "",
    protocol: "attention-v1.1",
    build: "0.3.0",
    recruitmentTarget: 5,
  });
})(typeof window !== "undefined" ? window : globalThis);
