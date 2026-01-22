import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = 'samus-storage';
const PREFIX = process.env.NEXT_PUBLIC_STORAGE_PREFIX || 'default';

export async function uploadFile(file: File, path: string): Promise<string> {
  const fullPath = `${PREFIX}/${path}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fullPath, file, { upsert: true });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(fullPath).data.publicUrl;
}

export async function deleteFile(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([`${PREFIX}/${path}`]);
  if (error) throw error;
}

export function getPublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(`${PREFIX}/${path}`).data.publicUrl;
}
