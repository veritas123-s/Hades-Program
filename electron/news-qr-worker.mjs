import { parentPort, workerData } from "node:worker_threads";
import jsQR from "jsqr";

const { pixels, width, height } = workerData;
parentPort.postMessage(
  jsQR(new Uint8ClampedArray(pixels), width, height)?.data || "",
);
