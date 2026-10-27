// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./ellipsis-BnQWfGiA.ts";
import { t as a } from "./tree-list-Db4WJcm2.ts";
import { useRef as o, useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
var u = {
	tags: ["motion"],
	title: "Components/Tree List/Motion",
	component: (e) => {
		let { draggable: t = !1, virtualize: n = !1 } = e, r = o(null), [u, d] = s(["workspaces", "tools"]), [f, p] = s([]), m = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t];
		return /* @__PURE__ */ l(c, {
			w: "80",
			h: n ? "64" : void 0,
			overflowY: n ? "auto" : void 0,
			ref: r,
			children: /* @__PURE__ */ l(a, {
				virtualize: n,
				scrollRef: r,
				nodeGap: "1",
				draggable: t,
				onReorderSections: () => {},
				onReorderNodes: () => {},
				sections: [{
					id: "workspaces",
					label: "Workspaces",
					nodes: [{
						id: "research",
						label: "Research",
						children: [{
							id: "notes",
							label: "Meeting notes",
							actions: [{
								id: "actions",
								label: "Note actions",
								icon: /* @__PURE__ */ l(i, {})
							}]
						}]
					}]
				}, {
					id: "tools",
					label: "Tools",
					nodes: [{
						id: "planner",
						label: "Planner"
					}]
				}],
				expandedSectionIds: u,
				expandedNodeIds: f,
				activeNodeId: "research",
				onToggleSection: (e) => d(m(u, e)),
				onToggleNode: (e) => p(m(f, e))
			})
		});
	}
}, d = { play: async ({ canvasElement: i }) => {
	let a = e(i);
	await n.click(await a.findByText("Research")), await t(() => r(a.getByText("Meeting notes")).toBeVisible()), a.getByText("Meeting notes").closest("[role=option]")?.focus(), await t(() => r(a.getByRole("button", { name: "Note actions" })).toBeVisible()), await n.click(a.getByText("Research")), await t(() => r(a.getByText("Meeting notes")).not.toBeVisible()), await n.click(a.getByText("Research")), await t(() => r(a.getByText("Meeting notes")).toBeVisible());
} }, f = {
	...d,
	args: { draggable: !0 }
}, p = {
	args: { virtualize: !0 },
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		await n.click(await a.findByText("Research")), await t(() => r(a.getByText("Meeting notes")).toBeVisible());
		for (let e of i.querySelectorAll("[data-open]")) await r(getComputedStyle(e).transitionDuration).toBe("0s");
	}
}, m = {
	tags: ["!manifest"],
	args: { draggable: !0 },
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		await n.tab(), await r(a.getByText("Research").closest("[role=option]")).toHaveFocus(), await n.keyboard("{Enter}"), await t(() => r(a.getByText("Meeting notes")).toBeVisible()), await n.keyboard("{ArrowDown}"), await r(a.getByText("Meeting notes").closest("[role=option]")).toHaveFocus(), await n.keyboard("{ArrowLeft}"), await r(a.getByText("Research").closest("[role=option]")).toHaveFocus(), await n.keyboard("{ArrowLeft}"), await t(() => r(a.getByText("Meeting notes")).not.toBeVisible());
	}
};
export { p as InstantVirtual, d as NestedGroups, f as SortableGroups, m as SortableKeyboard, u as default };
