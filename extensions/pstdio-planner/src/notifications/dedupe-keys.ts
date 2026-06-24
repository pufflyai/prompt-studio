const EXTENSION = "pstdio-planner";

export const proposalRefinedKey = (ticketId: string) => `${EXTENSION}:ticket:${ticketId}:proposal-refined`;

export const readyToMergeKey = (ticketId: string) => `${EXTENSION}:ticket:${ticketId}:ready-to-merge`;

export const blockedKey = (ticketId: string) => `${EXTENSION}:ticket:${ticketId}:blocked`;
