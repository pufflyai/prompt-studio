// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { r as i, t as a } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
import { n as o, t as s } from "./kanban-renderer-DXp4dq2X.ts";
import { useState as c } from "react";
import { Box as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/filtered-groups.stories.tsx
var d = {
	title: "Patterns/Kanban Renderer/Filtered Groups",
	parameters: { layout: "fullscreen" }
}, f = (e) => {
	let t = `storybook-empty-filter-groups-${e.mode}-${e.empty ?? !1}-${e.grouped ?? !0}`, n = {
		settings: {
			viewMode: e.mode,
			columnGrouping: e.grouped === !1 ? "none" : "status",
			rowGrouping: e.grouped === !1 ? "none" : "assignee",
			displayProperties: []
		},
		filter: {
			conjunction: "and",
			rules: [{
				attributeId: "title",
				condition: "contains",
				value: "no matching title"
			}]
		}
	}, r = o(t, (e) => e.reset, n);
	return c(r), /* @__PURE__ */ u(l, {
		height: e.mode === "list" && e.grouped !== !1 ? "20rem" : "32rem",
		children: /* @__PURE__ */ u(s, {
			rows: e.empty ? [] : i,
			attributes: a,
			storageKey: t,
			defaultSettings: n.settings,
			defaultFilter: n.filter,
			emptyTitle: "No tickets yet"
		})
	});
}, p = {
	render: () => /* @__PURE__ */ u(f, { mode: "board" }),
	play: async ({ canvasElement: a }) => {
		let o = e(a);
		await r(await o.findByText("Todo", { exact: !0 })).toBeVisible(), r(o.queryByText("Nothing matches this view", { exact: !0 })).toBeNull(), await r(o.getAllByText("Alex", { exact: !0 })[0]).toBeVisible(), await r(o.getByText("In progress", { exact: !0 })).toBeVisible(), await n.click(o.getByRole("button", {
			name: "Filter",
			exact: !0
		}));
		let s = e(a.ownerDocument.body), c = e(await s.findByTestId("filter-menu"));
		await t(() => r(c.getByRole("textbox", { name: "Filter properties" })).toBeVisible()), await n.keyboard("{Escape}"), await t(() => r(s.queryByTestId("filter-menu")).toBeNull()), await n.click(o.getByRole("button", { name: "Remove Title filter" })), await r(await o.findByText(i[0].title, { exact: !0 })).toBeVisible();
	}
}, m = {
	render: () => /* @__PURE__ */ u(f, { mode: "list" }),
	play: async ({ canvasElement: n }) => {
		let i = e(n);
		await r(await i.findByText("Todo", { exact: !0 })).toBeVisible(), r(i.queryByText("Nothing matches this view", { exact: !0 })).toBeNull(), await r(i.getAllByText("Alex", { exact: !0 })[0]).toBeVisible();
		let a = i.getByLabelText("Collection list");
		a.scrollTop = a.scrollHeight;
		let o = i.getAllByRole("option").at(-1);
		await t(() => {
			let e = o.getBoundingClientRect(), t = a.getBoundingClientRect();
			r(a.scrollTop).toBeGreaterThan(0), r(e.top).toBeGreaterThanOrEqual(t.top), r(e.bottom).toBeLessThanOrEqual(t.bottom);
		});
	}
}, h = {
	render: () => /* @__PURE__ */ u(f, {
		mode: "list",
		grouped: !1
	}),
	play: async ({ canvasElement: a }) => {
		let o = e(a);
		await r(await o.findByText("Nothing matches this view", { exact: !0 })).toBeVisible(), await n.click(o.getByRole("button", {
			name: "Edit filter",
			exact: !0
		}));
		let s = e(a.ownerDocument.body);
		await t(() => r(s.getByTestId("filter-menu")).toBeVisible()), await n.keyboard("{Escape}"), await t(() => r(s.queryByTestId("filter-menu")).toBeNull()), await n.click(o.getByRole("button", { name: "Remove Title filter" })), await r(await o.findByText(i[0].title, { exact: !0 })).toBeVisible();
	}
}, g = {
	render: () => /* @__PURE__ */ u(f, {
		mode: "list",
		empty: !0,
		grouped: !1
	}),
	play: async ({ canvasElement: t }) => {
		await r(await e(t).findByText("No tickets yet", { exact: !0 })).toBeVisible();
	}
};
export { p as Board, g as EmptyCollection, m as List, h as Ungrouped, d as default };
