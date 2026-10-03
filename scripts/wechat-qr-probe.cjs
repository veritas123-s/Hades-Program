const { app } = require("electron");
// A windowless test host for the real Windows nativeImage and decoder worker.
globalThis.medstackQRModule = import("../electron/news-qr.mjs");
app.whenReady();
