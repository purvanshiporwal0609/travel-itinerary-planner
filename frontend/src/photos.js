import { api } from "./api";

const mem = new Map();

// Photos already shown in the current trip, so no picture is repeated.
export const usedPhotos = new Set();
const TTL = 12 * 3600 * 1000; // providers ask apps not to keep image URLs long-term

export function cacheGet(key) {
  if (mem.has(key)) return mem.get(key);
  try {
    const c = JSON.parse(localStorage.getItem("photo5:" + key) || "null");
    if (c && Date.now() - c.t < TTL) { mem.set(key, c.v); return c.v; }
  } catch {}
  return null;
}

export function cacheSet(key, v) {
  mem.set(key, v);
  try { localStorage.setItem("photo5:" + key, JSON.stringify({ t: Date.now(), v })); } catch {}
}

// Used by the hero banner: remembers good results, never caches failures.
export async function loadPhoto(key, run) {
  const c = cacheGet(key);
  if (c) return c;
  let res = null;
  try { res = await run(); } catch { res = null; }
  if (res) cacheSet(key, res);
  return res;
}

// Photos via our backend (Pixabay / Pexels if keyed, otherwise Wikimedia Commons)
export async function webPhoto(q, fb) {
  const r = await api.photo(q, fb);
  return r.photo;
}

// Wikipedia exact-article photo: great for famous landmarks and known dishes
export async function wikiPhoto(title, size = 700, skip) {
  if (!title) return null;
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|info" +
    `&inprop=url&piprop=thumbnail&pithumbsize=${size}&titles=${encodeURIComponent(title)}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const pages = Object.values((await r.json()).query?.pages || {});
  const p = pages.find((x) => x.thumbnail?.source && !/\.svg|map|locator|location|flag|logo|seal|emblem/i.test(decodeURIComponent(x.thumbnail.source.split("/").pop())));
  if (!p || skip?.has(p.thumbnail.source)) return null;
  skip?.add(p.thumbnail.source);
  return { src: p.thumbnail.source, hero: p.thumbnail.source, page: p.fullurl, credit: "Wikipedia" };
}

// Wikimedia Commons search, run in the browser (the Python backend gets 403 from Wikimedia)
const BAD = /\b(map|logo|flag|locator|diagram|coat of arms|seal|icon|chart|plan of|poster|stamp|banknote)\b/i;

export async function commonsPhoto(q, size = 900, skip) {
  if (!q) return null;
  const url =
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=15" +
    `&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=${size}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Commons HTTP ${r.status}`);
  const pages = Object.values((await r.json()).query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) {
    const i = p.imageinfo?.[0];
    if (!i || i.mime !== "image/jpeg" || !i.thumburl || BAD.test(p.title || "") || skip?.has(i.thumburl)) continue;
    skip?.add(i.thumburl); // claim it right away so two items can never pick the same photo
    const artist = (i.extmetadata?.Artist?.value || "").replace(/<[^>]+>/g, "").trim();
    return {
      src: i.thumburl, hero: i.thumburl, page: i.descriptionurl,
      credit: artist ? `${artist.slice(0, 40)} / Wikimedia Commons` : "Wikimedia Commons",
    };
  }
  return null;
}
