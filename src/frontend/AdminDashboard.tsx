
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight,
  BadgeCheck, Ban, Bell, BriefcaseBusiness, Building2,
  Check, CheckCircle2, ClipboardCheck,
  Clock, Download, Eye, FileCheck, FileText, Filter,
  GraduationCap, LayoutDashboard, LockKeyhole, LogOut,
  Menu, MessageSquare, Search, Settings, Shield,
  ShieldCheck, UserCheck, UserRound, Users,
  X, XCircle
} from "lucide-react";
import { apiFetch, apiRequest, fetchCurrentAccount } from "../lib/api-config";
import { getSupabaseClient } from "../lib/supabase-config";

type Status =
  | "Pending"
  | "Verified"
  | "Rejected"
  | "Suspended";

type Role = "Institution" | "Job Seeker" | "Admin";

type Account = {
  id: string;
  name: string;
  username: string;
  role: Role;
  organization: string;
  date: string;
  status: Status;
  documents: string[];
  reason?: string;
};

type Vacancy = {
  id: string;
  title: string;
  institution: string;
  type: string;
  location: string;
  status: Status;
  applications: number;
};

type ConnectionStatus = "Pending" | "Approved" | "Blocked";

type Connection = {
  id: string;
  teacher: string;
  institution: string;
  status: ConnectionStatus;
};

type Complaint = {
  id: string;
  subject: string;
  reporter: string;
  status: "Open" | "Resolved" | "Escalated";
};

type AuditEntry = {
  id: string;
  action: string;
  target: string;
  date: string;
};

type AccountRecord = {
  id: string;
  role: "institution" | "job_seeker" | "admin";
  username: string;
  full_name: string;
  status: Status;
  status_reason: string | null;
  created_at: string;
  job_seeker_details: { subject?: string; resume_url?: string | null } | null;
  institution_details: { institution_name?: string } | null;
  institution_certificates: { cert_type: string }[];
};

type VacancyRecord = {
  id: string;
  title: string;
  category: string;
  location: string;
  status: Status;
  institution: { full_name: string } | null;
  applications: { count: number }[];
};

type ConnectionRecord = {
  id: string;
  status: ConnectionStatus;
  teacher: { full_name: string } | null;
  institution: { full_name: string } | null;
};

type ComplaintRecord = {
  id: string;
  subject: string;
  status: Complaint["status"];
  reporter: { full_name: string } | null;
};

type AuditRecord = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
};

type AdminOverview = {
  total_accounts: number;
  pending_accounts: number;
  verified_accounts: number;
  institution_count: number;
  job_seeker_count: number;
  pending_vacancies: number;
};

type AdminData = {
  overview: AdminOverview;
  accounts: Account[];
  vacancies: Vacancy[];
  connections: Connection[];
  complaints: Complaint[];
  audit: AuditEntry[];
};

function mapAdminData(
  overview: AdminOverview,
  accounts: AccountRecord[],
  vacancies: VacancyRecord[],
  connections: ConnectionRecord[],
  complaints: ComplaintRecord[],
  audit: AuditRecord[],
): AdminData {
  return {
    overview,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.full_name,
      username: account.username,
      role: account.role === "institution"
        ? "Institution"
        : account.role === "job_seeker"
          ? "Job Seeker"
          : "Admin",
      organization:
        account.institution_details?.institution_name ??
        account.job_seeker_details?.subject ??
        "",
      date: new Date(account.created_at).toLocaleDateString(),
      status: account.status,
      documents: [
        ...(account.institution_certificates ?? []).map((file) =>
          file.cert_type
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" "),
        ),
        ...(account.job_seeker_details?.resume_url ? ["Resume"] : []),
      ],
      reason: account.status_reason ?? undefined,
    })),
    vacancies: vacancies.map((vacancy) => ({
      id: vacancy.id,
      title: vacancy.title,
      institution: vacancy.institution?.full_name ?? "Unknown institution",
      type: vacancy.category,
      location: vacancy.location,
      status: vacancy.status,
      applications: (vacancy.applications ?? []).reduce(
        (total, relation) => total + relation.count,
        0,
      ),
    })),
    connections: connections.map((connection) => ({
      id: connection.id,
      teacher: connection.teacher?.full_name ?? "Unknown job seeker",
      institution: connection.institution?.full_name ?? "Unknown institution",
      status: connection.status,
    })),
    complaints: complaints.map((complaint) => ({
      id: complaint.id,
      subject: complaint.subject,
      reporter: complaint.reporter?.full_name ?? "Unknown reporter",
      status: complaint.status,
    })),
    audit: audit.map((entry) => ({
      id: entry.id,
      action: entry.action,
      target:
        (typeof entry.details.title === "string" && entry.details.title) ||
        (typeof entry.details.subject === "string" && entry.details.subject) ||
        (typeof entry.details.teacher === "string" && entry.details.teacher) ||
        entry.target_id,
      date: new Date(entry.created_at).toLocaleString(),
    })),
  };
}

