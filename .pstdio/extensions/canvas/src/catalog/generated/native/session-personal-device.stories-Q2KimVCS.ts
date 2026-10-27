// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { s as e, t } from "./test-CYwQ_LKY.ts";
import { t as n } from "./session-personal-device-PywC02Zg.ts";
import { Box as r } from "@chakra-ui/react";
import { jsx as i } from "react/jsx-runtime";
import { ChatPanel as a } from "@pstdio/ui/chat-ui";
// packages/pstdio-dashboard/src/modules/sessions/components/session-personal-device.stories.tsx
var o = {
	title: "Modules/Sessions/Personal Device",
	component: n,
	args: { name: "Laptop" },
	render: (e) => /* @__PURE__ */ i(r, {
		h: "lg",
		children: /* @__PURE__ */ i(a, {
			emptyStateTitle: "Conversation",
			emptyStateDescription: "Read the saved conversation.",
			chatInputPlaceholder: "Reply to the agent...",
			messages: [{
				id: "message",
				role: "assistant",
				parts: [{
					type: "text",
					text: "The saved conversation is available while Laptop is offline."
				}]
			}],
			composerFallback: /* @__PURE__ */ i(n, { ...e })
		})
	})
}, s = { play: async ({ canvasElement: n }) => {
	let r = e(n);
	await t(r.getByText("Session on Laptop")).toBeVisible(), await t(r.queryAllByRole("textbox").filter((e) => e.getAttribute("contenteditable") === "true")).toHaveLength(0);
} }, c = { globals: { theme: "pstdio-dark" } };
export { c as Dark, s as OfflineSource, o as default };
