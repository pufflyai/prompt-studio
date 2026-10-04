import { EXTENSION_WEBVIEW_PATH_PREFIX } from "pstdio-api-contracts/extension-webview-path";
import { PERFORMANCE_LIMITS, type SlowFrame } from "pstdio-api-contracts/performance-diagnostics";

// The subset of PerformanceLongAnimationFrameTiming and PerformanceScriptTiming this
// view reads. Long tasks share the timing fields but carry no scripts.
export interface SlowFrameEntry {
  startTime: number;
  duration: number;
  blockingDuration?: number;
  scripts?: Array<{
    duration: number;
    invoker: string;
    invokerType: string;
    sourceFunctionName: string;
    sourceURL: string;
  }>;
}

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const bounded = (value: string) => value.slice(0, PERFORMANCE_LIMITS.text);

// Script URLs can carry tokens, workspace paths, or webview capabilities. Keep a
// name that identifies the bundle and drop everything else.
export const sanitizeScriptSource = (value: string, origin: string) => {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    // blob: and data: URLs report the page origin but are not app bundles.
    if (url.origin !== origin || !url.protocol.startsWith("http")) return "external script";
    if (url.pathname.startsWith(EXTENSION_WEBVIEW_PATH_PREFIX)) return "extension webview";
    return bounded(url.pathname.split("/").at(-1) || "document");
  } catch {
    return "external script";
  }
};

const sanitizeInvoker = (invoker: string, invokerType: string, origin: string) => {
  if (invokerType === "classic-script" || invokerType === "module-script") {
    return sanitizeScriptSource(invoker, origin) ?? "script";
  }
  return bounded(invoker.replace(URL_PATTERN, "[url]"));
};

export const toSlowFrame = (entry: SlowFrameEntry, page: { timeOrigin: number; origin: string }): SlowFrame => ({
  startedAt: new Date(page.timeOrigin + entry.startTime).toISOString(),
  durationMs: Math.round(entry.duration),
  blockingDurationMs: entry.blockingDuration === undefined ? null : Math.round(entry.blockingDuration),
  scripts: [...(entry.scripts ?? [])]
    .sort((left, right) => right.duration - left.duration)
    .slice(0, PERFORMANCE_LIMITS.scriptsPerFrame)
    .map((script) => ({
      invokerType: bounded(script.invokerType),
      invoker: sanitizeInvoker(script.invoker, script.invokerType, page.origin),
      source: sanitizeScriptSource(script.sourceURL, page.origin),
      functionName: script.sourceFunctionName ? bounded(script.sourceFunctionName) : null,
      durationMs: Math.round(script.duration),
    })),
});
