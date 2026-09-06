import type { PlacementPresentation } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { registerPrivateHandler } from "./private-handlers";

export const normalizePlacementTab = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  id: string;
  tab: PlacementPresentation["tab"];
}) => {
  if (!input.tab) return undefined;
  const queryHandlerId = registerPrivateHandler({
    ...input,
    rendererId: input.id,
    rendererKind: "tab",
    rendererLocalId: input.id,
    operation: "query",
    handler: input.tab.query,
  });
  if (!queryHandlerId) return undefined;
  return { refreshEvents: input.tab.refreshEvents, queryHandlerId };
};
