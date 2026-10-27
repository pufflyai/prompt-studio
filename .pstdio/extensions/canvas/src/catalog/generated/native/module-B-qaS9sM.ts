// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./useMutation-Dy9eufiq.ts";
import { i as n, r } from "./workspace-providers-OzFU0iXu.ts";
import { a as i, i as a } from "./resource-registry-CVuZngrt.ts";
import { t as o } from "./resource-ref-D_HHex4N.ts";
import { _ as s, h as c } from "./workbench-core-kaLFKJEn.ts";
import { i as l, n as u, r as d, t as f } from "./widget-ids-CvvbLhYP.ts";
import { r as p } from "./resource-actions-cIjgxh6T.ts";
import { i as m } from "./terminal-module-DSNuh2gh.ts";
import { a as h, i as g, l as _, s as v } from "./collections-W65OWXaL.ts";
import { n as y } from "./api-D3Fkqs7r.ts";
import { i as b, n as ee, s as te } from "./project-context-BR7AjHlE.ts";
import { t as x } from "./commands-Bp5w85f4.ts";
import { i as ne } from "./api-CEi0FXP5.ts";
import { n as re, r as ie } from "./extension-webview-broadcast-CNLWiQaR.ts";
import { a as ae } from "./dashboard-rows-B7KuOiwh.ts";
import { r as S } from "./resources-CR_Z7fRd.ts";
import { _ as oe, d as se, g as ce, h as le, i as ue, o as de, s as fe, t as C, y as w } from "./dashboard-workspaces-BTeYGs-s.ts";
import { t as pe } from "./workspace-provider-form-BvpQV8wh.ts";
import { r as T, t as me } from "./workspace-navigation-yctjVTFm.ts";
import { Suspense as he, createElement as ge, lazy as _e, useEffect as ve, useState as E } from "react";
import { Button as D, Center as ye, Dialog as O, HStack as be, Input as xe, Spinner as Se, Stack as k, Text as A, Wrap as Ce } from "@chakra-ui/react";
import { EmptyState as we, resolveFileIconElement as Te, useFileIconThemePreference as Ee } from "@pstdio/ui";
import { Fragment as j, jsx as M, jsxs as N } from "react/jsx-runtime";
import { resourceKey as De, workbenchPages as P } from "@pstdio/sdk/extensions";
import { FileChangeBadge as Oe, LARGE_DIFF_LINE_THRESHOLD as ke, isBinaryDiffPath as Ae, isGeneratedDiffPath as je } from "@pstdio/ui/diff";
// packages/pstdio-dashboard/src/shared/workbench/resource-hierarchy.ts
var Me = (e) => typeof e == "object" && !!e && !Array.isArray(e), Ne = (e) => typeof e == "string" && e.length > 0 ? e : void 0, Pe = (e) => {
	let t = o.safeParse(e);
	return t.success ? t.data : void 0;
}, Fe = (e) => {
	if (Me(e)) {
		if (e.type === "view") {
			let t = Ne(e.viewId);
			return t ? {
				type: "view",
				viewId: t
			} : void 0;
		}
		return Pe(e);
	}
}, Ie = (e, t) => ({
	...e,
	label: e.label ?? e.id,
	icon: e.icon ?? t.fallbackIcon,
	metadata: {
		...e.metadata,
		projectId: e.projectId ?? t.projectId
	}
}), F = (e, t, n) => {
	let r = Fe(t.metadata?.resourceParent);
	if (r) return "viewId" in r ? r : Ie(r, {
		projectId: n,
		fallbackIcon: e.resources.getKind(r.type, r.extensionId)?.icon
	});
}, Le = (e, t, n, r) => e === "workspace_sessions" ? r.getCollection("workspaces").get(String(t.workspace_id))?.project_id === n || r.getCollection("sessions").get(String(t.session_id))?.project_id === n : t.project_id === n, Re = (e, t) => {
	let n = h(), r = n.subscribeCollections((r) => {
		if (!r) {
			t();
			return;
		}
		if (![
			"workspaces",
			"sessions",
			"workspace_sessions"
		].includes(r.table)) return;
		let i = e();
		(!i || r.changes.some(({ value: e, previousValue: t }) => [e, t].some((e) => e && Le(r.table, e, i, n)))) && t();
	}), i = ce((r) => {
		let i = e();
		i && n.getCollection("workspaces").get(r)?.project_id !== i || t();
	}, n);
	return () => {
		r(), i();
	};
}, ze = (e) => {
	let { projectId: t, extensionInstanceId: n, localId: r, record: i } = e, a = h(), o = y(a.connection).views, s, c = -1, l, u = /* @__PURE__ */ new Set(), d = () => {
		c = -1;
		for (let e of u) e();
	}, f = (e) => e.project_id === t && e.extension_instance_id === n && e.board_id === r, p = () => a.getIndexedRows("board_views", "project_id", t).filter(f), m = (e) => {
		if (e.table !== "board_views" || !l) return;
		if (e.type === "snapshot") {
			l.saved ? l = void 0 : l.snapshotDuringSave = !0;
			return;
		}
		if (!l.saved) return;
		let t = new Map(l.ids.map((e, t) => [e, t]));
		e.changes.some(({ value: e, previousValue: n }) => e && n && f(e) && Number(e.sort_order) !== Number(n.sort_order) && Number(e.sort_order) !== t.get(e.id)) && (l = void 0);
	}, g = {
		onCreateView: async (e) => await o.create(t, i.id, e),
		onUpdateView: async (e, n) => {
			await o.update(t, e, n);
		},
		onDeleteView: async (e) => {
			await o.delete(t, e);
		},
		onSetDefaultView: async (e) => {
			await o.setDefault(t, i.id, e);
		},
		onReorderViews: async (e) => {
			let n = {
				ids: [...e],
				saved: !1,
				snapshotDuringSave: !1
			};
			l = n, d();
			try {
				await o.reorder(t, i.id, e);
			} catch (e) {
				throw l === n && (l = void 0, d()), e;
			}
			if (n.saved = !0, n.snapshotDuringSave && l === n) {
				let e = await o.list(t, i.id).catch(() => void 0);
				e && l === n && (n.ids = e.views.map((e) => e.id), d());
			}
		}
	};
	return {
		getSnapshot: () => {
			if (!a.isInitialCollectionsSyncComplete()) return;
			let e = a.getCollectionsVersion();
			if (c === e && s) return s;
			let n = p().sort((e, t) => Number(e.sort_order) - Number(t.sort_order) || String(e.created_at).localeCompare(String(t.created_at)) || e.id.localeCompare(t.id));
			if (!n.length) return;
			if (l) {
				let e = new Map(l.ids.map((e, t) => [e, t])), t = n.length !== e.size || n.some((t) => !e.has(t.id)), r = n.every((t) => Number(t.sort_order) === e.get(t.id));
				t || r ? l = void 0 : n.sort((t, n) => e.get(t.id) - e.get(n.id));
			}
			let r = n.map((e) => ({
				id: e.id,
				title: String(e.title),
				settings: e.settings,
				filter: e.filter,
				sorts: e.sorts,
				builtIn: !1
			})), i = [a.getIndexedRows("board_default_views", "project_id", t).find(f)?.default_view_id, r[0]?.id].find((e) => r.some((t) => t.id === e));
			return c = e, s = {
				views: r,
				defaultViewId: i,
				...g
			}, s;
		},
		subscribe: (e) => {
			u.add(e);
			let n = a.subscribeCollections((t) => {
				t && m(t), t && t.table !== "board_views" && t.table !== "board_default_views" || e();
			}), r = new AbortController(), s = () => {
				o.list(t, i.id, { signal: r.signal }).catch(() => void 0);
			}, c = re((e) => {
				e.projectId === t && (i.schemaRefreshEventIds ?? i.refreshEventIds)?.includes(e.id) && s();
			}, a), l = ie(s, a);
			return s(), () => {
				u.delete(e), c(), l(), r.abort(), n();
			};
		}
	};
}, Be = (e) => {
	let t, n, r = () => {
		let r = b(e);
		if (r !== t) {
			t = r;
			let e = {
				id: u,
				defaultSettings: l
			};
			n = r ? ze({
				projectId: r,
				extensionInstanceId: null,
				localId: e.id,
				record: e
			}) : void 0;
		}
		return n;
	};
	return {
		getSnapshot: () => r()?.getSnapshot(),
		subscribe: (t) => {
			let n = r()?.subscribe(t), i = te(e, () => {
				n?.(), n = r()?.subscribe(t), t();
			});
			return () => {
				i(), n?.();
			};
		}
	};
}, Ve = {
	name: { stat: { type: "unique" } },
	type: {
		stat: {
			type: "top-values",
			limit: 3
		},
		renderer: {
			type: "badge",
			categories: [
				{
					value: "Project folder",
					palette: "gray"
				},
				{
					value: "Git worktree",
					palette: "purple"
				},
				{
					value: "Remote workspace",
					palette: "blue"
				}
			]
		}
	},
	location: {
		stat: { type: "unique" },
		renderer: { type: "path" }
	},
	created: { renderer: { type: "date" } },
	diff: { renderer: { type: "diff" } },
	attempt: { stat: { type: "unique" } },
	provider: { stat: {
		type: "top-values",
		limit: 5
	} },
	state: { stat: {
		type: "top-values",
		limit: 2
	} },
	error: { stat: { type: "unique" } },
	branch: { stat: { type: "unique" } },
	updated: { renderer: { type: "date" } }
}, He = d.map((e) => ({
	...e,
	...Ve[e.id]
})), Ue = async (e, t) => {
	let n = C(b(e));
	return await le(n.filter((e) => e.supportsDiff).map((e) => e.id), t), { rows: n.map(ue) };
}, We = (e) => {
	e.views.registerView({
		id: f.workspaces,
		title: "Workspaces",
		body: {
			kind: "dataTable",
			resourceKind: "workspace",
			columns: He,
			defaultSettings: l,
			viewsProvider: Be(e),
			emptyTitle: "No workspaces yet",
			emptyDescription: "Create a workspace to start an isolated attempt for this project.",
			contextKeys: [ee],
			subscribe: (t) => Re(() => b(e), t),
			executeQuery: (t, n) => Ue(e, n),
			onRowActivate: (t) => {
				t.resource && w(e, t.resource);
			}
		}
	}, { priority: 85 });
}, Ge = (e) => y().workspaces.create({
	project_id: e.projectId,
	provider_id: e.providerId,
	params: e.params,
	anchors: e.anchors,
	shorthand_base: e.shorthand_base
}), Ke = (e) => y().workspaces.delete(e), qe = (e, t) => y().workspaces.rename(e, { name: t }), Je = (n) => {
	let { input: i } = n, a = i.instance.resource?.metadata, o = i.instance.resource?.id, s = e(r(o)), c = t({ mutationFn: Ge }), l = () => i.workbench.layout.removeWidgetPlacement(i.instance.instanceId);
	return /* @__PURE__ */ N(j, { children: [/* @__PURE__ */ M(O.Header, { children: /* @__PURE__ */ M(O.Title, { children: "Create workspace" }) }), s.isPending || s.error ? /* @__PURE__ */ N(j, { children: [/* @__PURE__ */ M(O.Body, { children: s.error ? /* @__PURE__ */ M(A, {
		role: "alert",
		color: "fg.error",
		children: s.error.message
	}) : /* @__PURE__ */ M(A, { children: "Loading workspace providers..." }) }), /* @__PURE__ */ M(O.Footer, {
		justifyContent: "end",
		children: /* @__PURE__ */ N(be, {
			gap: "2",
			children: [/* @__PURE__ */ M(D, {
				variant: "ghost",
				onClick: l,
				children: "Cancel"
			}), /* @__PURE__ */ M(D, {
				variant: "primary",
				disabled: !0,
				children: "Create workspace"
			})]
		})
	})] }) : /* @__PURE__ */ M(pe, {
		providers: s.data ?? [],
		busy: c.isPending,
		executeOptionCommand: (e, t, n) => o ? ne(o, e, t, n) : Promise.reject(/* @__PURE__ */ Error("Workspace choices need a project.")),
		onCancel: l,
		onSubmit: async (e, t) => {
			o && (await c.mutateAsync({
				projectId: o,
				providerId: e,
				params: t,
				anchors: a?.anchors,
				shorthand_base: a?.shorthand_base
			}), l());
		}
	})] });
}, I = (e, t) => [
	"workspace-files",
	e,
	"file",
	t
], L = (e, t) => [
	"workspace-files",
	e,
	"list",
	t
], R = (e, t) => {
	let r = y();
	return n({
		queryKey: I(e, t),
		queryFn: ({ signal: n }) => r.workspaces.readFile(e, t, { signal: n })
	});
}, Ye = (e, t) => {
	let r = y(), i = {
		path: t,
		limit: 500
	};
	return n({
		queryKey: L(e, i),
		queryFn: ({ signal: t }) => r.workspaces.listFiles(e, i, { signal: t })
	});
}, z = (e, t) => {
	let n = e?.metadata?.[t];
	return typeof n == "string" ? n : void 0;
}, B = (e) => z(e, "workspaceId") ?? e?.id, V = {
	title: "Files are not on this device",
	description: "Choose a folder for this project to work on its files."
}, H = (e) => {
	let t = z(e, "workspaceError");
	if (t) throw Error(t);
	if (e?.metadata?.workspaceSupportsFiles === !1) return {
		title: "Files unavailable",
		description: "This workspace is not available for file access."
	};
	let n = z(e, "workspaceProviderState");
	if (n !== "ready") return n === "unattached" ? V : !n || n === "provisioning" ? {
		title: "Preparing workspace",
		description: "Files will appear when the workspace is ready."
	} : {
		title: "Files unavailable",
		description: "This workspace is not available for file access."
	};
}, U = (e, t) => ({
	...e,
	metadata: {
		...e.metadata,
		workspaceView: "files",
		workspaceFilePath: t
	}
}), Xe = (e, t, n) => ({
	...e,
	metadata: {
		...e.metadata,
		workspaceDeletePath: t,
		workspaceDeleteType: n
	}
}), Ze = (e) => {
	let { workspaceDeletePath: t, workspaceDeleteType: n, workspaceFilePath: r, ...i } = e.metadata ?? {};
	return {
		...e,
		metadata: {
			...i,
			workspaceView: "files"
		}
	};
}, W = (e, t) => {
	let n = z(e, "workspacePath")?.replace(/[/\\]+$/, "");
	if (!n) return;
	let r = n.includes("\\") && !n.includes("/") ? "\\" : "/";
	return `${n}${r}${t.split("/").join(r)}`;
}, G = (e) => e.newPath ?? e.oldPath ?? e.filePath, K = (e, t) => [
	"workspace-diffs",
	e,
	"files",
	t
], q = (e, t, n) => [
	"workspace-diffs",
	e,
	"file",
	t,
	n
], Qe = (e, t) => {
	let r = y().workspaces;
	return n({
		queryKey: K(e, t),
		queryFn: () => r.diffFiles(e, t)
	});
}, $e = (e, t, r) => {
	let i = y().workspaces;
	return n({
		queryKey: q(e, t, r),
		queryFn: () => i.diffFile(e, t, r)
	});
}, et = async (e, t) => {
	await e.cancelQueries({ queryKey: ["workspace-diffs", t] }), await Promise.all([
		e.invalidateQueries({ queryKey: [
			"workspace-files",
			t,
			"list"
		] }),
		e.invalidateQueries({ queryKey: ["workspace-diffs", t] }),
		e.invalidateQueries({ queryKey: ["workspace-diff-summary", t] })
	]);
}, tt = (e) => {
	let { name: t } = e, { activeFileIconTheme: n } = Ee();
	return Te(t, { theme: n });
}, nt = (e) => {
	let { change: t } = e;
	return /* @__PURE__ */ M(Oe, { change: t });
}, rt = (e) => {
	if (e.metadata?.workspaceProviderState !== "ready" || e.metadata.workspaceError || e.metadata?.workspaceSupportsDiff !== !0) return;
	let t = e.metadata?.workspaceId, n = typeof t == "string" ? t : e.resourceId;
	if (n) return {
		workspaceId: n,
		mode: e.metadata?.workspaceType === "folder" ? "current" : "fork_point"
	};
}, it = (e) => {
	let t = e.find((e) => {
		let t = e.newPath ?? e.oldPath ?? e.filePath;
		return (e.additions ?? 0) + (e.deletions ?? 0) <= ke && !je(t) && !Ae(t);
	}) ?? e[0];
	return t ? t.newPath ?? t.oldPath ?? t.filePath : void 0;
}, at = "dashboard.workspace.open-file", ot = "workspace-file.create", st = "workspace-directory.create", ct = "workspace-entry.rename", lt = "workspace-entry.copy-path", ut = "workspace-entry.copy-relative-path", dt = "workspace-entry.delete", ft = "workspace-entry.reveal", pt = () => globalThis.promptStudioDesktop, J = (e, t, n, r = "") => ({
	id: n === "directory" ? st : ot,
	label: n === "directory" ? "New folder" : "New file",
	icon: n === "directory" ? "FolderPlus" : "FilePlus2",
	run: () => t(e, r, n)
}), mt = (e, t, n, r) => ({
	id: dt,
	label: r === "directory" ? "Delete folder" : "Delete file",
	icon: "Trash2",
	run: () => {
		e.overlays.openOverlay(f.deleteWorkspaceEntry, {
			title: r === "directory" ? "Delete folder" : "Delete file",
			resource: Xe(t, n, r)
		});
	}
}), ht = (e, t, n, r, i) => ({
	id: ct,
	label: "Rename",
	icon: "Pencil",
	args: { name: n },
	params: { name: {
		type: "text",
		label: r === "directory" ? "Folder name" : "File name",
		required: !0
	} },
	submitLabel: "Rename",
	run: (n) => i.renameEntry(e, t, r, n)
}), gt = (e, t, n) => ({
	id: lt,
	label: "Copy path",
	icon: "Copy",
	run: async () => {
		let r = W(t, n);
		if (!r) throw Error("Workspace path is missing.");
		await navigator.clipboard.writeText(r), e.notifications.show({
			level: "success",
			title: "Path copied"
		});
	}
}), _t = (e, t) => ({
	id: ut,
	label: "Copy relative path",
	icon: "Copy",
	run: async () => {
		await navigator.clipboard.writeText(t), e.notifications.show({
			level: "success",
			title: "Relative path copied"
		});
	}
}), vt = (e, t) => ({
	id: ft,
	label: "Reveal in Finder",
	icon: "FolderOpen",
	run: async () => {
		let n = W(e, t), r = pt();
		if (!n || !r) throw Error("Reveal in Finder is unavailable.");
		await r.revealInFinder(n);
	}
}), yt = async () => {
	let e = pt();
	if (!e) return !1;
	try {
		return (await e.getAppInfo()).platform === "darwin";
	} catch {
		return !1;
	}
}, bt = (e, t, n, r) => ({
	id: `workspace-${n}:new:${t || "root"}`,
	label: n === "directory" ? "New folder" : "New file",
	icon: n === "directory" ? "Folder" : "File",
	inlineInput: {
		ariaLabel: t ? `New ${n === "directory" ? "folder" : "file"} name in ${t}` : `New ${n === "directory" ? "folder" : "file"} name`,
		placeholder: n === "directory" ? "folder-name" : "file-name",
		onCommit: (i) => r.commitCreate(e, t, n, i),
		onCancel: r.cancelCreate
	}
}), xt = (e, t, n, r, i) => {
	let a = [gt(e, t, n.path), _t(e, n.path)], o = ht(t, n.path, n.name, n.type, r), s = i.revealInFinder ? [vt(t, n.path)] : [], c = mt(e, t, n.path, n.type);
	if (n.type === "directory") {
		let e = [J(t, r.beginCreate, "file", n.path), J(t, r.beginCreate, "directory", n.path)];
		return {
			id: n.path,
			label: n.name,
			collapsible: !0,
			canDrag: !0,
			canDrop: !0,
			contextMenuActions: [
				...e,
				o,
				...a,
				...s,
				c
			],
			showContextMenuTrigger: !1
		};
	}
	return {
		id: n.path,
		label: n.name,
		iconElement: ge(tt, { name: n.name }),
		endContent: i.change ? ge(nt, { change: i.change }) : void 0,
		target: {
			kind: "command",
			commandId: at,
			args: { path: n.path }
		},
		contextMenuActions: [
			o,
			...a,
			...s,
			c
		],
		showContextMenuTrigger: !1,
		canDrag: !0
	};
}, St = (e, t) => [{
	id: "workspace-files",
	emptyState: {
		title: e,
		description: t
	},
	nodes: []
}], Ct = [{
	id: "workspace-files",
	nodes: [{
		id: "choose-project-folder",
		label: "Choose a folder",
		description: V.title,
		icon: "folder-open",
		commandId: x.chooseProjectFolder,
		target: {
			kind: "command",
			commandId: x.chooseProjectFolder
		}
	}]
}], wt = async (e, t, n, r, i = "") => {
	let a = t.resource, o = B(a);
	if (!a || !o) return St("Files unavailable", "Workspace details are missing.");
	let s = C().find((e) => e.id === o)?.resource, c = s ? {
		...a,
		metadata: {
			...a.metadata,
			...s.metadata
		}
	} : a, l = H(c);
	if (l === V) return Ct;
	if (l) return St(l.title, l.description);
	let u = rt({
		resourceId: c.id,
		metadata: c.metadata
	});
	t.signal?.throwIfAborted();
	let d = await y().workspaces.listFiles(o, {
		...i ? { path: i } : {},
		...t.filter ? { query: t.filter } : {},
		limit: 500
	}, { signal: t.signal });
	t.signal?.throwIfAborted();
	let f = u ? await y().workspaces.diffFiles(u.workspaceId, u.mode, t.signal) : null;
	t.signal?.throwIfAborted();
	let p = await yt(), m = new Map(f?.files.map((e) => [G(e), e.change])), h = d.entries.map((t) => xt(e, c, t, n, {
		change: m.get(t.path),
		revealInFinder: p
	}));
	return r && r.workspaceId === o && r.parentPath === i && h.unshift(bt(c, i, r.type, n)), d.truncated && h.push({
		id: "workspace-files:truncated",
		label: "Showing the first 500 matches. Refine your search.",
		rowVariant: "empty-state",
		disabled: !0
	}), [{
		id: "workspace-files",
		label: "Files",
		actions: [J(c, n.beginCreate, "file"), J(c, n.beginCreate, "directory")],
		collapsible: !1,
		emptyState: {
			title: t.filter ? "No matching files" : "No files",
			description: t.filter ? "Try a different search." : void 0
		},
		nodes: h
	}];
}, Tt = "dashboard.workspace.open-file", Et = (e) => {
	let t = e?.path;
	if (typeof t != "string" || !t.trim()) throw Error("File path is required.");
	return t.trim();
}, Y = async (e, t, n) => {
	await et(n, t), e.views.refreshView(f.workspaceFileTree);
}, Dt = async (e, t, n) => {
	let r = T(), i = B(t);
	if (!i) throw Error("Workspace details are missing.");
	let a = Et(n), o = await y().workspaces.createFile(i, a, { content: "" });
	r.setQueryData(R(i, a).queryKey, o), await Y(e, i, r), e.treeViews.setSelectedNode(f.workspaceFileTree, a), w(e, U(t, a));
}, Ot = async (e, t, n) => {
	let r = T(), i = B(t);
	if (!i) throw Error("Workspace details are missing.");
	await y().workspaces.createDirectory(i, n), await Y(e, i, r), e.treeViews.setNodeExpanded(f.workspaceFileTree, n, !0);
}, X = (e, t, n) => e === t ? n : e?.startsWith(`${t}/`) ? `${n}${e.slice(t.length)}` : e, kt = async (e, t, n, r) => {
	let i = T(), a = B(t);
	if (!a) throw Error("Workspace details are missing.");
	if (r === n) return;
	let o = e.treeViews.getTreeState(f.workspaceFileTree), s = X(o.selectedNodeId, n, r), c = z(e.getPrimaryResource(), "workspaceFilePath"), l = X(c, n, r), u = o.expandedNodeIds.filter((e) => e === n || e.startsWith(`${n}/`)), d = u.map((e) => X(e, n, r)).filter((e) => !!e);
	await y().workspaces.moveEntry(a, n, r), i.removeQueries({ predicate: (e) => {
		let [t, r, i, o] = e.queryKey;
		return t === "workspace-files" && r === a && i === "file" && typeof o == "string" && (o === n || o.startsWith(`${n}/`));
	} });
	let p = r.split("/").slice(0, -1).join("/");
	p && d.push(p), await Y(e, a, i);
	for (let t of u) e.treeViews.setNodeExpanded(f.workspaceFileTree, t, !1);
	for (let t of new Set(d)) e.treeViews.setNodeExpanded(f.workspaceFileTree, t, !0);
	s !== o.selectedNodeId && e.treeViews.setSelectedNode(f.workspaceFileTree, s), l !== c && l && w(e, U(t, l));
}, At = (e, t) => {
	let n = e?.name, r = typeof n == "string" ? n.trim() : "";
	if (!r || r === "." || r === ".." || r.includes("/") || r.includes("\\")) throw Error(`Enter a ${t === "directory" ? "folder" : "file"} name without folders.`);
	return r;
}, jt = async (e, t) => {
	let n = T(), r = B(t), i = z(t, "workspaceDeletePath"), a = z(t, "workspaceDeleteType");
	if (!r || !i || a !== "file" && a !== "directory") throw Error("Workspace entry details are missing.");
	await y().workspaces.deleteEntry(r, i), n.removeQueries({ predicate: (e) => {
		let [t, n, a, o] = e.queryKey;
		return t === "workspace-files" && n === r && a === "file" && typeof o == "string" && (o === i || o.startsWith(`${i}/`));
	} }), await Y(e, r, n);
	let o = e.getPrimaryResource(), s = B(o) === r ? z(o, "workspaceFilePath") : void 0;
	(s === i || a === "directory" && s?.startsWith(`${i}/`)) && (e.treeViews.setSelectedNode(f.workspaceFileTree, void 0), w(e, Ze(o))), e.notifications.show({
		level: "success",
		title: `Deleted ${i}`
	});
}, Mt = (e, t, n) => {
	e.views.registerView({
		id: f.workspaceFileTree,
		title: "Files",
		icon: "Files",
		body: {
			kind: "tree",
			searchable: !0,
			searchPlaceholder: "Search files",
			getBody: async (r) => {
				let i = z(r.resource, "workspaceFilePath");
				if (i) {
					r.setSelectedNode(i);
					let t = i.split("/").slice(0, -1);
					for (let n = 1; n <= t.length; n++) e.treeViews.setNodeExpanded(f.workspaceFileTree, t.slice(0, n).join("/"), !0);
				}
				return wt(e, r, t, n());
			},
			getChildren: (r, i) => wt(e, i, t, n(), r.id).then((e) => e[0]?.nodes ?? []),
			moveNode: (e, n, r) => {
				if (!r.resource || !e.canDrag || n && !n.canDrop) return;
				let i = n?.id ?? "", a = e.id.split("/").at(-1);
				if (!a) return;
				let o = i ? `${i}/${a}` : a;
				return t.moveEntry(r.resource, e.id, o);
			}
		}
	});
}, Nt = (e) => {
	e.views.registerView({
		id: f.workspaceFiles,
		title: "Files",
		body: {
			kind: "file",
			resourceKind: "workspace",
			load: async (e, t) => {
				let n = B(e), r = z(e, "workspaceFilePath"), i = n ? H(e) : void 0;
				if (i) return {
					editable: !1,
					emptyState: i
				};
				if (!n || !r) return {
					editable: !1,
					emptyState: {
						title: "Select a file",
						description: "Choose a file from the Files panel."
					}
				};
				let a = await y().workspaces.readFile(n, r, { signal: t });
				return {
					fileName: a.file_name,
					filePath: a.path,
					mimeType: a.mime_type,
					content: a.content,
					dataUrl: a.data_url,
					editable: a.editable,
					textRenderer: a.encoding === "utf8" ? "monaco" : "automatic"
				};
			},
			save: async (t, n) => {
				let r = T(), i = B(t), a = z(t, "workspaceFilePath");
				if (!i || !a) return;
				let o = await y().workspaces.writeFile(i, a, { content: n });
				r.setQueryData(R(i, a).queryKey, o), await et(r, i), e.views.refreshView(f.workspaceFileTree);
			}
		}
	});
}, Pt = (e) => {
	let t;
	e.commands.registerCommand({
		id: Tt,
		label: "Open workspace file",
		category: "Workspace"
	}, { execute: async (t) => {
		let n = t?.path, r = e.getPrimaryResource();
		if (typeof n == "string" && r?.type === "workspace") return e.treeViews.setSelectedNode(f.workspaceFileTree, n), w(e, U(r, n));
	} }), Mt(e, {
		beginCreate: (n, r, i) => {
			let a = B(n);
			if (!a) throw Error("Workspace details are missing.");
			t = {
				workspaceId: a,
				parentPath: r,
				type: i
			}, r && e.treeViews.setNodeExpanded(f.workspaceFileTree, r, !0), e.views.refreshView(f.workspaceFileTree);
		},
		cancelCreate: () => {
			t = void 0, e.views.refreshView(f.workspaceFileTree);
		},
		commitCreate: async (n, r, i, a) => {
			let o = At({ name: a }, i), s = t;
			t = void 0;
			try {
				let t = r ? `${r}/${o}` : o;
				i === "directory" ? await Ot(e, n, t) : await Dt(e, n, { path: t });
			} catch (e) {
				throw t = s, e;
			}
		},
		moveEntry: (t, n, r) => kt(e, t, n, r),
		renameEntry: (t, n, r, i) => {
			let a = At(i, r), o = n.split("/").slice(0, -1).join("/");
			return kt(e, t, n, o ? `${o}/${a}` : a);
		}
	}, () => t), Nt(e);
}, Ft = (e) => {
	e.workbench.layout.removeWidgetPlacement(e.instance.instanceId);
}, It = (e) => {
	let t = e.instance.resource?.metadata?.workspaceDeletePath;
	return typeof t == "string" ? t : "this entry";
}, Lt = (e) => e.instance.resource?.metadata?.workspaceDeleteType === "directory" ? "folder" : "file", Rt = (e) => {
	let { input: t } = e, n = t.instance.resource, r = It(t), i = Lt(t), [a, o] = E(""), [s, c] = E(!1), l = async () => {
		if (n && !s) {
			c(!0), o("");
			try {
				await jt(t.workbench, n), Ft(t);
			} catch (e) {
				o(e instanceof Error ? e.message : `The ${i} could not be deleted.`);
			} finally {
				c(!1);
			}
		}
	};
	return /* @__PURE__ */ N(j, { children: [
		/* @__PURE__ */ M(O.Header, {
			py: "xs",
			px: "sm",
			children: /* @__PURE__ */ N(O.Title, {
				textStyle: "label/S/medium",
				children: ["Delete ", i]
			})
		}),
		/* @__PURE__ */ M(O.Body, {
			px: "sm",
			py: "sm",
			children: /* @__PURE__ */ N(k, {
				gap: "xs",
				children: [/* @__PURE__ */ N(A, {
					textStyle: "paragraph/S/regular",
					children: [
						"Delete ",
						r,
						"? This action cannot be undone."
					]
				}), a ? /* @__PURE__ */ M(A, {
					textStyle: "paragraph/S/regular",
					color: "fg.error",
					children: a
				}) : null]
			})
		}),
		/* @__PURE__ */ M(O.Footer, {
			px: "sm",
			py: "sm",
			children: /* @__PURE__ */ N(k, {
				direction: "row",
				gap: "1",
				children: [/* @__PURE__ */ M(D, {
					variant: "outline",
					disabled: s,
					onClick: () => Ft(t),
					children: "Cancel"
				}), /* @__PURE__ */ N(D, {
					variant: "destructive",
					loading: s,
					onClick: () => void l(),
					children: ["Delete ", i]
				})]
			})
		})
	] });
}, Z = (e) => {
	e.workbench.layout.removeWidgetPlacement(e.instance.instanceId);
}, Q = 120, zt = (e) => {
	let { input: n } = e, r = n.instance.resource?.id ?? "", i = n.instance.resource?.label ?? "", [a, o] = E(i), [s, c] = E(""), l = t({ mutationFn: (e) => qe(r, e) }), u = a.trim(), d = l.isPending, f = !!r && u.length > 0 && u.length <= Q && u !== i && !d;
	ve(() => {
		o(i), c("");
	}, [i]);
	let p = async () => {
		if (r) {
			if (!u) c("Workspace name is required");
			else if (u.length > Q) c("Workspace name must be 120 characters or less");
			else if (u === i) Z(n);
			else try {
				await l.mutateAsync(u), n.workbench.notifications.show({
					level: "success",
					title: `Renamed workspace to ${u}`
				}), Z(n);
			} catch (e) {
				c(e instanceof Error ? e.message : String(e));
			}
		}
	};
	return /* @__PURE__ */ N(j, { children: [
		/* @__PURE__ */ M(O.Header, {
			py: "xs",
			px: "sm",
			children: /* @__PURE__ */ M(O.Title, {
				textStyle: "label/S/medium",
				children: "Rename workspace"
			})
		}),
		/* @__PURE__ */ M(O.Body, {
			px: "sm",
			py: "sm",
			children: /* @__PURE__ */ N(k, {
				gap: "2xs",
				children: [
					/* @__PURE__ */ M(A, {
						textStyle: "label/S/medium",
						children: "Workspace name"
					}),
					/* @__PURE__ */ M(xe, {
						value: a,
						"aria-label": "Workspace name",
						autoFocus: !0,
						disabled: d,
						maxLength: Q,
						onChange: (e) => {
							o(e.target.value), c("");
						},
						onKeyDown: (e) => {
							e.key === "Enter" && f && p();
						}
					}),
					s ? /* @__PURE__ */ M(A, {
						role: "alert",
						textStyle: "paragraph/S/regular",
						color: "fg.error",
						children: s
					}) : null
				]
			})
		}),
		/* @__PURE__ */ M(O.Footer, {
			px: "sm",
			py: "sm",
			children: /* @__PURE__ */ N(k, {
				direction: "row",
				gap: "1",
				children: [/* @__PURE__ */ M(D, {
					onClick: () => Z(n),
					variant: "outline",
					disabled: d,
					children: "Cancel"
				}), /* @__PURE__ */ M(D, {
					onClick: p,
					loading: d,
					variant: "primary",
					disabled: !f,
					children: "Rename workspace"
				})]
			})
		})
	] });
}, Bt = (e) => {
	let { input: t } = e, n = t.instance.resource, r = p(t.workbench), i = n ? r(n) : [], a = (z(n, "workspaceProviderState") ?? "provisioning").replaceAll("_", " "), o = z(n, "workspaceError");
	return /* @__PURE__ */ M(ye, {
		h: "full",
		minH: "0",
		bg: "bg",
		p: "md",
		children: /* @__PURE__ */ M(we, {
			title: n?.label ?? "Workspace",
			description: o ?? `Workspace state: ${a.charAt(0).toUpperCase()}${a.slice(1)}`,
			children: /* @__PURE__ */ M(Ce, {
				justify: "center",
				gap: "sm",
				children: i.map((e) => /* @__PURE__ */ M(D, {
					size: "sm",
					variant: "outline",
					disabled: e.isDisabled,
					onClick: e.onClick,
					children: e.label
				}, e.key))
			})
		})
	});
}, Vt = (e, t) => {
	let n = e.metadata?.[t];
	return typeof n == "string" ? n : void 0;
}, Ht = async (e) => {
	e.throwIfAborted(), !v() && await new Promise((t, n) => {
		let r = () => {
			a(), e.removeEventListener("abort", i);
		}, i = () => {
			r(), n(e.reason);
		}, a = _(() => {
			v() && (r(), t());
		});
		e.addEventListener("abort", i, { once: !0 });
	});
}, Ut = async (e, t, n) => {
	let r = b(e);
	if (!r || t.projectId !== r || t.extensionId !== "pstdio" || t.type !== "workspace") return [];
	await Ht(n);
	let i = new Set(g("workspace_sessions", "workspace_id", t.id).map((e) => e.session_id)), a = e.resources.listResources("").find((e) => e.resource.extensionId === "pstdio" && e.resource.type === "session" && e.resource.projectId === r && i.has(e.resource.id));
	return a ? [{
		resource: a.resource,
		autoOpen: !0,
		region: "side",
		open: "preview"
	}] : [];
}, Wt = (e) => {
	let t = e.metadata?.workspaceShorthand;
	return typeof t == "string" ? t : e.label ?? e.id ?? "workspace";
}, Gt = (e) => e.metadata?.workspaceExecutionKind === "local" && e.metadata.workspaceProviderState === "ready" && typeof e.metadata.workspacePath == "string" && e.metadata.workspacePath.length > 0, Kt = (e, t) => {
	if (typeof t.metadata?.workspacePath == "string" && t.metadata.workspacePath.length > 0) return t;
	let n = b(e), r = fe(n).find((e) => e.id === t.id);
	if (!r?.workspacePath) return t;
	let i = de(r, n);
	return {
		...t,
		metadata: {
			...i.metadata,
			...t.metadata,
			workspacePath: r.workspacePath
		}
	};
}, qt = async (e, t) => {
	t.id && (await Ke(t.id), e.notifications.show({
		level: "success",
		title: `Deleted workspace ${Wt(t)}`
	}));
}, Jt = (e, t) => {
	t.id && e.overlays.openOverlay(f.renameWorkspace, {
		title: "Rename workspace",
		resource: t
	});
}, Yt = (e, t) => {
	if (!t.id || !e.shellPlacements.getPlacement("workbench.terminal")) return;
	let n = Kt(e, t);
	if (Gt(n)) return m(e, { resource: n });
}, Xt = `${i} == "workspace" && !${a("workspaceIsDefault")}`, Zt = `${i} == "workspace" && ${a("workspaceExecutionKind")} == "local" && ${a("workspaceProviderState")} == "ready"`, Qt = `${Xt} && ${a("workspaceSupportsDelete")}`, $t = [{
	commandId: x.renameWorkspace,
	label: "Rename workspace",
	icon: "Pencil",
	order: 10,
	when: Xt
}, {
	commandId: x.deleteWorkspace,
	label: "Delete workspace",
	icon: "Trash2",
	order: 30,
	when: Qt
}], en = {
	commandId: x.openWorkspaceTerminal,
	label: "Open terminal",
	icon: "SquareTerminal",
	order: 5,
	when: Zt
}, tn = "kernel", nn = (e) => {
	e.commands.registerCommand({
		id: x.openWorkspaceTerminal,
		label: "Open terminal",
		category: "Workspace",
		icon: "SquareTerminal"
	}, { execute: (t, n) => n?.resource && Yt(e, n.resource) }), e.commands.registerCommand({
		id: x.renameWorkspace,
		label: "Rename workspace",
		category: "Workspace",
		icon: "Pencil"
	}, { execute: (t, n) => n?.resource && Jt(e, n.resource) }), e.commands.registerCommand({
		id: x.deleteWorkspace,
		label: "Delete workspace",
		category: "Workspace",
		icon: "Trash2"
	}, { execute: (t, n) => n?.resource && qt(e, n.resource) });
	for (let t of [en, ...$t]) e.layout.registerMenuItem(c("workspace"), {
		commandId: t.commandId,
		label: t.label,
		icon: t.icon,
		when: t.when,
		group: tn,
		order: t.order
	});
}, rn = (e, t) => {
	let n = e.pages.store.getState().location;
	n?.resource && e.pageLocations.replay({
		...n,
		resource: t
	});
}, $ = (e) => JSON.stringify([e?.workspaceProviderState, e?.workspacePath]), an = (e) => {
	let t = () => {
		let t = e.pages.store.getState().location, n = e.getPrimaryResource();
		if (t?.resource?.type !== "workspace" || n?.type !== "workspace") return;
		let r = C(b(e)).find((e) => e.id === t.resource?.id);
		if (!r) return;
		let i = {
			...n,
			...r.resource,
			metadata: {
				...n.metadata,
				...r.resource.metadata,
				...t.resource.metadata?.workspaceFilePath ? {
					workspaceView: "files",
					workspaceFilePath: t.resource.metadata.workspaceFilePath
				} : {}
			}
		};
		(n.label !== i.label || n.icon !== i.icon || JSON.stringify(n.metadata) !== JSON.stringify(i.metadata)) && (rn(e, i), $(n.metadata) !== $(i.metadata) && e.views.refreshView(f.workspaceFileTree));
	}, n = ae((e) => {
		e && e.table !== "workspaces" || t();
	}), r = e.pages.store.subscribe(t);
	return { dispose: () => {
		n(), r();
	} };
}, on = _e(() => import("./workspace-widget-yOitgcUa.ts").then((e) => ({ default: e.WorkspaceDiffsPanel }))), sn = (e, t = {}) => {
	let n = b(e);
	if (!n) e.pageLocations.clearProject(), e.modes.setActiveMode("project-selection");
	else return oe(n) ? e.commands.executeCommand(x.chooseProjectFolder) : e.overlays.openOverlay(f.createWorkspace, {
		title: "Create workspace",
		resource: {
			type: "workspace-draft",
			id: n,
			metadata: {
				...t.shorthand_base ? { shorthand_base: t.shorthand_base } : {},
				...t.anchors ? { anchors: t.anchors.map((e) => ({ ...e })) } : {}
			}
		}
	});
}, cn = (e) => {
	Pt(e), e.views.registerView({
		id: f.workspaceSummary,
		title: "Workspace",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ M(Bt, { input: e })
		}
	}), e.views.registerView({
		id: f.createWorkspace,
		title: "Create workspace",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ M(Je, { input: e })
		}
	}), e.overlays.registerOverlay({
		id: f.createWorkspace,
		viewId: f.createWorkspace,
		config: {
			size: "sm",
			placement: "center",
			scrollBehavior: "inside",
			closeOnInteractOutside: !1
		}
	}), e.views.registerView({
		id: f.renameWorkspace,
		title: "Rename workspace",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ M(zt, { input: e })
		}
	}), e.overlays.registerOverlay({
		id: f.renameWorkspace,
		viewId: f.renameWorkspace,
		config: {
			size: "sm",
			placement: "center",
			scrollBehavior: "inside",
			closeOnInteractOutside: !1
		}
	}), e.views.registerView({
		id: f.deleteWorkspaceEntry,
		title: "Delete entry",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ M(Rt, { input: e })
		}
	}), e.overlays.registerOverlay({
		id: f.deleteWorkspaceEntry,
		viewId: f.deleteWorkspaceEntry,
		config: {
			size: "sm",
			placement: "center",
			scrollBehavior: "inside",
			closeOnInteractOutside: !1
		}
	}), e.viewMenus.registerViewMenu({
		id: f.workspaceFileTree,
		ownerViewId: f.workspaceFiles,
		viewId: f.workspaceFileTree,
		side: "left"
	}), e.views.registerView({
		id: f.workspaceDiffs,
		title: "Changes",
		icon: "FileDiff",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ M(he, {
				fallback: /* @__PURE__ */ M(Se, {}),
				children: /* @__PURE__ */ M(on, { input: e })
			})
		}
	}, { priority: 70 });
}, ln = (e) => (e.pages.registerPage({
	id: S.workspaces.id,
	ref: P.workspaces,
	title: S.workspaces.label,
	icon: S.workspaces.icon,
	path: "workspaces",
	modeId: "project",
	main: {
		kind: "view",
		view: {
			kind: "view",
			id: f.workspaces
		},
		cardinality: "one"
	},
	slots: []
}), e.pages.registerPage({
	id: P.workspace.id,
	ref: P.workspace,
	document: { metadataKey: "workspaceFilePath" },
	title: "Workspace",
	icon: S.workspaces.icon,
	path: "workspace",
	modeId: "project",
	parentId: S.workspaces.id,
	resource: { kinds: [{
		kind: "resource-kind",
		id: "workspace"
	}] },
	main: {
		kind: "panels",
		landing: "changes",
		empty: {
			kind: "view",
			id: f.workspaceSummary
		}
	},
	slots: [{
		id: "changes",
		isAvailable: (e) => e?.metadata?.workspaceSupportsDiff === !0,
		region: "main",
		tab: { getSnapshot: () => ({ label: "Changes" }) },
		order: 1,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: f.workspaceDiffs
			},
			presence: "fixed"
		}
	}, {
		id: "files",
		isAvailable: (e) => e?.metadata?.workspaceSupportsFiles === !0,
		region: "main",
		tab: { getSnapshot: () => ({ label: "Files" }) },
		order: 2,
		item: {
			kind: "view",
			view: {
				kind: "view",
				id: f.workspaceFiles
			},
			presence: "fixed"
		}
	}]
})), un = (e) => {
	let t = e.pages.store.getState();
	if (t.activePageId !== P.workspace.id || t.location?.resource?.type !== "workspace") return;
	let n = e.getPrimaryResource();
	if (!n || (se(e, { selectedNode: null }), Vt(n, "workspaceView") !== "files")) return;
	let r = e.layout.listPanelInstances("main").find((e) => e.viewId === f.workspaceFiles && e.resourceKey === De(n));
	r && e.layout.activatePanel(r.instanceId);
}, dn = () => ({
	id: "dashboard.workspaces",
	activate(e) {
		e.resources.registerKind({
			kind: "workspace",
			extensionId: "pstdio",
			relatedOpenings: (t, n) => Ut(e, t, n),
			label: "Workspace",
			icon: S.workspaces.icon,
			resolve: (t) => C(b(e)).find((e) => e.id === t.id)?.resource ?? t,
			subscribe: (e) => _((t) => {
				t && t.table !== "workspaces" || e();
			})
		}), e.resources.registerProvider({
			id: "dashboard-workbench.workspaces",
			kind: "workspace",
			list: () => C(b(e)).map((t) => ({
				resource: t.resource,
				target: {
					kind: "page",
					page: P.workspace,
					resource: t.resource
				},
				searchText: [
					t.title,
					t.shorthand,
					t.branch
				].filter(Boolean).join(" "),
				group: "Workspaces",
				activate: () => w(e, t.resource)
			}))
		}), e.resources.registerHierarchyProvider({
			id: "dashboard-workbench.workspace-hierarchy",
			priority: 100,
			canResolve: (e) => e.type === "workspace",
			getParent: (t) => {
				let n = Vt(t, "projectId") ?? b(e);
				return n ? F(e, t, n) ?? {
					type: "view",
					viewId: S.workspaces.id
				} : {
					type: "view",
					viewId: S.workspaces.id
				};
			}
		}), nn(e), We(e), cn(e), ln(e);
		let t = an(e), n = me(e);
		e.modes.registerMode({
			id: "project",
			label: "Project",
			panels: [
				"main",
				"secondary",
				"side"
			],
			regionSettings: {
				side: { alwaysShowTabs: !0 },
				secondary: { alwaysShowTabs: !0 }
			},
			activate: () => void 0
		}), e.commands.registerCommand({
			id: x.openWorkspaces,
			label: "Open workspaces",
			category: "Dashboard",
			icon: S.workspaces.icon
		}, { execute: () => w(e) }), e.commands.registerCommand({
			id: x.createWorkspace,
			label: "New workspace",
			category: "Dashboard",
			icon: "Plus"
		}, { execute: (t) => sn(e, t) }), e.layout.registerMenuItem(s, {
			commandId: x.openWorkspaces,
			order: 10
		}), e.layout.registerMenuItem(s, {
			commandId: x.createWorkspace,
			order: 11
		}), e.keybindings.registerKeybinding({
			action: {
				kind: "command",
				commandId: x.openWorkspaces
			},
			keybinding: "Alt+Shift+W"
		}), e.keybindings.registerKeybinding({
			action: {
				kind: "command",
				commandId: x.createWorkspace
			},
			keybinding: "Mod+Alt+W"
		});
		let r = e.pages.store.subscribeSelector((e) => e.location, () => un(e));
		return { dispose: () => {
			n.dispose(), t.dispose(), r();
		} };
	}
});
export { G as a, K as c, z as d, I as f, F as g, Ye as h, rt as i, Qe as l, L as m, rn as n, q as o, R as p, it as r, $e as s, dn as t, U as u };
