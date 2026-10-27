// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./circle-B0quX-xX.ts";
import { t as r } from "./icon-D3uE7jD-.ts";
import { forwardRef as i } from "react";
import { Button as a, Flex as o, Menu as s, Portal as c, Text as l } from "@chakra-ui/react";
import { Tooltip as u } from "@pstdio/ui";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
import { harnessParamOptionColor as p, resolveHarnessParamText as m, updateHarnessParamOverride as h } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/modules/sessions/components/harness-param-option-icon.tsx
var g = (e) => {
	let { name: t } = e, n = p(t);
	return /* @__PURE__ */ d(r, {
		name: t,
		size: 14,
		color: n ? `${n}.500` : void 0
	});
}, _ = i((e, n) => {
	let { displayLabel: r, ariaLabel: i, label: o, startIcon: s, showChevron: c = !1, size: p = "sm", ...m } = e;
	return /* @__PURE__ */ d(u, {
		content: o,
		closeDelay: 150,
		children: /* @__PURE__ */ f(a, {
			ref: n,
			variant: "ghost",
			size: p,
			px: "2",
			minW: "0",
			flexShrink: "0",
			"aria-label": i,
			...m,
			children: [
				s,
				/* @__PURE__ */ d(l, {
					textStyle: "label/XS/medium",
					color: "fg",
					truncate: !0,
					children: r
				}),
				c ? /* @__PURE__ */ d(t, { size: 14 }) : null
			]
		})
	});
}), v = (e) => {
	let { paramKey: t, descriptor: r, defaults: i, overrides: a, onOverridesChange: o, disabled: s, value: c, size: l } = e, u = m(t, r.label), f = c === !0;
	return /* @__PURE__ */ d(_, {
		displayLabel: `${u}: ${f ? "on" : "off"}`,
		ariaLabel: `${u}: ${f ? "on" : "off"}`,
		label: u,
		disabled: s,
		size: l,
		startIcon: /* @__PURE__ */ d(n, {
			size: 10,
			fill: f ? "currentColor" : "transparent",
			strokeWidth: f ? 0 : 2
		}),
		onClick: () => o(h(a, i, t, !f))
	});
}, y = (t) => {
	let { paramKey: n, descriptor: r, defaults: i, overrides: a, onOverridesChange: o, disabled: l, value: u, size: p } = t, v = m(n, r.label), y = typeof u == "string" ? u : r.options[0]?.value, b = r.options.find((e) => e.value === y), x = b?.label ?? y ?? "unset";
	return /* @__PURE__ */ f(s.Root, {
		lazyMount: !0,
		closeOnSelect: !0,
		positioning: { placement: "bottom-end" },
		children: [/* @__PURE__ */ d(s.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ d(_, {
				displayLabel: x,
				ariaLabel: `${v}: ${x}`,
				label: v,
				disabled: l,
				size: p,
				startIcon: b?.icon ? /* @__PURE__ */ d(g, { name: b.icon }) : void 0,
				showChevron: !0
			})
		}), /* @__PURE__ */ d(c, { children: /* @__PURE__ */ d(s.Positioner, { children: /* @__PURE__ */ d(s.Content, {
			minW: "12rem",
			children: /* @__PURE__ */ f(s.ItemGroup, { children: [/* @__PURE__ */ d(s.ItemGroupLabel, { children: v }), r.options.map((t) => /* @__PURE__ */ f(s.Item, {
				value: t.value,
				role: "menuitemradio",
				"aria-checked": t.value === y,
				onSelect: () => o(h(a, i, n, t.value)),
				children: [
					/* @__PURE__ */ d(g, { name: t.icon }),
					/* @__PURE__ */ d(s.ItemText, { children: t.label }),
					t.value === y ? /* @__PURE__ */ d(e, { size: 14 }) : null
				]
			}, t.value))] })
		}) }) })]
	});
}, b = (e) => {
	let { paramKey: t, descriptor: n, defaults: r, overrides: i } = e, a = i[t] ?? r?.[t] ?? n.defaultValue;
	return n.type === "boolean" ? /* @__PURE__ */ d(v, {
		...e,
		descriptor: n,
		value: a
	}) : /* @__PURE__ */ d(y, {
		...e,
		descriptor: n,
		value: a
	});
}, x = (e) => {
	let { schema: t, defaults: n, overrides: r, onOverridesChange: i, disabled: a = !1, size: s = "sm" } = e, c = Object.entries(t ?? {}).filter(([, e]) => e.control !== "command");
	return c.length === 0 ? null : /* @__PURE__ */ d(o, {
		align: "center",
		justify: "flex-end",
		gap: "2xs",
		minW: "0",
		wrap: "wrap",
		children: c.map(([e, t]) => /* @__PURE__ */ d(b, {
			paramKey: e,
			descriptor: t,
			defaults: n,
			overrides: r,
			onOverridesChange: i,
			disabled: a,
			size: s
		}, e))
	});
};
export { x as t };
