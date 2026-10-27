// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./full-conversation-normalized-BR4uyFU4.ts";
import { n as a, t as o } from "./chat-panel-CAnDU0Lx.ts";
import { t as s } from "./ai-message-3J9aywD3.ts";
import { i as c, n as l, o as u } from "./message-types-D5cSq-0y.ts";
import { Box as d, Stack as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/ai-conversation.stories.tsx
var h = i, g = {
	title: "Patterns/Chat/AI Conversation",
	component: a.Root,
	parameters: { layout: "padded" }
}, _ = c(h).slice(-18), v = [{
	id: "status-color-user-message",
	role: "user",
	parts: [{
		type: "text",
		text: "```ts\nconst STATUS_INDICATOR_COLOR_BY_STATUS: Record<string, string> = {\n  gray: \"gray.400\",\n  red: \"red.400\",\n  orange: \"orange.400\",\n  yellow: \"yellow.400\",\n  green: \"green.400\",\n  teal: \"teal.400\",\n  blue: \"blue.400\",\n  cyan: \"cyan.400\",\n  purple: \"purple.400\",\n  pink: \"pink.400\",\n};\n```\ninstead of the above, use the correct status colors"
	}]
}, {
	id: "status-color-assistant-message",
	role: "assistant",
	parts: [{
		type: "text",
		text: "I'll update the status indicator colors to use the semantic status tokens."
	}]
}], y = [
	{
		id: "tall-status-color-user-message",
		role: "user",
		parts: [{
			type: "text",
			text: [
				"Please replace this status indicator color map with the correct semantic status colors.",
				"",
				"```ts",
				"const STATUS_INDICATOR_COLOR_BY_STATUS: Record<string, string> = {",
				...Array.from({ length: 72 }, (e, t) => `  status${String(t + 1).padStart(2, "0")}: getStatusColor(statuses[${t}], theme),`),
				"};",
				"```",
				"",
				"Keep the result typed, preserve the existing status order, and explain the mapping after the code change."
			].join("\n")
		}]
	},
	{
		id: "tall-status-color-assistant-message-1",
		role: "assistant",
		parts: [{
			type: "text",
			text: "I'll replace the raw color palette map with the status color tokens and keep the mapping stable."
		}]
	},
	{
		id: "tall-status-color-assistant-message-2",
		role: "assistant",
		parts: [{
			type: "text",
			text: "The important behavior is that the expanded prompt can be reviewed without losing access to the rest of the conversation below it."
		}]
	},
	{
		id: "tall-status-color-assistant-message-3",
		role: "assistant",
		parts: [{
			type: "text",
			text: "Once the prompt scroll reaches its boundary, the conversation should continue scrolling so the assistant responses remain reachable."
		}]
	}
], b = (e, t, n) => {
	let r = e.querySelector(t);
	if (!r) throw Error(`Expected ${n}`);
	return r;
}, x = () => /* @__PURE__ */ p(d, {
	h: "640px",
	maxW: "960px",
	w: "full",
	borderWidth: "1px",
	borderRadius: "md",
	bg: "bg",
	overflow: "hidden",
	children: /* @__PURE__ */ m(a.Root, { children: [/* @__PURE__ */ p(a.Viewport, { children: /* @__PURE__ */ p(f, {
		gap: "sm",
		children: _.map((e) => /* @__PURE__ */ p(s.Root, {
			from: l(e.role),
			children: /* @__PURE__ */ p(s.Content, {
				from: l(e.role),
				children: /* @__PURE__ */ p(u, { message: e })
			})
		}, e.id))
	}) }), /* @__PURE__ */ p(a.ScrollToBottom, { "aria-label": "Scroll to latest message" })] })
}), S = { render: () => /* @__PURE__ */ p(x, {}) }, C = {
	render: () => /* @__PURE__ */ p(d, {
		h: "520px",
		maxW: "960px",
		w: "full",
		borderWidth: "1px",
		borderRadius: "md",
		bg: "bg",
		overflow: "hidden",
		children: /* @__PURE__ */ p(o, {
			messages: v,
			emptyStateTitle: "No messages yet",
			emptyStateDescription: "Send a message to start this session.",
			chatInputPlaceholder: "Type a message..."
		})
	}),
	play: async ({ canvasElement: t }) => {
		let n = await e(t).findByRole("button", { name: "Show more" }), i = t.querySelector(".ai-message__content");
		if (!i) throw Error("Expected a user message content element");
		await r(n).toBeVisible(), r(i.getBoundingClientRect().height).toBeLessThanOrEqual(128);
	}
}, w = {
	render: () => /* @__PURE__ */ p(d, {
		h: "520px",
		maxW: "960px",
		w: "full",
		borderWidth: "1px",
		borderRadius: "md",
		bg: "bg",
		overflow: "hidden",
		children: /* @__PURE__ */ p(o, {
			messages: y,
			emptyStateTitle: "No messages yet",
			emptyStateDescription: "Send a message to start this session.",
			chatInputPlaceholder: "Type a message..."
		})
	}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = await a.findByRole("button", { name: "Show more" });
		await n.click(o);
		let s = await a.findByRole("button", { name: "Show less" }), c = b(i, "[data-sticky-user-message-content=\"expanded\"]", "an expanded sticky user message content element"), l = b(i, "[data-scope=\"scroll-area\"][data-part=\"viewport\"]", "a conversation viewport element");
		await r(s).toBeVisible();
		let u = s.closest(".ai-message__content");
		if (!u) throw Error("Expected Show less to render inside the sticky user message");
		r(u.contains(c)).toBe(!0), r(u.contains(s)).toBe(!0), r(c.dataset.scope).toBe("scroll-area"), r(c.dataset.part).toBe("viewport"), r(c.scrollHeight).toBeGreaterThan(c.clientHeight), r(l.scrollHeight).toBeGreaterThan(l.clientHeight), l.scrollTop = 0, c.scrollTop = 0;
		let d = l.scrollTop;
		t.wheel(c, { deltaY: 160 }), c.scrollTop = Math.min(160, c.scrollHeight - c.clientHeight), r(c.scrollTop).toBeGreaterThan(0), r(l.scrollTop).toBe(d), await r(s).toBeVisible(), c.scrollTop = c.scrollHeight;
		let f = l.scrollTop;
		t.wheel(c, { deltaY: 160 }), l.scrollTop = Math.min(f + 160, l.scrollHeight - l.clientHeight), r(l.scrollTop).toBeGreaterThan(f), await n.click(s), await r(await a.findByRole("button", { name: "Show more" })).toBeVisible(), r(c.scrollTop).toBe(0);
	}
};
export { S as FullConversationPreview, C as MultilineUserMessageShowMore, w as TallUserMessageScrollHandoff, g as default };
