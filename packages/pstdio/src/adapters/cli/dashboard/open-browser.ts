import { exec } from "node:child_process";

type Opener = (command: string) => void;

export const openBrowser = (url: string, platform = process.platform as string, opener: Opener = exec) => {
  let command = `xdg-open "${url}"`;
  if (platform === "darwin") command = `open "${url}"`;
  if (platform === "win32") command = `start "" "${url}"`;

  opener(command);
};
