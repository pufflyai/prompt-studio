// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, s as t, t as n } from "./test-CYwQ_LKY.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./workbench-BYYWgWSr.ts";
import { t as a } from "./settings-module-AIuYqymV.ts";
import { r as o } from "./terminal-module-BVELyv22.ts";
import { t as s } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as c } from "./desktop-project-tabs-controller-B3HInTdw.ts";
import { t as l } from "./desktop-project-tabs-B-MOZzFm.ts";
import { t as u } from "./module-Cb91dIbD.ts";
import { useState as d } from "react";
import { Box as f, Text as p } from "@chakra-ui/react";
import { jsx as m } from "react/jsx-runtime";
var h = {
	title: "Dashboard/Project selection",
	component: (e) => {
		let { platform: t } = e, [n] = d(() => new c([], async () => {})), [h] = d(() => {
			let e = r();
			return e.registerModule(o()), e.registerModule(u({ projectTabs: t ? n : void 0 })), e.registerModule(a()), e.views.registerView({
				id: "settings.general",
				title: "General",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ m(p, {
						p: "md",
						children: "General settings"
					})
				}
			}), e.settings.registerPanel({
				id: "general",
				title: "General",
				kind: "view",
				scope: "global",
				viewId: "settings.general"
			}), e.views.registerView({
				id: "status.activity",
				title: "Background activity",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ m(p, { children: "Background activity" })
				}
			}), e.statusBar.registerItem({
				id: "status.activity",
				viewId: "status.activity",
				slot: "trailing"
			}), e.modes.setActiveMode("project-selection"), e;
		});
		return /* @__PURE__ */ m(s, { children: /* @__PURE__ */ m(f, {
			h: "100dvh",
			children: /* @__PURE__ */ m(i, {
				workbench: h,
				panelControlsPlacement: t ? "host" : "nav",
				titleBar: t && /* @__PURE__ */ m(l, {
					workbench: h,
					controller: n,
					platform: t
				})
			})
		}) });
	},
	parameters: { layout: "fullscreen" }
}, g = async (r) => {
	let i = t(r.ownerDocument.body), a = await i.findByRole("dialog");
	await n(t(a).getByText("No projects yet")).toBeVisible(), await n(t(a).getByRole("button", { name: "Create project" })).toBeVisible();
	for (let e of r.querySelectorAll("button, [role=tab], [data-workbench-region=status]")) await n(e).not.toBeVisible();
	let o = r.querySelector("[data-workbench-panel=\"main\"]");
	await n(getComputedStyle(o).borderWidth).toBe("0px");
	let s = t(a).getByRole("button", { name: "Settings" });
	await n(s).toBeVisible(), await e.click(s), await n(await i.findByText("General settings")).toBeVisible(), await e.click(i.getByRole("button", { name: /^Close/ })), await n(await i.findByText("No projects yet")).toBeVisible(), await e.keyboard("{Escape}"), await n(i.getByRole("button", { name: "Create project" })).toBeVisible();
}, _ = { play: async ({ canvasElement: e }) => g(e) }, v = {
	args: { platform: "darwin" },
	play: async ({ canvasElement: e }) => g(e)
}, y = {
	args: { platform: "win32" },
	play: async ({ canvasElement: e }) => g(e)
};
export { _ as Browser, v as Mac, y as Windows, h as default };
