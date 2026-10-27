// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chat-panel-DXY6mCVA.ts";
import { useEffect as t, useRef as n, useState as r } from "react";
import { Box as i, Button as a, HStack as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-question-stream.stories.tsx
var l = {
	title: "Patterns/Chat/Chat Panel/Question Stream",
	component: e,
	parameters: { layout: "padded" }
}, u = {
	w: "960px",
	maxW: "100%",
	h: "680px",
	bg: "bg",
	borderWidth: "1px",
	borderColor: "border",
	borderRadius: "lg",
	p: "md"
}, d = 9, f = 55, p = "assistant-question", m = "question-call-1", h = "assistant-resumed", g = {
	callId: m,
	questions: [
		{
			id: "implementation",
			question: "Which implementation path should I continue with?",
			options: [{
				label: "Minimal patch",
				description: "Keep the change focused on the question flow."
			}, {
				label: "Refactor first",
				description: "Clean the surrounding chat structure before continuing."
			}],
			required: !0
		},
		{
			id: "constraints",
			question: "Which constraints should I apply?",
			options: [
				{
					label: "Keep API stable",
					description: "Do not change public contracts."
				},
				{
					label: "Add Storybook coverage",
					description: "Document the user-facing state."
				},
				{
					label: "No backend changes",
					description: "Keep this scoped to UI behavior."
				}
			],
			multiple: !0,
			required: !0
		},
		{
			id: "notes",
			question: "Any additional notes before I resume?",
			options: [],
			allowCustomAnswer: !0
		}
	]
}, _ = [{
	id: "user-initial",
	role: "user",
	parts: [{
		type: "text",
		text: "Show me how the OpenCode stream pauses when it reaches a Question tool."
	}]
}, {
	id: p,
	role: "assistant",
	parts: [{
		type: "text",
		text: ""
	}]
}], v = "I am streaming the response until the Question tool appears. At that point the stream stops and the input switches to the question form.", y = (e) => [
	"Answer submitted. I can now resume the OpenCode conversation with that response.",
	"",
	e,
	"",
	"The previous question is shown as the submitted response instead of the full form, and the assistant stream continues from here."
].join("\n"), b = (e) => ({
	type: "tool",
	tool: "Question",
	callId: m,
	status: e ? "completed" : "pending",
	state: {
		status: e ? "completed" : "pending",
		input: g,
		output: e
	}
}), x = (e) => {
	let t = [];
	for (let n = 0; n < e.length; n += d) t.push(e.slice(n, n + d));
	return t;
}, S = (e) => {
	e.current !== null && (clearInterval(e.current), e.current = null);
}, C = (e, t, n) => e.map((e) => {
	if (e.id !== t) return e;
	let r = e.parts[0];
	return !r || r.type !== "text" ? e : {
		...e,
		parts: [{
			...r,
			text: n
		}, ...e.parts.slice(1)]
	};
}), w = (e) => e.map((e) => e.id === p ? {
	...e,
	parts: [...e.parts, b()]
} : e), T = (e, t) => e.map((e) => ({
	...e,
	parts: e.parts.map((e) => e.type !== "tool" || e.callId !== m ? e : b(t))
})), E = (e) => {
	let { timerRef: t, sourceText: n, onStart: r, onChunk: i, onComplete: a } = e, o = x(n), s = "", c = 0;
	S(t), r(), t.current = setInterval(() => {
		s += o[c] ?? "", i(s), c += 1, !(c < o.length) && (S(t), a());
	}, f);
};
function D() {
	let [i, l] = r(_), [u, d] = r(!0), [f, m] = r(Date.now), [b, x] = r(), D = n(null);
	return t(() => (l(_), x(void 0), E({
		timerRef: D,
		sourceText: v,
		onStart: () => d(!0),
		onChunk: (e) => l((t) => C(t, p, e)),
		onComplete: () => {
			l((e) => w(e)), x(g), d(!1);
		}
	}), () => S(D)), []), /* @__PURE__ */ s(e, {
		messages: i,
		streaming: u,
		streamingStartedAt: f,
		emptyStateTitle: "No messages yet",
		emptyStateDescription: "The stream will start automatically.",
		chatInputPlaceholder: "Answer the question...",
		chatInputQuestionPrompt: b,
		onSubmitMessage: (e, t) => {
			let n = {
				id: "user-answer",
				role: "user",
				parts: [{
					type: "text",
					text: e
				}]
			}, r = {
				id: h,
				role: "assistant",
				parts: [{
					type: "text",
					text: ""
				}]
			};
			console.log("Submitted answer", {
				text: e,
				attachments: t
			}), x(void 0), l((t) => [
				...T(t, e),
				n,
				r
			]), E({
				timerRef: D,
				sourceText: y(e),
				onStart: () => {
					m(Date.now()), d(!0);
				},
				onChunk: (e) => l((t) => C(t, h, e)),
				onComplete: () => d(!1)
			});
		},
		actions: /* @__PURE__ */ c(o, {
			gap: "2",
			children: [/* @__PURE__ */ s(a, {
				size: "xs",
				variant: "subtle",
				children: "OpenCode"
			}), /* @__PURE__ */ s(a, {
				size: "xs",
				variant: "subtle",
				children: "Question stream"
			})]
		})
	});
}
var O = { render: () => /* @__PURE__ */ s(i, {
	...u,
	children: /* @__PURE__ */ s(D, {})
}) };
export { O as StopsAtQuestionAndResumes, l as default };
