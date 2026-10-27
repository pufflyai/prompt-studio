// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-right-C4vsuHeN.ts";
import { ct as t, lt as n, ot as r, st as i } from "./list-marker-width-plugin-q77pywDH.ts";
import { a, r as o } from "./chat-link-anchor-kdoOkLgc.ts";
import { a as s, i as c, n as l, t as u } from "./question-prompt-DIqKf96x.ts";
import { t as d } from "./alert-D8nHP1tF.ts";
import { n as f } from "./resource-badge-Cd8iYFfh.ts";
import { t as p } from "./rich-message-BDq8UfVC.ts";
import { t as m } from "./ai-response-BdnOY5G0.ts";
import { t as h } from "./chat-question-bubble-tyNUkJKt.ts";
import { r as g } from "./chat-question-navigation-DvO6NA0-.ts";
import { t as _ } from "./tool-invocation-timeline-DAOn-5O9.ts";
import { Box as v, Image as y, Spinner as b, Stack as x, chakra as S, useRecipe as C } from "@chakra-ui/react";
import { Fragment as w, jsx as T, jsxs as E } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-question-bubble.tsx
var D = (t) => {
	let { part: n } = t, r = s(n.state?.input), i = g(), a = C({ recipe: h });
	if (!r) return null;
	let o = c(n), d = o && !!i;
	return /* @__PURE__ */ T(x, {
		gap: "xs",
		align: "start",
		children: r.questions.map((t, r) => {
			let s = u(n, r) ?? t.options[0]?.label ?? "Your answer", c = i?.activeKey === l(n) && i?.selection?.index === r;
			return /* @__PURE__ */ E(S.button, {
				type: "button",
				css: a({ multiline: t.question.includes("\n") }),
				"data-state": o ? "pending" : "answered",
				disabled: !d,
				"aria-expanded": d ? c : void 0,
				"aria-label": `${t.question} → ${s}${d ? ". Open question" : ""}`,
				onClick: () => i?.open(n, r),
				children: [/* @__PURE__ */ T("span", {
					"data-question-text": !0,
					children: t.question
				}), /* @__PURE__ */ E("span", {
					"data-question-answer-row": !0,
					children: [/* @__PURE__ */ T(e, { "aria-hidden": "true" }), /* @__PURE__ */ T("span", {
						"data-question-answer": !0,
						children: s
					})]
				})]
			}, t.id);
		})
	});
}, O = (e) => e.type === "tool", k = (e) => e.filename ?? e.url.split("/").pop() ?? "attachment", A = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i, j = (e) => e.mediaType?.startsWith("image/") || A.test(k(e)), M = (e) => j(e) ? /* @__PURE__ */ T(y, {
	src: e.url,
	alt: `${k(e)} preview thumbnail`,
	boxSize: "18px",
	borderRadius: "xs",
	objectFit: "cover"
}) : void 0, N = (e, t) => {
	t ? t.open({
		source: e.url,
		origin: "reference"
	}) : typeof window < "u" && window.open(e.url, "_blank", "noopener,noreferrer");
}, P = (e) => {
	if (e.message && e.message.trim().length > 0) return e.message;
	let { errorType: t } = e;
	switch (t) {
		case "timeout": return "Session timed out.";
		case "crash": return "Session crashed unexpectedly.";
		case "permission": return "Permission denied.";
		default: return "An error occurred.";
	}
}, F = {
	info: "blue",
	warning: "orange",
	error: "red",
	success: "green",
	loading: "blue"
}, I = (e, t) => {
	let n = [], r = t;
	for (; r < e.length;) {
		let t = e[r];
		if (!O(t) || t.tool === "question" && s(t.state?.input)) break;
		n.push(t), r += 1;
	}
	return {
		invocations: n,
		nextIndex: r - 1
	};
};
function L(e) {
	let t = a();
	return /* @__PURE__ */ T(o, {
		handler: e.linkHandler ?? t,
		children: /* @__PURE__ */ T(R, { ...e })
	});
}
function R(e) {
	let { message: o, streaming: c = !1, hideQuestionForms: l = !1, toolInvocationTimeline: u } = e, h = a(), g = n(), y = t([o], h), x = u ?? _, S = o.parts ?? [], C = [];
	for (let e = 0; e < S.length; e += 1) {
		let t = S[e], n = `${o.id}-${e}`;
		switch (t.type) {
			case "text":
				C.push(/* @__PURE__ */ T(r, {
					value: g.get(t) ?? y.get(t) ?? i,
					children: /* @__PURE__ */ T("div", { children: /* @__PURE__ */ T(m, {
						streaming: c,
						children: t.text
					}) })
				}, n));
				break;
			case "reasoning":
				C.push(/* @__PURE__ */ T(v, {
					padding: "0",
					css: { "& .rich-text, & .rich-text *": {
						color: "fg.subtle !important",
						fontSize: ".75rem !important",
						fontWeight: "normal !important"
					} },
					children: /* @__PURE__ */ T(p, {
						defaultState: t.text,
						fullWidth: !0
					})
				}, n));
				break;
			case "tool": {
				if (t.tool === "question" && s(t.state?.input)) {
					C.push(/* @__PURE__ */ T(D, { part: t }, n));
					break;
				}
				let { invocations: r, nextIndex: i } = I(S, e);
				e = i, C.push(/* @__PURE__ */ T(v, {
					width: "full",
					children: /* @__PURE__ */ T(x, {
						invocations: r,
						linkHandler: h,
						labeledBlocks: !0,
						hideQuestionForms: l
					})
				}, n));
				break;
			}
			case "file":
				C.push(/* @__PURE__ */ T(v, {
					width: "fit-content",
					children: /* @__PURE__ */ T(f, {
						fileName: k(t),
						size: "sm",
						tone: "neutral",
						icon: M(t),
						onSelect: () => N(t, h)
					})
				}, n));
				break;
			case "error":
				C.push(/* @__PURE__ */ T(v, {
					py: "2",
					width: "full",
					children: /* @__PURE__ */ T(d, {
						borderRadius: "xs",
						status: "error",
						colorPalette: "red",
						title: P(t),
						size: "sm"
					})
				}, n));
				break;
			case "token_usage": break;
			case "alert":
				C.push(/* @__PURE__ */ T(v, {
					width: "full",
					children: /* @__PURE__ */ T(d, {
						borderRadius: "xs",
						status: t.status === "loading" ? "info" : t.status,
						colorPalette: F[t.status],
						title: t.title,
						icon: t.status === "loading" ? /* @__PURE__ */ T(b, { size: "sm" }) : void 0,
						size: "sm",
						children: t.message
					})
				}, n));
				break;
			default: C.push(null);
		}
	}
	return /* @__PURE__ */ T(w, { children: C });
}
// packages/ui/src/components/chat-ui/components/message-types.ts
var z = (e) => e === "user" || e === "assistant" || e === "developer" ? e : "assistant", B = (e) => {
	let t = e.parts ?? [];
	return t.length === 0 || t.some((e) => e.type === "text" && "text" in e) ? !1 : t.some((e) => e.type === "reasoning" || e.type === "tool");
}, V = (e) => e.text.trim().length > 0, H = (e) => e.title.trim().length > 0 || !!e.message?.trim(), U = (e) => {
	switch (e.type) {
		case "text":
		case "reasoning": return V(e);
		case "tool":
		case "file":
		case "error": return !0;
		case "alert": return H(e);
		default: return !1;
	}
}, W = (e) => e.type === "reasoning" || e.type === "tool" && e.tool.toLowerCase() !== "question", G = (e) => e.role === "user" || e.parts.length === 0 ? !1 : e.parts.every(W), K = (e) => {
	if (e.length === 0) return null;
	let [t, ...n] = e;
	return t ? {
		...t,
		role: "assistant",
		parts: e.flatMap((e) => e.parts),
		modelId: n.at(-1)?.modelId ?? t.modelId,
		providerId: n.at(-1)?.providerId ?? t.providerId
	} : null;
}, q = (e) => {
	let t = [];
	for (let n of e) {
		let e = t[t.length - 1];
		e && e.role === n.role && B(n) ? e.parts = [...e.parts ?? [], ...n.parts ?? []] : t.push({
			...n,
			parts: [...n.parts ?? []]
		});
	}
	return t;
}, J = (e, t = {}) => {
	let n = [], r = [], i = () => {
		r = [];
	};
	for (let t of e) {
		let e = (t.parts ?? []).filter(U);
		if (e.length === 0) continue;
		let a = e.length === t.parts.length ? t : {
			...t,
			parts: e
		};
		a.role === "user" ? (i(), n.push(a)) : G(a) ? r.push(a) : r.length > 0 ? (n.push({
			...a,
			parts: [...r.flatMap((e) => e.parts), ...a.parts]
		}), i()) : n.push(a);
	}
	if (t.streaming && r.length > 0) {
		let e = K(r);
		e && n.push(e);
	}
	return n;
}, Y = (e) => {
	let t = e.at(-1);
	return t?.role === "assistant" && t.parts.some((e) => e.type === "text" && V(e)) ? t.id : null;
}, X = (e) => {
	let t = [], n = [];
	for (let r of e) r.role === "user" ? t.push({
		userMessage: r,
		responses: []
	}) : t.length > 0 ? t[t.length - 1].responses.push(r) : n.push(r);
	return {
		groups: t,
		leadingResponses: n
	};
};
export { J as a, q as i, z as n, L as o, X as r, Y as t };
