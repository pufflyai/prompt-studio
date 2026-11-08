import { isDeepStrictEqual } from "node:util";
import type { Page } from "@playwright/test";

export interface SubnavFetchSignal {
  url: string;
  method: string;
  postData?: unknown;
  started: number;
  preAborted: boolean;
  abort?: { at: number; name: string; message: string; signalAborted: boolean };
}

export interface SubnavClientAbort {
  url: string;
  method: string;
  postData?: unknown;
  fetchStartedMs: number;
  atMs: number;
  name: string;
  message: string;
  signalAborted: boolean;
  preAborted: boolean;
}

declare global {
  interface Window {
    __subnavFetchSignals: SubnavFetchSignal[];
  }
}

export const installSubnavRequestSignals = (page: Page) =>
  page.addInitScript(() => {
    const original = window.fetch;
    const signals: SubnavFetchSignal[] = [];
    window.__subnavFetchSignals = signals;
    const describeFetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined;
      return {
        url: request ? request.url : new URL(String(input), location.href).href,
        method: (init?.method ?? request?.method ?? "GET").toUpperCase(),
        signal: init?.signal ?? request?.signal,
      };
    };
    const observeAbort = (entry: SubnavFetchSignal, signal?: AbortSignal | null) => {
      if (!signal) return;
      signal.addEventListener(
        "abort",
        () => {
          entry.abort = {
            at: performance.now(),
            signalAborted: signal.aborted,
            name: signal.reason?.name ?? "",
            message: signal.reason?.message ?? String(signal.reason),
          };
        },
        { once: true },
      );
    };
    window.fetch = Object.assign(function (this: unknown, ...args: Parameters<typeof fetch>) {
      const [input, init] = args;
      const { url, method, signal } = describeFetch(input, init);
      if (!/\/extensions\/commands\/[^/]+\.tree\.(body|children)\/execute$/.test(new URL(url).pathname))
        return original.apply(this, args);
      const entry: SubnavFetchSignal = {
        url,
        method,
        started: performance.now(),
        preAborted: signal?.aborted ?? false,
      };
      // SDK tree requests already provide a JSON string; never read or clone a Request body to observe it.
      if (typeof init?.body === "string") {
        try {
          entry.postData = JSON.parse(init.body);
        } catch {}
      }
      observeAbort(entry, signal);
      signals.push(entry);
      return original.apply(this, args);
    }, original);
  });

export const withSubnavClientAborts = <
  T extends { url: string; method: string; postData?: unknown; startedMs: number },
>(
  requests: T[],
  signals: SubnavFetchSignal[],
  clicked: number,
) => {
  const used = new Set<SubnavFetchSignal>();
  const annotated: (T & { clientAbort?: SubnavClientAbort })[] = requests.map((request) => {
    const started = clicked + request.startedMs;
    if (!Number.isFinite(started)) return request;
    const preceding = signals.filter(
      (entry) =>
        entry.url === request.url &&
        entry.method === request.method &&
        Number.isFinite(entry.started) &&
        entry.started <= started,
    );
    const latest = Math.max(...preceding.map((entry) => entry.started));
    const matches = preceding.filter((entry) => entry.started === latest);
    const entry = matches[0];
    if (matches.length !== 1 || !entry || used.has(entry) || !isDeepStrictEqual(entry.postData, request.postData))
      return request;
    used.add(entry);
    if (!entry.abort) return request;
    return {
      ...request,
      clientAbort: {
        url: entry.url,
        method: entry.method,
        postData: entry.postData,
        fetchStartedMs: entry.started - clicked,
        preAborted: entry.preAborted,
        atMs: entry.abort.at - clicked,
        name: entry.abort.name,
        message: entry.abort.message,
        signalAborted: entry.abort.signalAborted,
      },
    };
  });
  return annotated;
};
