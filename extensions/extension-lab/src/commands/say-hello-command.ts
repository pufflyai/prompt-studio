import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { LAB_ROUTE_HEADER_WHEN } from "../utils/lab-constants";

export const sayHelloCommand = defineCommand({
  title: l10n("commands.sayHello.title", "Say hello"),
  cli: true,
  menus: [
    {
      target: "workbench.nav.actions",
      label: l10n("commands.sayHello.headerLabel", "Lab: Say hello"),
      icon: "flask-conical",
      presentation: "button",
      when: LAB_ROUTE_HEADER_WHEN,
    },
    { target: "workbench.commandPalette", group: "Lab", label: l10n("commands.sayHello.paletteLabel", "Say hello") },
  ],
  async run(ctx) {
    const model = await ctx.settings.get("model.default");
    const tone = await ctx.settings.get("greeting.tone");
    const attachment = ctx.attachment;
    const projectName = attachment?.resource?.label ?? ctx.resource?.label ?? ctx.resource?.id ?? ctx.projectId;
    await ctx.notify.toast({
      type: "info",
      title: "Lab",
      message: `Hello from the lab — project ${projectName}`,
    });
    return { attachment, message: "hello dispatched", model, tone };
  },
});
