// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevrons-down-up-Bpa99miB.ts";
import { t as n } from "./chevrons-up-down-DlTkvZ9f.ts";
import { t as r } from "./file-text-B9-uT4dU.ts";
import { t as i } from "./list-tree-wIq_OI-O.ts";
import { a, i as o, n as s, r as c, t as l } from "./square-split-horizontal-D8KwXGQS.ts";
import { t as u } from "./search-FHo0INnP.ts";
import { t as d } from "./settings-2-CNFOcldp.ts";
import { t as f } from "./scroll-area-I7hjn89T.ts";
import { t as p } from "./empty-state-C7gtd4pd.ts";
import { t as m } from "./list-row-BhxGCvIh.ts";
import { t as h } from "./header-8InG5j3w.ts";
import { t as g } from "./react-vHPBN2SX.ts";
import { t as _ } from "./diff-bubble-CWPQbWDR.ts";
import { DiffDrawer as v } from "./diff-drawer-C4AQvgUV.ts";
import { t as y } from "./resizable-split-layout-DdxKHR9a.ts";
import { t as b } from "./tree-list-Db4WJcm2.ts";
import { useEffect as x, useRef as S, useState as ee } from "react";
import { Badge as C, Box as w, Flex as te, HStack as ne, Icon as T, IconButton as E, Input as D, InputGroup as O, Menu as k, Skeleton as A, Stack as j, Text as M } from "@chakra-ui/react";
import { Fragment as re, jsx as N, jsxs as P } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/build-changed-files-tree.ts
var F = (e) => e.split("/").map((e) => e.trim()).filter(Boolean).join("/"), I = (e) => (e.sort((e, t) => e.type === t.type ? e.name.localeCompare(t.name) : e.type === "folder" ? -1 : 1), e.forEach((e) => {
	e.children && I(e.children);
}), e), L = (e) => Array.from(new Set(e.map(F).filter(Boolean))), R = (e) => L(e).map((e) => ({
	id: `file:${e}`,
	name: e,
	type: "file"
})).sort((e, t) => e.name.localeCompare(t.name)), z = (e, t) => {
	if (t === "flat") return R(e);
	let n = /* @__PURE__ */ new Map(), r = [];
	return L(e).forEach((e) => {
		let t = e.split("/"), i = "", a = null;
		t.forEach((e, o) => {
			let s = i ? `${i}/${e}` : e, c = o === t.length - 1, l = `${c ? "file" : "folder"}:${s}`, u = n.get(l);
			if (u) {
				a = u, i = s;
				return;
			}
			let d = {
				id: l,
				name: e,
				type: c ? "file" : "folder",
				...c ? {} : { children: [] }
			};
			n.set(l, d), a ? a.children?.push(d) : r.push(d), a = d, i = s;
		});
	}), I(r);
}, B = (e) => {
	let t = [], n = (e) => {
		e.forEach((e) => {
			e.type === "folder" && (t.push(e.id), n(e.children ?? []));
		});
	};
	return n(e), t;
}, V = (e) => {
	let t = [], n = (e) => {
		e.forEach((e) => {
			e.type === "file" ? t.push(e.id.replace(/^file:/, "")) : n(e.children ?? []);
		});
	};
	return n(e), t;
}, H = (e, t) => t === "flat" ? [...e].sort((e, t) => e.localeCompare(t)) : V(z(e, "nested")), ie = g((e) => ({
	isTreePanelOpen: !0,
	viewMode: "nested",
	diffViewMode: "unified",
	searchQuery: "",
	selectedPath: null,
	expandedFolderIds: /* @__PURE__ */ new Set(),
	setTreePanelOpen: (t) => e({ isTreePanelOpen: t }),
	toggleTreePanel: () => e((e) => ({ isTreePanelOpen: !e.isTreePanelOpen })),
	setViewMode: (t) => e({ viewMode: t }),
	setDiffViewMode: (t) => e({ diffViewMode: t }),
	setSearchQuery: (t) => e({ searchQuery: t }),
	setSelectedPath: (t) => e({ selectedPath: t }),
	setExpandedFolderIds: (t) => e({ expandedFolderIds: new Set(t) }),
	toggleFolder: (t) => e((e) => {
		let n = new Set(e.expandedFolderIds);
		return n.has(t) ? n.delete(t) : n.add(t), { expandedFolderIds: n };
	}),
	expandAll: (t) => e({ expandedFolderIds: new Set(t) }),
	collapseAll: () => e({ expandedFolderIds: /* @__PURE__ */ new Set() })
})), U = (t) => /* @__PURE__ */ N(w, {
	w: "14px",
	flexShrink: 0,
	display: "flex",
	justifyContent: "center",
	children: t.selected ? /* @__PURE__ */ N(e, { size: 14 }) : null
}), W = (e) => {
	let { id: t, label: n, icon: r, selected: i, disabled: a, onActivate: o } = e;
	return /* @__PURE__ */ N(k.Item, {
		value: t,
		disabled: a,
		asChild: !0,
		children: /* @__PURE__ */ N(m, {
			asChild: !0,
			role: i === void 0 ? void 0 : "menuitemradio",
			"aria-checked": i,
			variant: "full-width",
			id: t,
			icon: r,
			label: n,
			disabled: a,
			isSelected: i,
			endContent: i === void 0 ? void 0 : /* @__PURE__ */ N(U, { selected: i }),
			onActivate: o
		})
	});
}, ae = (e) => {
	let { isTreePanelOpen: r, hasFilePaths: u, viewMode: f, diffViewMode: p, isExpandAllDisabled: m, isCollapseAllDisabled: h, onToggleTreePanel: g, onViewModeChange: _, onDiffViewModeChange: v, onExpandAll: y, onCollapseAll: b } = e;
	return /* @__PURE__ */ P(k.Root, { children: [/* @__PURE__ */ N(k.Trigger, {
		asChild: !0,
		children: /* @__PURE__ */ N(E, {
			"aria-label": "Diff view options",
			variant: "ghost",
			size: "sm",
			children: /* @__PURE__ */ N(d, { size: 14 })
		})
	}), /* @__PURE__ */ N(k.Positioner, { children: /* @__PURE__ */ P(k.Content, {
		minW: "190px",
		bg: "bg",
		p: "0",
		gap: "0",
		children: [
			/* @__PURE__ */ N(W, {
				id: "toggle-file-tree",
				icon: N(r ? o : c, { size: 14 }),
				label: r ? "Hide file tree" : "Show file tree",
				onActivate: g
			}),
			/* @__PURE__ */ N(k.Separator, {}),
			u ? /* @__PURE__ */ P(re, { children: [
				/* @__PURE__ */ N(W, {
					id: "nested",
					icon: /* @__PURE__ */ N(i, { size: 14 }),
					label: "Nested",
					selected: f === "nested",
					onActivate: () => _("nested")
				}),
				/* @__PURE__ */ N(W, {
					id: "flat",
					icon: /* @__PURE__ */ N(a, { size: 14 }),
					label: "Flat",
					selected: f === "flat",
					onActivate: () => _("flat")
				}),
				/* @__PURE__ */ N(k.Separator, {})
			] }) : null,
			/* @__PURE__ */ N(W, {
				id: "unified",
				icon: /* @__PURE__ */ N(s, { size: 14 }),
				label: "Unified",
				selected: p === "unified",
				onActivate: () => v("unified")
			}),
			/* @__PURE__ */ N(W, {
				id: "split",
				icon: /* @__PURE__ */ N(l, { size: 14 }),
				label: "Split",
				selected: p === "split",
				onActivate: () => v("split")
			}),
			/* @__PURE__ */ N(k.Separator, {}),
			/* @__PURE__ */ N(W, {
				id: "expand-all",
				icon: /* @__PURE__ */ N(n, { size: 14 }),
				label: "Expand all",
				disabled: m,
				onActivate: y
			}),
			/* @__PURE__ */ N(W, {
				id: "collapse-all",
				icon: /* @__PURE__ */ N(t, { size: 14 }),
				label: "Collapse all",
				disabled: h,
				onActivate: b
			})
		]
	}) })] });
}, G = {
	added: "A",
	copied: "C",
	deleted: "D",
	modified: "M",
	permissionChange: "M",
	renamed: "R"
}, K = {
	added: "green",
	copied: "purple",
	deleted: "red",
	modified: "blue",
	permissionChange: "yellow",
	renamed: "orange"
}, q = {
	added: {
		color: "fg.success",
		backgroundColor: "bg.success"
	},
	deleted: {
		color: "fg.error",
		backgroundColor: "bg.error"
	}
}, J = (e) => {
	let { change: t } = e, n = q[t] ?? { colorPalette: K[t] ?? "gray" };
	return /* @__PURE__ */ N(C, {
		size: "xs",
		variant: "subtle",
		flexShrink: 0,
		...n,
		children: G[t] ?? t
	});
}, Y = (e) => {
	let t = e.lastIndexOf("/");
	return t < 0 ? {
		fileName: e,
		dirPath: ""
	} : {
		fileName: e.slice(t + 1),
		dirPath: e.slice(0, t)
	};
}, X = (e) => {
	let { fileName: t, dirPath: n } = e;
	return /* @__PURE__ */ P(M, {
		textStyle: "label/S/regular",
		truncate: !0,
		children: [
			/* @__PURE__ */ N(M, {
				as: "span",
				color: "fg.default",
				children: t
			}),
			" ",
			/* @__PURE__ */ N(M, {
				as: "span",
				color: "fg.muted",
				children: n
			})
		]
	});
}, Z = (e) => {
	let { nodes: t, viewMode: n, onSelectPath: i, resolveFileIcon: a, changeByPath: o } = e;
	return t.map((e) => {
		if (e.type === "folder") return {
			id: e.id,
			label: e.name,
			isContainer: !0,
			children: Z({
				nodes: e.children ?? [],
				viewMode: n,
				onSelectPath: i,
				resolveFileIcon: a,
				changeByPath: o
			})
		};
		let t = e.id.replace(/^file:/, ""), { fileName: s, dirPath: c } = Y(t), l = a?.(t) ?? {
			icon: /* @__PURE__ */ N(T, {
				as: r,
				boxSize: "16px"
			}),
			color: "fg.subtle"
		}, u = o?.get(t);
		return {
			id: e.id,
			label: n === "flat" && c ? /* @__PURE__ */ N(X, {
				fileName: s,
				dirPath: c
			}) : e.name,
			icon: l.icon,
			iconColor: l.color,
			endContent: u ? /* @__PURE__ */ N(J, { change: u }) : void 0,
			onActivate: () => i(t)
		};
	});
}, oe = (e) => {
	let { paths: t, selectedPath: n, viewMode: r, searchQuery: i, expandedFolderIds: a, onSelectPath: o, onSearchQueryChange: s, onToggleFolder: c, resolveFileIcon: l, changeByPath: d } = e, m = S(null), g = Z({
		nodes: z(t, r),
		viewMode: r,
		onSelectPath: o,
		resolveFileIcon: l,
		changeByPath: d
	}), _ = i.trim() ? "No matching files" : "No changed files";
	return /* @__PURE__ */ P(j, {
		h: "full",
		minH: "0",
		minW: "0",
		w: "full",
		gap: "0",
		overflow: "hidden",
		bg: "bg",
		children: [/* @__PURE__ */ N(h, {
			flexShrink: 0,
			borderBottomWidth: "1px",
			borderColor: "border.subtle",
			bg: "bg",
			children: /* @__PURE__ */ N(O, {
				startElement: /* @__PURE__ */ N(u, { size: 14 }),
				children: /* @__PURE__ */ N(D, {
					size: "sm",
					variant: "borderless",
					"aria-label": "Search files",
					placeholder: "Search files",
					value: i,
					onChange: (e) => s(e.target.value)
				})
			})
		}), /* @__PURE__ */ N(f, {
			flex: "1",
			minH: "0",
			minW: "0",
			bg: "bg",
			viewportRef: m,
			viewportProps: { style: { overflowX: "hidden" } },
			children: t.length > 0 ? /* @__PURE__ */ N(b, {
				sections: [{
					id: "files",
					nodes: g
				}],
				expandedNodeIds: [...a],
				activeNodeId: n ? `file:${n}` : null,
				rowVariant: "tree",
				onToggleNode: c,
				virtualize: !0,
				scrollRef: m
			}) : /* @__PURE__ */ N(w, {
				px: "xs",
				py: "xs",
				children: /* @__PURE__ */ N(p, {
					title: _,
					size: "sm",
					textAlign: "left",
					alignItems: "flex-start"
				})
			})
		})]
	});
}, Q = (e) => e.newPath ?? e.oldPath ?? "unknown", se = (e) => new Map(e.map((e) => [Q(e), e.change])), ce = (e) => e.reduce((e, t) => ({
	additions: e.additions + (t.additions ?? 0),
	deletions: e.deletions + (t.deletions ?? 0)
}), {
	additions: 0,
	deletions: 0
}), le = (e) => {
	let { diffs: t, normalizedSearchQuery: n, viewMode: r } = e, i = n ? t.filter((e) => Q(e).toLowerCase().includes(n)) : t, a = H(i.map(Q), r), o = new Map(a.map((e, t) => [e, t]));
	return [...i].sort((e, t) => (o.get(Q(e)) ?? 2 ** 53 - 1) - (o.get(Q(t)) ?? 2 ** 53 - 1));
}, ue = (e, t) => e[0] ?? t[0] ?? null, de = [
	"first",
	"second",
	"third"
], fe = () => /* @__PURE__ */ N(j, {
	flex: "1",
	minH: "0",
	bg: "bg",
	p: "xs",
	gap: "xs",
	role: "status",
	"aria-busy": "true",
	"aria-label": "Loading diff panel",
	children: de.map((e) => /* @__PURE__ */ N(A, {
		h: "72px",
		w: "full",
		flexShrink: "0",
		borderRadius: "xs"
	}, e))
}), $ = (e) => {
	let { diffs: t, changedFilePaths: n, defaultSelectedPath: r = null, loading: i = !1, onLoadDiff: a, resolveFileIcon: o } = e, [s, c] = ee(null), [l, u] = ee({
		allExpanded: !1,
		allCollapsed: !1
	}), { isTreePanelOpen: d, viewMode: f, diffViewMode: m, searchQuery: g, selectedPath: b, expandedFolderIds: S, setTreePanelOpen: C, setViewMode: T, setDiffViewMode: E, setSearchQuery: D, setSelectedPath: O, setExpandedFolderIds: k, toggleFolder: A, expandAll: re, collapseAll: F } = ie(), I = t.map(Q), L = n ?? I, R = g.trim().toLowerCase(), V = R ? L.filter((e) => e.toLowerCase().includes(R)) : L, H = le({
		diffs: t,
		normalizedSearchQuery: R,
		viewMode: f
	}), U = se(t), W = H.map(Q), G = z(V, f), K = f === "nested" ? B(G) : [], q = V.join("\0"), J = W.join("\0"), Y = b ?? r ?? ue(W, V), X = H.length > 0, Z = R ? "No matching changes" : "No changes", de = !i && !X, $ = ce(H), pe = K.length > 0 || H.length > 0, me = K.every((e) => S.has(e)), he = K.every((e) => !S.has(e)), ge = H.length === 0 || l.allExpanded, _e = H.length === 0 || l.allCollapsed, ve = !pe || me && ge, ye = !pe || he && _e;
	x(() => {
		let e = z(q ? q.split("\0") : [], f);
		k(f === "nested" ? B(e) : []);
	}, [
		q,
		k,
		f
	]), x(() => {
		let e = J ? J.split("\0") : [], t = q ? q.split("\0") : [];
		Y && e.includes(Y) || O(ue(e, t));
	}, [
		J,
		q,
		Y,
		O
	]);
	let be = () => {
		re(K), c((e) => ({
			action: "expand",
			id: (e?.id ?? 0) + 1
		}));
	}, xe = () => {
		F(), c((e) => ({
			action: "collapse",
			id: (e?.id ?? 0) + 1
		}));
	}, Se = (e) => {
		let t = Y ? W.indexOf(Y) : -1, n = W.indexOf(e), r = t >= 0 && n >= 0 && n < t ? "up" : "down";
		O(e), c((t) => ({
			action: "expand-selected",
			direction: r,
			id: (t?.id ?? 0) + 1,
			path: e
		}));
	}, Ce = /* @__PURE__ */ P(j, {
		h: "full",
		minH: "0",
		minW: "0",
		flex: "1",
		bg: "bg",
		gap: "0",
		children: [
			/* @__PURE__ */ P(h, {
				variant: "main",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				bg: "bg",
				justifyContent: "space-between",
				children: [/* @__PURE__ */ P(ne, {
					gap: "xs",
					minW: "0",
					children: [/* @__PURE__ */ N(ae, {
						isTreePanelOpen: d,
						hasFilePaths: L.length > 0,
						viewMode: f,
						diffViewMode: m,
						isExpandAllDisabled: ve,
						isCollapseAllDisabled: ye,
						onToggleTreePanel: () => C(!d),
						onViewModeChange: T,
						onDiffViewModeChange: E,
						onExpandAll: be,
						onCollapseAll: xe
					}), de ? /* @__PURE__ */ N(M, {
						textStyle: "label/S/regular",
						color: "fg.muted",
						truncate: !0,
						children: Z
					}) : null]
				}), /* @__PURE__ */ N(_, {
					variant: "ghost",
					size: "small",
					additions: $.additions,
					deletions: $.deletions
				})]
			}),
			i && /* @__PURE__ */ N(fe, {}),
			!i && X && /* @__PURE__ */ N(w, {
				flex: "1",
				minH: "0",
				children: /* @__PURE__ */ N(v, {
					diffs: H,
					selectedDiffPath: Y,
					onLoadDiff: a,
					onSelectDiffPath: O,
					onExpansionStateChange: u,
					expansionCommand: s,
					diffViewMode: m
				})
			}),
			!i && !X && /* @__PURE__ */ N(w, {
				flex: "1",
				minH: "0",
				px: "md",
				py: "lg",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				bg: "bg",
				children: /* @__PURE__ */ N(p, { title: Z })
			})
		]
	});
	return /* @__PURE__ */ N(te, {
		flex: "1",
		minH: "0",
		minW: "0",
		bg: "bg",
		gap: "0",
		"data-testid": "diff-viewer",
		children: /* @__PURE__ */ N(y, {
			flex: "1",
			minH: "0",
			minW: "0",
			resizablePanel: /* @__PURE__ */ N(oe, {
				paths: V,
				selectedPath: Y,
				viewMode: f,
				searchQuery: g,
				expandedFolderIds: S,
				onSelectPath: Se,
				onSearchQueryChange: D,
				onToggleFolder: A,
				resolveFileIcon: o,
				changeByPath: U
			}),
			contentPanel: Ce,
			collapsed: !d,
			defaultSizePx: 288,
			minSizePx: 224,
			contentMinSizePx: 320,
			resizeLabel: "Resize file list panel",
			separator: "line",
			onCollapsedChange: (e) => C(!e)
		})
	});
};
export { $ as DiffViewer };
