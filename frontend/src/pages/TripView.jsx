import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { usedPhotos } from "../photos";
import DayPanel from "../components/DayPanel.jsx";
import HeroImage from "../components/HeroImage.jsx";
import { TYPES, dayCost, dayDate, gradientFor, money, planTotals } from "../utils";

export default function TripView({ readOnly = false }) {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [plan, setPlan] = useState(null);
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(0);
  const [busyDay, setBusyDay] = useState(null);
  const [toast, setToast] = useState("");
  const [err, setErr] = useState("");
  const [completing, setCompleting] = useState(false);
  const [loadAll, setLoadAll] = useState(false);

  useEffect(() => {
    usedPhotos.clear(); // new trip = fresh pool of photos
    (readOnly ? api.getShared(id) : api.get(id))
      .then((t) => { setTrip(t); setPlan(t.plan); })
      .catch((e) => setErr(e.message));
  }, [id, readOnly]);

  const totals = useMemo(() => (plan ? planTotals(plan) : { total: 0, byType: {}, itemCount: 0 }), [plan]);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  if (err && !trip) return <div className="notice error">{err}</div>;
  if (!trip) return <div className="skeletons"><div className="skeleton tall" /><div className="skeleton" /><div className="skeleton" /></div>;

  const req = trip.request;
  const pct = Math.min(100, (totals.total / req.budget) * 100);
  const over = totals.total > req.budget;
  const missing = req.num_days - plan.days.length;

  async function save() {
    try { const t = await api.save(id, plan); setTrip(t); setPlan(t.plan); setEditing(false); flash("Changes saved ✓"); }
    catch (e) { setErr(e.message); }
  }
  async function regen(day, instr) {
    setBusyDay(day); setErr("");
    try { const t = await api.regenDay(id, day, instr); setTrip(t); setPlan(t.plan); flash(`Day ${day} updated ✓`); }
    catch (e) { setErr(e.message); } finally { setBusyDay(null); }
  }
  async function completeDays() {
    setCompleting(true); setErr("");
    try { const t = await api.complete(id); const first = plan.days.length; setTrip(t); setPlan(t.plan); setActive(first); flash("Missing days added ✓"); }
    catch (e) { setErr(e.message); } finally { setCompleting(false); }
  }
  function printAll() { setLoadAll(true); setTimeout(() => window.print(), 1800); } // let every day's photos load first

  async function toggleShare() {
    try {
      const t = await api.share(id, !trip.is_shared);
      setTrip(t);
      if (t.is_shared) { await navigator.clipboard?.writeText(`${location.origin}/shared/${id}`); flash("Share link copied ✓"); }
      else flash("Sharing turned off");
    } catch (e) { setErr(e.message); }
  }

  return (
    <>
      <div className="hero" style={{ background: gradientFor(req.destination) }}>
        <HeroImage destination={req.destination} />
        <div className="hero-top">
          {readOnly ? <span className="chip glass">Shared itinerary</span> : <Link to="/" className="chip glass">← All trips</Link>}
          {!readOnly && (
            <div className="row wrap no-print">
              {editing ? (<>
                <button className="btn light small" onClick={save}>Save changes</button>
                <button className="btn glass small" onClick={() => { setPlan(trip.plan); setEditing(false); }}>Cancel</button>
              </>) : (<>
                <button className="btn glass small" onClick={() => setEditing(true)}>✎ Edit</button>
                <button className="btn glass small" onClick={toggleShare}>{trip.is_shared ? "🔗 Sharing on" : "🔗 Share"}</button>
                <button className="btn glass small" onClick={printAll}>⬇ Print / PDF</button>
              </>)}
            </div>
          )}
        </div>
        <h1>{req.destination}</h1>
        <div className="row wrap">
          <span className="chip glass">📅 {dayDate(req.start_date, 0)} → {dayDate(req.start_date, req.num_days - 1)}</span>
          <span className="chip glass">👥 {req.group_size} traveller{req.group_size > 1 ? "s" : ""}</span>
          <span className="chip glass">{req.travel_style}</span>
          <span className="chip glass">{req.pace} pace</span>
        </div>
      </div>

      {err && <div className="notice error">{err}</div>}
      {missing > 0 && !readOnly && (
        <div className="notice warn row between wrap no-print">
          <span>Only {plan.days.length} of {req.num_days} days were generated for this trip.</span>
          <button className="btn small" disabled={completing} onClick={completeDays}>
            {completing ? "Generating… (20–60s)" : `Generate the missing ${missing} day${missing > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat"><span className="muted">Estimated cost</span><strong className={over ? "bad" : ""}>{money(totals.total, req.currency)}</strong>
          <div className="meter"><i style={{ width: pct + "%", background: over ? "var(--bad)" : "var(--good)" }} /></div>
          <small className="muted">{over ? "Over budget by " + money(totals.total - req.budget, req.currency) : `${Math.round(pct)}% of budget used`}</small></div>
        <div className="stat"><span className="muted">Budget</span><strong>{money(req.budget, req.currency)}</strong><small className="muted">{money(req.budget / req.num_days, req.currency)} / day</small></div>
        <div className="stat"><span className="muted">Per person</span><strong>{money(totals.total / req.group_size, req.currency)}</strong><small className="muted">{req.group_size} traveller(s)</small></div>
        <div className="stat"><span className="muted">Plans</span><strong>{totals.itemCount}</strong><small className="muted">across {plan.days.length} days</small></div>
      </div>

      <div className="layout">
        <div>
          <div className="tabs no-print">
            {plan.days.map((d, i) => (
              <button key={d.day} className={"tab" + (i === active ? " on" : "")} onClick={() => setActive(i)}>
                <b>Day {d.day}</b><small>{dayDate(req.start_date, i)}</small>
              </button>
            ))}
          </div>
          {plan.days.map((d, i) => (
            <DayPanel key={d.day} day={d} index={i} dest={req.destination} currency={req.currency} start={req.start_date}
              editing={editing} readOnly={readOnly} busy={busyDay === d.day} active={i === active} loadImages={i === active || loadAll}
              onRegenerate={regen} onChange={(nd) => setPlan({ ...plan, days: plan.days.map((x, j) => (j === i ? nd : x)) })} />
          ))}
          <div className="row between no-print" style={{ marginTop: 8 }}>
            <button className="btn ghost small" disabled={active === 0} onClick={() => setActive(active - 1)}>← Previous day</button>
            <button className="btn ghost small" disabled={active === plan.days.length - 1} onClick={() => setActive(active + 1)}>Next day →</button>
          </div>
        </div>

        <aside className="side">
          <div className="card">
            <h3>About this trip</h3>
            <p className="muted">{plan.summary}</p>
            {plan.accommodation && (<p><strong>🛏️ Stay</strong><br />{plan.accommodation}
              {plan.accommodation_cost > 0 && <><br /><span className="muted">≈ {money(plan.accommodation_cost, req.currency)} total</span></>}</p>)}
          </div>
          <div className="card">
            <h3>Where the money goes</h3>
            <div className="stackbar">
              {Object.entries(totals.byType).map(([k, v]) => <i key={k} title={`${TYPES[k].label}: ${money(v, req.currency)}`} style={{ width: (v / (totals.total || 1)) * 100 + "%", background: TYPES[k].color }} />)}
            </div>
            <ul className="legend">
              {Object.entries(totals.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <li key={k}><span><i style={{ background: TYPES[k].color }} /> {TYPES[k].icon} {TYPES[k].label}</span><b>{money(v, req.currency)}</b></li>
              ))}
            </ul>
            <div className="muted" style={{ fontSize: ".8rem" }}>Daily: {plan.days.map((d) => money(dayCost(d), req.currency)).join(" · ")}</div>
          </div>
          {plan.tips?.length > 0 && (
            <div className="card"><h3>💡 Local tips</h3><ul className="tips">{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          )}
        </aside>
      </div>
      <p className="muted center-text no-print" style={{ fontSize: ".8rem", marginTop: 24 }}>
        Photos courtesy of Wikipedia, Wikimedia Commons, Pixabay and Pexels contributors (credit shown on each photo).
      </p>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
