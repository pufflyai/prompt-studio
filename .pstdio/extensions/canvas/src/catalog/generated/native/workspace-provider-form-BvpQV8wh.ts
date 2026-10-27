// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e, t } from "./command-palette-params-BB-3_RFH.ts";
import { t as n } from "./use-command-options-DPiKB0WN.ts";
import { n as r, t as i } from "./workspace-provider-fields-CpN_rFhm.ts";
import { useState as a } from "react";
import { Button as o, Dialog as s, HStack as c, Stack as l, Text as u } from "@chakra-ui/react";
import { Fragment as d, jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/workspaces/components/workspace-provider-form.tsx
var m = (m) => {
	let { providers: h, provider: g, busy: _, executeOptionCommand: v, onProviderChange: y, onCancel: b, onSubmit: x } = m, S = r(g), [C, w] = a(() => t(S)), [T, E] = a(""), D = (e, t) => w((n) => ({
		...n,
		[e]: t
	})), O = n(S, C, v, D), k = Object.values(O.validate(C))[0];
	if (!k) try {
		e(S, C);
	} catch (e) {
		k = e instanceof Error ? e.message : String(e);
	}
	return /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(s.Body, { children: /* @__PURE__ */ p(l, {
		gap: "sm",
		children: [/* @__PURE__ */ f(i, {
			typeLabel: "Workspace type",
			providers: h,
			provider: g,
			values: C,
			disabled: !!_,
			optionStates: O.states,
			onRetryOptions: O.retry,
			onProviderChange: y,
			onValueChange: D
		}), T && /* @__PURE__ */ f(u, {
			role: "alert",
			color: "fg.error",
			children: T
		})]
	}) }), /* @__PURE__ */ f(s.Footer, {
		justifyContent: "end",
		children: /* @__PURE__ */ p(c, {
			gap: "2",
			children: [/* @__PURE__ */ f(o, {
				variant: "ghost",
				disabled: _,
				onClick: b,
				children: "Cancel"
			}), /* @__PURE__ */ f(o, {
				variant: "primary",
				disabled: !!k,
				loading: _,
				onClick: async () => {
					if (!(_ || k)) try {
						E(""), await x(g.id, e(S, C));
					} catch (e) {
						E(e instanceof Error ? e.message : String(e));
					}
				},
				children: "Create workspace"
			})]
		})
	})] });
}, h = (e) => {
	let { providers: t, busy: n, executeOptionCommand: r, onCancel: i, onSubmit: l } = e, [h, g] = a(t[0]?.id), _ = t.find((e) => e.id === h) ?? t[0];
	return _ ? /* @__PURE__ */ f(m, {
		providers: t,
		provider: _,
		busy: n,
		executeOptionCommand: r,
		onProviderChange: g,
		onCancel: i,
		onSubmit: l
	}, JSON.stringify(_)) : /* @__PURE__ */ p(d, { children: [/* @__PURE__ */ f(s.Body, { children: /* @__PURE__ */ f(u, {
		color: "fg.muted",
		children: "Attach a project folder or enable a workspace provider in settings."
	}) }), /* @__PURE__ */ f(s.Footer, {
		justifyContent: "end",
		children: /* @__PURE__ */ p(c, {
			gap: "2",
			children: [/* @__PURE__ */ f(o, {
				variant: "ghost",
				onClick: i,
				children: "Cancel"
			}), /* @__PURE__ */ f(o, {
				variant: "primary",
				disabled: !0,
				children: "Create workspace"
			})]
		})
	})] });
};
export { h as t };
