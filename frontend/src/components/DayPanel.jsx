import { useState } from "react";
import PlaceImage from "./PlaceImage.jsx";
import { TYPES, dayCost, dayDate, duration, mapsUrl, money, typeOf } from "../utils";

const QUICK = ["Cheaper options", "More food spots", "Less walking", "Indoor activities", "Hidden gems", "Add nightlife"];

export default function DayPanel({ day, index, dest, currency, start, editing, readOnly, busy, active, loadImages, onChange, onRegenerate }) {
  const [instr, setInstr] = useState("");
  const total = dayCost(day);

  const setItems = (items) => onChange({ ...day, items });
  const upd = (i, k, v) => setItems(day.items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const del = (i) => setItems(day.items.filter((_, j) => j !== i));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= day.items.length) return;
    const a = [...day.items];
    [a[i], a[j]] = [a[j], a[i]];
    setItems(a);
  };
  const add = () => setItems([...day.items, { time: "12:00", type: "activity", name: "New activity", description: "", cost: 0, duration_min: 60 }]);
  const sortByTime = () => setItems([...day.items].sort((a, b) => (a.time || "").localeCompare(b.time || "")));

  return (
    <section className={"panel" + (active ? " active" : "")}>
      <div className="panel-head">
        <div>
          <span className="eyebrow">Day {day.day} · {dayDate(start, index)}</span>
          <h2>{day.title}</h2>
        </div>
        <span className="pill cost">{money(total, currency)}</span>
      </div>

      {busy ? (
        <div className="skeletons">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton" />)}<p className="muted center-text">Re-planning this day…</p></div>
      ) : (
        <ol className="tl">
          {day.items.map((it, i) => {
            const m = typeOf(it.type);
            return (
              <li className="tl-item" key={i} style={{ "--c": m.color }}>
                <div className="tl-time">{editing ? <input value={it.time} onChange={(e) => upd(i, "time", e.target.value)} /> : it.time}</div>
                <div className="tl-dot">{m.icon}</div>
                <div className="tl-card">
                  {editing ? (
                    <div className="stack tight">
                      <input value={it.name} onChange={(e) => upd(i, "name", e.target.value)} />
                      <textarea rows={2} value={it.description} onChange={(e) => upd(i, "description", e.target.value)} />
                      <div className="row wrap">
                        <select value={TYPES[it.type] ? it.type : "activity"} onChange={(e) => upd(i, "type", e.target.value)} style={{ width: 130 }}>
                          {Object.keys(TYPES).map((t) => <option key={t} value={t}>{TYPES[t].label}</option>)}
                        </select>
                        <input type="number" value={it.cost} onChange={(e) => upd(i, "cost", Number(e.target.value))} style={{ width: 110 }} />
                        <button className="icon-btn" onClick={() => move(i, -1)} title="Move up">↑</button>
                        <button className="icon-btn" onClick={() => move(i, 1)} title="Move down">↓</button>
                        <button className="icon-btn danger" onClick={() => del(i)} title="Remove">✕</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="row between">
                        <strong>{it.name}</strong>
                        <span className="badge">{m.label}</span>
                      </div>
                      {it.description && <p className="muted">{it.description}</p>}
                      {it.type !== "transport" && it.type !== "stay" && (
                        <PlaceImage name={it.name} dest={dest} type={it.type} load={loadImages} />
                      )}
                      <div className="tl-meta">
                        <span>{Number(it.cost) ? money(it.cost, currency) : "Free"}</span>
                        {it.duration_min > 0 && <span>⏱ {duration(it.duration_min)}</span>}
                        {it.type !== "transport" && <a href={mapsUrl(it.name, dest)} target="_blank" rel="noreferrer">📍 Map</a>}
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {editing && (
        <div className="row">
          <button className="btn ghost small" onClick={add}>+ Add item</button>
          <button className="btn ghost small" onClick={sortByTime}>⇅ Sort by time</button>
        </div>
      )}

      {!readOnly && !editing && (
        <div className="regen">
          <span className="eyebrow">✨ Not feeling this day? Ask for a change</span>
          <div className="row wrap" style={{ margin: "8px 0" }}>
            {QUICK.map((q) => <button key={q} className="chip pick" disabled={busy} onClick={() => onRegenerate(day.day, q)}>{q}</button>)}
          </div>
          <div className="row">
            <input value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Or describe it… e.g. add a sunset spot and skip museums"
              onKeyDown={(e) => e.key === "Enter" && instr && onRegenerate(day.day, instr)} />
            <button className="btn small" disabled={busy} onClick={() => onRegenerate(day.day, instr)}>{busy ? "Working…" : "↻ Regenerate"}</button>
          </div>
        </div>
      )}
    </section>
  );
}
