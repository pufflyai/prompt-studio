// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t, n } from "./command-palette-params-BB-3_RFH.ts";
// packages/pstdio-workbench/src/react/command-palette/command-param-descriptors.ts
var r = (e) => typeof e == "string" ? e : "", i = (e) => Array.isArray(e) ? e : [], a = (e) => e.label, o = (e) => (Array.isArray(e.options) ? e.options : []).map((e) => ({
	id: e.value,
	name: e.label,
	icon: e.icon
})), s = /* @__PURE__ */ new Set([
	"json",
	"resource",
	"harness",
	"workspace"
]), c = (e, n) => {
	let c = {
		id: e.key,
		name: a(e),
		description: e.description
	};
	return e.type === "boolean" ? {
		...c,
		type: "boolean",
		defaultValue: n === !0
	} : e.type === "number" ? {
		...c,
		type: "number",
		defaultValue: Number(r(n))
	} : e.type === "markdown" ? {
		...c,
		type: "markdown",
		defaultValue: r(n)
	} : e.type === "files" ? {
		...c,
		type: "fileUpload",
		defaultValue: t(n) ? n.uploads : [],
		accept: e.accept,
		multiple: e.multiple
	} : e.type === "multi-select" ? {
		...c,
		type: "selection",
		allowCustomValues: e.allowCustomValues,
		defaultValue: i(n),
		options: o(e),
		multiSelect: !0,
		placeholder: `Select ${e.label.toLowerCase()}`,
		searchable: (Array.isArray(e.options) ? e.options.length : 0) > 5
	} : (e.type === "select" || e.type === "template") && Array.isArray(e.options) ? {
		...c,
		type: "selection",
		allowCustomValues: e.allowCustomValues,
		defaultValue: r(n),
		options: o(e),
		placeholder: `Select ${e.label.toLowerCase()}`,
		searchable: e.options.length > 5,
		clearable: !e.required
	} : e.type === "longtext" || s.has(e.type) ? {
		...c,
		type: "text",
		defaultValue: r(n),
		singleLine: !1
	} : {
		...c,
		type: "text",
		defaultValue: r(n),
		singleLine: !0
	};
}, l = (t, r) => typeof t == "boolean" ? t : r?.type === "files" ? n({ uploads: Array.isArray(t) ? t.filter(e) : [] }) : Array.isArray(t) ? t.map(String) : String(t ?? "");
export { a as n, l as r, c as t };
