// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-CAnDU0Lx.ts";
import { useState as t } from "react";
import { Box as n, Button as r, Stack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-question-identity.stories.tsx
var c = {
	title: "Chat/ChatPanel/Question identity",
	component: e
};
function l() {
	let [c, l] = t(1), [u, d] = t();
	return /* @__PURE__ */ s(i, {
		height: "600px",
		gap: "md",
		children: [
			/* @__PURE__ */ o(r, {
				onClick: () => {
					l((e) => e + 1), d(void 0);
				},
				children: "Ask again"
			}),
			/* @__PURE__ */ o(a, { children: u ? JSON.stringify(u) : `Request ${c}` }),
			/* @__PURE__ */ o(n, {
				flex: "1",
				minHeight: "0",
				children: /* @__PURE__ */ o(e, {
					messages: [],
					streaming: !1,
					emptyStateTitle: "Choose an audience",
					emptyStateDescription: "Each request has its own question identity.",
					chatInputPlaceholder: "Answer the question...",
					chatInputQuestionPrompt: {
						callId: `request-${c}`,
						questions: [{
							id: "audience",
							question: "Who is it for?",
							options: [],
							required: !0,
							allowCustomAnswer: !0
						}]
					},
					onSubmitMessage: async (e, t, n) => {
						d(n);
					}
				})
			})
		]
	});
}
var u = { render: () => /* @__PURE__ */ o(l, {}) };
function d() {
	let [n, c] = t([]), l = (e, t, n) => c((r) => [...r, {
		id: e,
		role: "assistant",
		parts: [{
			type: "tool",
			tool: "question",
			callId: e,
			status: "pending",
			state: { input: { questions: [{
				question: t,
				options: n,
				custom: !0
			}] } }
		}]
	}]);
	return /* @__PURE__ */ s(i, {
		h: "600px",
		gap: "md",
		children: [/* @__PURE__ */ s(i, {
			direction: "row",
			children: [/* @__PURE__ */ o(r, {
				onClick: () => l("first", "Which language?", ["TypeScript", "Python"]),
				children: "Ask first"
			}), /* @__PURE__ */ o(r, {
				onClick: () => l("second", "Which validation?", ["Browser", "Native"]),
				children: "Ask another"
			})]
		}), /* @__PURE__ */ o(e, {
			messages: n,
			emptyStateTitle: "Release workflow",
			emptyStateDescription: "",
			chatInputDefaultValue: "Keep this unsent draft",
			attachedResources: ["draft.txt"],
			attachmentList: /* @__PURE__ */ o(a, { children: "draft.txt" }),
			onSubmitMessage: async (e, t, n) => {
				if (t.length) throw Error("A question answer must not contain draft files");
				c((e) => e.map((e) => ({
					...e,
					parts: e.parts.map((e) => e.type === "tool" && e.callId === n?.callId ? {
						...e,
						status: "completed",
						state: {
							...e.state,
							metadata: { answers: n.answers }
						}
					} : e)
				})));
			}
		})]
	});
}
var f = { render: () => /* @__PURE__ */ o(d, {}) };
export { f as QueuedRequests, u as RepeatedRequest, c as default };
