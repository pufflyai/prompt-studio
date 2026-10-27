// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { PreferenceSchemas as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { t as s } from "./module-By0YOr9e.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/16-document-renderer.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		ol: "ol",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: o,
			name: "14. Preference schemas"
		}),
		"\n",
		u(i.h1, { children: "14. Declare settings that features can read" }),
		"\n",
		u(i.p, { children: "A preference is a named setting. A feature reads the setting by name instead of owning a separate settings store." }),
		"\n",
		u(i.p, { children: "The schema declares four facts in one place:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			u(i.li, { children: "the preference name" }),
			"\n",
			u(i.li, { children: "the value type and allowed choices" }),
			"\n",
			u(i.li, { children: "the default value" }),
			"\n",
			u(i.li, { children: "where the selected value is saved" }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The settings UI uses that schema to build controls. Feature code reads the selected value from the preference registry.\nBoth use the same definition, so they cannot disagree about the name, default, or scope." }),
		"\n",
		u(i.p, { children: "Try the example in this order:" }),
		"\n",
		d(i.ol, { children: [
			"\n",
			d(i.li, { children: [
				"Change ",
				u(i.strong, { children: "Editor density" }),
				". The spacing in ",
				u(i.strong, { children: "Editor preview" }),
				" changes."
			] }),
			"\n",
			d(i.li, { children: [
				"Change ",
				u(i.strong, { children: "Default open region" }),
				". The selected region changes under ",
				u(i.strong, { children: "New resources open in" }),
				"."
			] }),
			"\n",
			u(i.li, { children: "Compare the scope badges. Density follows the user everywhere. The open region belongs only to this project." }),
			"\n"
		] }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "When to use this" }),
		"\n",
		u(i.p, { children: "Use a preference for a choice that must survive after the current panel closes, such as density, a default location, or\na feature option. Component state is still the right place for temporary UI state." }),
		"\n",
		d(i.p, { children: [
			"This is the Core API used by an application that embeds the workbench. An extension declares the same kind of setting\nunder ",
			u(i.code, { children: "settings" }),
			" in ",
			u(i.code, { children: "defineExtension" }),
			". The host converts that extension definition into a preference schema."
		] }),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: s,
			language: "tsx"
		}),
		"\n",
		u(i.p, { children: "Use a custom settings panel only when the shared boolean, number, string, choice, array, and object controls cannot\nrepresent the setting." }),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		u(i.p, { children: "The schema declares the contract for each preference:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "properties" }), " maps each preference name to its schema entry. The name is the stable identity feature code reads."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "type" }),
				" is the value type, here ",
				u(i.code, { children: "\"string\"" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "enum" }), " lists the allowed choices."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "default" }), " is the value used before anyone picks one."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "scope" }),
				" says where a choice is saved: ",
				u(i.code, { children: "\"user\"" }),
				" values follow the user everywhere, while ",
				u(i.code, { children: "\"project\"" }),
				" values belong to\none Prompt Studio project."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "description" }), " explains the preference to readers of the schema and to settings UI."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "Scope references select which saved value an operation targets:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "{ scope: \"user\" }" }), " targets the user's own value."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "{ scope: \"project\", scopeId }" }),
				" targets one project's value. ",
				u(i.code, { children: "scopeId" }),
				" names that project."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The module registers the schema and a panel that uses it:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.preferences.registerSchema(...)" }), " publishes the schema so the settings UI and feature code share one\ndefinition."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.views.registerView(...)" }),
				" defines the demo panel. ",
				u(i.code, { children: "body.kind: \"react\"" }),
				" lets host code render React, and\n",
				u(i.code, { children: "render" }),
				" receives the render input for one visible placement."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }),
				" places the View. ",
				u(i.code, { children: "item.kind: \"view\"" }),
				" places one static View,\n",
				u(i.code, { children: "item.view" }),
				" names it, ",
				u(i.code, { children: "item.presence: \"fixed\"" }),
				" keeps it open without a close button, and ",
				u(i.code, { children: "region: \"main\"" }),
				" picks\nthe region."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The panel reads and writes values through the preference registry:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "input.workbench.preferences.getValue(name, scope)" }), " returns the value saved for that scope, or the schema default."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "input.workbench.preferences.setValue(name, value, scope)" }), " saves a new value for that scope."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "useWorkbenchStore(input.workbench.preferences.store, selector)" }),
				" subscribes to registry state. The example selects\n",
				u(i.code, { children: "state.schemas" }),
				" to list the registered entries."
			] }),
			"\n"
		] })
	] });
}
function p(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? u(t, {
		...e,
		children: u(f, { ...e })
	}) : f(e);
}
function m() {
	return c(t, {
		component: p,
		annotations: i
	});
}
export { m as default };
