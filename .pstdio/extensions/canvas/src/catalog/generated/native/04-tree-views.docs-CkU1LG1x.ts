// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { TreeRenderer as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/tree-renderer.tsx?raw
var d = "import { Stack, Text } from \"@chakra-ui/react\";\nimport type { PageRef } from \"@pstdio/sdk/extensions\";\nimport { createWorkbench, type WorkbenchCore } from \"@pstdio/workbench\";\n\nconst navigationPages = [\n  { id: \"search\", title: \"Search\", icon: \"Search\" },\n  { id: \"sessions\", title: \"Sessions\", icon: \"MessagesSquare\" },\n  { id: \"tickets\", title: \"Tickets\", icon: \"Ticket\" },\n  { id: \"settings\", title: \"Settings\", icon: \"Settings\" },\n] as const;\nconst pageRef = (id: string): PageRef => ({ extensionId: \"host\", kind: \"page\", id });\nconst pageTarget = (id: string) => ({ kind: \"page\" as const, page: pageRef(id) });\nconst registerNavigationPage = (workbench: WorkbenchCore, page: (typeof navigationPages)[number]) => {\n  const contributionId = `host.project-navigation.${page.id}`;\n  workbench.views.registerView({\n    id: contributionId,\n    title: page.title,\n    body: {\n      kind: \"react\",\n      render: () => (\n        <Stack h=\"full\" gap=\"sm\" p=\"lg\" bg=\"bg\">\n          <Text textStyle=\"heading/M/semibold\">{page.title}</Text>\n          <Text color=\"fg.muted\">This page was opened by the tree renderer.</Text>\n        </Stack>\n      ),\n    },\n  });\n  workbench.pages.registerPage({\n    id: contributionId,\n    ref: pageRef(page.id),\n    title: page.title,\n    path: page.id,\n    modeId: \"project\",\n    main: {\n      kind: \"view\",\n      view: {\n        kind: \"view\",\n        id: contributionId,\n      },\n      cardinality: \"one\",\n    },\n    slots: [],\n  });\n};\nexport const createTreeWorkbench = () => {\n  const workbench = createWorkbench({ startPage: pageRef(\"search\") });\n  workbench.modes.registerMode({ id: \"project\", label: \"Project\", activate: () => undefined });\n  for (const page of navigationPages) registerNavigationPage(workbench, page);\n  workbench.views.registerView({\n    id: \"host.project-navigation\",\n    title: \"Project navigation\",\n    body: {\n      kind: \"tree\",\n      defaultExpandedSectionIds: [\"project\"],\n      getHeader: () => [\n        {\n          id: \"search\",\n          nodes: [\n            {\n              id: \"search\",\n              label: \"Search\",\n              icon: \"Search\",\n              target: pageTarget(\"search\"),\n            },\n          ],\n        },\n      ],\n      getBody: () => [\n        {\n          id: \"project\",\n          label: \"Project\",\n          nodes: [\n            {\n              id: \"sessions\",\n              label: \"Sessions\",\n              icon: \"MessagesSquare\",\n              target: pageTarget(\"sessions\"),\n            },\n            {\n              id: \"tickets\",\n              label: \"Tickets\",\n              icon: \"Ticket\",\n              target: pageTarget(\"tickets\"),\n            },\n          ],\n        },\n      ],\n      getFooter: () => [\n        {\n          id: \"account\",\n          nodes: [\n            {\n              id: \"settings\",\n              label: \"Settings\",\n              icon: \"Settings\",\n              target: pageTarget(\"settings\"),\n            },\n          ],\n        },\n      ],\n      getChildren: () => [],\n    },\n  });\n  workbench.modePlacements.registerPlacement({\n    id: \"host.project-navigation\",\n    ref: { extensionId: \"host\", kind: \"placement\", id: \"project-navigation\" },\n    modeId: \"project\",\n    item: {\n      kind: \"view\",\n      presence: \"fixed\",\n      view: {\n        kind: \"view\",\n        id: \"host.project-navigation\",\n      },\n    },\n    region: \"sidenav\",\n  });\n  workbench.pageLocations.switchProject(\"storybook\");\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/04-tree-views.docs.mdx
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
			name: "5. Tree navigation"
		}),
		"\n",
		l(i.h1, { children: "5. Add structured navigation" }),
		"\n",
		u(i.p, { children: [
			"This story registers the tree through the Core API. Extensions declare the same data through a ",
			l(i.code, { children: "tree" }),
			" view body."
		] }),
		"\n",
		l(i.p, { children: "The tree renderer owns hierarchy, expansion, selection, customization, and drag-and-drop. Extensions contribute tree\ndata instead of rebuilding those interactions." }),
		"\n",
		l(i.p, { children: "Press Sessions, Tickets, or Settings. Each row navigates to a registered page and replaces Main. After visiting two\npages, use the workbench Back and Forward buttons to move through the same page history." }),
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
		l(i.p, { children: "The outer setup prepares the workbench:" }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "createWorkbench({ startPage })" }), " creates the service container and names the page to open first."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "workbench.modes.registerMode(...)" }),
				" declares the ",
				l(i.code, { children: "project" }),
				" mode. ",
				l(i.code, { children: "id" }),
				" is the mode identity, ",
				l(i.code, { children: "label" }),
				" is its\nuser-facing name, and ",
				l(i.code, { children: "activate" }),
				" runs when the mode becomes active. This example needs no activation work."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "workbench.pageLocations.switchProject(...)" }), " selects the active project. Navigation needs an active project before\nit can commit a page location."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "pageRef" }),
				" and ",
				l(i.code, { children: "pageTarget" }),
				" are local helpers. ",
				l(i.code, { children: "pageRef" }),
				" builds the public page reference\n",
				l(i.code, { children: "{ extensionId, kind: \"page\", id }" }),
				". ",
				l(i.code, { children: "pageTarget" }),
				" wraps it in the page NavigationTarget ",
				l(i.code, { children: "{ kind: \"page\", page }" }),
				"."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "workbench.pages.registerPage(...)" }), " registers one page per navigation row:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable identity of this page registration."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "ref" }), " is the public page reference. Navigation targets address the page through this value."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "title" }), " is the user-facing page name."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "path" }), " is the URL path segment for the page location."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "modeId" }), " names the mode that owns the page. Opening the page activates that mode."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "main: { kind: \"view\", view, cardinality: \"one\" }" }),
				" renders the page content. ",
				l(i.code, { children: "slots" }),
				" contains additional panels."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			"The tree ",
			l(i.code, { children: "body" }),
			" inside ",
			l(i.code, { children: "ctx.views.registerView(...)" }),
			" supplies the tree data:"
		] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "body.kind: \"tree\"" }), " asks the built-in tree renderer to draw this View."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "defaultExpandedSectionIds" }), " lists the section ids that start expanded."] }),
			"\n",
			u(i.li, { children: [
				"Optional ",
				l(i.code, { children: "getStructure" }),
				" returns synchronous body sections before content reads begin. Set ",
				l(i.code, { children: "loading: true" }),
				" on pending sections. The host commits the layout before starting content reads; the final body replaces these sections. Extensions use the serializable ",
				l(i.code, { children: "body.structure" }),
				" declaration instead."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "getHeader" }),
				", ",
				l(i.code, { children: "getBody" }),
				", and ",
				l(i.code, { children: "getFooter" }),
				" each return a list of section groups. Header and footer sections stay\npinned. Body sections use the available scrolling area. A tree may return more than one group in any of the three\nslots."
			] }),
			"\n",
			u(i.li, { children: [
				"each section has an ",
				l(i.code, { children: "id" }),
				", an optional ",
				l(i.code, { children: "label" }),
				", and its ",
				l(i.code, { children: "nodes" }),
				"."
			] }),
			"\n",
			u(i.li, { children: [
				"each node has an ",
				l(i.code, { children: "id" }),
				", a ",
				l(i.code, { children: "label" }),
				", an optional ",
				l(i.code, { children: "icon" }),
				" name, and a ",
				l(i.code, { children: "target" }),
				"."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "target" }), " is a NavigationTarget. Every row here uses a page target. The workbench owns navigation and history, so\nthe tree does not need a custom navigation command."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "getChildren" }), " returns the nested rows under a node. This tree is flat, so it returns an empty list."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "workbench.modePlacements.registerPlacement(...)" }), " places the tree in the Sidenav:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable identity of this placement registration."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "ref" }), " is the public placement reference. Navigation targets and keybindings can address the placement through it."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "modeId" }), " names the mode that owns the placement. The placement appears only while that mode is active."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.kind: \"view\"" }), " says this is one static View rather than a resource-bound set of instances."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.view" }), " names the registered View to render."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.presence: \"fixed\"" }), " keeps the tree open while the mode is active. The user cannot close it and the Add panel\ndoes not offer it."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "region" }),
				" puts the placement in the ",
				l(i.code, { children: "sidenav" }),
				" region."
			] }),
			"\n",
			l(i.li, { children: "Sidenav sections are navigation chrome. Content tabs use Main, Side, and Secondary and can move between them." }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "Owners can restrict drop targets in their tree data. The renderer applies that policy; it does not hard-code\nextension or mode ownership rules." })
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
