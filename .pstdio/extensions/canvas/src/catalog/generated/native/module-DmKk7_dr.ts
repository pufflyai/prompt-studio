// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useMutation-Dy9eufiq.ts";
import { t } from "./widget-ids-CvvbLhYP.ts";
import { t as n } from "./use-workbench-store-BMaFgEbb.ts";
import { t as r } from "./settings-resources-BmVO5oBi.ts";
import { n as i } from "./collections-W65OWXaL.ts";
import { n as a } from "./api-D3Fkqs7r.ts";
import { n as o, r as s } from "./project-context-BR7AjHlE.ts";
import { n as c, t as l } from "./dashboard-navigation-contribution-CaGzI-cW.ts";
import { t as u } from "./commands-Bp5w85f4.ts";
import { t as d } from "./use-agents-xw128NHi.ts";
import { t as f } from "./project-setup-status-CO0VswgG.ts";
import { a as p, n as m, r as h, t as g } from "./dashboard-rows-B7KuOiwh.ts";
import { n as _, r as v } from "./resources-CR_Z7fRd.ts";
import { n as y, u as b, v as x } from "./dashboard-workspaces-MEnQd3Xj.ts";
import { n as S, r as C, t as w } from "./start-recent-list-WovIsFtk.ts";
import { t as T } from "./start-harness-status-UhZXNGRg.ts";
import { useSyncExternalStore as E } from "react";
import { Box as D, Flex as O, Stack as k, Text as A } from "@chakra-ui/react";
import { jsx as j, jsxs as M } from "react/jsx-runtime";
import { isLocalizedString as N, workbenchPages as P } from "@pstdio/sdk/extensions";
var F = (e) => typeof e == "string" ? e : "", I = (e, t) => {
	let n = F(e.title) || "Session", r = F(e.status) || "unknown", i = F(e.project_id) || t;
	return {
		id: e.id,
		title: n,
		icon: "MessageCircle",
		updatedAt: F(e.updated_at) || F(e.created_at),
		resource: _(e.id, n, i, { status: r })
	};
}, L = (e, t, n = 5) => e.sessions.filter((e) => h(e) && m(e, t)).map((e) => I(e, t)).sort((e, t) => t.updatedAt.localeCompare(e.updatedAt)).slice(0, n), R = (e, t) => L({ sessions: Array.from(i("sessions").values()) }, e), z = (e) => {
	let { projectId: t, onReviewExtensions: n } = e, r = d(t);
	return /* @__PURE__ */ j(T, {
		agents: r.data ?? [],
		isPending: r.isPending,
		isFetching: r.isFetching,
		isError: r.isError,
		onReviewExtensions: n,
		onCheckAgain: () => void r.refetch()
	});
}, B = (t) => {
	let { projectId: n, error: r } = t, i = e({ mutationFn: () => a().projects.retrySetup(n) });
	return /* @__PURE__ */ j(f, {
		error: i.error?.message ?? r,
		retrying: i.isPending,
		onRetry: () => i.mutate()
	});
}, V = "extensions", H = (e, t) => n(e.workbench.context.store, (e) => {
	let n = e.values[t];
	return typeof n == "string" ? n : void 0;
}), U = (e) => {
	let { input: t } = e, n = H(t, o), i = H(t, s), a = E(p, g, g), c = R(n, a), l = y(n, a), d = () => void t.workbench.commands.executeCommand(r, { panelId: V });
	return /* @__PURE__ */ j(O, {
		h: "full",
		minH: "0",
		w: "full",
		bg: "bg",
		overflow: "auto",
		"data-testid": "start-page",
		children: /* @__PURE__ */ M(k, {
			w: "full",
			maxW: "52rem",
			mx: "auto",
			px: {
				base: "md",
				md: "lg"
			},
			pt: "4xl",
			pb: "3xl",
			gap: "3xl",
			children: [
				/* @__PURE__ */ M(k, {
					gap: "xs",
					minW: "0",
					children: [/* @__PURE__ */ j(A, {
						textStyle: "heading/M",
						children: i ?? "Project"
					}), /* @__PURE__ */ j(A, {
						textStyle: "paragraph/M/regular",
						color: "fg.muted",
						children: "Project home"
					})]
				}),
				n && l && /* @__PURE__ */ j(B, {
					projectId: n,
					error: l
				}, n),
				/* @__PURE__ */ j(C, {}),
				n && !l && /* @__PURE__ */ j(z, {
					projectId: n,
					onReviewExtensions: d
				}, n),
				/* @__PURE__ */ M(k, {
					direction: {
						base: "column",
						md: "row"
					},
					gap: {
						base: "3xl",
						md: "4xl"
					},
					align: "flex-start",
					minW: "0",
					children: [/* @__PURE__ */ j(D, {
						flex: "1",
						minW: "0",
						w: "full",
						children: /* @__PURE__ */ j(S, { actions: [
							{
								id: "new-conversation",
								label: "New conversation",
								icon: "message-square-plus",
								run: () => void t.workbench.commands.executeCommand(u.createSession)
							},
							{
								id: "open-tool",
								label: "Open a tool",
								icon: "panels-top-left",
								run: () => void t.workbench.commands.executeCommand(u.openCommandPalette)
							},
							{
								id: "browse-extensions",
								label: "Browse extensions",
								icon: "blocks",
								run: d
							}
						] })
					}), /* @__PURE__ */ j(D, {
						flex: "1",
						minW: "0",
						w: "full",
						children: /* @__PURE__ */ j(w, {
							resources: c,
							onOpen: (e) => {
								x(t.workbench, e.resource);
							}
						})
					})]
				})
			]
		})
	});
}, W = (e) => e.title === void 0 ? e.ref.id : N(e.title) ? e.title.default ?? e.title.$l10n : e.title, G = (e) => e.ref.extensionId !== "pstdio" && !e.parentId, K = (e) => [e.resources.registerKind({
	kind: "tool",
	label: "Tool",
	icon: "panels-top-left"
}), e.resources.registerProvider({
	id: "dashboard.start.tools",
	kind: "tool",
	list: () => e.pages.listPages().filter(G).map((e) => ({
		page: e,
		title: W(e)
	})).sort((e, t) => e.title.localeCompare(t.title)).map(({ page: t, title: n }) => ({
		resource: {
			type: "tool",
			id: t.id,
			label: n,
			icon: t.icon
		},
		group: "Tools",
		activate: () => e.pageLocations.navigate({
			kind: "page",
			page: t.ref
		})
	}))
})], q = (e) => {
	e.views.registerView({
		id: t.start,
		title: "Start",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ j(U, { input: e })
		}
	}, { priority: 90 });
}, J = () => ({
	id: "dashboard.start",
	activate(e) {
		return q(e), e.pages.registerPage({
			id: v.start.id,
			ref: P.start,
			title: v.start.label,
			icon: v.start.icon,
			path: "",
			modeId: "project",
			main: {
				kind: "view",
				cardinality: "one",
				presentation: "page",
				view: {
					kind: "view",
					id: t.start
				}
			},
			slots: []
		}), c(e, {
			id: "dashboard.start.project-nav",
			modes: ["project"],
			getSections: () => [{
				...l.root,
				nodes: [{
					id: v.start.id,
					label: "Home",
					icon: v.start.icon,
					target: {
						kind: "page",
						page: P.start
					}
				}]
			}]
		}), [{ dispose: e.pages.store.subscribeSelector((e) => e.activePageId, (t) => {
			t === v.start.id && b(e, void 0);
		}) }, ...K(e)];
	}
});
export { J as t };
