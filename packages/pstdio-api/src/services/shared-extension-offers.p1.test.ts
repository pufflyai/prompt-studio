import { expect, test } from "bun:test";
import { mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { writeExtension } from "../features/extensions/default-extensions-test-fixtures";
import { createExtensionSourceMutations } from "./extension-source-mutations";
import { createSharedExtensionOffers } from "./shared-extension-offers";

test.each([
  "cancelled",
  "uninstalled",
  "installing",
  "file",
  "symlink",
  "deleted project",
])("a queued shared offer rechecks %s before writing", async (change) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "shared-offer-lifetime-")));
  const previous = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const handle = await createDb({ path: ":memory:" });
  const release = Promise.withResolvers<void>();
  let held: Promise<unknown> | undefined;
  let pending: Promise<unknown> | undefined;
  try {
    const sources = createInstalledExtensionSourcesDBService(handle.db);
    const instances = createExtensionInstancesDBService(handle.db);
    const projects = createProjectsDBService(handle.db);
    const project = await projects.create({ name: "Offer" });
    const sourcePath = join(root, "extensions", "tool");
    writeExtension(sourcePath, "tool");
    const source = await sources.register({
      install_name: "tool",
      extension_id: "pstdio.tool",
      display_name: "Tool",
      source_path: sourcePath,
      source_kind: "local_path",
      manifest_json: {},
      status: "loaded",
    });
    const mutateSource = createExtensionSourceMutations();
    held = mutateSource(sourcePath, () => release.promise);
    const offer = createSharedExtensionOffers({ sources, instances, mutateSource, emit: () => {} });
    const controller = new AbortController();
    pending = offer({ projectId: project.id, installedSourceId: source.id, signal: controller.signal });
    // Queue behind the same source owner, then change its actual lifetime.
    await sources.get(source.id);
    if (change === "cancelled") controller.abort(new Error("Inventory closed"));
    if (change === "uninstalled") await sources.updateLoadState(source.id, { status: "missing" });
    if (change === "installing") await writeFile(join(sourcePath, ".pstdio-installing"), "");
    if (change === "file" || change === "symlink") {
      await rm(sourcePath, { recursive: true });
      if (change === "file") await writeFile(sourcePath, "replaced");
      else {
        const target = join(root, "repo-tool");
        writeExtension(target, "tool");
        await symlink(target, sourcePath);
      }
    }
    if (change === "deleted project") await projects.hardDelete(project.id);
    const outcome = pending.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    release.resolve();
    const result = await outcome;
    if (change === "cancelled") expect(result).toMatchObject({ error: new Error("Inventory closed") });
    else expect(result).toEqual({ value: null });
    expect(await instances.list({ scope_id: project.id })).toEqual([]);
  } finally {
    release.resolve();
    await held;
    await pending?.catch(() => {});
    await handle.close();
    if (previous === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
