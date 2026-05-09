// Tiny wake-lock helper. Falls back to a no-op when the API isn't available
// (Safari < 16.4, some embedded WebViews).

// We type defensively: the WakeLock type isn't in every TS lib version we run on.
type Sentinel = {
  release: () => Promise<void>;
  released: boolean;
  addEventListener: (event: string, handler: () => void) => void;
};

let sentinel: Sentinel | null = null;

function getApi(): { request: (type: "screen") => Promise<Sentinel> } | null {
  if (typeof navigator === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const api = (navigator as any).wakeLock;
  return api ?? null;
}

export function isSupported(): boolean {
  return getApi() !== null;
}

export async function acquire(): Promise<boolean> {
  const api = getApi();
  if (!api) return false;
  try {
    sentinel = await api.request("screen");
    sentinel.addEventListener("release", () => {
      sentinel = null;
    });
    return true;
  } catch {
    sentinel = null;
    return false;
  }
}

export async function release(): Promise<void> {
  if (!sentinel) return;
  try {
    await sentinel.release();
  } catch {
    // ignore
  }
  sentinel = null;
}

export function isHeld(): boolean {
  return sentinel !== null && !sentinel.released;
}
