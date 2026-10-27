// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, r as t, s as n, t as r } from "./test-CYwQ_LKY.ts";
import { t as i } from "./session-harness-unavailable-BK_TnzVg.ts";
import { Box as a, Button as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
import { ChatPanel as c, ChatWorkspaceHub as l } from "@pstdio/ui/chat-ui";
// packages/pstdio-dashboard/src/modules/sessions/components/session-harness-unavailable.stories.tsx
var u = {
	title: "Modules/Sessions/Harness Unavailable",
	component: i,
	args: { onReviewExtensions: t() },
	parameters: { layout: "padded" },
	render: (e) => /* @__PURE__ */ s(a, {
		h: "lg",
		children: /* @__PURE__ */ s(c, {
			messages: [],
			emptyStateTitle: "New conversation",
			emptyStateDescription: "Start a conversation with an agent.",
			chatInputPlaceholder: "Reply to the agent...",
			workspaceHub: /* @__PURE__ */ s(l, {
				workspaceControl: /* @__PURE__ */ s(o, {
					size: "xs",
					variant: "ghost",
					children: "Project folder"
				}),
				additions: 0,
				deletions: 0
			}),
			composerFallback: /* @__PURE__ */ s(i, { ...e })
		})
	})
}, d = {}, f = { globals: { theme: "pstdio-dark" } }, p = { decorators: [(e) => /* @__PURE__ */ s(a, {
	maxW: "xs",
	children: /* @__PURE__ */ s(e, {})
})] }, m = {
	args: { onInterrupt: t() },
	play: async ({ canvasElement: t, args: i }) => {
		let a = n(t);
		await r(a.queryByRole("textbox")).not.toBeInTheDocument(), await e.click(a.getByRole("button", { name: /^Stop session$/ })), await r(i.onInterrupt).toHaveBeenCalledOnce(), await e.click(a.getByRole("button", { name: /^Browse extensions$/ })), await r(i.onReviewExtensions).toHaveBeenCalledOnce();
	}
};
export { m as ActiveRun, f as Dark, p as Narrow, d as NoHarnessAvailable, u as default };
