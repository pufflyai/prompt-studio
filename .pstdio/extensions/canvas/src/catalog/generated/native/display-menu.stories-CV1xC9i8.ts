// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { h as r } from "./collection-view-fields-D15M65ck.ts";
import { r as i, t as a } from "./kanban-renderer-helpers-CvTscXNQ.ts";
import { t as o } from "./display-menu-DgqSpRfh.ts";
import { useState as s } from "react";
import { Box as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/display-menu.stories.tsx
var f = [
	{
		id: "status",
		label: "Status",
		type: {
			kind: "enum",
			options: [{
				value: "todo",
				label: "Todo"
			}]
		},
		filterable: !0,
		groupable: !0,
		sortable: !0,
		displayable: !0
	},
	{
		id: "assignee",
		label: "Assignee",
		type: { kind: "user" },
		filterable: !0,
		groupable: !0,
		displayable: !0
	},
	{
		id: "updated",
		label: "Updated",
		type: { kind: "date" },
		sortable: !0,
		displayable: !0
	}
], p = { title: "Patterns/Kanban Renderer/Display Menu" }, m = (e = {}) => {
	let [t, n] = s(e.initialSettings ?? r);
	return /* @__PURE__ */ d(c, {
		p: "lg",
		children: [
			/* @__PURE__ */ u(o, {
				settings: t,
				groupingOptions: i(f),
				displayPropertyOptions: a(f),
				onViewModeChange: (e) => n((t) => ({
					...t,
					viewMode: e
				})),
				onColumnGroupingChange: (e) => n((t) => ({
					...t,
					columnGrouping: e
				})),
				onRowGroupingChange: (e) => n((t) => ({
					...t,
					rowGrouping: e
				})),
				onDisplayPropertyToggle: (e) => n((t) => ({
					...t,
					displayProperties: t.displayProperties.includes(e) ? t.displayProperties.filter((t) => t !== e) : [...t.displayProperties, e]
				}))
			}),
			/* @__PURE__ */ u(l, {
				mt: "sm",
				"data-testid": "view-mode-value",
				children: t.viewMode
			}),
			/* @__PURE__ */ u(l, {
				mt: "sm",
				"data-testid": "column-grouping-value",
				children: t.columnGrouping
			}),
			/* @__PURE__ */ u(l, {
				mt: "sm",
				"data-testid": "display-properties-value",
				children: t.displayProperties.join(",")
			})
		]
	});
}, h = { render: () => /* @__PURE__ */ u(m, {}) }, g = {
	render: () => /* @__PURE__ */ u(m, {}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.click(i.getByLabelText("Display settings")), await t.click(e(document.body).getByRole("button", { name: "List" })), await n(i.getByTestId("view-mode-value")).toHaveTextContent("list");
	}
};
export { h as Default, g as ToggleViewMode, p as default };
