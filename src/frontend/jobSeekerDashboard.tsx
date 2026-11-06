
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Download, PartyPopper, Sparkles, X } from "lucide-react";
import {
  apiRequest,
  apiRequestAllPages,
  fetchCurrentAccount,
  type InAppNotification,
} from "../lib/api-config";
import { JOB_SEEKER_PROFILE_PHOTO_KEY } from "../lib/job-seeker-profile";
import { getSupabaseClient } from "../lib/supabase-config";

type Job = {
  id: string;
  title: string;
  institution: string;
  location: string;
  type: string;
  salary: string;
  category: string;
  experience: string;
  posted: string;
  description: string;
  color: "violet" | "blue" | "emerald" | "amber" | "pink" | "cyan";
};

type Application = {
  id: string;
  jobId: string;
  status:
    | "Applied"
    | "Under Review"
    | "Shortlisted"
    | "Interview"
    | "Rejected"
    | "Hired";
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
  experience: string | null;
  created_at: string;
  institution: { full_name: string } | null;
};

type ApplicationRecord = {
  id: string;
  vacancy_id: string;
  status: Application["status"];
};

type ProfileRecord = {
  profile: {
    full_name: string;
    username: string;
    phone: string;
  };
  details: {
    qualification: string;
    subject: string;
    years_experience: number;
    preferred_location: string;
    professional_summary: string;
    profile_photo_url?: string | null;
  } | null;
};

type PreferencesRecord = { preferences: unknown };

type DashboardSettings = {
  newJobAlerts: boolean;
  applicationUpdates: boolean;
  weeklyDigest: boolean;
  profileVisibility: "institutions" | "private";
  alertLocation: string;
  alertCategory: string;
  alertJobType: string;
  theme: "light" | "dark";
};

const dashboardSettingsKey = "educareer.job-seeker.settings";
const celebrationFlowers = [
  "🌸",
  "🌼",
  "✨",
  "🌷",
  "🎉",
  "🌺",
  "💐",
  "✨",
  "🌻",
  "🌸",
  "🎊",
  "🌼",
];

const defaultSettings: DashboardSettings = {
  newJobAlerts: true,
  applicationUpdates: true,
  weeklyDigest: false,
  profileVisibility: "institutions",
  alertLocation: "Hyderabad",
  alertCategory: "All",
  alertJobType: "All",
  theme: "light",
};

const statusStyles: Record<Application["status"], string> = {
  Applied: "bg-blue-50 text-blue-700",
  "Under Review": "bg-amber-50 text-amber-700",
  Shortlisted: "bg-emerald-50 text-emerald-700",
  Interview: "bg-violet-50 text-violet-700",
  Rejected: "bg-rose-50 text-rose-700",
  Hired: "bg-emerald-50 text-emerald-700",
};

const jobColorStyles: Record<Job["color"], string> = {
  violet: "bg-violet-50 text-violet-700",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  pink: "bg-pink-50 text-pink-700",
  cyan: "bg-cyan-50 text-cyan-700",
};

function postedAgeInDays(posted: string) {
  if (posted === "Today") return 0;

  const days = Number(posted.match(/\d+/)?.[0]);
  return Number.isFinite(days) ? days : Number.MAX_SAFE_INTEGER;
}

function formatPay(minimum: number | null, maximum: number | null) {
  const format = (value: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  if (minimum === null && maximum === null) return "Salary not specified";
  if (minimum === null && maximum !== null) {
    return `Up to ₹${format(maximum)}/mo`;
  }
  if (minimum !== null && maximum === null) {
    return `From ₹${format(minimum)}/mo`;
  }
  if (minimum !== null && maximum !== null) {
    return `₹${format(minimum)}–₹${format(maximum)}/mo`;
  }
  return "Salary not specified";
}

function postedDate(createdAt: string) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000),
  );
  return days === 0 ? "Today" : `${days} day${days === 1 ? "" : "s"} ago`;
}

function readStoredProfilePhoto() {
  try {
    return {
      photo: window.localStorage.getItem(JOB_SEEKER_PROFILE_PHOTO_KEY),
      error: "",
    };
  } catch {
    return {
      photo: null,
      error: "Your profile photo is unavailable because browser storage could not be accessed.",
    };
  }
}

