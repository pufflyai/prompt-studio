type UpdateWhenAttemptStatusInput = {
  all_attempts_status: string;
  set_status: string;
};

export const updateWhenAttemptStatus = async (
  baseUrl: string,
  ticketId: string,
  input: UpdateWhenAttemptStatusInput,
) => {
  const res = await fetch(`${baseUrl}/v1/tickets/${ticketId}/update-when-attempt-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json()) as { error: string };
    throw new Error(body.error);
  }

  return (await res.json()) as { updated: boolean };
};
