import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { cacheGet, cacheSet, commonsPhoto, usedPhotos, wikiPhoto } from "../photos";

const strip = (n) =>
  n.replace(/^(breakfast|brunch|lunch|dinner|snacks?|coffee|tea|visit|explore|stroll|walk|shopping|sunset|sunrise)( at| in| to| around| through)?\s+/i, "");

const hash = (t) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const FOOD_FB = ["street food", "cuisine", "restaurant", "local dish", "thali", "sweets dessert"];
const PLACE_FB = ["landmark", "monument", "market", "street", "tourism", "heritage"];

// [specific search, varied broader search, last-resort city search]
function queries(name, dest, type, title) {
  const city = dest.split(",")[0].trim();
  const base = strip(title || name);
  const pick = (arr) => arr[hash(name) % arr.length];
  if (type === "food") return [`${base} food`, `${city} ${pick(FOOD_FB)}`, `${city} food`];
  return [`${base} ${city}`, `${city} ${pick(PLACE_FB)}`, `${city} travel`];
}

export default function PlaceImage({ title, name, dest, type, load }) {
  const key = `${type}|${title || ""}|${name}|${dest}`;
  const hidden = type === "transport" || type === "stay";
  const [st, setSt] = useState({ status: "idle" }); // idle | loading | ok | none

  const run = useCallback(async () => {
    const cached = cacheGet(key);
    if (cached) { usedPhotos.add(cached.src); return setSt({ status: "ok", img: cached }); }
    setSt({ status: "loading" });
    const [q, fb1, fb2] = queries(name, dest, type, title);
    const why = [];
    const attempt = async (fn) => { try { return await fn(); } catch (e) { why.push(e.message); return null; } };

    let img = await attempt(() => wikiPhoto(title, 700, usedPhotos));      // 1. exact Wikipedia article
    if (!img) {                                                            // 2. Pixabay / Pexels via backend, if keyed
      try {
        const r = await api.photo(q, fb1);
        if (r.photo && !usedPhotos.has(r.photo.src)) { usedPhotos.add(r.photo.src); img = r.photo; }
        else if (r.errors?.length) why.push(r.errors.join(", "));
      } catch (e) { why.push(`backend: ${e.message}`); }
    }
    if (!img) img = await attempt(() => commonsPhoto(q, 900, usedPhotos));   // 3. Commons: specific
    if (!img) img = await attempt(() => commonsPhoto(fb1, 900, usedPhotos)); // 4. Commons: varied broader search
    if (!img) img = await attempt(() => commonsPhoto(fb2, 900, usedPhotos)); // 5. Commons: city
    if (img) { cacheSet(key, img); return setSt({ status: "ok", img }); }
    setSt({ status: "none", why: why[0] || "no match found" });
  }, [key]);

  useEffect(() => { if (load && !hidden && st.status === "idle") run(); }, [load, hidden]);

  if (hidden || st.status === "idle") return null;
  if (st.status === "loading") return <div className="skeleton" style={{ height: 170, margin: "6px 0 8px" }} />;
  if (st.status === "none") {
    const city = dest.split(",")[0].trim();
    return (
      <div className="pic-miss">
        <span>📷 No photo yet — {st.why}</span>
        <button className="chip pick" onClick={run}>Retry</button>
        <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} ${city}`)}`} target="_blank" rel="noreferrer">See photos ↗</a>
      </div>
    );
  }
  const img = st.img;
  return (
    <figure className="pic">
      <img src={img.src} alt={name} loading="lazy" referrerPolicy="no-referrer"
        onError={() => setSt({ status: "none", why: "image failed to load" })} />
      <figcaption><a href={img.page} target="_blank" rel="noreferrer">Photo: {img.credit}</a></figcaption>
    </figure>
  );
}
