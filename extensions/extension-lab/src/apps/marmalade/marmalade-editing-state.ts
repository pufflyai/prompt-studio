import { diffEditingState, type JsonValue, type WebviewEditingChange } from "@pstdio/sdk/extensions";
import type { MarmaladeLayer, MarmaladeViewState } from "./marmalade.types";

export interface MarmaladeEditingState extends Omit<MarmaladeViewState, "document"> {
  document: Omit<MarmaladeViewState["document"], "layers"> & {
    layers: Record<string, MarmaladeLayer>;
    order: string[];
  };
}
const layerKey = (id: string) => `layer:${id}`;
/** Session projection uses stable IDs so a property draft never replaces another layer's accepted fields. */
export const marmaladeEditingState = (state: MarmaladeViewState) => {
  const { layers, ...document } = state.document;
  return {
    ...state,
    document: {
      ...document,
      layers: Object.fromEntries(layers.map((layer) => [layerKey(layer.id), layer])),
      order: layers.map((layer) => layer.id),
    },
  } satisfies MarmaladeEditingState;
};
export const marmaladeEditingView = (state: MarmaladeEditingState) => {
  const { layers, order, ...document } = state.document;
  return {
    ...state,
    document: { ...document, layers: order.flatMap((id) => (layers[layerKey(id)] ? [layers[layerKey(id)]] : [])) },
  };
};
export const marmaladeEditingChanges = (
  before: MarmaladeViewState,
  after: MarmaladeViewState,
  previous: WebviewEditingChange[] = [],
) => {
  const next = marmaladeEditingState(after);
  const changes = diffEditingState(marmaladeEditingState(before), next);
  const paths = new Map([...previous, ...changes].map(({ path }) => [JSON.stringify(path), path]));
  return [...paths.values()].flatMap((path) => {
    let value: unknown = next;
    for (const key of path) value = value && typeof value === "object" ? Reflect.get(value, key) : undefined;
    // A parent replacement already covers a removed child's path.
    return value === undefined ? [] : [{ path, value: value as JsonValue }];
  });
};
