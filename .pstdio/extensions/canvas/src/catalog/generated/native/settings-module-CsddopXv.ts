// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { D as e, l as t, n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./resource-icons-CZFS6OM4.ts";
import { t as i } from "./use-workbench-store-BMaFgEbb.ts";
import { t as a } from "./icon-D3uE7jD-.ts";
import { t as o } from "./tree-view-DssaVHjf.ts";
import { i as s, n as c, r as l, t as u } from "./settings-resources-BmVO5oBi.ts";
import { useEffect as d, useState as f, useSyncExternalStore as p } from "react";
import { Box as m, Button as h, Flex as g, HStack as _, Spinner as v, Stack as y, Text as b } from "@chakra-ui/react";
import { EmptyState as x, ResizableSplitLayout as S, ScrollArea as C } from "@pstdio/ui";
import { jsx as w, jsxs as T } from "react/jsx-runtime";
import { resourceKey as E } from "@pstdio/sdk/extensions";
import { ParamEditor as D } from "@pstdio/ui/param-editor";
// packages/pstdio-workbench/src/react/renderers/settings/preference-schema-to-params.ts
var O = [{
	id: "true",
	name: "On"
}, {
	id: "false",
	name: "Off"
}], k = (e) => {
	let t = (e.split(".").at(-1) ?? e).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ");
	return t.charAt(0).toUpperCase() + t.slice(1);
}, A = (e) => e.map((e) => ({
	id: String(e),
	name: k(String(e))
})), j = (e) => {
	let { name: t, schema: n } = e, r = e.label ?? k(t), i = n.description, a = e.value ?? n.default, o = {
		id: t,
		name: r,
		description: i
	};
	if (n.type === "number") return {
		...o,
		type: "number",
		defaultValue: Number(a ?? 0)
	};
	if (n.type === "boolean") return {
		...o,
		type: "selection",
		defaultValue: String(!!a),
		options: O
	};
	if (n.type === "string") return n.enum ? {
		...o,
		type: "selection",
		defaultValue: String(a ?? ""),
		options: A(n.enum)
	} : {
		...o,
		type: "text",
		defaultValue: String(a ?? ""),
		singleLine: !0
	};
	if (n.type === "array" && n.enum) {
		let e = Array.isArray(a) ? a.map(String) : [];
		return {
			...o,
			type: "selection",
			multiSelect: !0,
			defaultValue: e,
			options: A(n.enum)
		};
	}
}, M = (e) => e.map(j).filter((e) => e !== void 0), N = (e, t) => e.type === "boolean" ? t === "true" : e.type === "number" ? Number(t) : e.type === "array" ? Array.isArray(t) ? t.map(String) : [] : String(t), P = (e) => typeof e == "string" ? { name: e } : e, F = (e) => {
	let { preferences: t, names: n, resolveScopeId: r, mode: i = "live" } = e, [a, o] = f({}), [s, c] = f(0), l = (e) => ({
		scope: e,
		scopeId: r?.(e)
	}), u = [];
	for (let e of n) {
		let { name: n, label: r } = P(e), i = t.getSchema(n);
		i && u.push({
			name: n,
			label: r,
			schema: i,
			value: t.getValue(n, l(i.scope))
		});
	}
	let d = M(u), p = new Map(u.map((e) => [e.name, e.schema])), m = (e, n) => {
		let r = p.get(e);
		r && t.setValue(e, N(r, n), l(r.scope));
	}, g = (e, t) => {
		i === "apply" ? o((n) => ({
			...n,
			[e]: t
		})) : m(e, t);
	}, v = () => {
		for (let [e, t] of Object.entries(a)) m(e, t);
		o({}), c((e) => e + 1);
	}, b = () => {
		o({}), c((e) => e + 1);
	}, x = Object.keys(a).length > 0;
	return /* @__PURE__ */ T(y, {
		gap: "md",
		maxW: "640px",
		children: [/* @__PURE__ */ w(D, {
			params: d,
			onChange: g,
			fullWidth: !0
		}, s), i === "apply" && /* @__PURE__ */ T(_, {
			gap: "sm",
			children: [/* @__PURE__ */ w(h, {
				size: "sm",
				onClick: v,
				disabled: !x,
				children: "Save"
			}), /* @__PURE__ */ w(h, {
				size: "sm",
				variant: "outline",
				onClick: b,
				disabled: !x,
				children: "Discard"
			})]
		})]
	});
}, I = (e) => /* @__PURE__ */ w(g, {
	h: "full",
	minH: "0",
	align: "center",
	justify: "center",
	p: "lg",
	children: e.children
}), L = (e) => /* @__PURE__ */ w(C, {
	h: "full",
	minH: "0",
	contentProps: {
		h: "full",
		minH: "full"
	},
	children: /* @__PURE__ */ w(m, {
		h: "full",
		minH: "full",
		children: e.children
	})
}), R = (e) => {
	let { input: t, panelId: r, viewId: a } = e, o = i(n(t.workbench).store, (e) => e.renderers[a]);
	if (i(n(t.workbench).store, (e) => e.refreshKeys[a] ?? 0), !o) return /* @__PURE__ */ w(I, { children: /* @__PURE__ */ w(x, { title: "Settings View not found" }) });
	let s = o.render({
		...t,
		instance: {
			...t.instance,
			instanceId: JSON.stringify([
				t.instance.instanceId,
				r,
				a
			]),
			panelId: r,
			viewId: a
		}
	});
	return e.embedded ? s : /* @__PURE__ */ w(L, { children: s });
}, z = (e) => {
	let { panel: t, itemId: n, input: r } = e, i = r.workbench.settings.resolveCollectionItem, [a, o] = f({ status: "loading" });
	return d(() => {
		let e = !0;
		return o({ status: "loading" }), i(t.id, n).then((t) => {
			e && o(t === void 0 ? { status: "missing" } : { status: "ready" });
		}), () => {
			e = !1;
		};
	}, [
		t,
		n,
		i
	]), a.status === "loading" ? /* @__PURE__ */ w(I, { children: /* @__PURE__ */ w(v, { size: "sm" }) }) : a.status === "missing" ? /* @__PURE__ */ w(I, { children: /* @__PURE__ */ w(x, { title: "Item not found" }) }) : /* @__PURE__ */ w(R, {
		input: r,
		panelId: t.id,
		viewId: t.viewId
	});
}, B = (e) => {
	let { input: n, settings: r, resolveScopeId: a } = e, o = i(r.store, (e) => e), s = n.instance.resource, c = typeof s?.metadata?.panelId == "string" ? s.metadata.panelId : void 0, l = typeof s?.metadata?.itemId == "string" ? s.metadata.itemId : void 0, u = c ? o.panels[c] : void 0;
	if (!u) return /* @__PURE__ */ w(I, { children: /* @__PURE__ */ w(x, {
		title: "Select a settings entry",
		description: "Pick an item from the settings sidenav."
	}) });
	if (u.kind === "view") {
		let e = t(o).filter((e) => e.parentPanelId === u.id && n.workbench.context.matches(e.when));
		return e.length === 0 ? /* @__PURE__ */ w(R, {
			input: n,
			panelId: u.id,
			viewId: u.viewId
		}) : /* @__PURE__ */ w(L, { children: /* @__PURE__ */ T(y, {
			gap: "md",
			children: [/* @__PURE__ */ w(R, {
				embedded: !0,
				input: n,
				panelId: u.id,
				viewId: u.viewId
			}), e.map((e) => e.kind === "view" ? /* @__PURE__ */ w(R, {
				embedded: !0,
				input: n,
				panelId: e.id,
				viewId: e.viewId
			}, e.id) : null)]
		}) });
	}
	return u.kind === "collection" ? l ? /* @__PURE__ */ w(z, {
		panel: u,
		itemId: l,
		input: n
	}, `${E(s) ?? l}:${o.revision}`) : /* @__PURE__ */ w(I, { children: /* @__PURE__ */ w(x, { title: u.title }) }) : /* @__PURE__ */ T(C, {
		h: "full",
		minH: "0",
		contentProps: {
			p: "lg",
			display: "flex",
			flexDirection: "column",
			gap: "md"
		},
		children: [/* @__PURE__ */ T(y, {
			gap: "xs",
			children: [/* @__PURE__ */ w(b, {
				textStyle: "heading/M/semibold",
				children: u.title
			}), u.description && /* @__PURE__ */ w(b, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				maxW: "640px",
				children: u.description
			})]
		}), /* @__PURE__ */ w(F, {
			preferences: n.workbench.preferences,
			names: u.preferences,
			resolveScopeId: a,
			mode: u.save ?? "live"
		})]
	});
}, V = (e) => p((t) => e.store.subscribe(() => t()), () => e.store.getState().revision, () => e.store.getState().revision), H = (e) => {
	let { input: t, settings: n, navTreeId: r, title: i, resolveScopeId: s } = e;
	V(n);
	let c = t.instance.resource, l = /* @__PURE__ */ w(m, {
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		bg: "bg.subtle",
		children: /* @__PURE__ */ w(o, {
			workbench: t.workbench,
			treeViewId: r,
			activeNodeId: E(c)
		})
	});
	return /* @__PURE__ */ T(g, {
		direction: "column",
		position: "absolute",
		inset: "0",
		minH: "0",
		minW: "0",
		overflow: "hidden",
		children: [/* @__PURE__ */ T(g, {
			align: "center",
			bg: "bg.subtle",
			borderBottomWidth: "1px",
			borderColor: "border.subtle",
			flexShrink: 0,
			gap: "2",
			h: "12",
			px: "3.5",
			children: [/* @__PURE__ */ w(m, {
				color: "fg.accent",
				display: "inline-flex",
				children: /* @__PURE__ */ w(a, {
					name: "settings",
					size: 16
				})
			}), /* @__PURE__ */ w(b, {
				fontWeight: "semibold",
				textStyle: "sm",
				children: i
			})]
		}), /* @__PURE__ */ w(m, {
			flex: "1",
			minH: "0",
			minW: "0",
			position: "relative",
			overflow: "hidden",
			children: /* @__PURE__ */ w(S, {
				position: "absolute",
				inset: "0",
				minH: "0",
				minW: "0",
				resizableSide: "left",
				resizablePanel: l,
				contentPanel: /* @__PURE__ */ w(m, {
					flex: "1",
					h: "full",
					minH: "0",
					minW: "0",
					children: /* @__PURE__ */ w(B, {
						input: t,
						settings: n,
						resolveScopeId: s
					})
				}),
				defaultSizePx: 280,
				minSizePx: 220,
				maxSizePx: 420,
				contentMinSizePx: 360,
				collapsible: !1,
				resizeLabel: "Resize settings navigation",
				separator: "line"
			})
		})]
	});
}, U = "settings", W = (e) => e?.map((e) => ({
	id: e.id,
	label: e.label,
	icon: e.icon,
	run: e.run
})), G = (e, t) => {
	let n = e.itemId(t), r = e.itemLabel(t), i = e.itemIcon?.(t), a = l(e.id, {
		id: n,
		label: r,
		icon: i
	});
	return {
		id: E(a),
		label: r,
		icon: i,
		resource: a,
		target: {
			kind: "command",
			commandId: u,
			args: {
				panelId: e.id,
				itemId: n
			}
		}
	};
}, K = (e, t) => {
	let n = (e) => {
		let n = t?.indexOf(e) ?? -1;
		return n === -1 ? Infinity : n;
	};
	return [...e].sort((e, t) => n(e) - n(t));
}, q = async (e) => {
	let t;
	try {
		t = await e.items();
	} catch {
		t = [];
	}
	if (!e.groupBy) return t.map((t) => G(e, t));
	let n = e.groupBy, r = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = n.key(e), i = r.get(t) ?? [];
		i.push(e), r.set(t, i);
	}
	return K([...r.keys()], n.order).map((t) => ({
		id: `${e.id}:group:${t}`,
		label: n.label(t),
		icon: n.icon?.(t),
		collapsible: !0,
		children: (r.get(t) ?? []).map((t) => G(e, t))
	}));
}, J = (e) => {
	if (e.kind === "collection") return {
		id: `settings-collection:${e.id}`,
		label: e.title,
		icon: e.icon,
		collapsible: !0,
		actions: W(e.actions),
		children: []
	};
	let t = s(e);
	return {
		id: E(t),
		label: e.title,
		icon: e.icon,
		resource: t,
		target: {
			kind: "command",
			commandId: u,
			args: { panelId: e.id }
		}
	};
}, Y = async (t) => {
	let { settings: n, hasProjectScope: r, matchesWhen: i, signal: a, onProgress: o } = t;
	a?.throwIfAborted();
	let s = n.listSections(), l = new Map(s.map((e) => [e.id, e])), u = n.listPanels().filter((e) => !e.parentPanelId && c(e.scope, r) && i(e.when)), d = /* @__PURE__ */ new Map();
	for (let e of u) {
		let t = e.section && l.has(e.section) ? e.section : U, n = d.get(t) ?? [];
		n.push(e), d.set(t, n);
	}
	let f = s.map((e) => e.id);
	d.has("settings") && !l.has("settings") && f.push(U);
	let p = [], m = [];
	for (let e of f) {
		let t = l.get(e);
		if (t?.scope === "project" && !r) continue;
		let n = d.get(e) ?? [], i = W(t?.actions);
		if (n.length === 0 && !i) continue;
		let a = n.map(J);
		for (let e of n) e.kind === "collection" && m.push(e);
		p.push({
			id: e,
			label: t?.title,
			actions: i,
			nodes: a,
			collapsible: !1
		});
	}
	return o?.(p), await e(m.map((e) => async (t) => {
		let n = await q(e);
		t.throwIfAborted(), p = p.map((t) => ({
			...t,
			nodes: t.nodes.map((t) => t.id === `settings-collection:${e.id}` ? {
				...t,
				children: n
			} : t)
		})), o?.(p);
	}), a), p;
}, X = "workbench.settings", Z = "workbench.settings.nav", Q = "workbench.settings.panel", $ = X, ee = (e) => {
	let { args: t, ctx: n, hasProjectScope: r } = e, i = t && typeof t == "object" ? t : void 0, a = i && "panelId" in i ? i.panelId : void 0, o = i && "itemId" in i ? i.itemId : void 0, u = typeof a == "string" ? n.settings.getPanel(a) : void 0, d = (e) => !e.parentPanelId && c(e.scope, r()) && n.context.matches(e.when), f = (u && d(u) ? u : void 0) ?? n.settings.listPanels().find(d);
	if (!f) return;
	let p = f.kind === "collection" && typeof o == "string" ? l(f.id, {
		id: o,
		label: o
	}) : s(f);
	return n.overlays.openOverlay($, {
		resource: p,
		title: p.label
	}), p;
}, te = (e = {}) => {
	let t = e.title ?? "Settings", n = () => e.resolveScopeId?.("project") !== void 0;
	return {
		id: "workbench.settings.surface",
		activate(i) {
			i.views.registerView({
				id: Z,
				title: `${t} navigation`,
				body: {
					kind: "tree",
					defaultExpandedSectionIds: [...i.settings.listSections().map((e) => e.id), U],
					getBody: ({ signal: e, onProgress: t }) => Y({
						settings: i.settings,
						hasProjectScope: n(),
						matchesWhen: (e) => i.context.matches(e),
						signal: e,
						onProgress: t
					}),
					getChildren: () => []
				}
			}), i.views.registerView({
				id: Q,
				title: t,
				body: {
					kind: "react",
					render: (t) => /* @__PURE__ */ w(B, {
						input: t,
						settings: i.settings,
						resolveScopeId: e.resolveScopeId
					})
				}
			}), i.views.registerView({
				id: $,
				title: t,
				body: {
					kind: "react",
					render: (n) => /* @__PURE__ */ w(H, {
						input: n,
						settings: i.settings,
						navTreeId: Z,
						title: t,
						resolveScopeId: e.resolveScopeId
					})
				}
			}), i.overlays.registerOverlay({
				id: $,
				viewId: $,
				config: {
					size: "xl",
					scrollBehavior: "inside",
					contentHeight: "min(760px, 88vh)",
					contentMaxWidth: "min(1440px, 94vw)",
					contentWidth: "94vw",
					closeOnInteractOutside: !1
				}
			}), i.commands.registerCommand({
				id: u,
				label: "Open settings",
				category: "Settings",
				icon: r.settings
			}, { execute: (e) => ee({
				args: e,
				ctx: i,
				hasProjectScope: n
			}) });
			let a = () => {
				i.views.getView("workbench.settings.nav") && i.views.refreshView(Z);
			}, o = i.settings.store.subscribe(a), s = i.context.store.subscribe(a);
			return { dispose() {
				o(), s();
			} };
		}
	};
};
export { te as t };
