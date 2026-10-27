// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, r as t } from "./question-prompt-DIqKf96x.ts";
import { i as n, n as r, r as i, t as a } from "./timeline-kzOAeaXW.ts";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/utils/diff.ts
function s(e) {
	let t = e.lastIndexOf("/");
	return t >= 0 ? e.slice(t + 1) : e;
}
function c(e) {
	if (!e) return null;
	let t = e.split("	")[0].trim();
	if (t === "/dev/null") return null;
	let n = t;
	return (n.startsWith("a/") || n.startsWith("b/")) && (n = n.slice(2)), n.replace(/^\/+/, "").replace(/\\/g, "/");
}
var l = (e) => e.startsWith("--- "), u = (e) => e.startsWith("+++ "), d = (e) => e.startsWith("@@"), ee = (e) => e.startsWith("+") && !(u(e) || e === "+++"), te = (e) => e.startsWith("-") && !(l(e) || e === "---"), ne = (e, t) => {
	e.has(t) || e.set(t, {
		additions: 0,
		deletions: 0
	});
}, re = (e, t) => {
	let n = e.get(t);
	n && (n.additions += 1);
}, ie = (e, t) => {
	let n = e.get(t);
	n && (n.deletions += 1);
}, ae = (e, t, n) => {
	if (l(e)) return {
		...t,
		lastMinusHeader: c(e.slice(4)),
		inHunk: !1
	};
	if (u(e)) {
		let r = c(e.slice(4)) ?? t.lastMinusHeader;
		return r && ne(n, r), {
			...t,
			currentPath: r,
			inHunk: !1
		};
	}
	return t.currentPath ? d(e) ? {
		...t,
		inHunk: !0
	} : t.inHunk ? ee(e) ? (re(n, t.currentPath), t) : (te(e) && ie(n, t.currentPath), t) : t : t;
};
function f(e) {
	if (!e || typeof e != "string") return [];
	let t = /* @__PURE__ */ new Map(), n = {
		currentPath: null,
		lastMinusHeader: null,
		inHunk: !1
	}, r = e.split(/\r?\n/);
	for (let e of r) n = ae(e, n, t);
	return Array.from(t.entries()).map(([e, { additions: t, deletions: n }]) => ({
		filePath: e,
		additions: t,
		deletions: n
	}));
}
function oe(e) {
	return f(e).map((e) => ({
		kind: "diff",
		fileName: s(e.filePath),
		filePath: e.filePath,
		additions: e.additions,
		deletions: e.deletions
	}));
}
function se(e) {
	return f(e).map((e) => e.filePath);
}
var p = (e) => l(e) || e.startsWith("diff --git "), ce = (e) => e.startsWith(" ") || e.startsWith("+") || e.startsWith("-") ? !1 : e.trim() !== "", le = (e, t, n) => {
	if (e.startsWith(" ")) {
		let r = e.slice(1);
		t.push(r), n.push(r);
	} else e.startsWith("-") ? t.push(e.slice(1)) : e.startsWith("+") && n.push(e.slice(1));
}, ue = (e, t, n, r) => {
	let i = t;
	for (; i < e.length;) {
		let t = e[i] || "";
		if (p(t) || d(t) || ce(t)) break;
		le(t, n, r), i += 1;
	}
	return (n.length > 0 || r.length > 0) && (n.push(""), r.push("")), i;
}, de = (e, t) => {
	let n = c((e[t] || "").slice(4)), r = e[t + 1] || "";
	if (!u(r)) return { nextIndex: t + 1 };
	let i = c(r.slice(4)) ?? n ?? "", a = [], o = [], s = t + 2;
	for (; s < e.length;) {
		let t = e[s] || "";
		if (p(t)) break;
		d(t) ? s = ue(e, s + 1, a, o) : s += 1;
	}
	return {
		nextIndex: s,
		preview: {
			filePath: i,
			original: a.join("\n"),
			modified: o.join("\n")
		}
	};
};
function m(e) {
	if (!e || typeof e != "string") return [];
	let t = e.split(/\r?\n/), n = [], r = 0;
	for (; r < t.length;) {
		if (!l(t[r] || "")) {
			r += 1;
			continue;
		}
		let { nextIndex: e, preview: i } = de(t, r);
		i && n.push(i), r = Math.max(e, r + 1);
	}
	return n;
}
// packages/ui/src/components/chat-ui/tool-rendering/shared.ts
var h = {
	apply_patch: "Apply patch",
	bash: "Run command",
	edit: "Edit file",
	glob: "Find files",
	grep: "Search files",
	read: "Read file",
	skill: "Load skill",
	todowrite: "Update todos"
}, g = {
	error: "failed",
	"output-error": "failed",
	input_streaming: "running",
	running: "running",
	completed: "completed",
	failed: "failed"
}, _ = (e) => e.replace(/^tool-/, "").toLowerCase(), fe = (e) => e.split(" ").filter((e) => e.length > 0).map((e) => e[0].toUpperCase() + e.slice(1)).join(" "), pe = (e) => _(e.tool ?? "tool"), me = (e) => {
	let t = _(e);
	return h[t] ?? fe(t.replace(/_/g, " "));
}, he = (e) => {
	let t = e.state?.status ?? e.status;
	if (!t || typeof t != "string") return null;
	let n = t.replace(/-/g, "_");
	return g[n] ? g[n] : n.includes("stream") ? "running" : null;
}, v = (e) => {
	let t = e.state?.status ?? e.status;
	return t === "error" || t === "output-error" || t === "failed";
}, y = (e) => v(e) ? {
	type: "icon",
	icon: "danger"
} : {
	type: "icon",
	icon: r(pe(e))
}, b = (e, t, n, r) => {
	let i = [{
		kind: "text",
		text: n ?? me(e.tool ?? "tool"),
		bold: !0
	}];
	t && i.push({
		kind: "text",
		text: t,
		muted: !0,
		...r === "monospace" ? {
			truncate: !0,
			monospace: !0
		} : {}
	});
	let a = he(e);
	return a && a !== "completed" && i.push({
		kind: "text",
		text: a,
		muted: !0
	}), i;
}, x = (e) => {
	let t = e.state?.input;
	return !t || typeof t != "object" || Array.isArray(t) ? null : t;
}, S = (e) => {
	let t = e.state?.output;
	return !t || typeof t != "object" || Array.isArray(t) ? null : t;
}, C = (e) => typeof e == "string" && e.trim().length > 0 ? e : null, w = (e) => !e || typeof e != "object" || Array.isArray(e) ? null : e, ge = (e, t) => {
	let n = w(e.state);
	return n ? w(n[t]) : null;
}, T = (e) => e.replace(/\\/g, "/").replace(/^\/+/, ""), _e = (e) => e.includes("--- ") && e.includes("+++ ") && e.includes("@@"), E = (e) => {
	let t = S(e);
	return [ge(e, "metadata"), w(t?.metadata)].filter(Boolean);
}, ve = (e) => {
	let t = w(e);
	if (!t) return null;
	let n = C(t.filePath) ?? C(t.relativePath) ?? C(t.path);
	return n ? {
		filePath: T(n),
		additions: typeof t.additions == "number" ? t.additions : 0,
		deletions: typeof t.deletions == "number" ? t.deletions : 0,
		diff: C(t.diff) ?? void 0,
		before: C(t.before) ?? void 0,
		after: C(t.after) ?? void 0
	} : null;
}, D = (e) => {
	let t = [];
	for (let n of E(e)) {
		let e = Array.isArray(n.files) ? n.files : [];
		for (let n of e) {
			let e = ve(n);
			e && t.push(e);
		}
	}
	return t;
}, ye = (e) => {
	let t = x(e), n = (Array.isArray(t?.changes) ? t.changes : []).map((e) => C(w(e)?.path)).filter((e) => !!e).map(T);
	return Array.from(new Set(n));
}, be = (e) => {
	let t = x(e), n = C(t?.diff);
	if (n) return n;
	for (let t of E(e)) {
		let e = C(t.diff);
		if (e) return e;
	}
	let r = D(e).map((e) => e.diff).filter((e) => !!e);
	if (r.length > 0) return r.join("\n");
	let i = C(t?.patchText);
	return i && _e(i) ? i : null;
}, O = (e) => {
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e) t.has(r.filePath) || (t.add(r.filePath), n.push({
		kind: "diff",
		fileName: s(r.filePath),
		filePath: r.filePath,
		additions: r.additions,
		deletions: r.deletions
	}));
	return n;
}, k = (e) => Array.from(new Set(e.map((e) => e.filePath))), A = (e) => {
	let t = S(e);
	return C(e.state?.output) ?? C(t?.returnDisplay) ?? C(t?.preview) ?? C(t?.stdout) ?? C(t?.content);
}, j = (e) => {
	let t = e.match(/<skill_content(?:\s+name="([^"]+)")?>([\s\S]*?)<\/skill_content>/);
	return t ? {
		skillName: C(t[1]) ?? void 0,
		content: C(t[2]) ?? ""
	} : null;
}, M = (e) => {
	let t = x(e);
	return C(t?.name) ?? C(t?.skillName) ?? C(t?.skill) ?? C(t?.skill_name) ?? void 0;
}, N = (e, t) => ({
	kind: "link",
	text: s(e),
	filePath: e,
	...t ? { variant: t } : {}
}), P = (e, t) => !v(e) || !e.state?.errorText ? t : [{
	type: "comment",
	text: e.state.errorText
}, ...t], F = (e) => m(e ?? void 0).map((e) => ({
	type: "diff",
	language: "diff",
	original: e.original,
	modified: e.modified,
	sideBySide: !1
})), xe = (e) => oe(e ?? void 0), Se = (e) => se(e ?? void 0), Ce = (e) => {
	let t = be(e), n = D(e), r = ye(e), i = b(e, void 0, "Apply patch"), a = xe(t);
	a.length > 0 ? i.push(...a) : n.length > 0 ? i.push(...O(n)) : i.push(...r.map((e) => N(e, "bubble")));
	let o = [...F(t)];
	if (o.length === 0) for (let e of n) (e.before || e.after) && o.push({
		type: "diff",
		language: "diff",
		original: e.before ?? "",
		modified: e.after ?? "",
		sideBySide: !1
	});
	if (o.length === 0) {
		let e = Se(t);
		e.length === 0 && e.push(...k(n)), e.length === 0 && e.push(...r), e.length > 0 && o.push({
			type: "references",
			references: e
		});
	}
	return {
		indicator: y(e),
		title: i,
		blocks: P(e, o)
	};
}, we = (e, t) => [{
	type: "diff",
	language: "text",
	original: e,
	modified: t,
	sideBySide: !1
}], Te = (e) => {
	let t = x(e), n = S(e), r = C(t?.filePath) ?? C(t?.file_path) ?? C(n?.filePath) ?? void 0, i = C(n?.oldString) ?? C(t?.old_string) ?? void 0, a = C(n?.newString) ?? C(t?.new_string) ?? void 0, o = b(e, void 0, "Edit file");
	r && o.push(N(r));
	let s = i !== void 0 && a !== void 0 ? we(i, a) : F(C(n?.diff));
	return {
		indicator: y(e),
		title: o,
		blocks: P(e, s)
	};
}, Ee = (n) => {
	let { buildBaseTitle: r, buildIndicator: i, prependErrorBlock: a } = n;
	return (n) => {
		let o = t(n.state?.output) || t(n.state?.metadata), s = e(n.state?.input), c = s ? {
			type: "question-form",
			questions: s.questions
		} : null;
		if (!o && !c) return null;
		let l = c ? `${c.questions.length} field${c.questions.length === 1 ? "" : "s"}` : void 0, u = o ? [] : [c];
		return {
			indicator: i(n),
			title: r(n, l, "Question"),
			blocks: a(n, u),
			expandable: !1
		};
	};
}, De = (e) => {
	let t = x(e), n = S(e), r = C(t?.filePath) ?? C(t?.file_path) ?? C(t?.file) ?? C(n?.filePath) ?? C(n?.file) ?? C(n?.path) ?? void 0, i = b(e, void 0, "Read file");
	return r && i.push(N(r)), {
		indicator: y(e),
		title: i,
		blocks: P(e, [])
	};
}, I = (e, t) => {
	let n = x(e), r = S(e), i = b(e, C(n?.command) ?? void 0, t, "monospace"), a = [], o = A(e);
	o && a.push({
		type: "code",
		language: "text",
		code: o
	});
	let s = C(r?.stderr);
	return s && s !== o && a.push({
		type: "code",
		language: "text",
		code: s
	}), typeof r?.exitCode == "number" && a.push({
		type: "text",
		text: `Exit code: ${r.exitCode}`
	}), {
		indicator: y(e),
		title: i,
		blocks: P(e, a)
	};
}, Oe = (e) => I(e, "Run command"), ke = (e) => I(e, "Shell"), Ae = (e) => {
	let t = x(e), n = A(e), r = b(e, C(t?.pattern) ?? void 0, "Search files"), i = n ? [{
		type: "code",
		language: "text",
		code: n
	}] : [];
	return {
		indicator: y(e),
		title: r,
		blocks: P(e, i)
	};
}, je = (e) => {
	let t = x(e), n = A(e), r = b(e, C(t?.pattern) ?? void 0, "Find files"), i = [];
	if (n) {
		let e = n.split(/\r?\n/).map((e) => e.trim()).filter((e) => e.length > 0);
		e.length > 0 && i.push({
			type: "references",
			references: e
		});
	}
	return {
		indicator: y(e),
		title: r,
		blocks: P(e, i)
	};
}, Me = (e) => {
	let t = A(e), n = t ? j(t) : null, r = b(e, M(e) ?? n?.skillName, "Load skill"), i = n?.content ?? t, a = i ? [{
		type: "code",
		language: "markdown",
		code: i
	}] : [];
	return {
		indicator: y(e),
		title: r,
		blocks: P(e, a)
	};
}, L = (e) => typeof e == "string" && e.trim().length > 0 ? e : null, R = (e) => !e || typeof e != "object" || Array.isArray(e) ? null : e, Ne = (e) => {
	let t = R(e);
	if (!t) return null;
	let n = L(t.content) ?? L(t.title);
	return n ? {
		label: n,
		checked: L(t.status) === "completed"
	} : null;
}, z = (e) => {
	if (!e) return {
		items: [],
		explicit: !1
	};
	let t = (() => {
		if (Array.isArray(e)) return e;
		let t = R(e);
		return !t || !Array.isArray(t.todos) ? null : t.todos;
	})();
	return t ? {
		items: t.map(Ne).filter((e) => e !== null),
		explicit: !0
	} : {
		items: [],
		explicit: !1
	};
}, Pe = (e) => {
	let { buildBaseTitle: t, buildIndicator: n, prependErrorBlock: r } = e;
	return (e) => {
		let i = z(e.state?.input), a = z(e.state?.output), o = a.explicit ? a : i;
		if (!o.explicit) return null;
		let s = o.items, c = `${s.length} item${s.length === 1 ? "" : "s"}`, l = t(e, c, "Update todos");
		if (s.length === 0) return {
			indicator: n(e),
			title: l,
			blocks: r(e, [{
				type: "comment",
				text: "No todos"
			}])
		};
		let u = [{
			type: "todo-list",
			items: s
		}];
		return {
			indicator: n(e),
			title: l,
			blocks: r(e, u)
		};
	};
}, Fe = Ee({
	buildBaseTitle: b,
	buildIndicator: y,
	prependErrorBlock: P
}), B = Pe({
	buildBaseTitle: b,
	buildIndicator: y,
	prependErrorBlock: P
}), V = () => ({
	apply_patch: Ce,
	bash: Oe,
	edit: Te,
	glob: je,
	grep: Ae,
	question: Fe,
	read: De,
	shell: ke,
	skill: Me,
	todo_write: B,
	todowrite: B
}), H = {
	error: "failed",
	"output-error": "failed",
	"input-streaming": "running"
}, Ie = (e) => e.split(" ").filter((e) => e.length > 0).map((e) => e[0].toUpperCase() + e.slice(1)).join(" "), U = (e) => Ie(n(e ?? "tool").replace(/_/g, " ")), W = (e) => e === "error" || e === "output-error", Le = (e) => W(e.state?.status) ? {
	type: "icon",
	icon: "danger"
} : {
	type: "icon",
	icon: r(e.tool ?? "tool")
}, Re = (e) => !e || typeof e != "string" ? null : H[e] ? H[e] : e.includes("stream") ? "running" : null, ze = (e) => {
	if (typeof e == "string") return e;
	if (e == null) return null;
	try {
		return JSON.stringify(e, null, 2);
	} catch {
		return null;
	}
}, G = (e) => e == null ? !0 : typeof e == "string" ? e.trim().length === 0 : Array.isArray(e) ? e.length === 0 || e.every(G) : typeof e == "object" && Object.values(e).every(G), K = (e) => !e || typeof e != "object" || Array.isArray(e) ? null : e, q = (e) => typeof e == "string" && e.trim().length > 0 ? e : null, Be = (e) => q(e.mime_type) ?? q(e.mediaType) ?? q(e.mimeType), J = (e) => !!e?.startsWith("image/"), Ve = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(\?.*)?$/i, Y = (e, t) => {
	let n = K(e);
	if (!n) return null;
	let r = Be(n), i = q(n.data);
	if (i && J(r)) return {
		type: "image",
		src: `data:${r};base64,${i}`,
		alt: t
	};
	let a = q(n.url) ?? q(n.src);
	return a && (J(r) || Ve.test(a)) ? {
		type: "image",
		src: a,
		alt: t
	} : null;
}, X = (e) => {
	let t = K(e);
	if (!t) return null;
	let n = q(t.path) ?? q(t.filePath) ?? q(t.filename), r = q(t.content) ?? q(t.body) ?? q(t.text);
	return !n || r === null ? null : {
		filePath: n,
		content: r
	};
}, He = {
	css: "css",
	html: "html",
	js: "js",
	json: "json",
	jsx: "jsx",
	md: "markdown",
	py: "python",
	ts: "ts",
	tsx: "tsx",
	yaml: "yaml",
	yml: "yaml"
}, Ue = (e) => {
	let t = e.split(".").pop()?.toLowerCase();
	return t ? He[t] ?? t : "text";
}, Z = (e, t) => t.length === 0 ? [] : [{
	type: "text",
	text: e
}, ...t], We = (e, t) => {
	let n = [];
	for (let r of e) {
		let e = K(r), i = q(e?.type);
		if (i === "image") {
			let e = Y(r, t);
			e && n.push(e);
		} else if (i === "text") {
			let t = q(e?.text);
			t && n.push({
				type: "text",
				text: t
			});
		} else n.push(...Q(r, t));
	}
	return n;
}, Ge = (e) => {
	let t = X(e);
	return t ? [{
		type: "code",
		language: Ue(t.filePath),
		code: t.content
	}] : null;
}, Ke = (e) => {
	let t = K(e), n = q(t?.attachment_name) ?? q(t?.attachmentName), r = q(t?.attachment_file_id) ?? q(t?.attachmentFileId);
	return !n && !r ? null : [{
		type: "text",
		text: n ?? `Attachment ${r}`
	}];
}, Q = (e, t) => {
	if (G(e)) return [];
	let n = Y(e, t);
	if (n) return [n];
	if (Array.isArray(e)) return We(e, t);
	let r = Ge(e);
	if (r) return r;
	let i = Ke(e);
	if (i) return i;
	let a = ze(e);
	return a?.trim() ? [{
		type: "code",
		language: typeof e == "string" ? "text" : "json",
		code: a
	}] : [];
}, qe = (e) => {
	let t = [], n = U(e.tool);
	return W(e.state?.status) && e.state?.errorText && t.push({
		type: "comment",
		text: e.state.errorText
	}), t.push(...Z("Input", Q(e.state?.input, `${n} input`))), t.push(...Z("Output", Q(e.state?.output, `${n} output`))), t;
}, Je = (e) => {
	let t = [{
		kind: "text",
		text: U(e.tool),
		bold: !0
	}], n = X(e.state?.output);
	n && t.push({
		kind: "link",
		text: n.filePath,
		filePath: n.filePath
	});
	let r = Re(e.state?.status);
	return r && t.push({
		kind: "text",
		text: r,
		muted: !0
	}), {
		indicator: Le(e),
		title: t,
		blocks: qe(e)
	};
}, $ = (e) => e.kind === "text" || e.kind === "link" ? e.text.trim().length > 0 : e.kind !== "diff" || e.fileName.trim().length > 0, Ye = (e) => {
	switch (e.type) {
		case "comment":
		case "code":
		case "text": return e.type === "code" ? e.code.trim().length > 0 : e.text.trim().length > 0;
		case "diff": return e.original.trim().length > 0 || e.modified.trim().length > 0;
		case "image": return e.src.trim().length > 0;
		case "todo-list": return e.items.length > 0;
		case "question-form": return e.questions.length > 0;
		case "references": return e.references.length > 0;
		case "input":
		case "component": return !0;
	}
}, Xe = (e) => {
	let t = e.title.some($), n = (e.blocks ?? []).some(Ye);
	return t || n;
}, Ze = (e) => e ? {
	...V(),
	...e
} : V(), Qe = (e, t) => {
	let n = e.tool ?? "tool";
	for (let e of i(n)) {
		let n = t[e];
		if (n) return n;
	}
}, $e = (e, t, n) => {
	let r = Qe(e, t);
	if (r) {
		let t = r(e, n);
		if (t) return t;
	}
	return Je(e);
}, et = (e, t) => {
	let n = Ze(t?.toolRenderers);
	return { items: e.map((e) => $e(e, n, t)).filter(Xe) };
}, tt = (e) => n(e.tool ?? "").replace(/_/g, "") === "question", nt = (e) => {
	let t = e.state?.output;
	return typeof t == "string" ? t.trim().length > 0 : Array.isArray(t) ? t.length > 0 : t && typeof t == "object" ? Object.keys(t).length > 0 : t != null;
};
function rt(e) {
	let { invocations: t, labeledBlocks: n, hideQuestionForms: r = !1, linkHandler: i } = e, s = r ? t.filter((e) => !tt(e) || nt(e)) : t;
	if (s.length === 0) return null;
	let c = et(s, { labeledBlocks: n });
	return /* @__PURE__ */ o(a, {
		data: c,
		linkHandler: i
	});
}
export { rt as t };
