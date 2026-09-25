import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export interface DoctorLite {
  id: string;
  name: string;
  active?: boolean | null;
}

export interface RawAssignment {
  date: string;
  doctor_id?: string | null;
  doctor_name?: string | null;
}

export interface CleanAssignment {
  date: string;
  doctor_id: string;
  weekday_name: string;
  is_weekend: boolean;
  week_index: number;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const normalizeLastName = (name: string) => {
  const cleaned = name
    .toLowerCase()
    .replace(/\bdr\.?\s*/g, "")
    .replace(/[^a-z\s-]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
};

/** Returns the doctor id for a name by exact normalized last name, or an error string. */
export function matchDoctor(name: string, doctors: DoctorLite[]): { id?: string; error?: string } {
  const key = normalizeLastName(name ?? "");
  if (!key) return { error: `Empty doctor name` };
  const matches = doctors.filter((d) => normalizeLastName(d.name) === key);
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) return { error: `No doctor matches "${name}"` };
  return { error: `"${name}" matches more than one doctor` };
}

const toDateStr = (raw: string) => {
  const s = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
};

/**
 * Validates a proposed schedule for a block. Every day must be covered exactly once
 * by an active doctor. Derived fields are recomputed from the date.
 */
export function validateAssignments(
  raw: RawAssignment[],
  doctors: DoctorLite[],
  blockStart: string,
  blockEnd: string,
): { rows: CleanAssignment[]; errors: string[] } {
  const errors: string[] = [];
  const activeDoctors = doctors.filter((d) => d.active !== false);
  const activeIds = new Set(activeDoctors.map((d) => d.id));
  const start = parseISO(blockStart);
  const end = parseISO(blockEnd);
  const seen = new Map<string, CleanAssignment>();

  for (const r of raw) {
    const date = toDateStr(r.date);
    if (!date) {
      errors.push(`Invalid date "${r.date}"`);
      continue;
    }
    const d = parseISO(date);
    if (d < start || d > end) {
      errors.push(`${date} is outside the block (${blockStart} to ${blockEnd})`);
      continue;
    }
    let doctorId = r.doctor_id ?? undefined;
    if (!doctorId) {
      const m = matchDoctor(r.doctor_name ?? "", activeDoctors);
      if (m.error) {
        errors.push(`${date}: ${m.error}`);
        continue;
      }
      doctorId = m.id;
    }
    if (!doctorId || !activeIds.has(doctorId)) {
      errors.push(`${date}: doctor is not an active doctor`);
      continue;
    }
    if (seen.has(date)) {
      errors.push(`${date} is assigned more than once`);
      continue;
    }
    const dow = d.getDay();
    seen.set(date, {
      date,
      doctor_id: doctorId,
      weekday_name: WEEKDAYS[dow],
      is_weekend: dow === 0 || dow === 5 || dow === 6,
      week_index: Math.floor(differenceInCalendarDays(d, start) / 7) + 1,
    });
  }

  for (let d = start; d <= end; d = addDays(d, 1)) {
    const key = format(d, "yyyy-MM-dd");
    if (!seen.has(key)) errors.push(`${key} has no doctor assigned`);
  }

  const rows = [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, errors };
}
