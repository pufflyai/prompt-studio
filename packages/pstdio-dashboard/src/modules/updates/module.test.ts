import { describe, expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { createUpdatesModule } from "./module";
import type { UpdateChannel } from "./update-channel-bridge";

const desktopBridge = (channel: Promise<UpdateChannel | null>) => ({
  getAppInfo: async () => ({ version: "1.2.3" }),
  getUpdateChannel: () => channel,
  setUpdateChannel: async () => undefined,
});

describe("createUpdatesModule", () => {
  test("shows the Update channel panel when the desktop build can switch channel", async () => {
    const workbench = createWorkbench();
    const channel = Promise.resolve<UpdateChannel>("stable");

    workbench.registerModule(createUpdatesModule(desktopBridge(channel)));
    await channel;

    expect(workbench.settings.getPanel("update-channel")).toMatchObject({
      section: "workbench",
      scope: "global",
    });
  });

  test("hides the panel when the build cannot switch channel", async () => {
    const workbench = createWorkbench();
    const channel = Promise.resolve(null);

    workbench.registerModule(createUpdatesModule(desktopBridge(channel)));
    await channel;

    expect(workbench.settings.getPanel("update-channel")).toBeUndefined();
  });

  test("hides the panel outside the desktop app", () => {
    const workbench = createWorkbench();

    workbench.registerModule(createUpdatesModule({}));

    expect(workbench.settings.getPanel("update-channel")).toBeUndefined();
  });

  test("adds no panel when the module is disposed before the channel loads", async () => {
    const workbench = createWorkbench();
    const { promise: channel, resolve } = Promise.withResolvers<UpdateChannel>();

    const module = workbench.registerModule(createUpdatesModule(desktopBridge(channel)));
    module.dispose();
    resolve("nightly");
    await channel;

    expect(workbench.settings.getPanel("update-channel")).toBeUndefined();
  });

  test("removes the panel when the module is disposed", async () => {
    const workbench = createWorkbench();
    const channel = Promise.resolve<UpdateChannel>("nightly");

    const module = workbench.registerModule(createUpdatesModule(desktopBridge(channel)));
    await channel;
    module.dispose();

    expect(workbench.settings.getPanel("update-channel")).toBeUndefined();
  });
});
