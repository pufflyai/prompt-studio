// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-DXY6mCVA.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-working-indicator.stories.tsx
var r = {
	title: "Patterns/Chat/Chat Panel/Working Indicator",
	component: e,
	render: (r) => /* @__PURE__ */ n(t, {
		w: "xl",
		h: "xl",
		children: /* @__PURE__ */ n(e, { ...r })
	}),
	args: {
		conversationKey: "work-timer",
		messages: [{
			id: "request",
			role: "user",
			parts: [{
				type: "text",
				text: "Complete the task."
			}]
		}],
		streaming: !0,
		emptyStateTitle: "No messages",
		emptyStateDescription: "Start a conversation.",
		chatInputPlaceholder: "Reply..."
	}
}, i = {}, a = { args: { streamingStartedAt: Date.now() - 3e5 } };
export { a as AnchoredRun, i as WithoutAnchor, r as default };
