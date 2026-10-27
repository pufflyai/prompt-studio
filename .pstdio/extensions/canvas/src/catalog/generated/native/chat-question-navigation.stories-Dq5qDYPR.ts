// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-CAnDU0Lx.ts";
import { Box as a, Button as o } from "@chakra-ui/react";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-question-navigation.stories.tsx
var c = {
	title: "Patterns/Chat/Question navigation",
	component: i,
	tags: ["!manifest"],
	parameters: { layout: "centered" }
}, l = { questions: [
	{
		id: "greeting",
		question: "Choose a greeting",
		options: [{ label: "Hello" }, { label: "Hi" }],
		required: !0,
		allowCustomAnswer: !0
	},
	{
		id: "audience",
		question: "Choose an audience",
		options: [{ label: "World" }, { label: "Team" }],
		required: !0,
		allowCustomAnswer: !0
	},
	{
		id: "constraints",
		question: "Select constraints",
		options: [{ label: "Keep API stable" }, { label: "Add tests" }],
		multiple: !0,
		required: !0
	},
	{
		id: "delivery",
		question: "Choose delivery",
		options: [{ label: "Now" }, { label: "Later" }],
		required: !0
	}
] }, u = {
	render: () => /* @__PURE__ */ s(a, {
		w: "32rem",
		h: "24rem",
		children: /* @__PURE__ */ s(i, {
			messages: [],
			emptyStateTitle: "Question navigation",
			chatInputQuestionPrompt: l,
			actions: /* @__PURE__ */ s(o, {
				size: "xs",
				variant: "ghost",
				children: "gpt-6.1-sol"
			}),
			onSubmitMessage: () => {}
		})
	}),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = async (e) => {
			await r(i.getByRole("tab", { name: e })).toHaveAttribute("aria-selected", "true");
		};
		await n.click(i.getByText("Hello", { exact: !0 })), await a("Choose an audience (not answered)"), await r(i.getByRole("tabpanel")).toHaveFocus(), await n.click(i.getByRole("tab", { name: "Choose a greeting (answered)" })), await n.click(i.getByText("Hi", { exact: !0 })), await a("Choose a greeting (answered)"), await r(i.getByRole("radio", {
			name: "Hi",
			exact: !0
		})).toBeChecked(), await n.click(i.getByRole("tab", { name: "Choose an audience (not answered)" })), await n.click(i.getByText("Other", { exact: !0 })), await a("Choose an audience (not answered)"), await n.click(i.getByText("World", { exact: !0 })), await a("Choose an audience (answered)"), await n.click(i.getByRole("tab", { name: "Select constraints (not answered)" })), await n.click(i.getByText("Keep API stable", { exact: !0 })), await a("Select constraints (answered)"), await n.click(i.getByRole("tab", { name: "Choose delivery (not answered)" })), await n.click(i.getByText("Now", { exact: !0 })), await a("Choose delivery (answered)"), await r(i.getByRole("button", {
			name: "Send answer",
			exact: !0
		})).toBeEnabled();
	}
}, d = {
	...u,
	play: async ({ canvasElement: t }) => {
		let i = e(t);
		i.getByRole("radio", {
			name: "Hello",
			exact: !0
		}).focus(), await n.keyboard("[Space]"), await r(i.getByRole("tabpanel", { name: "Choose an audience (not answered)" })).toHaveFocus(), await n.tab(), await r(i.getByRole("radio", {
			name: "World",
			exact: !0
		})).toHaveFocus(), await n.keyboard("[Space]"), await r(i.getByRole("tabpanel", { name: "Select constraints (not answered)" })).toHaveFocus(), await n.tab(), await n.keyboard("[Space]"), await r(i.getByRole("checkbox", {
			name: "Keep API stable",
			exact: !0
		})).toBeChecked(), await r(i.getByRole("tab", { name: "Select constraints (answered)" })).toHaveAttribute("aria-selected", "true");
	}
}, f = {
	...u,
	play: async ({ canvasElement: i }) => {
		let a = e(i).getByRole("tab", { name: "Choose delivery (not answered)" });
		await n.hover(a);
		let o = await e(i.ownerDocument.body).findByRole("tooltip");
		await r(o).toHaveTextContent("Choose delivery"), await t(() => {
			let e = a.getBoundingClientRect(), t = o.getBoundingClientRect(), n = e.left + e.width / 2;
			r(t.left).toBeLessThanOrEqual(n), r(t.right).toBeGreaterThanOrEqual(n);
			let i = Math.min(Math.abs(t.top - e.bottom), Math.abs(e.top - t.bottom));
			r(i).toBeLessThan(e.height);
		});
	}
};
export { u as FirstRadioChoiceAdvances, d as KeyboardRadioChoiceAdvances, f as StepTooltipFollowsStep, c as default };
