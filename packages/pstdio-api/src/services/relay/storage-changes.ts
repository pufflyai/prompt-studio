import type { ExtensionsRouteDeps } from "../../features/extensions/deps";

// Writes in a burst, such as one sync round or one command, commit a few milliseconds apart and
// across several event loop turns. Waiting for a short quiet gap merges them; the maximum delay
// keeps a long download from holding back every view update.
const quietMs = 25;
const maxDelayMs = 250;

/** Tells open views that committed project storage changed, once per project for each burst of writes. */
export const createStorageChangeAnnouncer = (eventBus: ExtensionsRouteDeps["eventBus"]) => {
  const projects = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let firstChange = 0;
  const announce = () => {
    timer = undefined;
    for (const projectId of projects)
      eventBus.emit("extension_events", "set", {
        id: crypto.randomUUID(),
        projectId,
        eventId: "pstdio.event.storage-changed",
      });
    projects.clear();
  };
  return {
    changed(projectId: string) {
      const now = performance.now();
      if (!projects.size) firstChange = now;
      projects.add(projectId);
      clearTimeout(timer);
      timer = setTimeout(announce, Math.min(quietMs, firstChange + maxDelayMs - now));
    },
    close: () => clearTimeout(timer),
  };
};
