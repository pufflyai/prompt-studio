import { appendFileSync } from "node:fs";
import type { Page, Request } from "playwright-core";
import { EXTENSION_HOST_LOG_PREFIX, type ExtensionHostDiagnostic } from "pstdio-api/extensions/host-diagnostics";
import type { SmokeResult } from "./smoke-result";

const prefix = EXTENSION_HOST_LOG_PREFIX;
export const recordSmokeHostDiagnostic = (result: SmokeResult, event: ExtensionHostDiagnostic, phase: string) => {
  if (!event.event.endsWith("error") && event.event !== "webview-diagnostic") return;
  result.checks.push({
    id: "runtime-diagnostics",
    status: "failed",
    phase,
    message: event.message ?? event.event,
    extensionId: event.extensionId,
    contributionId: event.contributionId,
    code: event.code,
    capability: event.capability,
  });
  result.exitCode = Math.max(result.exitCode, event.extensionId ? 1 : 3);
};
export const observeSmokePage = (page: Page, result: SmokeResult, logPath: string) => {
  const events: ExtensionHostDiagnostic[] = [];
  const pending = new Set<Request>();
  page.on("request", (request) => pending.add(request));
  page.on("requestfinished", (request) => pending.delete(request));
  const identity = (text: string) => {
    const id = result.extension?.id;
    if (!id || !text.includes(`/${id}.view.`)) return {};
    const contributionId = text.split("/").find((segment) => segment.startsWith(`${id}.view.`));
    return { extensionId: id, contributionId };
  };
  // Extension webviews share the page console, so only dashboard scripts may speak for the host.
  const fromDashboard = (url: string) => {
    const origin = new URL(page.url()).origin;
    return url.startsWith(`${origin}/`) && !url.startsWith(`${origin}/v1/`);
  };
  let phase = "host-registration";
  const fail = (message: string, extensionId?: string, contributionId?: string, code?: string, capability?: string) => {
    result.checks.push({
      id: "runtime-diagnostics",
      status: "failed",
      phase,
      message,
      extensionId,
      contributionId,
      code,
      capability,
    });
    result.exitCode = Math.max(result.exitCode, extensionId ? 1 : 3);
  };
  const record = (message: string) => appendFileSync(logPath, `${JSON.stringify({ phase, message })}\n`);
  page.on("console", (message) => {
    const text = message.text();
    record(text);
    if (text.startsWith(prefix) && fromDashboard(message.location().url)) {
      const event = JSON.parse(text.slice(prefix.length)) as ExtensionHostDiagnostic;
      events.push(event);
      recordSmokeHostDiagnostic(result, event, phase);
    } else if (message.type() === "error") {
      // Registration errors can precede the host's ready signal. Keep every observation.
      const source = identity(message.location().url);
      fail(text, source.extensionId, source.contributionId);
    }
  });
  page.on("pageerror", (error) => {
    record(error.message);
    const source = identity(error.stack ?? "");
    fail(error.message, source.extensionId, source.contributionId);
  });
  page.on("requestfailed", (request) => {
    pending.delete(request);
    if (request.failure()?.errorText === "net::ERR_ABORTED") return;
    const message = `Request failed: ${request.url()}: ${request.failure()?.errorText}`;
    record(message);
    const source = identity(request.url());
    fail(message, source.extensionId, source.contributionId);
  });
  page.on("response", (response) => {
    if (response.headers()["content-type"]?.includes("text/event-stream")) pending.delete(response.request());
    if (response.status() < 400) return;
    const message = `HTTP ${response.status()}: ${response.url()}`;
    record(message);
    const source = identity(response.url());
    fail(message, source.extensionId, source.contributionId);
  });
  return {
    events,
    pending,
    setPhase: (next: string) => {
      phase = next;
    },
    fail,
  };
};
