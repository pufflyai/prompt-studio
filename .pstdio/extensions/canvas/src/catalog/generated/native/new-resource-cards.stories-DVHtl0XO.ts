// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-story-B6F8bQqu.ts";
import { useState as a } from "react";
import { Text as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/region/new-resource-cards.stories.tsx
var c = () => {
	let e = r(), t = {
		kind: "page",
		extensionId: "example",
		id: "notes"
	};
	e.modes.registerMode({
		id: "project",
		activate() {}
	}), e.views.registerView({
		id: "note",
		title: "Note",
		icon: "FileText",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ s(o, {
				p: "md",
				children: "Note content"
			})
		}
	}), e.views.registerView({
		id: "terminal",
		title: "Terminal",
		body: {
			kind: "react",
			render: () => null
		}
	}), e.shellPlacements.registerPlacement({
		id: "terminal",
		region: "side",
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: "terminal"
			},
			presence: "closed"
		}
	});
	let n = 0;
	return e.commands.registerCommand({
		id: "create-note",
		label: "New note",
		icon: "FilePlus"
	}, { execute: () => {
		n += 1, e.pages.openSlot({
			pageId: "notes",
			slotId: "note",
			resource: {
				type: "note",
				id: String(n),
				label: `Note ${n}`
			},
			open: "pin"
		});
	} }), e.pages.registerPage({
		id: "notes",
		ref: t,
		path: "notes",
		modeId: "project",
		main: { kind: "panels" },
		slots: [{
			id: "note",
			region: "main",
			addableIn: ["main"],
			item: {
				kind: "binding",
				binding: {
					kinds: [{
						kind: "resource-kind",
						id: "note"
					}],
					view: {
						kind: "view",
						id: "note"
					},
					cardinality: "many",
					add: {
						kind: "command",
						target: { command: {
							kind: "command",
							id: "create-note"
						} }
					}
				}
			}
		}]
	}), e.pageLocations.setProject("storybook-notes"), e.pageLocations.navigate({
		kind: "page",
		page: t
	}), e;
}, l = () => {
	let [e] = a(c);
	return /* @__PURE__ */ s(i, { workbench: e });
}, u = {
	title: "pstdio-workbench/Reference/Core API/New resource cards",
	component: l,
	parameters: { layout: "fullscreen" },
	tags: ["new-resource-cards"]
}, d = {
	render: () => /* @__PURE__ */ s(l, {}),
	play: async ({ canvasElement: r }) => {
		let i = t(r.querySelector("[data-workbench-panel=\"main\"]")), a = t(await i.findByRole("group", { name: "Available tabs" }));
		await e.click(a.getByRole("button", { name: "New note" })), await n(await i.findByRole("tab", { name: "Note 1" })).toBeVisible(), await e.click(i.getByRole("button", { name: "Add panel" }));
		let o = t(document.body);
		await e.click(await o.findByRole("menuitem", { name: "New note" })), await n(await i.findByRole("tab", { name: "Note 2" })).toHaveAttribute("aria-selected", "true"), await n(i.getByRole("tab", { name: "Note 1" })).toBeVisible();
	}
};
export { d as CreateFromCardAndMenu, u as default };
