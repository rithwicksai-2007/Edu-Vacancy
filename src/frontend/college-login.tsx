
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { fetchCurrentAccount } from "../lib/api-config";
import { getSupabaseClient, usernameAuthEmail } from "../lib/supabase-config";
import { useAppDialog } from "../components/AppDialogContext";

export default function InstituteLogin() {
  const [username, setUsername] = useState(
    () => localStorage.getItem("rememberUsername") ?? ""
  );
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem("rememberUsername") !== null
  );
  const [isLoading, setIsLoading] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();

  useEffect(() => {
    if (rememberMe && username.trim()) {
      localStorage.setItem("rememberUsername", username);
    } else {
      localStorage.removeItem("rememberUsername");
    }
  }, [username, rememberMe]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading) return;

    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(normalizedUsername)) {
      await showAlert("Enter a valid username (3–30 letters, numbers, dots, underscores, or hyphens).");
      usernameRef.current?.focus();
      return;
    }

    if (password.length < 6) {
      await showAlert("Password must contain at least 6 characters.");
      return;
    }

    setIsLoading(true);
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

      if (account.profile.role !== "institution") {
        await supabase.auth.signOut();
        throw new Error("This account is not registered as an institution.");
      }
      if (account.profile.status === "Suspended" || account.profile.status === "Rejected") {
        await supabase.auth.signOut();
        throw new Error(
          account.profile.status_reason || `This account is ${account.profile.status.toLowerCase()}.`,
        );
      }
      if (account.profile.status === "Pending") {
        await showAlert("Your institution is awaiting administrator verification.");
      }
      navigate("/institutionDashboard");
    } catch (error: unknown) {
      await showAlert(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-stretch justify-start bg-gradient-to-br from-[#6C63FF] via-[#8B5CF6] to-[#A855F7] p-[15px] sm:p-[30px] lg:items-center lg:justify-center">
      <section className="flex w-full max-w-[1200px] animate-[fadeIn_0.8s_ease] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_15px_40px_rgba(0,0,0,0.15)] lg:flex-row lg:rounded-[25px] min-[1600px]:max-w-[1600px]">
        {/* Left side: Login */}
        <div className="flex flex-1 flex-col justify-center bg-white p-[25px_18px] sm:p-[40px] lg:p-[50px] min-[1201px]:p-[60px]">
          <div className="mb-8 text-center sm:mb-10 lg:text-left">
            <h2 className="!m-0 !text-[26px] !leading-normal !tracking-normal !text-[#6C63FF] !font-bold sm:!text-[32px]">
              LOGO
            </h2>
          </div>

          <div className="w-full max-w-[430px] lg:mx-0 lg:animate-[slideLeft_0.8s_ease]">
            <h1 className="!mb-2 !mt-0 !text-center !text-[26px] !font-bold !leading-tight !tracking-normal !text-[#1e293b] sm:!text-[30px] lg:!text-left lg:!text-[38px] min-[1600px]:!text-5xl">
              Welcome Back
            </h1>

            <p className="mb-[35px] text-center text-[#64748b] lg:text-left">
              Sign in to continue
            </p>

            <form onSubmit={handleSubmit}>
              {/* Username */}
              <div className="mb-[22px]">
                <label
                  htmlFor="institute-username"
                  className="block w-full text-left text-sm font-semibold text-gray-800 sm:text-base"
                >
                  Username
                </label>

                <div className="flex h-[50px] items-center rounded-xl border border-[#e2e8f0] px-[15px] transition-all hover:border-[#6C63FF] focus-within:border-[#6C63FF] focus-within:ring-4 focus-within:ring-[#6C63FF]/15 sm:h-[55px] min-[1600px]:h-[65px]">
                  <i
                    className="fa-solid fa-envelope text-[#94a3b8]"
                    aria-hidden="true"
                  />

                  <input
                    ref={usernameRef}
                    id="institute-username"
                    type="text"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="Enter your username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[#1e293b] outline-none placeholder:text-gray-400 sm:text-[15px]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="mb-[22px]">
                <label
                  htmlFor="institute-password"
                  className="block w-full text-left text-sm font-semibold text-gray-800 sm:text-base"
                >
                  Password
                </label>

                <div className="flex h-[50px] items-center rounded-xl border border-[#e2e8f0] px-[15px] transition-all hover:border-[#6C63FF] focus-within:border-[#6C63FF] focus-within:ring-4 focus-within:ring-[#6C63FF]/15 sm:h-[55px] min-[1600px]:h-[65px]">
                  <i
                    className="fa-solid fa-lock text-[#94a3b8]"
                    aria-hidden="true"
                  />

                  <input
                    id="institute-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value.replace(/\s/g, ""))
                    }
                    required
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-[14px] text-[#1e293b] outline-none placeholder:text-gray-400 sm:text-[15px]"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-gray-100 hover:text-[#6C63FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C63FF]"
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

              {/* Remember me / Forgot password */}
              <div className="mb-[25px] flex flex-col items-start gap-[15px] text-sm sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-[#1e293b]">
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

              {/* Login */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-[15px] font-semibold text-white transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_20px_rgba(108,99,255,0.35)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6C63FF]/30 disabled:cursor-not-allowed disabled:opacity-70 sm:h-[55px] sm:text-base min-[1600px]:h-[65px]"
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            {/* Registration */}
            <p className="mt-[25px] text-center text-sm text-[#64748b] sm:text-base">
              Don't have an account?{" "}
              <Link
                to="/college-registration"
                className="font-semibold text-[#6C63FF] hover:underline"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>

        {/* Right side: Welcome panel */}
        <aside className="order-first flex flex-1 items-center justify-center bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] px-5 py-10 text-white sm:px-10 sm:py-12 lg:order-last lg:p-[60px] lg:animate-[slideRight_0.8s_ease]">
          <div className="w-full max-w-[420px] text-center lg:text-left">
            <h3 className="mb-[10px] text-xl font-semibold sm:text-2xl">
              Hello Again!
            </h3>

            <h2 className="!mb-5 !mt-0 !text-[30px] !font-bold !leading-tight !tracking-normal !text-white sm:!text-[38px] lg:!text-[56px] min-[1600px]:!text-[70px]">
              Welcome
            </h2>

            <p className="text-sm leading-[1.8] sm:text-base lg:text-lg min-[1600px]:text-[22px]">
              Login to access your account and enjoy all features.
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}
