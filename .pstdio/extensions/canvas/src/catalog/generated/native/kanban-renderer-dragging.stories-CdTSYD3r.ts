// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./kanban-renderer-DXp4dq2X.ts";
import { useState as i } from "react";
import { Box as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-dragging.stories.tsx
var s = {
	title: "Patterns/Kanban Renderer/Dragging",
	tags: ["!manifest"],
	parameters: { layout: "fullscreen" }
}, c = [{
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
}, {
	id: "team",
	label: "Team",
	groupable: !0,
	type: {
		kind: "enum",
		options: [{
			value: "design",
			label: "Design"
		}, {
			value: "product",
			label: "Product"
		}]
	}
}], l = [
	{
		id: "unknown",
		title: "Recover an unknown status",
		attributes: {
			status: "removed",
			team: "design"
		}
	},
	{
		id: "missing",
		title: "Assign a missing status",
		attributes: {
			status: null,
			team: "design"
		}
	},
	{
		id: "done",
		title: "Move a completed card",
		attributes: {
			status: "done",
			team: "product"
		}
	}
], u = (e) => {
	let { grouped: t = !1, ungrouped: n = !1 } = e, [s, u] = i(l);
	return /* @__PURE__ */ o(a, {
		p: "sm",
		height: "560px",
		children: /* @__PURE__ */ o(r, {
			rows: s,
			attributes: c,
			storageKey: `storybook-kanban-dragging-${t}-${n}`,
			hideToolbar: !0,
			defaultSettings: {
				viewMode: "board",
				columnGrouping: n ? "none" : "status",
				rowGrouping: t ? "team" : "none",
				displayProperties: []
			},
			onMove: ({ rowId: e, attributes: t }) => u((n) => n.map((n) => n.id === e ? {
				...n,
				attributes: {
					...n.attributes,
					...t
				}
			} : n))
		})
	});
}, d = async (r, i, a) => {
	let o = e(r).getByText(i).closest("[data-testid=\"renderer-card\"]");
	await n(o).toHaveAttribute("draggable", "true"), await t.hover(o);
	let s = new DataTransfer();
	o.dispatchEvent(new DragEvent("dragstart", {
		bubbles: !0,
		dataTransfer: s
	})), a.dispatchEvent(new DragEvent("dragover", {
		bubbles: !0,
		cancelable: !0,
		dataTransfer: s
	})), a.dispatchEvent(new DragEvent("drop", {
		bubbles: !0,
		cancelable: !0,
		dataTransfer: s
	})), o.dispatchEvent(new DragEvent("dragend", {
		bubbles: !0,
		dataTransfer: s
	}));
}, f = {
	render: () => /* @__PURE__ */ o(u, {}),
	play: async ({ canvasElement: t }) => {
		let r = e(t), i = r.getByTestId("board-column-todo"), a = r.getByTestId("board-column-done");
		await d(t, "Recover an unknown status", i), await n(await e(i).findByText("Recover an unknown status")).toBeVisible(), await d(t, "Assign a missing status", a), await n(await e(a).findByText("Assign a missing status")).toBeVisible(), await d(t, "Move a completed card", e(i).getByRole("button", { name: "Recover an unknown status" })), await n(await e(i).findByText("Move a completed card")).toBeVisible();
	}
}, p = {
	render: () => /* @__PURE__ */ o(u, { grouped: !0 }),
	play: async ({ canvasElement: t }) => {
		let r = e(t).getByTestId("board-column-done");
		await d(t, "Recover an unknown status", e(r).getByRole("button", { name: /Product/ })), await n(await e(r).findByText("Recover an unknown status")).toBeVisible();
		let i = e(r).getByText("Recover an unknown status").closest("[data-group-key]");
		await n(i).toHaveAttribute("data-group-key", "product");
	}
}, m = {
	render: () => /* @__PURE__ */ o(u, { ungrouped: !0 }),
	play: async ({ canvasElement: t }) => {
		let r = e(t).getByTestId("board-column-all");
		await d(t, "Recover an unknown status", r), await n(await e(r).findByText("Recover an unknown status")).toBeVisible();
	}
};
export { p as GroupedRows, f as MissingAndUnknownStatus, m as UngroupedBoard, s as default };
