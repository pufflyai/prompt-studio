// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./bell-Cw2yL2ca.ts";
import { t } from "./copy-COTDVt4R.ts";
import { t as n } from "./ellipsis-vertical-CeKd7BaK.ts";
import { t as r } from "./file-text-B9-uT4dU.ts";
import { t as i } from "./folder-DJ8ZbA4G.ts";
import { t as a } from "./house-BBkmrnwf.ts";
import { t as o } from "./pencil-DsB6zW8x.ts";
import { t as s } from "./plus-CYkLGSPS.ts";
import { t as c } from "./search-FHo0INnP.ts";
import { t as l } from "./settings-DjkPFa7Q.ts";
import { t as u } from "./star-DtQKFyMr.ts";
import { t as d } from "./trash-2-C03vrbuo.ts";
import { t as f } from "./scroll-area-I7hjn89T.ts";
import { c as p } from "./list-row-BhxGCvIh.ts";
import { n as m, r as h } from "./react-vHPBN2SX.ts";
import { n as g, r as _, t as v } from "./browser-storage-CFZrWu9H.ts";
import { n as y, r as b } from "./session-indicator-7-mIGr-J.ts";
import { t as x } from "./resizable-split-layout-DdxKHR9a.ts";
import { t as ee } from "./tree-list-Db4WJcm2.ts";
import { t as S } from "./panel-header.constants-PEx8xc6Y.ts";
import { useEffect as C, useRef as te, useState as w } from "react";
import { Badge as T, Box as E, Button as D, Flex as O, HStack as k, Input as A, Stack as j, Text as M } from "@chakra-ui/react";
import { jsx as N, jsxs as P } from "react/jsx-runtime";
// packages/ui/src/components/sidenav/sidenav.store.ts
var F = {
	open: !0,
	expandedSections: [],
	expandedNodes: [],
	width: null
}, I = "pstdio/ui/sidenav", L = (e) => `${I}/${e}`, R = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], z = (e, t, n) => n ? e.includes(t) ? e : [...e, t] : e.filter((e) => e !== t), ne = (e) => ({
	open: e.open,
	expandedSections: e.expandedSections,
	expandedNodes: e.expandedNodes,
	width: e.width
}), re = (e) => {
	let { storageKey: t, initialState: n } = e, r = {
		...F,
		...n
	};
	return h()(_((e) => ({
		...r,
		openSidenav: () => e((e) => ({
			...e,
			open: !0
		})),
		closeSidenav: () => e((e) => ({
			...e,
			open: !1
		})),
		toggleSidenav: () => e((e) => ({
			...e,
			open: !e.open
		})),
		toggleSection: (t) => e((e) => ({
			...e,
			expandedSections: R(e.expandedSections, t)
		})),
		toggleNode: (t) => e((e) => ({
			...e,
			expandedNodes: R(e.expandedNodes, t)
		})),
		setSectionExpanded: (t, n) => e((e) => ({
			...e,
			expandedSections: z(e.expandedSections, t, n)
		})),
		setNodeExpanded: (t, n) => e((e) => ({
			...e,
			expandedNodes: z(e.expandedNodes, t, n)
		})),
		setWidth: (t) => e((e) => ({
			...e,
			width: t
		})),
		reset: () => e(F)
	}), {
		name: L(t),
		storage: g(v),
		partialize: ne
	}));
}, B = /* @__PURE__ */ new Map(), V = (e, t) => {
	let n = B.get(e);
	if (n) return n;
	let r = re({
		storageKey: e,
		initialState: t
	});
	return B.set(e, r), r;
}, H = (e, t, n) => {
	let r = V(e, n);
	return m(r, t);
}, U = (e) => {
	let { children: t } = e;
	return t ? /* @__PURE__ */ N(E, {
		bg: "bg",
		position: "sticky",
		bottom: "0",
		overflow: "hidden",
		children: t
	}) : null;
}, W = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ N(k, {
		"data-testid": "sidenav-header",
		justify: "space-between",
		align: "center",
		minH: S,
		bg: "bg",
		position: "sticky",
		top: "0",
		zIndex: "1",
		gap: "0",
		children: /* @__PURE__ */ N(k, {
			minW: "0",
			flex: "1",
			children: t
		})
	});
}, G = 240, K = 200, q = 480, J = (e, t, n) => Math.min(Math.max(e, t), n), Y = (e, t = G) => {
	if (typeof e == "number") return e;
	if (typeof e == "string") {
		let t = parseInt(e, 10);
		if (!Number.isNaN(t)) return t;
	}
	return t;
}, X = (e) => {
	let { storageKey: t, sections: n, activeNodeId: r, contextActions: i = [], header: a, footer: o, width: s, closable: c = !0, emptyLabel: l = "No items available.", defaultExpandedSections: u, linkComponent: d, onNavigate: m, onOpenChange: h, resizable: g = !0, defaultWidth: _, minWidth: v = K, maxWidth: y = q, virtualize: b = !1 } = e, x = te(null), S = Y(s, _), w = {
		...u ? { expandedSections: u } : {},
		width: S
	}, T = H(t, (e) => e.open, w), D = H(t, (e) => e.width, w), k = H(t, (e) => e.expandedSections, w), A = H(t, (e) => e.expandedNodes, w), j = H(t, (e) => e.toggleSection, w), F = H(t, (e) => e.toggleNode, w);
	C(() => {
		h?.(T);
	}, [h, T]);
	let I = J(D ?? S, v, y);
	if (!T && c) return null;
	let L = g ? `${I}px` : s ?? `${S}px`, R = /* @__PURE__ */ P(O, {
		as: "aside",
		"data-testid": "sidenav",
		direction: "column",
		position: "relative",
		h: "100%",
		w: L,
		minW: L,
		maxW: L,
		flexShrink: 0,
		borderRightWidth: "1px",
		borderRightColor: "border.subtle",
		bg: "bg",
		children: [
			/* @__PURE__ */ N(W, { children: a }),
			/* @__PURE__ */ N(f, {
				flex: "1",
				mt: "lg",
				viewportRef: x,
				viewportProps: {
					display: "block",
					style: { overflowX: "hidden" }
				},
				contentProps: { style: {
					minWidth: "100%",
					width: "100%",
					minHeight: "100%",
					display: "flex",
					flexDirection: "column"
				} },
				children: /* @__PURE__ */ N(E, {
					w: "full",
					minW: "0",
					flex: "1 0 auto",
					display: "flex",
					flexDirection: "column",
					children: n.length === 0 ? /* @__PURE__ */ N(M, {
						textStyle: "paragraph/S/regular",
						color: "fg.muted",
						p: "3",
						children: l
					}) : /* @__PURE__ */ N(ee, {
						sections: n,
						expandedSectionIds: k,
						expandedNodeIds: A,
						activeNodeId: r,
						rowVariant: "compact",
						sectionGap: "md",
						nodeGap: "1px",
						linkComponent: d,
						onNavigate: m,
						onToggleSection: j,
						onToggleNode: F,
						virtualize: b,
						scrollRef: x
					})
				})
			}),
			/* @__PURE__ */ N(U, { children: o })
		]
	});
	return /* @__PURE__ */ N(p, {
		actions: i,
		closeOnSelect: !1,
		children: R
	});
}, Z = [
	{
		id: "top-level",
		nodes: [{
			id: "home",
			label: "Home",
			icon: /* @__PURE__ */ N(a, { size: 14 }),
			isNavigable: !0
		}, {
			id: "notifications",
			label: "Notifications",
			icon: /* @__PURE__ */ N(e, { size: 14 }),
			isNavigable: !0
		}]
	},
	{
		id: "docs",
		label: "Documentation",
		actions: [{
			id: "add-doc",
			label: "Add document",
			icon: /* @__PURE__ */ N(s, { size: 14 })
		}],
		nodes: [{
			id: "overview",
			label: "Overview",
			icon: /* @__PURE__ */ N(r, { size: 14 }),
			isNavigable: !0,
			navigationIntent: {
				id: "docs/open",
				payload: { slug: "overview" }
			},
			actions: [{
				id: "edit",
				label: "Edit",
				icon: /* @__PURE__ */ N(o, { size: 14 })
			}, {
				id: "more",
				label: "More actions",
				icon: /* @__PURE__ */ N(n, { size: 14 }),
				menuItems: [
					{
						id: "rename",
						label: "Rename"
					},
					{
						id: "duplicate",
						label: "Duplicate",
						icon: /* @__PURE__ */ N(t, { size: 14 })
					},
					{
						id: "delete",
						label: "Delete",
						icon: /* @__PURE__ */ N(d, { size: 14 })
					}
				]
			}]
		}, {
			id: "guides",
			label: "Guides",
			icon: /* @__PURE__ */ N(i, { size: 14 }),
			children: [{
				id: "projects",
				label: "Projects",
				icon: /* @__PURE__ */ N(i, { size: 14 }),
				children: [{
					id: "projects-create",
					label: "Create a project",
					icon: /* @__PURE__ */ N(r, { size: 14 }),
					isNavigable: !0
				}, {
					id: "projects-settings",
					label: "Project settings",
					icon: /* @__PURE__ */ N(u, { size: 14 }),
					isNavigable: !0,
					children: [{
						id: "projects-settings-advanced",
						label: "Advanced",
						isNavigable: !0
					}]
				}]
			}, {
				id: "pipelines",
				label: "Pipelines",
				icon: /* @__PURE__ */ N(i, { size: 14 }),
				children: [{
					id: "pipelines-author",
					label: "Author pipeline",
					icon: /* @__PURE__ */ N(r, { size: 14 }),
					isNavigable: !0,
					actions: [{
						id: "more",
						label: "More actions",
						icon: /* @__PURE__ */ N(n, { size: 14 }),
						menuItems: [{
							id: "rename",
							label: "Rename"
						}, {
							id: "delete",
							label: "Delete",
							icon: /* @__PURE__ */ N(d, { size: 14 })
						}]
					}]
				}, {
					id: "pipelines-run",
					label: "Run pipeline",
					icon: /* @__PURE__ */ N(r, { size: 14 }),
					isNavigable: !0,
					disabled: !0,
					description: "Coming soon"
				}]
			}]
		}]
	},
	{
		id: "settings",
		label: "Settings",
		nodes: [{
			id: "workspace",
			label: "Workspace",
			icon: /* @__PURE__ */ N(l, { size: 14 }),
			isNavigable: !0
		}]
	}
], ie = [{
	id: "sessions",
	label: "Sessions",
	nodes: [
		"in_progress",
		"awaiting_input",
		"completed",
		"failed",
		"cancelled"
	].map((e) => ({
		id: e,
		label: e.replaceAll("_", " "),
		icon: (() => {
			let t = b(e);
			return /* @__PURE__ */ N(t, { size: 14 });
		})(),
		iconColor: y(e),
		isNavigable: !0,
		navigationIntent: { id: `session/${e}` }
	}))
}], Q = (e) => {
	let { storageKey: t, sections: n = Z, header: r, contextActions: i } = e, [a, o] = w("overview"), [s, l] = w("No navigation yet"), [u, d] = w(!0), f = H(t, (e) => e.openSidenav), p = H(t, (e) => e.closeSidenav), m = (e) => {
		e ? f() : p();
	};
	return /* @__PURE__ */ N(j, {
		align: "stretch",
		h: "560px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ N(x, {
			flex: "1",
			minH: "0",
			minW: "0",
			collapsed: !u,
			defaultSizePx: 240,
			minSizePx: 200,
			maxSizePx: 480,
			contentMinSizePx: 320,
			resizeLabel: "Resize sidenav",
			onCollapsedChange: (e) => m(!e),
			resizablePanel: /* @__PURE__ */ N(X, {
				storageKey: t,
				sections: n,
				contextActions: i,
				activeNodeId: a,
				resizable: !1,
				width: "full",
				header: r ?? /* @__PURE__ */ P(k, {
					gap: "2",
					w: "100%",
					children: [/* @__PURE__ */ N(c, { size: 14 }), /* @__PURE__ */ N(A, {
						size: "sm",
						placeholder: "Search docs"
					})]
				}),
				footer: /* @__PURE__ */ P(k, {
					justify: "space-between",
					w: "100%",
					children: [/* @__PURE__ */ N(M, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						children: "Footer actions stay visible"
					}), /* @__PURE__ */ N(D, {
						size: "xs",
						variant: "ghost",
						children: "Help"
					})]
				}),
				onOpenChange: d,
				onNavigate: (e) => {
					o(e.nodeId), l(`${e.nodeId} (${e.intent?.id ?? "no-intent"})`);
				}
			}),
			contentPanel: /* @__PURE__ */ P(j, {
				flex: "1",
				p: "4",
				gap: "3",
				minW: "0",
				children: [
					/* @__PURE__ */ P(k, {
						gap: "2",
						flexWrap: "wrap",
						children: [/* @__PURE__ */ N(D, {
							size: "sm",
							onClick: f,
							children: "Reopen Sidenav"
						}), /* @__PURE__ */ N(T, {
							colorPalette: u ? "green" : "orange",
							children: u ? "Open" : "Hidden"
						})]
					}),
					/* @__PURE__ */ P(E, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						borderRadius: "md",
						p: "3",
						children: [/* @__PURE__ */ N(M, {
							textStyle: "paragraph/S/medium",
							children: "Navigation output"
						}), /* @__PURE__ */ N(M, {
							textStyle: "paragraph/S/regular",
							color: "fg.muted",
							children: s
						})]
					}),
					/* @__PURE__ */ N(E, {
						borderWidth: "1px",
						borderColor: "border.subtle",
						borderRadius: "md",
						p: "3",
						flex: "1",
						children: /* @__PURE__ */ N(M, {
							textStyle: "paragraph/S/regular",
							color: "fg.muted",
							children: "Content area reclaims width when sidenav is hidden."
						})
					})
				]
			})
		})
	});
}, ae = {
	title: "Components/Navigation/Sidenav",
	component: X,
	parameters: { layout: "fullscreen" }
}, oe = { render: () => /* @__PURE__ */ N(Q, { storageKey: "storybook-sidenav-default" }) }, $ = { render: () => /* @__PURE__ */ N(Q, { storageKey: "storybook-sidenav-layout" }) }, se = {
	render: () => /* @__PURE__ */ N(Q, { storageKey: "storybook-sidenav-reopen" }),
	parameters: { docs: { description: { story: "Hide the sidenav by dragging past the collapse threshold and reopen from the external button." } } }
}, ce = {
	render: () => /* @__PURE__ */ N(Q, { storageKey: "storybook-sidenav-persist" }),
	parameters: { docs: { description: { story: "Expand or collapse nodes, hide the sidenav, then refresh Storybook to verify persisted state restore." } } }
}, le = () => {
	let [t, n] = w(!0), r = Z.map((e) => ({
		...e,
		nodes: e.nodes.filter((e) => e.id !== "notifications" || t)
	}));
	return /* @__PURE__ */ N(Q, {
		storageKey: "storybook-sidenav-context-menu",
		sections: r,
		contextActions: [{
			key: "notifications",
			label: t ? "Hide Notifications" : "Show Notifications",
			icon: N(t ? e : s, { size: 14 }),
			onClick: () => n((e) => !e)
		}]
	});
}, ue = {
	render: () => /* @__PURE__ */ N(le, {}),
	parameters: { docs: { description: { story: "Right-click the header, navigation tree, empty space, or footer to customize Sidenav items." } } }
}, de = { render: () => /* @__PURE__ */ P(j, {
	direction: {
		base: "column",
		lg: "row"
	},
	gap: "4",
	p: "4",
	children: [/* @__PURE__ */ P(E, {
		flex: "1",
		minW: "0",
		children: [/* @__PURE__ */ N(M, {
			mb: "2",
			textStyle: "paragraph/S/medium",
			children: "Sidenav A"
		}), /* @__PURE__ */ N(Q, {
			storageKey: "storybook-sidenav-namespace-a",
			sections: Z
		})]
	}), /* @__PURE__ */ P(E, {
		flex: "1",
		minW: "0",
		children: [/* @__PURE__ */ N(M, {
			mb: "2",
			textStyle: "paragraph/S/medium",
			children: "Sidenav B"
		}), /* @__PURE__ */ N(Q, {
			storageKey: "storybook-sidenav-namespace-b",
			sections: Z
		})]
	})]
}) }, fe = {
	render: () => /* @__PURE__ */ N(Q, {
		storageKey: "storybook-sidenav-colored-icons",
		sections: ie
	}),
	parameters: { docs: { description: { story: "Sidenav nodes can provide iconColor so status-driven icons keep their semantic colors." } } }
};
export { fe as ColoredSessionIcons, oe as DefaultDocsTree, $ as HeaderAndFooterLayout, se as HiddenWithExternalReopen, de as NamespaceIsolation, ce as PersistenceRestore, ue as WholeSidenavContextMenu, ae as default };
