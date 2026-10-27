// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-387PxPNF.ts";
import { Box as t, Button as n, Container as r, HStack as i, Text as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/param-editor-inspector.stories.tsx
var c = {
	title: "Patterns/Param Editor/Inspector",
	component: e,
	parameters: { layout: "fullscreen" }
}, l = {
	render: (n) => /* @__PURE__ */ o(r, {
		padding: "md",
		children: /* @__PURE__ */ o(t, {
			maxWidth: "360px",
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "xs",
			bg: "bg.subtle",
			overflow: "hidden",
			children: /* @__PURE__ */ o(e, { ...n })
		})
	}),
	args: {
		fullWidth: !0,
		defaultValues: {
			model: "balanced",
			temperature: .4,
			prompt: "Summarize the selected workspace changes.",
			accent: "#0c8ce9",
			publishDate: "2026-07-01",
			visibility: "draft"
		},
		onChange: () => {},
		groups: [
			{
				id: "generation",
				title: "Generation",
				description: "Core prompt and model behavior.",
				collapsible: !0,
				params: [
					{
						id: "model",
						name: "Model",
						type: "selection",
						description: "Generation profile",
						defaultValue: "balanced",
						options: [
							{
								id: "fast",
								name: "Fast"
							},
							{
								id: "balanced",
								name: "Balanced"
							},
							{
								id: "deep",
								name: "Deep"
							}
						]
					},
					{
						id: "temperature",
						name: "Temperature",
						type: "number",
						description: "Sampling variance",
						defaultValue: .4,
						min: 0,
						max: 1,
						step: .1
					},
					{
						id: "prompt",
						name: "Prompt",
						type: "text",
						description: "Instruction template",
						defaultValue: "Summarize the selected workspace changes.",
						singleLine: !1
					}
				]
			},
			{
				id: "appearance",
				title: "Appearance",
				description: "Presentation metadata for generated output.",
				collapsible: !0,
				params: [{
					id: "accent",
					name: "Accent",
					type: "color",
					description: "Primary output color",
					defaultValue: "#0c8ce9"
				}, {
					id: "visibility",
					name: "Visibility",
					type: "property",
					description: "Current publication state",
					value: /* @__PURE__ */ s(i, {
						gap: "xs",
						children: [/* @__PURE__ */ o(a, {
							textStyle: "label/S/regular",
							children: "Draft"
						}), /* @__PURE__ */ o(n, {
							size: "xs",
							variant: "ghost",
							children: "Change"
						})]
					})
				}]
			},
			{
				id: "schedule",
				title: "Schedule",
				description: "Optional delivery settings.",
				collapsible: !0,
				defaultCollapsed: !0,
				params: [{
					id: "publishDate",
					name: "Publish Date",
					type: "date",
					description: "Target publish date",
					defaultValue: "2026-07-01"
				}]
			}
		]
	}
}, u = {
	...l,
	args: {
		...l.args,
		variant: "small"
	}
}, d = {
	render: (n) => /* @__PURE__ */ o(r, {
		padding: "md",
		children: /* @__PURE__ */ o(t, {
			maxWidth: "380px",
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "xs",
			overflow: "hidden",
			children: /* @__PURE__ */ o(e, { ...n })
		})
	}),
	args: {
		readOnly: !0,
		fullWidth: !0,
		params: [
			{
				id: "name",
				name: "Name",
				type: "readOnly",
				value: "Mina Patel"
			},
			{
				id: "verified",
				name: "Verified",
				type: "readOnly",
				value: !0
			},
			{
				id: "phone",
				name: "Phone",
				type: "readOnly",
				value: null
			},
			{
				id: "interests",
				name: "Interests",
				type: "readOnly",
				value: [
					"Design",
					"Travel",
					"Sustainability"
				]
			},
			{
				id: "gallery",
				name: "Gallery",
				type: "readOnly",
				value: {
					type: "image-gallery",
					images: [{
						src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=240",
						alt: "Mountain lake"
					}, {
						src: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=240",
						alt: "Forest"
					}]
				}
			}
		]
	}
};
export { l as GroupedInspector, d as SerializableReadOnlyValues, u as SmallInspector, c as default };
