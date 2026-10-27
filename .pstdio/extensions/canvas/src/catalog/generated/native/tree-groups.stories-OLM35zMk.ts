// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, n as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { t as o } from "./workbench-story-BezxAS71.ts";
import { useState as s } from "react";
import { Text as c } from "@chakra-ui/react";
import { HostStorageProvider as l } from "@pstdio/ui";
import { jsx as u } from "react/jsx-runtime";
var d = {
	title: "pstdio-workbench/Guides/Tree groups",
	component: (e) => {
		let { counts: t, chrome: n } = e, [r] = s(() => {
			let e = /* @__PURE__ */ new Map(), r = {
				getItem: (t) => e.get(t) ?? null,
				setItem: (t, n) => void e.set(t, n)
			}, i = a();
			return i.modes.registerMode({
				id: "project",
				label: "Project",
				chrome: n ? { sidenav: "group-navigation" } : void 0,
				activate: () => void 0
			}), i.views.registerView({
				id: "group-navigation",
				title: "Navigation",
				body: {
					kind: "tree",
					canMove: ({ source: e, destination: t }) => e.moveScope === t.moveScope,
					getHeader: () => [{
						id: "header",
						moveScope: "project",
						nodes: [{
							id: "search",
							label: "Search",
							canHide: !0
						}]
					}],
					getBody: () => [{
						id: "navigation",
						moveScope: "project",
						nodes: [{
							id: "tickets",
							label: "Tickets",
							canHide: !0
						}, ...t ? [{
							id: "requests",
							label: "Review requests",
							icon: "message-circle-warning",
							badge: {
								label: "3",
								color: "orange"
							}
						}, {
							id: "resolved",
							label: "Resolved requests",
							icon: "message-circle-warning",
							badge: {
								label: "3",
								color: "green"
							}
						}] : []]
					}],
					getChildren: () => []
				}
			}), i.views.registerView({
				id: "group-guide",
				title: "Tree groups",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ u(c, {
						p: "md",
						children: "Right-click the Sidenav to create a group. Drag rows into its header. Use the group menu to rename or remove it."
					})
				}
			}), i.pages.registerPage({
				id: "groups",
				ref: {
					kind: "page",
					id: "groups",
					extensionId: "storybook"
				},
				title: "Tree groups",
				path: "groups",
				modeId: "project",
				main: {
					kind: "view",
					view: {
						kind: "view",
						id: "group-guide"
					},
					cardinality: "one"
				},
				slots: []
			}), i.shellPlacements.registerPlacement({
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
			}), i.pageLocations.setProject("tree-groups"), i.pageLocations.navigate({
				kind: "page",
				page: {
					kind: "page",
					id: "groups",
					extensionId: "storybook"
				}
			}), {
				workbench: i,
				storage: r
			};
		});
		return /* @__PURE__ */ u(l, {
			storage: r.storage,
			children: /* @__PURE__ */ u(o, { workbench: r.workbench })
		});
	},
	parameters: { layout: "fullscreen" },
	tags: ["tree-groups"]
}, f = {}, p = { args: { counts: !0 } }, m = { play: async ({ canvasElement: n }) => {
	let a = r(n), o = r(n.ownerDocument.body);
	t.contextMenu(await a.findByRole("option", { name: "Search" })), await e.click(await o.findByRole("menuitem", { name: "New group" })), await e.type(await a.findByRole("textbox", { name: "Group name" }), "Research{Enter}"), t.contextMenu(await a.findByText("Research")), await e.click(await o.findByRole("menuitem", { name: "Rename group" }));
	let s = await a.findByRole("textbox", { name: "Group name" });
	await e.clear(s), await e.type(s, "Product research{Enter}"), await i(a.getByText("Product research")).toBeVisible();
	let c = a.getByText("Product research").closest("[aria-expanded]");
	await i(c).toHaveAttribute("aria-expanded", "false"), await e.click(a.getByText("Product research")), await i(c).toHaveAttribute("aria-expanded", "true"), await e.click(a.getByText("Product research")), await i(c).toHaveAttribute("aria-expanded", "false");
} }, h = {
	args: { chrome: !0 },
	play: m.play
}, g = { play: async ({ canvasElement: a }) => {
	let o = r(a), s = r(a.ownerDocument.body);
	for (let n of ["Research", "Product"]) t.contextMenu(await o.findByRole("option", { name: "Search" })), await e.click(await s.findByRole("menuitem", { name: "New group" })), await e.type(await o.findByRole("textbox", { name: "Group name" }), `${n}{Enter}`);
	let c = o.getByText("Product", { exact: !0 }), l = o.getByText("Research", { exact: !0 }), u = c.getBoundingClientRect(), d = l.getBoundingClientRect(), f = u.x + u.width / 2, p = u.y + u.height / 2, m = e.setup();
	await m.pointer([
		{
			target: c,
			keys: "[MouseLeft>]",
			coords: {
				clientX: f,
				clientY: p
			}
		},
		{
			target: c,
			coords: {
				clientX: f,
				clientY: p - 8
			}
		},
		{
			target: l,
			coords: {
				clientX: f,
				clientY: d.y
			}
		}
	]), await i(a.querySelector("[data-panel-dragging]")).toBeNull(), await i(a.querySelector("[data-workbench-edge-drop]")).toBeNull(), await m.pointer({
		target: l,
		keys: "[/MouseLeft]",
		coords: {
			clientX: f,
			clientY: d.y
		}
	}), await n(() => i(c.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy());
} };
export { p as CountBadges, m as CreateAndRename, f as Default, h as ModeChromeGroups, g as ReorderGroups, d as default };
