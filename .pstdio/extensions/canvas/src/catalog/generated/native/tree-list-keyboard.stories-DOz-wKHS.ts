// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./tree-list-Db4WJcm2.ts";
import { useState as a } from "react";
import { Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-keyboard.stories.tsx
var u = {
	title: "Components/Data Display/Tree List/Keyboard",
	component: i
}, d = (e) => {
	let { empty: t, moveSelection: n, select: r = !0 } = e, [u, d] = a(t ? [] : ["b", "c"]), [f, p] = a(n ? [
		"a",
		"b",
		"c",
		"d"
	] : [
		"a",
		"b",
		"c"
	]);
	return /* @__PURE__ */ l(o, {
		w: "80",
		children: [/* @__PURE__ */ c(i, {
			sections: [{
				id: "rows",
				nodes: f.map((e) => ({
					id: e,
					label: `Layer ${e}`,
					canDrag: !0,
					canDrop: !0
				}))
			}],
			activeNodeId: u,
			onSelectionChange: r ? d : void 0,
			moveSelection: n,
			onMoveNode: (e, t, r) => {
				if (!t) return;
				let i = f.filter((t) => n && u.includes(e) ? u.includes(t) : t === e), a = f.filter((e) => !i.includes(e));
				a.splice(a.indexOf(t) + +(r === "after"), 0, ...i), p(a);
			}
		}), /* @__PURE__ */ l(s, {
			role: "status",
			textStyle: "label/XS",
			children: ["Selected: ", u.join(", ")]
		})]
	});
}, f = {
	render: () => /* @__PURE__ */ c(d, { moveSelection: !0 }),
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		a.getByRole("option", {
			name: "Layer b",
			exact: !0
		}).focus(), await n.keyboard("{Alt>}{ArrowDown}{/Alt}"), await t(() => r(a.getAllByRole("option").map((e) => e.textContent)).toEqual([
			"Layer a",
			"Layer d",
			"Layer b",
			"Layer c"
		])), a.getByRole("option", {
			name: "Layer d",
			exact: !0
		}).focus(), await n.keyboard("{Alt>}{ArrowUp}{/Alt}"), await t(() => r(a.getAllByRole("option").map((e) => e.textContent)).toEqual([
			"Layer d",
			"Layer a",
			"Layer b",
			"Layer c"
		]));
	}
}, p = {
	render: () => /* @__PURE__ */ c(d, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getByRole("option", {
			name: "Layer b",
			exact: !0
		});
		o.focus(), await n.keyboard("{Alt>}{ArrowDown}{/Alt}"), await t(() => r(a.getAllByRole("option").map((e) => e.textContent)).toEqual([
			"Layer a",
			"Layer c",
			"Layer b"
		])), await r(o).toHaveFocus();
	}
}, m = {
	render: () => /* @__PURE__ */ c(d, { select: !1 }),
	play: p.play
}, h = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ c(d, { empty: !0 }),
	play: async ({ canvasElement: i }) => {
		let a = e(i);
		a.getByRole("option", {
			name: "Layer a",
			exact: !0
		}).focus(), await n.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}"), await t(() => r(a.getByRole("status")).toHaveTextContent("Selected: a, b, c")), await r(a.getByRole("option", {
			name: "Layer c",
			exact: !0
		})).toHaveFocus(), await n.keyboard("{Shift>}{ArrowUp}{/Shift}"), await t(() => r(a.getByRole("status")).toHaveTextContent("Selected: a, b"));
	}
};
export { m as MovesWithoutSelection, h as RangeFromEmptySelection, f as SelectionMoves, p as SourceOnlyMoves, u as default };
