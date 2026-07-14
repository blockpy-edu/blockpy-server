/**
 * Date formatting utilities for SolidJS frontend
 */

export function formatDuration(timestamp: string | null, current: string | null = null): string {
  if (!timestamp) {
    return "Never";
  }
  
  const start = new Date(timestamp);
  const end = current ? new Date(current) : new Date();
  const diff = end.getTime() - start.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
  }
}

export function prettyPrintDateTime(timestamp: string | null): string {
  if (!timestamp) {
    return "Unknown";
  }
  const date = new Date(timestamp);
  return date.toLocaleString();
}

export function prettyPrintDateTimeString(timestamp: string | null): string {
  return prettyPrintDateTime(timestamp);
}

export function prettyPrintDate(timestamp: string | null): string {
  if (!timestamp) {
    return "Unknown";
  }
  const date = new Date(timestamp);
  return date.toLocaleDateString();
}

export function prettyPrintTime(timestamp: string | null): string {
  if (!timestamp) {
    return "Unknown";
  }
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}
