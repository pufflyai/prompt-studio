// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { defineExtension as e, defineNavigationItem as t, definePage as n, defineView as r, workbenchModes as i } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/onboarding/extensions/page-extension.ts
var a = [
	{
		id: "guide",
		title: "Getting started",
		content: "Welcome to your first extension. Choose Pages or Views in the sidebar to keep reading."
	},
	{
		id: "pages",
		title: "Pages",
		content: "A page owns the main content and its panels. Opening another page replaces the current page's content."
	},
	{
		id: "views",
		title: "Views",
		content: "A view defines reusable content. This guide uses native file views, so the host renders the Markdown for you."
	}
].map((e) => r({
	id: e.id,
	title: e.title,
	body: {
		kind: "file",
		load: async () => ({
			fileName: `${e.id}.md`,
			content: `# ${e.title}\n\n${e.content}`
		})
	}
})), o = a.map((e) => n({
	id: e.id,
	title: e.title,
	path: e.id,
	mode: i.project,
	main: {
		kind: "view",
		view: e.ref,
		cardinality: "one"
	},
	slots: []
})), s = o[0], c = o.map((e) => t({
	id: e.id,
	owner: i.project,
	slot: "content",
	group: "Learn",
	label: e.title,
	icon: "BookOpen",
	action: {
		kind: "page",
		page: e.ref
	}
})), l = e({
	views: a,
	pages: o,
	navigationItems: c
}), u = "import { defineExtension, defineNavigationItem, definePage, defineView, workbenchModes } from \"@pstdio/sdk/extensions\";\n\nconst topics = [\n  {\n    id: \"guide\",\n    title: \"Getting started\",\n    content: \"Welcome to your first extension. Choose Pages or Views in the sidebar to keep reading.\",\n  },\n  {\n    id: \"pages\",\n    title: \"Pages\",\n    content: \"A page owns the main content and its panels. Opening another page replaces the current page's content.\",\n  },\n  {\n    id: \"views\",\n    title: \"Views\",\n    content:\n      \"A view defines reusable content. This guide uses native file views, so the host renders the Markdown for you.\",\n  },\n];\nconst views = topics.map((topic) =>\n  defineView({\n    id: topic.id,\n    title: topic.title,\n    body: {\n      kind: \"file\",\n      load: async () => ({ fileName: `${topic.id}.md`, content: `# ${topic.title}\\n\\n${topic.content}` }),\n    },\n  }),\n);\nconst pages = views.map((view) =>\n  definePage({\n    id: view.id,\n    title: view.title,\n    path: view.id,\n    mode: workbenchModes.project,\n    main: { kind: \"view\", view: view.ref, cardinality: \"one\" },\n    slots: [],\n  }),\n);\nexport const guidePage = pages[0]!;\nconst navigationItems = pages.map((page) =>\n  defineNavigationItem({\n    id: page.id,\n    owner: workbenchModes.project,\n    slot: \"content\",\n    group: \"Learn\",\n    label: page.title,\n    icon: \"BookOpen\",\n    action: { kind: \"page\", page: page.ref },\n  }),\n);\n\nexport default defineExtension({ views, pages, navigationItems });\n";
export { s as n, l as r, u as t };
