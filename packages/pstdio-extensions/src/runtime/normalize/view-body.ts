import type { ViewBody } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator, RegistryIndex } from "./accumulator";
import { registerPrivateHandler } from "./private-handlers";

const handler = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  viewId: string;
  localId: string;
  kind: "controls" | "dataTable" | "file" | "kanban" | "tree";
  operation: string;
  value: unknown;
}) =>
  registerPrivateHandler({
    ext: input.ext,
    source: input.source,
    runtime: input.runtime,
    index: input.index,
    rendererId: input.viewId,
    rendererKind: input.kind,
    rendererLocalId: input.localId,
    operation: input.operation,
    handler: input.value,
  });

export const normalizeViewBody = (input: {
  ext: NormalizedExtension;
  source: LoadedExtensionSource;
  runtime: Accumulator;
  index: RegistryIndex;
  viewId: string;
  localId: string;
  body: ViewBody;
}) => {
  const body = input.body as ViewBody & Record<string, unknown>;
  if (body.kind === "webview") return body;
  if (body.kind === "tree") {
    return {
      ...body,
      bodyHandlerId: handler({ ...input, kind: "tree", operation: "body", value: body.body }),
      childrenHandlerId: handler({ ...input, kind: "tree", operation: "children", value: body.children }),
      footerHandlerId: handler({ ...input, kind: "tree", operation: "footer", value: body.footer }),
    };
  }
  if (body.kind === "file") {
    return {
      ...body,
      loadHandlerId: handler({ ...input, kind: "file", operation: "load", value: body.load }),
      saveHandlerId: handler({ ...input, kind: "file", operation: "save", value: body.save }),
    };
  }
  if (body.kind === "controls") {
    return {
      ...body,
      queryHandlerId: handler({ ...input, kind: "controls", operation: "query", value: body.query }),
      valueChangeHandlerId: handler({
        ...input,
        kind: "controls",
        operation: "onValueChange",
        value: body.onValueChange,
      }),
      applyHandlerId: handler({ ...input, kind: "controls", operation: "onApply", value: body.onApply }),
      resetHandlerId: handler({ ...input, kind: "controls", operation: "onReset", value: body.onReset }),
    };
  }
  if (body.kind === "kanban") {
    return {
      ...body,
      queryHandlerId: handler({ ...input, kind: "kanban", operation: "query", value: body.query }),
      attributeChangeHandlerId: handler({
        ...input,
        kind: "kanban",
        operation: "onAttributeChange",
        value: body.onAttributeChange,
      }),
      reorderHandlerId: handler({ ...input, kind: "kanban", operation: "onReorder", value: body.onReorder }),
      columnActionHandlerId: handler({
        ...input,
        kind: "kanban",
        operation: "onColumnAction",
        value: body.onColumnAction,
      }),
      rowActivationHandlerId: handler({
        ...input,
        kind: "kanban",
        operation: "onRowActivate",
        value: body.onRowActivate,
      }),
    };
  }
  return {
    ...body,
    queryHandlerId: handler({ ...input, kind: "dataTable", operation: "query", value: body.query }),
    rowActivationHandlerId: handler({
      ...input,
      kind: "dataTable",
      operation: "onRowActivate",
      value: body.onRowActivate,
    }),
  };
};
