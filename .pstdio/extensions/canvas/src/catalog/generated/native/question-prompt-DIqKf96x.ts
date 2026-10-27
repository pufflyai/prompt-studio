// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// packages/ui/src/components/chat-ui/tool-rendering/question-prompt.ts
var e = (e) => typeof e == "object" && !!e && !Array.isArray(e), t = (t) => {
	try {
		let n = JSON.parse(t);
		return e(n) ? n : null;
	} catch {
		return null;
	}
}, n = (n) => e(n) ? n : typeof n == "string" && n.trim().length > 0 ? t(n) : null, r = (e) => typeof e == "string" && e.trim().length > 0 ? e : null, i = (t) => {
	let n = r(t);
	if (n) return n;
	if (Array.isArray(t)) {
		let e = t.map(i).filter((e) => e !== null);
		return e.length > 0 ? e.join("\n") : null;
	}
	return e(t) ? i(t.response) ?? i(t.answer) ?? i(t.text) ?? i(t.answers) : null;
}, a = (t) => e(t) ? Array.isArray(t.answers) ? !0 : a(t.response) || a(t.answer) : !1, o = (e) => i(e) !== null || a(e), s = (t) => {
	if (typeof t == "string" && t.trim().length > 0) return {
		label: t,
		description: void 0
	};
	if (!e(t)) return null;
	let n = r(t.label);
	return n ? {
		label: n,
		description: r(t.description) ?? void 0
	} : null;
}, c = (t, n) => {
	if (!e(t)) return null;
	let i = r(t.question);
	if (!i) return null;
	let a = Array.isArray(t.options) ? t.options.map(s).filter((e) => e !== null) : [], o = r(t.type), c = typeof t.allowCustomAnswer == "boolean" ? t.allowCustomAnswer : a.length === 0 || o === "freeform" || o === "text", l = typeof t.custom == "boolean" ? t.custom : c;
	return {
		id: r(t.id) ?? `question-${n}`,
		question: i,
		options: a,
		multiple: typeof t.multiple == "boolean" ? t.multiple : o === "multi_choice" || o === "multiple_choice",
		required: typeof t.required != "boolean" || t.required,
		allowCustomAnswer: l
	};
}, l = (e) => {
	let t = n(e);
	if (!t || !Array.isArray(t.questions)) return null;
	let r = t.questions.map(c).filter((e) => e !== null);
	return r.length === 0 ? null : {
		questions: r,
		...t.delivery === "async" ? { delivery: "async" } : {}
	};
}, u = (e) => e.tool.toLowerCase() === "question", d = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) if (n.role === "assistant") for (let e of n.parts) e.type === "tool" && u(e) && t.set(e.callId ?? e, e);
	return t.values();
}, f = (e) => e.callId ?? JSON.stringify(e.state?.input), p = (e) => e.status !== "failed" && e.status !== "denied" && !o(e.state?.output) && !o(e.state?.metadata), m = (e) => {
	if (!p(e)) return;
	let t = l(e.state?.input);
	return t ? {
		...t,
		...e.callId ? { callId: e.callId } : {}
	} : void 0;
}, h = (e, t) => {
	let n = [...d(e)].find((e) => f(e) === t);
	return n ? m(n) : void 0;
}, g = (e) => {
	for (let t of d(e)) {
		let e = m(t);
		if (e && e.delivery !== "async") return e;
	}
}, _ = (e, t) => {
	for (let r of [e.state?.metadata, e.state?.output]) {
		let e = n(r);
		if (Array.isArray(e?.answers)) {
			let n = e.answers[t];
			return Array.isArray(n) && n.length ? n.join(", ") : "Skipped";
		}
	}
	if (p(e)) return;
	let r = l(e.state?.input), a = i(e.state?.output);
	if (!a || !r) return e.status === "failed" || e.status === "denied" ? "Unavailable" : "Answered";
	let o = r.questions[t].question, s = a.split(/\n\n/).find((e) => e.startsWith(`${o}\n`));
	return s ? s.slice(o.length + 1).trim() || "Skipped" : r.questions.length === 1 ? a : "Answered";
};
export { l as a, p as i, f as n, g as o, o as r, h as s, _ as t };
