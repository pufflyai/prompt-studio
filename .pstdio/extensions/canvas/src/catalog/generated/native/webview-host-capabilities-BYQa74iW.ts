// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./extension-webview-host-capabilities-DOAAv1Ha.ts";
import { n as t, t as n } from "./menu-entries-CDhtPgU6.ts";
import { n as r, t as i } from "./resource-action-menu-C7it1uYl.ts";
import { t as a } from "./extension-navigation-target-4XfOKqwK.ts";
// packages/pstdio-api-contracts/src/extension-kernel/editing-state.ts
var o = (e) => typeof e == "object" && !!e && !Array.isArray(e), s = (e, t, n = []) => {
	let r = [];
	if (Object.keys(e).some((e) => !Object.hasOwn(t, e))) return [{
		path: n,
		value: t
	}];
	for (let [i, a] of Object.entries(t)) {
		let t = e[i];
		if (JSON.stringify(t) === JSON.stringify(a)) continue;
		let c = [...n, i];
		t !== void 0 && o(t) && o(a) ? r.push(...s(t, a, c)) : r.push({
			path: c,
			value: a
		});
	}
	return r;
}, c = (e, t) => {
	let n = structuredClone(e);
	for (let e of t) {
		if (e.path.some((e) => [
			"__proto__",
			"constructor",
			"prototype"
		].includes(e))) throw Error("Invalid editing path");
		if (e.path.length === 0) {
			if (!o(e.value)) throw Error("The editing state root must be an object");
			n = structuredClone(e.value);
			continue;
		}
		let t = n;
		for (let n of e.path.slice(0, -1)) {
			if (t[n] === void 0 && (t[n] = {}), !o(t[n])) throw Error("Editing paths must traverse objects");
			t = t[n];
		}
		t[e.path.at(-1)] = structuredClone(e.value);
	}
	return n;
}, l = (e, t) => {
	let n = e, r = /* @__PURE__ */ new Map();
	for (let [e, i] of t) try {
		n = c(n, i), r.set(e, i);
	} catch {}
	return {
		value: n,
		drafts: r
	};
}, u = "resources.actions", d = (e) => Object.assign(Error(e), { code: e }), f = (e) => JSON.stringify([e.projectId, e.extensionId]), p = (e) => ({
	value: c(e.value, [...e.previews.values()].flat()),
	version: e.version,
	revision: e.revision,
	savedRevision: e.savedRevision
}), m = (e, t) => {
	e.version++;
	let n = p(e);
	for (let r of e.members) r.events.emit({
		scope: "editing.session",
		payload: {
			sessionId: r.id,
			snapshot: n,
			...t?.member === r ? { appliedSequence: t.sequence } : {}
		}
	});
}, h = (e, t) => {
	let n = e.document, r = c(c(n.value, n.previews.get(e) ?? []), t.changes), i = new Map(n.previews);
	i.delete(e), i.set(e, s(n.value, r)), c(n.value, [...i.values()].flat()), n.previews = i, m(n, {
		member: e,
		sequence: t.sequence
	});
}, g = (e, t) => {
	let n = e.document, r = [...n.previews.get(e) ?? [], ...t.changes], i = c(n.value, r), a = new Map(n.previews);
	a.delete(e);
	let o = l(i, a);
	n.value = i, n.previews = o.drafts, r.length && n.revision++, m(n, {
		member: e,
		sequence: t.sequence
	});
}, _ = (e) => {
	let t = e.document;
	if (!t.previews.has(e)) return;
	let n = new Map(t.previews);
	n.delete(e), t.previews = l(t.value, n).drafts, m(t);
}, v = (e, t) => {
	if (t.expectedVersion !== e.version || e.savedRevision !== e.revision) return;
	let n = structuredClone(t.value), r = l(n, e.previews);
	return e.value = n, e.saved = structuredClone(n), e.previews = r.drafts, m(e), p(e);
}, y = (e, t, n, r) => ({
	key: t,
	scope: f(e),
	value: structuredClone(n.initial),
	saved: structuredClone(n.initial),
	version: 0,
	revision: 0,
	savedRevision: 0,
	save: structuredClone(n.save),
	execute: r,
	members: /* @__PURE__ */ new Set(),
	previews: /* @__PURE__ */ new Map(),
	writing: null
}), b = () => {
	let e = /* @__PURE__ */ new Map(), t = /* @__PURE__ */ new WeakMap(), n = (t) => {
		!t.members.size && !t.writing && t.savedRevision === t.revision && e.delete(t.key);
	}, r = (e) => {
		let r = e.document;
		r.members.delete(e), t.get(e.events)?.delete(e.id), _(e), n(r);
	}, i = (e) => (e.writing ||= Promise.resolve().then(async () => {
		for (; e.savedRevision < e.revision;) {
			let t = structuredClone(e.value), n = e.revision, r = s(e.saved, t);
			r.length && await e.execute({
				...e.save,
				params: {
					...e.save.params,
					changes: r.map(({ path: e, value: t }) => ({
						path: e,
						value: t
					}))
				}
			}), e.saved = t, e.savedRevision = n, m(e);
		}
	}).finally(() => {
		e.writing = null, n(e);
	}), e.writing), a = (e) => {
		let n = t.get(e);
		if (n) return n;
		let i = /* @__PURE__ */ new Map();
		return t.set(e, i), e.onDisconnect(() => {
			for (let e of i.values()) r(e);
		}), i;
	}, o = (t, n, r) => {
		if (!n.save.commandId.startsWith(`${t.extensionId}.command.`)) throw d("editing_save_not_owner");
		let i = JSON.stringify([
			t.projectId,
			t.extensionId,
			n.key
		]), o = e.get(i);
		if (o && (o.save.commandId !== n.save.commandId || s(o.save.params ?? {}, n.save.params ?? {}).length)) throw d("editing_save_mismatch");
		let c = a(t.events), l = c.get(n.sessionId);
		if (l && l.document !== o) throw d("editing_session_duplicate");
		if (o || (o = y(t, i, n, r), e.set(i, o)), !l) {
			let e = {
				id: n.sessionId,
				events: t.events,
				document: o
			};
			c.set(n.sessionId, e), o.members.add(e);
		}
		return p(o);
	};
	return (e) => ({ async request(t, n) {
		if (t.operation === "open") return o(e, t, n);
		let s = a(e.events).get(t.sessionId);
		if (!s && t.operation === "close") return;
		if (!s || s.document.scope !== f(e)) throw d("editing_session_closed");
		let c = s.document;
		if (t.operation === "close") r(s);
		else {
			switch (t.operation) {
				case "preview":
					h(s, t);
					break;
				case "cancel":
					_(s);
					break;
				case "refresh": return v(c, t);
				case "commit":
					g(s, t), await i(c);
					break;
				case "save": await i(c);
			}
			return p(c);
		}
	} });
}, x = /* @__PURE__ */ new WeakMap(), S = (e) => {
	let { workbench: t, extensionId: n, projectId: r, hostEvents: i } = e;
	if (!n || !r || !i) return;
	let a = x.get(t);
	return a || (a = b(), x.set(t, a)), a({
		extensionId: n,
		projectId: r,
		events: i
	});
}, C = (e) => {
	let t = e.workbench.preferences, n = () => {
		if (!e.extensionId) throw Error("Preferences require the calling extension identity");
		return e.extensionId;
	}, r = (n) => {
		let r = t.getSchema(n);
		return r && e.extensionId && r.ownerId !== "workbench.core" && r.ownerId !== e.extensionId && (e.warn ?? console.warn)(`Cross-extension preference access to ${n} is deprecated. Use preferences owned by ${e.extensionId}.`), !!r;
	};
	return {
		get: (i, a) => r(i) ? t.getValue(i, a) : (n(), e.ownedPreferences?.get(i, a) ?? t.getOwnedValue(n(), i, a)),
		set: (i, a, o) => {
			if (o.scope === "default") throw Error("preference_scope_read_only");
			return r(i) ? t.setValue(i, a, o) : (n(), e.ownedPreferences ? e.ownedPreferences.set(i, a, o) : t.setOwnedValue(n(), i, a, o));
		}
	};
}, w = (e, t) => {
	let n, i = !1, a = () => {
		i || (i = !0, queueMicrotask(() => {
			i = !1, t?.emit({
				scope: u,
				payload: { type: "changed" }
			});
		}));
	};
	return () => {
		if (!t || n) return;
		let i = r(e, a), o = t.onDisconnect(() => n?.());
		n = () => {
			i(), o(), n = void 0;
		};
	};
}, T = (e, r, a, o) => {
	let s = w(e, a);
	return async (a) => {
		let c = i(e, r ? {
			...a.resource,
			projectId: r
		} : a.resource), l = c ? n(t({
			...c,
			context: {
				...c.context,
				placement: o,
				projectId: r
			}
		})) : [];
		if (a.operation === "execute") {
			let e = l.find(({ id: e }) => e === a.key);
			if (!e?.run || e.disabled) throw Error("This resource action is no longer available.");
			return await e.run(), [];
		}
		return s(), l.map((e) => ({
			key: e.id,
			label: e.label,
			commandId: e.commandId,
			icon: e.icon,
			iconSrc: e.iconSrc,
			description: e.description,
			isDisabled: e.disabled,
			separatorBefore: e.separatorBefore,
			group: e.group ?? c?.group
		}));
	};
}, E = (e) => {
	let { workbench: t, placement: n, extensionId: r, projectId: i, hostEvents: o } = e, s = t.viewers.captureContext(n?.placementIdentity), c = () => {
		if (i && i !== t.pages.store.getState().projectId) throw Error("The calling view belongs to another project");
		if (s.isViewerCurrent?.() === !1) throw Error("The calling viewer is no longer open");
	}, l = T(t, i, o, n?.placementIdentity);
	return {
		resourceActions: async (e) => (c(), l(e)),
		hostEvents: o,
		editing: S(e),
		executeCommand: async (e, r) => (c(), { outcome: {
			ok: !0,
			status: "success",
			value: await t.commands.executeCommand(e.commandId, e.params, {
				resource: e.resource ?? n?.resource,
				placement: n?.placementIdentity,
				projectId: i,
				signal: r,
				removalVersion: s.removalVersion,
				isViewerCurrent: s.isViewerCurrent
			})
		} }),
		placement: n?.placementIdentity ? { close: () => (c(), t.closePlacement(n.placementIdentity)) } : void 0,
		pageParams: { update: (e) => {
			c();
			let n = t.pages.store.getState();
			if (!n.location) throw Error("page_params_no_page");
			if (!r || r !== n.location.page.extensionId) throw Error("page_params_not_owner");
			return t.pageLocations.updateParams(e);
		} },
		navigation: { open: (e) => t.navigation.openTarget(a(e, {
			extensionId: r,
			projectId: i
		}), {
			...s,
			projectId: i ?? s.projectId
		}) },
		notifications: { show: (e) => {
			e.type === "error" ? t.notifications.captureActionError(e.title ?? "Extension action", n?.instanceId)(Error(e.message)) : t.notifications.show({
				level: e.type,
				metadata: e.metadata,
				title: e.title ?? e.message,
				message: e.title === void 0 ? void 0 : e.message
			});
		} },
		preferences: C(e),
		terminal: t.terminal
	};
}, D = (t) => e(E(t));
export { D as n, E as t };
