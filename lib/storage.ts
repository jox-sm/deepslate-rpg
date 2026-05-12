// lib/storage.ts
import { supabase } from '@/lib/supabase';

export async function uploadImage(file: Buffer, fileName: string): Promise<string> {
  const uniqueName = `${crypto.randomUUID()}-${fileName}`;
  const { data, error } = await supabase.storage
    .from('deepslate-rpg')
    .upload(`games/${uniqueName}`, file, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('deepslate-rpg')
    .getPublicUrl(data.path);

  return publicUrl;
}