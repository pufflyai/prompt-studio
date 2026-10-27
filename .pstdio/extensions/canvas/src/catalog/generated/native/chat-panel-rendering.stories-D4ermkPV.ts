// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-CAnDU0Lx.ts";
import { i as a, l as o, o as s, r as c, u as l } from "./chat-performance-story-utils-BZGYQfkk.ts";
import { useRef as u, useState as d } from "react";
import { Box as f, Button as p, HStack as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/performance/chat-rendering-fixtures.ts
var _ = o({
	sessionId: "rendering",
	turns: 500,
	textRepeat: 4,
	toolCallsPerTurn: 3
}), v = o({
	sessionId: "long-turn",
	turns: 1,
	textRepeat: 1,
	toolCallsPerTurn: 3
})[1], y = Array.from({ length: 5e3 }, (e, t) => ({
	...v,
	id: `response-${t}`
})), b = {
	"Rich turns": _,
	"Plain turns": _.map((e) => ({
		...e,
		parts: [{
			type: "text",
			text: e.role === "user" ? "Inspect the rendering." : "The response is ready."
		}]
	})),
	"1000 responses": [_[0], ...y.slice(0, 1e3)],
	"5000 responses": [_[0], ...y],
	"Large response": [_[0], {
		...v,
		id: "large-response",
		parts: [{
			type: "text",
			text: Array.from({ length: 100 }, () => v.parts.find((e) => e.type === "text")?.text).join("\n\n")
		}]
	}]
}, x = [{
	...v,
	id: "streamed-response"
}], S = async ({ canvasElement: i }) => {
	let a = e(i);
	await n.click(a.getByRole("button", { name: "Large response" }));
	let o = i.querySelector("[data-testid=\"rendering-chat\"]"), s = o.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]");
	await t(() => r(getComputedStyle(s).visibility).toBe("visible")), s.dispatchEvent(new WheelEvent("wheel", {
		deltaY: -100,
		bubbles: !0
	})), s.scrollTop = 400;
	let c = () => o.querySelector("[data-chat-message-list-item=\"user\"]"), l = () => Math.abs(c().getBoundingClientRect().top - s.getBoundingClientRect().top);
	await t(() => r(l()).toBeLessThan(20));
	for (let e of [1, -1]) for (let t = 0; t < 20; t++) await new Promise((e) => requestAnimationFrame(() => e())), s.scrollTop += e * 12, r(l()).toBeLessThan(20);
}, C = async ({ canvasElement: i }) => {
	let a = e(i), o = i.querySelector("[data-testid=\"rendering-chat\"]"), s = () => o.querySelector("[data-scope=\"scroll-area\"][data-part=\"viewport\"]"), c = () => t(() => {
		r(getComputedStyle(s()).visibility).toBe("visible"), r(o.querySelectorAll("[data-chat-message-list-item=\"response\"]").length).toBeGreaterThan(0);
	}), l = () => r(o.querySelectorAll("[data-chat-message-list-item=\"response\"]").length).toBeLessThan(30), u = () => t(() => r(s().scrollHeight - s().scrollTop - s().clientHeight).toBeLessThan(3));
	for (let i of [1e3, 5e3]) {
		await n.click(a.getByRole("button", { name: `${i} responses` })), await c(), await u(), l(), r(o.querySelector(`[data-chat-message-id="response-${i - 1}"]`)).not.toBeNull(), s().scrollTop = s().scrollHeight / 2, await t(() => r(o.querySelector(`[data-chat-message-id="response-${i - 1}"]`)).toBeNull()), l();
		let d = s().scrollTop;
		await n.click(a.getByRole("button", { name: "Hide chat" })), await n.click(a.getByRole("button", { name: "Show chat" })), await c(), await t(() => r(Math.abs(s().scrollTop - d)).toBeLessThan(3));
		let f = o.querySelector("[data-chat-message-list-item=\"user\"]");
		r(Math.abs(f.getBoundingClientRect().top - s().getBoundingClientRect().top)).toBeLessThan(20), await n.click(e(f).getByRole("button", { name: "Show more" })), await t(() => r(f.querySelector("[data-sticky-user-message-content=\"expanded\"]")).not.toBeNull()), await n.click(e(f).getByRole("button", { name: "Show less" })), await n.click(a.getByRole("button", { name: "Switch session" })), await c(), await u(), l(), await n.click(a.getByRole("button", { name: "Hide chat" })), await n.click(a.getByRole("button", { name: "Stream response" })), await t(() => r(a.getByRole("button", { name: "Stream response" })).toBeEnabled()), await n.click(a.getByRole("button", { name: "Show chat" })), await c(), await u(), r(o.querySelector("[data-chat-message-id=\"streamed-response\"]")).not.toBeNull(), await n.click(a.getByRole("button", { name: "Stream response" })), await t(() => r(a.getByRole("button", { name: "Stream response" })).toBeEnabled()), await u(), r(o.querySelector("[data-chat-message-id=\"streamed-response-2\"]")).not.toBeNull(), l();
	}
}, w = {
	title: "Patterns/Chat/Chat Panel Rendering",
	component: i,
	parameters: {
		layout: "fullscreen",
		controls: { disable: !0 }
	},
	tags: ["!manifest"]
};
function T() {
	let [e, t] = d([]), [n, r] = d("primary"), [o, _] = d(!1), [v, y] = d(!1), S = u(0), C = (e) => {
		r(e), t(b[e]), y(!1), _(!1), S.current = 0;
	}, w = async () => {
		S.current += 1;
		let e = S.current === 1 ? "" : `-${S.current}`;
		y(!0), await s({
			messages: x.map((t) => ({
				...t,
				id: t.id + e
			})),
			isCancelled: () => !1,
			appendMessage: (e) => t((t) => [...t, e]),
			updateText: (e, n, r) => t((t) => l(t, e, n, r))
		}), y(!1), a("chat-rendering:stream-complete");
	};
	return /* @__PURE__ */ g(f, {
		h: "100vh",
		display: "flex",
		flexDirection: "column",
		children: [/* @__PURE__ */ g(m, {
			flexWrap: "wrap",
			p: "sm",
			children: [
				Object.keys(b).map((e) => /* @__PURE__ */ h(p, {
					onClick: () => C(e),
					children: e
				}, e)),
				/* @__PURE__ */ h(p, {
					onClick: () => r((e) => e === "secondary" ? "primary" : "secondary"),
					children: "Switch session"
				}),
				/* @__PURE__ */ h(p, {
					onClick: () => _((e) => !e),
					children: o ? "Show chat" : "Hide chat"
				}),
				/* @__PURE__ */ h(p, {
					onClick: () => void w(),
					disabled: v,
					children: "Stream response"
				})
			]
		}), /* @__PURE__ */ h(f, {
			flex: "1",
			minH: "0",
			display: o ? "none" : "block",
			"data-testid": "rendering-chat",
			children: /* @__PURE__ */ h(i, {
				conversationKey: n,
				messages: e,
				streaming: v,
				...c
			})
		})]
	});
}
var E = { render: () => /* @__PURE__ */ h(T, {}) }, D = {
	render: E.render,
	play: C
}, O = {
	render: E.render,
	play: S
};
export { O as ContinuousScrolling, D as LongTurnScrolling, E as RenderingWorkloads, w as default };
