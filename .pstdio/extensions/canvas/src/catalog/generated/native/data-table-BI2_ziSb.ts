// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { b as e, x as t, y as n } from "./lucide-react-DrMf1u5h.ts";
import { t as r } from "./check-Bgh538vW.ts";
import { t as i } from "./chevron-down-ZmPqsMG0.ts";
import { t as a } from "./chevron-right-CRFNEcZT.ts";
import { t as o } from "./chevrons-up-down-DlTkvZ9f.ts";
import { t as s } from "./circle-question-mark-Ck8Da90Q.ts";
import { r as c } from "./lock-CwbRk9bz.ts";
import { t as l } from "./list-filter-BPOkFpgD.ts";
import { t as u } from "./minus-BdT0RA0-.ts";
import { C as d, E as f, S as p, T as m, _ as h, a as g, b as _, c as ee, d as v, f as te, g as y, h as b, i as x, l as ne, m as re, p as S, u as ie, v as ae, w as oe, x as C, y as w } from "./data-table-state-BSAfS2dI.ts";
import { t as se } from "./scroll-area-I7hjn89T.ts";
import { t as T } from "./tooltip-BweQW627.ts";
import { i as ce } from "./collection-view-fields-D15M65ck.ts";
import { t as E } from "./checkbox-C3JJ0TWQ.ts";
import { c as le, t as D } from "./list-row-BhxGCvIh.ts";
import { a as ue, i as de, n as fe, o as pe, t as me } from "./edit-mode-data-table-CsRA94e-.ts";
import { t as O } from "./highlighted-text-CaWxQuWj.ts";
import { t as he } from "./diff-bubble-CWPQbWDR.ts";
import { t as ge } from "./display-sort-control-DHtzd27a.ts";
/* empty css                    */
import { t as _e } from "./collection-view-empty-state-BI6CP-yJ.ts";
import { t as ve } from "./data-table-display-menu-lznmGjkk.ts";
import * as k from "react";
import { Fragment as ye, Suspense as be, cloneElement as A, isValidElement as j, lazy as xe, useState as M } from "react";
import { Badge as N, Box as P, Button as F, Flex as I, HStack as Se, Icon as L, IconButton as R, Image as z, Menu as B, Popover as V, Portal as H, Table as U, Text as W, chakra as G } from "@chakra-ui/react";
import { jsx as K, jsxs as q } from "react/jsx-runtime";
// node_modules/.bun/@tanstack+react-table@8.21.3+bf16f8eded5e12ee/node_modules/@tanstack/react-table/build/lib/index.mjs
function Ce(e, t) {
	return e ? we(e) ? /*#__PURE__*/ k.createElement(e, t) : e : null;
}
function we(e) {
	return Te(e) || typeof e == "function" || Ee(e);
}
function Te(e) {
	return typeof e == "function" && (() => {
		let t = Object.getPrototypeOf(e);
		return t.prototype && t.prototype.isReactComponent;
	})();
}
function Ee(e) {
	return typeof e == "object" && typeof e.$$typeof == "symbol" && ["react.memo", "react.forward_ref"].includes(e.$$typeof.description);
}
function De(e) {
	let t = {
		state: {},
		onStateChange: () => {},
		renderFallbackValue: null,
		...e
	}, [n] = k.useState(() => ({ current: h(t) })), [r, i] = k.useState(() => n.current.initialState);
	return n.current.setOptions((t) => ({
		...t,
		...e,
		state: {
			...r,
			...e.state
		},
		onStateChange: (t) => {
			i(t), e.onStateChange == null || e.onStateChange(t);
		}
	})), n.current;
}
// packages/ui/src/components/data-table/categorical-color-cell.tsx
var Oe = (e, t) => t.find((t) => Object.is(t.value, e))?.color ?? null, ke = (e) => {
	let { children: t } = e;
	return t;
}, Ae = "#111827", je = "#ffffff", Me = "#000000", Ne = 4.5, Pe = (e) => e.split("").map((e) => e + e).join(""), J = (e) => {
	let t = e.trim(), n = t.startsWith("#") ? t.slice(1) : t, r = n.length === 3 ? Pe(n) : n;
	return /^[\da-f]{6}$/i.test(r) ? {
		r: Number.parseInt(r.slice(0, 2), 16),
		g: Number.parseInt(r.slice(2, 4), 16),
		b: Number.parseInt(r.slice(4, 6), 16)
	} : null;
}, Fe = (e) => {
	let t = e / 255;
	return t <= .03928 ? t / 12.92 : ((t + .055) / 1.055) ** 2.4;
}, Ie = (e) => .2126 * Fe(e.r) + .7152 * Fe(e.g) + .0722 * Fe(e.b), Le = (e, t) => {
	let n = Ie(e), r = Ie(t), i = Math.max(n, r), a = Math.min(n, r);
	return (i + .05) / (a + .05);
}, Re = (e) => {
	let t = (e) => Math.round(e).toString(16).padStart(2, "0");
	return `#${t(e.r)}${t(e.g)}${t(e.b)}`;
}, ze = (e, t, n) => ({
	r: e.r * (1 - n) + t.r * n,
	g: e.g * (1 - n) + t.g * n,
	b: e.b * (1 - n) + t.b * n
}), Be = (e, t) => {
	for (let n = 1; n <= 50; n += 1) {
		let r = ze(e, t, n / 50);
		if (Le(r, e) >= Ne) return {
			color: Re(r),
			step: n
		};
	}
	return {
		color: Re(t),
		step: 50
	};
}, Ve = (e) => {
	let t = J(e);
	if (!t) return Ae;
	let n = J(Me), r = J(je), i = Be(t, n), a = Be(t, r);
	return i.step <= a.step ? i.color : a.color;
}, He = (e, t, n) => {
	let r = J(e), i = J(t);
	return !r || !i ? null : Re(ze(r, i, 1 - n));
}, Ue = (e) => {
	let t = e.foreground?.light ?? Ve(e.light), n = e.foreground?.dark ?? Ve(e.dark);
	return {
		backgroundColor: `light-dark(${e.light}, ${e.dark})`,
		color: `light-dark(${t}, ${n})`
	};
}, We = (e) => Math.round(e * 100) / 100, Y = (e, t, n) => He(e, t, n) || `color-mix(in srgb, ${e} ${We(n * 100)}%, ${t})`, Ge = (e, t, n) => {
	let r = e.foreground && t.foreground ? {
		light: Y(e.foreground.light, t.foreground.light, n),
		dark: Y(e.foreground.dark, t.foreground.dark, n)
	} : void 0;
	return {
		light: Y(e.light, t.light, n),
		dark: Y(e.dark, t.dark, n),
		...r ? { foreground: r } : {}
	};
}, Ke = (e, t) => {
	if (typeof e != "number" || !Number.isFinite(e) || t.length < 2) return null;
	let n = t[0], r = t[t.length - 1];
	if (r.value - n.value <= 0) return null;
	if (e <= n.value) return n.color;
	if (e >= r.value) return r.color;
	let i = t.findIndex((t) => e <= t.value), a = t[i - 1], o = t[i], s = 1 - (e - a.value) / (o.value - a.value);
	return Ge(a.color, o.color, s);
}, qe = (e) => {
	let { value: t, search: n = "" } = e;
	return /* @__PURE__ */ K(W, {
		textStyle: "paragraph/S/medium",
		fontVariantNumeric: "tabular-nums",
		truncate: !0,
		children: /* @__PURE__ */ K(O, {
			text: String(t),
			query: n
		})
	});
}, Je = (e) => {
	let { value: t, categories: n, search: r = "" } = e, i = n?.find((e) => e.value === t)?.palette ?? "gray";
	return /* @__PURE__ */ K(N, {
		variant: "subtle",
		size: "sm",
		colorPalette: i,
		maxW: "full",
		truncate: !0,
		children: /* @__PURE__ */ K(O, {
			text: String(t),
			query: r
		})
	});
}, Ye = (e) => {
	let { value: t, search: n = "" } = e;
	return /* @__PURE__ */ K(he, {
		additions: t.additions,
		deletions: t.deletions,
		variant: "ghost",
		size: "small",
		additionsLabel: /* @__PURE__ */ K(O, {
			text: `+${t.additions}`,
			query: n
		}),
		deletionsLabel: /* @__PURE__ */ K(O, {
			text: `-${t.deletions}`,
			query: n
		})
	});
}, Xe = (e) => {
	let { value: t, search: n = "" } = e, r = t.slice(0, -5), i = t.slice(-5);
	return /* @__PURE__ */ K(T, {
		content: t,
		children: /* @__PURE__ */ q(G.span, {
			display: "inline-flex",
			minW: "0",
			maxW: "full",
			tabIndex: 0,
			textStyle: "paragraph/S/regular",
			whiteSpace: "nowrap",
			children: [/* @__PURE__ */ K(G.span, {
				overflow: "hidden",
				textOverflow: "ellipsis",
				children: /* @__PURE__ */ K(O, {
					text: r,
					query: n
				})
			}), /* @__PURE__ */ K(G.span, {
				flexShrink: 0,
				children: /* @__PURE__ */ K(O, {
					text: i,
					query: n
				})
			})]
		})
	});
}, Ze = (e) => e.stopPropagation(), Qe = (e) => {
	let { columnLabel: t, value: r, search: i = "" } = e, o = _(r).flatMap((e) => d(e.value, e.label) ? [e] : !Array.isArray(e.value) || !p(e.value, e.label) ? [] : e.value.map((t, n) => ({
		label: `${e.label} ${n + 1}`,
		value: t
	}))).slice(0, 2), s = C(r);
	return /* @__PURE__ */ q(V.Root, {
		positioning: {
			placement: "bottom-start",
			offset: { mainAxis: 6 }
		},
		children: [/* @__PURE__ */ K(V.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ q(F, {
				"aria-label": `View ${t} details`,
				variant: "ghost",
				size: "xs",
				width: "full",
				minWidth: "0",
				height: "28px",
				paddingX: "2xs",
				justifyContent: "flex-start",
				onClick: Ze,
				children: [
					o.length > 0 ? /* @__PURE__ */ K(Se, {
						gap: "-1",
						flexShrink: "0",
						children: o.map((e) => /* @__PURE__ */ K(z, {
							src: String(e.value),
							alt: `${e.label} preview`,
							boxSize: "22px",
							borderRadius: "xs",
							borderWidth: "1px",
							borderColor: "border.subtle",
							objectFit: "cover"
						}, e.label))
					}) : /* @__PURE__ */ K(n, { size: 14 }),
					/* @__PURE__ */ K(W, {
						flex: "1",
						minWidth: "0",
						textAlign: "left",
						textStyle: "paragraph/S/regular",
						truncate: !0,
						children: /* @__PURE__ */ K(O, {
							text: s,
							query: i
						})
					}),
					/* @__PURE__ */ K(a, { size: 12 })
				]
			})
		}), /* @__PURE__ */ K(H, { children: /* @__PURE__ */ K(V.Positioner, { children: /* @__PURE__ */ K(V.Content, {
			width: "min(380px, calc(100vw - 32px))",
			padding: "0",
			background: "bg",
			overflow: "hidden",
			children: /* @__PURE__ */ K(se, {
				maxH: "360px",
				viewportProps: { overscrollBehavior: "contain" },
				children: /* @__PURE__ */ K(w, { value: r })
			})
		}) }) })]
	});
}, $e = (e) => j(e) ? A(e, { style: {
	...e.props.style,
	flexWrap: "nowrap",
	minWidth: 0,
	whiteSpace: "nowrap"
} }) : e, X = (e) => {
	e.stopPropagation();
}, et = (e) => {
	let { table: t } = e, n = t.getIsAllRowsSelected(), i = !n && t.getIsSomeRowsSelected();
	return /* @__PURE__ */ K(E, {
		checked: i ? "indeterminate" : n,
		"aria-label": "Select all",
		icon: /* @__PURE__ */ K(L, {
			as: i ? u : r,
			boxSize: "12px",
			strokeWidth: "3"
		}),
		onClick: X,
		onCheckedChange: (e) => t.toggleAllRowsSelected(e.checked === !0)
	});
}, tt = (e) => {
	let { row: t, column: n } = e, { selectedRowIds: i } = n.columnDef.meta;
	return /* @__PURE__ */ K(E, {
		checked: !!i?.[t.id],
		"aria-label": "Select row",
		icon: /* @__PURE__ */ K(L, {
			as: r,
			boxSize: "12px",
			strokeWidth: "3"
		}),
		onClick: X,
		onCheckedChange: (e) => t.toggleSelected(e.checked === !0)
	});
}, nt = (e, t) => {
	let n = new Set(t.map((e) => e.label));
	return [...t, ...e.filter((e) => !n.has(e.label))];
}, rt = (e) => {
	let { row: t, column: n } = e, { rowActions: r = [], getRowActions: a } = n.columnDef.meta, o = nt(r, a?.(t.original) ?? []);
	return o.length === 0 ? null : /* @__PURE__ */ q(B.Root, { children: [/* @__PURE__ */ K(B.Trigger, {
		asChild: !0,
		children: /* @__PURE__ */ K(R, {
			"aria-label": "Row actions",
			size: "2xs",
			variant: "ghost",
			onClick: X,
			children: /* @__PURE__ */ K(L, {
				as: i,
				boxSize: "14px"
			})
		})
	}), /* @__PURE__ */ K(H, { children: /* @__PURE__ */ K(B.Positioner, { children: /* @__PURE__ */ K(B.Content, {
		zIndex: "popover",
		bg: "bg",
		children: o.map((e) => /* @__PURE__ */ K(B.Item, {
			value: e.label,
			asChild: !0,
			children: /* @__PURE__ */ K(D, {
				asChild: !0,
				variant: "full-width",
				tone: e.destructive ? "danger" : "default",
				label: e.label,
				icon: e.icon,
				onClick: X,
				onActivate: () => e.onSelect(t.original)
			})
		}, e.label))
	}) }) })] });
}, Z = (e) => {
	let { content: t, query: n } = e;
	return typeof t == "string" || typeof t == "number" ? /* @__PURE__ */ K(O, {
		text: String(t),
		query: n
	}) : Array.isArray(t) ? t.map((e, t) => /* @__PURE__ */ K(Z, {
		content: e,
		query: n
	}, t)) : j(t) && t.props.children !== void 0 ? A(t, { children: /* @__PURE__ */ K(Z, {
		content: t.props.children,
		query: n
	}) }) : t;
}, it = (e) => {
	let { value: t, wrapRows: n, search: r = "" } = e, i = re(t);
	return j(i) ? /* @__PURE__ */ K(G.span, {
		display: "inline-flex",
		maxWidth: "full",
		minW: "0",
		overflow: n ? "visible" : "hidden",
		overflowWrap: n ? "anywhere" : void 0,
		whiteSpace: n ? "normal" : "nowrap",
		children: /* @__PURE__ */ K(Z, {
			content: n ? i : $e(i),
			query: r
		})
	}) : /* @__PURE__ */ K(W, {
		maxWidth: "full",
		overflow: n ? "visible" : "hidden",
		overflowWrap: n ? "anywhere" : void 0,
		textOverflow: n ? void 0 : "ellipsis",
		textStyle: "paragraph/S/regular",
		whiteSpace: n ? "normal" : "nowrap",
		children: /* @__PURE__ */ K(Z, {
			content: i,
			query: r
		})
	});
}, at = (e) => {
	let { columnLabel: t, renderer: n, value: r, wrapRows: i, search: a } = e;
	return n?.type === "json" ? /* @__PURE__ */ K(Qe, {
		columnLabel: t,
		value: r,
		search: a
	}) : n?.type === "badge" && [
		"string",
		"number",
		"boolean"
	].includes(typeof r) ? /* @__PURE__ */ K(Je, {
		value: r,
		search: a,
		categories: n.categories
	}) : n?.type === "diff" && f(r) ? /* @__PURE__ */ K(Ye, {
		value: r,
		search: a
	}) : n?.type === "path" && typeof r == "string" && !i ? /* @__PURE__ */ K(Xe, {
		value: r,
		search: a
	}) : n?.type === "date" && m(r) ? /* @__PURE__ */ K(oe, {
		value: r,
		search: a
	}) : n?.type === "color-scale" && Ke(r, n.stops) && typeof r == "number" ? /* @__PURE__ */ K(qe, {
		value: r,
		search: a
	}) : n?.type === "categorical-color" && Oe(r, n.categories) ? /* @__PURE__ */ K(ke, { children: /* @__PURE__ */ K(it, {
		value: r,
		wrapRows: i,
		search: a
	}) }) : /* @__PURE__ */ K(it, {
		value: r,
		wrapRows: i,
		search: a
	});
}, ot = (e) => {
	let { getValue: t } = e;
	return /* @__PURE__ */ K(G.span, {
		display: "block",
		textStyle: "paragraph/S/regular",
		textAlign: "center",
		children: t()
	});
}, st = (e) => {
	let { column: t, getValue: n } = e, { renderer: r, wrapRows: i = !1, search: a } = t.columnDef.meta;
	return /* @__PURE__ */ K(at, {
		columnLabel: t.id,
		renderer: r,
		value: n(),
		wrapRows: i,
		search: a
	});
}, ct = (e) => {
	let { column: t } = e, { headerLabel: n, headerIcon: r, columnDescription: i } = t.columnDef.meta;
	return /* @__PURE__ */ q(G.span, {
		display: "inline-flex",
		alignItems: "center",
		gap: "4px",
		minW: "0",
		maxW: "full",
		overflow: "hidden",
		children: [
			r,
			/* @__PURE__ */ K(G.span, {
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap",
				children: n
			}),
			i ? /* @__PURE__ */ K(T, {
				content: i,
				children: /* @__PURE__ */ K(L, {
					as: s,
					"aria-label": `About ${n}`,
					boxSize: "12px",
					color: "fg.muted",
					cursor: "help",
					flexShrink: 0,
					opacity: .6,
					tabIndex: 0
				})
			}) : null
		]
	});
}, lt = (e, t) => {
	if (t?.type === "color-scale") {
		let n = Ke(e, t.stops);
		if (n && typeof e == "number") return Ue(n);
	}
	if (t?.type === "categorical-color") {
		let n = Oe(e, t.categories);
		if (n) return Ue(n);
	}
};
function ut(e, t, n = {}) {
	let { columnIcons: r, columnDescriptions: i, compactHeaders: a, enableSelection: o = !1, selectedRowIds: s, rowActions: c = [], getRowActions: l, columnRenderers: u, wrapRows: d = !1, rowNumbers: f = !0, search: p } = n, m = S.accessor((e, t) => t + 1 + (n.rowOffset ?? 0), {
		header: "",
		id: "rowIndex",
		enableResizing: !1,
		size: 20,
		cell: ot
	}), h = S.display({
		id: "rowSelection",
		header: et,
		cell: tt,
		meta: { selectedRowIds: s },
		enableResizing: !1,
		enableSorting: !1,
		size: 36
	}), g = t.map((t) => {
		let n = t || "-", o = e.map((e) => e[n]), s = u?.[n], c = r?.[n], l = c === void 0 ? b(o) : c, f = i?.[n];
		return S.accessor((e) => e[n], {
			id: n,
			header: ct,
			cell: st,
			meta: {
				headerLabel: a?.[n] ?? n,
				headerIcon: l,
				columnDescription: f,
				renderer: s,
				wrapRows: d,
				search: p,
				getCellStyle: (e) => lt(e, s)
			},
			enableSorting: !1
		});
	}), _ = S.display({
		id: "rowActions",
		header: "",
		cell: rt,
		meta: {
			rowActions: c,
			getRowActions: l
		},
		enableResizing: !1,
		enableSorting: !1,
		size: 36
	});
	return [
		...f ? [m] : [],
		...o ? [h] : [],
		...g,
		...c.length > 0 || l ? [_] : []
	];
}
// packages/ui/src/components/data-table/data-table-group-row.tsx
var dt = (e) => {
	let { label: t, count: n, collapsed: r, columnCount: o, onToggle: s } = e;
	return /* @__PURE__ */ K(U.Row, {
		"data-testid": "data-table-group-row",
		bg: "bg.subtle",
		borderBottom: "1px solid",
		borderColor: "border.subtle",
		children: /* @__PURE__ */ K(U.Cell, {
			colSpan: o,
			paddingX: "xs",
			paddingY: "2xs",
			borderBottom: "none",
			children: /* @__PURE__ */ q(G.button, {
				type: "button",
				"aria-expanded": !r,
				display: "flex",
				alignItems: "center",
				gap: "xs",
				height: "1.5rem",
				onClick: s,
				children: [
					/* @__PURE__ */ K(L, {
						as: r ? a : i,
						boxSize: "0.875rem",
						color: "fg.muted"
					}),
					/* @__PURE__ */ K(W, {
						as: "span",
						textStyle: "label/S/medium",
						children: t
					}),
					/* @__PURE__ */ K(W, {
						as: "span",
						textStyle: "label/XS",
						color: "fg.muted",
						children: n
					})
				]
			})
		})
	});
}, ft = xe(() => import("./data-table-stat-chart-content-mzxbv49u.ts").then((e) => ({ default: e.DataTableStatChart }))), pt = (e) => {
	let { height: t, ariaLabel: n } = e;
	return /* @__PURE__ */ K(P, {
		height: t,
		width: "full",
		minWidth: "0",
		"aria-label": n,
		children: /* @__PURE__ */ K(be, {
			fallback: null,
			children: /* @__PURE__ */ K(ft, { ...e })
		})
	});
}, mt = (e) => y(e) ? e.sortValue : e, ht = (e, t) => e.map((e) => mt(e[t])).filter((e) => e != null && e !== ""), gt = (e, t) => new Set(ht(e, t)).size, _t = (e, t, n) => {
	let r = ht(e, t), i = /* @__PURE__ */ new Map();
	for (let e of r) i.set(e, (i.get(e) ?? 0) + 1);
	let a = [...i.entries()].map(([e, t]) => ({
		label: String(e),
		count: t,
		percentage: Math.round(t / r.length * 100)
	})).sort((e, t) => t.count - e.count || e.label.localeCompare(t.label)), o = a.slice(0, n), s = a.slice(n).reduce((e, t) => e + t.count, 0);
	return s === 0 ? o : [...o, {
		label: "Other",
		count: s,
		percentage: Math.round(s / r.length * 100)
	}];
}, vt = (e, t, n) => {
	let r = ht(e, t).filter((e) => typeof e == "number");
	if (r.length === 0) return null;
	let i = Math.min(...r), a = Math.max(...r), o = (a - i) / n, s = Array.from({ length: n }, (e, t) => ({
		start: i + o * t,
		end: i + o * (t + 1),
		count: 0
	}));
	for (let e of r) {
		let t = e === a || o === 0 ? n - 1 : Math.floor((e - i) / o);
		s[t].count += 1;
	}
	return {
		min: i,
		max: a,
		bins: s
	};
}, Q = new Intl.NumberFormat(void 0, { maximumFractionDigits: 2 }).format, yt = "vis.categorical.1", bt = (e) => {
	let { value: t, count: n } = e;
	return /* @__PURE__ */ q(I, {
		"data-single-value-stat": !0,
		direction: "column",
		gap: "2xs",
		alignItems: "flex-start",
		minWidth: "0",
		children: [/* @__PURE__ */ K(W, {
			textStyle: "label/L/medium",
			lineHeight: "1",
			maxWidth: "100%",
			truncate: !0,
			children: t
		}), /* @__PURE__ */ q(W, {
			textStyle: "label/XS",
			color: "fg.muted",
			children: [
				Q(n),
				" ",
				n === 1 ? "value" : "values"
			]
		})]
	});
}, xt = (e) => {
	let { rows: t, columnId: n } = e, r = e.summary?.count ?? gt(t, n);
	return /* @__PURE__ */ q(I, {
		direction: "column",
		gap: "2xs",
		alignItems: "flex-start",
		children: [/* @__PURE__ */ K(W, {
			textStyle: "label/L/medium",
			lineHeight: "1",
			children: Q(r)
		}), /* @__PURE__ */ K(W, {
			textStyle: "label/XS/regular",
			color: "fg.muted",
			children: "unique values"
		})]
	});
}, St = (e) => {
	let { rows: t, columnId: n, binCount: r } = e, i = e.summary ? e.summary.histogram : vt(t, n, r);
	if (!i) return /* @__PURE__ */ K(W, {
		textStyle: "label/XS/regular",
		color: "fg.muted",
		children: "No numeric values"
	});
	let a = i.bins.reduce((e, t) => e + t.count, 0);
	return i.min === i.max ? /* @__PURE__ */ K(bt, {
		value: Q(i.min),
		count: a
	}) : /* @__PURE__ */ q(I, {
		direction: "column",
		width: "100%",
		gap: "2xs",
		children: [/* @__PURE__ */ K(pt, {
			data: i.bins,
			dataKey: "count",
			color: yt,
			height: "40px",
			ariaLabel: `Distribution for ${n}`,
			tooltipLabel: (e) => `${Q(e.start)} – ${Q(e.end)}`,
			tooltipValue: (e) => `${Q(Number(e))} values`,
			tooltipSeriesLabel: "Count"
		}), /* @__PURE__ */ q(I, {
			justifyContent: "space-between",
			gap: "xs",
			children: [/* @__PURE__ */ K(W, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				children: Q(i.min)
			}), /* @__PURE__ */ K(W, {
				textStyle: "label/XS/regular",
				color: "fg.muted",
				children: Q(i.max)
			})]
		})]
	});
}, Ct = (e) => {
	let { rows: t, columnId: n, limit: r } = e, i = e.summary?.values ?? _t(t, n, r);
	return i.length === 1 && i[0] ? /* @__PURE__ */ K(bt, {
		value: i[0].label,
		count: i[0].count
	}) : /* @__PURE__ */ K(I, {
		direction: "column",
		width: "100%",
		gap: "2xs",
		children: i.map((e) => /* @__PURE__ */ q(P, {
			position: "relative",
			height: "18px",
			children: [/* @__PURE__ */ K(pt, {
				data: [e],
				dataKey: "percentage",
				categoryKey: "label",
				color: yt,
				height: "18px",
				ariaLabel: `${e.label}: ${e.percentage}%`,
				layout: "vertical",
				domain: [0, 100],
				barSize: 18,
				tooltipLabel: (e) => `${e.label} · ${Q(e.count)} values`,
				tooltipValue: (e) => `${Q(Number(e))}%`,
				tooltipSeriesLabel: "Share"
			}), /* @__PURE__ */ q(I, {
				position: "absolute",
				inset: "0",
				paddingX: "2xs",
				justifyContent: "space-between",
				gap: "xs",
				pointerEvents: "none",
				children: [/* @__PURE__ */ K(W, {
					textStyle: "label/2XS",
					color: "fg.inverted",
					truncate: !0,
					children: e.label
				}), /* @__PURE__ */ q(W, {
					textStyle: "label/2XS/medium",
					color: "fg.muted",
					children: [e.percentage, "%"]
				})]
			})]
		}, e.label))
	});
}, wt = (e) => {
	let { rows: t, columnId: n, stat: r } = e;
	return r.type === "unique" ? /* @__PURE__ */ K(xt, {
		rows: t,
		columnId: n,
		summary: e.summary?.type === "unique" ? e.summary : void 0
	}) : r.type === "histogram" ? /* @__PURE__ */ K(St, {
		rows: t,
		columnId: n,
		binCount: r.bins ?? 10,
		summary: e.summary?.type === "histogram" ? e.summary : void 0
	}) : /* @__PURE__ */ K(Ct, {
		rows: t,
		columnId: n,
		limit: r.limit ?? 2,
		summary: e.summary?.type === "top-values" ? e.summary : void 0
	});
}, Tt = (e) => {
	let { header: t, headerGroup: n, rows: r, columnStats: i, fullWidth: a } = e, o = i[t.column.id];
	return /* @__PURE__ */ K(U.ColumnHeader, {
		"data-column-id": t.column.id,
		"data-stat-type": o?.type,
		borderRight: "1px solid",
		_last: { borderRight: "none" },
		borderColor: "border.subtle",
		padding: "xs",
		verticalAlign: "middle",
		overflow: "hidden",
		style: { width: a && n.headers.indexOf(t) === n.headers.length - 1 ? void 0 : `calc(var(--header-${t.id}-size) * 1px)` },
		children: o ? /* @__PURE__ */ K(wt, {
			rows: r,
			columnId: t.column.id,
			stat: o,
			summary: e.summaries?.[t.column.id]
		}) : null
	});
}, Et = (e) => {
	let { headerGroup: t, rows: n, columnStats: r, fullWidth: i, noBorder: a } = e;
	return t.headers.some((e) => r[e.column.id]) ? /* @__PURE__ */ K(U.Row, {
		className: "data-table-stats-row",
		borderRight: a ? "none" : "1px solid",
		borderColor: "border.subtle",
		children: t.headers.map((a) => /* @__PURE__ */ K(Tt, {
			header: a,
			headerGroup: t,
			rows: n,
			columnStats: r,
			summaries: e.summaries,
			fullWidth: i
		}, a.id))
	}) : null;
}, Dt = /* @__PURE__ */ new Set([
	"rowIndex",
	"rowSelection",
	"rowActions"
]), Ot = (n) => n === "asc" ? e : n === "desc" ? t : o, $ = (e) => /* @__PURE__ */ K(B.Item, {
	value: e.value,
	asChild: !0,
	children: /* @__PURE__ */ K(D, {
		asChild: !0,
		variant: "full-width",
		label: e.label,
		icon: /* @__PURE__ */ K(L, {
			as: e.icon,
			boxSize: "16px"
		}),
		onActivate: e.onActivate
	})
}), kt = (n) => {
	let { header: r, headerGroup: i, fullWidth: a, hasDescription: o, fieldMenu: s } = n, u = r.column.id, d = s?.sortFor(u), f = !!s && !Dt.has(u), p = u === "rowSelection" ? "Select all" : Ce(r.column.columnDef.header, r.getContext());
	return /* @__PURE__ */ K(U.ColumnHeader, {
		"data-column-id": u,
		textTransform: "none",
		borderRight: "1px solid",
		_last: { borderRight: "none" },
		borderColor: "border.subtle",
		paddingX: "xs",
		paddingY: "xs",
		overflow: "hidden",
		position: "relative",
		verticalAlign: "middle",
		whiteSpace: "nowrap",
		style: { width: a && i.headers.indexOf(r) === i.headers.length - 1 ? void 0 : `calc(var(--header-${r.id}-size) * 1px)` },
		children: /* @__PURE__ */ K(T, {
			content: p,
			disabled: o,
			children: /* @__PURE__ */ q(I, {
				className: "group",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "1",
				flex: "1",
				minW: "0",
				children: [
					/* @__PURE__ */ K(W, {
						as: "div",
						textStyle: "label/S/medium",
						lineHeight: "1.2",
						truncate: !0,
						children: Ce(r.column.columnDef.header, r.getContext())
					}),
					f && s ? /* @__PURE__ */ q(B.Root, { children: [/* @__PURE__ */ K(B.Trigger, {
						asChild: !0,
						children: /* @__PURE__ */ K(R, {
							ml: "2px",
							size: "2xs",
							minW: "auto",
							paddingX: "2xs",
							"aria-label": d ? `Sorted ${d}` : "Column options",
							variant: "ghost",
							color: d ? "fg" : "fg.subtle",
							children: /* @__PURE__ */ K(L, {
								as: Ot(d),
								boxSize: "14px"
							})
						})
					}), /* @__PURE__ */ K(H, { children: /* @__PURE__ */ K(B.Positioner, { children: /* @__PURE__ */ q(B.Content, {
						zIndex: "popover",
						bg: "bg",
						children: [
							/* @__PURE__ */ K($, {
								value: "sort-asc",
								label: "Sort ascending",
								icon: e,
								onActivate: () => s.onSort(u, "asc")
							}),
							/* @__PURE__ */ K($, {
								value: "sort-desc",
								label: "Sort descending",
								icon: t,
								onActivate: () => s.onSort(u, "desc")
							}),
							/* @__PURE__ */ K(B.Separator, {}),
							/* @__PURE__ */ K($, {
								value: "filter",
								label: "Filter by this field",
								icon: l,
								onActivate: () => s.onFilterBy(u)
							}),
							/* @__PURE__ */ K($, {
								value: "hide",
								label: "Hide column",
								icon: c,
								onActivate: () => s.onHide(u)
							})
						]
					}) }) })] }) : null,
					r.column.getCanResize() && /* @__PURE__ */ K("span", {
						onDoubleClick: () => r.column.resetSize(),
						onMouseDown: r.getResizeHandler(),
						onTouchStart: r.getResizeHandler(),
						className: `resizer ${r.column.getIsResizing() ? "isResizing" : ""}`
					})
				]
			})
		})
	}, r.id);
}, At = (e) => {
	let { cell: t, row: n, wrapRows: r, getCellContextMenuActions: i } = e, a = t.column.columnDef.meta?.getCellStyle?.(t.getValue()), o = {
		row: n.original,
		rowId: n.id,
		columnId: t.column.id,
		value: t.getValue()
	}, s = i?.(o).map((e) => ({
		key: e.label,
		label: e.label,
		icon: e.icon,
		onClick: () => e.onSelect(o)
	})) ?? [], c = /* @__PURE__ */ K(U.Cell, {
		"data-column-id": t.column.id,
		width: "fit-content",
		maxWidth: "12rem",
		overflow: "hidden",
		overflowWrap: r ? "anywhere" : void 0,
		padding: "xs",
		height: r ? void 0 : "10",
		maxHeight: r ? void 0 : "10",
		borderRight: "1px solid",
		borderColor: "border.subtle",
		_last: { borderRight: "none" },
		borderBottom: "none",
		textStyle: "paragraph/S/regular",
		textOverflow: r ? void 0 : "ellipsis",
		verticalAlign: r ? "top" : "middle",
		whiteSpace: r ? "normal" : "nowrap",
		style: a,
		children: Ce(t.column.columnDef.cell, t.getContext())
	}, t.id);
	return s.length === 0 ? c : /* @__PURE__ */ K(le, {
		actions: s,
		children: c
	}, t.id);
}, jt = (e) => {
	let { row: t, noBorder: n, rowIsInteractive: r, rowIsActive: i, rowIsSelected: a, wrapRows: o, onRowClick: s, getCellContextMenuActions: c } = e;
	return /* @__PURE__ */ K(U.Row, {
		"data-active": i ? "true" : void 0,
		"data-selected": a ? "true" : void 0,
		"aria-selected": a ? "true" : void 0,
		height: o ? void 0 : "10",
		cursor: r ? "pointer" : void 0,
		onClick: r ? () => s?.(t.original) : void 0,
		borderTop: n ? "none" : "1px solid",
		borderBottom: "1px solid",
		borderRight: n ? "none" : "1px solid",
		_last: {
			borderBottom: n ? "none" : "1px solid",
			borderColor: "border.subtle"
		},
		borderColor: "border.subtle",
		background: i ? "bg.active" : "bg",
		children: t.getVisibleCells().map((e) => /* @__PURE__ */ K(At, {
			cell: e,
			row: t,
			wrapRows: o,
			getCellContextMenuActions: c
		}, e.id))
	}, t.id);
}, Mt = (e) => {
	let t = {};
	for (let n of e.getFlatHeaders()) t[`--header-${n.id}-size`] = n.getSize(), t[`--col-${n.column.id}-size`] = n.column.getSize();
	return t;
}, Nt = (e) => {
	let { table: t, entries: n, collapsed: r, onToggleGroup: i, settings: a, data: o, fieldMenu: s, selectionActions: c } = e, { noBorder: l, fullWidth: u, onRowClick: d, isRowInteractive: f, activeRowId: p, columnDescriptions: m, columnStats: h } = e, { enableRowActivation: g = !1, getCellContextMenuActions: _ } = e, ee = new Map(t.getRowModel().rows.map((e) => [e.id, e])), te = Mt(t), y = t.getSelectedRowModel().rows, b = e.selectedRecords ?? x(y);
	return /* @__PURE__ */ q(P, {
		position: "relative",
		flex: "1",
		minHeight: "0",
		children: [/* @__PURE__ */ K(se, {
			height: "100%",
			maxWidth: "unset",
			showHorizontalScrollbar: !0,
			children: /* @__PURE__ */ q(U.Root, {
				className: `data-table${u ? " full-width" : ""}`,
				style: {
					...te,
					width: u ? "100%" : t.getTotalSize()
				},
				children: [/* @__PURE__ */ K(U.Header, { children: t.getHeaderGroups().map((n) => /* @__PURE__ */ q(ye, { children: [/* @__PURE__ */ K(U.Row, {
					className: "data-table-column-header-row",
					borderRight: l ? "none" : "1px solid",
					borderColor: "border.subtle",
					children: n.headers.map((e) => /* @__PURE__ */ K(kt, {
						header: e,
						headerGroup: n,
						table: t,
						fullWidth: u,
						hasDescription: !!m?.[e.column.id],
						fieldMenu: s
					}, e.id))
				}), h && a.showStats ? /* @__PURE__ */ K(Et, {
					headerGroup: n,
					rows: o,
					columnStats: h,
					summaries: e.page?.result?.statistics,
					noBorder: l,
					fullWidth: u
				}) : null] }, n.id)) }), /* @__PURE__ */ K(U.Body, { children: n.map((e) => {
					if (e.kind === "group") {
						let { key: n } = e.group;
						return /* @__PURE__ */ K(dt, {
							label: e.group.label,
							count: e.group.count ?? e.group.rows.length,
							collapsed: r.has(n),
							columnCount: t.getVisibleLeafColumns().length,
							onToggle: () => i(n)
						}, `group:${n}`);
					}
					let n = ee.get(e.row.id);
					return n ? /* @__PURE__ */ K(jt, {
						row: n,
						noBorder: l,
						rowIsInteractive: d ? f?.(n.original) ?? !0 : !1,
						rowIsActive: v({
							enableRowActivation: g,
							activeRowId: p,
							rowId: n.id
						}),
						rowIsSelected: n.getIsSelected(),
						wrapRows: a.wrapRows,
						onRowClick: d,
						getCellContextMenuActions: _
					}, n.id) : null;
				}) })]
			})
		}), c && b.length > 0 ? /* @__PURE__ */ K(de, {
			selectedCount: b.length,
			totalCount: b.length + o.length - y.length,
			onClearSelection: () => t.resetRowSelection(),
			onSelectAll: () => t.toggleAllRowsSelected(!0),
			actions: c,
			selectedRows: b
		}) : null]
	});
}, Pt = (e, t, n, r) => {
	let i = (e) => t.has(e.key) ? [] : e.rows, a = e.reduce((e, t) => e + i(t).length, 0), o = Math.max(1, Math.ceil(a / r)), s = Math.min(n, o - 1), c = s * r, l = c + r, u = [], d = 0;
	for (let t of e) {
		let e = i(t), n = d;
		if (d += e.length, e.length === 0 ? n >= c && n < l || n === a && s === o - 1 : d > c && n < l) {
			u.push({
				kind: "group",
				group: t
			});
			for (let t = Math.max(n, c); t < Math.min(d, l); t += 1) u.push({
				kind: "row",
				row: e[t - n]
			});
		}
	}
	return {
		entries: u,
		pageCount: o,
		page: s
	};
}, Ft = (e, t, n) => {
	let r = Math.max(1, Math.ceil(e.length / n)), i = Math.min(t, r - 1);
	return {
		entries: e.slice(i * n, (i + 1) * n).map((e) => ({
			kind: "row",
			row: e
		})),
		pageCount: r,
		page: i
	};
}, It = (e) => {
	let t = e.provider ? 0 : e.index, n = e.groups ? Pt(e.groups, e.collapsed, t, e.size) : Ft(e.rows, t, e.size);
	return e.provider ? {
		...n,
		page: e.index,
		pageCount: Math.max(1, Math.ceil((e.provider.filteredTotal ?? 0) / e.size))
	} : n;
}, Lt = (e, t, n) => new Set(n ?? (t.key === e ? t.groups : [])), Rt = (e, t, n) => {
	let r = /* @__PURE__ */ new Map();
	for (let [i, a] of Object.entries(t)) {
		let t = n.get(i) ?? e.get(i);
		a && t && r.set(i, t);
	}
	return r;
}, zt = (e) => {
	let { noBorder: t, fullWidth: n, onRowClick: r, isRowInteractive: i, activeRowId: a, columnIcons: o, columnDescriptions: s, compactHeaders: c, columnStats: l, columnRenderers: u, initialPageSize: d, pageSizeOptions: f = [
		10,
		20,
		30,
		50,
		100
	], rowActions: p = [], getRowActions: m, enableRowActivation: h = !1, getCellContextMenuActions: _ } = e, v = fe(e), { settings: y, setSettings: b, sorts: x, setSorts: re, filter: S, startRule: oe } = v, C = JSON.stringify([
		v.storageKey,
		S,
		x,
		y.grouping,
		v.deferredSearch
	]), [w, se] = M({
		key: C,
		index: 0
	}), T = w.key === C ? w.index : 0, E = e.page?.displayed ?? e.page?.request, le = E ? Math.floor(E.offset / E.limit) : T, D = e.page?.onPageChange ?? ((e) => se({
		key: C,
		index: e
	})), [de, me] = M(() => ee({ initialPageSize: d })), O = E?.limit ?? de, he = e.page?.onPageSizeChange ?? me, k = JSON.stringify([v.storageKey, y.grouping]), [ye, be] = M({
		key: k,
		groups: []
	}), A = Lt(k, ye, e.page?.request.collapsedGroups), [j, xe] = M({
		key: C,
		ids: {},
		rows: /* @__PURE__ */ new Map()
	}), N = j.key === C ? j.ids : {}, F = ie(e), Se = ne(e), { groups: L } = v, R = L ? L.flatMap((e) => e.rows) : v.shownRows, z = It({
		groups: L,
		rows: R,
		collapsed: A,
		index: le,
		size: O,
		provider: e.page?.result
	}), B = R.map((e) => e.sourceRow), V = new Map(R.map((e) => [e.sourceRow, e.id])), H = De({
		data: B,
		columns: ut(B, v.visibleColumnKeys, {
			columnIcons: o,
			columnDescriptions: s,
			compactHeaders: c,
			enableSelection: F,
			rowActions: p,
			getRowActions: m,
			selectedRowIds: N,
			columnRenderers: u,
			wrapRows: y.wrapRows,
			rowNumbers: y.rowNumbers,
			rowOffset: E?.offset,
			search: v.deferredSearch
		}),
		defaultColumn: {
			size: 150,
			minSize: 40,
			maxSize: 800
		},
		state: { rowSelection: N },
		getRowId: (e) => V.get(e) ?? "",
		columnResizeMode: "onChange",
		columnResizeDirection: "ltr",
		onRowSelectionChange: (e) => xe((t) => {
			let n = t.key === C ? t.ids : {}, r = typeof e == "function" ? e(n) : e;
			return {
				key: C,
				ids: r,
				rows: Rt(t.rows, r, new Map(R.map((e) => [e.id, e.sourceRow])))
			};
		}),
		getCoreRowModel: ae(),
		enableMultiRowSelection: F,
		enableRowSelection: F,
		autoResetAll: !1
	}), U = {
		sortFor: (e) => {
			let t = x[0];
			return t?.attributeId === e ? t.direction : void 0;
		},
		onSort: (e, t) => re([{
			attributeId: e,
			direction: t
		}]),
		onFilterBy: (e) => {
			let t = ce(v.attributes, e);
			t && oe(t);
		},
		onHide: (e) => b({ hiddenColumns: te(y.hiddenColumns, e, !1) })
	}, W = (e.page?.result?.total ?? v.rows.length) > 0 && v.shownRows.length === 0 && !!v.deferredSearch.trim();
	return /* @__PURE__ */ q(I, {
		"aria-busy": e.page?.loading,
		direction: "column",
		flex: "1",
		minH: "0",
		minW: "0",
		height: "100%",
		width: "100%",
		overflow: "hidden",
		children: [
			/* @__PURE__ */ K(pe, {
				itemLabel: e.itemLabel,
				view: v,
				viewsSource: e.viewsSource,
				actions: e.toolbarActions,
				displayControl: /* @__PURE__ */ K(ve, {
					columns: v.attributes,
					sortControl: /* @__PURE__ */ K(ge, {
						fields: v.attributes,
						sorts: x,
						onSortsChange: re
					}),
					settings: y,
					statsAvailable: !!l,
					onSettingsChange: b,
					onColumnVisibilityChange: (e, t) => b({ hiddenColumns: te(y.hiddenColumns, e, t) }),
					onColumnReorder: (e, t) => b({ columnOrder: g(v.orderedColumnKeys, e, t) })
				})
			}),
			e.contentPlaceholder != null || W ? /* @__PURE__ */ K(P, {
				flex: "1",
				minH: "0",
				overflow: "auto",
				children: e.contentPlaceholder ?? /* @__PURE__ */ K(_e, {
					search: v.deferredSearch,
					onClearSearch: () => v.setSearch("")
				})
			}) : /* @__PURE__ */ K(Nt, {
				page: e.page,
				selectedRecords: e.page ? [...Rt(j.rows, N, new Map(R.map((e) => [e.id, e.sourceRow]))).values()] : void 0,
				table: H,
				entries: z.entries,
				collapsed: A,
				onToggleGroup: (t) => {
					let n = new Set(A);
					n.has(t) ? n.delete(t) : n.add(t), e.page ? e.page.onCollapsedGroupsChange([...n]) : be({
						key: k,
						groups: [...n]
					});
				},
				settings: y,
				data: B,
				fieldMenu: U,
				selectionActions: F ? Se : void 0,
				noBorder: t,
				fullWidth: n,
				onRowClick: r,
				isRowInteractive: i,
				activeRowId: a,
				columnDescriptions: s,
				columnStats: l,
				enableRowActivation: h,
				getCellContextMenuActions: _
			}),
			z.pageCount > 1 ? /* @__PURE__ */ K(ue, {
				pageCount: z.pageCount,
				navigationIndex: e.page ? Math.floor(e.page.request.offset / e.page.request.limit) : void 0,
				loading: e.page?.loading,
				pageIndex: z.page,
				pageSize: O,
				pageSizeOptions: f,
				onPageChange: D,
				onPageSizeChange: (e) => {
					he(e), D(0);
				}
			}) : null
		]
	});
}, Bt = (e) => e.editMode ? /* @__PURE__ */ K(me, { ...e }) : /* @__PURE__ */ K(zt, { ...e });
export { Bt as t };
