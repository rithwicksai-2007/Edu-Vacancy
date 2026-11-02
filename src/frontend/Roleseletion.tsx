
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDialog } from "../components/AppDialogContext";

type Role = "job-seeker" | "college";

interface RoleOption {
  id: Role;
  title: string;
  description: string;
  icon: string;
  destination: string;
}

const roles: RoleOption[] = [
  {
    id: "job-seeker",
    title: "Job Seeker",
    description:
      "Find jobs, upload your resume and apply for opportunities.",
    icon: "fa-solid fa-user-tie",
    destination: "/job-login",
  },
  {
    id: "college",
    title: "College / Institute",
    description:
      "Register your institute and manage students' placements.",
    icon: "fa-solid fa-building-columns",
    destination: "/college-login",
  },
];

export default function RoleSelection() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );

  const navigateToRole = useCallback((role: RoleOption) => {
    setSelectedRole(role.id);
    navigate(role.destination);
  }, [navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }

      // Avoid shortcuts while the user is typing.
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }

      if (event.key === "1") {
        navigateToRole(roles[0]);
      } else if (event.key === "2") {
        navigateToRole(roles[1]);
      }
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      void showAlert("No Internet Connection!");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [navigateToRole, showAlert]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#6C63FF] via-[#8B5CF6] to-[#A855F7] p-[15px] sm:p-5">
      <div className="w-full max-w-[1300px] min-[1700px]:max-w-[1800px]">
        <section className="animate-[fadeIn_0.8s_ease] rounded-[18px] bg-white/[0.96] p-5 text-center shadow-[0_20px_40px_rgba(0,0,0,0.12)] backdrop-blur-[15px] sm:rounded-[25px] sm:p-[30px] md:p-10 lg:p-[60px] min-[1700px]:p-20">
          {/* Logo */}
          <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] text-2xl text-white sm:h-[70px] sm:w-[70px] sm:text-[30px] md:h-[90px] md:w-[90px] md:text-[38px] min-[1700px]:h-[120px] min-[1700px]:w-[120px] min-[1700px]:text-[50px]">
            <i className="fa-solid fa-briefcase" aria-hidden="true" />
          </div>

          {/* Heading */}
          <h1 className="mt-5 text-[26px] font-bold text-[#1e293b] sm:mt-6 sm:text-[30px] md:mt-[25px] md:text-[42px] min-[1700px]:text-[60px]">
            Welcome
          </h1>

          <p className="mx-auto mb-[35px] mt-[15px] max-w-[600px] text-[15px] leading-[1.8] text-[#64748b] md:mb-[50px] md:text-[18px] min-[1700px]:text-2xl">
            Please select your role to continue.
          </p>

          {/* Role Cards */}
          <div className="grid grid-cols-1 gap-6 md:gap-[35px] lg:grid-cols-2">
            {roles.map((role) => {
              const isSelected = selectedRole === role.id;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => navigateToRole(role)}
                  aria-label={`Continue as ${role.title}`}
                  className={`group w-full cursor-pointer rounded-[20px] border-2 bg-white p-[25px_15px] text-center shadow-[0_10px_25px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-2.5 hover:border-[#6C63FF] hover:shadow-[0_25px_45px_rgba(108,99,255,0.25)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6C63FF]/30 sm:p-[30px_20px] md:p-10 min-[1700px]:p-[60px] ${
                    isSelected
                      ? "border-[#6C63FF]"
                      : "border-transparent"
                  }`}
                >
                  <span className="block">
                    <i
                      className={`${role.icon} mb-5 text-[38px] text-[#6C63FF] sm:text-[45px] md:text-[60px] min-[1700px]:text-[80px]`}
                      aria-hidden="true"
                    />
                  </span>

                  <span className="mb-[15px] block text-xl font-semibold text-[#1e293b] sm:text-2xl min-[1700px]:text-4xl">
                    {role.title}
                  </span>

                  <span className="mb-[30px] block leading-[1.8] text-[#64748b] min-[1700px]:text-xl">
                    {role.description}
                  </span>

                  <span className="flex h-[50px] w-full items-center justify-center rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8B5CF6] text-base font-semibold text-white transition-transform duration-300 group-hover:scale-[1.02] sm:h-[55px] min-[1700px]:h-[70px] min-[1700px]:text-xl">
                    Continue
                  </span>
                </button>
              );
            })}
          </div>

          <p
            className="mt-6 text-sm text-[#64748b]"
            role="status"
            aria-live="polite"
          >
            {isOnline
              ? "Press 1 for Job Seeker or 2 for College / Institute."
              : "You are currently offline."}
          </p>
        </section>
      </div>
    </main>
  );
}
