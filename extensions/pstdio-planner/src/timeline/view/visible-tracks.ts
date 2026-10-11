// Derive the visible track columns from the saved view's Track rules. Other rules only narrow ticket rows.
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import { filterRowsByView } from "@pstdio/ui/collection-view";
import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import { ticketTagAttributeId } from "../../data/mappers";
import type { Plan } from "../contracts";
import { buildTracks, trackLayout, trackOptions, unassignedTrack } from "../model/tracks";

// A rule on another property is unknown here: a ticket in the track may still match it. Rules
// that the ticket filter ignores, and groups without rules, have no truth at all (null).
type Truth = boolean | undefined | null;

// The ticket filter skips a rule while it is still being edited, such as one without a value.
const isActive = (rule: ViewFilterRule, fields: AttributeDescriptor[]) => {
  const field = fields.find(({ id }) => id === rule.attributeId);
  if (!field || field.filterable === false) return false;
  if (rule.condition === "is-empty" || rule.condition === "is-not-empty") return true;
  return rule.value !== undefined && rule.value !== "" && !(Array.isArray(rule.value) && rule.value.length === 0);
};

const mentions = (group: ViewFilterGroup, attributeId: string, fields: AttributeDescriptor[]): boolean =>
  group.rules.some((rule) => rule.attributeId === attributeId && isActive(rule, fields)) ||
  (group.groups ?? []).some((child) => mentions(child, attributeId, fields));

const ruleTruth = (rule: ViewFilterRule, attributeId: string, value: string, fields: AttributeDescriptor[]): Truth => {
  if (!isActive(rule, fields)) return null;
  if (rule.attributeId !== attributeId) return undefined;
  const probe = { id: "track", title: "", attributes: { [attributeId]: value } } as KanbanRendererRow;
  return filterRowsByView([probe], { conjunction: "and", rules: [rule] }, fields).length > 0;
};

const groupTruth = (
  group: ViewFilterGroup,
  attributeId: string,
  value: string,
  fields: AttributeDescriptor[],
): Truth => {
  const results = [
    ...group.rules.map((rule) => ruleTruth(rule, attributeId, value, fields)),
    ...(group.groups ?? []).map((child) => groupTruth(child, attributeId, value, fields)),
  ].filter((result) => result !== null);
  if (results.length === 0) return null;
  const decisive = group.conjunction === "or";
  if (results.includes(decisive)) return decisive;
  if (results.every((result) => result === !decisive)) return !decisive;
  return undefined;
};

// A column stays visible unless the filter rejects every ticket that could be in it.
export function visibleTracks(plan: Plan | undefined, filter: ViewFilterGroup, fields: AttributeDescriptor[]) {
  const property = plan?.trackProperty;
  const tracks = buildTracks(property, plan?.sections.flatMap(({ rows }) => rows) ?? []);
  if (!property) return tracks;
  const attributeId = ticketTagAttributeId(property);
  if (!mentions(filter, attributeId, fields)) return tracks;
  return trackLayout(
    [...trackOptions(property), unassignedTrack].filter((track) => {
      const value = track.id === unassignedTrack.id ? "" : track.id;
      return groupTruth(filter, attributeId, value, fields) !== false;
    }),
  );
}
