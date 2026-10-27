// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, o as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./overlay-layer-Cm28dnJ7.ts";
import { n as o, o as s } from "./collections-W65OWXaL.ts";
import { i as c, r as l } from "./synced-settings-DHQMAu8t.ts";
import { o as u } from "./project-context-BR7AjHlE.ts";
import { t as d } from "./commands-Bp5w85f4.ts";
import { t as f } from "./module-Dq9dyKrk.ts";
import { t as p } from "./module-Cb91dIbD.ts";
import { useEffect as m, useState as h } from "react";
import { jsx as g } from "react/jsx-runtime";
var _ = {
	title: "Dashboard/Search overlays",
	component: (e) => {
		let { overlay: t, projectCount: n = 8 } = e, [r] = h(() => i());
		return m(() => {
			let e = l(), i = Array.from(o("projects").state.values());
			t === "Projects" && s("projects")?.truncateAndWrite(Array.from({ length: n }, (e, t) => ({
				id: `storybook-project-${t}`,
				name: `Project ${t + 1}`,
				created_at: "2026-10-16T09:00:00.000Z"
			}))), c({
				notifications_enabled: !0,
				machine_tokens_enabled: !1,
				max_concurrent_sessions: null
			});
			let a = r.registerModule(p()), m = r.registerModule(f());
			u(r, {
				id: "storybook-search-overlays",
				name: "Prompt Studio"
			});
			let h = t === "Projects" ? d.openProjects : d.openNotifications;
			return r.commands.executeCommand(h), () => {
				m.dispose(), a.dispose(), t === "Projects" && s("projects")?.truncateAndWrite(i), e ? c(e) : s("settings")?.remove("global");
			};
		}, [
			t,
			n,
			r
		]), /* @__PURE__ */ g(a, { workbench: r });
	},
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "Search overlays use the shared dialog close position to center the control beside the search field." } }
	},
	play: async ({ canvasElement: i, args: a }) => {
		let o = n(i.ownerDocument.body), s = await o.findByRole("button", { name: `Close ${a.overlay}` }), c = s.closest("[role=\"dialog\"]")?.querySelector("input");
		await t(() => r(c).toBeVisible()), await t(() => {
			let e = s.getBoundingClientRect(), t = c.getBoundingClientRect(), n = Math.abs(e.y + e.height / 2 - t.y - t.height / 2);
			r(n).toBeLessThanOrEqual(1);
		}), await e.click(s), await t(() => r(o.queryByRole("button", { name: `Close ${a.overlay}` })).toBeNull());
	}
}, v = { args: { overlay: "Projects" } }, y = { args: { overlay: "Notifications" } }, b = async (e, t) => {
	let i = await n(e.ownerDocument.body).findByRole("dialog");
	await r(n(i).queryByRole("textbox")).not.toBeInTheDocument(), await r(n(i).getByRole("button", { name: "Create project" })).toBeVisible();
	for (let e = 1; e <= t; e++) await r(n(i).getByText(`Project ${e}`, { exact: !0 })).toBeVisible();
}, x = {
	args: {
		overlay: "Projects",
		projectCount: 0
	},
	play: async ({ canvasElement: e }) => b(e, 0)
}, S = {
	args: {
		overlay: "Projects",
		projectCount: 7
	},
	play: async ({ canvasElement: e }) => b(e, 7)
}, C = {
	args: {
		overlay: "Projects",
		projectCount: 1
	},
	play: async ({ canvasElement: e }) => b(e, 1)
}, w = {
	args: {
		overlay: "Projects",
		projectCount: 8
	},
	play: async ({ canvasElement: t }) => {
		let i = await n(t.ownerDocument.body).findByRole("dialog"), a = n(i).getByRole("textbox");
		await e.type(a, "Project 8"), await r(n(i).getByText("Project 8", { exact: !0 })).toBeVisible(), await r(n(i).queryByText("Project 1", { exact: !0 })).not.toBeInTheDocument(), await r(a).toBeVisible(), await e.clear(a), await r(n(i).getByText("Project 1", { exact: !0 })).toBeVisible();
	}
};
export { w as FilterProjects, x as NoProjects, y as Notifications, C as OneProject, v as Projects, S as SmallProjectList, _ as default };
