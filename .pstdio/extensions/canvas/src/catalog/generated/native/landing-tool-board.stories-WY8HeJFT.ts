// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import "./assembly-layout-BE5FCzRo.ts";
import { t as e } from "./tool-board-DXXhX-ON.ts";
import { jsx as t } from "react/jsx-runtime";
// clients/landing-page/src/theme/recipes/landing-tool-board.stories.tsx
var n = {
	title: "Theme/Progressive Tool Board",
	component: e,
	parameters: { layout: "centered" },
	args: {
		x: 0,
		y: 0,
		scale: 1,
		unitScale: 1,
		view: {
			example: "icons",
			parts: []
		}
	},
	decorators: [(e, { args: n }) => /* @__PURE__ */ t("svg", {
		width: 640 * (n.unitScale ?? 1) * (n.scale ?? 1),
		height: 384 * (n.unitScale ?? 1) * (n.scale ?? 1) + 78,
		viewBox: `0 0 ${640 * (n.unitScale ?? 1) * (n.scale ?? 1)} ${384 * (n.unitScale ?? 1) * (n.scale ?? 1) + 78}`,
		"aria-label": "Tool assembly preview",
		children: /* @__PURE__ */ t(e, {})
	})]
}, r = {}, i = { args: { view: {
	example: "icons",
	parts: ["page"]
} } }, a = {
	args: { view: {
		example: "icons",
		parts: ["page", "editor"]
	} },
	parameters: { docs: { description: { story: "The inspector centers its glyph in a taller preview, including compact boards." } } }
}, o = { args: { view: {
	example: "icons",
	parts: [
		"page",
		"editor",
		"command"
	]
} } }, s = { args: {
	scale: .5,
	view: {
		example: "icons",
		parts: [
			"page",
			"editor",
			"command"
		]
	}
} }, c = { args: {
	scale: 1.8,
	view: {
		example: "icons",
		parts: [
			"page",
			"editor",
			"command"
		]
	}
} }, l = { args: {
	scale: 1.6,
	unitScale: 1.25,
	view: {
		example: "icons",
		parts: [
			"page",
			"editor",
			"command"
		]
	}
} }, u = { args: { view: {
	example: "shaders",
	parts: [
		"page",
		"editor",
		"hook"
	]
} } }, d = { args: {
	scale: 1.8,
	view: {
		example: "shaders",
		parts: [
			"page",
			"editor",
			"hook"
		]
	}
} }, f = { args: { view: {
	example: "agents",
	parts: [
		"page",
		"command",
		"skill",
		"hook",
		"automation"
	]
} } }, p = { args: { view: {
	example: "agents",
	parts: []
} } }, m = { args: {
	scale: .5,
	view: {
		example: "agents",
		parts: []
	}
} }, h = { args: { view: {
	example: "formulas",
	parts: [
		"page",
		"editor",
		"command"
	]
} } };
export { p as AgentSlotOutlines, f as AgentsComplete, r as Empty, h as FormulasComplete, o as IconsComplete, a as InspectorAdded, l as LargeDisplayIcons, c as LargeIconsComplete, d as LargeShadersComplete, m as NarrowFiveSlots, s as NarrowIconsComplete, i as PageAdded, u as ShadersComplete, n as default };
