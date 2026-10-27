// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { g as i, h as a, t as o } from "./workbench-core-kaLFKJEn.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as c } from "./workbench-story-BezxAS71.ts";
import { Text as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/header/breadcrumb-actions.stories.tsx
var d = {
	kind: "page",
	extensionId: "storybook",
	id: "board"
}, f = {
	kind: "page",
	extensionId: "storybook",
	id: "ticket"
}, p = {
	type: "ticket",
	id: "PS-1",
	label: "PS-1 Fix header",
	extensionId: "storybook"
}, m = (e) => {
	let t = o({ startPage: d });
	return t.modes.registerMode({
		id: "project",
		label: "Project",
		activate: () => void 0
	}), t.views.registerView({
		id: "body",
		title: "Body",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ u(l, {
				p: "md",
				children: "Page body"
			})
		}
	}), t.pages.registerPage({
		id: "board",
		ref: d,
		title: "Board",
		path: "board",
		modeId: "project",
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "body"
			}
		},
		slots: []
	}), t.pages.registerPage({
		id: "ticket",
		parentId: "board",
		ref: f,
		path: "ticket",
		modeId: "project",
		resource: { kinds: [{
			kind: "resource-kind",
			id: "ticket"
		}] },
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "body"
			}
		},
		slots: e.contributed ? [{
			id: "panel",
			region: "main",
			item: {
				kind: "binding",
				binding: {
					kinds: [{
						kind: "resource-kind",
						id: "ticket"
					}],
					view: {
						kind: "view",
						id: "body"
					},
					cardinality: "one"
				}
			},
			tab: { getSnapshot: (e) => ({
				label: e.resource?.label,
				menu: [{
					id: "panel",
					rows: [{
						id: "details",
						label: "Panel details",
						action: {
							kind: "command",
							commandId: "panel-details"
						}
					}]
				}]
			}) }
		}] : []
	}), t.commands.registerCommand({
		id: "archive",
		label: "Archive",
		icon: "archive"
	}, { execute: () => void 0 }), t.layout.registerMenuItem(a("ticket"), { commandId: "archive" }), t.commands.registerCommand({
		id: "copy-link",
		label: "Copy link",
		icon: "link"
	}, { execute: () => void 0 }), t.layout.registerMenuItem(i, { commandId: "copy-link" }), t.pageLocations.setProject("storybook"), t.pageLocations.navigate({
		kind: "page",
		...e
	}), e.contributed && t.pages.openSlot({
		pageId: "ticket",
		slotId: "panel",
		resource: p
	}), t;
}, h = {
	title: "pstdio-workbench/Reference/Core API/Breadcrumb actions",
	component: c,
	parameters: { layout: "fullscreen" },
	render: (e) => /* @__PURE__ */ u(s, { children: /* @__PURE__ */ u(c, { ...e }) })
}, g = async () => (await t.findAllByRole("menuitem")).map((e) => e.textContent), _ = {
	args: { workbench: m({
		page: f,
		resource: p
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await e.click(await i.findByRole("button", { name: "Actions for PS-1 Fix header" })), await r(await g()).toEqual(["Archive", "Copy link"]);
	}
}, v = {
	args: { workbench: m({ page: d }) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await e.click(await i.findByRole("button", { name: "Page actions" })), await r(await g()).toEqual(["Copy link"]);
	}
}, y = {
	args: { workbench: m({
		page: f,
		resource: p,
		contributed: !0
	}) },
	play: async ({ canvasElement: t }) => {
		let i = n(t);
		await e.click(await i.findByRole("button", { name: "Actions for PS-1 Fix header" })), await r(await g()).toEqual([
			"Archive",
			"Panel details",
			"Copy link"
		]);
	}
};
export { y as ContributedPanelActions, v as PlainPage, _ as ResourcePage, h as default };
