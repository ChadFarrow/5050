import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSats(millisats: number): string {
  const sats = Math.floor(millisats / 1000);
  if (sats >= 1000000) {
    return `${(sats / 1000000).toFixed(1)}M sats`;
  } else if (sats >= 1000) {
    return `${(sats / 1000).toFixed(1)}K sats`;
  } else {
    return `${sats.toLocaleString()} sats`;
  }
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return "Ended";
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
