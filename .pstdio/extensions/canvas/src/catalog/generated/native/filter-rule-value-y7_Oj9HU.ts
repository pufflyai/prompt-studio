// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { t } from "./icon-options-BaFkbkcp.ts";
import { r as n } from "./collection-view-fields-D15M65ck.ts";
import { t as r } from "./checkbox-C3JJ0TWQ.ts";
import { t as i } from "./list-row-BhxGCvIh.ts";
import { t as a } from "./param-editor-label-BDQjmLHj.ts";
import { n as o, o as s } from "./collection-view-labels-C1iICfrD.ts";
import { n as c, t as l } from "./number-input-BAmIOgl0.ts";
import { createContext as u, useContext as d, useRef as f, useState as p } from "react";
import { Button as m, Editable as h, HStack as g, Icon as _, Input as v, Popover as y, Portal as b, Stack as x, Text as S } from "@chakra-ui/react";
import { Fragment as C, jsx as w, jsxs as T } from "react/jsx-runtime";
// packages/ui/src/components/collection-view/collection-view-rules.ts
var E = (e) => n(e)[0], D = (e) => ({
	attributeId: e.id,
	condition: E(e),
	...e.type.kind === "boolean" ? { value: !0 } : {}
}), O = (e, t, n) => ({
	...e,
	rules: n === void 0 ? e.rules.filter((e, n) => n !== t) : e.rules.map((e, r) => r === t ? n : e)
}), k = (e, t) => ({
	...e,
	rules: [...e.rules, t]
}), A = (e, t) => ({
	...e,
	conjunction: t
}), j = (e, t, n) => {
	if (e.type.kind === "boolean" && typeof n == "boolean") {
		let r = t.condition === "is-not";
		return {
			attributeId: e.id,
			condition: r ? "is-not" : "is",
			value: r ? !n : n
		};
	}
	let r = t.condition;
	if (Array.isArray(n) && (r === "is-empty" || r === "is-not-empty")) {
		let t = r === "is-not-empty";
		r = e.type.kind === "enum-multi" ? t ? "has-none-of" : "has-any-of" : t ? "is-none-of" : "is-any-of";
	}
	return {
		...t,
		condition: r,
		value: n
	};
}, M = (e) => {
	let { children: t } = e;
	return /* @__PURE__ */ T(x, {
		height: "full",
		minH: "0",
		gap: "xs",
		padding: "sm",
		minW: "0",
		children: [/* @__PURE__ */ w(a, { name: "Value" }), t]
	});
}, N = u(!1), P = (e) => {
	let { open: t, onOpenChange: n, anchorRef: r, width: i, placement: a = "bottom-start", padding: o = "2xs", testId: s, children: c } = e, l = d(N);
	return /* @__PURE__ */ w(y.Root, {
		open: t,
		lazyMount: !0,
		unmountOnExit: !0,
		positioning: {
			placement: a,
			strategy: "fixed",
			hideWhenDetached: !0,
			offset: { mainAxis: 8 },
			getAnchorElement: () => r.current
		},
		onOpenChange: (e) => n(e.open),
		onInteractOutside: (e) => {
			let t = e.detail.originalEvent.target;
			t instanceof Node && r.current?.contains(t) && e.preventDefault();
		},
		children: /* @__PURE__ */ w(b, {
			disabled: l,
			children: /* @__PURE__ */ w(y.Positioner, { children: /* @__PURE__ */ w(y.Content, {
				"data-testid": s,
				width: i,
				maxWidth: "calc(100vw - 32px)",
				padding: o,
				gap: "0",
				overflow: "visible",
				children: /* @__PURE__ */ w(N, {
					value: !0,
					children: c
				})
			}) })
		})
	});
}, F = /^\d{4}-\d{2}-\d{2}$/, I = (e) => {
	let { rule: t, onChange: n } = e, r = typeof t.value == "number" ? t.value : void 0, [i, a] = p({
		source: r,
		text: r === void 0 ? "" : String(r)
	});
	return i.source !== r && a({
		source: r,
		text: r === void 0 ? "" : String(r)
	}), /* @__PURE__ */ w(c, {
		size: "sm",
		width: "full",
		value: i.text,
		onValueChange: (e) => {
			let t = Number.isFinite(e.valueAsNumber) ? e.valueAsNumber : void 0;
			a({
				source: t,
				text: e.value
			}), n(t);
		},
		children: /* @__PURE__ */ w(l, { "aria-label": "Value" })
	});
}, L = (e) => {
	let { field: t, rule: n, onChange: r } = e, i = typeof n.value == "string" ? n.value : "";
	return t.type.kind === "date" ? /* @__PURE__ */ w(M, { children: /* @__PURE__ */ w(v, {
		"aria-label": "Value",
		type: "date",
		size: "sm",
		width: "full",
		value: F.test(i) ? i : "",
		onChange: (e) => r(e.target.value || void 0)
	}) }) : /* @__PURE__ */ w(M, { children: t.type.kind === "number" ? /* @__PURE__ */ w(I, { ...e }) : /* @__PURE__ */ w(v, {
		"aria-label": "Value",
		size: "sm",
		placeholder: "Enter text…",
		width: "full",
		value: i,
		onChange: (e) => r(e.target.value)
	}) });
}, R = (e) => {
	let { rule: t, variant: n } = e, [r, i] = p(!1), a = f(null), s = e.open ?? r, c = e.onOpenChange ?? i;
	return /* @__PURE__ */ T(C, { children: [/* @__PURE__ */ w(m, {
		ref: a,
		"aria-label": "Values",
		variant: n ?? "subtle",
		size: "2xs",
		onClick: () => c(!s),
		children: /* @__PURE__ */ w(S, {
			textStyle: "label/XS",
			children: typeof t.value == "string" ? o(t.value) : "Choose date…"
		})
	}), /* @__PURE__ */ w(P, {
		open: s,
		onOpenChange: c,
		anchorRef: a,
		width: "18rem",
		padding: "0",
		children: /* @__PURE__ */ w(L, { ...e })
	})] });
}, z = (e, t) => t.condition === "is-empty" || t.condition === "is-not-empty" ? [
	"enum",
	"enum-multi",
	"user"
].includes(e.type.kind) ? "options" : "none" : Array.isArray(t.value) ? "options" : e.type.kind === "boolean" ? "boolean" : e.type.kind === "number" ? "number" : e.type.kind === "date" ? "day" : e.type.kind === "string" ? "text" : "options", B = (e, t) => e.includes(t) ? e.filter((e) => e !== t) : [...e, t], V = (e, t) => [...e, ...H(t).filter((t) => !e.some((e) => e.value === t)).map((e) => ({
	value: e,
	label: e
}))], H = (e) => Array.isArray(e.value) ? e.value : [], U = (e) => {
	let { rule: t, onChange: n, width: r } = e;
	return /* @__PURE__ */ w(v, {
		"aria-label": "Value",
		type: "number",
		variant: e.variant === "filter-segment" ? "borderless" : "outline",
		size: "2xs",
		width: r,
		value: typeof t.value == "number" ? String(t.value) : "",
		onChange: (e) => n(e.target.value === "" ? void 0 : Number(e.target.value))
	});
}, W = (e) => {
	let { rule: t, onChange: n, width: r } = e;
	return /* @__PURE__ */ w(v, {
		"aria-label": "Value",
		size: "2xs",
		width: r,
		value: typeof t.value == "string" ? t.value : "",
		onChange: (e) => n(e.target.value)
	});
}, G = (e) => {
	let { rule: t, onChange: n, open: r, onOpenChange: i } = e;
	return /* @__PURE__ */ T(h.Root, {
		size: "xs",
		variant: "filter-segment",
		value: typeof t.value == "string" ? t.value : "",
		placeholder: "Value…",
		edit: r,
		activationMode: "click",
		selectOnFocus: !0,
		onEditChange: (e) => i?.(e.edit),
		onValueChange: (e) => n(e.value),
		onValueRevert: (e) => n(e.value),
		children: [/* @__PURE__ */ w(h.Preview, {}), /* @__PURE__ */ w(h.Input, { "aria-label": "Value" })]
	});
}, K = (e) => {
	let { field: n, rule: r, options: i, onChange: a } = e, o = V(i, r), c = z(n, r);
	if (c === "none") return null;
	if (c === "boolean") return /* @__PURE__ */ w(S, {
		textStyle: e.variant === "filter-segment" ? "label/XS" : "label/S/medium",
		paddingX: "xs",
		children: n.label
	});
	if (c === "number") return /* @__PURE__ */ w(U, {
		...e,
		width: "9rem"
	});
	if (c === "text") return e.variant === "filter-segment" ? /* @__PURE__ */ w(G, { ...e }) : /* @__PURE__ */ w(W, {
		...e,
		width: "9rem"
	});
	if (c === "day") return /* @__PURE__ */ w(R, { ...e });
	let l = r.condition === "is-empty" || r.condition === "is-not-empty" ? "Empty" : void 0, u = r.condition === "has-all-of" ? `all of ${o.filter((e) => H(r).includes(e.value)).map((e) => e.label).join(", ")}` : l;
	return /* @__PURE__ */ w(s, {
		"aria-label": "Values",
		selectedLabel: u,
		multiple: !0,
		variant: e.variant,
		width: e.variant === "filter-segment" ? void 0 : "9rem",
		open: e.open,
		onOpenChange: e.onOpenChange,
		options: o.map((e) => ({
			...e,
			icon: e.icon ? t(e.icon) : void 0,
			iconColor: e.color ? `${e.color}.500` : void 0
		})),
		value: H(r),
		onSelect: (e) => a(B(H(r), e))
	});
}, q = (n) => {
	let { rule: a, options: o, onChange: s } = n, c = V(o, a), l = H(a);
	return /* @__PURE__ */ w(x, {
		gap: "0",
		flex: "1",
		minH: "0",
		children: /* @__PURE__ */ w(e, {
			flex: "1",
			minH: "0",
			viewportProps: { overscrollBehavior: "contain" },
			children: c.map((e) => {
				let n = l.includes(e.value);
				return /* @__PURE__ */ w(i, {
					id: e.value,
					role: "checkbox",
					"aria-label": e.label,
					"aria-checked": n,
					variant: "compact",
					label: /* @__PURE__ */ T(g, {
						minW: "0",
						gap: "xs",
						children: [e.icon ? /* @__PURE__ */ w(_, {
							as: t(e.icon),
							boxSize: "3",
							color: e.color ? `${e.color}.500` : "fg.muted"
						}) : null, /* @__PURE__ */ w(S, {
							textStyle: "label/S/regular",
							truncate: !0,
							children: e.label
						})]
					}),
					endContent: /* @__PURE__ */ T(g, {
						gap: "xs",
						children: [e.count && e.count > 0 ? /* @__PURE__ */ w(S, {
							textStyle: "label/XS",
							color: "fg.muted",
							children: e.count
						}) : null, /* @__PURE__ */ w(r, {
							checked: n,
							readOnly: !0,
							"aria-readonly": "true",
							inputProps: {
								tabIndex: -1,
								"aria-hidden": !0
							},
							pointerEvents: "none",
							size: "xs"
						})]
					}),
					onActivate: () => s(B(l, e.value))
				}, e.value);
			})
		})
	});
}, J = (e) => {
	let { field: t, rule: n } = e, r = z(t, n);
	return r === "none" ? null : r === "boolean" ? /* @__PURE__ */ w(M, { children: /* @__PURE__ */ w(S, {
		textStyle: "label/S/medium",
		children: t.label
	}) }) : r === "options" ? /* @__PURE__ */ w(M, { children: /* @__PURE__ */ w(q, { ...e }) }) : /* @__PURE__ */ w(L, { ...e });
};
export { k as a, A as c, M as i, O as l, J as n, D as o, P as r, j as s, K as t };
