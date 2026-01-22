/**
 * Gravatar URL utility
 * Generates Gravatar URLs from email addresses using proper MD5 hashing
 */

import md5 from 'blueimp-md5';

export type GravatarDefault = 'mp' | 'identicon' | 'monsterid' | 'wavatar' | 'retro' | 'robohash' | 'blank';

interface GravatarOptions {
  /** Size in pixels (1-2048) */
  size?: number;
  /** Default image style when no Gravatar exists */
  defaultImage?: GravatarDefault;
  /** Force default image even if Gravatar exists */
  forceDefault?: boolean;
}

/**
 * Generates a Gravatar URL from an email address
 *
 * @param email - The user's email address
 * @param options - Configuration options
 * @returns Gravatar URL string
 *
 * @example
 * ```ts
 * const url = getGravatarUrl('user@example.com', { size: 80 });
 * // https://www.gravatar.com/avatar/...?s=80&d=mp
 * ```
 */
export function getGravatarUrl(email: string | undefined | null, options: GravatarOptions = {}): string {
  const { size = 80, defaultImage = 'mp', forceDefault = false } = options;

  if (!email) {
    // Return default Gravatar when no email
    return `https://www.gravatar.com/avatar/00000000000000000000000000000000?s=${size}&d=${defaultImage}`;
  }

  // Normalize email: trim and lowercase (Gravatar requirement)
  const normalizedEmail = email.trim().toLowerCase();

  // Generate proper MD5 hash
  const hash = md5(normalizedEmail);

  // Build URL with query params
  const params = new URLSearchParams({
    s: size.toString(),
    d: defaultImage,
  });

  if (forceDefault) {
    params.set('f', 'y');
  }

  return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
}

/**
 * Gets the avatar URL with Gravatar as fallback
 *
 * @param avatarUrl - Custom avatar URL (if any)
 * @param email - User's email for Gravatar fallback
 * @param options - Gravatar options
 * @returns The avatar URL to use
 */
export function getAvatarWithGravatarFallback(
  avatarUrl: string | undefined | null,
  email: string | undefined | null,
  options: GravatarOptions = {}
): string {
  if (avatarUrl) {
    return avatarUrl;
  }
  return getGravatarUrl(email, options);
}

/**
 * Gets initials from a name for avatar fallback
 */
export function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
