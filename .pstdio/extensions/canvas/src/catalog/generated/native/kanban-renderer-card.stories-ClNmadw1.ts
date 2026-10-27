// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workspace-badge-C5sEf_C9.ts";
import { t } from "./kanban-renderer-card-DtFLg3Jg.ts";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
// packages/ui/src/components/kanban-renderer/kanban-renderer-card.stories.tsx
var i = {
	title: "Patterns/Kanban Renderer/Card",
	component: t,
	parameters: { layout: "padded" },
	decorators: [(e) => /* @__PURE__ */ r(n, {
		maxWidth: "300px",
		children: /* @__PURE__ */ r(e, {})
	})]
}, a = { args: { title: "Implement user authentication flow" } }, o = { args: {
	title: "Implement user authentication flow",
	isSelected: !0
} }, s = { args: {
	title: "Fix login redirect loop",
	badges: [{
		attributeId: "labels",
		label: "bug",
		color: "red"
	}]
} }, c = { args: {
	title: "Add dark mode support to settings panel",
	badges: [
		{
			attributeId: "status",
			label: "in progress",
			color: "yellow"
		},
		{
			attributeId: "priority",
			label: "high",
			color: "red"
		},
		{
			attributeId: "component",
			label: "frontend",
			color: "purple"
		}
	]
} }, l = { args: {
	title: "Create API endpoint for user preferences",
	workspaceBadge: {
		workspaceType: "worktree",
		shorthand: "A1",
		sessionStatus: "completed"
	},
	badges: [{
		attributeId: "component",
		label: "backend",
		color: "blue"
	}, {
		attributeId: "status",
		label: "todo",
		color: "gray"
	}]
} }, u = { args: {
	title: "Create API endpoint for user preferences",
	customSlots: [/* @__PURE__ */ r(e, {
		workspaceType: "worktree",
		shorthand: "A2",
		diffAdditions: 12,
		diffDeletions: 4,
		hasMultipleWorkspaces: !0,
		showLeadingSessionIndicator: !1
	}, "workspace")],
	badges: [{
		attributeId: "component",
		label: "backend",
		color: "blue"
	}, {
		attributeId: "status",
		label: "todo",
		color: "gray"
	}]
} }, d = { args: {
	title: "Refactor the entire authentication module to support OAuth2 and SAML providers with backward-compatible session handling",
	badges: [{
		attributeId: "type",
		label: "refactor",
		color: "purple"
	}, {
		attributeId: "priority",
		label: "high",
		color: "red"
	}]
} }, f = { args: { title: "Quick typo fix in README" } }, p = { args: {
	title: "Implement card workspace shortcut",
	workspaceBadge: {
		workspaceType: "worktree",
		shorthand: "A2",
		diffAdditions: 12,
		diffDeletions: 4,
		sessionStatus: "in_progress"
	}
} }, m = { args: {
	title: "Drag me around",
	draggable: !0,
	badges: [{
		attributeId: "status",
		label: "todo",
		color: "gray"
	}]
} };
export { a as Default, m as Draggable, d as LongTitle, f as NoBadges, o as Selected, p as WithDiffBadge, c as WithMultipleBadges, s as WithSingleBadge, l as WithWorkspaceBadge, u as WorkspaceBadgeAsDisplayTag, i as default };
