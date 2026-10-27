// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./tooltip-BweQW627.ts";
import { r as n } from "./chat-question-navigation-DvO6NA0-.ts";
import { r, t as i } from "./timeline-tool-blocks-BxxIzavI.ts";
import { useEffect as a, useRef as o, useState as s } from "react";
import { Button as c, HStack as l, Stack as u } from "@chakra-ui/react";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/chat-input-question-answers.ts
var p = (e, t) => e.id ?? `question-${t}`, m = (e, t, n) => Object.hasOwn(e, p(t, n)), h = (e, t, n) => {
	let { [p(t, n)]: r, ...i } = e;
	return i;
}, g = (e, t, n) => m(e, t, n) ? h(e, t, n) : {
	...e,
	[p(t, n)]: ""
}, _ = "Skipped the question.", v = (e, t) => e.callId ? {
	answers: t,
	callId: e.callId
} : { answers: t }, y = (e) => v(e, []), b = (e, t, n, i) => {
	let a = p(t, n), o = r(e, a) ?? [], s = o.includes(i);
	return t.multiple ? {
		...e,
		[a]: s ? o.filter((e) => e !== i) : [...o, i]
	} : {
		...e,
		[a]: s ? [] : [i]
	};
}, x = (e) => e ? JSON.stringify({
	callId: e.callId,
	delivery: e.delivery,
	questions: e.questions.map((e, t) => ({
		id: p(e, t),
		question: e.question,
		multiple: !!e.multiple,
		required: !!e.required,
		allowCustomAnswer: !!e.allowCustomAnswer,
		options: e.options.map((e) => ({
			label: e.label,
			description: e.description ?? ""
		}))
	}))
}) : "", S = (e, t, n) => {
	let r = n?.trim();
	return r ? e.multiple ? [...t, r] : [r] : t;
}, C = (e, t, n, i) => S(e, r(n, t) ?? [], r(i, t)), w = (e, t, n) => {
	let r = [];
	for (let i = 0; i < e.questions.length; i += 1) {
		let a = e.questions[i], o = C(a, p(a, i), t, n);
		o.length !== 0 && r.push(`${a.question}: ${o.join(", ")}`);
	}
	return r;
}, T = (e) => typeof e != "string", E = (e, t) => {
	if (T(t)) return t;
	let n = t.trim();
	return n.length === 0 ? {} : Object.fromEntries(e.questions.flatMap((e, t) => e.allowCustomAnswer ? [[p(e, t), n]] : []));
}, D = (e, t, n) => {
	if (!e) return typeof n == "string" ? n.trim() : "";
	let r = w(e, t, E(e, n)), i = typeof n == "string" ? n.trim() : "", a = e.questions.some((e) => e.allowCustomAnswer);
	return i.length > 0 && !a && r.push(`Additional response: ${i}`), r.join("\n");
}, O = (e, t, n) => {
	let r = E(e, n);
	return e.questions.map((e, n) => C(e, p(e, n), t, r));
}, k = (e, t, n) => {
	if (!e) return !1;
	let r = E(e, n);
	for (let n = 0; n < e.questions.length; n += 1) {
		let i = e.questions[n];
		if (!(!i.required || C(i, p(i, n), t, r).length > 0)) return !0;
	}
	return !1;
}, A = (e, t, n, r) => C(e, p(e, t), n, r).length > 0, j = (n) => {
	let { question: r, questionIndex: i, isActive: a, selectedOptionsByQuestion: o, customAnswersByQuestion: s, onSelectStep: l } = n, u = A(r, i, o, s), f = u ? "answered" : "not answered", p = a ? "outline" : "ghost";
	return /* @__PURE__ */ d(t, {
		content: r.question,
		children: /* @__PURE__ */ d(c, {
			id: `question-step-tab-${r.id}`,
			role: "tab",
			"aria-label": `${r.question} (${f})`,
			"aria-selected": a,
			"aria-controls": `question-step-panel-${r.id}`,
			size: "xs",
			variant: p,
			minW: "8",
			onClick: () => l(i),
			children: u ? /* @__PURE__ */ d(e, { "aria-hidden": "true" }) : i + 1
		})
	});
}, M = (e) => e.questions.map((e, t) => ({
	id: p(e, t),
	question: e.question,
	options: e.options,
	multiple: !!e.multiple,
	required: !!e.required,
	allowCustomAnswer: !!e.allowCustomAnswer
})), N = (e) => {
	let { questionPrompt: t, selectedOptionsByQuestion: c, customAnswersByQuestion: p, onToggleOption: h, onCustomAnswerChange: g } = e, { onToggleOther: _ } = e, { questions: v, isEditable: y } = e, [b, x] = s(0), S = o(null), C = n(), w = C?.selection, T = w?.revision;
	a(() => {
		T !== void 0 && S.current?.focus();
	}, [T]);
	let E = (e) => {
		w ? C?.selectStep(e) : x(e);
	}, D = Math.min(w?.index ?? b, v.length - 1), O = v[D], k = v.length > 1;
	return /* @__PURE__ */ f(u, {
		gap: "xs",
		pb: "sm",
		pt: k ? "0" : "xs",
		children: [k ? /* @__PURE__ */ d(l, {
			role: "tablist",
			"aria-label": "Question steps",
			gap: "1",
			minWidth: "0",
			children: v.map((e, t) => /* @__PURE__ */ d(j, {
				question: e,
				questionIndex: t,
				isActive: t === D,
				selectedOptionsByQuestion: c,
				customAnswersByQuestion: p,
				onSelectStep: E
			}, e.id))
		}) : null, /* @__PURE__ */ d(u, {
			ref: S,
			tabIndex: -1,
			id: `question-step-panel-${O.id}`,
			role: k ? "tabpanel" : void 0,
			"aria-labelledby": k ? `question-step-tab-${O.id}` : void 0,
			gap: "0",
			children: /* @__PURE__ */ d(i, {
				questions: [O],
				editable: y,
				selectedOptionsByQuestion: c,
				customAnswersByQuestion: p,
				onToggleOption: (e, n, i) => {
					let a = t.questions[D], o = (r(c, O.id) ?? []).length > 0 || m(p, a, D);
					h(a, D, i), !a.multiple && !o && D < v.length - 1 && (S.current?.focus(), E(D + 1));
				},
				onToggleOther: () => {
					_(t.questions[D], D);
				},
				onCustomAnswerChange: (e, n, r) => {
					g(t.questions[D], D, r);
				}
			})
		})]
	});
}, P = (e) => {
	let { questionPrompt: t } = e, n = M(t), r = x(t);
	return /* @__PURE__ */ d(N, {
		...e,
		questions: n
	}, r);
}, F = (e) => Object.fromEntries((e?.questions ?? []).flatMap((t, n) => e?.delivery === "async" && t.options.length ? [[p(t, n), [t.options[0].label]]] : [])), I = (e, t) => {
	let [n, r] = s(() => F(e)), [i, c] = s({}), l = x(e), u = o(JSON.stringify([l, t ?? null]));
	return a(() => {
		let n = JSON.stringify([l, t ?? null]);
		u.current !== n && (u.current = n, r(F(e)), c({}));
	}, [
		l,
		t,
		e
	]), {
		signature: l,
		selectedOptionsByQuestion: n,
		customAnswersByQuestion: i,
		reset: () => {
			r(F(e)), c({});
		},
		restore: (e, t) => {
			r(e), c(t);
		},
		toggleOption: (e, t, n) => {
			r((r) => b(r, e, t, n)), e.multiple || c((n) => h(n, e, t));
		},
		toggleOther: (e, t) => {
			c((n) => g(n, e, t)), e.multiple || r((n) => ({
				...n,
				[p(e, t)]: []
			}));
		},
		setCustomAnswer: (e, t, n) => {
			let r = p(e, t);
			c((e) => ({
				...e,
				[r]: n
			}));
		},
		responseText: e ? D(e, n, i) : "",
		hasMissingRequiredAnswer: k(e, n, i),
		buildAnswers: () => e ? O(e, n, i) : []
	};
};
export { x as a, y as i, P as n, v as o, _ as r, I as t };
