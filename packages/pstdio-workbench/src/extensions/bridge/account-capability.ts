import type {
  ExtensionAccountApi,
  WebviewAccountManageParams,
  WebviewAccountReadParams,
} from "pstdio-api-contracts/extension-kernel";

// One bridge method per permission. The operation names the `ctx.account` method to run.
const runAccountOperation = (
  account: ExtensionAccountApi,
  request: WebviewAccountReadParams | WebviewAccountManageParams,
) => {
  switch (request.op) {
    case "status":
      return account.status();
    case "loginStatus":
      return account.loginStatus(request.id);
    case "devices":
      return account.devices();
    case "projectSyncStatus":
      return account.projectSyncStatus(request.projectId);
    case "login":
      return account.login(request.managerOrigin);
    case "cancelLogin":
      return account.cancelLogin(request.id);
    case "logout":
      return account.logout();
    case "renameDevice":
      return account.renameDevice(request.id, request.name);
    case "removeDevice":
      return account.removeDevice(request.id);
    case "syncProject":
      return account.syncProject(request.projectId);
    case "stopProjectSync":
      return account.stopProjectSync(request.projectId);
  }
};

export const createAccountCapability = (account: ExtensionAccountApi | undefined) =>
  account &&
  ((request: WebviewAccountReadParams | WebviewAccountManageParams) => runAccountOperation(account, request));
