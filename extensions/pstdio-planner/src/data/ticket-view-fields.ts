import type { CollectionQueryField } from "@pstdio/sdk/data";
import type { KanbanRendererAttributeDescriptor, StorageExpression, StorageRecordQuery } from "@pstdio/sdk/extensions";
import { ticketTagAttributeId } from "./mappers";
import { isSingleSelectTicketTag } from "./ticket-tags";
import type { StoredTag } from "./types";

export const ticketViewFields = (
  attributes: KanbanRendererAttributeDescriptor[],
  tags: StoredTag[],
  computed: NonNullable<StorageRecordQuery["computed"]>,
  requested: ReadonlySet<string>,
  instantOrder = true,
) => {
  const names: Record<string, string> = {
    id: "breadcrumb",
    status: "statusId",
    parent: "parentShorthand",
    archived: "archiveState",
    created: "createdAt",
    updated: "updatedAt",
  };
  for (const tag of tags) {
    const name = `tag:${tag.id}`;
    names[ticketTagAttributeId(tag)] = name;
    if (!requested.has(ticketTagAttributeId(tag))) continue;
    const selected: StorageExpression = {
      each: { get: { field: "tags" }, key: tag.id },
      as: "selection",
      mode: "filter",
      where: {
        op: "eq",
        args: [
          {
            get: { literal: Object.fromEntries(tag.options.map(({ id }) => [id, true])) },
            key: { variable: "selection" },
          },
          { literal: true },
        ],
      },
    };
    computed[name] = isSingleSelectTicketTag(tag)
      ? { type: "string", expression: { op: "first", args: [selected] } }
      : { type: "array", expression: selected };
  }
  const fields: Record<string, CollectionQueryField> = { title: { field: "title", kind: "string" } };
  for (const attribute of attributes) {
    if (attribute.id === "workspace") continue;
    const kind = attribute.type.kind;
    fields[attribute.id] = {
      field: names[attribute.id] ?? attribute.id,
      kind,
      ...(instantOrder && attribute.id === "created" ? { orderField: "createdInstant" } : {}),
      ...(instantOrder && attribute.id === "updated" ? { orderField: "updatedInstant" } : {}),
      ...("options" in attribute.type
        ? {
            options: attribute.type.options.map(({ value, label }) => ({
              value,
              label: typeof label === "string" ? label : (label.default ?? label.$l10n),
            })),
          }
        : {}),
    };
  }
  return fields;
};
