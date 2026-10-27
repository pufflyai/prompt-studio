// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e } from "./test-whhQHjQi.ts";
import { n as t, t as n } from "./chat-input-D_XW8kA_.ts";
import { t as r } from "./attachment-list-BxV5Ln_Q.ts";
import { a as i, o as a, r as o, s } from "./chat-history-story-yy7L6VUi.ts";
import { useState as c } from "react";
import { Box as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-input.stories.tsx
var d = {
	title: "Patterns/Chat/Chat Input",
	component: n,
	parameters: {
		layout: "centered",
		actions: { argTypesRegex: "^on(?!Change)[A-Z].*" }
	}
}, f = t(""), p = { args: {
	defaultState: f,
	placeholder: "Ask me something...",
	onSubmit: (e, t) => {
		console.log("Submitted text:", e), t.length > 0 && console.log("Submitted attachments:", t), alert(`Submitted: ${e}${t.length > 0 ? ` with ${t.length} attachments` : ""}`);
	}
} }, m = {
	render: (e) => /* @__PURE__ */ u(l, {
		w: "32rem",
		children: /* @__PURE__ */ u(n, { ...e })
	}),
	args: {
		defaultState: f,
		placeholder: "Generating response...",
		streaming: !0,
		onInterrupt: () => console.log("Interrupted")
	}
}, h = {
	render: (e) => /* @__PURE__ */ u(l, {
		w: "32rem",
		children: /* @__PURE__ */ u(n, { ...e })
	}),
	args: {
		defaultState: f,
		placeholder: "Ask me something...",
		autoFocus: !0,
		onSubmit: (e) => {
			console.log("Submitted text:", e), alert(`Submitted: ${e}`);
		}
	}
};
function g(e) {
	let { attachedResources: t = [], onClearAttachments: i, ...a } = e, [o, s] = c(t), l = o.length > 0 ? /* @__PURE__ */ u(r, {
		attachments: o,
		onSelect: (e) => console.log("Selected:", e),
		onRemove: (e) => {
			s((t) => t.filter((t) => t !== e));
		}
	}) : void 0;
	return /* @__PURE__ */ u(n, {
		...a,
		attachedResources: o,
		attachmentList: l,
		onClearAttachments: () => {
			s([]), i?.();
		}
	});
}
var _ = {
	render: (e) => {
		let t = {
			...e ?? {},
			defaultState: e?.defaultState ?? f,
			attachedResources: e?.attachedResources ?? []
		};
		return /* @__PURE__ */ u(g, { ...t });
	},
	args: {
		defaultState: f,
		placeholder: "Summarize the attached files...",
		attachedResources: ["workspace/customer-data.csv", "workspace/analysis-report.md"],
		onSubmit: (e, t) => {
			console.log("Submitted text:", e), console.log("Submitted attachments:", t), alert(`Submitted: ${e}${t.length > 0 ? ` with ${t.length} attachments` : ""}`);
		}
	}
}, v = {
	render: (e) => {
		let t = {
			...e ?? {},
			defaultState: e?.defaultState ?? f,
			attachedResources: []
		};
		return /* @__PURE__ */ u(g, { ...t });
	},
	args: {
		defaultState: f,
		placeholder: "Attach files when needed..."
	}
}, y = { questions: [{
	id: "language",
	question: "Which language do you want to use?",
	options: [
		{ label: "TypeScript" },
		{ label: "Python" },
		{ label: "Go" }
	],
	multiple: !1,
	required: !0
}] }, b = { questions: [{
	id: "focus",
	question: "What should the plan prioritize?",
	options: [
		{
			label: "Performance",
			description: "runtime and build time"
		},
		{
			label: "Reliability",
			description: "tests and retries"
		},
		{
			label: "Maintainability",
			description: "readability and structure"
		}
	],
	multiple: !0,
	required: !0
}] }, x = { questions: [{
	id: "constraints",
	question: "Select constraints and add custom notes if needed.",
	options: [
		{ label: "No backend changes" },
		{ label: "Keep API stable" },
		{ label: "Ship today" }
	],
	multiple: !0,
	allowCustomAnswer: !0
}] }, S = { questions: [{
	id: "greeting",
	question: "Which greeting should I use?",
	options: [{
		label: "Hello",
		description: "Use \"Hello\" as the greeting."
	}, {
		label: "Hi",
		description: "Use \"Hi\" as the greeting."
	}],
	required: !0,
	allowCustomAnswer: !0
}] }, C = { questions: [{
	id: "details",
	question: "What should I know before continuing?",
	options: [],
	required: !0,
	allowCustomAnswer: !0
}] }, w = { questions: [
	{
		id: "goal",
		question: "What should be built?",
		options: [],
		required: !0,
		allowCustomAnswer: !0
	},
	{
		id: "constraints",
		question: "Select constraints.",
		options: [
			{ label: "Keep API stable" },
			{ label: "No backend changes" },
			{ label: "Add tests" }
		],
		multiple: !0,
		required: !0
	},
	{
		id: "notes",
		question: "Anything else?",
		options: [],
		allowCustomAnswer: !0
	}
] }, T = { args: {
	defaultState: f,
	placeholder: "Add context if needed...",
	questionPrompt: y,
	onSubmit: (e) => {
		console.log("Submitted response:", e), alert(`Submitted response: ${e}`);
	}
} }, E = { args: {
	defaultState: f,
	placeholder: "Optional details...",
	questionPrompt: b,
	onSubmit: (e) => {
		console.log("Submitted response:", e), alert(`Submitted response: ${e}`);
	}
} }, D = { args: {
	defaultState: f,
	placeholder: "Add a custom answer...",
	questionPrompt: x,
	onSubmit: (e) => {
		console.log("Submitted response:", e), alert(`Submitted response: ${e}`);
	}
} }, O = { args: {
	defaultState: f,
	questionPrompt: S,
	onSubmit: (e, t, n) => {
		console.log("Submitted response:", e, n), alert(`${e}\n\n${JSON.stringify(n)}`);
	}
} }, k = { args: {
	defaultState: f,
	placeholder: "Answer the question...",
	questionPrompt: C,
	onSubmit: (e) => {
		console.log("Submitted response:", e), alert(`Submitted response: ${e}`);
	}
} }, A = { args: {
	defaultState: f,
	questionPrompt: w,
	onSubmit: (e) => {
		console.log("Submitted response:", e), alert(`Submitted response: ${e}`);
	}
} }, j = (e) => {
	let [r, i] = c(e.defaultState);
	return /* @__PURE__ */ u(l, {
		w: "32rem",
		children: /* @__PURE__ */ u(n, {
			...e,
			defaultState: r,
			onChange: (e) => i(t(e))
		})
	});
}, M = {
	render: (e) => /* @__PURE__ */ u(j, { ...e }),
	args: {
		defaultState: f,
		recentUserMessages: [
			"Summarize the plan",
			"Show the next steps",
			"Explain the project"
		],
		onSelectionChange: e(),
		onEditorStateChange: e()
	},
	play: s
}, N = {
	tags: ["!manifest"],
	render: M.render,
	args: {
		...M.args,
		recentUserMessages: Array.from({ length: 12 }, (e, t) => `Prompt ${12 - t}`)
	},
	play: i
}, P = {
	tags: ["!manifest"],
	render: M.render,
	args: {
		...M.args,
		recentUserMessages: ["First line\nSecond line", "Earlier prompt"]
	},
	play: a
}, F = {
	render: M.render,
	args: M.args,
	play: o
}, I = {
	tags: ["!manifest"],
	render: M.render,
	args: {
		...M.args,
		streaming: !0
	},
	play: s
};
export { p as Default, v as EmptyAttachmentTray, M as PromptHistory, F as PromptHistoryDraft, N as PromptHistoryFull, P as PromptHistoryMultiline, I as PromptHistoryStreaming, k as QuestionFreeform, A as QuestionMultiStep, E as QuestionMultipleChoice, T as QuestionSingleChoice, O as QuestionSingleChoiceWithOther, D as QuestionWithCustomAnswer, h as Selected, m as Streaming, _ as WithAttachments, d as default };
