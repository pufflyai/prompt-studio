// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./kanban-renderer-BPXgHTX1.ts";
import { useState as i } from "react";
import { Button as a, Stack as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/paged-board.stories.tsx
var l = [{
	id: "status",
	label: "Status",
	groupable: !0,
	type: {
		kind: "enum",
		options: [{
			value: "todo",
			label: "Todo"
		}, {
			value: "done",
			label: "Done"
		}]
	}
}], u = Array.from({ length: 250 }, (e, t) => ({
	id: String(t),
	title: `Card ${t}`,
	attributes: { status: t < 125 ? "done" : "todo" }
})), d = {
	title: "Patterns/Kanban Renderer/Paged board",
	component: () => {
		let [e, t] = i(100), [n, d] = i(!1);
		return /* @__PURE__ */ c(o, {
			height: "600px",
			children: [/* @__PURE__ */ s(a, {
				onClick: () => {
					t(Math.min(250, e + 100)), d(!1);
				},
				children: "Finish read"
			}), /* @__PURE__ */ s(r, {
				storageKey: "storybook-paged-board",
				rows: u.slice(0, e),
				attributes: l,
				defaultSettings: {
					viewMode: "board",
					columnGrouping: "status",
					rowGrouping: "none",
					displayProperties: []
				},
				page: {
					request: {
						limit: 100,
						offset: Math.max(0, e - 100),
						search: "",
						fields: ["title", "status"]
					},
					result: {
						revision: "1",
						cursor: e < 250 ? String(e) : null,
						total: 250,
						filteredTotal: 250,
						groups: [{
							field: "status",
							value: "done",
							count: 125
						}, {
							field: "status",
							value: "todo",
							count: 125
						}]
					},
					loading: n,
					onLoadMore: () => d(!0),
					onPageChange: () => {},
					onPageSizeChange: () => {},
					onSearchChange: () => {},
					onCollapsedGroupsChange: () => {}
				}
			})]
		});
	},
	parameters: { layout: "fullscreen" }
}, f = { play: async ({ canvasElement: r }) => {
	let i = e(r), a = e(i.getByTestId("board-column-todo")), o = a.getByRole("button", { name: "Load more cards" });
	await n(a.getByText("125", { exact: !0 })).toBeVisible(), await n(a.queryByText(/hidden by search/)).not.toBeInTheDocument(), o.focus(), await t.keyboard("{Enter}"), await n(o).toBeDisabled(), await t.click(i.getByRole("button", { name: "Finish read" })), await n(await a.findByText("Card 125")).toBeVisible();
} };
export { f as UnloadedColumn, d as default };
