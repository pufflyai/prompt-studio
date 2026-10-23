import type { PerformanceBackend } from "./backend-response";
import { DesktopPerformanceCapture } from "./performance-capture";
import { createPerformanceRecording } from "./performance-recording";
import { createProcessObserver } from "./process-observer";

export const createDesktopCapture = (input: {
  backend: () => PerformanceBackend | null;
  executable: string;
  recordingDirectory: string;
  hostVersion: string;
  onError: (error: unknown) => void;
}) => {
  const recorder = createPerformanceRecording(input.recordingDirectory);
  let observer: ReturnType<typeof createProcessObserver> | null = null;
  const capture = new DesktopPerformanceCapture({
    backend: input.backend,
    readProcess: (pid, signal) => {
      observer ??= createProcessObserver({ executable: input.executable });
      return observer.read(pid, signal);
    },
    intervalMs: 2000,
    platform: process.platform,
    hostVersion: input.hostVersion,
    record: (sample) => recorder.write({ kind: "sample", captureId: capture.id, sample }),
  });
  recorder.write({ kind: "start", capture: capture.snapshot() });
  return {
    snapshot: () => capture.snapshot(),
    sample: (...args: Parameters<DesktopPerformanceCapture["sample"]>) => capture.sample(...args).catch(input.onError),
    close: async () => {
      const id = capture.snapshot().id;
      capture.stop();
      try {
        recorder.write({ kind: "stop", captureId: id, capturedAt: new Date().toISOString() });
      } finally {
        recorder.close();
        await observer?.close();
      }
    },
  };
};
