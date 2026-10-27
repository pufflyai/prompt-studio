// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./kanban-renderer-board-Cn-_gg0W.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-large-board.stories.tsx
var o = {
	title: "Patterns/Kanban Renderer/Large Board",
	tags: ["!manifest"]
}, s = Array.from({ length: 1e3 }, (e, t) => ({
	id: `row-${t}`,
	cardProps: { title: `Ticket ${t + 1}. ${"A task with variable height. ".repeat(t % 4)}` },
	contextMenuActions: [{
		key: "open",
		label: "Open ticket",
		onClick: () => void 0
	}]
})), c = {
	id: "todo",
	label: "Todo",
	items: s,
	actions: [],
	canCreate: !1
}, l = {
	render: () => /* @__PURE__ */ a(i, {
		height: "600px",
		children: /* @__PURE__ */ a(r, { columns: [c] })
	}),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(i.getAllByTestId("renderer-card").length).toBeLessThan(30);
		let a = i.getByRole("button", { name: "Ticket 1." });
		a.focus(), t.keyDown(a, { key: "End" });
		let o = await i.findByRole("button", { name: s[999].cardProps.title.trim() });
		await n(o).toHaveFocus(), await n(i.getAllByTestId("renderer-card").length).toBeLessThan(30), t.keyDown(o, { key: "Home" }), await n(await i.findByRole("button", { name: "Ticket 1." })).toHaveFocus();
	}
}, u = { render: () => /* @__PURE__ */ a(i, {
	height: "600px",
	children: /* @__PURE__ */ a(r, { columns: [{
		...c,
		groups: [{
			key: "row-0",
			label: "High",
			items: s.slice(0, 500)
		}, {
			key: "medium",
			label: "Medium",
			items: s.slice(0, 25).concat(s.slice(500))
		}]
	}] })
}) };
export { u as GroupedCards, l as VariableHeightCards, o as default };
