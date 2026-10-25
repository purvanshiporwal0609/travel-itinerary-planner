import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

const INTERESTS = [["Food", "🍜"], ["Sightseeing", "📸"], ["Culture & history", "🏛️"], ["Adventure", "🧗"], ["Nature", "🌿"],
  ["Shopping", "🛍️"], ["Nightlife", "🎶"], ["Relaxation", "🧘"], ["Photography", "📷"]];
const STYLES = [{ v: "budget", i: "🎒", t: "Budget", d: "Max value" }, { v: "balanced", i: "⚖️", t: "Balanced", d: "Comfort + value" }, { v: "luxury", i: "💎", t: "Premium", d: "Treat yourself" }];
const PACES = [{ v: "relaxed", i: "🌴", t: "Relaxed", d: "2–3 plans a day" }, { v: "moderate", i: "🚶", t: "Moderate", d: "Steady pace" }, { v: "packed", i: "⚡", t: "Packed", d: "See it all" }];
const IDEAS = ["Goa", "Jaipur", "Manali", "Kerala", "Bali", "Paris", "Dubai"];
const STEPS = ["Understanding your preferences…", "Scouting the best spots…", "Planning meals and routes…", "Balancing your budget…", "Polishing each day…"];
const today = new Date().toISOString().slice(0, 10);

const Stepper = ({ label, value, min, max, onChange }) => (
  <div className="field"><span className="label">{label}</span>
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <b>{value}</b>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div></div>
);

const Options = ({ items, value, onChange }) => (
  <div className="opts">{items.map((o) => (
    <button type="button" key={o.v} className={"opt" + (value === o.v ? " on" : "")} onClick={() => onChange(o.v)}>
      <span>{o.i}</span><b>{o.t}</b><small>{o.d}</small></button>))}</div>
);

export default function TripBuilder() {
  const nav = useNavigate();
  const [f, setF] = useState({ destination: "", start_date: today, num_days: 3, budget: 20000, currency: "INR",
    travel_style: "balanced", pace: "moderate", group_size: 2, interests: ["Food", "Sightseeing"], notes: "" });
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (i) => set("interests", f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i]);

  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 3500);
    return () => clearInterval(t);
  }, [busy]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setStep(0); setErr("");
    try { const trip = await api.generate(f); nav(`/trips/${trip.id}`); }
    catch (ex) { setErr(ex.message); setBusy(false); }
  }

  return (
    <>
      <div className="page-head"><h1>Plan your next trip ✈️</h1><p className="muted">Tell us what you like — we'll craft a day-by-day plan in seconds.</p></div>
      <form className="card stack big" onSubmit={submit}>
        <div className="field"><span className="label">Where to?</span>
          <input required value={f.destination} onChange={(e) => set("destination", e.target.value)} placeholder="e.g. Goa, India" />
          <div className="row wrap">{IDEAS.map((d) => <button type="button" key={d} className="chip pick" onClick={() => set("destination", d)}>{d}</button>)}</div></div>

        <div className="cols">
          <div className="field"><span className="label">Start date</span><input type="date" required min={today} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
          <Stepper label="Days" value={f.num_days} min={1} max={14} onChange={(v) => set("num_days", v)} />
          <Stepper label="Travellers" value={f.group_size} min={1} max={30} onChange={(v) => set("group_size", v)} />
        </div>

        <div className="cols">
          <div className="field"><span className="label">Total budget (whole group)</span>
            <input type="number" min={1} value={f.budget} onChange={(e) => set("budget", Number(e.target.value))} />
            <input type="range" min={2000} max={300000} step={1000} value={Math.min(Math.max(f.budget, 2000), 300000)} onChange={(e) => set("budget", Number(e.target.value))} /></div>
          <div className="field"><span className="label">Currency</span>
            <select value={f.currency} onChange={(e) => set("currency", e.target.value)}>{["INR", "USD", "EUR", "GBP", "AED", "SGD"].map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>

        <div className="field"><span className="label">Travel style</span><Options items={STYLES} value={f.travel_style} onChange={(v) => set("travel_style", v)} /></div>
        <div className="field"><span className="label">Pace</span><Options items={PACES} value={f.pace} onChange={(v) => set("pace", v)} /></div>

        <div className="field"><span className="label">Interests</span>
          <div className="row wrap">{INTERESTS.map(([n, e]) => (
            <button type="button" key={n} className={"chip pick lg" + (f.interests.includes(n) ? " on" : "")} onClick={() => toggle(n)}>{e} {n}</button>))}</div></div>

        <div className="field"><span className="label">Anything else? <span className="muted">(optional)</span></span>
          <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Vegetarian food, travelling with a toddler, love sunsets…" /></div>

        {err && <div className="notice error">{err}</div>}
        <button className="btn big" disabled={busy}>✨ Generate itinerary</button>
      </form>

      {busy && (
        <div className="overlay"><div className="loader-card">
          <div className="spinner" /><h3>Crafting your {f.num_days}-day trip to {f.destination}</h3>
          <p className="muted">{STEPS[step]}</p><small className="muted">This usually takes 15–40 seconds</small>
        </div></div>
      )}
    </>
  );
}
