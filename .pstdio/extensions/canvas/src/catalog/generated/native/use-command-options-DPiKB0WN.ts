// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./command-palette-params-BB-3_RFH.ts";
import { useEffect as t, useRef as n, useState as r, useSyncExternalStore as i } from "react";
import { Button as a, HStack as o, Text as s } from "@chakra-ui/react";
import { jsx as c, jsxs as l } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/command-option-status.tsx
var u = (e) => {
	let { state: t, onRetry: n } = e;
	return t?.status === "ready" ? t.options.length === 0 ? /* @__PURE__ */ c(s, {
		px: "sm",
		textStyle: "paragraph/XS/regular",
		color: "fg.muted",
		children: "No options available."
	}) : null : /* @__PURE__ */ l(o, {
		px: "sm",
		py: "xs",
		gap: "sm",
		children: [/* @__PURE__ */ c(s, {
			role: "status",
			textStyle: "paragraph/XS/regular",
			color: t?.status === "error" ? "fg.error" : "fg.muted",
			children: t?.error ?? "Loading options…"
		}), t?.status === "error" ? /* @__PURE__ */ c(a, {
			size: "xs",
			variant: "outline",
			onClick: n,
			children: "Retry"
		}) : null]
	});
}, d = (e) => typeof e == "object" && !!e && "kind" in e && e.kind === "param-value" && "key" in e && typeof e.key == "string", f = (t, n, r, i) => Object.fromEntries(Object.entries(t.params ?? {}).map(([t, a]) => {
	if (!d(a)) return [t, a];
	let o = r[a.key];
	return o?.resolvedFrom === "resource" ? [t, i[a.key]] : [t, o ? e({ [a.key]: {
		...o,
		required: !1
	} }, n)[a.key] : n[a.key]];
})), p = (e, t) => {
	if (!Array.isArray(t)) throw Error("The option command must return a list.");
	return t.map((t) => {
		if (!t || typeof t != "object" || typeof t[e.valueField] != "string" || typeof t[e.labelField] != "string") throw Error("The option command returned an invalid value or label.");
		return {
			value: t[e.valueField],
			label: t[e.labelField]
		};
	});
};
function m(e, t, n, r = {}) {
	let i = (t, n) => e[t]?.resolvedFrom === "resource" ? r[t] : n[t], a = (e, t) => JSON.stringify([e, Object.entries(e.params ?? {}).map(([e, n]) => [e, d(n) ? i(n.key, t) : n])]), o = {}, s = {}, c = !1, l = /* @__PURE__ */ new Map(), u = /* @__PURE__ */ new Set(), m = /* @__PURE__ */ new Map(), h = Object.entries(e).flatMap(([e, t]) => t.options && !Array.isArray(t.options) ? [{
		key: e,
		param: t,
		source: t.options
	}] : []), g = (e, t) => {
		o = {
			...o,
			[e]: t
		};
		for (let e of u) e();
	}, _ = (e, t) => {
		let r = new Set(t.map((e) => e.value)), i = s[e];
		if (Array.isArray(i)) {
			let t = i.filter((e) => r.has(e));
			t.length !== i.length && n(e, t);
		} else typeof i == "string" && i && !r.has(i) && n(e, "");
	}, v = async (n) => {
		let { key: i, source: o, param: u } = n;
		l.get(i)?.abort();
		let d = new AbortController();
		l.set(i, d);
		let h = (m.get(i) ?? 0) + 1;
		m.set(i, h);
		let v = a(o, s);
		g(i, {
			key: v,
			status: "loading",
			options: []
		});
		try {
			let n = p(o, await t(o.commandId, f(o, s, e, r), d.signal));
			if (c || m.get(i) !== h || (g(i, {
				key: v,
				status: "ready",
				options: n
			}), u.allowCustomValues)) return;
			_(i, n);
		} catch (e) {
			if (c || m.get(i) !== h) return;
			g(i, {
				key: v,
				status: "error",
				options: [],
				error: e instanceof Error ? e.message : String(e)
			});
		}
	};
	return {
		subscribe(e) {
			return u.add(e), () => {
				u.delete(e);
			};
		},
		getSnapshot: () => o,
		update(e) {
			c = !1, s = e;
			for (let e of h) o[e.key]?.key !== a(e.source, s) && v(e);
		},
		retry(e) {
			let t = h.find((t) => t.key === e);
			t && !c && v(t);
		},
		validate(e) {
			let t = {};
			for (let { key: n, param: r, source: i } of h) {
				let s = o[n];
				if (s?.status !== "ready" || s.key !== a(i, e)) {
					t[n] = "Wait for the available options to load.";
					continue;
				}
				if (r.allowCustomValues) continue;
				let c = e[n];
				(Array.isArray(c) ? c : [c].filter(Boolean)).some((e) => !s.options.some((t) => t.value === e)) && (t[n] = "Choose a value from the available options.");
			}
			return t;
		},
		dispose() {
			c = !0;
			for (let e of l.values()) e.abort();
			for (let [e, t] of m) m.set(e, t + 1);
			o = {}, u.clear();
		}
	};
}
// packages/pstdio-workbench/src/react/command-palette/use-command-options.ts
var h = (e, a, o, s, c = {}) => {
	let l = n({
		execute: o,
		onChange: s
	});
	l.current = {
		execute: o,
		onChange: s
	};
	let [u] = r(() => m(e, (e, t, n) => l.current.execute ? l.current.execute(e, t, n) : Promise.reject(/* @__PURE__ */ Error("Option commands are unavailable.")), (e, t) => l.current.onChange(e, t), c)), d = i(u.subscribe, u.getSnapshot, u.getSnapshot);
	return t(() => {
		u.update(a);
	}, [u, a]), t(() => () => u.dispose(), [u]), {
		states: d,
		validate: u.validate,
		retry: u.retry
	};
};
export { u as n, h as t };
