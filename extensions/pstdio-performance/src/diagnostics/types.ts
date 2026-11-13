export type DiagnosticKind = "cpu" | "coverage";

export interface DiagnosticSummary {
  durationMs: number;
  unit: "samples" | "calls";
  total: number;
  top: { name: string; location: string; count: number }[];
  memoryBefore: { rss: number; heapUsed: number; external: number };
  memoryAfter: { rss: number; heapUsed: number; external: number };
}

export interface DiagnosticRecord {
  id: string;
  projectId: string;
  kind: DiagnosticKind;
  seconds: number;
  createdAt: string;
  automationId?: string;
  startedAt?: string;
  finishedAt?: string;
  pid?: number;
  hostname?: string;
  admissionError?: string;
  summary?: DiagnosticSummary;
}

export interface DiagnosticView extends DiagnosticRecord {
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "rejected" | "unavailable";
  error: string | null;
  hasResult: boolean;
}

export const diagnosticLabels: Record<DiagnosticKind, string> = { cpu: "CPU profile", coverage: "Function calls" };
export const diagnosticRunning = (capture: Pick<DiagnosticView, "status">) =>
  capture.status === "queued" || capture.status === "running";
