// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./sliders-horizontal-0NDBIxRS.ts";
import { a as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { t as o } from "./workbench-story-BezxAS71.ts";
import { useState as s } from "react";
import { Input as c, Stack as l, Text as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/side-panel/side-panel.stories.tsx
var p = (e) => {
	let { detachable: t, bubbleIcon: n } = e, [r] = s(() => {
		let e = a({
			floatingPanels: t === !1 ? "hidden" : "visible",
			initialSidePanelMode: "closed"
		});
		return e.views.registerView({
			id: "side-panel.canvas",
			title: "Canvas",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ d(u, {
					p: "md",
					children: "Open the Side Panel to edit the object name."
				})
			}
		}), e.views.registerView({
			id: "side-panel.inspector",
			title: "Inspector",
			body: {
				kind: "react",
				render: () => /* @__PURE__ */ f(l, {
					p: "md",
					gap: "sm",
					children: [/* @__PURE__ */ d(u, { children: "Object name" }), /* @__PURE__ */ d(c, {
						"aria-label": "Object name",
						defaultValue: "Clay Study"
					})]
				})
			}
		}), e.shellPlacements.registerPlacement({
			id: "side-panel.canvas",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: "side-panel.canvas"
				}
			},
			region: "main"
		}), e.shellPlacements.registerPlacement({
			id: "side-panel.inspector",
			item: {
				kind: "view",
				presence: "fixed",
				view: {
					kind: "view",
					id: "side-panel.inspector"
				}
			},
			region: "side"
		}), e;
	});
	return /* @__PURE__ */ d(o, {
		workbench: r,
		sidePanelBubbleIcon: n
	});
}, m = {
	title: "pstdio-workbench/Reference/Core API/Side Panel",
	parameters: { layout: "fullscreen" },
	tags: ["autodocs"]
}, h = {
	parameters: { docs: { description: { story: "An attached-only panel opens from the navigation bar and has no bubble." } } },
	render: () => /* @__PURE__ */ d(p, { detachable: !1 })
}, g = {
	render: () => /* @__PURE__ */ d(p, {}),
	play: async ({ canvasElement: e }) => {
		let a = r(e.ownerDocument.body), o = await a.findByRole("button", { name: "Open Side Panel" });
		o.focus(), await t.keyboard("{Enter}");
		let s = await a.findByRole("dialog", { name: "Side Panel" });
		await n(() => i(o).not.toBeVisible()), await i(o.parentElement).toHaveAttribute("inert");
		let c = r(s).getByRole("textbox", { name: "Object name" });
		await t.clear(c), await t.type(c, "Terracotta"), await t.click(r(s).getByRole("button", { name: "Close Side Panel" })), await n(() => i(s).not.toBeVisible()), await n(() => i(o).toBeVisible()), await t.click(o), await i(c).toHaveValue("Terracotta");
	}
}, _ = {
	parameters: { docs: { description: { story: "Pass sidePanelBubbleIcon to Workbench to replace the default chat icon." } } },
	render: () => /* @__PURE__ */ d(p, { bubbleIcon: /* @__PURE__ */ d(e, { size: 20 }) })
};
export { h as AttachedOnly, _ as CustomBubbleIcon, g as DefaultBubble, m as default };
