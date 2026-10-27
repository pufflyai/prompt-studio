// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, i as t, m as n, p as r, r as i } from "./test-whhQHjQi.ts";
import { n as a, t as o } from "./chat-input-D_XW8kA_.ts";
import { useState as s } from "react";
import { Button as c, HStack as l, Input as u, Stack as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-input-delayed-enable.stories.tsx
var m = 400, h = (e) => {
	let { autoFocus: t = !1, lockedOnMount: n = !1 } = e, [r, i] = s(n), [h, g] = s(0), _ = () => {
		i(!0), setTimeout(() => i(!1), m);
	};
	return /* @__PURE__ */ p(d, {
		w: "32rem",
		gap: "xs",
		children: [/* @__PURE__ */ f(o, {
			defaultState: a(""),
			isDisabled: r,
			autoFocus: t,
			focusSignal: h,
			onSubmit: _
		}), /* @__PURE__ */ p(l, {
			gap: "xs",
			children: [
				/* @__PURE__ */ f(c, {
					size: "xs",
					variant: "outline",
					onClick: () => i(!1),
					children: "Unlock"
				}),
				/* @__PURE__ */ f(c, {
					size: "xs",
					variant: "outline",
					onClick: () => {
						_(), g((e) => e + 1);
					},
					children: "Load request"
				}),
				/* @__PURE__ */ f(u, {
					size: "xs",
					"aria-label": "Notes"
				})
			]
		})]
	});
}, g = {
	title: "Patterns/Chat/Chat Input/Delayed enable",
	component: h
}, _ = {
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = () => o.getByTestId("content-editable");
		await r.click(s()), await r.type(s(), "Follow-up message"), await t.keyDown(s(), {
			key: "Enter",
			code: "Enter"
		}), await n(() => i(s()).toHaveAttribute("contenteditable", "false")), await i(o.getByTestId("send-message-button")).toBeDisabled(), await n(() => i(s()).toHaveAttribute("contenteditable", "true")), await n(() => i(s()).toHaveFocus());
	}
}, v = {
	render: () => /* @__PURE__ */ f(h, {
		autoFocus: !0,
		lockedOnMount: !0
	}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = () => a.getByTestId("content-editable");
		await i(o()).toHaveAttribute("contenteditable", "false"), await r.click(a.getByRole("button", { name: "Unlock" })), await n(() => i(o()).toHaveAttribute("contenteditable", "true")), await n(() => i(o()).toHaveFocus());
	}
}, y = {
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: t }) => {
		let a = e(t), o = () => a.getByTestId("content-editable");
		await r.click(a.getByRole("button", { name: "Load request" })), await i(o()).toHaveAttribute("contenteditable", "false"), await n(() => i(o()).toHaveAttribute("contenteditable", "true")), await n(() => i(o()).toHaveFocus());
	}
}, b = {
	render: () => /* @__PURE__ */ f(h, {}),
	play: async ({ canvasElement: a }) => {
		let o = e(a), s = () => o.getByTestId("content-editable"), c = o.getByRole("textbox", { name: "Notes" });
		await r.click(s()), await r.type(s(), "Follow-up message"), await t.keyDown(s(), {
			key: "Enter",
			code: "Enter"
		}), await n(() => i(s()).toHaveAttribute("contenteditable", "false")), await r.type(c, "Remember the tests"), await n(() => i(s()).toHaveAttribute("contenteditable", "true")), await new Promise(requestAnimationFrame), await new Promise(requestAnimationFrame), await i(c).toHaveFocus(), await i(c).toHaveValue("Remember the tests");
	}
};
export { v as AutoFocusWhenUnlocked, y as FocusSignalWhenUnlocked, b as KeepsFocusInAnotherField, _ as RestoresFocus, g as default };
