// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./file-text-B9-uT4dU.ts";
import { t as o } from "./folder-DJ8ZbA4G.ts";
import { t as s } from "./tree-list-Db4WJcm2.ts";
import { useState as c } from "react";
import { Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-move.stories.tsx
var p = {
	title: "Components/Data Display/Tree List/Move",
	component: s
}, m = () => {
	let [e, t] = c(""), [n, r] = c(""), i = {
		id: "README.md",
		label: "README.md",
		icon: /* @__PURE__ */ d(a, { size: 14 }),
		canDrag: !0
	}, p = [{
		id: "files",
		nodes: [
			{
				id: "docs",
				label: "docs",
				icon: /* @__PURE__ */ d(o, { size: 14 }),
				isContainer: !0,
				canDrop: !0,
				children: [...n === "docs" ? [{
					id: "src",
					label: "src",
					icon: /* @__PURE__ */ d(o, { size: 14 }),
					isContainer: !0,
					canDrag: !0,
					canDrop: !0
				}] : [], ...e === "docs" ? [i] : []]
			},
			...n ? [] : [{
				id: "src",
				label: "src",
				icon: /* @__PURE__ */ d(o, { size: 14 }),
				isContainer: !0,
				canDrag: !0,
				canDrop: !0
			}],
			...e ? [] : [i]
		]
	}];
	return /* @__PURE__ */ f(l, {
		maxW: "20rem",
		h: "16rem",
		borderWidth: "1px",
		gap: "0",
		children: [/* @__PURE__ */ d(u, {
			p: "xs",
			textStyle: "label/S/regular",
			color: "fg.muted",
			children: "Drag README.md or src onto docs or the empty tree background."
		}), /* @__PURE__ */ d(s, {
			sections: p,
			expandedNodeIds: ["docs"],
			rowVariant: "tree",
			onMoveNode: (e, n) => {
				let i = n === "docs" ? "docs" : "";
				e === "src" ? r(i) : t(i);
			}
		})]
	});
}, h = { render: () => /* @__PURE__ */ d(m, {}) }, g = () => {
	let [e, t] = c(!1), [n, r] = c(["note", "second"]), [i, a] = c(["workspaces", "notes"]), o = {
		id: "note",
		label: "Research note",
		canDrag: !0,
		canDrop: !0
	}, l = {
		id: "second",
		label: "Meeting notes",
		canDrag: !0,
		canDrop: !0
	};
	return /* @__PURE__ */ d(s, {
		draggable: !0,
		expandedNodeIds: ["notes", "folder"],
		sections: [{
			id: "navigation",
			nodes: [{
				id: "workspaces",
				label: "Workspaces"
			}, {
				id: "notes",
				label: "Notes",
				canDrop: !0,
				children: [{
					id: "folder",
					label: "Ideas",
					canDrop: !0,
					isContainer: !0,
					children: e ? [o] : []
				}, ...n.flatMap((t) => t === "second" ? [l] : e ? [] : [o])]
			}].sort((e, t) => i.indexOf(e.id) - i.indexOf(t.id))
		}],
		onReorderNodes: (e, t) => a(t),
		onMoveNode: (e, n, i) => {
			e === "note" && n && (t(n === "folder"), n === "second" && r(i === "after" ? ["second", "note"] : ["note", "second"]));
		}
	});
}, _ = {
	render: () => /* @__PURE__ */ d(g, {}),
	play: async ({ canvasElement: r }) => {
		let a = e(r), o = new DataTransfer(), s = (e, n, r = 0) => t(n, new DragEvent(e, {
			bubbles: !0,
			cancelable: !0,
			dataTransfer: o,
			clientY: r
		})), c = (e) => {
			let t = a.getByRole("option", { name: "Research note" }), n = a.getByRole("option", { name: "Meeting notes" }), r = n.parentElement.getBoundingClientRect();
			s("dragstart", t.parentElement), s("dragover", n.parentElement, e ? r.bottom - 1 : r.top + 1), s("drop", n.parentElement, e ? r.bottom - 1 : r.top + 1);
		};
		c(!0), await n(() => i(a.getByRole("option", { name: "Meeting notes" }).compareDocumentPosition(a.getByRole("option", { name: "Research note" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()), c(!1), await n(() => i(a.getByRole("option", { name: "Research note" }).compareDocumentPosition(a.getByRole("option", { name: "Meeting notes" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()), s("dragstart", a.getByRole("option", { name: "Research note" }).parentElement), s("drop", a.getByRole("option", { name: "Ideas" }).parentElement), await n(() => i(a.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "3")), s("dragstart", a.getByRole("option", { name: "Research note" }).parentElement), s("drop", a.getByRole("option", { name: "Notes" }).parentElement), await n(() => i(a.getByRole("option", { name: "Research note" })).toHaveAttribute("aria-level", "2"));
	}
}, v = {
	tags: ["motion"],
	render: () => /* @__PURE__ */ d(g, {}),
	parameters: { docs: { description: { story: "Drag Workspaces below expanded Notes. The placement line appears after the last visible descendant." } } },
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = a.getByRole("option", {
			name: "Workspaces",
			exact: !0
		}), s = a.getByRole("option", {
			name: "Notes",
			exact: !0
		}), c = o.getBoundingClientRect(), l = s.getBoundingClientRect(), u = c.left + c.width / 2;
		await r.pointer({
			target: o,
			keys: "[MouseLeft>]",
			coords: {
				clientX: u,
				clientY: c.top + 14
			}
		}), await r.pointer({
			target: o,
			coords: {
				clientX: u,
				clientY: c.top + 20
			}
		}), await r.pointer({
			target: s,
			coords: {
				clientX: u,
				clientY: l.bottom - 2
			}
		}), await n(() => i(t.querySelector("[data-tree-list-drop-indicator=\"after\"]")).toBeVisible()), await r.pointer({
			target: s,
			keys: "[/MouseLeft]",
			coords: {
				clientX: u,
				clientY: l.bottom - 2
			}
		});
	}
};
export { v as ExpandedNavigation, h as MovableFiles, _ as NotesInSortableNavigation, p as default };
