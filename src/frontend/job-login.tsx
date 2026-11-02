
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { fetchCurrentAccount } from "../lib/api-config";
import { getSupabaseClient, usernameAuthEmail } from "../lib/supabase-config";
import { useAppDialog } from "../components/AppDialogContext";

type LoginStatus = "idle" | "loading";

export default function JobLogin() {
  const [username, setUsername] = useState(() => localStorage.getItem("rememberUsername") ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem("rememberUser") === "true"
  );
  const [status, setStatus] = useState<LoginStatus>("idle");

  const usernameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();

  useEffect(() => {
    const handleOffline = () => {
      void showAlert("No Internet Connection!");
    };

    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("offline", handleOffline);
    };
  }, [showAlert]);

  useEffect(() => {
    localStorage.setItem("rememberUser", String(rememberMe));
  }, [rememberMe]);

  useEffect(() => {
    if (rememberMe && username.trim()) {
      localStorage.setItem("rememberUsername", username);
    } else {
      localStorage.removeItem("rememberUsername");
    }
  }, [username, rememberMe]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (status === "loading") return;

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(normalizedUsername)) {
      await showAlert("Enter a valid username (3–30 letters, numbers, dots, underscores, or hyphens).");
      usernameRef.current?.focus();
      return;
    }

    if (password.length < 6) {
      await showAlert("Password must be at least 6 characters.");
      return;
    }

    setStatus("loading");
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameAuthEmail(normalizedUsername),
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Supabase did not return a sign-in session.");

      let account;
      try {
        account = await fetchCurrentAccount(data.session.access_token);
      } catch (error: unknown) {
        await supabase.auth.signOut();
        throw error;
      }

      if (account.profile.role !== "job_seeker") {
        await supabase.auth.signOut();
        throw new Error("This account is not registered as a job seeker.");
      }
      if (account.profile.status === "Suspended" || account.profile.status === "Rejected") {
        await supabase.auth.signOut();
        throw new Error(
          account.profile.status_reason || `This account is ${account.profile.status.toLowerCase()}.`,
        );
      }
      if (account.profile.status === "Pending") {
        await showAlert("Your account is awaiting administrator verification.");
      }
      navigate("/jobSeekerDashboard");
    } catch (error: unknown) {
      await showAlert(error instanceof Error ? error.message : "Unable to sign in.");
      setStatus("idle");
    }
  };

  return (
    <main className="flex min-h-screen items-stretch justify-start bg-gradient-to-br from-[#6C63FF] via-[#8B5CF6] to-[#A855F7] p-[15px] sm:p-5 lg:items-center lg:justify-center">
      <section className="flex w-full max-w-[1200px] animate-[fadeIn_0.8s_ease] flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_20px_40px_rgba(0,0,0,0.15)] md:rounded-[25px] lg:min-h-[720px] lg:flex-row min-[1700px]:max-w-[1700px] min-[1700px]:min-h-[900px]">
        {/* Left: Login form */}
        <div className="flex flex-1 flex-col justify-center p-[25px] sm:p-[35px] lg:p-[55px]">
          <div className="mb-8 text-left sm:mb-10">
            <h2 className="!m-0 !text-[24px] !leading-normal !tracking-normal !text-[#6C63FF] !font-bold sm:!text-[30px]">
              JOB PORTAL
            </h2>
          </div>

          <div className="w-full max-w-[450px] text-left">
            <h1 className="!m-0 !text-[26px] !font-bold !leading-tight !tracking-normal !text-[#1E293B] sm:!text-[32px] lg:!text-[40px] min-[1700px]:!text-[52px]">
              Job Seeker Login
            </h1>

            <p className="mb-[30px] mt-3 text-sm leading-6 text-[#64748B] sm:text-base">
              Login to continue your job search journey.
            </p>

            <form onSubmit={handleSubmit}>
              {/* Username */}
              <div className="mb-5">
                <label
                  htmlFor="username"
                  className="block w-full text-left text-sm font-semibold text-gray-800 sm:text-base"
                >
                  Username
                </label>

                <div className="flex h-[50px] items-center rounded-xl border border-[#E2E8F0] px-[15px] transition-all focus-within:border-[#6C63FF] focus-within:ring-[3px] focus-within:ring-[#6C63FF]/15 sm:h-[55px] min-[1700px]:h-[65px]">
                  <i
                    className="fa-solid fa-envelope text-[#888]"
                    aria-hidden="true"
                  />

                  <input
                    ref={usernameRef}
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                    }}
                    required
                    className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-[#1E293B] outline-none placeholder:text-gray-400 min-[1700px]:text-lg"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-5">
                <label
                  htmlFor="password"
                  className="block w-full text-left text-sm font-semibold text-gray-800 sm:text-base"
                >
                  Password
                </label>

                <div className="flex h-[50px] items-center rounded-xl border border-[#E2E8F0] px-[15px] transition-all focus-within:border-[#6C63FF] focus-within:ring-[3px] focus-within:ring-[#6C63FF]/15 sm:h-[55px] min-[1700px]:h-[65px]">
                  <i
                    className="fa-solid fa-lock text-[#888]"
                    aria-hidden="true"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter Password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value.replace(/\s/g, ""))
                    }
                    required
                    className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-[#1E293B] outline-none placeholder:text-gray-400 min-[1700px]:text-lg"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#888] transition hover:bg-gray-100 hover:text-[#6C63FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
                  >
                    <i
                      className={`fa-solid ${
                        showPassword ? "fa-eye-slash" : "fa-eye"
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              {/* Remember me and forgot password */}
              <div className="mb-[25px] mt-[18px] flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[#64748B]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 accent-[#6C63FF]"
                  />
                  Remember Me
                </label>

                <span className="text-[#64748B]">Forgot password? Contact an administrator.</span>
              </div>

              {/* Login button */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-base font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(108,99,255,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6C63FF]/30 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[55px] min-[1700px]:h-[65px]"
              >
                {status === "loading" ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    Logging In...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            <p className="mt-[25px] text-center text-sm text-[#64748B] sm:text-base">
              Don't have an account?{" "}
              <Link
                to="/job-registration"
                className="font-semibold text-[#6C63FF] hover:underline"
              >
                Register Now
              </Link>
            </p>
          </div>
        </div>

        {/* Right: Welcome panel */}
        <aside className="order-first flex flex-1 items-center justify-center bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] px-7 py-10 text-white sm:px-10 sm:py-12 lg:order-last lg:p-[60px]">
          <div className="w-full max-w-[430px]">
            <h3 className="text-lg font-semibold sm:text-[22px]">
              Find Your Dream Job
            </h3>

            <h2 className="!my-[15px] !text-[36px] !font-bold !leading-tight !tracking-normal !text-white sm:!text-5xl min-[1700px]:!text-[72px]">
              Welcome Back
            </h2>

            <p className="text-[15px] leading-[1.8] sm:text-lg">
              Login to apply for jobs, update your profile, and track your
              applications.
            </p>

            <div className="mt-[30px] space-y-[15px]">
              {[
                "10,000+ Jobs",
                "Verified Companies",
                "Easy Applications",
              ].map((feature) => (
                <div
                  key={feature}
                  className="flex items-center gap-3 text-base sm:text-lg"
                >
                  <i
                    className="fa-solid fa-circle-check"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
