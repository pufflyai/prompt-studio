// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { d as e, f as t, l as n, m as r, o as i, p as a, r as o, s, t as c, u as l } from "./resource-registry-CVuZngrt.ts";
import { contributionRefId as u, dockedWorkbenchRegions as d, isFileSourcePosition as f, isLocalizedString as p, isNavigationTarget as m, resourceKey as h, workbenchPages as g } from "@pstdio/sdk/extensions";
// packages/pstdio-api-contracts/src/extension-kernel/source-position.ts
var _ = (e) => {
	if (!e || typeof e != "object" || Array.isArray(e)) return !1;
	let t = e, n = (e) => typeof e == "number" && Number.isSafeInteger(e) && e > 0;
	if (!n(t.line)) return !1;
	for (let e of [
		"column",
		"endLine",
		"endColumn"
	]) if (t[e] !== void 0 && !n(t[e])) return !1;
	return !(t.endColumn !== void 0 && t.endLine === void 0 || t.endLine !== void 0 && (t.endLine < t.line || t.endLine === t.line && (t.endColumn ?? 1) < (t.column ?? 1)));
}, v = /* @__PURE__ */ new Set([
	"resource",
	"section",
	"document",
	"line",
	"column",
	"endLine",
	"endColumn"
]), y = (e) => /* @__PURE__ */ Error(`page_param_invalid: ${e}`), b = (e, t) => JSON.stringify(e) === JSON.stringify(t), x = (e, t) => e.type === "string[]" ? Array.isArray(t) && t.every((e) => typeof e == "string") : e.type === "string" ? typeof t == "string" && (!e.values || e.values.includes(t)) : e.type === "number" ? typeof t == "number" && Number.isFinite(t) : typeof t == "boolean", S = (e = {}) => {
	if (Object.keys(e).length > 32) throw y("at most 32 params");
	for (let [t, n] of Object.entries(e)) {
		if (t.length > 64 || !/^[a-z][a-z0-9-]*$/.test(t) || v.has(t)) throw Error(`page_param_reserved: ${t}`);
		if (n.default !== void 0 && !x(n, n.default)) throw y(t);
	}
}, ee = (e, t) => {
	for (let n of Object.keys(t)) if (!Object.hasOwn(e, n)) throw y(n);
}, C = (e = {}, t = {}, n = !0) => {
	let r = {};
	n && ee(e, t);
	for (let i of Object.keys(e)) {
		if (!Object.hasOwn(t, i)) continue;
		let a = t[i], o = e[i];
		if (x(o, a)) b(a, o.default) || Array.isArray(a) && !a.length || (r[i] = Array.isArray(a) ? Object.freeze([...a]) : a);
		else if (n) throw y(i);
	}
	let i = Object.keys(r).length ? Object.freeze(r) : void 0;
	if (w(e, i).toString().length > 2048) {
		if (n) throw y("query exceeds 2048 characters");
	} else return i;
}, te = (e = {}, t) => {
	let n = {};
	for (let [t, r] of Object.entries(e)) r.default !== void 0 && (n[t] = Array.isArray(r.default) ? Object.freeze([...r.default]) : r.default);
	return Object.freeze({
		...n,
		...t
	});
}, w = (e = {}, t) => {
	let n = new URLSearchParams();
	for (let r of Object.keys(e)) {
		let e = t?.[r];
		if (e !== void 0) for (let t of Array.isArray(e) ? e : [e]) n.append(r, String(t));
	}
	return n;
}, ne = (e = {}, t) => {
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		let e = t.getAll(r);
		if (!e.length || i.type !== "string[]" && e.length !== 1) continue;
		let a = e[0];
		i.type === "string[]" ? n[r] = e : i.type === "number" ? String(Number(a)) === a && (n[r] = Number(a)) : i.type === "boolean" ? (a === "true" || a === "false") && (n[r] = a === "true") : n[r] = a;
	}
	let r = C(e, n, !1);
	return w(e, r).toString().length <= 2048 ? r : void 0;
}, re = {
	normalize: (e) => ({ ...e }),
	toUri: (e) => {
		let t = `pstdio://extension-resource/${encodeURIComponent(e.type)}/${encodeURIComponent(e.id)}`, n = new URLSearchParams();
		return e.extensionId && n.set("extensionId", e.extensionId), e.projectId && n.set("projectId", e.projectId), n.size ? `${t}?${n}` : t;
	},
	fromUri: (e) => {
		try {
			let t = new URL(e);
			if (t.protocol !== "pstdio:" || t.hostname !== "extension-resource") return;
			let [n, r, ...i] = t.pathname.slice(1).split("/");
			if (!n || !r || i.length > 0) return;
			let a = t.searchParams.get("extensionId"), o = t.searchParams.get("projectId");
			return {
				type: decodeURIComponent(n),
				id: decodeURIComponent(r),
				...a ? { extensionId: a } : {},
				...o ? { projectId: o } : {}
			};
		} catch {
			return;
		}
	}
}, ie = "pstdio", T = (e) => `${e.extensionId ?? ""}:page:${e.id}`, ae = (e, t) => e.find((e) => T(e.ref) === T(t)), oe = (e) => e.split("/").filter(Boolean).map((e) => encodeURIComponent(e)).join("/"), se = (e, t) => {
	let n = `/projects/${encodeURIComponent(e)}`, r = oe(t.path);
	if (t.ref.extensionId === ie) return r ? `${n}/${r}` : n;
	if (!t.ref.extensionId) throw Error(`Page "${t.id}" has no extension id`);
	return `${n}/extensions/${encodeURIComponent(t.ref.extensionId)}/${r}`;
}, ce = (e) => {
	if (!e || typeof e != "object" || !Array.isArray(e.anchors)) return;
	let t = e.anchors;
	if (!t.some((e) => !e || typeof e != "object" || typeof e.id != "string" || typeof e.heading != "string" || e.occurrence !== void 0 && (!Number.isInteger(e.occurrence) || Number(e.occurrence) < 0))) return { anchors: t.map((e) => {
		let t = e;
		return {
			id: t.id,
			heading: t.heading,
			...t.occurrence === void 0 ? {} : { occurrence: t.occurrence }
		};
	}) };
}, le = (e) => {
	let t = ce(e);
	if (!t) throw Error("Page location has an invalid section");
	return JSON.stringify(t);
}, ue = (e) => {
	try {
		return ce(JSON.parse(e));
	} catch {
		return;
	}
}, de = (e) => {
	let t = ae(e.pages, e.location.page);
	if (!t) throw Error(`Unknown page ref: ${T(e.location.page)}`);
	let n = new URLSearchParams();
	e.location.resource && n.set("resource", e.resources.toUri(e.resources.normalize(e.location.resource)));
	let r = t.document && e.location.resource?.metadata?.[t.document.metadataKey];
	if (r !== void 0) {
		if (typeof r != "string" || !r) throw Error("Page location has an invalid document");
		n.set("document", r);
	}
	if (e.location.position) {
		if (!t.document || typeof r != "string" || !r || e.location.section || !_(e.location.position)) throw Error("Page location has an invalid source position");
		for (let t of [
			"line",
			"column",
			"endLine",
			"endColumn"
		]) {
			let r = e.location.position[t];
			r !== void 0 && n.set(t, String(r));
		}
	}
	e.location.section && n.set("section", le(e.location.section));
	let i = C(t.params, e.location.params);
	for (let [e, r] of w(t.params, i)) n.append(e, r);
	let a = n.toString(), o = se(e.projectId, t);
	return a ? `${o}?${a}` : o;
}, fe = (e) => {
	try {
		return e.split("/").filter(Boolean).map((e) => decodeURIComponent(e));
	} catch {
		return;
	}
}, pe = (e, t) => {
	try {
		let n = fe(new URL(e, "http://workbench.local").pathname);
		return !!(n && n[0] === "projects" && n[1] === t);
	} catch {
		return !1;
	}
}, me = (e, t, n) => e.find((e) => e.ref.extensionId === t && e.path === n), he = (e, t) => {
	try {
		let n = t.fromUri(e);
		return n ? t.normalize(n) : void 0;
	} catch {
		return;
	}
}, ge = (e, t, n, r) => {
	let i = Object.fromEntries([
		"line",
		"column",
		"endLine",
		"endColumn"
	].filter((t) => e.searchParams.has(t)).map((t) => {
		let n = e.searchParams.get(t);
		return [t, /^[1-9]\d*$/.test(n) ? Number(n) : NaN];
	})), a;
	if (Object.keys(i).length) {
		if (!t.document || n === null || r || !_(i)) return !1;
		a = i;
	}
	return a;
}, _e = (e, t, n) => {
	let r = fe(e.pathname);
	if (!r || r[0] !== "projects" || r[1] !== t) return;
	let i = r.slice(2), a = i[0] === "extensions", o = a ? i[1] : ie, s = (a ? i.slice(2) : i).join("/");
	if (!(!o || a && !s)) return me(n, o, s);
}, ve = (e) => {
	let t;
	try {
		t = new URL(e.url, "http://workbench.local");
	} catch {
		return;
	}
	let n = _e(t, e.projectId, e.pages);
	if (!n) return;
	for (let e of [
		"resource",
		"document",
		"section",
		"line",
		"column",
		"endLine",
		"endColumn"
	]) if (t.searchParams.getAll(e).length > 1) return;
	let r = t.searchParams.get("resource"), i = r ? he(r, e.resources) : void 0;
	if (r !== null && !i) return;
	let a = t.searchParams.get("document");
	if (a !== null) {
		if (!a || !n.document || !i) return;
		i = {
			...i,
			metadata: { [n.document.metadataKey]: a }
		};
	}
	let o = t.searchParams.get("section"), s = o ? ue(o) : void 0;
	if (o !== null && !s) return;
	let c = ge(t, n, a, s);
	if (c === !1) return;
	let l = ne(n.params, t.searchParams);
	return {
		pageId: n.id,
		...l ? { params: l } : {},
		...i ? { resource: i } : {},
		...s ? { section: s } : {},
		...c ? { position: c } : {}
	};
}, ye = () => {
	let e = n({
		name: "workbench.breadcrumbs",
		initialState: { items: void 0 }
	});
	return {
		store: e,
		setItems(t) {
			return e.setState({ items: t }, !1, "setBreadcrumbItems"), r(() => {
				e.getState().items === t && e.setState({ items: void 0 }, !1, "clearBreadcrumbItems");
			});
		},
		clearItems() {
			e.getState().items !== void 0 && e.setState({ items: void 0 }, !1, "clearBreadcrumbItems");
		},
		getItems() {
			return e.getState().items;
		},
		onDidChange(t) {
			let n = e.subscribeSelector((e) => e.items, () => t());
			return r(n);
		}
	};
}, be = (e = {}) => {
	let t = n({
		name: "workbench.commandPalette",
		initialState: {
			requestId: 0,
			resourceSearch: null,
			open: e.initialOpen ?? !1,
			view: "main",
			initialQuery: "",
			paramsRequest: null,
			confirmation: null
		}
	}), i = (e) => {
		let n = t.getState();
		t.setState({
			...n,
			...e,
			requestId: n.requestId + 1
		}, !1, "setCommandPaletteState");
	};
	return {
		store: t,
		isOpen() {
			return t.getState().open;
		},
		getView() {
			return t.getState().view;
		},
		getInitialQuery() {
			return t.getState().initialQuery;
		},
		getParamsRequest() {
			return t.getState().paramsRequest;
		},
		open(e = {}) {
			i({
				open: !0,
				view: e.view ?? "main",
				initialQuery: e.initialQuery ?? "",
				resourceSearch: e.resourceSearch ?? null
			});
		},
		close() {
			i({
				open: !1,
				view: "main",
				initialQuery: "",
				resourceSearch: null
			});
		},
		captureClose(e) {
			let { requestId: n } = t.getState();
			return () => {
				t.getState().requestId === n && e();
			};
		},
		toggle() {
			i({
				open: !t.getState().open,
				view: "main",
				initialQuery: "",
				resourceSearch: null
			});
		},
		requestConfirmation(e, n) {
			return t.getState().confirmation?.resolve(!1), new Promise((r) => {
				let i = {
					label: e,
					...n,
					resolve: (e) => {
						t.getState().confirmation === i && t.setState({
							...t.getState(),
							confirmation: null
						}), r(e);
					}
				};
				t.setState({
					...t.getState(),
					confirmation: i
				});
			});
		},
		requestParams(e) {
			t.setState({
				...t.getState(),
				paramsRequest: e
			}, !1, "requestCommandParams");
		},
		clearParams() {
			t.getState().paramsRequest && t.setState({
				...t.getState(),
				paramsRequest: null,
				confirmation: null
			}, !1, "clearCommandParams");
		},
		onDidChange(e) {
			let n = t.subscribeSelector((e) => e.open, (t) => e(t));
			return r(n);
		}
	};
}, xe = (e, t, n) => {
	let r = { ...e };
	return n.viewId !== void 0 && (r.viewId = n.viewId ?? void 0), n.resource === null ? (r.resource = void 0, r.resourceKey = void 0, r.title = n.title ?? t.title) : n.resource ? (r.resource = n.resource, r.resourceKey = h(n.resource), r.title = n.title ?? n.resource.label ?? t.title) : n.title !== void 0 && (r.title = n.title), n.pinned !== void 0 && (r.pinned = n.pinned), n.closable !== void 0 && (r.closable = n.closable), n.mountStrategy !== void 0 && (r.mountStrategy = n.mountStrategy), n.hiddenByDefault !== void 0 && (r.hiddenByDefault = n.hiddenByDefault), n.tabRetention !== void 0 && (r.tabRetention = n.tabRetention), n.tab !== void 0 && (r.tab = n.tab), n.ownerId !== void 0 && (r.ownerId = n.ownerId), n.source !== void 0 && (r.source = n.source), n.role !== void 0 && (r.role = n.role), r;
}, Se = (e, t, n) => ({
	widgetId: e,
	contributionId: t.id,
	viewId: n.viewId ?? void 0,
	ownerId: n.ownerId ?? t.ownerId,
	source: n.source ?? t.source,
	resource: n.resource ?? void 0,
	resourceKey: h(n.resource ?? void 0),
	title: n.title ?? n.resource?.label ?? t.title,
	pinned: n.pinned,
	closable: n.closable ?? t.closable ?? !t.singleton,
	mountStrategy: n.mountStrategy ?? t.mountStrategy,
	hiddenByDefault: n.hiddenByDefault ?? t.hiddenByDefault,
	tabRetention: n.tabRetention,
	tab: n.tab ?? t.tab,
	role: n.role ?? "content"
}), E = [
	"nav",
	"activity",
	"sidenav",
	"main-header",
	"main-left-menu",
	"main",
	"main-right-menu",
	"secondary-header",
	"secondary-left-menu",
	"secondary",
	"secondary-right-menu",
	"side-header",
	"side-left-menu",
	"side",
	"side-right-menu",
	"status",
	"overlay"
], D = [
	"main",
	"secondary",
	"side"
], Ce = {
	main: {
		left: "main-left-menu",
		right: "main-right-menu"
	},
	secondary: {
		left: "secondary-left-menu",
		right: "secondary-right-menu"
	},
	side: {
		left: "side-left-menu",
		right: "side-right-menu"
	}
}, we = {
	"main-left-menu": "main",
	"main-right-menu": "main",
	"secondary-left-menu": "secondary",
	"secondary-right-menu": "secondary",
	"side-left-menu": "side",
	"side-right-menu": "side"
}, Te = (e) => we[e], Ee = (e, t) => {
	let n = e.filter((e) => e.tabRetention === "preview"), r = n.find((e) => e.widgetId === t) ?? n[0];
	return {
		widgets: [...r ? [r] : [], ...e.filter((e) => e.tabRetention !== "preview")],
		replaced: n.filter((e) => e !== r)
	};
}, De = (e, t, n = "end") => {
	let r = e.filter((e) => e.widgetId !== t.widgetId), i = n === "start" ? 0 : r.length;
	if (typeof n == "object") {
		let e = "beforeWidgetId" in n, t = e ? n.beforeWidgetId : n.afterWidgetId, a = r.findIndex((e) => e.widgetId === t);
		a >= 0 && (i = a + +!e);
	}
	return r.splice(i, 0, t), Ee(r, t.tabRetention === "preview" ? t.widgetId : void 0);
}, Oe = (e, t, n = "end") => De(e, t.tabRetention === "preview" ? {
	...t,
	pinned: !0,
	tabRetention: "persistent"
} : t, n), ke = (e, t, n = t) => {
	if (!e.has(n)) return n;
	let r = 1;
	for (; e.has(`${t}:${r}`);) r += 1;
	return `${t}:${r}`;
}, Ae = (e, t) => ({
	id: e,
	visible: t,
	widgets: []
}), je = (e = {}) => {
	let t = (t) => Ae(t, e[t] ?? !0);
	return { regions: {
		nav: t("nav"),
		activity: t("activity"),
		sidenav: t("sidenav"),
		"main-header": t("main-header"),
		"main-left-menu": t("main-left-menu"),
		main: t("main"),
		"main-right-menu": t("main-right-menu"),
		"secondary-header": t("secondary-header"),
		"secondary-left-menu": t("secondary-left-menu"),
		secondary: t("secondary"),
		"secondary-right-menu": t("secondary-right-menu"),
		"side-header": t("side-header"),
		"side-left-menu": t("side-left-menu"),
		side: t("side"),
		"side-right-menu": t("side-right-menu"),
		status: t("status"),
		overlay: t("overlay")
	} };
}, Me = (e, t) => {
	for (let n = e.length - 1; n >= 0; --n) if (e[n]?.widgetId === t) return n;
	return -1;
}, Ne = (e) => {
	let t = /* @__PURE__ */ new Set(), n = {}, r = e.activeWidgetId, i = e.activeResourceKey;
	for (let [a, o] of Object.entries(e.regions)) {
		let s = o.activeWidgetId, c = s ? Me(o.widgets, s) : -1, l = o.widgets.map((e) => {
			let n = ke(t, e.contributionId, e.widgetId);
			return t.add(n), n === e.widgetId ? e : {
				...e,
				widgetId: n
			};
		}), u = c >= 0 ? l[c]?.widgetId : s, d = Ee(l, u).widgets;
		n[a] = {
			...o,
			widgets: d,
			activeWidgetId: d.find((e) => e.widgetId === u)?.widgetId ?? d[0]?.widgetId
		}, s && e.activeWidgetId === s && c >= 0 && (r = u, i = l[c]?.resourceKey);
	}
	return {
		...e,
		regions: n,
		activeWidgetId: r,
		activeResourceKey: i
	};
}, Pe = (e, t = {}) => {
	let n = je(t), r = Object.fromEntries(E.flatMap((t) => e.regions[t] ? [[t, e.regions[t]]] : []));
	return Ne({
		...e,
		regions: {
			...n.regions,
			...r
		}
	});
}, Fe = (e, t) => {
	for (let n of Object.values(e.regions)) {
		let e = n.widgets.findIndex((e) => e.contributionId === t);
		if (e >= 0) return {
			regionId: n.id,
			index: e,
			placement: n.widgets[e]
		};
	}
}, Ie = (e, t, n) => {
	for (let r of Object.values(e.regions)) {
		let e = r.widgets.findIndex((e) => e.contributionId === t && e.resourceKey === n);
		if (e >= 0) return {
			regionId: r.id,
			index: e,
			placement: r.widgets[e]
		};
	}
}, O = (e, t) => {
	for (let n of Object.values(e.regions)) {
		let e = n.widgets.findIndex((e) => e.widgetId === t);
		if (e >= 0) return {
			regionId: n.id,
			index: e,
			placement: n.widgets[e]
		};
	}
}, Le = (e, t) => ke(new Set(Object.values(e.regions).flatMap((e) => e.widgets.map((e) => e.widgetId))), t), Re = (e) => e.widgets.find((t) => t.widgetId === e.activeWidgetId) ?? e.widgets[0], ze = (e) => e.role === "location", Be = (e) => e.resourceKey ?? `${e.contributionId}:${e.widgetId}`, Ve = (e, t, n, r) => {
	if (!t) return e;
	let i = Be(t), a = { ...e.locationSubPanelSelections?.[i] ?? {} };
	return r ? a[n] = r : delete a[n], {
		...e,
		locationSubPanelSelections: {
			...e.locationSubPanelSelections,
			[i]: a
		}
	};
}, He = (e, t) => {
	if (!e.locationSubPanelSelections) return e;
	let n = Object.fromEntries(Object.entries(e.locationSubPanelSelections).map(([e, n]) => [e, Object.fromEntries(Object.entries(n).filter(([, e]) => e !== t))]));
	return {
		...e,
		locationSubPanelSelections: n
	};
}, k = (e) => {
	let t = Object.values(e.regions).flatMap((e) => e.widgets).filter(ze);
	return t.find((t) => t.widgetId === e.activeLocationWidgetId) ?? t.at(-1);
}, A = (e, t, n, r = {}) => {
	let i = e.regions[t], a = n(i.widgets), o = r.activeWidgetId ?? (r.clearActiveWidget ? void 0 : i.activeWidgetId);
	return {
		...e,
		activeLocationWidgetId: i.widgets.some((t) => t.widgetId === e.activeLocationWidgetId) && !a.some((t) => t.widgetId === e.activeLocationWidgetId) ? Object.values(e.regions).flatMap((e) => e.id === t ? a : e.widgets).filter(ze).at(-1)?.widgetId : e.activeLocationWidgetId,
		regions: {
			...e.regions,
			[t]: {
				...i,
				widgets: a,
				activeWidgetId: o
			}
		}
	};
}, Ue = (e, t) => {
	let n = e;
	for (let r of Object.values(e.regions)) {
		let e = r.widgets.filter((e) => e.contributionId === t), i = r.widgets.filter((e) => e.contributionId !== t);
		if (i.length === r.widgets.length) continue;
		let a = r.activeWidgetId && !i.some((e) => e.widgetId === r.activeWidgetId) ? void 0 : r.activeWidgetId;
		n = {
			...n,
			regions: {
				...n.regions,
				[r.id]: {
					...r,
					widgets: i,
					activeWidgetId: a
				}
			}
		};
		for (let t of e) n = He(n, t.widgetId);
	}
	let r = Object.values(n.regions).some((e) => e.widgets.some((e) => e.widgetId === n.activeWidgetId));
	return n.activeWidgetId && (!r || n.activeWidgetId.startsWith(`${t}:`) || n.activeWidgetId === t) && (n = {
		...n,
		activeWidgetId: void 0,
		activeResourceKey: void 0
	}), n.activeLocationWidgetId && !O(n, n.activeLocationWidgetId) && (n = {
		...n,
		activeLocationWidgetId: k(n)?.widgetId
	}), n;
}, We = (e, t) => {
	let n = O(e, t);
	if (!n) return;
	let r = e.regions[n.regionId], i = r.widgets.filter((e) => e.widgetId !== t), a = r.activeWidgetId === t || !r.activeWidgetId && n.index === 0, o = (n.placement.role === "sub-panel" ? i.find((e) => e.role === "sub-panel" && e.ownerResourceKey === n.placement.ownerResourceKey) : void 0) ?? (n.placement.role === "sub-panel" ? i.find(ze) : void 0) ?? i[n.index] ?? i[n.index - 1], s = a ? o?.widgetId : r.activeWidgetId, c = {
		...r,
		widgets: i,
		activeWidgetId: s,
		visible: i.length === 0 && (r.id === "side" || r.id === "secondary") ? !1 : r.visible
	}, l = e.activeLocationWidgetId;
	e.activeWidgetId === t && o?.role === "location" ? l = o.widgetId : l === t && (l = Object.values(e.regions).flatMap((e) => e.widgets).filter((e) => e.widgetId !== t && ze(e)).at(-1)?.widgetId);
	let u = He({
		...e,
		activeLocationWidgetId: l,
		regions: {
			...e.regions,
			[r.id]: c
		}
	}, t);
	return a && n.regionId !== "side" && D.includes(n.regionId) && (u = Ve(u, k(u), n.regionId, o?.role === "sub-panel" ? o.widgetId : void 0)), e.activeWidgetId === t && (u = {
		...u,
		activeWidgetId: o?.widgetId,
		activeResourceKey: o?.resourceKey
	}), {
		regionId: n.regionId,
		closedPlacement: n.placement,
		activePlacement: Re(c),
		layout: u
	};
}, Ge = (e, t, n) => {
	let r = e.regions[t];
	if (ze(n)) {
		let r = e.locationSubPanelSelections?.[Be(n)] ?? {}, i = { ...e.regions };
		for (let e of D) {
			let a = i[e], o = r[e], s = a.widgets.find((e) => e.widgetId === o && e.role === "sub-panel" && (!e.ownerResourceKey || e.ownerResourceKey === n.resourceKey));
			i[e] = {
				...a,
				activeWidgetId: (e === "side" || e === "secondary") && e !== t ? a.activeWidgetId : s?.widgetId ?? (e === t ? n.widgetId : void 0)
			};
		}
		return {
			...e,
			activeWidgetId: n.widgetId,
			activeLocationWidgetId: n.widgetId,
			activeResourceKey: n.resourceKey,
			regions: i
		};
	}
	let i = n.role === "sub-panel" && t === "main" ? Ve(e, k(e), t, n.widgetId) : e;
	return {
		...i,
		activeWidgetId: n.widgetId,
		activeLocationWidgetId: e.activeLocationWidgetId,
		activeResourceKey: n.resourceKey,
		regions: {
			...i.regions,
			[t]: {
				...r,
				activeWidgetId: n.widgetId
			}
		}
	};
}, Ke = (e, t, n) => {
	let r = e.regions[t], i = n ? r.widgets.find((e) => e.widgetId === n) : void 0;
	if (n && !i) throw Error(`Widget placement not found in ${t}: ${n}`);
	if (r.activeWidgetId === n) return;
	let a = e.activeWidgetId === r.activeWidgetId, o = {
		...e,
		activeWidgetId: a ? i?.widgetId : e.activeWidgetId,
		activeResourceKey: a ? i?.resourceKey : e.activeResourceKey,
		activeLocationWidgetId: i?.role === "location" ? i.widgetId : e.activeLocationWidgetId,
		regions: {
			...e.regions,
			[t]: {
				...r,
				activeWidgetId: i?.widgetId
			}
		}
	};
	return t === "side" || !D.includes(t) ? o : Ve(o, k(o), t, i?.role === "sub-panel" ? i.widgetId : void 0);
}, qe = (e, t) => !(e.resourceKinds?.length && (!t || !e.resourceKinds.includes(t.type)) || e.canOpen && (!t || !e.canOpen(t))), Je = (e, t, n, r = {}) => {
	let i = e.regions[t];
	return i.widgets.find((e) => e.widgetId === i.activeWidgetId && e.role === "sub-panel" && (r.ignoreOwnerResourceKey || !e.ownerResourceKey || e.ownerResourceKey === h(n)));
}, Ye = (e) => k(e), Xe = (e, t, n, r, i) => {
	let a = e.eligibleLocations;
	return !(!Ze(e, n) || a?.resourceKinds?.length && (!t || !a.resourceKinds.includes(t.type)) || a?.resourceIds?.length && (!t?.id || !a.resourceIds.includes(t.id)) || a?.canOpen && (!t || !a.canOpen(t)) || a?.canOpenLocation && !a.canOpenLocation({
		resource: t,
		viewId: i?.viewId
	}) || r?.ownerResourceKey && r.ownerResourceKey !== h(t));
}, Ze = (e, t) => {
	let n = e.eligibleLocations?.modeIds;
	return !n?.length || t !== void 0 && n.includes(t);
}, Qe = (e, t, n, r, i = {}) => qe(e, r?.resource ?? t) ? i.ignoreResourceLocation ? Ze(e, n) : Xe(e, t, n, r, i.location) : !1, $e = (e, t) => {
	let n = e.panelMenuOwner ?? { level: "panel" };
	return n.contributionId ? (t.subPanel ?? t.locationPanel)?.contributionId === n.contributionId : t.subPanel ? n.level === "sub-panel" : n.level === "panel";
}, et = (e, t) => {
	let n = !1, r = { ...e.regions };
	for (let e of Object.values(r)) {
		let i = t(e.id);
		if (e.size === void 0 || !i) continue;
		let a = Math.min(i.maxPx ?? Infinity, Math.max(i.minPx ?? 0, e.size));
		a !== e.size && (r[e.id] = {
			...e,
			size: a
		}, n = !0);
	}
	return n ? {
		...e,
		regions: r
	} : e;
}, tt = (e) => {
	let { getLayout: t, getWidgets: n, getPlaceholder: r } = e;
	return {
		getRegionSize(i) {
			let a = t().regions[i].size, o = Re(t().regions[i]), s = (o ? n()[o.contributionId]?.regionSize : r(i)?.regionSize) ?? e.getRegionSettings?.(i)?.size;
			return a === void 0 ? s : {
				...s,
				defaultPx: a
			};
		},
		getRegionCollapsible(i) {
			let a = Re(t().regions[i]);
			return a ? n()[a.contributionId]?.regionCollapsible ?? e.getRegionSettings?.(i)?.collapsible ?? !0 : r(i)?.regionCollapsible ?? e.getRegionSettings?.(i)?.collapsible ?? !0;
		},
		getRegionHeaderBorderBottom(e) {
			let r = Re(t().regions[e]);
			return r ? n()[r.contributionId]?.headerBorderBottom ?? !0 : !0;
		}
	};
}, nt = (e) => {
	let { getPlaceholders: t, getWidgets: n } = e;
	return {
		listPlaceholders: () => Object.values(t()).sort(i),
		listWidgets: () => Object.values(n()).sort(i)
	};
}, rt = (e) => {
	let { store: t, getPlaceholders: n, getWidgets: i, persistLayout: a } = e;
	return {
		registerPlaceholder(e, i) {
			if (n()[e.region]) throw Error(`Placeholder already registered: ${e.region}`);
			let { priority: a, ...o } = e, c = {
				...o,
				...s({
					...i,
					priority: i?.priority ?? a
				})
			}, l = t.getState();
			return t.setState({
				...l,
				placeholders: {
					...l.placeholders,
					[e.region]: c
				}
			}, !1, "registerPlaceholder"), r(() => {
				let n = t.getState();
				if (n.placeholders[e.region] !== c) return;
				let { [e.region]: r, ...i } = n.placeholders;
				t.setState({
					...n,
					placeholders: i
				}, !1, "unregisterPlaceholder");
			});
		},
		registerWidget(e, n) {
			if (i()[e.id]) throw Error(`Widget already registered: ${e.id}`);
			let { priority: o, reuse: c, singleton: l, ...u } = e, d = {
				...u,
				reuse: c ?? "resource",
				singleton: l ?? !0,
				...s({
					...n,
					priority: n?.priority ?? o
				})
			}, f = t.getState();
			return t.setState({
				...f,
				widgets: {
					...f.widgets,
					[e.id]: d
				}
			}, !1, "registerWidget"), r(() => {
				let n = t.getState();
				if (n.widgets[e.id] !== d) return;
				let { [e.id]: r, ...i } = n.widgets, o = Ue(n.layout, e.id);
				t.setState({
					widgets: i,
					layout: o
				}, !1, "unregisterWidget"), a();
			});
		}
	};
}, it = (e) => (t) => {
	let n = e.getLayout(), r = O(n, t);
	if (!r) throw Error(`Panel instance not found: ${t}`);
	if (r.regionId !== "main" || r.placement.role === "sub-panel" || r.placement.role === "panel-menu") return e.panelMethods.activatePanel(t);
	let i = {
		...r.placement,
		role: "location"
	}, a = new Set(e.getWidget(i.contributionId)?.ownedPanelMenuIds ?? []), o = Object.fromEntries(Object.entries(n.regions).map(([e, n]) => [e, {
		...n,
		widgets: n.widgets.map((e) => e.widgetId === t ? i : !a.has(e.contributionId) || e.resourceKey !== i.resourceKey ? e : {
			...e,
			ownerResourceKey: i.resourceKey
		})
	}]));
	return e.applyAndActivate({
		...n,
		regions: o
	}, "main", i), e.panelMethods.getActivePanel("main");
}, j = (e, t, n) => De(e, t, n).widgets, at = (e, t, n) => {
	let r = e.find((e) => e.widgetId === t);
	return r ? De(e.filter((e) => e.widgetId !== t), r, n).widgets : e;
}, ot = (e, t) => {
	let n = e;
	for (let r of Object.values(e.regions)) {
		let e = r.widgets.filter(t);
		if (e.length === 0) continue;
		let i = Re(r);
		n = A(n, r.id, (e) => e.filter((e) => !t(e)), { clearActiveWidget: i ? t(i) : !1 });
		for (let t of e) n = He(n, t.widgetId);
	}
	return n.activeWidgetId && Object.values(n.regions).flatMap((e) => e.widgets).find((e) => e.widgetId === n.activeWidgetId) || (n = {
		...n,
		activeWidgetId: void 0,
		activeResourceKey: void 0
	}), n;
}, st = (e, t) => ot(e, (e) => e.tabRetention === "preview" && (t === void 0 || e.ownerResourceKey !== t)), ct = (e) => ({
	updateWidgetPlacement(t, n) {
		let r = e.getLayout();
		for (let i of Object.values(r.regions)) {
			let a = i.widgets.findIndex((e) => e.widgetId === t);
			if (a < 0) continue;
			let o = e.requireWidget(i.widgets[a].contributionId);
			e.validateOpen?.(i.id, i.widgets[a], n);
			let s = xe(i.widgets[a], o, n), c = Ee(i.widgets.map((e, t) => t === a ? s : e), s.tabRetention === "preview" ? s.widgetId : i.activeWidgetId), l = A(r, i.id, () => c.widgets);
			return c.replaced.some((e) => e.widgetId === r.activeWidgetId || e.widgetId === i.activeWidgetId) ? e.applyAndActivate(l, i.id, s) : (e.setLayout(l), e.persistLayout(), s);
		}
		throw Error(`Widget placement not found: ${t}`);
	},
	reorderWidget(t, n) {
		let r = e.getLayout();
		for (let i of Object.values(r.regions)) if (i.widgets.some((e) => e.widgetId === t)) {
			e.setLayout(A(r, i.id, (e) => at(e, t, n))), e.persistLayout();
			return;
		}
		throw Error(`Widget placement not found: ${t}`);
	},
	expirePreviewTabs(t) {
		e.setLayout(st(e.getLayout(), t)), e.persistLayout();
	},
	activateWidget(t) {
		let n = e.getLayout();
		for (let r of Object.values(n.regions)) {
			let i = r.widgets.find((e) => e.widgetId === t);
			if (i) return e.applyAndActivate(n, r.id, i);
		}
		throw Error(`Widget placement not found: ${t}`);
	}
}), lt = (e) => {
	let t = /* @__PURE__ */ new Set();
	return {
		notify(n) {
			for (let r of t) a(e, () => r(n));
		},
		subscribe(e) {
			return t.add(e), r(() => t.delete(e));
		}
	};
}, ut = (e) => {
	let { getLayout: t, setLayout: n, persistLayout: r } = e, i = lt("layout restoration subscriber");
	return {
		onWillRestoreLayout: i.subscribe,
		setRegionActiveWidget(e, i) {
			let a = Ke(t(), e, i);
			a && (n(a), r());
		},
		closeWidget(e) {
			let i = We(t(), e);
			if (!i) throw Error(`Widget placement not found: ${e}`);
			if (i.closedPlacement.closable !== !0) throw Error(`Widget cannot be closed: ${e}`);
			return n(i.layout), r(), i.activePlacement;
		},
		removeWidgetPlacement(e) {
			let i = We(t(), e);
			if (i) return n(i.layout), r(), i.activePlacement;
		},
		clearRegion(e) {
			let i = t(), a = i.regions[e], o = a.activeWidgetId, s = {
				...i,
				regions: {
					...i.regions,
					[e]: {
						...a,
						widgets: [],
						activeWidgetId: void 0,
						visible: e === "side" || e === "secondary" ? !1 : a.visible
					}
				}
			}, c = o && i.activeWidgetId === o ? {
				...s,
				activeWidgetId: void 0,
				activeResourceKey: void 0
			} : s;
			e !== "side" && D.includes(e) && (c = Ve(c, k(c), e, void 0)), n(c), r();
		},
		resetRegions() {
			let e = t(), i = {};
			for (let [t, n] of Object.entries(e.regions)) i[t] = {
				...n,
				widgets: [],
				activeWidgetId: void 0
			};
			n({
				regions: i,
				locationSubPanelSelections: {},
				activeWidgetId: void 0,
				activeLocationWidgetId: void 0,
				activeResourceKey: void 0
			}), r();
		},
		restoreLayout(t) {
			i.notify(), n(Pe(t, e.defaultRegionVisibility)), r();
		}
	};
}, dt = (e) => {
	let t = (t, n) => {
		let r = e.getLayout(), i = r.regions[t], a = n(i);
		a !== i && (e.setLayout({
			...r,
			regions: {
				...r.regions,
				[t]: a
			}
		}), e.persistLayout());
	};
	return {
		setRegionVisible(n, r) {
			e.getLayout().regions[n].visible !== r && e.validateChange?.(n, r ? "open" : "close"), t(n, (e) => e.visible === r ? e : {
				...e,
				visible: r
			});
		},
		setRegionSize(n, r) {
			e.validateChange?.(n, "resize"), t(n, (e) => e.size === r ? e : {
				...e,
				size: r
			});
		},
		setSidePanelMode(n) {
			if (n === "floating" && e.getRegionSettings?.("side")?.floatable === !1) throw Error("Panel cannot float: side");
			let r = e.getLayout().regions.side.visible;
			n !== "closed" !== r && e.validateChange?.("side", n === "closed" ? "close" : "open"), t("side", (e) => n === "closed" ? e.visible ? {
				...e,
				visible: !1
			} : e : e.visible && e.presentation === n ? e : {
				...e,
				visible: !0,
				presentation: n
			});
		}
	};
}, ft = (e, t) => {
	let n = { ...t.regions };
	for (let r of Object.values(e.regions)) {
		let e = r.widgets.filter((e) => e.pinned && e.role === "content");
		if (e.length === 0) continue;
		let i = new Set(e.map((e) => e.contributionId)), a = t.regions[r.id];
		n[r.id] = {
			...a,
			widgets: [...e, ...a.widgets.filter((e) => !i.has(e.contributionId))],
			activeWidgetId: a.activeWidgetId ?? e[0]?.widgetId
		};
	}
	return {
		...t,
		regions: n
	};
}, pt = (e, t, n) => {
	if (n.length === 0) return t;
	let r = { ...t.regions };
	for (let t of n) r[t] = e.regions[t];
	return {
		...t,
		regions: r
	};
}, mt = (e, t) => t ? Pe(t, e) : je(e), ht = (e) => {
	let t, n = a("layout cache read for unscoped", () => e.persistence?.getLayout(void 0)) !== void 0, r = lt("layout scope subscriber"), i = lt("layout scope subscriber"), o = () => a(`layout cache for ${t ?? "unscoped"}`, () => e.persistence?.setLayout(e.getLayout(), t));
	return {
		getPersistenceScope: () => t,
		hasPersistedLayout: () => a(`layout cache read for ${t ?? "unscoped"}`, () => e.persistence?.getLayout(t)) !== void 0,
		enteredWithPersistedLayout: () => n,
		onDidChangePersistenceScope: i.subscribe,
		onWillChangePersistenceScope: r.subscribe,
		persistLayout: o,
		setPersistenceScope: (s, c = {}) => {
			if (t === s) return;
			o(), r.notify(s), t = s;
			let l = a(`layout cache read for ${t ?? "unscoped"}`, () => e.persistence?.getLayout(t));
			n = l !== void 0;
			let u = mt(e.defaultRegionVisibility, l), d = ft(e.getLayout(), u), f = pt(e.getLayout(), d, c.carryRegionState ?? []);
			e.setLayout(f, "setPersistenceScope"), i.notify(t);
		}
	};
}, gt = (e) => {
	for (let t of e.widget.ownedPanelMenuIds ?? []) {
		let n = e.requireWidget(t);
		e.openWidget(t, {
			pinned: !0,
			role: "panel-menu",
			viewId: n.rendererId,
			resource: e.placement.resource,
			title: n.region === "main-left-menu" ? e.placement.resource?.label : n.title
		});
	}
}, _t = (e, t, n) => {
	if (e.singleton || e.reuse !== "none") {
		if (n.role === "sub-panel" || n.role === "panel-menu") {
			let r = k(t)?.resourceKey;
			for (let i of Object.values(t.regions)) {
				let t = i.widgets.findIndex((t) => t.contributionId === e.id && (t.pinned === !0 || e.singleton && t.ownerResourceKey === void 0 || t.ownerResourceKey === r) && (!n.resource || e.singleton && t.resourceKey === void 0 || t.resourceKey === h(n.resource)));
				if (t >= 0) return {
					regionId: i.id,
					index: t,
					placement: i.widgets[t]
				};
			}
		} else return e.singleton ? Fe(t, e.id) : n.resource ? Ie(t, e.id, h(n.resource)) : Fe(t, e.id);
	}
}, vt = (e, t) => t.role ? t : e.panelMenuOwner ? {
	...t,
	role: "panel-menu"
} : e.eligibleLocations === void 0 ? t : {
	...t,
	role: "sub-panel"
}, yt = (e, t, n) => {
	let r = e.regions[t], i = n.role === "location" ? e.activeLocationWidgetId : r.activeWidgetId;
	if (n.replaceWidgetId) return r.widgets.findIndex((e) => e.widgetId === n.replaceWidgetId);
	if (n.tabRetention === "preview") return r.widgets.findIndex((e) => e.tabRetention === "preview");
	if (!n.replaceActive) return -1;
	let a = t === "main" && n.resource && e.activeLocationWidgetId ? e.activeLocationWidgetId : i;
	return r.widgets.findIndex((e) => e.widgetId === a && !e.pinned);
}, bt = (e, t, n) => {
	let r = e.find((e) => {
		try {
			return t.priority > n(e.contributionId).priority;
		} catch {
			return t.priority > 0;
		}
	});
	return r ? { beforeWidgetId: r.widgetId } : void 0;
}, xt = (e) => {
	let { getLayout: t, requireWidget: n, applyAndActivate: r } = e, i = (e, t) => e.role !== "sub-panel" && e.role !== "panel-menu" ? e : {
		...e,
		ownerResourceKey: k(t)?.resourceKey
	}, a = (e, n, a) => {
		let o = i(xe(n.placement, e, a), t()), s = A(t(), n.regionId, (e) => {
			let t = e.map((e, t) => t === n.index ? o : e);
			return a.tabPosition ? j(t.filter((e) => e.widgetId !== o.widgetId), o, a.tabPosition) : t;
		});
		return r(s, n.regionId, o);
	}, o = (e, n, a, o, s) => {
		let c = i(xe(o, e, s), t()), l = A(t(), n, (e) => {
			let t = e.map((e, t) => t === a ? c : e);
			return c.tabRetention === "preview" ? j(t, c, "start") : t;
		});
		return r(l, n, c);
	}, s = (e, n, o, s, c) => {
		if (c.tabRetention === "preview" && n.placement.tabRetention !== "preview") return r(t(), n.regionId, n.placement);
		if (n.regionId !== o) {
			let a = i(xe(n.placement, e, c), t()), l = A(A(t(), n.regionId, (e) => e.filter((e, t) => t !== n.index), { clearActiveWidget: t().regions[n.regionId].activeWidgetId === n.placement.widgetId }), o, (e) => {
				if (s < 0) return j(e, a, c.tabPosition);
				let t = [...e];
				return t.splice(s, 1, a), a.tabRetention === "preview" ? j(t, a, "start") : t;
			});
			return r(l, o, a);
		}
		if (s < 0 || n.index === s) return a(e, n, c);
		let l = i(xe(n.placement, e, c), t()), u = A(t(), o, (e) => j(e.map((e, t) => t === n.index ? l : e).filter((e, t) => t !== s && t !== n.index), l, c.tabPosition));
		return r(u, o, l);
	}, c = (e, a, o, s) => {
		let c = Le(t(), e.id), l = i(Se(c, e, s), t()), u = A(t(), a, (t) => {
			if (o < 0) return j(t, l, s.tabPosition ?? bt(t, e, n));
			let r = [...t];
			return r.splice(o, 1, l), l.tabRetention === "preview" ? j(r, l, "start") : r;
		});
		return r(u, a, l);
	}, l = (i, a = {}) => {
		let u = n(i), d = vt(u, a), f = t(), p = d.region ?? u.region ?? u.fallbackRegion ?? "main", m = f.regions[p], g = yt(f, p, d), _ = g >= 0 ? m.widgets[g] : void 0, v = !d.replaceWidgetId && d.tabRetention === "preview" && d.resource ? Ie(f, u.id, h(d.resource)) : void 0, y = d.replaceWidgetId && _ ? void 0 : _t(u, f, d);
		e.validateOpen?.(p, v?.placement ?? (y?.regionId === p ? y.placement : void 0), d);
		let b;
		return b = v ? r(f, v.regionId, v.placement) : y ? s(u, y, p, g, d) : _?.contributionId === u.id ? o(u, p, g, _, d) : c(u, p, g, d), gt({
			openWidget: l,
			placement: b,
			requireWidget: n,
			widget: u
		}), r(t(), v?.regionId ?? p, b);
	};
	return { openWidget: l };
}, St = (e = {}, t) => {
	let { strategy: n, ...r } = e, i = r.resource && r.viewId === void 0 ? {
		...r,
		viewId: null
	} : r;
	return n ? n.kind === "persistent" ? {
		...i,
		tabPosition: n.position,
		tabRetention: "persistent"
	} : n.kind === "replace-active" ? {
		...i,
		replaceActive: !0
	} : n.kind === "replace-panel" ? {
		...i,
		replaceWidgetId: n.instanceId,
		tabRetention: n.retention
	} : {
		...i,
		tabRetention: "preview",
		tabPosition: n.position
	} : {
		...i,
		tabRetention: t
	};
}, M = (e) => ({
	instanceId: e.widgetId,
	panelId: e.contributionId,
	placementIdentity: e.placementIdentity,
	viewId: e.viewId,
	ownerId: e.ownerId,
	source: e.source,
	resource: e.resource,
	section: e.section,
	position: e.position,
	pageContext: e.pageContext,
	resourceKey: e.resourceKey,
	ownerResourceKey: e.ownerResourceKey,
	title: e.title,
	pinned: e.pinned,
	closable: e.closable === !0,
	mountStrategy: e.mountStrategy,
	hiddenByDefault: e.hiddenByDefault,
	tabRetention: e.tabRetention,
	tab: e.tab
}), Ct = (e) => {
	let { closable: t, ownedPanelMenuIds: n, ...r } = e;
	return r;
}, wt = (e, t) => {
	if (t.pinned) return "persistent";
	let n = t.region ?? e.region ?? e.fallbackRegion ?? "main";
	return D.includes(n) ? "preview" : "persistent";
}, Tt = (e) => {
	let t = lt("panel activation subscriber");
	return {
		onDidActivatePanel: t.subscribe,
		getPanel(t) {
			let n = e.getWidgets()[t];
			return n ? Ct(n) : void 0;
		},
		listPanels: () => e.listWidgets().map(Ct),
		listPanelInstances(t) {
			return (t ? e.getLayout().regions[t].widgets : Object.values(e.getLayout().regions).flatMap((e) => e.widgets)).map(M);
		},
		getActivePanel(t) {
			if (t) {
				let n = e.getLayout().regions[t], r = n.widgets.find((e) => e.widgetId === n.activeWidgetId) ?? n.widgets[0];
				return r ? M(r) : void 0;
			}
			let n = e.getLayout().activeWidgetId;
			if (!n) return;
			let r = O(e.getLayout(), n);
			return r ? M(r.placement) : void 0;
		},
		openPanel(t, n = {}) {
			let r = e.getWidgets()[t];
			if (!r) throw Error(`Panel not registered: ${t}`);
			return M(e.widgetOpeners.openWidget(t, St(n, wt(r, n))));
		},
		updatePanel(t, n) {
			if (!O(e.getLayout(), t)) throw Error(`Panel instance not found: ${t}`);
			return M(e.placementMethods.updateWidgetPlacement(t, St(n)));
		},
		reorderPanel(t, n) {
			if (!O(e.getLayout(), t)) throw Error(`Panel instance not found: ${t}`);
			e.placementMethods.reorderWidget(t, n);
		},
		activatePanel(n) {
			if (!O(e.getLayout(), n)) throw Error(`Panel instance not found: ${n}`);
			let r = M(e.placementMethods.activateWidget(n));
			return t.notify(r), r;
		},
		closePanel(t) {
			let n = O(e.getLayout(), t);
			if (!n) throw Error(`Panel instance not found: ${t}`);
			if (n.placement.closable !== !0) throw Error(`Panel cannot be closed: ${t}`);
			let r = We(e.getLayout(), t);
			if (!r) throw Error(`Panel instance not found: ${t}`);
			return e.setLayout(r.layout), e.persistLayout(), r.activePlacement ? M(r.activePlacement) : void 0;
		}
	};
}, Et = Object.values(Ce).flatMap((e) => Object.values(e)), Dt = (e) => e.endsWith("-left-menu") ? "left" : "right", Ot = (e, t) => e(t)?.panelMenuOwner?.contributionId, kt = (e, t, n) => {
	for (let n of D) {
		let r = e.regions[n].widgets.find((e) => e.contributionId === t);
		if (r) return {
			region: n,
			placement: r
		};
	}
	let r = n().find((e) => e.contributionId === t);
	return r ? {
		region: "main",
		placement: r
	} : void 0;
}, At = (e, t, n, r) => {
	let i = [], a = [], o = /* @__PURE__ */ new Set(), s = !1;
	for (let c of e.regions[n].widgets) {
		let l = Ot(t, c.contributionId);
		if (!l) {
			i.push(c);
			continue;
		}
		if (o.has(c.contributionId)) {
			s = !0;
			continue;
		}
		o.add(c.contributionId);
		let u = kt(e, l, r);
		if (!u) {
			s = !0;
			continue;
		}
		let d = c.ownerResourceKey === u.placement.resourceKey ? c : {
			...c,
			ownerResourceKey: u.placement.resourceKey
		};
		d !== c && (s = !0);
		let f = Ce[u.region][Dt(n)];
		f === n ? i.push(d) : (s = !0, a.push({
			placement: d,
			target: f
		}));
	}
	return {
		changed: s,
		moves: a,
		placements: i
	};
}, jt = (e, t, n = () => []) => {
	let r = !1, i = { ...e.regions }, a = [];
	for (let o of Et) {
		if (e.regions[o].widgets.length === 0) continue;
		let s = At(e, t, o, n);
		if (a.push(...s.moves), !s.changed) continue;
		r = !0;
		let c = i[o];
		i[o] = {
			...c,
			widgets: s.placements,
			activeWidgetId: s.placements.some((e) => e.widgetId === c.activeWidgetId) ? c.activeWidgetId : void 0
		};
	}
	for (let e of a) {
		let t = i[e.target];
		i[e.target] = {
			...t,
			widgets: [...t.widgets, e.placement]
		};
	}
	return r ? {
		...e,
		regions: i
	} : e;
}, Mt = (e) => {
	let t = () => {
		let t = jt(e.getLayout(), e.getWidget, e.getDetachedOwners);
		t !== e.getLayout() && (e.setLayout(t), e.persistLayout());
	};
	return {
		openWidget: (n, r) => {
			let i = e.openWidget(n, r);
			return t(), i;
		},
		reconcilePanelMenus: t
	};
}, Nt = (e, t, n) => {
	let { side: r, ...i } = t, a = e.region, o = D.find((t) => t === e.fallbackRegion);
	return {
		...i,
		region: Ce[a][r],
		fallbackRegion: o ? Ce[o][r] : void 0,
		panelMenuOwner: {
			level: n === "sub-panel" ? "sub-panel" : "panel",
			contributionId: e.id
		}
	};
}, Pt = (e) => {
	let { kind: t, metadata: n, panel: i, registerWidget: a } = e, { panelMenus: o = [], ...s } = i, c = [];
	if (o.length > 0 && !D.includes(i.region)) throw Error(`Panel Menus require a Panel region: ${i.id}`);
	try {
		let e = {
			...s,
			ownedPanelMenuIds: o.map((e) => e.id)
		};
		c.push(a(e, n));
		for (let e of o) c.push(a(Nt(i, e, t), n));
	} catch (e) {
		for (let e of c.reverse()) e.dispose();
		throw e;
	}
	return r(() => {
		for (let e of c.reverse()) e.dispose();
	});
}, Ft = (e) => ({
	registerPanel: (t, n) => Pt({
		panel: t,
		kind: t.eligibleLocations ? "sub-panel" : "panel",
		metadata: n,
		registerWidget: e.registerWidget
	}),
	registerPanelMenu: (t, n) => e.registerWidget({
		...t,
		panelMenuOwner: t.panelMenuOwner ?? { level: "panel" }
	}, n)
}), It = (e, t) => {
	let n = e[t];
	if (!n) throw Error(`Widget not registered: ${t}`);
	return n;
}, Lt = (e = {}) => {
	let t = e.persistence?.getLayout(void 0), r = mt(e.defaultRegionVisibility, t), i = n({
		name: "workbench.layout",
		initialState: {
			layout: r,
			widgets: {},
			placeholders: {}
		}
	}), a = () => i.getState().layout, o = () => i.getState().placeholders, s = () => i.getState().widgets, c = (e) => o()[e], l = tt({
		getLayout: a,
		getWidgets: s,
		getPlaceholder: c,
		getRegionSettings: e.getRegionSettings
	}), u = nt({
		getPlaceholders: o,
		getWidgets: s
	}), d = ht({
		defaultRegionVisibility: e.defaultRegionVisibility,
		getLayout: a,
		persistence: e.persistence,
		setLayout: (e, t) => i.setState({
			...i.getState(),
			layout: e
		}, !1, t)
	}), f = () => d.persistLayout(), p = (e) => It(s(), e), m = (t) => {
		t = e.normalizeLayout?.(t) ?? t;
		let n = i.getState();
		n.layout !== t && i.setState({
			...n,
			layout: t
		}, !1, "setLayout");
	}, h = dt({
		getLayout: a,
		setLayout: m,
		persistLayout: f,
		validateChange: e.validateRegionChange,
		getRegionSettings: e.getRegionSettings
	}), g = ut({
		defaultRegionVisibility: e.defaultRegionVisibility,
		getLayout: a,
		setLayout: m,
		persistLayout: f
	}), _ = (e, t, n) => (m(Ge(e, t, n)), f(), n), v = rt({
		store: i,
		getPlaceholders: o,
		getWidgets: s,
		persistLayout: f
	}), y = Ft({ registerWidget: v.registerWidget }), b = xt({
		getLayout: a,
		requireWidget: p,
		applyAndActivate: _,
		validateOpen: e.validateWidgetOpen
	}), x = ct({
		validateOpen: e.validateWidgetOpen,
		getLayout: a,
		requireWidget: p,
		setLayout: m,
		persistLayout: f,
		applyAndActivate: _
	}), S = Tt({
		getLayout: a,
		getWidgets: s,
		listWidgets: u.listWidgets,
		persistLayout: f,
		placementMethods: x,
		setLayout: m,
		widgetOpeners: b
	}), ee = Mt({
		getLayout: a,
		getWidget: (e) => s()[e],
		getDetachedOwners: e.getDetachedOwners,
		openWidget: b.openWidget,
		persistLayout: f,
		setLayout: m
	}), C = it({
		applyAndActivate: _,
		getLayout: a,
		getWidget: p,
		panelMethods: S
	});
	return {
		store: i,
		registerPlaceholder: v.registerPlaceholder,
		registerWidget: v.registerWidget,
		...y,
		unregisterWidget(e, t = {}) {
			let n = i.getState();
			if (!n.widgets[e]) return;
			let { [e]: r, ...a } = n.widgets, o = t.removePlacements === !1 ? n.layout : Ue(n.layout, e);
			i.setState({
				...n,
				widgets: a,
				layout: o
			}, !1, "unregisterWidget"), t.persist !== !1 && f();
		},
		getWidget(e) {
			return s()[e];
		},
		getPlaceholder: c,
		getRegionSize: l.getRegionSize,
		getRegionSettings: (t, n) => e.getRegionSettings?.(t, n),
		getRegionCollapsible: l.getRegionCollapsible,
		getRegionHeaderBorderBottom: l.getRegionHeaderBorderBottom,
		...h,
		listPlaceholders: u.listPlaceholders,
		listWidgets: u.listWidgets,
		...S,
		openWidget: ee.openWidget,
		...x,
		establishLocation: C,
		reconcilePanelMenus: ee.reconcilePanelMenus,
		...g,
		getLayout: a,
		setPersistenceScope: d.setPersistenceScope,
		getPersistenceScope: d.getPersistenceScope,
		hasPersistedLayout: d.hasPersistedLayout,
		enteredWithPersistedLayout: d.enteredWithPersistedLayout,
		onWillChangePersistenceScope: d.onWillChangePersistenceScope,
		onDidChangePersistenceScope: d.onDidChangePersistenceScope
	};
}, Rt = {
	side: ["left", "right"],
	sidenav: ["left", "right"],
	main: ["top", "bottom"],
	secondary: ["top", "bottom"],
	activity: [
		"left",
		"right",
		"top",
		"bottom"
	]
}, zt = {
	side: "right",
	sidenav: "left",
	secondary: "bottom",
	activity: "left"
}, Bt = (e, t) => t === "main" ? e.secondary === "top" ? "bottom" : "top" : e[t], Vt = (e, t, n) => e && t.includes(e) ? e : n, Ht = (e) => ({
	side: Vt(e?.side, Rt.side, zt.side),
	sidenav: Vt(e?.sidenav, Rt.sidenav, zt.sidenav),
	secondary: Vt(e?.secondary, Rt.secondary, zt.secondary),
	activity: Vt(e?.activity, Rt.activity, zt.activity)
}), N = {
	main: [
		"main-header",
		"main-left-menu",
		"main",
		"main-right-menu"
	],
	secondary: [
		"secondary-header",
		"secondary-left-menu",
		"secondary",
		"secondary-right-menu"
	],
	side: [
		"side-header",
		"side-left-menu",
		"side",
		"side-right-menu"
	]
}, Ut = Object.values(N).flat(), Wt = (e) => e.panels ? [.../* @__PURE__ */ new Set(["main", ...e.panels])] : D, Gt = (e) => Object.keys(N).find((t) => N[t].some((t) => t === e)), P = (e, t) => !e || Wt(e).includes(t), F = (e, t) => {
	if (t) return Object.values(e.regions).flatMap((e) => e.widgets).find((e) => e.widgetId === t);
}, Kt = (e, t) => {
	let n = t.find((t) => t && F(e, t.widgetId));
	return {
		...e,
		activeWidgetId: n?.widgetId,
		activeResourceKey: n?.resourceKey
	};
}, qt = (e, t) => {
	if (t.length === 0) return e;
	let n = new Set(Object.keys(N).filter((e) => N[e].some((e) => t.includes(e)))), r = t.some((t) => {
		let n = e.regions[t];
		return n.widgets.length > 0 || n.activeWidgetId !== void 0 || n.visible;
	}), i = Object.values(e.locationSubPanelSelections ?? {}).some((e) => Object.keys(e).some((e) => n.has(e)));
	if (!r && !i) return e;
	let a = { ...e.regions };
	for (let e of t) a[e] = {
		...a[e],
		widgets: [],
		activeWidgetId: void 0,
		visible: !1
	};
	let o = Object.fromEntries(Object.entries(e.locationSubPanelSelections ?? {}).map(([e, t]) => [e, Object.fromEntries(Object.entries(t).filter(([e]) => !n.has(e)))])), s = {
		...e,
		regions: a
	};
	return {
		...Kt(s, [F(s, e.activeWidgetId)]),
		activeLocationWidgetId: F(s, e.activeLocationWidgetId)?.widgetId,
		locationSubPanelSelections: o
	};
}, Jt = (e, t) => {
	let n = new Set(t);
	return qt(e, Object.keys(N).filter((e) => !n.has(e)).flatMap((e) => N[e]));
}, Yt = (e, t, n) => {
	let r = t ? Jt(e, Wt(t)) : e;
	for (let e of ["side", "secondary"]) P(t, e) && n(e)?.canClose === !1 && !r.regions[e].visible && (r = {
		...r,
		regions: {
			...r.regions,
			[e]: {
				...r.regions[e],
				visible: !0
			}
		}
	});
	if (!r.arrangement) return r;
	let i = Ht(r.arrangement);
	for (let e of [
		"side",
		"sidenav",
		"secondary",
		"activity"
	]) (n(e)?.movable === !1 || e === "secondary" && n("main")?.movable === !1) && Object.assign(i, { [e]: zt[e] });
	return Object.keys(i).every((e) => i[e] === r.arrangement?.[e]) ? r : {
		...r,
		arrangement: i
	};
}, Xt = (e, t, n, r) => {
	if (!t) {
		let t = qt(e, Ut), i = { ...t.regions };
		for (let e of Ut) i[e] = r.regions[e];
		return Jt({
			...t,
			arrangement: r.arrangement,
			regions: i
		}, n);
	}
	let i = { ...e.regions };
	for (let e of Ut) i[e] = t.regions[e];
	let a = Jt({
		...e,
		arrangement: t.arrangement,
		regions: i
	}, n);
	return {
		...Kt(a, [F(a, t.activeWidgetId), F(a, e.activeWidgetId)]),
		activeLocationWidgetId: F(a, t.activeLocationWidgetId)?.widgetId ?? F(a, e.activeLocationWidgetId)?.widgetId,
		locationSubPanelSelections: t.locationSubPanelSelections
	};
}, Zt = (e) => {
	for (let t = e.length - 1; t >= 0; --t) a("mode disposal", () => e[t]?.dispose());
}, Qt = (e, t) => {
	t !== e.layout.getLayout() && e.layout.restoreLayout(t);
}, $t = /* @__PURE__ */ new WeakMap(), en = (e, t) => {
	$t.set(e, t);
}, tn = (e, t, n) => {
	let r = $t.get(e);
	if (!r) throw Error("Workbench mode registry internals are unavailable");
	r.activatePageMode(t, n);
}, nn = (e, t, n) => {
	let r = !1, i = () => void 0, o = () => {
		if (r) return;
		let e = t.layout.getActivePanel("main");
		if (!e) return;
		let a = t.layout.getLayout().regions.main.widgets.find((t) => t.widgetId === e.instanceId);
		(!a || a.role !== "sub-panel" && a.role !== "panel-menu") && (r = !0, i(), n?.(e.instanceId));
	};
	i = t.layout.store.subscribeSelector((e) => e.layout.regions.main, o);
	try {
		a(`mode ${e.id}.seed`, () => e.seed?.(t)), o();
	} finally {
		i();
	}
}, rn = (e) => e ? Array.isArray(e) ? [...e] : [e] : [], an = (e) => {
	let t = n({
		name: "workbench.modes",
		initialState: {
			modes: {},
			activeModeId: void 0
		}
	}), i = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Map(), c = [], l, u, d = !1, f = (t) => {
		if (i.has(t.id)) return;
		let n = rn(a(`mode ${t.id}.activate`, () => t.activate(e.resolveContext())));
		i.set(t.id, n);
	}, p = (t) => {
		let n = e.resolveContext(), r = `${t.id}\0${n.layout.getPersistenceScope() ?? "unscoped"}`;
		Qt(n, et(Yt(n.layout.getLayout(), t, (e) => n.layout.getRegionSettings(e, t.id)), n.layout.getRegionSize)), n.layout.reconcilePanelMenus(), !o.has(r) && !n.layout.enteredWithPersistedLayout() && nn(t, n, e.establishLocation), o.add(r);
	}, m = (t) => {
		p(t), a(`mode ${t.id}.reconcile`, () => t.reconcile?.(e.resolveContext()));
	}, h = (n) => {
		let r = e.resolveContext(), i = t.getState().activeModeId, a = r.layout.getPersistenceScope() === void 0;
		if (i && a && s.set(i, r.layout.getLayout()), _(), n === void 0) {
			t.setState({
				...t.getState(),
				activeModeId: void 0
			}, !1, "deactivateMode");
			return;
		}
		let o = t.getState().modes[n];
		if (!o) throw Error(`Workbench mode not registered: ${n}`);
		a && Qt(r, Xt(r.layout.getLayout(), s.get(n), Wt(o), r.layout.store.getInitialState().layout)), v(n, { seed: u !== n });
	}, g = (e, n) => {
		if (e && !t.getState().modes[e]) throw Error(`Workbench mode not registered: ${e}`);
		if (e === t.getState().activeModeId) n();
		else {
			d = !0, u = void 0;
			try {
				if (_(), e === void 0) {
					t.setState({
						...t.getState(),
						activeModeId: void 0
					}, !1, "deactivatePageMode"), n();
					return;
				}
				v(e, {
					seed: !1,
					afterPublish: n
				});
			} finally {
				d = !1;
			}
		}
	}, _ = () => {
		Zt(c), c = [], l?.dispose(), l = void 0;
	}, v = (n, r) => {
		let i = e.resolveContext(), o = t.getState().modes[n];
		if (!o) throw Error(`Workbench mode not registered: ${n}`);
		let s = i.context.createScope("workbench.mode");
		s.set("activeWorkbenchMode", n), s.set(`workbenchMode.${n}`, !0), l = s;
		try {
			f(o), t.setState({
				...t.getState(),
				activeModeId: n
			}, !1, "activateMode"), r.afterPublish?.(), r.seed && p(o), c = rn(a(`mode ${o.id}.enter`, () => o.enter?.(i))), r.seed && a(`mode ${o.id}.reconcile`, () => o.reconcile?.(e.resolveContext()));
		} catch (e) {
			throw _(), t.setState({
				...t.getState(),
				activeModeId: void 0
			}, !1, "deactivateMode"), e;
		}
	}, y = e.layout.onDidChangePersistenceScope(() => {
		let e = t.getState().activeModeId;
		if (e === u) return;
		let n = e ? t.getState().modes[e] : void 0;
		n && m(n);
	}), b = r(() => {
		y.dispose(), _();
		for (let e of i.values()) Zt(e);
		i.clear(), o.clear(), s.clear(), t.setState({
			modes: {},
			activeModeId: void 0
		}, !1, "disposeModes");
	}), x = {
		store: t,
		dispose() {
			b.dispose();
		},
		registerMode(e) {
			let n = t.getState();
			if (n.modes[e.id]) throw Error(`Workbench mode already registered: ${e.id}`);
			return t.setState({
				...n,
				modes: {
					...n.modes,
					[e.id]: e
				}
			}, !1, "registerMode"), r(() => {
				let n = t.getState();
				if (n.modes[e.id] !== e) return;
				n.activeModeId === e.id && (_(), t.setState({
					...t.getState(),
					activeModeId: void 0
				}, !1, "deactivateMode")), Zt(i.get(e.id) ?? []), i.delete(e.id), s.delete(e.id);
				for (let t of o) t.startsWith(`${e.id}\0`) && o.delete(t);
				let { [e.id]: r, ...a } = n.modes;
				t.setState({
					...t.getState(),
					modes: a
				}, !1, "unregisterMode");
			});
		},
		getMode(e) {
			return t.getState().modes[e];
		},
		listModes() {
			return Object.values(t.getState().modes);
		},
		getActiveModeId() {
			return t.getState().activeModeId;
		},
		isTransitioning() {
			return d || u !== void 0;
		},
		setActiveMode(e, n = {}) {
			if (e === t.getState().activeModeId) {
				let n = e ? t.getState().modes[e] : void 0;
				n && e !== u && m(n);
			} else {
				d = !0, u = n.deferSeed ? e : void 0;
				try {
					h(e);
				} finally {
					d = !1;
				}
			}
		},
		seedActiveMode() {
			let e = t.getState().activeModeId, n = e ? t.getState().modes[e] : void 0;
			d = !0;
			try {
				n && m(n);
			} finally {
				u = void 0, d = !1;
			}
		},
		onDidChangeActive(e) {
			let n = t.subscribeSelector((e) => e.activeModeId, () => e());
			return r(n);
		}
	};
	return en(x, { activatePageMode: g }), x;
}, on = "$main", I = (e) => e?.main.kind === "view" && e.main.presentation === "page", L = (e, t) => I(e) && t?.kind === "page" && t.pageId === e?.id && t.slotId === "$main", sn = (e) => {
	if (e.main.kind !== "view") return;
	let { kind: t, view: n, cardinality: r, empty: i, presentation: a, ...o } = e.main, s = e.resource ? {
		...e.resource,
		view: n,
		cardinality: r
	} : void 0;
	return {
		...o,
		id: on,
		role: "primary",
		region: "main",
		item: s ? {
			kind: "binding",
			binding: s
		} : {
			kind: "view",
			view: n,
			presence: "open"
		}
	};
}, R = (e) => {
	let t = sn(e);
	return [...t ? [t] : [], ...e.slots.map((e) => ({
		...e,
		role: "auxiliary"
	}))];
}, cn = (e, t) => {
	let n = R(e).find((e) => e.id === t);
	if (!n) throw Error(`Unknown page slot: ${e.id}.${t}`);
	return n;
}, ln = (e, t, n, r) => {
	let i = t.getView(n.viewId);
	if (!i) throw Error(`Workbench placement view is not registered: ${n.viewId}`);
	let { role: a, viewId: o, ...s } = n;
	return e.registerPanel({
		...s,
		title: i.title,
		icon: i.icon,
		rendererId: i.id,
		panelMenus: r?.definitionsFor(i.id, n.id)
	});
}, un = (e) => `workbench.mode-placement.${encodeURIComponent(e)}`, z = (e, t) => `workbench.page-placement.${encodeURIComponent(e)}.${encodeURIComponent(t)}`, dn = (e) => D.filter((t) => P(e, t) && e?.regionSettings?.[t]?.acceptsTabs !== !1), fn = (e, t) => dn(e).filter((e) => !t || t.includes(e)), pn = (e, t) => {
	if (e.pages.listPages().some((e) => I(e) && z(e.id, "$main") === t)) return [];
	let n = e.layout.getWidget(t);
	if (!n || !D.some((e) => e === n.region)) return [];
	let r = e.modes.getActiveModeId();
	return dn(r ? e.modes.getMode(r) : void 0).filter((t) => {
		let n = e.shell.getPanelPolicy(t);
		return n.acceptsTabs && (n.open || n.canOpen);
	});
}, mn = (e, t) => e.singleton ? t.some((t) => t.contributionId === e.id) : !1, hn = (e) => !!(e.openCommand || !e.resourceKinds?.length && !e.canOpen), gn = (e) => {
	for (let t of e.modePanels) {
		if (![
			"main",
			"side",
			"secondary"
		].includes(t.region) || !fn(e.mode, t.allowedRegions).includes(e.region)) continue;
		let n = e.widgets.find((e) => e.id === t.panelId);
		n && hn(n) && !mn(n, e.placements) && e.addable.set(t.panelId, {
			...t,
			region: e.region,
			contribution: n
		});
	}
}, _n = (e) => {
	for (let t of e.widgets) {
		if (!hn(t) || !t.eligibleLocations || ![
			"main",
			"side",
			"secondary"
		].includes(t.region)) continue;
		let n = e.modePanels.find((e) => e.panelId === t.id);
		fn(e.mode, n?.allowedRegions).includes(e.region) && (e.addable.has(t.id) || mn(t, e.placements) || Qe(t, e.resource, e.mode?.id, void 0, { location: e.location }) && e.addable.set(t.id, {
			panelId: t.id,
			region: e.region,
			contribution: t
		}));
	}
}, vn = (e) => ({ panelsFor(t) {
	let n = e.getLayout(), r = n.regions[t]?.widgets ?? [], i = e.getResource(), a = k(n), o = e.getActiveMode();
	if (!P(o, t) || o?.regionSettings?.[t]?.acceptsTabs === !1 || e.acceptsTabs?.(t) === !1) return {
		open: r,
		addable: [],
		closable: []
	};
	let s = Object.values(n.regions).flatMap((e) => e.widgets), c = e.listWidgets(), l = o?.listAddablePanels?.({
		layout: n,
		resource: i
	}) ?? [], u = /* @__PURE__ */ new Map();
	for (let r of e.listOwnedAddablePanels?.({
		layout: n,
		mode: o,
		region: t,
		resource: i
	}) ?? []) u.set(r.panelId, r);
	return gn({
		addable: u,
		layout: n,
		mode: o,
		modePanels: l,
		placements: s,
		region: t,
		resource: i,
		widgets: c
	}), _n({
		addable: u,
		location: a,
		mode: o,
		modePanels: l,
		placements: s,
		region: t,
		resource: i,
		widgets: c
	}), {
		open: r,
		addable: [...u.values()],
		closable: r.filter((e) => e.closable === !0).map((e) => e.contributionId)
	};
} }), yn = [
	"activity",
	"sidenav",
	"main",
	"secondary",
	"side",
	"status"
], bn = {
	activity: "activityFocus",
	sidenav: "sidenavFocus",
	main: "mainFocus",
	secondary: "secondaryFocus",
	side: "sideFocus",
	status: "statusFocus"
}, xn = (e) => {
	let t = n({
		name: "workbench.focus",
		initialState: { activeRegion: void 0 }
	}), i = e.context.createScope("workbench.focus"), a = (e) => {
		i.set("workbenchFocus", e !== void 0), i.set("activeWorkbenchFocusRegion", e);
		for (let t of yn) i.set(bn[t], t === e);
	};
	return a(void 0), {
		store: t,
		setActiveRegion(n) {
			e.isRegionFocusable?.(n) !== !1 && t.getState().activeRegion !== n && (t.setState({ activeRegion: n }, !1, "setActiveWorkbenchFocusRegion"), a(n));
		},
		clearFocus() {
			t.getState().activeRegion !== void 0 && (t.setState({ activeRegion: void 0 }, !1, "clearWorkbenchFocusRegion"), a(void 0));
		},
		getActiveRegion() {
			return t.getState().activeRegion;
		},
		onDidChange(e) {
			let n = t.subscribeSelector((e) => e.activeRegion, (t) => e(t));
			return r(n);
		}
	};
}, Sn = async (e, t) => {
	let n = new AbortController(), r = () => n.abort(t?.reason);
	t?.aborted ? r() : t?.addEventListener("abort", r, { once: !0 });
	let i;
	try {
		let r = await Promise.allSettled(e.map(async (e) => {
			try {
				return n.signal.throwIfAborted(), await e(n.signal);
			} catch (e) {
				throw i ??= e, n.abort(e), e;
			}
		}));
		if (i !== void 0) throw i;
		return t?.throwIfAborted(), r.map((e) => {
			if (e.status === "rejected") throw e.reason;
			return e.value;
		});
	} finally {
		t?.removeEventListener("abort", r);
	}
}, Cn = (e, t) => t.find((t) => t.ref.id === e.page.id && t.ref.extensionId === e.page.extensionId), wn = (e, t) => {
	let n = Cn(e, t.pages);
	return n ? t.navigationTrees.resolveOwner("page", n.id, "content") : void 0;
}, Tn = (e, t) => {
	let n = Cn(e, t.pages);
	return n ? t.navigationTrees.resolveOwner("page", n.id, "content") ? !0 : t.modes.getMode(n.modeId)?.chrome?.sidenav !== void 0 : !1;
}, En = (e) => {
	let t = [];
	for (let n = e.location; n; n = n.parent) {
		let r = wn(n, e);
		r && !t.some((e) => e.owner.id === r.id) && t.unshift({
			owner: r,
			location: n
		});
	}
	return t;
}, Dn = (e) => {
	let t = e.location;
	for (let n = e.location; n; n = n.parent) Tn(n, e) && (t = n.parent);
	return t;
}, On = /* @__PURE__ */ new WeakMap(), kn = (e, t) => {
	On.set(e, t);
}, B = (e) => {
	let t = On.get(e);
	if (!t) throw Error("Workbench page registry internals are unavailable");
	return t;
}, An = (e) => ({
	kind: "page",
	page: e.page,
	...e.resource ? { resource: e.resource } : {},
	...e.section ? { section: e.section } : {},
	...e.position ? { position: e.position } : {},
	...e.params ? { params: e.params } : {},
	...e.parent ? { parent: An(e.parent) } : {}
}), jn = (e, t, n) => {
	let r = e, i = /* @__PURE__ */ new Set();
	for (;;) {
		let e = t.find((e) => e.id === r.pageId);
		if (e?.main.kind !== "group") return r;
		if (i.has(e.id)) throw Error(`Page group default cycle reaches ${e.id}`);
		i.add(e.id);
		let a = e.main.default, o = t.find((e) => e.ref.id === a.id && e.ref.extensionId === a.extensionId);
		if (!o || o.parentId !== e.id || o.modeId !== e.modeId || o.resource) throw Error(`Page group "${e.id}" requires an available default child in its mode without a resource`);
		if (r.location.resource || r.open) throw Error(`Page group "${e.id}" does not accept a resource or open intent`);
		r = n({
			kind: "page",
			page: a,
			parent: An(r.location)
		});
	}
}, V = (e) => `${e.extensionId ?? ""}:page:${e.id}`, Mn = (e, t) => e.find((e) => V(e.ref) === V(t)), Nn = (e, t) => e.find((e) => e.id === t), Pn = (e) => {
	if (!e) return;
	let t = e.anchors.map((e) => Object.freeze({
		id: e.id,
		heading: e.heading,
		...e.occurrence === void 0 ? {} : { occurrence: e.occurrence }
	}));
	return Object.freeze({ anchors: Object.freeze(t) });
}, Fn = (e) => {
	if (e) return JSON.parse(JSON.stringify(e));
}, In = (e, t) => {
	if (!e) return;
	let n = t.normalize(e);
	if (!n.type || !n.id) throw Error("Page resource has no canonical type or id");
	let r = {
		type: n.type,
		id: n.id,
		...n.projectId ? { projectId: n.projectId } : {},
		...n.label ? { label: n.label } : {},
		...n.icon ? { icon: n.icon } : {},
		...n.extensionId ? { extensionId: n.extensionId } : {},
		...n.metadata ? { metadata: Fn(n.metadata) } : {}
	};
	return Object.freeze(r);
}, Ln = (e) => Object.freeze({
	extensionId: e.ref.extensionId,
	kind: "page",
	id: e.ref.id
}), Rn = (e) => e ? JSON.stringify(e) : "", zn = (e, t) => e.resource ? t.toUri(t.normalize(e.resource)) : "", Bn = (e, t, n) => V(e.page) === V(t.page) && zn(e, n) === zn(t, n), H = (e, t, n = []) => {
	let r = Mn(n, e.page)?.document, i = r ? e.resource?.metadata?.[r.metadataKey] : void 0;
	return JSON.stringify([
		V(e.page),
		zn(e, t),
		i ?? null,
		e.position ? [
			e.position.line,
			e.position.column ?? 1,
			e.position.endLine ?? null,
			e.position.endColumn ?? null
		] : null,
		Rn(e.section)
	]);
}, Vn = (e, t, n = []) => {
	let r = H(e, t, n);
	return e.parent ? `${r}>${Vn(e.parent, t, n)}` : r;
}, Hn = (e, t, n, r = []) => {
	let i = e, a = t;
	for (; i && a;) {
		if (H(i, n, r) !== H(a, n, r) || JSON.stringify(i.params ?? {}) !== JSON.stringify(a.params ?? {})) return !1;
		i = i.parent, a = a.parent;
	}
	return i === a;
}, Un = (e) => Object.isFrozen(e) ? e : Object.freeze({
	line: e.line,
	...e.column === void 0 ? {} : { column: e.column },
	...e.endLine === void 0 ? {} : { endLine: e.endLine },
	...e.endColumn === void 0 ? {} : { endColumn: e.endColumn }
}), Wn = (e) => {
	let t = e.page.document?.metadataKey, n = t ? e.resource?.metadata?.[t] : void 0;
	if (n !== void 0 && (typeof n != "string" || !n)) throw Error("Page location has an invalid document");
	if (e.position && (!t || !n || e.section || !f(e.position))) throw Error("Page location has an invalid source position");
	return Object.freeze({
		page: Ln(e.page),
		...e.params ? { params: e.params } : {},
		...e.resource ? { resource: In(e.resource, e.resources) } : {},
		...e.section ? { section: Pn(e.section) } : {},
		...e.position ? { position: Un(e.position) } : {},
		...e.parent ? { parent: e.parent } : {}
	});
}, Gn = (e) => {
	if (!e.page.parentId) return;
	let t = Nn(e.pages, e.page.parentId);
	if (!t) throw Error(`Unknown parent page: ${e.page.parentId}`);
	return qn({
		page: t,
		pages: e.pages,
		resources: e.resources,
		seen: e.seen
	});
}, Kn = (e) => ({
	resource: e.resource,
	section: e.section,
	position: e.position,
	params: e.params
}), qn = (e) => {
	let t = Wn({
		page: e.page,
		resources: e.resources,
		...e.resource ? { resource: e.resource } : {},
		...e.section ? { section: e.section } : {},
		...e.position ? { position: e.position } : {},
		...e.params ? { params: e.params } : {}
	}), n = H(t, e.resources, e.pages);
	if (e.seen.has(n)) throw Error(`Page location parent cycle reaches ${e.page.id}`);
	let r = new Set(e.seen).add(n), i = e.parent ?? Gn({
		page: e.page,
		pages: e.pages,
		resources: e.resources,
		seen: r
	});
	return Wn({
		page: e.page,
		resources: e.resources,
		...t.resource ? { resource: t.resource } : {},
		...t.section ? { section: t.section } : {},
		...t.position ? { position: t.position } : {},
		...t.params ? { params: t.params } : {},
		...i ? { parent: i } : {}
	});
}, Jn = (e, t, n) => t?.parent && Bn(e, t, n) ? t.parent : void 0, Yn = (e) => {
	let t = Mn(e.pages, e.target.page);
	if (!t) throw Error(`Unknown page: ${V(e.target.page)}`);
	let n = Wn({
		page: t,
		resources: e.resources,
		...e.target.resource ? { resource: e.target.resource } : {},
		...e.target.section ? { section: e.target.section } : {},
		...e.target.position ? { position: { ...e.target.position } } : {},
		params: C(t.params, e.target.params)
	}), r = H(n, e.resources, e.pages);
	if (e.seen.has(r)) throw Error(`Page location parent cycle reaches ${t.id}`);
	let i = new Set(e.seen).add(r), a = e.target.parent ? Yn({
		target: e.target.parent,
		pages: e.pages,
		resources: e.resources,
		seen: i
	}).location : Jn(n, e.active, e.resources), o = qn({
		page: t,
		pages: e.pages,
		resources: e.resources,
		seen: e.seen,
		...n.resource ? { resource: n.resource } : {},
		...n.section ? { section: n.section } : {},
		...n.position ? { position: n.position } : {},
		...n.params ? { params: n.params } : {},
		...a ? { parent: a } : {}
	});
	return {
		pageId: t.id,
		location: o,
		...e.target.open ? { open: e.target.open } : {}
	};
}, Xn = (e) => jn(Yn({
	...e,
	seen: /* @__PURE__ */ new Set()
}), e.pages, (t) => Yn({
	...e,
	target: t,
	active: void 0,
	seen: /* @__PURE__ */ new Set()
})), Zn = (e) => {
	let t = (n, r) => {
		let i = Mn(e.pages, n.page);
		if (!i) throw Error(`Unknown page: ${V(n.page)}`);
		let a = Wn({
			page: i,
			resources: e.resources,
			...n.resource ? { resource: n.resource } : {},
			...n.section ? { section: n.section } : {},
			...n.position ? { position: n.position } : {},
			params: C(i.params, n.params, !1)
		}), o = H(a, e.resources, e.pages);
		if (r.has(o)) throw Error(`Page location parent cycle reaches ${i.id}`);
		let s = new Set(r).add(o), c = n.parent ? t(n.parent, s).location : void 0;
		return {
			pageId: i.id,
			location: qn({
				page: i,
				pages: e.pages,
				resources: e.resources,
				seen: r,
				...Kn(a),
				...c ? { parent: c } : {}
			})
		};
	};
	return jn(t(e.location, /* @__PURE__ */ new Set()), e.pages, (t) => Yn({
		...e,
		target: t,
		seen: /* @__PURE__ */ new Set()
	}));
}, Qn = (e) => {
	let t = Nn(e.pages, e.pageId);
	if (!t) throw Error(`Unknown page: ${e.pageId}`);
	return jn({
		pageId: t.id,
		location: qn({
			page: t,
			pages: e.pages,
			resources: e.resources,
			seen: /* @__PURE__ */ new Set(),
			...e.resource ? { resource: e.resource } : {},
			...e.section ? { section: e.section } : {},
			...e.position ? { position: e.position } : {},
			...e.params ? { params: e.params } : {}
		})
	}, e.pages, (t) => Yn({
		...e,
		target: t,
		seen: /* @__PURE__ */ new Set()
	}));
}, $n = (e) => {
	if (!e || typeof e != "object") return !1;
	let t = e;
	return t.kind === "pstdio.page-location" && typeof t.index == "number" && typeof t.projectId == "string" && typeof t.routeKey == "string" && !!(t.location && typeof t.location == "object");
}, er = (e, t, n) => {
	if (V(e.page) === V(t)) {
		let { params: t, ...r } = e;
		return {
			...r,
			...n ? { params: n } : {}
		};
	}
	let r = e.parent && er(e.parent, t, n);
	return r ? {
		...e,
		parent: r
	} : void 0;
}, tr = (e) => (t, n) => {
	let r = e.pages(), i = ve({
		url: n.url,
		projectId: t,
		pages: r,
		resources: e.resources
	});
	if (!i) return;
	let a = Qn({
		...i,
		pages: r,
		resources: e.resources
	});
	if (!$n(n.state) || n.state.projectId !== t) return a;
	let o = r.find((e) => e.id === i.pageId), s = er(n.state.location, o.ref, i.params);
	if (!s) return a;
	let c = e.normalize(s), l = H(a.location, e.resources, r), u = H(c.location, e.resources, r), d = H(n.state.location, e.resources, r);
	return n.state.routeKey !== d || u !== l ? a : c;
}, nr = (e) => (t) => {
	let n = e.projectId();
	if (n) try {
		$n(t.state) && t.state.projectId === n && e.adopt(t.state.index);
		let r = e.resolve(n, t);
		if (!r) throw Error(`Cannot resolve page URL: ${t.url}`);
		let i = $n(t.state) ? t.state : void 0, a = i?.removalEpoch === e.removalEpoch?.() ? i?.removalVersion ?? 0 : 0, o = e.restore(r, n, a), s = !e.locationsEqual(r.location, o.location), c = e.commit(n, o, o.consumeRemembered || s ? "replace" : "none", "replayPageHistory");
		c.ok && e.notify(c.location);
	} catch (t) {
		e.fail(t);
	}
}, rr = (e, t) => {
	try {
		return !!e.resolveUrl(t, e.input.browser.current());
	} catch {
		return !1;
	}
}, ir = (e) => {
	let { input: t } = e, { navigation: n } = e, r = (e) => (e.ok && (t.activateLocation?.(), n.notify(e.location)), e);
	return {
		historyStore: e.historyStore,
		onDidNavigate: n.subscribe,
		removeResource: e.removeResource,
		setProject(n) {
			t.registry.store.getState().projectId !== n && (e.clearProject(n), e.resetHistory());
		},
		clearProject() {
			e.clearProject(void 0), e.resetHistory();
		},
		isCurrentProjectUrl: (e) => pe(t.browser.current().url, e),
		hasCurrentPageUrl: (t) => rr(e, t),
		getBootLocation(n) {
			try {
				if (pe(t.browser.current().url, n)) return e.resolveUrl(n, t.browser.current())?.location;
				let r = t.persistence.load(n);
				return r ? e.normalizeStored(r.location).location : e.normalizeTarget({
					kind: "page",
					page: t.startPage
				}).location;
			} catch {
				return;
			}
		},
		boot: (t) => e.restore(t, "boot", !0),
		switchProject(t) {
			return e.clearProject(t), e.restore(t, "project-switch", !1);
		},
		navigate(i) {
			let a = t.registry.store.getState().projectId;
			if (!a) return e.fail("navigation", /* @__PURE__ */ Error("Cannot navigate before a project is active"));
			try {
				let o = e.normalizeTarget(i), s = t.registry.store.getState().location;
				if (s && i.intent !== "restore" && t.focusResource?.(o.location, o.open)) return n.notify(s), {
					ok: !0,
					location: s
				};
				let c = e.locationsEqual(t.registry.store.getState().location, o.location) ? "none" : "push";
				return r(e.commit(a, o, c, "navigatePageLocation"));
			} catch (t) {
				return e.fail("navigation", t);
			}
		},
		updateParams(n) {
			let r = t.registry.store.getState();
			if (!r.location || !r.projectId) throw Error("page_params_no_page");
			let i = t.registry.getPage(r.activePageId), a = { ...r.location.params };
			for (let [e, t] of Object.entries(n)) {
				if (!i?.params || !Object.hasOwn(i.params, e)) throw Error(`page_param_invalid: ${e}`);
				t === null ? delete a[e] : a[e] = t;
			}
			let o = C(i?.params, a), { params: s, ...c } = r.location, l = e.normalizeStored({
				...c,
				...o ? { params: o } : {}
			});
			if (e.locationsEqual(r.location, l.location)) return r.location;
			let u = e.commit(r.projectId, l, "replace", "updatePageParams");
			if (!u.ok) throw Error(u.diagnostic.message);
			return u.location;
		},
		replay(n) {
			let r = t.registry.store.getState().projectId;
			if (!r) return e.fail("history", /* @__PURE__ */ Error("Cannot replay a page before a project is active"));
			try {
				return e.replay(r, e.normalizeStored(n));
			} catch (t) {
				return e.fail("history", t);
			}
		},
		select(n) {
			let r = t.registry.store.getState().projectId;
			if (!r) return e.fail("navigation", /* @__PURE__ */ Error("Cannot select a Main view before a project is active"));
			try {
				return e.select(r, e.normalizeStored(n));
			} catch (t) {
				return e.fail("navigation", t);
			}
		},
		navigateToParent() {
			let n = t.registry.store.getState();
			if (!n.projectId || !n.location?.parent) return e.fail("navigation", /* @__PURE__ */ Error("The active page does not have a parent location"));
			try {
				return r(e.commit(n.projectId, e.normalizeStored(n.location.parent), "replace", "navigateToParentPageLocation"));
			} catch (t) {
				return e.fail("navigation", t);
			}
		},
		navigateToRootLevel() {
			let n = t.registry.store.getState();
			if (!n.projectId) return e.fail("navigation", /* @__PURE__ */ Error("Cannot navigate before a project is active"));
			try {
				let t = e.rootLevelTarget(), i = e.locationsEqual(n.location, t.location) ? "none" : "push";
				return r(e.commit(n.projectId, t, i, "navigateToRootLevelPageLocation"));
			} catch (t) {
				return e.fail("navigation", t);
			}
		},
		closePlacement: e.closePlacement,
		goBack() {
			e.canGoBack() && t.browser.back();
		},
		goForward() {
			e.canGoForward() && t.browser.forward();
		},
		dispose: e.dispose
	};
}, ar = (e) => (t, n, r) => ({
	url: de({
		projectId: t,
		location: n,
		pages: e.pages(),
		resources: e.resources
	}),
	state: {
		kind: "pstdio.page-location",
		index: r,
		projectId: t,
		routeKey: H(n, e.resources, e.pages()),
		location: n,
		removalVersion: e.removalVersion?.() ?? 0,
		removalEpoch: e.removalEpoch?.()
	}
}), or = (e) => (t, n) => {
	let r = {
		code: "page-location-unresolved",
		source: t,
		message: n instanceof Error ? n.message : String(n)
	};
	return e?.(r), {
		ok: !1,
		diagnostic: r
	};
}, sr = () => {
	let e = 0, t = 0, r = n({
		name: "workbench.page-location-history",
		initialState: {
			canGoBack: !1,
			canGoForward: !1
		}
	}), i = () => e > 0, a = () => e < t, o = () => r.setState({
		canGoBack: i(),
		canGoForward: a()
	}, !1, "pageLocationHistory");
	return {
		store: r,
		publish: o,
		canGoBack: i,
		canGoForward: a,
		getIndex: () => e,
		commitIndex(n, r) {
			e = n, r && (t = n);
		},
		adopt(n) {
			e = n, t = Math.max(t, n), o();
		},
		reset() {
			e = 0, t = 0, o();
		}
	};
}, cr = /* @__PURE__ */ new WeakMap(), lr = (e, t) => cr.set(e, t), ur = (e) => {
	let t = cr.get(e);
	if (!t) throw Error("Page location preparation is unavailable");
	return t;
}, dr = (e, t) => Object.fromEntries(Object.entries(e).map(([e, n]) => [e, {
	...n,
	resourceInstances: Object.fromEntries(Object.entries(n.resourceInstances).map(([n, r]) => [n, r.map((r) => t[e]?.resourceInstances[n]?.find((e) => e.instanceKey === r.instanceKey) ?? r)]))
}])), fr = (t, n, r) => (i, o, s, c, l, u = "navigate") => e(() => {
	let e = o.location;
	if (!e) throw Error("Prepared page navigation has no location");
	let d = s === "push" ? r.getIndex() + 1 : r.getIndex();
	s !== "none" && t.browser[s](r.entry(i, e, d)), r.commitIndex(d, s === "push"), l?.(), n.publish(o, c, u);
	let f = r.rememberRootLevel(e), p = r.rememberLocation(e);
	return a(`page location cache for ${i}`, () => t.persistence.save(i, {
		location: e,
		remembered: p,
		...f ? { rootLevel: f } : {}
	})), s !== "none" && r.publish(), {
		ok: !0,
		location: e
	};
}), pr = (e) => (t, n) => {
	let r = "replayWorkbenchPageHistory", i = e.registry.store.getState(), a = e.prepare(t, n, r), { resources: o } = B(e.registry), s = i.projectId === t && Hn(i.location, n.location, o, e.registry.listPages()) ? B(e.registry).prepare.compose(i, {
		...i,
		location: a.location,
		pageStates: dr(i.pageStates, a.pageStates),
		activate: [],
		action: r
	}) : a;
	return e.publish(t, s, "replace", r, () => e.consumeRemembered?.(n.consumeRemembered));
}, mr = (e) => {
	let t = B(e), n = (e, t, n) => ({
		pageId: t.pageId,
		projectId: e,
		location: t.location,
		action: n,
		open: t.open,
		resource: t.location.resource,
		section: t.location.section,
		position: t.location.position,
		pageStates: t.pageStates
	});
	return {
		select: (r, i, a) => t.prepare.selection(n(r, i, a), e.store.getState()),
		open: (r, i, a) => t.prepare.location(n(r, i, a), e.store.getState()),
		restore: (r, i, a) => t.prepare.restore(n(r, i, a), e.store.getState())
	};
}, hr = (e) => (t, n) => e.publish(t, e.prepare(t, n, "selectMainView"), "replace", "selectMainView", void 0, "select"), gr = (e, t, n, r) => {
	if (!t) return e;
	let i;
	try {
		i = n(t);
	} catch {
		return {
			...e,
			consumeRemembered: t
		};
	}
	let a = r?.(i.location) ?? i.location;
	return a === i.location ? i : {
		...n(a),
		consumeRemembered: t
	};
}, _r = (e, t) => e ? !!(e.resource && t(e.resource)) || _r(e.parent, t) : !1, vr = (e) => {
	let t;
	return {
		restore(e) {
			t = e;
		},
		remember(n) {
			let r = Dn({
				...e.levels,
				location: n,
				pages: e.pages()
			});
			return r && (t = r), t;
		},
		forget(n) {
			let r = e.resourceKey(n);
			t && _r(t, (t) => e.resourceKey(t) === r) && (t = void 0);
		},
		target() {
			if (!t) return e.start();
			try {
				return e.normalize(t);
			} catch {
				return e.start();
			}
		}
	};
}, yr = (e) => {
	let t, n = [], r = (t) => e.pages().find((e) => V(e.ref) === V(t.page)), i = (t) => JSON.stringify([
		V(t.page),
		r(t)?.main.kind === "panels" && t.resource ? e.resources.toUri(e.resources.normalize(t.resource)) : null,
		t.parent ? Vn(t.parent, e.resources, e.pages()) : null
	]), a = (t) => e.pages().find((e) => V(e.ref) === V(t.page))?.modeId, o = (t) => Vn(t, e.resources, e.pages());
	return {
		load(e, r = []) {
			t !== e && (t = e, n = [...r]);
		},
		find(e) {
			let t = [...n].reverse().find((t) => i(t) === i(e) && t.modeId === a(e));
			return t?.modeId === a(e) ? t?.location : void 0;
		},
		remember(e) {
			for (let t = e; t; t = t.parent) {
				let r = a(t);
				r && r === a(e) && (n = [...n.filter((e) => i(e) !== i(t)), {
					page: t.page,
					...t.resource ? { resource: t.resource } : {},
					...t.parent ? { parent: t.parent } : {},
					modeId: r,
					location: e
				}]);
			}
			return n;
		},
		consume(e) {
			if (!e) return;
			let t = o(e);
			n = n.filter((e) => o(e.location) !== t);
		},
		forgetResource(t) {
			let r = e.resources.toUri(e.resources.normalize(t)), i = (t) => !!(t.resource && e.resources.toUri(e.resources.normalize(t.resource)) === r || t.parent && i(t.parent));
			n = n.filter((e) => !i(e.location) && !i(e));
		}
	};
}, br = (e) => e.registry.store.subscribe((t, n) => {
	if (Object.keys(n.pages).some((e) => !t.pages[e]) && t.projectId && t.projectId === n.projectId && n.location) {
		try {
			if (t.location) {
				e.normalizeStored(t.location);
				return;
			}
		} catch (t) {
			e.fail("navigation", t);
		}
		try {
			let n = t.activePageId ? t.pages[t.activePageId] : void 0, r = n && t.location ? Qn({
				pageId: n.id,
				pages: e.pages(),
				resources: e.resources,
				resource: t.location.resource,
				section: t.location.section,
				params: t.location.params
			}) : e.start();
			e.commit(t.projectId, r, "replace", "removePageLocationOwner");
		} catch (t) {
			e.fail("navigation", t);
		}
	}
}), xr = (e) => {
	let t = (t, n, r) => {
		let i = e.getPageRef(r.target.pageId);
		if (!i) throw Error(`Unknown page: ${r.target.pageId}`);
		let a = r.target.pageContext ?? n, o = e.normalizeStored({
			page: i,
			...r.target.resource ? { resource: r.target.resource } : {},
			...r.target.section ? { section: r.target.section } : {},
			...r.target.position ? { position: r.target.position } : {},
			...a.params ? { params: a.params } : {},
			...a.parent ? { parent: a.parent } : {}
		});
		return e.commit(t, {
			...o,
			pageStates: r.pageStates,
			...r.target.open ? { open: r.target.open } : {}
		}, r.locationChanged ? "replace" : "none", "closePagePlacement");
	};
	return (n) => {
		let r = e.getCurrent();
		if (!r.projectId || !r.location) return e.fail("navigation", /* @__PURE__ */ Error("Cannot close a page placement without an active location"));
		try {
			if (n.kind !== "page") throw Error("Only page-owned placements can close through page navigation");
			let i = e.resolveClosePlacement(n);
			return t(r.projectId, r.location, i);
		} catch (t) {
			return e.fail("navigation", t);
		}
	};
}, Sr = (e, t) => e < t ? -1 : +(e > t), Cr = (e) => e.kind === "shell" ? `shell\0${e.placementId}` : e.kind === "mode" ? `mode\0${e.modeId}\0${e.placementId}` : `page\0${e.pageId}\0${e.slotId}`, U = (e) => e.kind === "shell" ? JSON.stringify([
	"shell",
	e.placementId,
	e.instanceKey
]) : e.kind === "mode" ? JSON.stringify([
	"mode",
	e.modeId,
	e.placementId,
	e.instanceKey
]) : JSON.stringify([
	"page",
	e.pageId,
	e.slotId,
	e.instanceKey
]), wr = (e, t) => {
	let n = Sr(Cr(e.identity), Cr(t.identity));
	return n === 0 ? Sr(e.identity.instanceKey, t.identity.instanceKey) : n;
}, Tr = (e, t) => e.order - t.order || wr(e, t), Er = (e, t) => {
	if (t.identity.kind === e) return;
	let n = `${e[0]?.toUpperCase()}${e.slice(1)}`;
	throw Error(`${n} placement must have a ${e} owner`);
}, Dr = (e) => {
	let t = [], n = /* @__PURE__ */ new Set(), r = (e, r) => {
		for (let i of r) {
			if (Er(e, i), !Number.isFinite(i.order)) throw Error("Placement order must be a finite number");
			let r = U(i.identity);
			if (n.has(r)) throw Error(`Duplicate placement identity: ${r}`);
			n.add(r), t.push(i);
		}
	};
	if (r("shell", e.shell), r("mode", e.mode ?? []), r("page", e.page ?? []), new Set((e.mode ?? []).map((e) => e.identity.kind === "mode" ? e.identity.modeId : "invalid-mode-owner")).size > 1) throw Error("Mode placements must belong to one active mode");
	return t;
}, Or = () => E.reduce((e, t) => (e[t] = [], e), {}), kr = (e) => {
	let t = Dr(e), n = new Set((e.closed ?? []).map(U)), r = [], i = Or();
	for (let e of t) n.has(U(e.identity)) ? r.push(e) : i[e.region].push(e);
	for (let e of E) i[e].sort(Tr);
	return r.sort(wr), {
		placements: E.flatMap((e) => i[e]),
		closed: r,
		regions: i,
		visibleRegions: new Set(E.filter((e) => i[e].length > 0))
	};
}, Ar = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of e) {
		let e = U(n.identity);
		if (t.has(e)) throw Error(`Duplicate placement identity: ${e}`);
		t.set(e, n);
	}
	return t;
}, jr = (e, t, n) => e.region === t.region && e.order === t.order && n(e.value, t.value), W = (e) => {
	let t = Ar(e.current), n = Ar(e.desired), r = [], i = [], a = [], o = [];
	for (let [o, s] of n) {
		let n = t.get(o);
		n ? jr(n, s, e.valuesEqual) ? i.push(s) : a.push({
			current: n,
			desired: s
		}) : r.push(s);
	}
	for (let [e, r] of t) n.has(e) || o.push(r);
	let s = new Set((e.activate ?? []).map(U)), c = Array.from(s, (e) => {
		let t = n.get(e);
		if (!t) throw Error(`Cannot activate missing placement: ${e}`);
		return t;
	});
	return r.sort(wr), i.sort(wr), a.sort((e, t) => wr(e.desired, t.desired)), c.sort(wr), o.sort(wr), {
		add: r,
		retain: i,
		update: a,
		activate: c,
		remove: o,
		...e.destinations?.length ? { destinations: e.destinations } : {}
	};
}, Mr = (e, t, n) => {
	let r = e.parent ? Mr(e.parent, t, n) : void 0, i = r === e.parent ? e : {
		...e,
		parent: r
	};
	if (!i.resource || !n(i.resource)) return i;
	let a = t.find((e) => e.ref.id === i.page.id && e.ref.extensionId === i.page.extensionId);
	if (I(a) && a?.main.empty) {
		let { resource: e, section: t, position: n, ...r } = i;
		return r;
	}
	return r ?? { page: i.page };
}, Nr = (e, t, n) => {
	let r = e.pageContext;
	if (!r?.parent) return e;
	let i = Mr(r.parent, t, n);
	return i === r.parent ? e : {
		...e,
		pageContext: {
			...r,
			parent: i
		}
	};
}, Pr = (e, t, n) => e.resource && t ? `${e.id}|${JSON.stringify([n.toUri(n.normalize(t)), e.document ? t.metadata?.[e.document.metadataKey] : null])}` : e.id, Fr = (e, t, n) => e.resource && t ? Pr(e, t, n) : "default", Ir = (e, t, n) => {
	let r = n === "default" ? t : n;
	return e === r || e.startsWith(`${r}|`);
}, G = (e, t, n) => e.resource ? Pr(e, t?.resource, n) : e.main.kind === "panels" && t ? `${e.id}|${Vn({
	...t,
	position: void 0
}, n)}` : e.id, Lr = (e, t) => Object.fromEntries(Object.entries(e).filter(([e]) => e !== t && !e.startsWith(`${t}|`))), Rr = (e, t, n, r) => {
	let i = (e) => n.toUri(n.normalize(e)), a = i(t), o = new Set(r.map(U)), s = Object.fromEntries(Object.entries(e.pageStates).map(([t, n]) => {
		let r = Object.keys(e.pages).find((e) => t === e || t.startsWith(`${e}|`));
		if (!r) return [t, n];
		let s = Object.fromEntries(Object.entries(n.resourceInstances).map(([t, n]) => [t, n.filter((e) => i(e.resource) !== a || o.has(U({
			kind: "page",
			pageId: r,
			slotId: t,
			instanceKey: e.instanceKey
		}))).map((t) => Nr(t, Object.values(e.pages), (e) => i(e) === a))])), c = sn(e.pages[r]), l = c ? s[c.id] ?? [] : [], u = n.activePrimaryInstanceKey;
		return c?.item.kind === "binding" && !l.some((e) => e.instanceKey === u) && (u = l.at(-1)?.instanceKey), [t, {
			...n,
			resourceInstances: s,
			activePrimaryInstanceKey: u
		}];
	})), c = e.location, l = e.activePageId ? e.pages[e.activePageId] : void 0;
	if (l && c?.resource && i(c.resource) === a) {
		let t = s[G(l, c, n)], r = sn(l), o = (r ? t?.resourceInstances[r.id] ?? [] : []).find((e) => e.instanceKey === t?.activePrimaryInstanceKey);
		if (o) c = {
			...c,
			resource: o.resource,
			section: o.section
		};
		else if (I(l) && l.main.empty) {
			let { resource: e, section: t, position: n, ...r } = c;
			c = r;
		} else c.parent ? c = Mr(c.parent, Object.values(e.pages), (e) => i(e) === a) : l.parentId && (c = { page: e.pages[l.parentId].ref });
	}
	return c?.parent && (c = {
		...c,
		parent: Mr(c.parent, Object.values(e.pages), (e) => i(e) === a)
	}), {
		pageStates: s,
		location: c
	};
}, zr = (e) => (t) => {
	if (!t.projectId) return;
	let n = e.persistence.load(t.projectId);
	if (!n) return;
	let r = (t) => e.resources.toUri(e.resources.normalize(t)), i = r(t), a = (e) => !!(e && (e.resource && r(e.resource) === i || a(e.parent))), o = n.location;
	if (a(o)) {
		let n = e.getState(), r = Object.values(n.pages).find((e) => V(e.ref) === V(o.page)), i = Rr({
			...n,
			projectId: t.projectId,
			activePageId: r?.id,
			location: o,
			pageStates: {}
		}, t, e.resources, []), s = o.parent;
		for (; s && a(s);) s = s.parent;
		o = i.location && !a(i.location) ? i.location : s ?? e.start().location;
	}
	e.persistence.save(t.projectId, {
		location: o,
		...a(n.rootLevel) ? {} : { rootLevel: n.rootLevel },
		remembered: n.remembered?.filter((e) => !a(e) && !a(e.location))
	});
}, Br = (e) => {
	let t = zr(e);
	return (n, r) => {
		let i = e.getState();
		if (n.projectId && n.projectId !== i.projectId) {
			t(n);
			return;
		}
		if (e.forgetMemory(n), e.forgetRootLevel(n), !i.projectId || !i.location) return;
		let a = Rr(i, n, e.resources, r);
		if (!a.location) return;
		let o = !Hn(i.location, a.location, e.resources, Object.values(i.pages)), s = Zn({
			location: a.location,
			pages: Object.values(i.pages),
			resources: e.resources
		});
		e.commit(i.projectId, {
			...s,
			pageStates: a.pageStates
		}, o ? "replace" : "none", "removePageResource");
	};
}, Vr = (e) => {
	let t = lt("page navigation subscriber"), n = B(e.registry), r = e.registry.listPages, i = yr({
		pages: r,
		resources: n.resources
	}), a = sr(), o = or(e.reportDiagnostic), s = ar({
		pages: r,
		resources: n.resources,
		removalVersion: e.getResourceRemovalVersion,
		removalEpoch: e.getResourceRemovalEpoch
	}), c = vr({
		levels: e,
		pages: r,
		normalize: (e) => f(e),
		resourceKey: (e) => n.resources.toUri(n.resources.normalize(e)),
		start: () => h()
	}), l = fr(e, n, {
		getIndex: a.getIndex,
		commitIndex: a.commitIndex,
		entry: s,
		publish: a.publish,
		rememberRootLevel: c.remember,
		rememberLocation: i.remember
	}), u = mr(e.registry), d = (e, t, n, r) => l(e, u.open(e, t, r), n, r, () => i.consume(t.consumeRemembered)), f = (e) => Zn({
		location: e,
		pages: r(),
		resources: n.resources
	}), p = (t, n, r) => gr(t, t.location, f, (t) => e.restoreLocation?.(t, n, r) ?? t), m = (t) => {
		let a = Xn({
			target: t,
			pages: r(),
			resources: n.resources,
			active: e.registry.store.getState().location
		});
		return t.intent === "restore" ? gr(a, i.find(a.location), f, (t) => e.restoreLocation?.(t, e.registry.store.getState().projectId) ?? t) : a;
	}, h = () => Xn({
		target: {
			kind: "page",
			page: e.startPage
		},
		pages: r(),
		resources: n.resources
	}), g = tr({
		pages: r,
		resources: n.resources,
		normalize: f
	}), _ = (s, m, _) => {
		try {
			let o = e.browser.current();
			$n(o.state) && o.state.projectId === s ? a.adopt(o.state.index) : a.reset();
			let d = _ && pe(o.url, s), v = d ? g(s, o) : void 0;
			if (d && !v) throw Error(`Cannot resolve page URL: ${o.url}`);
			let y = e.persistence.load(s);
			i.load(s, y?.remembered), c.restore(y?.rootLevel);
			let b = d ? void 0 : y?.location, x = p(v ?? (b ? f(b) : h()), s), S = m === "boot" ? "bootPageLocation" : "switchPageProject", ee = Hn(y?.location, x.location, n.resources, r()), C = ee ? u.restore : u.open, te = l(s, C(s, x, S), "replace", S, () => i.consume(x.consumeRemembered));
			return te.ok && v && !ee && t.notify(te.location), te;
		} catch (e) {
			o(m, e);
			try {
				return d(s, h(), "replace", `${m}StartFallback`);
			} catch (e) {
				return o(m, e);
			}
		}
	}, v = nr({
		projectId: () => e.registry.store.getState().projectId,
		removalEpoch: e.getResourceRemovalEpoch,
		adopt: a.adopt,
		resolve: g,
		restore: p,
		locationsEqual: (e, t) => Hn(e, t, n.resources, r()),
		commit: d,
		notify: t.notify,
		fail: (e) => o("history", e)
	}), y = e.browser.onPopState(v), b = br({
		registry: e.registry,
		pages: r,
		resources: n.resources,
		normalizeStored: f,
		start: h,
		commit: d,
		fail: o
	}), x = xr({
		commit: d,
		fail: o,
		getCurrent: () => e.registry.store.getState(),
		getPageRef: (t) => e.registry.getPage(t)?.ref,
		normalizeStored: f,
		resolveClosePlacement: n.resolveClosePlacement
	}), S = ir({
		input: e,
		historyStore: a.store,
		navigation: t,
		clearProject(t) {
			c.restore(void 0), i.load(t, t ? e.persistence.load(t)?.remembered : void 0), n.clearProject(t);
		},
		resetHistory: a.reset,
		rootLevelTarget: c.target,
		restore: _,
		resolveUrl: g,
		normalizeTarget: m,
		normalizeStored: f,
		locationsEqual: (e, t) => Hn(e, t, n.resources, r()),
		commit: d,
		replay: (t, n) => pr({
			registry: e.registry,
			prepare: u.open,
			publish: l,
			consumeRemembered: i.consume
		})(t, p(n, t)),
		select: hr({
			prepare: u.select,
			publish: l
		}),
		fail: o,
		closePlacement: x,
		removeResource: Br({
			getState: e.registry.store.getState,
			resources: n.resources,
			forgetRootLevel: c.forget,
			forgetMemory: i.forgetResource,
			persistence: e.persistence,
			start: h,
			commit: d
		}),
		canGoBack: a.canGoBack,
		canGoForward: a.canGoForward,
		dispose() {
			y.dispose(), b();
		}
	});
	return lr(S, {
		resolve: m,
		commit: (t, a, o = []) => {
			if (!t.projectId || !t.location) throw Error("Cannot navigate before a project is active");
			let s = Hn(e.registry.store.getState().location, t.location, n.resources, r()) ? "none" : "push";
			return l(t.projectId, t, s, "navigateCompoundTarget", () => {
				a?.();
				for (let e of o) i.consume(e);
			});
		}
	}), S;
}, Hr = (e = {}) => {
	let t, i = a(`panel menu cache read for ${t ?? "unscoped"}`, () => e.persistence?.getMenuStates(t)), o = (e) => ({ ...e?.openByMenuId }), s = n({
		name: "workbench.panelMenuState",
		initialState: { openByMenuId: o(i) }
	}), c = () => {
		e.persistence && a(`panel menu cache write for ${t ?? "unscoped"}`, () => e.persistence?.setMenuStates({ openByMenuId: s.getState().openByMenuId }, t));
	}, l = (e) => s.getState().openByMenuId[e] ?? !0;
	return {
		store: s,
		isOpen: l,
		setOpen(e, t) {
			let n = s.getState();
			(n.openByMenuId[e] ?? !0) !== t && (s.setState({ openByMenuId: {
				...n.openByMenuId,
				[e]: t
			} }, !1, "setMenuOpen"), c());
		},
		toggle(e) {
			this.setOpen(e, !l(e));
		},
		setPersistenceScope(n) {
			if (n === t) return;
			c(), t = n;
			let r = a(`panel menu cache read for ${t ?? "unscoped"}`, () => e.persistence?.getMenuStates(t));
			s.setState({ openByMenuId: o(r) }, !1, "setPersistenceScope");
		},
		getPersistenceScope: () => t,
		onDidChange(e) {
			let t = s.subscribe((t) => e(t));
			return r(t);
		}
	};
}, Ur = (e) => {
	let t = () => e.getFloatingPanels?.() !== "hidden", n = (e) => !t() && e === "floating" ? "attached" : e, i = e.initialMode === "attached" ? "attached" : "floating", a = () => {
		let t = e.layout.getLayout().regions.side;
		return t.visible ? n(t.presentation ?? i) : "closed";
	};
	return {
		canFloat: t,
		getMode: a,
		setMode: (t) => {
			e.validateMode?.(t), e.layout.setSidePanelMode(n(t));
		},
		onDidChange(t) {
			let n = a(), i = () => {
				let e = a();
				e !== n && (n = e, t(e));
			}, o = e.layout.store.subscribe(i), s = e.onDidChangePolicy?.(i);
			return r(() => {
				o(), s?.dispose();
			});
		}
	};
}, Wr = "Terminal", Gr = 200, Kr = () => {
	let e = n({
		name: "workbench.terminal",
		initialState: { sessionsById: {} }
	}), t = null, r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Map(), s = /* @__PURE__ */ new Map(), c = /* @__PURE__ */ new Map(), l = /* @__PURE__ */ new Map(), u = (t, n, r) => {
		let i = e.getState(), a = i.sessionsById[t];
		a && e.setState({ sessionsById: {
			...i.sessionsById,
			[t]: {
				...a,
				...n
			}
		} }, !1, r);
	}, d = (e) => {
		let t = r.get(e);
		if (!t) throw Error(`Unknown terminal session: ${e}`);
		return t;
	}, f = (e) => {
		r.delete(e), a.delete(e), o.delete(e);
		let t = c.get(e);
		c.delete(e), t && s.get(t) === e && s.delete(t);
		let n = i.get(e) ?? [];
		i.delete(e);
		for (let e of n) e();
	}, p = (e, t) => {
		let n = a.get(e);
		if (!n) return;
		let r = new Uint8Array(t);
		n.push(r), n.length > Gr && n.shift();
		for (let t of o.get(e) ?? []) t(r);
	}, m = async (e) => {
		await d(e.sessionId).kill(e.signal), u(e.sessionId, { status: "killed" }, "killTerminalSession"), f(e.sessionId);
	};
	return {
		store: e,
		isAvailable: () => t !== null,
		setSessionOpener(e) {
			t = e;
		},
		open: async (n) => {
			if (!t) throw Error("Terminal sessions are not available in this workbench host.");
			if (n.bindingId) {
				let e = s.get(n.bindingId);
				if (e && r.has(e)) return { sessionId: e };
				let t = l.get(n.bindingId);
				if (t) return await t;
			}
			let d = (async () => {
				let l = await t(n.request);
				r.set(l.id, l), a.set(l.id, []), o.set(l.id, /* @__PURE__ */ new Set()), n.bindingId && (s.set(n.bindingId, l.id), c.set(l.id, n.bindingId));
				let d = [l.onData((e) => p(l.id, e))], m = l.onTitle?.((e) => u(l.id, { title: e }, "terminalSessionTitleChanged"));
				m && d.push(m), d.push(l.onExit((t) => {
					e.getState().sessionsById[l.id]?.status === "running" && u(l.id, {
						status: "exited",
						exit: t
					}, "terminalSessionExited"), f(l.id);
				})), i.set(l.id, d);
				let h = e.getState();
				return e.setState({ sessionsById: {
					...h.sessionsById,
					[l.id]: {
						id: l.id,
						title: n.title ?? Wr,
						status: "running"
					}
				} }, !1, "openTerminalSession"), { sessionId: l.id };
			})();
			n.bindingId && l.set(n.bindingId, d);
			try {
				return await d;
			} finally {
				n.bindingId && l.get(n.bindingId) === d && l.delete(n.bindingId);
			}
		},
		write(e) {
			d(e.sessionId).write(e.data);
		},
		resize(e) {
			d(e.sessionId).resize(e.cols, e.rows);
		},
		kill: m,
		killBinding: async (e) => {
			let t = s.get(e);
			if (t && r.has(t)) {
				await m({ sessionId: t });
				return;
			}
			let n = l.get(e);
			if (!n) return;
			let i = await n.catch(() => void 0);
			i && r.has(i.sessionId) && await m({ sessionId: i.sessionId });
		},
		subscribe(e, t) {
			let n = d(e), r = [];
			if (t.onData) {
				let n = t.onData, i = o.get(e);
				i?.add(n), r.push(() => i?.delete(n));
				for (let t of a.get(e) ?? []) n(t);
			}
			return r.push(t.onExit ? n.onExit(t.onExit) : void 0, t.onError ? n.onError(t.onError) : void 0), () => {
				for (let e of r) e?.();
			};
		},
		getSession(t) {
			return e.getState().sessionsById[t];
		},
		listSessions() {
			return Object.values(e.getState().sessionsById);
		},
		async dispose() {
			let t = Object.values(e.getState().sessionsById).filter((e) => e.status === "running");
			await Promise.all(t.map((e) => m({ sessionId: e.id })));
			for (let t of Object.values(e.getState().sessionsById)) f(t.id);
			r.clear();
		}
	};
}, qr = () => {
	let e = n({
		name: "workbench.commandPaletteResources",
		initialState: {
			providers: {},
			refreshToken: 0
		}
	});
	return {
		store: e,
		registerProvider(t) {
			let n = e.getState();
			if (n.providers[t.id]) throw Error(`Command palette resource provider already registered: ${t.id}`);
			return e.setState({
				...n,
				providers: {
					...n.providers,
					[t.id]: t
				}
			}, !1, "registerProvider"), r(() => {
				let n = e.getState();
				if (n.providers[t.id] !== t) return;
				let { [t.id]: r, ...i } = n.providers;
				e.setState({
					...n,
					providers: i
				}, !1, "unregisterProvider");
			});
		},
		listProviders() {
			return Object.values(e.getState().providers);
		},
		async queryProviders(t) {
			let n = Object.values(e.getState().providers);
			return Promise.all(n.map(async (e) => {
				try {
					let n = await e.query(t);
					return {
						providerId: e.id,
						title: e.title,
						results: n
					};
				} catch {
					return {
						providerId: e.id,
						title: e.title,
						results: []
					};
				}
			}));
		},
		refresh() {
			let t = e.getState();
			e.setState({
				...t,
				refreshToken: t.refreshToken + 1
			}, !1, "refresh");
		}
	};
}, Jr = (e) => e.replace(/^['"]|['"]$/g, ""), Yr = (e, t) => {
	let n = t.trim();
	if (n.length === 0) return !0;
	let r = n.match(/^([A-Za-z0-9_.-]+)\s*(==|!=)\s*(.+)$/);
	if (r) {
		let [, t, n, i] = r, a = e[t ?? ""], o = Jr(i ?? "");
		return n === "==" ? String(a) === o : String(a) !== o;
	}
	return n.startsWith("!") ? !e[n.slice(1)] : !!e[n];
}, Xr = (e, t) => !t || t.split("||").some((t) => t.split("&&").every((t) => Yr(e, t))), Zr = () => {
	let e = n({
		name: "workbench.context",
		initialState: { values: {} }
	}), t = {}, r = /* @__PURE__ */ new Map(), i = () => {
		let e = { ...t };
		for (let t of r.values()) Object.assign(e, t);
		return e;
	}, a = (t) => {
		e.setState({ values: i() }, !1, t);
	};
	return {
		store: e,
		set(e, n) {
			t[e] !== n && (t = {
				...t,
				[e]: n
			}, a("setContextKey"));
		},
		get(t) {
			return e.getState().values[t];
		},
		delete(e) {
			if (!(e in t)) return;
			let { [e]: n, ...r } = t;
			t = r, a("deleteContextKey");
		},
		createScope(e) {
			r.set(e, r.get(e) ?? {});
			let t = !1, n = () => {
				if (t) throw Error(`Context key scope disposed: ${e}`);
			};
			return {
				ownerId: e,
				set(t, i) {
					n();
					let o = r.get(e) ?? {};
					o[t] !== i && (r.set(e, {
						...o,
						[t]: i
					}), a("setScopedContextKey"));
				},
				get(t) {
					return n(), r.get(e)?.[t];
				},
				delete(t) {
					n();
					let i = r.get(e);
					if (!i || !(t in i)) return;
					let { [t]: o, ...s } = i;
					r.set(e, s), a("deleteScopedContextKey");
				},
				dispose() {
					t || (t = !0, r.delete(e) && a("disposeContextKeyScope"));
				}
			};
		},
		deleteOwner(e) {
			r.delete(e) && a("deleteContextKeyOwner");
		},
		snapshot() {
			return { ...e.getState().values };
		},
		matches(t) {
			return Xr(e.getState().values, t);
		}
	};
}, Qr = (e = {}) => {
	let t = n({
		name: "workbench.commands",
		initialState: { commands: {} }
	}), a = /* @__PURE__ */ new Set(), c = (e) => {
		let n = t.getState().commands[e];
		if (!n) throw Error(`Command not registered: ${e}`);
		return n;
	}, l = (e) => {
		for (let t of a) t(e);
	};
	return {
		store: t,
		registerCommand(e, n, i) {
			let a = t.getState();
			if (a.commands[e.id]) throw Error(`Command already registered: ${e.id}`);
			let o = {
				...s(i),
				command: e,
				handler: n
			};
			return t.setState({ commands: {
				...a.commands,
				[e.id]: o
			} }, !1, "registerCommand"), r(() => {
				let n = t.getState();
				if (n.commands[e.id] !== o) return;
				let { [e.id]: r, ...i } = n.commands;
				t.setState({ commands: i }, !1, "unregisterCommand");
			});
		},
		getCommand(e) {
			return t.getState().commands[e];
		},
		listCommands() {
			return Object.values(t.getState().commands).sort(i);
		},
		isCommandEnabled(e, t, n) {
			return c(e).handler.isEnabled?.(t, n) ?? !0;
		},
		isCommandVisible(t, n, r) {
			let i = c(t), a = e.context?.snapshot() ?? {};
			return Xr(r ? o(a, r.resource) : a, i.command.when) ? i.handler.isVisible?.(n, r) ?? !0 : !1;
		},
		isCommandToggled(e, t) {
			return c(e).handler.isToggled?.(t) ?? !1;
		},
		async prepareCommandArgs(e, t, n, r) {
			let i = c(e).handler.prepareArgs;
			return i ? i(t, n, r) : t;
		},
		async executeCommand(t, n, r) {
			if (r?.projectId !== void 0 && e.getProjectId && r.projectId !== e.getProjectId()) throw Error(`Command belongs to another project: ${t}`);
			if (r?.isViewerCurrent?.() === !1) throw Error(`Command belongs to a closed viewer: ${t}`);
			let i = c(t);
			if (i.handler.isEnabled?.(n, r) === !1) {
				let e = /* @__PURE__ */ Error(`Command is disabled: ${t}`);
				throw l({
					commandId: t,
					args: n,
					error: e
				}), e;
			}
			try {
				return await i.handler.execute(n, r);
			} catch (e) {
				throw l({
					commandId: t,
					args: n,
					error: e
				}), e;
			}
		},
		onDidExecuteError(e) {
			return a.add(e), r(() => {
				a.delete(e);
			});
		}
	};
}, $r = (e) => Array.isArray(e) ? e : e.trim().split(/\s+/).filter(Boolean), ei = (e) => {
	let t = $r(e);
	return t.length === 1 ? t[0] ?? "" : t;
}, ti = (e) => {
	let t = n({
		name: "workbench.keybindings",
		initialState: { keybindings: [] }
	});
	return {
		store: t,
		registerKeybinding(n, i) {
			if (n.action.kind === "command" && !e.commands.getCommand(n.action.commandId)) throw Error(`Keybinding command not registered: ${n.action.commandId}`);
			let a = {
				...s(i),
				...n,
				keybinding: ei(n.keybinding)
			}, o = t.getState();
			return t.setState({ keybindings: [...o.keybindings, a] }, !1, "registerKeybinding"), r(() => {
				let e = t.getState(), n = e.keybindings.filter((e) => e !== a);
				n.length !== e.keybindings.length && t.setState({ keybindings: n }, !1, "unregisterKeybinding");
			});
		},
		listKeybindings() {
			return [...t.getState().keybindings].sort(i);
		},
		listActiveKeybindings() {
			return t.getState().keybindings.filter((t) => e.context.matches(t.when)).sort(i);
		},
		listCommandKeybindings() {
			return [...t.getState().keybindings].sort(i).flatMap((e) => e.action.kind === "command" ? [{
				commandId: e.action.commandId,
				keybinding: e.keybinding
			}] : []);
		}
	};
}, ni = (e, t, n) => ({
	role: "anchor",
	anchor: e,
	persistence: t,
	candidates: n
}), K = (e, t = !1) => t ? {
	role: "projection",
	reads: e,
	navigator: t
} : {
	role: "projection",
	reads: e
}, ri = {
	nav: K(["primary", "attached"]),
	activity: { role: "chrome" },
	sidenav: K(["primary"], !0),
	"main-header": K(["primary"]),
	"main-left-menu": K(["primary"]),
	main: ni("primary", "primary", "global"),
	"main-right-menu": K(["primary"]),
	"secondary-header": K(["primary"]),
	"secondary-left-menu": K(["secondary"]),
	secondary: ni("secondary", "derived", "scoped"),
	"secondary-right-menu": K(["secondary"]),
	status: K(["primary", "attached"]),
	overlay: { role: "transient" },
	"side-header": K(["attached"]),
	"side-left-menu": K(["attached"]),
	side: ni("attached", "detached", "scoped"),
	"side-right-menu": K(["attached"])
}, ii = (e) => ri[e], ai = () => E.filter((e) => ri[e].role === "anchor"), oi = (e) => {
	let t = E.find((t) => {
		let n = ri[t];
		return n.role === "anchor" && n.anchor === e;
	});
	if (!t) throw Error(`No region hosts anchor: ${e}`);
	return t;
}, si = (e, t) => {
	let n = Re(e.regions[oi(t)]);
	if (t !== "primary") return n?.resource;
	let r = k(e);
	return r ? r.resource : n?.role === "sub-panel" ? void 0 : n?.resource;
}, ci = ({ layout: e, primary: t, isInScope: n }) => {
	let r = [];
	for (let i of ai()) {
		let a = ii(i);
		if (a.role === "anchor" && a.persistence !== "primary") for (let o of e.regions[i].widgets) {
			if (!o.resource) continue;
			let e = o.role === "location" || o.role === "sub-panel" && (!!o.ownerResourceKey || o.placementIdentity?.kind === "shell" || o.placementIdentity?.kind === "mode") || a.persistence !== "derived" && n(o.resource, t);
			r.push({
				region: i,
				widgetId: o.widgetId,
				action: e ? "keep" : "clear"
			});
		}
	}
	return r;
}, li = (e) => e.join("/"), ui = (e) => {
	let t = 0, a = n({
		name: "workbench.menus",
		initialState: { itemsByPath: {} }
	});
	return {
		menuStore: a,
		registerMenuItem(n, i, o) {
			if (!e.commands.getCommand(i.commandId)) throw Error(`Menu command not registered: ${i.commandId}`);
			let c = li(n), l = {
				...s(o),
				...i,
				id: i.id ?? `${o?.ownerId ?? "workbench.core"}:${c}:${t++}`,
				path: n
			}, u = a.getState(), d = u.itemsByPath[c] ?? [];
			return a.setState({ itemsByPath: {
				...u.itemsByPath,
				[c]: [...d, l]
			} }, !1, "registerMenuItem"), r(() => {
				let e = a.getState(), t = e.itemsByPath[c] ?? [], n = t.filter((e) => e !== l);
				n.length !== t.length && a.setState({ itemsByPath: {
					...e.itemsByPath,
					[c]: n
				} }, !1, "unregisterMenuItem");
			});
		},
		listMenuItems(e) {
			return [...a.getState().itemsByPath[li(e)] ?? []].sort((e, t) => (e.order ?? 0) - (t.order ?? 0) || i(e, t));
		}
	};
}, di = (e) => [
	"workbench",
	"header",
	e,
	"leading"
], fi = (e) => [
	"workbench",
	"header",
	e,
	"trailing"
], pi = (e) => [
	"workbench",
	"regionTabs",
	e,
	"leading"
], mi = ["workbench", "commandPalette"], hi = di("nav"), gi = fi("nav"), _i = [
	"workbench",
	"breadcrumb",
	"location"
], vi = (e) => [
	"workbench",
	"resource",
	e,
	"context"
], q = (e, t) => e.kinds.some((e) => e.id === t.type && (!t.extensionId || !e.extensionId || t.extensionId === e.extensionId)), yi = "single", bi = (e, t) => e.kind === "view" && e.presence === "fixed" && D.some((e) => e === t) ? {
	...e,
	presence: "open"
} : { ...e }, xi = (e) => e.kind !== "view" || e.presence !== "fixed", J = (e) => u(e.kind === "view" ? e.view : e.binding.view), Y = () => ({
	staticOverrides: /* @__PURE__ */ new Map(),
	resourceInstances: /* @__PURE__ */ new Map()
}), Si = (e, t, n) => e.kind === "view" ? e.presence === "fixed" || (t.staticOverrides.get(n) ?? e.presence) === "open" : !1, Ci = (e, t, n) => {
	if (n.kind === "binding" && n.binding.kinds.length === 0) throw Error(`${e} "${t}" must bind at least one resource kind`);
}, wi = (e) => {
	let { id: t, item: n, label: r, state: i } = e;
	if (n.kind !== "view") throw Error(`${r} "${t}" is not a static placement`);
	if (e.resource) throw Error(`${r} "${t}" does not accept a resource`);
	if (e.open) throw Error(`${r} "${t}" does not accept an open intent`);
	n.presence !== "fixed" && i.staticOverrides.set(t, "open");
}, Ti = (e) => {
	let { id: t, item: n, label: r, state: i } = e;
	if (n.kind !== "view") throw Error(`${r} "${t}" is not a static placement`);
	if (n.presence === "fixed") throw Error(`${r} "${t}" is fixed and cannot close`);
	i.staticOverrides.set(t, "closed");
}, Ei = (e, t, n) => {
	if (e.binding.cardinality === "one") return [n];
	let r = t.find((e) => e.instanceKey === n.instanceKey)?.open === "pin" || n.open === "pin" ? "pin" : "preview";
	return [...t.filter((e) => e.instanceKey !== n.instanceKey), {
		...n,
		open: r
	}];
}, Di = (e, t, n = h) => {
	let r = n(t), i = e.find((e) => n(e.resource) === r);
	if (i) return i.instanceKey;
	let a = new Set(e.map((e) => e.instanceKey)), o = r;
	for (let e = 2; a.has(o); e += 1) o = `${r}#${e}`;
	return o;
}, Oi = (e) => {
	let { id: t, item: n, label: r, state: i } = e;
	if (n.kind !== "binding") throw Error(`${r} "${t}" is not resource-backed`);
	if (!e.resource) throw Error(`${r} "${t}" requires a resource`);
	if (!q(n.binding, e.resource)) throw Error(`${r} "${t}" does not accept resource kind "${e.resource.type}"`);
	if (e.open && n.binding.cardinality !== "many") throw Error(`${r} "${t}" accepts open intent only with many cardinality`);
	let a = i.resourceInstances.get(t) ?? [], o = {
		instanceKey: n.binding.cardinality === "one" ? yi : Di(a, e.resource, e.keyOfResource),
		resource: e.resource,
		...e.location,
		...n.binding.cardinality === "many" ? { open: e.open ?? "preview" } : {},
		...e.title ? { title: e.title } : {},
		...e.relatedSource && e.open !== "pin" ? { relatedSource: e.relatedSource } : {}
	};
	return i.resourceInstances.set(t, Ei(n, a, o)), o.instanceKey;
}, ki = (e) => {
	if (e.instanceKey === "default") return Ti(e), !0;
	let t = e.state.resourceInstances.get(e.id) ?? [], n = t.filter((t) => t.instanceKey !== e.instanceKey);
	return n.length !== t.length && (e.state.resourceInstances.set(e.id, n), !0);
}, Ai = (e) => {
	let { id: t, item: n, label: r, state: i } = e;
	if (e.instanceKey === "default" || n.kind !== "binding") return;
	if (e.resource && !q(n.binding, e.resource)) throw Error(`${r} "${t}" does not accept resource kind "${e.resource.type}"`);
	let a = i.resourceInstances.get(t) ?? [], o = e.keyOfResource ?? h;
	i.resourceInstances.set(t, a.map((t) => {
		if (t.instanceKey !== e.instanceKey) return t;
		let n = !!(e.resource && o(e.resource) !== o(t.resource)), r = e.location || n ? {
			section: e.location?.section,
			position: e.location?.position,
			pageContext: e.location?.pageContext ?? t.pageContext
		} : void 0;
		return {
			...t,
			...r,
			...e.open ? { open: e.open } : {},
			...e.open || n ? { relatedSource: void 0 } : {},
			...e.resource ? { resource: e.resource } : {},
			...e.title === void 0 ? {} : { title: e.title }
		};
	}));
}, ji = (e, t) => {
	e.staticOverrides.delete(t), e.resourceInstances.delete(t);
}, Mi = /* @__PURE__ */ new WeakMap(), Ni = (e, t) => Mi.set(e, t), X = (e) => {
	let t = Mi.get(e);
	if (!t) throw Error("Owned placement preparation is unavailable");
	return t;
}, Pi = (e) => {
	let t = {
		staticOverrides: new Map(e.current.staticOverrides),
		resourceInstances: new Map(e.current.resourceInstances)
	}, n = {
		...e.target,
		label: e.label,
		id: e.target.placementId,
		item: e.item,
		state: t,
		keyOfResource: e.keyOfResource
	}, r = "default";
	return e.item.kind === "view" ? wi(n) : r = Oi(n), {
		state: t,
		identity: e.identityFor(r)
	};
}, Fi = (e) => {
	let t = {
		staticOverrides: new Map(e.state.staticOverrides),
		resourceInstances: new Map(e.state.resourceInstances)
	};
	for (let n of e.declarations) {
		let r = e.saved.filter((t) => {
			let r = t.placementIdentity;
			return r && e.owns(r) && r.kind !== "page" && r.placementId === n.id;
		});
		if (n.item.kind === "view") {
			t.staticOverrides.set(n.id, r.length ? "open" : "closed");
			continue;
		}
		let i = n.item.binding, a = r.flatMap((e) => !e.resource || !e.placementIdentity || !q(i, e.resource) ? [] : [{
			instanceKey: i.cardinality === "one" ? yi : e.placementIdentity.instanceKey,
			resource: e.resource,
			section: e.section,
			position: e.position,
			pageContext: e.pageContext,
			title: e.title,
			...e.tabRetention === "preview" && e.relatedSource ? { relatedSource: e.relatedSource } : {},
			...i.cardinality === "many" ? { open: e.tabRetention === "preview" ? "preview" : "pin" } : {}
		}]);
		t.resourceInstances.set(n.id, i.cardinality === "one" ? a.slice(-1) : a);
	}
	return t;
}, Ii = (e) => JSON.stringify([
	e.page.extensionId,
	e.page.id,
	e.id
]), Li = (e, t) => e.listPlacements().find((e) => e.replaces?.some((e) => Ii(e) === Ii(t))), Ri = (e) => JSON.stringify([e.extensionId, e.id]), zi = (e) => {
	let { placement: t, placements: n, refs: r, views: i } = e;
	if (n.has(t.id)) throw Error(`Mode placement already registered: ${t.id}`);
	if (t.ref.kind !== "placement" || !t.ref.extensionId || !t.ref.id) throw Error(`Mode placement "${t.id}" must declare a normalized placement ref`);
	let a = Ri(t.ref), o = new Set([...n.values()].flatMap((e) => (e.replaces ?? []).map(Ii)));
	for (let e of t.replaces ?? []) {
		if (!e.page.extensionId || e.page.extensionId !== t.ref.extensionId) throw Error("A placement can replace only its own extension's page slots");
		let n = Ii(e);
		if (o.has(n)) throw Error(`Page slot already replaced: ${n}`);
		o.add(n);
	}
	if (r.has(a)) throw Error(`Mode placement ref already registered: ${a}`);
	if (t.movableTo && !t.movableTo.includes(t.region)) throw Error(`Mode placement "${t.id}" must include its initial region in movableTo`);
	if (Ci("Mode placement", t.id, t.item), !i.getView(J(t.item))) throw Error(`Workbench mode placement view is not registered: ${J(t.item)}`);
	return a;
}, Bi = (e) => ({
	...e,
	ref: { ...e.ref },
	...e.replaces ? { replaces: e.replaces.map((e) => ({
		...e,
		page: { ...e.page }
	})) } : {},
	item: bi(e.item, e.region),
	...e.addableIn ? { addableIn: [...e.addableIn] } : {},
	...e.movableTo ? { movableTo: [...e.movableTo] } : {}
}), Vi = (e, t) => ({
	kind: "mode",
	modeId: e.modeId,
	placementId: e.id,
	instanceKey: t
}), Hi = (e) => e === "pin" ? {
	pinned: !0,
	tabRetention: "persistent"
} : e === "preview" ? {
	pinned: !1,
	tabRetention: "preview"
} : {}, Ui = (e) => {
	let n = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), o = Y(), s = /* @__PURE__ */ new Set(), c = "Mode placement", l = (e) => [...n.values()].filter((t) => !e || t.modeId === e).sort((e, t) => e.id.localeCompare(t.id)), u, d = (e) => {
		u?.(e);
		for (let e of s) t(e, () => a("mode placement subscriber", e));
	}, f = (t, n, r, i, a, o, s) => {
		if (!e.views.getView(J(t.item))) throw Error(`Workbench mode placement view is not registered: ${J(t.item)}`);
		let c = un(t.id), l = e.getPanel(c);
		if (!l) throw Error(`Workbench mode placement is not registered: ${t.id}`);
		return {
			identity: Vi(t, n),
			region: t.region,
			order: t.order ?? 0,
			value: {
				...Se(`workbench.mode.${encodeURIComponent(t.id)}.${encodeURIComponent(n)}`, l, {
					viewId: J(t.item),
					role: t.region === "main" ? "location" : "sub-panel",
					closable: xi(t.item),
					...r ? { resource: r } : {},
					...a ? { title: a } : {},
					...Hi(i)
				}),
				...o ? { relatedSource: o } : {},
				section: s?.section,
				position: s?.position,
				pageContext: s?.pageContext
			}
		};
	}, p = {
		connectRuntime(e) {
			return u = e, r(() => {
				u === e && (u = void 0);
			});
		},
		getState: () => o,
		restore(t, n = o) {
			e.getProjectId && t.projectId !== e.getProjectId() && (n = Y());
			let r = e.loadLayout?.(t);
			if (!r) return n;
			let i = l(t.modeId).filter((e) => e.item.kind === "view" ? !n.staticOverrides.has(e.id) : !n.resourceInstances.has(e.id));
			return i.length ? Fi({
				state: n,
				declarations: i,
				saved: Object.values(r.regions).flatMap((e) => e.widgets),
				owns: (e) => e.kind === "mode" && e.modeId === t.modeId
			}) : n;
		},
		adopt(e, t, n = o) {
			return Fi({
				state: n,
				declarations: l(e),
				saved: t,
				owns: (t) => t.kind === "mode" && t.modeId === e
			});
		},
		open(t, r = o) {
			let i = n.get(t.placementId);
			if (!i) throw Error(`Unknown mode placement: ${t.placementId}`);
			return Pi({
				label: c,
				target: t,
				item: i.item,
				current: r,
				keyOfResource: e.resourceReferenceKey,
				identityFor: (e) => Vi(i, e)
			});
		},
		apply: (e) => {
			o = e;
		},
		publish: d,
		resolve(e, t = o) {
			return e ? l(e).flatMap((e) => e.item.kind === "view" ? Si(e.item, t, e.id) ? [f(e, "default")] : [] : (t.resourceInstances.get(e.id) ?? []).map((t) => f(e, t.instanceKey, t.resource, t.open, t.title, t.relatedSource, t))) : [];
		}
	}, m = {
		registerPlacement(t) {
			let a = zi({
				placement: t,
				placements: n,
				refs: i,
				views: e.views
			}), s = Bi(t), c = ln(e.registerPanel, e.views, {
				...s,
				id: un(s.id),
				viewId: J(s.item),
				role: s.region === "main" ? "location" : "sub-panel",
				singleton: s.item.kind === "view" || s.item.binding.cardinality === "one",
				closable: xi(s.item)
			}, e.viewMenus);
			return n.set(s.id, s), i.set(a, s), s.item.kind === "binding" && (o = p.restore({
				modeId: s.modeId,
				projectId: e.getProjectId?.()
			})), d(), r(() => {
				n.get(s.id) === s && (n.delete(s.id), i.delete(a), ji(o, s.id), c.dispose(), d());
			});
		},
		getPlacement(e) {
			return i.get(Ri(e));
		},
		listPlacements: l,
		openPlacement(t) {
			let n = i.get(Ri(t.panel));
			if (!n) throw Error(`Unknown mode panel: ${t.panel.extensionId}.${t.panel.id}`);
			let r = p.open({
				...t,
				placementId: n.id
			});
			return e.validateOpen?.(r.identity, t.region ?? n.region, {
				reveal: !t.relatedSource,
				resource: t.resource,
				requestedRegion: t.region
			}), p.apply(r.state), p.publish(t.region ? {
				identity: r.identity,
				region: t.region
			} : void 0), r.identity;
		},
		closePlacement(e) {
			if (e.kind !== "mode") throw Error("Mode placement registry closes only mode-owned placements");
			let t = n.get(e.placementId);
			t && ki({
				label: c,
				id: t.id,
				item: t.item,
				state: o,
				instanceKey: e.instanceKey
			}) && d();
		},
		updatePlacement(t, r) {
			if (t.kind !== "mode") throw Error("Mode placement registry updates only mode-owned placements");
			let i = n.get(t.placementId);
			i && (Ai({
				label: c,
				id: i.id,
				item: i.item,
				state: o,
				instanceKey: t.instanceKey,
				keyOfResource: e.resourceReferenceKey,
				...r
			}), d());
		},
		resolvePlacements: (e, t) => p.resolve(e, t ? p.restore(t) : o),
		onDidChange(e) {
			return s.add(e), r(() => s.delete(e));
		}
	};
	return Ni(m, p), m;
}, Wi = (e, t) => t.priority - e.priority || e.id.localeCompare(t.id), Gi = (e, t) => {
	if (e?.projectId !== void 0 && t && e.projectId !== t()) throw Error("The calling view belongs to another project");
	return e?.isViewerCurrent?.() !== !1;
}, Ki = () => {
	throw Error("navigation.openTarget: no dispatcher available (configure resolveDispatcher)");
}, qi = async (e, t, n) => {
	if (e.kind === "page") {
		if (!t.openPageTarget) throw Error("navigation.openTarget: page target dispatcher is not configured");
		return t.openPageTarget(e);
	}
	if (e.kind === "panel") {
		if (!t.openPanelTarget) throw Error("navigation.openTarget: panel target dispatcher is not configured");
		return t.openPanelTarget(e);
	}
	if (e.kind === "viewer") {
		if (!t.openViewerTarget) throw Error("Viewer navigation is not configured");
		return t.openViewerTarget(e, n);
	}
	if (e.kind === "href") {
		if (!t.openHref) throw Error(`Cannot open navigation href target: ${e.href}`);
		return t.openHref(e.href);
	}
	return t.executeCommand(e.commandId, e.args, e.region, n);
}, Ji = (e, t) => {
	if (e.kind === "href" && !m(e)) throw Error("Navigation requires an HTTP or HTTPS URL.");
	if (e.kind === "panel" && t.canOpenPanel?.(e) === !1) throw Error(`Cannot open navigation panel target: ${e.panel.id}`);
	if (e.kind === "command" && t.canExecuteCommand?.(e.commandId) === !1) throw Error(`Cannot open navigation command target: ${e.commandId}`);
}, Yi = (e) => e.kind === "compound" ? e.targets : [e], Xi = (e = {}) => {
	let t = e.resolveDispatcher ?? Ki, i = /* @__PURE__ */ new Set(), o = n({
		name: "workbench.navigation",
		initialState: { parsers: {} }
	}), c = (e, t) => {
		let { [t]: n, ...r } = e;
		return r;
	}, l = {
		store: o,
		registerParser(e, t) {
			let n = o.getState();
			if (n.parsers[e.id]) throw Error(`Navigation parser already registered: ${e.id}`);
			let { priority: i, ...a } = e, l = {
				...a,
				...s({
					...t,
					priority: t?.priority ?? i
				})
			};
			return o.setState({
				...n,
				parsers: {
					...n.parsers,
					[e.id]: l
				}
			}, !1, "registerParser"), r(() => {
				let t = o.getState();
				t.parsers[e.id] === l && o.setState({
					...t,
					parsers: c(t.parsers, e.id)
				}, !1, "unregisterParser");
			});
		},
		listParsers() {
			return Object.values(o.getState().parsers).sort(Wi);
		},
		resolveLocation(e) {
			let t = this.listParsers().find((t) => t.canParse(e));
			if (!t) throw Error(`No navigation parser registered for location: ${e}`);
			return t.parse(e);
		},
		async openTarget(n, r) {
			if (!Gi(r, e.getProjectId)) return [];
			let o = t(), s = Yi(n), c = [];
			for (let e of s) Ji(e, o);
			if (n.kind === "compound") {
				if (n.targets.some((e) => e.kind !== "page" && e.kind !== "panel")) throw Error("Compound navigation accepts only page and panel targets");
				if (!o.prepareNavigation) throw Error("navigation.openTarget: navigation preparation is not configured");
				let e = [o.prepareNavigation(n.targets).commit()];
				for (let e of i) a("navigation observer", () => e(n));
				return e;
			}
			for (let e of s) c.push(await qi(e, o, r));
			for (let e of i) a("navigation observer", () => e(n));
			return c;
		},
		async openPage(e) {
			return l.openTarget({
				...e,
				kind: "page"
			});
		},
		async openPanel(e) {
			return l.openTarget({
				...e,
				kind: "panel"
			});
		},
		async navigate(e) {
			return l.openTarget(l.resolveLocation(e));
		},
		onDidOpenTarget(e) {
			return i.add(e), r(() => i.delete(e));
		}
	};
	return l;
}, Zi = /* @__PURE__ */ new WeakMap(), Qi = (e, t) => {
	Zi.set(e, t);
}, $i = (e, t) => {
	let n = Zi.get(e);
	return t && n?.registryToken !== t ? void 0 : n;
}, ea = (e) => JSON.stringify([e.projectId, h(e.resource)]), ta = () => {
	let e = /* @__PURE__ */ new Map(), t = (t, n) => {
		let r = e.get(t);
		return r?.scope === ea(n) ? r.sections : void 0;
	};
	return {
		get: t,
		begin(n, r) {
			let i = {
				scope: ea(r),
				sections: t(n, r)
			};
			return e.set(n, i), {
				sections: i.sections,
				complete(t) {
					e.get(n) === i && (i.sections = t);
				}
			};
		},
		delete: (t) => e.delete(t)
	};
}, na = "navigation.root", ra = (e = "content") => e === "content" ? na : `navigation.${e}`, ia = (e) => `${e.kind}:${e.extensionId}:${e.id}`, aa = (e, t) => ia(e) === ia(t), oa = (e) => (t, n) => {
	let r = t.sourceExtensionId === e.extensionId;
	if (r !== (n.sourceExtensionId === e.extensionId)) return r ? -1 : 1;
	if (!r) {
		let e = t.sourceExtensionId.localeCompare(n.sourceExtensionId);
		if (e !== 0) return e;
	}
	return t.declarationIndex - n.declarationIndex || t.id.localeCompare(n.id);
}, sa = (e, t) => e ? `${e}:${t}` : t, ca = (e, t) => ({
	...t,
	resource: e.resolveResource ? e.resolveResource(t.resource) : t.resource
}), la = (e, t) => {
	let n = e.findIndex((e) => e.id === t.id);
	if (n < 0) {
		e.push(t);
		return;
	}
	let r = e[n];
	e[n] = {
		...r,
		nodes: [...r.nodes, ...t.nodes]
	};
}, ua = (e = {}) => {
	let t = /* @__PURE__ */ new Map(), n = {}, i = ta(), a = /* @__PURE__ */ new Set(), o = () => {
		for (let e of a) e();
	}, s = (e, n) => [...t.values()].filter((t) => aa(t.owner, e) && (t.slot ?? "content") === n).sort(oa(e)), c = (e, t, r, i) => {
		let a = {
			...e,
			id: sa(t.idScope, e.id),
			moveScope: r,
			canHide: e.canHide ?? t.owner.kind === "mode",
			canReorder: e.canReorder ?? t.owner.kind === "mode",
			children: e.children?.map((e) => c(e, t, r, i))
		};
		return Qi(a, {
			contribution: t,
			node: e,
			resource: i,
			registryToken: n
		}), a;
	}, l = (e, t, n, r) => ({
		...e,
		id: t.sourceExtensionId !== n.extensionId && !e.label ? ra(t.slot) : sa(t.idScope, e.id),
		moveScope: ia(n),
		canHide: e.canHide ?? !0,
		canReorder: e.canReorder ?? !0,
		nodes: e.nodes.map((e) => c(e, t, ia(n), r))
	}), u = (t, n, r) => {
		let a = ca(t, r);
		return (i.get(t.id, a) ?? (t.viewId ? e.getViewStructure?.(t.viewId, a) : t.getStructure?.(a)) ?? []).map((e) => l(e, t, n, a.resource));
	}, d = (e) => {
		let t = [];
		for (let n of e.flat()) la(t, n);
		return t;
	};
	return {
		registerContribution(n) {
			if (t.has(n.id)) throw Error(`Navigation tree contribution already registered: ${n.id}`);
			if (!n.viewId && !n.getSections) throw Error(`Navigation tree contribution must declare a viewId or getSections: ${n.id}`);
			t.set(n.id, n);
			let a = n.viewId ? e.subscribeViewRefresh?.(n.viewId, o) : void 0;
			return o(), r(() => {
				t.get(n.id) === n && (a?.dispose(), t.delete(n.id), i.delete(n.id), o());
			});
		},
		resolveOwner(e, n, r) {
			return [...t.values()].find((t) => t.owner.kind === e && t.owner.id === n && (!r || (t.slot ?? "content") === r))?.owner;
		},
		getReadKey(e, t = {}) {
			return JSON.stringify([
				"header",
				"content",
				"footer"
			].flatMap((n) => s(e, n).map((e) => [e.id, h(ca(e, t).resource)])));
		},
		getStructure(e, t = "content", n = {}) {
			return d(s(e, t).map((t) => u(t, e, n)));
		},
		async getSections(t, n = "content", r = {}) {
			let a = s(t, n), o = a.map((e) => u(e, t, r)), c = a.map((e) => i.begin(e.id, ca(e, r))), f = () => d(o);
			return await Sn(a.map((n, i) => async (a) => {
				let s = ca(n, {
					...r,
					signal: a
				}), u = (e, u = !1) => {
					a.throwIfAborted(), (u || c[i].sections === void 0) && (u && c[i].complete(e), o[i] = e.map((e) => l(e, n, t, s.resource)), r.onProgress?.(f()));
				}, d = {
					...s,
					onProgress: u
				};
				u((n.viewId ? await e.getViewSections?.(n.viewId, d) : await n.getSections?.(d)) ?? [], !0);
			}), r.signal), f();
		},
		async getChildren(t, r = {}) {
			r.signal?.throwIfAborted();
			let i = $i(t, n);
			if (!i) return t.children ?? [];
			let a = t.moveScope ?? ia(i.contribution.owner), o = {
				...r,
				resource: i.resource
			}, s = i.contribution.viewId ? await e.getViewChildren?.(i.contribution.viewId, i.node, o) : await i.contribution.getChildren?.(i.node, o);
			return s ? s.map((e) => c(e, i.contribution, a, i.resource)) : t.children ?? [];
		},
		async moveNode(t, r, i = {}) {
			let a = $i(t, n), o = r ? $i(r, n) : void 0;
			a?.contribution.viewId && a.node.canDrag && (!r || o && a.contribution === o.contribution && o.node.canDrop) && await e.moveViewNode?.(a.contribution.viewId, a.node, o?.node, {
				...i,
				resource: a.resource
			});
		},
		getDefaultExpandedSectionIds(t, n) {
			return (n ? [n] : [
				"header",
				"content",
				"footer"
			]).flatMap((n) => s(t, n).flatMap((t) => (t.defaultExpandedSectionIds ?? (t.viewId ? e.getViewDefaultExpandedSectionIds?.(t.viewId) : void 0) ?? []).map((e) => sa(t.idScope, e))));
		},
		onDidChange(e) {
			return a.add(e), r(() => a.delete(e));
		},
		listActions() {
			return [...t.values()].flatMap((e) => (e.listActions?.() ?? []).map((t) => ({
				...t,
				ownerId: e.sourceExtensionId
			})));
		}
	};
}, da = (e = () => "region:main") => {
	let t = n({
		name: "workbench.notifications",
		initialState: { notifications: {} }
	}), i = /* @__PURE__ */ new Set(), a = 0, o = (e) => {
		for (let t of i) t(e);
	};
	return {
		store: t,
		captureActionError(t, n = e()) {
			let r = `workbench.action-error.${n}`;
			return this.dismiss(r), (e) => {
				this.show({
					id: r,
					level: "error",
					title: `${t} failed`,
					message: e instanceof Error ? e.message : String(e),
					inlineTarget: n
				});
			};
		},
		show(e, n) {
			let r = e.id;
			r ||= (a += 1, `workbench.notification.${a.toString()}`);
			let i = {
				...s(n),
				...e,
				id: r,
				createdAt: e.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
			}, c = t.getState();
			return t.setState({ notifications: {
				...c.notifications,
				[r]: i
			} }, !1, "showNotification"), o({
				type: "show",
				id: r,
				notification: i
			}), i;
		},
		dismiss(e) {
			let n = t.getState();
			if (!n.notifications[e]) return !1;
			let { [e]: r, ...i } = n.notifications;
			return t.setState({ notifications: i }, !1, "dismissNotification"), o({
				type: "dismiss",
				id: e
			}), !0;
		},
		clear() {
			let e = Object.keys(t.getState().notifications);
			t.setState({ notifications: {} }, !1, "clearNotifications");
			for (let t of e) o({
				type: "dismiss",
				id: t
			});
		},
		listNotifications() {
			return Object.values(t.getState().notifications).sort((e, t) => t.createdAt.localeCompare(e.createdAt));
		},
		subscribe(e) {
			return i.add(e), r(() => {
				i.delete(e);
			});
		}
	};
}, fa = (e) => `workbench.overlay.${encodeURIComponent(e)}`, pa = (e) => {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map();
	return {
		registerOverlay(r) {
			if (t.has(r.id)) throw Error(`Overlay already registered: ${r.id}`);
			let i = { ...r }, a = ln(e.layout, e.views, {
				...i,
				id: fa(i.id),
				region: "overlay",
				role: "content",
				singleton: !0,
				closable: i.closable ?? !0
			}, e.viewMenus);
			return t.set(i.id, i), n.set(i.id, a), { dispose() {
				t.get(i.id) === i && (t.delete(i.id), n.delete(i.id), a.dispose());
			} };
		},
		getOverlay: (e) => t.get(e),
		listOverlays: () => [...t.values()].sort((e, t) => e.id.localeCompare(t.id)),
		openOverlay(n, r = {}) {
			if (!t.has(n)) throw Error(`Unknown overlay: ${n}`);
			return e.layout.openPanel(fa(n), {
				viewId: t.get(n)?.viewId,
				resource: r.resource,
				title: r.title,
				closable: t.get(n)?.closable ?? !0,
				strategy: { kind: "persistent" }
			}).instanceId;
		},
		closeOverlay(t) {
			e.layout.removeWidgetPlacement(t);
		}
	};
}, ma = (e) => {
	let t = e.pages[e.activePageId ?? ""];
	return e.placements.find((e) => e.region === "main" && L(t, e.identity))?.value;
}, ha = (e) => {
	let t = ma(B(e).getPublishingState());
	return t ? [t] : [];
}, ga = (e) => ({
	openStaticSlotIds: R(e).filter((e) => e.item.kind === "view" && e.item.presence !== "closed").map((e) => e.id),
	resourceInstances: {}
}), _a = (e, t) => e.item.kind === "view" && t.openStaticSlotIds.includes(e.id), va = (e, t, n) => {
	if (e.item.kind !== "binding" || e.item.binding.cardinality !== "many") return [n];
	let r = t.find((e) => e.instanceKey === n.instanceKey)?.open === "pin" || n.open === "pin" ? "pin" : "preview";
	return [...t.filter((e) => e.instanceKey !== n.instanceKey), {
		...n,
		open: r
	}];
}, ya = (e) => {
	let { slot: t, state: n, target: r } = e;
	if (t.item.kind !== "binding") throw Error(`Page slot "${t.id}" does not accept a resource`);
	let i = t.item.binding;
	if (!r.resource) throw Error(`Page slot "${t.id}" requires a resource`);
	if (!q(i, r.resource)) throw Error(`Page slot "${t.id}" does not accept resource kind "${r.resource.type}"`);
	if (r.open && i.cardinality !== "many") throw Error(`Page slot "${t.id}" accepts open intent only with many cardinality`);
	let a = i.cardinality === "one" && t.role !== "primary" ? yi : e.resourceKey(r.resource), o = {
		instanceKey: a,
		resource: r.resource,
		pageContext: r.pageContext,
		...r.section ? { section: r.section } : {},
		...r.position ? { position: r.position } : {},
		...i.cardinality === "many" ? { open: r.open ?? "preview" } : {}
	};
	return {
		...n,
		resourceInstances: {
			...n.resourceInstances,
			[t.id]: va(t, n.resourceInstances[t.id] ?? [], o)
		},
		...t.role === "primary" ? { activePrimaryInstanceKey: a } : {}
	};
}, ba = (e) => {
	let { page: t, target: n } = e;
	if (t.resource) {
		if (!n.resource) {
			if (I(t) && t.main.empty) return {
				...e.state,
				resourceInstances: {
					...e.state.resourceInstances,
					[on]: []
				},
				activePrimaryInstanceKey: void 0
			};
			throw Error(`Page "${t.id}" requires a resource`);
		}
		if (!q(t.resource, n.resource)) throw Error(`Page "${t.id}" does not accept resource kind "${n.resource.type}"`);
	} else if (n.resource) throw Error(`Page "${t.id}" does not accept a resource`);
	let r = sn(t);
	if (!r) {
		if (n.open && !(t.resource && t.main.kind === "panels" && typeof t.main.landing == "object")) throw Error(`Panel collection page "${t.id}" does not accept an open intent`);
		return t.main.kind === "panels" && typeof t.main.landing == "string" ? Ca(e.state, t.main.landing, !0) : e.state;
	}
	if (n.resource) return ya({
		...e,
		slot: r
	});
	if (n.open) throw Error(`Page "${t.id}" accepts open intent only with a resource`);
	return {
		...Ca(e.state, r.id, !0),
		activePrimaryInstanceKey: "default"
	};
}, xa = (e, t) => e.slots.filter((e) => e.item.kind === "binding" && e.openOn === "page-resource" && t && q(e.item.binding, t)), Sa = (e) => e.target.resource ? xa(e.page, e.target.resource).reduce((t, n) => ya({
	slot: {
		...n,
		role: "auxiliary"
	},
	state: t,
	target: {
		pageId: e.page.id,
		resource: e.target.resource
	},
	resourceKey: e.resourceKey
}), e.state) : e.state, Ca = (e, t, n) => {
	let r = new Set(e.openStaticSlotIds);
	return n ? r.add(t) : r.delete(t), {
		...e,
		openStaticSlotIds: [...r]
	};
}, wa = (e, t, n) => ({
	...e,
	resourceInstances: {
		...e.resourceInstances,
		[t]: (e.resourceInstances[t] ?? []).filter((e) => e.instanceKey !== n)
	}
}), Ta = (e) => {
	let { slot: t, instanceKey: n } = e, r = t.item.kind === "view" ? Ca(e.state, t.id, !1) : wa(e.state, t.id, n);
	if (t.role === "auxiliary") return {
		kind: "stay",
		state: r
	};
	let i = r.resourceInstances[t.id] ?? [];
	if (i.length) {
		let e = r.activePrimaryInstanceKey, t = e && e !== n ? e : i.at(-1)?.instanceKey;
		return {
			kind: "stay",
			state: {
				...r,
				activePrimaryInstanceKey: t
			},
			activateInstanceKey: t
		};
	}
	return {
		kind: "stay",
		state: {
			...r,
			activePrimaryInstanceKey: void 0
		}
	};
}, Ea = (e) => {
	let { identity: t, page: n, state: r } = e;
	if (L(n, t)) throw Error("Page content closes through navigation");
	if (t.kind !== "page") throw Error("Page registry can close only page-owned placements");
	if (r.activePageId !== t.pageId) throw Error(`Page is not active: ${t.pageId}`);
	let i = cn(n, t.slotId);
	if (!r.placements.some((e) => U(e.identity) === U(t))) throw Error(`Page placement is not open: ${U(t)}`);
	let a = r.pageStates[e.stateKey] ?? ga(n), o = i.role === "primary" && a.activePrimaryInstanceKey === t.instanceKey, s = Ta({
		page: n,
		slot: i,
		state: a,
		instanceKey: t.instanceKey
	}), c = {
		...r.pageStates,
		[e.stateKey]: s.state
	};
	if (i.role === "auxiliary" || !s.activateInstanceKey) {
		if (!r.location) throw Error("Active page has no canonical location");
		return {
			kind: "stay",
			pageStates: c,
			target: {
				pageId: n.id,
				...r.location.resource ? { resource: r.location.resource } : {},
				...r.location.section ? { section: r.location.section } : {},
				position: r.location.position,
				pageContext: {
					page: r.location.page,
					parent: r.location.parent,
					params: r.location.params
				}
			},
			locationChanged: !1
		};
	}
	let l = s.state.activePrimaryInstanceKey, u = (s.state.resourceInstances[i.id] ?? []).find((e) => e.instanceKey === l);
	return {
		kind: "stay",
		pageStates: c,
		target: {
			pageId: n.id,
			...u?.resource ? { resource: u.resource } : {},
			...u?.section ? { section: u.section } : {},
			position: u?.position,
			pageContext: u?.pageContext,
			...u?.open ? { open: u.open } : {}
		},
		locationChanged: o
	};
}, Da = (e, t, n, r = "pin") => {
	if (t.kind !== "page" || e.activePageId !== t.pageId) throw Error("Only an active page placement can be pinned");
	let i = e.pages[t.pageId];
	if (L(i, t)) throw Error("Page content has no tab retention");
	let a = G(i, e.location, n), o = e.pageStates[a], s = o.resourceInstances[t.slotId] ?? [];
	if (!s.some((e) => e.instanceKey === t.instanceKey)) throw Error("Only an open resource placement can be pinned");
	return {
		...e,
		pageStates: {
			...e.pageStates,
			[a]: {
				...o,
				resourceInstances: {
					...o.resourceInstances,
					[t.slotId]: s.map((e) => e.instanceKey === t.instanceKey ? {
						...e,
						open: r
					} : e)
				}
			}
		}
	};
}, Oa = (e, t, n) => Object.fromEntries(Object.entries(e).map(([e, r]) => {
	if (e !== t.pageId && !e.startsWith(`${t.pageId}|`)) return [e, r];
	let i = (r.resourceInstances[t.slotId] ?? []).flatMap((e) => e.instanceKey === t.instanceKey ? n.kind === "close" ? [] : n.kind === "reference" ? [{
		...e,
		resource: n.resource,
		section: n.section,
		position: n.position,
		pageContext: n.pageContext ?? e.pageContext
	}] : [{
		...e,
		open: n.open
	}] : [e]);
	return [e, {
		...r,
		openStaticSlotIds: n.kind === "close" && Ir(e, t.pageId, t.instanceKey) ? r.openStaticSlotIds.filter((e) => e !== t.slotId) : r.openStaticSlotIds,
		resourceInstances: {
			...r.resourceInstances,
			[t.slotId]: i
		},
		activePrimaryInstanceKey: n.kind === "close" && r.activePrimaryInstanceKey === t.instanceKey ? i.at(-1)?.instanceKey : r.activePrimaryInstanceKey
	}];
})), ka = (e, t, n, r) => {
	if (t.kind !== "page") throw Error("Page registry updates only page-owned placements");
	let i = e.pages[t.pageId], a = i && R(i).find((e) => e.id === t.slotId);
	if (a?.item.kind !== "binding" || !q(a.item.binding, n.resource)) throw Error("Page viewer does not accept this resource kind");
	let o = U(t), s = a.item.binding, c = Object.entries(e.pageStates).filter(([e]) => e === t.pageId || e.startsWith(`${t.pageId}|`)).flatMap(([, e]) => e.resourceInstances[t.slotId] ?? []).find((e) => e.instanceKey === t.instanceKey), l = e.placements.map((e) => U(e.identity) === o ? {
		...e,
		value: r.resolvePagePlacement({
			identity: t,
			pageId: i.id,
			slotId: a.id,
			role: a.role,
			viewId: u(s.view),
			...n,
			pageContext: n.pageContext ?? c?.pageContext,
			open: c?.open,
			closable: !L(i, t)
		})
	} : e);
	return {
		...e,
		pageStates: Oa(e.pageStates, t, {
			kind: "reference",
			...n
		}),
		placements: l,
		reconciliation: W({
			current: e.placements,
			desired: l,
			valuesEqual: r.valuesEqual
		})
	};
}, Aa = (e, t, n) => ({
	kind: "page",
	pageId: e,
	slotId: t,
	instanceKey: n
}), ja = (e, t, n) => t ? xa(e, t).filter((e) => e.region !== "main").filter((e, t, n) => n.findIndex((t) => t.region === e.region) === t).map((r) => Aa(e.id, r.id, r.item.kind === "binding" && r.item.binding.cardinality === "one" ? yi : n(t))) : [], Ma = (e) => {
	let t = /* @__PURE__ */ new Set();
	for (let n of e.slots) {
		if (I(e) && n.region === "main") throw Error(`Page "${e.id}" has one Main view and cannot declare Main tab slots`);
		if (n.id === "$main" || t.has(n.id)) throw Error(`Page "${e.id}" declares duplicate or reserved slot "${n.id}"`);
		if (t.add(n.id), n.movableTo && !n.movableTo.includes(n.region)) throw Error(`Page slot "${n.id}" must include its initial region in movableTo`);
		if (n.item.kind === "binding" && n.item.binding.kinds.length === 0) throw Error(`Page slot "${n.id}" must bind at least one resource kind`);
		if (n.openOn && n.item.kind !== "binding") throw Error(`Page slot "${n.id}" requires a binding for openOn`);
	}
	let n = e.main;
	if (n.kind === "panels" && n.landing && typeof n.landing == "string" && !e.slots.some((e) => e.id === n.landing && e.region === "main" && e.item.kind === "view")) throw Error(`Page "${e.id}" must declare a static Main landing slot`);
}, Na = (e) => {
	if (e.ref.kind !== "page" || !e.ref.extensionId || !e.ref.id) throw Error(`Page "${e.id}" must declare a normalized page ref`);
	if (e.path.startsWith("/") || e.path.endsWith("/")) throw Error(`Page "${e.id}" must declare a normalized path`);
	if (!e.main || ![
		"view",
		"panels",
		"group"
	].includes(e.main.kind)) throw Error(`Page "${e.id}" must declare Main content or a panel collection`);
	if (e.main.kind === "group" && (e.resource || e.document || e.slots.length || e.panelView)) throw Error(`Page group "${e.id}" cannot declare content, resources, or panels`);
	if (e.document && (!e.resource || !e.document.metadataKey.trim())) throw Error(`Page "${e.id}" requires a document metadata key and routed resource`);
	if (e.resource && e.resource.kinds.length === 0) throw Error(`Page "${e.id}" must accept at least one resource kind`);
	if (e.main.kind === "view" && e.main.cardinality === "many" && !e.resource) throw Error(`Page "${e.id}" requires a resource for many cardinality`);
	if (e.main.kind === "view" && e.resource && !e.parentId) throw Error(`Resource page "${e.id}" must declare a parent`);
	Ma(e);
}, Pa = (e) => {
	let t = e.slot.item, n = t.kind === "view" ? t.view : t.binding.view, r = Aa(e.page.id, e.slot.id, e.instanceKey);
	return {
		identity: r,
		region: e.slot.region,
		order: e.slot.order ?? 0,
		value: e.resolvePagePlacement({
			identity: r,
			pageId: e.page.id,
			slotId: e.slot.id,
			role: e.slot.role,
			viewId: u(n),
			...e.resource ? { resource: e.resource } : {},
			...e.section ? { section: e.section } : {},
			...e.position ? { position: e.position } : {},
			pageContext: e.pageContext,
			...e.open ? { open: e.open } : {},
			closable: !L(e.page, r)
		})
	};
}, Fa = (e) => {
	let t = [];
	for (let n of R(e.page)) {
		if (n.isAvailable && !n.isAvailable(e.resource)) continue;
		_a(n, e.state) && t.push(Pa({
			...e,
			slot: n,
			instanceKey: e.staticInstanceKey
		}));
		let r = e.state.resourceInstances[n.id] ?? [], i = n.role === "primary" && I(e.page) ? r.filter((t) => t.instanceKey === e.state.activePrimaryInstanceKey).slice(-1) : r;
		for (let r of i) t.push(Pa({
			...e,
			slot: n,
			...r
		}));
	}
	return t;
}, Ia = () => ({
	add: [],
	retain: [],
	update: [],
	activate: [],
	remove: []
}), La = (e) => n({
	name: "workbench.pages",
	initialState: {
		pages: {},
		pageStates: {},
		placements: kr({ shell: e.resolveShellPlacements() }).placements,
		reconciliation: Ia()
	}
}), Ra = (e) => {
	if (e.modeId) return e.desired ? e.desired : e.resolveModePlacements(e.modeId, e.location, e.projectId, e.pageId);
}, za = (e) => {
	let t = e.state.activeModeId;
	t && e.commit({
		pageStates: e.state.pageStates,
		projectId: e.state.projectId,
		location: e.state.location,
		activePageId: e.state.activePageId,
		activeModeId: t,
		modePlacements: e.registryInput.resolveModePlacements(t),
		destinations: e.destination ? [e.destination] : void 0,
		action: "refreshModePlacements"
	});
}, Ba = (e) => {
	e.commit({
		pageStates: e.state.pageStates,
		projectId: e.state.projectId,
		location: e.state.location,
		activePageId: e.state.activePageId,
		activeModeId: e.state.activeModeId,
		destinations: e.destination ? [e.destination] : void 0,
		action: "refreshShellPlacements"
	});
}, Z = (e, t) => JSON.stringify([h(t), e?.document ? t?.metadata?.[e.document.metadataKey] ?? null : null]), Va = (e, t, n) => {
	let r = n.normalize(t);
	return e.document && e.resource && q(e.resource, r) ? Pr(e, r, n) : n.toUri(r);
}, Ha = (e, t, n, r, i) => {
	let a = sn(e), o = t.activePrimaryInstanceKey, s = e.main, c = s.kind === "panels" && !n.pageStates ? e.slots.find((e) => e.id === s.landing && (!e.isAvailable || e.isAvailable(n.resource))) : void 0, l = i ? ja(e, n.resource, (t) => Va(e, t, r)) : [];
	return [
		...a && o ? [Aa(e.id, a.id, o)] : [],
		...c ? [Aa(e.id, c.id, Fr(e, n.resource, r))] : [],
		...l
	];
}, Ua = (e) => {
	let t = e.resources.normalize, n = (e, t) => {
		let n = e.pages[t];
		if (!n) throw Error(`Unknown page: ${t}`);
		return n;
	}, r = (t, n, r) => {
		let i = n.activePageId ? t.pages[n.activePageId] : void 0, a = i ? n.pageStates[G(i, n.location, e.resources)] : void 0;
		n.activeModeId && e.validateMode?.(n.activeModeId);
		let o = r?.mode ?? Ra({
			current: t,
			modeId: n.activeModeId,
			desired: n.modePlacements,
			location: n.location,
			projectId: n.projectId,
			pageId: n.activePageId,
			resolveModePlacements: e.resolveModePlacements
		});
		if (n.activeModeId && o?.some((e) => e.identity.kind !== "mode" || e.identity.modeId !== n.activeModeId)) throw Error(`Mode placement owner does not match active mode: ${n.activeModeId}`);
		let s = r?.shell ?? e.resolveShellPlacements(n.activeModeId ? {
			modeId: n.activeModeId,
			pageId: n.activePageId,
			projectId: n.projectId,
			location: n.location
		} : void 0), c = kr({
			shell: s,
			mode: o,
			...i && a ? { page: Fa({
				page: i,
				state: a,
				staticInstanceKey: Fr(i, n.location?.resource, e.resources),
				resource: n.location?.resource,
				sharedPlacements: [...s, ...o ?? []],
				resolvePagePlacement: e.resolvePagePlacement
			}) } : {}
		}), l = W({
			current: t.placements,
			desired: c.placements,
			destinations: n.destinations,
			activate: n.activate,
			valuesEqual: e.valuesEqual
		});
		return {
			...t,
			pageStates: n.pageStates,
			projectId: n.projectId,
			location: n.location,
			activePageId: n.activePageId,
			activeModeId: n.activeModeId,
			placements: c.placements,
			reconciliation: l
		};
	}, i = (i, o, s) => {
		let c = i.pageStates ?? o.pageStates, l = n(o, i.pageId), u = (t) => Va(l, t, e.resources), d = {
			...i,
			pageContext: {
				page: i.location.page,
				parent: i.location.parent,
				params: i.location.params
			},
			...i.resource ? { resource: t(i.resource) } : {}
		}, f = G(l, i.location, e.resources), p = c[f] ?? e.restorePageState?.(l, i.location, i.projectId) ?? ga(l), m = i.pageStates ? p : ba({
			page: l,
			state: p,
			target: d,
			resourceKey: u
		}), h = !i.pageStates || o.activePageId !== l.id || Z(l, o.location?.resource) !== Z(l, d.resource) || m.activePrimaryInstanceKey !== void 0 && o.pageStates[f]?.activePrimaryInstanceKey !== m.activePrimaryInstanceKey, g = h ? Sa({
			page: l,
			state: m,
			target: d,
			resourceKey: u
		}) : m, _ = a(l, i, s), v = r(o, {
			pageStates: {
				...c,
				[f]: g
			},
			projectId: i.projectId,
			location: i.location,
			activePageId: l.id,
			activeModeId: l.modeId,
			activate: [
				..._ ? [_.identity] : [],
				...s?.landing ? [s.landing] : [],
				...Ha(l, g, d, e.resources, h)
			],
			action: i.action
		}, _ ? { mode: _.placements } : s), y = _?.identity ?? s?.landing;
		return y && e.validateLanding?.(v, y), v;
	}, a = (t, n, r) => {
		if (!(r || n.pageStates)) return e.resolveLanding?.(t, {
			projectId: n.projectId,
			location: n.location,
			open: n.open
		});
	};
	return {
		compose: r,
		location: i,
		restore: (t, a) => {
			let o = n(a, t.pageId), s = e.restorePageState?.(o, t.location, t.projectId);
			return s ? r(a, {
				...a,
				pageStates: {
					...a.pageStates,
					[G(o, t.location, e.resources)]: s
				},
				projectId: t.projectId,
				location: t.location,
				activePageId: o.id,
				activeModeId: o.modeId,
				activate: [],
				action: t.action
			}) : i(t, a);
		},
		selection: (t, r) => {
			let a = n(r, t.pageId), o = {
				modeId: a.modeId,
				pageId: a.id,
				projectId: t.projectId,
				location: t.location
			}, s = t.resource ? t : {
				...t,
				pageStates: r.pageStates
			};
			return i(s, r, {
				shell: e.resolveShellPlacements(o),
				mode: e.resolveModePlacements(a.modeId, t.location, t.projectId, a.id)
			});
		},
		slot: (i, a, o) => {
			if (a.activePageId !== i.pageId) throw Error(`Page is not active: ${i.pageId}`);
			let s = n(a, i.pageId), c = (t) => Va(s, t, e.resources), l = cn(s, i.slotId), u = G(s, a.location, e.resources), d = a.pageStates[u] ?? ga(s), f = Fr(s, a.location?.resource, e.resources), p = i.resource ? t(i.resource) : void 0;
			if (p) d = ya({
				slot: l,
				state: d,
				target: {
					...i,
					resource: p
				},
				resourceKey: c
			}), f = d.resourceInstances[l.id].at(-1).instanceKey;
			else {
				if (l.item.kind === "binding") throw Error(`Page slot "${l.id}" requires a resource`);
				if (i.open) throw Error(`Page slot "${l.id}" accepts open intent only with a resource`);
				d = Ca(d, l.id, !0);
			}
			return r(a, {
				...a,
				pageStates: {
					...a.pageStates,
					[u]: d
				},
				activate: [Aa(s.id, l.id, f)],
				destinations: i.region ? [{
					identity: Aa(s.id, l.id, f),
					region: i.region
				}] : void 0,
				action: "openPageSlot"
			}, o);
		}
	};
}, Wa = () => ({
	add: [],
	retain: [],
	update: [],
	activate: [],
	remove: []
}), Ga = (e) => {
	let { page: t, store: n } = e;
	Na(t);
	let i = n.getState();
	if (i.pages[t.id]) throw Error(`Page already registered: ${t.id}`);
	if (Object.values(i.pages).some((e) => e.ref.extensionId === t.ref.extensionId && e.ref.id === t.ref.id)) throw Error(`Page ref already registered: ${t.ref.extensionId}.${t.ref.id}`);
	if (Object.values(i.pages).some((e) => e.ref.extensionId === t.ref.extensionId && e.path === t.path)) throw Error(`Page route already registered: ${t.ref.extensionId}.${t.path}`);
	let a = {
		...t,
		ref: { ...t.ref },
		slots: t.slots.map((e) => ({ ...e }))
	}, o = e.registryInput.registerPagePlacements?.(a);
	return n.setState({
		...i,
		pages: {
			...i.pages,
			[t.id]: a
		},
		reconciliation: Wa()
	}, !1, "registerPage"), r(() => {
		let r = n.getState();
		if (r.pages[t.id] !== a) return;
		let { [t.id]: i, ...s } = r.pages, c = Lr(r.pageStates, t.id);
		if (r.activePageId === t.id) {
			let t = kr({ shell: e.registryInput.resolveShellPlacements() }).placements;
			e.publishState({
				...r,
				pages: s,
				pageStates: c,
				location: void 0,
				activePageId: void 0,
				activeModeId: void 0,
				placements: t,
				reconciliation: W({
					current: r.placements,
					desired: t,
					valuesEqual: e.registryInput.valuesEqual
				})
			}, "unregisterActivePage"), o?.dispose();
		} else n.setState({
			...r,
			pages: s,
			pageStates: c,
			reconciliation: Wa()
		}, !1, "unregisterPage"), o?.dispose();
	});
}, Ka = (e, t) => ({
	...e,
	...t,
	metadata: {
		...e.metadata,
		...t.metadata
	}
}), qa = (e, t, n) => e ? {
	...e,
	...e.resource && n(e.resource) === n(t) ? { resource: Ka(e.resource, t) } : {},
	...e.parent ? { parent: qa(e.parent, t, n) } : {}
} : void 0, Ja = (e, t, n) => Object.fromEntries(Object.entries(e).map(([e, r]) => [e, {
	...r,
	resourceInstances: Object.fromEntries(Object.entries(r.resourceInstances).map(([e, r]) => [e, r.map((e) => n(e.resource) === n(t) ? {
		...e,
		resource: Ka(e.resource, t)
	} : e)]))
}])), Ya = (t) => {
	let n = (e) => t.resources.normalize(e), i = (e) => t.resources.toUri(n(e)), a = La(t), o, s, c, l = (t, n, r = "navigate") => e(() => {
		t = s?.(t, r) ?? t;
		let e = a.getState(), i = c;
		c = t;
		try {
			let e = o?.(t, r);
			t = {
				...t,
				layoutActivation: e || void 0
			};
		} finally {
			c = i;
		}
		a.getState() === e && a.setState(t, !1, n);
	}), u = (e) => {
		let t = a.getState().pages[e];
		if (!t) throw Error(`Unknown page: ${e}`);
		return t;
	}, d = Ua(t), f = (e) => l(d.compose(c ?? a.getState(), e), e.action), p = (e) => l(d.location(e, a.getState()), e.action), m = {
		store: a,
		getContent() {
			return ma(a.getState());
		},
		registerPage(e) {
			return S(e.params), Ga({
				page: e,
				registryInput: t,
				store: a,
				publishState: l,
				normalizeResource: n,
				resourceKey: i
			});
		},
		getPage(e) {
			return a.getState().pages[e];
		},
		listPages() {
			return Object.values(a.getState().pages).sort((e, t) => e.id.localeCompare(t.id));
		},
		resourceReferenceKey(e) {
			let t = n(e), r = new Set(Object.values(a.getState().pages).flatMap((e) => e.document && e.resource && q(e.resource, t) ? [e.document.metadataKey] : []));
			return JSON.stringify([i(t), [...r].sort().map((e) => [e, t.metadata?.[e] ?? null])]);
		},
		refreshResource(e) {
			let t = a.getState();
			f({
				...t,
				location: qa(t.location, e, m.resourceReferenceKey),
				pageStates: Ja(t.pageStates, e, m.resourceReferenceKey),
				action: "refreshPageResource"
			});
		},
		refreshPlacement(e, n) {
			l(ka(a.getState(), e, n, t), "refreshPagePlacement");
		},
		pinPlacement(e, n) {
			f({
				...Da(a.getState(), e, t.resources, n),
				action: "pinPagePlacement"
			});
		},
		openSlot(e) {
			l(d.slot(e, a.getState()), "openPageSlot");
		}
	};
	return kn(m, {
		resources: t.resources,
		prepare: d,
		publish: l,
		onDidCommit: (e) => r(a.api.subscribe(e)),
		getPublishingState: () => c ?? a.getState(),
		connectRuntime(e, t) {
			if (o) throw Error("Workbench page registry already has a runtime");
			o = e, s = t;
			try {
				l(a.getState(), "connectPageRuntime");
			} catch (e) {
				throw o = void 0, s = void 0, e;
			}
			return r(() => {
				o === e && (o = void 0, s = void 0);
			});
		},
		refreshModePlacements(e) {
			za({
				state: c ?? a.getState(),
				registryInput: t,
				commit: f,
				destination: e
			});
		},
		refreshShellPlacements(e) {
			Ba({
				state: c ?? a.getState(),
				commit: f,
				destination: e
			});
		},
		activateLocation: p,
		clearProject(e) {
			let n = a.getState(), r = kr({ shell: t.resolveShellPlacements() }).placements, i = {};
			l({
				...n,
				pageStates: i,
				projectId: e,
				location: void 0,
				activePageId: void 0,
				activeModeId: void 0,
				placements: r,
				reconciliation: W({
					current: n.placements,
					desired: r,
					valuesEqual: t.valuesEqual
				})
			}, "clearPageProject");
		},
		resolveClosePlacement(e) {
			let n = a.getState();
			if (e.kind !== "page") throw Error("Page registry can close only page-owned placements");
			return Ea({
				identity: e,
				page: u(e.pageId),
				state: n,
				stateKey: G(u(e.pageId), n.location, t.resources),
				resourceKey: i
			});
		}
	}), m;
}, Xa = (e) => ({ registerPlaceholder(t, n) {
	let r = e.views.getView(t.viewId);
	if (!r) throw Error(`Workbench placeholder view is not registered: ${t.viewId}`);
	return e.layout.registerPlaceholder({
		...t,
		title: t.title ?? r.title,
		rendererId: r.id
	}, n);
} }), Za = (e, t, n) => {
	if (t.has(e.id)) throw Error(`Shell placement already registered: ${e.id}`);
	if (!n.getView(J(e.item))) throw Error(`Workbench shell placement view is not registered: ${J(e.item)}`);
	Ci("Shell placement", e.id, e.item);
}, Qa = (e) => `workbench.shell-placement.${encodeURIComponent(e)}`, $a = (e, t) => ({
	kind: "shell",
	placementId: e,
	instanceKey: t
}), eo = (e, t) => `workbench.shell.${encodeURIComponent(e)}.${encodeURIComponent(t)}`, to = (e) => e === "main" ? "location" : e === "secondary" || e === "side" ? "sub-panel" : "content", no = (e) => e === "pin" ? {
	pinned: !0,
	tabRetention: "persistent"
} : e === "preview" ? {
	pinned: !1,
	tabRetention: "preview"
} : {}, ro = (e) => {
	let n = /* @__PURE__ */ new Map(), i = Y(), o = /* @__PURE__ */ new Set(), s = "Shell placement", c, l = (e) => {
		c?.(e);
		for (let e of o) t(e, () => a("shell placement subscriber", e));
	}, u = (t) => {
		e.enteredWithPersistedLayout() ? i = Fi({
			state: i,
			declarations: [t],
			saved: Object.values(e.getLayout().regions).flatMap((e) => e.widgets),
			owns: (e) => e.kind === "shell"
		}) : ji(i, t.id);
	};
	e.onDidChangePersistenceScope(() => {
		if (!e.isChangingPage?.()) {
			for (let e of n.values()) u(e);
			t(n, l);
		}
	});
	let d = (t, n, r, i, a, o, s) => {
		let c = e.getPanel(Qa(t.id));
		if (!c) throw Error(`Workbench shell placement is not registered: ${t.id}`);
		return {
			identity: $a(t.id, n),
			region: t.region,
			order: t.order ?? 0,
			value: {
				...Se(eo(t.id, n), c, {
					viewId: J(t.item),
					role: to(t.region),
					closable: xi(t.item),
					...r ? { resource: r } : {},
					...a ? { title: a } : {},
					...no(i)
				}),
				...o ? { relatedSource: o } : {},
				section: s?.section,
				position: s?.position,
				pageContext: s?.pageContext
			}
		};
	}, f = {
		connectRuntime(e) {
			return c = e, r(() => {
				c === e && (c = void 0);
			});
		},
		getState: () => i,
		restore(t, r = i, a) {
			if (e.getContext) {
				let i = a ?? e.getContext();
				if (i?.modeId === t.modeId && i?.projectId === t.projectId) return r;
				let o = e.loadLayout?.(t);
				return o ? Fi({
					state: Y(),
					declarations: [...n.values()],
					saved: Object.values(o.regions).flatMap((e) => e.widgets),
					owns: (e) => e.kind === "shell"
				}) : Y();
			}
			if (!e.resolveScope) return r;
			let o = e.resolveScope(t);
			if (o === (a ? e.resolveScope(a) : e.getScope?.())) return r;
			if (o === e.getScope?.()) return i;
			let s = e.loadLayout?.(t);
			return s ? Fi({
				state: Y(),
				declarations: [...n.values()],
				saved: Object.values(s.regions).flatMap((e) => e.widgets),
				owns: (e) => e.kind === "shell"
			}) : Y();
		},
		adopt(e, t, r = i) {
			return Fi({
				state: r,
				declarations: [...n.values()],
				saved: t,
				owns: (e) => e.kind === "shell"
			});
		},
		open(t, r = i) {
			let a = n.get(t.placementId);
			if (!a) throw Error(`Unknown shell placement: ${t.placementId}`);
			return Pi({
				label: s,
				target: t,
				item: a.item,
				current: r,
				keyOfResource: e.resourceReferenceKey,
				identityFor: (e) => $a(a.id, e)
			});
		},
		apply: (e) => {
			i = e;
		},
		publish: l,
		resolve(e, t = i) {
			return [...n.values()].flatMap((e) => e.item.kind === "view" ? Si(e.item, t, e.id) ? [d(e, "default")] : [] : (t.resourceInstances.get(e.id) ?? []).map((t) => d(e, t.instanceKey, t.resource, t.open, t.title, t.relatedSource, t)));
		}
	}, p = {
		registerPlacement(t) {
			Za(t, n, e.views);
			let a = {
				...t,
				item: bi(t.item, t.region)
			}, o = ln(e.registerPanel, e.views, {
				...a,
				id: Qa(a.id),
				viewId: J(a.item),
				role: to(a.region),
				singleton: a.item.kind === "view" || a.item.binding.cardinality === "one",
				closable: xi(a.item)
			}, e.viewMenus);
			return n.set(a.id, a), e.enteredWithPersistedLayout() && u(a), l(), r(() => {
				n.get(a.id) === a && (n.delete(a.id), ji(i, a.id), o.dispose(), l());
			});
		},
		getPlacement: (e) => n.get(e),
		listPlacements: () => [...n.values()].sort((e, t) => e.id.localeCompare(t.id)),
		openPlacement(t) {
			let r = f.open(t);
			return e.validateOpen?.(r.identity, t.region ?? n.get(t.placementId).region, {
				reveal: !t.relatedSource,
				resource: t.resource,
				requestedRegion: t.region
			}), f.apply(r.state), f.publish(t.region ? {
				identity: r.identity,
				region: t.region
			} : void 0), t.activate !== !1 && e.activatePanel(eo(t.placementId, r.identity.instanceKey)), r.identity;
		},
		closePlacement(e) {
			if (e.kind !== "shell") throw Error("Shell placement registry closes only shell-owned placements");
			let t = n.get(e.placementId);
			t && ki({
				label: s,
				id: t.id,
				item: t.item,
				state: i,
				instanceKey: e.instanceKey
			}) && l();
		},
		updatePlacement(t, r) {
			if (t.kind !== "shell") throw Error("Shell placement registry updates only shell-owned placements");
			let a = n.get(t.placementId);
			a && (Ai({
				label: s,
				id: a.id,
				item: a.item,
				state: i,
				instanceKey: t.instanceKey,
				keyOfResource: e.resourceReferenceKey,
				...r
			}), l());
		},
		resolvePlacements: (e) => f.resolve(void 0, e ? f.restore(e) : i),
		onDidChange(e) {
			return o.add(e), r(() => o.delete(e));
		}
	};
	return Ni(p, f), p;
}, io = (e, t) => `${e}:${t.scope}:${t.scopeId ?? ""}`, ao = () => {
	let e = /* @__PURE__ */ new Map();
	return {
		getValue(t, n) {
			return e.get(io(t, n));
		},
		setValue(t, n, r) {
			e.set(io(t, r), n);
		}
	};
}, oo = (e = {}) => {
	let t = n({
		name: "workbench.preferences",
		initialState: { schemas: {} }
	}), i = /* @__PURE__ */ new Map(), o = e.persistence ?? ao(), s = /* @__PURE__ */ new Set(), c = (e, t) => {
		let n = () => {
			for (let t of s) a("preference change", () => t(e));
		};
		if (t instanceof Promise) return t.then(n);
		n();
	};
	return {
		store: t,
		onDidChangeValue(e) {
			return s.add(e), r(() => s.delete(e));
		},
		registerValueAdapter(e, t) {
			return i.set(e, t), r(() => {
				i.get(e) === t && i.delete(e);
			});
		},
		registerSchema(e, n) {
			let i = Object.keys(e.properties), a = t.getState();
			for (let e of i) if (Object.hasOwn(a.schemas, e)) throw Error(`Preference schema already registered: ${e}`);
			let o = Object.create(null);
			for (let t of i) {
				let r = e.properties[t];
				r && (o[t] = {
					...r,
					ownerId: n?.ownerId ?? "workbench.core",
					source: n?.source ?? "module"
				});
			}
			return t.setState({ schemas: {
				...a.schemas,
				...o
			} }, !1, "registerSchema"), r(() => {
				let e = { ...t.getState().schemas };
				for (let t of i) delete e[t];
				t.setState({ schemas: e }, !1, "unregisterSchema");
			});
		},
		getOwnedValue(e, t, n) {
			let r = JSON.stringify([e, t]);
			if (n?.scope !== "default") return (n ? o.getValue(r, n) : void 0) ?? o.getValue(r, { scope: "user" });
		},
		setOwnedValue(e, t, n, r) {
			if (r.scope === "default") throw Error("preference_scope_read_only");
			let i = JSON.stringify([e, t]);
			return c(i, o.setValue(i, n, r));
		},
		getSchema(e) {
			let n = t.getState().schemas;
			return Object.hasOwn(n, e) ? n[e] : void 0;
		},
		setValue(e, n, r) {
			if (!Object.hasOwn(t.getState().schemas, e)) throw Error(`Preference schema not registered: ${e}`);
			let a = i.get(e);
			return a ? c(e, a.set(n)) : c(e, o.setValue(e, n, r));
		},
		getValue(e, n) {
			let r = i.get(e);
			if (r) return r.get();
			if (n) {
				let t = o.getValue(e, n);
				if (t !== void 0) return t;
			}
			let a = o.getValue(e, { scope: "user" });
			if (a !== void 0) return a;
			let s = t.getState().schemas;
			return Object.hasOwn(s, e) ? s[e]?.default : void 0;
		}
	};
}, so = (e) => {
	let { rendererRegistry: t } = e, a = n({
		name: "workbench.controlsRenderers",
		initialState: { renderers: {} }
	}), o = /* @__PURE__ */ new Set(), c = () => null, l = (e) => {
		let t = a.getState().renderers[e];
		if (!t) throw Error(`Controls renderer not registered: ${e}`);
		return t;
	};
	return {
		controlsStore: a,
		setControlsRendererImplementation(e) {
			c = e;
		},
		registerControlsRenderer(e, n) {
			let i = a.getState();
			if (i.renderers[e.id]) throw Error(`Controls renderer already registered: ${e.id}`);
			let o = {
				...s(n),
				...e
			};
			a.setState({
				...i,
				renderers: {
					...i.renderers,
					[e.id]: o
				}
			}, !1, "registerControlsRenderer");
			let l = t.registerRenderer({
				id: e.id,
				render: (t) => c({
					...t,
					controlsRendererId: e.id
				})
			});
			return r(() => {
				l.dispose();
				let t = a.getState();
				if (t.renderers[e.id] !== o) return;
				let { [e.id]: n, ...r } = t.renderers;
				a.setState({ renderers: r }, !1, "unregisterControlsRenderer");
			});
		},
		getControlsRenderer(e) {
			return a.getState().renderers[e];
		},
		listControlsRenderers() {
			return Object.values(a.getState().renderers).sort(i);
		},
		refreshControlsRenderer(e) {
			l(e);
			let t = { controlsRendererId: e };
			for (let e of o) e(t);
		},
		onDidRefreshControlsRenderer(e) {
			return o.add(e), r(() => {
				o.delete(e);
			});
		}
	};
}, co = (e) => {
	let t = n({
		name: "workbench.dataTableRenderers",
		initialState: { renderers: {} }
	}), a = /* @__PURE__ */ new Set(), o = () => null;
	return {
		dataTableStore: t,
		setDataTableRendererImplementation(e) {
			o = e;
		},
		registerDataTableRenderer(n, i) {
			let a = t.getState();
			if (a.renderers[n.id]) throw Error(`Data table renderer already registered: ${n.id}`);
			let c = {
				...s(i),
				...n
			};
			t.setState({ renderers: {
				...a.renderers,
				[n.id]: c
			} }, !1, "registerDataTableRenderer");
			let l = e.rendererRegistry.registerRenderer({
				id: n.id,
				render: (e) => o({
					...e,
					dataTableRendererId: n.id
				})
			});
			return r(() => {
				l.dispose();
				let e = t.getState();
				if (e.renderers[n.id] !== c) return;
				let { [n.id]: r, ...i } = e.renderers;
				t.setState({ renderers: i }, !1, "unregisterDataTableRenderer");
			});
		},
		getDataTableRenderer(e) {
			return t.getState().renderers[e];
		},
		listDataTableRenderers() {
			return Object.values(t.getState().renderers).sort(i);
		},
		refreshDataTableRenderer(e) {
			if (!t.getState().renderers[e]) throw Error(`Data table renderer not registered: ${e}`);
			let n = { dataTableRendererId: e };
			for (let e of a) e(n);
		},
		onDidRefreshDataTableRenderer(e) {
			return a.add(e), r(() => a.delete(e));
		}
	};
}, lo = (e) => {
	let { rendererRegistry: t } = e, a = n({
		name: "workbench.fileRenderers",
		initialState: { renderers: {} }
	}), o = /* @__PURE__ */ new Set(), c = () => null, l = (e) => {
		let t = a.getState().renderers[e];
		if (!t) throw Error(`File renderer not registered: ${e}`);
		return t;
	};
	return {
		fileRendererStore: a,
		setFileRendererImplementation(e) {
			c = e;
		},
		registerFileRenderer(e, n) {
			let i = a.getState();
			if (i.renderers[e.id]) throw Error(`File renderer already registered: ${e.id}`);
			let o = {
				...s(n),
				...e
			};
			a.setState({
				...i,
				renderers: {
					...i.renderers,
					[e.id]: o
				}
			}, !1, "registerFileRenderer");
			let l = t.registerRenderer({
				id: e.id,
				render: (t) => c({
					...t,
					fileRendererId: e.id
				})
			});
			return r(() => {
				l.dispose();
				let t = a.getState();
				if (t.renderers[e.id] !== o) return;
				let { [e.id]: n, ...r } = t.renderers;
				a.setState({ renderers: r }, !1, "unregisterFileRenderer");
			});
		},
		getFileRenderer(e) {
			return a.getState().renderers[e];
		},
		listFileRenderers() {
			return Object.values(a.getState().renderers).sort(i);
		},
		refreshFileRenderer(e, t = {}) {
			l(e);
			let n = {
				fileRendererId: e,
				...t
			};
			for (let e of o) e(n);
		},
		onDidRefreshFileRenderer(e) {
			return o.add(e), r(() => {
				o.delete(e);
			});
		}
	};
}, uo = (e) => {
	let { rendererRegistry: t } = e, a = n({
		name: "workbench.kanbanRenderers",
		initialState: { renderers: {} }
	}), o = /* @__PURE__ */ new Set(), c = () => null, l = (e) => {
		let t = a.getState().renderers[e];
		if (!t) throw Error(`Kanban renderer not registered: ${e}`);
		return t;
	};
	return {
		dataStore: a,
		setKanbanRendererImplementation(e) {
			c = e;
		},
		registerKanbanRenderer(e, n) {
			let i = a.getState();
			if (i.renderers[e.id]) throw Error(`Kanban renderer already registered: ${e.id}`);
			let o = {
				...s(n),
				...e
			};
			a.setState({
				...i,
				renderers: {
					...i.renderers,
					[e.id]: o
				}
			}, !1, "registerKanbanRenderer");
			let l = t.registerRenderer({
				id: e.id,
				render: (t) => c({
					...t,
					kanbanRendererId: e.id
				})
			});
			return r(() => {
				l.dispose();
				let t = a.getState();
				if (t.renderers[e.id] !== o) return;
				let { [e.id]: n, ...r } = t.renderers;
				a.setState({ renderers: r }, !1, "unregisterKanbanRenderer");
			});
		},
		getKanbanRenderer(e) {
			return a.getState().renderers[e];
		},
		listKanbanRenderers() {
			return Object.values(a.getState().renderers).sort(i);
		},
		refreshKanbanRenderer(e) {
			l(e);
			let t = { kanbanRendererId: e };
			for (let e of o) e(t);
		},
		onDidRefreshKanbanRenderer(e) {
			return o.add(e), r(() => {
				o.delete(e);
			});
		}
	};
}, fo = (e = {}) => {
	let t = n({
		name: "workbench.renderers",
		initialState: {
			renderers: {},
			refreshKeys: {}
		}
	}), i = {
		store: t,
		registerRenderer(e) {
			let n = t.getState();
			if (n.renderers[e.id]) throw Error(`Renderer already registered: ${e.id}`);
			return t.setState({
				...n,
				renderers: {
					...n.renderers,
					[e.id]: e
				}
			}, !1, "registerRenderer"), r(() => {
				let n = t.getState();
				if (n.renderers[e.id] !== e) return;
				let { [e.id]: r, ...i } = n.renderers, { [e.id]: a, ...o } = n.refreshKeys;
				t.setState({
					renderers: i,
					refreshKeys: o
				}, !1, "unregisterRenderer");
			});
		},
		getRenderer: (e) => t.getState().renderers[e],
		listRenderers: () => Object.values(t.getState().renderers),
		refreshRenderer(e) {
			let n = t.getState();
			if (!n.renderers[e]) throw Error(`Renderer is not registered: ${e}`);
			t.setState({
				...n,
				refreshKeys: {
					...n.refreshKeys,
					[e]: (n.refreshKeys[e] ?? 0) + 1
				}
			}, !1, "refreshRenderer");
		},
		onDidChange(e) {
			return r(t.subscribeSelector((e) => e.renderers, () => e()));
		}
	};
	for (let t of e.initialRenderers ?? []) i.registerRenderer(t);
	return i;
}, po = (e) => ({
	expandedNodeIds: [...e.defaultExpandedNodeIds ?? []],
	expandedSectionIds: [...e.defaultExpandedSectionIds ?? []]
}), mo = (e, t) => {
	let n = (t.defaultExpandedSectionIds ?? []).filter((t) => !e.expandedSectionIds.includes(t));
	return n.length === 0 ? e : {
		...e,
		expandedSectionIds: [...e.expandedSectionIds, ...n]
	};
}, ho = (e, t, n) => n ? e.includes(t) ? e : [...e, t] : e.includes(t) ? e.filter((e) => e !== t) : e, go = (e) => {
	let { rendererRegistry: t, persistence: a } = e, o = a?.getTreeStates(), c = n({
		name: "workbench.treeRenderers",
		initialState: {
			trees: {},
			statesByTreeId: o?.statesByTreeId ?? {},
			refreshKeysByTreeId: {}
		}
	}), l = /* @__PURE__ */ new Set(), u = () => null, d = (e) => {
		let t = c.getState().trees[e];
		if (!t) throw Error(`Tree renderer not registered: ${e}`);
		return t;
	}, f = (e) => {
		let t = c.getState(), n = t.statesByTreeId[e];
		if (n) return n;
		let r = t.trees[e];
		if (!r) throw Error(`Tree renderer not registered: ${e}`);
		let i = po(r);
		return c.setState({
			...t,
			statesByTreeId: {
				...t.statesByTreeId,
				[e]: i
			}
		}, !1, "ensureTreeState"), i;
	}, p = () => {
		if (!a) return;
		let e = {};
		for (let [t, n] of Object.entries(c.getState().statesByTreeId)) {
			let { loading: r, ...i } = n;
			e[t] = i;
		}
		a.setTreeStates({ statesByTreeId: e });
	}, m = (e, t, n) => {
		let r = f(e), i = t(r);
		if (i === r) return;
		let a = c.getState();
		c.setState({
			...a,
			statesByTreeId: {
				...a.statesByTreeId,
				[e]: i
			}
		}, !1, n), p();
	}, h = {
		treeStore: c,
		setTreeRendererImplementation(e) {
			u = e;
		},
		registerTreeRenderer(e, n) {
			let i = c.getState();
			if (i.trees[e.id]) throw Error(`Tree renderer already registered: ${e.id}`);
			let a = {
				...s(n),
				...e
			}, o = i.statesByTreeId[e.id], l = o ? mo(o, e) : po(e);
			c.setState({
				...i,
				trees: {
					...i.trees,
					[e.id]: a
				},
				statesByTreeId: {
					...i.statesByTreeId,
					[e.id]: l
				}
			}, !1, "registerTreeRenderer");
			let d = t.registerRenderer({
				id: e.id,
				render: (t) => u({
					...t,
					treeId: e.id
				})
			});
			return r(() => {
				d.dispose();
				let t = c.getState();
				if (t.trees[e.id] !== a) return;
				let { [e.id]: n, ...r } = t.trees, { [e.id]: i, ...o } = t.statesByTreeId, { [e.id]: s, ...l } = t.refreshKeysByTreeId;
				c.setState({
					trees: r,
					statesByTreeId: o,
					refreshKeysByTreeId: l
				}, !1, "unregisterTreeRenderer"), p();
			});
		},
		getTreeRenderer(e) {
			return c.getState().trees[e];
		},
		listTreeRenderers() {
			return Object.values(c.getState().trees).sort(i);
		},
		async getBody(e, t = {}) {
			return await d(e).getBody({
				...t,
				state: h.getTreeState(e),
				refresh: () => h.refresh(e),
				setSelectedNode: (t) => h.setSelectedNode(e, t)
			});
		},
		async getHeader(e, t = {}) {
			let n = d(e);
			return n.getHeader ? await n.getHeader({
				...t,
				state: h.getTreeState(e),
				refresh: () => h.refresh(e),
				setSelectedNode: (t) => h.setSelectedNode(e, t)
			}) : [];
		},
		async getFooter(e, t = {}) {
			let n = d(e);
			return n.getFooter ? await n.getFooter({
				...t,
				state: h.getTreeState(e),
				refresh: () => h.refresh(e),
				setSelectedNode: (t) => h.setSelectedNode(e, t)
			}) : [];
		},
		async getChildren(e, t, n = {}) {
			return await d(e).getChildren(t, {
				...n,
				state: h.getTreeState(e),
				refresh: () => h.refresh(e),
				setSelectedNode: (t) => h.setSelectedNode(e, t)
			});
		},
		getTreeState(e) {
			let t = f(e);
			return {
				expandedNodeIds: [...t.expandedNodeIds],
				expandedSectionIds: [...t.expandedSectionIds],
				selectedNodeId: t.selectedNodeId,
				loading: t.loading
			};
		},
		setNodeExpanded(e, t, n) {
			d(e), m(e, (e) => {
				let r = ho(e.expandedNodeIds, t, n);
				return r === e.expandedNodeIds ? e : {
					...e,
					expandedNodeIds: r
				};
			}, "setNodeExpanded");
		},
		setSectionExpanded(e, t, n) {
			d(e), m(e, (e) => {
				let r = ho(e.expandedSectionIds, t, n);
				return r === e.expandedSectionIds ? e : {
					...e,
					expandedSectionIds: r
				};
			}, "setSectionExpanded");
		},
		setSelectedNode(e, t) {
			d(e), m(e, (e) => e.selectedNodeId === t ? e : {
				...e,
				selectedNodeId: t
			}, "setSelectedNode");
		},
		setLoading(e, t) {
			d(e);
			let n = f(e);
			if (n.loading === t) return;
			let r = c.getState();
			c.setState({
				...r,
				statesByTreeId: {
					...r.statesByTreeId,
					[e]: {
						...n,
						loading: t
					}
				}
			}, !1, "setLoading");
		},
		refresh(e) {
			d(e);
			let t = c.getState(), n = t.refreshKeysByTreeId[e] ?? 0;
			c.setState({
				...t,
				refreshKeysByTreeId: {
					...t.refreshKeysByTreeId,
					[e]: n + 1
				}
			}, !1, "refreshTreeRenderer");
			let r = { treeId: e };
			for (let e of l) e(r);
		},
		onDidRefresh(e) {
			return l.add(e), r(() => {
				l.delete(e);
			});
		}
	};
	return h;
}, _o = () => {
	let e = /* @__PURE__ */ new Map(), t = !1, n = (t, n) => {
		if (!n.active && !n.pending && !n.queued) {
			for (let e of n.waiters) e();
			n.waiters.clear();
		}
		n.binding || n.active || n.pending || e.get(t) !== n || e.delete(t);
	}, r = (e, t) => e.binding === t.token && e.generation === t.generation, i = (e, a) => {
		a.queued || a.active || t || (a.queued = !0, queueMicrotask(() => {
			a.queued = !1;
			let o = a.pending;
			if (!o || t || a.active || (a.pending = void 0, !r(a, o))) {
				n(e, a);
				return;
			}
			let s = new AbortController();
			a.active = {
				controller: s,
				settled: Promise.resolve().then(() => o.run(s.signal)).catch((e) => {
					!s.signal.aborted && r(a, o) && o.onError(e);
				}).finally(() => {
					a.active = void 0, a.pending && i(e, a), n(e, a);
				})
			};
		}));
	};
	return {
		bind(a) {
			if (t) throw Error("Read registry is disposed");
			let o = e.get(a) ?? {
				generation: 0,
				queued: !1,
				waiters: /* @__PURE__ */ new Set()
			};
			e.set(a, o), o.active?.controller.abort(), o.pending = void 0;
			let s = Symbol(a);
			return o.binding = s, o.generation++, {
				request(e, n = "refresh") {
					if (o.binding !== s || t) return Promise.resolve();
					(o.queryKey !== e.queryKey || n === "retry") && (o.generation++, o.active?.controller.abort()), o.queryKey = e.queryKey;
					let c = o.generation, l, u = new Promise((e) => {
						l = e;
					});
					o.waiters.add(l);
					let d = {
						token: s,
						generation: c,
						queryKey: e.queryKey,
						onError: e.onError,
						async run(t) {
							t.throwIfAborted();
							let n = !0, i = (i) => {
								n && !t.aborted && r(o, d) && e.onProgress?.(i);
							}, a;
							try {
								a = await e.load(t, i);
							} finally {
								n = !1;
							}
							!t.aborted && r(o, d) && e.onValue(a);
						}
					};
					return o.pending = d, i(a, o), u;
				},
				dispose() {
					o.binding === s && (o.binding = void 0, o.pending = void 0, o.generation++, o.active?.controller.abort(), n(a, o));
				}
			};
		},
		async dispose() {
			t = !0;
			let r = [];
			for (let [t, i] of e) i.binding = void 0, i.pending = void 0, i.active && (i.active.controller.abort(), r.push(i.active.settled)), n(t, i);
			await Promise.allSettled(r);
		}
	};
}, vo = (e, t) => (e.order ?? 0) - (t.order ?? 0) || i(e, t), yo = (e) => Object.values(e.panels).sort(vo), bo = (e = {}) => {
	let t = n({
		name: "workbench.settings",
		initialState: {
			sections: {},
			panels: {},
			revision: 0
		}
	}), i = /* @__PURE__ */ new Map(), a = (e, t) => JSON.stringify([e, t]);
	return {
		store: t,
		refresh() {
			i.clear();
			let e = t.getState();
			t.setState({
				...e,
				revision: e.revision + 1
			}, !1, "refreshSettings");
		},
		registerSection(e, n) {
			let i = t.getState();
			if (i.sections[e.id]) throw Error(`Settings section already registered: ${e.id}`);
			let a = {
				...s(n),
				...e
			};
			return t.setState({
				...i,
				sections: {
					...i.sections,
					[e.id]: a
				}
			}, !1, "registerSection"), r(() => {
				let n = t.getState();
				if (n.sections[e.id] !== a) return;
				let { [e.id]: r, ...i } = n.sections;
				t.setState({
					...n,
					sections: i
				}, !1, "unregisterSection");
			});
		},
		registerPanel(n, a) {
			let o = t.getState();
			if (o.panels[n.id]) throw Error(`Settings panel already registered: ${n.id}`);
			if (n.kind !== "schema" && e.hasView && !e.hasView(n.viewId)) throw Error(`Settings panel View is not registered: ${n.viewId}`);
			let c = {
				...s(a),
				...n
			};
			return t.setState({
				...o,
				panels: {
					...o.panels,
					[n.id]: c
				}
			}, !1, "registerPanel"), r(() => {
				let e = t.getState();
				if (e.panels[n.id] !== c) return;
				let { [n.id]: r, ...a } = e.panels;
				for (let e of i.keys()) e.startsWith(`["${n.id}",`) && i.delete(e);
				t.setState({
					...e,
					panels: a
				}, !1, "unregisterPanel");
			});
		},
		getSection(e) {
			return t.getState().sections[e];
		},
		getPanel(e) {
			return t.getState().panels[e];
		},
		listSections() {
			return Object.values(t.getState().sections).sort(vo);
		},
		listPanels() {
			return yo(t.getState());
		},
		async resolveCollectionItem(e, n) {
			let r = t.getState().panels[e];
			if (!r || r.kind !== "collection") return;
			let o = (await r.items()).find((e) => r.itemId(e) === n);
			return o !== void 0 && i.set(a(e, n), o), o;
		},
		getCollectionItem: (e, t) => i.get(a(e, t))
	};
}, xo = (e, t) => e.slot.localeCompare(t.slot) || (e.order ?? 0) - (t.order ?? 0) || e.id.localeCompare(t.id), So = (e) => {
	let t = n({
		name: "workbench.statusBar",
		initialState: {
			items: {},
			order: a("status bar order read", () => e.persistence?.getOrder()) ?? []
		}
	}), i = () => {
		let { items: e, order: n } = t.getState(), r = new Map(n.map((e, t) => [e, t]));
		return Object.values(e).sort((e, t) => {
			let n = r.get(e.id) ?? Infinity, i = r.get(t.id) ?? Infinity;
			return e.slot.localeCompare(t.slot) || n - i || xo(e, t);
		});
	};
	return {
		store: t,
		registerItem(n) {
			let i = t.getState();
			if (i.items[n.id]) throw Error(`Status bar item already registered: ${n.id}`);
			if (!e.hasView(n.viewId)) throw Error(`Status bar view is not registered: ${n.viewId}`);
			if (n.order !== void 0 && !Number.isFinite(n.order)) throw Error(`Status bar item order must be finite: ${n.id}`);
			return t.setState({ items: {
				...i.items,
				[n.id]: n
			} }, !1, "registerItem"), r(() => {
				let e = t.getState();
				if (e.items[n.id] !== n) return;
				let { [n.id]: r, ...i } = e.items;
				t.setState({ items: i }, !1, "unregisterItem");
			});
		},
		getItem(e) {
			return t.getState().items[e];
		},
		listItems: i,
		reorderItem(n, r) {
			let o = t.getState(), s = "beforeItemId" in r ? r.beforeItemId : r.afterItemId, c = o.items[n], l = o.items[s];
			if (!c || !l || c.id === l.id || c.slot !== l.slot) return;
			let u = [.../* @__PURE__ */ new Set([...o.order, ...i().map((e) => e.id)])].filter((e) => e !== n);
			u.splice(u.indexOf(s) + +("afterItemId" in r), 0, n), t.setState({ order: u }, !1, "reorderItem"), a("status bar order write", () => e.persistence?.setOrder(u));
		},
		listVisibleItems(e) {
			return i().filter((t) => (!e || t.slot === e) && (t.isVisible?.() ?? !0));
		}
	};
}, Co = (e, t, n) => {
	for (let r of t.actions ?? []) if (!n.has(r)) throw Error(`Status "${e.id}.${t.id}" references unknown action "${r}"`);
}, wo = (e, t) => {
	let n = /* @__PURE__ */ new Set(), r = new Set((e.actions ?? []).map((e) => e.id)), i = 0;
	for (let a of t) {
		if (!a.id.trim()) throw Error(`Status set "${e.id}" contains an empty status id`);
		if (n.has(a.id)) throw Error(`Status set "${e.id}" contains duplicate id "${a.id}"`);
		if (n.add(a.id), !a.label.trim()) throw Error(`Status "${e.id}.${a.id}" must have a label`);
		if (!a.color.trim()) throw Error(`Status "${e.id}.${a.id}" must have a color`);
		if (!Number.isFinite(a.sortOrder)) throw Error(`Status "${e.id}.${a.id}" must have a finite order`);
		Co(e, a, r), a.isDefault && (i += 1);
	}
	if (i > 1) throw Error(`Status set "${e.id}" has more than one default status`);
	return [...t].sort((e, t) => e.sortOrder - t.sortOrder || e.id.localeCompare(t.id));
}, To = () => {
	let e = n({
		name: "workbench.statuses",
		initialState: {
			statusSets: {},
			values: {}
		}
	}), t = (t) => {
		let n = e.getState().statusSets[t];
		if (!n) throw Error(`Status set is not registered: ${t}`);
		return n;
	}, a = /* @__PURE__ */ new Map(), o = async (n) => {
		let r = t(n), i = wo(r, await r.query()), a = e.getState();
		return a.statusSets[n] === r && e.setState({
			...a,
			values: {
				...a.values,
				[n]: i
			}
		}, !1, "queryStatuses"), i;
	};
	return {
		store: e,
		registerStatusSet(t, n) {
			let i = e.getState();
			if (i.statusSets[t.id]) throw Error(`Status set already registered: ${t.id}`);
			let o = {
				...s(n),
				...t
			};
			return e.setState({
				...i,
				statusSets: {
					...i.statusSets,
					[t.id]: o
				}
			}, !1, "registerStatusSet"), r(() => {
				a.delete(t.id);
				let n = e.getState();
				if (n.statusSets[t.id] !== o) return;
				let { [t.id]: r, ...i } = n.statusSets, { [t.id]: s, ...c } = n.values;
				e.setState({
					statusSets: i,
					values: c
				}, !1, "unregisterStatusSet");
			});
		},
		getStatusSet(t) {
			return e.getState().statusSets[t];
		},
		listStatusSets() {
			return Object.values(e.getState().statusSets).sort((e, t) => i(e, t) || e.id.localeCompare(t.id));
		},
		getStatuses(t) {
			return e.getState().values[t];
		},
		load(t) {
			let n = e.getState().values[t];
			if (n) return Promise.resolve(n);
			let r = a.get(t);
			if (r) return r;
			let i = o(t).finally(() => {
				a.get(t) === i && a.delete(t);
			});
			return a.set(t, i), i;
		},
		query: o,
		async save(n, r) {
			let i = t(n);
			if (!i.save) throw Error(`Status set is read-only: ${n}`);
			let a = wo(i, r), o = wo(i, await i.save(a)), s = e.getState();
			return e.setState({
				...s,
				values: {
					...s.values,
					[n]: o
				}
			}, !1, "saveStatuses"), o;
		}
	};
}, Eo = () => {
	let e = n({
		name: "workbench.fileIconThemes",
		initialState: { themes: [] }
	}), t = /* @__PURE__ */ new Set(), i = () => {
		e.setState({ themes: [...t].flat() }, !1, "syncFileIconThemes");
	};
	return {
		store: e,
		register(e) {
			return t.add(e), i(), r(() => {
				t.delete(e) && i();
			});
		},
		listThemes() {
			return e.getState().themes;
		}
	};
}, Do = () => {
	let e = n({
		name: "workbench.themes",
		initialState: { themes: [] }
	}), t = /* @__PURE__ */ new Set(), i = () => {
		e.setState({ themes: [...t].flat() }, !1, "syncThemes");
	};
	return {
		store: e,
		register(e) {
			return t.add(e), i(), r(() => {
				t.delete(e) && i();
			});
		},
		listThemes() {
			return e.getState().themes;
		}
	};
}, Oo = (e, t) => `workbench.view-menu.${encodeURIComponent(e)}.${encodeURIComponent(t)}`, ko = (e) => e.config === void 0 ? { viewContextId: e.id } : !e.config || typeof e.config != "object" || Array.isArray(e.config) ? {
	viewContextId: e.id,
	value: e.config
} : {
	...e.config,
	viewContextId: e.id
}, Ao = (e) => {
	let t = /* @__PURE__ */ new Map();
	return {
		registerViewMenu(n) {
			if (t.has(n.id)) throw Error(`View menu already registered: ${n.id}`);
			if (!e.views.getView(n.ownerViewId)) throw Error(`View menu owner is not registered: ${n.ownerViewId}`);
			if (!e.views.getView(n.viewId)) throw Error(`View menu View is not registered: ${n.viewId}`);
			let i = { ...n };
			return t.set(i.id, i), r(() => {
				t.get(i.id) === i && t.delete(i.id);
			});
		},
		getViewMenu: (e) => t.get(e),
		listViewMenus: (e) => [...t.values()].filter((t) => !e || t.ownerViewId === e),
		definitionsFor(n, r) {
			return [...t.values()].filter((e) => e.ownerViewId === n).map((t) => {
				let n = e.views.getView(t.viewId);
				if (!n) throw Error(`View menu View is not registered: ${t.viewId}`);
				return {
					id: Oo(r, t.id),
					title: n.title,
					icon: n.icon,
					side: t.side,
					rendererId: n.id,
					priority: t.priority,
					mountStrategy: t.mountStrategy,
					hiddenByDefault: t.hiddenByDefault,
					regionSize: t.regionSize,
					regionCollapsible: t.regionCollapsible,
					headerBorderBottom: t.headerBorderBottom,
					config: ko(t)
				};
			});
		}
	};
}, jo = "workbench.view.id", Mo = (e, t) => t.priority - e.priority || e.id.localeCompare(t.id), No = (e) => {
	let t = n({
		name: "workbench.views",
		initialState: { views: {} }
	}), i = /* @__PURE__ */ new Map();
	return {
		reads: _o(),
		store: t,
		registerView(n, a) {
			let o = t.getState();
			if (o.views[n.id]) throw Error(`View already registered: ${n.id}`);
			let c = e.registerBody(n, a);
			i.set(n.id, c);
			let l = {
				...n,
				...s(a)
			};
			return t.setState({ views: {
				...o.views,
				[n.id]: l
			} }, !1, "registerView"), r(() => {
				let e = t.getState();
				if (e.views[n.id] !== l) return;
				let { [n.id]: r, ...a } = e.views;
				t.setState({ views: a }, !1, "unregisterView"), c.dispose(), i.delete(n.id);
			});
		},
		getView(e) {
			return t.getState().views[e];
		},
		listViews() {
			return Object.values(t.getState().views).sort(Mo);
		},
		refreshView(e, n) {
			if (!t.getState().views[e]) throw Error(`View is not registered: ${e}`);
			i.get(e)?.refresh?.(n);
		}
	};
}, Po = (e, t, n) => {
	e.notifications.captureActionError(t)(n);
}, Fo = async (e, t, n, r) => {
	let i = e.notifications.captureActionError(t, r?.inlineTarget);
	try {
		await n(), r?.onSuccess?.();
	} catch (e) {
		i(e);
	}
}, Io = (e, t) => {
	if (!e || e.main.kind === "panels" && !e.resource || I(e)) return e;
	let n = e;
	for (; n.parentId;) {
		let r = t.find((e) => e.id === n.parentId);
		if (!r || r.modeId !== e.modeId || r.resource || I(r)) break;
		if (r.main.kind === "panels") return r;
		n = r;
	}
	return e;
}, Lo = (e, t) => Object.values(e.regions).some((e) => e.widgets.some((e) => e.placementIdentity && t(e.placementIdentity, e))), Ro = (e, t) => {
	let n = Object.values(e.layout.getLayout().regions).flatMap((e) => e.widgets).find((e) => e.placementIdentity && U(e.placementIdentity) === U(t));
	n && e.layout.activatePanel(n.widgetId);
}, zo = (e, t) => {
	let n = e.pages.listPages(), r = (e) => e && u(e) === u(t), i = n.filter((e) => r(e.panelView) || e.main.kind === "panels" && typeof e.main.landing == "object" && r(e.main.landing));
	if (!i.length) return !0;
	let a = Io(e.pages.getPage(e.pages.store.getState().activePageId ?? ""), n);
	return i.some((e) => Io(e, n)?.id === a?.id);
}, Bo = async (e, t, n) => {
	if (t.kind === "command") await e.commands.executeCommand(u(t.target.command), t.target.params, {
		source: "panel-add",
		region: n
	});
	else {
		if (t.kind === "panel") {
			await e.navigation.openTarget({
				...t,
				region: n
			});
			return;
		}
		if (t.kind === "compound") {
			await e.navigation.openTarget({
				...t,
				targets: t.targets.map((e) => e.kind === "panel" ? {
					...e,
					region: n
				} : e)
			});
			return;
		}
		await e.navigation.openTarget(t);
	}
}, Vo = (e, t) => {
	if (t.kind !== "binding") return !0;
	let n = t.binding.add;
	if (!n) return !1;
	if (n.kind !== "command") return !0;
	let r = u(n.target.command);
	return !!(e.commands.getCommand(r) && e.commands.isCommandVisible(r, n.target.params) && e.commands.isCommandEnabled(r, n.target.params));
}, Ho = (e, t, n) => {
	for (let r of e.shellPlacements.listPlacements()) {
		if (!pn(e, Qa(r.id)).includes(t.region)) continue;
		let i = r.item.kind === "binding" && r.item.binding.cardinality === "many", a = Lo(t.layout, (e) => e.kind === "shell" && e.placementId === r.id);
		!i && a || !Vo(e, r.item) || n(Qa(r.id), () => {
			if (r.item.kind === "binding" && r.item.binding.add) return Bo(e, r.item.binding.add, t.region);
			Ro(e, e.shellPlacements.openPlacement({
				placementId: r.id,
				region: t.region
			}));
		}, r.item);
	}
}, Uo = (e, t, n) => {
	if (t.modeId) for (let r of e.modePlacements.listPlacements(t.modeId)) {
		if (t.region === "main" && r.item.kind === "view" && !zo(e, r.ref)) continue;
		let i = r.addableIn ?? r.movableTo;
		if (i && !i.includes(t.region) || !pn(e, un(r.id)).includes(t.region)) continue;
		let a = r.item.kind === "binding" && r.item.binding.cardinality === "many", o = Lo(t.layout, (e) => e.kind === "mode" && e.placementId === r.id);
		!a && o || !Vo(e, r.item) || n(un(r.id), () => {
			if (r.item.kind === "binding" && r.item.binding.add) return Bo(e, r.item.binding.add, t.region);
			Ro(e, e.modePlacements.openPlacement({
				panel: r.ref,
				region: t.region
			}));
		}, r.item);
	}
}, Wo = (e, t, n, r) => {
	let i = n.addableIn ?? n.movableTo;
	return i && !i.includes(r.region) || n.role === "primary" && r.region !== "main" || n.isAvailable && !n.isAvailable(r.resource) ? !1 : pn(e, z(t, n.id)).includes(r.region);
}, Go = (e, t, n) => {
	let r = e.pages.store.getState(), i = r.activePageId ? e.pages.getPage(r.activePageId) : void 0;
	if (i) for (let a of R(i)) {
		if (!Wo(e, i.id, a, t)) continue;
		let o = a.item.kind === "binding" && a.item.binding.cardinality === "many", s = a.role !== "primary" && o, c = a.role === "primary" ? r.location?.resource : t.resource, l = Lo(t.layout, (t, n) => t.kind === "page" && t.pageId === i.id && t.slotId === a.id && (a.role !== "primary" || !c || n.resource && e.pages.resourceReferenceKey(n.resource) === e.pages.resourceReferenceKey(c)) === !0);
		!s && l || !Vo(e, a.item) || n(z(i.id, a.id), () => {
			if (a.item.kind === "binding" && a.item.binding.add) return Bo(e, a.item.binding.add, t.region);
			e.pages.openSlot({
				pageId: i.id,
				slotId: a.id,
				region: t.region
			});
			let n = Object.values(e.layout.getLayout().regions).flatMap((e) => e.widgets).find((t) => t.widgetId === e.layout.getLayout().activeWidgetId && t.contributionId === z(i.id, a.id));
			n?.placementIdentity && Ro(e, n.placementIdentity);
		}, a.item);
	}
}, Ko = (e, t) => {
	let n = [], r = (r, i, a) => {
		let o = e.layout.getWidget(r), s = a.kind === "binding" ? a.binding.add : void 0, c = s?.kind === "command" ? e.commands.getCommand(u(s.target.command))?.command : void 0;
		o && n.push({
			panelId: r,
			region: t.region,
			contribution: c ? {
				...o,
				title: c.label,
				icon: c.icon ?? o.icon
			} : o,
			open: (t) => Fo(e, "Add panel", () => i?.(t))
		});
	};
	return Ho(e, t, r), Uo(e, t, r), Go(e, t, r), n;
}, qo = (e, t = e.pages.store.getState(), n = e.layout.getLayout()) => {
	let r = t.activePageId ? t.pages[t.activePageId] : void 0;
	if (!r) return;
	let i = r.main, a = R(r).find((e) => i.kind === "view" ? e.role === "primary" : i.kind === "panels" && e.id === i.landing);
	if (a) return Ko(e, {
		layout: n,
		region: "main",
		resource: t.location?.resource
	}).find((e) => e.panelId === z(r.id, a.id));
}, Jo = (e) => {
	e.commands.registerCommand({
		id: "workbench.resizePanel",
		label: "Resize a panel",
		category: "Workbench",
		params: {
			region: {
				type: "string",
				label: "Panel",
				required: !0,
				options: [
					{
						label: "Navigation",
						value: "sidenav"
					},
					{
						label: "Bottom",
						value: "secondary"
					},
					{
						label: "Side",
						value: "side"
					}
				]
			},
			size: {
				type: "number",
				label: "Size in pixels",
				required: !0
			}
		}
	}, { execute: ({ region: t, size: n }) => e.shell.setRegionSize(t, n) }), e.commands.registerCommand({
		id: "workbench.setSidePanelPresentation",
		label: "Set Side Panel presentation",
		category: "Workbench",
		params: { presentation: {
			type: "string",
			label: "Presentation",
			required: !0,
			options: [
				{
					label: "Attached",
					value: "attached"
				},
				{
					label: "Floating",
					value: "floating"
				},
				{
					label: "Closed",
					value: "closed"
				}
			]
		} }
	}, { execute: ({ presentation: t }) => e.shell.setSidePanelPresentation(t) }), e.commands.registerCommand({
		id: "workbench.setPanelOpen",
		label: "Show or hide a panel",
		category: "Workbench",
		params: {
			region: {
				type: "string",
				label: "Panel",
				required: !0,
				options: [
					{
						label: "Navigation",
						value: "sidenav"
					},
					{
						label: "Bottom",
						value: "secondary"
					},
					{
						label: "Side",
						value: "side"
					}
				]
			},
			open: {
				type: "boolean",
				label: "Open",
				required: !0
			}
		}
	}, { execute: ({ region: t, open: n }) => e.shell.setRegionOpen(t, n) }), e.commands.registerCommand({
		id: "workbench.setPanelHeaderVisible",
		label: "Show or hide a panel header",
		category: "Workbench",
		params: {
			region: {
				type: "string",
				label: "Panel",
				required: !0,
				options: [
					{
						label: "Main",
						value: "main"
					},
					{
						label: "Bottom",
						value: "secondary"
					},
					{
						label: "Side",
						value: "side"
					}
				]
			},
			visible: {
				type: "boolean",
				label: "Header visible",
				required: !0
			}
		}
	}, { execute: ({ region: t, visible: n }) => e.shell.setHeaderVisible(t, n) });
}, Yo = (e) => {
	let t = {
		type: "string",
		label: "Position",
		required: !0,
		options: [
			"left",
			"right",
			"top",
			"bottom"
		].map((e) => ({
			label: e,
			value: e
		}))
	};
	e.commands.registerCommand({
		id: "workbench.repositionPanel",
		label: "Change panel position",
		category: "Workbench",
		params: {
			region: {
				type: "string",
				label: "Panel",
				required: !0,
				options: [
					{
						label: "Main",
						value: "main"
					},
					{
						label: "Side",
						value: "side"
					},
					{
						label: "Bottom",
						value: "secondary"
					},
					{
						label: "Navigation",
						value: "sidenav"
					}
				]
			},
			position: t
		}
	}, { execute: (t) => e.shell.repositionPanel(t.region, t.position) }), e.commands.registerCommand({
		id: "workbench.setActionBarPosition",
		label: "Change action bar position",
		category: "Workbench",
		params: { position: t }
	}, { execute: (t) => e.shell.repositionPanel("activity", t.position) });
}, Xo = (e) => {
	Jo(e), Yo(e), e.commands.registerCommand({
		id: "workbench.reopenPageContent",
		label: "Restore page content to Main",
		category: "Workbench"
	}, { execute: () => qo(e)?.open?.() }), e.commands.registerCommand({
		id: "workbench.resetLayout",
		label: "Reset workbench layout",
		category: "Workbench",
		icon: "RotateCcw"
	}, { execute: () => e.resetLayout() }), e.commands.registerCommand({
		id: "workbench.movePanel",
		label: "Move workbench tab",
		category: "Workbench",
		icon: "PanelsTopLeft",
		params: {
			instanceId: {
				type: "string",
				label: "Tab instance",
				required: !0
			},
			region: {
				type: "string",
				label: "Destination",
				required: !0,
				options: [
					{
						label: "Main",
						value: "main"
					},
					{
						label: "Side",
						value: "side"
					},
					{
						label: "Secondary",
						value: "secondary"
					}
				]
			}
		}
	}, { execute: (t) => e.movePanel(t.instanceId, t.region, t.position) });
}, Zo = (e, t, n) => {
	let r = e.placementIdentity;
	if (r?.kind !== "page") return !1;
	let i = (e, t) => Ir(e, r.pageId, r.instanceKey) && t?.openStaticSlotIds.includes(r.slotId) || t?.resourceInstances[r.slotId]?.some((e) => e.instanceKey === r.instanceKey);
	return Object.entries(n.pageStates).some(([e, n]) => (e === r.pageId || e.startsWith(`${r.pageId}|`)) && i(e, n) && !i(e, t.pageStates[e]));
}, Qo = (e) => ({
	projectId: e.projectId,
	modeId: e.activeModeId,
	pageId: e.activePageId,
	resource: e.location?.resource
}), Q = (e, t) => e.projectId !== t.projectId || e.activeModeId !== t.activeModeId || e.activePageId !== t.activePageId || Z(e.pages[e.activePageId ?? ""], e.location?.resource) !== Z(t.pages[t.activePageId ?? ""], t.location?.resource), $o = (e, t) => new Set(Object.values(e?.regions ?? {}).flatMap((e) => e.widgets.flatMap((n) => e.id === "main" === t && n.placementIdentity ? [U(n.placementIdentity)] : []))), es = (e, t, n) => {
	let r = e.placementIdentity;
	if (!r) return !1;
	if (r.kind !== "page") return n;
	if (r.pageId !== t.activePageId) return !0;
	let i = t.pages[r.pageId], a = i && R(i).find((e) => e.id === r.slotId), o = a?.item.kind === "binding" ? a.item.binding : i?.resource;
	return o && (!e.resource || !q(o, e.resource)) ? !1 : !!(i?.resource && Z(i, e.resource) !== Z(i, t.location?.resource));
}, ts = (e, t) => {
	let n = e.placementIdentity;
	if (n?.kind !== "page" || n.pageId !== t.activePageId) return !1;
	let r = t.pages[n.pageId];
	return !r?.resource || !e.resource || !q(r.resource, e.resource) || Z(r, e.resource) === Z(r, t.location?.resource);
}, ns = (e, t, n) => {
	let { state: r, previous: i, layout: a, pageLayout: o } = e, s = Q(r, i), c = new Set(r.reconciliation.activate.map((e) => U(e.identity))), l = [...t], u = s ? o?.regions.main.widgets : a.regions.main.widgets;
	I(r.pages[r.activePageId ?? ""]) && (u = []);
	for (let [t, a] of (u ?? []).entries()) {
		let o = a.placementIdentity;
		if (!o || !e.getWidget(a.contributionId) || Zo(a, r, i) || !es(a, r, s)) continue;
		let u = U(o);
		if (n.has(u)) continue;
		let d = l.find((e) => U(e.identity) === u);
		l = l.filter((e) => U(e.identity) !== u);
		let f = c.has(u) && d ? d.value : rs(e, a);
		l.push({
			identity: o,
			region: "main",
			order: t,
			value: f.role === "location" && o.kind === "page" && o.pageId !== r.activePageId ? {
				...f,
				role: "sub-panel"
			} : f
		});
	}
	return l;
}, rs = (e, t) => {
	t = {
		...t,
		closable: e.getWidget(t.contributionId)?.closable ?? t.closable
	};
	let n = t.placementIdentity;
	if (n?.kind !== "page" || !t.resource) return t;
	let r = Object.entries(e.state.pageStates).filter(([e]) => e === n.pageId || e.startsWith(`${n.pageId}|`)).flatMap(([, e]) => e.resourceInstances[n.slotId] ?? []).find((e) => e.instanceKey === n.instanceKey && h(e.resource) === h(t.resource));
	return r ? {
		...t,
		resource: r.resource,
		section: r.section,
		position: r.position,
		pageContext: r.pageContext,
		title: r.resource.label ?? e.getWidget(t.contributionId)?.title ?? t.title
	} : t;
}, is = (e, t) => {
	let n = U(t.placementIdentity), r = [...e.state.reconciliation.activate, ...e.state.reconciliation.update.map((e) => e.desired)].find((e) => U(e.identity) === n);
	return r ? {
		...r.value,
		widgetId: t.widgetId
	} : rs(e, t);
}, as = (e, t, n) => {
	let r = t.placementIdentity;
	return r?.kind === "page" && !!e.getWidget(t.contributionId) && e.state.pages[r.pageId]?.modeId === e.state.activeModeId && !(n && t.tabRetention === "preview") && !Zo(t, e.state, e.previous);
}, os = (e, t, n) => {
	let { state: r, previous: i } = e, a = Q(r, i) && r.projectId === i.projectId && r.activeModeId === i.activeModeId, o = [...t];
	for (let t of Object.values(n?.regions ?? {})) if (t.id === "side" || t.id === "secondary") for (let [n, r] of t.widgets.entries()) {
		let i = r.placementIdentity;
		if (!i || !as(e, r, a)) continue;
		let s = U(i);
		o = o.filter((e) => U(e.identity) !== s), o.push({
			identity: i,
			region: t.id,
			order: n,
			value: is(e, r)
		});
	}
	return o;
}, ss = (e) => {
	let { state: t, previous: n, layout: r, modeLayout: i } = e;
	if (!t.activePageId) return t;
	let a = Q(t, n), o = t.projectId === n.projectId && t.activeModeId === n.activeModeId, s = o ? r : i, c = Object.values(t.pages), l = Io(t.pages[t.activePageId], c), u = o && l?.main.kind === "panels" && !l.resource && l === Io(n.pages[n.activePageId ?? ""], c), d = n.activePageId && !u ? $o(r, !0) : /* @__PURE__ */ new Set(), f = $o(s, !1), p = new Set(t.reconciliation.activate.map((e) => U(e.identity))), m = os(e, ns(e, t.placements.filter((e) => {
		let t = U(e.identity);
		return !a || !d.has(t) || f.has(t) || p.has(t);
	}), f), s);
	return {
		...t,
		placements: m,
		reconciliation: W({
			current: n.placements,
			desired: m,
			destinations: t.reconciliation.destinations,
			activate: t.reconciliation.activate.filter((e) => m.some((t) => U(t.identity) === U(e.identity))).map((e) => e.identity),
			valuesEqual: (e, t) => JSON.stringify(e) === JSON.stringify(t)
		})
	};
}, cs = (e) => ({
	loadPageLayout: (t) => e.loadPageLayout(Qo(t), t.pages[t.activePageId ?? ""]),
	savePageMain: (t, n, r) => e.savePageMain(Qo(t), n, t.pages[t.activePageId ?? ""], r)
}), ls = /* @__PURE__ */ new WeakMap(), us = (e, t = e.modes.getActiveModeId(), n) => {
	let r = ls.get(e), i = e.pages.store.getState(), a = n?.projectId ?? i.projectId, o = e.layout.store.getInitialState().layout, s = t && (t !== e.modes.getActiveModeId() || a !== i.projectId) ? r?.readMode(a, t) ?? o : e.layout.getLayout();
	if (!n || !Q(n, i)) return s;
	let c = r?.loadPageLayout(Qo(n), n.pages[n.activePageId ?? ""]);
	return {
		...s,
		regions: {
			...s.regions,
			main: c?.regions.main ?? o.regions.main
		}
	};
}, ds = (e) => ({
	getContext() {
		let t = e()?.pages.store.getState();
		return t?.activeModeId ? {
			modeId: t.activeModeId,
			projectId: t.projectId
		} : void 0;
	},
	isChangingPage() {
		let t = e();
		return !!(t && B(t.pages).getPublishingState() !== t.pages.store.getState());
	}
}), fs = (e, t) => {
	ls.set(e, t);
	let n = () => {
		let n = e.pages.store.getState();
		n.activeModeId && t.saveMode(n.projectId, n.activeModeId, e.layout.getLayout()), n.activeModeId === e.modes.getActiveModeId() && t.savePageMain(Qo(n), e.layout.getLayout(), n.pages[n.activePageId ?? ""]);
	};
	e.layout.store.subscribe(() => {
		!e.modes.isTransitioning() && B(e.pages).getPublishingState() === e.pages.store.getState() && n();
	}), e.pages.store.subscribe(n);
}, ps = (e) => {
	let { region: t, mode: n, state: r, settings: i = {} } = e, a = Gt(t), o = !a || a === "main" || P(n, a), s = t === "main", c = i.size, l = c?.minPx !== void 0 && c.minPx === c.maxPx, u = o && i.canOpen !== !1, d = o && !s && i.canClose !== !1, f = i.showHeader ?? (i.alwaysShowTabs !== !1 && void 0);
	return {
		provided: o,
		open: o && (s || r.visible),
		canOpen: u,
		canClose: d,
		canToggle: u && d,
		acceptsTabs: o && i.acceptsTabs !== !1,
		movable: o && i.movable !== !1,
		resizable: o && !l && i.resizable !== !1,
		floatable: o && t === "side" && (i.floatable ?? e.legacyFloatable ?? !0),
		showHeader: o && (r.headerVisible ?? e.pageShowHeader ?? f ?? !0)
	};
}, ms = (e, t, n = e.modes.getActiveModeId(), r = e.pages.store.getState()) => {
	let i = n ? e.modes.getMode(n) : void 0, a = r, o = a.activePageId ? e.pages.getPage(a.activePageId) : void 0, s = e.layout.getRegionSettings(t, n), c = s?.showHeader === void 0 && s?.alwaysShowTabs === !1, l = ps({
		region: t,
		mode: i,
		settings: s,
		pageShowHeader: o && o.modeId === n ? o.regionSettings?.[t]?.showHeader : void 0,
		state: us(e, n, r).regions[t],
		legacyFloatable: e.sidePanel.canFloat()
	}), u = l.acceptsTabs && !(t === "main" && o?.modeId === n && I(o));
	return {
		...l,
		acceptsTabs: u,
		showHeader: t === "main" && o?.modeId === n ? l.provided && !I(o) && !c : l.showHeader
	};
}, hs = (e, t) => {
	if (!e || e.modes.isTransitioning()) return t;
	let n = e.modes.getActiveModeId();
	return et(Yt(t, n ? e.modes.getMode(n) : void 0, (t) => e.layout.getRegionSettings(t, n)), e.layout.getRegionSize);
}, gs = (e, t, n = {}) => {
	let r = n.identity && Object.values(us(e, n.modeId, n.proposed).regions).flatMap((e) => e.widgets.map((t) => ({
		region: e.id,
		placement: t
	}))).find(({ placement: e }) => e.placementIdentity && U(e.placementIdentity) === U(n.identity)), i = n.requestedRegion ?? r?.region ?? t, a = !r || r.region !== i || n.resource && h(r.placement.resource) !== h(n.resource), o = ms(e, i, n.modeId, n.proposed);
	if (!o.provided) throw Error(`Panel is not provided: ${i}`);
	if (a && !o.acceptsTabs) throw Error(`Panel cannot accept tabs: ${i}`);
	if (n.reveal !== !1 && !o.open && !o.canOpen) throw Error(`Panel cannot open: ${i}`);
}, _s = (e, t) => {
	if (!e.panelView) return;
	let n = t.getPlacement(e.panelView);
	if (!n || n.modeId !== e.modeId) throw Error(`Page "${e.id}" requires a panel view in its mode`);
}, vs = (e, t, n) => {
	let r = t.placements.find((e) => U(e.identity) === U(n));
	r && gs(e, r.region, {
		identity: n,
		modeId: t.activeModeId,
		proposed: t
	});
}, ys = (e, t, n, r, i = h) => {
	let a = t.placementIdentity, o = (n && a?.kind === "page" ? Li(n, {
		kind: "page-slot",
		page: e.ref,
		id: a.slotId
	}) : void 0)?.ref ?? (L(e, a) ? e.panelView : void 0);
	if (!o) return;
	let s = n?.getPlacement(o);
	if (!s || !n) return t;
	let c = Object.values(r?.regions ?? {}).flatMap((e) => e.widgets).find((e) => {
		let n = e.placementIdentity;
		return n?.kind === "mode" && n.modeId === s.modeId && n.placementId === s.id && (s.item.kind === "view" || !!(e.resource && t.resource && i(e.resource) === i(t.resource)));
	});
	if (c) return c;
	let l = X(n), u = l.open({
		placementId: s.id,
		location: {
			section: t.section,
			position: t.position,
			pageContext: t.pageContext
		},
		...s.item.kind === "binding" && t.resource ? { resource: t.resource } : {},
		...s.item.kind === "binding" && s.item.binding.cardinality === "many" ? { open: t.tabRetention === "preview" ? "preview" : "pin" } : {}
	}), d = l.resolve(e.modeId, u.state).find((e) => U(e.identity) === U(u.identity));
	return d ? {
		...d.value,
		placementIdentity: d.identity,
		pinned: t.pinned,
		tabRetention: t.tabRetention
	} : void 0;
}, bs = (e, t, n, r) => {
	let i = e.main.kind === "panels" ? e.main.landing : void 0;
	if (!i || typeof i == "string") return;
	let a = t.getPlacement(i);
	if (!a || a.modeId !== e.modeId) throw Error(`Page "${e.id}" requires a landing placement in its mode`);
	if (a.item.kind === "view") {
		if (r?.open) throw Error("A static landing does not accept a resource open intent");
		return X(t).open({ placementId: a.id }, n);
	}
	if (!e.resource || a.item.binding.cardinality !== "many" || a.region !== "main") throw Error(`Page "${e.id}" requires a many-resource Main landing viewer`);
	let o = r?.location.resource;
	if (!o || !q(e.resource, o)) throw Error(`Page "${e.id}" requires a compatible landing resource`);
	return X(t).open({
		placementId: a.id,
		resource: o,
		open: r.open,
		location: {
			section: r.location.section,
			position: r.location.position,
			pageContext: {
				page: r.location.page,
				parent: r.location.parent,
				params: r.location.params
			}
		}
	}, n);
}, xs = (e, t) => {
	if (t.kind === "mode") return e.modePlacements.listPlacements().find((e) => e.id === t.placementId)?.item;
	if (t.kind === "shell") return e.shellPlacements.getPlacement(t.placementId)?.item;
	let n = e.pages.getPage(t.pageId), r = n && R(n).find((e) => e.id === t.slotId);
	return r?.openOn === "page-resource" ? void 0 : r?.item;
}, Ss = (e) => {
	let t = e.pages.getContent();
	return [...t ? [{
		region: "main",
		widget: t
	}] : [], ...[
		"main",
		"secondary",
		"side"
	].flatMap((t) => e.layout.getLayout().regions[t].widgets.map((e) => ({
		region: t,
		widget: e
	})))].flatMap(({ region: t, widget: n }) => {
		let r = n.placementIdentity;
		return !r || !n.resource || xs(e, r)?.kind !== "binding" ? [] : [{
			region: t,
			widget: n,
			identity: r,
			resource: n.resource
		}];
	});
}, Cs = (e, t) => U(e) === U(t), ws = (e, t, n) => {
	let r = e.pages.resourceReferenceKey(t);
	return Ss(e).find((t) => (!n || !Cs(t.identity, n)) && e.pages.resourceReferenceKey(t.resource) === r);
}, Ts = (e, t, n) => {
	if (t.kind === "page") {
		let e = Object.values(n.pages).find((e) => e.ref.id === t.page.id && e.ref.extensionId === t.page.extensionId);
		return e?.resource && e.modeId === n.activeModeId ? e.resource : void 0;
	}
	let r = t.panel;
	if (r.kind === "placement") {
		let t = e.modePlacements.getPlacement(r);
		return t && t.modeId === n.activeModeId && t.item.kind === "binding" ? t.item.binding : void 0;
	}
	if (r.kind === "shell-placement") {
		let t = e.shellPlacements.getPlacement(r.id);
		return t?.item.kind === "binding" ? t.item.binding : void 0;
	}
	let i = Object.values(n.pages).find((e) => e.ref.id === r.page.id && e.ref.extensionId === r.page.extensionId), a = i && R(i).find((e) => e.id === r.id);
	return i?.id === n.activePageId && a?.item.kind === "binding" ? a.item.binding : void 0;
}, Es = (e, t) => Object.values(e.layout.getLayout().regions).find((e) => e.widgets.some((e) => e.placementIdentity && U(e.placementIdentity) === U(t)))?.id, Ds = (e, t, n) => {
	if (!t.resource || t.kind === "page" && t.intent === "restore") return;
	let r = Ts(e, t, n);
	if (!r) return;
	if (!q(r, t.resource)) throw Error("Viewer does not accept this resource kind");
	let i = e.pages.resourceReferenceKey(t.resource), a = n.pages[n.activePageId ?? ""], o = n.placements.find((t) => !t.value.resource || xs(e, t.identity)?.kind !== "binding" || (Es(e, t.identity) ?? t.region) === "main" && I(a) && !L(a, t.identity) ? !1 : e.pages.resourceReferenceKey(t.value.resource) === i);
	if (!o) return;
	let s = Es(e, o.identity) ?? o.region;
	return L(a, o.identity) || gs(e, s, {
		identity: o.identity,
		proposed: n,
		modeId: n.activeModeId
	}), {
		identity: o.identity,
		region: s
	};
}, Os = (e, t, n, r, i) => {
	let a = {
		...t,
		resourceInstances: new Map(t.resourceInstances)
	};
	return Ai({
		label: "Viewer",
		id: n.placementId,
		item: r,
		state: a,
		instanceKey: n.instanceKey,
		resource: i.resource,
		location: i,
		open: "pin",
		keyOfResource: e.pages.resourceReferenceKey
	}), a;
}, ks = (e, t, n, r) => {
	if (t.kind === "mode") {
		let i = e.modePlacements.listPlacements().find((e) => e.id === t.placementId).item;
		return {
			...r,
			mode: Os(e, r.mode, t, i, n)
		};
	}
	if (t.kind === "shell") {
		let i = e.shellPlacements.getPlacement(t.placementId).item;
		return {
			...r,
			shell: Os(e, r.shell, t, i, n)
		};
	}
	let i = Oa(Oa(r.page.pageStates, t, {
		kind: "reference",
		...n
	}), t, {
		kind: "retention",
		open: "pin"
	});
	return {
		...r,
		page: {
			...r.page,
			pageStates: i
		}
	};
}, As = (e, t, n) => {
	let r = new Set(n.placements.map((e) => U(e.identity)));
	for (let n of t) r.has(U(n)) && e.pinPlacement(n);
}, js = (e, t, n) => e === "pin" && !L(t.pages[t.activePageId ?? ""], n), Ms = (e) => {
	if (!e.projectId) throw Error("Cannot navigate before a project is active");
	return e.projectId;
}, Ns = (e, t, n, r) => {
	if (t.kind === "panel") for (let i of r.reconciliation.activate) gs(e, t.region ?? i.region, {
		modeId: r.activeModeId,
		identity: i.identity,
		resource: t.resource,
		requestedRegion: t.region,
		proposed: n
	});
}, Ps = (e, t, n) => {
	let r = n ?? e.modes.getActiveModeId(), i = r ? e.modes.getMode(r) : void 0;
	if (t.region && !P(i, t.region)) throw Error(`Panel cannot open in ${t.region}`);
	return r;
}, Fs = (e, t, n, r) => {
	let i = e.kind === "panel" ? e.region : void 0;
	for (let e of t) n.set(i ?? e.region, e.identity), i && r.set(U(e.identity), {
		identity: e.identity,
		region: i
	});
}, Is = (e) => e.activeModeId ? {
	modeId: e.activeModeId,
	pageId: e.activePageId,
	projectId: e.projectId,
	location: e.location
} : void 0, Ls = (e, t) => {
	let n = Object.values(e.pages).find((e) => e.ref.extensionId === t.page.extensionId && e.ref.id === t.page.id);
	if (!n || n.id !== e.activePageId) throw Error(`Page panel "${t.id}" is not owned by the proposed page`);
	return n;
}, Rs = (e, t, n, r, i) => {
	let a = t.panel;
	if (a.kind === "placement") {
		let o = e.modePlacements.getPlacement(a);
		if (!o || o.modeId !== n) throw Error(`Mode panel "${a.id}" is not owned by the proposed mode`);
		let s = X(e.modePlacements).open({
			placementId: o.id,
			resource: t.resource,
			open: t.open,
			region: t.region
		}, r);
		return {
			modeState: s.state,
			shellState: i,
			identity: s.identity
		};
	}
	let o = X(e.shellPlacements).open({
		placementId: a.id,
		resource: t.resource,
		open: t.open,
		region: t.region,
		..."title" in t ? { title: t.title } : {}
	}, i);
	return {
		modeState: r,
		shellState: o.state,
		identity: o.identity
	};
}, zs = (e, t, n, r, i) => {
	let a = t.pages[n.pageId], o = {
		modeId: a.modeId,
		pageId: a.id,
		projectId: Ms(t),
		location: n.location
	}, s = X(e.shellPlacements), c = X(e.modePlacements), l = s.restore?.(o, i, Is(t)) ?? i, u = c.restore?.(o, r) ?? r, d = bs(a, e.modePlacements, u, n), f = d?.state ?? u;
	return {
		mode: f,
		shell: l,
		placements: {
			shell: s.resolve(void 0, l),
			mode: c.resolve(a.modeId, f),
			...d ? { landing: d.identity } : {}
		}
	};
}, Bs = (e, t) => {
	if (e.kind !== "page") return { resource: e.resource };
	let { location: n } = t(e);
	return {
		resource: e.resource,
		section: n.section,
		position: n.position,
		pageContext: {
			page: n.page,
			parent: n.parent,
			params: n.params
		}
	};
}, Vs = (e, t, n, r) => {
	for (let n of t) e.viewers.refreshReference(n.resource, n);
	n ? e.viewers.focusResource(n.resource, n) : r?.kind === "page" && e.pages.getContent() && e.focus.setActiveRegion("main");
}, Hs = (t, n) => {
	if (n = n.map((e) => {
		let n = e.kind === "panel" && e.panel.kind === "page-slot" ? Li(t.modePlacements, e.panel) : void 0;
		return n ? {
			...e,
			kind: "panel",
			panel: n.ref
		} : e;
	}), !n.length) throw Error("Compound navigation requires at least one page or panel target");
	let r = B(t.pages), i = ur(t.pageLocations), a = X(t.modePlacements), o = X(t.shellPlacements), s = t.pages.store.getState(), c = a.getState(), l = o.getState(), u = c, d = l, f = s, p, m = /* @__PURE__ */ new Map(), h = /* @__PURE__ */ new Map(), g = [], _ = /* @__PURE__ */ new Map(), v = /* @__PURE__ */ new Map(), y = (e = f.activeModeId) => ({
		shell: o.resolve(void 0, d),
		mode: a.resolve(e, u)
	});
	for (let e of n) {
		let n = f;
		p = void 0;
		let a = Ds(t, e, f);
		if (a) {
			if (_.set(a.region, a.identity), p = Bs(e, i.resolve), m.set(U(a.identity), p), js(e.open, f, a.identity)) {
				let e = a.identity;
				h.set(U(e), e);
				let n = ks(t, e, p, {
					page: f,
					mode: u,
					shell: d
				});
				f = n.page, u = n.mode, d = n.shell;
			}
		} else {
			if (e.kind === "page") {
				let n = Ms(f), a = i.resolve(e);
				a.consumeRemembered && g.push(a.consumeRemembered);
				let o = f.pages[a.pageId], s = zs(t, f, a, u, d);
				d = s.shell, u = s.mode, f = r.prepare.location({
					pageId: o.id,
					projectId: n,
					location: a.location,
					resource: a.location.resource,
					section: a.location.section,
					position: a.location.position,
					open: a.open,
					action: "preparePageNavigation"
				}, f, s.placements);
			} else if (e.kind === "panel") {
				let n = Ps(t, e, f.activeModeId), i = e.panel;
				if (i.kind === "page-slot") {
					let t = Ls(f, i);
					f = r.prepare.slot({
						pageId: t.id,
						slotId: i.id,
						resource: e.resource,
						open: e.open,
						region: e.region
					}, f, y());
				} else {
					let i = Rs(t, e, n, u, d);
					u = i.modeState, d = i.shellState;
					let a = i.identity;
					f = r.prepare.compose(f, {
						...f,
						activeModeId: n,
						activate: [a],
						action: "preparePanelNavigation"
					}, y(n));
				}
			} else throw Error("Compound navigation accepts only page and panel targets");
			Ns(t, e, n, f), Fs(e, f.reconciliation.activate, _, v);
		}
	}
	let b = r.prepare.compose(s, {
		...f,
		activate: [],
		action: "prepareCompoundOwners"
	}, y()), x = new Set(b.placements.map((e) => U(e.identity))), S = r.prepare.compose(s, {
		...f,
		activate: [..._.values()].filter((e) => x.has(U(e))),
		destinations: [...v.values()],
		action: "prepareCompoundNavigation"
	}, y());
	return { commit: () => e(() => {
		let e = () => {
			As(t, h.values(), s), a.apply(u), o.apply(d);
		}, f = S.location ? i.commit(S, e, g) : (e(), r.publish(S, "navigateCompoundTarget"));
		return u !== c && a.publish(), d !== l && o.publish(), Vs(t, m.values(), p, n.at(-1)), f;
	}) };
}, Us = (e, t) => e.pages.listPages().find((e) => e.ref.extensionId === t.page.extensionId && e.ref.id === t.page.id), Ws = (e, t) => {
	let n = t.panel;
	return n.kind === "shell-placement" ? !!e.shellPlacements.getPlacement(n.id) : n.kind === "page-slot" ? Li(e.modePlacements, n) ? !0 : !!Us(e, n)?.slots.some((e) => e.id === n.id) : !!e.modePlacements.getPlacement(n);
}, Gs = (e, t) => {
	t === "secondary" && !e.shell.getPanelPolicy("secondary").open && e.shell.setRegionOpen("secondary", !0), t === "side" && e.sidePanel.getMode() === "closed" && e.sidePanel.setMode("attached");
}, Ks = (e, t) => Hs(e, [t]).commit(), qs = (e) => Xi({
	getProjectId: () => e().pages.store.getState().projectId,
	resolveDispatcher: () => {
		let t = e();
		return {
			prepareNavigation: (e) => Hs(t, e),
			canOpenPanel: (e) => Ws(t, e),
			canExecuteCommand: (e) => !!t.commands.getCommand(e),
			openPanelTarget: (e) => Ks(t, e),
			openViewerTarget: (e, n) => {
				if (!n?.viewer) throw Error("Viewer navigation requires a calling viewer");
				return t.viewers.change(n.viewer, e, n);
			},
			openPageTarget: (e) => {
				let n = t.pageLocations.navigate(e);
				if (!n.ok) throw Error(n.diagnostic.message);
				return n;
			},
			executeCommand: (e, n, r, i) => t.commands.executeCommand(e, n, {
				...r ? {
					region: r,
					source: "panel-add"
				} : {},
				...i?.viewer ? { placement: i.viewer } : {},
				...i?.projectId ? { projectId: i.projectId } : {},
				removalVersion: i?.removalVersion,
				isViewerCurrent: i?.isViewerCurrent
			}),
			openHref: (e) => globalThis.open(e, "_blank", "noopener,noreferrer")
		};
	}
}), Js = (e, t, n) => e.visible && (n > 0 || t === "main"), Ys = (e, t) => ({
	...e,
	visible: !0,
	headerVisible: !t || e.headerVisible,
	presentation: e.id === "side" && !e.visible ? "attached" : e.presentation
}), Xs = (t) => ({
	getPanelDestinations(e) {
		let n = t(), r = O(n.layout.getLayout(), e);
		return r ? pn(n, r.placement.contributionId) : [];
	},
	movePanel(n, r, i = "end") {
		let a = t(), o = O(a.layout.getLayout(), n);
		if (!o) throw Error(`Panel instance not found: ${n}`);
		if (!D.some((e) => e === o.regionId) || !pn(a, o.placement.contributionId).includes(r)) throw Error(`Panel cannot move to ${r}: ${n}`);
		e(() => {
			o.placement.tabRetention === "preview" && o.placement.placementIdentity && a.pinPlacement(o.placement.placementIdentity);
			let e = a.layout.getLayout(), t = O(e, n), s = e.regions[t.regionId], c = s.widgets.filter((e) => e.widgetId !== n), l = e.regions[r], u = Oe(r === t.regionId ? c : l.widgets, t.placement, i), d = {
				...He(e, n),
				regions: {
					...e.regions,
					[t.regionId]: {
						...s,
						widgets: c,
						visible: Js(s, t.regionId, c.length),
						activeWidgetId: s.activeWidgetId === n ? (c[t.index] ?? c[t.index - 1])?.widgetId : s.activeWidgetId
					},
					[r]: {
						...Ys(l, a.shell.getPanelPolicy(r).showHeader),
						widgets: u.widgets
					}
				}
			}, f = t.placement.role === "location" ? Ke(d, r, n) ?? d : Ge(d, r, t.placement);
			a.layout.restoreLayout({
				...f,
				activeWidgetId: n,
				activeResourceKey: t.placement.resourceKey,
				activeLocationWidgetId: t.placement.role === "location" ? n : e.activeLocationWidgetId
			}), a.layout.reconcilePanelMenus(), Gs(a, r);
		});
	}
}), Zs = (e, t) => {
	let n = t.placementIdentity;
	if (n?.kind !== "page") return !1;
	let r = e.pages.store.getState();
	return !e.layout.getLayout().regions.main.widgets.includes(t) || n.pageId !== r.activePageId || !!r.pages[n.pageId]?.resource && Z(r.pages[n.pageId], t.resource) !== Z(r.pages[n.pageId], r.location?.resource);
}, Qs = (t, n, r, i) => {
	let a = t.pages.store.getState(), o = U(r), s = Oa(a.pageStates, r, i), c = a.placements.flatMap((e) => U(e.identity) === o ? i.kind === "close" ? [] : [{
		...e,
		value: {
			...n,
			pinned: i.open === "pin",
			tabRetention: i.open === "pin" ? "persistent" : "preview"
		}
	}] : [e]);
	e(() => {
		i.kind === "close" ? t.layout.removeWidgetPlacement(n.widgetId) : t.layout.updateWidgetPlacement(n.widgetId, {
			pinned: i.open === "pin",
			tabRetention: i.open === "pin" ? "persistent" : "preview"
		}), B(t.pages).publish({
			...a,
			pageStates: s,
			placements: c,
			reconciliation: W({
				current: a.placements,
				desired: c,
				valuesEqual: (e, t) => JSON.stringify(e) === JSON.stringify(t)
			})
		}, "editSharedPagePlacement");
	});
}, $s = (e) => (t) => {
	let n = e();
	if (t.kind === "page" && L(n.pages.getPage(t.pageId), t)) throw Error("Page content closes through navigation");
	let r = U(t), i = Object.values(n.layout.getLayout().regions).flatMap((e) => e.widgets).find((e) => e.placementIdentity && U(e.placementIdentity) === r);
	if (!i) throw Error(`Placement is not open: ${r}`);
	if (!i.closable) throw Error(`Placement is fixed and cannot close: ${r}`);
	if (t.kind === "page") {
		if (Zs(n, i)) {
			Qs(n, i, t, { kind: "close" });
			return;
		}
		let e = n.pageLocations.closePlacement(t);
		if (!e.ok) throw Error(e.diagnostic.message);
	} else t.kind === "mode" ? n.modePlacements.closePlacement(t) : n.shellPlacements.closePlacement(t);
}, ec = (e, t, n, r) => {
	n.kind === "page" && Zs(e, t) ? Qs(e, t, n, {
		kind: "retention",
		open: r
	}) : n.kind === "page" ? e.pages.pinPlacement(n, r) : n.kind === "mode" ? e.modePlacements.updatePlacement(n, { open: r }) : e.shellPlacements.updatePlacement(n, { open: r });
}, tc = (e) => (t, n = !0) => {
	let r = e();
	if (t.kind === "page" && L(r.pages.getPage(t.pageId), t)) throw Error("Page content has no tab retention");
	let i = U(t), a = Object.values(r.layout.getLayout().regions).flatMap((e) => e.widgets).find((e) => e.placementIdentity && U(e.placementIdentity) === i);
	if (!a) throw Error(`Placement is not open: ${i}`);
	let o = n ? "pin" : "preview";
	a.tabRetention === "persistent" !== n && (a.resource ? ec(r, a, t, o) : r.layout.updatePanel(a.widgetId, {
		pinned: n,
		strategy: { kind: n ? "persistent" : "preview" }
	}));
}, nc = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of Object.values(e.regions)) for (let e of n.widgets) {
		if (!e.placementIdentity) continue;
		let r = U(e.placementIdentity);
		if (t.has(r)) throw Error(`Duplicate rendered placement identity: ${r}`);
		t.set(r, {
			region: n.id,
			placement: e
		});
	}
	return t;
}, rc = (e) => {
	let t = /* @__PURE__ */ new Map();
	for (let n of Object.values(e.regions)) for (let e of n.widgets) {
		if (t.has(e.widgetId)) throw Error(`Duplicate rendered widget ID: ${e.widgetId}`);
		t.set(e.widgetId, e.placementIdentity ? U(e.placementIdentity) : null);
	}
	return t;
}, ic = (e, t, n) => {
	if (!D.some((t) => t === e)) return {};
	let r = t.tabRetention ?? n?.tabRetention ?? "persistent";
	return {
		tabRetention: r,
		pinned: r === "persistent"
	};
}, ac = (e) => e.value.role === "sub-panel" && e.identity.kind === "page", oc = (e, t, n) => ac(e) ? e.value.ownerResourceKey ?? t?.ownerResourceKey ?? n?.ownerResourceKey : e.value.ownerResourceKey, sc = (e) => {
	if (e.desired.identity.kind !== "mode") return;
	let t = e.desired.identity;
	return [...e.current.entries()].find(([n, r]) => !e.desiredKeys.has(n) && !e.transferredCurrentKeys.has(n) && r.placement.placementIdentity?.kind === "mode" && (r.placement.placementIdentity.modeId !== t.modeId || r.placement.placementIdentity.placementId !== t.placementId) && r.region === e.desired.region && r.placement.contributionId === e.desired.value.contributionId && r.placement.viewId === e.desired.value.viewId);
}, cc = (e, t, n, r) => {
	let i = new Set(e.map((e) => e.widgetId)), a = [...e, ...t.filter((e) => !i.has(e.widgetId) && e.placementIdentity && n.has(U(e.placementIdentity)))];
	if (!r) return a;
	let o = new Map(r.map((e, t) => [e, t])), s = a.sort((e, t) => (o.get(e.widgetId) ?? r.length) - (o.get(t.widgetId) ?? r.length)), c = new Map(t.map((e, t) => [e.widgetId, t])), l = s.filter((e) => e.placementIdentity?.kind !== "page").sort((e, n) => (c.get(e.widgetId) ?? t.length) - (c.get(n.widgetId) ?? t.length)), u = 0;
	return s.map((e) => e.placementIdentity?.kind === "page" ? e : l[u++]);
}, lc = (e, t) => {
	let n = [], r = /* @__PURE__ */ new Set(), i = rc(e.layout), a = e.modeLayout ? nc(e.modeLayout) : /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new Set(), s = new Map(e.destinations?.map((e) => [U(e.identity), e.region])), c = kr({
		shell: e.placements.filter((e) => e.identity.kind === "shell"),
		mode: e.placements.filter((e) => e.identity.kind === "mode"),
		page: e.placements.filter((e) => e.identity.kind === "page")
	}).placements, l = new Set(c.map((e) => U(e.identity))), u = /* @__PURE__ */ new Set();
	for (let e of c) {
		let c = U(e.identity);
		if (r.has(c)) throw Error(`Duplicate desired placement identity: ${c}`);
		r.add(c);
		let d = t.get(c) ?? a.get(c), f = d ? void 0 : sc({
			current: t,
			desired: e,
			desiredKeys: l,
			transferredCurrentKeys: u
		}), p = f?.[0];
		p && u.add(p);
		let m = d?.placement.widgetId ?? f?.[1].placement.widgetId ?? e.value.widgetId, h = i.get(m);
		if (h !== void 0 && h !== c && h !== p) throw Error(`Rendered widget ID belongs to another placement: ${m}`);
		if (o.has(m)) throw Error(`Duplicate desired widget ID: ${m}`);
		o.add(m);
		let g = oc(e, d?.placement, f?.[1].placement), _ = s.get(c) ?? d?.region ?? e.region;
		n.push({
			identity: e.identity,
			region: _,
			placement: {
				...e.value,
				...ic(_, e.value, d?.placement),
				widgetId: m,
				placementIdentity: e.identity,
				...g ? { ownerResourceKey: g } : {}
			},
			...p ? { transferredFromKey: p } : {}
		});
	}
	return n;
}, uc = (e, t, n, r) => {
	let i = new Set(d.filter((e) => e !== "side")), a = { ...e.regions }, o = new Map(t.map((e) => [U(e.identity), e])), s = new Set(t.flatMap((e) => e.transferredFromKey ?? []));
	for (let c of E) {
		let l = e.regions[c], u = t.some((e) => e.region === c && e.identity.kind === "page" && e.placement.role === "location"), d = /* @__PURE__ */ new Set(), f = cc(l.widgets, r?.regions[c].widgets ?? [], o, l.savedWidgetOrder).flatMap((e) => {
			if (!e.placementIdentity) return c === "main" && u && e.role === "location" ? [] : [e];
			let t = U(e.placementIdentity), r = o.get(t);
			return r ? r.region === c ? (d.add(t), [r.placement]) : [] : n.has(t) || s.has(t) ? [] : [e];
		});
		for (let e of t) {
			let t = U(e.identity);
			e.region === c && !d.has(t) && f.push(e.placement);
		}
		let p = Ee(f, t.find((e) => e.region === c && e.placement.tabRetention === "preview")?.placement.widgetId ?? l.activeWidgetId), m = l.widgets.find((e) => e.widgetId === l.activeWidgetId), h = [
			l.activeWidgetId,
			m?.tabRetention === "preview" ? p.widgets.find((e) => e.tabRetention === "preview")?.widgetId : void 0,
			r?.regions[c].activeWidgetId
		].find((e) => p.widgets.some((t) => t.widgetId === e)) ?? p.widgets[0]?.widgetId, g = l.widgets.length === 0 && f.some((e) => !e.hiddenByDefault), _ = (c === "side" || c === "secondary") && l.widgets.length > 0 && f.length === 0;
		a[c] = {
			...l,
			widgets: p.widgets,
			savedWidgetOrder: void 0,
			activeWidgetId: h,
			...i.has(c) ? { visible: l.visible || g } : {},
			..._ ? { visible: !1 } : {}
		};
	}
	return {
		...e,
		regions: a
	};
}, dc = (e) => {
	let t = new Set(e.desired.flatMap((e) => e.transferredFromKey ?? [])), n = e.layout;
	for (let [r, i] of e.current) e.removedKeys.has(r) && !t.has(r) && (n = He(n, i.placement.widgetId));
	let r = n.activeLocationWidgetId ? O(n, n.activeLocationWidgetId)?.placement : void 0, i = k(n), a = r?.widgetId ?? i?.widgetId, o = n.activeWidgetId ? O(n, n.activeWidgetId)?.placement : void 0, s = a ? O(n, a)?.placement : Object.values(n.regions).flatMap((e) => e.widgets)[0];
	return {
		...n,
		activeWidgetId: o?.widgetId ?? s?.widgetId,
		activeLocationWidgetId: a,
		activeResourceKey: o?.resourceKey ?? s?.resourceKey
	};
}, fc = (e, t) => {
	let n = k(e), r = n?.resourceKey;
	if (!r) return e;
	let i = n.placementIdentity, a = new Map(t.map((e) => [U(e.identity), e])), o = Object.fromEntries(Object.entries(e.regions).map(([e, t]) => [e, {
		...t,
		widgets: t.widgets.map((e) => {
			if (e.role !== "sub-panel" || !e.placementIdentity) return e;
			let t = a.get(U(e.placementIdentity));
			return !t || t.identity.kind !== "page" || i?.kind === "page" && (t.identity.pageId !== i.pageId || t.identity.slotId === i.slotId) ? e : {
				...e,
				ownerResourceKey: r
			};
		})
	}]));
	return {
		...e,
		regions: o
	};
}, pc = (e, t) => {
	let n = nc(e.layout), r = lc(e, n), i = dc({
		current: n,
		desired: r,
		removedKeys: t,
		layout: uc(e.layout, r, t, e.modeLayout)
	}), a = new Map(r.map((e) => [U(e.identity), e]));
	for (let t of e.activate ?? []) {
		let e = a.get(U(t));
		if (!e) throw Error(`Cannot activate missing rendered placement: ${U(t)}`);
		i = Ge(i, e.region, e.placement);
	}
	return fc(i, r);
}, mc = (e) => {
	let t = new Set(e.placements.map((e) => U(e.identity))), n = nc(e.layout);
	return pc(e, new Set([...n.keys()].filter((e) => !t.has(e))));
}, hc = (e) => pc(e, new Set(e.remove.map(U))), gc = (t) => {
	let n = t.pages.store.getState(), r = n.activePageId ? n.pages[n.activePageId] : void 0;
	if (!r || !n.projectId || !n.location) return;
	let i = X(t.modePlacements), a = X(t.shellPlacements), o = {
		staticOverrides: new Map(i.getState().staticOverrides),
		resourceInstances: new Map(i.getState().resourceInstances)
	}, s = {
		staticOverrides: new Map(a.getState().staticOverrides),
		resourceInstances: new Map(a.getState().resourceInstances)
	};
	for (let e of t.modePlacements.listPlacements(n.activeModeId)) ji(o, e.id);
	for (let e of t.shellPlacements.listPlacements()) [
		"main",
		"secondary",
		"side"
	].includes(e.region) && ji(s, e.id);
	let c = B(t.pages), l = c.prepare.location({
		pageId: r.id,
		projectId: n.projectId,
		location: n.location,
		resource: n.location.resource,
		section: n.location.section,
		action: "resetWorkbenchLayout"
	}, {
		...n,
		pageStates: {
			...n.pageStates,
			[G(r, n.location, c.resources)]: ga(r)
		}
	}, {
		mode: i.resolve(n.activeModeId, o),
		shell: a.resolve(void 0, s)
	}), u = t.layout.getLayout(), d = t.layout.store.getInitialState().layout, f = {
		...u,
		arrangement: d.arrangement,
		regions: Object.fromEntries(Object.entries(u.regions).map(([e, t]) => [e, [
			"main",
			"secondary",
			"side"
		].includes(e) ? {
			...d.regions[e],
			widgets: [],
			activeWidgetId: void 0,
			headerVisible: void 0
		} : t])),
		locationSubPanelSelections: {},
		activeWidgetId: void 0,
		activeLocationWidgetId: void 0
	};
	e(() => {
		i.apply(o), a.apply(s), t.layout.restoreLayout(mc({
			layout: f,
			placements: l.placements,
			activate: l.reconciliation.activate.map((e) => e.identity)
		})), c.publish(l, "resetWorkbenchLayout");
	});
}, _c = (e) => {
	let t = /* @__PURE__ */ new Set();
	return {
		resetLayout() {
			gc(e());
			for (let e of t) e();
		},
		onDidResetLayout(e) {
			return t.add(e), r(() => t.delete(e));
		}
	};
}, vc = (t, n, r) => {
	if (n.projectId && n.projectId !== t.pages.store.getState().projectId) return;
	let i = new Set(r.map(U));
	e(() => {
		for (let e of ["mode", "shell"]) {
			let r = X(e === "mode" ? t.modePlacements : t.shellPlacements), a = r.getState(), o = new Map([...a.resourceInstances].map(([r, a]) => [r, a.filter((a) => {
				if (h(a.resource) !== h(n)) return !0;
				let o = e === "shell" ? {
					kind: e,
					placementId: r,
					instanceKey: a.instanceKey
				} : {
					kind: e,
					placementId: r,
					instanceKey: a.instanceKey,
					modeId: t.modePlacements.listPlacements().find((e) => e.id === r).modeId
				};
				return i.has(U(o));
			}).map((e) => Nr(e, t.pages.listPages(), (e) => h(e) === h(n)))]));
			r.apply({
				...a,
				resourceInstances: o
			});
		}
	});
}, yc = (t, n, r, i) => e(() => {
	vc(t, n, r), i(n), t.pageLocations.removeResource(n, r);
}), bc = (e, t) => {
	let n = e?.fullscreen.store.getState();
	if (n?.active) return t === "main" || t === "side" && n.sideOpen;
}, xc = (e) => {
	let t = n({
		name: "workbench.fullscreen",
		initialState: {
			active: !1,
			sideOpen: !1
		}
	}), r = () => e().shell.getPanelPolicy("side"), i = () => {
		let t = e().modes, n = t.getActiveModeId();
		return !n || t.getMode(n)?.canFullscreen !== !1;
	};
	return {
		store: t,
		canEnter: i,
		canShowSide: () => {
			let e = r();
			return t.getState().active && e.provided && e.floatable && e.canOpen;
		},
		enter() {
			if (!i()) throw Error("Fullscreen is not available in this mode");
			if (t.getState().active) return;
			let n = r();
			t.setState({
				active: !0,
				sideOpen: n.open && n.floatable
			}), e().focus.setActiveRegion("main");
		},
		exit: () => {
			t.getState().active && (t.setState({
				active: !1,
				sideOpen: !1
			}), e().focus.clearFocus());
		},
		showSide() {
			if (!t.getState().active) throw Error("Main fullscreen is not active");
			let n = r();
			if (!n.provided) throw Error("Panel is not provided: side");
			if (!n.floatable) throw Error("Panel cannot float: side");
			if (!n.canOpen) throw Error("Panel cannot open: side");
			t.setState({ sideOpen: !0 }), e().focus.setActiveRegion("side");
		},
		hideSide() {
			if (!t.getState().active) throw Error("Main fullscreen is not active");
			if (!r().canClose) throw Error("Panel cannot close: side");
			t.setState({ sideOpen: !1 }), e().focus.clearFocus();
		}
	};
}, Sc = (e) => {
	let t = [
		e.modes.store.subscribeSelector((e) => e.activeModeId, e.fullscreen.exit),
		e.pages.store.subscribeSelector((e) => e.projectId, e.fullscreen.exit),
		e.layout.store.subscribe((t, n) => {
			if (!e.fullscreen.store.getState().sideOpen) return;
			let r = t.layout.regions.side, i = n.layout.regions.side, a = i.visible && !r.visible, o = i.widgets.length > 0 && r.widgets.length === 0;
			(a || o) && e.shell.getPanelPolicy("side").canClose && e.fullscreen.hideSide();
		})
	];
	for (let [t, n, r] of [
		[
			"enterMainFullscreen",
			"Enter Main fullscreen",
			e.fullscreen.enter
		],
		[
			"exitMainFullscreen",
			"Exit Main fullscreen",
			e.fullscreen.exit
		],
		[
			"showFullscreenSide",
			"Show fullscreen Side Panel",
			e.fullscreen.showSide
		],
		[
			"hideFullscreenSide",
			"Hide fullscreen Side Panel",
			e.fullscreen.hideSide
		]
	]) e.commands.registerCommand({
		id: `workbench.${t}`,
		label: n,
		category: "Workbench"
	}, {
		execute: r,
		isEnabled: t === "enterMainFullscreen" ? e.fullscreen.canEnter : void 0
	});
	return () => {
		for (let e of t) e();
		e.fullscreen.exit();
	};
}, Cc = (e) => `${e.extensionId ?? ""}:${e.id}`, wc = (e) => e.parent ? [...wc(e.parent), e] : [e], Tc = (e) => e.title === void 0 ? e.ref.id : p(e.title) ? e.title.default ?? e.title.$l10n : e.title, Ec = (e, t) => e?.main.kind === "view" && (!e.resource || !!t.resource), Dc = (e, t) => {
	let n = e?.main.empty;
	return t && n && "view" in n ? n.breadcrumb : void 0;
}, Oc = (e, t) => {
	if (e?.main.kind !== "panels" || t.resource) return;
	let n = e.main.landing;
	return e.slots.find((e) => e.id === n);
}, kc = (e, t) => {
	let n = e.parent;
	return !!(e.resource && n?.resource && Cc(e.page) !== Cc(n.page) && t.toUri(t.normalize(e.resource)) === t.toUri(t.normalize(n.resource)));
}, Ac = (e, t, n) => {
	let r = kc(e, n);
	return {
		title: !r && e.resource?.label || (t ? Tc(t) : e.page.id),
		icon: r ? t?.icon ?? e.resource?.icon : e.resource?.icon ?? t?.icon
	};
}, jc = (e) => {
	let t = new Map(e.pages.map((e) => [Cc(e.ref), e])), n = wc(e.location);
	return n.map((r, i) => {
		let a = t.get(Cc(r.page)), o = I(a) && Ec(a, r), s = Dc(a, i === n.length - 1 && !o && e.layout.regions.main.widgets.length === 0), c = Ac(r, a, e.resources), l = {
			title: s?.label ?? c.title,
			icon: s?.icon ?? c.icon,
			...s?.menu ? { menu: s.menu } : {},
			...Tn(r, e) ? { startsLevel: !0 } : {},
			...!s && r.resource ? { resource: e.resources.normalize(r.resource) } : {}
		}, u = Oc(a, r), d = a?.main.kind === "panels" && a.main.landing && typeof a.main.landing != "string";
		return (i < n.length - 1 && (r.resource || Ec(a, r)) || u && e.openPanel || d) && (l.onClick = () => {
			e.navigate(An(r)), a && u && e.openPanel?.(a.id, u.id);
		}), l;
	});
}, Mc = (e) => e.breadcrumbs.setItems(jc(e)), Nc = (e) => {
	let t, n = () => {
		let n = e.pages.store.getState();
		!n.activePageId || !n.location ? (t?.dispose(), t = void 0) : (t?.dispose(), t = Mc({
			breadcrumbs: e.breadcrumbs,
			location: n.location,
			layout: e.layout.getLayout(),
			pages: Object.values(n.pages),
			navigationTrees: e.navigationTrees,
			modes: e.modes,
			resources: e.resources,
			navigate: (t) => {
				e.locations.navigate(t);
			},
			openPanel: (t, n) => e.pages.openSlot({
				pageId: t,
				slotId: n
			})
		}));
	}, i = B(e.pages).onDidCommit(n), a = e.layout.store.subscribeSelector((e) => e.layout.regions.main.widgets.length, n);
	return n(), r(() => {
		i.dispose(), a(), t?.dispose();
	});
}, Pc = () => {
	let e = [{ url: "/" }], t = 0, n = /* @__PURE__ */ new Set(), r = () => {
		for (let r of n) r(e[t]);
	};
	return {
		current: () => e[t],
		push: (n) => {
			e.splice(t + 1), e.push(n), t = e.length - 1;
		},
		replace: (n) => {
			e[t] = n;
		},
		back: () => {
			t !== 0 && (--t, r());
		},
		forward: () => {
			t >= e.length - 1 || (t += 1, r());
		},
		onPopState: (e) => (n.add(e), { dispose: () => n.delete(e) })
	};
}, Fc = () => {
	let e = /* @__PURE__ */ new Map();
	return {
		load: (t) => e.get(t),
		save: (t, n) => e.set(t, n)
	};
}, Ic = (e) => new Set(Object.values(e?.regions ?? {}).flatMap((e) => e.id === "main" ? [] : e.widgets.map((e) => e.widgetId))), Lc = (e, t, n, r) => {
	let i = { ...e.regions }, a = r?.regions.main ?? n.regions.main, o = Ic(t);
	for (let s of Object.values(e.regions)) {
		if (!Gt(s.id)) continue;
		let e = s.id === "main" ? a.widgets.filter((e) => !o.has(e.widgetId)) : [], c = t?.regions[s.id] ?? n.regions[s.id];
		i[s.id] = {
			...c,
			headerVisible: r?.regions[s.id].headerVisible,
			savedWidgetOrder: s.id === "main" ? a.savedWidgetOrder : t?.regions[s.id].widgets.map((e) => e.widgetId),
			widgets: [...e, ...s.id === "main" ? [] : t?.regions[s.id].widgets ?? []],
			activeWidgetId: s.id === "main" ? a.activeWidgetId : c.activeWidgetId ?? s.activeWidgetId
		};
	}
	return {
		...e,
		arrangement: t?.arrangement ?? n.arrangement,
		regions: i,
		activeWidgetId: t?.activeWidgetId && o.has(t.activeWidgetId) ? t.activeWidgetId : e.activeWidgetId,
		activeLocationWidgetId: t?.activeLocationWidgetId && o.has(t.activeLocationWidgetId) ? t.activeLocationWidgetId : e.activeLocationWidgetId
	};
}, Rc = (e) => e.placementIdentity ? U(e.placementIdentity) : `widget:${e.widgetId}`, zc = (e, t, n, r) => Object.values(e.regions).flatMap((i) => i.widgets.map((a) => {
	let o = a.placementIdentity, s = o?.kind === "page" ? t.find((e) => e.id === o.pageId) : void 0, c = a;
	i.id === "main" && (n || L(s, o)) ? c = void 0 : s && r && (c = r(s, a, e) ?? (L(s, o) ? void 0 : a));
	let l = Number(c === a) * 4 + Number(a.widgetId === e.activeWidgetId) * 2 + Number(a.widgetId === i.activeWidgetId);
	return {
		widget: a,
		next: c,
		rank: l
	};
})), Bc = (e, t, n, r) => {
	let i = ["workbench-main:", "workbench-collection-main:"].find((t) => e?.startsWith(t)), a = i ? JSON.parse(e.slice(i.length))[2] : void 0, o = zc(t, n, I(n.find((e) => e.id === a)), r), s = /* @__PURE__ */ new Map();
	for (let e of o) {
		if (!e.next) continue;
		let t = Rc(e.next), n = s.get(t);
		(!n || e.rank > n.rank) && s.set(t, e);
	}
	let c = new Map(o.filter((e) => e.next !== e.widget).map(({ widget: e, next: t }) => [e.widgetId, t ? s.get(Rc(t))?.next?.widgetId : void 0]));
	if (!c.size) return t;
	let l = new Map(o.flatMap(({ widget: e, next: t }) => t && s.get(Rc(t))?.widget === e ? [[e, t]] : [])), u = (e) => e && c.has(e) ? c.get(e) : e, d = { ...t.regions };
	for (let e of Object.values(t.regions)) {
		let t = e.widgets.flatMap((e) => l.get(e) ? [l.get(e)] : []), n = new Set(t.map((e) => e.widgetId)), r = u(e.activeWidgetId);
		d[e.id] = {
			...e,
			widgets: t,
			activeWidgetId: r && n.has(r) ? r : t[0]?.widgetId,
			savedWidgetOrder: e.savedWidgetOrder ? [...new Set(e.savedWidgetOrder.flatMap((e) => {
				let t = u(e);
				return t && n.has(t) ? [t] : [];
			}))] : void 0
		};
	}
	let f = u(t.activeWidgetId), p = [...l.values()].find((e) => e.widgetId === f);
	return {
		...t,
		regions: d,
		activeWidgetId: f,
		activeLocationWidgetId: c.has(t.activeLocationWidgetId ?? "") ? void 0 : t.activeLocationWidgetId,
		activeResourceKey: h(p?.resource)
	};
}, Vc = (e) => {
	let t = new Set(lc(e, nc(e.layout)).filter((e) => e.region !== "main").map((e) => U(e.identity)));
	return {
		...e,
		layout: {
			...e.layout,
			regions: {
				...e.layout.regions,
				main: {
					...e.layout.regions.main,
					widgets: [],
					activeWidgetId: void 0
				}
			}
		},
		placements: e.placements.filter((e) => t.has(U(e.identity))),
		activate: e.activate?.filter((e) => t.has(U(e)))
	};
}, Hc = (e) => {
	let t = e.main.kind === "panels" ? e.main.landing : void 0;
	return t && typeof t != "string" ? t : void 0;
}, Uc = (e, t) => e.id === t?.id && e.extensionId === t.extensionId, Wc = (e, t) => !e.resource || !t.resource ? !e.resource && !t.resource : e.resource.kinds.some((e) => q(t.resource, {
	type: e.id,
	id: "",
	extensionId: e.extensionId
})), Gc = (e, t, n) => {
	let r = Hc(e);
	if (!r) return;
	let i = t.getPlacement(r);
	if (!i || i.modeId !== e.modeId) throw Error(`Page "${e.id}" requires a landing placement in its mode`);
	if (i.item.kind === "binding") {
		let t = i.item.binding;
		if (!e.resource || t.cardinality !== "many" || i.region !== "main" || !e.resource.kinds.every((e) => q(t, {
			type: e.id,
			id: "",
			extensionId: e.extensionId
		}))) throw Error(`Page "${e.id}" requires a compatible many-resource Main landing viewer`);
	}
	if (n.some((t) => t.id !== e.id && t.modeId === e.modeId && Uc(r, Hc(t)) && Wc(e, t))) throw Error(`Page "${e.id}" must have an unambiguous landing route`);
}, Kc = (e, t, n, r) => {
	let i = lc({
		layout: n,
		modeLayout: r,
		placements: e.placements,
		destinations: e.reconciliation.destinations
	}, nc(n)), a = [
		...e.reconciliation.activate,
		...e.reconciliation.add,
		...e.reconciliation.update.map((e) => e.desired)
	].filter((e) => e.value.tabRetention === "preview").map((e) => U(e.identity)), o = /* @__PURE__ */ new Set();
	for (let t of Object.values(n.regions)) {
		if (t.id === "main" && I(e.pages[e.activePageId ?? ""])) continue;
		let n = i.filter((e) => e.region === t.id), r = a.map((e) => n.find((t) => U(t.identity) === e)).find(Boolean), s = Ee(n.map((e) => e.placement), r?.placement.widgetId ?? t.activeWidgetId);
		for (let e of s.replaced) e.placementIdentity && o.add(U(e.placementIdentity));
	}
	return qc(e, t, o);
}, qc = (e, t, n) => {
	if (!n.size) return e;
	let r = e.placements.filter((e) => !n.has(U(e.identity))), i = e.pageStates;
	for (let t of e.placements) {
		let e = t.identity;
		e.kind === "page" && n.has(U(e)) && (i = Oa(i, e, { kind: "close" }));
	}
	return {
		...e,
		placements: r,
		pageStates: i,
		reconciliation: W({
			current: t.placements,
			desired: r,
			destinations: e.reconciliation.destinations,
			activate: e.reconciliation.activate.filter((e) => !n.has(U(e.identity))).map((e) => e.identity),
			valuesEqual: (e, t) => JSON.stringify(e) === JSON.stringify(t)
		})
	};
}, Jc = (e, t, n) => {
	if (!t.activePageId || t.projectId !== e.projectId || t.activeModeId !== e.activeModeId || !Q(e, t)) return [];
	let r = new Set(e.reconciliation.activate.map((e) => U(e.identity)));
	return Object.values(n.regions).flatMap((e) => e.widgets.filter((e) => e.tabRetention === "preview" && (!e.placementIdentity || !r.has(U(e.placementIdentity)))));
}, Yc = (e, t, n) => {
	let r = Jc(e, t, n), i = qc(e, t, new Set(r.flatMap((t) => {
		if (!t.placementIdentity) return [];
		let n = U(t.placementIdentity), r = e.placements.find((e) => U(e.identity) === n);
		return r && (r.value.tabRetention ?? t.tabRetention) === "preview" && h(r.value.resource) === h(t.resource) ? [n] : [];
	}))), a = i.pageStates;
	for (let e of r) {
		let t = e.placementIdentity;
		t?.kind === "page" && (a = Oa(a, t, { kind: "close" }));
	}
	return r.length ? {
		...i,
		pageStates: a
	} : i;
}, Xc = (e) => {
	let { state: t, previous: n, sharedLayout: r } = e, i = new Set(r ? Jc(t, n, r).map((e) => e.widgetId) : []), a = /* @__PURE__ */ new Map();
	for (let t of ["side", "secondary"]) for (let n of r?.regions[t].widgets ?? []) {
		let t = n.placementIdentity;
		t && n.resource && !i.has(n.widgetId) && e.isResourceViewer(t) && a.set(e.resourceKey(n.resource), U(t));
	}
	let o = t.placements.filter((t) => {
		if (t.region !== "main" || !t.value.resource || !e.isResourceViewer(t.identity)) return !1;
		let n = a.get(e.resourceKey(t.value.resource));
		return n !== void 0 && n !== U(t.identity);
	});
	if (!o.length) return t;
	let s = new Set(o.map((e) => U(e.identity))), c = t.placements.filter((e) => !s.has(U(e.identity))), l = t.pageStates;
	for (let e of o) e.identity.kind === "page" && (l = Oa(l, e.identity, { kind: "close" }));
	return {
		...t,
		pageStates: l,
		placements: c,
		reconciliation: W({
			current: n.placements,
			desired: c,
			destinations: t.reconciliation.destinations,
			activate: t.reconciliation.activate.filter((e) => !s.has(U(e.identity))).map((e) => e.identity),
			valuesEqual: (e, t) => JSON.stringify(e) === JSON.stringify(t)
		})
	};
}, Zc = (e, t, n) => {
	let r = e.registry.store.getState(), i = e.layout.getLayout(), a = t.activeModeId ? e.loadModeLayout?.(t.projectId, t.activeModeId) : void 0;
	if (n === "select") return ss({
		state: t,
		previous: r,
		layout: i,
		pageLayout: i,
		modeLayout: a,
		getWidget: e.layout.getWidget
	});
	let o = e.loadPageLayout?.(t), s = Kc(ss({
		state: Yc(t, r, i),
		previous: r,
		layout: i,
		pageLayout: o,
		modeLayout: a,
		getWidget: e.layout.getWidget
	}), r, o ?? i, a);
	return e.isResourceViewer ? Xc({
		state: s,
		previous: r,
		sharedLayout: t.projectId === r.projectId && t.activeModeId === r.activeModeId ? i : a,
		isResourceViewer: e.isResourceViewer,
		resourceKey: e.registry.resourceReferenceKey
	}) : s;
}, Qc = (e) => e ? e === "pin" ? {
	pinned: !0,
	tabRetention: "persistent"
} : {
	pinned: !1,
	tabRetention: "preview"
} : {}, $c = (e, t, n) => {
	let r = e.resource, i = n.getView(e.viewId);
	if (!i) throw Error(`Workbench page view is not registered: ${e.viewId}`);
	let a = z(e.pageId, e.slotId), o = t.getWidget(a);
	if (!o) throw Error(`Workbench page placement is not registered: ${e.pageId}.${e.slotId}`);
	return {
		...Se(`workbench.page.${encodeURIComponent(U(e.identity))}`, o, {
			viewId: e.viewId,
			title: r?.label ?? i.title ?? o.title,
			role: e.role === "primary" ? "location" : "sub-panel",
			closable: e.closable,
			...r ? { resource: r } : {},
			...Qc(e.open)
		}),
		...e.section ? { section: e.section } : {},
		...e.position ? { position: e.position } : {},
		pageContext: e.pageContext,
		placementIdentity: e.identity
	};
}, el = (e, t) => {
	let n = t ?? e;
	return {
		...n,
		regions: {
			...n.regions,
			main: {
				...e.regions.main,
				headerVisible: t?.regions.main.headerVisible
			}
		}
	};
}, tl = (e, t) => {
	let n = e.layout.getPersistenceScope();
	return e.layout.store.subscribe((r, i) => {
		let a = e.layout.getPersistenceScope(), o = n !== a;
		if (n = a, t() || o) return;
		let s = new Set(Object.values(r.layout.regions).flatMap((e) => e.widgets.flatMap((e) => e.placementIdentity ? [U(e.placementIdentity)] : []))), c = e.registry.store.getState(), l = new Set(c.placements.map((e) => U(e.identity))), u = new Set(Object.values(i.layout.regions).flatMap((e) => e.widgets.flatMap((e) => {
			if (e.tabRetention !== "preview" || !e.placementIdentity) return [];
			let t = U(e.placementIdentity);
			return l.has(t) && !s.has(t) ? [t] : [];
		})));
		u.size && B(e.registry).publish(qc(c, c, u), "removeReplacedTrayPreviews");
	});
}, nl = (e, t) => {
	let n = [...Object.values(e.getLayout().regions).flatMap((e) => e.widgets), ...t ? [t] : []].filter((e) => !!e.placementIdentity);
	for (let t of n) {
		let n = e.getWidget(t.contributionId);
		for (let r of n?.ownedPanelMenuIds ?? []) {
			let n = e.getWidget(r);
			n && e.openWidget(r, {
				pinned: !0,
				role: "panel-menu",
				viewId: n.rendererId,
				resource: t.resource,
				title: n.region.endsWith("-left-menu") ? t.resource?.label : n.title
			});
		}
	}
	e.reconcilePanelMenus();
}, rl = (e) => {
	let t = h(e.location?.resource);
	return t ? e.placements.map((n) => n.value.role === "sub-panel" && ts({
		...n.value,
		placementIdentity: n.identity
	}, e) ? {
		...n,
		value: {
			...n.value,
			ownerResourceKey: t
		}
	} : n) : e.placements;
}, il = (e, t, n, r) => !!(e.activeModeId && e.projectId === t.projectId && n && r), al = (e, t, n) => n ? mc(e) : hc({
	...e,
	remove: t.reconciliation.remove.map((e) => e.identity)
}), ol = (e, t, n) => n ? [] : t.reconciliation.activate.length > 0 ? t.reconciliation.activate : e.reconciliation.activate, sl = (e, t, n) => {
	for (let r of n) {
		let n = U(r.identity), i = Object.values(t.regions).find((e) => e.widgets.some((e) => e.placementIdentity && U(e.placementIdentity) === n));
		i && e.revealRegion?.(i.id);
	}
}, cl = (e, t, n, r = e.registry.store.getState()) => {
	let i = e.layout.getPersistenceScope(), a = e.registry.store.getState(), o = a.activeModeId ? e.layout.store.getInitialState().layout : e.layout.getLayout(), s = a.activeModeId !== t.activeModeId || a.projectId !== t.projectId, c = t.activeModeId ? e.loadModeLayout?.(t.projectId, t.activeModeId) : void 0, l = e.loadPageLayout?.(t), u = n === "selection" ? el(e.layout.getLayout(), l) : l, d = il(a, t, s, c);
	if (n !== "scope-restore") {
		let r = e.layout.getLayout();
		if (s && a.activeModeId && e.saveModeLayout?.(a.projectId, a.activeModeId, e.layout.getLayout()), n !== "selection") for (let n of Jc(t, a, e.layout.getLayout())) e.layout.removeWidgetPlacement(n.widgetId);
		Q(t, a) && e.savePageMain?.(a, e.layout.getLayout(), r);
	}
	return tn(e.modes, t.activeModeId, () => {
		n !== "scope-restore" && e.beforeApply?.(t);
		let l = e.registry.store.getState(), f = l === r ? t : l, p = n === "scope-restore" || e.layout.getPersistenceScope() !== i, m = s || p || Q(t, a), h = ol(t, f, d), g = I(f.pages[f.activePageId ?? ""]), _ = {
			layout: m ? Lc(e.layout.getLayout(), c, o, u) : e.layout.getLayout(),
			modeLayout: c,
			placements: rl(f),
			activate: h.map((e) => e.identity),
			destinations: n === "scope-restore" ? void 0 : f.reconciliation.destinations
		}, v = al(g ? Vc(_) : _, f, m), y = f.activeModeId ? e.modes.getMode(f.activeModeId) : void 0, b = Yt(v, y, (t) => e.layout.getRegionSettings(t, y?.id));
		e.layout.restoreLayout(et(b, e.layout.getRegionSize)), nl(e.layout, ma(f)), n !== "scope-restore" && sl(e, v, h);
	}), d ? "restore-mode" : "open-page";
}, ll = (e) => {
	let t = !1, n = B(e.registry).connectRuntime((n, r) => {
		let i = e.registry.store.getState();
		t = !0;
		try {
			return cl(e, n, r === "select" ? "selection" : "transition", i);
		} finally {
			t = !1;
		}
	}, (t, n) => Zc(e, t, n)), i = tl(e, () => t), a = e.layout.onDidChangePersistenceScope(() => {
		let n = e.registry.store.getState();
		!t && n.activePageId && cl(e, n, "scope-restore");
	});
	return r(() => {
		a.dispose(), i(), n.dispose();
	});
}, ul = (e) => {
	let t = e.resources ?? re, n = Ya({
		validateLanding: e.validateLanding,
		restorePageState: e.restorePageState,
		validateMode: (t) => {
			if (!e.modes.getMode(t)) throw Error(`Workbench mode not registered: ${t}`);
		},
		resolveShellPlacements: (t) => e.shellPlacements.resolvePlacements(t),
		resolveModePlacements: (t, n, r, i) => e.modePlacements.resolvePlacements(t, r ? {
			modeId: t,
			location: n,
			projectId: r,
			pageId: i
		} : void 0),
		resolveLanding: (t, n) => {
			let r = X(e.modePlacements), i = r.restore({
				...n,
				modeId: t.modeId,
				pageId: t.id
			}), a = bs(t, e.modePlacements, i, n);
			if (a) return {
				placements: r.resolve(t.modeId, a.state),
				identity: a.identity
			};
		},
		resolvePagePlacement: (t) => $c(t, e.layout, e.views),
		resources: t,
		valuesEqual: (e, t) => JSON.stringify(e) === JSON.stringify(t),
		registerPagePlacements: (t) => {
			_s(t, e.modePlacements), Gc(t, e.modePlacements, n.listPages());
			let i = R(t).map((n) => {
				let r = u(n.item.kind === "view" ? n.item.view : n.item.binding.view);
				if (!r) throw Error(`Workbench page slot view is not registered: ${t.id}.${n.id}`);
				return ln(e.layout, e.views, {
					...n,
					id: z(t.id, n.id),
					viewId: r,
					role: n.role === "primary" ? "location" : "sub-panel",
					singleton: n.item.kind === "view" || n.item.binding.cardinality !== "many",
					closable: n.role !== "primary" || t.main.kind !== "view" || t.main.presentation !== "page"
				}, e.viewMenus);
			});
			return r(() => {
				for (let e of i.reverse()) e.dispose();
			});
		}
	});
	return ll({
		isResourceViewer: e.isResourceViewer,
		loadPageLayout: e.loadPageLayout,
		loadModeLayout: e.loadModeLayout,
		saveModeLayout: e.saveModeLayout,
		savePageMain: e.savePageMain,
		beforeApply: (t) => {
			e.beforeApply?.(t);
			let r = X(e.shellPlacements);
			r.apply(r.adopt(t.activeModeId ?? "", t.placements.map((e) => ({
				...e.value,
				placementIdentity: e.identity
			}))));
			let i = X(e.modePlacements);
			t.projectId !== n.store.getState().projectId && i.apply(Y()), t.activeModeId && i.apply(i.adopt(t.activeModeId, t.placements.map((e) => ({
				...e.value,
				placementIdentity: e.identity
			}))));
		},
		revealRegion: e.revealRegion,
		layout: e.layout,
		modes: e.modes,
		registry: n
	}), X(e.modePlacements).connectRuntime((e) => B(n).refreshModePlacements(e)), X(e.shellPlacements).connectRuntime((e) => B(n).refreshShellPlacements(e)), n;
}, dl = (e, t, n) => {
	let r = Object.values(t.regions).flatMap((e) => e.widgets), i = [], a = {}, o;
	for (let s of R(e)) {
		let c = r.filter((t) => t.placementIdentity?.kind === "page" && t.placementIdentity.pageId === e.id && t.placementIdentity.slotId === s.id);
		if (s.item.kind === "view") {
			c.some((t) => Z(e, t.resource) === Z(e, n)) && i.push(s.id);
			continue;
		}
		let l = s.item.binding, u = c.flatMap((e) => {
			let t = e.placementIdentity;
			return !t || !e.resource || !q(l, e.resource) ? [] : [{
				instanceKey: l.cardinality === "one" && s.role !== "primary" ? yi : t.instanceKey,
				resource: e.resource,
				section: e.section,
				position: e.position,
				pageContext: e.pageContext,
				...l.cardinality === "many" ? { open: e.tabRetention === "preview" ? "preview" : "pin" } : {}
			}];
		});
		if (a[s.id] = l.cardinality === "one" ? u.slice(-1) : u, s.role === "primary") {
			let e = c.find((e) => t.activeLocationWidgetId === e.widgetId);
			o = e ? u.find((t) => t.resource === e.resource)?.instanceKey : void 0;
		}
	}
	return {
		openStaticSlotIds: i,
		resourceInstances: a,
		activePrimaryInstanceKey: o
	};
}, fl = (e, t, n) => {
	let r = e.resolvePagePersistenceScope?.({
		...t,
		currentScope: n?.getPersistenceScope() ?? t.currentScope
	}), i = e.persistence?.getSnapshot(r?.scope)?.layout ?? e.layoutPersistence?.getLayout(r?.scope);
	return !n || !r?.carryRegions?.length ? i : pt(n.getLayout(), i ?? je(), r.carryRegions);
}, pl = (e, t = (t) => fl(e, t), n) => (r, i, a) => {
	let o = {
		modeId: r.modeId,
		pageId: r.id,
		projectId: a,
		resource: i.resource
	}, s = t(o, r);
	if (n && !n(o, r)) return;
	let c = e.pageLocationPersistence?.load(a)?.location, l = Hn(c, i, re, [r]);
	if (s && (n || l || Object.values(s.regions).some((e) => e.widgets.some((e) => e.placementIdentity?.kind === "page" && e.placementIdentity.pageId === r.id)))) return dl(r, s, i.resource);
}, ml = (e, t) => ({
	...e,
	regions: Object.fromEntries(Object.entries(e.regions).map(([e, n]) => [e, {
		...n,
		widgets: n.widgets.map(t)
	}]))
}), hl = (e, t) => ml(e, (e) => ({
	...e,
	tab: typeof e.tab?.getSnapshot == "function" ? e.tab : t(e.contributionId)
})), gl = (e) => {
	let t = e.read(e.preferredScope), n = new Map(e.layouts.map((e) => [e.scope, e]));
	t && n.set(e.preferredScope, {
		scope: e.preferredScope,
		layout: t
	});
	let r = [...n.values()].filter(({ scope: t, layout: n }) => {
		if (!t?.startsWith("workbench-main:") || n.regions.main.widgets.length === 0) return !1;
		let [r, i, a] = JSON.parse(t.slice(15)), o = e.pages.find((e) => e.id === a);
		return r === e.context.projectId && i === e.context.modeId && Io(o, e.pages)?.id === e.page.id;
	});
	if (r.length) {
		if (!e.read(e.scope)) {
			let t = r.find((t) => t.scope === e.preferredScope) ?? r.at(-1), n = [t, ...r.filter((e) => e !== t)], i = /* @__PURE__ */ new Set(), a = n.flatMap(({ layout: e }) => e.regions.main.widgets).filter((e) => !i.has(e.widgetId) && (i.add(e.widgetId), !0)), o = {
				...t.layout,
				regions: {
					...t.layout.regions,
					main: {
						...t.layout.regions.main,
						widgets: a
					}
				}
			};
			if (!e.write(o, e.scope)) return;
		}
		for (let { scope: t, layout: n } of r) e.clear(t, {
			...n,
			regions: {
				...n.regions,
				main: {
					...n.regions.main,
					widgets: [],
					activeWidgetId: void 0
				}
			},
			activeWidgetId: void 0,
			activeLocationWidgetId: void 0,
			activeResourceKey: void 0
		});
	}
}, _l = () => {
	let e = Symbol("current layout"), t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Map(), r = /* @__PURE__ */ new Map(), i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o, s, c, l, u = (t) => {
		let a = n.get(t), o = r.get(t), u = a?.get(e) ?? a?.get(i.get(t));
		o !== u && (!!o != !!u && (s = void 0), o?.resource !== u?.resource && (l = void 0), u ? r.set(t, u) : r.delete(t), c = void 0);
	}, d = (e) => {
		let t = e.resource ? [h(e.resource)] : [], n = e.pageContext?.parent;
		for (; n;) n.resource && t.push(h(n.resource)), n = n.parent;
		return t;
	}, f = (e, t, n) => {
		let r = new Set([...t.values()].flatMap(d)), i = new Set([...n.values()].flatMap(d));
		for (let t of r) {
			if (i.has(t)) continue;
			let n = a.get(t);
			n.delete(e), n.size || a.delete(t);
		}
		for (let t of i) {
			if (r.has(t)) continue;
			let n = a.get(t);
			n || (n = /* @__PURE__ */ new Set(), a.set(t, n)), n.add(e);
		}
	}, p = (t, r) => {
		let a = n.get(r);
		if (a.delete(t), i.get(r) === t) {
			i.delete(r);
			for (let t of a.keys()) t !== e && i.set(r, t);
		}
		a.size || n.delete(r), u(r);
	}, m = (t, r, a) => {
		for (let e of r.keys()) a.has(e) || p(t, e);
		for (let [o, s] of a) {
			if (r.get(o) === s) continue;
			let a = n.get(o);
			a || (a = /* @__PURE__ */ new Map(), n.set(o, a)), a.delete(t), a.set(t, s), t !== e && i.set(o, t), u(o);
		}
	}, g = (e, n) => {
		let r = t.get(e) ?? /* @__PURE__ */ new Map(), i = new Map(Object.values(n?.regions ?? {}).flatMap((e) => e.widgets.map((e) => [e.widgetId, e])));
		f(e, r, i), m(e, r, i), i.size ? t.set(e, i) : t.delete(e);
	};
	return {
		set: g,
		removeResource(e, n) {
			let r = t.get(e);
			if (!r) return;
			let i = h(n), a = new Map([...r].filter(([, e]) => h(e.resource) !== i));
			f(e, r, a), m(e, r, a), a.size ? t.set(e, a) : t.delete(e);
		},
		setCurrent(t) {
			o !== t && (o = t, g(e, t));
		},
		getIds: () => s ??= new Set(r.keys()),
		getPlacements: () => c ??= [...r.values()],
		getResources: () => (l ??= [...new Map([...r.values()].flatMap((e) => e.resource ? [[h(e.resource), e.resource]] : [])).values()], l),
		getScopes(e) {
			return [...a.get(h(e)) ?? []].filter((e) => typeof e != "symbol");
		}
	};
}, vl = [
	"main",
	"side",
	"secondary"
], yl = (e) => `workbench-page-headers:${JSON.stringify([e.projectId, e.pageId])}`, bl = (e) => ({
	load: (t) => e.read(yl(t)),
	save(t, n) {
		let r = yl(t), i = e.read(r);
		if (vl.every((e) => i?.regions[e].headerVisible === n.regions[e].headerVisible)) return;
		let a = je();
		for (let e of vl) a.regions[e].headerVisible = n.regions[e].headerVisible;
		vl.some((e) => a.regions[e].headerVisible !== void 0) ? e.write(a, r) : e.clear(r, a);
	}
}), xl = (e, t) => {
	let n = { ...e.regions };
	for (let e of vl) n[e] = {
		...n[e],
		headerVisible: t?.regions[e].headerVisible
	};
	return {
		...e,
		regions: n
	};
}, Sl = (e, t, n) => {
	if (!e && !t && !n) return;
	let r = e ?? je(), i = new Set(t?.regions.main.widgets.map((e) => e.widgetId));
	return xl({
		...r,
		regions: {
			...r.regions,
			main: t?.regions.main ?? {
				...r.regions.main,
				widgets: [],
				activeWidgetId: void 0
			}
		},
		activeWidgetId: i.has(t?.activeWidgetId ?? "") ? t?.activeWidgetId : r.activeWidgetId,
		activeLocationWidgetId: i.has(t?.activeLocationWidgetId ?? "") ? t?.activeLocationWidgetId : r.activeLocationWidgetId
	}, n);
}, Cl = (e, t, n) => {
	let r = {
		pageId: e.id,
		resource: t
	}, i = (t) => Va(e, t, n);
	return kr({
		shell: [],
		page: Fa({
			page: e,
			resource: t,
			state: Sa({
				page: e,
				state: ba({
					page: e,
					state: ga(e),
					target: r,
					resourceKey: i
				}),
				target: r,
				resourceKey: i
			}),
			staticInstanceKey: Fr(e, t, n),
			sharedPlacements: [],
			resolvePagePlacement: (e) => e
		})
	}).regions.main;
}, wl = (e, t, n) => e.placementIdentity && U(e.placementIdentity) === U(t.identity) && e.viewId === t.viewId && Z(n, e.resource) === Z(n, t.resource) && !!e.pinned == (t.open !== "preview") && e.tabRetention === (t.open === "preview" ? "preview" : "persistent") && JSON.stringify(e.section) === JSON.stringify(t.section), Tl = (e, t, n, r = re) => {
	if (!e || e.resource && !t || e.main.kind === "panels" && typeof e.main.landing == "object") return !1;
	let i = Cl(e, t, r), a = n.regions.main;
	if (a.widgets.length !== i.length || !a.widgets.every((t, n) => wl(t, i[n].value, e))) return !1;
	let o = a.widgets.find((e) => e.widgetId === a.activeWidgetId) ?? a.widgets[0], s = i.find((e) => e.value.role === "primary") ?? i[0];
	return o?.placementIdentity && s ? U(o.placementIdentity) === U(s.identity) : !o && !s;
}, El = (e, t, n = !1) => `${n ? "workbench-collection-main" : "workbench-main"}:${JSON.stringify([
	e.projectId,
	e.modeId,
	e.pageId,
	Z(t, e.resource)
])}`, Dl = (e) => {
	let t = (t, n) => {
		let r = Io(n, e());
		return {
			page: r,
			context: r && r !== n ? {
				...t,
				pageId: r.id,
				resource: void 0
			} : t
		};
	};
	return {
		pageMainOwner: t,
		pageMainScope: (e, n) => {
			let r = t(e, n);
			return El(r.context, r.page, r.page?.main.kind === "panels" && !r.page.resource);
		}
	};
}, Ol = (e, t) => {
	let n = { ...e.regions };
	for (let r of E) {
		let i = e.regions[r], a = i.widgets.filter((e) => t(e, r));
		n[r] = {
			...i,
			widgets: a,
			activeWidgetId: a.some((e) => e.widgetId === i.activeWidgetId) ? i.activeWidgetId : void 0
		};
	}
	return {
		...e,
		regions: n
	};
}, kl = (e, t) => `workbench-mode:${JSON.stringify([e ?? null, t])}`, Al = (e, t) => t !== "main" && (e.placementIdentity?.kind === "mode" || !!Gt(t)), jl = (e) => {
	let { context: t, pages: n, saved: r } = e, i = Object.values(e.layout.regions).flatMap((e) => e.widgets).find((t) => t.widgetId === e.layout.activeLocationWidgetId), a = r && n.find((e) => e.ref.id === r.page.id && e.ref.extensionId === r.page.extensionId);
	if (a && (!i?.resource?.projectId || i.resource.projectId === t.projectId)) {
		let n = {
			projectId: t.projectId,
			modeId: a.modeId,
			pageId: a.id,
			resource: r.resource
		};
		if (e.resolveScope?.(n)?.scope === e.scope) return {
			context: n,
			page: a
		};
	}
	if (!i || i.placementIdentity?.kind !== "page") return;
	let o = i.placementIdentity.pageId, s = n.find((e) => e.id === o);
	if (s) return {
		context: {
			projectId: i.resource?.projectId ?? t.projectId,
			modeId: s.modeId,
			pageId: o,
			resource: s.resource ? i.resource : void 0
		},
		page: s
	};
}, Ml = (e, t = () => void 0, n = () => void 0, r = () => [], i) => {
	let { pageMainOwner: o, pageMainScope: s } = Dl(r), c = /* @__PURE__ */ new Map(), l = _l(), u = !1, d = r(), f = e.persistence ? {
		getLayout: (t) => e.persistence?.getSnapshot(t)?.layout,
		setLayout: (t, n) => e.persistence?.setSnapshot({ layout: t }, n),
		removeLayout: e.persistence.removeSnapshot ? (t) => e.persistence?.removeSnapshot?.(t) : void 0,
		listLayouts: () => e.persistence?.listLayouts?.() ?? [],
		onDidChangeLayout: e.persistence?.onDidChangeLayout,
		flush: e.persistence.flush,
		dispose: e.persistence.dispose
	} : e.layoutPersistence ?? {
		getLayout: (e) => c.get(e),
		setLayout: (e, t) => c.set(t, e),
		removeLayout: (e) => {
			c.delete(e);
		}
	}, p = (e, t) => {
		let n = t ? Bc(e, t, r(), i) : void 0;
		return n && n !== t && a("page content layout migration", () => f.setLayout(n, e)), l.set(e, n), n;
	}, m = f.onDidChangeLayout?.((e, t) => p(e, t)), g = (e) => {
		let t = a(`layout cache read for ${e ?? "unscoped"}`, () => f.getLayout(e)), r = p(e, t);
		return r ? hl(r, n) : void 0;
	}, _ = (e, t) => a(`layout cache write for ${t ?? "unscoped"}`, () => {
		let n = Bc(t, e, r(), i);
		return f.setLayout(n, t), l.set(t, n), !0;
	}), v = (e, t) => {
		a(`remove default page layout for ${e}`, () => {
			f.removeLayout ? f.removeLayout(e) : f.getLayout(e) && f.setLayout(t, e);
		}), l.set(e, f.removeLayout ? void 0 : f.getLayout(e));
	}, y = bl({
		read: g,
		write: _,
		clear: v
	}), b = (t, n, i, a) => {
		let o = jl({
			layout: t,
			context: n,
			pages: i ? [i, ...r()] : r(),
			saved: n.projectId ? e.pageLocationPersistence?.load(n.projectId)?.location : void 0,
			scope: a,
			resolveScope: e.resolvePagePersistenceScope
		});
		if (!o) return;
		let c = s(o.context, o.page);
		(g(c) || _(Ol(t, (e, t) => t === "main"), c)) && _(Ol(t, (e, t) => t !== "main"), a);
	}, x = (e) => {
		let t = r();
		if ((t.length !== d.length || t.some((e, t) => e !== d[t])) && (d = t, u = !1), !u) {
			u = !0;
			for (let { scope: e, layout: t } of f.listLayouts?.() ?? []) p(e, t);
		}
		l.setCurrent(e);
	};
	return {
		listPlacements(e) {
			return x(e), l.getPlacements();
		},
		placementIds(e) {
			return x(e), l.getIds();
		},
		listResources(e) {
			return x(e), l.getResources();
		},
		hasPageMain(e, t) {
			return !I(t) && !!g(s(e, t));
		},
		loadPageLayout(t, n) {
			let i = e.resolvePagePersistenceScope?.(t)?.scope, a = g(i);
			if (!t.pageId || !t.modeId) return a;
			a?.regions.main.widgets.length && b(a, t, n, i);
			let c = o(t, n);
			return c.page?.main.kind === "panels" && !c.page.resource && gl({
				context: c.context,
				page: c.page,
				pages: r(),
				scope: s(t, n),
				preferredScope: El(t, n),
				layouts: f.listLayouts?.() ?? [],
				read: g,
				write: _,
				clear: v
			}), Sl(a, I(n) ? void 0 : g(s(t, n)), y.load(t));
		},
		savePageMain(t, n, r, i = n) {
			if (!t.pageId || !t.modeId) return;
			y.save(t, n);
			let a = s(t, r), c = Ol(n, (e, t) => t === "main");
			if (I(r)) {
				v(a, c);
				return;
			}
			let l = o(t, r), u = (n) => Tl(l.page, l.context.resource, n, e.pageResources) && Tl(r, t.resource, n, e.pageResources);
			u(n) || i !== n && u(i) ? v(a, c) : _(c, a);
		},
		removeResource(e) {
			if (!u) {
				u = !0;
				for (let { scope: e, layout: t } of f.listLayouts?.() ?? []) p(e, t);
			}
			for (let t of l.getScopes(e)) {
				let n = g(t);
				if (n) {
					let i = Ol(n, (t) => h(t.resource) !== h(e));
					for (let t of Object.values(i.regions)) t.widgets = t.widgets.map((t) => Nr(t, r(), (t) => h(t) === h(e)));
					_(i, t);
				} else l.removeResource(t, e);
			}
		},
		layout: {
			...f,
			dispose() {
				m?.(), f.dispose?.();
			},
			getLayout: g,
			setLayout: (e, n) => {
				let r = Ol(e, (e, n) => !t() || n !== "main" && !Al(e, n));
				for (let t of E) r.regions[t].savedWidgetOrder = e.regions[t].widgets.map((e) => e.widgetId);
				return _(r, n);
			}
		},
		readMode: (e, t) => g(kl(e, t)),
		saveMode: (e, t, n) => _(Ol(n, (e, n) => Al(e, n) && (e.placementIdentity?.kind !== "mode" || e.placementIdentity.modeId === t)), kl(e, t))
	};
}, Nl = (e, t) => Ml(e, () => t()?.pages.store.getState().activeModeId, (e) => t()?.layout.getWidget(e)?.tab, () => t()?.pages.listPages() ?? [], (e, n, r) => {
	let i = t();
	return ys(e, n, i?.modePlacements, r, i?.pages.resourceReferenceKey);
}), Pl = (e, t, n) => {
	let { identity: r } = t, i = e.layout.getLayout().regions.main, a = i.widgets[i.widgets.findIndex((e) => e.widgetId === t.widget.widgetId) + 1], o = e.layout.getLayout().activeWidgetId, s = e.pages.getPage(r.pageId), c = t.widget.pageContext ?? e.pages.store.getState().location, l = e.pageLocations.navigate({
		...An({
			...c,
			page: s.ref
		}),
		resource: n.resource,
		section: n.section,
		position: n.position,
		...s.main.kind === "view" && s.main.cardinality === "many" ? { open: t.widget.tabRetention === "persistent" ? "pin" : "preview" } : {}
	});
	if (!l.ok) throw Error(l.diagnostic.message);
	let u = e.layout.getActivePanel("main");
	e.closePlacement(r), a && e.layout.reorderPanel(u.instanceId, { beforeWidgetId: a.widgetId }), n.operation === "replace" && o && o !== t.widget.widgetId && e.layout.activatePanel(o);
}, Fl = (e, t) => {
	let n = /* @__PURE__ */ new Map(), r = [], i = () => {
		let r = e();
		for (let [e, i] of n) {
			let a = t(r, i.identity), o = a?.resource ? r.pages.resourceReferenceKey(a.resource) : void 0;
			a && i.projectId === r.pages.store.getState().projectId && i.resourceKey === o || (i.current = !1, n.delete(e));
		}
	};
	return {
		capture(a) {
			let o = e(), s = t(o, a);
			if (!s) return () => !1;
			r.length || r.push(l(o.layout.store, i), l(o.pages.store, i));
			let c = U(a), u = n.get(c);
			return u || (u = {
				identity: a,
				projectId: o.pages.store.getState().projectId,
				resourceKey: s?.resource ? o.pages.resourceReferenceKey(s.resource) : void 0,
				current: !!s
			}, n.set(c, u)), () => u.current;
		},
		dispose() {
			for (let e of n.values()) e.current = !1;
			n.clear();
			for (let e of r) e();
			r.length = 0;
		}
	};
}, Il = (e, t, n = e.pages.store.getState().projectId, r) => {
	if (r !== void 0 && (t = Mr(t, e.pages.listPages(), (t) => e.resources.wasRemovedSince(t, r))), !t.resource) return t;
	let i = e.pages.listPages().find((e) => e.ref.id === t.page.id && e.ref.extensionId === t.page.extensionId);
	if (!i) return t;
	let a = e.pages.resourceReferenceKey(t.resource), o = e.pages.store.getState(), s = {
		...o,
		projectId: n,
		activePageId: i.id,
		activeModeId: i.modeId,
		location: t
	}, c = us(e, i.modeId, s), l = new Set(Jc(s, o, e.layout.getLayout()).map((e) => e.widgetId)), u = e.modes.getMode(i.modeId);
	if (!["side", "secondary"].some((t) => P(u, t) && c.regions[t].widgets.some((t) => t.resource && !l.has(t.widgetId) && t.placementIdentity && xs(e, t.placementIdentity)?.kind === "binding" && e.pages.resourceReferenceKey(t.resource) === a))) return t;
	if (I(i) && i?.main.empty) {
		let { resource: e, section: n, position: r, ...i } = t;
		return i;
	}
	return t.parent ? Il(e, t.parent, n) : { page: t.page };
}, Ll = (e, t, n) => {
	if (!t.resource) return !1;
	let r = e.pages.listPages().find((e) => e.ref.id === t.page.id && e.ref.extensionId === t.page.extensionId);
	if (!r?.resource) return !1;
	if (!r.resource || !q(r.resource, t.resource)) throw Error("Page does not accept this resource kind");
	if (r.modeId !== e.pages.store.getState().activeModeId) return !1;
	let i = ws(e, t.resource);
	if (i?.region === "main" && i.identity.kind === "page" && i.identity.pageId === r.id) return !1;
	let a = e.viewers.focusResource(t.resource, {
		section: t.section,
		position: t.position,
		pageContext: {
			page: t.page,
			parent: t.parent,
			params: t.params
		}
	});
	return a && i && n === "pin" && e.pinPlacement(i.identity), a;
}, Rl = (e, t) => {
	e.pages.getContent()?.widgetId !== t.widget.widgetId && gs(e, t.region, { identity: t.identity });
}, zl = (e, t) => {
	e.pages.getContent()?.widgetId !== t.widget.widgetId && (gs(e, t.region, { identity: t.identity }), Gs(e, t.region), e.layout.activatePanel(t.widget.widgetId)), e.focus.setActiveRegion(t.region);
}, Bl = (e, t, n, r) => {
	let i = t.identity;
	if (i.kind === "mode") e.modePlacements.updatePlacement(i, {
		resource: n,
		location: r
	});
	else if (i.kind === "shell") e.shellPlacements.updatePlacement(i, {
		resource: n,
		location: r
	});
	else if (e.pages.getContent()?.widgetId === t.widget.widgetId) {
		let t = e.pages.store.getState().location, i = e.pageLocations.select({
			...t,
			resource: n,
			section: r.section,
			position: r.position
		});
		if (!i.ok) throw Error(i.diagnostic.message);
	} else e.pages.refreshPlacement(i, {
		resource: n,
		section: r.section,
		position: r.position,
		pageContext: r.pageContext
	});
}, Vl = (e, t) => {
	let n = e.pages.store.getState(), r = t.page ?? n.location.page, i = e.pages.listPages().find((e) => e.ref.id === r.id && e.ref.extensionId === r.extensionId);
	if (!i || i.modeId !== n.activeModeId || !i.resource || !q(i.resource, t.resource)) throw Error("Viewer replacement requires a resource page in the current mode");
	return r;
}, Hl = (e, t) => {
	let n = Vl(e, t), r = e.pages.store.getState().location, i = r.page.id === n.id && r.page.extensionId === n.extensionId, a = e.layout.getLayout().activeWidgetId, o = e.focus.getActiveRegion(), s = e.pageLocations.navigate({
		...i ? An(r) : { kind: "page" },
		page: n,
		resource: t.resource,
		section: t.section,
		position: t.position
	});
	if (!s.ok) throw Error(s.diagnostic.message);
	t.operation === "replace" && o && o !== "main" && (a && e.layout.activatePanel(a), e.focus.setActiveRegion(o));
}, Ul = (e, t, n) => {
	let r = xs(e, t), i = L(t.kind === "page" ? e.pages.getPage(t.pageId) : void 0, t), a = i && n.page && !n.from;
	if (r?.kind !== "binding" && !a) throw Error("Only a resource viewer can switch resources");
	if (n.page && !i) throw Error("Only current Main page content can change its page");
	if (!n.page && r?.kind === "binding" && !q(r.binding, n.resource)) throw Error("Viewer does not accept this resource kind");
	return i && Vl(e, n), i;
}, Wl = (e) => {
	let t = e.pages.store.getState();
	if (!t.location?.resource) return;
	let n = t.pages[t.activePageId], { resource: r, section: i, position: a, ...o } = t.location, s = n?.main.empty ? o : o.parent;
	if (!s) throw Error("The Main viewer does not have a landing page");
	let c = e.pageLocations.replay(s);
	if (!c.ok) throw Error(c.diagnostic.message);
}, Gl = (t, n, r, i, a) => {
	let o = t.focus.getActiveRegion() === n.region && (a || t.layout.getLayout().regions[n.region].activeWidgetId === n.widget.widgetId);
	return (i.operation === "switch" || o) && Rl(t, r), e(() => {
		if (Bl(t, r, i.resource, i), i.operation === "switch") return zl(t, r);
		a ? Wl(t) : t.closePlacement(n.identity), o && zl(t, r);
	});
}, Kl = (e, t, n, r) => {
	let i = t.identity;
	if (r ? Hl(e, n) : i.kind === "page" && i.slotId === "$main" && t.region === "main" ? Pl(e, {
		...t,
		identity: i
	}, n) : i.kind === "mode" ? e.modePlacements.updatePlacement(i, {
		resource: n.resource,
		title: n.resource.label,
		location: n
	}) : i.kind === "shell" ? e.shellPlacements.updatePlacement(i, {
		resource: n.resource,
		title: n.resource.label,
		location: n
	}) : Bl(e, {
		...t,
		resource: n.resource
	}, n.resource, n), n.operation !== "switch") return;
	let a = Ss(e).find((e) => Cs(e.identity, i)) ?? ws(e, n.resource);
	a && zl(e, a);
}, ql = (e, t) => {
	let n = e.pages.getContent();
	if (n?.placementIdentity && Cs(n.placementIdentity, t)) return {
		region: "main",
		widget: n,
		identity: t,
		resource: n.resource
	};
	for (let n of [
		"main",
		"side",
		"secondary"
	]) {
		let r = e.layout.getLayout().regions[n].widgets.find((e) => e.placementIdentity && Cs(e.placementIdentity, t));
		if (r) return {
			region: n,
			widget: r,
			identity: t,
			resource: r.resource
		};
	}
}, Jl = (e, t, n) => !(n?.isViewerCurrent?.() === !1 || n?.projectId && n.projectId !== e.pages.store.getState().projectId || n?.removalVersion !== void 0 && e.resources.wasRemovedSince(t.resource, n.removalVersion) || t.resource.projectId && t.resource.projectId !== e.pages.store.getState().projectId), Yl = (t) => {
	let n = Fl(t, ql), r = {
		captureContext(e) {
			let r = t();
			return {
				viewer: e,
				projectId: r.pages.store.getState().projectId,
				removalVersion: r.resources.getRemovalVersion(),
				...e ? { isViewerCurrent: n.capture(e) } : {}
			};
		},
		capture(e) {
			let n = ql(t(), e);
			if (!n) return;
			let i = r.captureContext(e);
			return (t) => r.change(e, {
				...t,
				from: n.resource
			}, i);
		},
		refreshReference(e, n) {
			let r = t(), i = ws(r, e);
			return i ? (Bl(r, i, e, n), !0) : !1;
		},
		focusResource(n, r) {
			let i = t(), a = ws(i, n);
			return a ? (Rl(i, a), e(() => {
				r && Bl(i, a, n, r), zl(i, a);
			}), !0) : !1;
		},
		change(n, r, i) {
			let a = t();
			if (!Jl(a, r, i)) return "stale";
			let o = ql(a, n), s = o?.resource ? a.pages.resourceReferenceKey(o.resource) : void 0, c = r.from ? a.pages.resourceReferenceKey(r.from) : void 0;
			if (!o || s !== c) return "stale";
			let l = Ul(a, n, r);
			if (!r.page && s === a.pages.resourceReferenceKey(r.resource)) return e(() => (Bl(a, {
				...o,
				resource: r.resource
			}, r.resource, r), r.operation === "switch" && zl(a, {
				...o,
				resource: r.resource
			}), "changed"));
			let u = ws(a, r.resource, n);
			return u ? (Gl(a, o, u, r, l), "focused") : e(() => (Kl(a, o, r, l), "changed"));
		}
	};
	return {
		controller: r,
		dispose: n.dispose
	};
}, Xl = (e) => {
	let t = (t) => !Object.hasOwn(Rt, t) || !e.getPolicy(t).movable || t === "main" && !e.getPolicy("secondary").open || (t === "main" || t === "secondary") && (!e.getPolicy("main").movable || !e.getPolicy("secondary").movable) ? [] : Rt[t];
	return {
		getArrangement: () => Ht(e.layout.getLayout().arrangement),
		getPanelPositions: t,
		repositionPanel(n, r) {
			if (!t(n).includes(r)) throw Error(`Panel cannot move to ${r}: ${n}`);
			let i = e.layout.getLayout(), a = n === "main" ? "secondary" : n, o = r;
			n === "main" && (o = r === "top" ? "bottom" : "top"), e.layout.restoreLayout({
				...i,
				arrangement: {
					...i.arrangement,
					[a]: o
				}
			});
		}
	};
}, Zl = (e) => {
	let t = (t, n) => {
		let r = e.getPolicy(t);
		if (!r.provided) throw Error(`Panel is not provided: ${t}`);
		if (!{
			open: r.canOpen,
			close: r.canClose,
			resize: r.resizable
		}[n]) throw Error(`Panel cannot ${n}: ${t}`);
	};
	return {
		...Xl(e),
		getPanelPolicy: e.getPolicy,
		setHeaderVisible(t, n) {
			if (!e.getPolicy(t).provided) throw Error(`Panel is not provided: ${t}`);
			let r = e.layout.getLayout();
			e.layout.restoreLayout({
				...r,
				regions: {
					...r.regions,
					[t]: {
						...r.regions[t],
						headerVisible: n
					}
				}
			});
		},
		getRegionState(t) {
			let n = e.layout.getLayout().regions[t];
			return {
				open: e.getPolicy(t).open,
				size: n.size
			};
		},
		setRegionOpen(n, r) {
			t(n, r ? "open" : "close"), n === "side" ? r ? e.sidePanel.getMode() === "closed" && e.sidePanel.setMode("attached") : e.sidePanel.setMode("closed") : e.layout.setRegionVisible(n, r);
		},
		setRegionSize(n, r) {
			t(n, "resize");
			let i = e.layout.getRegionSize(n);
			e.layout.setRegionSize(n, Math.min(i?.maxPx ?? Infinity, Math.max(i?.minPx ?? 0, r)));
		},
		getSidePanelPresentation: e.sidePanel.getMode,
		setSidePanelPresentation(n) {
			if (n === "floating" && e.layout.getRegionSettings("side")?.floatable === !1) throw Error("Panel cannot float: side");
			n === "closed" ? t("side", "close") : e.getPolicy("side").open || t("side", "open"), e.sidePanel.setMode(n);
		},
		onDidChange(t) {
			let n = e.layout.getLayout(), i = e.sidePanel.getMode(), a = () => {
				let r = e.layout.getLayout(), a = e.sidePanel.getMode();
				(r !== n || a !== i) && (n = r, i = a, t());
			}, o = e.layout.store.subscribeSelector((e) => e.layout, a), s = e.sidePanel.onDidChange(a);
			return r(() => {
				o(), s.dispose();
			});
		}
	};
}, Ql = (e, t, n, r) => Ur({
	validateMode: (e) => {
		let t = r();
		if (!t) return;
		let n = t.shell.getPanelPolicy("side");
		if (!n.provided) throw Error("Panel is not provided: side");
		if (e === "closed" && !n.canClose) throw Error("Panel cannot close: side");
		if (e !== "closed" && !n.open && !n.canOpen) throw Error("Panel cannot open: side");
		if (e === "floating" && t.layout.getRegionSettings("side")?.floatable === !1) throw Error("Panel cannot float: side");
	},
	getFloatingPanels: () => {
		let r = t.getActiveModeId();
		if (!P(r ? t.getMode(r) : void 0, "side")) return "hidden";
		let i = e.getRegionSettings("side")?.floatable;
		return i === void 0 ? (r ? t.getMode(r)?.floatingPanels : void 0) ?? n.floatingPanels ?? "visible" : i ? "visible" : "hidden";
	},
	onDidChangePolicy: t.onDidChangeActive,
	initialMode: n.initialSidePanelMode,
	layout: e
}), $l = (e) => {
	let t = e.focus.getActiveRegion() ?? "main";
	return e.layout.getLayout().regions[t].activeWidgetId ?? `region:${t}`;
}, eu = (e, t) => {
	let n = t.placementIdentity;
	if (n?.kind === "page") return n.slotId === "$main" && t.resource ? e.pages.getPage(n.pageId) : void 0;
	if (n?.kind !== "mode") return;
	let r = e.modePlacements.listPlacements(n.modeId).find((e) => e.id === n.placementId);
	if (r) return e.pages.listPages().find((e) => {
		let i = e.main.kind === "panels" ? e.main.landing : void 0;
		return i && typeof i != "string" && e.modeId === n.modeId && i.id === r.ref.id && i.extensionId === r.ref.extensionId && (e.resource ? !!(t.resource && q(e.resource, t.resource)) : !t.resource);
	});
}, tu = (e, t) => JSON.stringify([
	t?.widgetId,
	t?.resource ? e.pages.resourceReferenceKey(t.resource) : null,
	t?.section,
	t?.position,
	t?.pageContext
]), nu = (e, t) => {
	let n = eu(e, t), r = e.pages.store.getState().location;
	if (!n || !r) return;
	let i = n.ref.id === r.page.id && n.ref.extensionId === r.page.extensionId, a = t.pageContext, o = a ? a.parent : i && r.parent, s = a?.params, c = r.resource ? e.pages.resourceReferenceKey(r.resource) : null, l = t.resource ? e.pages.resourceReferenceKey(t.resource) : null;
	i && c === l && JSON.stringify([
		r.section,
		r.position,
		r.parent,
		r.params
	]) === JSON.stringify([
		t.section,
		t.position,
		o || void 0,
		s
	]) || e.pageLocations.select({
		page: n.ref,
		resource: t.resource,
		section: t.section,
		position: t.position,
		params: s,
		...o ? { parent: o } : {}
	});
}, ru = (e) => {
	let t = e.pages.store.getState(), n = t.pages[t.activePageId ?? ""];
	if (!t.location || I(n)) return;
	let r = e.layout.getLayout().regions.main, i = r.widgets.find((e) => e.widgetId === r.activeWidgetId) ?? r.widgets[0];
	if (i && eu(e, i)) return nu(e, i);
	let a = n?.main.kind === "panels" ? n.main.landing : void 0;
	a && typeof a != "string" && e.modePlacements.getPlacement(a)?.item.kind === "binding" && t.location.resource && t.location.parent && e.pageLocations.select(t.location.parent);
}, iu = (e) => {
	let t = () => {
		let t = e.layout.getLayout().regions.main;
		return t.widgets.find((e) => e.widgetId === t.activeWidgetId) ?? t.widgets[0];
	}, n = tu(e, t()), r = (r) => {
		let i = tu(e, t());
		i !== n && (n = i, r && ru(e));
	}, i = e.layout.store.subscribe(() => {
		e.modes.isTransitioning() || B(e.pages).getPublishingState() !== e.pages.store.getState() || r(!0);
	}), a = e.pages.store.subscribe((e, t) => r(e.location === t.location));
	return () => {
		i(), a();
	};
}, au = (e) => (t) => !e.listProviders().some((e) => e.kind === t.type) || e.listResources("").some((e) => h(e.resource) === h(t)), ou = ({ layout: e, isInScope: t, primary: n }) => {
	let i = !1, a = () => n ? n.getResource() : si(e.getLayout(), "primary"), o = h(a()), s = e.onWillChangePersistenceScope(() => {
		i = !0;
	}), c = e.onDidChangePersistenceScope(() => {
		i = !1;
	}), l = (n) => {
		let r = a(), s = h(r) !== o;
		if (o = h(r), s && !i) for (let i of ci({
			layout: n,
			primary: r,
			isInScope: t
		})) i.action === "clear" && e.removeWidgetPlacement(i.widgetId);
	}, u = e.store.subscribe((e, t) => l(t.layout)), d = n?.subscribe(() => l(e.getLayout()));
	return r(() => {
		u(), d?.dispose(), s.dispose(), c.dispose();
	});
}, su = "sidenav", cu = (e, t) => {
	e.shell.setRegionOpen(t, !e.shell.getRegionState(t).open);
}, lu = [
	{
		id: "workbench.toggleCommandPalette",
		label: "Toggle Command Palette",
		icon: "Command",
		keybinding: "Mod+P",
		execute: (e) => e.commandPalette.toggle()
	},
	{
		id: "workbench.action.showCommands",
		label: "Run Command",
		icon: "Terminal",
		keybinding: "Alt+Shift+K",
		execute: (e) => e.commandPalette.open({ initialQuery: "> " })
	},
	{
		id: "workbench.action.changeTheme",
		label: "Change Theme",
		icon: "Palette",
		keybinding: "Alt+Shift+T",
		execute: (e) => e.commandPalette.open({ view: "theme" })
	},
	{
		id: "workbench.action.navigateBack",
		label: "Navigate Back",
		icon: "ArrowLeft",
		keybinding: "Alt+Shift+ArrowLeft",
		execute: (e) => {
			e.pageLocations.goBack();
		}
	},
	{
		id: "workbench.action.navigateForward",
		label: "Navigate Forward",
		icon: "ArrowRight",
		keybinding: "Alt+Shift+ArrowRight",
		execute: (e) => {
			e.pageLocations.goForward();
		}
	},
	{
		id: "workbench.toggleSideBar",
		label: "Toggle Sidenav",
		icon: "PanelLeft",
		keybinding: "Mod+B",
		execute: (e) => cu(e, su)
	}
], uu = (e) => {
	for (let t of lu) e.commands.registerCommand({
		id: t.id,
		label: t.label,
		category: "Workbench",
		icon: t.icon,
		when: "!inputFocus"
	}, { execute: () => t.execute(e) }), e.keybindings.registerKeybinding({
		action: {
			kind: "command",
			commandId: t.id
		},
		keybinding: t.keybinding,
		when: "!inputFocus"
	}), e.layout.registerMenuItem(mi, {
		commandId: t.id,
		group: "Workbench"
	});
}, du = (e) => vn({
	acceptsTabs: (t) => e().shell.getPanelPolicy(t).acceptsTabs,
	getActiveMode: () => {
		let t = e(), n = t.modes.getActiveModeId();
		return n ? t.modes.getMode(n) : void 0;
	},
	getLayout: () => e().layout.getLayout(),
	getResource: () => e().getPrimaryResource(),
	listWidgets: () => e().layout.listWidgets(),
	listOwnedAddablePanels: ({ layout: t, mode: n, region: r, resource: i }) => Ko(e(), {
		layout: t,
		modeId: n?.id,
		region: r,
		resource: i
	})
}), fu = (e, t) => {
	iu(e), e.layout.store.subscribe((t) => {
		let n = e.focus.getActiveRegion();
		n && !(bc(e, n) ?? t.layout.regions[n].visible) && e.focus.clearFocus();
	});
	let n = () => {
		let t = pu(e)?.viewId;
		t ? e.context.set(jo, t) : e.context.delete(jo);
	};
	for (let t of [
		e.layout.store,
		e.pages.store,
		e.focus.store
	]) t.subscribe(n);
	n(), ou({
		layout: e.layout,
		primary: {
			getResource: () => e.pages.store.getState().activePageId ? e.getPrimaryResource() : si(e.layout.getLayout(), "primary"),
			subscribe: (t) => e.onDidChangePrimaryResource(t)
		},
		isInScope: t.isInScope ?? au(e.resources)
	}), uu(e);
}, pu = (e) => {
	let t = e.pages.getContent();
	if (t && (e.focus.getActiveRegion() === "main" || !e.layout.getLayout().activeWidgetId)) return t;
	let n = e.layout.getLayout().activeWidgetId;
	if (n) for (let t of Object.values(e.layout.getLayout().regions)) {
		let e = t.widgets.find((e) => e.widgetId === n);
		if (e) return e;
	}
}, mu = (e) => pu(e)?.resource, hu = (e) => e.pages.store.getState().location?.resource, gu = (e, t) => {
	let n = e.getActiveResource(), i = () => {
		let r = e.getActiveResource();
		h(r) !== h(n) && (n = r, t(r));
	}, a = [
		e.layout.store.subscribe(i),
		e.pages.store.subscribe(i),
		e.focus.store.subscribe(i)
	];
	return r(() => {
		for (let e of a) e();
	});
}, _u = (e) => ua({
	subscribeViewRefresh: (t, n) => e.onDidRefresh(({ treeId: e }) => {
		e === t && n();
	}),
	getViewDefaultExpandedSectionIds: (t) => e.getTreeRenderer(t)?.defaultExpandedSectionIds,
	getViewSections: (t, n) => e.getBody(t, {
		...n,
		viewId: t
	}),
	getViewStructure: (t, n) => e.getTreeRenderer(t)?.getStructure?.({
		...n,
		viewId: t
	}) ?? [],
	getViewChildren: (t, n, r) => e.getChildren(t, n, {
		...r,
		viewId: t
	}),
	moveViewNode: (t, n, r, i) => vu(e, t, n, r, i)
}), vu = async (e, t, n, r, i) => {
	await e.getTreeRenderer(t)?.moveNode?.(n, r, {
		...i,
		viewId: t,
		state: e.getTreeState(t),
		refresh: () => e.refresh(t),
		setSelectedNode: (n) => e.setSelectedNode(t, n)
	});
}, yu = (e) => {
	let t = fo();
	return {
		...t,
		...go({
			rendererRegistry: t,
			persistence: e.treePersistence
		}),
		...uo({ rendererRegistry: t }),
		...co({ rendererRegistry: t }),
		...lo({ rendererRegistry: t }),
		...so({ rendererRegistry: t })
	};
}, bu = (e, t) => ({
	dispose: () => e.dispose(),
	refresh: t
}), xu = (e) => (t, n) => {
	let r = t.body;
	if (r.kind === "react") return bu(e.registerRenderer({
		id: t.id,
		render: r.render
	}), () => e.refreshRenderer(t.id));
	if (r.kind === "tree") {
		let { kind: i, ...a } = r;
		return bu(e.registerTreeRenderer({
			...a,
			id: t.id,
			title: t.title,
			icon: t.icon
		}, n), () => e.refresh(t.id));
	}
	if (r.kind === "file") {
		let { kind: i, ...a } = r;
		return bu(e.registerFileRenderer({
			...a,
			id: t.id,
			title: t.title
		}, n), (n) => e.refreshFileRenderer(t.id, n));
	}
	if (r.kind === "controls") {
		let { kind: i, ...a } = r;
		return bu(e.registerControlsRenderer({
			...a,
			id: t.id,
			title: t.title
		}, n), () => e.refreshControlsRenderer(t.id));
	}
	if (r.kind === "kanban") {
		let { kind: i, ...a } = r;
		return bu(e.registerKanbanRenderer({
			...a,
			id: t.id,
			title: t.title
		}, n), () => e.refreshKanbanRenderer(t.id));
	}
	let { kind: i, ...a } = r;
	return bu(e.registerDataTableRenderer({
		...a,
		id: t.id,
		title: t.title
	}, n), () => e.refreshDataTableRenderer(t.id));
}, Su = (e, t) => {
	let n = No({ registerBody: xu(t) });
	return {
		views: n,
		viewMenus: Ao({ views: n }),
		statusBar: So({
			hasView: (e) => !!n.getView(e),
			persistence: e.statusBarPersistence
		})
	};
}, $ = (e, t) => ({
	...t,
	source: e.source,
	ownerId: e.ownerId
}), Cu = (e) => e ? Array.isArray(e) ? [...e] : [e] : [], wu = (e) => {
	for (let t = e.length - 1; t >= 0; --t) e[t]?.dispose();
}, Tu = (e, t) => {
	let n = e.context.createScope(t.contextScopeId);
	t.track(n);
	let i = (e) => (t.track(e), e), { openPanel: a, openWidget: o, registerPanel: s, registerPanelMenu: c, registerPlaceholder: l, registerWidget: u, ...d } = e.layout;
	return {
		...e,
		registerChildModule: (t) => i(e.registerModule(t)),
		onDidChangePrimaryResource: (t) => i(e.onDidChangePrimaryResource(t)),
		onDidChangeActiveResource: (t) => i(e.onDidChangeActiveResource(t)),
		breadcrumbs: {
			...e.breadcrumbs,
			setItems: (t) => i(e.breadcrumbs.setItems(t)),
			onDidChange: (t) => i(e.breadcrumbs.onDidChange(t))
		},
		commandPalette: {
			...e.commandPalette,
			onDidChange: (t) => i(e.commandPalette.onDidChange(t))
		},
		context: {
			...e.context,
			set: (e, t) => n.set(e, t),
			delete: (e) => n.delete(e),
			createScope: (t) => i(e.context.createScope(t))
		},
		focus: {
			...e.focus,
			onDidChange: (t) => i(e.focus.onDidChange(t))
		},
		commands: {
			...e.commands,
			registerCommand: (n, r, a) => i(e.commands.registerCommand(n, r, $(t, a))),
			onDidExecuteError: (t) => i(e.commands.onDidExecuteError(t))
		},
		keybindings: {
			...e.keybindings,
			registerKeybinding: (n, r) => i(e.keybindings.registerKeybinding(n, $(t, r)))
		},
		layout: {
			...d,
			registerMenuItem: (n, r, a) => i(e.layout.registerMenuItem(n, r, $(t, a))),
			onWillChangePersistenceScope: (t) => i(e.layout.onWillChangePersistenceScope(t)),
			onDidChangePersistenceScope: (t) => i(e.layout.onDidChangePersistenceScope(t))
		},
		modes: {
			...e.modes,
			registerMode: (n) => i(e.modes.registerMode({
				...n,
				activate: () => {
					let i = [], a = Tu(e, {
						...t,
						contextScopeId: `mode:${n.id}`,
						track: (e) => i.push(e)
					}), o = Cu(n.activate(a));
					return r(() => wu([...i, ...o]));
				}
			})),
			onDidChangeActive: (t) => i(e.modes.onDidChangeActive(t))
		},
		modePlacements: {
			...e.modePlacements,
			registerPlacement: (t) => i(e.modePlacements.registerPlacement(t)),
			onDidChange: (t) => i(e.modePlacements.onDidChange(t))
		},
		shellPlacements: {
			...e.shellPlacements,
			registerPlacement: (t) => i(e.shellPlacements.registerPlacement(t)),
			onDidChange: (t) => i(e.shellPlacements.onDidChange(t))
		},
		navigation: {
			...e.navigation,
			registerParser: (n, r) => i(e.navigation.registerParser(n, $(t, r)))
		},
		navigationTrees: {
			...e.navigationTrees,
			registerContribution: (t) => i(e.navigationTrees.registerContribution(t)),
			onDidChange: (t) => i(e.navigationTrees.onDidChange(t))
		},
		notifications: {
			...e.notifications,
			show: (n, r) => e.notifications.show(n, $(t, r))
		},
		overlays: {
			...e.overlays,
			registerOverlay: (t) => i(e.overlays.registerOverlay(t))
		},
		placeholders: {
			...e.placeholders,
			registerPlaceholder: (n, r) => i(e.placeholders.registerPlaceholder(n, $(t, r)))
		},
		pages: {
			...e.pages,
			registerPage: (t) => i(e.pages.registerPage(t))
		},
		panelMenuState: {
			...e.panelMenuState,
			onDidChange: (t) => i(e.panelMenuState.onDidChange(t))
		},
		preferences: {
			...e.preferences,
			registerSchema: (n, r) => i(e.preferences.registerSchema(n, $(t, r)))
		},
		resources: {
			...e.resources,
			onWillRemove: (t) => i(e.resources.onWillRemove(t)),
			onDidRemove: (t) => i(e.resources.onDidRemove(t)),
			registerKind: (n, r) => i(e.resources.registerKind(n, $(t, r))),
			registerHierarchyProvider: (t) => i(e.resources.registerHierarchyProvider(t)),
			registerProvider: (t) => i(e.resources.registerProvider(t))
		},
		views: {
			...e.views,
			registerView: (n, r) => i(e.views.registerView(n, $(t, r)))
		},
		viewMenus: {
			...e.viewMenus,
			registerViewMenu: (t) => i(e.viewMenus.registerViewMenu(t))
		},
		settings: {
			...e.settings,
			registerSection: (n, r) => i(e.settings.registerSection(n, $(t, r))),
			registerPanel: (n, r) => i(e.settings.registerPanel(n, $(t, r)))
		},
		statusBar: {
			...e.statusBar,
			registerItem: (t) => i(e.statusBar.registerItem(t))
		},
		statuses: {
			...e.statuses,
			registerStatusSet: (n, r) => i(e.statuses.registerStatusSet(n, $(t, r)))
		},
		shell: {
			...e.shell,
			onDidChange: (t) => i(e.shell.onDidChange(t))
		},
		sidePanel: {
			...e.sidePanel,
			onDidChange: (t) => i(e.sidePanel.onDidChange(t))
		},
		themes: {
			...e.themes,
			register: (t) => i(e.themes.register(t))
		},
		fileIconThemes: {
			...e.fileIconThemes,
			register: (t) => i(e.fileIconThemes.register(t))
		}
	};
}, Eu = (e) => {
	let t = /* @__PURE__ */ new Map();
	return {
		registerModule(n) {
			if (t.has(n.id)) throw Error(`Workbench module already registered: ${n.id}`);
			let i = [], a;
			a = r(() => {
				t.get(n.id)?.disposable === a && (t.delete(n.id), wu(i));
			});
			let o = { disposable: a };
			t.set(n.id, o);
			try {
				let t = Tu(e(), {
					contextScopeId: `module:${n.id}`,
					ownerId: n.ownerId ?? n.id,
					source: n.source ?? "module",
					track: (e) => {
						i.push(e);
					}
				});
				i.push(...Cu(n.activate(t)));
			} catch (e) {
				throw o.disposable.dispose(), e;
			}
			return o.disposable;
		},
		unregisterModule(e) {
			t.get(e)?.disposable.dispose();
		}
	};
}, Du = (e, t, n) => {
	let r = e.resolvePagePersistenceScope;
	if (r) return (e) => {
		let i = r({
			currentScope: t.getPersistenceScope(),
			modeId: e.activeModeId,
			pageId: e.activePageId,
			projectId: e.projectId,
			resource: e.location?.resource
		});
		n.setPersistenceScope(i.scope), t.setPersistenceScope(i.scope, { carryRegionState: i.carryRegions });
	};
}, Ou = /* @__PURE__ */ new WeakMap(), ku = (e, t) => {
	Ou.set(e, t);
}, Au = (e) => {
	let t = Ou.get(e);
	if (!t) throw Error("Workbench renderers are not initialized");
	return t;
}, ju = (e) => ({
	validateRegionChange(t, n) {
		let r = e();
		if (!r || r.modes.isTransitioning()) return;
		let i = r.shell.getPanelPolicy(t);
		if (!i.provided) throw Error(`Panel is not provided: ${t}`);
		if (!{
			open: i.canOpen,
			close: i.canClose,
			resize: i.resizable
		}[n]) throw Error(`Panel cannot ${n}: ${t}`);
	},
	validateWidgetOpen(t, n, r) {
		let i = e();
		if (!i || i.modes.isTransitioning() || ![
			"main",
			"secondary",
			"side"
		].includes(t)) return;
		let a = i.shell.getPanelPolicy(t);
		if (!a.provided) throw Error(`Panel is not provided: ${t}`);
		if ((!n || r.resource && h(n.resource) !== h(r.resource)) && !a.acceptsTabs) throw Error(`Panel cannot accept tabs: ${t}`);
		if (!a.open && !a.canOpen) throw Error(`Panel cannot open: ${t}`);
	}
}), Mu = (e, t, n) => ({
	getOpenPlacements() {
		let r = n();
		return [...t.listPlacements(e.getLayout()), ...r ? [r] : []];
	},
	getOpenPlacementIds() {
		let r = new Set(t.placementIds(e.getLayout())), i = n();
		return i && r.add(i.widgetId), r;
	},
	getSnapshot: () => ({ layout: e.getLayout() }),
	restoreSnapshot: (t) => e.restoreLayout(t.layout),
	setPersistenceScope: (t, n = {}) => e.setPersistenceScope(t, { carryRegionState: n.carryRegions }),
	getPersistenceScope: e.getPersistenceScope
}), Nu = (e, t, n, r, i) => Vr({
	registry: t,
	browser: e.pageLocationBrowser ?? Pc(),
	navigationTrees: n,
	modes: r,
	persistence: e.pageLocationPersistence ?? Fc(),
	startPage: e.startPage ?? g.start,
	getResourceRemovalVersion: () => i().resources.getRemovalVersion(),
	getResourceRemovalEpoch: () => i().resources.getRemovalEpoch(),
	restoreLocation: (e, t, n) => Il(i(), e, t, n),
	focusResource: (e, t) => Ll(i(), e, t),
	activateLocation: () => {
		let e = i();
		e.pages.getContent() && e.focus.setActiveRegion("main");
	}
}), Pu = (e) => {
	e?.flush?.(), e?.dispose?.();
}, Fu = (e = {}) => {
	let t, n = Zr(), i = Qr({
		context: n,
		getProjectId: () => t?.pages.store.getState().projectId
	}), a = yu(e), o = Nl(e, () => t), s = {
		...e,
		persistence: void 0,
		layoutPersistence: o.layout
	}, { establishLocation: l, ...u } = Lt({
		defaultRegionVisibility: {
			...e.defaultPanelOpenByRegionId,
			side: (e.initialSidePanelMode ?? "floating") !== "closed"
		},
		getRegionSettings: (n, r = t?.modes.getActiveModeId()) => {
			let i = r ? t?.modes.getMode(r) : void 0;
			return {
				...e.regionSettings?.[n],
				...i?.regionSettings?.[n]
			};
		},
		...ju(() => t),
		normalizeLayout: (e) => hs(t, e),
		getDetachedOwners: () => t ? ha(t.pages) : [],
		persistence: o.layout
	}), d = {
		...u,
		...ui({ commands: i })
	}, f = xn({
		context: n,
		isRegionFocusable: (e) => bc(t, e) ?? d.getLayout().regions[e].visible
	}), { views: p, viewMenus: m, statusBar: g } = Su(e, a), _ = e.pageResources ?? re, v = Ui({
		resourceReferenceKey: (e) => t?.pages.resourceReferenceKey(e) ?? h(e),
		loadLayout: (e) => o.readMode(e.projectId, e.modeId),
		validateOpen: (e, n, r) => gs(t, n, {
			identity: e,
			...r
		}),
		getProjectId: () => t?.pages.store.getState().projectId,
		views: p,
		viewMenus: m,
		getPanel: d.getWidget,
		registerPanel: d
	}), y = ro({
		resourceReferenceKey: (e) => t?.pages.resourceReferenceKey(e) ?? h(e),
		views: p,
		viewMenus: m,
		getPanel: d.getWidget,
		registerPanel: d,
		activatePanel: d.activatePanel,
		getLayout: d.getLayout,
		getScope: d.getPersistenceScope,
		...ds(() => t),
		validateOpen: (e, n, r) => gs(t, n, {
			identity: e,
			...r
		}),
		resolveScope: e.resolvePagePersistenceScope ? (t) => e.resolvePagePersistenceScope({
			...t,
			currentScope: d.getPersistenceScope(),
			resource: t.location?.resource
		}).scope : void 0,
		loadLayout: (e) => o.readMode(e.projectId, e.modeId) ?? fl(s, {
			...e,
			resource: e.location?.resource
		}, d),
		enteredWithPersistedLayout: d.enteredWithPersistedLayout,
		onDidChangePersistenceScope: d.onDidChangePersistenceScope
	}), b = _u(a), x = pa({
		layout: d,
		views: p,
		viewMenus: m
	}), S = Xa({
		layout: d,
		views: p
	}), ee = ye(), C = Hr({ persistence: e.panelMenuStatePersistence }), te = c({
		remove: (e, n) => yc(t, e, n, o.removeResource),
		getPrimary: () => t.getPrimaryResource(),
		resolveView: p.getView
	}), w = an({
		establishLocation: l,
		layout: d,
		resolveContext: () => t
	}), ne = Ql(d, w, e, () => t), ie = Zl({
		layout: d,
		sidePanel: ne,
		getPolicy: (e) => ms(t, e)
	}), T = ul({
		isResourceViewer: (e) => !!(t && xs(t, e)?.kind === "binding"),
		...cs(o),
		loadModeLayout: o.readMode,
		saveModeLayout: o.saveMode,
		beforeApply: Du(e, d, C),
		restorePageState: pl(s, o.loadPageLayout, o.hasPageMain),
		validateLanding: (e, n) => vs(t, e, n),
		revealRegion: (e) => Gs(t, e),
		layout: d,
		modePlacements: v,
		modes: w,
		shellPlacements: y,
		views: p,
		viewMenus: m,
		resources: _
	}), ae = Nu(e, T, b, w, () => t), oe = du(() => t), se = Yl(() => t);
	t = {
		viewers: se.controller,
		getOpenResources: () => {
			let e = o.listResources(d.getLayout()), t = T.getContent()?.resource;
			return t ? [...e.filter((e) => h(e) !== h(t)), t] : e;
		},
		closePlacement: $s(() => t),
		pinPlacement: tc(() => t),
		...Xs(() => t),
		..._c(() => t),
		breadcrumbs: ee,
		commandPalette: be(),
		commands: i,
		composition: oe,
		context: n,
		focus: f,
		fullscreen: xc(() => t),
		host: Mu(d, o, T.getContent),
		keybindings: ti({
			commands: i,
			context: n
		}),
		layout: d,
		modes: w,
		modePlacements: v,
		shellPlacements: y,
		notifications: da(() => $l({
			focus: f,
			layout: d
		})),
		overlays: x,
		placeholders: S,
		pageLocations: ae,
		pages: T,
		navigation: qs(() => t),
		navigationTrees: b,
		panelMenuState: C,
		preferences: oo({ persistence: e.preferencePersistence }),
		treeViews: {
			getTreeState: a.getTreeState,
			setNodeExpanded: a.setNodeExpanded,
			setSectionExpanded: a.setSectionExpanded,
			setSelectedNode: a.setSelectedNode
		},
		commandPaletteResources: qr(),
		resources: te,
		views: p,
		viewMenus: m,
		settings: bo({ hasView: (e) => !!p.getView(e) }),
		statusBar: g,
		statuses: To(),
		shell: ie,
		sidePanel: ne,
		terminal: Kr(),
		themes: Do(),
		fileIconThemes: Eo(),
		getActiveResource() {
			return mu(t);
		},
		async dispose() {
			se.dispose(), ce(), Pu(o.layout), await Promise.all([p.reads.dispose(), t.terminal.dispose()]);
		},
		onDidChangeActiveResource(e) {
			return gu(t, e);
		},
		getPrimaryResource() {
			return hu(t);
		},
		onDidChangePrimaryResource(e) {
			return r(t.pages.store.subscribeSelector((e) => e.location?.resource, () => e(t.getPrimaryResource())));
		},
		registerChildModule(e) {
			return t.registerModule(e);
		},
		...Eu(() => t)
	}, ku(t, a);
	let ce = Sc(t);
	return Xo(t), fs(t, o), Nc({
		breadcrumbs: ee,
		locations: ae,
		pages: T,
		navigationTrees: b,
		modes: w,
		layout: d,
		resources: _
	}), fu(t, e), t;
};
export { P as A, O as B, $r as C, Sn as D, En as E, Ye as F, ve as G, Te as H, Je as I, te as J, de as K, Qe as L, Bt as M, Ct as N, I as O, M as P, Ze as R, ii as S, U as T, Ce as U, Oe as V, D as W, _ as X, S as Y, mi as _, xs as a, gi as b, Fo as c, ma as d, ra as f, _i as g, vi as h, Jc as i, Ht as j, Gt as k, yo as l, fi as m, Au as n, Q as o, $i as p, re as q, eu as r, Po as s, Fu as t, Z as u, pi as v, Xr as w, si as x, hi as y, $e as z };
