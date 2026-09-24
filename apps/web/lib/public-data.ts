import { ApiError, apiFetch } from './api';

// A temporary outage is distinct from a successful response with no records.
export async function loadPublicData<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500)) {
      console.warn(`Public data unavailable: ${path} (status ${error.status})`);
      return null;
    }
    throw error;
  }
}
