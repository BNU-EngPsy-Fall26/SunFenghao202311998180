/* 公开配置：只填项目码，绝不能把下载密钥放在这里。 */
(function (root) {
  "use strict";
  root.LAB_CONFIG = Object.freeze({
    project: "W2UGHD",
    endpoint: "https://attention-lab-production.up.railway.app",
    collectionEnabled: true, // 体验确认、真实接口核验与收数前提交均已完成
    preregistrationCommit: "89c427c9b7fbb3895d49f36e48bd8c7e2daca2d5",
    protocol: "attention-v1.1",
    build: "0.3.0",
    recruitmentTarget: 5,
  });
})(typeof window !== "undefined" ? window : globalThis);
