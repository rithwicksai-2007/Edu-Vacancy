export type CurrentAccount = {
  id: string;
  username: string;
  platform_role: string | null;
  profile: {
    id: string;
    role: "job_seeker" | "institution" | "admin";
    username: string;
    full_name: string;
    phone: string;
    status: "Pending" | "Verified" | "Rejected" | "Suspended";
    status_reason: string | null;
    created_at: string;
  };
};

export type InAppNotification = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
};

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL?.trim() || "http://127.0.0.1:8000").replace(
    /\/+$/,
    "",
  );

export async function fetchCurrentAccount(
  accessToken: string,
): Promise<CurrentAccount> {
  return apiRequest<CurrentAccount>(accessToken, "/api/v1/auth/me");
}

export async function apiRequest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await apiFetch(accessToken, path, init);
  if (response.status === 204) return undefined as T;
  const result: unknown = await response.json();

  return result as T;
}

export async function apiPublicRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the EduVacancy API at ${apiBaseUrl}. Start the backend and check VITE_API_BASE_URL.`,
        { cause: error },
      );
    }
    throw error;
  }

  if (response.status === 204) return undefined as T;
  const result: unknown = await response.json();
  if (!response.ok) {
    const detail =
      typeof result === "object" &&
      result !== null &&
      "detail" in result &&
      typeof result.detail === "string"
        ? result.detail
        : `The API request failed with status ${response.status}.`;
    throw new Error(detail);
  }
  return result as T;
}

export async function apiRequestAllPages<T>(
  accessToken: string,
  path: string,
  pageSize = 100,
): Promise<T[]> {
  const entries: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const separator = path.includes("?") ? "&" : "?";
    const page = await apiRequest<T[]>(
      accessToken,
      `${path}${separator}limit=${pageSize}&offset=${offset}`,
    );
    entries.push(...page);
    if (page.length < pageSize) return entries;
  }
}

export async function apiFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    });
  } catch (error: unknown) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the EduVacancy API at ${apiBaseUrl}. Start the backend and check VITE_API_BASE_URL.`,
        { cause: error },
      );
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    let result: unknown;
    try {
      result = body ? JSON.parse(body) : null;
    } catch {
      result = null;
    }
    const detail =
      typeof result === "object" &&
      result !== null &&
      "detail" in result &&
      typeof result.detail === "string"
        ? result.detail
        : `The API request failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return response;
}
