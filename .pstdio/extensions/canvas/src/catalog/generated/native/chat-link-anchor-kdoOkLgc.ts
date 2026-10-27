// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e, useContext as t, useEffect as n, useState as r } from "react";
import { Link as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/links/chat-link.ts
var o = (e) => e.origin === "text" || e.origin === "inline-code", s = (e, t) => {
	if (!e?.resolveIcon || e.resolveHref(t)) return !1;
	let n = p(t, typeof window > "u" ? void 0 : window.location.origin);
	return n?.kind === "external" && /^https?:/i.test(n.href);
}, c = (e) => ({
	kind: "invalid",
	reason: e
}), l = (e) => Number.isSafeInteger(e) && e > 0, u = (e) => {
	if (/^file:/i.test(e)) try {
		let t = new URL(e);
		if (t.hostname) return c("Network file links are unavailable.");
		if (e = t.pathname.replace(/^\/([a-z]:\/)/i, "$1") + t.hash, t.search) return c("File links cannot contain a query.");
	} catch {
		return c("This file link is malformed.");
	}
	else if (/^[a-z][a-z\d+.-]*:/i.test(e) && !/^[a-z]:[/\\]/i.test(e) && !/^[^:]+:\d+(?::\d+)?$/.test(e)) return c("This link scheme is unsupported.");
	return e.replace(/^#?\$PROJECT\//i, "");
}, d = (e) => {
	let t, n = e.indexOf("#");
	if (n >= 0) {
		let r = /^#L(\d+)(?:-L(\d+))?$/.exec(e.slice(n));
		if (!r) return c("This file location is unsupported.");
		t = {
			line: Number(r[1]),
			...r[2] ? { endLine: Number(r[2]) } : {}
		}, e = e.slice(0, n);
	} else {
		let n = /:(\d+)(?::(\d+))?$/.exec(e);
		n && (t = {
			line: Number(n[1]),
			...n[2] ? { column: Number(n[2]) } : {}
		}, e = e.slice(0, n.index));
	}
	return t && (!l(t.line) || t.column !== void 0 && !l(t.column) || t.endLine !== void 0 && (!l(t.endLine) || t.endLine < t.line)) ? c("Source locations must use positive line and column numbers.") : {
		kind: "file",
		path: e,
		position: t
	};
}, f = (e, t) => {
	let n = /^(\.\.?\/|\/|[a-z]:\/)/i.test(e) || t.startsWith("$PROJECT/"), r = !/^(@|v\d)/.test(e) && !/[\s()]/.test(e) && (e.includes("/") || /^[\w-]+\.[a-z][\w-]*$/i.test(e));
	return n || r;
}, p = (e, t) => {
	let n = e.source.trim();
	if (!n) return;
	if (/^https?:/i.test(n)) try {
		let e = new URL(n);
		return e.origin === t && e.pathname.startsWith("/projects/") ? {
			kind: "page",
			href: n
		} : {
			kind: "external",
			href: n
		};
	} catch {
		return c("This URL is malformed.");
	}
	if (/^(mailto:|sms:|tel:)/i.test(n)) return {
		kind: "external",
		href: n
	};
	if (/^\/projects\//.test(n)) return {
		kind: "page",
		href: n
	};
	if (/^(~\/|\\\\|\/\/)/.test(n)) return c("This path has no supported workspace root.");
	if (/^(javascript|data|vscode|pstdio):/i.test(n)) return c("This link scheme is unsupported.");
	let r = u(n);
	if (typeof r != "string") return r;
	let i = d(r);
	if (i.kind === "invalid") return i;
	if (i.path.includes("?")) return c("Encode question marks in file names.");
	let a;
	try {
		a = decodeURIComponent(i.path).replaceAll("\\", "/");
	} catch {
		return c("This path has invalid URL encoding.");
	}
	if (a.includes("\0")) return c("This path is malformed.");
	if (e.origin !== "inline-code" || f(a, e.source)) return {
		...i,
		path: a
	};
}, m = e(void 0), h = (e) => {
	let { handler: t, children: n } = e;
	return /* @__PURE__ */ a(m.Provider, {
		value: t,
		children: n
	});
}, g = () => t(m), _ = e(!1), v = (e, t = !0) => {
	let { source: i, origin: a } = e, o = g(), [s, c] = r(null);
	return n(() => {
		if (!t) return;
		let e = !0;
		return o?.resolveResource?.({
			source: i,
			origin: a
		}).then((t) => {
			e && c({
				source: i,
				value: t
			});
		}).catch(() => {
			e && c(null);
		}), () => {
			e = !1;
		};
	}, [
		o,
		i,
		a,
		t
	]), s?.source === i ? s.value : null;
}, y = (e) => {
	let { candidate: t, children: n, resolvedHref: r } = e, s = g(), c = v(t, r === void 0), l = p(t, typeof window > "u" ? void 0 : window.location.origin);
	if (r === void 0 && !c && o(t)) return n;
	let u = r;
	return u === void 0 && (u = c ? c.href : s?.resolveHref(t)), !s || !l || l.kind === "external" && !u ? n : /* @__PURE__ */ a(i, {
		variant: "resource",
		href: u ?? void 0,
		role: u ? void 0 : "button",
		tabIndex: 0,
		onClickCapture: (e) => {
			e.stopPropagation(), !(u && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) && (e.preventDefault(), s.open(t));
		},
		onKeyDownCapture: (e) => {
			!u && e.key === "Enter" && (e.preventDefault(), s.open(t));
		},
		children: n
	});
};
export { g as a, p as c, _ as i, v as n, s as o, h as r, o as s, y as t };
