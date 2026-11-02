
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiRequest,
  apiRequestAllPages,
  fetchCurrentAccount,
  type InAppNotification,
} from "../lib/api-config";
import { getSupabaseClient } from "../lib/supabase-config";
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

type Page =
  | "Overview"
  | "Find Teachers"
  | "Vacancies"
  | "Applicants"
  | "Analytics"
  | "Institution Profile"
  | "Notifications"
  | "Settings";

type Teacher = {
  id: string;
  name: string;
  subject: string;
  qualification: string;
  experience: number;
  location: string;
  salary: number | null;
  level: string;
  initials: string;
  color: string;
  verified: boolean;
};

type Vacancy = {
  id: string;
  title: string;
  department: string;
  level: string;
  type: string;
  salary: string;
  location: string;
  deadline: string;
  applicants: number;
  status: "Active" | "Pending review" | "Closed";
};

type Applicant = {
  id: string;
  name: string;
  role: string;
  qualification: string;
  experience: string;
  status: "Applied" | "Under Review" | "Shortlisted" | "Interview" | "Rejected" | "Hired";
  initials: string;
  color: string;
  createdAt: string;
};

type ProfileRecord = {
  profile: { full_name: string; username: string; phone: string; status: string };
  details: {
    institution_name: string;
    institution_type: string;
    city: string;
    website: string | null;
    description: string;
  } | null;
};

type VacancyRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  employment_type: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  deadline: string | null;
  experience: string | null;
  status: "Pending" | "Verified" | "Rejected" | "Suspended";
};

type TeacherRecord = {
  id: string;
  full_name: string;
  job_seeker_details: {
    subject: string;
    qualification: string;
    years_experience: number;
    preferred_location: string;
  } | null;
};

type ApplicationRecord = {
  id: string;
  status: Applicant["status"];
  created_at: string;
  applicant: {
    full_name: string;
    job_seeker_details: {
      subject: string;
      qualification: string;
      years_experience: number;
    } | null;
  } | null;
  vacancy: { id: string; title: string } | null;
};

type CreateVacancyPayload = {
  title: string;
  description: string;
  category: string;
  employment_type: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  experience: string;
  deadline: string;
};

type InstitutionPreferences = {
  inAppNotifications: boolean;
  applicationReminders: boolean;
  profileVisibility: boolean;
};

const defaultInstitutionPreferences: InstitutionPreferences = {
  inAppNotifications: true,
  applicationReminders: true,
  profileVisibility: true,
};

function normalizeInstitutionPreferences(value: unknown): InstitutionPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultInstitutionPreferences;
  }
  const settings = value as Partial<InstitutionPreferences> & {
    emailNotifications?: boolean;
  };
  return {
    inAppNotifications:
      typeof settings.inAppNotifications === "boolean"
        ? settings.inAppNotifications
        : typeof settings.emailNotifications === "boolean"
          ? settings.emailNotifications
          : defaultInstitutionPreferences.inAppNotifications,
    applicationReminders:
      typeof settings.applicationReminders === "boolean"
        ? settings.applicationReminders
        : defaultInstitutionPreferences.applicationReminders,
    profileVisibility:
      typeof settings.profileVisibility === "boolean"
        ? settings.profileVisibility
        : defaultInstitutionPreferences.profileVisibility,
  };
}

const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Find Teachers", icon: Users },
  { label: "Vacancies", icon: BriefcaseBusiness },
  { label: "Applicants", icon: ClipboardList },
  { label: "Analytics", icon: Activity },
  { label: "Institution Profile", icon: Building2 },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings },
];

const statusOptions: Applicant["status"][] = [
  "Applied",
  "Under Review",
  "Shortlisted",
  "Interview",
  "Rejected",
  "Hired",
];

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  const value = String(children);
  const colors: Record<string, string> = {
    Active: "bg-emerald-50 text-emerald-700",
    "Pending review": "bg-amber-50 text-amber-700",
    Closed: "bg-slate-100 text-slate-600",
    Applied: "bg-sky-50 text-sky-700",
    "Under Review": "bg-amber-50 text-amber-700",
    Shortlisted: "bg-violet-50 text-violet-700",
    Interview: "bg-amber-50 text-amber-700",
    Rejected: "bg-rose-50 text-rose-700",
    Hired: "bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${colors[value] ?? "bg-slate-100 text-slate-600"}`}
    >
      {children}
    </span>
  );
}

function Avatar({
  initials,
  color,
  size = "md",
}: {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-9 w-9 text-xs",
    md: "h-11 w-11 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl font-bold ${sizes[size]} ${color}`}
    >
      {initials}
    </div>
  );
}

function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <Panel className="min-w-0 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-xl p-2.5 ${color}`}>
          <Icon size={21} />
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
          <ArrowUpRight size={14} />
          {change}
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-500">{title}</p>
      <p className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">Compared with last month</p>
    </Panel>
  );
}

