export type Role = "admin" | "user";

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  display_name: string;
  role: Role;
  daily_target_minutes: number | null;
  default_break_minutes: number;
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
  createdAt: string;
  updatedAt: string;
}

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    dailyTargetMinutes: row.daily_target_minutes,
    defaultBreakMinutes: row.default_break_minutes,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function toPublicEntry(row: TimeEntryRow): PublicTimeEntry {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
