// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { a as i, f as a } from "./data-table-state-BSAfS2dI.ts";
import { t as o } from "./data-table-display-menu-lznmGjkk.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
import { DEFAULT_DATA_TABLE_SETTINGS as u } from "@pstdio/sdk/extensions";
// packages/ui/src/components/data-table/data-table-display-menu.stories.tsx
var d = {
	title: "Patterns/Data Table/Display Menu",
	component: o
}, f = [
	{
		id: "ID",
		label: "ID",
		type: { kind: "string" }
	},
	{
		id: "Title",
		label: "Title",
		type: { kind: "string" }
	},
	{
		id: "Status",
		label: "Status",
		type: { kind: "string" },
		groupable: !0
	},
	{
		id: "Priority",
		label: "Priority",
		type: { kind: "string" },
		groupable: !0
	},
	{
		id: "Updated",
		label: "Updated",
		type: { kind: "date" }
	},
	{
		id: "Score",
		label: "Score",
		type: { kind: "number" }
	}
], p = (e) => {
	let [t, n] = s({
		...u,
		...e.settings
	}), r = f.map((e) => e.id);
	return /* @__PURE__ */ l(c, {
		padding: "lg",
		children: /* @__PURE__ */ l(o, {
			columns: f,
			settings: t,
			statsAvailable: e.statsAvailable ?? !0,
			onSettingsChange: (e) => n((t) => ({
				...t,
				...e
			})),
			onColumnVisibilityChange: (e, t) => n((n) => ({
				...n,
				hiddenColumns: a(n.hiddenColumns, e, t)
			})),
			onColumnReorder: (e, t) => n((n) => ({
				...n,
				columnOrder: i(r, e, t)
			}))
		})
	});
}, m = {
	render: () => /* @__PURE__ */ l(p, {}),
	play: async ({ canvasElement: i }) => {
		await n.click(e(i).getByRole("button", { name: "Display settings" })), await t(() => r(e(document.body).getByText("6 of 6 shown")).toBeVisible());
	}
}, h = { render: () => /* @__PURE__ */ l(p, { settings: {
	grouping: "Status",
	rowNumbers: !1
} }) }, g = {
	render: () => /* @__PURE__ */ l(p, { settings: { hiddenColumns: ["Score"] } }),
	play: async ({ canvasElement: i }) => {
		await n.click(e(i).getByRole("button", { name: "Display settings" })), await t(() => r(e(document.body).getByText("5 of 6 shown")).toBeVisible());
	}
}, _ = { render: () => /* @__PURE__ */ l(p, { statsAvailable: !1 }) };
export { m as Defaults, h as GroupedWithRowNumbersOff, g as HiddenColumn, _ as NoStatisticsAvailable, d as default };
