import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { findPageIcons } from "./page-icons";
import { isPublicAddress } from "./public-address";
import { webUrl } from "./web-url";

const PAGE_BYTES = 512 * 1024;
const ICON_BYTES = 100 * 1024;
const MAX_REDIRECTS = 3;
const MAX_DECLARED_ICONS = 4;
const TIME_LIMIT_MS = 3_000;
const CACHE_TTL_MS = 30 * 60_000;
const CACHE_ENTRIES = 200;

export interface LinkIconFetcherOptions {
  // Tests allow their own loopback servers. The runtime allows only public internet addresses.
  isAllowedAddress?: (address: string) => boolean;
  // One limit for finding a site's icon, including DNS lookups, redirects and reading bodies.
  timeoutMs?: number;
}

const contentType = (response: Response) =>
  response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";

// Bun inflates compressed bodies ahead of the reader, so byte limits would not limit memory.
const isCompressed = (response: Response) => (response.headers.get("content-encoding") ?? "identity") !== "identity";

const withinTimeLimit = <T>(work: () => Promise<T>, signal: AbortSignal) => {
  signal.throwIfAborted();
  return Promise.race([
    work(),
    new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true })),
  ]);
};

const readHead = async (response: Response) => {
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let html = "";
  let size = 0;
  while (reader && size < PAGE_BYTES && !html.toLowerCase().includes("</head")) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    html += decoder.decode(value, { stream: true });
  }
  await reader?.cancel();
  return html;
};

const readIcon = async (response: Response) => {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > ICON_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
};

export const createLinkIconFetcher = (options: LinkIconFetcherOptions = {}) => {
  const { isAllowedAddress = isPublicAddress, timeoutMs = TIME_LIMIT_MS } = options;
  const cache = new Map<string, { expires: number; icon: Promise<string | null> }>();

  // Checks every address the host resolves to. Bun's fetch resolves the name again, see the API reference.
  const isAllowedHost = async (hostname: string, signal: AbortSignal) => {
    const host = hostname.replace(/^\[(.*)\]$/, "$1");
    if (isIP(host)) return isAllowedAddress(host);
    const addresses = await withinTimeLimit(() => lookup(host, { all: true }), signal).catch(() => []);
    return addresses.length > 0 && addresses.every(({ address }) => isAllowedAddress(address));
  };

  // Follows redirects by hand so that every hop passes the address check. No cookies or client headers are sent.
  const fetchWeb = async (start: URL, accept: string, signal: AbortSignal) => {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isAllowedHost(url.hostname, signal))) return null;
      const response = await fetch(url, {
        redirect: "manual",
        decompress: false,
        headers: { accept, "accept-encoding": "identity" },
        signal,
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status > 399 || !location) return { response, url };
      await response.body?.cancel();
      const next = webUrl(location, url.href);
      if (!next) return null;
      url = next;
    }
    return null;
  };

  const declaredIcons = async (url: URL, signal: AbortSignal) => {
    const page = await fetchWeb(url, "text/html", signal).catch(() => null);
    if (!page) return { pageUrl: url, icons: [] };
    if (!page.response.ok || contentType(page.response) !== "text/html" || isCompressed(page.response)) {
      await page.response.body?.cancel();
      return { pageUrl: page.url, icons: [] };
    }
    const html = await readHead(page.response).catch(() => "");
    return { pageUrl: page.url, icons: findPageIcons(html, page.url).slice(0, MAX_DECLARED_ICONS) };
  };

  const iconDataUrl = async (url: URL, signal: AbortSignal) => {
    const icon = await fetchWeb(url, "image/*", signal);
    if (!icon) return null;
    const type = contentType(icon.response);
    if (!icon.response.ok || !type.startsWith("image/") || isCompressed(icon.response)) {
      await icon.response.body?.cancel();
      return null;
    }
    const bytes = await readIcon(icon.response);
    return bytes?.length ? `data:${type};base64,${bytes.toString("base64")}` : null;
  };

  const resolve = async (url: URL) => {
    const signal = AbortSignal.timeout(timeoutMs);
    const { pageUrl, icons } = await declaredIcons(url, signal);
    const candidates = new Set([...icons.map(String), new URL("/favicon.ico", pageUrl).href]);
    for (const candidate of candidates) {
      const dataUrl = await iconDataUrl(new URL(candidate), signal).catch(() => null);
      if (dataUrl) return dataUrl;
    }
    return null;
  };

  return {
    // Sites usually use one icon, so results and misses are cached per origin.
    get: (value: string) => {
      const url = webUrl(value);
      if (!url) return Promise.resolve(null);
      const cached = cache.get(url.origin);
      if (cached && cached.expires > Date.now()) return cached.icon;
      cache.delete(url.origin);
      if (cache.size >= CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
      // A failed lookup is a miss. A rejected promise in the cache would fail every request for the site.
      const icon = resolve(url).catch(() => null);
      cache.set(url.origin, { expires: Date.now() + CACHE_TTL_MS, icon });
      return icon;
    },
  };
};

export type LinkIconFetcher = ReturnType<typeof createLinkIconFetcher>;
