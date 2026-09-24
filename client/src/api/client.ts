import type { TimeEntry, User, SortOption, DateFormat, Tag, BreakRule, DayLabel, DayStatus } from "./types";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function toSearchParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][];
  return new URLSearchParams(entries).toString();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { ApiError };

export const api = {
  setup: {
    status: () => request<{ setupComplete: boolean }>("/setup/status"),
    create: (data: { username: string; password: string; displayName?: string }) =>
      request<{ ok: true }>("/setup", { method: "POST", body: JSON.stringify(data) }),
  },
  auth: {
    login: (username: string, password: string) =>
      request<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
    logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
    me: () => request<{ user: User }>("/auth/me"),
  },
  entries: {
    list: (params: { from?: string; to?: string; q?: string; sort?: SortOption; tagId?: number } = {}) => {
      const search = toSearchParams(params);
      return request<{ entries: TimeEntry[] }>(`/entries${search ? `?${search}` : ""}`);
    },
    todayOpen: () => request<{ entry: TimeEntry | null }>("/entries/today-open"),
    start: () => request<{ entry: TimeEntry }>("/entries/start", { method: "POST" }),
    stop: () => request<{ entry: TimeEntry }>("/entries/stop", { method: "POST" }),
    create: (data: {
      workDate: string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      note?: string;
      tagIds?: number[];
    }) => request<{ entry: TimeEntry }>("/entries", { method: "POST", body: JSON.stringify(data) }),
    update: (
      id: number,
      data: Partial<Pick<TimeEntry, "workDate" | "startTime" | "endTime" | "breakMinutes" | "note">> & {
        tagIds?: number[];
      }
    ) => request<{ entry: TimeEntry }>(`/entries/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: true }>(`/entries/${id}`, { method: "DELETE" }),
    exportCsvUrl: (params: { from?: string; to?: string; q?: string; sort?: SortOption; tagId?: number } = {}) => {
      const search = toSearchParams(params);
      return `/api/entries/export.csv${search ? `?${search}` : ""}`;
    },
  },
  dayLabels: {
    list: (params: { from?: string; to?: string } = {}) => {
      const search = toSearchParams(params);
      return request<{ dayLabels: DayLabel[] }>(`/day-labels${search ? `?${search}` : ""}`);
    },
    set: (workDate: string, status: DayStatus, note?: string) =>
      request<{ dayLabel: DayLabel }>(`/day-labels/${workDate}`, {
        method: "PUT",
        body: JSON.stringify({ status, note }),
      }),
    remove: (workDate: string) => request<{ ok: true }>(`/day-labels/${workDate}`, { method: "DELETE" }),
  },
  tags: {
    list: () => request<{ tags: Tag[] }>("/tags"),
    create: (data: { name: string; color?: string; icon?: string }) =>
      request<{ tag: Tag }>("/tags", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; color?: string; icon?: string }) =>
      request<{ tag: Tag }>(`/tags/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: true }>(`/tags/${id}`, { method: "DELETE" }),
  },
  users: {
    list: () => request<{ users: User[] }>("/users"),
    create: (data: {
      username: string;
      password: string;
      displayName?: string;
      role?: string;
      dailyTargetMinutes?: number | null;
      defaultBreakMinutes?: number;
      breakRules?: BreakRule[] | null;
      sickCountsAsWork?: boolean;
    }) => request<{ user: User }>("/users", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: Record<string, unknown>) =>
      request<{ user: User }>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: true }>(`/users/${id}`, { method: "DELETE" }),
  },
  profile: {
    update: (data: {
      displayName?: string;
      dailyTargetMinutes?: number | null;
      defaultBreakMinutes?: number;
      breakRules?: BreakRule[] | null;
      workDays?: number[];
      dateFormat?: DateFormat;
      sickCountsAsWork?: boolean;
      password?: string;
    }) => request<{ user: User }>("/profile", { method: "PATCH", body: JSON.stringify(data) }),
    getApiToken: () => request<{ apiToken: string | null }>("/profile/api-token"),
    generateApiToken: () => request<{ apiToken: string }>("/profile/api-token", { method: "POST" }),
    revokeApiToken: () => request<{ ok: true }>("/profile/api-token", { method: "DELETE" }),
  },
  settings: {
    get: () => request<{ settings: Record<string, string> }>("/settings"),
    update: (data: Record<string, string>) =>
      request<{ settings: Record<string, string> }>("/settings", { method: "PATCH", body: JSON.stringify(data) }),
  },
};
