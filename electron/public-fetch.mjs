// Public collectors never use an authenticated Electron session.
export function abortable(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || Error("请求超时"));
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
export async function publicResponse(
  raw,
  { validate, fetcher = fetch, signal, headers = {}, redirects = 2 },
) {
  let url = validate(raw);
  for (let hop = 0; ; hop++) {
    const response = await abortable(
      fetcher(url, {
        redirect: "manual",
        credentials: "omit",
        signal,
        headers,
      }),
      signal,
    );
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    await response.body?.cancel();
    if (hop >= redirects) throw Error("来源重定向过多");
    const location = response.headers.get("location");
    if (!location) throw Error("来源跳转无效");
    url = validate(new URL(location, url).href);
  }
}
export async function boundedBytes(response, limit, signal) {
  if (!response.ok || !response.body) throw Error("来源暂不可用");
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body.cancel();
    throw Error("来源内容过大");
  }
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await abortable(reader.read(), signal);
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw Error("来源内容过大");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    if (signal?.aborted) reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
