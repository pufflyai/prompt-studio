// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./workbench-BbqJVWhj.ts";
import { t as a } from "./commands-Bp5w85f4.ts";
import { n as o } from "./workspace-navigation-yctjVTFm.ts";
import { useState as s } from "react";
import { Box as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
var u = {
	title: "Dashboard/Workspace navigation",
	component: (e) => {
		let { providers: t } = e, [n] = s(() => {
			let e = {
				kind: "page",
				extensionId: "storybook",
				id: "workspace-navigation"
			}, n = r({ startPage: e });
			n.modes.registerMode({
				id: "workspace-navigation",
				label: "Workspaces",
				activate: () => void 0
			});
			for (let [e, t] of [[a.openWorkspaces, "Open workspaces"], [a.createWorkspace, "New workspace"]]) n.commands.registerCommand({
				id: e,
				label: t
			}, { execute: () => void 0 });
			return n.views.registerView({
				id: "workspace-navigation",
				title: "Workspace navigation",
				body: {
					kind: "tree",
					getBody: () => [{
						id: "navigation.root",
						nodes: [{
							...o(t),
							hiddenByDefault: !1
						}]
					}],
					getChildren: () => []
				}
			}), n.pages.registerPage({
				id: e.id,
				ref: e,
				title: "Workspace navigation",
				path: "workspace-navigation",
				modeId: "workspace-navigation",
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: "workspace-navigation"
					},
					cardinality: "one"
				},
				slots: []
			}), n.pageLocations.switchProject("storybook-workspace-navigation"), n.pageLocations.navigate({
				kind: "page",
				page: e
			}), n;
		});
		return /* @__PURE__ */ l(c, {
			h: "100dvh",
			children: /* @__PURE__ */ l(i, { workbench: n })
		});
	},
	parameters: { layout: "fullscreen" }
}, d = {
	args: { providers: [] },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.hover(await i.findByRole("option", { name: /^Workspaces$/ })), await n(i.queryByRole("button", { name: "New workspace" })).toBeNull();
	}
}, f = {
	args: { providers: [{
		id: "pstdio.worktree",
		label: "Git worktree",
		params: {}
	}] },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.hover(await i.findByRole("option", { name: /^Workspaces/ })), await n(i.getByRole("button", { name: "New workspace" })).toBeVisible();
	}
}, p = {
	...f,
	args: { providers: [{
		id: "example.cloud",
		label: "Cloud workspace",
		params: {}
	}] }
};
export { p as CloudProvider, f as GitProvider, d as NoCreationProviders, u as default };
