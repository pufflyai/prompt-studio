// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { n as i, t as a } from "./prompt-input-CCkHsRH6.ts";
import { useEffect as o, useState as s } from "react";
import { Button as c, Stack as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/ui/src/components/rich-text/prompt-input/prompt-input.stories.tsx
var f = {
	title: "Patterns/Editors/Prompt Editor",
	component: a,
	parameters: { layout: "padded" },
	args: {
		defaultState: JSON.stringify(i()),
		commands: [{
			name: "/plan",
			description: "Select native planning.",
			argumentHelp: "[task]"
		}, {
			name: "/compact",
			description: "Compact this thread."
		}]
	}
}, p = {}, m = { args: { isEditable: !1 } }, h = { args: { debug: !0 } }, g = { play: async ({ canvasElement: t }) => {
	let i = e(t), a = e(t.ownerDocument.body), o = i.getByRole("textbox");
	await n.type(o, "/"), await r(await a.findByRole("listbox", { name: "Typeahead menu" })).toBeVisible(), await n.keyboard("{ArrowDown}{Enter}"), await r(o.innerText).toBe("/compact "), await r(a.queryByRole("listbox", { name: "Typeahead menu" })).not.toBeInTheDocument();
} }, _ = { play: async ({ canvasElement: t }) => {
	let i = e(t), a = e(t.ownerDocument.body), o = i.getByRole("textbox");
	await n.type(o, "/pl"), await r(await a.findAllByRole("option")).toHaveLength(1), await n.keyboard("{Tab}"), await r(o.innerText).toBe("/plan "), await n.type(o, "Keep my task text"), await r(o).toHaveTextContent("/plan Keep my task text");
} }, v = { play: async ({ canvasElement: t }) => {
	let i = e(t), a = e(t.ownerDocument.body), o = i.getByRole("textbox");
	await n.type(o, "/"), await n.keyboard("{Escape}"), await r(o).toHaveTextContent("/"), await r(a.queryByRole("listbox", { name: "Typeahead menu" })).not.toBeInTheDocument();
} }, y = { play: async ({ canvasElement: t }) => {
	let i = e(t).getByRole("textbox");
	await n.type(i, "/"), await n.keyboard("{Shift>}{Enter}{/Shift}"), await n.type(i, "Keep this line"), await r(i.innerText).toContain("/\nKeep this line");
} }, b = (e) => {
	let { commands: t = [], ...n } = e, [r, i] = s(""), [c, l] = s(!1);
	return o(() => {
		if (r !== "/" || c) return;
		let e = setTimeout(() => l(!0), 250);
		return () => clearTimeout(e);
	}, [r, c]), /* @__PURE__ */ u(a, {
		...n,
		commands: c ? t : [],
		onChange: i
	});
}, x = {
	render: (e) => /* @__PURE__ */ u(b, { ...e }),
	play: async ({ canvasElement: t }) => {
		let i = e(t), a = e(t.ownerDocument.body);
		await n.type(i.getByRole("textbox"), "/"), await r(await a.findByRole("listbox", { name: "Typeahead menu" })).toBeVisible();
	}
}, S = (e) => {
	let [t, n] = s(!1), [r, i] = s(!0);
	return /* @__PURE__ */ d(l, {
		gap: "xs",
		children: [/* @__PURE__ */ u(a, {
			...e,
			isEditable: t,
			focusRequested: r,
			onFocusRequestComplete: () => i(!1)
		}), /* @__PURE__ */ u(c, {
			size: "xs",
			variant: "outline",
			alignSelf: "start",
			onClick: () => n(!0),
			children: "Unlock"
		})]
	});
}, C = {
	render: (e) => /* @__PURE__ */ u(S, { ...e }),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = a.getByRole("textbox");
		await r(o).not.toHaveFocus(), await n.click(a.getByRole("button", { name: "Unlock" })), await t(() => r(o).toHaveFocus());
	}
};
export { p as Basic, h as DebugView, x as DelayedDiscovery, v as DismissPopover, _ as FilterAndTab, C as FocusRequest, y as MultilineDraft, m as ReadOnly, g as SlashPopover, f as default };
