const APP_TITLE = "Prompt Studio";

const getProjectSectionTitle = (pathSegments: string[]) => {
  const section = pathSegments[2];

  if (section === "tickets") return "Tickets";
  if (section === "docs") return "Docs";
  if (section === "sessions") return "Sessions";
  if (section === "changelog") return "Changelog";
  if (section === "settings") return "Settings";

  return null;
};

export const getPageTitle = (pathname: string, projectName?: string) => {
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
    const sectionTitle = getProjectSectionTitle(pathSegments);
    if (!sectionTitle || !projectName) {
      return APP_TITLE;
    }

    return `${projectName} > ${sectionTitle}`;
  }

  return APP_TITLE;
};
