import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get a user's display name, preferring fullName over GitHub username.
 */
export function displayName(user: { fullName?: string | null; name?: string | null; email?: string | null }): string {
  return user.fullName || user.name || user.email || "Unknown";
}
