// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./icon-D3uE7jD-.ts";
import { t } from "./resource-link-picker-Cp3Bn-In.ts";
import { t as n } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useEffect as r, useState as i } from "react";
import { Button as a, Dialog as o, HStack as s, IconButton as c, Stack as l, Text as u } from "@chakra-ui/react";
import { AlertMessage as d, ListRow as f, ScrollArea as p } from "@pstdio/ui";
import { Fragment as m, jsx as h, jsxs as g } from "react/jsx-runtime";
import { resourceKey as _ } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/react/resource-links/related-resources.tsx
var v = (n) => {
	let { resource: v, service: y, onClose: b } = n, [x, S] = i([]), [C, w] = i(), [T, E] = i(), [D, O] = i(!1), [k, A] = i(!1), [j, M] = i(!0), [N, P] = i(), [F, I] = i(0), L = _(v);
	r(() => y.subscribe(() => {
		I((e) => e + 1);
	}), [y]), r(() => {
		let e = !1, t = new AbortController();
		return M(!0), P(void 0), y.list({
			resource: v,
			direction: "both",
			limit: 25,
			cursor: C
		}).then(async (n) => {
			if (e) return;
			let r = n.items.map((e) => _(e.source) === L ? e.target : e.source), i = await y.resolve(r, t.signal);
			if (e) return;
			let a = new Map(i.map((e) => [_(e.resource), e]));
			S(n.items.map((e, t) => ({
				edge: e,
				incoming: _(e.source) !== L,
				candidate: a.get(_(r[t])) ?? { resource: r[t] }
			}))), E(n.nextCursor);
		}).catch((t) => {
			e || P(t instanceof Error ? t.message : String(t));
		}).finally(() => {
			e || M(!1);
		}), () => {
			e = !0, t.abort();
		};
	}, [
		v,
		L,
		C,
		F,
		y
	]);
	let R = async (e) => {
		A(!0), P(void 0);
		try {
			await e(), O(!1), w(void 0), I((e) => e + 1);
		} catch (e) {
			P(e instanceof Error ? e.message : String(e));
		} finally {
			A(!1);
		}
	}, z = (e, t) => R(() => y.add(v, [{
		...e.resource,
		role: t
	}])), B = async (e) => {
		P(void 0);
		try {
			await e.open?.(), b();
		} catch (e) {
			P(e instanceof Error ? e.message : String(e));
		}
	};
	return /* @__PURE__ */ g(m, { children: [/* @__PURE__ */ h(o.Header, { children: /* @__PURE__ */ h(o.Title, { children: D ? "Link resource" : "Related resources" }) }), /* @__PURE__ */ h(o.Body, { children: /* @__PURE__ */ g(l, {
		gap: "3",
		children: [
			/* @__PURE__ */ h(u, {
				color: "fg.muted",
				textStyle: "sm",
				children: v.label ?? v.shorthand ?? v.id
			}),
			N ? /* @__PURE__ */ h(d, {
				status: "error",
				title: N
			}) : null,
			D ? /* @__PURE__ */ h(t, {
				service: y,
				excludeKey: L,
				busy: k,
				onCancel: () => O(!1),
				onSelect: z
			}) : /* @__PURE__ */ g(m, { children: [
				j ? /* @__PURE__ */ h(u, {
					color: "fg.muted",
					textStyle: "sm",
					children: "Loading resources…"
				}) : null,
				!j && !x.length && !N ? /* @__PURE__ */ h(u, {
					color: "fg.muted",
					textStyle: "sm",
					children: "No related resources yet."
				}) : null,
				/* @__PURE__ */ h(p, {
					maxH: "80",
					children: x.map(({ edge: t, candidate: n, incoming: r }) => /* @__PURE__ */ h(f, {
						label: n.resource.label ?? n.resource.shorthand ?? `${n.resource.type}: ${n.resource.id}`,
						description: `${r ? "Incoming" : "Outgoing"} · ${t.target.role ?? "context"}${n.open ? "" : " · Unavailable"}`,
						tooltip: `${n.resource.extensionId ?? "pstdio"} · ${n.resource.type}: ${n.resource.id}`,
						icon: /* @__PURE__ */ h(e, { name: n.resource.icon ?? "file-text" }),
						onActivate: n.open ? () => {
							B(n);
						} : void 0,
						endContent: /* @__PURE__ */ h(c, {
							"aria-label": "Remove link",
							variant: "ghost",
							size: "2xs",
							disabled: k,
							onKeyDown: (e) => e.stopPropagation(),
							onClick: (e) => {
								e.stopPropagation(), R(() => y.remove(t.source, [t.target]));
							},
							children: /* @__PURE__ */ h(e, { name: "unlink" })
						})
					}, `${_(t.source)}:${_(t.target)}`))
				}),
				/* @__PURE__ */ g(s, { children: [
					/* @__PURE__ */ g(a, {
						variant: "outline",
						onClick: () => O(!0),
						disabled: k,
						children: [/* @__PURE__ */ h(e, { name: "link" }), "Link resource"]
					}),
					C ? /* @__PURE__ */ h(a, {
						variant: "ghost",
						onClick: () => w(void 0),
						disabled: j,
						children: "First page"
					}) : null,
					T ? /* @__PURE__ */ h(a, {
						variant: "ghost",
						onClick: () => w(T),
						disabled: j,
						children: "More resources"
					}) : null
				] })
			] })
		]
	}) })] });
}, y = {
	type: "ticket",
	id: "ticket",
	extensionId: "planner",
	projectId: "project",
	label: "PS-490 · General resource linking"
}, b = {
	type: "artifact",
	id: "prototype",
	extensionId: "artifacts",
	projectId: "project",
	label: "Interaction prototype",
	icon: "file-code"
}, x = {
	type: "workspace",
	id: "worktree",
	extensionId: "pstdio",
	projectId: "project",
	label: "WS-180 · Implementation",
	icon: "folder"
}, S = {
	type: "note",
	id: "deleted-resource",
	extensionId: "notes",
	projectId: "project"
}, C = (e, t = !1) => ({
	list: async () => {
		if (t) throw Error("The connection was interrupted. Try again.");
		return { items: e };
	},
	add: async () => void 0,
	remove: async () => void 0,
	search: async () => [{
		resource: b,
		description: "Artifacts"
	}, {
		resource: x,
		description: "Workspaces"
	}],
	resolve: async () => [{
		resource: b,
		open: async () => void 0
	}, {
		resource: x,
		open: async () => void 0
	}],
	subscribe: () => () => void 0
}), w = {
	title: "Workbench/Resource links",
	component: v,
	args: {
		resource: y,
		onClose: () => void 0
	},
	decorators: [(e) => /* @__PURE__ */ h(n, { children: /* @__PURE__ */ h(o.Root, {
		open: !0,
		children: /* @__PURE__ */ h(o.Positioner, { children: /* @__PURE__ */ h(o.Content, {
			maxW: "lg",
			children: /* @__PURE__ */ h(e, {})
		}) })
	}) })]
}, T = { args: { service: C([
	{
		source: y,
		target: {
			...b,
			role: "result"
		}
	},
	{
		source: x,
		target: {
			...y,
			role: "primary"
		}
	},
	{
		source: y,
		target: S
	}
]) } }, E = { args: { service: C([]) } }, D = { args: { service: C([], !0) } }, O = { args: { service: {
	...C([]),
	list: () => new Promise(() => {})
} } };
export { E as Empty, D as Failure, O as Loading, T as Related, w as default };
