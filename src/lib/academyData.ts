import { supabase } from './supabase';

// Academy tables live in their own Postgres schema, not `public`, so every
// query here goes through .schema('academy').
const academy = () => supabase.schema('academy');

export type AcademyRow = {
  id: string;
  pitch_owner_id: string;
  name: string;
  description: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_active: boolean;
  created_at: string;
};

export type AcademyMember = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  avatar_url: string | null;
  guardian_id: string | null;
};

export type EnrolmentRow = {
  id: string;
  academy_id: string;
  member_id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  member: AcademyMember | null;
};

export async function fetchMyAcademies(): Promise<AcademyRow[]> {
  const { data, error } = await academy()
    .from('academies')
    .select('id, pitch_owner_id, name, description, city, logo_url, cover_url, is_active, created_at')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as AcademyRow[];
}

export async function createAcademy(input: {
  pitchOwnerId: string;
  name: string;
  city?: string | null;
  description?: string | null;
}) {
  return academy()
    .from('academies')
    .insert({
      pitch_owner_id: input.pitchOwnerId,
      name: input.name.trim(),
      city: input.city?.trim() || null,
      description: input.description?.trim() || null,
    });
}

export async function updateAcademy(
  academyId: string,
  fields: Partial<Pick<AcademyRow, 'name' | 'city' | 'description' | 'is_active'>>
) {
  return academy()
    .from('academies')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', academyId);
}

export async function deleteAcademy(academyId: string) {
  return academy().from('academies').delete().eq('id', academyId);
}

/**
 * Enrolment requests for one academy, with the member attached.
 *
 * Members are fetched separately rather than as an embedded join: PostgREST
 * can only embed across a relationship it can see, and RLS narrows the member
 * rows to those enrolled in academies this owner runs.
 */
export async function fetchEnrolments(academyId: string): Promise<EnrolmentRow[]> {
  const { data, error } = await academy()
    .from('enrolments')
    .select('id, academy_id, member_id, status, requested_at')
    .eq('academy_id', academyId)
    .order('requested_at', { ascending: false });

  if (error || !data) return [];

  const rows = data as Omit<EnrolmentRow, 'member'>[];
  const memberIds = rows.map((row) => row.member_id);
  if (memberIds.length === 0) return rows.map((row) => ({ ...row, member: null }));

  const { data: members } = await academy()
    .from('members')
    .select('id, full_name, date_of_birth, avatar_url, guardian_id')
    .in('id', memberIds);

  const byId = new Map<string, AcademyMember>(
    ((members ?? []) as AcademyMember[]).map((m) => [m.id, m])
  );

  return rows.map((row) => ({ ...row, member: byId.get(row.member_id) ?? null }));
}

export async function respondToEnrolment(enrolmentId: string, approve: boolean) {
  return academy()
    .from('enrolments')
    .update({
      status: approve ? 'approved' : 'rejected',
      responded_at: new Date().toISOString(),
    })
    .eq('id', enrolmentId);
}

/** Age in whole years, used to show who is a child at a glance. */
export function ageFromDateOfBirth(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDelta = now.getMonth() - born.getMonth();

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < born.getDate())) {
    age -= 1;
  }

  return age;
}
