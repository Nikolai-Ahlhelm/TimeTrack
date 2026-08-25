import { parseBreakRules, type BreakRule } from "./lib/breakRules.js";

export type Role = "admin" | "user";
export type { BreakRule };

// Supported date display formats, keyed by the token string stored in the DB.
export const DATE_FORMATS = ["YYYY-MM-DD", "DD.MM.YYYY", "DD/MM/YYYY", "MM/DD/YYYY"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: Role;
  daily_target_minutes: number | null;
  default_break_minutes: number;
  break_rules: string | null;
  work_days: string;
  date_format: string;
  sick_counts_as_work: number;
  is_active: number;
  created_at: string;
}

export interface PublicUser {
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

export interface TimeEntryRow {
  id: number;
  user_id: number;
  work_date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicTimeEntry {
  id: number;
  userId: number;
  workDate: string;
  startTime: string;
  endTime: string | null;
  breakMinutes: number;
  note: string | null;
  totalMinutes: number | null;
  tags: PublicTag[];
  createdAt: string;
  updatedAt: string;
}

export interface TagRow {
  id: number;
  user_id: number;
  name: string;
  color: string;
  icon: string | null;
  created_at: string;
}

export interface PublicTag {
  id: number;
  name: string;
  color: string;
  icon: string | null;
  createdAt: string;
}

export type DayStatus = "sick" | "vacation";
export const DAY_STATUSES: DayStatus[] = ["sick", "vacation"];

export interface DayLabelRow {
  id: number;
  user_id: number;
  work_date: string;
  status: DayStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicDayLabel {
  id: number;
  workDate: string;
  status: DayStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toPublicDayLabel(row: DayLabelRow): PublicDayLabel {
  return {
    id: row.id,
    workDate: row.work_date,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicTag(row: TagRow): PublicTag {
  return {
    icon: row.icon,
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    dailyTargetMinutes: row.daily_target_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    breakRules: parseBreakRules(row.break_rules),
    workDays: row.work_days
      .split(",")
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
    dateFormat: (DATE_FORMATS as readonly string[]).includes(row.date_format)
      ? (row.date_format as DateFormat)
      : "YYYY-MM-DD",
    sickCountsAsWork: row.sick_counts_as_work === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function toPublicEntry(row: TimeEntryRow, tags: PublicTag[] = []): PublicTimeEntry {
  const totalMinutes = row.end_time
    ? Math.max(
        0,
        Math.round((new Date(row.end_time).getTime() - new Date(row.start_time).getTime()) / 60000) -
          row.break_minutes
      )
    : null;
  return {
    id: row.id,
    userId: row.user_id,
    workDate: row.work_date,
    startTime: row.start_time,
    endTime: row.end_time,
    breakMinutes: row.break_minutes,
    note: row.note,
    totalMinutes,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
