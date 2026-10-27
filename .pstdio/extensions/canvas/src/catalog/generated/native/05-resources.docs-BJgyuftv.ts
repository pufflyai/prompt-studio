// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { ResourceBackedPanel as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { createElement as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/resource-panel.tsx?raw
var d = "import { Button, Code, HStack, Stack, Text } from \"@chakra-ui/react\";\nimport { resourceKey } from \"@pstdio/sdk/extensions\";\nimport { createWorkbench, type ResourceRef, type WorkbenchPanelRegion } from \"../../../core\";\n\nconst guidePlacementId = \"host.resource-guide\";\nconst openNextGuideCommandId = \"host.resource-guide.open-next\";\nconst guides = [\n  {\n    type: \"guide\",\n    id: \"getting-started\",\n    label: \"Getting started\",\n  },\n  {\n    type: \"guide\",\n    id: \"views\",\n    label: \"Views and placements\",\n  },\n  {\n    type: \"guide\",\n    id: \"resources\",\n    label: \"Resource identity\",\n  },\n] as const satisfies readonly ResourceRef[];\nexport const createResourceWorkbench = () => {\n  const workbench = createWorkbench();\n  workbench.registerModule({\n    id: \"host.resource-guide\",\n    activate(ctx) {\n      const nextGuide = () => {\n        const openGuides = new Set(\n          Object.values(ctx.layout.getLayout().regions)\n            .flatMap((region) => region.widgets)\n            .filter(\n              (widget) =>\n                widget.placementIdentity?.kind === \"shell\" && widget.placementIdentity.placementId === guidePlacementId,\n            )\n            .map((widget) => resourceKey(widget.resource)),\n        );\n        return guides.find((guide) => !openGuides.has(resourceKey(guide)));\n      };\n      const openGuide = (resource: ResourceRef, region?: WorkbenchPanelRegion) =>\n        ctx.shellPlacements.openPlacement({\n          placementId: guidePlacementId,\n          resource,\n          title: resource.label,\n          open: \"pin\",\n          region,\n        });\n      ctx.resources.registerKind({ kind: \"guide\", label: \"Guide\", icon: \"BookOpen\" });\n      ctx.views.registerView({\n        id: guidePlacementId,\n        title: \"Open another guide\",\n        body: {\n          kind: \"react\",\n          render: ({ instance }) => (\n            <Stack h=\"full\" gap=\"sm\" p=\"lg\" bg=\"bg\">\n              <Text textStyle=\"heading/M/semibold\">{instance.resource?.label}</Text>\n              <Text color=\"fg.muted\">\n                Each button sends a different resource to the same placement. Reopening a guide selects its existing\n                tab.\n              </Text>\n              <Code alignSelf=\"flex-start\">{resourceKey(instance.resource)}</Code>\n              <HStack gap=\"sm\" flexWrap=\"wrap\" pt=\"sm\">\n                {guides.map((guide) => (\n                  <Button key={resourceKey(guide)} size=\"sm\" variant=\"outline\" onClick={() => openGuide(guide)}>\n                    Open {guide.label}\n                  </Button>\n                ))}\n              </HStack>\n              <Text color=\"fg.muted\" textStyle=\"paragraph/XS/regular\">\n                The + button opens the next closed guide. It disappears when all three guides are open.\n              </Text>\n            </Stack>\n          ),\n        },\n      });\n      ctx.commands.registerCommand(\n        {\n          id: openNextGuideCommandId,\n          label: \"Open another guide\",\n          category: \"Guides\",\n          icon: \"BookOpen\",\n        },\n        {\n          isEnabled: () => Boolean(nextGuide()),\n          execute: (_args, context) => {\n            const guide = nextGuide();\n            if (guide) return openGuide(guide, context?.region);\n          },\n        },\n      );\n      ctx.shellPlacements.registerPlacement({\n        id: guidePlacementId,\n        item: {\n          kind: \"binding\",\n          binding: {\n            kinds: [\n              {\n                kind: \"resource-kind\",\n                id: \"guide\",\n              },\n            ],\n            view: {\n              kind: \"view\",\n              id: guidePlacementId,\n            },\n            cardinality: \"many\",\n            add: { kind: \"command\", target: { command: { kind: \"command\", id: openNextGuideCommandId } } },\n          },\n        },\n        region: \"main\",\n      });\n      openGuide(guides[0]);\n    },\n  });\n  return workbench;\n};\n";
// packages/pstdio-workbench/src/examples/onboarding/05-resources.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return u(c, { children: [
		l(n, {
			of: o,
			name: "6. Resource-backed panel"
		}),
		"\n",
		l(i.h1, { children: "6. Open domain objects as resources" }),
		"\n",
		l(i.p, { children: "This story uses the Core API to register a resource kind, a View, and a resource-bound shell placement." }),
		"\n",
		l(i.p, { children: "A resource is stable domain identity: a file, ticket, session, or another object a user can open. Passing it to a\nplacement lets the View load the right data and lets the workbench reuse the right instance. When the module\nactivates, it opens the Getting started guide as a pinned tab in Main." }),
		"\n",
		u(i.p, { children: [
			"Press any ",
			l(i.strong, { children: "Open" }),
			" button to add or select a guide tab. The + menu in the Main tab bar now has an ",
			l(i.strong, { children: "Open another guide" }),
			"\naction. It opens the next closed guide through the same resource placement. The + button disappears when all three\nguides are open. Close one tab and the button returns."
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
		u(i.p, { children: [
			"Each entry in ",
			l(i.code, { children: "guides" }),
			" is a ",
			l(i.code, { children: "ResourceRef" }),
			", the value that identifies one domain object:"
		] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "type" }),
				" groups objects of the same kind. The placement accepts only ",
				l(i.code, { children: "guide" }),
				" resources."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "type" }),
				" and ",
				l(i.code, { children: "id" }),
				", together with any extension and project owner, identify this object. Instance reuse follows that identity."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the short identity inside the kind."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "label" }), " is the user-facing name of the object."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			"The module setup is the same as in the earlier guides: ",
			l(i.code, { children: "createWorkbench()" }),
			" creates the container,\n",
			l(i.code, { children: "registerModule(...)" }),
			" groups the registrations under one owner, and ",
			l(i.code, { children: "activate(ctx)" }),
			" runs once with the Core\ncontribution APIs."
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.resources.registerKind(...)" }), " declares the resource kind:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "kind" }),
				" is the kind identity. It must match the ",
				l(i.code, { children: "type" }),
				" on the resources that open here."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "label" }), " is the user-facing name of the kind."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "icon" }), " is the icon name shown for objects of this kind."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.views.registerView(...)" }), " defines the panel content:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable View identity. The placement refers to this value."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "title" }), " is the default label. Each opened instance may carry a more specific title."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "body.kind: \"react\"" }), " allows trusted host code to return React."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "render" }),
				" receives the render input for one instance. ",
				l(i.code, { children: "instance.resource" }),
				" carries the resource that instance opened,\nso the View reads ",
				l(i.code, { children: "label" }),
				" and its identity from it instead of holding its own state."
			] }),
			"\n",
			u(i.li, { children: [
				"each button calls ",
				l(i.code, { children: "openGuide(...)" }),
				" with a different resource. Reopening a guide selects the tab already bound to its\nidentity."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.commands.registerCommand(...)" }), " gives the placement's + menu a real action:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "openNextGuideCommandId" }), " identifies the action."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "nextGuide()" }), " reads the open instances from the layout and finds the first guide that is closed."] }),
			"\n",
			u(i.li, { children: [
				"the handler calls ",
				l(i.code, { children: "openGuide(...)" }),
				" with that guide. ",
				l(i.code, { children: "isEnabled" }),
				" returns false when none remain."
			] }),
			"\n",
			l(i.li, { children: "the + menu offers command targets only while their commands are visible and enabled." }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.binding.add" }), " links the resource placement to that command. Without an Add action or an accepted active resource, a\nresource placement has nothing to open from the + menu."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [l(i.code, { children: "ctx.shellPlacements.registerPlacement(...)" }), " binds the View to the resource kind:"] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "id" }), " is the stable identity of this shell-owned placement."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.kind: \"binding\"" }), " says this placement hosts one instance per opened resource rather than one static View."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.binding.view" }), " names the View that renders each resource instance."] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "item.binding.kinds" }), " lists the kinds this placement accepts."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "item.binding.cardinality" }),
				" is required. ",
				l(i.code, { children: "\"many\"" }),
				" gives each resource identity its own instance, and reopening a resource selects the\nexisting tab. ",
				l(i.code, { children: "\"one\"" }),
				" would keep a single instance and rebind it when another resource opens. Cardinality does not\ncontrol initial visibility or closability: resource placements start empty, and resource tabs are always closable."
			] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "region" }),
				" puts the instances in ",
				l(i.code, { children: "main" }),
				"."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: [
			l(i.code, { children: "openGuide(...)" }),
			" calls ",
			l(i.code, { children: "ctx.shellPlacements.openPlacement(...)" }),
			" for one instance:"
		] }),
		"\n",
		u(i.ul, { children: [
			"\n",
			u(i.li, { children: [l(i.code, { children: "placementId" }), " names the registered placement to open."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "resource" }),
				" is the selected ",
				l(i.code, { children: "ResourceRef" }),
				"."
			] }),
			"\n",
			u(i.li, { children: [l(i.code, { children: "title" }), " sets the tab title for this instance."] }),
			"\n",
			u(i.li, { children: [
				l(i.code, { children: "open: \"pin\"" }),
				" opens a pinned tab. ",
				l(i.code, { children: "\"preview\"" }),
				" would open a reusable preview tab instead. Open intent applies only\nto ",
				l(i.code, { children: "cardinality: \"many\"" }),
				"."
			] }),
			"\n"
		] }),
		"\n",
		l(i.p, { children: "Use page navigation when opening the resource must also establish a routed location." })
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
