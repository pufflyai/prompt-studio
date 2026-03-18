const APP_TITLE = "Prompt Studio";

export interface PageTitleOptions {
  settingsPanel?: string;
  sessionTitle?: string;
  docTitle?: string;
}

const getSettingsSectionTitle = (settingsPanel?: string) => {
  if (!settingsPanel) {
    return "Settings";
  }

  if (settingsPanel.startsWith("template:")) {
    const templateName = settingsPanel.slice("template:".length);
    if (templateName) {
      return templateName;
    }
  }

  if (settingsPanel === "tags") {
    return "Tags";
  }

  if (settingsPanel === "startup-script") {
    return "Startup Script";
  }

  if (settingsPanel === "danger-zone") {
    return "Danger Zone";
  }

  return "Settings";
};

const getTicketSectionTitle = (pathSegments: string[]) => {
  const ticketShorthand = pathSegments[3];
  const workspaceShorthand = pathSegments[5];

  if (workspaceShorthand && pathSegments[4] === "workspaces") {
    const attempt = workspaceShorthand.startsWith(`${ticketShorthand}_`)
      ? workspaceShorthand.slice(ticketShorthand.length + 1)
      : workspaceShorthand;
    return { title: `${ticketShorthand} > ${attempt}`, skipProjectPrefix: true };
  }

  if (ticketShorthand) {
    return { title: ticketShorthand };
  }

  return { title: "Tickets" };
};

const getSessionsSectionTitle = (pathSegments: string[], options: PageTitleOptions) => {
  const sessionId = pathSegments[3];
  if (sessionId && options.sessionTitle) {
    return options.sessionTitle;
  }

  return "Sessions";
};

const getProjectSectionTitle = (pathSegments: string[], options: PageTitleOptions) => {
  const section = pathSegments[2];

  if (section === "tickets") {
    return getTicketSectionTitle(pathSegments);
  }

  if (section === "docs") {
    if (options.docTitle) return { title: options.docTitle, skipProjectPrefix: true };
    return { title: "Docs" };
  }

  if (section === "sessions") {
    const sessionTitle = getSessionsSectionTitle(pathSegments, options);
    if (sessionTitle !== "Sessions") return { title: sessionTitle, skipProjectPrefix: true };
    return { title: sessionTitle };
  }

  if (section === "changelog") return { title: "Changelog" };

  if (section === "settings") {
    return { title: getSettingsSectionTitle(options.settingsPanel) };
  }

  return null;
};

export const getPageTitle = (pathname: string, projectName?: string, options: PageTitleOptions = {}) => {
  const pathSegments = pathname.split("/").filter(Boolean);

  if (pathname === "/projects") {
    return "Projects";
  }

  if (pathname === "/docs") {
    return "Docs";
  }

  if (pathname === "/settings") {
    return "Settings";
  }

  if (pathname === "/onboarding") {
    return "Onboarding";
  }

  if (pathSegments[0] === "projects" && pathSegments[1]) {
    const result = getProjectSectionTitle(pathSegments, options);
    if (!result) {
      return APP_TITLE;
    }

    if (result.skipProjectPrefix) {
      return result.title;
    }

    return `${projectName ?? "Project"} > ${result.title}`;
  }

  return APP_TITLE;
};
