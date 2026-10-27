// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, p as t, r as n } from "./test-whhQHjQi.ts";
import { n as r, t as i } from "./chat-input-D_XW8kA_.ts";
import { t as a } from "./alert-D8nHP1tF.ts";
import { t as o } from "./harness-controls-BnCYJQpS.ts";
import { useState as s } from "react";
import { Button as c } from "@chakra-ui/react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/harness-controls.stories.tsx
var f = {
	title: "Patterns/Chat/Harness Controls",
	component: o,
	args: {
		modes: [],
		onAction: async () => {}
	}
}, p = (e) => {
	let [t, n] = s(""), [a, f] = s(!1);
	return /* @__PURE__ */ u(i, {
		defaultState: r(""),
		onChange: n,
		actions: /* @__PURE__ */ d(l, { children: [/* @__PURE__ */ u(c, {
			size: "xs",
			variant: "ghost",
			children: "Model"
		}), /* @__PURE__ */ u(o, {
			...e,
			modes: [],
			draftTag: a ? {
				label: "Goal",
				description: `Goal: ${t} · Draft`,
				onClose: () => f(!1)
			} : void 0
		})] }),
		commands: [
			{
				name: "/goal",
				description: "Use this draft as the objective.",
				onSelect: () => f(!0)
			},
			{
				name: "/plan",
				description: "Select native planning.",
				disabledReason: "Leave the goal first."
			},
			{
				name: "/compact",
				description: "Compact this thread."
			}
		]
	});
}, m = {
	render: (e) => /* @__PURE__ */ u(p, { ...e }),
	play: async ({ canvasElement: r }) => {
		let i = e(r);
		await t.type(i.getByRole("textbox"), "Finish the release notes /go");
		let a = await e(r.ownerDocument.body).findByRole("listbox", { name: "Harness commands" });
		await n(a).toBeVisible(), await t.click(e(a).getByRole("option", { name: "/goal" })), await n(i.getByRole("textbox").innerText.trim()).toBe("Finish the release notes");
		let o = i.getByRole("button", { name: /Goal: Finish the release notes/ });
		await n(o).toHaveTextContent("Goal"), await t.hover(o), await n(await e(r.ownerDocument.body).findByRole("tooltip")).toHaveTextContent(/Finish the release notes/), await t.click(i.getByRole("button", { name: "Remove Goal" })), await n(i.getByRole("textbox").innerText.trim()).toBe("Finish the release notes");
	}
}, h = {
	render: (e) => /* @__PURE__ */ u(i, {
		defaultState: r("Keep this unsent draft"),
		actions: /* @__PURE__ */ u(o, { ...e })
	}),
	args: { modes: [{
		id: "planning",
		label: "Plan",
		description: "Selected for the next turn.",
		state: "Next turn",
		closeActionId: "default",
		actions: [{
			id: "default",
			label: "Leave planning"
		}]
	}, {
		id: "goal",
		label: "Goal",
		description: "Finish the migration and verify the result.",
		state: "active · 1200 / 40000 tokens",
		indicator: {
			label: "Active",
			tone: "success"
		},
		tagText: "active: Finish the migration and verify the result.",
		closeActionId: "clear",
		actions: [
			{
				id: "pause",
				label: "Pause",
				icon: "pause"
			},
			{
				id: "edit",
				label: "Edit",
				icon: "pencil",
				argument: {
					label: "Objective",
					value: "Finish the migration"
				}
			},
			{
				id: "clear",
				label: "Clear",
				icon: "trash-2"
			}
		]
	}] },
	play: async ({ canvasElement: r }) => {
		let i = e(r), a = e(r.ownerDocument.body), o = i.getByRole("button", { name: "Goal details" });
		await n(o).toHaveTextContent("Goal"), o.focus(), await n(await a.findByRole("tooltip")).toHaveTextContent(/Finish the migration/), await t.click(o), await t.click(await a.findByRole("button", { name: "Edit" }));
		let s = await a.findByRole("textbox", { name: "Objective" });
		await t.clear(s), await t.type(s, "Revised native objective"), await t.click(a.getByRole("button", { name: "Apply" })), await n(i.getByRole("textbox").innerText).toBe("Keep this unsent draft");
	}
}, g = { args: {
	...h.args,
	pending: !0
} }, _ = h.args?.modes?.find((e) => e.id === "goal"), v = { args: { modes: _ ? [{
	..._,
	state: "paused · 1200 / 40000 tokens",
	indicator: {
		label: "Paused",
		tone: "warning"
	},
	actions: [{
		id: "resume",
		label: "Resume",
		icon: "play"
	}, ..._.actions.filter((e) => e.id !== "pause")]
}] : [] } }, y = { args: { modes: _ ? [{
	..._,
	state: "complete · 1200 / 40000 tokens",
	indicator: {
		label: "Complete",
		tone: "info"
	}
}] : [] } }, b = { args: {
	...h.args,
	unavailable: !0
} }, x = { args: { sentTag: {
	label: "Goal",
	description: "Finish the release notes · Native status is not confirmed. Closing hides this reference only.",
	onClose: () => {}
} } }, S = { render: (e) => /* @__PURE__ */ d(l, { children: [/* @__PURE__ */ u(a, {
	status: "error",
	title: "Command not sent",
	children: "This harness does not support this command. Your draft is ready to edit."
}), /* @__PURE__ */ u(o, { ...e })] }) };
export { y as CompletedGoal, h as IndependentModes, S as NativeError, m as NewConversation, v as PausedGoal, g as Pending, x as SentReference, b as StatusUnavailable, f as default };
