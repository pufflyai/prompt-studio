// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-kaLFKJEn.ts";
import { t as a } from "./workbench-BbqJVWhj.ts";
import { t as o } from "./settings-module-CsddopXv.ts";
import { t as s } from "./settings-resources-BmVO5oBi.ts";
import { t as c } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useEffect as l, useState as u } from "react";
import { Box as d, Button as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/settings/settings-progressive-loading.stories.tsx
var _ = (e) => {
	let t = {
		skills: Promise.withResolvers(),
		templates: Promise.withResolvers()
	}, n = e.registerModule({
		id: "storybook.progressive-settings",
		activate(e) {
			e.views.registerView({
				id: "settings-content",
				title: "Settings content",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ g(p, {
						p: "md",
						gap: "md",
						children: [
							/* @__PURE__ */ h(m, { children: "General settings" }),
							/* @__PURE__ */ h(f, {
								onClick: () => t.templates.resolve(["Ticket template"]),
								children: "Load templates"
							}),
							/* @__PURE__ */ h(f, {
								onClick: () => t.skills.resolve(["Review skill"]),
								children: "Load skills"
							}),
							/* @__PURE__ */ h(f, {
								onClick: () => {
									t.skills = Promise.withResolvers(), t.templates = Promise.withResolvers(), e.settings.refresh();
								},
								children: "Refresh collections"
							})
						]
					})
				}
			}), e.settings.registerSection({
				id: "general",
				title: "Workbench"
			}), e.settings.registerPanel({
				id: "general",
				title: "General",
				kind: "view",
				section: "general",
				viewId: "settings-content",
				order: 0
			});
			for (let [n, r] of [["skills", "Skills"], ["templates", "Templates"]]) e.settings.registerPanel({
				id: n,
				title: r,
				kind: "collection",
				section: "general",
				viewId: "settings-content",
				order: 10,
				items: () => t[n].promise,
				itemId: (e) => e,
				itemLabel: (e) => e
			});
		}
	}), r = e.registerModule(o({ resolveScopeId: () => "storybook" }));
	return () => {
		r.dispose(), n.dispose();
	};
}, v = {
	title: "pstdio-workbench/Reference/Core API/Settings progressive loading",
	component: () => {
		let [e] = u(() => i());
		return l(() => {
			let t = _(e);
			return e.commands.executeCommand(s), t;
		}, [e]), /* @__PURE__ */ h(a, { workbench: e });
	},
	decorators: [(e) => /* @__PURE__ */ h(c, { children: /* @__PURE__ */ h(d, {
		height: "100vh",
		children: /* @__PURE__ */ h(e, {})
	}) })],
	parameters: { layout: "fullscreen" }
}, y = { play: async ({ canvasElement: i }) => {
	let a = n(i.ownerDocument.body), o = await a.findByRole("option", { name: "General" }), s = a.getByRole("option", { name: "Skills" }), c = a.getByRole("option", { name: "Templates" });
	await r(o).toBeVisible(), await e.click(s), await e.click(c), await e.click(a.getByRole("button", { name: "Load templates" })), await r(await a.findByRole("option", { name: "Ticket template" })).toBeVisible(), await r(a.queryByRole("option", { name: "Review skill" })).not.toBeInTheDocument(), await r(o).toBe(a.getByRole("option", { name: "General" })), await r(s).toBe(a.getByRole("option", { name: "Skills" })), await e.click(a.getByRole("button", { name: "Load skills" })), await r(await a.findByRole("option", { name: "Review skill" })).toBeVisible(), await r(o).toBe(a.getByRole("option", { name: "General" })), await r(c).toBe(a.getByRole("option", { name: "Templates" }));
	let l = a.getByRole("option", { name: "Review skill" }), u = a.getByRole("option", { name: "Ticket template" });
	await e.click(a.getByRole("button", { name: "Refresh collections" })), await r(l).toBeVisible(), await r(u).toBeVisible(), await e.click(a.getByRole("button", { name: "Load templates" })), await r(l).toBeVisible(), await e.click(a.getByRole("button", { name: "Load skills" })), await t(() => r(l).toBe(a.getByRole("option", { name: "Review skill" }))), await r(u).toBe(a.getByRole("option", { name: "Ticket template" }));
} };
export { y as IndependentCollections, v as default };