function readSeenHiredApplications(userId: string): Set<string> {
  try {
    const stored = window.localStorage.getItem(
      `educareer.job-seeker.hired-applications:${userId}`,
    );
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed)
      ? new Set(parsed.filter((value): value is string => typeof value === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

function readDashboardSettings() {
  try {
    const storedSettings = window.localStorage.getItem(dashboardSettingsKey);
    if (!storedSettings) {
      return { settings: defaultSettings, error: "" };
    }

    const parsed: unknown = JSON.parse(storedSettings);
    return { settings: normalizeDashboardSettings(parsed), error: "" };
  } catch {
    return {
      settings: defaultSettings,
      error: "Saved settings could not be loaded. Default settings are shown.",
    };
  }
}

function normalizeDashboardSettings(parsed: unknown): DashboardSettings {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return defaultSettings;
  }
  const value = parsed as Partial<DashboardSettings>;
  return {
    newJobAlerts:
      typeof value.newJobAlerts === "boolean"
        ? value.newJobAlerts
        : defaultSettings.newJobAlerts,
    applicationUpdates:
      typeof value.applicationUpdates === "boolean"
        ? value.applicationUpdates
        : defaultSettings.applicationUpdates,
    weeklyDigest:
      typeof value.weeklyDigest === "boolean"
        ? value.weeklyDigest
        : defaultSettings.weeklyDigest,
    profileVisibility:
      value.profileVisibility === "private" ||
      value.profileVisibility === "institutions"
        ? value.profileVisibility
        : defaultSettings.profileVisibility,
    alertLocation:
      typeof value.alertLocation === "string"
        ? value.alertLocation
        : defaultSettings.alertLocation,
    alertCategory:
      value.alertCategory === "All" ||
      value.alertCategory === "School" ||
      value.alertCategory === "College"
        ? value.alertCategory
        : defaultSettings.alertCategory,
    alertJobType:
      value.alertJobType === "All" ||
      value.alertJobType === "Full-time" ||
      value.alertJobType === "Part-time"
        ? value.alertJobType
        : defaultSettings.alertJobType,
    theme:
      value.theme === "dark" || value.theme === "light"
        ? value.theme
        : defaultSettings.theme,
  };
}

function hasPreferenceEntries(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

const navItems = [
  { label: "Overview", icon: "▦" },
  { label: "Find Jobs", icon: "⌕" },
  { label: "My Applications", icon: "▤" },
  { label: "Saved Jobs", icon: "♡" },
  { label: "My Profile", icon: "♙" },
  { label: "Notifications", icon: "♢" },
  { label: "ID Card", icon: "▣" },
  { label: "Settings", icon: "⚙" },
];

export default function JobSeekerDashboard() {
  const navigate = useNavigate();
  const [hiredCelebrations, setHiredCelebrations] = useState<
    { id: string; title: string; institution: string }[]
  >([]);
  const seenHiredApplications = useRef(new Set<string>());
  const vacanciesById = useRef(new Map<string, Pick<Job, "title" | "institution">>());
  const userIdRef = useRef("");
  const applicationPollingError = useRef("");
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("All");
  const [jobType, setJobType] = useState("All");
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [notificationsUpdating, setNotificationsUpdating] = useState(false);
  const [storedProfilePhoto] = useState(readStoredProfilePhoto);
  const [storedDashboardSettings] = useState(readDashboardSettings);
  const [settings, setSettings] = useState(storedDashboardSettings.settings);
  const [profilePhoto, setProfilePhoto] = useState(storedProfilePhoto.photo);
  const [notice, setNotice] = useState(
    storedProfilePhoto.error || storedDashboardSettings.error,
  );
  const [pikachuOpen, setPikachuOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "assistant" | "user"; content: string }[]
  >([
    {
      role: "assistant",
      content:
        "Hi! I’m Pikachu, your career assistant. Ask me about job matches, applications, or interview preparation.",
    },
  ]);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [accessToken, setAccessToken] = useState("");
  const [accountStatus, setAccountStatus] = useState("Pending");
  const [profile, setProfile] = useState({
    name: "",
    username: "",
    phone: "",
    qualification: "",
    subject: "",
    experience: "",
    preferredLocation: "",
    bio: "",
  });

  function celebrateNewHires(records: ApplicationRecord[]) {
    const unseenHires = records.filter(
      (application) =>
        application.status === "Hired" &&
        !seenHiredApplications.current.has(application.id),
    );
    if (unseenHires.length === 0) return;

    for (const application of unseenHires) {
      seenHiredApplications.current.add(application.id);
    }

    try {
      window.localStorage.setItem(
        `educareer.job-seeker.hired-applications:${userIdRef.current}`,
        JSON.stringify([...seenHiredApplications.current]),
      );
    } catch {
      // The celebration still works if browser storage is unavailable.
    }

    setHiredCelebrations(
      unseenHires.map((application) => {
        const job = vacanciesById.current.get(application.vacancy_id);
        return {
          id: application.id,
          title: job?.title ?? "Your new role",
          institution: job?.institution ?? "Your new institution",
        };
      }),
    );
  }

  useEffect(() => {
    let mounted = true;
    async function loadDashboard() {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) {
          navigate("/job-login", { replace: true });
          return;
        }

        const account = await fetchCurrentAccount(session.access_token);
        if (account.profile.role !== "job_seeker") {
          await supabase.auth.signOut();
          navigate("/job-login", { replace: true });
          return;
        }
        const [profileData, vacancies, saved, preferenceData, notificationData] = await Promise.all([
          apiRequest<ProfileRecord>(session.access_token, "/api/v1/profiles/me"),
          apiRequestAllPages<VacancyRecord>(
            session.access_token,
            "/api/v1/vacancies",
          ),
          apiRequest<{ vacancy_id: string }[]>(
            session.access_token,
            "/api/v1/saved-vacancies/mine",
          ),
          apiRequest<PreferencesRecord>(
            session.access_token,
            "/api/v1/profiles/me/preferences",
          ),
          apiRequest<InAppNotification[]>(
            session.access_token,
            "/api/v1/notifications/mine",
          ),
        ]);
        const applicationsData =
          account.profile.status === "Verified"
            ? await apiRequest<ApplicationRecord[]>(
                session.access_token,
                "/api/v1/applications/mine",
              )
            : [];

        let profilePhotoUrl = storedProfilePhoto.photo;
        let profilePhotoError = "";
        const profilePhotoPath = profileData.details?.profile_photo_url;
        if (profilePhotoPath) {
          const { data: signedPhoto, error: signedPhotoError } =
            await supabase.storage
              .from("job-seeker-documents")
              .createSignedUrl(profilePhotoPath, 60 * 60);
          if (signedPhotoError) {
            profilePhotoError = `Unable to load your saved profile photo: ${signedPhotoError.message}`;
          } else {
            profilePhotoUrl = signedPhoto.signedUrl;
          }
        }

        if (!mounted) return;
        setProfilePhoto(profilePhotoUrl);
        if (profilePhotoError) setNotice(profilePhotoError);
        setAccessToken(session.access_token);
        userIdRef.current = account.id;
        seenHiredApplications.current = readSeenHiredApplications(account.id);
        vacanciesById.current = new Map(
          vacancies.map((vacancy) => [
            vacancy.id,
            {
              title: vacancy.title,
              institution: vacancy.institution?.full_name ?? "Institution",
            },
          ]),
        );
        setNotifications(notificationData);
        setAccountStatus(account.profile.status);
        setProfile({
          name: profileData.profile.full_name,
          username: profileData.profile.username,
          phone: profileData.profile.phone ?? "",
          qualification: profileData.details?.qualification ?? "",
          subject: profileData.details?.subject ?? "",
          experience:
            profileData.details?.years_experience === undefined
              ? ""
              : `${profileData.details.years_experience} years`,
          preferredLocation: profileData.details?.preferred_location ?? "",
          bio: profileData.details?.professional_summary ?? "",
        });
        setJobs(
          vacancies.map((vacancy, index) => ({
            id: vacancy.id,
            title: vacancy.title,
            institution: vacancy.institution?.full_name ?? "Institution",
            location: vacancy.location,
            type: vacancy.employment_type,
            salary: formatPay(vacancy.salary_min, vacancy.salary_max),
            category: vacancy.category,
            experience: vacancy.experience ?? "Experience not specified",
            posted: postedDate(vacancy.created_at),
            description: vacancy.description,
            color: (["violet", "blue", "emerald", "amber", "pink", "cyan"] as const)[
              index % 6
            ],
          })),
        );
        setSavedJobs(saved.map((item) => item.vacancy_id));
        const mappedApplications = applicationsData.map((application) => ({
            id: application.id,
            jobId: application.vacancy_id,
            status: application.status,
          }));
        setApplications(mappedApplications);
        celebrateNewHires(applicationsData);
        setSettings(
          hasPreferenceEntries(preferenceData.preferences)
            ? normalizeDashboardSettings(preferenceData.preferences)
            : storedDashboardSettings.settings,
        );
        if (account.profile.status !== "Verified") {
          setNotice((current) =>
            current
              ? `${current} Your account is awaiting administrator verification. Applications are available after verification.`
              : "Your account is awaiting administrator verification. Applications are available after verification.",
          );
        }
      } catch (error: unknown) {
        if (mounted) {
          setNotice(
            error instanceof Error
              ? error.message
              : "Unable to load your dashboard.",
          );
        }
      } finally {
        if (mounted) setDashboardLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      mounted = false;
    };
  }, [navigate, storedDashboardSettings.settings, storedProfilePhoto.photo]);

  useEffect(() => {
    if (!accessToken || accountStatus !== "Verified") return;

    let mounted = true;
    let requestPending = false;
    const refreshApplicationStatuses = async () => {
      if (requestPending) return;
      requestPending = true;
      try {
        const records = await apiRequest<ApplicationRecord[]>(
          accessToken,
          "/api/v1/applications/mine",
        );
        if (!mounted) return;

        setApplications(
          records.map((application) => ({
            id: application.id,
            jobId: application.vacancy_id,
            status: application.status,
          })),
        );
        celebrateNewHires(records);
        if (applicationPollingError.current) {
          const previousError = applicationPollingError.current;
          applicationPollingError.current = "";
          setNotice((current) => current === previousError ? "" : current);
        }
      } catch (error: unknown) {
        if (mounted && !applicationPollingError.current) {
          const message = error instanceof Error
            ? `Unable to check for application updates: ${error.message}`
            : "Unable to check for application updates.";
          applicationPollingError.current = message;
          setNotice(message);
        }
      } finally {
        requestPending = false;
      }
    };

    const intervalId = window.setInterval(
      () => void refreshApplicationStatuses(),
      15000,
    );
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshApplicationStatuses();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [accessToken, accountStatus]);

  async function updateSettings(updates: Partial<DashboardSettings>) {
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);
    try {
      window.localStorage.setItem(
        dashboardSettingsKey,
        JSON.stringify(nextSettings),
      );
    } catch {
      setNotice("Browser storage is unavailable; syncing settings to your account.");
    }
    try {
      await apiRequest(accessToken, "/api/v1/profiles/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: nextSettings }),
      });
      setNotice("Settings saved to your account.");
    } catch (error: unknown) {
      setNotice(
        error instanceof Error
          ? `Settings could not be synced to your account: ${error.message}`
          : "Settings could not be synced to your account.",
      );
    }
  }

  function applyAlertPreferences() {
    setLocation(settings.alertLocation.trim());
    setCategory(settings.alertCategory);
    setJobType(settings.alertJobType);
    setSortOrder("recent");
    setSearch("");
    setActivePage("Find Jobs");
    setNotice("Job search updated with your alert preferences.");
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      navigate("/job-login", { replace: true });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? `Could not log out: ${error.message}`
          : "Could not log out. Please try again.",
      );
      setLoggingOut(false);
    }
  }

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    const city = location.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        !query ||
        [
          job.title,
          job.institution,
          job.location,
          job.category,
          job.description,
        ].some((value) => value.toLowerCase().includes(query));

      const matchesLocation =
        !city || job.location.toLowerCase().includes(city);

      const matchesCategory =
        category === "All" || job.category === category;

      const matchesType = jobType === "All" || job.type === jobType;

      const isSaved = savedJobs.includes(job.id);
      const hasApplied = applications.some((app) => app.jobId === job.id);

      const matchesPage =
        activePage === "Saved Jobs"
          ? isSaved
          : activePage === "My Applications"
            ? hasApplied
            : true;

      return (
        matchesSearch &&
        matchesLocation &&
        matchesCategory &&
        matchesType &&
        matchesPage
      );
    }).sort((first, second) => {
      const ageDifference =
        postedAgeInDays(first.posted) - postedAgeInDays(second.posted);
      return sortOrder === "recent" ? ageDifference : -ageDifference;
    });
  }, [
    jobs,
    search,
    location,
    category,
    jobType,
    sortOrder,
    savedJobs,
    applications,
    activePage,
  ]);

  function getPikachuReply(message: string) {
    const query = message.toLowerCase();

    if (/\b(job|jobs|role|roles|vacanc|opening|recommend|opportunit)\b/.test(query)) {
      if (filteredJobs.length === 0) {
        return "I couldn’t find a match with your current filters. Open Find Jobs and try a broader location, institution type, or employment type.";
      }

      const recommendations = filteredJobs
        .slice(0, 3)
        .map((job) => `${job.title} at ${job.institution} (${job.location})`)
        .join(" · ");
      return `Here are a few roles to explore: ${recommendations}. Choose Find Jobs to see the details and apply.`;
    }

    if (/\b(application|applications|applied|status|shortlist)\b/.test(query)) {
      return `You have ${applications.length} application${applications.length === 1 ? "" : "s"} on your dashboard. Open My Applications to review each status and keep track of your progress.`;
    }

    if (/\b(profile|resume|cv|qualification|experience)\b/.test(query)) {
      return `Your profile is ${profileCompletion}% complete. Add your experience, qualifications, and a clear professional summary to help institutions understand your strengths.`;
    }

    if (/\b(interview|prepare|preparation)\b/.test(query)) {
      return "For an education interview, prepare a short introduction, a lesson example from your subject, and a story about how you support different learners. Would you like help finding roles to practice for?";
    }

    return "I can help you explore job matches, check your application progress, strengthen your profile, or prepare for an education interview. What would you like to work on?";
  }

  function sendChatMessage(message = chatDraft) {
    const content = message.trim();
    if (!content) return;

    setChatMessages((previous) => [
      ...previous,
      { role: "user", content },
      { role: "assistant", content: getPikachuReply(content) },
    ]);
    setChatDraft("");
  }

  const appliedCount = applications.length;
  const shortlistedCount = applications.filter(
    (app) => app.status === "Shortlisted" || app.status === "Interview",
  ).length;
  const reviewCount = applications.filter(
    (app) => app.status === "Under Review",
  ).length;
  const rejectedCount = applications.filter(
    (app) => app.status === "Rejected",
  ).length;

  const profileFields = [
    profile.name,
    profile.username,
    profile.phone,
    profile.qualification,
    profile.subject,
    profile.experience,
    profile.preferredLocation,
    profile.bio,
  ];

  const profileCompletion = Math.round(
    (profileFields.filter((field) => field.trim().length > 0).length /
      profileFields.length) *
      100,
  );

  async function toggleSaved(jobId: string) {
    if (!accessToken) return;
    const isSaved = savedJobs.includes(jobId);
    try {
      if (isSaved) {
        await apiRequest<void>(
          accessToken,
          `/api/v1/saved-vacancies/${jobId}`,
          { method: "DELETE" },
        );
        setSavedJobs((previous) => previous.filter((id) => id !== jobId));
      } else {
        await apiRequest(
          accessToken,
          `/api/v1/saved-vacancies/${jobId}`,
          { method: "POST" },
        );
        setSavedJobs((previous) => [...previous, jobId]);
      }
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to update saved jobs.");
    }
  }

  async function applyToJob(jobId: string) {
    if (applications.some((app) => app.jobId === jobId)) {
      setNotice("You have already applied for this job.");
      return;
    }
    if (accountStatus !== "Verified") {
      setNotice("Your account must be verified before you can apply.");
      return;
    }
    try {
      const application = await apiRequest<ApplicationRecord>(
        accessToken,
        `/api/v1/vacancies/${jobId}/applications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      setApplications((previous) => [
        ...previous,
        { id: application.id, jobId: application.vacancy_id, status: application.status },
      ]);
      setNotice("Application submitted successfully.");
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to submit your application.");
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
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
        apiRequest(accessToken, "/api/v1/profiles/me/job-seeker", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: profile.subject,
            qualification: profile.qualification,
            years_experience: Number.parseInt(profile.experience, 10) || 0,
            preferred_location: profile.preferredLocation,
            professional_summary: profile.bio,
          }),
        }),
      ]);
      setNotice("Your profile has been saved.");
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : "Unable to save your profile.");
    } finally {
      setProfileSaving(false);
    }
  }

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
    const unread = notifications.filter((notification) => !notification.read_at);
    if (unread.length === 0 || !accessToken || notificationsUpdating) return;

    setNotificationsUpdating(true);
    try {
      const updated = await Promise.all(
        unread.map((notification) =>
          apiRequest<InAppNotification>(
            accessToken,
            `/api/v1/notifications/${notification.id}/read`,
            { method: "PATCH" },
          ),
        ),
      );
      setNotifications((current) =>
        current.map(
          (notification) =>
            updated.find((item) => item.id === notification.id) ?? notification,
        ),
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to update notifications.";
      try {
        const refreshed = await apiRequest<InAppNotification[]>(
          accessToken,
          "/api/v1/notifications/mine",
        );
        setNotifications(refreshed);
        setNotice(`${message} Notification statuses were refreshed.`);
      } catch {
        setNotice(message);
      }
    } finally {
      setNotificationsUpdating(false);
    }
  }

  function exportApplications() {
    const applicationsToExport = applications
      .map((application) => {
        const job = jobs.find((item) => item.id === application.jobId);
        return job ? [job.title, job.institution, job.location, job.category, application.status] : null;
      })
      .filter((row): row is string[] => row !== null);
    if (applicationsToExport.length === 0) return;

    const escapeCell = (value: string) => {
      const safeValue = /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const csv = [
      ["Job title", "Institution", "Location", "Category", "Status"],
      ...applicationsToExport,
    ]
      .map((row) => row.map(escapeCell).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "educareer-applications.csv";
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${applicationsToExport.length} application${applicationsToExport.length === 1 ? "" : "s"} exported.`);
  }

  const unreadNotificationCount = notifications.filter((item) => !item.read_at).length;

  const heading =
    activePage === "Overview"
      ? "Dashboard overview"
      : activePage === "Find Jobs"
        ? "Find your next opportunity"
        : activePage === "My Applications"
          ? "My applications"
          : activePage === "Saved Jobs"
            ? "Saved jobs"
            : activePage === "Notifications"
              ? "Notifications"
            : activePage === "ID Card"
              ? "Your ID card"
              : activePage === "Settings"
                ? "Settings"
              : "My profile";

  if (dashboardLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Loading your dashboard…
      </main>
    );
  }

  return (
    <div className={`${settings.theme === "dark" ? "dashboard-dark" : ""} min-h-screen bg-slate-50 text-slate-800`}>
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-xl"
        >
          <div className="flex items-center gap-3">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss notification"
              className="rounded px-1 text-lg hover:bg-white/10"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {hiredCelebrations.length > 0 && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-slate-950/60 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {celebrationFlowers.map((flower, index) => (
              <span
                key={`${flower}-${index}`}
                className="hired-flower-confetti absolute -top-12 text-2xl sm:text-3xl"
                style={{
                  left: `${(index * 37 + 5) % 100}%`,
                  animationDelay: `${(index % 6) * -0.7}s`,
                  animationDuration: `${4 + (index % 5) * 0.6}s`,
                }}
              >
                {flower}
              </span>
            ))}
          </div>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hired-celebration-title"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-white/70 bg-white text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setHiredCelebrations([])}
              aria-label="Close congratulations"
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={20} />
            </button>
            <div className="bg-gradient-to-br from-rose-50 via-amber-50 to-violet-50 px-6 pb-7 pt-10 sm:px-10">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-violet-600 shadow-lg shadow-violet-200/70">
                <PartyPopper size={38} />
              </div>
              <div className="mb-2 flex items-center justify-center gap-2 text-2xl" aria-hidden="true">
                <span>🌸</span>
                <Sparkles className="text-amber-500" size={22} />
                <span>🌷</span>
                <Sparkles className="text-violet-500" size={22} />
                <span>🌼</span>
              </div>
              <h2
                id="hired-celebration-title"
                className="text-3xl font-extrabold tracking-tight text-slate-900"
              >
                Congratulations!
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                You got hired! Your hard work has paid off. Wishing you great
                success in your new role!
              </p>
            </div>
            <div className="px-6 py-6 sm:px-10">
              <ul className="space-y-3 text-left">
                {hiredCelebrations.map((application) => (
                  <li
                    key={application.id}
                    className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-3"
                  >
                    <p className="font-semibold text-slate-900">{application.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{application.institution}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setHiredCelebrations([]);
                    setActivePage("My Applications");
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-700"
                >
                  <Sparkles size={17} />
                  View my applications
                </button>
                <button
                  type="button"
                  onClick={() => setHiredCelebrations([])}
                  className="min-h-11 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Thank you!
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-sm font-bold text-white">
            EV
            </div>
          <div className="min-w-0">
            <h1 className="!m-0 whitespace-nowrap !text-base !leading-tight font-bold tracking-tight xl:!text-lg">Edu Vacancy</h1>
              <p className="text-xs text-slate-500">Education jobs portal</p>
            </div>
          </div>

          <div className="px-4 py-6">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Workspace
            </p>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActivePage(item.label);
                    setNotice("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                    activePage === item.label
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <span className="w-5 text-center text-xl">{item.icon}</span>
                  {item.label}
                  {item.label === "My Applications" && appliedCount > 0 && (
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                      {appliedCount}
                    </span>
                  )}
                  {item.label === "Notifications" && unreadNotificationCount > 0 && (
                    <span className="ml-auto rounded-full bg-violet-600 px-2 py-0.5 text-xs text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setPikachuOpen((open) => !open)}
              aria-expanded={pikachuOpen}
              aria-controls="pikachu-chat-panel"
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-300 hover:bg-amber-100"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-300 text-lg text-amber-950">
                ⚡
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">Pikachu AI</span>
                <span className="block text-xs text-slate-500">Career assistant</span>
              </span>
              <span className="ml-auto text-xs text-amber-700">Chat</span>
            </button>
          </div>

          <div className="mt-auto p-4">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-white">
              <p className="text-sm font-semibold">Your next chapter starts here</p>
              <p className="mt-2 text-xs leading-5 text-violet-100">
                Discover opportunities at schools and colleges.
              </p>
              <button
                type="button"
                onClick={() => setActivePage("Find Jobs")}
                className="mt-4 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
              >
                Explore jobs →
              </button>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          {/* Top navigation */}
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
              <div className="min-w-0 lg:hidden">
                <p className="whitespace-nowrap text-sm font-bold text-slate-900 sm:text-base">Edu Vacancy</p>
                <p className="text-xs text-slate-500">Job seeker portal</p>
              </div>

              <div className="hidden sm:block">
                <p className="text-sm text-slate-500">Welcome back,</p>
                <p className="font-semibold text-slate-900">{profile.name}</p>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActivePage("Notifications")}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="View notifications"
                >
                  <Bell size={18} />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage("My Applications")}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-lg hover:bg-slate-50"
                  aria-label="View applications"
                >
                  ♧
                  {appliedCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] text-white">
                      {appliedCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage("My Profile")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 ring-2 ring-white"
                  aria-label="Open profile"
                >
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt=""
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    profile.name.trim().charAt(0).toUpperCase() || "A"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePage("Settings");
                    setNotice("");
                  }}
                  aria-label="Open settings"
                  aria-current={activePage === "Settings" ? "page" : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border text-lg transition lg:hidden ${
                    activePage === "Settings"
                      ? "border-violet-200 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  ⚙
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            {/* Page heading */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-1 text-sm font-medium text-violet-600">
                  EDUCATION CAREERS
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {heading}
                </h2>
                <p className="mt-2 text-sm text-slate-500 sm:text-base">
                  Find meaningful opportunities in schools and colleges.
                </p>
              </div>

              {activePage !== "My Profile" &&
                activePage !== "ID Card" &&
                activePage !== "Settings" && (
                <button
                  type="button"
                  onClick={() => setActivePage("Find Jobs")}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
                >
                  + Explore jobs
                </button>
              )}
            </div>

            {/* Profile page */}
            {activePage === "Notifications" ? (
              <section className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Platform inbox</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Important updates from the EduVacancy administrators.
                    </p>
                  </div>
                  {unreadNotificationCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      disabled={notificationsUpdating}
                      className="rounded-lg px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 disabled:cursor-wait disabled:opacity-60"
                    >
                      {notificationsUpdating ? "Updating..." : `Mark all ${unreadNotificationCount} as read`}
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    You have no notifications.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((item) => (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-4 ${item.read_at ? "border-slate-200 bg-white" : "border-violet-200 bg-violet-50/60"}`}
                      >
                        <div className="flex items-start gap-3">
                          <Bell size={18} className="mt-0.5 shrink-0 text-violet-600" />
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-slate-900">{item.title}</h4>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.message}</p>
                            <p className="mt-2 text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p>
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
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : activePage === "Settings" ? (
              <div className="mx-auto grid max-w-4xl gap-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-900">Appearance</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose the display mode for your dashboard.
                    </p>
                  </div>
                  <label className="flex max-w-xl items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Bright or dark mode
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {settings.theme === "dark"
                          ? "Dark mode is active."
                          : "Bright mode is active."}
                      </span>
                    </span>
                    <select
                      aria-label="Display mode"
                      value={settings.theme}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "light" || value === "dark") {
                          updateSettings({ theme: value });
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                    >
                      <option value="light">Bright</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Notifications</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose which updates you want to receive.
                    </p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {[
                      {
                        key: "newJobAlerts" as const,
                        title: "New job matches",
                        description: "Get notified when jobs match your preferences.",
                      },
                      {
                        key: "applicationUpdates" as const,
                        title: "Application updates",
                        description: "Stay informed about changes to your applications.",
                      },
                      {
                        key: "weeklyDigest" as const,
                        title: "Weekly job digest",
                        description: "Receive a weekly summary of jobs and career activity.",
                      },
                    ].map((option) => (
                      <label
                        key={option.key}
                        className="flex cursor-pointer items-center justify-between gap-4 py-4"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-500">
                            {option.description}
                          </span>
                        </span>
                        <input
                          type="checkbox"
                          checked={settings[option.key]}
                          onChange={(event) =>
                            updateSettings({ [option.key]: event.target.checked })
                          }
                          className="h-5 w-5 shrink-0 accent-violet-600"
                          aria-label={option.title}
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold text-slate-900">Job alert preferences</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Save filters for the kinds of roles you want to find.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <label className="min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Preferred location
                      </span>
                      <input
                        value={settings.alertLocation}
                        onChange={(event) =>
                          setSettings((previous) => ({
                            ...previous,
                            alertLocation: event.target.value,
                          }))
                        }
                        onBlur={() =>
                          updateSettings({ alertLocation: settings.alertLocation })
                        }
                        placeholder="Any location"
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Institution type
                      </span>
                      <select
                        value={settings.alertCategory}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "All" || value === "School" || value === "College") {
                            updateSettings({ alertCategory: value });
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                      >
                        <option value="All">All institutions</option>
                        <option value="School">Schools</option>
                        <option value="College">Colleges</option>
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Employment type
                      </span>
                      <select
                        value={settings.alertJobType}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (
                            value === "All" ||
                            value === "Full-time" ||
                            value === "Part-time"
                          ) {
                            updateSettings({ alertJobType: value });
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500"
                      >
                        <option value="All">All job types</option>
                        <option value="Full-time">Full-time</option>
                        <option value="Part-time">Part-time</option>
                      </select>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={applyAlertPreferences}
                    className="mt-5 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
                  >
                    Browse matching jobs
                  </button>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <div className="mb-5">
                    <h3 className="text-lg font-bold text-slate-900">Privacy</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose whether your profile should be visible to institutions.
                    </p>
                  </div>
                  <label className="flex max-w-xl items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        Profile visibility
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {settings.profileVisibility === "institutions"
                          ? "Visible to institutions browsing candidates."
                          : "Keep your profile private."}
                      </span>
                    </span>
                    <select
                      aria-label="Profile visibility"
                      value={settings.profileVisibility}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "institutions" || value === "private") {
                          updateSettings({ profileVisibility: value });
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500"
                    >
                      <option value="institutions">Institutions</option>
                      <option value="private">Private</option>
                    </select>
                  </label>
                </section>

                <p className="text-xs leading-5 text-slate-400">
                  Preferences are saved in this browser. Notification delivery and recruiter visibility require a connected account service.
                </p>

                <section className="rounded-2xl border border-rose-200 bg-white p-5 sm:p-7">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Sign out</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Securely end your current session on this device.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                    >
                      {loggingOut ? "Signing out..." : "Log out"}
                    </button>
                  </div>
                </section>
              </div>
            ) : activePage === "ID Card" ? (
              <section className="mx-auto max-w-2xl">
                <div className="mb-5 text-sm text-slate-500">
                  Your ID card always reflects the details in your profile.
                </div>
                <article className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-lg shadow-violet-100">
                  <div className="bg-gradient-to-r from-violet-700 to-indigo-600 px-6 py-5 text-white sm:px-8">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
                        EV
                      </div>
                      <div className="min-w-0">
                        <p className="whitespace-nowrap text-lg font-bold">Edu Vacancy</p>
                        <p className="text-xs text-violet-100">Job seeker identity card</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-3xl font-bold text-violet-700">
                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt={`${profile.name} profile`}
                            className="h-full w-full rounded-2xl object-cover"
                          />
                        ) : (
                          profile.name.trim().charAt(0).toUpperCase() || "A"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-2xl font-bold text-slate-900">
                          {profile.name || "Your name"}
                        </p>
                        <p className="mt-1 text-sm text-violet-700">
                          {profile.qualification || "Qualification not provided"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {profile.subject || "Specialization not provided"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-violet-50 px-4 py-3 sm:ml-auto">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">
                          Member ID
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold text-violet-800">
                          EDU-2026-0001
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-2">
                      {[
                        { label: "Experience", value: profile.experience },
                        { label: "Preferred location", value: profile.preferredLocation },
                        { label: "Username", value: `@${profile.username}` },
                        { label: "Phone", value: profile.phone },
                      ].map((item) => (
                        <div key={item.label} className="min-w-0">
                          <p className="text-xs font-medium text-slate-400">{item.label}</p>
                          <p className="mt-1 break-words text-sm font-semibold text-slate-700">
                            {item.value || "Not provided"}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                      <p className="text-xs text-slate-400">
                        Your profile details are stored securely
                      </p>
                      <button
                        type="button"
                        onClick={() => setActivePage("My Profile")}
                        className="rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
                      >
                        Edit profile
                      </button>
                    </div>
                  </div>
                </article>
              </section>
            ) : activePage === "My Profile" ? (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
                  <div className="mb-6 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-2xl font-bold text-violet-700">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt={`${profile.name} profile`}
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        profile.name.trim().charAt(0).toUpperCase() || "A"
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Your professional profile</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Help schools and colleges understand your experience.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={saveProfile}
                    className="grid grid-cols-1 gap-5 sm:grid-cols-2"
                  >
                    {[
                      { key: "name", label: "Full name", type: "text" },
                      { key: "username", label: "Username", type: "text" },
                      { key: "phone", label: "Phone number", type: "tel" },
                      { key: "qualification", label: "Highest qualification", type: "text" },
                      { key: "subject", label: "Subject / Specialization", type: "text" },
                      { key: "experience", label: "Teaching experience", type: "text" },
                      { key: "preferredLocation", label: "Preferred location", type: "text" },
                    ].map((field) => (
                      <div key={field.key} className="min-w-0">
                        <label
                          htmlFor={field.key}
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          {field.label}
                        </label>
                        <input
                          id={field.key}
                          type={field.type}
                          value={profile[field.key as keyof typeof profile]}
                          disabled={field.key === "username"}
                          onChange={(event) =>
                            setProfile((previous) => ({
                              ...previous,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                    ))}

                    <div className="sm:col-span-2">
                      <label htmlFor="bio" className="mb-2 block text-sm font-medium text-slate-700">
                        Professional summary
                      </label>
                      <textarea
                        id="bio"
                        rows={4}
                        value={profile.bio}
                        onChange={(event) =>
                          setProfile((previous) => ({ ...previous, bio: event.target.value }))
                        }
                        className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50 disabled:text-slate-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        disabled={profileSaving}
                        className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-emerald-600"
                      >
                        {profileSaving ? "Saving…" : "Save profile"}
                      </button>
                      <p className="mt-3 text-xs text-slate-500">
                        Your profile is updated on the server and can be edited again at any time.
                      </p>
                    </div>
                  </form>
                </section>

                <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="font-bold">Profile strength</h3>
                  <div className="mt-5 flex items-center gap-4">
                    <div
                      className="flex h-20 w-20 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#7c3aed ${profileCompletion}%, #ede9fe 0)`,
                      }}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-lg font-bold">
                        {profileCompletion}%
                      </div>
                    </div>
                    <div>
                      <p className="font-semibold">
                        {profileCompletion >= 100 ? "Profile complete" : "Keep improving"}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Complete your details to help institutions assess your suitability.
                      </p>
                    </div>
                  </div>
                  <p className="mt-6 border-t border-slate-100 pt-4 text-sm text-slate-500">
                    Add accurate qualifications, experience, and contact details before applying.
                  </p>
                </aside>
              </div>
            ) : (
              <>
                {/* Search panel */}
                <section className="mb-6 rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 p-5 text-white shadow-sm sm:p-7">
                  <div className="max-w-2xl">
                    <h3 className="text-xl font-bold sm:text-2xl">
                      Your next teaching opportunity awaits.
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-violet-100">
                      Discover teaching, faculty, academic, and support roles in educational institutions.
                    </p>
                  </div>

                  <form
                    className="mt-6 grid grid-cols-1 gap-3 rounded-xl bg-white p-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setActivePage("Find Jobs");
                    }}
                  >
                    <label className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 px-3">
                      <span className="text-lg text-slate-400">⌕</span>
                      <input
                        aria-label="Search job titles or institutions"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Job title, subject, or institution"
                        className="min-w-0 flex-1 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </label>

                    <label className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 px-3">
                      <span className="text-slate-400">⌖</span>
                      <input
                        aria-label="Search location"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="City or location"
                        className="min-w-0 flex-1 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                      />
                    </label>

                    <button
                      type="submit"
                      className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Search jobs
                    </button>
                  </form>
                </section>

                {/* Stats */}
                {activePage === "Overview" && (
                  <>
                    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                      {[
                        { label: "Applications sent", value: appliedCount, icon: "↗", color: "bg-blue-50 text-blue-700" },
                        { label: "Under review", value: reviewCount, icon: "◷", color: "bg-amber-50 text-amber-700" },
                        { label: "Shortlisted / interview", value: shortlistedCount, icon: "✓", color: "bg-emerald-50 text-emerald-700" },
                        { label: "Saved jobs", value: savedJobs.length, icon: "♡", color: "bg-violet-50 text-violet-700" },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm text-slate-500">{stat.label}</p>
                            <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${stat.color}`}>
                              {stat.icon}
                            </span>
                          </div>
                          <p className="mt-4 text-3xl font-bold text-slate-900">{stat.value}</p>
                          <p className="mt-1 text-xs text-slate-400">Based on your current activity</p>
                        </div>
                      ))}
                    </section>

                    {/* Application status chart */}
                    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">Application status</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Track the progress of your job applications.
                          </p>
                        </div>
                        <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          All applications
                        </span>
                      </div>

                      <div className="mt-6 space-y-5">
                        {[
                          { label: "Applied", value: appliedCount, color: "bg-blue-500" },
                          { label: "Under review", value: reviewCount, color: "bg-amber-500" },
                          { label: "Shortlisted / interview", value: shortlistedCount, color: "bg-emerald-500" },
                          { label: "Rejected", value: rejectedCount, color: "bg-rose-500" },
                        ].map((item) => (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <span className="text-slate-600">{item.label}</span>
                              <span className="font-semibold text-slate-800">{item.value}</span>
                            </div>
                            <div
                              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
                              role="progressbar"
                              aria-label={item.label}
                              aria-valuemin={0}
                              aria-valuemax={Math.max(appliedCount, 1)}
                              aria-valuenow={item.value}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                                style={{
                                  width: `${Math.min(100, (item.value / Math.max(appliedCount, 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-5 text-xs text-slate-400">
                        Application statuses are supplied and updated by the institution.
                      </p>
                    </section>
                  </>
                )}

                {/* Jobs and side panel */}
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
                  <section className="min-w-0">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">
                          {activePage === "Saved Jobs"
                            ? "Your saved opportunities"
                            : activePage === "My Applications"
                              ? "Your applications"
                              : activePage === "Find Jobs"
                                ? "Available education jobs"
                                : "Jobs picked for you"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {filteredJobs.length} opportunity{filteredJobs.length === 1 ? "" : "ies"} found
                        </p>
                      </div>

                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <select
                          aria-label="Filter by institution type"
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 sm:flex-none"
                        >
                          <option value="All">All institutions</option>
                          <option value="School">Schools</option>
                          <option value="College">Colleges</option>
                        </select>
                        <select
                          aria-label="Sort jobs by posting date"
                          value={sortOrder}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === "recent" || value === "oldest") {
                              setSortOrder(value);
                            }
                          }}
                          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500 sm:flex-none"
                        >
                          <option value="recent">Most recent</option>
                          <option value="oldest">Oldest first</option>
                        </select>
                      </div>
                    </div>
                    {activePage === "My Applications" && (
                      <button
                        type="button"
                        onClick={exportApplications}
                        disabled={applications.length === 0}
                        className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download size={16} aria-hidden="true" />
                        Export applications
                      </button>
                    )}

                    <div className="mb-4 flex flex-wrap gap-2">
                      {["All", "Full-time", "Part-time"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setJobType(type)}
                          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            jobType === type
                              ? "border-violet-600 bg-violet-600 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-violet-300"
                          }`}
                        >
                          {type === "All" ? "All job types" : type}
                        </button>
                      ))}
                    </div>

                    {filteredJobs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                        <div className="text-3xl">⌕</div>
                        <h4 className="mt-3 font-semibold">No jobs found</h4>
                        <p className="mt-2 text-sm text-slate-500">
                          Try a different search term or clear your filters.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setSearch("");
                            setLocation("");
                            setCategory("All");
                            setJobType("All");
                          }}
                          className="mt-4 rounded-lg bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700"
                        >
                          Clear filters
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
                        {filteredJobs.map((job) => {
                          const application = applications.find(
                            (app) => app.jobId === job.id,
                          );
                          const saved = savedJobs.includes(job.id);

                          return (
                            <article
                              key={job.id}
                              className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-violet-200 hover:shadow-md sm:p-6"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${jobColorStyles[job.color]}`}>
                                  {job.category === "School" ? "S" : "C"}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="break-words font-bold text-slate-900">
                                    {job.title}
                                  </h4>
                                  <p className="mt-1 break-words text-sm text-slate-500">
                                    {job.institution}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleSaved(job.id)}
                                  aria-label={saved ? "Remove saved job" : "Save job"}
                                  aria-pressed={saved}
                                  className={`shrink-0 rounded-lg px-2 py-1 text-xl transition hover:bg-violet-50 ${
                                    saved ? "text-violet-600" : "text-slate-400"
                                  }`}
                                >
                                  {saved ? "♥" : "♡"}
                                </button>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                                  {job.category}
                                </span>
                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                  {job.type}
                                </span>
                                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                  {job.experience}
                                </span>
                              </div>

                              <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">
                                {job.description}
                              </p>

                              <div className="mt-4 space-y-2 text-sm text-slate-500">
                                <p className="flex items-start gap-2">
                                  <span>⌖</span>
                                  <span>{job.location}</span>
                                </p>
                                <p className="flex items-start gap-2">
                                  <span>₹</span>
                                  <span>{job.salary}</span>
                                </p>
                              </div>

                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                                <span className="text-xs text-slate-400">
                                  {job.posted}
                                </span>

                                {application ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[application.status]}`}>
                                      {application.status}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => applyToJob(job.id)}
                                    disabled={accountStatus !== "Verified"}
                                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-700"
                                  >
                                    Apply now →
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Right side panel */}
                  <aside className="space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-bold">Your profile</h3>
                        <button
                          type="button"
                          onClick={() => setActivePage("My Profile")}
                          className="text-xs font-semibold text-violet-600 hover:underline"
                        >
                          Edit
                        </button>
                      </div>

                      <div className="mt-5 flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg font-bold text-violet-700">
                          {profilePhoto ? (
                            <img
                              src={profilePhoto}
                              alt=""
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            profile.name.trim().charAt(0).toUpperCase() || "A"
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="break-words font-semibold">{profile.name}</p>
                          <p className="break-words text-xs text-slate-500">
                            {profile.qualification} · {profile.subject}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="text-slate-500">Profile completion</span>
                          <span className="font-semibold text-violet-700">{profileCompletion}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all"
                            style={{ width: `${profileCompletion}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePage("My Profile")}
                        className="mt-5 w-full rounded-xl border border-violet-200 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                      >
                        Complete your profile
                      </button>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="font-bold">Application summary</h3>
                      <p className="mt-1 text-xs text-slate-500">Your current progress</p>

                      <div className="mt-4 space-y-4">
                        {[
                          { label: "Applied", count: appliedCount, color: "bg-blue-500" },
                          { label: "Under review", count: reviewCount, color: "bg-amber-500" },
                          { label: "Shortlisted", count: shortlistedCount, color: "bg-emerald-500" },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                              {item.label}
                            </div>
                            <span className="font-bold">{item.count}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActivePage("My Applications")}
                        className="mt-5 w-full rounded-xl bg-slate-50 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        View applications →
                      </button>
                    </section>

                    <section className="rounded-2xl bg-amber-50 p-5">
                      <p className="font-bold text-amber-900">Career tip</p>
                      <p className="mt-2 text-sm leading-6 text-amber-800">
                        Add your qualifications, teaching certifications, preferred subjects, and experience to make your profile more useful to recruiters.
                      </p>
                    </section>
                  </aside>
                </div>
              </>
            )}

            <footer className="mt-10 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
              Edu Vacancy · Opportunities in schools, colleges, and educational institutions
            </footer>
          </div>

          {/* Mobile navigation */}
          <nav className="sticky bottom-0 z-30 grid grid-cols-7 border-t border-slate-200 bg-white/95 px-0.5 py-2 backdrop-blur lg:hidden">
            {navItems.filter((item) => item.label !== "Settings").map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setActivePage(item.label);
                  setNotice("");
                }}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-[10px] font-medium sm:text-xs ${
                  activePage === item.label
                    ? "text-violet-700"
                    : "text-slate-500"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                <span className="max-w-full truncate">{item.label === "My Applications" ? "Applied" : item.label === "My Profile" ? "Profile" : item.label === "Notifications" ? "Alerts" : item.label === "ID Card" ? "ID" : item.label === "Settings" ? "Settings" : item.label === "Find Jobs" ? "Jobs" : item.label === "Saved Jobs" ? "Saved" : "Home"}</span>
              </button>
            ))}
          </nav>
        </main>
      </div>

      {pikachuOpen && (
        <section
          id="pikachu-chat-panel"
          aria-label="Chat with Pikachu"
          className="fixed bottom-20 right-3 z-40 flex h-[min(34rem,calc(100dvh-7rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 lg:bottom-6 lg:right-6 lg:h-[min(34rem,calc(100dvh-3rem))]"
        >
          <header className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-amber-300 to-yellow-200 px-4 py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-xl text-amber-800 shadow-sm">
              ⚡
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900">Pikachu</h2>
              <p className="text-xs text-slate-700">AI career assistant</p>
            </div>
            <button
              type="button"
              onClick={() => setPikachuOpen(false)}
              aria-label="Close Pikachu chat"
              className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-slate-700 transition hover:bg-white/60"
            >
              ×
            </button>
          </header>

          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4"
          >
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <p
                  className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                    message.role === "user"
                      ? "rounded-br-md bg-violet-600 text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white p-3">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {["Show me jobs", "Improve my profile", "Interview tips"].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendChatMessage(prompt)}
                  className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                sendChatMessage();
              }}
              className="flex items-center gap-2"
            >
              <label className="sr-only" htmlFor="pikachu-chat-input">
                Message Pikachu
              </label>
              <input
                id="pikachu-chat-input"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                placeholder="Ask Pikachu anything..."
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              />
              <button
                type="submit"
                disabled={!chatDraft.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-lg text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                ↑
              </button>
            </form>
          </div>
        </section>
      )}

      {!pikachuOpen && (
        <div className="group fixed bottom-20 right-4 z-40 flex items-center gap-2 lg:hidden">
          <span
            aria-hidden="true"
            className="pointer-events-none rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-800 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            Pikachu
          </span>
          <button
            type="button"
            onClick={() => setPikachuOpen(true)}
            aria-label="Chat with Pikachu"
            className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-amber-300 text-2xl text-amber-950 shadow-lg shadow-amber-900/25 transition hover:scale-105 hover:bg-amber-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            ⚡
          </button>
        </div>
      )}
    </div>
  );
}
