// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { a as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-kaLFKJEn.ts";
import { t as o } from "./workbench-BbqJVWhj.ts";
import { o as s } from "./collections-W65OWXaL.ts";
import { o as c } from "./project-context-BR7AjHlE.ts";
import { y as l } from "./dashboard-workspaces-BTeYGs-s.ts";
import { t as u } from "./module-B-qaS9sM.ts";
import { r as d } from "./workspace-navigation-yctjVTFm.ts";
import { t as f } from "./workspace-views-story-DlVi0mQ4.ts";
import { useState as p } from "react";
import { Box as m } from "@chakra-ui/react";
import { jsx as h } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/workspaces/collections/workspace-list.stories.tsx
var g = "storybook-workspace-list", _ = (e) => (/* @__PURE__ */ new Date(Date.now() - e * 60 * 60 * 1e3)).toISOString(), v = (e) => ({
	project_id: g,
	archived: !1,
	setup_error: null,
	deleted_at: null,
	provider_state: "ready",
	execution_kind: "local",
	branch: null,
	updated_at: _(1),
	...e
}), y = () => s("workspaces")?.truncateAndWrite([
	v({
		id: "workspace-folder",
		name: "Project workspace",
		workspace_shorthand: "WS-1",
		provider_id: "pstdio.root",
		is_default: !0,
		root_path: "/Users/alex/Projects/prompt-studio",
		provider_capabilities_json: {
			files: "write",
			diff: !1
		},
		created_at: _(72)
	}),
	v({
		id: "workspace-worktree",
		name: "Workspace list defaults",
		workspace_shorthand: "PS-400_A1",
		provider_id: "pstdio.worktree",
		branch: "workspace/PS-400_A1",
		root_path: "/Users/alex/.pstdio/workspaces/5c64c4e9-82c0-4be1-989a-4eb1b95d9345/prompt-studio",
		provider_capabilities_json: {
			files: "write",
			diff: !0,
			merge: !0
		},
		created_at: _(5)
	}),
	v({
		id: "workspace-remote",
		name: "Remote runner",
		workspace_shorthand: "WS-3",
		provider_id: "example.remote-execution.workspace-type.remote",
		execution_kind: "remote",
		provider_state: "failed",
		display_path: "remote://runner-42/workspace",
		provider_error_json: { message: "Remote container failed to start" },
		provider_capabilities_json: {
			files: "read",
			diff: !1
		},
		created_at: _(2)
	})
]), b = {
	title: "Dashboard/Workspace list",
	component: (t) => {
		let { openWorkspaceId: n } = t, [r] = p(() => {
			y(), f(g);
			let e = a();
			return e.registerModule(u()), c(e, {
				id: g,
				name: "Prompt Studio"
			}), l(e, n ? {
				type: "workspace",
				id: n
			} : void 0), e;
		});
		return /* @__PURE__ */ h(e, {
			client: d(),
			children: /* @__PURE__ */ h(m, {
				h: "100dvh",
				children: /* @__PURE__ */ h(o, { workbench: r })
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, x = (e) => [...e.querySelectorAll("thead tr.data-table-column-header-row th")].map((e) => e.textContent?.trim()).filter(Boolean), S = { play: async ({ canvasElement: e }) => {
	let t = r(e);
	await t.findByText("Workspace list defaults"), await i(x(e)).toEqual([
		"Name",
		"Type",
		"Location",
		"Created at",
		"Diff"
	]), await i(t.queryByText("unique values")).toBeNull(), await i(t.getByText("Git worktree")).toBeVisible(), await i(t.getAllByText("Not supported")).toHaveLength(2), await n(() => i(t.getByText("+128")).toBeVisible());
} }, C = { play: async ({ canvasElement: e }) => {
	let n = r(e);
	await n.findByText("Remote runner"), await t.click(n.getByRole("button", { name: "Display settings" }));
	let a = r(await r(document.body).findByRole("dialog"));
	await t.click(a.getByText("Statistics")), await t.click(a.getByText("State", { exact: !0 })), await t.click(a.getByText("Provider error")), await i(await n.findByText("Remote container failed to start")).toBeVisible(), await i(n.getByRole("cell", { name: "Failed" })).toBeVisible(), await i((await n.findAllByText("unique values")).length).toBeGreaterThan(0);
} }, w = (e) => e.querySelector("nav[aria-label=\"breadcrumb\"] li:last-child svg")?.getAttribute("class") ?? "", T = {
	args: { openWorkspaceId: "workspace-folder" },
	play: async ({ canvasElement: e }) => {
		await n(() => i(w(e)).toContain("lucide-folder"));
	}
}, E = {
	args: { openWorkspaceId: "workspace-worktree" },
	play: async ({ canvasElement: e }) => {
		await n(() => i(w(e)).toContain("lucide-git-branch"));
	}
};
export { S as Defaults, C as DiagnosticColumns, E as GitWorktreeBreadcrumb, T as ProjectFolderBreadcrumb, b as default };
