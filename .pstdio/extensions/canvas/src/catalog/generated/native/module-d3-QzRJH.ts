// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { a as e, i as t } from "./resource-registry-CVuZngrt.ts";
import { _ as n, h as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./widget-ids-CvvbLhYP.ts";
import { a, i as o, l as s, n as c, o as l } from "./collections-CVGR0OYX.ts";
import { n as u } from "./api-BQ3Fs8xe.ts";
import { i as d, n as ee } from "./project-context-BR7AjHlE.ts";
import { n as f, t as te } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as p } from "./commands-Bp5w85f4.ts";
import { n as m, r as h } from "./dashboard-rows-wkmk8GQV.ts";
import { n as ne, r as g, t as re } from "./resources-CR_Z7fRd.ts";
import { c as _, d as ie, m as ae, o as v, p as y, r as oe, s as se, u as ce, v as b } from "./dashboard-workspaces-CHwEPE31.ts";
import { Suspense as x, lazy as S } from "react";
import { Spinner as C } from "@chakra-ui/react";
import { resolveSessionIndicatorColor as le } from "@pstdio/ui";
import { jsx as w } from "react/jsx-runtime";
import { resourceKey as T, workbenchPages as E, workbenchPanels as D } from "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/modules/sessions/data/dashboard-sessions.ts
var ue = (...e) => e.filter((e) => typeof e == "string" && e.length > 0).sort((e, t) => t.localeCompare(e))[0] ?? "", O = (e, t) => {
	let n = e.title ?? "Session", r = e.project_id ?? t?.project_id, i = e.updated_at ?? e.created_at ?? "", a = [..._(e), ...t ? _(t) : []], o = a[0];
	return {
		device: e.device,
		id: e.id,
		title: n,
		status: e.status ?? "unknown",
		agent: e.agent ?? null,
		lastSelectedModel: e.last_selected_model ?? null,
		params: e.params_json ?? {},
		updatedAt: i,
		lastActivityAt: ue(e.last_request_ended, e.last_request_started, i),
		workspaceId: t?.id ?? null,
		workspaceBranch: t?.branch ?? null,
		workspaceShorthand: t?.workspace_shorthand ?? "",
		anchors: a,
		resource: ne(e.id, n, r, {
			status: e.status ?? "unknown",
			...o ? { resourceParent: o } : {}
		})
	};
}, de = (e, t = {}) => {
	let n = new Map(e.workspaces.filter((e) => h(e) && m(e, t.projectId)).map((e) => [e.id, e])), r = /* @__PURE__ */ new Map();
	for (let t of e.workspaceSessions) {
		let e = n.get(t.workspace_id);
		e && r.set(t.session_id, e);
	}
	return e.sessions.filter((e) => h(e) && m(e, t.projectId)).map((e) => O(e, r.get(e.id))).sort((e, t) => t.lastActivityAt.localeCompare(e.lastActivityAt) || e.id.localeCompare(t.id));
}, k = /* @__PURE__ */ new WeakMap(), A = (e) => {
	let t = a(), n = [
		"sessions",
		"workspaces",
		"workspace_sessions"
	].map((e) => t.getCollectionVersion(e)).join(":"), r = k.get(t);
	r?.version !== n && (r = {
		version: n,
		projects: /* @__PURE__ */ new Map()
	}, k.set(t, r));
	let i = r.projects.get(e);
	if (i) return i;
	let o = de({
		sessions: [...c("sessions").values()],
		workspaces: [...c("workspaces").values()],
		workspaceSessions: [...c("workspace_sessions").values()]
	}, { projectId: e });
	return r.projects.set(e, o), o;
}, j = (e, t) => {
	if (!e) return;
	let n = c("sessions").get(e);
	return !n || !h(n) || !m(n, t) ? void 0 : O(n, o("workspace_sessions", "session_id", e).flatMap((e) => {
		let t = c("workspaces").get(String(e.workspace_id));
		return t && h(t) ? [t] : [];
	}).at(-1));
}, M = "draft", N = {
	id: M,
	draftKey: M,
	sessionId: void 0,
	workspaceTitle: "",
	workspaceId: null,
	workspaceBranch: null,
	workspaceShorthand: "",
	agent: null,
	lastSelectedModel: null,
	params: {},
	lastRequestStarted: null,
	additions: 0,
	deletions: 0,
	messages: []
}, P = (e, t) => {
	let n = e?.metadata?.[t];
	return typeof n == "string" ? n : void 0;
}, fe = (e) => ({
	...N,
	draftKey: e?.id ?? "draft",
	workspaceTitle: P(e, "workspaceTitle") ?? "",
	workspaceId: P(e, "workspaceId") ?? null,
	workspaceBranch: P(e, "workspaceBranch") ?? null,
	workspaceShorthand: P(e, "workspaceShorthand") ?? ""
}), pe = (e) => ({
	...N,
	id: e,
	draftKey: e,
	sessionId: e
}), me = (e) => {
	if (!e) return N;
	let t = j(e);
	if (!t) return pe(e);
	let n = t.workspaceId ? c("workspaces").get(t.workspaceId) : void 0, r = t.workspaceId ? ae(t.workspaceId) : void 0;
	return {
		device: t.device,
		id: t.id,
		draftKey: t.id,
		sessionId: t.id,
		status: t.status,
		lastRequestStarted: c("sessions").get(t.id)?.last_request_started ?? null,
		workspaceTitle: n?.name ?? n?.workspace_shorthand ?? "",
		workspaceId: n?.id ?? null,
		workspaceBranch: n?.branch ?? t.workspaceBranch ?? null,
		workspaceShorthand: t.workspaceShorthand,
		agent: t.agent,
		lastSelectedModel: t.lastSelectedModel,
		params: t.params,
		additions: r?.additions ?? 0,
		deletions: r?.deletions ?? 0,
		messages: []
	};
}, he = (e) => {
	let t = e?.type === "session" ? e.id : void 0;
	return t ? me(t) : e?.type === "session-draft" ? fe(e) : N;
}, F = (e) => he(e.resource), ge = (e) => e === "in_progress" ? "LoaderCircle" : e === "completed" ? "CircleCheck" : e === "failed" ? "CircleAlert" : e === "cancelled" ? "CircleStop" : e === "disconnected" ? "CirclePause" : e === "queued" ? "ClockAlert" : e === "awaiting_input" ? "CircleDot" : "CircleDashed", I = (e) => ({
	icon: ge(e),
	color: le(e),
	label: e ? `Session status: ${e}` : "Session status"
}), L = (e, t) => {
	let n = t ?? e.resource?.metadata?.status;
	return typeof n == "string" ? n : void 0;
}, _e = (e) => {
	if (e.workspaceId) return re("workspace", e.workspaceId, e.workspaceTitle || e.workspaceShorthand || "Workspace", oe(e.workspaceId), e.projectId, {
		workspaceId: e.workspaceId,
		...e.workspaceBranch ? { workspaceBranch: e.workspaceBranch } : {},
		...e.workspaceShorthand ? { workspaceShorthand: e.workspaceShorthand } : {}
	});
}, ve = (e, t) => {
	let n = e.getPrimaryResource(), r = F(t);
	if (!r.workspaceId && n?.type === "workspace") return n;
	let i = e.context.get(ee);
	return _e({
		projectId: typeof i == "string" ? i : void 0,
		workspaceId: r.workspaceId,
		workspaceTitle: r.workspaceTitle,
		workspaceShorthand: r.workspaceShorthand,
		workspaceBranch: r.workspaceBranch
	});
}, R = (e) => ({
	subscribe: y,
	getSnapshot(t) {
		let n = j(F(t).sessionId), r = L(t, n?.status), i = ve(e, t);
		return {
			label: n?.title ?? t.resource?.label ?? "New session",
			icon: "message-circle",
			indicator: I(r),
			menu: [{
				id: "sessions",
				label: "Sessions",
				rows: [{
					id: "new-session",
					label: "New session",
					icon: "MessageSquarePlus",
					action: {
						kind: "command",
						commandId: p.createSession,
						args: {
							workspace: i,
							replacePanel: t.placementIdentity,
							from: t.resource
						}
					}
				}, {
					id: "switch-session",
					label: "Switch session",
					icon: "Search",
					action: {
						kind: "command",
						commandId: p.switchSession,
						args: {
							placementIdentity: t.placementIdentity,
							from: t.resource
						}
					}
				}]
			}]
		};
	}
}), z = (e) => e === "project" ? D.projectSession : {
	kind: "placement",
	extensionId: "pstdio",
	id: `session.${e}`
}, ye = (e) => {
	let t = /* @__PURE__ */ new Map(), n = () => {
		let n = /* @__PURE__ */ new Set(["project", ...e.modes.listModes().map((e) => e.id)]);
		for (let [e, r] of t) n.has(e) || (r.dispose(), t.delete(e));
		for (let r of n) {
			if (t.has(r)) continue;
			let n = e.modePlacements.registerPlacement({
				id: `dashboard.session-bubble.${r}`,
				ref: z(r),
				modeId: r,
				region: "side",
				item: {
					kind: "binding",
					binding: {
						kinds: [{
							kind: "resource-kind",
							id: "session"
						}, {
							kind: "resource-kind",
							id: "session-draft"
						}],
						view: {
							kind: "view",
							id: i.sessionBubble
						},
						cardinality: "many",
						add: {
							kind: "command",
							target: { command: {
								kind: "command",
								extensionId: "pstdio",
								id: p.createSession
							} }
						}
					}
				},
				tab: R(e)
			});
			t.set(r, n);
		}
	};
	n();
	let r = e.modes.store.subscribe(n);
	return { dispose() {
		r();
		for (let e of t.values()) e.dispose();
		t.clear();
	} };
}, B = (e, t = {}) => {
	let n = e.modes.getActiveModeId();
	if (t.resource && n) return e.navigation.openTarget({
		kind: "panel",
		panel: z(n),
		resource: t.resource,
		open: t.tabRetention === "persistent" ? "pin" : "preview",
		region: t.region
	});
}, be = (e, t) => t.replacePanel ? e.navigation.openTarget({
	kind: "viewer",
	operation: "switch",
	from: t.from,
	resource: t.resource,
	...t.replacePanel.kind === "page" ? { page: E.session } : {}
}, {
	viewer: t.replacePanel,
	projectId: t.from?.projectId
}) : B(e, {
	resource: t.resource,
	tabRetention: t.tabRetention,
	region: t.region
}), xe = (e) => {
	e.commands.registerCommand({
		id: p.switchSession,
		label: "Switch session",
		category: "Dashboard",
		icon: "Search"
	}, { execute: (t, n) => {
		let { placementIdentity: r = n?.placement, page: i, from: a = n?.resource } = t ?? {}, o = d(e), s = (t) => r ? e.navigation.openTarget({
			kind: "viewer",
			operation: "switch",
			from: a,
			resource: t,
			...r.kind === "page" ? { page: i ?? E.session } : {}
		}, {
			viewer: r,
			projectId: o
		}) : e.navigation.openPage({
			page: i ?? E.session,
			resource: t
		});
		e.commandPalette.open({ resourceSearch: {
			label: "Switch session",
			placeholder: "Search sessions",
			subscribe: y,
			list: () => A(o).map(({ resource: e, status: t }) => ({
				resource: e,
				indicator: I(t),
				activate: s
			}))
		} });
	} });
}, Se = S(() => import("./session-widget-DYYDaTT9.ts").then((e) => ({ default: e.SessionWidget }))), V = (e, t) => {
	let n = e?.metadata?.[t];
	return typeof n == "string" ? n : void 0;
}, Ce = (e) => {
	let t = d(e);
	if (!t) return;
	let n = se(t)[0];
	if (n) return v(n, t);
}, H = (e) => {
	let t = e.getPrimaryResource();
	return t?.type === "workspace" ? t : void 0;
}, we = (e, t) => {
	let n = e?.id ?? V(e, "workspaceId"), r = V(e, "workspaceShorthand"), i = V(e, "workspaceBranch"), a = V(e, "workspacePath"), o = e?.label ?? r;
	return {
		type: "session-draft",
		extensionId: "pstdio",
		projectId: t,
		id: `${n ? `new-${n}` : "new"}-${globalThis.crypto.randomUUID()}`,
		label: "New session",
		icon: "message-circle",
		metadata: {
			...n ? { workspaceId: n } : {},
			...o ? { workspaceTitle: o } : {},
			...r ? { workspaceShorthand: r } : {},
			...i ? { workspaceBranch: i } : {},
			...a ? { workspacePath: a } : {}
		}
	};
}, Te = (e, t) => {
	e.views.registerView({
		id: i.sessionBubble,
		title: "New session",
		icon: "MessageCircle",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ w(x, {
				fallback: /* @__PURE__ */ w(C, {}),
				children: /* @__PURE__ */ w(Se, {
					input: e,
					drafts: t
				})
			})
		}
	}, { priority: 30 });
}, Ee = (e, t = {}) => {
	let n = we(t.workspace ?? H(e) ?? Ce(e), d(e)), r = t.replacePanel;
	return r ? e.navigation.openTarget({
		kind: "viewer",
		operation: "switch",
		from: t.from,
		resource: n,
		...r.kind === "page" ? { page: E.newSession } : {}
	}, {
		viewer: r,
		projectId: d(e)
	}) : !t.sidePanel && t.region === void 0 ? b(e, n) : B(e, {
		resource: n,
		tabRetention: t.tabRetention,
		region: t.region
	});
}, De = (e) => {
	e.commands.registerCommand({
		id: p.openSessionPanel,
		label: "Open session panel",
		category: "Dashboard",
		icon: "MessageCircle"
	}, { execute: async (t, n) => {
		let { resource: r = n?.resource, selectWorkspaceSidenav: i = !0, tabRetention: a, replacePanel: o, from: s = n?.resource } = t ?? {};
		if (r?.type !== "session" || !r.id) return;
		let c = be(e, {
			resource: r,
			tabRetention: a,
			replacePanel: o,
			from: s
		});
		return i && H(e) && e.commands.getCommand(p.selectWorkspaceSidenavSession) && await e.commands.executeCommand(p.selectWorkspaceSidenavSession, { resource: r }), c;
	} }), e.commands.registerCommand({
		id: p.createSession,
		label: "New session",
		category: "Dashboard",
		icon: "MessageSquarePlus"
	}, { execute: async (t, n) => {
		let { workspace: r, replacePanel: i, sidePanel: a = !1, from: o = n?.resource } = t ?? {}, s = n?.source === "panel-add";
		await Ee(e, {
			workspace: r,
			replacePanel: s ? void 0 : i,
			from: o,
			sidePanel: a || s && n?.region !== "main",
			tabRetention: s ? "persistent" : void 0,
			region: n?.region
		});
	} });
}, U = (e = {}) => ({
	id: "dashboard.session-bubble",
	activate(t) {
		return Te(t, e.sessionDraftPersistence), De(t), xe(t), ye(t);
	}
}), Oe = (e) => (e.pages.registerPage({
	id: g.sessions.id,
	ref: E.sessions,
	title: g.sessions.label,
	icon: g.sessions.icon,
	path: "sessions",
	modeId: "project",
	main: {
		kind: "group",
		default: E.sessionComposer
	},
	slots: []
}), e.pages.registerPage({
	id: E.sessionComposer.id,
	ref: E.sessionComposer,
	title: "New session",
	icon: "message-circle",
	path: "sessions/compose",
	modeId: "project",
	parentId: g.sessions.id,
	main: {
		kind: "view",
		view: {
			kind: "view",
			id: i.session
		},
		cardinality: "one",
		presentation: "page",
		tab: R(e)
	},
	slots: []
}), e.pages.registerPage({
	id: E.newSession.id,
	ref: E.newSession,
	title: "New session",
	icon: "message-circle",
	path: "sessions/new",
	modeId: "project",
	parentId: g.sessions.id,
	resource: { kinds: [{
		kind: "resource-kind",
		id: "session-draft"
	}] },
	main: {
		kind: "view",
		view: {
			kind: "view",
			id: i.session
		},
		cardinality: "one",
		presentation: "page",
		tab: R(e)
	},
	panelView: D.projectSession,
	slots: []
}), e.pages.registerPage({
	id: E.session.id,
	ref: E.session,
	title: "Session",
	icon: "message-circle",
	path: "session",
	modeId: "project",
	parentId: g.sessions.id,
	resource: { kinds: [{
		kind: "resource-kind",
		id: "session"
	}, {
		kind: "resource-kind",
		id: "session-draft"
	}] },
	main: {
		kind: "view",
		view: {
			kind: "view",
			id: i.session
		},
		cardinality: "one",
		presentation: "page",
		tab: R(e)
	},
	panelView: D.projectSession,
	slots: []
})), W = (e, t, n) => {
	let r = n?.resource ?? e.getActiveResource(), i = j(t?.sessionId ?? (r?.type === "session" ? r.id : void 0));
	if (!i) throw Error("Choose a saved session first.");
	return i;
}, G = `${e} == "session"`, K = t("status"), q = [
	"in_progress",
	"awaiting_input",
	"queued"
], ke = q.map((e) => `${G} && ${K} == "${e}"`).join(" || "), Ae = `${G} && ${q.map((e) => `${K} != "${e}"`).join(" && ")}`, je = (e) => {
	e.commands.registerCommand({
		id: p.renameSession,
		label: "Rename session",
		category: "Session",
		icon: "Pencil",
		when: G
	}, {
		prepareArgs: (t, n) => {
			let r = W(e, t, n);
			return {
				...t,
				sessionId: r.id,
				title: t?.title ?? r.title
			};
		},
		execute: async (t, n) => {
			let r = W(e, t, n);
			if (t?.title === void 0) {
				e.commandPalette.requestParams({
					record: { command: {
						id: p.renameSession,
						label: "Rename session",
						params: { title: {
							type: "text",
							label: "Session name",
							required: !0
						} }
					} },
					label: "Rename session",
					args: {
						sessionId: r.id,
						title: r.title
					},
					context: { resource: r.resource }
				});
				return;
			}
			let i = t.title.trim();
			if (!i) throw Error("Enter a session name.");
			let a = e.resources.preview.begin(r.resource, { label: i });
			try {
				let t = await e.resources.preview.persist(r.resource, () => u().sessions.rename(r.id, i));
				return l("sessions")?.upsert(t), await a.commit(), t;
			} catch (e) {
				throw a.rollback(), e;
			}
		}
	});
	for (let t of ["archive", "delete"]) {
		let n = t === "archive" ? "Archive session" : "Delete session", r = t === "archive" ? p.archiveSession : p.deleteSession;
		e.commands.registerCommand({
			id: r,
			label: n,
			category: "Session",
			icon: t === "archive" ? "Archive" : "Trash2",
			when: G
		}, {
			prepareArgs: (t, n) => ({ sessionId: W(e, t, n).id }),
			execute: async (r, i) => {
				let a = W(e, r, i), o = a.status === "queued" ? "Queued work will be cancelled." : "Running work or work awaiting input will continue.";
				await e.commandPalette.requestConfirmation(`${n} “${a.title}”`, {
					description: t === "archive" ? `The saved conversation is kept. ${o}` : "This cannot be undone. Workspace files and external agent history are kept.",
					buttonLabel: t === "archive" ? "Archive" : "Delete",
					onConfirm: async () => {
						let n = e.resources.preview.begin(a.resource, { removed: !0 });
						try {
							if (await e.resources.preview.persist(a.resource, () => u().sessions[t](a.id)), t === "delete") l("sessions")?.remove(a.id);
							else {
								let e = c("sessions").get(a.id);
								e && l("sessions")?.upsert({
									...e,
									archived: !0
								});
							}
							await n.commit();
						} catch (e) {
							throw n.rollback(), e;
						}
					}
				});
			}
		});
	}
	e.layout.registerMenuItem(r("session"), {
		commandId: p.renameSession,
		group: "kernel",
		order: 20,
		when: G
	}), e.layout.registerMenuItem(r("session"), {
		commandId: p.archiveSession,
		group: "kernel",
		order: 30,
		when: G
	});
	let t = {
		commandId: p.deleteSession,
		group: "kernel",
		order: 40,
		separatorBefore: !0
	};
	e.layout.registerMenuItem(r("session"), {
		...t,
		when: Ae
	}), e.layout.registerMenuItem(r("session"), {
		...t,
		when: ke,
		readOnly: !0,
		description: "Stop active or queued work before deleting."
	});
}, Me = (e) => {
	let t = /* @__PURE__ */ new Map(), n = !1, r = !1, i = () => {
		r || n || (r = !0, queueMicrotask(() => {
			if (r = !1, n) return;
			let i = new Set(e.getOpenResources().filter((e) => e.type === "session").map((e) => e.id));
			for (let e of i) t.has(e) || t.set(e, u().sessions.retainResources(e));
			for (let [e, n] of t) i.has(e) || (n.close(), t.delete(e));
		}));
	}, a = [
		e.layout.store.subscribe(i),
		e.pages.store.subscribe(i),
		e.modes.store.subscribe(i)
	];
	return i(), () => {
		n = !0;
		for (let e of a) e();
		for (let e of t.values()) e.close();
		t.clear();
	};
}, Ne = (e, t) => {
	let n = {
		type: "session",
		id: t,
		extensionId: "pstdio",
		projectId: d(e)
	};
	e.resources.removed(n);
}, Pe = (e) => s((t) => {
	if (t?.table === "sessions") for (let { key: n, value: r, previousValue: i } of t.changes) (r ?? i)?.project_id === d(e) && (r && r.archived !== !0 || Ne(e, n));
}), Fe = (e) => e === "completed" ? "CircleCheck" : e === "failed" ? "CircleAlert" : e === "cancelled" ? "CircleStop" : e === "disconnected" ? "CirclePause" : e === "queued" ? "ClockAlert" : e === "awaiting_input" ? "CircleDot" : "CircleDashed", Ie = (e) => e === "completed" ? "fg.success" : e === "failed" ? "fg.error" : e === "cancelled" || e === "disconnected" ? "fg.warning" : e === "queued" ? "fg.info" : "fg.muted", Le = (e) => `${e.getFullYear()}-${e.getMonth() + 1}-${e.getDate()}`, Re = (e) => {
	let t = /* @__PURE__ */ new Date(), n = new Date(t.getFullYear(), t.getMonth(), t.getDate()), r = new Date(e.getFullYear(), e.getMonth(), e.getDate()), i = Math.round((n.getTime() - r.getTime()) / 864e5);
	return i === 0 ? "Today" : i === 1 ? "Yesterday" : e.toLocaleDateString(void 0, {
		month: "short",
		day: "numeric",
		year: e.getFullYear() === t.getFullYear() ? void 0 : "numeric"
	});
}, J = (e, t) => {
	let n = e?.metadata?.[t];
	return typeof n == "string" ? n : void 0;
}, Y = (e) => {
	if (e) return e.type === "workspace" ? e.id ?? J(e, "workspaceId") : J(e, "workspaceId");
}, ze = (e, t) => ({
	id: T(e.resource),
	label: e.title,
	resource: e.resource,
	icon: Fe(e.status),
	iconColor: Ie(e.status),
	...t === "resource" ? { target: {
		kind: "page",
		page: E.session,
		resource: e.resource
	} } : { target: {
		kind: "panel",
		panel: D.projectSession,
		resource: e.resource,
		open: "preview"
	} }
}), X = (e, t) => {
	if (e.length === 0) return [{
		id: "sessions-empty",
		label: "No sessions yet",
		disabled: !0
	}];
	let n = [], r;
	for (let i of e) {
		let e = new Date(i.lastActivityAt), a = Le(e);
		a !== r && (r = a, n.push({
			id: `sessions-date-${a}`,
			label: Re(e),
			disabled: !0
		})), n.push(ze(i, t));
	}
	return n;
}, Z = (e) => ({
	id: "sessions.create",
	label: "New session",
	icon: "Plus",
	commandId: p.createSession,
	...e ? { args: { workspace: e } } : {}
}), Q = (e) => [{
	id: "session-list",
	label: "Sessions",
	collapsible: !1,
	loading: !e,
	actions: [Z(void 0)],
	nodes: e ? X(e, "resource") : []
}], Be = (e, t) => {
	let n = Y(t), r = n ? e.filter((e) => e.workspaceId === n) : e;
	return [{
		id: "sessions-wrap",
		nodes: [{
			id: "workspace-sessions",
			label: "Sessions",
			canHide: !0,
			collapsible: !0,
			actions: [Z(t)],
			children: X(r, "side")
		}]
	}];
}, Ve = S(() => import("./session-widget-DYYDaTT9.ts").then((e) => ({ default: e.SessionWidget }))), He = (e, t) => {
	e.views.registerView({
		id: i.session,
		title: "Session",
		icon: "message-circle",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ w(x, {
				fallback: /* @__PURE__ */ w(C, {}),
				children: /* @__PURE__ */ w(Ve, {
					input: e,
					drafts: t
				})
			})
		}
	}, { priority: 40 });
}, Ue = (e) => b(e), We = () => ({
	id: g.sessions.id,
	label: g.sessions.label,
	icon: g.sessions.icon,
	canHide: !0,
	target: {
		kind: "page",
		page: E.sessions
	}
}), $ = (e) => {
	let t = e.pages.store.getState();
	if (![
		E.sessions.id,
		E.sessionComposer.id,
		E.session.id,
		E.newSession.id
	].some((e) => e === t.activePageId)) return;
	let n = t.location?.resource;
	if (n?.type !== "session") {
		ce(e, void 0);
		return;
	}
	let r = j(n.id);
	if (r && (T(n) !== T(r.resource) || n.label !== r.title || n.metadata?.status !== r.status)) {
		e.pageLocations.replay({
			...t.location,
			resource: {
				...n,
				...r.resource,
				metadata: {
					...n.metadata,
					...r.resource.metadata
				}
			}
		});
		return;
	}
	let i = r?.resource ?? {
		type: n.type,
		id: n.id,
		label: n.label,
		metadata: n.metadata
	};
	ie(e, { selectedNode: T(i) });
}, Ge = (e) => {
	e.navigationTrees.registerContribution({
		id: "dashboard.sessions.level",
		owner: {
			kind: "page",
			id: g.sessions.id,
			extensionId: "pstdio"
		},
		sourceExtensionId: "pstdio",
		declarationIndex: 0,
		getStructure: () => Q(),
		getSections: () => Q(A(d(e)))
	}), f(e, {
		id: "dashboard.sessions.project-nav",
		modes: ["project"],
		getSections: () => [{
			...te.root,
			nodes: [We()]
		}]
	}), f(e, {
		id: "dashboard.sessions.list",
		modes: ["project"],
		resolveResource: ({ resource: e }) => e?.type === "workspace" ? e : void 0,
		getSections: (t, n) => {
			let r = n.resource?.type === "workspace" ? n.resource : void 0;
			return r ? Be(A(d(e)), r) : [];
		}
	});
}, Ke = (e = {}) => ({
	id: "dashboard.sessions",
	activate(t) {
		t.resources.registerKind({
			kind: "session",
			label: "Session",
			icon: "MessageCircle",
			resolve: (e) => j(e.id)?.resource,
			subscribe: y
		}), t.resources.registerKind({
			kind: "session-draft",
			label: "Session draft",
			icon: "message-circle"
		}), t.registerChildModule(U({ sessionDraftPersistence: e.sessionDraftPersistence })), He(t, e.sessionDraftPersistence), Oe(t), Ge(t), je(t);
		let r = Pe(t), i = Me(t);
		t.commands.getCommand(p.createSession) && t.keybindings.registerKeybinding({
			action: {
				kind: "command",
				commandId: p.createSession
			},
			keybinding: "Mod+Alt+S"
		}), t.commands.getCommand(p.createSession) && t.layout.registerMenuItem(n, {
			commandId: p.createSession,
			order: 35
		}), t.commands.registerCommand({
			id: p.openSessions,
			label: "Open sessions",
			category: "Dashboard",
			icon: g.sessions.icon
		}, { execute: () => Ue(t) }), t.keybindings.registerKeybinding({
			action: {
				kind: "command",
				commandId: p.openSessions
			},
			keybinding: "Alt+Shift+S"
		}), t.layout.registerMenuItem(n, {
			commandId: p.openSessions,
			order: 30
		});
		let a = y(() => $(t));
		t.resources.registerProvider({
			id: "dashboard-workbench.sessions",
			kind: "session",
			list: () => A(d(t)).map(({ resource: e, status: n }) => ({
				resource: e,
				indicator: I(n),
				target: {
					kind: "page",
					page: E.session,
					resource: e
				},
				group: "Sessions",
				activate: () => b(t, e)
			}))
		});
		let o = t.pages.store.subscribe(() => $(t));
		return { dispose: () => {
			a(), r(), i(), o();
		} };
	}
});
export { F as i, U as n, B as r, Ke as t };
