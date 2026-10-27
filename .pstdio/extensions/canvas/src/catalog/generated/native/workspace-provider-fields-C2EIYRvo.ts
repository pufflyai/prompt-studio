// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { o as e } from "./command-palette-params-BB-3_RFH.ts";
import { n as t } from "./use-command-options-DPiKB0WN.ts";
import { t as n } from "./command-param-field-DbtnulFL.ts";
import { t as r } from "./extension-localization-DzVq3_HP.ts";
import { Fragment as i } from "react";
import { Fragment as a, jsx as o, jsxs as s } from "react/jsx-runtime";
import { commandRefId as c, isLocalizedString as l } from "@pstdio/sdk/extensions";
import { ParamEditorRow as u } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/shared/workspaces/workspace-provider-param-schema.ts
var d = (e) => typeof e == "string" || l(e) ? r(e) : "", f = (e) => {
	if (Array.isArray(e)) return e.map((e) => ({
		...e,
		label: d(e.label)
	}));
	let t = e;
	return {
		commandId: c(t.command),
		valueField: t.valueField,
		labelField: t.labelField,
		params: t.params
	};
}, p = (e) => Object.fromEntries(Object.entries(e.params).map(([e, t]) => [e, {
	...t,
	label: d(t.label) || e,
	description: d(t.description),
	...t.type === "select" || t.type === "multi-select" ? { options: f(t.options) } : {}
}])), m = (r) => {
	let { typeLabel: c, providers: l, provider: f, values: m, disabled: h, optionStates: g, onRetryOptions: _, onProviderChange: v, onValueChange: y } = r;
	return /* @__PURE__ */ s(a, { children: [/* @__PURE__ */ o(u, {
		param: {
			id: "workspace-type",
			type: "selection",
			name: c,
			description: d(f.description),
			options: l.map((e) => ({
				id: e.id,
				name: d(e.label),
				icon: e.icon
			})),
			defaultValue: f.id,
			clearable: !1
		},
		readOnly: h,
		onChange: (e, t) => {
			typeof t == "string" && v(t);
		}
	}), e(p(f)).map((e) => {
		let r = e.options && !Array.isArray(e.options), a = g[e.key];
		return /* @__PURE__ */ s(i, { children: [/* @__PURE__ */ o(n, {
			entry: r ? {
				...e,
				options: a?.options ?? []
			} : e,
			value: m[e.key],
			disabled: h || !!(r && a?.status !== "ready"),
			onChange: (t) => y(e.key, t)
		}), r ? /* @__PURE__ */ o(t, {
			state: a,
			onRetry: () => _(e.key)
		}) : null] }, e.key);
	})] });
};
export { p as n, m as t };
