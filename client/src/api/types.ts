export type Role = "admin" | "user";

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  dailyTargetMinutes: number | null;
  defaultBreakMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  userId: number;
  workDate: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  note: string | null;
  totalMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export type SortOption = "date_desc" | "date_asc" | "hours_desc" | "hours_asc";
