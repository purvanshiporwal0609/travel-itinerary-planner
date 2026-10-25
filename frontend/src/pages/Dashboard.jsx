import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { dayDate, gradientFor, money } from "../utils";

export default function Dashboard() {
  const [trips, setTrips] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { api.list().then(setTrips).catch((e) => setErr(e.message)); }, []);

  async function del(id) {
    if (!confirm("Delete this trip?")) return;
    await api.remove(id);
    setTrips((t) => t.filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="row between wrap page-head">
        <div><h1>Your trips</h1><p className="muted">{trips ? `${trips.length} saved itinerar${trips.length === 1 ? "y" : "ies"}` : "Generate, edit and share itineraries."}</p></div>
        <Link to="/new" className="btn">+ Plan a new trip</Link>
      </div>
      {err && <div className="notice error">{err}</div>}
      {trips === null && !err && <div className="grid">{[1, 2, 3].map((i) => <div key={i} className="skeleton tall" />)}</div>}
      {trips?.length === 0 && (
        <div className="card empty"><div style={{ fontSize: "3rem" }}>🗺️</div><h3>No trips yet</h3>
          <p className="muted">Tell us where you want to go and we'll do the rest.</p><Link to="/new" className="btn">Plan your first trip</Link></div>
      )}
      <div className="grid">
        {trips?.map((t) => (
          <div className="trip-card" key={t.id}>
            <Link to={`/trips/${t.id}`} className="trip-cover" style={{ background: gradientFor(t.request.destination) }}>
              <span>{t.request.num_days} days</span><h3>{t.request.destination}</h3>
            </Link>
            <div className="trip-body">
              <p className="muted">📅 {dayDate(t.request.start_date, 0)} · 👥 {t.request.group_size}</p>
              <div><span className="chip">{t.request.travel_style}</span><span className="chip">{t.request.pace}</span>
                <span className="chip">{money(t.request.budget, t.request.currency)}</span></div>
              <div className="row between">
                <Link to={`/trips/${t.id}`} className="btn small">Open</Link>
                <button className="btn ghost small" onClick={() => del(t.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
