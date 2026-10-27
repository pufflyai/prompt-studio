// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./auto-build.story-fixture-B2DuqMiC.ts";
import { t } from "./auto-build-help-BidMmd9N.ts";
import { AutoBuildForm as n } from "./auto-build-form-ByHaWJ-4.ts";
import { Dialog as r, HStack as i, Portal as a } from "@chakra-ui/react";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
// extensions/pstdio-planner/src/timeline/view/auto-build-form.stories.tsx
function c(e) {
	let { children: n } = e;
	return /* @__PURE__ */ o(r.Root, {
		defaultOpen: !0,
		size: "lg",
		scrollBehavior: "inside",
		children: /* @__PURE__ */ s(a, { children: [/* @__PURE__ */ o(r.Backdrop, {}), /* @__PURE__ */ o(r.Positioner, { children: /* @__PURE__ */ s(r.Content, { children: [/* @__PURE__ */ o(r.Header, { children: /* @__PURE__ */ s(i, {
			gap: "xs",
			children: [/* @__PURE__ */ o(r.Title, { children: "Auto Build" }), /* @__PURE__ */ o(t, { t: (e, t) => t ?? e })]
		}) }), n] }) })] })
	});
}
var l = {
	title: "Extensions/Planner/Auto Build form",
	component: n,
	decorators: [(e) => /* @__PURE__ */ o(c, { children: /* @__PURE__ */ o(e, {}) })],
	args: {
		...e,
		onClose: () => {},
		t: (e, t) => t ?? e
	}
}, u = {}, d = { args: { supervisorModel: {
	harnessId: "codex",
	model: "example-model"
} } }, f = { args: { prompt: "" } }, p = { args: { saving: !0 } }, m = { args: { error: "Agent unavailable" } }, h = { args: { eligible: {
	conjunction: "and",
	rules: []
} } }, g = { args: { eligible: {
	conjunction: "and",
	rules: [{
		attributeId: "title",
		condition: "contains",
		value: "calculator"
	}]
} } };
export { h as AllEligibleTickets, f as EmptyPrompt, m as Failure, p as Saving, d as SelectedSupervisorModel, u as SupervisorAndEligibleTickets, g as TextFilter, l as default };
