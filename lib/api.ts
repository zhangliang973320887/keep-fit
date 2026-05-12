// Tiny fetch wrapper for the Go backend.
//
// All requests go to /api/* (same origin in prod; configurable in dev).
// We send + receive the JWT auth cookie via `credentials: "include"`.

const API_BASE = (() => {
  if (typeof window === "undefined") return "";
  // Allow overriding for local dev via env (Next.js inlines NEXT_PUBLIC_*).
  return process.env.NEXT_PUBLIC_API_BASE || "";
})();

export class ApiError extends Error {
  status: number;
  /** Backend-defined error code like "wrong_credentials", "email_taken" */
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, init);

  // 204 No Content
  if (res.status === 204) return undefined as T;

  let parsed: any = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      // fall through — non-JSON response shouldn't crash callers
    }
  }

  if (!res.ok) {
    const code = parsed?.error ?? `http_${res.status}`;
    throw new ApiError(res.status, code);
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  del: <T = void>(path: string) => request<T>("DELETE", path),
};
