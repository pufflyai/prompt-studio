// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./workbench-BbqJVWhj.ts";
import { t as o } from "./settings-module-CsddopXv.ts";
import { t as s } from "./settings-resources-BmVO5oBi.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useEffect as l, useState as u } from "react";
import { Box as d, Text as f } from "@chakra-ui/react";
import { jsx as p } from "react/jsx-runtime";
var m = {
	title: "pstdio-workbench/Reference/Core API/Settings overlay",
	component: () => {
		let [e] = u(() => i());
		return l(() => {
			let t = e.registerModule(o()), n = e.registerModule({
				id: "storybook.settings.general",
				activate(e) {
					e.views.registerView({
						id: "storybook.settings.general.view",
						title: "General",
						body: {
							kind: "react",
							render: () => /* @__PURE__ */ p(f, {
								p: "md",
								children: "General settings"
							})
						}
					}), e.settings.registerSection({
						id: "workbench",
						title: "Workbench",
						order: 10
					}), e.settings.registerPanel({
						id: "storybook.general",
						title: "General",
						kind: "view",
						order: 10,
						section: "workbench",
						scope: "global",
						viewId: "storybook.settings.general.view"
					}), e.views.registerView({
						id: "storybook.settings.appearance.view",
						title: "Appearance",
						body: {
							kind: "react",
							render: () => /* @__PURE__ */ p(f, {
								p: "md",
								children: "Appearance settings"
							})
						}
					}), e.settings.registerPanel({
						id: "storybook.appearance",
						title: "Appearance",
						kind: "view",
						order: 20,
						section: "workbench",
						scope: "global",
						viewId: "storybook.settings.appearance.view"
					});
				}
			});
			return e.commands.executeCommand(s), () => {
				n.dispose(), t.dispose();
			};
		}, [e]), /* @__PURE__ */ p(a, { workbench: e });
	},
	decorators: [(e) => /* @__PURE__ */ p(c, { children: /* @__PURE__ */ p(d, {
		height: "100vh",
		children: /* @__PURE__ */ p(e, {})
	}) })],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "The settings dialog uses the shared dialog close position beside its title." } }
	}
}, h = { play: async ({ canvasElement: e }) => {
	let i = n(e.ownerDocument.body), a = await i.findByRole("button", { name: /^Close/ }), o = await i.findByText("Settings");
	await t(() => {
		let e = a.getBoundingClientRect(), t = o.getBoundingClientRect(), n = Math.abs(e.y + e.height / 2 - t.y - t.height / 2);
		r(n).toBeLessThanOrEqual(1);
	});
} }, g = { play: async ({ canvasElement: t }) => {
	let i = n(t.ownerDocument.body), a = await i.findByRole("option", { name: "General" });
	await e.click(i.getByRole("option", { name: "Appearance" })), await r(await i.findByText("Appearance settings")).toBeVisible(), await r(a).toBeVisible(), await r(a).toBe(i.getByRole("option", { name: "General" }));
} };
export { h as CenteredClose, g as NavigationRetention, m as default };
