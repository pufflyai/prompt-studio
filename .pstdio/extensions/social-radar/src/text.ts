export const plural = (count: number, word: string, many = `${word}s`) => `${count} ${count === 1 ? word : many}`;
// Day keys use the host's local calendar, like the 07:00 schedule.
export const localDay = (time: number | string) => new Date(time).toLocaleDateString("sv-SE");
