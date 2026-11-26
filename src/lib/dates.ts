const TZ = 'Asia/Karachi';

export function todayKarachi(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function karachiLongDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date());
}

export function karachiMonthYear(): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'long', year: 'numeric' }).format(new Date());
}
