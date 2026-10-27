// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { t } from "./useMutation-Dy9eufiq.ts";
import { d as n } from "./resource-registry-CVuZngrt.ts";
import { _ as r } from "./workbench-core-kaLFKJEn.ts";
import { t as i } from "./widget-ids-CvvbLhYP.ts";
import { t as a } from "./resource-icons-CZFS6OM4.ts";
import { t as o } from "./use-workbench-store-BMaFgEbb.ts";
import { s } from "./collections-CVGR0OYX.ts";
import { n as c } from "./api-BQ3Fs8xe.ts";
import { i as l, n as u, o as d, t as f } from "./project-context-BR7AjHlE.ts";
import { t as p } from "./commands-Bp5w85f4.ts";
import { t as m } from "./folder-picker-CPAYQGva.ts";
import { a as h } from "./dashboard-rows-wkmk8GQV.ts";
import { n as g, t as _ } from "./project-data-BZ7dVP-4.ts";
import { t as v } from "./project-folder-choice-DM6UWdRF.ts";
import { n as y } from "./project-picker-widget-BdXrd_av.ts";
import { useState as b } from "react";
import { Dialog as x } from "@chakra-ui/react";
import { Fragment as S, jsx as C, jsxs as w } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/data/project-creation.ts
var T = async (e) => {
	let t = await c().projects.create({ initial_workspace: {
		provider_id: "pstdio.root",
		params: { path: e.path }
	} }), n = (await c().workspaces.list(t.id)).find((e) => e.is_default);
	if (n?.setup_error) throw Error(n.setup_error);
	if (!n?.root_path || n.initializing || n.provider_state !== "ready") throw Error("The project folder is not ready. Open it again to retry setup.");
	return t;
}, E = (e) => {
	let { input: n } = e, r = t({ mutationFn: T });
	return /* @__PURE__ */ C(m, {
		isOpening: r.isPending,
		error: r.error?.message,
		onSelect: async (e) => {
			try {
				let t = await r.mutateAsync({ path: e });
				await n.workbench.commands.executeCommand(p.selectProject, { project: {
					id: t.id,
					name: t.name
				} }), n.workbench.layout.removeWidgetPlacement(n.instance.instanceId);
			} catch {}
		},
		onClose: () => n.workbench.layout.removeWidgetPlacement(n.instance.instanceId)
	});
}, D = (e) => e.replace(/\.git$/, "").split(/[/:]/).filter(Boolean).pop() ?? "project", O = (n) => {
	let { input: r } = n, i = o(r.workbench.context.store, (e) => e.values[u]), [a, s] = b(), [l, d] = b(), [f, p] = b(), h = e({
		queryKey: ["project-folder", i],
		queryFn: () => c().projects.folder(i),
		enabled: !!i
	}), _ = () => r.workbench.layout.removeWidgetPlacement(r.instance.instanceId), y = t({
		mutationFn: (e) => c().projects.chooseFolder(i, e),
		onSuccess: _
	});
	if (!i || !h.data) return null;
	let { gitRemote: T } = h.data, E = a ?? (T ? "clone" : "existing"), O = l ?? (T ? `~/Projects/${D(T)}` : ""), k = async (e, t) => {
		try {
			await y.mutateAsync({
				path: e,
				clone: t
			});
		} catch {}
	};
	return /* @__PURE__ */ w(S, { children: [/* @__PURE__ */ C(v, {
		projectName: g(i)?.name ?? "",
		gitRemote: T,
		method: E,
		clonePath: O,
		pending: y.isPending,
		error: y.error?.message,
		onMethodChange: s,
		onClonePathChange: d,
		onBrowse: () => p("clone"),
		onNotNow: _,
		onContinue: () => E === "clone" ? void k(O, !0) : p("existing")
	}), /* @__PURE__ */ w(x.Root, {
		open: f !== void 0,
		onOpenChange: (e) => {
			e.open || p(void 0);
		},
		closeOnInteractOutside: !1,
		lazyMount: !0,
		unmountOnExit: !0,
		children: [/* @__PURE__ */ C(x.Backdrop, {}), /* @__PURE__ */ C(x.Positioner, { children: /* @__PURE__ */ C(x.Content, { children: /* @__PURE__ */ C(m, {
			onClose: () => p(void 0),
			onSelect: async (e) => {
				p(void 0), f === "clone" ? d(`${e.replace(/[/\\]+$/, "")}/${D(T ?? "")}`) : await k(e, !1);
			}
		}) }) })]
	})] });
}, k = /* @__PURE__ */ new Set([i.projectPicker, i.createProject]), A = (e) => {
	let t = e.layout.getLayout().regions.overlay.widgets;
	for (let n of t) n.viewId && k.has(n.viewId) && e.overlays.closeOverlay(n.widgetId);
}, j = (e, t, n) => {
	t !== n && e.modes.setActiveMode(void 0);
}, M = (e) => {
	let t = e?.project;
	if (!t || typeof t.id != "string" || t.id.trim().length === 0) throw Error("Project selection requires a project ID");
	if (typeof t.name != "string" || t.name.trim().length === 0) throw Error("Project selection requires a project name");
	return t;
}, N = (e, t, r, a) => {
	let o = M(a);
	n(() => {
		let n = l(e);
		A(e), n !== o.id && (e.pageLocations.clearProject(), j(e, n, o.id), d(t, o, r), e.views.getView(i.dashboardSidenav) && e.views.refreshView(i.dashboardSidenav));
	});
}, P = (e, t, n) => {
	e.pageLocations.clearProject(), f(t, n), e.modes.setActiveMode("project-selection");
}, F = (e, t, n, r) => {
	let i = r ?? n?.getSelectedProjectId();
	if (!i || l(e)) return;
	let a = g(i);
	if (a) return N(e, t, n, { project: a }), a;
}, I = (e, t, n, r) => {
	if (!r && !n?.getSelectedProjectId() || F(e, t, n, r)) return;
	if (s()) {
		n?.setSelectedProjectId(void 0);
		return;
	}
	let i = h(() => {
		l(e) || F(e, t, n, r) ? i() : s() && (n?.setSelectedProjectId(void 0), i());
	});
	return { dispose: i };
}, L = (e, t, n) => {
	let r = (r) => {
		if (r?.table && r.table !== "projects" || !s()) return;
		let i = l(e);
		i && !g(i) && P(e, t, n);
	};
	return r(), { dispose: h(r) };
}, R = (e, t, n) => {
	if (l(e) || !s() || e.layout.getLayout().regions.overlay.widgets.some((e) => e.viewId === i.createProject)) return !1;
	let r = _();
	return r.length === 1 && (N(e, t, n, { project: r[0] }), !0);
}, z = (e, t, n) => {
	R(e, t, n);
	let r = h((r) => {
		r?.table && r.table !== "projects" || R(e, t, n);
	}), a = e.layout.store.subscribeSelector((e) => e.layout.regions.overlay.widgets.some((e) => e.viewId === i.createProject), (r) => {
		r || R(e, t, n);
	});
	return { dispose() {
		r(), a();
	} };
}, B = "dashboard-workbench.required-project-picker", V = (e) => {
	e.views.registerView({
		id: i.projectPicker,
		title: "Projects",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ C(y, { input: e })
		}
	});
	let t = {
		size: "lg",
		placement: "center",
		scrollBehavior: "inside",
		closeOnInteractOutside: !1
	};
	e.overlays.registerOverlay({
		id: i.projectPicker,
		viewId: i.projectPicker,
		config: t
	}), e.overlays.registerOverlay({
		id: B,
		viewId: i.projectPicker,
		closable: !1,
		config: t
	}), e.views.registerView({
		id: i.createProject,
		title: "Create project",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ C(E, { input: e })
		}
	}), e.overlays.registerOverlay({
		id: i.createProject,
		viewId: i.createProject,
		config: {
			placement: "center",
			scrollBehavior: "inside",
			closeOnInteractOutside: !1,
			contentWidth: "folder-picker-width",
			contentHeight: "folder-picker-height",
			contentMaxWidth: "calc(100vw - {spacing.xl})",
			contentMaxHeight: "calc(100dvh - {spacing.xl})"
		}
	});
}, H = (e) => {
	e.views.registerView({
		id: i.projectFolder,
		title: "Project folder",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ C(O, { input: e })
		}
	}), e.overlays.registerOverlay({
		id: i.projectFolder,
		viewId: i.projectFolder,
		config: {
			size: "md",
			placement: "center",
			closeOnInteractOutside: !1
		}
	}), e.commands.registerCommand({
		id: p.chooseProjectFolder,
		label: "Choose project folder",
		category: "Dashboard",
		icon: "Folder"
	}, { execute: () => e.overlays.openOverlay(i.projectFolder, { title: "Project folder" }) });
}, U = (e) => {
	e.modes.registerMode({
		id: "project-selection",
		label: "Projects",
		chrome: {
			nav: !1,
			sidenav: !1,
			activity: !1,
			status: !1
		},
		floatingPanels: "hidden",
		panels: [],
		regionSettings: { main: {
			showHeader: !1,
			acceptsTabs: !1
		} },
		activate: () => void 0,
		enter: (e) => {
			let t = e.overlays.openOverlay(B, { title: "Projects" });
			return { dispose: () => e.overlays.closeOverlay(t) };
		}
	});
}, W = (e) => {
	e.resources.registerKind({
		kind: "project",
		label: "Project",
		icon: a.project
	}), e.resources.registerProvider({
		id: "dashboard-workbench.projects",
		kind: "project",
		list: (t) => {
			let n = t.trim().toLowerCase();
			return _().filter((e) => !n || e.name.toLowerCase().includes(n) || (e.folderPath ?? "").toLowerCase().includes(n)).map((t) => ({
				resource: t.resource,
				description: t.folderPath ?? void 0,
				group: "Projects",
				activate: () => e.commands.executeCommand(p.selectProject, { project: {
					id: t.id,
					name: t.name
				} })
			}));
		}
	});
}, G = (e, t, n) => {
	e.commands.registerCommand({
		id: p.selectProject,
		label: "Select project",
		category: "Dashboard",
		icon: a.project
	}, { execute: (r) => N(e, t, n, r) }), e.commands.registerCommand({
		id: p.clearSelectedProject,
		label: "Clear selected project",
		category: "Dashboard",
		icon: a.project
	}, { execute: () => P(e, t, n) }), e.commands.registerCommand({
		id: p.openProjects,
		label: "Projects",
		category: "Dashboard",
		icon: a.project
	}, { execute: () => {
		if (!l(e)) e.pageLocations.clearProject(), e.modes.setActiveMode("project-selection");
		else return e.overlays.openOverlay(i.projectPicker, { title: "Projects" });
	} }), e.commands.registerCommand({
		id: p.createProject,
		label: "Create project",
		category: "Dashboard",
		icon: "Plus"
	}, { execute: () => e.overlays.openOverlay(i.createProject, { title: "Create project" }) }), e.layout.registerMenuItem(r, {
		commandId: p.openProjects,
		order: 5
	}), e.layout.registerMenuItem(r, {
		commandId: p.createProject,
		order: 6
	});
}, K = (e = {}) => ({
	id: "dashboard.projects",
	activate(t) {
		let n = { context: t.context.createScope("dashboard.selectedProject") }, r = !!(e.initialProjectId ?? e.projectSelectionPersistence?.getSelectedProjectId());
		V(t), H(t), U(t), W(t), G(t, n, e.projectSelectionPersistence);
		let i = I(t, n, e.projectSelectionPersistence, e.initialProjectId), a = r || e.projectTabs ? void 0 : z(t, n, e.projectSelectionPersistence), o = e.projectTabs?.connect(t) ?? L(t, n, e.projectSelectionPersistence);
		return [
			...i ? [i] : [],
			...a ? [a] : [],
			o
		];
	}
});
export { K as t };