async function loadAdminData(accessToken: string): Promise<AdminData> {
  const fetchAll = async <T,>(path: string): Promise<T[]> => {
    const entries: T[] = [];
    for (let offset = 0; ; offset += 100) {
      const page = await apiRequest<T[]>(
        accessToken,
        `${path}?limit=100&offset=${offset}`,
      );
      entries.push(...page);
      if (page.length < 100) return entries;
    }
  };

  const [overview, accounts, vacancies, connections, complaints, audit] =
    await Promise.all([
      apiRequest<AdminOverview>(accessToken, "/api/v1/admin/overview"),
      fetchAll<AccountRecord>("/api/v1/admin/accounts"),
      fetchAll<VacancyRecord>("/api/v1/admin/vacancies"),
      fetchAll<ConnectionRecord>("/api/v1/admin/connections"),
      fetchAll<ComplaintRecord>("/api/v1/admin/complaints"),
      fetchAll<AuditRecord>("/api/v1/admin/audit"),
    ]);
  return mapAdminData(overview, accounts, vacancies, connections, complaints, audit);
}

async function loadAdminVacancies(
  accessToken: string,
): Promise<{ overview: AdminOverview; vacancies: Vacancy[] }> {
  const vacancies: VacancyRecord[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await apiRequest<VacancyRecord[]>(
      accessToken,
      `/api/v1/admin/vacancies?limit=100&offset=${offset}`,
    );
    vacancies.push(...page);
    if (page.length < 100) break;
  }

  const overview = await apiRequest<AdminOverview>(
    accessToken,
    "/api/v1/admin/overview",
  );
  return {
    overview,
    vacancies: mapAdminData(overview, [], vacancies, [], [], []).vacancies,
  };
}

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Approvals", icon: ClipboardCheck },
  { label: "Institutions", icon: Building2 },
  { label: "Job Seekers", icon: GraduationCap },
  { label: "Vacancies", icon: BriefcaseBusiness },
  { label: "Connections", icon: Users },
  { label: "Complaints", icon: MessageSquare },
  { label: "Reports & Audit", icon: FileText },
  { label: "Notifications", icon: Bell },
  { label: "Settings", icon: Settings }
];

