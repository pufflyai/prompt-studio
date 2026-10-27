// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { h as e, m as t, p as n, r } from "./test-whhQHjQi.ts";
import { t as i } from "./check-Bgh538vW.ts";
import { t as a } from "./copy-COTDVt4R.ts";
import { t as o } from "./ellipsis-vertical-CeKd7BaK.ts";
import { t as s } from "./file-text-B9-uT4dU.ts";
import { t as c } from "./folder-DJ8ZbA4G.ts";
import { t as l } from "./plus-CYkLGSPS.ts";
import { t as u } from "./search-FHo0INnP.ts";
import { t as d } from "./settings-DjkPFa7Q.ts";
import { t as f } from "./trash-2-C03vrbuo.ts";
import { t as p } from "./scroll-area-I7hjn89T.ts";
import { n as m, r as h } from "./react-vHPBN2SX.ts";
import { r as ee } from "./browser-storage-CFZrWu9H.ts";
import { i as te, n as ne, r as re } from "./host-storage-CRtYziQh.ts";
import { t as g } from "./tree-list-Db4WJcm2.ts";
import { useRef as ie, useState as _ } from "react";
import { Box as v, Button as y, Flex as b, HStack as x, Kbd as S, Stack as C, Text as w } from "@chakra-ui/react";
import { jsx as T, jsxs as E } from "react/jsx-runtime";
// packages/ui/src/components/tree-list/tree-list-inline-creation-story.tsx
var D = (e) => {
	let { type: t = "file" } = e, [n, r] = _(), i = t === "folder" ? "folder" : "file", a = T(t === "folder" ? c : s, { size: 16 }), o = [{
		id: "files",
		label: "Files",
		nodes: [{
			id: "docs",
			label: "docs",
			icon: /* @__PURE__ */ T(c, { size: 16 })
		}, ...n ? [{
			id: n,
			label: n,
			icon: a
		}] : [{
			id: `new-${i}`,
			label: `New ${i}`,
			icon: a,
			inlineInput: {
				ariaLabel: `New ${i} name`,
				placeholder: `${i}-name`,
				onCommit: (e) => {
					if (!e) throw Error(`Enter a ${i} name.`);
					r(e);
				}
			}
		}]]
	}];
	return /* @__PURE__ */ E(C, {
		maxW: "20rem",
		gap: "md",
		children: [/* @__PURE__ */ T(C, {
			borderWidth: "1px",
			p: "xs",
			children: /* @__PURE__ */ T(g, {
				sections: o,
				expandedSectionIds: ["files"],
				rowVariant: "tree"
			})
		}), /* @__PURE__ */ E(w, {
			textStyle: "label/XS",
			color: "fg.muted",
			children: [
				"Enter commits the ",
				i,
				" name. Escape or blur cancels creation."
			]
		})]
	});
}, O = (e, t) => {
	let n = t.filter((e) => e.canReorder !== !1), r = 0, i = e.map((e) => e.canReorder === !1 ? e : n[r++]).filter((e) => !!e);
	return i.push(...n.slice(r)), i.every((e, n) => e === t[n]) && i.length === t.length ? t : i;
}, ae = (e, t) => {
	if (t.length === 0) return e;
	let n = new Map(e.map((e, t) => [e.id, t])), r = /* @__PURE__ */ new Set(), i = [];
	for (let a of t) {
		let t = n.get(a);
		t === void 0 || r.has(t) || (r.add(t), i.push(e[t]));
	}
	let a = i.length > 0 && i.length !== e.length;
	for (let t = 0; t < e.length; t += 1) r.has(t) || (i.length !== t && !a && (a = !0), i.push(e[t]));
	if (!a) {
		for (let t = 0; t < e.length; t += 1) if (e[t] !== i[t]) {
			a = !0;
			break;
		}
	}
	return a ? i : e;
}, k = (e, t, n, r = []) => {
	let i = new Map(e.flatMap((e) => e.nodes.map((e) => [e.id, e]))), a = r.length ? [...e, ...r.map(({ icon: e, ...t }) => ({
		...t,
		canHide: !0,
		nodes: []
	}))] : e, o = Object.entries(n).flatMap(([e, t]) => {
		if (a.some((t) => t.id === e)) return [];
		let n = t.map((e) => i.get(e)).find((e) => e && e.canReorder !== !1);
		return n ? [{
			id: e,
			moveScope: n.moveScope,
			nodes: []
		}] : [];
	}), s = o.length > 0 ? [...a, ...o] : a, c = s !== e, l = O(s, ae(s, t));
	l !== s && (c = !0);
	let u = new Set(Object.entries(n).filter(([e]) => s.some((t) => t.id === e)).flatMap(([, e]) => e.filter((e) => i.has(e) && i.get(e)?.canReorder !== !1))), d = [];
	for (let e of l) {
		let t = n[e.id];
		if (!(e.id in n)) {
			let t = e.nodes.filter((e) => !u.has(e.id));
			t.length === e.nodes.length ? d.push(e) : (c = !0, d.push({
				...e,
				nodes: t
			}));
			continue;
		}
		let r = (t ?? []).flatMap((e) => {
			let t = i.get(e);
			return t && t.canReorder !== !1 ? [t] : [];
		}), a = e.nodes.filter((e) => !u.has(e.id)), o = O(e.nodes, [...r, ...a]);
		o.length !== e.nodes.length || o.some((t, n) => t !== e.nodes[n]) ? (c = !0, d.push({
			...e,
			nodes: o
		})) : d.push(e);
	}
	return c ? d : e;
}, A = {
	sectionOverrides: {},
	nodeOverrides: {}
}, j = "pstdio/ui/tree-list-visibility", M = (e) => `${j}/${e}`, oe = (e, t) => e ?? (t ? "hidden" : "shown"), se = (e) => e === "hidden" ? "shown" : "hidden", N = (e, t, n) => {
	if (n === void 0) {
		if (!(t in e)) return e;
		let { [t]: n, ...r } = e;
		return r;
	}
	return e[t] === n ? e : {
		...e,
		[t]: n
	};
}, P = (e, t, n) => N(e, t, se(oe(e[t], n))), F = (e) => ({
	sectionOverrides: e.sectionOverrides,
	nodeOverrides: e.nodeOverrides
}), I = (e) => h()(ee((e) => ({
	...A,
	setSection: (t, n) => e((e) => ({
		...e,
		sectionOverrides: N(e.sectionOverrides, t, n)
	})),
	setNode: (t, n) => e((e) => ({
		...e,
		nodeOverrides: N(e.nodeOverrides, t, n)
	})),
	toggleSection: (t, n) => e((e) => ({
		...e,
		sectionOverrides: P(e.sectionOverrides, t, n)
	})),
	toggleNode: (t, n) => e((e) => ({
		...e,
		nodeOverrides: P(e.nodeOverrides, t, n)
	})),
	clearSection: (t) => e((e) => ({
		...e,
		sectionOverrides: N(e.sectionOverrides, t, void 0)
	})),
	clearNode: (t) => e((e) => ({
		...e,
		nodeOverrides: N(e.nodeOverrides, t, void 0)
	})),
	reset: () => e(A)
}), {
	name: M(e.storageKey),
	storage: ne(e.storage),
	partialize: F
})), L = re((e, t) => I({
	storageKey: e,
	storage: t
})), R = (e, t) => {
	let n = L(e, te());
	return m(n, t);
}, z = (e, t) => typeof e == "string" ? e : t, B = (e, t) => e ?? (t ? "hidden" : "shown"), V = (e) => e.canHide === !0 || e.hiddenByDefault === !0, H = (e, t) => B(t[e.id], e.hiddenByDefault) === "shown", U = (e, t) => {
	let n = !1, r = [];
	for (let i of e) if (!H(i, t)) n = !0;
	else {
		if (i.children && i.children.length > 0) {
			let e = U(i.children, t);
			if (e !== i.children) {
				n = !0, r.push({
					...i,
					children: e
				});
				continue;
			}
		}
		r.push(i);
	}
	return n ? r : e;
}, W = (e, t, n) => {
	let r = !1, i = [];
	for (let a of e) {
		if (B(t[a.id], a.hiddenByDefault) === "hidden") {
			r = !0;
			continue;
		}
		let e = U(a.nodes, n);
		e.length === 0 && !a.emptyState && !a.actions?.length ? r = !0 : e === a.nodes ? i.push(a) : (r = !0, i.push({
			...a,
			nodes: e
		}));
	}
	return r ? i : e;
}, G = (e, t) => e === "shown" ? t.visibleIcon : t.hiddenIcon, K = (e, t, n, r, i) => {
	let a = e.hiddenByDefault === !0, o = B(n[e.id], a);
	return {
		key: `section:${e.id}`,
		label: t,
		onClick: () => r.onToggleSection(e.id, a),
		endContent: G(o, i)
	};
}, ce = (e, t, n, r) => {
	let i = e.hiddenByDefault === !0, a = B(t[e.id], i);
	return {
		key: `node:${e.id}`,
		label: z(e.label, e.id),
		icon: e.icon,
		onClick: () => n.onToggleNode(e.id, i),
		endContent: G(a, r)
	};
}, q = (e, t, n, r, i) => {
	let a = [], o = (e) => {
		e.length !== 0 && (a.length > 0 && (e[0] = {
			...e[0],
			separatorBefore: !0
		}), a.push(...e));
	}, s = (e) => {
		let a = [];
		for (let o of e) {
			let e = o.label ?? o.menuLabel;
			e && V(o) && a.push(K(o, e, t, r, i));
			for (let e of o.nodes) V(e) && a.push(ce(e, n, r, i));
		}
		return a;
	};
	return o(s(e.headerSections ?? [])), o(s(e.sections)), o(s(e.footerSections ?? [])), a.length === 0 || a.push({
		key: "__reset-visibility",
		label: "Reset to default",
		icon: i.resetIcon,
		separatorBefore: !0,
		onClick: r.onResetAll
	}), a;
}, J = {
	title: "Components/Data Display/Tree List",
	component: g
}, Y = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], le = Array.from({ length: 10 }, (e, t) => ({
	id: `action-${t + 1}`,
	label: `Action ${t + 1}`,
	description: `Run action ${t + 1}`
})), ue = [{
	id: "docs",
	label: "Documentation",
	actions: [{
		id: "add-doc",
		label: "Add document",
		icon: /* @__PURE__ */ T(l, { size: 14 })
	}],
	nodes: [{
		id: "overview",
		label: "Overview",
		icon: /* @__PURE__ */ T(s, { size: 14 }),
		isNavigable: !0,
		navigationIntent: {
			id: "open",
			payload: "overview"
		}
	}, {
		id: "guides",
		label: "Guides",
		icon: /* @__PURE__ */ T(c, { size: 14 }),
		children: [{
			id: "projects",
			label: "Projects",
			icon: /* @__PURE__ */ T(c, { size: 14 }),
			children: [{
				id: "create-project",
				label: "Create a project",
				icon: /* @__PURE__ */ T(s, { size: 14 }),
				isNavigable: !0,
				navigationIntent: {
					id: "open",
					payload: "create-project"
				}
			}]
		}]
	}]
}, {
	id: "settings",
	label: "Settings",
	nodes: [{
		id: "workspace",
		label: "Workspace",
		icon: /* @__PURE__ */ T(d, { size: 14 }),
		isNavigable: !0,
		actions: [{
			id: "more",
			label: "More actions",
			icon: /* @__PURE__ */ T(o, { size: 14 }),
			menuItems: le
		}]
	}]
}], de = [{
	id: "files",
	nodes: [{
		id: "src",
		label: "src",
		isContainer: !0,
		children: [{
			id: "src/components",
			label: "components",
			isContainer: !0,
			children: [{
				id: "src/components/tree-list.tsx",
				label: "tree-list.tsx",
				icon: /* @__PURE__ */ T(s, { size: 14 }),
				onActivate: () => void 0
			}]
		}, {
			id: "src/index.ts",
			label: "index.ts",
			icon: /* @__PURE__ */ T(s, { size: 14 }),
			onActivate: () => void 0
		}]
	}]
}], fe = () => {
	let [e, t] = _(["docs", "settings"]), [n, r] = _(["guides", "projects"]), [i, a] = _("overview"), [o, s] = _("No navigation yet");
	return /* @__PURE__ */ E(C, {
		maxW: "18rem",
		gap: "md",
		children: [/* @__PURE__ */ T(g, {
			sections: ue,
			expandedSectionIds: e,
			expandedNodeIds: n,
			activeNodeId: i,
			rowVariant: "compact",
			sectionGap: "md",
			nodeGap: "1px",
			onNavigate: (e) => {
				a(e.nodeId), s(`${e.sectionId}:${e.nodeId}`);
			},
			onToggleSection: (e) => t((t) => Y(t, e)),
			onToggleNode: (e) => r((t) => Y(t, e))
		}), /* @__PURE__ */ T(v, {
			borderWidth: "1px",
			p: "sm",
			children: /* @__PURE__ */ T(w, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: o
			})
		})]
	});
}, pe = () => {
	let [e, t] = _(["src", "src/components"]), [n, r] = _("src/components/tree-list.tsx"), i = de.map((e) => ({
		...e,
		nodes: e.nodes.map((e) => ({
			...e,
			children: e.children?.map((e) => ({
				...e,
				children: e.children?.map((e) => ({
					...e,
					onActivate: () => r(e.id ?? "")
				}))
			}))
		}))
	}));
	return /* @__PURE__ */ T(C, {
		maxW: "20rem",
		borderWidth: "1px",
		p: "xs",
		children: /* @__PURE__ */ T(g, {
			sections: i,
			expandedNodeIds: e,
			activeNodeId: n,
			rowVariant: "tree",
			onToggleNode: (e) => t((t) => Y(t, e))
		})
	});
}, me = [{
	id: "workspace",
	label: "Workspace",
	nodes: [{
		id: "overview",
		label: "Overview",
		icon: /* @__PURE__ */ T(s, { size: 14 }),
		actions: [{
			id: "add",
			label: "Add",
			icon: /* @__PURE__ */ T(l, { size: 14 }),
			tooltip: /* @__PURE__ */ E(x, {
				gap: "2",
				children: [/* @__PURE__ */ T(w, { children: "Add" }), /* @__PURE__ */ T(S, { children: "⌘N" })]
			})
		}, {
			id: "copy",
			label: "Copy",
			icon: /* @__PURE__ */ T(a, { size: 14 })
		}],
		menuItems: [{
			id: "rename",
			label: "Rename",
			endContent: /* @__PURE__ */ T(S, { children: "F2" })
		}, {
			id: "delete",
			label: "Delete",
			icon: /* @__PURE__ */ T(f, { size: 14 }),
			endContent: /* @__PURE__ */ T(S, { children: "⌫" })
		}],
		contextMenuItems: [{
			id: "rename-ctx",
			label: "Rename",
			endContent: /* @__PURE__ */ T(S, { children: "F2" })
		}, {
			id: "delete-ctx",
			label: "Delete",
			icon: /* @__PURE__ */ T(f, { size: 14 }),
			endContent: /* @__PURE__ */ T(S, { children: "⌫" })
		}]
	}, {
		id: "settings",
		label: "Settings",
		icon: /* @__PURE__ */ T(d, { size: 14 })
	}]
}], he = () => /* @__PURE__ */ E(C, {
	maxW: "20rem",
	borderWidth: "1px",
	p: "xs",
	children: [/* @__PURE__ */ T(g, {
		sections: me,
		expandedSectionIds: ["workspace"],
		rowVariant: "compact",
		sectionGap: "md",
		nodeGap: "1px"
	}), /* @__PURE__ */ T(w, {
		textStyle: "label/XS",
		color: "fg.muted",
		children: "Hover the Add icon for a tooltip with a Kbd hint. Click the row chevron / right-click for menus with trailing Kbd."
	})]
}), ge = [{
	id: "favorites",
	label: "Favorites",
	nodes: [
		{
			id: "inbox",
			label: "Inbox",
			icon: /* @__PURE__ */ T(s, { size: 14 })
		},
		{
			id: "drafts",
			label: "Drafts",
			icon: /* @__PURE__ */ T(s, { size: 14 })
		},
		{
			id: "archive",
			label: "Archive",
			icon: /* @__PURE__ */ T(s, { size: 14 })
		}
	]
}, {
	id: "projects",
	label: "Projects",
	nodes: [{
		id: "alpha",
		label: "Alpha",
		icon: /* @__PURE__ */ T(c, { size: 14 })
	}, {
		id: "beta",
		label: "Beta",
		icon: /* @__PURE__ */ T(c, { size: 14 })
	}]
}], _e = () => {
	let [e, t] = _([]), [n, r] = _({}), i = k(ge, e, n);
	return /* @__PURE__ */ E(C, {
		maxW: "20rem",
		gap: "md",
		children: [
			/* @__PURE__ */ T(C, {
				borderWidth: "1px",
				p: "xs",
				children: /* @__PURE__ */ T(g, {
					sections: i,
					expandedSectionIds: ["favorites", "projects"],
					rowVariant: "compact",
					sectionGap: "md",
					nodeGap: "1px",
					draggable: !0,
					onReorderSections: t,
					onReorderNodes: (e, t) => r((n) => ({
						...n,
						[e]: t
					}))
				})
			}),
			/* @__PURE__ */ T(y, {
				size: "sm",
				variant: "outline",
				onClick: () => {
					t([]), r({});
				},
				children: "Reset order"
			}),
			/* @__PURE__ */ T(w, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: "Drag a section header or a row (move 4px to start). Nested rows stay anchored to their parent."
			})
		]
	});
}, ve = [{
	id: "primary",
	label: "Primary",
	nodes: [{
		id: "overview",
		label: "Overview",
		icon: /* @__PURE__ */ T(s, { size: 14 })
	}, {
		id: "activity",
		label: "Activity",
		icon: /* @__PURE__ */ T(s, { size: 14 })
	}]
}, {
	id: "advanced",
	label: "Advanced",
	hiddenByDefault: !0,
	nodes: [{
		id: "debug",
		label: "Debug",
		icon: /* @__PURE__ */ T(d, { size: 14 })
	}]
}], ye = () => {
	let [e, t] = _({}), [n, r] = _({}), i = W(ve, e, n);
	return /* @__PURE__ */ E(C, {
		maxW: "20rem",
		gap: "md",
		children: [
			/* @__PURE__ */ T(C, {
				borderWidth: "1px",
				p: "xs",
				children: /* @__PURE__ */ T(g, {
					sections: i,
					expandedSectionIds: ["primary", "advanced"],
					rowVariant: "compact",
					sectionGap: "md",
					nodeGap: "1px"
				})
			}),
			/* @__PURE__ */ E(x, {
				gap: "xs",
				children: [/* @__PURE__ */ T(y, {
					size: "sm",
					variant: "outline",
					onClick: () => t((e) => ({
						...e,
						advanced: "shown"
					})),
					children: "Show Advanced"
				}), /* @__PURE__ */ T(y, {
					size: "sm",
					variant: "outline",
					onClick: () => r((e) => ({
						...e,
						activity: "hidden"
					})),
					children: "Hide Activity"
				})]
			}),
			/* @__PURE__ */ T(w, {
				textStyle: "label/XS",
				color: "fg.muted",
				children: "The Advanced section is hiddenByDefault. Overrides toggle visibility without mutating the source tree."
			})
		]
	});
}, be = { render: () => /* @__PURE__ */ T(fe, {}) }, xe = { render: () => /* @__PURE__ */ T(pe, {}) }, Se = { render: () => /* @__PURE__ */ T(D, {}) }, Ce = { render: () => /* @__PURE__ */ T(D, { type: "folder" }) }, we = { render: () => /* @__PURE__ */ T(he, {}) }, Te = {
	render: () => /* @__PURE__ */ T(_e, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = () => a.getAllByRole("option").map((e) => e.textContent), s = (e) => a.getByRole("option", { name: e }), c = (e, t = 0) => {
			let n = e.getBoundingClientRect();
			return {
				x: n.left + 20,
				y: n.top + n.height / 2 + t
			};
		}, l = n.setup(), u = async (e, n, r) => {
			await l.pointer([
				{
					keys: "[MouseLeft>]",
					target: e,
					coords: c(e)
				},
				{
					target: e,
					coords: c(e, 8)
				},
				{ coords: n }
			]), await t(r), await l.pointer({
				keys: "[/MouseLeft]",
				coords: n
			});
		};
		await u(s("Inbox"), c(s("Archive"), 4), () => {
			r(i.querySelector("[data-tree-list-drop-indicator=\"after\"]")).toBeInTheDocument(), r(i.querySelector("[data-tree-list-drop-group]")).toBeInTheDocument();
		}), await t(() => r(o()).toEqual([
			"Drafts",
			"Archive",
			"Inbox",
			"Alpha",
			"Beta"
		]));
		let d = s("Inbox").getBoundingClientRect();
		await u(s("Drafts"), {
			x: d.left + 20,
			y: d.bottom + 6
		}, () => {
			r(i.querySelector("[data-tree-list-drop-indicator=\"middle\"]")).toBeInTheDocument(), r(i.querySelector("[data-tree-list-drop-group]")).toBeNull();
		}), await t(() => r(o()).toEqual([
			"Archive",
			"Inbox",
			"Drafts",
			"Alpha",
			"Beta"
		])), await r(i.querySelector("[data-tree-list-drop-indicator]")).toBeNull();
	}
}, Ee = [{
	id: "pinned",
	nodes: [{
		id: "search",
		label: "Search",
		icon: /* @__PURE__ */ T(u, { size: 14 })
	}]
}, {
	id: "navigation",
	nodes: [{
		id: "sessions",
		label: "Sessions",
		icon: /* @__PURE__ */ T(s, { size: 14 })
	}, {
		id: "notes",
		label: "Notes",
		icon: /* @__PURE__ */ T(s, { size: 14 })
	}]
}], De = () => {
	let [e, t] = _([]), [n, r] = _({});
	return /* @__PURE__ */ T(C, {
		maxW: "20rem",
		borderWidth: "1px",
		p: "xs",
		children: /* @__PURE__ */ T(g, {
			sections: k(Ee, e, n),
			rowVariant: "compact",
			sectionGap: "md",
			nodeGap: "1px",
			draggable: !0,
			onReorderSections: t,
			onReorderNodes: (e, t) => r((n) => ({
				...n,
				[e]: t
			}))
		})
	});
}, Oe = {
	render: () => /* @__PURE__ */ T(De, {}),
	play: async ({ canvasElement: i }) => {
		let a = e(i), o = () => a.getAllByRole("option").map((e) => e.textContent), s = (e) => a.getByRole("option", { name: e }), c = (e, t = 0) => {
			let n = e.getBoundingClientRect();
			return {
				x: n.left + 20,
				y: n.top + n.height / 2 + t
			};
		}, l = n.setup(), u = async (e, n) => {
			await l.pointer([{
				keys: "[MouseLeft>]",
				target: e,
				coords: c(e)
			}, {
				target: e,
				coords: c(e, 8)
			}]);
			let a = await t(n);
			await l.pointer({ coords: a }), await t(() => r(i.querySelector("[data-tree-list-drop-indicator]")).toBeInTheDocument()), await l.pointer({
				keys: "[/MouseLeft]",
				coords: a
			});
		};
		await u(s("Search"), () => c(s("Notes"), 4)), await t(() => r(o()).toEqual([
			"Sessions",
			"Notes",
			"Search"
		])), await r(i.querySelector("[data-tree-list-empty-drop-zone]")).toBeNull(), await u(s("Notes"), () => {
			let e = i.querySelector("[data-tree-list-empty-drop-zone]");
			return r(e).toBeInTheDocument(), c(e);
		}), await t(() => r(o()).toEqual([
			"Notes",
			"Sessions",
			"Search"
		]));
	}
}, ke = { render: () => /* @__PURE__ */ T(ye, {}) }, Ae = [{
	id: "search",
	label: "Search",
	icon: /* @__PURE__ */ T(u, { size: 14 }),
	canHide: !0
}], je = [{
	id: "help",
	label: "Help",
	icon: /* @__PURE__ */ T(d, { size: 14 }),
	canHide: !0
}], X = [{
	id: "navigation",
	label: "Navigation",
	canHide: !0,
	nodes: [{
		id: "tickets",
		label: "Tickets",
		icon: /* @__PURE__ */ T(s, { size: 14 })
	}, {
		id: "planner",
		label: "Planner",
		icon: /* @__PURE__ */ T(d, { size: 14 })
	}]
}, {
	id: "files",
	label: "Files",
	canHide: !0,
	hiddenByDefault: !0,
	nodes: [{
		id: "readme",
		label: "README.md",
		icon: /* @__PURE__ */ T(c, { size: 14 })
	}]
}], Z = {
	headerSections: [{
		id: "header",
		nodes: Ae
	}],
	sections: X,
	footerSections: [{
		id: "footer",
		nodes: je
	}]
}, Q = {
	visibleIcon: /* @__PURE__ */ T(i, { size: 14 }),
	hiddenIcon: /* @__PURE__ */ T(i, { size: 14 })
}, $ = "storybook/tree-customization", Me = () => {
	let e = R($, (e) => e.sectionOverrides), t = R($, (e) => e.nodeOverrides), n = R($, (e) => e.toggleSection), r = R($, (e) => e.toggleNode), i = R($, (e) => e.reset), a = W(X, e, t), o = q(Z, e, t, {
		onToggleSection: n,
		onToggleNode: r,
		onResetAll: i
	}, Q);
	return /* @__PURE__ */ E(C, {
		maxW: "20rem",
		gap: "md",
		children: [/* @__PURE__ */ T(v, {
			borderWidth: "1px",
			h: "16rem",
			overflow: "hidden",
			children: /* @__PURE__ */ T(g, {
				sections: a,
				expandedSectionIds: ["workspace-actions", "navigation"],
				rowVariant: "compact",
				sectionGap: "md",
				nodeGap: "1px",
				backgroundContextActions: o
			})
		}), /* @__PURE__ */ T(w, {
			textStyle: "label/XS",
			color: "fg.muted",
			children: "Right-click the empty area below the items to open the customize menu. Toggle entries (they disappear / reappear), or Reset to default — the menu stays open across toggles. Only opted-in categories and header/footer rows are listed (e.g. \"Navigation\", \"Search\", \"Help\"); leaf rows are never hideable. \"Files\" is hiddenByDefault."
		})]
	});
}, Ne = { render: () => /* @__PURE__ */ T(Me, {}) }, Pe = () => {
	let e = ie(null), t = R($, (e) => e.sectionOverrides), n = R($, (e) => e.nodeOverrides), r = R($, (e) => e.toggleSection), i = R($, (e) => e.toggleNode), a = R($, (e) => e.reset), o = W(X, t, n), s = q(Z, t, n, {
		onToggleSection: r,
		onToggleNode: i,
		onResetAll: a
	}, Q);
	return /* @__PURE__ */ T(b, {
		direction: "column",
		h: "20rem",
		maxW: "20rem",
		borderWidth: "1px",
		children: /* @__PURE__ */ T(p, {
			flex: "1",
			minH: "0",
			w: "full",
			viewportRef: e,
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
			children: /* @__PURE__ */ T(v, {
				w: "full",
				minW: "0",
				flex: "1 0 auto",
				display: "flex",
				flexDirection: "column",
				children: /* @__PURE__ */ T(g, {
					sections: o,
					expandedSectionIds: ["workspace-actions", "navigation"],
					rowVariant: "compact",
					sectionGap: "md",
					nodeGap: "1px",
					backgroundContextActions: s,
					scrollRef: e
				})
			})
		})
	});
}, Fe = { render: () => /* @__PURE__ */ T(Pe, {}) };
export { we as ActionShortcuts, Ne as BackgroundContextMenu, Fe as BackgroundContextMenuInScrollArea, Oe as EmptiedSectionAcceptsRows, xe as FileTree, Se as InlineFileCreation, Ce as InlineFolderCreation, Te as Reorderable, be as SectionedNavigation, ke as Visibility, J as default };
