// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./kanban-renderer-board-Cn-_gg0W.ts";
import { useState as a } from "react";
import { Box as o, Button as s, Stack as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-scrolling.stories.tsx
var d = {
	title: "Patterns/Kanban Renderer/Column Scrolling",
	tags: ["!manifest", "ticket-column-scrollbar"]
}, f = Array.from({ length: 40 }, (e, t) => ({
	id: `ticket-${t}`,
	cardProps: { title: `Ticket ${t + 1}. ${"A task with a longer title. ".repeat(t % 3)}` }
})), p = {
	id: "todo",
	label: "Todo",
	items: f,
	actions: [],
	canCreate: !1
}, m = (e) => {
	let { count: t, grouped: n } = e, [r, d] = a(t), m = f.slice(0, r);
	return /* @__PURE__ */ u(c, {
		alignItems: "start",
		children: [/* @__PURE__ */ l(s, {
			size: "sm",
			onClick: () => d(1),
			children: "Keep one card"
		}), /* @__PURE__ */ l(o, {
			"data-testid": "board-frame",
			height: "lg",
			width: "sm",
			children: /* @__PURE__ */ l(i, { columns: [{
				...p,
				items: m,
				groups: n ? [{
					key: "priority",
					label: "High priority",
					items: m
				}] : void 0
			}] })
		})]
	});
}, h = (t) => {
	let n = e(t).getByTestId("board-column-todo"), r = n.querySelector("[data-board-column-viewport]");
	return {
		columnElement: n,
		viewport: r,
		scrollbar: r.parentElement.querySelector("[data-part=\"scrollbar\"]")
	};
}, g = {
	render: () => /* @__PURE__ */ l(m, { count: 5 }),
	play: async ({ canvasElement: n }) => {
		let { viewport: i, scrollbar: a } = h(n);
		await t(() => r(i.querySelectorAll("[data-index]")).toHaveLength(5));
		let o = e(n).getByTestId("board-frame"), s = i.querySelector("[data-index=\"4\"]");
		await t(() => r(s.offsetTop).toBeGreaterThan(0));
		let c = s.offsetTop + s.getBoundingClientRect().height;
		o.style.height = `${o.clientHeight - i.clientHeight + c + 4}px`, await t(() => r(i.clientHeight).toBeLessThan(c + 10)), await t(() => r(i.scrollHeight).toBe(i.clientHeight)), await t(() => r(a).not.toBeVisible());
	}
}, _ = {
	render: () => /* @__PURE__ */ l(m, { count: 40 }),
	play: async ({ canvasElement: i }) => {
		let { columnElement: a, viewport: o, scrollbar: s } = h(i);
		await t(() => r(o.scrollHeight).toBeGreaterThan(o.clientHeight)), await n.hover(o), await t(() => r(s).toBeVisible());
		let c = a.getBoundingClientRect().right - a.clientLeft;
		r(Math.abs(s.getBoundingClientRect().right - c)).toBeLessThan(1), o.scrollTop = o.scrollHeight, await t(() => r(e(a).getByRole("button", { name: f.at(-1).cardProps.title.trim() })).toBeVisible()), await n.click(e(i).getByRole("button", { name: "Keep one card" })), await t(() => r(o.scrollHeight).toBe(o.clientHeight)), await t(() => r(s).not.toBeVisible());
	}
}, v = {
	render: () => /* @__PURE__ */ l(m, {
		count: 40,
		grouped: !0
	}),
	play: async ({ canvasElement: i }) => {
		let { viewport: a, scrollbar: o } = h(i);
		await t(() => r(a.scrollHeight).toBeGreaterThan(a.clientHeight)), await n.click(e(i).getByRole("button", { name: /High priority/ })), await t(() => r(a.scrollHeight).toBe(a.clientHeight)), await t(() => r(o).not.toBeVisible());
	}
};
export { g as FittingCards, v as GroupedCards, _ as OverflowingCards, d as default };
