// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useTranslation-DvWg4zeU.ts";
import { useState as t } from "react";
import { Button as n, Code as r, HStack as i, Input as a, Spinner as o, Stack as s } from "@chakra-ui/react";
import { CopyButton as c, EmptyState as l } from "@pstdio/ui";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
import { SelectionInput as f } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/shared/agents/harness-browser-progress.tsx
var p = (r) => {
	let { question: i, onReply: o } = r, { t: c } = e("projects"), [l, p] = t(i.type === "select" ? i.initial ?? i.options[0]?.id ?? "" : "");
	return /* @__PURE__ */ u(s, {
		asChild: !0,
		gap: "sm",
		w: "full",
		children: /* @__PURE__ */ d("form", {
			onSubmit: (e) => {
				e.preventDefault(), o(l), p("");
			},
			children: [i.type === "select" ? /* @__PURE__ */ u(f, {
				id: "account-choice",
				name: i.title,
				description: "",
				defaultValue: l,
				options: i.options.map((e) => ({
					id: e.id,
					name: e.label,
					description: e.description
				})),
				onChange: (e, t) => p(String(t)),
				hideLabel: !0,
				searchable: !0,
				fullWidth: !0
			}) : /* @__PURE__ */ u(a, {
				"aria-label": i.title,
				placeholder: i.placeholder,
				value: l,
				onChange: (e) => p(e.target.value),
				type: i.secret ? "password" : "text",
				autoComplete: "off",
				autoFocus: !0,
				size: "sm"
			}), /* @__PURE__ */ u(n, {
				type: "submit",
				size: "sm",
				variant: "outline",
				disabled: !l,
				children: c("harnessAccount.continue")
			})]
		})
	});
}, m = (t) => {
	let { name: a, action: f, prompt: m, question: h, message: g, onReply: _, onCancel: v } = t, { t: y } = e("projects"), b = y(m ? "harnessAccount.waiting" : "harnessAccount.starting"), x = m?.code ? y("harnessAccount.deviceInstructions") : b;
	return /* @__PURE__ */ u(l, {
		title: h?.title ?? y(f === "login" ? "harnessAccount.loginTitle" : "harnessAccount.logoutTitle", { name: a }),
		description: h ? void 0 : g ?? m?.message ?? x,
		icon: h ? void 0 : /* @__PURE__ */ u(o, { size: "lg" }),
		children: /* @__PURE__ */ d(s, {
			gap: "sm",
			align: "center",
			w: "full",
			maxW: "sm",
			children: [
				m?.code ? /* @__PURE__ */ d(i, {
					gap: "xs",
					children: [/* @__PURE__ */ u(r, { children: m.code }), /* @__PURE__ */ u(c, { text: m.code })]
				}) : null,
				m ? /* @__PURE__ */ u(n, {
					asChild: !0,
					size: "sm",
					variant: "outline",
					children: /* @__PURE__ */ u("a", {
						href: m.url,
						target: "_blank",
						rel: "noopener noreferrer",
						children: y("harnessAccount.openPage")
					})
				}) : null,
				h && _ ? /* @__PURE__ */ u(p, {
					question: h,
					onReply: _
				}, JSON.stringify(h)) : null,
				/* @__PURE__ */ u(n, {
					size: "sm",
					variant: "ghost",
					onClick: v,
					children: y("harnessAccount.cancel")
				})
			]
		})
	});
};
export { m as t };
