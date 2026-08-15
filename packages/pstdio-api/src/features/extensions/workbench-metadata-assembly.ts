import { join } from "node:path";
import type { ExtensionRuntime } from "pstdio-extensions";
import type { ExtensionsRouteDeps, ExtensionWebviewMetadataDeps } from "./deps";
import { buildAutomationRecords } from "./extension-automations";
import { resolvePstdioHome } from "./install-extension-source";
import { buildWorkbenchExtensionMetadata } from "./workbench-extension-metadata";

type SourceLike = {
  instance: { id: string };
  installedSource: { id: string; extension_id: string; install_name: string; loaded_revision: string | null };
};

const toViewRecord = (record: {
  id: string;
  localId: string;
  extensionId: string;
  contribution: { title?: unknown };
}) => ({
  id: record.id,
  localId: record.localId,
  extensionId: record.extensionId,
  title: record.contribution.title as never,
});

// The workbench metadata payload plus the dashboard-facing record groups
// (automations with effective enablement, harnesses, skills, templates, themes).
export const assembleWorkbenchMetadata = async (
  deps: ExtensionsRouteDeps & ExtensionWebviewMetadataDeps,
  projectId: string,
  runtime: ExtensionRuntime,
  sources: SourceLike[],
) => {
  const installNamesByExtensionId = new Map(
    sources.map(({ installedSource }) => [installedSource.extension_id, installedSource.install_name]),
  );
  const installedExtensionIdsByExtensionId = new Map(
    sources.map(({ installedSource }) => [installedSource.extension_id, installedSource.id]),
  );
  const assetRevisionsByExtensionId = new Map(
    sources.map(({ installedSource }) => [installedSource.extension_id, installedSource.loaded_revision]),
  );
  const extensionInstanceIdsByExtensionId = new Map(
    sources.map(({ installedSource, instance }) => [installedSource.extension_id, instance.id]),
  );
  const webviewCacheRoot = join(resolvePstdioHome({ env: process.env }), "cache", "extension-webviews");
  const automations = await buildAutomationRecords(deps, projectId, runtime, sources);
  const harnesses = runtime.harnesses.map((harness) => ({
    id: harness.id,
    localId: harness.localId,
    extensionId: harness.extensionId,
    label: harness.provider?.label,
  }));
  const skills = runtime.skills.map(toViewRecord);
  const templates = runtime.templates.map(toViewRecord);
  // Theme records carry their title at the top level, unlike skills/templates.
  const themes = [...runtime.themes, ...runtime.fileIconThemes].map((record) => ({
    id: record.id,
    localId: record.localId,
    extensionId: record.extensionId,
    title: record.title as never,
  }));

  return {
    ...buildWorkbenchExtensionMetadata({
      extensionInstanceIdsByExtensionId,
      installedExtensionIdsByExtensionId,
      installNamesByExtensionId,
      runtime,
      assetRevisionsByExtensionId,
      webviewUrlIssuer: deps.extensionWebviewAccess,
      webviewCacheRoot,
    }),
    automations,
    harnesses,
    skills,
    templates,
    themes,
  };
};
