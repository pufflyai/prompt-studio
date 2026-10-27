// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { r, t as i } from "./kanban-renderer-story-fixtures-DLwkBAvf.ts";
import { n as a, t as o } from "./kanban-renderer-DXp4dq2X.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-view-controls.stories.tsx
var u = {
	title: "Patterns/Kanban Renderer/View Controls",
	component: o,
	parameters: { layout: "fullscreen" }
}, d = (e, t, n) => {
	let r = e.find((e) => e.id === t);
	if (!r) return e;
	let i = e.filter((e) => e.id !== t), a = n ? i.findIndex((e) => e.id === n) : i.length;
	return [
		...i.slice(0, a),
		r,
		...i.slice(a)
	];
}, f = (e) => {
	let { storageKey: t, defaultFilter: n, defaultSorts: u } = e, [f, p] = s(r), m = {
		settings: {
			columnGrouping: "status",
			displayProperties: [
				"id",
				"priority",
				"assignee"
			]
		},
		filter: n,
		sorts: u
	}, h = a(t, (e) => e.reset, m);
	return s(h), /* @__PURE__ */ l(c, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ l(o, {
			rows: f,
			storageKey: t,
			attributes: i,
			defaultSettings: m.settings,
			defaultFilter: n,
			defaultSorts: u,
			onAttributeChange: (e, t, n) => p((r) => r.map((r) => r.id === e ? {
				...r,
				attributes: {
					...r.attributes,
					[t]: n
				}
			} : r)),
			onReorder: (e, t) => p((n) => d(n, e, t))
		})
	});
}, p = {
	render: () => /* @__PURE__ */ l(f, { storageKey: "storybook-kanban-view-controls-search" }),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: "Search this view" })), await t.type(i.getByRole("textbox", { name: "Search this view" }), "set up"), await n(await i.findAllByRole("mark")).not.toHaveLength(0), await n(i.queryByText("Write docs")).not.toBeInTheDocument();
	}
}, m = {
	render: () => /* @__PURE__ */ l(f, { storageKey: "storybook-kanban-view-controls-no-matches" }),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByRole("button", { name: "Search this view" })), await t.type(i.getByRole("textbox", { name: "Search this view" }), "radr"), await n(await i.findByText("No results for “radr”")).toBeVisible(), await t.click(i.getByRole("button", { name: "Clear search" })), await n(await i.findByText("Write docs")).toBeVisible();
	}
}, h = { render: () => /* @__PURE__ */ l(f, {
	storageKey: "storybook-kanban-view-controls-rules",
	defaultFilter: {
		conjunction: "and",
		rules: [{
			attributeId: "status",
			condition: "is-none-of",
			value: ["done"]
		}, {
			conjunction: "or",
			rules: [{
				attributeId: "assignee",
				condition: "is-any-of",
				value: ["Alex"]
			}, {
				attributeId: "priority",
				condition: "is-any-of",
				value: ["high"]
			}]
		}]
	}
}) }, g = {
	render: () => /* @__PURE__ */ l(f, {
		storageKey: "storybook-kanban-view-controls-multi-sort",
		defaultSorts: [{
			attributeId: "priority",
			direction: "asc"
		}, {
			attributeId: "updated",
			direction: "desc"
		}]
	}),
	play: async ({ canvasElement: t }) => {
		let r = e(t);
		await n(r.getByRole("button", { name: "Sorted by Priority" })).toHaveTextContent("+1");
	}
}, _ = { render: () => /* @__PURE__ */ l(f, { storageKey: "storybook-kanban-view-controls-manual" }) };
export { h as FilterRules, _ as ManualOrderWithoutSort, g as MultiSort, p as Search, m as SearchNoMatches, u as default };
