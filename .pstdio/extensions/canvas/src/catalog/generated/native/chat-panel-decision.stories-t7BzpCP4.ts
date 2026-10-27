// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-CAnDU0Lx.ts";
import { t as a } from "./harness-controls-BnCYJQpS.ts";
import { useState as o } from "react";
import { jsx as s } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-decision.stories.tsx
var c = (e) => {
	let [t, n] = o(!1), r = /* @__PURE__ */ s(a, {
		modes: [{
			id: "planning",
			label: "Plan",
			description: "Release workflow",
			state: "Awaiting approval",
			confirmation: {
				id: "proposal",
				title: "Approve plan",
				actionId: "implement"
			},
			actions: [{
				id: "implement",
				label: "Approve and implement"
			}]
		}],
		onAction: async () => {},
		onRequestConfirmation: () => n(!1)
	});
	return /* @__PURE__ */ s(i, {
		...e,
		actions: r,
		composerDecision: t || !e.composerDecision ? void 0 : {
			...e.composerDecision,
			controls: r,
			onAction: async (t) => {
				await e.composerDecision?.onAction(t), n(!0);
			}
		}
	});
}, l = {
	title: "Patterns/Chat/Composer Decision",
	component: i,
	render: (e) => /* @__PURE__ */ s(c, { ...e }),
	args: {
		messages: [{
			id: "plan",
			role: "assistant",
			parts: [{
				type: "text",
				text: "# Release workflow\n\n1. Update shared controls.\n2. Validate native state."
			}]
		}],
		chatInputDefaultValue: "Keep this unsent draft",
		chatInputPlaceholder: "Reply to the agent...",
		emptyStateTitle: "Conversation",
		emptyStateDescription: "",
		onSubmitMessage: e(),
		composerDecision: {
			id: "proposal",
			model: "gpt-5.5",
			actions: [
				{
					id: "skip",
					label: "Skip",
					variant: "ghost"
				},
				{
					id: "continue",
					label: "Continue planning",
					variant: "subtle"
				},
				{
					id: "approve",
					label: "Approve and implement",
					variant: "primary"
				}
			],
			onAction: e()
		}
	}
}, u = { play: async ({ canvasElement: e }) => {
	let i = t(e);
	await r(i.getByLabelText("Plan decision")).toBeVisible(), await n.click(i.getByRole("button", {
		name: "Continue planning",
		exact: !0
	})), await r(e.querySelector("[role=\"textbox\"][contenteditable=\"true\"]")).toHaveTextContent("Keep this unsent draft"), await n.click(i.getByRole("button", { name: "Plan details" })), await n.click(await t(e.ownerDocument.body).findByRole("button", {
		name: "Approve and implement",
		exact: !0
	})), await r(i.getByLabelText("Plan decision")).toBeVisible();
} }, d = { args: { composerDecision: {
	...l.args.composerDecision,
	actions: l.args.composerDecision.actions.map((e) => ({
		...e,
		disabled: e.id === "approve"
	}))
} } }, f = { args: { composerDecision: {
	...l.args.composerDecision,
	pending: !0
} } }, p = {
	args: {
		queuedFollowUps: [{
			id: "queued",
			prompt: "Keep this queued edit"
		}],
		onQueuedFollowUpUpdate: e()
	},
	play: async ({ canvasElement: e, args: i }) => {
		let a = t(e);
		await n.click(a.getByRole("button", { name: /^Edit queued message:/ })), await n.click(a.getByRole("button", {
			name: "Continue planning",
			exact: !0
		})), await r(e.querySelector("[role=\"textbox\"][contenteditable=\"true\"]")).toHaveTextContent("Keep this queued edit"), await r(i.onQueuedFollowUpUpdate).not.toHaveBeenCalled();
	}
}, m = { args: { composerDecision: {
	...l.args.composerDecision,
	onAction: async () => {
		throw Error("Provider unavailable");
	}
} } }, h = {
	args: { messages: [...l.args.messages, {
		id: "question",
		role: "assistant",
		parts: [{
			type: "tool",
			tool: "question",
			callId: "native-question",
			status: "pending",
			state: { input: { questions: [{
				question: "Which validation?",
				options: [{ label: "Browser" }, { label: "Native" }]
			}] } }
		}]
	}] },
	play: async ({ canvasElement: e }) => {
		await r(t(e).getByRole("radio", { name: "Browser" })).toBeVisible();
	}
};
export { m as Failed, h as NativeQuestionFirst, f as Pending, u as PlanApproval, p as QueuedEdit, d as Unavailable, l as default };
