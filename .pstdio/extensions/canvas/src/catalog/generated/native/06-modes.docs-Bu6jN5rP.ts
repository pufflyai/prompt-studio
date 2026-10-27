// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-9wQwzhjL.ts";
import i, { ModeContribution as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/mode-page.tsx?raw
var d = "import { Button, HStack, Stack, Text } from \"@chakra-ui/react\";\nimport type { PageRef } from \"@pstdio/sdk/extensions\";\nimport { createWorkbench, type WorkbenchCore, type WorkbenchPanelRenderInput } from \"@pstdio/workbench\";\n\nconst pageRef = (id: string): PageRef => ({ extensionId: \"host\", kind: \"page\", id });\nconst overviewPage = pageRef(\"overview\");\nconst ticketsPage = pageRef(\"tickets\");\nconst sessionPage = pageRef(\"session\");\ninterface GuidePage {\n  id: string;\n  ref: PageRef;\n  title: string;\n  path: string;\n  modeId: \"project\" | \"session\";\n  pageContribution: string;\n  pageContributionDetail: string;\n  description: string;\n  links: readonly {\n    label: string;\n    page: PageRef;\n  }[];\n}\nconst guidePages: readonly GuidePage[] = [\n  {\n    id: \"overview\",\n    ref: overviewPage,\n    title: \"Project overview\",\n    path: \"overview\",\n    modeId: \"project\",\n    pageContribution: \"Release summary\",\n    pageContributionDetail: \"Milestone v0.31 · 3 changes ready for review\",\n    description: \"Northstar is preparing v0.31. Eight tickets remain open and three are ready for review.\",\n    links: [\n      { label: \"Open Tickets\", page: ticketsPage },\n      { label: \"Open current session\", page: sessionPage },\n    ],\n  },\n  {\n    id: \"tickets\",\n    ref: ticketsPage,\n    title: \"Tickets\",\n    path: \"tickets\",\n    modeId: \"project\",\n    pageContribution: \"Ticket filter\",\n    pageContributionDetail: \"Status: In progress · Milestone: v0.31\",\n    description: \"PS-336 cleans up the workbench API. PS-337 makes supplied extension templates editable.\",\n    links: [\n      { label: \"Open overview\", page: overviewPage },\n      { label: \"Open current session\", page: sessionPage },\n    ],\n  },\n  {\n    id: \"session\",\n    ref: sessionPage,\n    title: \"Current session\",\n    path: \"sessions/current\",\n    modeId: \"session\",\n    pageContribution: \"Session context\",\n    pageContributionDetail: \"Agent: Codex · Task: PS-336 · 7 files changed\",\n    description: \"Session S-104 is implementing the workbench API examples for PS-336.\",\n    links: [{ label: \"Open project overview\", page: overviewPage }],\n  },\n];\nconst ModePageContent = (props: { input: WorkbenchPanelRenderInput; page: GuidePage }) => {\n  const { input, page } = props;\n  return (\n    <Stack h=\"full\" gap=\"md\" p=\"lg\" bg=\"bg\">\n      <Stack gap=\"xs\">\n        <Text textStyle=\"heading/M/semibold\">{page.title}</Text>\n        <Text color=\"fg.muted\">{page.description}</Text>\n      </Stack>\n      <Text>\n        Mode-owned Sidenav: <strong>{page.modeId === \"project\" ? \"Northstar navigation\" : \"Session S-104\"}</strong>\n      </Text>\n      <Text>\n        Page-owned content: <strong>{page.pageContribution}</strong> in Secondary and this panel in Main\n      </Text>\n      <HStack gap=\"sm\" flexWrap=\"wrap\">\n        {page.links.map((link) => (\n          <Button\n            key={link.label}\n            size=\"sm\"\n            onClick={() => input.workbench.pageLocations.navigate({ kind: \"page\", page: link.page })}\n          >\n            {link.label}\n          </Button>\n        ))}\n      </HStack>\n    </Stack>\n  );\n};\nconst registerModeSidenav = (workbench: WorkbenchCore, modeId: GuidePage[\"modeId\"], label: string) => {\n  const contributionId = `host.${modeId}.navigation`;\n  workbench.views.registerView({\n    id: contributionId,\n    title: `${label} navigation`,\n    body: {\n      kind: \"tree\",\n      defaultExpandedSectionIds: [modeId],\n      getBody: () => [\n        {\n          id: modeId,\n          label,\n          nodes: guidePages\n            .filter((page) => page.modeId === modeId)\n            .map((page) => ({\n              id: page.id,\n              label: page.title,\n              target: { kind: \"page\", page: page.ref },\n            })),\n        },\n      ],\n      getChildren: () => [],\n    },\n  });\n  workbench.modePlacements.registerPlacement({\n    id: contributionId,\n    ref: { extensionId: \"host\", kind: \"placement\", id: `${modeId}-navigation` },\n    modeId,\n    item: {\n      kind: \"view\",\n      presence: \"fixed\",\n      view: {\n        kind: \"view\",\n        id: contributionId,\n      },\n    },\n    region: \"sidenav\",\n  });\n};\nconst registerPage = (workbench: WorkbenchCore, page: GuidePage) => {\n  const mainId = `host.${page.id}.main`;\n  const sidenavId = `host.${page.id}.sidenav`;\n  workbench.views.registerView({\n    id: mainId,\n    title: page.title,\n    body: { kind: \"react\", render: (input) => <ModePageContent input={input} page={page} /> },\n  });\n  workbench.views.registerView({\n    id: sidenavId,\n    title: page.pageContribution,\n    body: {\n      kind: \"react\",\n      render: () => (\n        <Stack gap=\"xs\" p=\"md\" bg=\"bg\">\n          <Text textStyle=\"heading/S/semibold\">{page.pageContribution}</Text>\n          <Text>{page.pageContributionDetail}</Text>\n          <Text color=\"fg.muted\">This section belongs to {page.title}. It changes when the page changes.</Text>\n        </Stack>\n      ),\n    },\n  });\n  workbench.pages.registerPage({\n    id: `host.${page.id}`,\n    ref: page.ref,\n    title: page.title,\n    path: page.path,\n    modeId: page.modeId,\n    main: {\n      kind: \"view\",\n      view: {\n        kind: \"view\",\n        id: mainId,\n      },\n      cardinality: \"one\",\n    },\n    slots: [\n      {\n        id: \"tools\",\n        region: \"secondary\",\n        item: {\n          kind: \"view\",\n          view: {\n            kind: \"view\",\n            id: sidenavId,\n          },\n          presence: \"open\",\n        },\n      },\n    ],\n  });\n};\nexport const createModeContributionWorkbench = () => {\n  const workbench = createWorkbench({ startPage: overviewPage });\n  workbench.modes.registerMode({ id: \"project\", label: \"Project\", activate: () => undefined });\n  workbench.modes.registerMode({ id: \"session\", label: \"Session\", activate: () => undefined });\n  registerModeSidenav(workbench, \"project\", \"Northstar project\");\n  registerModeSidenav(workbench, \"session\", \"Session S-104\");\n  for (const page of guidePages) registerPage(workbench, page);\n  workbench.pageLocations.switchProject(\"storybook\");\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/06-modes.docs.mdx
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
	return u(c, { children: [
		l(n, {
			of: o,
			name: "7. Mode and page contributions"
		}),
		"\n",
		l(i.h1, { children: "7. Compose a mode with a page" }),
		"\n",
		l(i.p, { children: "This is the Core API representation that the validated Extension API compiles into." }),
		"\n",
		l(i.p, { children: "A mode contributes context that stays while related pages change. A page contributes content for one location. This\nexample uses a release project, its tickets, and an active coding session so each owner has visible work to do." }),
		"\n",
		l(i.p, { children: "Try these transitions in the story:" }),
		"\n",
		u(i.ol, { children: [
			"\n",
			u(i.li, { children: [
				"Start on Project overview. The Sidenav contains ",
				l(i.strong, { children: "Northstar project" }),
				" navigation.\nThe page's release summary appears in Secondary."
			] }),
			"\n",
			l(i.li, { children: "Open Tickets. Northstar navigation stays, while Secondary shows the ticket filter." }),
			"\n",
			u(i.li, { children: [
				"Open the current session. Both project contributions disappear. ",
				l(i.strong, { children: "Session S-104" }),
				" navigation and session context\nreplace them."
			] }),
			"\n",
			l(i.li, { children: "Use Back and Forward. The workbench restores the complete mode and page composition for each location." }),
			"\n"
		] }),
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
				" declares each mode. ",
				l(i.code, { children: "id" }),
				" is the mode identity, ",
				l(i.code, { children: "label" }),
				" is its user-facing name,\nand ",
				l(i.code, { children: "activate" }),
				" runs when the mode becomes active. This example needs no activation work."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "workbench.pageLocations.switchProject(...)" }), " selects the active project. Navigation needs an active project before\nit can commit a page location."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "registerModeSidenav" }), " contributes the mode-owned navigation:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				"the tree View uses ",
				l(i.code, { children: "body.kind: \"tree\"" }),
				". ",
				l(i.code, { children: "defaultExpandedSectionIds" }),
				" lists the sections that start expanded.\n",
				l(i.code, { children: "getBody" }),
				" returns one section with an ",
				l(i.code, { children: "id" }),
				", a ",
				l(i.code, { children: "label" }),
				", and its ",
				l(i.code, { children: "nodes" }),
				". Each node has an ",
				l(i.code, { children: "id" }),
				", a ",
				l(i.code, { children: "label" }),
				", and a\npage ",
				l(i.code, { children: "target" }),
				", the NavigationTarget ",
				l(i.code, { children: "{ kind: \"page\", page }" }),
				". The project tree lists Overview and Tickets. The\nsession tree lists only the current session. ",
				l(i.code, { children: "getChildren" }),
				" returns an empty list because each tree is flat."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "workbench.modePlacements.registerPlacement(...)" }),
				" places the tree. ",
				l(i.code, { children: "id" }),
				" is the registration identity. ",
				l(i.code, { children: "ref" }),
				" is the\npublic placement reference. ",
				l(i.code, { children: "modeId" }),
				" names the owning mode, so the placement appears only while that mode is active\nand is removed when the mode changes. ",
				l(i.code, { children: "item.kind: \"view\"" }),
				" with ",
				l(i.code, { children: "item.view" }),
				" renders one static View.\n",
				l(i.code, { children: "item.presence: \"fixed\"" }),
				" keeps it open while the mode is active; the user cannot close it. ",
				l(i.code, { children: "region: \"sidenav\"" }),
				" places this navigation chrome in the Sidenav."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "registerPage" }), " contributes each page and the Views it renders:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				"the main View uses ",
				l(i.code, { children: "body.kind: \"react\"" }),
				". Its ",
				l(i.code, { children: "render" }),
				" receives the render input, and ",
				l(i.code, { children: "input.workbench" }),
				" exposes the\ncore services. The buttons call ",
				l(i.code, { children: "input.workbench.pageLocations.navigate({ kind: \"page\", page })" }),
				" to open another\npage and commit one canonical location."
			] }),
			"\n",
			l(i.li, { children: "the tools View is a second React View that renders the page-owned content in Secondary." }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "workbench.pages.registerPage(...)" }),
				" registers the page. ",
				l(i.code, { children: "id" }),
				" is the registration identity. ",
				l(i.code, { children: "ref" }),
				" is the public page\nreference that navigation targets use. ",
				l(i.code, { children: "title" }),
				" is the page name. ",
				l(i.code, { children: "path" }),
				" is the URL path segment. ",
				l(i.code, { children: "modeId" }),
				" names the\nowning mode, so opening the page also activates that mode."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "main: { kind: \"view\", view, cardinality: \"one\" }" }), " renders the page content."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "slots" }),
				" contains the page's Secondary panel with ",
				l(i.code, { children: "region: \"secondary\"" }),
				" and\n",
				l(i.code, { children: "item: { kind: \"view\", view, presence: \"open\" }" }),
				". It starts open and the user may close it.\nSaved user choices apply on the next visit."
			] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "Shared mode placements keep their identity across pages within the mode. Page panels belong to their page location.\nRemoving an owning contribution disposes its instances." }),
		"\n",
		u(i.p, { children: [
			"This host example registers its Sidenav through the Core API. Extension authors contribute sidebar content through\n",
			l(i.code, { children: "navigationItems" }),
			" and ",
			l(i.code, { children: "navigationTrees" }),
			", or replace it with ",
			l(i.code, { children: "mode.chrome.sidenav" }),
			". Extension page slots and mode\nplacements use Main, Side, and Secondary."
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
