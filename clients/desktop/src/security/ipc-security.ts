type IpcSender = {
  senderId: number;
  senderFrameUrl: string;
  isMainFrame: boolean;
};

type IpcPolicy = {
  expectedWebContentsId: number;
  lifecycleUrl: string;
  runtimeOrigin: string | null;
};

const isLifecycleUrl = (value: URL, lifecycleUrl: string) => {
  const expected = new URL(lifecycleUrl);
  value.hash = "";
  value.search = "";
  expected.hash = "";
  expected.search = "";
  return value.href === expected.href;
};

export const isAllowedIpcSender = (sender: IpcSender, policy: IpcPolicy) => {
  if (sender.senderId !== policy.expectedWebContentsId || !sender.isMainFrame) return false;
  try {
    const url = new URL(sender.senderFrameUrl);
    if (isLifecycleUrl(url, policy.lifecycleUrl)) return true;
    return Boolean(policy.runtimeOrigin && url.origin === policy.runtimeOrigin);
  } catch {
    return false;
  }
};
