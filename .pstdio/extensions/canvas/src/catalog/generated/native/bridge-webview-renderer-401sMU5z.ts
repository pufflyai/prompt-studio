// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./extension-webview-host-capabilities-DOAAv1Ha.ts";
import { J as n } from "./workbench-core-N58OeDyx.ts";
import { t as r } from "./host-BKbqlzxa.ts";
import { useEffect as i, useState as a } from "react";
import { Box as o, Center as s, Stack as c, Text as l } from "@chakra-ui/react";
import { jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-extensions/src/bridge/host/host-diagnostics.ts
var f = "[pstdio.extension-host] ", p = (e, t = console.info) => {
	t(`${f}${JSON.stringify(e)}`);
}, m = (e, t) => {
	let n = (n) => p({
		extensionId: e.extensionId,
		contributionId: e.id,
		...n
	}, t);
	return {
		onReady: () => n({ event: "webview-ready" }),
		onError: (e) => n({
			event: "webview-error",
			...e
		}),
		onDiagnostics: (e) => {
			for (let t of e) n({
				event: "webview-diagnostic",
				...t
			});
		}
	};
}, h = (e) => {
	let { view: t, workbench: f, ...p } = e, [h, g] = a(f.pages.store.getState);
	i(() => f.pages.store.subscribe((e) => g(e)), [f]);
	let _ = h.activePageId ? f.pages.getPage(h.activePageId) : void 0, v = {
		pageLocation: h.location,
		pageParams: n(_?.params, h.location?.params)
	}, [y, b] = a(null), x = m(t);
	return /* @__PURE__ */ d(o, {
		position: "relative",
		width: e.sizing === "content-width" ? "max-content" : "full",
		height: e.sizing === "content-height" ? "auto" : "full",
		minH: "0",
		display: "flex",
		flexDirection: "column",
		children: [y ? /* @__PURE__ */ u(s, {
			position: "absolute",
			inset: "0",
			px: "md",
			zIndex: 1,
			bg: "bg",
			children: /* @__PURE__ */ d(c, {
				gap: "xs",
				maxW: "md",
				textAlign: "center",
				children: [/* @__PURE__ */ u(l, {
					textStyle: "paragraph/S/medium",
					color: "fg.error",
					children: "Extension view failed to load."
				}), /* @__PURE__ */ u(l, {
					textStyle: "paragraph/XS/regular",
					color: "fg.muted",
					children: y
				})]
			})
		}) : null, /* @__PURE__ */ u(r, {
			view: t,
			...p,
			props: {
				...p.props,
				...v
			},
			onReady: () => {
				x.onReady(), b(null);
			},
			onDiagnostics: x.onDiagnostics,
			onError: (e) => {
				x.onError(e), b(e.message);
			}
		})]
	});
}, g = () => "light", _ = /* @__PURE__ */ new WeakMap(), v = (t, n) => {
	let r = _.get(t);
	r || (r = /* @__PURE__ */ new Map(), _.set(t, r));
	let i = n.instanceId, a = r.get(i);
	return a || (a = e(), r.set(i, a)), a;
}, y = (e) => {
	let { context: n, createHostAdapters: r, createProps: i, createTheme: a = g, ownerId: o, title: s, webview: c } = e;
	return /* @__PURE__ */ u(h, {
		sizing: e.sizing,
		view: {
			extensionId: o ?? "workbench",
			id: n.webviewId,
			label: c.title ?? s,
			webview: {
				capabilities: c.capabilities,
				moduleUrl: c.moduleUrl,
				runtimeUrl: c.runtimeUrl,
				styles: c.styles ?? []
			}
		},
		props: {
			...i(n),
			viewLocation: {
				section: n.placement.section,
				position: n.placement.position,
				pageContext: n.placement.pageContext
			}
		},
		workbench: n.workbench,
		theme: a(n),
		capabilities: t(r({
			...n,
			extensionId: o ?? n.extensionId
		})),
		hostEvents: n.hostEvents
	});
};
export { y as n, v as t };
