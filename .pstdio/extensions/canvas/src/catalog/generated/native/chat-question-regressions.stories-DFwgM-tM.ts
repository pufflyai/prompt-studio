// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./paperclip-CoBJq1oI.ts";
import { t } from "./chat-panel-DXY6mCVA.ts";
import { useState as n } from "react";
import { Box as r, Button as i, IconButton as a, Stack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-question-regressions.stories.tsx
var u = {
	title: "Patterns/Chat/Question interruptions",
	component: t,
	parameters: { layout: "centered" }
}, d = { questions: [{
	id: "choice",
	question: "Choose a greeting",
	options: [{ label: "Hello" }],
	required: !0
}] };
function f(u) {
	let { prompt: f, queued: p = !1, rejectFirst: m = !1, draft: h } = u, [g, _] = n(m), [v, y] = n(f), [b, x] = n(), [S, C] = n(p ? [{
		id: "queued-message",
		prompt: "Review the release notes",
		position: 1
	}] : []);
	return /* @__PURE__ */ l(o, {
		w: "32rem",
		gap: "sm",
		children: [
			p ? /* @__PURE__ */ c(i, {
				onClick: () => y(d),
				children: "Ask a question"
			}) : null,
			/* @__PURE__ */ c(r, {
				h: "24rem",
				children: /* @__PURE__ */ c(t, {
					messages: [],
					emptyStateTitle: "Question replies",
					emptyStateDescription: "Answer the question or skip it.",
					chatInputPlaceholder: "Type a message...",
					chatInputDefaultValue: h,
					attachmentActions: /* @__PURE__ */ c(a, {
						size: "xs",
						variant: "ghost",
						"aria-label": "Attach files",
						children: /* @__PURE__ */ c(e, { size: 14 })
					}),
					actions: /* @__PURE__ */ c(i, {
						size: "xs",
						variant: "ghost",
						children: "gpt-6.1-sol"
					}),
					queuedFollowUps: S,
					onQueuedFollowUpUpdate: (e, t) => {
						C((n) => n.map((n) => n.id === e ? {
							...n,
							prompt: t
						} : n));
					},
					chatInputQuestionPrompt: v,
					onSubmitMessage: (e, t, n) => {
						if (g) throw _(!1), Error("Question reply failed");
						x(n), y(void 0);
					}
				})
			}),
			/* @__PURE__ */ c(s, {
				as: "output",
				"aria-label": "Question response",
				children: JSON.stringify(b ?? null)
			})
		]
	});
}
var p = { render: () => /* @__PURE__ */ c(f, { queued: !0 }) }, m = { render: () => /* @__PURE__ */ c(f, {
	queued: !0,
	rejectFirst: !0
}) }, h = { render: () => /* @__PURE__ */ c(f, { prompt: d }) }, g = {
	tags: ["!manifest"],
	render: () => /* @__PURE__ */ c(f, {
		queued: !0,
		draft: "Keep my draft"
	}),
	parameters: { docs: { description: { story: "Select part of the draft, ask a question, answer it, then focus the draft. Its text and selection return." } } }
}, _ = { render: () => /* @__PURE__ */ c(f, { prompt: { questions: [
	"constructor",
	"__proto__",
	"toString"
].map((e) => ({
	id: e,
	question: `Answer ${e}`,
	options: [{ label: "Yes" }],
	required: !0,
	allowCustomAnswer: !0
})) } }) }, v = { render: () => /* @__PURE__ */ c(f, { prompt: { questions: [{
	id: "listed-value",
	question: "Choose the listed value",
	options: [{ label: "__pstdio_other__" }],
	required: !0
}] } }) }, y = { render: () => /* @__PURE__ */ c(f, { prompt: { questions: [{
	id: "listed-value",
	question: "Choose the listed value",
	options: [{ label: "__pstdio_other__" }],
	required: !0,
	allowCustomAnswer: !0
}] } }) };
export { h as AttachmentControlsDuringQuestion, g as DraftSelectionAfterQuestion, _ as InheritedQuestionIds, v as ListedOtherValue, y as ListedOtherValueWithCustomAnswer, p as QueuedEditInterruptedByQuestion, m as QueuedEditRejectedQuestionReply, u as default };
