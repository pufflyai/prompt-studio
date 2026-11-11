import { publishPreparationEvent, startPreparationWorker } from "pstdio-extensions/preparation-server";

let sequence = 0;
startPreparationWorker(async (task, data, signal) => {
  const input = data as { url?: string; name?: string; rows?: unknown[]; id?: string; event?: Record<string, unknown> };
  if (task === "hold") await fetch(input.url!, { signal });
  if (task === "watch.update") publishPreparationEvent({ registration: input.rows, watchId: input.id });
  if (task === "notify") publishPreparationEvent(input.event!);
  return { name: input.name, sequence: ++sequence };
});
