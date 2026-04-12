const DEFAULT_MAX_TITLE_LENGTH = 36;

const truncateTitle = (title: string, maxLength: number) => {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength - 1)}…`;
};

export const formatTicketBreadcrumbLabel = (
  ticketShorthand: string,
  title: string | null | undefined,
  maxTitleLength = DEFAULT_MAX_TITLE_LENGTH,
) => {
  const normalizedTitle = title?.trim() ?? "";
  if (!normalizedTitle) {
    return ticketShorthand;
  }

  return `${ticketShorthand} ${truncateTitle(normalizedTitle, maxTitleLength)}`;
};
