import { projectCompositionSchema } from "pstdio-api-contracts";
import defaults from "../../../files/default-project-composition.json";
import type { ExtensionsRouteDeps } from "../extensions/deps";

export const readProjectComposition = async (
  deps: Pick<ExtensionsRouteDeps, "projectInfoService">,
  projectId: string,
) => {
  const info = await deps.projectInfoService.read(projectId);
  return projectCompositionSchema.parse(info.composition === undefined ? defaults : JSON.parse(info.composition));
};
