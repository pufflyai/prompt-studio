// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./breadcrumb-view-BjIWEesp.ts";
import { t as a } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as o } from "react";
import { jsx as s } from "react/jsx-runtime";
var c = {
	title: "pstdio-workbench/Guides/Document breadcrumb",
	component: () => {
		let [e] = o(() => {
			let e = r(), t = (e) => ({
				kind: "page",
				extensionId: "story",
				id: e
			}), n = {
				type: "ticket",
				id: "one",
				label: "PS-1"
			}, i = {
				...n,
				metadata: { document: "brief" }
			};
			e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.resources.registerKind({
				kind: "ticket",
				label: "Ticket"
			}), e.views.registerView({
				id: "editor",
				title: "Editor",
				body: {
					kind: "react",
					render: () => null
				}
			}), e.commands.registerCommand({
				id: "edit-document",
				label: "Document controls"
			}, { execute() {} }), e.pages.registerPage({
				id: "tickets",
				ref: t("tickets"),
				title: "Tickets",
				path: "tickets",
				modeId: "project",
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: "editor"
					},
					cardinality: "one"
				},
				slots: []
			});
			for (let n of ["ticket", "document"]) e.pages.registerPage({
				id: n,
				ref: t(n),
				title: n === "document" ? "Brief" : "Ticket",
				path: n,
				modeId: "project",
				parentId: n === "document" ? "ticket" : "tickets",
				resource: { kinds: [{
					kind: "resource-kind",
					id: "ticket"
				}] },
				...n === "document" ? { document: { metadataKey: "document" } } : {},
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: "editor"
					},
					cardinality: "one",
					tab: { getSnapshot: () => ({ menu: [{
						id: "document",
						rows: [{
							id: "controls",
							label: "Document controls",
							action: {
								kind: "command",
								commandId: "edit-document"
							}
						}]
					}] }) }
				},
				slots: []
			});
			return e.pageLocations.setProject("story"), e.pageLocations.navigate({
				kind: "page",
				page: t("document"),
				resource: i,
				parent: {
					kind: "page",
					page: t("ticket"),
					resource: n
				}
			}), e;
		});
		return /* @__PURE__ */ s(a, { children: /* @__PURE__ */ s(i, { workbench: e }) });
	}
}, l = { play: async ({ canvasElement: r }) => {
	let i = t(r), a = t(r.ownerDocument.body);
	await e.pointer({
		target: i.getByText("PS-1", { exact: !0 }),
		keys: "[MouseRight]"
	}), await n(a.queryByRole("menuitem", { name: "Document controls" })).not.toBeInTheDocument(), await e.keyboard("{Escape}"), await e.pointer({
		target: i.getByText("Brief", { exact: !0 }),
		keys: "[MouseRight]"
	}), await n(await a.findByRole("menuitem", { name: "Document controls" })).toBeVisible();
} };
export { l as ParentResourceAndDocument, c as default };
