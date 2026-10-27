// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-story-B6F8bQqu.ts";
// packages/pstdio-workbench/src/react/breadcrumb/page-context.stories.tsx
var o = (e = !1, t = !1) => {
	let n = {
		kind: "page",
		extensionId: "storybook",
		id: "documents"
	}, r = i({
		startPage: n,
		initialSidePanelMode: "attached"
	});
	r.modes.registerMode({
		id: "project",
		activate: () => void 0
	}), r.resources.registerKind({
		kind: "note",
		label: "Note",
		icon: "file-text"
	}), r.views.registerView({
		id: "editor",
		title: "Editor",
		body: {
			kind: "react",
			render: () => null
		}
	}), r.pages.registerPage({
		id: n.id,
		ref: n,
		title: "Documents",
		path: "documents",
		modeId: "project",
		...e ? { resource: { kinds: [{
			kind: "resource-kind",
			id: "workspace"
		}] } } : {},
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "editor"
			}
		},
		slots: ["main", "side"].map((e) => ({
			id: e,
			region: e,
			item: t ? {
				kind: "view",
				view: {
					kind: "view",
					id: "editor"
				},
				presence: "open"
			} : {
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
			tab: { getSnapshot: () => ({
				...t ? { label: `${e} files` } : {},
				menu: [{
					id: "note",
					rows: [{
						id: e,
						label: `${e} document action`
					}]
				}]
			}) }
		}))
	}), r.pageLocations.setProject("storybook-context"), r.pageLocations.navigate({
		kind: "page",
		page: n,
		...e ? { resource: {
			type: "workspace",
			id: "workspace",
			label: "My workspace"
		} } : {}
	});
	for (let e of ["main", "side"]) t || r.pages.openSlot({
		pageId: n.id,
		slotId: e,
		resource: {
			type: "note",
			id: e,
			label: `${e} document`
		}
	});
	return r;
}, s = {
	title: "pstdio-workbench/Guides/Page context",
	component: a,
	parameters: { layout: "fullscreen" }
}, c = {
	args: { workbench: o() },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await e.click(await i.findByRole("tab", { name: "side document" }));
		let a = n(i.getByRole("navigation", { name: "breadcrumb" }));
		await r(a.getByText("main document", { exact: !0 })).toBeVisible(), await r(a.queryByText("side document", { exact: !0 })).not.toBeInTheDocument(), await e.click(i.getByRole("button", { name: "Actions for main document" })), await r(await n(t.ownerDocument.body).findByRole("menuitem", { name: "main document action" })).toBeVisible();
	}
}, l = {
	args: { workbench: o(!0) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		for (let t of ["main document", "side document"]) {
			await e.click(await i.findByRole("tab", { name: t }));
			let a = n(i.getByRole("navigation", { name: "breadcrumb" }));
			await r(a.getByText("My workspace", { exact: !0 })).toBeVisible(), await r(a.queryByText(t, { exact: !0 })).not.toBeInTheDocument();
		}
	}
}, u = {
	tags: ["breadcrumb-resource-ownership"],
	args: { workbench: o(!0, !0) },
	play: async ({ canvasElement: i }) => {
		let a = n(i);
		await r(a.getByRole("tab", { name: "main files" })).toBeVisible();
		let o = n(a.getByRole("navigation", { name: "breadcrumb" }));
		await r(o.getByText("My workspace", { exact: !0 })).toBeVisible(), await r(o.queryByText("main files", { exact: !0 })).toBeNull(), await e.click(a.getByRole("button", { name: "Actions for My workspace" }));
		let s = await n(i.ownerDocument.body).findByRole("menuitem", { name: "main document action" });
		await t(() => r(s).toBeVisible());
	}
}, d = {
	tags: ["!manifest", "page-composer-navigation"],
	args: { workbench: (() => {
		let e = i(), t = {
			kind: "page",
			extensionId: "storybook",
			id: "compose"
		};
		return e.modes.registerMode({
			id: "project",
			activate() {}
		}), e.views.registerView({
			id: "compose",
			title: "Compose",
			body: {
				kind: "react",
				render: () => null
			}
		}), e.pages.registerPage({
			id: "compose",
			ref: t,
			title: "Messages",
			path: "messages",
			modeId: "project",
			main: {
				kind: "view",
				presentation: "page",
				cardinality: "one",
				view: {
					kind: "view",
					id: "compose"
				},
				tab: { getSnapshot: () => ({
					label: "New message",
					menu: [{
						id: "compose",
						rows: [{
							id: "open",
							label: "Open message",
							action: {
								kind: "navigation",
								target: {
									kind: "viewer",
									operation: "switch",
									page: {
										...t,
										id: "message"
									},
									resource: {
										type: "message",
										id: "one",
										label: "Message one"
									}
								}
							}
						}]
					}]
				}) }
			},
			slots: []
		}), e.pages.registerPage({
			id: "message",
			ref: {
				...t,
				id: "message"
			},
			title: "Message",
			path: "messages/:resourceId",
			modeId: "project",
			parentId: "compose",
			resource: { kinds: [{
				kind: "resource-kind",
				id: "message"
			}] },
			main: {
				kind: "view",
				presentation: "page",
				cardinality: "one",
				view: {
					kind: "view",
					id: "compose"
				}
			},
			slots: []
		}), e.pageLocations.setProject("storybook-composer"), e.pageLocations.navigate({
			kind: "page",
			page: t
		}), e;
	})() },
	play: async ({ canvasElement: t }) => {
		let i = n(t), a = n(i.getByRole("navigation", { name: "breadcrumb" }));
		await r(a.getByText("Messages", { exact: !0 })).toBeVisible(), await r(a.getByText("New message", { exact: !0 })).toBeVisible(), await e.click(i.getByRole("button", { name: "Page actions" })), await e.click(await n(t.ownerDocument.body).findByRole("menuitem", { name: "Open message" })), await r(a.getByText("Messages", { exact: !0 })).toBeVisible(), await r(await a.findByText("Message one", { exact: !0 })).toBeVisible();
	}
};
export { c as CollectionDocument, d as PageComposer, u as RoutedContextView, l as RoutedResource, s as default };
