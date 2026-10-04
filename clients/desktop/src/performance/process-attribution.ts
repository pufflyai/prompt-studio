import type { ProcessMetric } from "electron";
import { webviewHostLabel, webviewOriginLabel } from "pstdio/runtime";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-webview-path";
import type { PerformanceExtensionFrame, PerformanceProcessRole } from "pstdio-api-contracts/performance-diagnostics";

export interface OwnedFrame {
  owner: "startup" | "workbench";
  isMainFrame: boolean;
  osProcessId: number;
  url: string;
}

type ProcessIdentity = Pick<ProcessMetric, "pid" | "type" | "name" | "serviceName">;

// Names come from the runtime's webview URLs, which only the main process can read.
// Each extension's webviews run on their own `<label>.localhost` host at the runtime
// port. A frame counts only when its host label matches the extension id in its
// path, so a page cannot load a decoy frame to blame or hide behind another one.
const extensionFrameFor = (frame: OwnedFrame, runtimeOrigin: string | null) => {
  if (frame.isMainFrame || !runtimeOrigin) return null;
  const url = URL.parse(frame.url);
  const runtime = URL.parse(runtimeOrigin);
  if (!url || !runtime || url.port !== runtime.port) return null;
  const label = webviewHostLabel(url.host);
  const scope = parseExtensionWebviewPath(url.pathname)?.scope;
  if (!label || !scope || webviewOriginLabel(scope.installedExtensionId) !== label) return null;
  return scope;
};

const uniqueExtensionFrames = (frames: OwnedFrame[], runtimeOrigin: string | null) => {
  const unique = new Map<string, PerformanceExtensionFrame>();
  for (const frame of frames) {
    const scope = extensionFrameFor(frame, runtimeOrigin);
    if (scope) unique.set(`${scope.installedExtensionId}\n${scope.webviewId}`, scope);
  }
  return [...unique.values()];
};

const rendererRole = (hosted: OwnedFrame[], extensionFrames: PerformanceExtensionFrame[]) => {
  const mainFrame = hosted.find((frame) => frame.isMainFrame);
  if (mainFrame) return mainFrame.owner;
  return extensionFrames.length > 0 ? "extension-frames" : "renderer";
};

const roleFor = (
  type: ProcessIdentity["type"],
  hosted: OwnedFrame[],
  extensionFrames: PerformanceExtensionFrame[],
): PerformanceProcessRole => {
  if (type === "Browser") return "main";
  if (type === "GPU") return "gpu";
  if (type === "Utility") return "utility";
  if (type === "Tab") return rendererRole(hosted, extensionFrames);
  return "other";
};

// Chromium can place several frames in one renderer, so a process lists every
// extension it hosts instead of claiming one owner or splitting its CPU.
export const attributeProcess = (metric: ProcessIdentity, frames: OwnedFrame[], runtimeOrigin: string | null) => {
  const hosted = frames.filter((frame) => frame.osProcessId === metric.pid);
  const extensionFrames = uniqueExtensionFrames(hosted, runtimeOrigin);
  return {
    role: roleFor(metric.type, hosted, extensionFrames),
    name: metric.type === "Utility" ? (metric.name ?? metric.serviceName ?? null) : null,
    extensionFrames,
  };
};
