export const formatRelativeDate = (isoDate: string): string => {
  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return 'Unknown';
  }

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) {
    return 'just now';
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  if (hours < 24) {
    return `${hours}h ago`;
  }

  if (days < 30) {
    return `${days}d ago`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo ago`;
  }

  const years = Math.floor(months / 12);
  return `${years}y ago`;
};

export const formatCoins = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.trunc(value) : 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
};

export const formatVnd = (value: number): string => {
  const amount = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)}đ`;
};

const toSafeDate = (isoDate: string): Date | null => {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toDateLabel = (isoDate: string): string => {
  const date = toSafeDate(isoDate);
  if (!date) {
    return 'Unknown date';
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const toDateTimeLabel = (isoDate: string): string => {
  const date = toSafeDate(isoDate);
  if (!date) {
    return 'Unknown date';
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
