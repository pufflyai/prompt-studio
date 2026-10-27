// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { n as a, r as o, t as s } from "./lock-CwbRk9bz.ts";
import { t as c } from "./eye-D2mhng7S.ts";
import { t as l } from "./file-image-C-vmn7dP.ts";
import { t as u } from "./folder-DJ8ZbA4G.ts";
import { t as d } from "./scroll-area-I7hjn89T.ts";
import { t as f } from "./tree-list-Db4WJcm2.ts";
import { useRef as p, useState as m } from "react";
import { Box as h, Button as g, HStack as _, Stack as v, Text as y } from "@chakra-ui/react";
import { jsx as b, jsxs as x } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-outliner.stories.tsx
var S = {
	title: "Components/Data Display/Tree List/Outliner",
	component: f,
	parameters: { docs: { description: { component: "Compose authoring rows with controlled selection, expansion, order, extension previews, and persistent toggle actions. Click replaces selection; Ctrl/Cmd toggles; Shift-click or Shift+Up/Down extends a visible enabled range. Space/Enter selects. Alt+Up/Down emits the focused node's sibling move through onMoveNode. Moves apply to the source by default; set moveSelection when the host moves the selected set. The host persists order and enforces domain rules such as locks. Group expansion has its own control. Buttons do not select, activate, or drag their row. Drop near a group edge for before/after, or in its center for inside. Native HTML drag moves and sortable customization remain separate APIs." } } }
}, C = (e) => {
	let { narrow: t } = e, [n, r] = m(["artwork"]), [i, d] = m(["group"]), [p, g] = m(["hidden"]), [S, C] = m(["locked"]), [w, T] = m([
		"title",
		"artwork",
		"group",
		"hidden",
		"locked",
		"disabled"
	]), E = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], D = (e, t) => ({
		id: e,
		label: t,
		disabled: e === "disabled",
		canDrag: !S.includes(e) && e !== "disabled",
		canDrop: e !== "disabled",
		isContainer: e === "group",
		children: e === "group" ? [D("child", "Group child")] : void 0,
		startContent: /* @__PURE__ */ x(_, {
			gap: "2xs",
			children: [/* @__PURE__ */ b(h, {
				boxSize: "5",
				display: "grid",
				placeItems: "center",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "xs",
				children: b(e === "group" ? u : l, { size: 14 })
			}), e === "artwork" ? /* @__PURE__ */ b(h, {
				"aria-label": "Mask preview",
				w: "4",
				h: "5",
				bg: "fg",
				borderWidth: "1px",
				borderColor: "border.subtle"
			}) : null]
		}),
		indicator: p.includes(e) ? {
			icon: /* @__PURE__ */ b(o, { size: 14 }),
			tooltip: "Hidden in the document"
		} : void 0,
		actionsVisibility: "always",
		actions: [{
			id: "visibility",
			label: `Toggle visibility: ${t}`,
			icon: p.includes(e) ? /* @__PURE__ */ b(o, {}) : /* @__PURE__ */ b(c, {}),
			pressed: !p.includes(e),
			disabled: e === "disabled",
			onAction: () => g(E(p, e))
		}, {
			id: "lock",
			label: `Toggle lock: ${t}`,
			icon: S.includes(e) ? /* @__PURE__ */ b(s, {}) : /* @__PURE__ */ b(a, {}),
			pressed: S.includes(e),
			disabled: e === "disabled",
			onAction: () => C(E(S, e))
		}]
	}), O = {
		title: "Title",
		artwork: "Artwork",
		group: "Group",
		hidden: "Hidden",
		locked: "Locked",
		disabled: "Unavailable"
	};
	return /* @__PURE__ */ x(v, {
		w: t ? "64" : "80",
		gap: "xs",
		children: [/* @__PURE__ */ b(f, {
			sections: [{
				id: "layers",
				nodes: w.map((e) => D(e, O[e]))
			}],
			activeNodeId: n,
			expandedNodeIds: i,
			onSelectionChange: r,
			onToggleNode: (e) => d(E(i, e)),
			onMoveNode: (e, t, n) => {
				if (n === "inside" || !t || !w.includes(e) || !w.includes(t)) return;
				let r = w.filter((t) => t !== e);
				r.splice(r.indexOf(t) + +(n === "after"), 0, e), T(r);
			}
		}), /* @__PURE__ */ x(y, {
			textStyle: "label/XS",
			color: "fg.muted",
			role: "status",
			children: ["Selected: ", n.join(", ")]
		})]
	});
}, w = {
	parameters: { docs: { description: { story: "This example reorders root siblings. Drops inside groups are ignored." } } },
	render: () => /* @__PURE__ */ b(C, {}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = r.setup(), s = a.getByRole("option", {
			name: "Title",
			exact: !0
		}), c = a.getByRole("option", {
			name: "Artwork",
			exact: !0
		});
		await o.click(a.getByRole("button", { name: "Toggle visibility: Artwork" })), await n(() => i(c).toHaveAttribute("aria-selected", "true")), await i(a.getByRole("button", { name: "Toggle visibility: Artwork" })).toHaveAttribute("aria-pressed", "false"), await o.click(s), await o.keyboard("{Control>}"), await o.click(c), await o.keyboard("{/Control}"), await n(() => i(s).toHaveAttribute("aria-selected", "true")), await n(() => i(c).toHaveAttribute("aria-selected", "true")), await o.click(c), await n(() => i(s).toHaveAttribute("aria-selected", "false")), c.focus(), await o.keyboard("{Alt>}{ArrowUp}{/Alt}"), await n(() => i(c).toHaveFocus()), await n(() => i(c.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
		let l = a.getByRole("option", {
			name: "Group",
			exact: !0
		});
		await o.click(l), await n(() => i(l).toHaveAttribute("aria-selected", "true")), await n(() => i(l).toHaveAttribute("aria-expanded", "true")), await o.click(a.getByRole("button", { name: "Collapse group" })), await n(() => i(l).toHaveAttribute("aria-expanded", "false")), await n(() => i(l).toHaveAttribute("aria-selected", "true"));
	}
}, T = { render: () => /* @__PURE__ */ b(C, { narrow: !0 }) }, E = () => {
	let e = p(null), [t, n] = m(["row-0"]);
	return /* @__PURE__ */ x(v, {
		w: "80",
		gap: "xs",
		children: [/* @__PURE__ */ b(d, {
			viewportRef: e,
			h: "64",
			children: /* @__PURE__ */ b(f, {
				virtualize: !0,
				scrollRef: e,
				activeNodeId: t,
				onSelectionChange: n,
				sections: [{
					id: "virtual",
					nodes: Array.from({ length: 60 }, (e, t) => ({
						id: `row-${t}`,
						label: `Layer ${t}`,
						disabled: t > 5 && t < 45
					}))
				}]
			})
		}), /* @__PURE__ */ x(y, {
			role: "status",
			children: ["Selected: ", t.join(", ")]
		})]
	});
}, D = {
	render: () => /* @__PURE__ */ b(E, {}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = r.setup();
		await o.click(a.getByRole("option", {
			name: "Layer 0",
			exact: !0
		})), await o.keyboard("{Shift>}");
		for (let e = 0; e < 6; e += 1) await o.keyboard("{ArrowDown}");
		await o.keyboard("{/Shift}"), await n(() => i(a.getByRole("option", {
			name: "Layer 45",
			exact: !0
		})).toHaveFocus()), await n(() => i(a.getByRole("status")).toHaveTextContent("row-0, row-1, row-2, row-3, row-4, row-5, row-45"));
	}
}, O = () => {
	let [e, t] = m(!1), [n, r] = m(["b"]), i = {
		id: "b",
		label: "Last layer"
	};
	return /* @__PURE__ */ x(v, {
		w: "80",
		children: [/* @__PURE__ */ b(f, {
			activeNodeId: n,
			onSelectionChange: r,
			expandedNodeIds: ["g"],
			sections: [{
				id: "layers",
				nodes: [{
					id: "g",
					label: "Group",
					isContainer: !0,
					children: [{
						id: "a",
						label: "First layer"
					}, ...e ? [] : [i]]
				}, ...e ? [i] : []]
			}]
		}), /* @__PURE__ */ b(g, {
			onClick: () => t(!0),
			children: "Move last layer to root"
		})]
	});
}, k = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ b(O, {}),
	play: async ({ canvasElement: a }) => {
		let o = e(a);
		await r.click(o.getByRole("option", {
			name: "Last layer",
			exact: !0
		})), t.click(o.getByRole("button", { name: "Move last layer to root" })), await n(() => i(o.getByRole("option", {
			name: "Last layer",
			exact: !0
		})).toHaveAttribute("aria-level", "1")), await n(() => i(o.getByRole("option", {
			name: "Last layer",
			exact: !0
		})).toHaveFocus());
	}
};
export { w as ControlledAuthoringRows, k as FocusAfterReparenting, T as NarrowInspector, D as VirtualRangeSelection, S as default };
