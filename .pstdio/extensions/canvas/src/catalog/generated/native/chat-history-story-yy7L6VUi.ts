// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-DXY6mCVA.ts";
import { useState as a } from "react";
import { Box as o, Button as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-history-story.tsx
var u = (e) => {
	let { prompts: t = [
		"Explain the project",
		"Show the next steps",
		"Summarize the plan"
	] } = e, [n, r] = a(""), [s, l] = a(t.map((e, t) => ({
		id: String(t),
		role: "user",
		parts: [{
			type: "text",
			text: e
		}]
	})));
	return /* @__PURE__ */ c(o, {
		w: "full",
		h: "600px",
		children: /* @__PURE__ */ c(i, {
			conversationKey: "prompt-history",
			messages: s,
			chatInputDefaultValue: n,
			onChatInputChange: r,
			emptyStateTitle: "Start a conversation",
			emptyStateDescription: "Send a prompt",
			chatInputPlaceholder: "Use Arrow Up to recall a prompt",
			onSubmitMessage: (e) => l((t) => [...t, {
				id: String(t.length),
				role: "user",
				parts: [{
					type: "text",
					text: e
				}]
			}])
		})
	});
}, d = (e) => t(async () => {
	let t = e.querySelector("[contenteditable=\"true\"]");
	return await n.click(t), await r(t).toHaveFocus(), t;
}), f = async ({ canvasElement: e }) => {
	let i = await d(e);
	for (let e of [
		"Control",
		"Meta",
		"Shift",
		"Alt"
	]) await n.keyboard(`{${e}>}{ArrowUp}{/${e}}`), await r(i.textContent).toBe("");
	for (let e of [
		"Summarize the plan",
		"Show the next steps",
		"Explain the project"
	]) await n.keyboard("{ArrowUp}"), await t(() => r(i).toHaveTextContent(e)), await r(i).toHaveFocus();
	await n.keyboard("{ArrowUp}"), await r(i).toHaveTextContent("Explain the project"), await n.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}"), await r(i.textContent).toBe(""), await n.keyboard("{ArrowUp}"), await n.paste(" revised"), await n.keyboard("{ArrowUp}"), await r(i).toHaveTextContent("Summarize the plan revised");
}, p = async ({ canvasElement: e }) => {
	let i = await d(e);
	for (let e = 12; e >= 1; e--) await n.keyboard("{ArrowUp}"), await t(() => r(i).toHaveTextContent(RegExp(`^Prompt ${e}$`))), await r(i).toHaveFocus();
	await n.keyboard("{ArrowUp}"), await r(i).toHaveTextContent(/^Prompt 1$/);
	for (let e = 2; e <= 12; e++) await n.keyboard("{ArrowDown}"), await t(() => r(i).toHaveTextContent(RegExp(`^Prompt ${e}$`)));
	await n.keyboard("{ArrowDown}"), await t(() => r(i.textContent).toBe(""));
}, m = async ({ canvasElement: e }) => {
	let i = await d(e);
	await n.keyboard("{ArrowUp}"), await t(() => r(i).toHaveTextContent("First line")), await r(i).toHaveTextContent("Second line"), await r(i.querySelectorAll("p")).toHaveLength(2), await n.keyboard("{ArrowUp}"), await t(() => r(i).toHaveTextContent("Earlier prompt")), await n.keyboard("{ArrowDown}{ArrowDown}"), await t(() => r(i.textContent).toBe(""));
}, h = async ({ canvasElement: e }) => {
	let t = await d(e);
	await n.paste("First line\nSecond line"), await n.keyboard("{ArrowUp}{ArrowDown}"), await r(t).toHaveTextContent("First line"), await r(t).toHaveTextContent("Second line");
}, g = () => {
	let [e, t] = a(0), [n, r] = a("Original prompt");
	return /* @__PURE__ */ l(o, {
		w: "full",
		h: "600px",
		children: [
			/* @__PURE__ */ c(s, {
				onClick: () => t((e) => e + 1),
				children: "Switch conversation"
			}),
			/* @__PURE__ */ c(s, {
				onClick: () => r("Updated prompt"),
				children: "Update history"
			}),
			/* @__PURE__ */ c(i, {
				conversationKey: String(e),
				messages: [{
					id: "same-first-message",
					role: "user",
					parts: [{
						type: "text",
						text: n
					}]
				}],
				emptyStateTitle: "Start a conversation",
				emptyStateDescription: "Send a prompt",
				chatInputPlaceholder: "Use Arrow Up to recall a prompt"
			})
		]
	});
}, _ = async ({ canvasElement: t }) => {
	let i = e(t), a = () => t.querySelector("[contenteditable=\"true\"]");
	await n.click(a()), await n.keyboard("{ArrowUp}"), await r(a()).toHaveTextContent("Original prompt"), await n.click(i.getByRole("button", { name: "Switch conversation" })), await r(a().textContent).toBe(""), await n.click(a()), await n.keyboard("{ArrowUp}"), await n.click(i.getByRole("button", { name: "Update history" })), await n.click(a()), await n.keyboard("{ArrowDown}"), await r(a()).toHaveTextContent("Original prompt");
};
export { p as a, _ as i, g as n, m as o, h as r, f as s, u as t };
