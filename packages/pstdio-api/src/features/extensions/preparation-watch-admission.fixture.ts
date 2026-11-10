import { publishPreparationEvent, startPreparationWorker } from "pstdio-extensions/preparation-server";

let sequence = 0;
startPreparationWorker(async (task, data, signal) => {
  const input = data as { url?: string; name?: string; rows?: unknown[] };
  if (task === "hold") await fetch(input.url!, { signal });
  if (task === "watch.update") publishPreparationEvent({ registration: input.rows });
  return { name: input.name, sequence: ++sequence };
});
