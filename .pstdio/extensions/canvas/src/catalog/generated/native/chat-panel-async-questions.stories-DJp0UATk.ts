// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-DXY6mCVA.ts";
import { useState as t } from "react";
import { Box as n, Button as r, HStack as i, Stack as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-async-questions.stories.tsx
var l = {
	title: "Chat/ChatPanel/Async questions",
	component: e
}, u = (e, t) => ({
	id: e,
	role: "assistant",
	parts: [{
		type: "tool",
		tool: "question",
		callId: e,
		status: "pending",
		state: { input: {
			delivery: "async",
			questions: t.map((t, n) => ({
				...t,
				id: `${e}-${n}`,
				allowCustomAnswer: !0
			}))
		} }
	}]
}), d = [
	{
		id: "user",
		role: "user",
		parts: [{
			type: "text",
			text: "Prepare the release notes. Ask while you work."
		}]
	},
	u("first", [{
		question: "Which validation should I run?",
		options: ["Browser checks", "Targeted tests"]
	}, {
		question: "Who is it for?",
		options: []
	}]),
	u("second", [{
		question: "Which files should I include?",
		options: ["Release notes only", "All changed files"]
	}]),
	{
		id: "progress",
		role: "assistant",
		parts: [{
			type: "text",
			text: "I can review the changed files while you choose."
		}]
	}
], f = [
	d[0],
	u("long", [
		{
			question: "Should I validate the full release workflow in the browser, including onboarding, selecting a project, opening a session, submitting an async answer, and restoring the draft and attachments afterward? Or should I only run the targeted tests for the changed question controls before preparing the pull request?",
			options: ["Browser checks", "Targeted tests"]
		},
		{
			question: "Which color?",
			options: ["Blue", "Green"]
		},
		{
			question: "Which environment?\nChoose one.",
			options: ["Local", "CI"]
		}
	]),
	d[3]
];
function p(l) {
	let { decision: p, terminal: m, long: h } = l, [g, _] = t(() => h ? f : m ? d.slice(0, 2) : d), [v, y] = t(""), [b, x] = t(!1);
	return /* @__PURE__ */ c(a, {
		height: "700px",
		gap: "md",
		children: [
			/* @__PURE__ */ c(i, { children: [/* @__PURE__ */ s(r, {
				onClick: () => x(!0),
				children: "Reject next answer"
			}), /* @__PURE__ */ s(r, {
				onClick: () => _((e) => [...e, u(`request-${e.length}`, [{
					question: "Which language?",
					options: ["TypeScript", "Python"]
				}])]),
				children: "Ask another"
			})] }),
			/* @__PURE__ */ s(o, { children: v }),
			/* @__PURE__ */ s(n, {
				flex: "1",
				minHeight: "0",
				children: /* @__PURE__ */ s(e, {
					conversationKey: "async-questions",
					messages: g,
					streaming: !m,
					emptyStateTitle: "Release workflow",
					emptyStateDescription: "",
					chatInputPlaceholder: "Message the agent...",
					chatInputDefaultValue: "Keep this unsent release draft",
					attachedResources: ["release-notes.md"],
					attachmentList: /* @__PURE__ */ s(o, { children: "release-notes.md" }),
					composerDecision: p ? {
						id: "plan-approval",
						model: "gpt-6.1-sol",
						actions: [{
							id: "approve",
							label: "Approve and implement",
							variant: "primary"
						}],
						onAction: async () => {}
					} : void 0,
					onSubmitMessage: async (e, t, n) => {
						if (n) {
							if (t.length) throw Error("Question answers must not include draft attachments");
							if (b) throw x(!1), Error("The provider rejected the answer");
							y(JSON.stringify(n)), _((e) => e.map((e) => ({
								...e,
								parts: e.parts.map((e) => e.type === "tool" && e.callId === n.callId ? {
									...e,
									status: "completed",
									state: {
										...e.state,
										output: { answers: n.answers }
									}
								} : e)
							})));
						}
					}
				})
			})
		]
	});
}
var m = { render: () => /* @__PURE__ */ s(p, {}) }, h = { render: () => /* @__PURE__ */ s(p, { decision: !0 }) }, g = { render: () => /* @__PURE__ */ s(p, { terminal: !0 }) }, _ = { render: () => /* @__PURE__ */ s(p, { long: !0 }) };
export { _ as LongMultilineQuestion, m as PendingAndAnswered, g as QuestionOnlyTail, h as WithPlanDecision, l as default };
