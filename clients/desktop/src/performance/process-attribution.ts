import type { ProcessMetric } from "electron";
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
// Extension webviews load from the runtime origin, and their path names the extension
// and webview that its signed capability covers. Extension frames share renderers, so
// a process lists every extension it hosts rather than naming one owner.
const extensionFrameFor = (frame: OwnedFrame, runtimeOrigin: string | null) => {
  if (frame.isMainFrame || !runtimeOrigin) return null;
  const url = URL.parse(frame.url);
  if (!url || url.origin !== runtimeOrigin) return null;
  return parseExtensionWebviewPath(url.pathname)?.scope ?? null;
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
