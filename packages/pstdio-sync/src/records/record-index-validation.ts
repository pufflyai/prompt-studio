import type { StorageRecordIndex, StorageRelatedSelection } from "pstdio-sync-contracts";
import { queryField, validateQueryField } from "./record-query-field";

const validateIdentity = (index: StorageRecordIndex) => {
  if (index.identity) {
    const { kind, idField, shorthandField } = index.identity;
    if (
      !kind ||
      idField === shorthandField ||
      [idField, shorthandField].some((name) => queryField(index, name).type !== "string")
    )
      throw new Error("Identity fields need a kind and different string fields");
    if (queryField(index, idField).lookup || index.hierarchy?.breadcrumbField === idField)
      throw new Error("Resource identity joins need a local ID field");
    if (
      index.identity.aliasesField &&
      (queryField(index, index.identity.aliasesField).type !== "array" ||
        [idField, shorthandField].includes(index.identity.aliasesField))
    )
      throw new Error("Identity aliases need a different array field");
  }
};

const validateHierarchy = (index: StorageRecordIndex) => {
  if (index.hierarchy) {
    const { separator, idField, parentField, labelField, breadcrumbField } = index.hierarchy;
    const fields = [idField, parentField, labelField, breadcrumbField];
    if (
      typeof separator !== "string" ||
      new Set(fields).size !== fields.length ||
      fields.some((name) => queryField(index, name).type !== "string")
    )
      throw new Error("Hierarchy needs different string fields and a separator");
    if ([idField, parentField, labelField].some((name) => queryField(index, name).lookup))
      throw new Error("Hierarchy links and labels need local fields");
  }
};

const validateCountFields = (index: StorageRecordIndex) => {
  const counts = index.countBy ?? [];
  if (
    counts.length > 4 ||
    new Set(counts).size !== counts.length ||
    counts.some((name) => {
      const field = index.fields[name];
      return (
        !field?.derive ||
        field.lookup ||
        ["object", "array"].includes(field.type) ||
        name === index.identity?.shorthandField ||
        name === index.identity?.aliasesField ||
        name === index.hierarchy?.breadcrumbField
      );
    })
  )
    throw new Error("Count indexes require up to four distinct local derived scalar fields");
};
const validateAlternateOrders = (index: StorageRecordIndex) => {
  const alternate = index.alternateOrders ?? [];
  if (alternate.length > 8 || alternate.some((order) => !order.length || order.length > 8))
    throw new Error("An index supports up to eight alternate orders of one to eight local fields");
  for (const order of alternate)
    for (const { field } of order)
      if (
        index.fields[field]?.lookup ||
        field === index.identity?.shorthandField ||
        field === index.identity?.aliasesField ||
        field === index.hierarchy?.breadcrumbField
      )
        throw new Error("Alternate orders require local fields");
  return alternate;
};
const validateIndex = (index: StorageRecordIndex) => {
  if (!Object.keys(index.fields).length) throw new Error("An index needs fields");
  for (const [name, field] of Object.entries(index.fields)) validateQueryField(name, field);
  if (Object.values(index.fields).some((field) => field.expression || field.cases || field.format))
    throw new Error("Install derived fields; expressions and formatting belong to queries");
  validateIdentity(index);
  validateHierarchy(index);
  validateCountFields(index);
  const alternate = validateAlternateOrders(index);
  const sorts = [...(index.orderBy ?? []), ...alternate.flat()];
  for (const name of [...(index.equality ?? []), ...sorts.map((sort) => sort.field)]) {
    if (!Object.hasOwn(index.fields, name)) throw new Error(`Unknown index field: ${name}`);
    if (["array", "object"].includes(index.fields[name].type))
      throw new Error("Array and object fields cannot order a page");
  }
  for (const sort of sorts)
    if (sort.direction !== "asc" && sort.direction !== "desc") throw new Error("Invalid sort direction");
};

export const validateIndexes = (indexes: StorageRecordIndex[]) => {
  const names = new Set<string>();
  for (const index of indexes) {
    if (!index.name || names.has(index.name)) throw new Error("Index names must be unique and nonempty");
    names.add(index.name);
    validateIndex(index);
  }
  for (const index of indexes)
    for (const field of Object.values(index.fields)) {
      if (!field.lookup) continue;
      const target = indexes.find((target) => target.name === field.lookup!.index);
      if (!target || queryField(target, field.lookup.field).type !== field.type)
        throw new Error("Related projection needs a declared field of the same type");
      validateRelatedFields(index, field.lookup, (name) => {
        const target = indexes.find((index) => index.name === name);
        if (!target) throw new Error(`Unknown related index: ${name}`);
        return target;
      });
      if (queryField(target, field.lookup.field).lookup)
        throw new Error("Related projections cannot chain projection fields");
      if (
        field.lookup.on.some(
          (join) => queryField(index, join.sourceField).lookup || queryField(target, join.relatedField).lookup,
        )
      )
        throw new Error("Related projection joins need local fields");
    }
};

export const validateRelatedFields = (
  index: StorageRecordIndex,
  selection: StorageRelatedSelection,
  resolveIndex?: (name: string) => StorageRecordIndex,
) => {
  if (!resolveIndex) throw new Error("Related query needs installed indexes");
  const related = resolveIndex(selection.index);
  const joins = selection.on;
  if (!Array.isArray(joins) || !joins.length || joins.length > 8)
    throw new Error("Related query needs 1 to 8 join fields");
  for (const join of joins) {
    const source = queryField(index, join.sourceField).type;
    const target = queryField(related, join.relatedField).type;
    const operation = join.op ?? "eq";
    if (operation === "eq" && source !== target) throw new Error("Related fields must have the same type");
    if (operation === "contains" && (source !== "array" || target !== "string"))
      throw new Error("Related contains needs a source string array and related string");
    if (operation === "containedBy" && (source !== "string" || target !== "array"))
      throw new Error("Related containedBy needs a source string and related string array");
    if (!["eq", "contains", "containedBy"].includes(operation)) throw new Error("Unsupported related join");
  }
  return related;
};
