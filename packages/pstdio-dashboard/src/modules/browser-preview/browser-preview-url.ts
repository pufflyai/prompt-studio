export type BrowserPreviewUrlRejectionReason = "invalid-url" | "unsupported-scheme" | "credentials" | "host-origin";

export type BrowserPreviewUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: BrowserPreviewUrlRejectionReason; message: string };

export interface BrowserPreviewUrlPolicy {
  dashboardOrigin?: string;
  apiOrigin?: string;
}

const messages = {
  "invalid-url": "Browser Preview URL is invalid.",
  "unsupported-scheme": "Browser Preview supports only HTTP(S) URLs.",
  credentials: "Browser Preview URLs cannot include credentials.",
  "host-origin": "Browser Preview cannot open the Prompt Studio host origin.",
} as const satisfies Record<BrowserPreviewUrlRejectionReason, string>;

const reject = (reason: BrowserPreviewUrlRejectionReason): BrowserPreviewUrlResult => ({
  ok: false,
  reason,
  message: messages[reason],
});

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"]);

const originKey = (url: URL) => {
  const host = loopbackHosts.has(url.hostname) ? "localhost" : url.hostname;
  return `${url.protocol}//${host}:${url.port || (url.protocol === "https:" ? "443" : "80")}`;
};

const parseOrigin = (origin: string | undefined) => {
  if (!origin) return undefined;
  try {
    return originKey(new URL(origin));
  } catch {
    return undefined;
  }
};

const parseAddress = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const shorthandHostPort = /^[^:/\s]+:\d+(?:[/#?]|$)/.test(trimmed);

  try {
    if (shorthandHostPort) return new URL(`http://${trimmed}`);
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`http://${trimmed}`);
    } catch {
      return undefined;
    }
  }
};

export const normalizeBrowserPreviewUrl = (
  input: string,
  policy: BrowserPreviewUrlPolicy = {},
): BrowserPreviewUrlResult => {
  const url = parseAddress(input);
  if (!url) return reject("invalid-url");
  if (url.protocol !== "http:" && url.protocol !== "https:") return reject("unsupported-scheme");
  if (url.username || url.password) return reject("credentials");

  const deniedOrigins = [parseOrigin(policy.dashboardOrigin), parseOrigin(policy.apiOrigin)].filter(Boolean);
  if (deniedOrigins.includes(originKey(url))) return reject("host-origin");

  return { ok: true, url: url.href };
};
