// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./use-command-options-DPiKB0WN.ts";
import { t as n } from "./extension-localization-DzVq3_HP.ts";
import { Fragment as r } from "react";
import { Stack as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
import { ParamEditorRow as s } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/modules/settings/components/extension-settings-params.ts
var c = (e) => e.value === void 0 ? e.default : e.value, l = (e, t) => {
	let n = e.map((e) => ({
		id: e.value,
		name: e.label
	}));
	return !t || n.some((e) => e.id === t) ? n : [...n, {
		id: t,
		name: t
	}];
}, u = (e, t = {}) => e.flatMap((e) => {
	let r = {
		id: e.key,
		name: n(e.title, e.extensionId) || e.key,
		description: n(e.description, e.extensionId) || void 0
	}, i = c(e);
	if (e.type === "boolean") return [{
		...r,
		type: "boolean",
		defaultValue: !!i
	}];
	if (e.type === "number") return [{
		...r,
		type: "number",
		defaultValue: Number(i ?? 0)
	}];
	if (e.type === "string" && e.options) {
		let n = t[e.key], a = String(i ?? "");
		return [{
			...r,
			type: "selection",
			defaultValue: a,
			options: l(n?.options ?? [], a),
			searchable: !0,
			clearable: !0,
			disabled: n?.status === "loading"
		}];
	}
	return e.type === "string" && e.enum?.length ? [{
		...r,
		type: "selection",
		defaultValue: String(i ?? ""),
		options: e.enum.map((e) => ({
			id: String(e),
			name: String(e)
		}))
	}] : e.type === "string" ? [{
		...r,
		type: "text",
		singleLine: !0,
		defaultValue: String(i ?? "")
	}] : [];
}), d = (e) => e.type === "string" && e.options ? {
	type: "select",
	options: e.options
} : e.type === "string" ? { type: "text" } : e.type === "number" || e.type === "boolean" ? { type: e.type } : null, f = (e) => Object.fromEntries(e.flatMap((e) => {
	let t = d(e);
	return t ? [[e.key, t]] : [];
})), p = (e, t, n) => n === "" && e.some((e) => e.key === t && e.options) ? void 0 : n, m = (e) => {
	let t = {};
	for (let n of e) {
		let e = c(n);
		(typeof e == "string" || typeof e == "number" || typeof e == "boolean") && (t[n.key] = e);
	}
	return t;
}, h = (e) => {
	let t = {};
	for (let [n, r] of Object.entries(m(e))) t[n] = typeof r == "boolean" ? r : String(r);
	return t;
}, g = () => {}, _ = (e) => /* @__PURE__ */ a(v, { ...e }, JSON.stringify(f(e.settings))), v = (n) => {
	let { settings: c, executeOptionCommand: l, onChangeSetting: d } = n, _ = f(c), v = m(c), y = t(_, h(c), l, g);
	return /* @__PURE__ */ a(i, {
		gap: "0",
		children: u(c, y.states).map((t) => /* @__PURE__ */ o(r, { children: [/* @__PURE__ */ a(s, {
			param: t,
			values: v,
			variant: "small",
			onChange: (e, t) => d(e, p(c, e, t))
		}), c.some((e) => e.key === t.id && e.options) ? /* @__PURE__ */ a(e, {
			state: y.states[t.id],
			onRetry: () => y.retry(t.id)
		}) : null] }, t.id))
	});
};
export { u as n, _ as t };
