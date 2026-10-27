// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-label-BDQjmLHj.ts";
import { t } from "./param-editor-read-only-value-c3lD-see.ts";
import { useEffect as n, useRef as r, useState as i } from "react";
import { Box as a, ColorPicker as o, Flex as s, parseColor as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/color-input.tsx
var d = (d) => {
	let { id: f, defaultValue: p, name: m, onChange: h, description: g, readOnly: _, hideLabel: v = !1, fullWidth: y = !1, size: b = "sm" } = d, [x, S] = i(p), [C, w] = i(!1), T = r(null), E = r(null), D = r(null), O = (e) => {
		D.current && clearTimeout(D.current), D.current = setTimeout(() => h(f, e), 540);
	};
	n(() => {
		S(p);
	}, [p]), n(() => {
		if (!C) return;
		let e = (e) => {
			let t = e;
			return T.current?.contains(t) || E.current?.contains(t);
		}, t = (t) => {
			e(t.target) || w(!1);
		};
		return document.addEventListener("focusin", t, !0), document.addEventListener("pointerdown", t, !0), document.addEventListener("click", t, !0), () => {
			document.removeEventListener("focusin", t, !0), document.removeEventListener("pointerdown", t, !0), document.removeEventListener("click", t, !0);
		};
	}, [C]);
	let k = (e) => {
		S(e), O(e);
	}, A = (e) => {
		let t = e.currentTarget;
		setTimeout(() => {
			t.contains(t.ownerDocument.activeElement) || w(!1);
		});
	};
	if (_) {
		let n = /* @__PURE__ */ l(t, { children: /* @__PURE__ */ u(s, {
			alignItems: "center",
			gap: "xs",
			children: [/* @__PURE__ */ l(a, {
				boxSize: "0.75rem",
				borderRadius: "xs",
				bg: x
			}), /* @__PURE__ */ l(a, {
				as: "span",
				children: x
			})]
		}) });
		return y ? /* @__PURE__ */ u(a, { children: [!v && /* @__PURE__ */ l(a, {
			mb: "xs",
			children: /* @__PURE__ */ l(e, {
				name: m,
				description: g
			})
		}), n] }) : /* @__PURE__ */ l(a, { children: /* @__PURE__ */ u(s, {
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: "2rem",
			gap: "xs",
			children: [!v && /* @__PURE__ */ l(e, {
				name: m,
				description: g
			}), n]
		}) });
	}
	let j = {
		value: c(x),
		open: C,
		onOpenChange: (e) => w(e.open),
		onFocusOutside: () => w(!1),
		onInteractOutside: () => w(!1),
		onBlur: A,
		onValueChange: (e) => k(e.value.toString("hex")),
		disabled: _
	}, M = /* @__PURE__ */ u(o.Root, {
		ref: T,
		...j,
		size: b,
		width: y ? "100%" : "8.75rem",
		maxW: "100%",
		children: [
			/* @__PURE__ */ l(o.HiddenInput, {}),
			/* @__PURE__ */ l(o.Label, {
				srOnly: !0,
				children: m
			}),
			/* @__PURE__ */ u(o.Control, { children: [/* @__PURE__ */ l(o.Input, {
				readOnly: _,
				onFocus: () => w(!1)
			}), /* @__PURE__ */ l(o.Trigger, {})] }),
			/* @__PURE__ */ l(o.Positioner, { children: /* @__PURE__ */ u(o.Content, {
				ref: E,
				onBlur: A,
				children: [
					/* @__PURE__ */ l(o.Area, {}),
					/* @__PURE__ */ l(o.Sliders, {}),
					/* @__PURE__ */ l(o.SwatchGroup, { children: /* @__PURE__ */ l(o.SwatchTrigger, {
						value: x,
						children: /* @__PURE__ */ l(o.Swatch, { value: x })
					}) })
				]
			}) })
		]
	});
	return /* @__PURE__ */ l(a, { children: y ? /* @__PURE__ */ u(a, { children: [!v && /* @__PURE__ */ l(a, {
		mb: "xs",
		children: /* @__PURE__ */ l(e, {
			name: m,
			description: g
		})
	}), M] }) : /* @__PURE__ */ u(s, {
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: "2rem",
		gap: "xs",
		children: [!v && /* @__PURE__ */ l(e, {
			name: m,
			description: g
		}), M]
	}) });
};
export { d as t };
