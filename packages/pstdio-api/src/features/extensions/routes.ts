import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewMetadataDeps } from "./deps";
import {
  attemptFixProjectExtensionHandler,
  attemptFixProjectExtensionRoute,
} from "./endpoints/attempt-fix-project-extension";
import {
  createExtensionNotificationHandler,
  createExtensionNotificationRoute,
} from "./endpoints/create-extension-notification";
import { dispatchExtensionEventHandler, dispatchExtensionEventRoute } from "./endpoints/dispatch-extension-event";
import { enableInstalledExtensionHandler, enableInstalledExtensionRoute } from "./endpoints/enable-installed-extension";
import { executeExtensionCommandHandler, executeExtensionCommandRoute } from "./endpoints/execute-extension-command";
import {
  deleteExtensionFileHandler,
  deleteExtensionFileRoute,
  getExtensionFileContentHandler,
  getExtensionFileContentRoute,
  listExtensionFilesHandler,
  listExtensionFilesRoute,
  uploadExtensionCommandFileHandler,
  uploadExtensionCommandFileRoute,
  uploadExtensionFileHandler,
  uploadExtensionFileRoute,
} from "./endpoints/extension-files";
import {
  deleteGlobalExtensionSettingHandler,
  deleteGlobalExtensionSettingRoute,
  deleteProjectExtensionSettingHandler,
  deleteProjectExtensionSettingRoute,
  getGlobalExtensionSettingHandler,
  getGlobalExtensionSettingRoute,
  getProjectExtensionSettingHandler,
  getProjectExtensionSettingRoute,
  listGlobalExtensionSettingsHandler,
  listGlobalExtensionSettingsRoute,
  listProjectExtensionSettingsHandler,
  listProjectExtensionSettingsRoute,
  updateGlobalExtensionSettingHandler,
  updateGlobalExtensionSettingRoute,
  updateProjectExtensionSettingHandler,
  updateProjectExtensionSettingRoute,
} from "./endpoints/extension-settings";
import {
  getExtensionContributionsHandler,
  getExtensionContributionsRoute,
} from "./endpoints/get-extension-contributions";
import {
  getMarketplaceExtensionContributionsHandler,
  getMarketplaceExtensionContributionsRoute,
} from "./endpoints/get-marketplace-extension-contributions";
import { getProjectExtensionUiHandler, getProjectExtensionUiRoute } from "./endpoints/get-project-extension-ui";
import {
  installMarketplaceExtensionHandler,
  installMarketplaceExtensionRoute,
} from "./endpoints/install-marketplace-extension";
import { listExtensionAppearanceHandler, listExtensionAppearanceRoute } from "./endpoints/list-extension-appearance";
import { listExtensionCommandsHandler, listExtensionCommandsRoute } from "./endpoints/list-extension-commands";
import { listProjectExtensionsHandler, listProjectExtensionsRoute } from "./endpoints/list-project-extensions";
import { reloadProjectExtensionHandler, reloadProjectExtensionRoute } from "./endpoints/reload-project-extension";
import {
  setExtensionAutomationEnabledHandler,
  setExtensionAutomationEnabledRoute,
} from "./endpoints/set-extension-automation-enabled";
import {
  setProjectExtensionEnabledHandler,
  setProjectExtensionEnabledRoute,
} from "./endpoints/set-project-extension-enabled";
import {
  uninstallProjectExtensionHandler,
  uninstallProjectExtensionRoute,
} from "./endpoints/uninstall-project-extension";
import {
  updateInstalledExtensionTemplateHandler,
  updateInstalledExtensionTemplateRoute,
} from "./endpoints/update-installed-extension-template";
import { upgradeProjectExtensionHandler, upgradeProjectExtensionRoute } from "./endpoints/upgrade-project-extension";
import {
  createProjectExtensionLifecycle,
  type ProjectExtensionLifecycleRouteDeps,
} from "./project-extension-lifecycle";

type ExtensionRoutes = OpenAPIHono<AppBindings>;

const registerInstalledExtensionRoutes = (routes: ExtensionRoutes, deps: ExtensionsRouteDeps) => {
  routes.openapi(enableInstalledExtensionRoute, enableInstalledExtensionHandler(deps));
  routes.openapi(updateInstalledExtensionTemplateRoute, updateInstalledExtensionTemplateHandler(deps));
};

