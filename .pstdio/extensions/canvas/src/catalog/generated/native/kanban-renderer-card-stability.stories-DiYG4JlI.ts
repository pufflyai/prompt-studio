// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./kanban-renderer-board-Cn-_gg0W.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-card-stability.stories.tsx
var o = {
	title: "Patterns/Kanban Renderer/Card Stability",
	tags: ["!manifest"]
}, s = e(() => ({ title: "Review ticket filters" })), c = e(() => [{
	key: "open",
	label: "Open ticket",
	onClick: () => void 0
}]), l = {
	id: "backlog",
	label: "Backlog",
	actions: [],
	canCreate: !1,
	items: [{
		id: "task",
		get cardProps() {
			return s();
		},
		get contextMenuActions() {
			return c();
		}
	}]
}, u = () => new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), d = {
	render: () => /* @__PURE__ */ a(i, {
		height: "lg",
		children: /* @__PURE__ */ a(r, { columns: [l] })
	}),
	play: async ({ canvasElement: e }) => {
		let r = t(e), i = await r.findByTestId("renderer-card"), a = r.getByTestId("board-column-backlog");
		await u(), s.mockClear(), c.mockClear();
		let o = new DataTransfer(), l = i.getBoundingClientRect(), d = (e) => new DragEvent(e, {
			dataTransfer: o,
			bubbles: !0,
			cancelable: !0,
			clientX: l.x + l.width / 2,
			clientY: l.y + l.height / 2
		});
		i.dispatchEvent(d("dragstart")), a.dispatchEvent(d("dragover")), await u(), i.dispatchEvent(d("dragend")), await u(), await n(s).not.toHaveBeenCalled(), await n(c).not.toHaveBeenCalled(), await n(r.getByText("Review ticket filters")).toBeVisible();
	}
};
export { d as DragRetainsCardContent, o as default };
