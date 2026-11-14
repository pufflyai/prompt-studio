import { type APIRequestContext, expect } from "@playwright/test";

export const summarizeSamples = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { samples, min: sorted[0], median, max: sorted[sorted.length - 1] };
};

// The planner registers its views after the project starts, and a sample must not include that boot.
export const waitForTicketsView = (request: APIRequestContext, projectId: string) =>
  expect
    .poll(
      async () => {
        const response = await request.get(`/v1/projects/${projectId}/extensions/ui`);
        if (!response.ok()) return false;
        const metadata = (await response.json()) as { views?: Array<{ id: string; body?: { kind?: string } }> };
        return (
          metadata.views?.some(
            (view) => view.id === "pstdio.pstdio-planner.view.tickets" && view.body?.kind === "kanban",
          ) ?? false
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
