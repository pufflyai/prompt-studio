import { afterEach } from "bun:test";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import type { SessionLogFiles } from "./log-files";
import { createPersonalLogStreams } from "./log-stream";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});

export const personalLogStreamsFixture = async (projectId: string, files: SessionLogFiles, namespace: string) => {
  const { db, close } = await createDb({ path: ":memory:" });
  cleanup.push(close);
  const now = new Date().toISOString();
  await db
    .insert(projects)
    .values({ id: projectId, name: "Personal logs", shorthand: "L", created_at: now, updated_at: now });
  const service = createExtensionStorageDBService(db).logs;
  const streams = createPersonalLogStreams({
    service,
    owner: { workbenchId: projectId, extensionId: "private-personal-log-fixture" },
    files,
    namespace,
  });
  return { streams, writerId: await streams.writerId() };
};
