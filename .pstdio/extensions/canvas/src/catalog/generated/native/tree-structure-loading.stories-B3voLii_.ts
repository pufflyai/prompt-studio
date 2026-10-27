// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, n as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./workbench-story-B6F8bQqu.ts";
import { useState as o } from "react";
import { Button as s, Stack as c } from "@chakra-ui/react";
import { jsx as l } from "react/jsx-runtime";
var u = {
	title: "pstdio-workbench/Guides/Structure before contents",
	component: () => {
		let [e] = o(() => {
			let e = i(), t = Promise.withResolvers();
			return e.views.registerView({
				id: "navigation",
				title: "Navigation",
				body: {
					kind: "tree",
					defaultExpandedSectionIds: [
						"Files",
						"Workspaces",
						"Sessions"
					],
					getStructure: () => [{
						id: "ticket",
						nodes: [{
							id: "self",
							label: "T-1 Ticket"
						}]
					}, ...[
						"Files",
						"Workspaces",
						"Sessions"
					].map((e) => ({
						id: e,
						label: e,
						loading: !0,
						nodes: []
					}))],
					getBody: async () => (await t.promise, [{
						id: "Files",
						label: "Files",
						nodes: [{
							id: "readme",
							label: "README.md"
						}]
					}]),
					getChildren: () => []
				}
			}), e.views.registerView({
				id: "controls",
				title: "Controls",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ l(c, {
						p: "md",
						children: /* @__PURE__ */ l(s, {
							onClick: () => t.resolve(),
							children: "Complete fetch"
						})
					})
				}
			}), e.modes.registerMode({
				id: "project",
				activate() {}
			}), e.pages.registerPage({
				id: "ticket",
				ref: {
					kind: "page",
					id: "ticket",
					extensionId: "storybook"
				},
				title: "Ticket",
				path: "ticket",
				modeId: "project",
				slots: [],
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: "controls"
					},
					cardinality: "one"
				}
			}), e.shellPlacements.registerPlacement({
				id: "navigation",
				region: "sidenav",
				item: {
					kind: "view",
					presence: "fixed",
					view: {
						kind: "view",
						id: "navigation"
					}
				}
			}), e.pageLocations.setProject("project"), e.pageLocations.navigate({
				kind: "page",
				page: {
					kind: "page",
					id: "ticket",
					extensionId: "storybook"
				}
			}), e;
		});
		return /* @__PURE__ */ l(a, { workbench: e });
	},
	parameters: { layout: "fullscreen" }
}, d = { play: async ({ canvasElement: t }) => {
	let i = n(t);
	await r(await i.findByText("T-1 Ticket")).toBeVisible();
	for (let e of [
		"Files",
		"Workspaces",
		"Sessions"
	]) await r(i.getByText(e, { exact: !0 })).toBeVisible();
	await r(i.getAllByText("Loading…")).toHaveLength(3), await r(i.queryByText("No files")).not.toBeInTheDocument(), await e.click(await i.findByRole("button", { name: "Complete fetch" })), await r(await i.findByText("README.md")).toBeVisible(), await r(i.queryByText("Loading…")).not.toBeInTheDocument();
} }, f = () => {
	let [{ workbench: e, pending: t }] = o(() => {
		let e = i(), t = Promise.withResolvers(), n = {
			id: "navigation",
			nodes: [{
				id: "search",
				label: "Search",
				canHide: !0
			}]
		};
		return e.views.registerView({
			id: "group-navigation",
			title: "Group navigation",
			body: {
				kind: "tree",
				getStructure: () => [n],
				getChildren: () => [],
				getBody: async () => (await t.promise, [n, {
					id: "files",
					nodes: [{
						id: "folder",
						label: "Folder",
						collapsible: !0
					}]
				}])
			}
		}), e.shellPlacements.registerPlacement({
			id: "group-navigation",
			region: "sidenav",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: "group-navigation"
				}
			}
		}), e.pageLocations.setProject("groups-loading"), {
			workbench: e,
			pending: t
		};
	});
	return /* @__PURE__ */ l("div", {
		onContextMenuCapture: (e) => {
			e.target.textContent === "Research" && t.resolve();
		},
		children: /* @__PURE__ */ l(a, { workbench: e })
	});
}, p = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ l(f, {}),
	play: async ({ canvasElement: i }) => {
		let a = n(i), o = n(i.ownerDocument.body);
		t.contextMenu(await a.findByText("Search", { exact: !0 })), await e.click(await o.findByRole("menuitem", { name: "New group" }));
		let s = await a.findByRole("textbox", { name: "Group name" });
		await e.type(s, "Research{Enter}"), t.contextMenu(await a.findByText("Research", { exact: !0 })), await r(await a.findByText("Folder", { exact: !0 })).toBeVisible(), await e.click(await o.findByRole("menuitem", { name: "Rename group" }));
		let c = await a.findByRole("textbox", { name: "Group name" });
		await r(c).toHaveFocus(), await e.clear(c), await e.type(c, "Product research{Enter}"), await r(await a.findByText("Product research", { exact: !0 })).toBeVisible();
	}
};
export { p as GroupMenuWhileContentsArrive, d as PendingContents, u as default };
