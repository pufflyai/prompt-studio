// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./check-Bgh538vW.ts";
import { t } from "./chevron-down-ZmPqsMG0.ts";
import { t as n } from "./icon-options-BaFkbkcp.ts";
import { i as r, r as i, t as a } from "./list-row-BhxGCvIh.ts";
import { Button as o, Flex as s, Icon as c, IconButton as l, Menu as u, Portal as d } from "@chakra-ui/react";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/inputs/selection-menu.tsx
var m = (e) => e?.icon ? n(e.icon) : void 0, h = (e, t) => e?.icon ? /* @__PURE__ */ f(c, {
	as: n(e.icon),
	boxSize: t,
	color: e.color ? `${e.color}.500` : "fg.muted"
}) : null, g = (n) => {
	let { triggerLabel: g, options: _, selectedIds: v, multiSelect: y, reselectable: b = !1, disabled: x, searchable: S = !1, allowCustomValues: C = !1, searchPlaceholder: w = "Search options…", emptyText: T = "No options found", group: E, fullWidth: D, triggerVariant: O = "button", triggerAriaLabel: k, size: A = "sm", onToggle: j, onGroupChange: M } = n, N = !!(M && E && !E.disabled && E.options.some((e) => !e.disabled && e.id !== E.defaultValue)), P = _.some((e) => !e.disabled && (y || b || !v.includes(e.id))), F = x || !C && !P && !N, I = O === "icon" ? /* @__PURE__ */ f(l, {
		"aria-label": k ?? "Open options",
		size: "2xs",
		variant: "ghost",
		disabled: F,
		children: g
	}) : /* @__PURE__ */ f(o, {
		size: A,
		borderWidth: "1px",
		borderStyle: "solid",
		borderColor: "border",
		disabled: F,
		textStyle: A === "xs" ? "label/XS" : "label/S/regular",
		width: D ? "100%" : void 0,
		minW: "0",
		flexShrink: 1,
		_hover: {
			bg: "bg.hover",
			borderColor: "border.accent-light"
		},
		_active: {
			bg: "bg.active",
			borderColor: "border.accent-light"
		},
		_expanded: {
			bg: "bg.active",
			borderColor: "border.accent-light"
		},
		_focusVisible: {
			borderColor: "border.accent-light",
			outline: "none",
			boxShadow: "none"
		},
		children: /* @__PURE__ */ p(s, {
			alignItems: "center",
			justifyContent: "space-between",
			gap: "xs",
			minW: "0",
			w: D ? "full" : void 0,
			children: [/* @__PURE__ */ f(s, {
				alignItems: "center",
				gap: "xs",
				minW: "0",
				children: g
			}), /* @__PURE__ */ f(t, { size: 14 })]
		})
	});
	if (S || C || E) {
		let e = _.map((e) => ({
			id: e.id,
			label: e.name,
			searchText: [e.id, e.description].filter(Boolean).join(" "),
			secondaryLabel: e.description,
			icon: m(e),
			iconColor: e.color ? `${e.color}.500` : void 0,
			isDisabled: e.disabled,
			isSelected: v.includes(e.id),
			onSelect: () => j(e.id)
		})), t = E?.options.find((e) => e.id === E.defaultValue);
		return /* @__PURE__ */ f(i, {
			trigger: I,
			items: e,
			listId: E?.defaultValue,
			showSearch: S || C,
			filterItems: (e, t) => {
				let n = r(e, t), i = t.trim();
				return !C || !i || _.some((e) => e.id === i) ? n : [...n, {
					id: i,
					label: `Use "${i}"`,
					onSelect: () => j(i)
				}];
			},
			searchPlaceholder: w,
			multiple: y,
			closeOnSelect: !y,
			emptyState: /* @__PURE__ */ f(u.Item, {
				value: "empty",
				disabled: !0,
				asChild: !0,
				children: /* @__PURE__ */ f(a, {
					asChild: !0,
					variant: "full-width",
					id: "empty",
					label: T,
					disabled: !0
				})
			}),
			parentList: E ? {
				items: E.options.map((e) => ({
					id: e.id,
					label: e.name,
					searchText: [e.id, e.description].filter(Boolean).join(" "),
					secondaryLabel: e.description,
					icon: m(e),
					iconColor: e.color ? `${e.color}.500` : void 0,
					isDisabled: e.disabled,
					isSelected: e.id === E.defaultValue
				})),
				selectedLabel: t?.name ?? E.placeholder ?? `Select ${E.name.toLowerCase()}`,
				selectedIcon: m(t),
				ariaLabel: E.name,
				disabled: !N,
				showSearch: E.searchable,
				searchPlaceholder: E.searchPlaceholder ?? `Search ${E.name.toLowerCase()}…`,
				emptyState: /* @__PURE__ */ f(u.Item, {
					value: "group-empty",
					disabled: !0,
					asChild: !0,
					children: /* @__PURE__ */ f(a, {
						asChild: !0,
						variant: "full-width",
						id: "group-empty",
						label: E.emptyText ?? `No ${E.name.toLowerCase()} found`,
						disabled: !0
					})
				}),
				onSelect: (e) => M?.(e.id)
			} : void 0
		});
	}
	return /* @__PURE__ */ p(u.Root, {
		closeOnSelect: !y,
		children: [/* @__PURE__ */ f(u.Trigger, {
			asChild: !0,
			children: I
		}), /* @__PURE__ */ f(d, { children: /* @__PURE__ */ f(u.Positioner, { children: /* @__PURE__ */ f(u.Content, { children: _.map((t) => {
			let n = v.includes(t.id);
			return /* @__PURE__ */ f(u.Item, {
				value: t.id,
				disabled: t.disabled,
				onSelect: () => j(t.id),
				asChild: !0,
				children: /* @__PURE__ */ f(a, {
					asChild: !0,
					variant: "full-width",
					role: y ? "menuitemcheckbox" : "menuitemradio",
					"aria-checked": n,
					label: t.name,
					icon: h(t, "16px"),
					tooltip: t.description,
					disabled: t.disabled,
					isSelected: n,
					endContent: n ? /* @__PURE__ */ f(c, {
						as: e,
						boxSize: "3.5",
						color: "fg"
					}) : void 0
				})
			}, t.id);
		}) }) }) })]
	});
};
export { h as n, g as t };
