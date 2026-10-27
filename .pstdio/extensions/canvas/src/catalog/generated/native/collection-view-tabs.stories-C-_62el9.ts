// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./collection-view-tabs-D5oJVSgx.ts";
import { t as a } from "./collection-view-types-69xG6kJd.ts";
import { useState as o } from "react";
import { Box as s, HStack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-tabs.stories.tsx
var f = Array.from({ length: 18 }, (e, t) => ({
	id: String(t),
	title: `Team view ${t + 1}`,
	settings: {},
	filter: a,
	sorts: [],
	builtIn: !1
})), p = "Team planning and research for the upcoming desktop release", m = (e) => {
	let { longLabel: t } = e, [n, r] = o("0");
	return /* @__PURE__ */ d(s, {
		width: "full",
		maxW: "24rem",
		children: [/* @__PURE__ */ u(c, {
			gap: "2xs",
			children: /* @__PURE__ */ u(i, {
				views: t ? f.map((e, t) => t === 1 ? {
					...e,
					title: p
				} : e) : f,
				activeViewId: n,
				dirty: !1,
				busy: !1,
				state: f[0],
				onActivate: (e) => r(e.id),
				run: (e) => void e(),
				createView: async () => void 0
			})
		}), /* @__PURE__ */ u(l, {
			"data-testid": "active-view",
			children: n
		})]
	});
}, h = { title: "Patterns/Collection View/View Tabs" }, g = (e) => {
	let { crowded: t } = e, [n, r] = o(f.slice(0, t ? 18 : 3)), [a, l] = o("0");
	return /* @__PURE__ */ u(s, {
		width: "full",
		maxW: t ? "24rem" : void 0,
		children: /* @__PURE__ */ u(c, { children: /* @__PURE__ */ u(i, {
			views: n,
			viewsSource: {
				views: n,
				defaultViewId: "0",
				onCreateView: async () => n[0],
				onUpdateView: async () => void 0,
				onDeleteView: async () => void 0,
				onSetDefaultView: async () => void 0,
				onReorderViews: async (e) => r(e.map((e) => n.find((t) => t.id === e)))
			},
			activeViewId: a,
			dirty: !0,
			busy: !1,
			state: n[0],
			onActivate: (e) => l(e.id),
			run: (e) => void e(),
			createView: async () => void 0
		}) })
	});
}, _ = {
	render: () => /* @__PURE__ */ u(g, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getByRole("tab", { name: /^Team view 1/ });
		o.focus(), await n.keyboard("{Alt>}{ArrowRight}{/Alt}"), await r(a.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Team view 2",
			"Team view 1",
			"Team view 3"
		]), await r(o).toHaveAttribute("aria-selected", "true"), await r(o).toHaveFocus(), await r(a.getByLabelText("Unsaved view changes")).toBeVisible(), await n.keyboard("{Alt>}{ArrowLeft}{/Alt}"), await r(a.getAllByRole("tab").map((e) => e.textContent)).toEqual([
			"Team view 1",
			"Team view 2",
			"Team view 3"
		]), await n.keyboard("{ArrowRight}"), await t(() => r(a.getByRole("tab", { name: /^Team view 2/ })).toHaveAttribute("aria-selected", "true"));
		let s = a.getByRole("tab", { name: /^Team view 2/ });
		await n.keyboard("{Shift>}{F10}{/Shift}"), await e(document.body).findByRole("menu"), await n.keyboard("{Escape}"), await t(() => r(s).toHaveFocus());
	}
}, v = {
	render: () => /* @__PURE__ */ u(g, { crowded: !0 }),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getByRole("tab", { name: /^Team view 1 / });
		o.focus();
		for (let e = 1; e <= 10; e++) await n.keyboard("{Alt>}{ArrowRight}{/Alt}"), await t(() => r(a.getAllByRole("tab").indexOf(o)).toBe(e));
		let s = i.querySelector("[data-part=\"viewport\"]");
		await t(() => {
			let e = o.getBoundingClientRect(), t = s.getBoundingClientRect();
			r(e.left).toBeGreaterThanOrEqual(t.left - 1), r(e.right).toBeLessThanOrEqual(t.right + 1);
		}), await r(o).toHaveFocus();
	}
}, y = {
	render: () => /* @__PURE__ */ u(m, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = i.querySelector("[data-part=\"viewport\"]");
		r(o).not.toBeNull(), r(o.scrollWidth).toBeGreaterThan(o.clientWidth), r(getComputedStyle(i.querySelector("[data-part=\"scrollbar\"]")).height).toBe("2px"), a.getByRole("tab", {
			name: "Team view 1",
			exact: !0
		}).focus(), await n.keyboard("{End}"), await t(() => r(a.getByTestId("active-view")).toHaveTextContent("17"));
		let s = a.getByRole("tab", {
			name: "Team view 18",
			exact: !0
		}).getBoundingClientRect();
		r(s.right).toBeLessThanOrEqual(o.getBoundingClientRect().right + 1), await r(a.getByRole("button", { name: "Add view" })).toBeVisible();
	}
}, b = {
	render: () => /* @__PURE__ */ u(m, { longLabel: !0 }),
	play: async ({ canvasElement: i }) => {
		let a = e(i).getByRole("tab", { name: p }), o = e(i.ownerDocument.body), s = e(i).getByRole("tab", { name: "Team view 1" });
		await new Promise((e) => requestAnimationFrame(() => requestAnimationFrame(() => e()))), await n.hover(a), await r(await o.findByRole("tooltip")).toHaveTextContent(p), await n.unhover(a), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull()), await n.unhover(s), await n.hover(a), await r(await o.findByRole("tooltip")).toHaveTextContent(p), await n.unhover(a), await n.keyboard("{Escape}"), await t(() => r(o.queryByRole("tooltip")).toBeNull()), a.focus(), await r(await o.findByRole("tooltip")).toHaveTextContent(p), await n.keyboard("{Escape}"), s.focus(), await n.hover(s), await t(() => r(o.queryByRole("tooltip")).toBeNull());
	}
};
export { v as CrowdedReordering, b as FullTitle, y as ManyViews, _ as ReorderViews, h as default };
