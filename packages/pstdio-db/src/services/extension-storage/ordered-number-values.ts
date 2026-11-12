import { canonicalExtensionId } from "pstdio-api-contracts/extension-host";
import { type OrderedOperation, type OrderedRecord, orderedBody } from "pstdio-sync/records";
import type { Json } from "pstdio-sync-contracts";
import { isNumberRecord, type NumberRecord, numberIndexString } from "./resource-number-records";

export const numberAlias = (shorthand: string) => {
  const separator = shorthand.lastIndexOf("-");
  const suffix = shorthand.slice(separator + 1);
  const value = Number(suffix);
  if (separator < 1 || !/^[1-9]\d*$/.test(suffix) || !Number.isSafeInteger(value)) return;
  return { prefix: shorthand.slice(0, separator), value };
};
const bodyObject = (record: OrderedRecord | undefined) => {
  const value = record?.value;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
};
export const orderedNumber = (record: OrderedRecord | undefined, retained = false): NumberRecord | undefined => {
  if (!record) return;
  const value = orderedBody(record).value;
  if (
    !isNumberRecord({
      recordId: record.recordId,
      exists: true,
      deleted: retained ? false : record.deleted,
      value,
      revision: "",
      asset: null,
      shared: null,
    })
  )
    return;
  const number = value as unknown as NumberRecord;
  // Other core JSON remains valid; only ordinary resource identifiers enter SQL text indexes.
  if ([number.id, number.extensionId, number.kind, number.prefix, ...number.aliases].some((key) => key.includes("\0")))
    return;
  return { ...number, extensionId: canonicalExtensionId(number.extensionId) };
};
export const numberHistory = (record: OrderedRecord | undefined) => {
  const value = bodyObject(record).numberHistory;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {} as Record<string, number>;
  return Object.fromEntries(
    Object.entries(value).filter(
      ([prefix, high]) =>
        numberIndexString(prefix) && typeof high === "number" && Number.isSafeInteger(high) && high > 0,
    ),
  ) as Record<string, number>;
};
export const shownNumberAliases = (record: OrderedRecord | undefined) => {
  const value = bodyObject(record).numberAliases;
  return Array.isArray(value)
    ? value.filter(
        (alias): alias is string =>
          typeof alias === "string" && numberAlias(alias) !== undefined && numberIndexString(alias),
      )
    : [];
};
const aliasMetadataEdit = (edit: OrderedOperation["edits"][number]) => {
  if (edit.texts?.length || edit.deleted !== undefined || edit.condition || edit.changes.length !== 1) return false;
  const change = edit.changes[0]!;
  return (
    change.path.length === 1 &&
    change.path[0] === "numberAliases" &&
    "set" in change &&
    Array.isArray(change.set) &&
    change.set.every((alias) => typeof alias === "string" && numberAlias(alias) !== undefined)
  );
};
export const numberAliasIntent = (operation: OrderedOperation) =>
  operation.operationId.startsWith("number-alias:") && operation.edits.every(aliasMetadataEdit);

/** Private history is carried by checkpoints; the SQL floor index is always rebuildable from it. */
export const retainNumberHistory = (before: OrderedRecord | undefined, after: OrderedRecord, stamp?: string) => {
  const old = orderedNumber(before, true);
  const current = orderedNumber(after, true);
  const history = new Map(Object.entries(numberHistory(before)));
  const remember = (prefix: string, value: number) => history.set(prefix, Math.max(history.get(prefix) ?? 0, value));
  for (const [prefix, value] of Object.entries(numberHistory(after))) remember(prefix, value);
  const aliases = [
    ...new Set([
      ...shownNumberAliases(before),
      ...shownNumberAliases(after),
      ...(old?.aliases ?? []),
      ...(current?.aliases ?? []),
    ]),
  ].sort();
  for (const number of [old, current]) if (number) remember(number.prefix, number.value);
  for (const alias of aliases) {
    const number = numberAlias(alias)!;
    remember(number.prefix, number.value);
  }
  if (!history.size && !aliases.length) return after;
  const value: Record<string, Json> = {
    ...bodyObject(after),
    numberHistory: Object.fromEntries(history),
    numberAliases: aliases,
  };
  if (current)
    value.value = { ...current, aliases: [...new Set([...current.aliases, ...aliases])].sort() } as unknown as Json;
  const stamps = { ...after.stamps };
  if (stamp && current && shownNumberAliases(after).includes(`${current.prefix}-${current.value}`))
    stamps["/value/value"] = stamp;
  return { ...after, value, stamps };
};

export const renumberOrderedRecord = (record: OrderedRecord, value: number, stamp: string) => {
  const before = orderedNumber(record)!;
  const aliases = [
    ...new Set([
      ...shownNumberAliases(record),
      ...before.aliases,
      `${before.prefix}-${before.value}`,
      `${before.prefix}-${value}`,
    ]),
  ].sort();
  const result = {
    ...record,
    value: { ...bodyObject(record), value: { ...before, value, aliases }, numberAliases: aliases },
    stamps: { ...record.stamps, "/value/value": stamp, "/value/aliases": stamp },
  };
  return retainNumberHistory(record, result);
};

/** Metadata-only shown-alias intent cannot create or resurrect a refused/deleted resource. */
export const supplementNumberIntent = (
  before: ReadonlyMap<string, OrderedRecord>,
  records: OrderedRecord[],
  operation: OrderedOperation,
) => {
  if (!numberAliasIntent(operation)) return records;
  return operation.edits.flatMap((edit) => {
    const previous = before.get(edit.recordId);
    if (!previous) return [];
    return [
      {
        ...previous,
        value: { ...bodyObject(previous), numberAliases: "set" in edit.changes[0]! ? edit.changes[0]!.set : [] },
      },
    ];
  });
};
