// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./use-question-prompt-state-DLGduPR4.ts";
import { useState as n } from "react";
import { Box as r, Button as i, Stack as a, Text as o } from "@chakra-ui/react";
import { jsx as s, jsxs as c } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/question-prompt-controls.stories.tsx
var l = { questions: [
	{
		id: "filter",
		question: "How many tags can the sidebar filter by?",
		required: !0,
		options: [{ label: "One tag at a time (recommended)" }, { label: "Several tags at once" }]
	},
	{
		id: "assumptions",
		question: "Tick each assumption you accept",
		multiple: !0,
		options: [{ label: "A note can have several tags, and names ignore case and spaces" }, { label: "Tags come from existing notes, with no separate tag list" }]
	},
	{
		id: "notes",
		question: "Corrections or other answers",
		options: []
	}
] };
function u(r) {
	let { prompt: l } = r, u = t(l), [d, f] = n();
	return /* @__PURE__ */ c(a, {
		gap: "sm",
		children: [
			/* @__PURE__ */ s(e, {
				isEditable: !0,
				questionPrompt: l,
				selectedOptionsByQuestion: u.selectedOptionsByQuestion,
				customAnswersByQuestion: u.customAnswersByQuestion,
				onToggleOption: u.toggleOption,
				onToggleOther: u.toggleOther,
				onCustomAnswerChange: u.setCustomAnswer
			}),
			/* @__PURE__ */ s(i, {
				alignSelf: "start",
				size: "sm",
				disabled: u.hasMissingRequiredAnswer,
				onClick: () => f(u.buildAnswers()),
				children: "Submit answer"
			}),
			d ? /* @__PURE__ */ s(o, {
				textStyle: "label/S/regular",
				children: JSON.stringify(d)
			}) : null
		]
	});
}
var d = {
	title: "Patterns/Chat/Question form",
	component: u,
	decorators: [(e) => /* @__PURE__ */ s(r, {
		maxW: "2xl",
		p: "md",
		children: /* @__PURE__ */ s(e, {})
	})],
	args: { prompt: l }
}, f = {}, p = { args: { prompt: { questions: [l.questions[0]] } } };
export { p as SingleQuestion, f as StepTabs, d as default };
