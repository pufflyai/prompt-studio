// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chat-panel-CAnDU0Lx.ts";
import { t as i } from "./workspace-hub-BZBU-L1T.ts";
import { Box as a, Button as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-width.stories.tsx
var c = [{
	id: "prompt",
	role: "user",
	parts: [{
		type: "text",
		text: "Review the release checks."
	}]
}, {
	id: "response",
	role: "assistant",
	parts: [{
		type: "text",
		text: Array.from({ length: 24 }, (e, t) => `Check ${t + 1}: Review service health, errors, timing, and remaining work.`).join("\n\n")
	}]
}], l = {
	title: "Patterns/Chat/Chat Panel Width",
	component: r,
	tags: ["chat-width"],
	parameters: { layout: "fullscreen" },
	args: {
		messages: c,
		emptyStateTitle: "No messages yet",
		emptyStateDescription: "Send a message to start this session.",
		chatInputPlaceholder: "Type a message...",
		workspaceHub: /* @__PURE__ */ s(i, {
			workspaceControl: /* @__PURE__ */ s(o, {
				size: "xs",
				variant: "ghost",
				children: "Release checks"
			}),
			additions: 0,
			deletions: 0
		}),
		queuedFollowUps: [{
			id: "queued",
			prompt: "Prepare the release notes.",
			position: 1
		}]
	}
}, u = async ({ canvasElement: r }) => {
	let i = await e(r).findByRole("log"), a = i.querySelector("[data-part=\"viewport\"]"), o = a.querySelector("[data-part=\"content\"]"), s = i.nextElementSibling, c = a.parentElement.querySelector(":scope > [data-part=\"scrollbar\"][data-orientation=\"vertical\"]");
	await t(() => {
		n(a.scrollHeight).toBeGreaterThan(a.clientHeight), n(getComputedStyle(a).visibility).toBe("visible"), n(c).toBeVisible();
	});
	let l = i.parentElement.getBoundingClientRect(), u = o.getBoundingClientRect(), d = s.getBoundingClientRect(), f = Math.min(l.width, 832);
	n(a.getBoundingClientRect().width).toBeCloseTo(l.width, 0), n(u.width).toBeCloseTo(f, 0), n(u.left + u.width / 2).toBeCloseTo(l.left + l.width / 2, 0), n(d.width).toBeCloseTo(u.width, 0), n(d.left).toBeCloseTo(u.left, 0), n(c.getBoundingClientRect().right).toBeGreaterThan(l.right - 12), n(a.scrollWidth).toBe(a.clientWidth);
}, d = {
	render: (e) => /* @__PURE__ */ s(a, {
		w: "1200px",
		maxW: "full",
		h: "680px",
		bg: "bg",
		children: /* @__PURE__ */ s(r, { ...e })
	}),
	play: u
}, f = {
	render: (e) => /* @__PURE__ */ s(a, {
		w: "420px",
		maxW: "full",
		h: "680px",
		bg: "bg",
		children: /* @__PURE__ */ s(r, { ...e })
	}),
	play: u
}, p = {
	...d,
	args: {
		messages: [],
		queuedFollowUps: []
	},
	play: void 0
};
export { p as EmptyWidePane, f as NarrowPane, d as WidePane, l as default };
