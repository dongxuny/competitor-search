export function normalizeLogoUrl(value?: string | null) {
  const nextValue = value?.trim() || '';
  return /^https?:\/\//i.test(nextValue) ? nextValue : '';
}

export function getFaviconUrl(website?: string | null) {
  const nextWebsite = website?.trim() || '';

  if (!nextWebsite) {
    return '';
  }

  try {
    return `${new URL(nextWebsite).origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function getHostname(website?: string | null) {
  const nextWebsite = website?.trim() || '';

  if (!nextWebsite) {
    return '';
  }

  try {
    return new URL(nextWebsite).hostname;
  } catch {
    return '';
  }
}

function getGoogleFaviconUrl(website?: string | null) {
  const hostname = getHostname(website);
  return hostname ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64` : '';
}

function getDuckDuckGoFaviconUrl(website?: string | null) {
  const hostname = getHostname(website);
  return hostname ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostname)}.ico` : '';
}

export function getSiteLogoCandidates(website?: string | null, logo?: string | null) {
  const candidates = [
    normalizeLogoUrl(logo),
    getFaviconUrl(website),
    getGoogleFaviconUrl(website),
    getDuckDuckGoFaviconUrl(website),
  ].filter(Boolean);
  return [...new Set(candidates)];
}
