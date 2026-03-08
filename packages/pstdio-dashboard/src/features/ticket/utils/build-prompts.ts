export const buildCreateSubTicketsPrompt = (ticketShorthand: string, templateName?: string) => {
  const template = templateName?.trim();

  if (!template) {
    return `breakdown ticket ${ticketShorthand} into sub-tickets`;
  }

  return `breakdown ticket ${ticketShorthand} into sub-tickets using template ${template}`;
};

export const buildRefineTicketPrompt = (ticketShorthand: string, additionalContext: string, templateName?: string) => {
  const context = additionalContext.trim();
  const template = templateName?.trim();
  const basePrompt = template
    ? `refine ticket: ${ticketShorthand} with template ${template}`
    : `refine ticket: ${ticketShorthand}`;

  if (context.length === 0) {
    return basePrompt;
  }

  return `${basePrompt}\n\nAdditional context:\n${context}`;
};
