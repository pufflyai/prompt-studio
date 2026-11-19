import type { StoragePredicate, ViewFilterGroup, ViewSort } from "pstdio-api-contracts/extension-kernel";
import { type CollectionPageSelection, readCollectionPage } from "./collection-page";
import { collectionDateFields } from "./collection-view-date";
import {
  type CollectionQueryField,
  collectionFilterPredicate,
  collectionSearchPredicate,
} from "./collection-view-filter";
import { collectionGroupSelection } from "./collection-view-groups";
import { collectionSortSelection } from "./collection-view-sort";
import { scalarViewValues } from "./collection-view-values";

export type { CollectionQueryField } from "./collection-view-filter";
export interface CollectionViewSelection extends Omit<CollectionPageSelection, "fields" | "search" | "groups"> {
  fields: Record<string, CollectionQueryField>;
  select?: string[];
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  searchFields?: string[];
  groups?: string[];
}

const together = (...parts: (StoragePredicate | undefined)[]): StoragePredicate | undefined => {
  const all = parts.filter((part) => part !== undefined);
  return all.length ? { all } : undefined;
};

/** A bounded provider for tables and boards. Controls are translated before SQL selection; it never assembles a collection. */
export const collectionViewSelection = (input: CollectionViewSelection) => {
  const { page, groups: groupNames = [] } = input;
  const { fields, formats, computed: dateComputed } = collectionDateFields(input);
  const filter = collectionFilterPredicate(fields, input.filter, page);
  const needle = page?.search.trim().toLowerCase();
  const search = needle
    ? {
        any: (input.searchFields ?? Object.keys(fields)).flatMap((name) =>
          fields[name] ? [collectionSearchPredicate(fields[name], needle)] : [],
        ),
      }
    : undefined;
  const { orderBy, computed, textOrder } = collectionSortSelection({ ...input, computed: dateComputed }, fields);
  const groups = collectionGroupSelection(groupNames, fields, computed);
  const hidden = collapsedGroupPredicates(groups[0] && fields[groups[0].field], page?.collapsedGroups ?? []);
  return {
    index: input.index,
    computed,
    textOrder,
    formats,
    where: together(input.where, filter),
    search,
    visible: together(input.visible, hidden.length ? { all: hidden } : undefined),
    fields: input.select ?? [...new Set(Object.values(fields).map((field) => field.field))],
    orderBy,
    groups,
    page: !groups.length && page?.collapsedGroups?.length ? { ...page, collapsedGroups: [] } : page,
  } satisfies CollectionPageSelection;
};

export const readCollectionViewPage = (
  storage: Parameters<typeof readCollectionPage>[0],
  input: CollectionViewSelection,
) => readCollectionPage(storage, collectionViewSelection(input));

const collapsedGroupPredicates = (firstGroup: CollectionQueryField | undefined, collapsed: string[]) => {
  const hidden: StoragePredicate[] = [];
  if (firstGroup && collapsed.length) {
    const values = scalarViewValues(
      firstGroup.kind,
      collapsed.filter((key) => key !== firstGroup.emptyGroup),
    );
    if (values.length) hidden.push({ field: firstGroup.field, op: "notIn", value: values });
    if (firstGroup.emptyGroup && collapsed.includes(firstGroup.emptyGroup)) {
      const known = firstGroup.options?.map((option) => option.value);
      hidden.push(
        known ? { field: firstGroup.field, op: "in", value: known } : { field: firstGroup.field, op: "notEmpty" },
      );
    }
  }

  return hidden;
};
