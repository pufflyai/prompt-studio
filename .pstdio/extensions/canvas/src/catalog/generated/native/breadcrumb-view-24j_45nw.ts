// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e } from "./resource-registry-CVuZngrt.ts";
import { P as t, a as n, d as r, r as i } from "./workbench-core-N58OeDyx.ts";
import { t as a } from "./use-workbench-store-BMaFgEbb.ts";
import { t as o } from "./icon-D3uE7jD-.ts";
import { r as s } from "./resource-actions-B6hNjsqI.ts";
import { n as c, t as l } from "./resource-menu-BPUwurff.ts";
import { n as u } from "./page-active-placement-CV13tWER.ts";
import { useEffect as d, useState as f } from "react";
import { HStack as p, Text as m } from "@chakra-ui/react";
import { Breadcrumb as h, SessionIndicator as g } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/breadcrumb/breadcrumb-snapshot.ts
var y = (e, t, n, r, i) => e === t && n && e.resource && i(e.resource) === i(n) ? r : {}, b = (e) => e?.tab?.getSnapshot(t(e)) ?? {}, x = (t, n) => {
	let r = a(n.resources.preview.store, (e) => e.changes), [i, o] = f(() => ({
		placement: t,
		snapshot: b(t)
	}));
	d(() => {
		let e = () => o({
			placement: t,
			snapshot: b(t)
		}), n = t?.tab?.subscribe?.(e);
		return e(), () => {
			typeof n == "function" ? n() : n?.dispose();
		};
	}, [t]);
	let s = i.placement === t ? i.snapshot : b(t), c = t?.resource, l = c ? e(c, r) : void 0;
	return l && l !== c ? {
		...s,
		label: l.label
	} : s;
}, S = (e) => {
	let t = a(e.pages.store, (e) => e), o = t.activePageId ? t.pages[t.activePageId] : void 0, s = a(e.layout.store, (t) => u(t.layout, o, e.pages.store.getState().location?.resource, (t) => i(e, t)?.id === o?.id)), c = r(t), l = c ?? s, d = x(l, e);
	return {
		placement: l,
		content: c,
		snapshot: d,
		resourcePresentation: l?.placementIdentity && n(e, l.placementIdentity)?.kind === "binding" ? d : {}
	};
}, C = (e) => typeof e.resource?.metadata?.status == "string" ? e.resource.metadata.status : void 0, w = (e) => {
	let { item: t } = e, n = C(t);
	return t.indicator === "session-status" ? /* @__PURE__ */ _(g, {
		status: n,
		boxSize: "14px"
	}) : t.icon ? /* @__PURE__ */ _(m, {
		as: "span",
		"aria-hidden": "true",
		color: "fg.muted",
		display: "inline-flex",
		flexShrink: 0,
		children: /* @__PURE__ */ _(o, {
			name: t.icon,
			size: 14
		})
	}) : null;
}, T = (e) => {
	let { item: t } = e, n = t.title;
	return /* @__PURE__ */ v(p, {
		as: "span",
		gap: "2xs",
		minW: "0",
		children: [/* @__PURE__ */ _(w, { item: t }), /* @__PURE__ */ _(m, {
			as: "span",
			minW: "0",
			maxW: "15rem",
			truncate: !0,
			children: n
		})]
	});
}, E = (e, t) => (e ?? []).map((e) => {
	let n = t?.(e);
	return {
		title: /* @__PURE__ */ _(T, { item: e }),
		url: e.url,
		onClick: e.onClick,
		...n?.length ? { contextMenuActions: n } : {}
	};
}), D = (t) => {
	let { workbench: n } = t, r = a(n.resources.preview.store, (e) => e.changes), i = a(n.breadcrumbs.store, (e) => e.items) ?? [], { placement: o, content: u, snapshot: d, resourcePresentation: f } = S(n);
	if (s(n), i.length === 0) return null;
	let p = o?.resource, m = i.flatMap((t) => {
		if (!t.resource) return [t];
		let a = e(t.resource, r);
		if (!a) return [];
		let o = y(t, i.at(-1), p, f, n.pages.resourceReferenceKey);
		return [{
			...t,
			resource: a,
			title: a === t.resource ? o.label ?? t.title : a.label,
			icon: (a === t.resource ? void 0 : a.icon) ?? o.icon ?? t.icon
		}];
	});
	return u && !p && m.length && d.label && d.label !== m.at(-1)?.title && m.push({
		title: d.label,
		icon: d.icon ?? m.at(-1)?.icon
	}), p && e(p, r) && !m.some((e) => e.resource && n.pages.resourceReferenceKey(e.resource) === n.pages.resourceReferenceKey(p)) && m.push({
		title: f.label ?? p.label ?? p.id,
		icon: f.icon ?? n.resources.getKind(p.type, p.extensionId)?.icon,
		resource: p
	}), /* @__PURE__ */ _(h, {
		items: E(m, (e) => [...e.resource || e === m.at(-1) ? l(n, e.resource, !p && e === m.at(-1) ? d : y(e, m.at(-1), p, d, n.pages.resourceReferenceKey), e === m.at(-1) ? o : void 0) : [], ...c(n, { menu: e.menu }, e.resource, e === m.at(-1) ? o : void 0)]),
		separator: "/",
		separatorGap: "xs",
		display: "flex",
		h: "full"
	});
};
export { S as n, x as r, D as t };
