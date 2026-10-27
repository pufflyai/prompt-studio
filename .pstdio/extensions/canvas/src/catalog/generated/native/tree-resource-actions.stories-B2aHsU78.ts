// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, n as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { h as a, t as o } from "./workbench-core-N58OeDyx.ts";
import { t as s } from "./workbench-story-B6F8bQqu.ts";
import { useState as c } from "react";
import { Box as l, Text as u } from "@chakra-ui/react";
import { jsx as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-resource-actions-story.tsx
var f = (e) => {
	let t = {
		extensionId: "storybook",
		kind: "page",
		id: `tree-actions-${e}`
	}, n = o({ startPage: t }), r = {
		type: "ticket",
		id: "ticket",
		label: "Write notes"
	}, i = {
		type: "session",
		id: "inactive-session",
		label: "Inactive session"
	}, s = {
		type: "workspace",
		id: "workspace",
		label: "Review workspace"
	};
	n.modes.registerMode({
		id: "tree-actions",
		label: "Tree actions",
		activate: () => void 0
	}), n.commands.registerCommand({
		id: "session.inspect",
		label: "Inspect session",
		icon: "MessageCircle"
	}, { execute: (e, t) => n.notifications.show({
		title: `Inspected ${t?.resource?.label}`,
		level: "success"
	}) }), n.commands.registerCommand({
		id: "ticket.archive",
		label: "Archive ticket",
		icon: "Archive"
	}, { execute: (e, t) => n.notifications.show({
		title: `Archived ${t?.resource?.label}`,
		level: "success"
	}) }), n.commands.registerCommand({
		id: "workspace.archive",
		label: "Archive workspace",
		icon: "Archive"
	}, { execute: (e, t) => n.notifications.show({
		title: `Archived ${t?.resource?.label}`,
		level: "success"
	}) }), n.commands.registerCommand({
		id: "workspace.delete",
		label: "Delete workspace",
		icon: "Trash"
	}, {
		execute: () => void 0,
		isEnabled: () => !1
	});
	for (let [e, t] of [
		["ticket", "ticket.archive"],
		["session", "session.inspect"],
		["workspace", "workspace.archive"],
		["workspace", "workspace.delete"]
	]) n.layout.registerMenuItem(a(e), { commandId: t });
	let c = [{
		id: "resources",
		label: "Resources",
		canHide: !0,
		nodes: [
			{
				id: "session",
				label: i.label,
				icon: "MessageCircle",
				resource: i
			},
			{
				id: "ticket",
				label: r.label,
				icon: "Component",
				resource: r
			},
			{
				id: "file",
				label: "notes.md",
				icon: "FileText",
				tooltip: "docs/notes.md",
				contextMenuActions: [{
					id: "rename",
					label: "Rename",
					icon: "Pencil",
					args: { name: "notes.md" },
					params: { name: {
						type: "text",
						label: "File name",
						required: !0
					} },
					submitLabel: "Save",
					run: (e) => {
						let t = e.name;
						n.notifications.show({
							title: `Renamed notes.md to ${t}`,
							level: "success"
						});
					}
				}, {
					id: "delete",
					label: "Delete",
					icon: "Trash",
					run: () => void 0
				}]
			},
			{
				id: "workspace",
				label: s.label,
				icon: "GitBranch",
				resource: s
			},
			{
				id: "placeholder",
				label: "No sessions",
				disabled: !0,
				rowVariant: "empty-state"
			}
		]
	}];
	return n.views.registerView({
		id: "tree-resource-actions",
		title: "Resource tree",
		body: {
			kind: "tree",
			defaultExpandedSectionIds: ["resources"],
			getBody: () => c,
			getChildren: () => []
		}
	}), n.views.registerView({
		id: "tree-actions-guide",
		title: "Tree actions",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ d(l, {
				p: "md",
				children: /* @__PURE__ */ d(u, { children: "Hover the file to see its path. Right-click a ticket, file, or workspace. Right-click the Sidenav background to customize the tree." })
			})
		}
	}), n.pages.registerPage({
		id: "tree-actions",
		ref: t,
		title: "Tree actions",
		modeId: "tree-actions",
		path: `tree-actions-${e}`,
		main: {
			kind: "view",
			view: {
				kind: "view",
				id: e === "main" ? "tree-resource-actions" : "tree-actions-guide"
			},
			cardinality: "one"
		},
		slots: []
	}), e === "sidenav" && n.modePlacements.registerPlacement({
		id: "tree-resource-actions",
		ref: {
			extensionId: "storybook",
			kind: "placement",
			id: "tree-resource-actions"
		},
		modeId: "tree-actions",
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: "tree-resource-actions"
			},
			presence: "fixed"
		},
		region: "sidenav"
	}), n.pageLocations.switchProject(`tree-resource-actions-${e}`), n;
}, p = {
	title: "pstdio-workbench/Guides/Tree resource actions",
	component: (e) => {
		let { region: t } = e, [n] = c(() => f(t));
		return /* @__PURE__ */ d(s, { workbench: n });
	},
	parameters: { layout: "fullscreen" }
}, m = async (a) => {
	let o = r(a), s = r(a.ownerDocument.body);
	(await o.findByRole("option", { name: "Inactive session" })).focus(), await e.keyboard("{Shift>}{F10}{/Shift}"), await n(() => i(s.getByRole("menuitem", { name: "Inspect session" })).toBeVisible()), await e.click(s.getByRole("menuitem", { name: "Inspect session" })), await n(() => i(s.getByText("Inspected Inactive session")).toBeVisible()), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument());
	let c = await o.findByRole("option", { name: /Write notes/ });
	await t.contextMenu(c), await n(() => i(s.getByRole("menuitem", { name: "Archive ticket" })).toBeVisible()), await i(s.getAllByRole("menu")).toHaveLength(1), await n(() => i(s.getByRole("menu")).toHaveFocus()), await e.keyboard("{Escape}"), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument());
	let l = o.getByRole("option", { name: /notes.md/ });
	await e.hover(r(l).getByText("notes.md")), await n(() => i(s.getByRole("tooltip", { name: "docs/notes.md" })).toBeVisible()), await e.unhover(r(l).getByText("notes.md")), await t.contextMenu(l), await e.click(await s.findByRole("menuitem", { name: "Rename" }));
	let u = await s.findByRole("dialog"), d = r(u).getByRole("textbox");
	await e.clear(d), await e.type(d, "summary.md"), await e.click(r(u).getByRole("button", { name: "Save" })), await n(() => i(s.getByText("Renamed notes.md to summary.md")).toBeVisible()), await t.contextMenu(o.getByRole("option", { name: /Review workspace/ })), await n(() => i(s.getByRole("menuitem", { name: "Archive workspace" })).toBeVisible()), await i(s.getByRole("menuitem", { name: "Delete workspace" })).toHaveAttribute("data-disabled"), await i(s.queryByRole("menuitem", { name: "Archive ticket" })).not.toBeInTheDocument(), await n(() => i(s.getByRole("menu")).toHaveFocus()), await e.keyboard("{Escape}"), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument());
}, h = {
	args: { region: "sidenav" },
	play: async ({ canvasElement: a }) => {
		await m(a);
		let o = a.querySelector("[data-workbench-region=\"sidenav\"]");
		if (!o) throw Error("Sidenav is missing.");
		await t.contextMenu(o);
		let s = r(a.ownerDocument.body);
		await e.click(await s.findByRole("menuitem", { name: "Hide/show items" })), await n(() => i(s.getByRole("menuitem", { name: /Resources/ })).toBeVisible()), await i(s.queryByRole("menuitem", { name: "Archive workspace" })).not.toBeInTheDocument(), await n(() => i(s.getByRole("menu", { name: "Hide/show items" })).toHaveFocus()), await e.keyboard("{Escape}"), await n(() => i(s.queryByRole("menu")).not.toBeInTheDocument());
	}
}, g = {
	args: { region: "main" },
	play: async ({ canvasElement: e }) => m(e)
};
export { h as Sidenav, g as Standalone, p as default };
