import { setTimeout as delay } from "node:timers/promises";
// A service may run under a path of a shared address, such as https://base.prompt.studio/relay.
export const serviceAddress = (input: string) => {
  const url = new URL(input);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "[::1]", "localhost"].includes(url.hostname))
    )
  )
    throw new Error("Invalid service address");
  return url.href.replace(/\/+$/, "");
};

// Service routes are absolute paths; resolve them under the address path, not at its origin.
export const serviceUrl = (address: string, path: string) =>
  new URL(path.replace(/^\/+/, ""), `${serviceAddress(address)}/`);

// A rate limit or a gateway whose upstream failed for a moment (an instance or database recovering) clears on its
// own. Waiting keeps a long sync pass going instead of discarding its work; the relay protocol makes every request
// safe to send again after a lost response. Other failures, and the last attempt's answer, go to the caller.
const transient = new Set([429, 502, 503, 504]);

export const fetchWithBackoff = async (send: () => Promise<Response>, signal: AbortSignal) => {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    const response = await send();
    if (!transient.has(response.status) || attempt >= 5) return response;
    await response.body?.cancel();
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter === null ? 2 ** attempt : Number(retryAfter);
    const milliseconds = Number.isFinite(seconds)
      ? Math.max(0, seconds * 1000)
      : Math.max(0, Date.parse(retryAfter!) - Date.now());
    await delay(Number.isFinite(milliseconds) ? milliseconds : 1000, undefined, { signal });
  }
};
