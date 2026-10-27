// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { d as e, h as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { t as a } from "./chat-panel-CAnDU0Lx.ts";
import { useState as o } from "react";
import { Box as s } from "@chakra-ui/react";
import { jsx as c } from "react/jsx-runtime";
var l = {
	title: "Patterns/Chat/Measurement",
	component: () => {
		let [e, t] = o([]);
		return /* @__PURE__ */ c(s, {
			h: "96",
			w: "full",
			maxW: "container.sm",
			children: /* @__PURE__ */ c(a, {
				messages: e,
				emptyStateTitle: "No messages yet",
				emptyStateDescription: "Send a message to start this session.",
				chatInputPlaceholder: "Reply to the agent...",
				onSubmitMessage: (e) => {
					t((t) => [...t, {
						id: `message-${t.length}`,
						role: "user",
						parts: [{
							type: "text",
							text: e
						}]
					}]);
				}
			})
		});
	}
}, u = {
	tags: ["measurement-regression"],
	play: async ({ canvasElement: a }) => {
		let o = t(a), s = () => o.getAllByTestId("content-editable").at(-1), c = e(console, "error");
		try {
			await r.click(s()), await r.keyboard("Measure this message."), await n(() => i(o.getByTestId("send-message-button")).toBeEnabled()), await r.click(o.getByTestId("send-message-button")), await n(() => i(s()).toHaveTextContent(/^$/)), await n(() => i(o.getByText("Measure this message.")).toBeVisible()), i(c.mock.calls.filter((e) => e.some((e) => String(e).includes("flushSync")))).toEqual([]);
		} finally {
			c.mockRestore();
		}
	}
};
export { u as SendMessage, l as default };
