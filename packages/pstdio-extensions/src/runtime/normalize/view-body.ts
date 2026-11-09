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
  kind: "chat" | "controls" | "dataTable" | "file" | "kanban" | "resourceList" | "terminal" | "tree";
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
  if (body.kind === "terminal") {
    return {
      ...body,
      sessionHandlerId: handler({ ...input, kind: "terminal", operation: "session", value: body.session }),
    };
  }
  if (body.kind === "chat") {
    return {
      ...body,
      queryHandlerId: handler({ ...input, kind: "chat", operation: "query", value: body.query }),
      actionHandlerId: handler({ ...input, kind: "chat", operation: "onAction", value: body.onAction }),
      loadDraftHandlerId: handler({ ...input, kind: "chat", operation: "loadDraft", value: body.loadDraft }),
      saveDraftHandlerId: handler({ ...input, kind: "chat", operation: "saveDraft", value: body.saveDraft }),
      resolveLinkHandlerId: handler({ ...input, kind: "chat", operation: "resolveLink", value: body.resolveLink }),
      resolveImageHandlerId: handler({ ...input, kind: "chat", operation: "resolveImage", value: body.resolveImage }),
    };
  }
  if (body.kind === "tree") {
    return {
      ...body,
      headerHandlerId: handler({ ...input, kind: "tree", operation: "header", value: body.header }),
      bodyHandlerId: handler({ ...input, kind: "tree", operation: "body", value: body.body }),
      childrenHandlerId: handler({ ...input, kind: "tree", operation: "children", value: body.children }),
      pageHandlerId: handler({ ...input, kind: "tree", operation: "page", value: body.page }),
      footerHandlerId: handler({ ...input, kind: "tree", operation: "footer", value: body.footer }),
      moveHandlerId: handler({ ...input, kind: "tree", operation: "onMove", value: body.onMove }),
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
  if (body.kind === "kanban" || body.kind === "resourceList") {
    return {
      ...body,
      queryHandlerId: handler({ ...input, kind: body.kind, operation: "query", value: body.query }),
      attributeChangeHandlerId: handler({
        ...input,
        kind: body.kind,
        operation: "onAttributeChange",
        value: body.onAttributeChange,
      }),
      moveHandlerId: handler({
        ...input,
        kind: body.kind,
        operation: "onMove",
        value: "onMove" in body ? body.onMove : undefined,
      }),
      columnActionHandlerId: handler({
        ...input,
        kind: body.kind,
        operation: "onColumnAction",
        value: body.onColumnAction,
      }),
      rowActivationHandlerId: handler({
        ...input,
        kind: body.kind,
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
