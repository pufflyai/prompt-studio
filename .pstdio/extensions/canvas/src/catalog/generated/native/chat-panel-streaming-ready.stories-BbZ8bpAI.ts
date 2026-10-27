// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, r as n } from "./test-whhQHjQi.ts";
import { t as r } from "./chat-panel-CAnDU0Lx.ts";
import { useEffect as i, useState as a } from "react";
import { Box as o, Button as s, Stack as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-streaming-ready.stories.tsx
var d = Array.from({ length: 12 }, (e, t) => `Earlier paragraph ${t + 1}.`).join("\n\n");
function f() {
	let [e, t] = a(d), [n, f] = a("closed"), p = n === "streaming";
	return i(() => {
		if (!p) return;
		let e = 0, n = 0, r = () => {
			n += 1;
			let i = `New paragraph ${n}.`;
			t((e) => `${e}\n\n${i}`), e = requestAnimationFrame(r);
		};
		return e = requestAnimationFrame(r), () => cancelAnimationFrame(e);
	}, [p]), /* @__PURE__ */ u(c, {
		h: "680px",
		w: "420px",
		maxW: "full",
		children: [
			/* @__PURE__ */ l(s, {
				onClick: () => f("streaming"),
				disabled: n !== "closed",
				children: "Open streaming conversation"
			}),
			/* @__PURE__ */ l(s, {
				onClick: () => f("stopped"),
				children: "Stop stream"
			}),
			/* @__PURE__ */ l(o, {
				flex: "1",
				minH: "0",
				children: n === "closed" ? null : /* @__PURE__ */ l(r, {
					conversationKey: "streaming-on-open",
					messages: [{
						id: "prompt",
						role: "user",
						parts: [{
							type: "text",
							text: "Continue the review."
						}]
					}, {
						id: "response",
						role: "assistant",
						parts: [{
							type: "text",
							text: e
						}]
					}],
					streaming: p,
					emptyStateTitle: "No messages",
					emptyStateDescription: "Send a message.",
					chatInputPlaceholder: "Reply to the review..."
				})
			})
		]
	});
}
var p = {
	title: "Patterns/Chat/Chat Panel Streaming Ready",
	component: f,
	parameters: { layout: "fullscreen" }
}, m = { play: async ({ canvasElement: r }) => {
	let i = e(r);
	i.getByRole("button", { name: "Open streaming conversation" }).click();
	let a = (await i.findByRole("log")).querySelector("[data-part=\"viewport\"]");
	try {
		await t(() => n(a).toBeVisible()), await n(r.querySelector(".streaming-text-chunk")).toBeVisible();
	} finally {
		i.getByRole("button", { name: "Stop stream" }).click();
	}
} };
export { m as OpensDuringContinuousStream, p as default };
