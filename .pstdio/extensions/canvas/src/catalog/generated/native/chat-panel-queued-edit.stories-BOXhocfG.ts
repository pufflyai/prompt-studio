// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./chat-panel-DXY6mCVA.ts";
import { useState as a } from "react";
import { Box as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
var u = {
	title: "Patterns/Chat/Queued follow-up edit",
	component: () => {
		let [e, t] = a(""), [n, r] = a([{
			id: "queued-1",
			prompt: "Run the validation suite next.",
			position: 1
		}]);
		return /* @__PURE__ */ l(o, {
			h: "32rem",
			w: "full",
			maxW: "40rem",
			display: "flex",
			flexDirection: "column",
			children: [/* @__PURE__ */ c(o, {
				flex: "1",
				minH: "0",
				children: /* @__PURE__ */ c(i, {
					messages: [],
					streaming: !0,
					emptyStateTitle: "Agent is working",
					emptyStateDescription: "New messages wait in the queue.",
					chatInputPlaceholder: "Reply to the agent...",
					chatInputDefaultValue: e,
					onChatInputChange: t,
					queuedFollowUps: n,
					onQueuedFollowUpUpdate: (e, t) => r((n) => n.map((n) => n.id === e ? {
						...n,
						prompt: t
					} : n)),
					onQueuedFollowUpRemove: (e) => r((t) => t.filter((t) => t.id !== e))
				})
			}), /* @__PURE__ */ l(s, {
				textStyle: "label/S/regular",
				color: "fg.subtle",
				children: ["Stored draft: ", e || "(empty)"]
			})]
		});
	}
}, d = { play: async ({ canvasElement: t }) => {
	let i = e(t);
	await n.click(i.getByRole("button", { name: /^Edit queued message:/ }));
	let a = i.getAllByTestId("content-editable").at(-1);
	await n.click(a);
	let o = a.closest(".ps-chat-composer__input");
	await r(o).toHaveStyle({
		borderWidth: "0px",
		outlineStyle: "solid",
		outlineWidth: "1px"
	}), await n.click(i.getByText("Agent is working")), await r(o).toHaveStyle({
		borderWidth: "0px",
		outlineStyle: "none"
	});
} }, f = { play: async ({ canvasElement: i }) => {
	let a = e(i), o = () => a.getAllByTestId("content-editable").at(-1);
	await n.click(o()), await n.keyboard("Half-written note"), await t(() => r(a.getByText("Stored draft: Half-written note")).toBeVisible()), await n.click(a.getByRole("button", { name: /^Edit queued message:/ })), await t(() => r(o()).toHaveTextContent("Run the validation suite next.")), await n.click(o()), await n.keyboard(" Then summarize.{Enter}"), await t(() => r(a.getByText("Run the validation suite next. Then summarize.")).toBeVisible()), await t(() => r(o()).toHaveTextContent("Half-written note")), await r(a.getByText("Stored draft: Half-written note")).toBeVisible();
} }, p = { play: async ({ canvasElement: i }) => {
	let a = e(i), o = () => a.getAllByTestId("content-editable").at(-1);
	await n.click(o()), await n.keyboard("Run the validation suite next."), await n.click(a.getByRole("button", { name: /^Edit queued message:/ })), await n.click(o()), await n.keyboard(" Then summarize.{Enter}"), await t(() => r(a.getByText("Run the validation suite next. Then summarize.")).toBeVisible()), await t(() => r(o()).toHaveTextContent("Run the validation suite next.")), await r(a.getByText("Stored draft: Run the validation suite next.")).toBeVisible();
} };
export { d as EditingSurface, f as KeepDraftAfterQueuedEdit, p as KeepMatchingDraftAfterQueuedEdit, u as default };
