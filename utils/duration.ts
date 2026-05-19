/**
 * Format the duration between two dates into a human-readable string.
 * If endDate is not provided, uses current date (for "ongoing" events).
 */
export function formatDuration(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years <= 0 && months <= 0) {
    // Less than a month — show days
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    return `${days}d`;
  }

  if (years === 0) return `${months}mo`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}m`;
}

/**
 * Format a date range for display.
 * Examples: "Jun 2002 → Apr 2005", "Jun 2002 → Ongoing"
 */
export function formatDateRange(
  startDate: string,
  endDate?: string,
  isEndUnknown?: boolean,
  detailed?: boolean
): string {
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 'Unknown';

  const fmt: Intl.DateTimeFormatOptions = detailed
    ? { month: 'long', day: 'numeric', year: 'numeric' }
    : { month: 'short', year: 'numeric' };

  const startStr = start.toLocaleDateString('en-US', fmt);

  if (isEndUnknown) {
    return `${startStr} → Ongoing`;
  }

  if (!endDate) return startStr;

  const end = new Date(endDate);
  if (isNaN(end.getTime())) return startStr;

  const endStr = end.toLocaleDateString('en-US', fmt);
  return `${startStr} → ${endStr}`;
}
