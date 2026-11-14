import type { Profiler } from "node:inspector";
import type { DiagnosticSummary } from "./types";

// A CPU call tree can contain the same function under several callers.
export const frequentFunctions = (profile?: Profiler.Profile, coverage: Profiler.ScriptCoverage[] = []) => {
  const samples = new Map<number, number>();
  for (const id of profile?.samples ?? []) samples.set(id, (samples.get(id) ?? 0) + 1);
  const entries = profile
    ? profile.nodes.map((node) => ({
        name: node.callFrame.functionName || "(anonymous)",
        location: `${node.callFrame.url}:${node.callFrame.lineNumber}:${node.callFrame.columnNumber}`,
        count: samples.get(node.id) ?? 0,
      }))
    : coverage.flatMap((script) =>
        script.functions.map((entry) => ({
          name: entry.functionName || "(anonymous)",
          location: `${script.url}:${entry.ranges[0]?.startOffset ?? 0}`,
          count: entry.ranges[0]?.count ?? 0,
        })),
      );
  const functions = new Map<string, DiagnosticSummary["top"][number]>();
  for (const entry of entries) {
    const key = JSON.stringify([entry.location, entry.name]);
    const previous = functions.get(key);
    functions.set(key, { ...entry, count: (previous?.count ?? 0) + entry.count });
  }
  return {
    total: entries.reduce((total, entry) => total + entry.count, 0),
    top: [...functions.values()]
      .filter((entry) => entry.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
};
