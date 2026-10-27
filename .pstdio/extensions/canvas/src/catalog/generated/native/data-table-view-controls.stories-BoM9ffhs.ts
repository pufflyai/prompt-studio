// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { r as a } from "./edit-mode-data-table-C5AqhcKZ.ts";
import { t as o } from "./data-table-BpTupEfR.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
import { DEFAULT_DATA_TABLE_SETTINGS as u } from "@pstdio/sdk/extensions";
// packages/ui/src/components/data-table/data-table-view-controls.stories.tsx
var d = {
	title: "Patterns/Data Table/View Controls",
	component: o,
	parameters: { layout: "fullscreen" }
}, f = [
	"In review",
	"In progress",
	"Todo",
	"Backlog"
], p = [
	"Urgent",
	"High",
	"Medium"
], m = {
	data: [
		"Improve chat and data tables",
		"Show sidebar shortcuts at rest",
		"Feature-slice @pstdio/ui",
		"Chat scroll jumps while streaming",
		"Harness run parameters",
		"Bubblify the side panel across resources",
		"Saved filters for views",
		"Archived filter by default"
	].map((e, t) => ({
		id: `PS-${151 - t * 3}`,
		Title: e,
		Status: t === 5 ? null : f[t % f.length],
		Priority: p[t % p.length],
		Score: 92 - t * 9,
		Updated: new Date(Date.UTC(2026, 9, 2 - t)).toISOString()
	})),
	fullWidth: !0,
	columnTypes: {
		Score: "number",
		Updated: "date"
	},
	groupableColumns: ["Status", "Priority"],
	columnRenderers: { Updated: { type: "date" } }
}, h = (e) => {
	let { storageKey: t, ...n } = e, r = a(t, (e) => e.reset, n);
	return s(r), /* @__PURE__ */ l(c, {
		height: "32rem",
		children: /* @__PURE__ */ l(o, {
			...m,
			...n,
			toolbarStorageKey: t
		})
	});
}, g = {
	render: () => /* @__PURE__ */ l(h, { storageKey: "storybook-data-table-header-sort" }),
	play: async ({ canvasElement: t }) => {
		let n = t.querySelector("[data-column-id=\"Score\"]");
		await r.click(e(n).getByRole("button", { name: "Column options" })), await r.click(await e(document.body).findByText("Sort ascending")), await i(e(n).getByRole("button", { name: "Sorted asc" })).toBeVisible();
	}
}, _ = {
	render: () => /* @__PURE__ */ l(h, { storageKey: "storybook-data-table-search" }),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await r.click(n.getByRole("button", { name: "Search this view" })), await r.type(n.getByRole("textbox", { name: "Search this view" }), "chat"), await i(await n.findAllByRole("mark")).toHaveLength(2), await i(n.getByText("2 of 8")).toBeVisible();
	}
}, v = () => {
	let [e, t] = s([{
		id: "all",
		title: "All rows",
		settings: u,
		filter: {
			conjunction: "and",
			rules: []
		},
		sorts: [],
		builtIn: !0
	}, {
		id: "high-score",
		title: "High score",
		settings: {
			...u,
			rowNumbers: !1
		},
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "Score",
				condition: "gte",
				value: 70
			}]
		},
		sorts: [{
			attributeId: "Score",
			direction: "desc"
		}],
		builtIn: !1
	}]);
	return /* @__PURE__ */ l(h, {
		storageKey: "storybook-data-table-saved-views",
		viewsSource: {
			views: e,
			defaultViewId: "all",
			onCreateView: async (e) => {
				let n = {
					...e,
					id: crypto.randomUUID(),
					builtIn: !1
				};
				return t((e) => [...e, n]), n;
			},
			onUpdateView: async (e, n) => t((t) => t.map((t) => t.id === e ? {
				...t,
				...n
			} : t)),
			onDeleteView: async (e) => t((t) => t.filter((t) => t.id !== e)),
			onSetDefaultView: async () => void 0
		}
	});
}, y = {
	render: () => /* @__PURE__ */ l(v, {}),
	play: async ({ canvasElement: r }) => {
		t.contextMenu(e(r).getByRole("tab", {
			name: "High score",
			exact: !0
		}));
		let a = await e(document.body).findByRole("menu"), o = a.querySelector("[data-part=\"viewport\"]");
		await n(() => i(o.scrollWidth).toBeLessThanOrEqual(o.clientWidth)), i(o.scrollHeight).toBeLessThanOrEqual(o.clientHeight);
		let s = e(a).getAllByRole("menuitem");
		i(s.map((e) => e.textContent)).toEqual([
			"Rename",
			"Duplicate",
			"Delete view"
		]), i(a.querySelectorAll("[data-part=\"separator\"]")).toHaveLength(1);
	}
}, b = {
	render: () => /* @__PURE__ */ l(h, {
		storageKey: "storybook-data-table-grouped",
		defaultSettings: {
			grouping: "Status",
			rowNumbers: !1
		},
		defaultSorts: [{
			attributeId: "Priority",
			direction: "asc"
		}]
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await i(n.getAllByTestId("data-table-group-row")).toHaveLength(5);
	}
}, x = {
	render: () => /* @__PURE__ */ l(h, {
		storageKey: "storybook-data-table-no-row-numbers",
		defaultSettings: { rowNumbers: !1 }
	}),
	play: async ({ canvasElement: e }) => {
		await i(e.querySelector("[data-column-id=\"rowIndex\"]")).toBeNull();
	}
}, S = {
	render: () => /* @__PURE__ */ l(h, {
		storageKey: "storybook-data-table-page-reset",
		initialPageSize: 3,
		pageSizeOptions: [3, 10]
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await r.click(n.getByRole("button", { name: "Go to next page" })), await i(n.getByRole("button", { name: "Go to previous page" })).toBeEnabled();
		let a = t.querySelector("[data-column-id=\"Score\"]");
		await r.click(e(a).getByRole("button", { name: "Column options" })), await r.click(await e(document.body).findByText("Sort ascending")), await i(n.getByRole("button", { name: "Go to previous page" })).toBeDisabled();
	}
}, C = {
	render: () => /* @__PURE__ */ l(h, {
		storageKey: "storybook-empty-table-groups",
		defaultSettings: { grouping: "Status" },
		defaultFilter: {
			conjunction: "and",
			rules: [{
				attributeId: "Score",
				condition: "gt",
				value: 1e3
			}]
		}
	}),
	play: async ({ canvasElement: t }) => {
		let n = e(t);
		await i(await n.findByText("In review", { exact: !0 })).toBeVisible(), await i(n.getByText("In progress", { exact: !0 })).toBeVisible(), await i(n.getByText("No status", { exact: !0 })).toBeVisible();
	}
};
export { C as EmptyFilteredGroups, b as GroupedByStatus, g as HeaderSort, S as PageResetsOnViewChange, x as RowNumbersHidden, y as SavedViews, _ as SearchHighlights, d as default };
