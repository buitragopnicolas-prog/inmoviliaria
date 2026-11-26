import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { apiBaseUrl, apiFetch, ApiError } from './api';
import { resolveCopy, type SiteSection } from './site-content';

// All sections returned by this endpoint are public. Private session data is never cached here.
const publishedSections = unstable_cache(
  () => apiFetch<SiteSection[]>('/site-content'),
  ['jb-published-sections', apiBaseUrl()],
  { tags: ['site-content'], revalidate: 30 },
);

// Editors need the current revision, including writes made directly through the API.
export const editSite = cache(() => apiFetch<SiteSection[]>('/site-content'));

export const readSite = cache(async () => {
  try {
    return resolveCopy(await publishedSections());
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500)) {
      return resolveCopy();
    }
    throw error;
  }
});
