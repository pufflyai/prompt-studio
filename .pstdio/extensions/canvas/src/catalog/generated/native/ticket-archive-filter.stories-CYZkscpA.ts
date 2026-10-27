// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./mappers-07bJ6k9J.ts";
import { isLocalizedString as i } from "@pstdio/sdk/extensions";
import { KanbanRenderer as a } from "@pstdio/ui/kanban-renderer";
// extensions/pstdio-planner/src/ticket-archive-filter.stories.tsx
var o = {
	title: "Extensions/Planner/Ticket Archive Filter",
	component: a,
	parameters: { layout: "fullscreen" }
}, s = JSON.parse(JSON.stringify(r([])), (e, t) => i(t) ? t.default : t), c = (r) => ({
	args: {
		storageKey: `storybook-ticket-archive-${r}`,
		attributes: s,
		rows: [{
			id: "active",
			title: "Active ticket",
			attributes: { archived: "active" }
		}, {
			id: "archived",
			title: "Archived ticket",
			attributes: { archived: "archived" }
		}],
		defaultSettings: {
			viewMode: "list",
			columnGrouping: "none"
		}
	},
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = e(i.ownerDocument.body);
		await t.click(a.getByRole("button", { name: "Filter" })), await t.click(o.getByRole("button", { name: "Ticket" })), await t.click(o.getByRole("checkbox", { name: r === "active" ? "Active" : "Archived" })), await t.keyboard("{Escape}");
		let s = a.getByRole("group", { name: "Ticket filter" });
		await n(s).toHaveTextContent(`Ticketis${r === "active" ? "Active" : "Archived"}`);
	}
}), l = c("active"), u = c("archived");
export { l as Active, u as Archived, o as default };
