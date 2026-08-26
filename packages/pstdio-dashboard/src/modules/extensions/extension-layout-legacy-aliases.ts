/** Read only while migrating layouts written before the shared view registry. */
export const legacyExtensionViewWidgetId = (viewId: string) => `dashboard-workbench.extension-view.${viewId}`;
