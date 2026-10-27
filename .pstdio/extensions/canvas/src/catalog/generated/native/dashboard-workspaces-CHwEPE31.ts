// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { D as e } from "./workbench-core-kaLFKJEn.ts";
import { t } from "./widget-ids-CvvbLhYP.ts";
import { t as n } from "./navigation-level-composition-CFeKYFum.ts";
import { a as r, n as i } from "./collections-CVGR0OYX.ts";
import { n as a } from "./api-BQ3Fs8xe.ts";
import { n as o } from "./runtime-state-DUeC3JNx.ts";
import { i as s } from "./workbench-extension-contributions-Dqir4_Ek.ts";
import { i as c, s as l } from "./project-context-BR7AjHlE.ts";
import { i as u, n as d, r as f } from "./dashboard-rows-wkmk8GQV.ts";
import { r as p, t as m } from "./resources-CR_Z7fRd.ts";
import { resourceKey as h, workbenchPages as g } from "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/shared/extensions/resource-identity.ts
var _ = (e, t, n = s(t)?.resourceKinds ?? []) => {
	let r = e.extensionId;
	!r && [
		"project",
		"workspace",
		"session",
		"session-draft"
	].includes(e.type) && (r = "pstdio");
	let i = n.filter((t) => (t.localId ?? t.id) === e.type);
	return !r && i.length === 1 && (r = i[0].extensionId), {
		...e,
		projectId: e.projectId ?? t,
		...r ? { extensionId: r } : {}
	};
}, v = (e, t, n) => ({
	...e,
	...e.resource ? { resource: _(e.resource, t, n) } : {},
	...e.parent ? { parent: v(e.parent, t, n) } : {}
}), y = (e, t) => {
	let n = c(e);
	if (!n) throw Error("Cannot navigate to a dashboard page without a selected project");
	e.pageLocations.setProject(n);
	let r = e.pageLocations.navigate(v({
		kind: "page",
		page: t.page,
		...t.resource ? { resource: t.resource } : {},
		...t.parent ? { parent: t.parent } : {},
		...t.open ? { open: t.open } : {}
	}, n));
	if (!r.ok) throw Error(r.diagnostic.message);
	return r.location;
}, b = (e, t) => {
	let n = g.sessions;
	return t?.type === "session" && (n = g.session), t?.type === "session-draft" && (n = g.newSession), y(e, {
		page: n,
		...t ? { resource: t } : {}
	});
}, x = (e, t, n) => y(e, {
	page: t ? g.workspace : g.workspaces,
	...t ? { resource: t } : {},
	...n ? { parent: n } : {}
}), S = (e) => {
	let t = e.provider_error_json;
	if (e.setup_error || t?.message) return "failed";
	if (e.initializing) return "provisioning";
	let n = e.provider_state ?? "ready";
	return n === "ready" ? e.execution_kind !== "remote" && !e.root_path ? e.is_default ? "unattached" : "unavailable" : "ready" : String(n);
}, C = (e) => [...i("workspaces").state.values()].some((t) => t.project_id === e && t.is_default && !t.deleted_at && S(t) === "unattached"), w = o(() => ({
	summaries: /* @__PURE__ */ new Map(),
	listeners: /* @__PURE__ */ new Set()
}), (e) => {
	e.summaries.clear(), e.listeners.clear();
}), T = (e) => `+${e.additions} -${e.deletions}`, E = (e) => ({
	workspaceId: e.workspace_id,
	additions: e.additions,
	deletions: e.deletions,
	fileCount: e.file_count
}), D = async (e, t, n) => {
	let r = await a(t.connection).workspaces.diffSummary(e, "fork_point", n);
	return r ? E(r) : null;
}, O = (e, t) => {
	if (!e || t.isDisposed()) return null;
	let n = w(t);
	n.summaries.set(e.workspaceId, e);
	for (let t of n.listeners) t(e.workspaceId);
	return e;
}, k = (e, t = r()) => w(t).summaries.get(e), A = (e, t = r()) => {
	let n = /* @__PURE__ */ new Map();
	for (let r of e) {
		let e = w(t).summaries.get(r);
		e && n.set(r, e);
	}
	return n;
}, j = async (e, t, n = r()) => {
	t?.throwIfAborted();
	let i = n.getCollection("workspaces").state.get(e);
	return !i || S(i) !== "ready" || i.provider_capabilities_json?.diff !== !0 ? null : w(n).summaries.get(e) || O(await D(e, n, t), n);
}, ee = async (t, n, i = r()) => {
	let a = /* @__PURE__ */ new Map(), o = [...new Set(t)];
	for (let t = 0; t < o.length; t += 4) {
		let r = await e(o.slice(t, t + 4).map((e) => async (t) => {
			try {
				return [e, await j(e, t, i)];
			} catch (n) {
				if (t.throwIfAborted(), n instanceof Error && n.name === "AbortError") throw n;
				return [e, null];
			}
		}), n);
		for (let [e, t] of r) t && a.set(e, t);
	}
	return a;
}, M = (e, t = r()) => {
	let n = w(t).listeners;
	return n.add(e), () => {
		n.delete(e);
	};
}, N = (e) => {
	let t = !1, n = !1;
	return {
		notify() {
			t || n || (t = !0, queueMicrotask(() => {
				t = !1, n || e();
			}));
		},
		dispose() {
			n = !0;
		}
	};
}, P = (e, t) => {
	let n = r(), i = N(t), a = () => n.getIndexedRows("workspace_sessions", "session_id", e).map((e) => String(e.workspace_id)), o = a(), s = () => o.map((e) => k(e, n)), c = s(), l = n.subscribeCollections((t) => {
		e && (t ? t.changes.some(({ key: n, value: r, previousValue: i }) => t.table === "sessions" && n === e || t.table === "workspaces" && o.includes(n) || t.table === "workspace_sessions" && [r, i].some((t) => t?.session_id === e)) && (o = a(), i.notify()) : (o = a(), i.notify()));
	}), u = M(() => {
		let e = s();
		(e.length !== c.length || e.some((e, t) => e !== c[t])) && (c = e, i.notify());
	}, n);
	return () => {
		i.dispose(), l(), u();
	};
}, F = (e) => {
	let t = N(e), n = r().subscribeCollections((e) => {
		(!e || [
			"sessions",
			"workspaces",
			"workspace_sessions"
		].includes(e.table)) && t.notify();
	});
	return () => {
		t.dispose(), n();
	};
}, I = (e, r = {}) => {
	if (e.views.getView(t.dashboardSidenav)) {
		"selectedNode" in r && e.treeViews.setSelectedNode(t.dashboardSidenav, r.selectedNode ?? void 0);
		for (let r of n(e).getDefaultExpandedSectionIds()) e.treeViews.setSectionExpanded(t.dashboardSidenav, r, !0);
		e.views.refreshView(t.dashboardSidenav);
	}
}, L = (e, n) => {
	e.views.getView(t.dashboardSidenav) && e.treeViews.setSelectedNode(t.dashboardSidenav, n);
}, R = (e) => {
	e.modes.getActiveModeId() && I(e);
}, z = (e) => {
	let r = n(e);
	e.views.registerView({
		id: t.dashboardSidenav,
		title: "Sidenav",
		body: {
			kind: "tree",
			getReadKey: () => r.getReadKey(),
			getStructure: () => r.getStructure("content"),
			getHeaderStructure: () => r.getStructure("header"),
			getFooterStructure: () => r.getStructure("footer"),
			defaultExpandedNodeIds: ["workspace-sessions"],
			defaultExpandedSectionIds: ["sessions-wrap"],
			canMove: ({ source: e, destination: t }) => e.moveScope === t.moveScope,
			getHeader: (e) => r.getSections("header", e.signal, e.onProgress),
			getBody: (e) => r.getSections("content", e.signal, e.onProgress),
			getFooter: (e) => r.getSections("footer", e.signal, e.onProgress),
			getChildren: (t, n) => e.navigationTrees.getChildren(t, n),
			moveNode: (t, n, r) => e.navigationTrees.moveNode(t, n, r)
		}
	}, { priority: 80 }), e.shellPlacements.registerPlacement({
		id: "dashboard.sidenav",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: t.dashboardSidenav
			}
		},
		region: "sidenav"
	});
}, B = (e) => {
	z(e);
	let n = () => {
		e.views.getView(t.dashboardSidenav) && e.views.refreshView(t.dashboardSidenav);
	}, r = e.modes.onDidChangeActive(() => R(e)), i = e.onDidChangePrimaryResource(n), a = e.pages.store.subscribeSelector((e) => e.location, () => I(e)), o = F(n), s = l(e, n), c = e.navigationTrees.onDidChange(() => R(e));
	return { dispose: () => {
		r.dispose(), i.dispose(), a(), o(), s(), c.dispose();
	} };
}, V = (e) => typeof e == "object" && !!e && !Array.isArray(e), H = (e) => V(e) && typeof e.type == "string" && typeof e.id == "string", U = (e) => {
	let t = e.anchors_json;
	return Array.isArray(t) ? t.filter(H) : [];
}, W = (e) => e.execution_kind === "remote" ? "remote" : e.provider_id === "pstdio.worktree" ? "worktree" : "folder", G = {
	folder: "Folder",
	worktree: "GitBranch",
	remote: "Cloud"
}, K = (e) => G[e], q = (e) => ({
	workspaceExecutionKind: e.executionKind,
	workspaceProviderState: e.providerState,
	workspaceSupportsDelete: e.supportsDelete,
	workspaceSupportsFiles: e.supportsFiles,
	workspaceSupportsDiff: e.supportsDiff
}), J = (e, t) => e === "local" && t !== "none", Y = (e) => {
	let t = e.execution_kind === "remote" ? "remote" : "local", n = e.provider_capabilities_json, r = t === "remote" ? null : e.root_path ?? null;
	return {
		id: e.id,
		title: e.name ?? e.workspace_shorthand,
		shorthand: e.workspace_shorthand,
		branch: e.branch ?? null,
		type: W(e),
		isDefault: !!e.is_default,
		executionKind: t,
		providerState: S(e),
		supportsFiles: J(t, n?.files),
		supportsDiff: n?.diff === !0,
		supportsDelete: n?.delete === !0,
		workspacePath: r,
		updatedAt: e.updated_at ?? e.created_at ?? ""
	};
}, X = (e, t) => m("workspace", e.id, e.title, K(e.type), t, {
	workspaceId: e.id,
	workspaceShorthand: e.shorthand,
	workspaceType: e.type,
	workspaceIsDefault: e.isDefault,
	...q(e),
	...e.workspacePath ? { workspacePath: e.workspacePath } : {},
	...e.branch ? { workspaceBranch: e.branch } : {}
}), Z = (e, t) => e.workspaces.filter((e) => f(e) && d(e, t)).map((e) => Y(e)).sort((e, t) => e.isDefault === t.isDefault ? t.updatedAt.localeCompare(e.updatedAt) : e.isDefault ? -1 : 1), Q = (e) => Z(u(), e), te = (e) => {
	let t = U(e)[0];
	return t ? { resourceParent: {
		type: t.type,
		id: t.id,
		...t.label ? { label: t.label } : {},
		...t.metadata ? { metadata: t.metadata } : {}
	} } : {};
}, ne = (e) => {
	let t = e.workspace.branch, n = e.workspace.execution_kind === "remote" ? "remote" : "local", r = S(e.workspace), i = e.workspace.provider_error_json, a = e.workspace.provider_capabilities_json, o = {
		workspaceId: e.workspace.id,
		...e.workspacePath ? { workspacePath: e.workspacePath } : {},
		workspaceShorthand: e.workspace.workspace_shorthand,
		workspaceType: W(e.workspace),
		...q({
			executionKind: n,
			providerState: r,
			supportsDelete: a?.delete === !0,
			supportsFiles: J(n, a?.files),
			supportsDiff: a?.diff === !0
		}),
		...e.workspace.provider_id ? { workspaceProviderId: e.workspace.provider_id } : {},
		...e.workspace.display_path ? { workspaceDisplayPath: e.workspace.display_path } : {},
		workspaceError: e.workspace.setup_error ?? i?.message ?? null,
		workspaceIsDefault: !!e.workspace.is_default,
		...te(e.workspace),
		...t ? { workspaceBranch: t } : {}
	};
	return e.summary && (o.diffOverview = T(e.summary), o.diffAdditions = e.summary.additions, o.diffDeletions = e.summary.deletions, o.diffFileCount = e.summary.fileCount), o;
}, $ = (e, t = {}) => e.workspaces.filter((e) => f(e) && d(e, t.projectId)).map((e) => {
	let n = e.name ?? e.workspace_shorthand, r = W(e), i = t.diffSummariesByWorkspaceId?.get(e.id), a = i ? T(i) : void 0, o = e.execution_kind === "remote" ? null : e.root_path ?? null, s = e.provider_error_json, c = ne({
		workspace: e,
		workspacePath: o,
		summary: i
	});
	return {
		id: e.id,
		title: n,
		shorthand: e.workspace_shorthand,
		type: r,
		additions: i?.additions ?? 0,
		deletions: i?.deletions ?? 0,
		diffOverview: a,
		diffFileCount: i?.fileCount,
		createdAt: e.created_at ?? "",
		updatedAt: e.updated_at ?? "",
		branch: e.branch ?? null,
		worktreePath: e.root_path ?? null,
		isDefault: !!e.is_default,
		setupError: e.setup_error ?? s?.message ?? null,
		displayPath: e.display_path ?? o,
		supportsDiff: c.workspaceSupportsDiff === !0,
		provider: e.provider_id ?? "pstdio.root",
		providerState: S(e),
		resource: m("workspace", e.id, n, K(r), e.project_id, c)
	};
}).sort((e, t) => e.createdAt.localeCompare(t.createdAt)), re = (e, t) => e ? $(u(), { projectId: e }).find((e) => e.isDefault)?.setupError ?? null : null, ie = (e) => {
	let t = i("workspaces").state.get(e);
	return t ? K(W(t)) : p.workspaces.icon;
}, ae = (e) => {
	let t = u();
	return $(t, {
		projectId: e,
		diffSummariesByWorkspaceId: A(t.workspaces.filter((e) => !e.archived).map((e) => e.id))
	});
}, oe = (e) => {
	let t = e.providerState.replaceAll("_", " ");
	return `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}, se = {
	worktree: "Git worktree",
	folder: "Project folder",
	remote: "Remote workspace"
}, ce = (e) => {
	if (!e.supportsDiff) return "Not supported";
	if (e.diffOverview !== void 0) return {
		additions: e.additions,
		deletions: e.deletions
	};
}, le = (e) => {
	let t = ce(e);
	return {
		id: h(e.resource),
		resource: e.resource,
		values: {
			name: e.title,
			type: se[e.type],
			...e.displayPath ? { location: e.displayPath } : {},
			created: e.createdAt,
			...t === void 0 ? {} : { diff: t },
			attempt: e.shorthand,
			provider: e.provider,
			state: oe(e),
			branch: e.branch ?? "",
			updated: e.updatedAt,
			...e.setupError ? { error: e.setupError } : {}
		}
	};
};
export { C as _, Z as a, U as c, I as d, P as f, M as g, ee as h, le as i, B as l, k as m, re as n, X as o, F as p, ie as r, Q as s, ae as t, L as u, b as v, x as y };
