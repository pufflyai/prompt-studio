// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./checkbox-C3JJ0TWQ.ts";
import { n as t, t as n } from "./radio-BKAZ8M9R.ts";
import { Box as r, Stack as i, Text as a, Textarea as o } from "@chakra-ui/react";
import { Fragment as s, jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/components/question-choices.ts
var u = "Other", d = "__pstdio_other__", f = (e, t) => Object.hasOwn(e, t) ? e[t] : void 0, p = (e) => !!e.allowCustomAnswer && e.options.length > 0, m = (e) => {
	e.preventDefault();
}, h = (e) => {
	let { option: t } = e;
	return /* @__PURE__ */ l(i, {
		gap: "0",
		minWidth: "0",
		children: [/* @__PURE__ */ c(a, {
			textStyle: "label/S/regular",
			color: "fg",
			children: t.label
		}), t.description ? /* @__PURE__ */ c(a, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			children: t.description
		}) : null]
	});
}, g = (t) => {
	let { option: n, name: r, checked: i, editable: a, onToggle: o } = t;
	return /* @__PURE__ */ c(e, {
		name: r,
		checked: i,
		readOnly: !a,
		"aria-readonly": a ? void 0 : "true",
		inputProps: a ? void 0 : { tabIndex: -1 },
		alignItems: "flex-start",
		onCheckedChange: a ? o : void 0,
		children: /* @__PURE__ */ c(h, { option: n })
	});
}, _ = (e) => {
	let { question: r, questionIndex: i, name: a, selectedOption: o, otherSelected: s, editable: f, onToggleOption: m, onToggleOther: g } = e, { otherField: _ } = e, v = p(r), y = r.options.findIndex((e) => e.label === o);
	return /* @__PURE__ */ l(t, {
		name: a,
		value: s ? d : y === -1 ? null : String(y),
		readOnly: !f,
		"aria-readonly": f ? void 0 : "true",
		display: "flex",
		flexDirection: "column",
		gap: "xs",
		onValueChange: f ? (e) => {
			e.value && (e.value === "__pstdio_other__" ? g?.(r, i) : m?.(r, i, r.options[Number(e.value)].label));
		} : void 0,
		children: [
			r.options.map((e, t) => /* @__PURE__ */ c(n, {
				value: String(t),
				inputProps: f ? void 0 : { tabIndex: -1 },
				alignItems: "flex-start",
				children: /* @__PURE__ */ c(h, { option: e })
			}, e.label)),
			v ? /* @__PURE__ */ c(n, {
				value: d,
				inputProps: f ? void 0 : { tabIndex: -1 },
				alignItems: "flex-start",
				children: /* @__PURE__ */ c(h, { option: { label: u } })
			}) : null,
			s ? _ : null
		]
	});
}, v = (t) => {
	let { items: n } = t;
	return /* @__PURE__ */ c(i, {
		as: "ul",
		gap: "0",
		listStyleType: "none",
		margin: "0",
		padding: "0",
		children: n.map((t, n) => /* @__PURE__ */ c(r, {
			as: "li",
			children: /* @__PURE__ */ c(e, {
				checked: t.checked,
				readOnly: !0,
				"aria-readonly": "true",
				inputProps: { tabIndex: -1 },
				size: "xs",
				children: /* @__PURE__ */ c(a, {
					textStyle: "label/XS/regular",
					color: "fg",
					children: t.label
				})
			})
		}, `${t.label}-${n}`))
	});
}, y = (e) => {
	let { question: t, questionIndex: n, editable: r, customAnswer: i, onCustomAnswerChange: a, hasOtherChoice: s } = e;
	return /* @__PURE__ */ c(o, {
		readOnly: !r,
		"aria-readonly": r ? void 0 : "true",
		value: i ?? "",
		placeholder: r ? s ? "Type your answer..." : "Answer..." : "Answer",
		"aria-label": s ? `${t.question} (${u})` : t.question,
		rows: 2,
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "sm",
		padding: "xs",
		resize: r ? "vertical" : "none",
		color: "fg",
		onChange: (e) => a?.(t, n, e.currentTarget.value)
	});
}, b = (e) => {
	let { question: t, questionIndex: n, editable: r, selectedOptions: i, customAnswer: a, onToggleOption: o, onToggleOther: d } = e, { name: f, otherField: m } = e, h = p(t), _ = a !== void 0;
	return /* @__PURE__ */ l(s, { children: [
		t.options.map((e) => /* @__PURE__ */ c(g, {
			option: e,
			name: f,
			checked: i.includes(e.label),
			editable: r,
			onToggle: () => o?.(t, n, e.label)
		}, e.label)),
		h ? /* @__PURE__ */ c(g, {
			option: { label: u },
			name: f,
			checked: _,
			editable: r,
			onToggle: () => d?.(t, n)
		}) : null,
		_ ? m : null
	] });
}, x = (e) => {
	let { question: t, questionIndex: n, editable: r, selectedOptions: o, customAnswer: s, onToggleOption: u, onToggleOther: d } = e, f = t.id ?? `question-${n}`, m = p(t), h = t.allowCustomAnswer ? /* @__PURE__ */ c(y, {
		...e,
		hasOtherChoice: m
	}) : null, g = t.options.length > 0 || m;
	return /* @__PURE__ */ l(i, {
		as: "fieldset",
		gap: "xs",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "sm",
		padding: "sm",
		minWidth: "0",
		children: [
			/* @__PURE__ */ c(a, {
				as: "legend",
				textStyle: "label/S/medium",
				color: "fg",
				paddingX: "2xs",
				children: t.question
			}),
			g && t.multiple ? /* @__PURE__ */ c(b, {
				...e,
				name: f,
				otherField: h
			}) : null,
			g && !t.multiple ? /* @__PURE__ */ c(_, {
				question: t,
				questionIndex: n,
				name: f,
				selectedOption: o[0],
				otherSelected: s !== void 0,
				editable: r,
				onToggleOption: u,
				onToggleOther: d,
				otherField: h
			}) : null,
			g ? null : h
		]
	});
}, S = (e) => {
	let { questions: t, editable: n = !1, selectedOptionsByQuestion: r = {}, customAnswersByQuestion: a = {}, onToggleOption: o, onToggleOther: s, onCustomAnswerChange: l } = e;
	return /* @__PURE__ */ c(i, {
		as: "form",
		gap: "sm",
		onSubmit: m,
		"aria-label": "Question form",
		children: t.map((e, t) => {
			let i = e.id ?? `question-${t}`;
			return /* @__PURE__ */ c(x, {
				question: e,
				questionIndex: t,
				editable: n,
				selectedOptions: f(r, i) ?? [],
				customAnswer: f(a, i),
				onToggleOption: o,
				onToggleOther: s,
				onCustomAnswerChange: l
			}, i);
		})
	});
};
export { v as n, f as r, S as t };
