// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e, n as t, r as n, t as r } from "./native-document-blocks-ZX3UlLq0.ts";
import i, { WorkbenchRegions as a, t as o } from "./onboarding.stories-B8X6Bf1U.ts";
import { t as s } from "./module-CxX_23sA.ts";
import { createElement as c } from "react";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/14-side-panels.docs.mdx
function f(t) {
	let i = {
		code: "code",
		h1: "h1",
		h2: "h2",
		li: "li",
		p: "p",
		pre: "pre",
		strong: "strong",
		ul: "ul",
		...t.components
	};
	return d(l, { children: [
		u(n, {
			of: o,
			name: "12. Workbench regions"
		}),
		"\n",
		u(i.h1, { children: "12. Choose the correct workbench region" }),
		"\n",
		d(i.p, { children: [
			"The area map shows every supported placement region at once. Use it to choose an API target, not as a product layout.\nExtension panels use ",
			u(i.code, { children: "main" }),
			", ",
			u(i.code, { children: "secondary" }),
			", or ",
			u(i.code, { children: "side" }),
			". Extensions contribute Sidenav content with navigation items\nand trees, or replace it through mode chrome. Host APIs can address additional regions shown here."
		] }),
		"\n",
		d(i.p, { children: [
			"The Activity Bar is the narrow strip at the far left. Panel menus are attached to the left and right edges of Main,\nSecondary, and Side. They collapse into ",
			u(i.strong, { children: "Open … menu" }),
			" buttons when a panel is narrow. Drag a visible menu's resize\nhandle to change its width or collapse it."
		] }),
		"\n",
		d(i.p, { children: [
			u(i.code, { children: "workbenchRegions" }),
			" is the canonical region list. ",
			u(i.code, { children: "main" }),
			", ",
			u(i.code, { children: "secondary" }),
			", and ",
			u(i.code, { children: "side" }),
			" are panel regions. Each panel owns a\nleft and a right menu region through ",
			u(i.code, { children: "viewMenus.registerViewMenu" }),
			". The example attaches both menus to all three panel\nViews so you can inspect all six menu regions. The status bar is different: it is not a placement region, so the example\nregisters a backing View through ",
			u(i.code, { children: "workbench.statusBar" }),
			" instead. The complete area map also lives under ",
			u(i.strong, { children: "Reference →\nCore API → Region map" }),
			"."
		] }),
		"\n",
		u(r, {
			of: a,
			sourceState: "none"
		}),
		"\n",
		u(i.h2, { children: "Complete example" }),
		"\n",
		u(e, {
			code: s,
			language: "tsx"
		}),
		"\n",
		u(i.h2, { children: "Side Panel presentation" }),
		"\n",
		u(i.p, { children: "The Side Panel supports attached, floating, and closed presentations. Modes declare their floating policy. A host\ncan supply the default:" }),
		"\n",
		u(i.pre, { children: u(i.code, {
			className: "language-tsx",
			children: "const workbench = createWorkbench({\n  initialSidePanelMode: \"attached\",\n  floatingPanels: \"hidden\",\n});\n"
		}) }),
		"\n",
		d(i.p, { children: [
			u(i.code, { children: "floatingPanels" }),
			" defaults to ",
			u(i.code, { children: "\"visible\"" }),
			". The active mode can override the host default with the same field. Kiln\ndeclares ",
			u(i.code, { children: "floatingPanels: \"hidden\"" }),
			" on its mode. The controller enforces this setting on transitions, saved state,\nand requests. The Float button and bubble launcher use ",
			u(i.code, { children: "workbench.sidePanel.canFloat()" }),
			"."
		] }),
		"\n",
		d(i.p, { children: [
			"The presentation is layout state. The ",
			u(i.code, { children: "side" }),
			" region's ",
			u(i.code, { children: "visible" }),
			" flag says whether the panel is open, and its\n",
			u(i.code, { children: "presentation" }),
			" says whether it is attached or floating. Layout persistence saves it with each persistence scope, so\na host that scopes layouts by project or page restores each scope's own choice. A scope without a saved layout uses\n",
			u(i.code, { children: "initialSidePanelMode" }),
			". When a mode hides floating panels, a floating choice shows attached and comes back when the\nmode allows floating again."
		] }),
		"\n",
		d(i.p, { children: [
			"Use ",
			u(i.code, { children: "workbench.shell.setRegionOpen(\"side\", open)" }),
			" to hide or reopen the panel. Use\n",
			u(i.code, { children: "workbench.shell.setSidePanelPresentation(\"floating\")" }),
			" to float it when allowed. A forbidden floating request\nresolves to ",
			u(i.code, { children: "\"attached\"" }),
			". ",
			u(i.code, { children: "collapsible: false" }),
			" prevents dragging closed and still permits explicit hide/show."
		] }),
		"\n",
		d(i.p, { children: [
			"Pass ",
			u(i.code, { children: "sidePanelBubbleIcon" }),
			" to the React host to choose a bubble icon. This accepts a React node and defaults to the\nchat icon. It changes the icon while keeping the launcher's tooltip, accessible label, and click behavior:"
		] }),
		"\n",
		u(i.pre, { children: u(i.code, {
			className: "language-tsx",
			children: "import { SlidersHorizontal } from \"lucide-react\";\nimport { Workbench } from \"@pstdio/workbench/react\";\n\n<Workbench workbench={workbench} sidePanelBubbleIcon={<SlidersHorizontal size={20} />} />;\n"
		}) }),
		"\n",
		u(i.p, { children: "The bubble is shown only for closed panels that allow detachment. See the Side Panel stories in the Core API reference\nfor the default icon, a custom icon, and a panel that stays attached." }),
		"\n",
		u(i.h2, { children: "What each field means" }),
		"\n",
		d(i.p, { children: [
			u(i.code, { children: "createRegionMapModule()" }),
			" returns one module contribution. ",
			u(i.code, { children: "id" }),
			" is the module's stable identity, and ",
			u(i.code, { children: "activate(ctx)" }),
			"\nregisters everything through the module context. ",
			u(i.code, { children: "RegionMapPlaceholder" }),
			", ",
			u(i.code, { children: "regionLabels" }),
			", ",
			u(i.code, { children: "describeSurface" }),
			",\n",
			u(i.code, { children: "createRegionResource" }),
			", ",
			u(i.code, { children: "regionResourceKind" }),
			", and ",
			u(i.code, { children: "regionWidgetId" }),
			" are local example helpers, not workbench API."
		] }),
		"\n",
		u(i.p, { children: "The setup calls:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.sidePanel.setMode(\"attached\")" }),
				" docks the Side region so it is visible. The other modes are ",
				u(i.code, { children: "\"floating\"" }),
				" and\n",
				u(i.code, { children: "\"closed\"" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.resources.registerKind({ kind, label, icon })" }), " declares the resource kind the example's region resources use."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The Views and the status bar:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.views.registerView({ id, title, body })" }),
				" defines one View per region. ",
				u(i.code, { children: "body.kind: \"react\"" }),
				" renders the\nplaceholder content."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "ctx.statusBar.registerItem({ id, viewId, slot })" }),
				" places a backing View in the status bar. ",
				u(i.code, { children: "slot" }),
				" is ",
				u(i.code, { children: "\"leading\"" }),
				" or\n",
				u(i.code, { children: "\"trailing\"" }),
				". The status bar has its own registry because it is not a placement region."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The overlay:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.overlays.registerOverlay({ id, viewId, config })" }), " declares an overlay backed by a View."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "config.modal: false" }), " keeps the rest of the workbench interactive while the overlay is open."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "config.closeOnInteractOutside: false" }), " keeps the overlay open when the user clicks elsewhere."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "workbench.overlays.openOverlay(id)" }), " opens it. The button in the Main region calls this."] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The shell placements:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.shellPlacements.registerPlacement({ id, item, region })" }), " places one View in one region. The shell owns these\nplacements, so they exist in every mode."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "item.kind: \"view\"" }), " says this is one static View rather than a resource-bound set of instances."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "item.view" }), " names the registered View to render."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "item.presence" }),
				" is required and sets the item's presence. ",
				u(i.code, { children: "\"fixed\"" }),
				" means the item is always open while its owner is\nactive; the user cannot close it, and the Add panel does not offer it. ",
				u(i.code, { children: "\"open\"" }),
				" means the item starts open when the\nowner has no saved state, and the user may close it. ",
				u(i.code, { children: "\"closed\"" }),
				" means the item stays hidden until the user or an\naction opens it from the Add panel. A saved user choice wins over ",
				u(i.code, { children: "\"open\"" }),
				" and ",
				u(i.code, { children: "\"closed\"" }),
				" on the next visit. Every\nplacement here uses ",
				u(i.code, { children: "\"fixed\"" }),
				" so the whole map stays visible."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "region" }),
				" names the target region from the canonical ",
				u(i.code, { children: "workbenchRegions" }),
				" list."
			] }),
			"\n",
			d(i.li, { children: [
				"placements carry no size or collapse settings. Region layout policy lives in ",
				u(i.code, { children: "regionSettings" }),
				" on the mode\n(",
				u(i.code, { children: "defineMode({ regionSettings })" }),
				") or on the host (",
				u(i.code, { children: "createWorkbench({ regionSettings })" }),
				"), and the active mode's\nsettings win over the host's."
			] }),
			"\n"
		] }),
		"\n",
		u(i.p, { children: "The panel menus:" }),
		"\n",
		d(i.ul, { children: [
			"\n",
			d(i.li, { children: [u(i.code, { children: "ctx.viewMenus.registerViewMenu({ id, ownerViewId, viewId, side, regionSize })" }), " attaches a menu to one edge of a panel\nView."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "ownerViewId" }), " names the panel View the menu belongs to. The menu appears wherever that View is placed."] }),
			"\n",
			d(i.li, { children: [u(i.code, { children: "viewId" }), " names the View rendered inside the menu."] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "side" }),
				" is ",
				u(i.code, { children: "\"left\"" }),
				" or ",
				u(i.code, { children: "\"right\"" }),
				"."
			] }),
			"\n",
			d(i.li, { children: [
				u(i.code, { children: "regionSize" }),
				" sets the menu region's width in pixels. ",
				u(i.code, { children: "defaultPx" }),
				" is the starting width and ",
				u(i.code, { children: "minPx" }),
				" the minimum. This\nfield belongs to view menus only; placements have no size field."
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