const statusColors: Record<Status, string> = {
  Pending: "bg-amber-50 text-amber-700 ring-amber-200",
  Verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Rejected: "bg-rose-50 text-rose-700 ring-rose-200",
  Suspended: "bg-slate-100 text-slate-700 ring-slate-200"
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusColors[status]}`}
    >
      {status === "Verified" && <BadgeCheck size={14} />}
      {status === "Pending" && <Clock size={13} />}
      {status === "Rejected" && <XCircle size={13} />}
      {status === "Suspended" && <Ban size={13} />}
      {status}
    </span>
  );
}

function VerifiedBadge() {
  return (
    <span
      title="This account has passed the platform's verification checks"
      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200"
    >
      <BadgeCheck size={14} />
      Verified
    </span>
  );
}

function Panel({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Metric({
  title,
  value,
  detail,
  icon: Icon,
  color,
  trend
}: {
  title: string;
  value: number;
  detail: string;
  icon: typeof Users;
  color: string;
  trend: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {value.toLocaleString()}
          </p>
        </div>
        <span className={`shrink-0 rounded-xl p-2.5 ${color}`}>
          <Icon size={21} />
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1 text-xs">
        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
          <ArrowUpRight size={14} />
          {trend}
        </span>
        <span className="text-slate-400">{detail}</span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [activePage, setActivePage] = useState("Overview");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterRole, setFilterRole] = useState("All");
  const [selected, setSelected] = useState<Account | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Account | null>(null);
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationRecipient, setNotificationRecipient] = useState("all");
  const [notice, setNotice] = useState("");
  const noticeTimeout = useRef<number | undefined>(undefined);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [overview, setOverview] = useState<AdminOverview>({
    total_accounts: 0,
    pending_accounts: 0,
    verified_accounts: 0,
    institution_count: 0,
    job_seeker_count: 0,
    pending_vacancies: 0,
  });
  const [accessToken, setAccessToken] = useState("");
  const [adminName, setAdminName] = useState("Platform Admin");
  const [adminInitial, setAdminInitial] = useState("A");
  const [apiLoading, setApiLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [vacancyRefreshAttempt, setVacancyRefreshAttempt] = useState(0);
  const [vacancyRefreshing, setVacancyRefreshing] = useState(false);
  const navigate = useNavigate();

  const notify = (message: string) => {
    setNotice(message);
    if (noticeTimeout.current !== undefined) {
      window.clearTimeout(noticeTimeout.current);
    }
    noticeTimeout.current = window.setTimeout(() => {
      setNotice("");
      noticeTimeout.current = undefined;
    }, 3500);
  };

  const applyAdminData = (data: AdminData) => {
    setOverview(data.overview);
    setAccounts(data.accounts);
    setVacancies(data.vacancies);
    setConnections(data.connections);
    setComplaints(data.complaints);
    setAudit(data.audit);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setApiLoading(true);
      setLoadError("");
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          navigate("/admin-login", { replace: true });
          return;
        }

        const account = await fetchCurrentAccount(data.session.access_token);
        if (account.platform_role !== "admin") {
          await supabase.auth.signOut();
          navigate("/admin-login", { replace: true });
          return;
        }

        const dashboard = await loadAdminData(data.session.access_token);
        if (mounted) {
          setAccessToken(data.session.access_token);
          setAdminName(account.profile.full_name);
          setAdminInitial(account.profile.full_name.slice(0, 1).toUpperCase() || "A");
          applyAdminData(dashboard);
        }
      } catch (error: unknown) {
        if (mounted) {
          const message =
            error instanceof Error ? error.message : "Unable to load admin data.";
          setLoadError(message);
          notify(message);
        }
      } finally {
        if (mounted) setApiLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
      if (noticeTimeout.current !== undefined) {
        window.clearTimeout(noticeTimeout.current);
      }
    };
  }, [navigate, reloadAttempt]);

  useEffect(() => {
    if (activePage !== "Vacancies" || !accessToken) return;

    let mounted = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      if (mounted) setVacancyRefreshing(true);
      try {
        const current = await loadAdminVacancies(accessToken);
        if (mounted) {
          setOverview((previous) => ({
            ...previous,
            pending_vacancies: current.overview.pending_vacancies,
          }));
          setVacancies(current.vacancies);
          setLoadError("");
        }
      } catch (error: unknown) {
        if (mounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to refresh the vacancy moderation list.",
          );
        }
      } finally {
        refreshing = false;
        if (mounted) setVacancyRefreshing(false);
      }
    };

    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [accessToken, activePage, vacancyRefreshAttempt]);

  const performAdminAction = async (
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    if (!accessToken) {
      notify("Your administrator session is not available. Please sign in again.");
      return;
    }
    try {
      await action();
      notify(successMessage);
      try {
        applyAdminData(await loadAdminData(accessToken));
        setLoadError("");
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Unable to refresh admin data.";
        setLoadError(`${successMessage} The change was saved, but dashboard refresh failed: ${message}`);
        notify(`${successMessage} The change was saved, but the dashboard could not refresh.`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "The admin action failed.";
      setLoadError(message);
      notify(message);
    }
  };

  const updateAccount = (
    id: string,
    status: Status,
    reason?: string
  ) => {
    const account = accounts.find(item => item.id === id);
    if (!account) return;

    void performAdminAction(
      () => apiRequest(accessToken, `/api/v1/admin/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      }),
      `${account.name}: ${status}`,
    );
    setSelected(null);
    setRejectTarget(null);
    setRejectReason("");
  };

  const updateVacancy = (id: string, status: Status) => {
    const vacancy = vacancies.find(item => item.id === id);
    if (!vacancy) return;

    void performAdminAction(
      () => apiRequest(accessToken, `/api/v1/admin/vacancies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
      `Vacancy "${vacancy.title}" marked ${status.toLowerCase()}.`,
    );
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(account => {
      const matchesSearch = [
        account.name,
        account.username,
        account.organization
      ].join(" ").toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        filterStatus === "All" || account.status === filterStatus;

      const matchesRole =
        filterRole === "All" || account.role === filterRole;

      const matchesPage =
        activePage === "Approvals"
          ? account.status === "Pending"
          : activePage === "Institutions"
            ? account.role === "Institution"
            : activePage === "Job Seekers"
              ? account.role === "Job Seeker"
              : true;

      return matchesSearch && matchesStatus && matchesRole && matchesPage;
    });
  }, [accounts, search, filterStatus, filterRole, activePage]);

  const pendingAccounts = overview.pending_accounts;
  const verifiedAccounts = overview.verified_accounts;
  const institutionCount = overview.institution_count;
  const teacherCount = overview.job_seeker_count;
  const pendingVacancies = overview.pending_vacancies;

  const downloadReport = async () => {
    if (!accessToken) {
      notify("Your administrator session is not available. Please sign in again.");
      return;
    }
    try {
      const response = await apiFetch(
        accessToken,
        "/api/v1/admin/reports/accounts.csv",
      );
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "educareer-accounts.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      applyAdminData(await loadAdminData(accessToken));
      notify("CSV report exported.");
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to export the report.");
    }
  };

  const approveConnection = (id: string, status: ConnectionStatus) => {
    const connection = connections.find(c => c.id === id);
    if (!connection) return;

    void performAdminAction(
      () => apiRequest(accessToken, `/api/v1/admin/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
      `Connection ${status.toLowerCase()}.`,
    );
  };

  const updateComplaint = (complaint: Complaint, status: Complaint["status"]) => {
    void performAdminAction(
      () => apiRequest(accessToken, `/api/v1/admin/complaints/${complaint.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }),
      `Complaint marked ${status.toLowerCase()}.`,
    );
  };

  const sendAdminNotification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) {
      notify("Your administrator session is not available. Please sign in again.");
      return;
    }

    try {
      const result = await apiRequest<{ recipient_count: number }>(
        accessToken,
        "/api/v1/admin/notifications",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: notificationTitle,
            message: notificationMessage,
            recipient_id:
              notificationRecipient === "all" ? null : notificationRecipient,
          }),
        },
      );
      setNotificationTitle("");
      setNotificationMessage("");
      setNotificationRecipient("all");
      notify(`Notification sent to ${result.recipient_count} account${result.recipient_count === 1 ? "" : "s"}.`);
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to send notification.");
    }
  };

  const openEvidence = async (accountId: string, documentName: string) => {
    if (!accessToken) return;
    try {
      const documents = await apiRequest<
        { name: string; url: string; expires_in: number }[]
      >(accessToken, `/api/v1/admin/accounts/${accountId}/documents`);
      const selectedDocument = documents.find((item) => item.name === documentName);
      if (!selectedDocument) {
        notify("A secure link is not available for this document.");
        return;
      }
      const link = window.document.createElement("a");
      link.href = selectedDocument.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: unknown) {
      notify(error instanceof Error ? error.message : "Unable to open the document.");
    }
  };

  const signOut = async () => {
    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      notify(error.message);
      return;
    }
    navigate("/admin-login", { replace: true });
  };

  const pageTitle = activePage === "Overview"
    ? "Platform Overview"
    : activePage;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-4 z-[100] flex max-w-sm items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          <CheckCircle2 size={19} className="text-emerald-400" />
          {notice}
          <button onClick={() => setNotice("")} aria-label="Dismiss notification">
            <X size={17} />
          </button>
        </div>
      )}

      <div className="flex min-h-screen">
        {mobileMenu && (
          <button
            aria-label="Close navigation overlay"
            onClick={() => setMobileMenu(false)}
            className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          />
        )}

        <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
          mobileMenu ? "translate-x-0" : "-translate-x-full"
        }`}>
          <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-5 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500 shadow-lg shadow-violet-950/30">
              <ShieldCheck size={23} />
            </div>
            <div className="min-w-0 flex-1">
              <div role="heading" aria-level={1} className="whitespace-nowrap text-base font-bold leading-5 tracking-tight text-white">
                EduVacancy
              </div>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">Platform administration</p>
            </div>
            <button
              onClick={() => setMobileMenu(false)}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 lg:hidden"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Main menu
            </p>
            <nav className="space-y-1" aria-label="Admin navigation">
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = activePage === item.label;
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setActivePage(item.label);
                      setSearch("");
                      setFilterStatus("All");
                      setFilterRole("All");
                      setMobileMenu(false);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      isActive
                        ? "bg-violet-600 font-semibold text-white shadow-md shadow-violet-950/30 ring-1 ring-inset ring-white/10"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.label === "Approvals" && pendingAccounts > 0 && (
                      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">
                        {pendingAccounts}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="shrink-0 border-t border-white/10 p-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 font-bold text-white">
                {adminInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{adminName}</p>
                <p className="text-xs text-slate-400">Administrator</p>
              </div>
              <Shield size={17} className="shrink-0 text-emerald-400" />
            </div>
            <button
              onClick={() => void signOut()}
              className="mt-3 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <LogOut size={17} className="shrink-0" /> Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileMenu(true)}
                className="rounded-lg p-2 hover:bg-slate-100 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-400">
                  Admin / {activePage}
                </p>
                <h2 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {pageTitle}
                </h2>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <span className="hidden text-sm text-slate-500 sm:block">
                School & College Recruitment
              </span>
              <button
                onClick={() => {
                  setActivePage("Approvals");
                  setFilterStatus("All");
                  setSearch("");
                }}
                className="relative rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50"
                aria-label="View pending approvals"
              >
                <Bell size={19} />
                {pendingAccounts > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {pendingAccounts}
                  </span>
                )}
              </button>
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-violet-100 font-bold text-violet-700 sm:flex">
                {adminInitial}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
            {apiLoading && (
              <p role="status" className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                Loading current platform data...
              </p>
            )}
            {!apiLoading && loadError && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <p>{loadError}</p>
                <button
                  onClick={() => setReloadAttempt((attempt) => attempt + 1)}
                  className="rounded-lg border border-rose-300 bg-white px-3 py-2 font-semibold hover:bg-rose-100"
                >
                  Retry loading
                </button>
              </div>
            )}
            {activePage === "Overview" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      Welcome back, Administrator
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Monitor registrations, verification and recruitment activity.
                    </p>
                  </div>
                  <button
                    onClick={downloadReport}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                  >
                    <Download size={17} /> Export report
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric title="Total Accounts" value={overview.total_accounts} detail="All registered accounts" icon={Users} color="bg-violet-50 text-violet-600" trend="Platform total" />
                  <Metric title="Pending Reviews" value={pendingAccounts} detail="Require admin review" icon={Clock} color="bg-amber-50 text-amber-600" trend="Action needed" />
                  <Metric title="Verified Accounts" value={verifiedAccounts} detail="Approved accounts" icon={BadgeCheck} color="bg-emerald-50 text-emerald-600" trend="Approved" />
                  <Metric title="Pending Vacancies" value={pendingVacancies} detail="Awaiting moderation" icon={BriefcaseBusiness} color="bg-blue-50 text-blue-600" trend="Review needed" />
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <Panel
                      title="Registration overview"
                      subtitle="Live account distribution by role"
                    >
                      <div className="grid gap-7 sm:grid-cols-2">
                        <div className="space-y-5">
                          {[
                            { label: "Institutions", value: institutionCount, color: "bg-violet-500" },
                            { label: "Job seekers", value: teacherCount, color: "bg-blue-500" },
                            { label: "Administrators", value: Math.max(0, overview.total_accounts - institutionCount - teacherCount), color: "bg-amber-500" }
                          ].map(item => {
                            const percent = overview.total_accounts
                              ? Math.round(item.value / overview.total_accounts * 100)
                              : 0;
                            return (
                              <div key={item.label}>
                                <div className="mb-2 flex justify-between text-sm">
                                  <span className="font-medium text-slate-600">{item.label}</span>
                                  <span className="font-bold text-slate-900">{item.value} ({percent}%)</span>
                                </div>
                                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className={`h-full rounded-full ${item.color} transition-all`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-col justify-center rounded-2xl bg-slate-50 p-5">
                          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <Activity size={18} className="text-violet-600" />
                            Verification health
                          </div>
                          <p className="text-4xl font-bold text-slate-900">
                            {overview.total_accounts
                              ? Math.round(verifiedAccounts / overview.total_accounts * 100)
                              : 0}%
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Of accounts are verified
                          </p>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <StatusBadge status="Verified" />
                            <StatusBadge status="Pending" />
                          </div>
                          <p className="mt-4 text-xs leading-5 text-slate-400">
                            Counts update from the platform database.
                          </p>
                        </div>
                      </div>
                    </Panel>
                  </div>

                  <Panel title="Quick actions" subtitle="Common administration tasks">
                    <div className="space-y-3">
                      {[
                        { title: "Review new users", sub: `${pendingAccounts} awaiting review`, icon: UserCheck, page: "Approvals" },
                        { title: "Verify institutions", sub: "Review school and college records", icon: Building2, page: "Institutions" },
                        { title: "Moderate vacancies", sub: `${pendingVacancies} awaiting approval`, icon: BriefcaseBusiness, page: "Vacancies" },
                        { title: "Manage connections", sub: "Control recruitment contacts", icon: Users, page: "Connections" }
                      ].map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.title}
                            onClick={() => setActivePage(item.page)}
                            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/50"
                          >
                            <span className="rounded-lg bg-violet-50 p-2.5 text-violet-600">
                              <Icon size={19} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-slate-800">{item.title}</span>
                              <span className="mt-1 block text-xs text-slate-500">{item.sub}</span>
                            </span>
                            <ArrowUpRight size={17} className="text-slate-400" />
                          </button>
                        );
                      })}
                    </div>
                  </Panel>
                </div>

                <Panel
                  title="Recent registration requests"
                  subtitle="Accounts that need review"
                  action={
                    <button
                      onClick={() => setActivePage("Approvals")}
                      className="text-sm font-semibold text-violet-600 hover:text-violet-800"
                    >
                      View all
                    </button>
                  }
                >
                  <AccountTable
                    accounts={accounts.filter(a => a.status === "Pending").slice(0, 4)}
                    onView={setSelected}
                  />
                </Panel>
              </>
            )}

            {[
              "Approvals", "Institutions", "Job Seekers"
            ].includes(activePage) && (
              <Panel
                title={
                  activePage === "Approvals"
                    ? "Registration approval queue"
                    : activePage === "Institutions"
                      ? "Institution management"
                      : "Job seeker management"
                }
                subtitle="Search accounts, inspect submitted evidence, and record moderation decisions."
                action={
                  <span className="rounded-lg bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
                    {filteredAccounts.length} accounts
                  </span>
                }
              >
                <div className={`mb-5 grid gap-3 ${activePage === "Approvals" ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
                  <div className="relative sm:col-span-1">
                    <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search name or username..."
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                  {activePage !== "Approvals" && (
                    <select
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                    >
                      {["All", "Pending", "Verified", "Rejected", "Suspended"].map(s => (
                        <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>
                      ))}
                    </select>
                  )}
                  <select
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  >
                    {["All", "Institution", "Job Seeker"].map(r => (
                      <option key={r} value={r}>{r === "All" ? "All roles" : r}</option>
                    ))}
                  </select>
                </div>
                <AccountTable accounts={filteredAccounts} onView={setSelected} />
              </Panel>
            )}

            {activePage === "Vacancies" && (
              <Panel
                title="Vacancy moderation"
                subtitle="Only approved institution accounts should publish active vacancies."
                action={
                  <button
                    type="button"
                    disabled={vacancyRefreshing}
                    onClick={() =>
                      setVacancyRefreshAttempt((attempt) => attempt + 1)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    <Activity
                      size={16}
                      className={vacancyRefreshing ? "animate-spin" : ""}
                    />
                    {vacancyRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                }
              >
                <div className="space-y-4">
                  {vacancies.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                      No vacancies have been submitted for review yet.
                    </p>
                  )}
                  {vacancies.map(vacancy => (
                    <div key={vacancy.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 lg:flex-row lg:items-center">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <div className="h-fit rounded-xl bg-blue-50 p-3 text-blue-600">
                          <BriefcaseBusiness size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900">{vacancy.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{vacancy.institution}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {vacancy.type} · {vacancy.location} · {vacancy.applications} applications
                          </p>
                          <div className="mt-2"><StatusBadge status={vacancy.status} /></div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={vacancy.status === "Verified"}
                          onClick={() => updateVacancy(vacancy.id, "Verified")}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Check size={15} /> Approve
                        </button>
                        <button
                          disabled={vacancy.status === "Rejected"}
                          onClick={() => updateVacancy(vacancy.id, "Rejected")}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                        >
                          <X size={15} /> Reject
                        </button>
                        <button
                          disabled={vacancy.status === "Suspended"}
                          onClick={() => updateVacancy(vacancy.id, "Suspended")}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                        >
                          <Ban size={15} /> Suspend
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {activePage === "Connections" && (
              <Panel
                title="Recruitment connection control"
                subtitle="Review and moderate contact requests between teachers and institutions."
              >
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <LockKeyhole size={20} className="mt-0.5 shrink-0" />
                  <p>
                    Production rule: allow connections only when both accounts are verified, neither is suspended, and the institution has an approved vacancy.
                  </p>
                </div>
                <div className="space-y-3">
                  {connections.map(connection => (
                    <div key={connection.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{connection.teacher}</p>
                        <p className="my-1 text-xs text-slate-400">wants to connect with</p>
                        <p className="text-sm text-slate-600">{connection.institution}</p>
                        <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                          connection.status === "Approved"
                            ? "bg-emerald-50 text-emerald-700"
                            : connection.status === "Blocked"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}>
                          {connection.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={
                            connection.status === "Approved"
                          }
                          onClick={() => approveConnection(connection.id, "Approved")}
                          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          disabled={connection.status === "Blocked"}
                          onClick={() => approveConnection(connection.id, "Blocked")}
                          className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
                        >
                          Block
                        </button>
                        <button
                          disabled={connection.status === "Pending"}
                          onClick={() => approveConnection(connection.id, "Pending")}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
                        >
                          Reopen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {activePage === "Complaints" && (
              <Panel title="Complaints and reports" subtitle="Review reported accounts, institutions, and teaching vacancies.">
                <div className="space-y-3">
                  {complaints.map(complaint => (
                    <div key={complaint.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div className="rounded-xl bg-rose-50 p-3 text-rose-600">
                        <AlertTriangle size={21} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{complaint.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">Reported by: {complaint.reporter}</p>
                        <p className="mt-1 text-xs text-amber-600">{complaint.status}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateComplaint(complaint, "Resolved")}
                          disabled={complaint.status === "Resolved"}
                          className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-40"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => updateComplaint(complaint, "Escalated")}
                          disabled={complaint.status === "Escalated"}
                          className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
                        >
                          Escalate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {activePage === "Reports & Audit" && (
              <div className="space-y-6">
                <Panel
                  title="Export account report"
                  subtitle="Download the current account list in CSV format."
                  action={
                    <button
                      onClick={downloadReport}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      <Download size={17} /> Export CSV
                    </button>
                  }
                >
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Institutions</p>
                      <p className="mt-2 text-2xl font-bold">{institutionCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Job seekers</p>
                      <p className="mt-2 text-2xl font-bold">{teacherCount}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-500">Pending reviews</p>
                      <p className="mt-2 text-2xl font-bold">{pendingAccounts}</p>
                    </div>
                  </div>
                </Panel>

                <Panel title="Admin audit log" subtitle="Moderation actions and exports from the platform audit trail.">
                  {audit.length === 0 ? (
                    <div className="py-10 text-center">
                      <FileCheck className="mx-auto text-slate-300" size={36} />
                      <p className="mt-3 font-semibold">No actions recorded yet</p>
                      <p className="mt-1 text-sm text-slate-500">Approvals and moderation decisions will appear here.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[550px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Action</th>
                            <th className="px-4 py-3">Target</th>
                            <th className="px-4 py-3">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {audit.map(entry => (
                            <tr key={entry.id}>
                              <td className="px-4 py-3 font-semibold">{entry.action}</td>
                              <td className="px-4 py-3">{entry.target}</td>
                              <td className="px-4 py-3 text-slate-500">{entry.date}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </div>
            )}

            {activePage === "Notifications" && (
              <Panel
                title="Send in-app notification"
                subtitle="Messages appear in the recipient's dashboard inbox when they next sign in."
              >
                <form onSubmit={sendAdminNotification} className="max-w-3xl space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Recipient
                    </span>
                    <select
                      value={notificationRecipient}
                      onChange={(event) => setNotificationRecipient(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    >
                      <option value="all">All registered accounts ({accounts.length})</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} (@{account.username})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Title
                    </span>
                    <input
                      value={notificationTitle}
                      onChange={(event) => setNotificationTitle(event.target.value)}
                      maxLength={120}
                      required
                      placeholder="Important account update"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      Message
                    </span>
                    <textarea
                      value={notificationMessage}
                      onChange={(event) => setNotificationMessage(event.target.value)}
                      maxLength={2000}
                      required
                      rows={6}
                      placeholder="Write the update users should see in their dashboard inbox."
                      className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                    />
                    <span className="mt-1 block text-right text-xs text-slate-400">
                      {notificationMessage.length}/2000
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    <Bell size={17} /> Send notification
                  </button>
                </form>
              </Panel>
            )}

            {activePage === "Settings" && (
              <Panel title="Platform settings" subtitle="Configuration checklist for the production admin platform.">
                <div className="space-y-4">
                  {[
                    ["Account verification", "Require manual review of identity and institution evidence."],
                    ["Recruitment permissions", "Only verified institutions can publish vacancies."],
                    ["Teacher contact permissions", "Only eligible, verified users can establish connections."],
                    ["Security", "Require secure administrator authentication and role-based access control."],
                    ["Audit trail", "Record administrator identity, timestamp, target, reason, and result for every action."],
                    ["Notifications", "Notify users when their registration or vacancy status changes."]
                  ].map(([title, description]) => (
                    <div key={title} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
                      <ShieldCheck size={20} className="mt-0.5 shrink-0 text-violet-600" />
                      <div>
                        <p className="font-semibold">{title}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
                      </div>
                    </div>
                  ))}
                  <p className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                    Account and recruitment moderation rules are enforced by FastAPI. Configure a notification provider separately if users should receive status updates.
                  </p>
                </div>
              </Panel>
            )}

            <footer className="flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs text-slate-400 sm:flex-row">
              <p>EduVacancy Admin · School & College Recruitment</p>
              <p>Live data · Secured by Supabase Auth and FastAPI</p>
            </footer>
          </div>
        </main>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={e => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-dialog-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
                  Account verification
                </p>
                <h2 id="account-dialog-title" className="mt-2 text-xl font-bold text-slate-900">
                  {selected.name}
                </h2>
                <p className="mt-1 break-all text-sm text-slate-500">@{selected.username}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close account details"
                className="rounded-lg p-2 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Account role</p>
                  <p className="mt-1 font-semibold">{selected.role}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Current status</p>
                  <div className="mt-2"><StatusBadge status={selected.status} /></div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Position / institution type</p>
                <p className="rounded-xl border border-slate-200 p-3 text-sm">{selected.organization}</p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Submitted evidence</p>
                  <span className="text-xs text-slate-400">{selected.documents.length} items</span>
                </div>
                {selected.documents.length ? (
                  <div className="space-y-2">
                    {selected.documents.map(document => (
                      <div key={document} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                        <FileCheck size={19} className="shrink-0 text-violet-600" />
                        <span className="flex-1 text-sm">{document}</span>
                        <button
                          onClick={() => void openEvidence(selected.id, document)}
                          className="text-xs font-semibold text-violet-700 hover:underline"
                        >
                          Open securely
                        </button>
                      </div>
                    ))}
                    <p className="text-xs leading-5 text-amber-700">
                      Private files are opened with short-lived links after the administrator is authorized.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
                    No evidence submitted. Request documents before approving this account.
                  </div>
                )}
              </div>

              {selected.reason && (
                <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  Previous decision reason: {selected.reason}
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
                <button
                  disabled={
                    (selected.role === "Institution" && selected.documents.length === 0) ||
                    selected.status === "Verified"
                  }
                  onClick={() => updateAccount(selected.id, "Verified")}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Check size={17} /> Verify account
                </button>
                <button
                  onClick={() => {
                    setRejectTarget(selected);
                    setSelected(null);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <X size={17} /> Reject
                </button>
                <button
                  disabled={selected.status === "Suspended"}
                  onClick={() => updateAccount(selected.id, "Suspended", "Suspended by administrator")}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                >
                  <Ban size={17} /> Suspend
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold">Reject account request</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Explain the reason for rejecting {rejectTarget.name}. This reason will be recorded with the decision.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="For example: institution documents could not be verified..."
              rows={4}
              className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={!rejectReason.trim()}
                onClick={() => updateAccount(rejectTarget.id, "Rejected", rejectReason.trim())}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountTable({
  accounts,
  onView
}: {
  accounts: Account[];
  onView: (account: Account) => void;
}) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
        <Filter size={30} className="mx-auto text-slate-300" />
        <p className="mt-3 font-semibold text-slate-700">No matching accounts</p>
        <p className="mt-1 text-sm text-slate-500">
          Try changing your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Account</th>
            <th className="px-4 py-3 font-semibold">Role</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Registered</th>
            <th className="px-4 py-3 font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {accounts.map(account => (
            <tr key={account.id} className="transition hover:bg-slate-50/80">
              <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                    {account.role === "Institution"
                      ? <Building2 size={19} />
                      : <UserRound size={19} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{account.name}</p>
                    <p className="mt-1 max-w-56 truncate text-xs text-slate-500">@{account.username}</p>
                    <p className="mt-1 max-w-56 truncate text-xs text-slate-400">{account.organization}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-slate-600">{account.role}</td>
              <td className="px-4 py-4">
                <div className="space-y-1">
                  <StatusBadge status={account.status} />
                  {account.status === "Verified" && <VerifiedBadge />}
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-4 text-slate-500">{account.date}</td>
              <td className="px-4 py-4">
                <button
                  onClick={() => onView(account)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                >
                  <Eye size={15} /> Review
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