const registerExtensionWorkbenchRoutes = (
  routes: ExtensionRoutes,
  deps: ExtensionsRouteDeps & ExtensionWebviewMetadataDeps,
) => {
  routes.openapi(listExtensionAppearanceRoute, listExtensionAppearanceHandler(deps));
  routes.openapi(listExtensionCommandsRoute, listExtensionCommandsHandler(deps));
  routes.openapi(getProjectExtensionUiRoute, getProjectExtensionUiHandler(deps));
  routes.openapi(executeExtensionCommandRoute, executeExtensionCommandHandler(deps));
  routes.openapi(createExtensionNotificationRoute, createExtensionNotificationHandler(deps));
  routes.openapi(dispatchExtensionEventRoute, dispatchExtensionEventHandler(deps));
};

const registerExtensionFileRoutes = (routes: ExtensionRoutes, deps: ExtensionsRouteDeps) => {
  routes.openapi(uploadExtensionCommandFileRoute, uploadExtensionCommandFileHandler(deps));
  routes.openapi(uploadExtensionFileRoute, uploadExtensionFileHandler(deps));
  routes.openapi(listExtensionFilesRoute, listExtensionFilesHandler(deps));
  routes.openapi(getExtensionFileContentRoute, getExtensionFileContentHandler(deps));
  routes.openapi(deleteExtensionFileRoute, deleteExtensionFileHandler(deps));
};

const registerProjectExtensionRoutes = (
  routes: ExtensionRoutes,
  deps: ProjectExtensionLifecycleRouteDeps & ExtensionWebviewMetadataDeps,
) => {
  routes.openapi(listProjectExtensionsRoute, listProjectExtensionsHandler(deps));
  routes.openapi(installMarketplaceExtensionRoute, installMarketplaceExtensionHandler(deps));
  routes.openapi(getMarketplaceExtensionContributionsRoute, getMarketplaceExtensionContributionsHandler(deps));
  routes.openapi(getExtensionContributionsRoute, getExtensionContributionsHandler(deps));
  routes.openapi(setProjectExtensionEnabledRoute, setProjectExtensionEnabledHandler(deps));
  routes.openapi(setExtensionAutomationEnabledRoute, setExtensionAutomationEnabledHandler(deps));
  routes.openapi(reloadProjectExtensionRoute, reloadProjectExtensionHandler(deps));
  routes.openapi(upgradeProjectExtensionRoute, upgradeProjectExtensionHandler(deps));
  routes.openapi(attemptFixProjectExtensionRoute, attemptFixProjectExtensionHandler(deps));
  routes.openapi(uninstallProjectExtensionRoute, uninstallProjectExtensionHandler(deps));
};

const registerExtensionSettingsRoutes = (routes: ExtensionRoutes, deps: ExtensionsRouteDeps) => {
  routes.openapi(listProjectExtensionSettingsRoute, listProjectExtensionSettingsHandler(deps));
  routes.openapi(getProjectExtensionSettingRoute, getProjectExtensionSettingHandler(deps));
  routes.openapi(updateProjectExtensionSettingRoute, updateProjectExtensionSettingHandler(deps));
  routes.openapi(deleteProjectExtensionSettingRoute, deleteProjectExtensionSettingHandler(deps));
  routes.openapi(listGlobalExtensionSettingsRoute, listGlobalExtensionSettingsHandler(deps));
  routes.openapi(getGlobalExtensionSettingRoute, getGlobalExtensionSettingHandler(deps));
  routes.openapi(updateGlobalExtensionSettingRoute, updateGlobalExtensionSettingHandler(deps));
  routes.openapi(deleteGlobalExtensionSettingRoute, deleteGlobalExtensionSettingHandler(deps));
};

export const createExtensionRoutes = (deps: ExtensionsRouteDeps & ExtensionWebviewMetadataDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  registerInstalledExtensionRoutes(routes, deps);
  registerExtensionWorkbenchRoutes(routes, deps);
  registerExtensionFileRoutes(routes, deps);
  registerProjectExtensionRoutes(routes, {
    ...deps,
    projectExtensionLifecycle: createProjectExtensionLifecycle(deps),
  });
  registerExtensionSettingsRoutes(routes, deps);

  return routes;
};
