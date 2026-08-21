import { headerTrailingMenuPath, type WorkbenchModuleContribution } from "../../core";

const emptyMainRendererId = "hello-world.empty-main";
const welcomeWidgetId = "hello-world.welcome";
const openWelcomeCommandId = "hello-world.openWelcome";
const mainHeaderTrailingMenuPath = headerTrailingMenuPath("main");

const ExamplePanel = (props: { title: string; description: string }) => {
  const { title, description } = props;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p>{description}</p>
    </div>
  );
};

export const createHelloWorldModule = (): WorkbenchModuleContribution => ({
  id: "hello-world",
  activate(ctx) {
    ctx.layout.registerPlaceholder({
      id: emptyMainRendererId,
      title: "Empty main",
      region: "main",
      rendererId: emptyMainRendererId,
    });

    ctx.layout.registerPanel({
      id: welcomeWidgetId,
      title: "Welcome",
      region: "main",
      rendererId: welcomeWidgetId,
    });

    ctx.renderers.registerRenderer({
      id: emptyMainRendererId,
      render: () => <ExamplePanel title="Nothing open" description="Open a widget to get started." />,
    });

    ctx.renderers.registerRenderer({
      id: welcomeWidgetId,
      render: () => (
        <ExamplePanel title="Hello world" description="A workbench module rendered into the main region." />
      ),
    });

    ctx.commands.registerCommand(
      {
        id: openWelcomeCommandId,
        label: "Open tab",
        category: "Hello world",
        icon: "plus",
      },
      {
        execute: () => ctx.layout.openPanel(welcomeWidgetId),
      },
    );

    ctx.layout.registerMenuItem(mainHeaderTrailingMenuPath, {
      commandId: openWelcomeCommandId,
      group: "primary",
      order: 10,
    });
  },
});
