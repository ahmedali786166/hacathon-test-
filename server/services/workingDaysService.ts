import { query, queryOne } from '../db/database.js';

export interface CompanySchedule {
  weekendDays: string[]; // e.g. ["Saturday", "Sunday"]
  startTime: string; // "09:00"
  graceMinutes: number; // 15
  halfDayHours: number; // 5.0
}

export async function getCompanySchedule(): Promise<CompanySchedule> {
  const settings = await queryOne<any>('SELECT weekend_days, start_time, grace_minutes, half_day_hours FROM company_settings LIMIT 1');
  let weekendDays = ['Saturday', 'Sunday'];
  if (settings?.weekend_days) {
    try {
      weekendDays = JSON.parse(settings.weekend_days);
    } catch {
      weekendDays = ['Saturday', 'Sunday'];
    }
  }

  return {
    weekendDays,
    startTime: settings?.start_time || '09:00',
    graceMinutes: settings?.grace_minutes ?? 15,
    halfDayHours: settings?.half_day_hours ?? 5.0,
  };
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function getTodayDateStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

export async function isHoliday(dateStr: string): Promise<boolean> {
  const row = await queryOne<{ count: number }>(
    'SELECT count(1) as count FROM company_holidays WHERE date = ?',
    [dateStr]
  );
  return (row?.count ?? 0) > 0;
}

export function isWeekend(date: Date, weekendDays: string[]): boolean {
  const dayName = getDayName(date);
  return weekendDays.includes(dayName);
}

/**
 * Calculates working days in a specified month (format 'YYYY-MM')
 */
export async function getWorkingDaysInMonth(yearMonth: string): Promise<number> {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  const schedule = await getCompanySchedule();
  const holidays = await query<{ date: string }>('SELECT date FROM company_holidays');
  const holidaySet = new Set(holidays.map(h => h.date));

  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const isoDate = d.toISOString().split('T')[0];
    const dayName = getDayName(d);

    if (!schedule.weekendDays.includes(dayName) && !holidaySet.has(isoDate)) {
      workingDays++;
    }
  }

  return Math.max(1, workingDays);
}

/**
 * Calculates working days between start date and end date (inclusive)
 * Skipping configured weekends and holidays.
 */
export async function calculateWorkingDaysBetween(
  startDateStr: string,
  endDateStr: string,
  customWeekendDays?: string[]
): Promise<{ workingDays: number; holidaysCount: number; weekendCount: number }> {
  const schedule = await getCompanySchedule();
  const weekends = customWeekendDays || schedule.weekendDays;

  const holidays = await query<{ date: string }>('SELECT date FROM company_holidays');
  const holidaySet = new Set(holidays.map(h => h.date));

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (start > end) {
    return { workingDays: 0, holidaysCount: 0, weekendCount: 0 };
  }

  let workingDays = 0;
  let holidaysCount = 0;
  let weekendCount = 0;

  const cur = new Date(start);
  while (cur <= end) {
    const iso = cur.toISOString().split('T')[0];
    const dayName = getDayName(cur);

    if (weekends.includes(dayName)) {
      weekendCount++;
    } else if (holidaySet.has(iso)) {
      holidaysCount++;
    } else {
      workingDays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  return { workingDays, holidaysCount, weekendCount };
}
