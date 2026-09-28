import { ASSISTANT_API } from "../src/assistant.mjs";

export function apiBase(value = ASSISTANT_API) {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("API 地址无效");
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入完整的 API 地址，例如 https://服务地址/v1");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "API 地址须使用 HTTPS，且不能包含账号、参数或密钥；本机服务可用 HTTP",
    );
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (/\/(chat\/completions|models)$/i.test(url.pathname))
    throw new Error("请填写 Base URL，不要带 /chat/completions 或 /models");
  return url.href.replace(/\/+$/, "");
}

export function validModel(value) {
  return (
    typeof value === "string" &&
    /^[a-zA-Z0-9@][a-zA-Z0-9._:/@+\-]{0,199}$/.test(value)
  );
}
