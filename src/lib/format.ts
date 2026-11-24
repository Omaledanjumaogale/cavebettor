const TZ = 'Africa/Lagos';

export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso));
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date(iso));
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...opts
  }).format(new Date(iso));
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'just now';
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins}m ago` : `in ${-mins}m`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours}h ago` : `in ${-hours}h`;
  const days = Math.round(hours / 24);
  return days > 0 ? `${days}d ago` : `in ${-days}d`;
}

export function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'starting';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `${hours}h ${rem}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  // One-word clubs get three letters: a lone "N" badge reads as a placeholder.
  if (words.length === 1) return (words[0] ?? '').slice(0, 3).toUpperCase();
  return words
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function statusLabel(status: string): string {
  return status === 'scheduled'
    ? 'Upcoming'
    : status === 'live'
      ? 'Live'
      : status === 'halftime'
        ? 'Half-time'
        : status === 'finished'
          ? 'Finished'
          : 'Postponed';
}
