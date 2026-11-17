import { startPreparationWorker } from "pstdio-extensions/preparation-server";

startPreparationWorker(async (task, input, signal) => {
  const value = input as { name: string; url?: string };
  if (task === "wait") await fetch(value.url!, { signal });
  return value.name;
});
