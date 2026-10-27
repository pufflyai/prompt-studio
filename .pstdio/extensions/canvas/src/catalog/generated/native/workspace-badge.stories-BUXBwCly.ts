// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./workspace-badge-C5sEf_C9.ts";
import { Box as r, VStack as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
// packages/ui/src/components/primitives/workspace-badge.stories.tsx
var s = {
	title: "Components/Data Display/Workspace Badge",
	component: n,
	args: { workspaceType: "worktree" },
	decorators: [(e) => /* @__PURE__ */ a(r, {
		p: "sm",
		children: /* @__PURE__ */ a(e, {})
	})]
}, c = {
	args: {
		workspaceType: "folder",
		label: "Project workspace",
		sessionStatus: "in_progress"
	},
	play: async ({ canvasElement: n }) => {
		await t(e(n).getByLabelText("Project folder")).toBeVisible();
	}
}, l = {
	args: {
		workspaceType: "worktree",
		shorthand: "PS-412_A1",
		diffAdditions: 18,
		diffDeletions: 4
	},
	play: async ({ canvasElement: n }) => {
		await t(e(n).getByLabelText("Git worktree")).toBeVisible();
	}
}, u = {
	args: {
		workspaceType: "remote",
		label: "Cloud development",
		sessionStatus: "completed"
	},
	play: async ({ canvasElement: n }) => {
		await t(e(n).getByLabelText("Remote workspace")).toBeVisible();
	}
}, d = { args: {
	initializing: !0,
	shorthand: "A1"
} }, f = { args: {
	workspaceType: "folder",
	sessionStatus: "in_progress",
	hasMultipleWorkspaces: !1
} }, p = { args: {
	shorthand: "A2",
	hasMultipleWorkspaces: !0,
	attemptStatus: {
		name: "Needs Review",
		color: "orange",
		description: "Waiting for reviewer confirmation"
	}
} }, m = { args: {
	shorthand: "A3",
	diffAdditions: 18,
	diffDeletions: 4,
	sessionStatus: "completed"
} }, h = { args: {
	label: "Latest implementation attempt",
	shorthand: "PS-412_A3",
	diffAdditions: 18,
	diffDeletions: 4,
	showLeadingSessionIndicator: !1
} }, g = { args: {
	label: "Refactor workspace badge rendering for long ticket board names",
	shorthand: "PS-412_A4",
	diffAdditions: 106,
	diffDeletions: 27,
	showLeadingSessionIndicator: !1
} }, _ = { args: {
	label: "Remote review pass",
	workspaceType: "remote",
	shorthand: "PS-412_A5",
	hasMultipleWorkspaces: !0,
	showLeadingSessionIndicator: !1
} }, v = { args: {
	shorthand: "A3",
	sessionStatus: "completed"
} }, y = { args: {
	shorthand: "A4",
	attemptStatus: {
		name: "Blocked",
		color: "red",
		description: "Waiting on upstream migration"
	},
	sessionStatus: "in_progress"
} }, b = { args: {
	shorthand: "A4",
	sessionStatus: "awaiting_input",
	attemptStatus: void 0
} }, x = { render: () => /* @__PURE__ */ o(i, {
	align: "start",
	gap: "sm",
	children: [
		/* @__PURE__ */ a(n, {
			workspaceType: "worktree",
			initializing: !0,
			shorthand: "A1"
		}),
		/* @__PURE__ */ a(n, {
			workspaceType: "worktree",
			shorthand: "A2",
			sessionStatus: "in_progress",
			hasMultipleWorkspaces: !0
		}),
		/* @__PURE__ */ a(n, {
			workspaceType: "worktree",
			shorthand: "A3",
			attemptStatus: {
				name: "Ready",
				color: "green",
				description: "Ready to merge"
			},
			diffAdditions: 9,
			diffDeletions: 2
		}),
		/* @__PURE__ */ a(n, {
			workspaceType: "worktree",
			sessionStatus: "failed"
		}),
		/* @__PURE__ */ a(n, {
			workspaceType: "folder",
			label: "Project workspace",
			sessionStatus: "in_progress"
		}),
		/* @__PURE__ */ a(n, {
			workspaceType: "remote",
			label: "Cloud development",
			sessionStatus: "completed"
		})
	]
}) };
export { b as FallbackSessionStatus, l as GitWorktree, d as Initializing, g as LongWorkspaceName, p as MultiWorkspaceWithShorthandAndDropdown, _ as NamedMultipleWorkspaces, c as ProjectFolder, u as RemoteWorkspace, f as SingleWorkspaceNoShorthand, x as StateMatrix, y as WithAttemptStatus, m as WithDiffs, h as WithNameAndDiffs, v as WithoutDiffs, s as default };
