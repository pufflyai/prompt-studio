// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-resource-mutation-fSotiWIh.ts";
import { t as o } from "./breadcrumb-view-24j_45nw.ts";
import { n as s } from "./palette-params-dialog-2JtYNQ7b.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useRef as l, useState as u } from "react";
import { Button as d, Stack as f, Text as p } from "@chakra-ui/react";
import { jsx as m, jsxs as h } from "react/jsx-runtime";
var g = {
	title: "pstdio-workbench/Guides/Breadcrumb resource actions",
	component: (e) => {
		let { optimistic: t = !1 } = e, n = l(void 0), r = () => t ? new Promise((e, t) => n.current = {
			resolve: e,
			reject: t
		}) : Promise.resolve(), [c, g] = u("No action run"), [_] = u(() => {
			let e = {
				kind: "page",
				extensionId: "storybook",
				id: "notes"
			}, n = i({ startPage: e }), o = /* @__PURE__ */ new Set(), s = "Research note", c = {
				type: "note",
				id: "note-1",
				label: s,
				projectId: "storybook-notes",
				extensionId: "storybook"
			}, l = (e) => e === "rename" ? {
				kind: e,
				resourceType: "note",
				idParam: "noteId",
				labelParam: "title"
			} : {
				kind: e,
				resourceType: "note",
				idParam: "noteId"
			}, u = (e, r, i) => t ? a({
				workbench: n,
				projectId: "storybook-notes",
				executeCommand: () => void 0
			}, {
				id: e,
				title: e === "remove" ? "Delete note" : "Rename note",
				extensionId: "storybook",
				resourceMutation: l(e)
			}, r, void 0, i) : i(), d = {
				type: "text",
				label: "Note",
				required: !0,
				resolvedFrom: "resource"
			};
			return n.modes.registerMode({
				id: "project",
				activate: () => void 0
			}), n.resources.registerKind({
				kind: "note",
				label: "Note",
				icon: "file-text"
			}), n.views.registerView({
				id: "editor",
				title: "Editor",
				body: {
					kind: "react",
					render: () => null
				}
			}), n.commands.registerCommand({
				id: "rename",
				label: "Rename note",
				resourceMutation: t ? l("rename") : void 0,
				params: {
					noteId: d,
					title: {
						type: "text",
						label: "Title",
						required: !0
					}
				}
			}, { execute: (e) => u("rename", e, async () => {
				await r(), s = e.title;
				for (let e of o) e();
				g(`Renamed ${e.noteId}`);
			}) }), n.commands.registerCommand({
				id: "delete",
				label: "Delete",
				params: { noteId: d },
				resourceMutation: t ? l("remove") : void 0
			}, { execute: (e) => u("remove", e, async () => {
				await r();
				let t = n.layout.getLayout().regions.main.widgets.find((e) => e.resource?.id === c.id);
				t?.placementIdentity && n.closePlacement(t.placementIdentity), g(`Deleted ${e.noteId}`);
			}) }), n.pages.registerPage({
				id: e.id,
				ref: e,
				title: "Notes",
				icon: "notebook-pen",
				path: "notes",
				modeId: "project",
				main: {
					kind: "panels",
					empty: {
						kind: "view",
						id: "editor"
					}
				},
				slots: [{
					id: "note",
					region: "main",
					item: {
						kind: "binding",
						binding: {
							kinds: [{
								kind: "resource-kind",
								id: "note"
							}],
							view: {
								kind: "view",
								id: "editor"
							},
							cardinality: "many"
						}
					},
					tab: {
						subscribe: (e) => (o.add(e), () => o.delete(e)),
						getSnapshot: () => ({
							label: s,
							menu: [{
								id: "note",
								rows: [{
									id: "rename",
									label: "Rename note",
									icon: "pencil",
									action: {
										kind: "navigation",
										target: {
											kind: "command",
											commandId: "rename",
											args: {
												noteId: c.id,
												title: s
											}
										}
									}
								}, {
									id: "delete",
									label: "Delete",
									icon: "trash",
									action: {
										kind: "navigation",
										target: {
											kind: "command",
											commandId: "delete",
											args: { noteId: c.id }
										}
									}
								}]
							}]
						})
					}
				}]
			}), n.pageLocations.setProject("storybook-notes"), n.pageLocations.navigate({
				kind: "page",
				page: e
			}), n.pages.openSlot({
				pageId: e.id,
				slotId: "note",
				resource: c
			}), n;
		});
		return /* @__PURE__ */ h(f, { children: [
			/* @__PURE__ */ m(o, { workbench: _ }),
			/* @__PURE__ */ m(p, { children: c }),
			t ? /* @__PURE__ */ h(f, {
				direction: "row",
				children: [/* @__PURE__ */ m(d, {
					onClick: () => {
						n.current?.resolve(), n.current = void 0;
					},
					children: "Finish save"
				}), /* @__PURE__ */ m(d, {
					onClick: () => {
						n.current?.reject(/* @__PURE__ */ Error("Save failed")), n.current = void 0;
					},
					children: "Fail save"
				})]
			}) : null,
			/* @__PURE__ */ m(s, { workbench: _ })
		] });
	},
	decorators: [(e) => /* @__PURE__ */ m(c, { children: /* @__PURE__ */ m(e, {}) })]
}, _ = { play: async ({ canvasElement: t }) => {
	let i = n(t), a = n(t.ownerDocument.body);
	await r(i.getByText("Notes", { exact: !0 })).toBeVisible(), await e.click(i.getByText("Research note", { exact: !0 })), await e.keyboard("{Shift>}{F10}{/Shift}"), await a.findByRole("menuitem", { name: "Rename note" }), await e.keyboard("{Home}{Enter}");
	let o = await a.findByRole("textbox", { name: /Title/ });
	await r(o).toHaveValue("Research note"), await e.clear(o), await e.type(o, "Renamed note"), await e.click(a.getByRole("button", { name: /^Run$/ })), await r(await i.findByText("Renamed note", { exact: !0 })).toBeVisible(), await r(i.getByText("Renamed note-1", { exact: !0 })).toBeVisible(), await e.click(i.getByText("Renamed note", { exact: !0 })), await e.keyboard("{Shift>}{F10}{/Shift}"), await a.findByRole("menuitem", { name: /^Delete$/ }), await e.keyboard("{End}{Enter}"), await r(await i.findByText("Deleted note-1", { exact: !0 })).toBeVisible(), await r(i.queryByText("Renamed note", { exact: !0 })).not.toBeInTheDocument(), await r(i.getByText("Notes", { exact: !0 })).toBeVisible();
} }, v = {
	args: { optimistic: !0 },
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = n(i.ownerDocument.body);
		await e.click(a.getByText("Research note", { exact: !0 })), await e.keyboard("{Shift>}{F10}{/Shift}{Home}{Enter}");
		let s = await o.findByRole("textbox", { name: /Title/ });
		await e.clear(s), await e.type(s, "Instant title"), await e.click(o.getByRole("button", { name: /^Run$/ })), await r(await a.findByText("Instant title", { exact: !0 })).toBeVisible(), await r(a.getByText("No action run")).toBeVisible(), await t(() => r(o.queryByRole("dialog")).not.toBeInTheDocument()), await e.click(a.getByRole("button", { name: "Fail save" })), await r(await a.findByText("Research note", { exact: !0 })).toBeVisible(), await e.click(a.getByText("Research note", { exact: !0 })), await e.keyboard("{Shift>}{F10}{/Shift}{End}{Enter}"), await o.findByRole("button", { name: /^Delete$/ }), await r(a.getByText("Research note", { exact: !0 })).toBeVisible(), await e.click(o.getByRole("button", { name: /^Close$/ })), await r(a.getByText("Research note", { exact: !0 })).toBeVisible(), await e.click(a.getByText("Research note", { exact: !0 })), await e.keyboard("{Shift>}{F10}{/Shift}{End}{Enter}"), await e.click(await o.findByRole("button", { name: /^Delete$/ })), await t(() => r(a.queryByText("Research note", { exact: !0 })).not.toBeInTheDocument()), await r(a.getByText("No action run")).toBeVisible(), await e.click(a.getByRole("button", { name: "Fail save" })), await r(await a.findByText("Research note", { exact: !0 })).toBeVisible();
	}
};
export { v as OptimisticResourceActions, _ as SelectedNote, g as default };
