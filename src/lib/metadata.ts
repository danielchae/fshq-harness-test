import type { Metadata } from 'next';

const SITE_NAME = 'FSHQ.gg';
const SITE_DESCRIPTION = "Your Fantasy Sports Clubhouse - Connect leagues, track pick'ems, and compete on leaderboards";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fshq.gg';

/**
 * Base metadata configuration for FSHQ.gg
 */
export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ['fantasy sports', 'fantasy football', "pick'ems", 'leaderboard', 'sleeper', 'fantasy leagues'],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

/**
 * Create page-specific metadata
 */
export function createMetadata(options: {
  title: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
}): Metadata {
  const { title, description, path = '', noIndex = false } = options;
  const url = `${SITE_URL}${path}`;
  const pageDescription = description || SITE_DESCRIPTION;

  return {
    title,
    description: pageDescription,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: pageDescription,
      url,
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: pageDescription,
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}

/**
 * Create metadata for league pages
 */
export function createLeagueMetadata(options: {
  leagueName: string;
  pageTitle: string;
  description?: string;
  slug: string;
}): Metadata {
  const { leagueName, pageTitle, description, slug } = options;
  const title = `${pageTitle} - ${leagueName}`;
  const pageDescription = description || `${pageTitle} for ${leagueName} on ${SITE_NAME}`;
  const url = `${SITE_URL}/leagues/${slug}`;

  return {
    title,
    description: pageDescription,
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: pageDescription,
      url,
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: pageDescription,
    },
  };
}
