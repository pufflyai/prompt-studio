// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./data-table-BpTupEfR.ts";
import { Box as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table-color-scale.stories.tsx
var r = [
	{
		Team: "North",
		Completion: 0,
		Variance: -100,
		Health: 12
	},
	{
		Team: "South",
		Completion: 20,
		Variance: -60,
		Health: 34
	},
	{
		Team: "East",
		Completion: 40,
		Variance: -20,
		Health: 49
	},
	{
		Team: "West",
		Completion: 60,
		Variance: 20,
		Health: 63
	},
	{
		Team: "Central",
		Completion: 80,
		Variance: 60,
		Health: 82
	},
	{
		Team: "International",
		Completion: 100,
		Variance: 100,
		Health: 96
	}
], i = [
	{
		Project: "Website launch",
		Owner: "Maya",
		Status: "On track"
	},
	{
		Project: "Mobile refresh",
		Owner: "Noah",
		Status: "At risk"
	},
	{
		Project: "Billing migration",
		Owner: "Ava",
		Status: "Blocked"
	},
	{
		Project: "Customer research",
		Owner: "Leo",
		Status: "Complete"
	},
	{
		Project: "Partner rollout",
		Owner: "Mia",
		Status: "On track"
	}
], a = {
	title: "Components/Data Display/Data Table",
	component: e
}, o = (e, t) => ({
	light: e,
	dark: t
}), s = (r) => /* @__PURE__ */ n(t, {
	width: "100%",
	maxWidth: "880px",
	height: "440px",
	marginX: "auto",
	padding: "sm",
	background: "bg",
	children: /* @__PURE__ */ n(e, { ...r })
}), c = {
	args: {
		data: r,
		fullWidth: !0,
		columnRenderers: {
			Completion: {
				type: "color-scale",
				stops: [{
					value: 0,
					color: o("#fee2e2", "#580707")
				}, {
					value: 100,
					color: o("#bbf7d0", "#003110")
				}]
			},
			Variance: {
				type: "color-scale",
				stops: [
					{
						value: -100,
						color: o("#bfdbfe", "#002862")
					},
					{
						value: 0,
						color: o("#f3f4f6", "#33363e")
					},
					{
						value: 100,
						color: o("#fecaca", "#580707")
					}
				]
			},
			Health: {
				type: "color-scale",
				stops: [
					{
						value: 0,
						color: o("#fecaca", "#580707")
					},
					{
						value: 50,
						color: o("#fde68a", "#644e00")
					},
					{
						value: 100,
						color: o("#bbf7d0", "#003110")
					}
				]
			}
		},
		columnStats: { Health: { type: "histogram" } },
		toolbarStorageKey: "storybook-data-table-color-scales"
	},
	render: s
}, l = {
	args: {
		data: i,
		fullWidth: !0,
		columnRenderers: { Status: {
			type: "categorical-color",
			categories: [
				{
					value: "On track",
					color: o("#bbf7d0", "#003110")
				},
				{
					value: "At risk",
					color: o("#fde68a", "#644e00")
				},
				{
					value: "Blocked",
					color: o("#fecaca", "#580707")
				},
				{
					value: "Complete",
					color: o("#bfdbfe", "#002862")
				}
			]
		} },
		columnStats: { Status: {
			type: "top-values",
			limit: 3
		} },
		toolbarStorageKey: "storybook-data-table-categorical-colors"
	},
	render: s
};
export { l as CategoricalColors, c as ColorScales, a as default };
