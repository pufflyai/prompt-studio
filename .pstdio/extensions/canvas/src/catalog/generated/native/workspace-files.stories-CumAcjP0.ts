// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { a as t, o as n, s as r, t as i } from "./test-CYwQ_LKY.ts";
import { t as a } from "./workbench-core-N58OeDyx.ts";
import { t as o } from "./widget-ids-CvvbLhYP.ts";
import { t as s } from "./workbench-BYYWgWSr.ts";
import { o as c } from "./project-context-BR7AjHlE.ts";
import { y as l } from "./dashboard-workspaces-MEnQd3Xj.ts";
import { c as u, f as d, m as f, n as p, o as m, t as h } from "./module-DwWTLgjb.ts";
import { r as g } from "./workspace-navigation-yctjVTFm.ts";
import { useState as _ } from "react";
import { Box as v, Button as y } from "@chakra-ui/react";
import { jsx as b, jsxs as x } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/workspaces/workspace-files.stories.tsx
var S = "PS-118_A5", C = (e) => {
	if (e === "text" || e === "default" || e === "collapsed" || e === "preparing" || e === "failed" || e === "provider-failed") return "README.md";
	if (e === "image") return "assets/logo.png";
}, w = (e) => {
	let t = C(e), n = e === "diffs" || e.startsWith("changes-"), r = "worktree";
	return e === "default" && (r = "folder"), e === "remote" && (r = "remote"), {
		type: "workspace",
		id: S,
		label: S,
		icon: e === "default" ? "Folder" : "GitBranch",
		metadata: {
			projectId: "prompt-studio",
			workspaceId: S,
			workspaceProviderState: e === "preparing" ? "provisioning" : "ready",
			workspaceShorthand: S,
			workspaceType: r,
			workspaceView: n ? "diffs" : "files",
			...e === "changes-setup-failed" ? {
				workspaceProviderState: "failed",
				workspaceError: "Workspace configuration could not be written."
			} : {},
			...e === "changes-provider-failed" ? {
				workspaceProviderState: "failed",
				workspaceError: "The workspace provider could not start the environment."
			} : {},
			...e === "changes-unavailable" ? { workspaceProviderState: "failed" } : {},
			...e === "changes-preparing" || e === "changes-recovery" ? { workspaceProviderState: "provisioning" } : {},
			workspaceSupportsFiles: e !== "remote",
			workspaceSupportsDelete: e === "remote",
			workspaceSupportsDiff: e !== "default" && e !== "remote",
			...e === "failed" ? {
				workspaceProviderState: "failed",
				workspaceError: "The project folder does not exist at revision HEAD.",
				workspaceSupportsDiff: !1
			} : {},
			...e === "provider-failed" ? {
				workspaceProviderState: "failed",
				workspaceSupportsDiff: !1
			} : {},
			...e === "remote" ? {
				workspaceExecutionKind: "remote",
				workspaceSupportsFiles: !1,
				workspaceSupportsDiff: !1
			} : {},
			...t ? { workspaceFilePath: t } : {}
		}
	};
}, T = () => {
	g().clear(), g().setQueryDefaults(["workspace-files", S], { staleTime: Infinity }), g().setQueryDefaults(["workspace-diffs", S], { staleTime: Infinity }), g().setQueryData(f(S, { limit: 500 }), {
		workspace_id: S,
		path: "",
		entries: [
			{
				path: "src",
				name: "src",
				type: "directory"
			},
			{
				path: "assets",
				name: "assets",
				type: "directory"
			},
			{
				path: "README.md",
				name: "README.md",
				type: "file",
				size: 485
			}
		],
		truncated: !1
	}), g().setQueryData(d(S, "README.md"), {
		workspace_id: S,
		path: "README.md",
		file_name: "README.md",
		mime_type: "text/markdown",
		size: 485,
		encoding: "utf8",
		content: "# Prompt Studio\n\nA workspace keeps its Files and Changes views on the same resource.\n\n## PS-118\n\n- Browse files from the left Panel menu.\n- Edit text with Monaco.\n- Load one diff body when it is selected.",
		editable: !0
	}), g().setQueryData(d(S, "assets/logo.png"), {
		workspace_id: S,
		path: "assets/logo.png",
		file_name: "logo.png",
		mime_type: "image/png",
		size: 68,
		encoding: "base64",
		data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
		editable: !1
	});
	let e = {
		filePath: "README.md",
		change: "modified",
		additions: 4,
		deletions: 1,
		oldPath: "README.md",
		newPath: "README.md"
	};
	for (let t of ["current", "fork_point"]) g().setQueryData(u(S, t), {
		workspace_id: S,
		files: [e]
	}), g().setQueryData(m(S, t, "README.md"), {
		...e,
		oldContent: "# Prompt Studio\n\nThe old workspace diff view.\n",
		newContent: "# Prompt Studio\n\nFiles and Changes are workspace tabs.\n\nText opens in Monaco.\n"
	});
}, E = (e) => {
	T();
	let t = a();
	if (t.registerModule(h()), c(t, {
		id: "prompt-studio",
		name: "Prompt Studio"
	}), l(t, w(e)), t.shell.setRegionOpen("sidenav", !1), e === "collapsed") {
		let e = t.layout.listPanelInstances("main-left-menu").find((e) => e.panelId === o.workspaceFileTree);
		e && t.panelMenuState.setOpen(`panel-menu:${e.instanceId}`, !1);
	}
	return t;
}, D = {
	title: "Modules/Workspaces/Files and Changes",
	component: (t) => {
		let { state: n } = t, [r] = _(() => E(n));
		return /* @__PURE__ */ b(e, {
			client: g(),
			children: /* @__PURE__ */ x(v, {
				h: "100dvh",
				w: "full",
				display: "flex",
				flexDirection: "column",
				children: [n === "changes-recovery" ? /* @__PURE__ */ b(y, {
					onClick: () => p(r, w("diffs")),
					children: "Finish workspace setup"
				}) : null, /* @__PURE__ */ b(v, {
					flex: "1",
					minH: "0",
					children: /* @__PURE__ */ b(s, { workbench: r })
				})]
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, O = { args: { state: "diffs" } }, k = {
	args: { state: "diffs" },
	play: async ({ canvasElement: e }) => {
		let n = r(e);
		await i(await n.findByRole("tab", { name: "Changes" })).toBeVisible(), await i(n.queryByRole("button", { name: "Close Changes" })).not.toBeInTheDocument(), await i(n.queryByRole("button", { name: "Close Files" })).not.toBeInTheDocument(), await t.click(n.getByRole("tab", { name: "Files" })), await i(n.getByRole("tab", { name: "Files" })).toBeVisible(), await i(n.getByRole("tab", { name: "Files" })).toHaveAttribute("aria-selected", "true"), await t.click(n.getByRole("tab", { name: "Changes" })), await i(n.getByRole("tab", { name: "Changes" })).toHaveAttribute("aria-selected", "true");
	}
}, A = { args: { state: "files" } }, j = { args: { state: "text" } }, M = { args: { state: "image" } }, N = { args: { state: "default" } }, P = { args: { state: "collapsed" } }, F = {
	args: { state: "remote" },
	play: async ({ canvasElement: e }) => {
		let a = r(e);
		await i(await a.findByText("Workspace state: Ready")).toBeVisible(), await i(a.getByRole("button", { name: "Rename workspace" })).toBeVisible(), await i(a.getByRole("button", { name: "Delete workspace" })).toBeVisible(), await i(a.queryByRole("region", { name: "Files" })).not.toBeInTheDocument(), await i(a.queryByRole("tab", { name: "Files" })).not.toBeInTheDocument(), await i(a.queryByText("Select a file")).not.toBeInTheDocument(), await i(a.queryByRole("button", { name: "Open terminal" })).not.toBeInTheDocument(), await t.click(a.getByRole("button", { name: "Rename workspace" })), await n(() => i(r(document.body).getByRole("dialog", { name: "Rename workspace" })).toBeVisible()), await t.click(r(document.body).getByRole("button", { name: "Cancel" }));
	}
}, I = { args: { state: "preparing" } }, L = { args: { state: "failed" } }, R = { args: { state: "provider-failed" } }, z = { args: { state: "changes-setup-failed" } }, B = { args: { state: "changes-provider-failed" } }, V = { args: { state: "changes-unavailable" } }, H = { args: { state: "changes-preparing" } }, U = { args: { state: "changes-recovery" } };
export { H as ChangesPreparing, B as ChangesProviderFailure, U as ChangesRecovery, O as ChangesSelected, z as ChangesSetupFailure, V as ChangesUnavailable, P as CollapsedFilesMenu, N as DefaultWorkspace, R as FailedWorkspaceProvider, L as FailedWorkspaceSetup, A as FilesNoSelection, k as FixedWorkspacePanels, M as ImagePreview, j as MonacoTextFile, I as PreparingWorkspace, F as RemoteWithoutFileViews, D as default };
