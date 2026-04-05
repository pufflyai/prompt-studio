import type { CreateTicketInput } from "@pstdio/sdk/api";
import { apiClient } from "@/features/api-client";

export const createTicket = async (input: CreateTicketInput) => apiClient().tickets.create(input);
