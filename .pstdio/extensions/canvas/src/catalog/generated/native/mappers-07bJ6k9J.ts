// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./sort-C5A4Nn9L.ts";
import "./ticket-page-target-B06ixsvs.ts";
import { l10n as t } from "@pstdio/sdk/extensions";
// extensions/pstdio-planner/src/data/ticket-tags.ts
var n = (e) => e.type === "single_select" || e.id === "default-type", r = (e) => e === void 0 ? [] : typeof e == "string" ? [e] : e, i = (e) => Object.values(e.tags ?? {}).flatMap(r), a = "workspace", o = "workspaceItems", s = "archived", c = "active", l = "archived";
t("boardView.archiveAll", "Archive all");
var u = {
	"default-priority": "priority",
	"default-type": "type",
	"default-complexity": "complexity"
}, d = "circle", f = (e) => u[e.id] ?? e.id, p = (e) => ({
	value: e.id,
	label: e.name,
	color: e.color,
	icon: e.icon ?? d
}), m = (t) => ({
	id: f(t),
	label: t.name,
	type: {
		kind: n(t) ? "enum" : "enum-multi",
		options: [...t.options].sort(e).map((e) => ({
			value: e.id,
			label: e.name,
			color: e.color,
			icon: e.icon
		}))
	},
	filterable: !0,
	displayable: !0,
	editable: !0,
	groupable: n(t)
}), h = (n, r = []) => [
	{
		id: "status",
		label: t("displayMenu.propertyOptions.status", "Status"),
		type: {
			kind: "enum",
			options: [...n].sort(e).map(p)
		},
		groupable: !0,
		filterable: !0,
		displayable: !0,
		editable: !0
	},
	{
		id: s,
		label: t("displayMenu.propertyOptions.archived", "Ticket"),
		type: {
			kind: "enum",
			options: [{
				value: c,
				label: t("archiveState.active", "Active")
			}, {
				value: l,
				label: t("archiveState.archived", "Archived")
			}]
		},
		filterable: !0,
		editable: !1
	},
	{
		id: "created",
		label: t("displayMenu.propertyOptions.createdAt", "Created"),
		type: { kind: "date" },
		sortable: !0,
		displayable: !0
	},
	{
		id: "updated",
		label: t("displayMenu.propertyOptions.updatedAt", "Updated"),
		type: { kind: "date" },
		sortable: !0,
		displayable: !0
	},
	{
		id: "id",
		label: t("displayMenu.orderingOptions.shorthand", "ID"),
		type: { kind: "string" },
		displayable: !0
	},
	{
		id: "parent",
		label: t("displayMenu.propertyOptions.parent", "Parent"),
		type: { kind: "string" },
		filterable: !0
	},
	{
		id: a,
		label: t("displayMenu.propertyOptions.workspace", "Workspace"),
		type: { kind: "string" },
		displayable: !0,
		display: {
			kind: "badge-list",
			itemsAttributeId: o
		}
	},
	...[...r].sort(e).map(m)
];
export { f as n, i as r, h as t };
