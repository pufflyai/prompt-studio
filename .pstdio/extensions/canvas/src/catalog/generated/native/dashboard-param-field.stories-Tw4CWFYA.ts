// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./queryClient-BgKKh9f4.ts";
import { t as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./use-workbench-store-BMaFgEbb.ts";
import { n as a } from "./command-param-descriptors-DkvKpi2f.ts";
import { i as o, o as s } from "./project-context-BR7AjHlE.ts";
import { r as c } from "./template-provider-api-NLcTDJc8.ts";
import { a as l, t as u } from "./dashboard-rows-B7KuOiwh.ts";
import { useState as d, useSyncExternalStore as f } from "react";
import { Button as p, Dialog as m, Stack as h } from "@chakra-ui/react";
import { jsx as g, jsxs as _ } from "react/jsx-runtime";
import { resourceKey as v } from "@pstdio/sdk/extensions";
import { ParamEditorRow as y } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/shared/command-params/resource-param-options.ts
var b = (e) => ({
	type: e.type,
	id: e.id ?? v(e),
	...e.label ? { label: e.label } : {},
	...e.metadata ? { metadata: e.metadata } : {}
}), x = (e, t) => {
	let n = /* @__PURE__ */ new Set();
	return e.flatMap((e) => {
		let { resource: r } = e;
		return t && r.type !== t || n.has(v(r)) ? [] : (n.add(v(r)), [{
			id: v(r),
			name: r.label ?? r.id ?? v(r),
			description: e.description,
			icon: r.icon,
			value: JSON.stringify(b(r))
		}]);
	});
}, S = (e, t) => {
	if (typeof t != "string" || t.length === 0) return "";
	try {
		let n = JSON.parse(t);
		return e.find((e) => {
			let t = JSON.parse(e.value);
			return t.type === n.type && t.id === n.id;
		})?.id ?? "";
	} catch {
		return "";
	}
}, C = (e) => {
	let { entry: t, value: n, disabled: r, onChange: o, workbench: s } = e;
	i(s.resources.store, (e) => e.providers), f(l, u, u);
	let c = x(s.resources.listResources(""), t.resourceType), d = {
		id: t.key,
		name: a(t),
		description: t.description,
		type: "selection",
		defaultValue: S(c, n),
		options: c.map((e) => ({
			id: e.id,
			name: e.name,
			description: e.description,
			icon: e.icon
		})),
		clearable: !t.required,
		placeholder: `Select ${t.label.toLowerCase()}`,
		searchable: c.length > 5,
		searchPlaceholder: `Search ${t.label.toLowerCase()}…`,
		emptyText: `No ${t.label.toLowerCase()} available`,
		disabled: r || c.length === 0
	};
	return /* @__PURE__ */ g(y, {
		param: d,
		onChange: (e, t) => {
			typeof t == "string" && o(c.find((e) => e.id === t)?.value ?? "");
		}
	});
}, w = (e, t) => e.filter((e) => !t.templateType || e.templateType === t.templateType).map((e) => ({
	label: e.title,
	value: e.name
})), T = (e) => typeof e == "string" ? e : "", E = (e) => ["project-template-assets", e], D = (e) => {
	let { entry: n, value: r, disabled: i, onChange: s, workbench: l } = e, u = o(l), d = T(r), { data: f = [], isLoading: p } = t({
		queryKey: E(u),
		queryFn: () => u ? c(u) : Promise.resolve([]),
		enabled: !!u
	}), m = w(f, n), h = {
		id: n.key,
		name: a(n),
		description: n.description,
		type: "selection",
		defaultValue: d,
		options: m.map((e) => ({
			id: e.value,
			name: e.label,
			icon: "FileText"
		})),
		clearable: !n.required,
		placeholder: p ? "Loading templates…" : "No template",
		searchable: m.length > 5,
		searchPlaceholder: "Search templates…",
		emptyText: "No templates available",
		disabled: i || p
	};
	return /* @__PURE__ */ g(y, {
		param: h,
		onChange: (e, t) => typeof t == "string" && s(t)
	});
}, O = "project-1", k = r();
s(k, {
	id: O,
	name: "Prompt Studio"
}), k.resources.registerProvider({
	id: "story.workspaces",
	kind: "workspace",
	list: () => [{
		resource: {
			type: "workspace",
			id: "workspace-1",
			label: "PS-324_A1",
			icon: "GitBranch"
		},
		description: "bugfix/template-resource-dropdowns"
	}, {
		resource: {
			type: "workspace",
			id: "workspace-2",
			label: "PS-323_A1",
			icon: "GitBranch"
		},
		description: "feature/extension-input"
	}]
});
var A = new n({ defaultOptions: { queries: { staleTime: Infinity } } });
A.setQueryData(E(O), [{
	id: "ticket:bug-fix",
	projectId: O,
	name: "bug-fix",
	title: "Bug fix",
	templateType: "pstdio.pstdio-planner.template-type.ticket",
	localType: "ticket",
	groupLabel: "Ticket",
	groupOrder: 10,
	commands: {
		list: "list",
		read: "read",
		save: "save",
		delete: "delete"
	}
}, {
	id: "ticket:proposal",
	projectId: O,
	name: "proposal",
	title: "Proposal",
	templateType: "pstdio.pstdio-planner.template-type.ticket",
	localType: "ticket",
	groupLabel: "Ticket",
	groupOrder: 10,
	commands: {
		list: "list",
		read: "read",
		save: "save",
		delete: "delete"
	}
}]);
var j = {
	key: "template",
	type: "template",
	label: "Ticket template",
	required: !1,
	templateType: "pstdio.pstdio-planner.template-type.ticket"
}, M = {
	key: "workspace",
	type: "resource",
	label: "Workspace",
	required: !1,
	resourceType: "workspace"
}, N = {
	title: "CommandParams/DashboardParamFields",
	component: () => {
		let [t, n] = d(""), [r, i] = d("");
		return /* @__PURE__ */ g(e, {
			client: A,
			children: /* @__PURE__ */ _(m.Root, {
				open: !0,
				size: "lg",
				children: [/* @__PURE__ */ g(m.Backdrop, {}), /* @__PURE__ */ g(m.Positioner, { children: /* @__PURE__ */ _(m.Content, { children: [
					/* @__PURE__ */ g(m.Header, { children: /* @__PURE__ */ g(m.Title, { children: "Refine ticket" }) }),
					/* @__PURE__ */ g(m.Body, {
						p: "0",
						children: /* @__PURE__ */ _(h, {
							gap: "0",
							children: [/* @__PURE__ */ g(D, {
								workbench: k,
								entry: j,
								value: t,
								disabled: !1,
								onChange: n
							}), /* @__PURE__ */ g(C, {
								workbench: k,
								entry: M,
								value: r,
								disabled: !1,
								onChange: i
							})]
						})
					}),
					/* @__PURE__ */ _(m.Footer, { children: [/* @__PURE__ */ g(p, {
						size: "sm",
						variant: "ghost",
						children: "Cancel"
					}), /* @__PURE__ */ g(p, {
						size: "sm",
						variant: "primary",
						children: "Run"
					})] })
				] }) })]
			})
		});
	},
	parameters: { layout: "fullscreen" }
}, P = {};
export { P as TemplateAndResourceDropdowns, N as default };
