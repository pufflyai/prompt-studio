// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { P as e, W as t, i as n, o as r } from "./workbench-core-N58OeDyx.ts";
import { t as i } from "./use-workbench-store-BMaFgEbb.ts";
import { useEffect as a, useLayoutEffect as o, useRef as s, useState as c } from "react";
import { Box as l, Center as u, Text as d } from "@chakra-ui/react";
import { useThemePreference as f } from "@pstdio/ui";
import { jsx as p } from "react/jsx-runtime";
import { Terminal as m, createTerminalThemeFromPreference as h } from "@pstdio/ui/terminal";
// packages/pstdio-workbench/src/react/terminal/workbench-terminal-panel.tsx
var g = (e) => {
	let t = e?.metadata?.workspacePath;
	return typeof t == "string" && t.length > 0 ? t : void 0;
}, _ = (e, t) => {
	let n = g(t);
	return n && !e.cwd ? {
		...e,
		cwd: n
	} : e;
}, v = (e, t = {}) => ({ async openSession(n) {
	let { sessionId: r } = await e.open({
		bindingId: t.getBindingId?.(),
		request: _(n, t.getResource?.()),
		title: t.getTitle?.()
	});
	return {
		id: r,
		write: (t) => e.write({
			sessionId: r,
			data: t
		}),
		resize: (t, n) => e.resize({
			sessionId: r,
			cols: t,
			rows: n
		}),
		kill: (t) => e.kill({
			sessionId: r,
			signal: t
		}),
		onData: (t) => e.subscribe(r, { onData: t }),
		onExit: (t) => e.subscribe(r, { onExit: t }),
		onError: (t) => e.subscribe(r, { onError: t })
	};
} }), y = (e) => {
	let { placement: t, workbench: n } = e, { themePreference: r, themePreferences: g } = f(), _ = g.find((e) => e.id === r), y = s(t);
	o(() => {
		y.current = t;
	}, [t]);
	let [b] = c(() => v(n.terminal, {
		getBindingId: () => y.current.instanceId,
		getResource: () => y.current.resource,
		getTitle: () => y.current.title
	})), [x, S] = c(), C = i(n.terminal.store, (e) => x ? e.sessionsById[x]?.title : void 0), w = i(n.layout.store, (e) => {
		let n = Object.values(e.layout.regions).find((e) => e.widgets.some((e) => e.widgetId === t.instanceId));
		return n ? (n.activeWidgetId ?? n.widgets[0]?.widgetId) === t.instanceId : !1;
	}), T = n.shellPlacements.updatePlacement;
	return a(() => {
		if (!x || !C) return;
		let e = n.layout.getLayout().regions, r = Object.values(e).flatMap((e) => e.widgets).find((e) => e.widgetId === t.instanceId), i = r?.placementIdentity;
		i?.kind === "shell" && r?.resource && T(i, { resource: {
			...r.resource,
			label: C
		} });
	}, [
		x,
		C,
		t.instanceId,
		n.layout,
		T
	]), n.terminal.isAvailable() ? /* @__PURE__ */ p(l, {
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		children: /* @__PURE__ */ p(m, {
			bridge: b,
			theme: h(_),
			autoFocus: w,
			killOnUnmount: !1,
			onSessionOpen: S
		})
	}) : /* @__PURE__ */ p(u, {
		h: "full",
		px: "md",
		children: /* @__PURE__ */ p(d, {
			textStyle: "paragraph/S/regular",
			color: "fg.muted",
			children: "Terminal sessions are not available in this workbench host."
		})
	});
}, b = "workbench.terminal", x = "workbench.terminal.open", S = (e) => t.flatMap((t) => e.regions[t].widgets).filter((e) => e.viewId === b), C = (e) => new Set(S(e.layout.getLayout()).map((e) => e.widgetId)), w = (e) => {
	let t = e.layout.getPersistenceScope(), i = e.modes.getActiveModeId(), a = e.pages.store.getState(), o = e.layout.store.subscribe((o, s) => {
		let c = e.layout.getPersistenceScope(), l = c !== t;
		t = c;
		let u = e.modes.getActiveModeId(), d = u !== i;
		i = u;
		let f = e.pages.store.getState(), p = new Set(n(f, a, s.layout).map((e) => e.widgetId)), m = new Set(r(f, a) ? s.layout.regions.main.widgets.filter((e) => e.tabRetention !== "preview").map((e) => e.widgetId) : []);
		if (a = f, d || e.modes.isTransitioning()) return;
		let h = new Set(S(o.layout).map((e) => e.widgetId)), g = S(s.layout).map((e) => e.widgetId);
		for (let t of g) m.has(t) || l && !p.has(t) || h.has(t) || e.terminal.killBinding(t);
	});
	return { dispose() {
		o();
		for (let t of C(e)) e.terminal.killBinding(t);
	} };
}, T = /^Terminal (\d+)$/, E = /* @__PURE__ */ new WeakMap(), D = (e) => {
	let t = S(e.layout.getLayout()), n = t.map((e) => T.exec(e.title ?? "")?.[1]).filter((e) => e !== void 0).map((e) => Number.parseInt(e, 10));
	return Math.max(t.length, ...n) + 1;
}, O = (e) => {
	let t = Math.max(E.get(e.layout.store) ?? 1, D(e));
	return E.set(e.layout.store, t + 1), `Terminal ${t}`;
}, k = (e) => typeof e?.metadata?.workspacePath == "string" && e.metadata.workspacePath.length > 0, A = (e, t) => {
	let n = e.getActiveResource(), r = e.getPrimaryResource();
	return (k(t) ? t : void 0) ?? (k(n) ? n : void 0) ?? (k(r) ? r : void 0) ?? t ?? r;
}, j = (t, n = {}) => {
	let { reveal: r = !0, region: i = "secondary" } = n, a = A(t, n.resource), o = O(t), s = Number.parseInt(T.exec(o)?.[1] ?? "1", 10), c = {
		type: "terminal",
		id: `${String(s).padStart(8, "0")}-${globalThis.crypto.randomUUID()}`,
		extensionId: "pstdio",
		projectId: a?.projectId ?? t.pages.store.getState().projectId,
		label: o,
		icon: "SquareTerminal",
		metadata: a?.metadata
	}, l = t.shellPlacements.openPlacement({
		placementId: b,
		resource: c,
		open: "pin",
		title: o,
		region: i
	});
	if (l.kind !== "shell") throw Error("Terminal placement must be shell-owned");
	r && i !== "main" && t.shell.setRegionOpen(i, !0);
	let u = t.layout.getLayout().regions[i].widgets.find((e) => e.placementIdentity?.kind === "shell" && e.placementIdentity.placementId === l.placementId && e.placementIdentity.instanceKey === l.instanceKey);
	if (!u) throw Error(`Terminal placement did not open: ${l.instanceKey}`);
	return e(u);
}, M = () => ({
	id: "workbench.terminal.surface",
	activate(e) {
		return [
			e.views.registerView({
				id: b,
				title: "Terminal",
				icon: "SquareTerminal",
				body: {
					kind: "react",
					render: (e) => /* @__PURE__ */ p(y, {
						placement: e.instance,
						workbench: e.workbench
					})
				}
			}),
			e.shellPlacements.registerPlacement({
				id: b,
				item: {
					kind: "binding",
					binding: {
						kinds: [{
							kind: "resource-kind",
							id: "terminal"
						}],
						view: {
							kind: "view",
							id: b
						},
						cardinality: "many",
						add: {
							kind: "command",
							target: { command: {
								kind: "command",
								id: x
							} }
						}
					}
				},
				region: "secondary",
				mountStrategy: "keep-mounted",
				hiddenByDefault: !0
			}),
			w(e),
			e.commands.registerCommand({
				id: x,
				label: "Open terminal",
				category: "Terminal",
				icon: "SquareTerminal"
			}, { execute: (t, n) => j(e, {
				resource: n?.resource,
				region: n?.region
			}) })
		];
	}
});
export { j as i, b as n, M as r, x as t };
