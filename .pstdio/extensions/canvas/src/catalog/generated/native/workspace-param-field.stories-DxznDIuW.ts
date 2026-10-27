// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./queryClient-BgKKh9f4.ts";
import { n as r, r as i } from "./workspace-providers-OzFU0iXu.ts";
import { o as a, s as o, t as s } from "./test-CYwQ_LKY.ts";
import { t as c } from "./workbench-core-N58OeDyx.ts";
import { c as l, t as u } from "./command-palette-params-BB-3_RFH.ts";
import { t as d } from "./use-command-options-DPiKB0WN.ts";
import { n as f } from "./command-param-descriptors-DkvKpi2f.ts";
import { i as p, o as m } from "./project-context-BR7AjHlE.ts";
import { i as h } from "./api-CEi0FXP5.ts";
import { n as g, t as _ } from "./workspace-provider-fields-C2EIYRvo.ts";
import { useEffect as v, useRef as y, useState as b } from "react";
import { Dialog as x, Stack as S, Text as C } from "@chakra-ui/react";
import { jsx as w, jsxs as T } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/command-params/param-field-shared.ts
var E = (e) => {
	if (typeof e != "string" || e.length === 0) return {};
	try {
		let t = JSON.parse(e);
		return typeof t == "object" && t ? t : {};
	} catch {
		return {};
	}
}, D = (e) => JSON.stringify(e), O = (e) => typeof e == "object" && !!e && !Array.isArray(e), k = (e) => {
	let t = E(e);
	return {
		providerId: typeof t.providerId == "string" ? t.providerId : "",
		params: O(t.params) ? t.params : {}
	};
}, A = (e, t) => {
	let n = Object.fromEntries(Object.entries(g(e)).map(([e, t]) => [e, {
		...t,
		required: !1
	}]));
	return D({
		providerId: e.id,
		params: l(n, t)
	});
}, j = (e) => u(g(e)), M = (e, t) => u(Object.fromEntries(Object.entries(g(e)).map(([e, { defaultValue: t, ...n }]) => [e, n])), t), N = (e, t, n) => {
	let { provider: r, value: i, onChange: a, onUpdateValue: o } = e, s = (e) => {
		let i = k(e);
		if (i.providerId !== r.id) return e;
		try {
			let e = M(r, i.params);
			return A(r, {
				...e,
				[t]: n
			});
		} catch {
			return e;
		}
	};
	o ? o(s) : a(s(i));
}, P = (e) => {
	let { entry: n, value: r, onChange: a, workbench: o } = e, s = p(o), c = t(i(s)), l = (c.data ?? []).filter((e) => !n.providers || n.providers.includes(e.id)), u = k(r), d = l.find((e) => e.id === u.providerId), f = l[0];
	if (v(() => {
		!d && f && a(A(f, j(f)));
	}, [
		f,
		a,
		d
	]), c.error && !c.data) return /* @__PURE__ */ w(C, {
		role: "alert",
		color: "fg.error",
		children: c.error.message
	});
	if (c.isPending) return /* @__PURE__ */ w(C, {
		color: "fg.muted",
		children: "Loading workspace types..."
	});
	let m = d ?? f;
	if (!m) return /* @__PURE__ */ w(C, {
		color: "fg.muted",
		children: "This project has no workspace type that can run this command."
	});
	let h = d ? M(d, u.params) : j(m);
	return /* @__PURE__ */ w(F, {
		...e,
		projectId: s,
		providers: l,
		provider: m,
		values: h,
		onProviderChange: (e) => {
			let t = l.find((t) => t.id === e);
			t && a(A(t, j(t)));
		},
		onValueChange: (t, n) => N({
			...e,
			provider: m
		}, t, n)
	}, JSON.stringify([s, m]));
}, F = (e) => {
	let { entry: t, disabled: n, onValidationChange: r, projectId: i, provider: a, values: o, providers: s, onProviderChange: c, onValueChange: u } = e, p = g(a), m = y(r);
	m.current = r;
	let b = d(p, o, (e, t, n) => i ? h(i, e, t, n) : Promise.reject(/* @__PURE__ */ Error("Workspace choices need a project.")), u), x = Object.values(b.validate(o))[0];
	if (!x) try {
		l(p, o);
	} catch (e) {
		x = e instanceof Error ? e.message : String(e);
	}
	return v(() => {
		m.current?.(x);
	}, [x]), v(() => () => m.current?.(void 0), []), /* @__PURE__ */ w(_, {
		typeLabel: f(t),
		providers: s,
		provider: a,
		values: o,
		disabled: n,
		optionStates: b.states,
		onRetryOptions: b.retry,
		onProviderChange: c,
		onValueChange: u
	});
}, I = "project-1", L = c();
m(L, {
	id: I,
	name: "Prompt Studio"
});
var R = [{
	id: "pstdio.worktree",
	label: "Git worktree",
	icon: "git-branch",
	description: "Create an isolated branch in the project repository.",
	params: { base: {
		type: "select",
		label: "Base branch",
		defaultValue: "main",
		required: !0,
		options: [
			"main",
			"develop",
			"feature/documents"
		].map((e) => ({
			label: e,
			value: e,
			icon: "git-commit-horizontal"
		}))
	} }
}, {
	id: "cloud.environment",
	label: "Remote environment",
	icon: "rocket",
	description: "The provider supplies its files. Local files are not uploaded or synchronized.",
	params: { image: {
		type: "text",
		label: "Environment image",
		required: !0
	} }
}], z = new n({ defaultOptions: { queries: { staleTime: Infinity } } });
z.setQueryData(r(I), R);
var B = {
	title: "CommandParams/WorkspaceParamField",
	component: (t) => {
		let { providerIds: n } = t, [r, i] = b(""), a = {
			key: "workspace",
			type: "workspace",
			label: "Workspace",
			required: !1,
			providers: n
		};
		return /* @__PURE__ */ w(e, {
			client: z,
			children: /* @__PURE__ */ T(x.Root, {
				open: !0,
				size: "lg",
				children: [/* @__PURE__ */ w(x.Backdrop, {}), /* @__PURE__ */ w(x.Positioner, { children: /* @__PURE__ */ T(x.Content, { children: [/* @__PURE__ */ w(x.Header, { children: /* @__PURE__ */ w(x.Title, { children: "Run attempt" }) }), /* @__PURE__ */ w(x.Body, { children: /* @__PURE__ */ T(S, {
					gap: "sm",
					children: [/* @__PURE__ */ w(P, {
						workbench: L,
						entry: a,
						value: r,
						disabled: !1,
						onChange: i,
						onUpdateValue: i
					}), /* @__PURE__ */ w(C, {
						"data-testid": "workspace-param-value",
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: String(r)
					})]
				}) })] }) })]
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, V = { play: async () => {
	let e = await o(document.body).findByTestId("workspace-param-value");
	await a(() => s(e.textContent).toBe(JSON.stringify({
		providerId: "pstdio.worktree",
		params: { base: "main" }
	})));
} }, H = { args: { providerIds: ["pstdio.worktree"] } }, U = { args: { providerIds: ["acme.missing"] } };
export { V as AllWorkspaceTypes, H as GitWorktreeOnly, U as NoMatchingType, B as default };
