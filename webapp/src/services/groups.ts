import { supabase } from '../lib/supabaseClient';

export type MyGroup = {
  group_id: string;
  name: string;
  role: 'leader' | 'member';
  status: 'pending' | 'approved' | 'archived';
};

export async function listMyGroups(): Promise<MyGroup[]> {
  const { data, error } = await supabase.rpc('list_my_groups');
  if (error) throw new Error(error.message);
  return (data ?? []) as MyGroup[];
}
