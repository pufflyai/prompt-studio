// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { a as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { t as o } from "./workbench-BbqJVWhj.ts";
import { t as s } from "./settings-module-CsddopXv.ts";
import { r as c } from "./terminal-module-DSNuh2gh.ts";
import { t as l } from "./workbench-theme-provider-CQSyY8qK.ts";
import { t as u } from "./desktop-project-tabs-controller-B3HInTdw.ts";
import { t as d } from "./desktop-project-tabs-OWzgYI9X.ts";
import { t as f } from "./module-slVbQVuG.ts";
import { useState as p } from "react";
import { Box as m, Text as h } from "@chakra-ui/react";
import { jsx as g } from "react/jsx-runtime";
var _ = {
	title: "Dashboard/Project selection",
	component: (n) => {
		let { platform: r } = n, [i] = p(() => {
			let e = new t({ defaultOptions: { queries: { enabled: !1 } } });
			return e.setQueryData(["account-status"], { cloudProjects: [] }), e;
		}), [_] = p(() => new u([], async () => {})), [v] = p(() => {
			let e = a();
			return e.registerModule(c()), e.registerModule(f({ projectTabs: r ? _ : void 0 })), e.registerModule(s()), e.views.registerView({
				id: "settings.general",
				title: "General",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ g(h, {
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
					render: () => /* @__PURE__ */ g(h, { children: "Background activity" })
				}
			}), e.statusBar.registerItem({
				id: "status.activity",
				viewId: "status.activity",
				slot: "trailing"
			}), e.modes.setActiveMode("project-selection"), e;
		});
		return /* @__PURE__ */ g(e, {
			client: i,
			children: /* @__PURE__ */ g(l, { children: /* @__PURE__ */ g(m, {
				h: "100dvh",
				children: /* @__PURE__ */ g(o, {
					workbench: v,
					panelControlsPlacement: r ? "host" : "nav",
					titleBar: r && /* @__PURE__ */ g(d, {
						workbench: v,
						controller: _,
						platform: r
					})
				})
			}) })
		});
	},
	parameters: { layout: "fullscreen" }
}, v = async (e) => {
	let t = r(e.ownerDocument.body), a = await t.findByRole("dialog");
	await i(r(a).getByText("No projects yet")).toBeVisible(), await i(r(a).getByRole("button", { name: "Create project" })).toBeVisible();
	for (let t of e.querySelectorAll("button, [role=tab], [data-workbench-region=status]")) await i(t).not.toBeVisible();
	let o = e.querySelector("[data-workbench-panel=\"main\"]");
	await i(getComputedStyle(o).borderWidth).toBe("0px");
	let s = r(a).getByRole("button", { name: "Settings" });
	await i(s).toBeVisible(), await n.click(s), await i(await t.findByText("General settings")).toBeVisible(), await n.click(t.getByRole("button", { name: /^Close/ })), await i(await t.findByText("No projects yet")).toBeVisible(), await n.keyboard("{Escape}"), await i(t.getByRole("button", { name: "Create project" })).toBeVisible();
}, y = { play: async ({ canvasElement: e }) => v(e) }, b = {
	args: { platform: "darwin" },
	play: async ({ canvasElement: e }) => v(e)
}, x = {
	args: { platform: "win32" },
	play: async ({ canvasElement: e }) => v(e)
};
export { y as Browser, b as Mac, x as Windows, _ as default };
