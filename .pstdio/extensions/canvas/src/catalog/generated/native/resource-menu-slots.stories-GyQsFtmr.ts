// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { t } from "./workbench-theme-provider-CQSyY8qK.ts";
import { n, r } from "./extension-contributions-CzIuN5EO.ts";
import { Badge as i, Box as a, HStack as o, Stack as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/resource-menu-slots/module.tsx
var d = [{
	id: "note",
	label: "Note",
	slotId: "note.headerPrimary"
}, {
	id: "incident",
	label: "Incident",
	slotId: "incident.context"
}], f = {
	...r,
	commands: d.map((e) => ({
		id: `example.command.${e.id}`,
		extensionId: "example.resources",
		title: `Open ${e.label.toLowerCase()}`
	})),
	menuContributions: [...d.map((e) => ({
		id: `example.menu.${e.id}`,
		extensionId: "example.resources",
		commandId: `example.command.${e.id}`,
		slotId: e.slotId,
		label: `Open ${e.label.toLowerCase()}`
	})), {
		id: "example.menu.unknown",
		extensionId: "example.resources",
		commandId: "example.command.note",
		slotId: "unknown.headerPrimary",
		label: "Unknown action"
	}]
}, p = n({
	metadata: f,
	menuSlotsById: /* @__PURE__ */ new Map([["note.headerPrimary", {
		menuPath: [
			"example",
			"note",
			"header"
		],
		group: "primary"
	}], ["incident.context", { menuPath: [
		"example",
		"incident",
		"context"
	] }]])
}), m = (e) => {
	let { id: t, label: n, slotId: r } = e, d = p.registrations.find((e) => e.contribution.slotId === r);
	return /* @__PURE__ */ u(s, {
		gap: "sm",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "md",
		p: "md",
		flex: "1",
		children: [
			/* @__PURE__ */ u(o, {
				justify: "space-between",
				children: [/* @__PURE__ */ l(c, {
					textStyle: "heading/S/semibold",
					children: n
				}), /* @__PURE__ */ l(i, { children: t })]
			}),
			/* @__PURE__ */ l(c, {
				textStyle: "paragraph/XS/regular",
				color: "fg.muted",
				children: r
			}),
			/* @__PURE__ */ u(a, {
				borderWidth: "1px",
				borderColor: "border",
				borderRadius: "sm",
				p: "sm",
				children: [/* @__PURE__ */ l(c, {
					textStyle: "paragraph/S/medium",
					children: d?.menuItem.label
				}), /* @__PURE__ */ l(c, {
					textStyle: "paragraph/XS/regular",
					color: "fg.muted",
					children: d?.menuPath.join(" / ")
				})]
			})
		]
	});
}, h = () => /* @__PURE__ */ u(s, {
	gap: "md",
	p: "lg",
	bg: "bg",
	minH: "100vh",
	children: [
		/* @__PURE__ */ u(s, {
			gap: "2xs",
			children: [/* @__PURE__ */ l(c, {
				textStyle: "heading/M/semibold",
				children: "Resource menu slots"
			}), /* @__PURE__ */ l(c, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: "Each resource kind owns its action placement. Missing targets stay visible as warnings."
			})]
		}),
		/* @__PURE__ */ l(o, {
			align: "stretch",
			gap: "md",
			children: d.map((e) => /* @__PURE__ */ l(m, { ...e }, e.id))
		}),
		p.unresolved.map((e) => /* @__PURE__ */ u(a, {
			borderWidth: "1px",
			borderColor: "border.warning",
			borderRadius: "md",
			p: "sm",
			children: [/* @__PURE__ */ l(c, {
				textStyle: "paragraph/S/semibold",
				children: "Unresolved target"
			}), /* @__PURE__ */ l(c, {
				textStyle: "paragraph/XS/regular",
				color: "fg.muted",
				children: e.targetId
			})]
		}, e.contribution.id))
	]
}), g = "import { Badge, Box, HStack, Stack, Text } from \"@chakra-ui/react\";\nimport type { WorkbenchExtensionMetadata } from \"@pstdio/sdk/api\";\nimport { buildWorkbenchExtensionMenuRegistrations, emptyWorkbenchExtensionMetadata } from \"../../extensions\";\n\nconst resourceKinds = [\n  { id: \"note\", label: \"Note\", slotId: \"note.headerPrimary\" },\n  { id: \"incident\", label: \"Incident\", slotId: \"incident.context\" },\n] as const;\n\nconst metadata = {\n  ...emptyWorkbenchExtensionMetadata,\n  commands: resourceKinds.map((kind) => ({\n    id: `example.command.${kind.id}`,\n    extensionId: \"example.resources\",\n    title: `Open ${kind.label.toLowerCase()}`,\n  })),\n  menuContributions: [\n    ...resourceKinds.map((kind) => ({\n      id: `example.menu.${kind.id}`,\n      extensionId: \"example.resources\",\n      commandId: `example.command.${kind.id}`,\n      slotId: kind.slotId,\n      label: `Open ${kind.label.toLowerCase()}`,\n    })),\n    {\n      id: \"example.menu.unknown\",\n      extensionId: \"example.resources\",\n      commandId: \"example.command.note\",\n      slotId: \"unknown.headerPrimary\",\n      label: \"Unknown action\",\n    },\n  ],\n} satisfies WorkbenchExtensionMetadata;\n\nconst result = buildWorkbenchExtensionMenuRegistrations({\n  metadata,\n  menuSlotsById: new Map([\n    [\"note.headerPrimary\", { menuPath: [\"example\", \"note\", \"header\"], group: \"primary\" }],\n    [\"incident.context\", { menuPath: [\"example\", \"incident\", \"context\"] }],\n  ]),\n});\n\nconst ResourceCard = (props: { id: string; label: string; slotId: string }) => {\n  const { id, label, slotId } = props;\n  const registration = result.registrations.find((item) => item.contribution.slotId === slotId);\n  return (\n    <Stack gap=\"sm\" borderWidth=\"1px\" borderColor=\"border\" borderRadius=\"md\" p=\"md\" flex=\"1\">\n      <HStack justify=\"space-between\">\n        <Text textStyle=\"heading/S/semibold\">{label}</Text>\n        <Badge>{id}</Badge>\n      </HStack>\n      <Text textStyle=\"paragraph/XS/regular\" color=\"fg.muted\">\n        {slotId}\n      </Text>\n      <Box borderWidth=\"1px\" borderColor=\"border\" borderRadius=\"sm\" p=\"sm\">\n        <Text textStyle=\"paragraph/S/medium\">{registration?.menuItem.label}</Text>\n        <Text textStyle=\"paragraph/XS/regular\" color=\"fg.muted\">\n          {registration?.menuPath.join(\" / \")}\n        </Text>\n      </Box>\n    </Stack>\n  );\n};\n\nexport const ResourceMenuSlotsExample = () => (\n  <Stack gap=\"md\" p=\"lg\" bg=\"bg\" minH=\"100vh\">\n    <Stack gap=\"2xs\">\n      <Text textStyle=\"heading/M/semibold\">Resource menu slots</Text>\n      <Text textStyle=\"paragraph/S/regular\" color=\"fg.muted\">\n        Each resource kind owns its action placement. Missing targets stay visible as warnings.\n      </Text>\n    </Stack>\n    <HStack align=\"stretch\" gap=\"md\">\n      {resourceKinds.map((kind) => (\n        <ResourceCard key={kind.id} {...kind} />\n      ))}\n    </HStack>\n    {result.unresolved.map((item) => (\n      <Box key={item.contribution.id} borderWidth=\"1px\" borderColor=\"border.warning\" borderRadius=\"md\" p=\"sm\">\n        <Text textStyle=\"paragraph/S/semibold\">Unresolved target</Text>\n        <Text textStyle=\"paragraph/XS/regular\" color=\"fg.muted\">\n          {item.targetId}\n        </Text>\n      </Box>\n    ))}\n  </Stack>\n);\n", _ = /* @__PURE__ */ e({
	TwoResourceKinds: () => y,
	default: () => v
}), v = {
	title: "pstdio-workbench/Guides/Resource menu slots",
	component: h,
	tags: ["!dev"],
	parameters: {
		layout: "fullscreen",
		docs: { description: { component: "A resource kind declares its public or owner-only menu slots. Commands target those typed slots, and the host maps them onto the resource header or context menu." } }
	}
}, y = {
	parameters: { docs: { source: {
		code: g,
		language: "tsx",
		type: "code"
	} } },
	render: () => /* @__PURE__ */ l(t, { children: /* @__PURE__ */ l(h, {}) })
};
export { y as TwoResourceKinds, v as default, g as n, _ as t };
