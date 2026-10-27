// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-right-CRFNEcZT.ts";
import { t as n } from "./list-filter-BPOkFpgD.ts";
import { t as r } from "./search-FHo0INnP.ts";
import { t as i } from "./x-DqEAa6-d.ts";
import { t as a } from "./scroll-area-I7hjn89T.ts";
import { c as o } from "./collection-view-fields-D15M65ck.ts";
import { i as s, n as c, o as l, s as u } from "./filter-rule-value-y7_Oj9HU.ts";
import { t as d } from "./collection-view-field-icon-C_8hVgsS.ts";
import { t as f } from "./checkbox-C3JJ0TWQ.ts";
import { t as p } from "./list-row-BhxGCvIh.ts";
import { useState as m } from "react";
import { Box as h, Button as g, HStack as _, Icon as v, Input as y, Stack as b, Text as x } from "@chakra-ui/react";
import { jsx as S, jsxs as C } from "react/jsx-runtime";
import { normalizeBooleanViewRule as w } from "@pstdio/sdk/extensions";
// packages/ui/src/components/collection-view/filter-picker-values.tsx
var T = (e) => {
	let { field: t, rule: n, options: r, onSelectRule: i } = e, [o, s] = m(n.value), l = t.type.kind === "string" || o !== void 0 && o !== "", d = () => {
		l && i(u(t, n, o));
	};
	return /* @__PURE__ */ C(b, {
		height: "full",
		minH: "0",
		gap: "xs",
		onKeyDown: (e) => {
			e.key === "Enter" && (e.preventDefault(), d());
		},
		children: [/* @__PURE__ */ S(a, {
			flex: "1",
			minH: "0",
			viewportProps: { overscrollBehavior: "contain" },
			children: /* @__PURE__ */ S(c, {
				field: t,
				rule: {
					...n,
					value: o
				},
				options: r,
				onChange: s
			})
		}), /* @__PURE__ */ S(h, {
			paddingX: "sm",
			paddingBottom: "sm",
			flexShrink: 0,
			children: /* @__PURE__ */ S(g, {
				size: "sm",
				variant: "primary",
				width: "full",
				disabled: !l,
				onClick: d,
				children: "Apply filter"
			})
		})]
	});
}, E = (t) => {
	let { field: n, options: r, onSelectRule: a } = t, o = w(t.rule ?? l(n), n.type), d = [
		"string",
		"number",
		"date"
	].includes(n.type.kind), m = d && ["is-empty", "is-not-empty"].includes(o.condition) ? l(n) : o;
	return n.type.kind === "boolean" ? /* @__PURE__ */ S(s, { children: /* @__PURE__ */ S(b, {
		gap: "0",
		children: [!0, !1].map((r) => /* @__PURE__ */ S(p, {
			id: String(r),
			role: "button",
			variant: "compact",
			icon: /* @__PURE__ */ S(v, {
				as: r ? e : i,
				boxSize: "3"
			}),
			label: r ? "Yes" : "No",
			endContent: /* @__PURE__ */ S(f, {
				checked: !!t.rule && typeof m.value == "boolean" && (m.condition === "is-not" ? !m.value : m.value) === r,
				readOnly: !0,
				inputProps: {
					tabIndex: -1,
					"aria-hidden": !0
				},
				pointerEvents: "none",
				size: "xs"
			}),
			onActivate: () => a(u(n, m, r))
		}, String(r)))
	}) }) : d ? /* @__PURE__ */ S(T, {
		...t,
		rule: m
	}, n.id) : /* @__PURE__ */ S(c, {
		field: n,
		rule: m,
		options: r,
		onChange: (e) => {
			e !== void 0 && e !== "" && a(u(n, m, e));
		}
	});
}, D = {
	p: "2xs",
	display: "flex",
	flexDirection: "column",
	gap: "1px"
}, O = (e) => {
	let { fields: i, filter: s, optionsFor: c, onSelectRule: l } = e, [u, f] = m(""), g = i.filter(o), [w, T] = m(g[0]?.id ?? i[0]?.id ?? ""), O = u.trim().toLocaleLowerCase(), k = i.filter((e) => e.label.toLocaleLowerCase().includes(O)), A = k.find((e) => e.id === w);
	return /* @__PURE__ */ C(b, {
		"data-testid": "filter-menu",
		layerStyle: "filterPicker",
		gap: "0",
		overflow: "hidden",
		children: [
			/* @__PURE__ */ C(_, {
				height: "2.25rem",
				gap: "xs",
				paddingX: "sm",
				borderBottomWidth: "1px",
				borderColor: "border.subtle",
				children: [/* @__PURE__ */ S(v, {
					as: r,
					boxSize: "0.875rem",
					color: "fg.muted"
				}), /* @__PURE__ */ S(y, {
					autoFocus: !0,
					"aria-label": "Filter properties",
					value: u,
					placeholder: "Filter by…",
					variant: "flushed",
					border: "0",
					height: "full",
					padding: "0",
					onChange: (e) => f(e.target.value)
				})]
			}),
			/* @__PURE__ */ C(_, {
				alignItems: "stretch",
				gap: "0",
				flex: "1",
				minH: "0",
				children: [/* @__PURE__ */ S(b, {
					"data-testid": "filter-property-column",
					width: "11.75rem",
					flexShrink: 0,
					borderRightWidth: "1px",
					borderColor: "border.subtle",
					gap: "0",
					minH: "0",
					children: /* @__PURE__ */ S(a, {
						flex: "1",
						minH: "0",
						viewportProps: { overscrollBehavior: "contain" },
						contentProps: D,
						children: k.map((e) => /* @__PURE__ */ S(p, {
							id: e.id,
							role: "button",
							variant: "compact",
							isSelected: A?.id === e.id,
							icon: /* @__PURE__ */ S(v, {
								as: d(e),
								boxSize: "3"
							}),
							label: e.label,
							endContent: /* @__PURE__ */ S(v, {
								as: t,
								boxSize: "3",
								color: "fg.subtle"
							}),
							onActivate: () => T(e.id)
						}, e.id))
					})
				}), /* @__PURE__ */ S(b, {
					flex: "1",
					minW: "0",
					minH: "0",
					gap: "0",
					children: A ? /* @__PURE__ */ S(h, {
						"data-testid": "filter-value-column",
						flex: "1",
						minH: "0",
						children: /* @__PURE__ */ S(E, {
							field: A,
							rule: s.rules.find((e) => e.attributeId === A.id),
							options: c(A),
							onSelectRule: l
						})
					}) : null
				})]
			}),
			e.onAddAdvanced || e.onClear ? /* @__PURE__ */ C(_, {
				"data-testid": "filter-menu-footer",
				padding: "2xs",
				borderTopWidth: "1px",
				borderColor: "border.subtle",
				children: [e.onAddAdvanced ? /* @__PURE__ */ S(p, {
					id: "advanced-filter",
					role: "button",
					variant: "compact",
					flex: "1",
					label: "Advanced filter",
					icon: /* @__PURE__ */ S(v, {
						as: n,
						boxSize: "3"
					}),
					onActivate: e.onAddAdvanced
				}) : /* @__PURE__ */ S(h, { flex: "1" }), e.onClear ? /* @__PURE__ */ S(p, {
					id: "clear-all",
					role: "button",
					"aria-label": "Clear all",
					variant: "compact",
					flex: "1",
					label: "",
					endContent: /* @__PURE__ */ S(x, {
						textStyle: "label/S/regular",
						children: "Clear all"
					}),
					disabled: s.rules.length === 0 && !s.groups?.length,
					onActivate: e.onClear
				}) : null]
			}) : null
		]
	});
};
export { O as t };
