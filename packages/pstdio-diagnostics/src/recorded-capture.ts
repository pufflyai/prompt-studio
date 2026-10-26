import type {
  PerformanceCapture,
  PerformanceCaptureSample,
  PerformanceRecordingExport,
} from "pstdio-api-contracts/performance-diagnostics";

/** Saved history supplies startup samples that have left the bounded live window. */
export const restoreRecordedCapture = (recording: PerformanceRecordingExport, live: PerformanceCapture) => {
  const samples = new Map<number, PerformanceCaptureSample>();
  for (const file of recording.files) {
    for (const line of file.content.split("\n").filter(Boolean)) {
      const record = JSON.parse(line) as { kind: string; captureId?: string; sample?: PerformanceCaptureSample };
      if (record.kind === "sample" && record.captureId === live.id && record.sample)
        samples.set(record.sample.sequence, record.sample);
    }
  }
  for (const sample of live.samples) samples.set(sample.sequence, sample);
  const ordered = [...samples.values()].sort((left, right) => left.sequence - right.sequence);
  const total = Math.max(live.samples.length + live.droppedSamples, (ordered.at(-1)?.sequence ?? -1) + 1);
  return { ...live, samples: ordered, droppedSamples: total - ordered.length };
};
