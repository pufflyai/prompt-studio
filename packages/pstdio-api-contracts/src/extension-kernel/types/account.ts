import type {
  CloudDevice,
  CloudDeviceBootstrapFile,
  CloudDeviceProvider,
  CloudDeviceProviderInput,
  PrepareCloudDeviceBootstrapInput,
  StartCloudDeviceInput,
} from "../../cloud-devices";

export type {
  CloudDevice,
  CloudDeviceBootstrapFile,
  CloudDeviceProvider,
  CloudDeviceProviderInput,
  PrepareCloudDeviceBootstrapInput,
  StartCloudDeviceInput,
} from "../../cloud-devices";

import type { AccountDevice, AccountLogin, AccountLoginStatus, AccountStatus } from "../../account";
import type { ProjectSyncStatus } from "../../project-sync";

export type { AccountDevice, AccountLogin, AccountLoginStatus, AccountStatus, DeviceLogin } from "../../account";
export type { ProjectSyncState, ProjectSyncStatus } from "../../project-sync";

/**
 * This device's Cloud account, the account's devices, and each project's sync status.
 * Methods that take a project id use the current project when it is omitted.
 * Listen to `accountEvents.projectSyncChanged` for sync status changes.
 * Listen to `accountEvents.changed` for account changes, including `signInRequired`.
 */
export interface ExtensionAccountApi {
  status(): Promise<AccountStatus>;
  /**
   * Starts a native browser sign-in. Omit the address to use the host's account service. Open `url` in a browser on
   * the computer that runs Prompt Studio, then poll `loginStatus` until it is no longer pending.
   */
  login(managerOrigin?: string): Promise<AccountLogin>;
  loginStatus(id: string): Promise<AccountLoginStatus>;
  /** Cancels a pending sign-in. Returns `complete` when the sign-in had already finished. */
  cancelLogin(id: string): Promise<Exclude<AccountLoginStatus, "pending">>;
  /**
   * Signs this device out. Local data stays. `removed` is false when the account service could
   * not be reached; remove the device from another one later.
   */
  logout(): Promise<{ removed: boolean }>;
  /** The account's devices with their presence. `current` marks this device. */
  devices(): Promise<AccountDevice[]>;
  /** Native, device-local provider configuration. The credential is write-only and never synced. */
  cloudDeviceProvider(): Promise<CloudDeviceProvider>;
  configureCloudDeviceProvider(input: CloudDeviceProviderInput): Promise<void>;
  cloudDevices(): Promise<CloudDevice[]>;
  /** Writes a one-use enrollment envelope to a private native file; returns only its location. */
  prepareCloudDeviceBootstrap(input: PrepareCloudDeviceBootstrapInput): Promise<CloudDeviceBootstrapFile>;
  /** Creates a user-paid device, or powers on an existing device by ID. */
  startCloudDevice(input: StartCloudDeviceInput): Promise<CloudDevice>;
  /** Requests graceful shutdown; the provider continues billing for retained resources. */
  stopCloudDevice(id: string): Promise<CloudDevice>;
  renameDevice(id: string, name: string): Promise<void>;
  /** Stops the device from renewing Cloud access. Removing the current device signs it out. */
  removeDevice(id: string): Promise<void>;
  projectSyncStatus(projectId?: string): Promise<ProjectSyncStatus>;
  /** Syncs the project on every device of the account that has it. */
  syncProject(projectId?: string): Promise<void>;
  /**
   * Makes the project local on every device. Each device keeps its copy and the encrypted
   * Cloud data stays, so syncing again merges the copies.
   */
  stopProjectSync(projectId?: string): Promise<void>;
}
