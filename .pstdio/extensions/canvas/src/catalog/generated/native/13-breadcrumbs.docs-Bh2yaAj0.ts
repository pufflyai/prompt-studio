// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { Breadcrumbs as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/breadcrumbs.tsx?raw
var d = "import { Button, HStack, Stack, Text } from \"@chakra-ui/react\";\nimport type { PageRef } from \"@pstdio/sdk/extensions\";\nimport { createWorkbench } from \"../../../core\";\n\nconst pageRef = (id: string): PageRef => ({ extensionId: \"host.breadcrumb-example\", kind: \"page\", id });\n\ninterface BreadcrumbPage {\n  id: string;\n  ref: PageRef;\n  title: string;\n  icon: string;\n  path: string;\n  parentId?: string;\n}\n\nconst breadcrumbPages: readonly BreadcrumbPage[] = [\n  {\n    id: \"host.breadcrumb.root\",\n    ref: pageRef(\"root\"),\n    title: \"Prompt Studio\",\n    icon: \"FolderGit2\",\n    path: \"review\",\n  },\n  {\n    id: \"host.breadcrumb.pull-requests\",\n    ref: pageRef(\"pull-requests\"),\n    title: \"Pull requests\",\n    icon: \"GitPullRequest\",\n    path: \"review/pull-requests\",\n    parentId: \"host.breadcrumb.root\",\n  },\n  {\n    id: \"host.breadcrumb.pull-request\",\n    ref: pageRef(\"pull-request\"),\n    title: \"#646 Additive pages\",\n    icon: \"GitPullRequest\",\n    path: \"review/pull-requests/646\",\n    parentId: \"host.breadcrumb.pull-requests\",\n  },\n  {\n    id: \"host.breadcrumb.files\",\n    ref: pageRef(\"files\"),\n    title: \"Files changed\",\n    icon: \"Files\",\n    path: \"review/pull-requests/646/files\",\n    parentId: \"host.breadcrumb.pull-request\",\n  },\n  {\n    id: \"host.breadcrumb.file\",\n    ref: pageRef(\"file\"),\n    title: \"workbench-core.ts\",\n    icon: \"FileCode2\",\n    path: \"review/pull-requests/646/files/workbench-core\",\n    parentId: \"host.breadcrumb.files\",\n  },\n];\n\nexport const createBreadcrumbWorkbench = () => {\n  const workbench = createWorkbench({ startPage: breadcrumbPages[0]!.ref });\n  workbench.modes.registerMode({ id: \"review\", label: \"Review\", activate: () => undefined });\n\n  for (const page of breadcrumbPages) {\n    const viewId = `${page.id}.view`;\n    workbench.views.registerView({\n      id: viewId,\n      title: page.title,\n      body: {\n        kind: \"react\",\n        render: ({ workbench }) => (\n          <Stack h=\"full\" gap=\"md\" p=\"lg\" bg=\"bg\">\n            <Stack gap=\"xs\">\n              <Text textStyle=\"heading/M/semibold\">{page.title}</Text>\n              <Text color=\"fg.muted\">\n                This is a real page location. Use Back and Forward in the header to move through the five-page history.\n              </Text>\n            </Stack>\n            <HStack gap=\"sm\" flexWrap=\"wrap\">\n              {breadcrumbPages.map((target) => (\n                <Button\n                  key={target.id}\n                  size=\"sm\"\n                  variant=\"outline\"\n                  disabled={target.id === page.id}\n                  onClick={() => workbench.pageLocations.navigate({ kind: \"page\", page: target.ref })}\n                >\n                  Open {target.title}\n                </Button>\n              ))}\n            </HStack>\n          </Stack>\n        ),\n      },\n    });\n    workbench.pages.registerPage({\n      id: page.id,\n      ref: page.ref,\n      title: page.title,\n      icon: page.icon,\n      path: page.path,\n      modeId: \"review\",\n      parentId: page.parentId,\n      main: { kind: \"view\", view: { kind: \"view\", id: viewId }, cardinality: \"one\" },\n      slots: [],\n    });\n  }\n\n  workbench.pageLocations.switchProject(\"breadcrumb-story\");\n  for (const page of breadcrumbPages.slice(1)) {\n    workbench.pageLocations.navigate({ kind: \"page\", page: page.ref });\n  }\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/13-breadcrumbs.docs.mdx
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
			name: "11. Breadcrumbs"
		}),
		"\n",
		l(i.h1, { children: "11. Navigate a full location trail" }),
		"\n",
		u(i.p, { children: [
			"Breadcrumbs describe the active location and its parents. This story starts at ",
			l(i.code, { children: "workbench-core.ts" }),
			" inside a pull request\nreview. The header shows five levels: Prompt Studio, Pull requests, #646 Additive pages, Files changed, and the current\nfile."
		] }),
		"\n",
		l(i.p, { children: "The story reached the file by navigating through each parent page. That created real history. Press Back in the header\nto return to Files changed. Forward becomes available and returns to the file. Click a breadcrumb ancestor or a button\nin Main to create another history entry." }),
		"\n",
		l(i.p, { children: "For resource hierarchies, register canonical parent edges and derive the breadcrumb trail from those resources. Avoid a\nseparate hierarchy that can disagree with navigation." }),
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
		l(i.p, { children: "The setup creates the workbench and its page mode:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "createWorkbench({ startPage })" }), " creates one workbench and names Prompt Studio as its first page."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "modes.registerMode(...)" }), " registers the Review mode used by all five pages."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "breadcrumbPages" }), " stores the page identity, label, path, icon, and declared parent."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			l(i.code, { children: "workbench.views.registerView(...)" }),
			" and ",
			l(i.code, { children: "workbench.pages.registerPage(...)" }),
			" build each location:"
		] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				"the View uses ",
				l(i.code, { children: "body.kind: \"react\"" }),
				" to render the active location and page buttons."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "main" }),
				" renders the page content; ",
				l(i.code, { children: "resource" }),
				" declares its routed resource constraint."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "parentId" }), " points to the registered parent page. The location controller follows those links to build the breadcrumb\ntrail."] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "The final loop creates the navigation history:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "switchProject(\"breadcrumb-story\")" }), " opens the root page, Prompt Studio."] }),
			"\n",
			u(i.li, { children: [
				"each call to ",
				l(i.code, { children: "pageLocations.navigate(...)" }),
				" opens the next child and pushes a history entry."
			] }),
			"\n",
			u(i.li, { children: [
				"the workbench derives breadcrumbs from the active page and its declared parents. The story never calls\n",
				l(i.code, { children: "breadcrumbs.setItems(...)" }),
				"."
			] }),
			"\n",
			l(i.li, { children: "Back and Forward replay those saved page locations, so the panel content and breadcrumb trail move together." }),
			"\n"
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
