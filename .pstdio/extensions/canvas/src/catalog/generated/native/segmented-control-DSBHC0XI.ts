// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createSlotRecipeContext as e, defineSlotRecipe as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/theme/recipes/segmented-control.ts
var r = t({
	className: "ps-segmented-control",
	slots: ["root", "item"],
	base: {
		root: {
			display: "inline-flex",
			alignItems: "center",
			gap: "3xs",
			padding: "3xs",
			bg: "bg.subtle",
			borderRadius: "compact",
			borderWidth: "1px",
			borderColor: "border"
		},
		item: {
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			whiteSpace: "nowrap",
			textStyle: "label/S/medium",
			color: "fg.muted",
			bg: "transparent",
			borderRadius: "xs",
			cursor: "pointer",
			transitionProperty: "background-color, color",
			transitionDuration: "fast",
			focusVisibleRing: "outside",
			_hover: { color: "fg" },
			_selected: {
				bg: "bg.inverted",
				color: "fg.inverted"
			},
			_disabled: {
				cursor: "not-allowed",
				opacity: .5,
				_hover: { color: "fg.muted" }
			}
		}
	},
	variants: { size: {
		sm: {
			root: { height: "segmented-control-sm" },
			item: {
				height: "segmented-control-item-sm",
				paddingInline: "compact"
			}
		},
		xs: {
			root: { height: "segmented-control-xs" },
			item: {
				height: "segmented-control-item-xs",
				paddingInline: "xs"
			}
		}
	} },
	defaultVariants: { size: "sm" }
}), { withProvider: i, withContext: a } = e({ recipe: r }), o = i("div", "root"), s = a("button", "item"), c = (e) => {
	let { options: t, value: r, onValueChange: i, disabled: a, "aria-label": c, ...l } = e;
	return /* @__PURE__ */ n(o, {
		role: "group",
		"aria-label": c,
		...l,
		children: t.map((e) => {
			let t = e.value === r;
			return /* @__PURE__ */ n(s, {
				type: "button",
				"aria-pressed": t,
				"data-selected": t ? "" : void 0,
				disabled: a,
				onClick: () => i(e.value),
				children: e.label
			}, e.value);
		})
	});
};
export { c as t };
