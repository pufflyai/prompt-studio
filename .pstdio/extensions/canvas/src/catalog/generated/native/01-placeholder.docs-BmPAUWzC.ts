// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { Placeholder as a, t as o } from "./onboarding.stories-Now-_M4N.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/placeholder.tsx?raw
var d = "import { Stack, Text } from \"@chakra-ui/react\";\nimport { createWorkbench } from \"../../../core\";\n\nexport const createPlaceholderWorkbench = () => {\n  const workbench = createWorkbench();\n  workbench.registerModule({\n    id: \"host.empty-state\",\n    activate(ctx) {\n      ctx.views.registerView({\n        id: \"host.empty-state\",\n        title: \"Empty main\",\n        body: {\n          kind: \"react\",\n          render: () => (\n            <Stack h=\"full\" align=\"center\" justify=\"center\" gap=\"xs\" bg=\"bg\">\n              <Text textStyle=\"heading/M/semibold\">Nothing is open</Text>\n              <Text color=\"fg.muted\">Open a tool to replace this placeholder.</Text>\n            </Stack>\n          ),\n        },\n      });\n      ctx.placeholders.registerPlaceholder({\n        id: \"host.empty-state\",\n        viewId: \"host.empty-state\",\n        region: \"main\",\n      });\n    },\n  });\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/01-placeholder.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		ul: "ul",
		...t.components
	};
	return u(c, { children: [
		l(n, {
			of: o,
			name: "1. Placeholder"
		}),
		"\n",
		l(i.h1, { children: "1. Give an empty region a useful state" }),
		"\n",
		l(i.p, { children: "This is a Core API feature for the host shell. Extensions cannot register placeholders." }),
		"\n",
		l(i.p, { children: "A placeholder is shown only while its region has no open panel. Use it for guidance, not for page content. The shell\nremoves it automatically as soon as a real panel opens in the same region." }),
		"\n",
		l(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		l(i.h2, { children: "Complete example" }),
		"\n",
		l(e, {
			code: d,
			language: "tsx"
		}),
		"\n",
		l(i.h2, { children: "What each field means" }),
		"\n",
		l(i.p, { children: "The outer setup creates and owns the module:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "createWorkbench()" }), " creates one workbench service container."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "registerModule(...)" }), " groups registrations under one owner so the workbench can remove them together."] }),
			"\n",
			u(i.li, { children: [
				"the module ",
				l(i.code, { children: "id" }),
				" is that owner's stable identity."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "activate(ctx)" }),
				" runs once when the host installs the module. ",
				l(i.code, { children: "ctx" }),
				" exposes the Core contribution APIs."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.views.registerView(...)" }), " defines the placeholder content:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable View identity. The placeholder refers to this value."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "title" }), " is the default user-facing label."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "body.kind: \"react\"" }), " allows trusted host code to return React."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "render" }), " creates the content each time the placeholder becomes visible."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.placeholders.registerPlaceholder(...)" }), " shows that View while a region is empty:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable identity of this placeholder registration."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "viewId" }), " names the registered View to render."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "region" }),
				" selects the region to watch. The placeholder renders only while ",
				l(i.code, { children: "main" }),
				" has no open panel."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			l(i.code, { children: "Stack" }),
			" and ",
			l(i.code, { children: "Text" }),
			" come from the UI component library. They style the React body and are not part of the placeholder\nAPI."
		] }),
		"\n",
		u(i.p, { children: [
			"The View and the placeholder share the id ",
			l(i.code, { children: "host.empty-state" }),
			" here for clarity. They remain separate registrations."
		] })
	] });
}
function p(e = {}) {
	let { wrapper: t } = e.components || {};
	return t ? l(t, {
		...e,
		children: l(f, { ...e })
	}) : f(e);
}
function m() {
	return s(t, {
		component: p,
		annotations: i
	});
}
export { m as default };
