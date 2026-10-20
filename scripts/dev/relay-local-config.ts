// The host's private account file. The launcher writes it for the fixture device.
export interface LocalAccountFile {
  login: {
    managerOrigin: string;
    relayOrigin: string;
    accountId: string;
    deviceId: string;
    token: string;
  } | null;
}

// A saved login counts only when it belongs to this app's device in the fixture account.
export const savedFixtureLogin = (file: LocalAccountFile, device: { accountId: string; deviceId: string }) =>
  file.login?.accountId === device.accountId && file.login.deviceId === device.deviceId ? file.login : null;

export const localLoginNeedsEnrollment = (status: number) => {
  if (status === 200) return false;
  if (status === 401) return true;
  throw new Error(`Local authority renewal unavailable (${status})`);
};
