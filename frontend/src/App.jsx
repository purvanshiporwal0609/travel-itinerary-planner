import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import TripBuilder from "./pages/TripBuilder.jsx";
import TripView from "./pages/TripView.jsx";

export default function App() {
  const [session, setSession] = useState(undefined);
  const nav = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="center muted">Loading…</div>;
  const guard = (el) => (session ? el : <Navigate to="/login" replace />);

  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">🧭 Wayfarer</Link>
        {session && (
          <nav>
            <Link to="/new" className="btn small">+ New trip</Link>
            <button className="btn ghost small" onClick={async () => { await supabase.auth.signOut(); nav("/login"); }}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main className="container">
        <Routes>
          <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/" element={guard(<Dashboard />)} />
          <Route path="/new" element={guard(<TripBuilder />)} />
          <Route path="/trips/:id" element={guard(<TripView />)} />
          <Route path="/shared/:id" element={<TripView readOnly />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
