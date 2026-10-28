import type { Request } from "@playwright/test";

export interface SubnavRequestClockInput {
  url: string;
  timing: ReturnType<Request["timing"]>;
  elapsedMs: number;
}

export interface SubnavResourceClockEntry {
  name: string;
  responseEnd: number;
}

export const measureSubnavRequests = (
  requests: SubnavRequestClockInput[],
  resources: SubnavResourceClockEntry[],
  started: number,
) => {
  const urls = new Set(requests.map(({ url }) => url));
  const byUrl = new Map<string, SubnavResourceClockEntry[]>();
  for (const resource of resources) {
    if (!urls.has(resource.name)) continue;
    const entries = byUrl.get(resource.name) ?? [];
    entries.push(resource);
    byUrl.set(resource.name, entries);
  }
  const measured = requests.map(({ url, timing, elapsedMs }) => {
    const resource = byUrl.get(url)?.shift();
    if (!resource) throw new Error(`Missing browser resource timing for ${url}`);
    return {
      durationMs: timing.responseEnd >= 0 ? timing.responseEnd : elapsedMs,
      completedMs: resource.responseEnd - started,
    };
  });
  if ([...byUrl.values()].some((entries) => entries.length)) {
    throw new Error("Browser resource timing does not match the recorded request count");
  }
  return measured;
};
