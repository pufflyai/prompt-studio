/** This device's cloud login. The device credential stays in the native host. */
export interface DeviceLogin {
  managerOrigin: string;
  relayOrigin: string;
  accountId: string;
  deviceId: string;
  /** Verified by the Google sign-in exchange. Older logins may not include it. */
  email?: string;
}

export interface AccountStatus {
  login: DeviceLogin | null;
  /** Cloud projects of the account. This device syncs the ones that exist on it. */
  cloudProjects: string[];
  /** False until this login's Cloud project list has been read from the account service. */
  cloudProjectsLoaded: boolean;
}

export interface AccountDevice {
  id: string;
  name: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  /** The account service heard from this device within its presence lease window. */
  online: boolean;
  /** True for the device that answered the request. */
  current: boolean;
}

/** A native browser sign-in. Open `url` in a browser on the computer that runs Prompt Studio. */
export interface AccountLogin {
  id: string;
  url: string;
}

export type AccountLoginStatus = "pending" | "complete" | "failed";
