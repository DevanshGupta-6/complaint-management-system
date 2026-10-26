// lib/date.ts
const istDateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatIST(date: string | Date): string {
  return istDateTimeFormatter.format(typeof date === "string" ? new Date(date) : date);
}