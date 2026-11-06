import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchCurrentAccount } from "../lib/api-config";
import { getSupabaseClient, usernameAuthEmail } from "../lib/supabase-config";

export default function AdminLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameAuthEmail(username),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase did not return a sign-in session.");

      const account = await fetchCurrentAccount(data.session.access_token);

      if (account.platform_role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("This account is not authorized to access administrator tools.");
      }

      navigate("/adminDashboard");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="rounded-xl bg-violet-100 p-3 text-violet-700">EV</span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Administrator sign in</h1>
            <p className="mt-1 text-sm text-slate-500">EduVacancy platform console</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="admin-username" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>
          {message && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in securely"}
          </button>
        </form>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-violet-700 hover:underline">
          Back to role selection
        </Link>
      </section>
    </main>
  );
}
