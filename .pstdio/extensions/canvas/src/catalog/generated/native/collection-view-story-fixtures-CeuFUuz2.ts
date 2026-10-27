// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { u as e } from "./collection-view-fields-D15M65ck.ts";
import { t } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
// packages/ui/src/components/collection-view/collection-view-story-fixtures.ts
var n = e([
	...t,
	{
		id: "archived",
		label: "Archived",
		type: { kind: "boolean" },
		filterable: !0
	},
	{
		id: "score",
		label: "Score",
		type: { kind: "number" },
		filterable: !0,
		sortable: !0
	}
]).map((e) => ({
	...e,
	filterable: !0,
	sortable: e.type.kind !== "enum-multi"
})), r = [
	"Alex",
	"Sam",
	"Jordan"
], i = (e) => e.type.kind === "user" ? r.map((e, t) => ({
	value: e,
	label: e,
	count: 3 - t
})) : e.type.kind !== "enum" && e.type.kind !== "enum-multi" ? [] : (Array.isArray(e.type.options) ? e.type.options : e.type.options.getSnapshot()).map((e, t) => ({
	...e,
	count: t + 1
})), a = {
	conjunction: "and",
	rules: [
		{
			attributeId: "status",
			condition: "is-none-of",
			value: ["done"]
		},
		{
			attributeId: "priority",
			condition: "is-any-of",
			value: ["high", "medium"]
		},
		{
			attributeId: "assignee",
			condition: "is-any-of",
			value: ["Alex"]
		},
		{
			attributeId: "updated",
			condition: "is-after",
			value: "today-7"
		}
	]
};
export { a as n, i as r, n as t };
