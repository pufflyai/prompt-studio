// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { b as r, h as i, t as a } from "./workbench-core-N58OeDyx.ts";
import { t as o } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as s } from "./workbench-story-B6F8bQqu.ts";
import { Button as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/header/header-actions.stories.tsx
var p = {
	kind: "page",
	extensionId: "storybook",
	id: "library"
}, m = {
	type: "artifact",
	id: "prototype",
	extensionId: "storybook",
	projectId: "storybook"
}, h = (e) => e.navigation.openTarget({
	kind: "panel",
	panel: {
		kind: "page-slot",
		page: p,
		id: "artifact"
	},
	resource: m,
	open: "pin"
}), g = () => {
	let e = a({ startPage: p });
	return e.modes.registerMode({
		id: "project",
		label: "Project",
		activate: () => void 0
	}), e.views.registerView({
		id: "library",
		title: "Library",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ d(u, {
				p: "md",
				children: "Library and artifact tabs share the same view."
			})
		}
	}), e.pages.registerPage({
		id: "library",
		ref: p,
		path: "library",
		modeId: "project",
		main: {
			kind: "panels",
			empty: {
				kind: "view",
				id: "library"
			}
		},
		slots: [{
			id: "library",
			region: "main",
			item: {
				kind: "view",
				view: {
					kind: "view",
					id: "library"
				},
				presence: "fixed"
			}
		}, {
			id: "artifact",
			region: "main",
			tab: { getSnapshot: () => ({ label: "Preview" }) },
			item: {
				kind: "binding",
				binding: {
					kinds: [{
						kind: "resource-kind",
						id: "artifact"
					}],
					view: {
						kind: "view",
						id: "library"
					},
					cardinality: "many"
				}
			}
		}]
	}), e.commands.registerCommand({
		id: "publish-artifact",
		label: "Publish artifact"
	}, {
		execute: () => void 0,
		isVisible: () => !!e.getActiveResource()
	}), e.layout.registerMenuItem(r, {
		commandId: "publish-artifact",
		group: "primary"
	}), e.commands.registerCommand({
		id: "rename-artifact",
		label: "Rename artifact"
	}, { execute: () => void 0 }), e.layout.registerMenuItem(i("artifact"), { commandId: "rename-artifact" }), e.pageLocations.setProject("storybook"), e.pageLocations.navigate({
		kind: "page",
		page: p
	}), e;
}, _ = {
	title: "pstdio-workbench/Reference/Core API/Header actions",
	component: s,
	parameters: { layout: "fullscreen" }
}, v = {
	args: { workbench: g() },
	render: (e) => /* @__PURE__ */ d(o, { children: /* @__PURE__ */ f(l, {
		gap: "sm",
		children: [/* @__PURE__ */ d(c, {
			onClick: () => void h(e.workbench),
			children: "Open artifact tab"
		}), /* @__PURE__ */ d(s, { ...e })]
	}) }),
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await n(i.queryByRole("button", { name: "Publish artifact" })).toBeNull(), await e.click(i.getByRole("button", { name: "Open artifact tab" })), await n(await i.findByRole("button", { name: "Publish artifact" })).toBeVisible();
		let a = i.getAllByRole("tab", { name: "Library" })[0];
		await e.click(a), await n(i.queryByRole("button", { name: "Publish artifact" })).toBeNull();
	}
}, y = {
	...v,
	args: { workbench: g() },
	play: async ({ canvasElement: r }) => {
		let i = t(r);
		await e.click(i.getByRole("button", { name: "Open artifact tab" })), await e.click(await i.findByRole("button", { name: "Actions for prototype" })), await n(await t(document.body).findByRole("menuitem", { name: "Rename artifact" })).toBeVisible(), await e.keyboard("{Escape}"), await e.click(i.getAllByRole("tab", { name: "Library" })[0]), await n(i.queryByRole("button", { name: "Actions for prototype" })).toBeNull();
	}
};
export { y as BreadcrumbActionsForFocusedResource, v as FocusedResourceInLibrary, _ as default };