function ApplicationChart({ applications }: { applications: Applicant[] }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const monthApplications = applications.filter((application) => {
      const createdAt = new Date(application.createdAt);
      return `${createdAt.getFullYear()}-${createdAt.getMonth()}` === key;
    });
    return {
      month: date.toLocaleString(undefined, { month: "short" }),
      applications: monthApplications.length,
      hires: monthApplications.filter((application) => application.status === "Hired").length,
    };
  });
  const maximum = Math.max(1, ...months.map((month) => month.applications));
  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-4 text-sm">
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
          Applications
        </span>
        <span className="flex items-center gap-2 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
          Hires
        </span>
      </div>
      <div className="flex h-52 items-end justify-between gap-2 border-b border-slate-200 px-1 sm:gap-5">
        {months.map((item, index) => (
          <div
            key={`${item.month}-${index}`}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
          >
            <div className="flex h-40 w-full items-end justify-center gap-1.5 sm:gap-2">
              <div
                title={`${item.applications} applications`}
                className="w-[55%] max-w-8 rounded-t-md bg-violet-600 transition-all hover:bg-violet-700"
                style={{ height: `${(item.applications / maximum) * 100}%` }}
              />
              <div
                title={`${item.hires} hires`}
                className="w-[35%] max-w-5 rounded-t-md bg-sky-400"
                style={{ height: `${item.applications ? (item.hires / item.applications) * (item.applications / maximum) * 100 : 0}%` }}
              />
            </div>
            <span className="pb-2 text-xs text-slate-500">{item.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VacancyModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (vacancy: {
    title: string;
    description: string;
    category: string;
    employment_type: string;
    location: string;
    salary_min: number | null;
    salary_max: number | null;
    experience: string;
    deadline: string;
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("Mathematics");
  const [level, setLevel] = useState("School");
  const [type, setType] = useState("Full-time");
  const [salary, setSalary] = useState("₹30,000–₹45,000");
  const [location, setLocation] = useState("Hyderabad");
  const [deadline, setDeadline] = useState("2026-11-30");
  const [description, setDescription] = useState("");
  const [minimumQualification, setMinimumQualification] = useState("B.Ed.");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedSalary = salary.match(/\d[\d,]*/g)?.map((value) =>
      Number(value.replaceAll(",", "")),
    ) ?? [];
    const created = await onCreate({
      title: title.trim(),
      description: `Department: ${department}. ${description.trim()}${minimumQualification.trim() ? ` Minimum qualification: ${minimumQualification.trim()}.` : ""}`,
      category: level,
      employment_type: type,
      location: location.trim(),
      salary_min: parsedSalary[0] ?? null,
      salary_max: parsedSalary[1] ?? null,
      experience: minimumQualification.trim(),
      deadline: new Date(`${deadline}T23:59:59.000Z`).toISOString(),
    });
    if (created) onClose();
  }

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 sm:px-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Post a teaching vacancy
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Reach qualified teachers and academic staff.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vacancy form"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Job title *
            </label>
            <input
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Senior Mathematics Teacher"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-slate-700">
                Subject / Department
              </label>
              <select
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                className={inputClass}
              >
                {[
                  "Mathematics",
                  "Physics",
                  "Chemistry",
                  "Biology",
                  "English",
                  "Social Studies",
                  "Computer Science",
                  "Commerce",
                  "Economics",
                  "Administration",
                  "Physical Education",
                  "Other",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Institution level
              </label>
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className={inputClass}
              >
                <option>School</option>
                <option>College</option>
                <option>University</option>
                <option>Coaching Institute</option>
                <option>Preschool</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Employment type
              </label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className={inputClass}
              >
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Temporary</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Salary range
              </label>
              <input
                required
                value={salary}
                onChange={(event) => setSalary(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Location *
              </label>
              <input
                required
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700">
                Application deadline *
              </label>
              <input
                required
                type="date"
                min="2026-10-17"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Minimum qualification
            </label>
            <input
              value={minimumQualification}
              onChange={(event) =>
                setMinimumQualification(event.target.value)
              }
              className={inputClass}
              placeholder="e.g. M.Sc., B.Ed., NET/SET"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Job description *
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Responsibilities, eligibility criteria, teaching experience, and benefits..."
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Eligibility requirements: {minimumQualification || "Not specified"}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus size={17} />
              Publish vacancy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PikachuChat({
  onClose,
}: {
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<
    { from: "pikachu" | "user"; text: string }[]
  >([
    {
      from: "pikachu",
      text: "Pika-pika! ⚡ Hi! I'm Pikachu, your recruitment assistant. Ask me about teaching vacancies, job descriptions, interviews, or finding qualified teachers.",
    },
  ]);

  function sendMessage(text = message) {
    const question = text.trim();
    if (!question) return;

    let answer =
      "I can help with teacher recruitment, vacancy descriptions, applicant workflows, and interview planning. Tell me the subject and school or college level for more specific suggestions.";

    const q = question.toLowerCase();

    if (q.includes("job description") || q.includes("vacancy")) {
      answer =
        "A good teaching vacancy should include: job title, subject, classes taught, required qualifications, teaching experience, responsibilities, salary range, location, employment type, and application deadline. Use the Post Vacancy button to create a listing.";
    } else if (q.includes("interview")) {
      answer =
        "Try these interview questions: 1. How do you adapt lessons for different learning needs? 2. How do you assess student understanding? 3. Describe a classroom management challenge and how you handled it. 4. Demonstrate a short lesson in your subject. 5. How do you communicate progress to parents or students?";
    } else if (
      q.includes("teacher") ||
      q.includes("candidate") ||
      q.includes("hire")
    ) {
      answer =
        "To find suitable teachers, open Find Teachers and filter by subject, qualification, experience, location, and school or college level. Review each candidate's credentials before shortlisting or interviewing them.";
    } else if (q.includes("application") || q.includes("applicant")) {
      answer =
        "Open Applicants to review candidates. Move applicants through New, Shortlisted, Interview, Hired, or Rejected. Keep your criteria job-related, consistent, and documented.";
    } else if (q.includes("hello") || q.includes("hi")) {
      answer =
        "Pika-pika! ⚡ Welcome! I can help you prepare a vacancy, plan teacher interviews, or organize recruitment. What would you like to do?";
    }

    setMessages((current) => [
      ...current,
      { from: "user", text: question },
      { from: "pikachu", text: answer },
    ]);
    setMessage("");
  }

  return (
    <div className="fixed bottom-20 right-3 z-40 flex h-[min(540px,70dvh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:right-6">
      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-400 to-yellow-300 px-4 py-4 text-slate-900">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-2xl">
          ⚡
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Pikachu AI Assistant</h3>
          <p className="text-xs text-slate-700">
            Your recruitment companion
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close Pikachu chat"
          className="rounded-lg p-2 hover:bg-white/40"
        >
          <X size={19} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {messages.map((item, index) => (
          <div
            key={`${index}-${item.from}`}
            className={`flex ${item.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-sm leading-6 ${
                item.from === "user"
                  ? "rounded-br-sm bg-violet-600 text-white"
                  : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {item.text}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 bg-white p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          {["Write a vacancy", "Interview questions", "Find teachers"].map(
            (suggestion) => (
              <button
                key={suggestion}
                onClick={() => sendMessage(suggestion)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-violet-300 hover:bg-violet-50"
              >
                {suggestion}
              </button>
            ),
          )}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ask Pikachu..."
            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            aria-label="Send message"
            className="rounded-xl bg-violet-600 p-3 text-white hover:bg-violet-700"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default function InstitutionDashboard() {
  const navigate = useNavigate();
  const [page, setPage] = useState<Page>("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showVacancyModal, setShowVacancyModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("All subjects");
  const [levelFilter, setLevelFilter] = useState("All levels");
  const [minExperience, setMinExperience] = useState("0");
  const [teacherSaved, setTeacherSaved] = useState<string[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [vacancyFilter, setVacancyFilter] = useState("All");
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notice, setNotice] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [institutionStatus, setInstitutionStatus] = useState("Pending");
  const [preferences, setPreferences] = useState(defaultInstitutionPreferences);
  const [profile, setProfile] = useState({
    name: "",
    type: "",
    username: "",
    phone: "",
    city: "",
    website: "",
    description: "",
  });

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) {
          navigate("/college-login", { replace: true });
          return;
        }

        const account = await fetchCurrentAccount(session.access_token);
        if (account.profile.role !== "institution") {
          await supabase.auth.signOut();
          navigate("/college-login", { replace: true });
          return;
        }

        const [profileData, vacancyData, applicationData, savedTeacherData, preferenceData, notificationData] = await Promise.all([
          apiRequest<ProfileRecord>(session.access_token, "/api/v1/profiles/me"),
          apiRequestAllPages<VacancyRecord>(session.access_token, "/api/v1/vacancies/mine"),
          apiRequest<ApplicationRecord[]>(session.access_token, "/api/v1/applications/mine"),
          apiRequest<{ job_seeker_id: string }[]>(
            session.access_token,
            "/api/v1/saved-teachers/mine",
          ),
          apiRequest<{ preferences: unknown }>(
            session.access_token,
            "/api/v1/profiles/me/preferences",
          ),
          apiRequest<InAppNotification[]>(
            session.access_token,
            "/api/v1/notifications/mine",
          ),
        ]);
        const teacherData =
          account.profile.status === "Verified"
            ? await apiRequestAllPages<TeacherRecord>(
                session.access_token,
                "/api/v1/directory/job-seekers",
              )
            : [];
        if (!mounted) return;

        setAccessToken(session.access_token);
        setNotifications(notificationData);
        setInstitutionStatus(account.profile.status);
        setTeacherSaved(savedTeacherData.map((item) => item.job_seeker_id));
        setPreferences(normalizeInstitutionPreferences(preferenceData.preferences));
        setProfile({
          name: profileData.details?.institution_name ?? profileData.profile.full_name,
          type: profileData.details?.institution_type ?? "",
          username: profileData.profile.username,
          phone: profileData.profile.phone ?? "",
          city: profileData.details?.city ?? "",
          website: profileData.details?.website ?? "",
          description: profileData.details?.description ?? "",
        });
        setVacancies(
          vacancyData.map((vacancy) => ({
            id: vacancy.id,
            title: vacancy.title,
            department: vacancy.description.match(/Department: ([^.]+)/)?.[1] ?? vacancy.category,
            level: vacancy.category,
            type: vacancy.employment_type,
            salary:
              vacancy.salary_min === null && vacancy.salary_max === null
                ? "Salary not specified"
                : `${vacancy.salary_min === null ? "" : money(vacancy.salary_min)}${vacancy.salary_min !== null && vacancy.salary_max !== null ? "–" : ""}${vacancy.salary_max === null ? "" : money(vacancy.salary_max)}`,
            location: vacancy.location,
            deadline: vacancy.deadline
              ? new Date(vacancy.deadline).toLocaleDateString()
              : "Not specified",
            applicants: applicationData.filter((application) => application.vacancy?.id === vacancy.id).length,
            status:
              vacancy.status === "Verified"
                ? "Active"
                : vacancy.status === "Pending"
                  ? "Pending review"
                  : "Closed",
          })),
        );
        setTeachers(
          teacherData.map((teacher, index) => ({
            id: teacher.id,
            name: teacher.full_name,
            subject: teacher.job_seeker_details?.subject || "Educator",
            qualification: teacher.job_seeker_details?.qualification || "Qualification not provided",
            experience: teacher.job_seeker_details?.years_experience ?? 0,
            location: teacher.job_seeker_details?.preferred_location || "Location not provided",
            salary: null,
            level: "Educator",
            initials: teacher.full_name.trim().slice(0, 2).toUpperCase() || "ED",
            color: ["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700"][index % 4],
            verified: true,
          })),
        );
        setApplicants(
          applicationData.map((application, index) => ({
            id: application.id,
            name: application.applicant?.full_name ?? "Job seeker",
            role: application.vacancy?.title ?? "Vacancy",
            qualification:
              application.applicant?.job_seeker_details?.qualification ?? "Qualification not provided",
            experience: `${application.applicant?.job_seeker_details?.years_experience ?? 0} years`,
            status: application.status,
            initials: application.applicant?.full_name.trim().slice(0, 2).toUpperCase() ?? "JS",
            color: ["bg-violet-100 text-violet-700", "bg-sky-100 text-sky-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700"][index % 4],
            createdAt: application.created_at,
          })),
        );
        if (account.profile.status !== "Verified") {
          setNotice("Your institution is awaiting administrator verification. Posting vacancies and searching candidates will be enabled after verification.");
        }
      } catch (error: unknown) {
        if (mounted) {
          setNotice(error instanceof Error ? error.message : "Unable to load institution data.");
        }
      } finally {
        if (mounted) setDashboardLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  const activeVacancies = vacancies.filter(
    (item) => item.status === "Active",
  ).length;
  const totalApplicants = applicants.length;
  const hiredCount = applicants.filter(
    (item) => item.status === "Hired",
  ).length;

  const filteredTeachers = useMemo(() => {
    const q = search.toLowerCase().trim();

    return teachers.filter((teacher) => {
      const matchesSearch =
        !q ||
        [
          teacher.name,
          teacher.subject,
          teacher.qualification,
          teacher.location,
        ].some((field) => field.toLowerCase().includes(q));

      return (
        matchesSearch &&
        (subjectFilter === "All subjects" ||
          teacher.subject === subjectFilter) &&
        (levelFilter === "All levels" || teacher.level === levelFilter) &&
        teacher.experience >= Number(minExperience)
      );
    });
  }, [teachers, search, subjectFilter, levelFilter, minExperience]);

  const filteredApplicants = applicants.filter((applicant) =>
    `${applicant.name} ${applicant.role} ${applicant.status}`
      .toLowerCase()
      .includes(applicantSearch.toLowerCase()),
  );

  const filteredVacancies = vacancies.filter(
    (vacancy) => vacancyFilter === "All" || vacancy.status === vacancyFilter,
  );

  if (dashboardLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading your institution dashboard…
      </main>
    );
  }

  function notify(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2800);
  }

  async function createVacancy(vacancy: CreateVacancyPayload) {
    if (!accessToken || institutionStatus !== "Verified") {
      notify("Your institution must be verified before posting vacancies.");
      return false;
    }
    try {
      const created = await apiRequest<VacancyRecord>(
        accessToken,
        "/api/v1/vacancies",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vacancy),
        },
      );
      const amount = (value: number | null) =>
        value === null ? "" : money(value);
      setVacancies((current) => [
        {
          id: created.id,
          title: created.title,
          department: vacancy.description.match(/Department: ([^.]+)/)?.[1] ?? created.category,
          level: created.category,
          type: created.employment_type,
          salary:
            created.salary_min === null && created.salary_max === null
              ? "Salary not specified"
              : `${amount(created.salary_min)}${created.salary_min !== null && created.salary_max !== null ? "–" : ""}${amount(created.salary_max)}`,
          location: created.location,
          deadline: created.deadline
            ? new Date(created.deadline).toLocaleDateString()
            : "Not specified",
          applicants: 0,
          status: "Pending review",
        },
        ...current,
      ]);
      setPage("Vacancies");
      notify("Vacancy submitted and is awaiting administrator review.");
      return true;
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to create vacancy.");
      return false;
    }
  }

  async function changeApplicantStatus(
    id: string,
    status: Applicant["status"],
  ) {
    try {
      await apiRequest(accessToken, `/api/v1/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setApplicants((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      notify(`Applicant status changed to ${status}.`);
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to update applicant.");
    }
  }

  async function toggleVacancyStatus(id: string) {
    try {
      await apiRequest(accessToken, `/api/v1/vacancies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Suspended" }),
      });
      setVacancies((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "Closed" } : item,
        ),
      );
      notify("Vacancy closed.");
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to close vacancy.");
    }
  }

  async function contactTeacher(teacher: Teacher) {
    try {
      await apiRequest(accessToken, "/api/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_user_id: teacher.id }),
      });
      notify(`Connection request sent to ${teacher.name}.`);
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to contact teacher.");
    }
  }

  async function toggleSavedTeacher(teacherId: string) {
    if (!accessToken) return;
    const isSaved = teacherSaved.includes(teacherId);
    try {
      if (isSaved) {
        await apiRequest<void>(
          accessToken,
          `/api/v1/saved-teachers/${teacherId}`,
          { method: "DELETE" },
        );
        setTeacherSaved((current) => current.filter((id) => id !== teacherId));
      } else {
        await apiRequest(
          accessToken,
          `/api/v1/saved-teachers/${teacherId}`,
          { method: "POST" },
        );
        setTeacherSaved((current) => [...current, teacherId]);
      }
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to update saved teachers.");
    }
  }

  async function saveInstitutionProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileSaving || !accessToken) return;
    setProfileSaving(true);
    try {
      await Promise.all([
        apiRequest(accessToken, "/api/v1/profiles/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: profile.name,
            phone: profile.phone,
          }),
        }),
        apiRequest(accessToken, "/api/v1/profiles/me/institution", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_name: profile.name,
            institution_type: profile.type,
            city: profile.city,
            website: profile.website || null,
            description: profile.description,
          }),
        }),
      ]);
      notify("Institution profile updated.");
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to save institution profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function updateInstitutionPreference(
    key: keyof InstitutionPreferences,
    value: boolean,
  ) {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    try {
      await apiRequest(accessToken, "/api/v1/profiles/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updated }),
      });
      notify("Workspace preferences saved.");
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to save preferences.");
    }
  }

  async function handleLogout() {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      navigate("/college-login", { replace: true });
    } catch (error: unknown) {
      notify(error instanceof Error ? `Could not log out: ${error.message}` : "Could not log out.");
    }
  }

  function renderOverview() {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-600 p-5 text-white sm:p-7 lg:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div className="max-w-2xl">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-100">
                <Sparkles size={16} /> Institution recruitment centre
              </p>
              <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
                Find exceptional educators.
                <br className="hidden sm:block" /> Build a brighter future.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-violet-100">
                Manage teaching vacancies, discover qualified teachers, and
                track your institution's recruitment progress in one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowVacancyModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-violet-700 hover:bg-violet-50"
                >
                  <Plus size={17} /> Post a vacancy
                </button>
                <button
                  onClick={() => setPage("Find Teachers")}
                  className="flex items-center gap-2 rounded-xl border border-white/40 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                >
                  <Search size={17} /> Find teachers
                </button>
              </div>
            </div>
            <div className="hidden h-32 w-32 shrink-0 items-center justify-center rounded-3xl border border-white/20 bg-white/10 lg:flex">
              <GraduationCap size={76} strokeWidth={1.3} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Active vacancies"
            value={String(activeVacancies)}
            change="Live"
            icon={BriefcaseBusiness}
            color="bg-violet-50 text-violet-700"
          />
          <MetricCard
            title="Total applicants"
            value={String(totalApplicants)}
            change="Live"
            icon={Users}
            color="bg-sky-50 text-sky-700"
          />
          <MetricCard
            title="Interviews scheduled"
            value={String(
              applicants.filter((item) => item.status === "Interview").length,
            )}
            change="Live"
            icon={CalendarDays}
            color="bg-amber-50 text-amber-700"
          />
          <MetricCard
            title="Successful hires"
            value={String(hiredCount)}
            change="Live"
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2">
            <SectionHeading
              title="Recruitment overview"
              description="Applications and successful hires by month"
              action={
                <button
                  onClick={() => setPage("Analytics")}
                  className="text-sm font-semibold text-violet-700 hover:underline"
                >
                  Full report →
                </button>
              }
            />
            <ApplicationChart applications={applicants} />
          </Panel>

          <Panel>
            <SectionHeading
              title="Application pipeline"
              description="Current candidate progress"
            />
            <div className="space-y-5">
              {[
                {
                  label: "New applications",
                  count: applicants.filter((a) => a.status === "Applied").length,
                  color: "bg-sky-500",
                },
                {
                  label: "Shortlisted",
                  count: applicants.filter((a) => a.status === "Shortlisted")
                    .length,
                  color: "bg-violet-500",
                },
                {
                  label: "Interview",
                  count: applicants.filter((a) => a.status === "Interview")
                    .length,
                  color: "bg-amber-500",
                },
                {
                  label: "Hired",
                  count: hiredCount,
                  color: "bg-emerald-500",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-bold text-slate-900">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{
                        width: `${Math.min((item.count / Math.max(totalApplicants, 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPage("Applicants")}
              className="mt-7 w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manage applicants
            </button>
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Panel>
            <SectionHeading
              title="Recent vacancies"
              description="Your latest teaching opportunities"
              action={
                <button
                  onClick={() => setPage("Vacancies")}
                  className="text-sm font-semibold text-violet-700 hover:underline"
                >
                  View all
                </button>
              }
            />
            <div className="space-y-4">
              {vacancies.slice(0, 3).map((vacancy) => (
                <div
                  key={vacancy.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
                      <BookOpen size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-900">
                        {vacancy.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {vacancy.level} · {vacancy.location}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {vacancy.applicants} applicants
                      </p>
                    </div>
                  </div>
                  <Badge>{vacancy.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHeading
              title="Recently received applications"
              description="Candidates who need your attention"
              action={
                <button
                  onClick={() => setPage("Applicants")}
                  className="text-sm font-semibold text-violet-700 hover:underline"
                >
                  View all
                </button>
              }
            />
            <div className="space-y-4">
              {applicants.slice(0, 4).map((applicant) => (
                <div
                  key={applicant.id}
                  className="flex items-center gap-3"
                >
                  <Avatar
                    initials={applicant.initials}
                    color={applicant.color}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-slate-900">
                      {applicant.name}
                    </h3>
                    <p className="truncate text-xs text-slate-500">
                      {applicant.role}
                    </p>
                  </div>
                  <Badge>{applicant.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  function renderTeachers() {
    return (
      <div className="space-y-5">
        <Panel>
          <SectionHeading
            title="Find qualified teachers"
            description="Discover educators for your school, college, or university."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative sm:col-span-2">
              <Search
                className="absolute left-3.5 top-3.5 text-slate-400"
                size={18}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, subject, qualification, location..."
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </div>
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
            >
              {[
                "All subjects",
                ...Array.from(new Set(teachers.map((t) => t.subject))),
              ].map((subject) => (
                <option key={subject}>{subject}</option>
              ))}
            </select>
            <select
              value={levelFilter}
              onChange={(event) => setLevelFilter(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500"
            >
              <option>All levels</option>
              <option>Educator</option>
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SlidersHorizontal size={16} className="text-slate-400" />
            <label className="text-sm text-slate-600">
              Minimum experience:
            </label>
            <select
              value={minExperience}
              onChange={(event) => setMinExperience(event.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="0">Any experience</option>
              <option value="2">2+ years</option>
              <option value="5">5+ years</option>
              <option value="8">8+ years</option>
            </select>
            <span className="text-sm text-slate-500">
              {filteredTeachers.length} candidates found
            </span>
          </div>
        </Panel>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredTeachers.map((teacher) => (
            <Panel key={teacher.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <Avatar
                  initials={teacher.initials}
                  color={teacher.color}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900">{teacher.name}</h3>
                  <p className="mt-1 text-sm text-violet-700">
                    {teacher.subject}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    {teacher.verified && (
                      <ShieldCheck size={14} className="text-emerald-600" />
                    )}
                    {teacher.verified
                      ? "Profile marked verified"
                      : "Verification pending"}
                  </p>
                </div>
                <button
                  onClick={() =>
                    void toggleSavedTeacher(teacher.id)
                  }
                  aria-label={
                    teacherSaved.includes(teacher.id)
                      ? "Unsave teacher"
                      : "Save teacher"
                  }
                  className={`rounded-lg p-2 ${teacherSaved.includes(teacher.id) ? "bg-amber-50 text-amber-500" : "text-slate-400 hover:bg-slate-100"}`}
                >
                  <Star
                    size={19}
                    fill={
                      teacherSaved.includes(teacher.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>

              <div className="my-4 space-y-2 border-y border-slate-100 py-4 text-sm text-slate-600">
                <p className="flex items-start gap-2">
                  <GraduationCap
                    size={16}
                    className="mt-0.5 shrink-0 text-slate-400"
                  />
                  {teacher.qualification}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 size={16} className="text-slate-400" />
                  {teacher.experience} years of experience
                </p>
                <p className="flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  {teacher.level}
                </p>
                <p className="flex items-center gap-2">
                  <Search size={16} className="text-slate-400" />
                  {teacher.location}
                </p>
              </div>

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Expected monthly pay</p>
                  <p className="mt-1 font-bold text-slate-900">
                    {teacher.salary === null
                      ? "Contact candidate for expectations"
                      : money(teacher.salary)}
                  </p>
                </div>
                <button
                  onClick={() => void contactTeacher(teacher)}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Contact teacher
                </button>
              </div>
            </Panel>
          ))}
          {filteredTeachers.length === 0 && (
            <Panel className="text-center md:col-span-2 2xl:col-span-3">
              <Users size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 font-semibold text-slate-800">
                No teachers found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try changing the search or filters.
              </p>
            </Panel>
          )}
        </div>
      </div>
    );
  }

  function renderVacancies() {
    return (
      <Panel>
        <SectionHeading
          title="Vacancy management"
          description="Create and manage teaching and academic staff vacancies."
          action={
            <button
              onClick={() => setShowVacancyModal(true)}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus size={17} /> Post vacancy
            </button>
          }
        />
        <div className="mb-5 flex flex-wrap gap-2">
          {["All", "Active", "Pending review", "Closed"].map((filter) => (
            <button
              key={filter}
              onClick={() => setVacancyFilter(filter)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${vacancyFilter === filter ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {filter}
              {filter === "All" ? ` (${vacancies.length})` : ""}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredVacancies.map((vacancy) => (
            <div
              key={vacancy.id}
              className="rounded-xl border border-slate-200 p-4 transition hover:border-violet-200 sm:p-5"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="rounded-xl bg-violet-50 p-3 text-violet-700">
                    <BookOpen size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">
                        {vacancy.title}
                      </h3>
                      <Badge>{vacancy.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {vacancy.department} · {vacancy.level} · {vacancy.type}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Building2 size={14} /> {vacancy.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays size={14} /> Deadline: {vacancy.deadline}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={14} /> {vacancy.applicants} applicants
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 lg:border-0 lg:pt-0">
                  <span className="text-sm font-bold text-slate-900">
                    {vacancy.salary}
                  </span>
                  <button
                    onClick={() => void toggleVacancyStatus(vacancy.id)}
                    disabled={vacancy.status !== "Active"}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {vacancy.status === "Active"
                      ? "Close vacancy"
                      : vacancy.status === "Pending review"
                        ? "Awaiting review"
                        : "Closed"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredVacancies.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              No vacancies in this category.
            </p>
          )}
        </div>
      </Panel>
    );
  }

  function renderApplicants() {
    return (
      <Panel>
        <SectionHeading
          title="Applicant management"
          description="Review applications and move candidates through your recruitment pipeline."
        />
        <div className="relative mb-5 max-w-md">
          <Search
            size={18}
            className="absolute left-3.5 top-3.5 text-slate-400"
          />
          <input
            value={applicantSearch}
            onChange={(event) => setApplicantSearch(event.target.value)}
            placeholder="Search candidate, role, or status..."
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-500"
          />
        </div>

        <div className="space-y-3">
          {filteredApplicants.map((applicant) => (
            <div
              key={applicant.id}
              className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
            >
              <Avatar
                initials={applicant.initials}
                color={applicant.color}
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-slate-900">{applicant.name}</h3>
                <p className="mt-1 text-sm text-violet-700">
                  {applicant.role}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {applicant.qualification} · {applicant.experience}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Badge>{applicant.status}</Badge>
                <label className="sr-only" htmlFor={`status-${applicant.id}`}>
                  Change status for {applicant.name}
                </label>
                <select
                  id={`status-${applicant.id}`}
                  value={applicant.status}
                  onChange={(event) =>
                  void changeApplicantStatus(
                      applicant.id,
                      event.target.value as Applicant["status"],
                    )
                  }
                  className="max-w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
          {filteredApplicants.length === 0 && (
            <p className="py-12 text-center text-sm text-slate-500">
              No applicants match your search.
            </p>
          )}
        </div>
      </Panel>
    );
  }

  function renderAnalytics() {
    const total = Math.max(applicants.length, 1);
    const distribution = [
      { label: "Applied", color: "bg-sky-500" },
      { label: "Shortlisted", color: "bg-violet-500" },
      { label: "Interview", color: "bg-amber-500" },
      { label: "Hired", color: "bg-emerald-500" },
      { label: "Rejected", color: "bg-rose-500" },
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            title="Total applications"
            value={String(totalApplicants)}
            change="Live"
            icon={Users}
            color="bg-sky-50 text-sky-700"
          />
          <MetricCard
            title="Active vacancies"
            value={String(activeVacancies)}
            change="Live"
            icon={BriefcaseBusiness}
            color="bg-violet-50 text-violet-700"
          />
          <MetricCard
            title="Successful hires"
            value={String(hiredCount)}
            change="Live"
            icon={CheckCircle2}
            color="bg-emerald-50 text-emerald-700"
          />
        </div>
        <Panel>
          <SectionHeading
            title="Applications vs hires"
            description="Monthly applications and hires from your account data"
          />
          <ApplicationChart applications={applicants} />
        </Panel>
        <Panel>
          <SectionHeading
            title="Current applicant distribution"
            description="Distribution updates when you change applicant statuses."
          />
          <div className="space-y-5">
            {distribution.map((item) => {
              const count = applicants.filter(
                (a) => a.status === item.label,
              ).length;
              const percentage = Math.round((count / total) * 100);

              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold text-slate-900">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            Metrics are based on your current vacancies and applicant records.
          </p>
        </Panel>
      </div>
    );
  }

  function renderInstitutionProfile() {
    return (
      <Panel className="mx-auto max-w-3xl">
        <SectionHeading
          title="Institution profile"
          description="Maintain the public and recruitment contact details for your institution."
        />
        <p className="mb-5 text-xs leading-5 text-slate-500">
          {institutionStatus === "Verified"
            ? "Update your institution's recruitment details."
            : "Profile editing is available after administrator verification."}
        </p>
        <div className="mb-6 flex items-center gap-4 rounded-xl bg-violet-50 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-white">
            <Building2 size={32} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{profile.name}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {profile.type} · Institution administrator
            </p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck size={14} /> Recruitment workspace
            </span>
          </div>
        </div>

        <form
          onSubmit={saveInstitutionProfile}
          className="space-y-5"
        >
          {[
            {
              key: "name",
              label: "Institution name",
              value: profile.name,
            },
            { key: "username", label: "Username", value: `@${profile.username}` },
            { key: "phone", label: "Contact number", value: profile.phone },
            { key: "city", label: "City", value: profile.city },
            { key: "website", label: "Website", value: profile.website },
          ].map((field) => (
            <div key={field.key}>
              <label
                htmlFor={`profile-${field.key}`}
                className="text-sm font-semibold text-slate-700"
              >
                {field.label}
              </label>
              <input
                id={`profile-${field.key}`}
                value={field.value}
                disabled={field.key === "username" || institutionStatus !== "Verified"}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
          ))}

          <div>
            <label
              htmlFor="profile-type"
              className="text-sm font-semibold text-slate-700"
            >
              Institution type
            </label>
            <select
              id="profile-type"
              value={profile.type}
              disabled={institutionStatus !== "Verified"}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option>School</option>
              <option>College</option>
              <option>University</option>
              <option>Preschool</option>
              <option>Educational Trust</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-description"
              className="text-sm font-semibold text-slate-700"
            >
              About your institution
            </label>
            <textarea
              id="profile-description"
              rows={4}
              value={profile.description}
              disabled={institutionStatus !== "Verified"}
              onChange={(event) =>
                setProfile((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-violet-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={profileSaving || institutionStatus !== "Verified"}
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {profileSaving ? "Saving…" : "Save profile"}
          </button>
          {institutionStatus !== "Verified" && (
            <p role="status" className="mt-3 text-xs text-slate-500">
              Your institution must be verified before profile changes can be submitted.
            </p>
          )}
        </form>
      </Panel>
    );
  }

  const unreadNotificationCount = notifications.filter((item) => !item.read_at).length;

  async function markNotificationRead(notification: InAppNotification) {
    if (notification.read_at || !accessToken) return;
    try {
      const updated = await apiRequest<InAppNotification>(
        accessToken,
        `/api/v1/notifications/${notification.id}/read`,
        { method: "PATCH" },
      );
      setNotifications((current) =>
        current.map((item) => item.id === updated.id ? updated : item),
      );
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to update notification.");
    }
  }

  async function markAllNotificationsRead() {
    try {
      const updated = await Promise.all(
        notifications
          .filter((item) => !item.read_at)
          .map((item) =>
            apiRequest<InAppNotification>(
              accessToken,
              `/api/v1/notifications/${item.id}/read`,
              { method: "PATCH" },
            ),
          ),
      );
      setNotifications((current) =>
        current.map(
          (item) => updated.find((notification) => notification.id === item.id) ?? item,
        ),
      );
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to update notifications.");
    }
  }

  function renderNotifications() {
    return (
      <Panel>
        <SectionHeading
          title="Notifications"
          description="Important messages from EduVacancy administrators"
          action={
            unreadNotificationCount > 0 ? (
              <button
                onClick={() => void markAllNotificationsRead()}
                className="text-sm font-semibold text-violet-700 hover:underline"
              >
                Mark all as read
              </button>
            ) : undefined
          }
        />
        <div className="space-y-3">
          {notifications.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">
              You have no notifications.
            </p>
          )}
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-xl border p-4 ${item.read_at ? "border-slate-100 bg-white" : "border-violet-100 bg-violet-50/50"}`}
            >
              <div className="rounded-xl bg-white p-3 text-violet-700">
                <Bell size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {item.message}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              {!item.read_at && (
                <button
                  type="button"
                  onClick={() => void markNotificationRead(item)}
                  className="shrink-0 text-xs font-semibold text-violet-700 hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  function renderSettings() {
    return (
      <Panel className="mx-auto max-w-3xl">
        <SectionHeading
          title="Workspace settings"
          description="Configure recruitment preferences for this institution."
        />
        <div className="divide-y divide-slate-100">
          {[
            {
              key: "inAppNotifications" as const,
              title: "In-app application alerts",
              description: "Show new application updates in your dashboard inbox.",
            },
            {
              key: "applicationReminders" as const,
              title: "Application reminders",
              description: "Account preference for pending candidate review reminders.",
            },
            {
              key: "profileVisibility" as const,
              title: "Profile visibility",
              description: "Save whether your institution should be discoverable.",
            },
          ].map((setting) => (
            <div
              key={setting.title}
              className="flex items-center justify-between gap-4 py-5"
            >
              <div>
                <h3 className="font-semibold text-slate-900">
                  {setting.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {setting.description}
                </p>
              </div>
              <input
                type="checkbox"
                checked={preferences[setting.key]}
                onChange={(event) =>
                  void updateInstitutionPreference(setting.key, event.target.checked)
                }
                aria-label={setting.title}
                className="h-5 w-5 shrink-0 accent-violet-600"
              />
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Workspace preferences are saved to your account and follow you across devices.
        </p>
      </Panel>
    );
  }

  const pageContent: Record<Page, () => ReactNode> = {
    Overview: renderOverview,
    "Find Teachers": renderTeachers,
    Vacancies: renderVacancies,
    Applicants: renderApplicants,
    Analytics: renderAnalytics,
    "Institution Profile": renderInstitutionProfile,
    Notifications: renderNotifications,
    Settings: renderSettings,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {showVacancyModal && (
        <VacancyModal
          onClose={() => setShowVacancyModal(false)}
          onCreate={createVacancy}
        />
      )}

      {showChat && <PikachuChat onClose={() => setShowChat(false)} />}

      {notice && (
        <div
          role="status"
          className="fixed left-1/2 top-4 z-[60] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
          {notice}
        </div>
      )}

      <div className="flex min-h-screen">
        {mobileMenuOpen && (
          <button
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex h-[76px] items-center gap-3 border-b border-slate-100 px-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
              <GraduationCap size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="!m-0 whitespace-nowrap !text-lg !leading-tight font-extrabold tracking-tight text-slate-900">
                Edu<span className="text-violet-600">Vacancy</span>
              </h1>
              <p className="text-[11px] text-slate-500">
                Institutional workspace
              </p>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close menu"
            >
              <X size={19} />
            </button>
          </div>

          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <Building2 size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {profile.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Institution admin
                </p>
              </div>
              <ChevronDown size={16} className="text-slate-400" />
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Recruitment
            </p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = page === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setPage(item.label);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={19} />
                  <span className="flex-1">{item.label}</span>
                  {item.label === "Notifications" && unreadNotificationCount > 0 && (
                    <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <p className="text-sm font-bold text-slate-900">
                  Need recruitment help?
                </p>
              </div>
              <p className="text-xs leading-5 text-slate-600">
                Ask Pikachu for interview ideas and vacancy-writing tips.
              </p>
              <button
                onClick={() => setShowChat(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <MessageCircle size={15} /> Chat with Pikachu
              </button>
            </div>
            <button
              onClick={() => void handleLogout()}
              className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-500 hover:bg-slate-50"
            >
              <LogOut size={18} /> Sign out
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 sm:text-base">
                  {page}
                </p>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Home / {page}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <button
                onClick={() => setPage("Notifications")}
                aria-label="View notifications"
                className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
              >
                <Bell size={19} />
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] text-white">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setPage("Institution Profile")}
                className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700">
                  GW
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-semibold text-slate-900">
                    Institution Admin
                  </p>
                  <p className="text-xs text-slate-500">{profile.type}</p>
                </div>
                <ChevronDown size={15} className="hidden text-slate-400 sm:block" />
              </button>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1800px] p-4 sm:p-6 lg:p-8">
            <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm text-slate-500">
                  Welcome back, Institution Admin 👋
                </p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                  {page === "Overview"
                    ? "Recruitment overview"
                    : page}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {page === "Overview"
                    ? "Here is what is happening with your institution's hiring."
                    : `Manage your institution's ${page.toLowerCase()} in one place.`}
                </p>
              </div>
              <button
                onClick={() => setShowVacancyModal(true)}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                <Plus size={18} /> Post a vacancy
              </button>
            </div>

            {pageContent[page]()}
          </main>

          <footer className="border-t border-slate-200 bg-white px-5 py-5 text-center text-xs text-slate-400">
            EduVacancy · School & College Recruitment
          </footer>
        </div>
      </div>

      <button
        onClick={() => setShowChat((current) => !current)}
        aria-label={showChat ? "Close Pikachu assistant" : "Open Pikachu assistant"}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border-4 border-white bg-amber-400 px-4 py-3 font-bold text-slate-900 shadow-xl transition hover:-translate-y-1 hover:bg-yellow-300 sm:bottom-6 sm:right-6"
      >
        {showChat ? <X size={20} /> : <span className="text-xl">⚡</span>}
        <span className="text-sm">Pikachu</span>
      </button>
    </div>
  );
}
