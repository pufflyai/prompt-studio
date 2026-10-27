// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./scroll-area-I7hjn89T.ts";
import { t as a } from "./tree-list-Db4WJcm2.ts";
import { useRef as o, useState as s } from "react";
import { Box as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
var p = {
	title: "Components/Data Display/Tree List/Virtual Sortable",
	component: () => {
		let e = o(null), [t, n] = s(""), [r, c] = s([{
			id: "sessions",
			label: "Sessions",
			nodes: Array.from({ length: 1e3 }, (e, t) => ({
				id: `session-${t + 1}`,
				label: `Session ${t + 1}`,
				isNavigable: !0
			}))
		}]);
		return /* @__PURE__ */ f(l, {
			w: "80",
			gap: "sm",
			children: [/* @__PURE__ */ f(u, { children: ["Opened: ", t] }), /* @__PURE__ */ d(i, {
				height: "96",
				viewportRef: e,
				children: /* @__PURE__ */ d(a, {
					virtualize: !0,
					draggable: !0,
					scrollRef: e,
					sections: r,
					expandedSectionIds: ["sessions"],
					rowVariant: "compact",
					onNavigate: (e) => n(e.nodeId),
					onReorderNodes: (e, t) => c((n) => n.map((n) => n.id === e ? {
						...n,
						nodes: t.map((e) => n.nodes.find((t) => t.id === e))
					} : n))
				})
			})]
		});
	},
	tags: ["!manifest"]
}, m = { play: async ({ canvasElement: i }) => {
	let a = e(i), o = await a.findByRole("option", { name: "Session 1" });
	await r(o).toBeVisible(), await r(a.getAllByRole("option").length).toBeLessThan(60), await n.click(o), await r(a.getByText("Opened: session-1")).toBeVisible(), await n.keyboard("{End}"), await t(() => r(a.getByRole("option", { name: "Session 1000" })).toHaveFocus()), await n.keyboard("{Home}"), await t(() => r(a.getByText("Sessions", { exact: !0 }).closest("[data-tree-list-focus-id]")).toHaveFocus());
} }, h = {}, g = () => {
	let e = o(null), [t, n] = s(["Files", "Sessions"]);
	return /* @__PURE__ */ d(c, {
		w: "80",
		children: /* @__PURE__ */ d(i, {
			height: "64",
			viewportRef: e,
			children: /* @__PURE__ */ d(a, {
				virtualize: !0,
				draggable: !0,
				scrollRef: e,
				sections: t.map((e) => ({
					id: e,
					label: e,
					nodes: [{
						id: `${e}-row`,
						label: `${e} row`
					}]
				})),
				expandedSectionIds: t,
				onReorderSections: n
			})
		})
	});
}, _ = { render: () => /* @__PURE__ */ d(g, {}) }, v = () => {
	let e = o(null), [t, n] = s({
		navigation: ["search"],
		research: []
	});
	return /* @__PURE__ */ d(c, {
		w: "80",
		children: /* @__PURE__ */ d(i, {
			height: "64",
			viewportRef: e,
			children: /* @__PURE__ */ d(a, {
				virtualize: !0,
				draggable: !0,
				scrollRef: e,
				sections: [{
					id: "navigation",
					nodes: t.navigation.map((e) => ({
						id: e,
						label: "Search"
					}))
				}, {
					id: "research",
					label: "Research",
					nodes: t.research.map((e) => ({
						id: e,
						label: "Search"
					}))
				}],
				expandedSectionIds: ["research"],
				onReorderNodes: (e, t) => n((n) => ({
					...n,
					[e]: t
				}))
			})
		})
	});
}, y = { render: () => /* @__PURE__ */ d(v, {}) };
export { m as LargeSessions, y as MoveIntoGroup, _ as ReorderSections, h as ReorderVisibleRows, p as default };
