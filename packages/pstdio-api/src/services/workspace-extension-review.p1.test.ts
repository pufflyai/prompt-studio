import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { packagedExtensionCatalog } from "../features/extensions/extension-catalog";
import { activatePreparedInstall, settlePreparedInstall } from "../features/extensions/extension-install-transaction";
import { installExtensionSource } from "../features/extensions/install-extension-source";
import { startExtensionSourceReview } from "../features/extensions/review-extension-source";
import { createExtensionUpgradeService, type ExtensionService } from "./extension-upgrade-service";

test("stages, validates and applies a compatible workspace snapshot while retaining local files", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-extension-review-"));
  try {
    const workspace = join(root, "workspace");
    const incoming = join(workspace, "extensions", "harness-codex");
    const local = join(root, "local", "harness-codex");
    const home = join(root, "home");
    for (const path of [incoming, local]) await mkdir(path, { recursive: true });
    const manifest = (version: string, api: string) =>
      JSON.stringify({
        name: "harness-codex",
        publisher: "pstdio",
        version,
        main: "extension.ts",
        engines: { pstdio: api },
      });
    await writeFile(join(local, "package.json"), manifest("0.48.0", "^0.5.0"));
    const edited = "export default {}; // local customizations\n";
    await writeFile(join(local, "extension.ts"), edited);
    await writeFile(join(local, "local-notes.txt"), "Keep these notes.\n");
    await writeFile(join(incoming, "package.json"), manifest("0.49.0", `^${EXTENSION_API_VERSION}`));
    const candidate = "export default {}; // compatible workspace snapshot\n";
    await writeFile(join(incoming, "extension.ts"), candidate);
    const instance = { id: "local-provider", enabled: true };
    const source = {
      id: "local-source",
      install_name: "harness-codex",
      extension_id: "pstdio.harness-codex",
      display_name: "Codex",
      source_path: local,
      source_ref: null,
      source_kind: "local_path",
      source_hash: "previous-source",
      version: "0.48.0",
      manifest_json: { name: "harness-codex", enginesPstdio: "^0.5.0" },
    };
    let switched: Parameters<ExtensionService["enableInstalledSourceForProject"]>[0] | undefined;
    const extensionService = {
      assertInstalledSourceChoice: async (sourceId: string) => {
        expect(sourceId).toBe(source.id);
      },
      getProjectExtensionInstance: async () => ({ instance, installedSource: source }),
      listProjectExtensionInstances: async () => [{ instance, installedSource: source }],
      enableInstalledSourceForProject: async (
        input: Parameters<ExtensionService["enableInstalledSourceForProject"]>[0],
        guard: Parameters<ExtensionService["enableInstalledSourceForProject"]>[1],
      ) => {
        expect(guard).toMatchObject({ expectedProvider: instance.id });
        expect(input.installation).toBeDefined();
        await activatePreparedInstall(input.installation!);
        await settlePreparedInstall(input.installation!, true);
        switched = input;
        return { instance: { ...instance, id: "compatible-provider" }, installedSource: source };
      },
    } as unknown as ExtensionService;
    const service = createExtensionUpgradeService({
      home,
      extensionService,
      catalog: packagedExtensionCatalog,
      release: { source: "workspace", root: workspace, ref: "pstdio@0.48.0" },
      workspaceService: { getDefault: async () => null },
      installExtensionSource: (input) =>
        installExtensionSource({ ...input, env: { PSTDIO_HOME: home }, skipInstall: true }),
    });
    await expect(service.upgrade("project", instance.id)).rejects.toThrow("Choose which version of Codex");
    const review = (await service.reviews.beginReview("project", instance.id))!;
    expect(review.hasOriginal).toBe(false);
    const file = (await service.reviews.readReviewFile("project", instance.id, review.id, "extension.ts"))!;
    expect(file.local).toBe(edited);
    expect(file.incoming).toBe(candidate);
    await writeFile(join(incoming, "extension.ts"), "export default {}; // changed after review\n");
    const choices = review.changes
      .filter((change) => change.status === "conflict")
      .map((change) => ({ path: change.path, kind: "incoming" as const }));
    expect(await service.reviews.validateReview("project", instance.id, review.id, review.revision, choices)).toEqual({
      valid: true,
      revision: review.revision,
    });
    await service.reviews.applyReview("project", instance.id, review.id, choices, { revision: review.revision });
    expect(switched).toBeDefined();
    expect(switched!.sourcePath).not.toBe(local);
    expect(switched!.sourceKind).toBe("local_path");
    expect(switched!.sourceRef).toBeNull();
    expect(await readFile(join(switched!.sourcePath, "extension.ts"), "utf8")).toBe(candidate);
    expect(await readFile(join(local, "extension.ts"), "utf8")).toBe(edited);
    expect(await readFile(join(local, "local-notes.txt"), "utf8")).toBe("Keep these notes.\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local review candidates require the running workspace and a separate provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-review-boundary-"));
  try {
    const workspace = join(root, "workspace");
    const outside = join(root, "outside");
    for (const path of [workspace, outside]) await mkdir(path);
    const link = join(workspace, "linked-extension");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
    const source = { path: outside, ref: null, separateProviderId: "local-provider" };
    const begin = (path: string, trustedRoot?: string, separateProviderId = source.separateProviderId) =>
      startExtensionSourceReview(
        join(root, "home"),
        "project",
        "instance",
        "pstdio.harness-codex",
        { ...source, separateProviderId },
        { source: path },
        trustedRoot,
      );
    await expect(begin(workspace)).rejects.toThrow("pinned upstream release");
    await expect(begin(workspace, workspace, "")).rejects.toThrow("pinned upstream release");
    await expect(begin(outside, workspace)).rejects.toThrow("running workspace");
    await expect(begin(link, workspace)).rejects.toThrow("running workspace");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
