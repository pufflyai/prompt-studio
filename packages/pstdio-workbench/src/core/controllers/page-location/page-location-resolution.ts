import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { pageLocationTarget } from "../navigation/resource-editor-lookup";
import { normalizeWorkbenchPageLocation, normalizeWorkbenchPageTarget } from "./page-location-normalization";
import type { CreateWorkbenchPageLocationControllerInput, ResolvedPageLocation } from "./page-location-types";
import { resolveLocationMode, resolvePageTargetMode, resolveStartPageLocation } from "./page-mode-locations";

export const createPageLocationResolution = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  resources: WorkbenchPageResourceCodec,
) => {
  const pages = input.registry.listPages;
  const activeModeId = () => input.registry.store.getState().activeModeId;
  const normalizeRawStored = (location: PageLocation): ResolvedPageLocation =>
    resolveLocationMode(
      normalizeWorkbenchPageLocation({ location, pages: pages(), resources: resources }),
      pages(),
      activeModeId(),
    );
  const normalizeStored = (location: PageLocation, current = input.registry.store.getState()): ResolvedPageLocation => {
    const resolved = normalizeRawStored(location);
    const target = pageLocationTarget(resolved.location);
    const editorTarget = input.resolvePageTarget?.(target, current) ?? { target };
    return {
      ...(editorTarget.target === target
        ? resolved
        : normalizeWorkbenchPageTarget({ target: editorTarget.target, pages: pages(), resources: resources })),
      activate: editorTarget.activate,
      editorOpens: editorTarget.editorOpens,
    };
  };
  const start = () => resolveStartPageLocation(input.startPage, pages(), resources);
  const normalizeTarget = (
    target: Parameters<typeof resolvePageTargetMode>[0],
    current = input.registry.store.getState(),
  ) => {
    const modeId = current.activeModeId;
    const modeTarget = resolvePageTargetMode(target, pages(), modeId);
    const editorTarget = input.resolvePageTarget?.(modeTarget, current) ?? { target: modeTarget };
    return {
      ...normalizeWorkbenchPageTarget({
        target: resolvePageTargetMode(editorTarget.target, pages(), modeId),
        pages: pages(),
        resources: resources,
        active: current.location,
      }),
      activate: editorTarget.activate,
      editorOpens: editorTarget.editorOpens,
    };
  };

  return { normalizeRawStored, normalizeStored, normalizeTarget, start };
};
