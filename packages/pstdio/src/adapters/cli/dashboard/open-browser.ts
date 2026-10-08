import { execFile } from "node:child_process";

type Opener = (file: string, args: string[]) => void;

const runOpener: Opener = (file, args) => {
  execFile(file, args, () => {});
};

// Each opener takes the URL as one argument with no shell in between. `cmd /c start` would parse
// the URL again, so Windows uses the URL protocol handler instead.
export const openBrowser = (url: string, platform = process.platform as string, opener: Opener = runOpener) => {
  if (platform === "darwin") opener("open", [url]);
  else if (platform === "win32") opener("rundll32", ["url.dll,FileProtocolHandler", url]);
  else opener("xdg-open", [url]);
};
