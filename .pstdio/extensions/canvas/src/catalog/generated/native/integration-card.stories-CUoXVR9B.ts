// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./slack-BVfL7J8A.ts";
import { t as n } from "./github--jDPcRoW.ts";
import { t as r } from "./integration-card-7_TuiIUj.ts";
import { Box as i } from "@chakra-ui/react";
import { jsx as a } from "react/jsx-runtime";
// packages/ui/src/components/primitives/integration-card.stories.tsx
var o = {
	title: "Components/Data Display/Integration Card",
	component: r,
	decorators: [(e) => /* @__PURE__ */ a(i, {
		padding: "sm",
		background: "bg",
		maxWidth: "640px",
		children: /* @__PURE__ */ a(e, {})
	})],
	args: {
		icon: /* @__PURE__ */ a(n, {}),
		name: "GitHub",
		version: "1.2.0",
		description: "Link repositories and track code changes.",
		id: "github",
		active: !1
	}
}, s = { render: (e) => /* @__PURE__ */ a(r, { ...e }) }, c = {
	args: {
		icon: /* @__PURE__ */ a(t, {}),
		name: "Slack",
		description: "Get notifications and updates in Slack channels.",
		id: "slack",
		active: !0
	},
	render: (e) => /* @__PURE__ */ a(r, { ...e })
}, l = {
	args: {
		icon: /* @__PURE__ */ a(e, {}),
		name: "Figma",
		description: "Preview designs and sync assets from Figma.",
		id: "figma",
		category: "Paid"
	},
	render: (e) => /* @__PURE__ */ a(r, { ...e })
};
export { c as Active, s as Default, l as Paid, o as default };
