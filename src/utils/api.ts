// Small API helper: dedupe identical in-flight requests and handle 429 Retry-After with jittered backoff
// Add a very short TTL cache for GET /api/me to avoid flooding the auth endpoint on rapid navigation/refresh.
const inFlight = new Map<string, Promise<any>>();

// Short in-memory cache for specific lightweight GETs (key -> { expires, responseWrapper })
const shortCache = new Map<string, { expires: number; response: any }>();

function makeKey(url: string, init?: RequestInit) {
  try {
    return url + '|' + JSON.stringify({ method: (init && init.method) || 'GET', body: init && (init as any).body ? (init as any).body : null });
  } catch (e) {
    return url + '|' + ((init && init.method) || 'GET');
  }
}

function jitter(ms: number) {
  return ms + Math.floor(Math.random() * ms * 0.5);
}

export async function fetchWithBackoff(url: string, init: RequestInit = {}, maxRetries = 4): Promise<any> {
  const key = makeKey(url, init);

  // Very short cache for /api/me (1.5s by default) to dedupe rapid refreshes
  if ((init.method || 'GET').toUpperCase() === 'GET' && url.includes('/api/me')) {
    const cached = shortCache.get(key);
    if (cached && cached.expires > Date.now()) {
  // Return the cached wrapper/response directly (wrapper exposes json()/text()/ok/status/headers)
  return cached.response;
    }
  }

  if (inFlight.has(key)) {
    return inFlight.get(key)!;
  }

  const p = (async () => {
    let attempt = 0;
    let delay = 500; // start lower for snappier retries

    while (true) {
      attempt += 1;
      let res: Response;
      try {
        res = await fetch(url, init);
      } catch (err) {
        if (attempt > maxRetries) throw err;
        await new Promise(r => setTimeout(r, jitter(delay)));
        delay = Math.min(5000, delay * 2);
        continue;
      }

      if (res.status === 429) {
        // Respect Retry-After header when present
        const ra = res.headers.get('Retry-After');
        let wait = ra ? parseInt(ra, 10) * 1000 : jitter(delay);
        if (!isFinite(wait) || wait <= 0) wait = jitter(delay);

        if (attempt > maxRetries) {
          return res;
        }

        await new Promise(r => setTimeout(r, wait));
        delay = Math.min(10000, delay * 2);
        continue;
      }

      // Read body once and produce a wrapper so multiple .json()/.text() calls work safely
      let bodyText: string | null = null;
      try {
        bodyText = await res.clone().text();
      } catch (e) {
        bodyText = null;
      }

      const makeWrapper = () => ({
        ok: res.ok,
        status: res.status,
        headers: res.headers,
        json: async () => {
          if (bodyText === null) return Promise.reject(new Error('No body'));
          try { return JSON.parse(bodyText); } catch (e) { return Promise.reject(e); }
        },
        text: async () => bodyText,
        clone: () => makeWrapper()
      });

      const wrapper = makeWrapper();

      // cache successful /api/me responses briefly to avoid refetch storms
      if ((init.method || 'GET').toUpperCase() === 'GET' && url.includes('/api/me') && res.ok) {
        try {
          shortCache.set(key, { expires: Date.now() + 1500, response: wrapper });
        } catch (e) {
          // ignore
        }
      }

      return wrapper;
    }
  })();

  inFlight.set(key, p);
  try {
    const result = await p;
    return result;
  } finally {
    inFlight.delete(key);
  }
}

export default fetchWithBackoff;
