// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./data-table-BpTupEfR.ts";
import { Badge as i, Box as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-value-renderers.stories.tsx
var s = (e) => (/* @__PURE__ */ new Date(Date.now() - e * 60 * 60 * 1e3)).toISOString(), c = [
	{
		Name: "Project workspace",
		Type: "Project folder",
		Location: "/Users/alex/Projects/prompt-studio",
		Created: s(72),
		Diff: "Not supported",
		Provider: "pstdio.root"
	},
	{
		Name: "Workspace list defaults",
		Type: "Git worktree",
		Location: "/Users/alex/.pstdio/workspaces/5c64c4e9-82c0-4be1-989a-4eb1b95d9345/prompt-studio",
		Created: s(5),
		Diff: {
			additions: 128,
			deletions: 14
		},
		Provider: "pstdio.worktree"
	},
	{
		Name: "Clean worktree",
		Type: "Git worktree",
		Location: "/Users/alex/.pstdio/workspaces/0b1f/prompt-studio",
		Created: s(1),
		Diff: {
			additions: 0,
			deletions: 0
		},
		Provider: "pstdio.worktree"
	},
	{
		Name: "Remote runner",
		Type: "Remote workspace",
		Location: "remote://runner-42/workspace",
		Created: s(.5),
		Diff: "Not supported",
		Provider: "example.remote"
	}
], l = {
	Type: {
		type: "badge",
		categories: [
			{
				value: "Project folder",
				palette: "gray"
			},
			{
				value: "Git worktree",
				palette: "purple"
			},
			{
				value: "Remote workspace",
				palette: "blue"
			}
		]
	},
	Location: { type: "path" },
	Created: { type: "date" },
	Diff: { type: "diff" }
}, u = {
	title: "Components/Data Display/Data Table",
	component: r
}, d = (e) => /* @__PURE__ */ o(a, {
	width: "100%",
	maxWidth: "880px",
	height: "440px",
	marginX: "auto",
	padding: "sm",
	background: "bg",
	children: /* @__PURE__ */ o(r, { ...e })
}), f = {
	parameters: { docs: { description: { story: "Relative dates refresh every minute while the table stays open. Hover or focus a date to read its full timestamp." } } },
	args: {
		data: c,
		fullWidth: !0,
		columnRenderers: l,
		toolbarStorageKey: "storybook-data-table-value-renderers"
	},
	render: d,
	play: async ({ canvasElement: t }) => {
		let r = e(t);
		await n(r.getAllByText("Git worktree")[0]).toBeVisible(), await n(r.getByText("+128")).toBeVisible(), await n(r.getByText("+0")).toBeVisible(), await n(r.getByText("5 hours ago")).toBeVisible();
		let i = String(c[1].Location);
		await n(r.getByText((e, t) => t?.getAttribute("tabindex") === "0" && t.textContent === i)).toBeVisible();
	}
}, p = {
	args: {
		data: c,
		fullWidth: !0,
		columnRenderers: l,
		columnStats: {
			Type: {
				type: "top-values",
				limit: 3
			},
			Provider: {
				type: "top-values",
				limit: 3
			}
		},
		defaultSettings: {
			showStats: !1,
			hiddenColumns: ["Provider"]
		},
		toolbarStorageKey: "storybook-data-table-default-display"
	},
	render: d,
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await n(i.queryByText("pstdio.root")).toBeNull(), await n(i.queryByText("50%")).toBeNull(), await t.click(i.getByRole("button", { name: "Display settings" }));
		let a = e(await e(document.body).findByRole("dialog"));
		await t.click(a.getByText("Statistics")), await t.click(a.getByText("Provider")), await n((await i.findAllByText("pstdio.root"))[0]).toBeVisible(), await n((await i.findAllByText("50%")).length).toBeGreaterThan(0);
	}
}, m = {
	args: {
		data: [{
			Name: {
				display: /* @__PURE__ */ o(i, { children: "Completed" }),
				sortValue: 1
			},
			Created: s(5),
			Diff: {
				additions: 128,
				deletions: 14
			}
		}, {
			Name: {
				display: "Pending",
				sortValue: 2
			},
			Created: s(1),
			Diff: {
				additions: 0,
				deletions: 0
			}
		}],
		columnRenderers: {
			Created: { type: "date" },
			Diff: { type: "diff" }
		},
		fullWidth: !0,
		toolbarStorageKey: "storybook-data-table-search-cell-values",
		defaultSettings: { showStats: !1 }
	},
	render: d
};
export { p as DefaultDisplay, m as SearchCellValues, f as ValueRenderers, u as default };
