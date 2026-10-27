// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { h as i, t as a } from "./workbench-core-kaLFKJEn.ts";
import { n as o } from "./palette-params-dialog-2JtYNQ7b.ts";
import { n as s, t as c } from "./use-tab-context-menu-DObEI0YB.ts";
import { t as l } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useId as u, useState as d } from "react";
import { Button as f, Input as p, Stack as m, Text as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
var v = {
	title: "pstdio-workbench/Guides/Tab actions",
	component: () => {
		let [e, t] = d("No action run"), n = u(), { menu: r, show: l, onContextMenu: v } = c(n), [y] = d(() => {
			let e = a(), n = {
				type: "text",
				label: "Note",
				required: !0,
				resolvedFrom: "resource"
			};
			return e.commands.registerCommand({
				id: "rename",
				label: "Rename note",
				params: {
					noteId: n,
					title: {
						type: "text",
						label: "Title",
						required: !0
					}
				}
			}, { execute: (e) => {
				let { noteId: n, title: r } = e;
				t(`Renamed ${n} to ${r}`);
			} }), e.commands.registerCommand({
				id: "delete",
				label: "Delete",
				params: { noteId: n }
			}, { execute: (e) => t(`Deleted ${e.noteId}`) }), e.resources.registerKind({
				kind: "note",
				label: "Note"
			}), e.layout.registerMenuItem(i("note"), {
				commandId: "rename",
				args: { title: "Existing title" }
			}), e.layout.registerMenuItem(i("note"), { commandId: "delete" }), e;
		});
		return /* @__PURE__ */ _(m, { children: [
			/* @__PURE__ */ g(f, {
				id: n,
				onClick: (e) => l(e.currentTarget),
				onContextMenu: v,
				children: "Note actions"
			}),
			/* @__PURE__ */ g(h, { children: e }),
			/* @__PURE__ */ g(p, {
				"aria-label": "Draft outside the menu",
				placeholder: "Keep focus here when dismissing the menu"
			}),
			/* @__PURE__ */ g(s, {
				menu: r,
				label: "Note",
				workbench: y,
				placement: {
					widgetId: "note-1",
					contributionId: "note-slot",
					resource: {
						type: "note",
						id: "note-1",
						label: "Existing title"
					}
				},
				groups: []
			}),
			/* @__PURE__ */ g(o, { workbench: y })
		] });
	},
	tags: ["!manifest"],
	decorators: [(e) => /* @__PURE__ */ g(l, { children: /* @__PURE__ */ g(e, {}) })]
}, y = { play: async ({ canvasElement: i }) => {
	let a = n(i), o = n(document.body);
	await e.click(a.getByRole("button", { name: "Note actions" })), await o.findByRole("menuitem", { name: "Rename note" }), await e.keyboard("{Home}{Enter}");
	let s = await o.findByRole("dialog", { name: "Rename note" }), c = n(s).getByRole("textbox", { name: "Title" });
	await r(c).toHaveValue("Existing title"), await e.clear(c), await e.type(c, "New title"), await e.click(n(s).getByRole("button", { name: "Run" })), await t(() => r(a.getByText("Renamed note-1 to New title")).toBeVisible()), await t(() => r(o.queryByRole("dialog", { hidden: !0 })).not.toBeInTheDocument()), await e.click(a.getByRole("button", { name: "Note actions" })), await e.click(await o.findByRole("menuitem", { name: "Delete" })), await t(() => r(a.getByText("Deleted note-1")).toBeVisible()), await r(o.queryByRole("dialog")).not.toBeInTheDocument(), await e.click(a.getByRole("button", { name: "Note actions" })), await o.findByRole("menuitem", { name: "Delete" });
	let l = a.getByRole("textbox", { name: "Draft outside the menu" });
	await e.click(l), await t(() => r(o.queryByRole("menu")).not.toBeInTheDocument()), await r(l).toHaveFocus();
} };
export { y as EditableTitleAndBoundResource, v as default };
