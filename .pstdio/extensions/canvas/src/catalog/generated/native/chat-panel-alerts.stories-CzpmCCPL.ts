// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-up-right-CUuzCgQb.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./git-branch-BjWwGBn9.ts";
import { t as r } from "./chat-panel-CAnDU0Lx.ts";
import { t as i } from "./alert-D8nHP1tF.ts";
import { t as a } from "./workspace-hub-BZBU-L1T.ts";
import { Box as o, Button as s, Icon as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-alerts.stories.tsx
var f = {
	title: "Patterns/Chat/Chat Panel/Alerts",
	component: r,
	parameters: { layout: "padded" }
}, p = {
	w: "960px",
	maxW: "100%",
	h: "680px",
	bg: "bg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "lg",
	p: "md"
}, m = {
	streaming: !1,
	emptyStateTitle: "",
	emptyStateDescription: "",
	chatInputPlaceholder: "Type a message..."
}, h = /* @__PURE__ */ d(s, {
	size: "xs",
	variant: "ghost",
	px: "2xs",
	children: [
		/* @__PURE__ */ u(n, { size: 14 }),
		/* @__PURE__ */ u(l, {
			textStyle: "label/XS/medium",
			color: "fg",
			ml: "2xs",
			children: "main"
		}),
		/* @__PURE__ */ u(t, { size: 14 })
	]
}), g = [
	{
		id: "user-1",
		role: "user",
		parts: [{
			type: "text",
			text: "Show me all alert styles"
		}]
	},
	{
		id: "alert-info",
		role: "assistant",
		parts: [{
			type: "alert",
			status: "info",
			title: "Branch checked out",
			message: "Switched to workspace/PS-42_A1"
		}]
	},
	{
		id: "alert-success",
		role: "assistant",
		parts: [{
			type: "alert",
			status: "success",
			title: "Workspace ready"
		}]
	},
	{
		id: "alert-warning",
		role: "assistant",
		parts: [{
			type: "alert",
			status: "warning",
			title: "Merge conflicts detected",
			message: "3 files have conflicts that need manual resolution."
		}]
	},
	{
		id: "alert-error",
		role: "assistant",
		parts: [{
			type: "alert",
			status: "error",
			title: "Hook failed",
			message: "pre-commit hook exited with code 1: lint errors found."
		}]
	},
	{
		id: "alert-loading",
		role: "assistant",
		parts: [{
			type: "alert",
			status: "loading",
			title: "Setting up workspace...",
			message: "Installing dependencies and preparing environment"
		}]
	}
], _ = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: g
	}
}, v = [{
	id: "user-prompt",
	role: "user",
	parts: [{
		type: "text",
		text: "/implement PS-104"
	}]
}], y = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: v,
		streaming: !0,
		streamingStartedAt: Date.now(),
		workspaceInitializing: !0,
		workspaceHub: /* @__PURE__ */ u(a, {
			workspaceControl: h,
			additions: 0,
			deletions: 0,
			status: "loading",
			statusLabel: "Setting up workspace — installing dependencies"
		})
	}
}, b = [{
	id: "user-prompt",
	role: "user",
	parts: [{
		type: "text",
		text: "/implement PS-104"
	}]
}, {
	id: "assistant-1",
	role: "assistant",
	parts: [{
		type: "text",
		text: "I'll start implementing the hooks system. Let me read the ticket and the existing codebase first."
	}]
}], x = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: b,
		workspaceHub: /* @__PURE__ */ u(a, {
			workspaceControl: h,
			additions: 0,
			deletions: 0,
			action: /* @__PURE__ */ d(s, {
				size: "sm",
				variant: "plain",
				children: ["Review changes", /* @__PURE__ */ u(c, {
					as: e,
					boxSize: 4
				})]
			})
		})
	}
}, S = [{
	id: "user-prompt",
	role: "user",
	parts: [{
		type: "text",
		text: "/implement PS-104"
	}]
}], C = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: S,
		inputDisabled: !0,
		workspaceHub: /* @__PURE__ */ u(a, {
			workspaceControl: h,
			additions: 0,
			deletions: 0,
			status: "error",
			statusLabel: "Setup failed — bun install could not resolve dependencies",
			action: /* @__PURE__ */ d(s, {
				size: "sm",
				variant: "destructive",
				children: ["Edit hook", /* @__PURE__ */ u(c, {
					as: e,
					boxSize: 4
				})]
			})
		})
	}
}, w = /* @__PURE__ */ u(s, { children: "Retry" }), T = [{
	id: "user-sent",
	role: "user",
	parts: [{
		type: "text",
		text: "Check the board"
	}],
	createdAt: Date.now() - 6e4
}, {
	id: "assistant-reply",
	role: "assistant",
	parts: [{
		type: "text",
		text: "The board has 32 active tickets."
	}]
}], E = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: [...T, {
			id: "user-unsent",
			role: "user",
			parts: [{
				type: "text",
				text: "Summarize the open tickets."
			}],
			delivery: "unsent"
		}],
		conversationNotices: /* @__PURE__ */ u(i, {
			status: "error",
			title: "Message not sent",
			onClose: () => {},
			endElement: w,
			children: "The network is unavailable."
		})
	}
}, D = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: T,
		conversationNotices: /* @__PURE__ */ u(i, {
			status: "error",
			title: "Could not load conversation",
			onClose: () => {},
			endElement: w,
			children: "The server had a temporary problem."
		})
	}
}, O = {
	render: (e) => /* @__PURE__ */ u(o, {
		...p,
		children: /* @__PURE__ */ u(r, { ...e })
	}),
	args: {
		...m,
		messages: [],
		conversationNotices: /* @__PURE__ */ u(i, {
			status: "error",
			title: "Could not load conversation",
			onClose: () => {},
			children: "This session no longer exists."
		})
	}
};
export { _ as AlertVariants, D as ConversationCouldNotLoad, O as ConversationGone, E as MessageNotSent, y as WorkspaceInitializing, x as WorkspaceReady, C as WorkspaceSetupFailed, f as default };
