// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, i as n, m as r, p as i, r as a } from "./test-whhQHjQi.ts";
import { t as o } from "./archive-DozS7A-I.ts";
import { t as s } from "./play-crlvkPMv.ts";
import { t as c } from "./trash-2-C03vrbuo.ts";
import { t as l } from "./kanban-renderer-board-Cn-_gg0W.ts";
import { useState as u } from "react";
import { Box as d } from "@chakra-ui/react";
import { jsx as f } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-board.stories.tsx
var p = { title: "Patterns/Kanban Renderer/Board" }, m = e(), h = [
	{
		id: "todo",
		label: "todo",
		color: "gray",
		canCreate: !0,
		actions: [],
		items: [{
			id: "t1",
			contextMenuActions: [{
				key: "run",
				label: "Run attempt",
				icon: /* @__PURE__ */ f(s, { size: 14 }),
				onClick: m
			}, {
				key: "delete",
				label: "Delete",
				icon: /* @__PURE__ */ f(c, { size: 14 }),
				separatorBefore: !0,
				onClick: () => void 0
			}],
			cardProps: {
				title: "Set up auth",
				badges: [{
					attributeId: "priority",
					label: "medium",
					color: "yellow"
				}, {
					attributeId: "component",
					label: "backend",
					color: "blue"
				}]
			}
		}, {
			id: "t2",
			cardProps: {
				title: "Build dashboard",
				badges: [{
					attributeId: "priority",
					label: "high",
					color: "red"
				}]
			}
		}]
	},
	{
		id: "in_progress",
		label: "in progress",
		color: "blue",
		canCreate: !1,
		actions: [],
		items: [{
			id: "t3",
			cardProps: {
				title: "Write tests",
				badges: [{
					attributeId: "priority",
					label: "low",
					color: "green"
				}]
			}
		}]
	},
	{
		id: "done",
		label: "done",
		color: "green",
		canCreate: !1,
		actions: [{
			id: "archive_all",
			label: "Archive all",
			icon: o
		}],
		items: [{
			id: "t4",
			cardProps: { title: "Deploy to prod" }
		}]
	}
], g = (e, t, n) => {
	let r, i = null, a = e.map((e) => {
		let n = e.items.findIndex((e) => e.id === t);
		if (n < 0) return e;
		i = e.id;
		let a = [...e.items], [o] = a.splice(n, 1);
		return r = o, {
			...e,
			items: a
		};
	});
	if (!r || !i || i === n) return e;
	let o = r;
	return a.map((e) => e.id === n ? {
		...e,
		items: [...e.items, o]
	} : e);
}, _ = () => {
	let [e, t] = u(h), [n, r] = u(null), i = e.map((e) => ({
		...e,
		items: e.items.map((e) => ({
			...e,
			cardProps: {
				...e.cardProps,
				onClick: () => r(e.id)
			}
		}))
	}));
	return /* @__PURE__ */ f(l, {
		columns: i,
		selectedItemId: n,
		onMoveItem: (e, n) => t((t) => g(t, e, n)),
		onCreateStart: (e) => console.log("create in", e),
		onColumnAction: (e, t) => console.log("action", t, "on", e)
	});
}, v = { render: () => /* @__PURE__ */ f(_, {}) }, y = {
	parameters: { docs: { description: { story: "Hold the primary mouse button and drag empty space or a column heading to pan horizontally. Cards still open and drag between columns. Column controls keep their normal actions. Touch and scrollbars use native scrolling." } } },
	render: () => /* @__PURE__ */ f(d, {
		maxW: "lg",
		height: "md",
		children: /* @__PURE__ */ f(_, {})
	})
}, b = {
	parameters: { docs: { description: { story: "Hold a dragged card near either side of the board to scroll. Moving closer to the edge scrolls faster." } } },
	render: () => /* @__PURE__ */ f(d, {
		maxW: "lg",
		height: "md",
		children: /* @__PURE__ */ f(_, {})
	}),
	play: async ({ canvasElement: e }) => {
		let i = t(e).getByText("Set up auth").closest("[data-testid=\"renderer-card\"]"), o = e.querySelector("[data-part=\"viewport\"]"), s = o.getBoundingClientRect(), c = new DataTransfer(), l = s.top + s.height / 2;
		n.dragStart(i, {
			dataTransfer: c,
			clientX: s.left + s.width / 2,
			clientY: l
		});
		try {
			n.dragOver(o, {
				dataTransfer: c,
				clientX: s.right - 48,
				clientY: l
			}), await r(() => a(o.scrollLeft).toBeGreaterThan(60)), n.dragOver(o, {
				dataTransfer: c,
				clientX: s.left + 48,
				clientY: l
			}), await r(() => a(o.scrollLeft).toBe(0));
		} finally {
			n.dragEnd(i, { dataTransfer: c });
		}
	}
}, x = {
	render: () => /* @__PURE__ */ f(d, {
		maxW: "lg",
		height: "md",
		children: /* @__PURE__ */ f(_, {})
	}),
	play: async ({ canvasElement: e }) => {
		m.mockClear();
		let o = t(e).getByText("Set up auth").closest("[data-testid=\"renderer-card\"]");
		a(o).not.toBeNull(), n.contextMenu(o), await a(await t(document.body).findByRole("menuitem", { name: "Run attempt" })).toBeVisible(), await a(t(document.body).getByRole("menuitem", { name: "Delete" })).toBeVisible(), await i.click(t(document.body).getByRole("menuitem", { name: "Run attempt" })), await r(() => a(m).toHaveBeenCalledTimes(1));
	}
};
export { v as Default, b as EdgeScrolling, y as WideBoard, x as WithContextMenuActions, p as default };
