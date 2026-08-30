import type { WorkbenchModuleContext } from "@pstdio/workbench";

// The landing rule: a fresh project lands on the first project-navigation item whose
// action is (or contains) a page target. The extensions module records the page id
// when it registers navigation; bootstrap reads it when no restore target exists.
const landingPageByWorkbench = new WeakMap<object, string | undefined>();

export const setExtensionLandingPageId = (ctx: WorkbenchModuleContext, pageId: string | undefined) => {
  landingPageByWorkbench.set(ctx.context.store, pageId);
};

export const clearExtensionLandingPageId = (ctx: WorkbenchModuleContext) => {
  landingPageByWorkbench.delete(ctx.context.store);
};

export const getExtensionLandingPageId = (ctx: WorkbenchModuleContext) => landingPageByWorkbench.get(ctx.context.store);
