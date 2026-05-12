export type NtDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const ntDatePattern =
  /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i;

export function parseNtDateParts(value: string): NtDateParts {
  const match = value.trim().match(ntDatePattern);

  if (!match) {
    throw new Error(`Unsupported NinjaTrader date: ${value}`);
  }

  const [, year, month, day, hourRaw, minute, meridiem] = match;
  let hour = Number(hourRaw);

  if (meridiem.toUpperCase() === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem.toUpperCase() === "AM" && hour === 12) {
    hour = 0;
  }

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour,
    minute: Number(minute),
  };
}

export function ntDateToIso(value: string): string {
  const parts = parseNtDateParts(value);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  ).toISOString();
}

export function tradingDateFromNtPeriod(
  value: string,
  sessionStartHour = 18,
): string {
  const parts = parseNtDateParts(value);
  const date = new Date(parts.year, parts.month - 1, parts.day);

  if (parts.hour >= sessionStartHour) {
    date.setDate(date.getDate() + 1);
  }

  return formatDateKey(date);
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
