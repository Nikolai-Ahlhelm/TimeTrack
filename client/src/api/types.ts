export type Role = "admin" | "user";

export const DATE_FORMATS = ["YYYY-MM-DD", "DD.MM.YYYY", "DD/MM/YYYY", "MM/DD/YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface BreakRule {
  afterMinutes: number;
  breakMinutes: number;
}

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: Role;
  dailyTargetMinutes: number | null;
  defaultBreakMinutes: number;
  breakRules: BreakRule[] | null;
  workDays: number[];
  dateFormat: DateFormat;
  sickCountsAsWork: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  icon: string | null;
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
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export type SortOption = "date_desc" | "date_asc" | "hours_desc" | "hours_asc";

export type DayStatus = "sick" | "vacation";

export interface DayLabel {
  id: number;
  workDate: string;
  status: DayStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}
