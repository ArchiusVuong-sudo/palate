import { getCalendarData } from "@/lib/queries";
import { CalendarView } from "./view";

export const dynamic = "force-dynamic";

/** Local-timezone "YYYY-MM-DD" (toISOString would shift the day in +TZ). */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const today = new Date();
  const monthKey =
    month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? month
      : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const [year, mon] = monthKey.split("-").map(Number);

  // Monday-start grid: pad to full weeks on both sides of the month.
  const first = new Date(year, mon - 1, 1);
  const last = new Date(year, mon, 0);
  const leading = (first.getDay() + 6) % 7; // days before the 1st (Mon = 0)
  const trailing = (7 - ((last.getDay() + 6) % 7) - 1) % 7; // days after the last
  const gridStart = new Date(year, mon - 1, 1 - leading);
  const gridEnd = new Date(year, mon - 1, last.getDate() + trailing);

  const days: string[] = [];
  for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
    days.push(isoDay(d));
  }

  const { posts, briefs } = await getCalendarData(isoDay(gridStart), isoDay(gridEnd));

  return (
    <CalendarView
      monthKey={monthKey}
      days={days}
      todayISO={isoDay(today)}
      posts={posts}
      briefs={briefs}
    />
  );
}
