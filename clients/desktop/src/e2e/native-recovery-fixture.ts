import { once } from "node:events";
import { app, dialog, shell } from "electron";

app.setName("PromptStudioNativeRecoveryFixture");
app.setPath("userData", process.env.PSTDIO_NATIVE_TEST_PROFILE!);

// Keep the OS dialog as the automation boundary while exercising the real main entry point.
dialog.showMessageBox = (async (options: Electron.MessageBoxOptions) => {
  process.send!({ nativePrompt: true, buttons: options.buttons?.length, cancelId: options.cancelId });
  const [response] = await once(process, "message");
  return { response: Number(response), checkboxChecked: false };
}) as typeof dialog.showMessageBox;
shell.showItemInFolder = (path) => {
  process.send!({ logsOpened: true, privatePath: path.startsWith(process.env.PSTDIO_HOME!) });
};

try {
  await import(process.env.PSTDIO_NATIVE_TEST_MAIN!);
} catch (error) {
  process.send!({ fixtureError: String(error) });
  app.exit(1);
}
