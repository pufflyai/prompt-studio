// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { t } from "./workbench-core-N58OeDyx.ts";
import { t as n } from "./workbench-BYYWgWSr.ts";
import { t as r } from "./workbench-theme-provider-CQSyY8qK.ts";
import { n as i } from "./module-D85vQAe8.ts";
import { t as a } from "./module-BQkLCofd.ts";
import { t as o } from "./resource-tabs-example-BZ7CVm_o.ts";
import { t as s } from "./resource-tabs-example-CIi0cDTC.ts";
import { useState as c } from "react";
import { Box as l, Button as u, Code as d, HStack as f, Stack as p, Text as m } from "@chakra-ui/react";
import { jsx as h, jsxs as g } from "react/jsx-runtime";
import { resourceKey as _ } from "@pstdio/sdk/extensions";
// packages/pstdio-workbench/src/examples/api/resource-rebind-example.tsx
var v = "guide.inspector", y = {
	main: {
		type: "branch",
		id: "main",
		label: "main"
	},
	release: {
		type: "branch",
		id: "release",
		label: "release"
	}
}, b = (e, t) => {
	e.shellPlacements.openPlacement({
		placementId: v,
		resource: t,
		title: t.label
	});
}, x = (e) => {
	let { workbench: t } = e;
	return /* @__PURE__ */ g(p, {
		gap: "md",
		p: "lg",
		children: [
			/* @__PURE__ */ h(m, {
				textStyle: "heading/M",
				children: "Branches"
			}),
			/* @__PURE__ */ g(m, {
				color: "fg.muted",
				children: [
					"The inspector declares ",
					/* @__PURE__ */ h("code", { children: "cardinality: \"one\"" }),
					". Opening another branch rebinds the same instance instead of adding a tab."
				]
			}),
			/* @__PURE__ */ g(f, {
				gap: "sm",
				flexWrap: "wrap",
				children: [/* @__PURE__ */ h(u, {
					size: "sm",
					onClick: () => b(t, y.main),
					children: "Inspect main"
				}), /* @__PURE__ */ h(u, {
					size: "sm",
					onClick: () => b(t, y.release),
					children: "Inspect release"
				})]
			})
		]
	});
}, S = () => {
	let e = t();
	return e.views.registerView({
		id: "guide.branches",
		title: "Branches",
		body: {
			kind: "react",
			render: ({ workbench: e }) => /* @__PURE__ */ h(x, { workbench: e })
		}
	}), e.shellPlacements.registerPlacement({
		id: "guide.branches",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "guide.branches"
			}
		},
		region: "main"
	}), e.views.registerView({
		id: "guide.branch-inspector",
		title: "Branch inspector",
		body: {
			kind: "react",
			render: ({ instance: e }) => /* @__PURE__ */ g(p, {
				gap: "sm",
				p: "lg",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "heading/M",
					children: e.resource?.label
				}), /* @__PURE__ */ g(m, {
					color: "fg.muted",
					children: ["Bound resource: ", _(e.resource)]
				})]
			})
		}
	}), e.shellPlacements.registerPlacement({
		id: v,
		item: {
			kind: "binding",
			binding: {
				kinds: [{
					kind: "resource-kind",
					id: "branch"
				}],
				view: {
					kind: "view",
					id: "guide.branch-inspector"
				},
				cardinality: "one"
			}
		},
		region: "secondary"
	}), e;
}, C = () => {
	let [e] = c(S);
	return /* @__PURE__ */ h(r, { children: /* @__PURE__ */ h(l, {
		h: "480px",
		minH: "360px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ h(n, { workbench: e })
	}) });
}, w = "import { Box, Button, HStack, Stack, Text } from \"@chakra-ui/react\";\nimport { resourceKey } from \"@pstdio/sdk/extensions\";\nimport { createWorkbench, type ResourceRef, type WorkbenchCore } from \"@pstdio/workbench\";\nimport { Workbench, WorkbenchThemeProvider } from \"@pstdio/workbench/react\";\nimport { useState } from \"react\";\n\nconst inspectorPlacementId = \"guide.inspector\";\nconst branches = {\n  main: {\n    type: \"branch\",\n    id: \"main\",\n    label: \"main\",\n  },\n  release: {\n    type: \"branch\",\n    id: \"release\",\n    label: \"release\",\n  },\n} as const satisfies Record<string, ResourceRef>;\nconst inspectBranch = (workbench: WorkbenchCore, resource: ResourceRef) => {\n  workbench.shellPlacements.openPlacement({\n    placementId: inspectorPlacementId,\n    resource,\n    title: resource.label,\n  });\n};\nconst BranchLauncher = (props: { workbench: WorkbenchCore }) => {\n  const { workbench } = props;\n  return (\n    <Stack gap=\"md\" p=\"lg\">\n      <Text textStyle=\"heading/M\">Branches</Text>\n      <Text color=\"fg.muted\">\n        The inspector declares <code>cardinality: \"one\"</code>. Opening another branch rebinds the same instance instead\n        of adding a tab.\n      </Text>\n      <HStack gap=\"sm\" flexWrap=\"wrap\">\n        <Button size=\"sm\" onClick={() => inspectBranch(workbench, branches.main)}>\n          Inspect main\n        </Button>\n        <Button size=\"sm\" onClick={() => inspectBranch(workbench, branches.release)}>\n          Inspect release\n        </Button>\n      </HStack>\n    </Stack>\n  );\n};\nconst createResourceRebindWorkbench = () => {\n  const workbench = createWorkbench();\n  workbench.views.registerView({\n    id: \"guide.branches\",\n    title: \"Branches\",\n    body: {\n      kind: \"react\",\n      render: ({ workbench }) => <BranchLauncher workbench={workbench} />,\n    },\n  });\n  workbench.shellPlacements.registerPlacement({\n    id: \"guide.branches\",\n    item: {\n      kind: \"view\",\n      presence: \"fixed\",\n      view: {\n        kind: \"view\",\n        id: \"guide.branches\",\n      },\n    },\n    region: \"main\",\n  });\n  workbench.views.registerView({\n    id: \"guide.branch-inspector\",\n    title: \"Branch inspector\",\n    body: {\n      kind: \"react\",\n      render: ({ instance }) => (\n        <Stack gap=\"sm\" p=\"lg\">\n          <Text textStyle=\"heading/M\">{instance.resource?.label}</Text>\n          <Text color=\"fg.muted\">Bound resource: {resourceKey(instance.resource)}</Text>\n        </Stack>\n      ),\n    },\n  });\n  workbench.shellPlacements.registerPlacement({\n    id: inspectorPlacementId,\n    item: {\n      kind: \"binding\",\n      binding: {\n        kinds: [\n          {\n            kind: \"resource-kind\",\n            id: \"branch\",\n          },\n        ],\n        view: {\n          kind: \"view\",\n          id: \"guide.branch-inspector\",\n        },\n        cardinality: \"one\",\n      },\n    },\n    region: \"secondary\",\n  });\n  return workbench;\n};\nexport const ResourceRebindExample = () => {\n  const [workbench] = useState(createResourceRebindWorkbench);\n  return (\n    <WorkbenchThemeProvider>\n      <Box h=\"480px\" minH=\"360px\" borderWidth=\"1px\" borderColor=\"border.subtle\" overflow=\"hidden\">\n        <Workbench workbench={workbench} />\n      </Box>\n    </WorkbenchThemeProvider>\n  );\n};\n", T = "guide.static-placement", E = (e) => e.navigation.openPanel({ panel: {
	kind: "shell-placement",
	id: T
} }), D = (e) => {
	let { input: t } = e, n = t.instance.placementIdentity?.instanceKey ?? "default", [r, i] = c(1);
	return /* @__PURE__ */ g(p, {
		gap: "md",
		p: "lg",
		children: [
			/* @__PURE__ */ h(m, {
				textStyle: "heading/M",
				children: "Static placement"
			}),
			/* @__PURE__ */ h(m, {
				color: "fg.muted",
				children: "A static placement has one instance. Opening it again selects that instance."
			}),
			/* @__PURE__ */ h(u, {
				alignSelf: "flex-start",
				size: "sm",
				onClick: () => {
					E(t.workbench), i((e) => e + 1);
				},
				children: "Open again"
			}),
			/* @__PURE__ */ g(m, { children: ["Instance key: ", /* @__PURE__ */ h(d, { children: n })] }),
			/* @__PURE__ */ g(m, { children: ["Open calls handled by this one instance: ", /* @__PURE__ */ h(d, { children: r })] })
		]
	});
}, O = () => {
	let e = t();
	return e.views.registerView({
		id: "guide.static-view",
		title: "Static placement",
		body: {
			kind: "react",
			render: (e) => /* @__PURE__ */ h(D, { input: e })
		}
	}), e.shellPlacements.registerPlacement({
		id: T,
		item: {
			kind: "view",
			presence: "closed",
			view: {
				kind: "view",
				id: "guide.static-view"
			}
		},
		region: "main"
	}), E(e), e;
}, k = () => {
	let [e] = c(O);
	return /* @__PURE__ */ h(r, { children: /* @__PURE__ */ h(l, {
		h: "480px",
		minH: "360px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ h(n, { workbench: e })
	}) });
}, A = "import { Box, Button, Code, Stack, Text } from \"@chakra-ui/react\";\nimport { createWorkbench, type WorkbenchPanelRenderInput } from \"@pstdio/workbench\";\nimport { Workbench, WorkbenchThemeProvider } from \"@pstdio/workbench/react\";\nimport { useState } from \"react\";\n\nconst placementId = \"guide.static-placement\";\nconst openPlacement = (workbench: WorkbenchPanelRenderInput[\"workbench\"]) =>\n  workbench.navigation.openPanel({ panel: { kind: \"shell-placement\", id: placementId } });\nconst StaticPlacement = (props: { input: WorkbenchPanelRenderInput }) => {\n  const { input } = props;\n  const currentKey = input.instance.placementIdentity?.instanceKey ?? \"default\";\n  const [openCount, setOpenCount] = useState(1);\n  return (\n    <Stack gap=\"md\" p=\"lg\">\n      <Text textStyle=\"heading/M\">Static placement</Text>\n      <Text color=\"fg.muted\">A static placement has one instance. Opening it again selects that instance.</Text>\n      <Button\n        alignSelf=\"flex-start\"\n        size=\"sm\"\n        onClick={() => {\n          void openPlacement(input.workbench);\n          setOpenCount((count) => count + 1);\n        }}\n      >\n        Open again\n      </Button>\n      <Text>\n        Instance key: <Code>{currentKey}</Code>\n      </Text>\n      <Text>\n        Open calls handled by this one instance: <Code>{openCount}</Code>\n      </Text>\n    </Stack>\n  );\n};\nconst createStaticPlacementWorkbench = () => {\n  const workbench = createWorkbench();\n  workbench.views.registerView({\n    id: \"guide.static-view\",\n    title: \"Static placement\",\n    body: {\n      kind: \"react\",\n      render: (input) => <StaticPlacement input={input} />,\n    },\n  });\n  workbench.shellPlacements.registerPlacement({\n    id: placementId,\n    item: {\n      kind: \"view\",\n      presence: \"closed\",\n      view: {\n        kind: \"view\",\n        id: \"guide.static-view\",\n      },\n    },\n    region: \"main\",\n  });\n  void openPlacement(workbench);\n  return workbench;\n};\nexport const StaticPlacementExample = () => {\n  const [workbench] = useState(createStaticPlacementWorkbench);\n  return (\n    <WorkbenchThemeProvider>\n      <Box h=\"480px\" minH=\"360px\" borderWidth=\"1px\" borderColor=\"border.subtle\" overflow=\"hidden\">\n        <Workbench workbench={workbench} />\n      </Box>\n    </WorkbenchThemeProvider>\n  );\n};\n", j = () => {
	let e = t(), n = /* @__PURE__ */ new Set(), r = !1;
	return e.views.registerView({
		id: "guide.session",
		title: "Session",
		icon: "MessageCircle",
		body: {
			kind: "react",
			render: () => /* @__PURE__ */ g(p, {
				gap: "sm",
				p: "lg",
				children: [/* @__PURE__ */ h(m, {
					textStyle: "heading/M",
					children: "Session tab"
				}), /* @__PURE__ */ h(m, {
					color: "fg.muted",
					children: "The status indicator replaces the ordinary view icon, so the tab has one leading glyph."
				})]
			})
		}
	}), e.shellPlacements.registerPlacement({
		id: "guide.session",
		item: {
			kind: "view",
			presence: "fixed",
			view: {
				kind: "view",
				id: "guide.session"
			}
		},
		region: "main",
		tab: {
			subscribe: (e) => (n.add(e), () => {
				n.delete(e);
			}),
			getSnapshot: () => ({ indicator: r ? {
				icon: "LoaderCircle",
				color: "fg.info",
				label: "Session status: in_progress"
			} : {
				icon: "CircleCheck",
				color: "fg.success",
				label: "Session status: completed"
			} })
		}
	}), {
		workbench: e,
		toggle: () => {
			r = !r;
			for (let e of n) e();
		}
	};
}, M = () => {
	let [{ workbench: e, toggle: t }] = c(j);
	return /* @__PURE__ */ g(r, { children: [/* @__PURE__ */ h(u, {
		onClick: t,
		children: "Change session status"
	}), /* @__PURE__ */ h(l, {
		h: "320px",
		minH: "240px",
		borderWidth: "1px",
		borderColor: "border.subtle",
		overflow: "hidden",
		children: /* @__PURE__ */ h(n, { workbench: e })
	})] });
}, N = "import { Box, Button, Stack, Text } from \"@chakra-ui/react\";\nimport { createWorkbench } from \"@pstdio/workbench\";\nimport { Workbench, WorkbenchThemeProvider } from \"@pstdio/workbench/react\";\nimport { useState } from \"react\";\n\nconst createTabPresentationWorkbench = () => {\n  const workbench = createWorkbench();\n  const listeners = new Set<() => void>();\n  let running = false;\n  const toggle = () => {\n    running = !running;\n    for (const listener of listeners) listener();\n  };\n  workbench.views.registerView({\n    id: \"guide.session\",\n    title: \"Session\",\n    icon: \"MessageCircle\",\n    body: {\n      kind: \"react\",\n      render: () => (\n        <Stack gap=\"sm\" p=\"lg\">\n          <Text textStyle=\"heading/M\">Session tab</Text>\n          <Text color=\"fg.muted\">\n            The status indicator replaces the ordinary view icon, so the tab has one leading glyph.\n          </Text>\n        </Stack>\n      ),\n    },\n  });\n  workbench.shellPlacements.registerPlacement({\n    id: \"guide.session\",\n    item: {\n      kind: \"view\",\n      presence: \"fixed\",\n      view: {\n        kind: \"view\",\n        id: \"guide.session\",\n      },\n    },\n    region: \"main\",\n    tab: {\n      subscribe: (listener) => {\n        listeners.add(listener);\n        return () => {\n          listeners.delete(listener);\n        };\n      },\n      getSnapshot: () => ({\n        indicator: running\n          ? { icon: \"LoaderCircle\", color: \"fg.info\", label: \"Session status: in_progress\" }\n          : { icon: \"CircleCheck\", color: \"fg.success\", label: \"Session status: completed\" },\n      }),\n    },\n  });\n  return { workbench, toggle };\n};\nexport const TabPresentationExample = () => {\n  const [{ workbench, toggle }] = useState(createTabPresentationWorkbench);\n  return (\n    <WorkbenchThemeProvider>\n      <Button onClick={toggle}>Change session status</Button>\n      <Box h=\"320px\" minH=\"240px\" borderWidth=\"1px\" borderColor=\"border.subtle\" overflow=\"hidden\">\n        <Workbench workbench={workbench} />\n      </Box>\n    </WorkbenchThemeProvider>\n  );\n};\n", P = /* @__PURE__ */ e({
	PageReplacement: () => V,
	ResourceRebind: () => z,
	ResourceTabs: () => R,
	StaticPlacement: () => L,
	TabPresentation: () => B,
	default: () => F
}), F = {
	title: "pstdio-workbench/Guides/Panels and pages",
	tags: ["!dev"],
	parameters: {
		layout: "padded",
		docs: { description: { component: "This Core API guide explains static and resource placements, then shows complete page replacement." } }
	}
}, I = (e) => ({ docs: { source: {
	code: e,
	language: "tsx",
	type: "code"
} } }), L = {
	name: "Static placement",
	parameters: I(A),
	render: () => /* @__PURE__ */ h(k, {})
}, R = {
	name: "Resource placement (many)",
	parameters: I(s),
	render: () => /* @__PURE__ */ h(o, {})
}, z = {
	name: "Resource placement (one)",
	parameters: I(w),
	render: () => /* @__PURE__ */ h(C, {})
}, B = {
	name: "Tab presentation",
	parameters: I(N),
	render: () => /* @__PURE__ */ h(M, {})
}, V = {
	name: "Page replacement",
	parameters: I(a),
	render: () => /* @__PURE__ */ h(i, {})
};
export { V as PageReplacement, z as ResourceRebind, R as ResourceTabs, L as StaticPlacement, B as TabPresentation, F as default, P as t };
