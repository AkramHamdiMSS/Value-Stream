import { showToast } from "./lib/toast";
import { incLoading, decLoading } from "./lib/loading";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const TOKEN_KEY = "pilotage_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Every request funnels through here, so this is also the one place that
// needs to surface failures (toast) and track in-flight activity (loading
// bar) for the whole app — individual screens don't have to remember to.
async function request(path, { method = "GET", body, silent = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  incLoading();
  try {
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      const message = "Impossible de contacter le serveur. Vérifiez votre connexion.";
      if (!silent) showToast(message, "error");
      throw new Error(message);
    }

    if (res.status === 204) return null;
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : null;

    if (!res.ok) {
      const message = (data && data.error) || `Erreur ${res.status}`;
      if (!silent) showToast(message, "error");
      throw new Error(message);
    }
    return data;
  } finally {
    decLoading();
  }
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  patch: (path, body, opts) => request(path, { method: "PATCH", body, ...opts }),
  delete: (path, opts) => request(path, { method: "DELETE", ...opts }),
};
