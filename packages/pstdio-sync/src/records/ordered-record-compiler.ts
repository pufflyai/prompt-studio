import { canonicalJson, type Json, type StorageGroup, type StorageTextDeclaration } from "pstdio-sync-contracts";
import { applyJsonChanges, observeJson, parseJsonPointer, replacementChanges } from "./ordered-json";
import { type OrderedRecord, prepareOrderedOperation } from "./ordered-operation";
import { readOrderedObservation } from "./ordered-operation-wire";
import { orderedBody } from "./ordered-projection";
import { editOrderedShared } from "./ordered-shared";
import { compileOrderedText } from "./ordered-text-compiler";

const valueChanges = async (edit: StorageGroup["edits"][number], current: OrderedRecord | undefined) => {
  if (edit.replace !== undefined && (edit.set !== undefined || edit.unset !== undefined))
    throw new Error("Choose a replacement or explicit paths");
  const token = edit.observedRevision ?? edit.expectedRevision;
  const observed = token ? readOrderedObservation(token).value : await observeJson(current?.value ?? null);
  const baseline = observed.kind === "object" ? observed.fields : {};
  if (Object.hasOwn(edit, "replace")) {
    canonicalJson(edit.replace!);
    return replacementChanges(baseline.value, edit.replace!);
  }
  return [
    ...Object.entries(edit.set ?? {}).map(([path, set]) => ({ path: parseJsonPointer(path), set })),
    ...(edit.unset ?? []).map((path) => ({ path: parseJsonPointer(path), remove: true as const })),
  ];
};

const compileEdit = async (
  edit: StorageGroup["edits"][number],
  current: OrderedRecord | undefined,
  declarations: StorageTextDeclaration[],
  operationId: string,
) => {
  if (
    !Object.hasOwn(edit, "replace") &&
    edit.asset === undefined &&
    edit.deleted === undefined &&
    !edit.shared?.length &&
    edit.set === undefined &&
    edit.unset === undefined &&
    !Object.keys(edit.text ?? {}).length
  )
    throw new Error("Empty record edit");
  const body = current ? orderedBody(current) : { value: null, asset: null, shared: null };
  if (
    edit.asset !== undefined &&
    !edit.deleted &&
    !current?.deleted &&
    "nativeSources" in body &&
    Object.values(body.nativeSources).some(
      (source) =>
        "asset" in source &&
        canonicalJson(edit.asset as unknown as Json) !== canonicalJson(source.asset as unknown as Json),
    )
  )
    throw new Error("A bound file must be written through its text source");
  const plain = await valueChanges(edit, current);
  const changes = plain.map((change) => ({ ...change, path: ["value", ...change.path] }));
  const recreating = current?.deleted && edit.deleted === false;
  if (recreating) changes.push({ path: ["nativeSources"], remove: true });
  if (edit.asset !== undefined) changes.push({ path: ["asset"], set: edit.asset as Json });
  let shared = body.shared;
  if (edit.shared?.length) {
    shared = editOrderedShared(body.shared, edit.shared);
    for (const change of await replacementChanges(await observeJson(body.shared as Json), shared as Json))
      changes.push({ ...change, path: ["shared", ...change.path] });
  }
  const target = { ...body, value: applyJsonChanges(body.value, plain), shared } as Json;
  const compiled = await compileOrderedText({
    edit,
    current: recreating
      ? {
          ...current,
          texts: undefined,
          lifetime: JSON.stringify(["recreate", operationId]),
          value: { ...body, value: null, nativeSources: {} } as Json,
        }
      : current,
    declarations,
    changes,
    target,
    ...(shared?.kind === "text" ? { sharedText: shared.value } : {}),
  });
  return {
    recordId: edit.recordId,
    changes: compiled.changes,
    ...(compiled.texts.length ? { texts: compiled.texts } : {}),
    ...(edit.deleted === undefined ? {} : { deleted: edit.deleted }),
    ...(edit.expectedRevision === undefined ? {} : { expectedRevision: edit.expectedRevision }),
  };
};

/** Compile only channels requested by the author, even when its observed baseline is stale. */
export const compileOrderedGroup = async (
  group: StorageGroup,
  views: ReadonlyMap<string, OrderedRecord>,
  declarations: StorageTextDeclaration[] = [],
) =>
  prepareOrderedOperation(
    {
      operationId: group.operationId,
      edits: await Promise.all(
        group.edits.map((edit) => compileEdit(edit, views.get(edit.recordId), declarations, group.operationId)),
      ),
    },
    views,
  );
