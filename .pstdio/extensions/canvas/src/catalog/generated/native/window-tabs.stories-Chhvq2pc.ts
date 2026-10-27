// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./book-open-OD77qyyJ.ts";
import { n as a, t as o } from "./pen-tool-jRnL7PHh.ts";
import { t as s } from "./folder-DJ8ZbA4G.ts";
import { t as c } from "./plus-CYkLGSPS.ts";
import { t as l } from "./window-title-bar-BQdVajcZ.ts";
import { t as u } from "./window-tabs-DXUe-FGy.ts";
import { useState as d } from "react";
import { Box as f, IconButton as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/ui/src/components/tab-strip/window-tabs.stories.tsx
var g = [
	{
		id: "docs",
		label: "Docs",
		icon: /* @__PURE__ */ m(i, {})
	},
	{
		id: "kanban",
		label: "Agentic kanban",
		icon: /* @__PURE__ */ m(a, {})
	},
	{
		id: "design",
		label: "Agentic design",
		icon: /* @__PURE__ */ m(o, {})
	}
], _ = (e) => {
	let { initialTabs: t = g, platform: n = "darwin" } = e, [r, i] = d(t), [a, o] = d(r[0]?.id);
	return /* @__PURE__ */ h(l, {
		platform: n,
		children: [/* @__PURE__ */ m(u, {
			tabs: r,
			selectedId: a,
			"aria-label": "Project tabs",
			onSelect: o,
			onReorder: (e, t) => {
				let n = [...r], a = n.findIndex((t) => t.id === e), o = n.findIndex((e) => e.id === t);
				n.splice(o, 0, ...n.splice(a, 1)), i(n);
			},
			onClose: (e) => {
				let t = r.findIndex((t) => t.id === e), n = r.filter((t) => t.id !== e);
				i(n), a === e && o(n[Math.min(t, n.length - 1)]?.id);
			}
		}), /* @__PURE__ */ m(p, {
			"aria-label": "Open project",
			variant: "ghost",
			size: "xs",
			children: /* @__PURE__ */ m(c, {})
		})]
	});
}, v = {
	title: "Components/Navigation/Window Tabs",
	component: u,
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Native window title-bar tabs. The host owns selection, close behavior, and optional reordering. Drag a tab to the shared insertion line; the preview stays inside the strip and releasing outside cancels the move. Long labels ellipsize at the shared tab limit; crowded tabs shrink before scrolling. Focus a tab and use Alt+ArrowLeft or Alt+ArrowRight to reorder, or press Space, arrow keys, then Space to drop or Escape to cancel. Reordering keeps the selected tab. Native controls occupy the reserved area; stories do not draw them. The desktop host sets data-window-full-screen on the document in macOS full screen to release that space." } }
	}
}, y = async (t) => {
	let n = e(t), i = n.getAllByRole("tab").at(-1).closest(".ps-window-tabs__tab"), a = n.getByRole("button", { name: "Open project" }), o = Number.parseFloat(getComputedStyle(a.parentElement).columnGap);
	await r(a.getBoundingClientRect().left - i.getBoundingClientRect().right).toBeCloseTo(o, 1);
}, b = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		await y(t);
		let i = e(t).getAllByRole("tab");
		for (let e of i) await r(e.closest(".ps-window-tabs__tab")).toHaveStyle({ borderWidth: "0px" });
		await n.click(i[1]), await r(i[1]).toHaveAttribute("aria-selected", "true");
		for (let e of i) await r(e.closest(".ps-window-tabs__tab")).toHaveStyle({ borderWidth: "0px" });
		await n.click(e(t).getByRole("button", { name: "Close Agentic design" })), await y(t);
	}
}, x = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getByRole("tab", { name: "Docs" });
		a.focus(), await n.keyboard(" {ArrowRight} "), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Agentic kanban",
			"Docs",
			"Agentic design"
		]), await r(a).toHaveAttribute("aria-selected", "true"), await n.keyboard(" {ArrowRight}{Escape}"), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Agentic kanban",
			"Docs",
			"Agentic design"
		]), await r(a).not.toHaveAttribute("aria-pressed", "true"), await n.keyboard(" {ArrowLeft} "), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Docs",
			"Agentic kanban",
			"Agentic design"
		]), await n.keyboard("{Alt>}{ArrowRight}{/Alt}"), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Agentic kanban",
			"Docs",
			"Agentic design"
		]), await r(a).toHaveAttribute("aria-selected", "true");
	}
}, S = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getByRole("tab", { name: "Docs" }), s = a.getByRole("tab", { name: "Agentic design" }), c = o.getBoundingClientRect(), l = s.getBoundingClientRect(), u = {
			x: c.left + c.width / 2,
			y: c.top + c.height / 2
		}, d = {
			x: l.right - 4,
			y: u.y
		}, f = n.setup();
		await f.pointer([
			{
				keys: "[MouseLeft>]",
				target: o,
				coords: u
			},
			{
				target: o,
				coords: {
					...u,
					x: u.x + 8
				}
			},
			{
				target: s,
				coords: d
			}
		]), await t(() => r(i.querySelector("[data-window-tab-drop=\"after\"]")).toBeVisible()), await r(o.getBoundingClientRect().left).toBe(c.left), await f.pointer({
			keys: "[/MouseLeft]",
			target: s,
			coords: d
		}), await t(() => r(a.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Agentic kanban",
			"Agentic design",
			"Docs"
		])), await r(o).toHaveAttribute("aria-selected", "true");
		let p = o.getBoundingClientRect(), m = a.getByRole("tab", { name: "Agentic kanban" }), h = m.getBoundingClientRect(), g = {
			x: h.left + h.width / 2,
			y: u.y
		};
		await f.pointer([
			{
				keys: "[MouseLeft>]",
				target: o,
				coords: {
					x: p.left + p.width / 2,
					y: u.y
				}
			},
			{
				target: o,
				coords: {
					x: p.left + p.width / 2 - 8,
					y: u.y
				}
			},
			{
				target: m,
				coords: g
			}
		]), await t(() => r(i.querySelector("[data-window-tab-drop=\"before\"]")).toBeVisible()), await f.pointer({
			keys: "[/MouseLeft]",
			target: m,
			coords: g
		}), await t(() => r(a.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Docs",
			"Agentic kanban",
			"Agentic design"
		]));
	}
}, C = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getByRole("tab", { name: "Docs" }), o = a.getBoundingClientRect(), s = {
			x: o.left + o.width / 2,
			y: o.top + o.height / 2
		}, c = {
			x: t.getBoundingClientRect().right - 10,
			y: s.y
		}, l = n.setup();
		await l.pointer([
			{
				keys: "[MouseLeft>]",
				target: a,
				coords: s
			},
			{
				target: a,
				coords: {
					...s,
					x: s.x + 8
				}
			},
			{
				target: t,
				coords: c
			}
		]), await r(a.getBoundingClientRect().left).toBe(o.left), await r(t.querySelector("[data-window-tab-drop]")).toBeNull(), await l.pointer({
			keys: "[/MouseLeft]",
			target: t,
			coords: c
		}), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Docs",
			"Agentic kanban",
			"Agentic design"
		]);
	}
}, w = { render: () => /* @__PURE__ */ m(f, {
	"data-window-full-screen": "",
	children: /* @__PURE__ */ m(_, {})
}) }, T = {
	...w,
	globals: { theme: "pstdio-dark" }
}, E = {
	render: () => /* @__PURE__ */ m(_, { initialTabs: g.slice(0, 1) }),
	play: async ({ canvasElement: e }) => y(e)
}, D = {
	render: () => /* @__PURE__ */ m(f, {
		maxWidth: "2xl",
		children: /* @__PURE__ */ m(_, { initialTabs: Array.from({ length: 12 }, (e, t) => ({
			id: String(t),
			label: `Research project ${t + 1}`,
			icon: /* @__PURE__ */ m(s, {})
		})) })
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getAllByRole("tab"), s = i.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
		await r(s.scrollWidth).toBeGreaterThan(s.clientWidth), await r(s.scrollHeight).toBe(s.clientHeight), o[0].focus(), await n.keyboard("{End}"), await t(() => r(s.scrollLeft).toBeGreaterThan(0)), await r(o.at(-1)).toHaveAttribute("aria-selected", "true");
		let c = a.getAllByRole("button", { name: /^Close / }).at(-1);
		await r(c.getBoundingClientRect().right).toBeLessThanOrEqual(s.getBoundingClientRect().right);
	}
}, O = {
	...D,
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = i.getAllByRole("tab"), o = a.map((e) => e.textContent), s = t.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]"), c = a[2].getBoundingClientRect(), l = s.getBoundingClientRect(), u = {
			x: c.left + c.width / 2,
			y: c.top + c.height / 2
		}, d = {
			x: l.right + 24,
			y: u.y
		}, f = n.setup();
		await f.pointer([
			{
				keys: "[MouseLeft>]",
				target: a[2],
				coords: u
			},
			{
				target: a[2],
				coords: {
					...u,
					x: u.x + 8
				}
			},
			{
				target: i.getByRole("button", { name: "Open project" }),
				coords: d
			}
		]), await r(t.querySelector("[data-window-tab-drop]")).toBeNull(), await f.pointer({
			keys: "[/MouseLeft]",
			target: t,
			coords: d
		}), await r(i.getAllByRole("tab").map((e) => e.textContent)).toEqual(o);
	}
}, k = {
	render: () => /* @__PURE__ */ m(_, { initialTabs: [{
		id: "long",
		label: "Prompt Studio research and documentation for the desktop release",
		icon: /* @__PURE__ */ m(i, {})
	}, ...g] }),
	play: async ({ canvasElement: i }) => {
		let a = "Prompt Studio research and documentation for the desktop release", o = e(i).getByRole("tab", { name: a }), s = o.querySelector("span");
		await r(s.scrollWidth).toBeGreaterThan(s.clientWidth), await r(s).toHaveStyle({
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		});
		let c = e(i.ownerDocument.body), l = e(i).getByRole("tab", { name: "Docs" });
		await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), await n.hover(o), await r(await c.findByRole("tooltip")).toHaveTextContent(a), await n.unhover(o), await n.hover(l), await t(() => r(c.queryByRole("tooltip")).toBeNull()), await n.unhover(l), await n.hover(o), await r(await c.findByRole("tooltip")).toHaveTextContent(a), await n.unhover(o), await n.keyboard("{Escape}"), await t(() => r(c.queryByRole("tooltip")).toBeNull()), o.focus(), await r(await c.findByRole("tooltip")).toHaveTextContent(a), await n.keyboard("{Escape}"), l.focus(), await n.hover(l), await t(() => r(c.queryByRole("tooltip")).toBeNull());
	}
}, A = {
	render: () => /* @__PURE__ */ m(_, {}),
	globals: { theme: "pstdio-dark" }
}, j = {
	render: () => /* @__PURE__ */ m(_, {}),
	globals: { theme: "pstdio-light" }
}, M = { render: () => /* @__PURE__ */ m(_, { platform: "win32" }) }, N = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		await n.hover(e(t).getByRole("button", { name: "Close Docs" }));
	}
}, P = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		i.getByRole("tab", { name: "Docs" }).focus(), await n.tab(), await r(i.getByRole("button", { name: "Close Docs" })).toHaveFocus();
	}
}, F = {
	render: () => /* @__PURE__ */ m(_, {}),
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		i.getByRole("tab", { name: "Docs" }).focus(), await n.keyboard("{ArrowRight}"), await r(i.getByRole("tab", { name: "Agentic kanban" })).toHaveAttribute("aria-selected", "true"), await n.keyboard("{Delete}"), await r(i.getByRole("tab", { name: "Agentic design" })).toHaveAttribute("aria-selected", "true");
	}
}, I = {
	render: () => /* @__PURE__ */ m(f, {
		maxWidth: "2xl",
		children: /* @__PURE__ */ m(_, { initialTabs: [
			...g,
			{
				id: "research",
				label: "Research and documentation",
				icon: /* @__PURE__ */ m(s, {})
			},
			{
				id: "notes",
				label: "Notes",
				icon: /* @__PURE__ */ m(i, {})
			}
		] })
	}),
	play: async ({ canvasElement: e }) => y(e)
};
export { P as CloseFocus, N as CloseHover, I as Crowded, A as Dark, C as DropOutside, w as FullScreen, T as FullScreenDark, x as KeyboardReordering, F as KeyboardSelection, j as Light, k as LongNames, M as NativeOverlay, E as OneTab, D as Overflow, O as OverflowDropOutside, S as PointerReordering, b as SeveralTabs, v as default };
