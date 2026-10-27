// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./chevron-right-CRFNEcZT.ts";
import { t as r } from "./copy-COTDVt4R.ts";
import { t as i } from "./scroll-area-I7hjn89T.ts";
import { t as a } from "./tooltip-BweQW627.ts";
import { t as o } from "./empty-state-C7gtd4pd.ts";
import { n as s, t as c } from "./use-virtualizer-DJbWYnTZ.ts";
import { t as l } from "./diff-bubble-CWPQbWDR.ts";
import { a as u, i as d, n as f, o as p, r as m } from "./diff-size-BfcOlnSz.ts";
import { r as h, t as g } from "./diff-editor-CLA3b8qv.ts";
import { useEffect as _, useLayoutEffect as v, useRef as y, useState as b } from "react";
import { Box as x, Button as S, Grid as C, IconButton as w, Image as T, Skeleton as E, Stack as D, Text as O } from "@chakra-ui/react";
import { jsx as k, jsxs as A } from "react/jsx-runtime";
// packages/ui/src/components/diff-viewer/diff-card-body.tsx
var j = (e) => {
	let { diff: t, filePath: n, oldContent: r, newContent: i, isLargeDiff: a, hasOptedIntoLargeDiff: o, onShowFullDiff: s, diffViewMode: c = "unified", buildViewData: l } = e;
	if (m(n)) {
		let e = M(r), t = M(i);
		return u(n) && (e || t) ? {
			kind: "image",
			filePath: n,
			oldSrc: e,
			newSrc: t
		} : {
			kind: "binary",
			filePath: n,
			isImage: u(n)
		};
	}
	return a && !o ? {
		kind: "placeholder",
		filePath: n,
		renderedLineCount: f(t),
		onShowFullDiff: s
	} : {
		kind: "editor",
		diffViewData: (l ?? h)({
			original: r,
			modified: i,
			oldPath: t.oldPath,
			newPath: t.newPath
		}),
		sideBySide: c === "split"
	};
}, M = (e) => e.startsWith("data:image/") ? e : "", N = (e) => {
	let { diff: t, filePath: n, oldContent: r, newContent: i, isLargeDiff: a, hasOptedIntoLargeDiff: o, onShowFullDiff: s, diffViewMode: c = "unified" } = e, l = j({
		diff: t,
		filePath: n,
		oldContent: r,
		newContent: i,
		isLargeDiff: a,
		hasOptedIntoLargeDiff: o,
		onShowFullDiff: s,
		diffViewMode: c
	});
	return /* @__PURE__ */ A(x, {
		bg: "bg",
		borderBottomRadius: "xs",
		overflow: "hidden",
		children: [
			l.kind === "editor" && /* @__PURE__ */ k(g, {
				original: r,
				modified: i,
				oldPath: t.oldPath,
				newPath: t.newPath,
				sideBySide: l.sideBySide,
				data: l.diffViewData
			}),
			l.kind === "image" && /* @__PURE__ */ k(P, {
				oldSrc: l.oldSrc,
				newSrc: l.newSrc
			}),
			l.kind === "binary" && /* @__PURE__ */ k(te, { isImage: l.isImage }),
			l.kind === "placeholder" && /* @__PURE__ */ k(ee, {
				filePath: l.filePath,
				renderedLineCount: l.renderedLineCount,
				onShowFullDiff: l.onShowFullDiff
			})
		]
	});
}, P = (e) => {
	let { oldSrc: t, newSrc: n } = e;
	return /* @__PURE__ */ A(C, {
		templateColumns: {
			base: "1fr",
			md: "1fr 1fr"
		},
		gap: "sm",
		p: "sm",
		borderTop: "1px solid",
		borderColor: "border.subtle",
		bg: "bg",
		children: [/* @__PURE__ */ k(F, {
			label: "Old",
			src: t,
			fallback: "No old image"
		}), /* @__PURE__ */ k(F, {
			label: "New",
			src: n,
			fallback: "No new image"
		})]
	});
}, F = (e) => {
	let { label: t, src: n, fallback: r } = e;
	return /* @__PURE__ */ A(x, {
		border: "1px solid",
		borderColor: "border.subtle",
		borderRadius: "xs",
		overflow: "hidden",
		bg: "bg.subtle",
		minW: "0",
		children: [/* @__PURE__ */ k(O, {
			px: "xs",
			py: "2xs",
			textStyle: "label/S/medium",
			color: "fg.muted",
			borderBottom: "1px solid",
			borderColor: "border.subtle",
			children: t
		}), /* @__PURE__ */ k(x, {
			display: "grid",
			placeItems: "center",
			minH: "180px",
			p: "sm",
			children: n ? /* @__PURE__ */ k(T, {
				src: n,
				alt: `${t} image diff`,
				maxH: "260px",
				maxW: "100%",
				objectFit: "contain"
			}) : /* @__PURE__ */ k(O, {
				color: "fg.muted",
				textStyle: "body/S/regular",
				children: r
			})
		})]
	});
}, ee = (e) => {
	let { filePath: t, onShowFullDiff: n } = e;
	return /* @__PURE__ */ k(x, {
		p: "md",
		borderTop: "1px solid",
		borderColor: "border.subtle",
		bg: "bg",
		children: /* @__PURE__ */ k(o, {
			title: "Large diffs are hidden by default",
			paddingY: "sm",
			children: n ? /* @__PURE__ */ k(S, {
				size: "xs",
				variant: "outline",
				"aria-label": `Render full diff for ${t}`,
				onClick: n,
				children: "Show full diff"
			}) : null
		})
	});
}, te = (e) => {
	let { isImage: t } = e;
	return /* @__PURE__ */ k(x, {
		p: "md",
		borderTop: "1px solid",
		borderColor: "border.subtle",
		bg: "bg",
		children: /* @__PURE__ */ k(o, {
			title: t ? "Image diffs are not shown" : "Binary diffs are not shown",
			paddingY: "sm"
		})
	});
}, ne = (e) => {
	let { title: t, actionLabel: n, isLoadingDiff: r, onAction: i } = e;
	return /* @__PURE__ */ k(x, {
		bg: "bg",
		p: "md",
		borderTop: "1px solid",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ k(o, {
			title: t,
			paddingY: "sm",
			children: n ? /* @__PURE__ */ k(S, {
				size: "xs",
				variant: "outline",
				loading: r,
				onClick: i,
				children: n
			}) : null
		})
	});
}, re = [
	"first",
	"second",
	"third"
], ie = () => /* @__PURE__ */ k(D, {
	h: "280px",
	bg: "bg",
	borderTop: "1px solid",
	borderColor: "border.subtle",
	p: "xs",
	gap: "2xs",
	role: "status",
	"aria-busy": "true",
	"aria-label": "Loading diff",
	children: re.map((e) => /* @__PURE__ */ k(E, {
		h: "20px",
		w: "full",
		borderRadius: "xs"
	}, e))
}), ae = (e) => {
	let { isLargeDiff: t, isGeneratedDiff: n, loadError: r, canLoadDiff: i, onLoadDiff: a, onShowFullDiff: o } = e, s = "Diff content is not loaded yet.", c = i ? "Load diff" : void 0, l = i ? () => void a() : void 0;
	return t && (s = "Large diffs are hidden by default", c = i ? "Show full diff" : void 0, l = () => {
		o?.(), a();
	}), n && (s = "Generated diffs are hidden by default", c = i ? "Load diff" : void 0, l = i ? () => void a() : void 0), r && (s = "Diff failed to load. Try again.", c = i ? "Load diff" : void 0, l = i ? () => void a() : void 0), {
		title: s,
		actionLabel: c,
		onAction: l
	};
}, I = (e) => {
	let { diff: t, filePath: n, oldContent: r, newContent: i, isExpanded: a, isLargeDiff: o, isGeneratedDiff: s, isBinaryDiff: c, hasDiffContent: l, canLoadDiff: u, shouldAutoLoadDiff: d, loadError: f, isLoadingDiff: p, onLoadDiff: m, hasOptedIntoLargeDiff: h, onShowFullDiff: g, diffViewMode: _ = "unified" } = e;
	if (!a) return null;
	if (c) return /* @__PURE__ */ k(N, {
		diff: t,
		filePath: n,
		oldContent: r,
		newContent: i,
		isLargeDiff: !1,
		hasOptedIntoLargeDiff: h,
		onShowFullDiff: g,
		diffViewMode: _
	});
	if (!l && !d) {
		let { title: e, actionLabel: t, onAction: n } = ae({
			isLargeDiff: o,
			isGeneratedDiff: s,
			loadError: f,
			canLoadDiff: u,
			onLoadDiff: m,
			onShowFullDiff: g
		});
		return /* @__PURE__ */ k(ne, {
			title: e,
			actionLabel: t,
			isLoadingDiff: p,
			onAction: n
		});
	}
	return d ? /* @__PURE__ */ k(ie, {}) : /* @__PURE__ */ k(N, {
		diff: t,
		filePath: n,
		oldContent: r,
		newContent: i,
		isLargeDiff: o,
		hasOptedIntoLargeDiff: h,
		onShowFullDiff: g,
		diffViewMode: _
	});
}, L = (e) => {
	let { isExpanded: t, isSelected: n, hasDiffContent: r, isLargeDiff: i, isGeneratedDiff: a, isBinaryDiff: o, requestedPath: s, filePath: c } = e;
	return t && n && !r && !i && !a && !o && s !== c;
}, R = (e) => {
	let { requestedPath: t, filePath: n, hasDiffContent: r } = e;
	return t === n && r ? null : t;
}, z = (e) => !u(e), B = (e) => e.newPath || e.oldPath || "unknown", V = (e) => {
	let { filePath: t, isExpanded: n, isSelected: r, hasDiffContent: i, isLargeDiff: a, isGeneratedDiff: o, isBinaryDiff: s, onLoadDiff: c } = e, [l, u] = b(!1), [d, f] = b(null), [p, m] = b(!1), h = async () => {
		if (c && !l) {
			f(t), m(!1), u(!0);
			try {
				await c(t);
			} catch {
				f(null), m(!0);
			} finally {
				u(!1);
			}
		}
	}, g = L({
		isExpanded: n,
		isSelected: r,
		hasDiffContent: i,
		isLargeDiff: a,
		isGeneratedDiff: o,
		isBinaryDiff: s,
		requestedPath: d,
		filePath: t
	});
	return _(() => {
		f((e) => R({
			requestedPath: e,
			filePath: t,
			hasDiffContent: i
		}));
	}, [t, i]), _(() => {
		c && g && !p && h();
	}), {
		isLoadingDiff: l,
		loadError: p,
		shouldAutoLoadDiff: !!c && g && !p,
		loadDiff: h
	};
}, H = (e) => {
	let { diff: t, isSelected: n = !1, isExpanded: r = !0, onToggleExpanded: i, onSelect: a, onLoadDiff: o, hasOptedIntoLargeDiff: s = !1, onShowFullDiff: c, diffViewMode: l = "unified" } = e, f = B(t), h = t.oldContent || "", g = t.newContent || "", _ = p(t), v = d(f), y = m(f) && !u(f), b = t.oldContent !== void 0 || t.newContent !== void 0, { isLoadingDiff: S, loadError: C, shouldAutoLoadDiff: w, loadDiff: T } = V({
		filePath: f,
		isExpanded: r,
		isSelected: n,
		hasDiffContent: b,
		isLargeDiff: _ && !s,
		isGeneratedDiff: v,
		isBinaryDiff: y,
		onLoadDiff: o
	});
	return /* @__PURE__ */ A(x, {
		"data-testid": "diff-card",
		border: "1px solid",
		borderColor: n ? "border.accent" : "border.subtle",
		borderRadius: "xs",
		overflow: "visible",
		bg: "bg",
		width: "100%",
		maxW: "100%",
		transition: "border-color 0.14s ease",
		_hover: { borderColor: "border.accent" },
		onClick: a,
		children: [/* @__PURE__ */ k(U, {
			diff: t,
			isExpanded: r,
			onToggleExpanded: i
		}), /* @__PURE__ */ k(I, {
			diff: t,
			filePath: f,
			oldContent: h,
			newContent: g,
			isExpanded: r,
			isLargeDiff: _,
			isGeneratedDiff: v,
			isBinaryDiff: y,
			hasDiffContent: b,
			canLoadDiff: !!o,
			shouldAutoLoadDiff: w,
			loadError: C,
			isLoadingDiff: S,
			onLoadDiff: T,
			hasOptedIntoLargeDiff: s,
			onShowFullDiff: c,
			diffViewMode: l
		})]
	});
}, U = (i) => {
	let { diff: o, isExpanded: s = !0, onToggleExpanded: c } = i, u = B(o), d = o.additions ?? 0, f = o.deletions ?? 0, p = z(u), [m, h] = b(!1), g = y(null);
	_(() => () => {
		g.current !== null && window.clearTimeout(g.current);
	}, []);
	let v = async () => {
		try {
			await navigator.clipboard.writeText(u), h(!0), g.current !== null && window.clearTimeout(g.current), g.current = window.setTimeout(() => h(!1), 1200);
		} catch {
			h(!1);
		}
	};
	return /* @__PURE__ */ A(C, {
		"data-testid": "diff-card-header",
		templateColumns: "auto minmax(0, 1fr) auto",
		px: "xs",
		py: "2xs",
		alignItems: "center",
		justifyContent: "space-between",
		borderBottom: s ? "1px solid" : "none",
		borderColor: "border.subtle",
		borderTopRadius: "xs",
		borderBottomRadius: s ? "0" : "xs",
		position: "sticky",
		top: "0",
		zIndex: "1",
		bg: "bg",
		cursor: "pointer",
		transition: "background 0.14s ease",
		_hover: { bg: "bg" },
		onClick: () => c?.(),
		gap: "sm",
		children: [
			/* @__PURE__ */ k(w, {
				"aria-label": s ? "Collapse" : "Expand",
				variant: "ghost",
				size: "2xs",
				onClick: (e) => {
					e.stopPropagation(), c?.();
				},
				flexShrink: 0,
				children: k(s ? t : n, { size: 16 })
			}),
			/* @__PURE__ */ A(C, {
				templateColumns: "minmax(0, max-content) auto",
				alignItems: "center",
				justifyContent: "start",
				gap: "2xs",
				minW: 0,
				children: [/* @__PURE__ */ A(x, {
					minW: 0,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
					title: u,
					children: [
						o.change === "renamed" && /* @__PURE__ */ A(O, {
							as: "span",
							textStyle: "sm",
							children: [
								/* @__PURE__ */ k(O, {
									as: "span",
									color: "fg.muted",
									textDecoration: "line-through",
									mr: "xs",
									children: o.oldPath
								}),
								/* @__PURE__ */ k(x, {
									as: "span",
									display: "inline-flex",
									alignItems: "center",
									verticalAlign: "middle",
									mr: "xs",
									children: /* @__PURE__ */ k(n, { size: 12 })
								}),
								o.newPath
							]
						}),
						o.change === "deleted" && /* @__PURE__ */ k(O, {
							as: "span",
							color: "fg.muted",
							textDecoration: "line-through",
							textStyle: "sm",
							children: u
						}),
						o.change !== "renamed" && o.change !== "deleted" && /* @__PURE__ */ k(O, {
							as: "span",
							textStyle: "sm",
							children: u
						})
					]
				}), /* @__PURE__ */ k(x, {
					opacity: m ? "1" : "0",
					pointerEvents: m ? "auto" : "none",
					transition: "opacity 120ms ease",
					css: { "[data-testid='diff-card-header']:hover &, [data-testid='diff-card-header']:focus-within &": {
						opacity: 1,
						pointerEvents: "auto"
					} },
					children: /* @__PURE__ */ k(a, {
						content: m ? "Copied" : "Copy file path",
						children: /* @__PURE__ */ k(w, {
							"aria-label": m ? "Copied" : "Copy file path",
							variant: "ghost",
							size: "2xs",
							onClick: (e) => {
								e.stopPropagation(), v();
							},
							flexShrink: 0,
							children: k(m ? e : r, { size: 12 })
						})
					})
				})]
			}),
			p ? /* @__PURE__ */ k(x, {
				flexShrink: 0,
				children: /* @__PURE__ */ k(l, {
					variant: "ghost",
					additions: d,
					deletions: f
				})
			}) : null
		]
	});
}, W = () => /* @__PURE__ */ k(D, {
	h: "full",
	minH: "0",
	gap: "0",
	bg: "bg",
	children: /* @__PURE__ */ k(i, {
		flex: "1",
		minH: "0",
		contentProps: {
			p: "xs",
			spaceY: "xs"
		},
		children: /* @__PURE__ */ k(o, {
			title: "No changes detected",
			description: "Make some changes to see the diff here.",
			paddingY: "sm"
		})
	})
}), G = 34, K = 18, q = 28, J = 8, Y = () => 130, oe = (e) => {
	let { diff: t, isCollapsed: n, hasOptedIntoLargeDiff: r = !1, diffViewMode: i = "unified" } = e;
	if (n) return 42;
	let a = t.oldContent !== void 0 || t.newContent !== void 0, o = t.newPath ?? t.oldPath ?? "";
	if (u(o) && (t.oldContent || t.newContent)) return 380;
	if (m(o) || !a || p(t) && !r) return Y();
	let { unifiedContentRows: s, splitContentRows: c, hunkRows: l } = h({
		original: t.oldContent ?? "",
		modified: t.newContent ?? "",
		oldPath: t.oldPath,
		newPath: t.newPath
	}), d = i === "split" ? c : s;
	return d === 0 && l === 0 ? Y() : G + (d * K + l * q) + J;
}, se = (e) => e.newPath ?? e.oldPath ?? "unknown", ce = 24, le = (e) => {
	let { diffs: t, selectedDiffPath: n, collapsedPaths: r, expansionCommand: i, completedScrollCommandId: a } = e, o = n, s = n ? `selected:${n}` : null, c = i?.action === "expand-selected" ? i.id : null, l = c !== null && a === c;
	i?.action === "expand-selected" && i.path && (o = i.path, s = `command:${i.id}:${i.path}`);
	let u = s;
	if (o && s) {
		let e = r.has(o) ? "collapsed" : "expanded";
		u = `${s}:${e}`;
	}
	let d = o ? t.findIndex((e) => se(e) === o) : -1, f = d >= 0 && i?.action === "expand-selected" && i.direction === "up" && !l;
	return {
		selectedScrollPath: o,
		selectedScrollKey: u,
		selectedScrollCommandId: c,
		selectedScrollIndex: d,
		shouldPinSelectedScrollIndex: f,
		hasCompletedSelectedScroll: l
	};
}, ue = (e) => {
	let { indexes: t, selectedScrollIndex: n, shouldPinSelectedScrollIndex: r } = e;
	if (!r || t.includes(n)) return t;
	let i = Math.max(0, n - ce), a = Array.from({ length: n - i + 1 }, (e, t) => i + t);
	return Array.from(/* @__PURE__ */ new Set([...t, ...a])).sort((e, t) => e - t);
}, de = 3, fe = 12, pe = (e) => e.newPath ?? e.oldPath ?? "unknown", me = (e) => {
	let { diffs: t, selectedDiffPath: n, collapsedPaths: r, expansionCommand: i, scrollRef: a, virtualizerRef: o, suppressScrollAdjustRef: s } = e, [c, l] = b(null), { selectedScrollPath: u, selectedScrollKey: d, selectedScrollCommandId: f, selectedScrollIndex: p, shouldPinSelectedScrollIndex: m, hasCompletedSelectedScroll: h } = le({
		diffs: t,
		selectedDiffPath: n,
		collapsedPaths: r,
		expansionCommand: i,
		completedScrollCommandId: c
	});
	return v(() => {
		if (!u || !d || h || r.has(u)) return;
		let e = t.findIndex((e) => pe(e) === u);
		if (e < 0) return;
		let n = o.current, i = a.current;
		if (!n || !i) return;
		let c = [], p = !1;
		s.current = !0;
		let m = () => {
			s.current = !1;
		}, g = () => {
			p = !0, m(), f !== null && l(f);
		}, _ = 0, v = () => {
			p || (n.scrollToIndex(e, { align: "start" }), _ += 1, _ >= de && f !== null ? (m(), l(f)) : _ < fe ? c.push(requestAnimationFrame(v)) : m());
		};
		return i.addEventListener("wheel", g, { passive: !0 }), i.addEventListener("touchmove", g, { passive: !0 }), v(), () => {
			m(), i.removeEventListener("wheel", g), i.removeEventListener("touchmove", g);
			for (let e of c) cancelAnimationFrame(e);
		};
	}, [
		d,
		u,
		f,
		h,
		t,
		r,
		a,
		o,
		s
	]), {
		selectedScrollIndex: p,
		shouldPinSelectedScrollIndex: m
	};
}, X = (e) => e.newPath ?? e.oldPath ?? "unknown", Z = 10, Q = 100, he = (e) => e.length <= Z ? /* @__PURE__ */ new Set() : new Set(e.filter((e, t) => {
	let n = (e.additions ?? 0) + (e.deletions ?? 0);
	return t >= Z || n > Q;
}).map((e) => X(e))), ge = (e) => new Set(e.map((e) => X(e))), _e = (e, t) => {
	let n = new Set(e);
	return n.has(t) ? n.delete(t) : n.add(t), n;
}, $ = (e, t, n) => {
	if (!n || !t.has(n) || !e.some((e) => X(e) === n)) return t;
	let r = new Set(t);
	return r.delete(n), r;
}, ve = (e, t, n, r) => {
	let i = $(e, t, n);
	if (!r || r === n || i.has(r) || !e.some((e) => X(e) === r)) return i;
	let a = i === t ? new Set(t) : i;
	return a.add(r), a;
};
function ye(e) {
	let { diffs: t, selectedDiffPath: n = null, onLoadDiff: r, onSelectDiffPath: a, onExpansionStateChange: o, expansionCommand: l = null, diffViewMode: u = "unified" } = e, d = y(null), f = y(null), p = y(null), m = y(!1), h = y(null), [g, S] = b(() => he(t)), [C, w] = b(() => /* @__PURE__ */ new Set()), { selectedScrollIndex: T, shouldPinSelectedScrollIndex: E } = me({
		diffs: t,
		selectedDiffPath: n,
		collapsedPaths: g,
		expansionCommand: l,
		scrollRef: d,
		virtualizerRef: p,
		suppressScrollAdjustRef: m
	}), { virtualizer: O, virtualItems: A, totalSize: j } = c({
		count: t.length,
		getScrollElement: () => d.current,
		estimateSize: (e) => {
			let n = t[e], r = X(n);
			return oe({
				diff: n,
				isCollapsed: g.has(r),
				hasOptedIntoLargeDiff: C.has(r),
				diffViewMode: u
			});
		},
		getItemKey: (e) => X(t[e]),
		overscan: 3,
		rangeExtractor: (e) => ue({
			indexes: s(e),
			selectedScrollIndex: T,
			shouldPinSelectedScrollIndex: E
		})
	});
	if (O.shouldAdjustScrollPositionOnItemSizeChange = (e, t, n) => !n.isScrolling && !m.current, p.current = O, v(() => {
		n && S((e) => $(t, e, n));
	}, [t, n]), v(() => {
		if (l) {
			if (l.action === "expand-selected") {
				let e = l.path;
				if (e) {
					let n = h.current;
					h.current = e, S((r) => ve(t, r, e, n));
				}
			} else h.current = null, S(l.action === "collapse" ? ge(t) : /* @__PURE__ */ new Set());
		}
	}, [t, l]), _(() => {
		let e = {
			allExpanded: g.size === 0,
			allCollapsed: t.length > 0 && t.every((e) => g.has(X(e)))
		}, n = f.current;
		(n?.allExpanded !== e.allExpanded || n.allCollapsed !== e.allCollapsed) && (f.current = e, o?.(e));
	}, [
		g,
		t,
		o
	]), t.length === 0) return /* @__PURE__ */ k(W, {});
	let M = (e) => {
		S((t) => _e(t, e));
	}, N = (e) => {
		w((t) => {
			let n = new Set(t);
			return n.add(e), n;
		});
	};
	return /* @__PURE__ */ k(D, {
		h: "full",
		minH: "0",
		gap: "0",
		bg: "bg",
		children: /* @__PURE__ */ k(x, {
			position: "relative",
			flex: "1",
			minH: "0",
			bg: "bg",
			children: /* @__PURE__ */ k(i, {
				position: "absolute",
				inset: "0",
				viewportRef: d,
				viewportProps: { style: { overflowAnchor: "none" } },
				contentProps: { p: "xs" },
				children: /* @__PURE__ */ k(x, {
					position: "relative",
					width: "100%",
					style: { height: j },
					children: A.map((e) => {
						let i = t[e.index], o = X(i);
						return /* @__PURE__ */ k(x, {
							"data-index": e.index,
							ref: O.measureElement,
							position: "absolute",
							left: "0",
							width: "100%",
							pb: "xs",
							style: { top: `${e.start}px` },
							children: /* @__PURE__ */ k(H, {
								diff: i,
								isSelected: n === o,
								isExpanded: !g.has(o),
								onToggleExpanded: () => M(o),
								onSelect: () => a?.(o),
								onLoadDiff: r,
								hasOptedIntoLargeDiff: C.has(o),
								onShowFullDiff: () => N(o),
								diffViewMode: u
							}, o)
						}, e.key);
					})
				})
			})
		})
	});
}
export { ye as DiffDrawer };
