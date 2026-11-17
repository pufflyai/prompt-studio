import { projectCompositionSchema } from "pstdio-api-contracts";
import defaults from "../../../files/default-project-composition.json";
import type { ExtensionsRouteDeps } from "../extensions/deps";

export const announceProjectCompositionChange = (deps: ExtensionsRouteDeps, projectId: string) => {
  deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "runtime_refresh" });
  deps.eventBus.emit("extension_events", "set", {
    id: crypto.randomUUID(),
    projectId,
    eventId: "pstdio.event.project-composition-changed",
  });
};

export const readProjectComposition = async (
  deps: Pick<ExtensionsRouteDeps, "projectInfoService">,
  projectId: string,
) => {
  const info = await deps.projectInfoService.read(projectId);
  if (info.composition === undefined) return projectCompositionSchema.parse(defaults);
  const empty = () => projectCompositionSchema.parse({ defaultPage: null, resourceOpeners: [] });
  let value: unknown;
  try {
    value = JSON.parse(info.composition);
  } catch (error) {
    if (error instanceof SyntaxError) return empty();
    throw error;
  }
  const parsed = projectCompositionSchema.safeParse(value);
  // Synced bytes remain intact so a compatible peer or a later explicit edit can recover them.
  return parsed.success ? parsed.data : empty();
};
