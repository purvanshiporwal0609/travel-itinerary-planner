import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { data, error } = await fn.call(supabase.auth, { email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (mode === "signup" && !data.session) setMsg("Check your email to confirm your account, then sign in.");
  }

  return (
    <div className="card narrow">
      <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
      <p className="muted">Plan trips in seconds with AI.</p>
      <form onSubmit={submit} className="stack">
        <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <div className="notice">{msg}</div>}
        <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}</button>
      </form>
      <p className="muted center-text">
        {mode === "signin" ? "New here? " : "Already registered? "}
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "signin" ? "signup" : "signin"); setMsg(""); }}>
          {mode === "signin" ? "Create an account" : "Sign in"}
        </a>
      </p>
    </div>
  );
}
