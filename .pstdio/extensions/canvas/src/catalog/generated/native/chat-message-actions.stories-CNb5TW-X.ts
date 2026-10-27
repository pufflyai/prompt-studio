// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, r as t } from "./test-whhQHjQi.ts";
import { t as n } from "./chat-panel-DXY6mCVA.ts";
import { Box as r, HStack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-message-actions.stories.tsx
var c = [
	{
		id: "completed-user-1",
		role: "user",
		createdAt: Date.UTC(2026, 7, 6, 12),
		parts: [{
			type: "text",
			text: "Make the change."
		}]
	},
	{
		id: "completed-commentary",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 12, 1),
		parts: [{
			type: "text",
			text: "I will inspect it."
		}]
	},
	{
		id: "completed-tool",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 12, 2),
		parts: [{
			type: "tool",
			tool: "read",
			status: "completed"
		}]
	},
	{
		id: "completed-final",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 12, 3),
		parts: [{
			type: "text",
			text: "The change is complete."
		}]
	},
	{
		id: "completed-user-2",
		role: "user",
		createdAt: Date.UTC(2026, 7, 6, 12, 4),
		parts: [{
			type: "text",
			text: "Thanks."
		}]
	}
], l = [
	{
		id: "incomplete-user",
		role: "user",
		createdAt: Date.UTC(2026, 7, 6, 13),
		parts: [{
			type: "text",
			text: "Make the change."
		}]
	},
	{
		id: "incomplete-commentary-1",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 1),
		parts: [{
			type: "text",
			text: "First update."
		}]
	},
	{
		id: "incomplete-commentary-2",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 2),
		parts: [{
			type: "text",
			text: "Second update."
		}]
	},
	{
		id: "incomplete-tool-1",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 3),
		parts: [{
			type: "tool",
			tool: "read",
			status: "completed"
		}]
	},
	{
		id: "incomplete-tool-2",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 4),
		parts: [{
			type: "tool",
			tool: "grep",
			status: "completed"
		}]
	},
	{
		id: "incomplete-commentary-3",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 5),
		parts: [{
			type: "text",
			text: "Third update."
		}]
	},
	{
		id: "incomplete-tool-3",
		role: "assistant",
		createdAt: Date.UTC(2026, 7, 6, 13, 6),
		parts: [{
			type: "tool",
			tool: "shell",
			status: "running"
		}]
	}
], u = {
	title: "Patterns/Chat/Message Actions",
	component: n,
	parameters: { layout: "padded" }
}, d = {
	emptyStateTitle: "No messages yet",
	emptyStateDescription: "Send a message to start this session.",
	chatInputPlaceholder: "Type a message..."
}, f = {
	render: () => /* @__PURE__ */ s(i, {
		alignItems: "flex-start",
		gap: "md",
		children: [/* @__PURE__ */ s(r, {
			"data-message-action-example": "completed",
			width: "480px",
			children: [/* @__PURE__ */ o(a, {
				textStyle: "label/S/medium",
				mb: "xs",
				children: "Completed turn"
			}), /* @__PURE__ */ o(r, {
				height: "480px",
				borderWidth: "1px",
				borderRadius: "md",
				overflow: "hidden",
				children: /* @__PURE__ */ o(n, {
					...d,
					messages: c
				})
			})]
		}), /* @__PURE__ */ s(r, {
			"data-message-action-example": "incomplete",
			width: "480px",
			children: [/* @__PURE__ */ o(a, {
				textStyle: "label/S/medium",
				mb: "xs",
				children: "Incomplete turn"
			}), /* @__PURE__ */ o(r, {
				height: "480px",
				borderWidth: "1px",
				borderRadius: "md",
				overflow: "hidden",
				children: /* @__PURE__ */ o(n, {
					...d,
					messages: l,
					streaming: !0
				})
			})]
		})]
	}),
	play: async ({ canvasElement: n }) => {
		let r = e(n);
		await r.findByText("The change is complete."), await r.findByText("Third update.");
		let i = n.querySelector("[data-message-action-example=\"completed\"]"), a = n.querySelector("[data-message-action-example=\"incomplete\"]");
		t(i?.querySelectorAll("[data-chat-message-action-panel=\"true\"]")).toHaveLength(3), t(a?.querySelectorAll("[data-chat-message-action-panel=\"true\"]")).toHaveLength(1);
	}
};
export { f as TurnBoundaries, u as default };
