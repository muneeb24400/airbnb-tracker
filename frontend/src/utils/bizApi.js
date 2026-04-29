/**
 * bizApi.js
 * Central helper for ALL direct fetch calls in components.
 * Automatically appends ?businessId= to every request.
 * Import getBizId() and bizFetch() instead of raw fetch().
 */

const BASE_URL = process.env.REACT_APP_API_URL || "";

/** Get the active businessId from session storage */
export function getBizId() {
  return sessionStorage.getItem("st_businessId") || "";
}

/** Build a URL with businessId query param appended */
export function bizUrl(path) {
  const id = getBizId();
  const sep = path.includes("?") ? "&" : "?";
  return id ? `${BASE_URL}${path}${sep}businessId=${encodeURIComponent(id)}` : `${BASE_URL}${path}`;
}

/** fetch() wrapper that auto-injects businessId into every request */
export async function bizFetch(path, options = {}) {
  const id  = getBizId();
  const url = bizUrl(path);

  // For methods with a body, also inject businessId into the JSON body
  if (options.body && options.headers?.["Content-Type"] === "application/json") {
    try {
      const body = JSON.parse(options.body);
      if (!body.businessId) body.businessId = id;
      options = { ...options, body: JSON.stringify(body) };
    } catch {}
  }

  return fetch(url, options);
}
