// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, h as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-CAnDU0Lx.ts";
import { t as a } from "./alert-D8nHP1tF.ts";
import { useState as o } from "react";
import { Box as s, Button as c, Input as l, Stack as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-panel-composer-fallback.stories.tsx
var p = (e) => e.querySelector("[role=\"textbox\"][contenteditable=\"true\"]"), m = (e) => {
	let [t, n] = o(!0), [r, l] = o("Keep this unsent draft.");
	return /* @__PURE__ */ f(u, {
		h: "lg",
		children: [/* @__PURE__ */ d(c, {
			size: "sm",
			onClick: () => n((e) => !e),
			children: "Toggle messaging availability"
		}), /* @__PURE__ */ d(s, {
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ d(i, {
				...e,
				chatInputDefaultValue: r,
				onChatInputChange: l,
				composerFallback: t ? /* @__PURE__ */ d(a, {
					status: "warning",
					title: "Messaging is unavailable"
				}) : void 0,
				submitDisabled: t || e.submitDisabled
			})
		})]
	});
}, h = {
	title: "Patterns/Chat/Composer Fallback",
	component: i,
	render: (e) => /* @__PURE__ */ d(m, { ...e }),
	args: {
		messages: [{
			id: "reply",
			role: "assistant",
			parts: [{
				type: "text",
				text: "The saved conversation stays visible."
			}]
		}],
		emptyStateTitle: "Conversation",
		emptyStateDescription: "",
		chatInputPlaceholder: "Reply...",
		actions: /* @__PURE__ */ d(c, {
			size: "xs",
			children: "Message settings"
		}),
		attachmentActions: /* @__PURE__ */ d(c, {
			size: "xs",
			children: "Upload files"
		}),
		workspaceHub: /* @__PURE__ */ d(c, {
			size: "xs",
			children: "Select workspace"
		})
	},
	play: async ({ canvasElement: e }) => {
		let i = t(e);
		await r(p(e)).not.toBeInTheDocument(), await r(i.queryByRole("button", { name: "Upload files" })).not.toBeInTheDocument(), await r(i.queryByRole("button", { name: "Message settings" })).not.toBeInTheDocument(), await r(i.getByRole("button", { name: "Select workspace" })).toBeVisible(), await n.click(i.getByRole("button", { name: "Toggle messaging availability" }));
		let a = p(e);
		await r(a).toHaveTextContent("Keep this unsent draft."), await n.click(a), await n.keyboard(" More details.");
		let o = a.textContent;
		await n.click(i.getByRole("button", { name: "Toggle messaging availability" })), await r(p(e)).not.toBeInTheDocument(), await n.click(i.getByRole("button", { name: "Toggle messaging availability" })), await r(p(e)).toHaveTextContent(o);
	}
}, g = {}, _ = { globals: { theme: "pstdio-dark" } }, v = {
	args: {
		queuedFollowUps: [{
			id: "queued",
			prompt: "Review the changes.",
			position: 1
		}],
		onQueuedFollowUpUpdate: e()
	},
	play: async ({ canvasElement: e }) => {
		let i = t(e), a = i.getByRole("button", { name: "Toggle messaging availability" });
		await n.click(a), await n.click(i.getByRole("button", { name: /^Edit queued message:/ })), await n.click(p(e)), await n.keyboard(" Keep this edit.");
		let o = p(e).textContent;
		await n.click(a), await r(p(e)).not.toBeInTheDocument(), await n.click(a), await r(p(e)).toHaveTextContent(o), await n.click(i.getByRole("button", { name: /^Cancel$/ })), await r(p(e)).toHaveTextContent("Keep this unsent draft.");
	}
}, y = {
	tags: ["!manifest"],
	args: {
		chatInputQuestionPrompt: {
			callId: "release-checks",
			questions: [{
				id: "validation",
				question: "Which checks should I run?",
				multiple: !0,
				allowCustomAnswer: !0,
				options: [{ label: "Targeted tests" }]
			}]
		},
		queuedFollowUps: [{
			id: "queued",
			prompt: "Review the release notes.",
			position: 1
		}],
		onSubmitMessage: e()
	},
	play: async ({ canvasElement: e, args: i }) => {
		let a = t(e), o = a.getByRole("button", { name: "Toggle messaging availability" });
		await n.click(o), await n.click(a.getByRole("checkbox", { name: "Targeted tests" })), await n.click(a.getByRole("checkbox", { name: "Other" }));
		let s = a.getByRole("textbox", { name: "Which checks should I run? (Other)" });
		await n.type(s, "Check the isolated preview"), await n.click(o), await r(s).toBeVisible(), await r(s).toHaveValue("Check the isolated preview"), await r(a.getByRole("checkbox", { name: "Targeted tests" })).toBeChecked(), await r(a.getByText("Messaging is unavailable")).toBeVisible(), await r(a.queryByText("Review the release notes.")).not.toBeInTheDocument(), await n.click(o), await r(s).toHaveValue("Check the isolated preview"), await n.click(o), await n.click(a.getByTestId("send-message-button")), await r(i.onSubmitMessage).toHaveBeenCalledWith(r.any(String), [], {
			callId: "release-checks",
			answers: [["Targeted tests", "Check the isolated preview"]]
		});
	}
}, b = {
	tags: ["!manifest"],
	args: { composerDecision: {
		id: "release-approval",
		controls: /* @__PURE__ */ d(l, {
			"aria-label": "Approval note",
			size: "sm"
		}),
		actions: [{
			id: "approve",
			label: "Approve and implement",
			variant: "primary"
		}],
		onAction: e()
	} },
	play: async ({ canvasElement: e, args: i }) => {
		let a = t(e), o = a.getByRole("button", { name: "Toggle messaging availability" });
		await n.click(o);
		let s = a.getByRole("textbox", { name: "Approval note" });
		await n.type(s, "Keep the existing release scope"), await n.click(o), await r(s).toBeVisible(), await r(s).toHaveValue("Keep the existing release scope"), await r(a.getByText("Messaging is unavailable")).toBeVisible(), await n.click(a.getByRole("button", { name: "Approve and implement" })), await r(i.composerDecision?.onAction).toHaveBeenCalledWith("approve");
	}
};
export { _ as Dark, b as RetainedConfirmation, g as RetainedDraft, y as RetainedQuestionAnswers, v as RetainedQueuedEdit, h as default };
