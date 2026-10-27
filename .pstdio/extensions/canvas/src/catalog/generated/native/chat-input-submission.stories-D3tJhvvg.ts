// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { n as a, t as o } from "./chat-input-D_XW8kA_.ts";
import { useState as s } from "react";
import { Box as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
var f = {
	title: "Patterns/Chat/Follow-up submission",
	component: (e) => {
		let { fail: t, slow: n, question: r } = e, [i, f] = s([]), [p, m] = s(!0), [h, g] = s(!1);
		return /* @__PURE__ */ d(c, {
			w: "full",
			children: [
				/* @__PURE__ */ u(o, {
					defaultState: a("Seeded draft"),
					questionPrompt: r ? { questions: [{
						id: "language",
						question: "Choose a language",
						multiple: !0,
						allowCustomAnswer: !0,
						options: [{ label: "TypeScript" }]
					}] } : void 0,
					streaming: p,
					onInterrupt: () => m(!1),
					onSubmit: async (e) => {
						if (g(!0), t || f((t) => [...t, e]), n && await new Promise((e) => setTimeout(e, 1e3)), g(!1), t) throw Error("Submission failed");
					}
				}),
				/* @__PURE__ */ u(l, { children: h ? "Sending" : "Ready" }),
				/* @__PURE__ */ u(l, { children: p ? "Current turn is running" : "Response stopped" }),
				i.map((e, t) => /* @__PURE__ */ d(l, { children: ["Waiting: ", e] }, `${t}-${e}`))
			]
		});
	}
}, p = {}, m = {
	tags: ["!manifest"],
	args: {
		fail: !0,
		slow: !0
	},
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = () => a.getByTestId("content-editable");
		await r.click(a.getByTestId("send-message-button")), await n(() => i(a.getByText("Sending")).toBeVisible()), await i(o().textContent).toBe(""), await i(o()).toHaveAttribute("contenteditable", "false"), await n(() => i(a.getByText("Ready")).toBeVisible()), await i(o()).toHaveTextContent("Seeded draft"), await i(o()).toHaveAttribute("contenteditable", "true"), await n(() => i(o()).toHaveFocus());
	}
}, h = {
	tags: ["!manifest"],
	args: { slow: !0 },
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = () => o.getByTestId("content-editable"), c = o.getByTestId("send-message-button");
		await r.click(s()), await t.keyDown(s(), {
			key: "Enter",
			code: "Enter"
		}), await n(() => i(o.getByText("Sending")).toBeVisible()), await i(o.getByText("Waiting: Seeded draft")).toBeVisible(), await i(s().textContent).toBe(""), await i(s()).toHaveAttribute("contenteditable", "false"), await i(c).toBeDisabled(), await n(() => i(o.getByText("Ready")).toBeVisible()), await i(s().textContent).toBe(""), await n(() => i(s()).toHaveFocus());
	}
}, g = {
	tags: ["!manifest"],
	args: {
		fail: !0,
		slow: !0,
		question: !0
	},
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = a.getByRole("checkbox", { name: "TypeScript" }), s = a.getByRole("checkbox", { name: "Other" }), c = () => a.getByRole("textbox", { name: "Choose a language (Other)" });
		await r.click(o), await r.click(s), await r.type(c(), "Another language"), await r.click(a.getByTestId("send-message-button")), await n(() => i(a.getByText("Sending")).toBeVisible()), await i(o).not.toBeChecked(), await i(s).not.toBeChecked(), await i(a.queryByRole("textbox", { name: "Choose a language (Other)" })).not.toBeInTheDocument(), await i(o.closest("label")).toHaveAttribute("aria-readonly", "true"), await r.click(o), await i(o).not.toBeChecked(), await n(() => i(a.getByText("Ready")).toBeVisible()), await n(() => i(o).toBeChecked()), await i(s).toBeChecked(), await i(c()).toHaveValue("Another language"), await i(a.getByTestId("content-editable")).toHaveTextContent("Seeded draft");
	}
};
export { m as KeepFailedDraft, g as KeepFailedQuestionAnswers, p as QueueWhileRunning, h as SlowSubmission, f as default };
