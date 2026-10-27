// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { t as n } from "./chevrons-up-down-DlTkvZ9f.ts";
import { a as r, n as i, o as a, s as o, t as s } from "./test-CYwQ_LKY.ts";
import { g as c, t as ee } from "./workbench-core-kaLFKJEn.ts";
import { t as l } from "./widget-ids-CvvbLhYP.ts";
import { t as u } from "./use-workbench-store-BMaFgEbb.ts";
import { t as d } from "./breadcrumb-view-BjIWEesp.ts";
import { t as te } from "./workbench-BbqJVWhj.ts";
import { o as f } from "./collections-CVGR0OYX.ts";
import { r as ne } from "./api-BQ3Fs8xe.ts";
import { n as p, o as re, r as ie } from "./project-context-BR7AjHlE.ts";
import { n as m, t as h } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as ae } from "./module-Dixbes9T.ts";
import { t as g } from "./commands-Bp5w85f4.ts";
import { t as oe } from "./module-DsN4KqgB.ts";
import { a as _, t as v } from "./dashboard-rows-wkmk8GQV.ts";
import { n as y } from "./project-data-BZ7dVP-4.ts";
import { t as b } from "./desktop-project-tabs-controller-Ctn0yYIm.ts";
import { t as se } from "./module-D4RLR2Pv.ts";
import { l as ce, v as x, y as S } from "./dashboard-workspaces-CHwEPE31.ts";
import { g as le, t as ue } from "./module-DYoDP9uf.ts";
import { t as de } from "./module-d3-QzRJH.ts";
import { t as fe } from "./module-5sOndPUV.ts";
import { t as pe } from "./workspace-views-story-BXNRdh6R.ts";
import { useState as me, useSyncExternalStore as he } from "react";
import { Avatar as C, Box as w, Button as ge, HStack as T, IconButton as _e, Text as E } from "@chakra-ui/react";
import { Tooltip as D } from "@pstdio/ui";
import { jsx as O, jsxs as k } from "react/jsx-runtime";
import { resourceKey as A, workbenchPages as j } from "@pstdio/sdk/extensions";
// packages/pstdio-dashboard/src/modules/command-palette/module.ts
var M = () => ({
	id: "dashboard.command-palette",
	activate(e) {
		e.commands.registerCommand({
			id: g.openCommandPalette,
			label: "Search",
			category: "Workbench",
			icon: "Search"
		}, { execute: () => e.commandPalette.open() }), e.commands.registerCommand({
			id: g.openFile,
			label: "Open file",
			category: "Dashboard",
			icon: "FileText"
		}, { execute: (t) => {
			let { path: n } = t;
			e.notifications.show({
				level: "info",
				title: `Opened ${n}`
			});
		} });
	}
}), N = {
	_hover: { bg: "bg.menu-item.hover" },
	_active: { bg: "bg.menu-item.selected" }
}, P = (e, t, n) => (typeof e == "string" ? y(e) : void 0)?.name ?? (typeof t == "string" ? t : "Projects"), F = (e) => P(u(e.context.store, (e) => e.values[p]), u(e.context.store, (e) => e.values[ie]), he(_, v, v)), I = (e) => {
	let { workbench: t } = e, n = F(t);
	return /* @__PURE__ */ O(D, {
		content: "Go to project navigation",
		children: /* @__PURE__ */ O(ge, {
			px: "xs",
			variant: "ghost",
			size: "xs",
			maxW: "2xs",
			minW: "0",
			justifyContent: "flex-start",
			onClick: () => {
				t.pageLocations.navigateToRootLevel();
			},
			...N,
			children: /* @__PURE__ */ k(T, {
				gap: "xs",
				minW: "0",
				children: [/* @__PURE__ */ O(C.Root, {
					size: "2xs",
					children: /* @__PURE__ */ O(C.Fallback, {
						name: n,
						background: "bg.muted",
						color: "fg.muted"
					})
				}), /* @__PURE__ */ O(E, {
					textStyle: "label/S/medium",
					truncate: !0,
					children: n
				})]
			})
		})
	});
}, ve = (e) => {
	let { input: t } = e, r = u(t.workbench.breadcrumbs.store, (e) => e.items) ?? [];
	return /* @__PURE__ */ k(T, {
		gap: "xs",
		h: "full",
		minW: "0",
		w: "full",
		children: [
			/* @__PURE__ */ k(T, {
				gap: "2xs",
				flexShrink: 0,
				minW: "0",
				children: [/* @__PURE__ */ O(I, { workbench: t.workbench }), /* @__PURE__ */ O(D, {
					content: "Switch project",
					children: /* @__PURE__ */ O(_e, {
						variant: "ghost",
						size: "xs",
						flexShrink: 0,
						"aria-label": "Switch project",
						onClick: () => {
							t.workbench.commands.executeCommand(g.openProjects);
						},
						...N,
						children: /* @__PURE__ */ O(n, { size: 14 })
					})
				})]
			}),
			r.length > 0 ? /* @__PURE__ */ O(E, {
				"aria-hidden": "true",
				color: "fg.subtle",
				flexShrink: 0,
				children: "/"
			}) : null,
			/* @__PURE__ */ O(d, { workbench: t.workbench })
		]
	});
}, L = "dashboard.page.copyLink", ye = (e) => {
	e.commands.registerCommand({
		id: L,
		label: "Copy link",
		icon: "link"
	}, { execute: async () => {
		await navigator.clipboard.writeText(window.location.href), e.notifications.show({
			level: "success",
			title: "Link copied"
		});
	} }), e.layout.registerMenuItem(c, { commandId: L });
}, be = (e, t) => {
	e.views.registerView({
		id: l.projectHeader,
		title: t ? "Project navigation" : "Project selector",
		body: {
			kind: "react",
			render: (e) => t ? /* @__PURE__ */ O(d, { workbench: e.workbench }) : /* @__PURE__ */ O(ve, { input: e })
		}
	}), e.shellPlacements.registerPlacement({
		id: l.projectHeader,
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: l.projectHeader
			}
		},
		region: "nav"
	});
}, xe = (e) => ({
	id: "dashboard.headers",
	activate(t) {
		be(t, e), ye(t);
	}
}), R = ["dashboardWorkbench", "help"], Se = "https://github.com/pufflyai/prompt-studio", Ce = "https://discord.gg/3RxwUEk8fW", we = () => ne()?.version?.trim() || "dev", z = (e = we()) => `v${e}`, Te = (e, t) => {
	t(e, "_blank", "noopener,noreferrer");
}, B = (e) => {
	Te(e, window.open.bind(window));
}, V = () => ({
	id: "help",
	label: "Help",
	icon: "CircleHelp",
	canHide: !0,
	menuPath: R,
	menuPlacement: "top-start"
}), Ee = (e) => m(e, {
	id: "dashboard.help.footer",
	modes: ["project"],
	slot: "footer",
	getStructure: () => [{
		...h.footer,
		nodes: [V()]
	}],
	getSections: () => [{
		...h.footer,
		nodes: [V()]
	}]
}), De = () => ({
	id: "dashboard.help",
	activate(e) {
		Ee(e), e.commands.registerCommand({
			id: g.openDocs,
			label: "Documentation",
			category: "Help",
			icon: "BookOpen"
		}, { execute: () => B(Se) }), e.commands.registerCommand({
			id: g.openDiscord,
			label: "Discord",
			category: "Help",
			icon: "MessageCircle"
		}, { execute: () => B(Ce) }), e.commands.registerCommand({
			id: g.productInfo,
			label: "Prompt Studio",
			category: "Help",
			description: z()
		}, {
			execute: () => void 0,
			isEnabled: () => !1
		}), e.layout.registerMenuItem(R, {
			commandId: g.openDocs,
			order: 20,
			external: !0
		}), e.layout.registerMenuItem(R, {
			commandId: g.openDiscord,
			order: 30,
			external: !0
		}), e.layout.registerMenuItem(R, {
			commandId: g.productInfo,
			label: "Prompt Studio",
			description: z(),
			iconSrc: "/logo.svg",
			readOnly: !0,
			order: 40
		});
	}
}), Oe = (e) => {
	f("settings")?.truncateAndWrite([{
		id: "global",
		max_concurrent_sessions: null,
		notifications_enabled: !0,
		machine_tokens_enabled: !1
	}]), f("sessions")?.truncateAndWrite([
		H(e, "session-today-1", "Refactor sidenav", "completed", "2026-06-24T09:00:00Z", "workspace-1"),
		H(e, "session-today-2", "Investigate flaky test", "failed", "2026-06-24T08:00:00Z"),
		H(e, "session-yesterday", "Wire up board", "completed", "2026-06-23T15:00:00Z", "workspace-1")
	]), f("workspaces")?.truncateAndWrite([{
		id: "workspace-1",
		project_id: e,
		name: "Mode-driven sidenav",
		branch: "feature/PS-107",
		root_path: "/repo/.pstdio/workspaces/PS-107",
		archived: !1,
		workspace_shorthand: "PS-107_A1",
		setup_error: null,
		created_at: "2026-06-22T08:10:00Z",
		updated_at: "2026-06-24T09:00:00Z",
		deleted_at: null
	}]), f("notifications")?.truncateAndWrite([{
		id: "notification-1",
		project_id: e,
		title: "Review generated ticket summary",
		body: "The planner has an update ready for review.",
		kind: "needs_review",
		priority: "normal",
		status: "open",
		source: "dashboard",
		origin: "core",
		source_extension_id: null,
		actor_type: "agent",
		actor_id: null,
		target_json: null,
		related_json: [],
		actions_json: [],
		dedupe_key: "story-notification",
		metadata_json: null,
		created_at: "2026-06-24T09:30:00Z",
		updated_at: "2026-06-24T09:30:00Z",
		read_at: null,
		resolved_at: null,
		snoozed_until: null,
		expires_at: null
	}]), pe(e);
}, H = (e, t, n, r, i, a) => ({
	id: t,
	project_id: e,
	title: n,
	status: r,
	agent: null,
	last_selected_model: null,
	archived: !1,
	last_request_started: i,
	last_request_ended: i,
	created_at: i,
	updated_at: i,
	deleted_at: null,
	...a ? { workspace_id: a } : {}
}), ke = (e) => {
	let t = [{
		...h.header,
		nodes: [{
			id: "search",
			label: "Search",
			icon: "Search",
			canHide: !0,
			commandId: g.openCommandPalette,
			target: {
				kind: "command",
				commandId: g.openCommandPalette
			}
		}]
	}];
	m(e, {
		id: "dashboard.sidenav.search",
		slot: "header",
		modes: ["project"],
		getStructure: () => t,
		getSections: () => t
	});
}, Ae = () => ({
	id: "dashboard.sidenav",
	activate(e) {
		return ke(e), ce(e);
	}
}), U = "demo-project", W = "story.page.ticket", G = {
	extensionId: "story",
	kind: "page",
	id: "ticket"
}, je = new t({ defaultOptions: { queries: { retry: !1 } } }), K = {
	id: "pstdio-planner.tickets",
	label: "Tickets",
	icon: "square-kanban"
}, q = {
	type: "ticket",
	id: "PS-163",
	label: "PS-163 Workbench navigation",
	icon: "FileText",
	metadata: { projectId: U }
}, J = {
	type: "ticket",
	id: "PS-164",
	label: "PS-164 Sidenav resource sections",
	icon: "FileText",
	metadata: {
		projectId: U,
		resourceParent: {
			type: "ticket",
			id: q.id,
			label: q.label,
			metadata: { shorthand: q.id }
		}
	}
}, Y = {
	type: "workspace",
	id: "PS-164_A1",
	label: "PS-164_A1",
	icon: "GitBranch",
	metadata: {
		projectId: U,
		workspaceId: "PS-164_A1",
		workspaceShorthand: "PS-164_A1",
		resourceParent: {
			type: "ticket",
			id: J.id,
			label: J.label,
			metadata: J.metadata
		}
	}
}, Me = () => ({
	id: "story.tickets-navigation",
	activate(e) {
		e.resources.registerKind({
			kind: "ticket",
			label: "Ticket",
			icon: "FileText"
		}), e.views.registerView({
			id: K.id,
			title: K.label,
			icon: K.icon,
			body: {
				kind: "react",
				render: (e) => /* @__PURE__ */ O(w, {
					p: "lg",
					children: e.instance.resource?.label
				})
			}
		}), e.resources.registerHierarchyProvider({
			id: "story.ticket-hierarchy",
			canResolve: (e) => e.type === "ticket",
			getParent: (t) => le(e, t, U) ?? {
				type: "view",
				viewId: K.id
			}
		}), e.pages.registerPage({
			id: W,
			ref: G,
			title: K.label,
			icon: K.icon,
			path: "ticket",
			modeId: "project",
			parentId: j.start.id,
			resource: { kinds: [{
				kind: "resource-kind",
				id: "ticket"
			}] },
			main: {
				kind: "view",
				view: {
					kind: "view",
					id: K.id
				},
				cardinality: "one"
			},
			slots: []
		}), e.navigationTrees.registerContribution({
			id: "story.tickets-navigation.project",
			owner: {
				kind: "mode",
				id: "project",
				extensionId: "pstdio"
			},
			sourceExtensionId: "story",
			declarationIndex: 0,
			getSections: () => [{
				id: "navigation.root",
				nodes: [{
					id: K.id,
					label: K.label,
					icon: K.icon,
					target: {
						kind: "page",
						page: G,
						resource: J
					}
				}]
			}]
		}), e.navigationTrees.registerContribution({
			id: "story.ticket-resource",
			owner: {
				kind: "page",
				id: W,
				extensionId: "story"
			},
			sourceExtensionId: "story",
			declarationIndex: 1,
			getSections: (e) => e.resource?.type === "ticket" ? [
				{
					id: "ticket",
					nodes: [{
						id: "ticket-body",
						label: J.label,
						icon: "FileText"
					}]
				},
				{
					id: "files",
					label: "Files",
					collapsible: !0,
					nodes: [{
						id: "research.md",
						label: "research.md",
						icon: "FileText"
					}]
				},
				{
					id: "workspaces",
					label: "Workspaces",
					collapsible: !0,
					nodes: [{
						id: A(Y),
						label: Y.label,
						icon: "GitBranch",
						resource: Y,
						target: {
							kind: "page",
							page: j.workspace,
							resource: {
								type: Y.type,
								id: Y.id,
								label: Y.label,
								metadata: Y.metadata
							}
						}
					}]
				}
			] : []
		});
		for (let t of ["files", "workspaces"]) e.treeViews.setSectionExpanded(l.dashboardSidenav, t, !0);
		return [];
	}
}), Ne = () => {
	f("workspace_sessions")?.truncateAndWrite([{
		id: "link-1",
		workspace_id: "workspace-1",
		session_id: "session-today-1"
	}, {
		id: "link-2",
		workspace_id: "workspace-1",
		session_id: "session-yesterday"
	}]);
}, Pe = (e = !1) => {
	Oe(U), Ne();
	let t = ee();
	for (let n of [
		Ae(),
		M(),
		ue(),
		se(),
		xe(e ? new b([], async () => {}) : void 0),
		De(),
		oe(),
		de(),
		ae(),
		fe(),
		Me()
	]) t.registerModule(n);
	return re(t, {
		id: U,
		name: "Prompt Studio"
	}), t.pageLocations.setProject(U), t;
}, X = (e) => {
	e.navigation.openTarget({
		kind: "page",
		page: G,
		resource: J
	});
}, Z = (e) => void e.navigation.openTarget({
	kind: "page",
	page: j.start
}), Fe = {
	title: "Dashboard/Sidenav",
	parameters: { layout: "fullscreen" },
	decorators: [(t) => /* @__PURE__ */ O(e, {
		client: je,
		children: /* @__PURE__ */ O(t, {})
	})]
}, Q = (e) => {
	let { open: t, desktop: n } = e, [r] = me(() => {
		let e = Pe(n);
		return t(e), e;
	});
	return /* @__PURE__ */ O(w, {
		h: "100dvh",
		w: "full",
		children: /* @__PURE__ */ O(te, { workbench: r })
	});
}, Ie = {
	render: () => /* @__PURE__ */ O(Q, { open: Z }),
	play: async ({ canvasElement: e }) => {
		let t = o(e), n = await t.findByRole("option", { name: "Home" }), r = await t.findByRole("option", { name: "Sessions" });
		await s(n.getBoundingClientRect().bottom).toBeLessThanOrEqual(r.getBoundingClientRect().top), await s(n).toHaveAttribute("aria-selected", "true"), await s(e.querySelector("[data-workbench-panel-header=\"sidenav\"]")).toBeNull();
	}
}, Le = {
	name: "Overflow with pinned header and footer",
	render: () => /* @__PURE__ */ O(Q, { open: (e) => {
		e.navigationTrees.registerContribution({
			id: "story.overflow.header",
			owner: {
				kind: "mode",
				id: "project",
				extensionId: "pstdio"
			},
			sourceExtensionId: "story.overflow",
			declarationIndex: 0,
			slot: "header",
			getSections: () => [{
				id: "overflow-header",
				nodes: [{
					id: "overflow-header-item",
					label: "Pinned header"
				}]
			}]
		}), e.navigationTrees.registerContribution({
			id: "story.overflow.project",
			owner: {
				kind: "mode",
				id: "project",
				extensionId: "pstdio"
			},
			sourceExtensionId: "story.overflow",
			declarationIndex: 0,
			getSections: () => Array.from({ length: 24 }, (e, t) => ({
				id: `overflow-${t}`,
				label: `Overflow group ${t + 1}`,
				nodes: [{
					id: `overflow-item-${t}`,
					label: `Overflow item ${t + 1}`
				}]
			}))
		}), Z(e);
	} }),
	play: async ({ canvasElement: e }) => {
		let t = o(e), n = await t.findByRole("option", { name: "Pinned header" }), r = await t.findByRole("option", { name: /^Settings$/ }), i = e.querySelector("[data-workbench-region=\"sidenav\"] [data-scope=\"scroll-area\"][data-part=\"viewport\"]");
		await s(i).not.toBeNull();
		let a = n.getBoundingClientRect().top, c = r.getBoundingClientRect().bottom;
		i.scrollTop = i.scrollHeight, await s(n.getBoundingClientRect().top).toBe(a), await s(r.getBoundingClientRect().bottom).toBe(c);
	}
}, $ = { render: () => /* @__PURE__ */ O(Q, { open: (e) => void S(e) }) }, Re = {
	render: () => /* @__PURE__ */ O(Q, { open: (e) => void S(e) }),
	play: async ({ canvasElement: e }) => {
		e.querySelector("[data-tree-list-focus-id=\"workspaces\"]")?.setAttribute("data-hover", "");
	}
}, ze = {
	name: "Ticket page navigation",
	render: () => /* @__PURE__ */ O(Q, { open: X })
}, Be = {
	name: "Desktop session navigation",
	render: () => /* @__PURE__ */ O(Q, {
		desktop: !0,
		open: (e) => void x(e)
	}),
	play: async ({ canvasElement: e }) => {
		let t = o(e), n = await t.findByRole("navigation", { name: "breadcrumb" });
		await s(o(n).getByText("Sessions", { exact: !0 })).toBeVisible(), await r.click(await t.findByRole("button", { name: /^Project$/ })), await s(await t.findByRole("option", { name: /^Home$/ })).toHaveAttribute("aria-selected", "true"), e.dataset.desktopSessionJourney = "complete";
	}
}, Ve = {
	name: "Ticket linked workspace and back",
	render: () => /* @__PURE__ */ O(Q, { open: X })
}, He = {
	render: () => /* @__PURE__ */ O(Q, { open: (e) => void x(e) }),
	play: async ({ canvasElement: e }) => {
		let t = o(e), n = o(e.ownerDocument.body), c = await t.findByRole("option", { name: "Investigate flaky test" });
		await i.contextMenu(c), await a(() => s(n.getByRole("menuitem", { name: "Rename session" })).toBeVisible()), await s(n.getAllByRole("menu")).toHaveLength(1), await a(() => s(n.getByRole("menu")).toHaveFocus()), await r.keyboard("{Escape}"), await a(() => s(n.queryByRole("menu")).not.toBeInTheDocument()), await i.contextMenu(t.getByRole("option", { name: "Search" })), await a(() => s(n.getByRole("menuitem", { name: "Hide/show items" })).toBeVisible()), await a(() => s(n.getByRole("menu")).toHaveFocus()), await r.keyboard("{Escape}"), await a(() => s(n.queryByRole("menu")).not.toBeInTheDocument());
	}
}, Ue = { render: () => /* @__PURE__ */ O(Q, { open: (e) => {
	let t = e.resources.listResources("").find((e) => e.resource.type === "workspace")?.resource;
	t && S(e, t);
} }) };
export { Be as DesktopSessionNavigation, Le as OverflowWithPinnedChrome, Ie as ProjectMode, He as SessionMode, ze as TicketMode, Ve as TicketWorkspaceBackJourney, Ue as WorkspaceResource, $ as WorkspacesView, Re as WorkspacesViewHover, Fe as default };
