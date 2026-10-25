import { supabase } from "./supabaseClient";
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function req(path, opts = {}, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const { data } = await supabase.auth.getSession();
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const res = await fetch(BASE + path, { ...opts, headers });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail); } catch {}
    throw new Error(msg);
  }
  return res.json();
}
const body = (b) => JSON.stringify(b);

export const api = {
  generate: (data) => req("/api/itineraries/generate", { method: "POST", body: body(data) }),
  list: () => req("/api/itineraries"),
  get: (id) => req(`/api/itineraries/${id}`),
  save: (id, plan, title) => req(`/api/itineraries/${id}`, { method: "PUT", body: body({ plan, title }) }),
  regenDay: (id, day, instruction) =>
    req(`/api/itineraries/${id}/regenerate-day`, { method: "POST", body: body({ day, instruction }) }),
  complete: (id) => req(`/api/itineraries/${id}/complete`, { method: "POST" }),
  remove: (id) => req(`/api/itineraries/${id}`, { method: "DELETE" }),
  share: (id, enabled) => req(`/api/itineraries/${id}/share`, { method: "POST", body: body({ enabled }) }),
  getShared: (id) => req(`/api/shared/${id}`, {}, false),
  
photo: (q, fb) =>
  req(
    `/api/photo?q=${encodeURIComponent(q)}&fb=${encodeURIComponent(fb || "")}`
  ),

};
