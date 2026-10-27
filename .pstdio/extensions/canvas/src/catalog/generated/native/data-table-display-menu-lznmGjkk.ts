// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./grip-vertical-C8TSneyx.ts";
import { t as n } from "./settings-2-CNFOcldp.ts";
import { S as r, b as i, l as a, s as o, t as s, x as c } from "./core.esm-cje5eyjm.ts";
import { t as l } from "./scroll-area-I7hjn89T.ts";
import { t as u } from "./tooltip-BweQW627.ts";
import { t as d } from "./collection-view-field-icon-C_8hVgsS.ts";
import { t as f } from "./checkbox-C3JJ0TWQ.ts";
import { a as p } from "./list-row-BhxGCvIh.ts";
import { t as m } from "./switch-CVOnzlSE.ts";
import { n as h } from "./display-menu-DgqSpRfh.ts";
import { a as g, i as _, t as v } from "./sortable.esm-R8iGneY7.ts";
import { useEffect as y, useRef as b, useState as x } from "react";
import { Box as S, HStack as C, Icon as w, IconButton as T, Popover as E, Portal as D, Stack as O, Text as k } from "@chakra-ui/react";
import { jsx as A, jsxs as j } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-display-menu.tsx
var M = (e) => /* @__PURE__ */ j(C, {
	paddingX: "xs",
	paddingTop: "xs",
	paddingBottom: "2xs",
	children: [/* @__PURE__ */ A(k, {
		textStyle: "label/XS/medium",
		color: "fg.muted",
		children: e.children
	}), e.end ? /* @__PURE__ */ A(k, {
		marginLeft: "auto",
		textStyle: "label/XS",
		color: "fg.subtle",
		children: e.end
	}) : null]
}), N = (e) => /* @__PURE__ */ A(S, {
	paddingX: "xs",
	paddingY: "2xs",
	children: /* @__PURE__ */ A(m, {
		checked: e.checked,
		inputProps: { role: "switch" },
		width: "full",
		flexDirection: "row-reverse",
		justifyContent: "space-between",
		onCheckedChange: (t) => e.onChange(t.checked === !0),
		children: /* @__PURE__ */ j(C, {
			as: "span",
			gap: "xs",
			children: [/* @__PURE__ */ A(k, {
				as: "span",
				textStyle: "label/S/regular",
				children: e.label
			}), e.hint ? /* @__PURE__ */ A(k, {
				as: "span",
				textStyle: "label/XS",
				color: "fg.subtle",
				children: e.hint
			}) : null]
		})
	})
}), P = (n) => {
	let { column: i, checked: a, onColumnVisibilityChange: o } = n, { attributes: s, listeners: c, setNodeRef: l, transform: u, transition: p, isDragging: m } = _({ id: i.id });
	return /* @__PURE__ */ j(C, {
		ref: l,
		style: {
			transform: r.Transform.toString(u),
			transition: p,
			opacity: m ? .5 : 1
		},
		gap: "2xs",
		minW: "0",
		width: "full",
		borderRadius: "xs",
		px: "xs",
		py: "2xs",
		_hover: { bg: "bg.hover" },
		children: [
			/* @__PURE__ */ A(S, {
				as: "span",
				display: "inline-flex",
				cursor: "grab",
				color: "fg.muted",
				...s,
				...c,
				children: /* @__PURE__ */ A(t, { size: 14 })
			}),
			/* @__PURE__ */ A(f, {
				checked: a,
				flex: "1",
				minW: "0",
				size: "sm",
				icon: /* @__PURE__ */ A(w, {
					as: e,
					boxSize: "12px",
					strokeWidth: "3"
				}),
				onCheckedChange: (e) => o(i.id, e.checked === !0),
				children: /* @__PURE__ */ A(k, {
					as: "span",
					textStyle: "label/S/regular",
					truncate: !0,
					children: i.label
				})
			}),
			/* @__PURE__ */ A(w, {
				as: d(i),
				boxSize: "0.75rem",
				color: "fg.subtle",
				flexShrink: 0
			})
		]
	});
}, F = (e) => {
	let { columns: t, settings: r, statsAvailable: d, onSettingsChange: f, onColumnVisibilityChange: m, onColumnReorder: _ } = e, C = b(null), k = b(null), [F, I] = x(!1), [L, R] = x(""), z = c(i(o, { activationConstraint: { distance: 5 } })), B = L.trim().toLowerCase(), V = B ? t.filter((e) => e.label.toLowerCase().includes(B)) : t, H = t.filter((e) => !r.hiddenColumns.includes(e.id)).length, U = [{
		value: "none",
		label: "None"
	}, ...t.filter((e) => e.groupable).map((e) => ({
		value: e.id,
		label: e.label
	}))];
	return y(() => {
		if (!F) return;
		let e = (e) => {
			let t = e.target;
			t instanceof Node && (k.current?.contains(t) || C.current?.contains(t) || I(!1));
		};
		return document.addEventListener("pointerdown", e), () => document.removeEventListener("pointerdown", e);
	}, [F]), /* @__PURE__ */ j(E.Root, {
		open: F,
		closeOnInteractOutside: !1,
		positioning: {
			placement: "bottom-end",
			offset: { mainAxis: 8 },
			getAnchorElement: () => C.current
		},
		onOpenChange: (e) => I(e.open),
		children: [/* @__PURE__ */ A(u, {
			content: "Display",
			children: /* @__PURE__ */ A(E.Trigger, {
				asChild: !0,
				children: /* @__PURE__ */ A(T, {
					ref: C,
					"aria-label": "Display settings",
					variant: "ghost",
					size: "2xs",
					children: /* @__PURE__ */ A(w, { as: n })
				})
			})
		}), /* @__PURE__ */ A(D, { children: /* @__PURE__ */ A(E.Positioner, { children: /* @__PURE__ */ j(E.Content, {
			ref: k,
			"data-testid": "data-table-display-menu",
			width: "min(300px, calc(100vw - 32px))",
			padding: "2xs",
			gap: "1px",
			children: [
				/* @__PURE__ */ A(M, { children: "TABLE DISPLAY" }),
				U.length > 1 ? /* @__PURE__ */ A(h, {
					label: "Grouping",
					value: r.grouping,
					options: U,
					onSelect: (e) => f({ grouping: e })
				}) : null,
				e.sortControl,
				/* @__PURE__ */ A(N, {
					label: "Row numbers",
					checked: r.rowNumbers,
					onChange: (e) => f({ rowNumbers: e })
				}),
				/* @__PURE__ */ A(N, {
					label: "Wrap rows",
					checked: r.wrapRows,
					onChange: (e) => f({ wrapRows: e })
				}),
				d ? /* @__PURE__ */ A(N, {
					label: "Statistics",
					hint: "from column stats",
					checked: r.showStats,
					onChange: (e) => f({ showStats: e })
				}) : null,
				/* @__PURE__ */ A(S, {
					borderTopWidth: "1px",
					borderColor: "border.subtle",
					marginY: "2xs"
				}),
				/* @__PURE__ */ A(M, {
					end: `${H} of ${t.length} shown`,
					children: "COLUMNS"
				}),
				/* @__PURE__ */ A(p, {
					value: L,
					placeholder: "Search columns",
					onValueChange: R
				}),
				/* @__PURE__ */ A(l, {
					maxH: "280px",
					viewportProps: { overscrollBehavior: "contain" },
					children: /* @__PURE__ */ A(s, {
						sensors: z,
						collisionDetection: a,
						onDragEnd: (e) => {
							let { active: t, over: n } = e;
							n && t.id !== n.id && _(String(t.id), String(n.id));
						},
						children: /* @__PURE__ */ A(v, {
							items: t.map((e) => e.id),
							strategy: g,
							children: /* @__PURE__ */ A(O, {
								gap: "1px",
								padding: "2xs",
								children: V.map((e) => /* @__PURE__ */ A(P, {
									column: e,
									checked: !r.hiddenColumns.includes(e.id),
									onColumnVisibilityChange: m
								}, e.id))
							})
						})
					})
				})
			]
		}) }) })]
	});
};
export { F as t };
