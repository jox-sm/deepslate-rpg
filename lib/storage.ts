// lib/storage.ts
import { supabase } from '@/lib/supabase';
import { convertToWebp } from '@/utilities/imagesUtils';
import { retry } from '@/lib/retry';
import { createServiceRoleSupabaseClient } from '@/lib/auth';
import type { ImageUploadOptions } from '@/types/images';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function uploadImage(
  file: Buffer, 
  fileName: string, 
  options?: ImageUploadOptions,
  authenticatedClient?: SupabaseClient
): Promise<string> {
  const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_NAME || 'deepslate-rpg';
  const uniqueName = `${crypto.randomUUID()}-${fileName}`;
  const webpBuffer = await convertToWebp(file);
  const cacheControl = options?.cacheControl || 'public, max-age=31536000'; // Default: 1 year
  
  // Prefer the service-role client for uploads (bypasses RLS, server-only).
  // Falls back to the authenticated/anon client when no service role key is set.
  const client = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceRoleSupabaseClient()
    : (authenticatedClient || supabase);
  
  const uploadOperation = () => 
    client.storage
      .from(bucketName)
      .upload(`games/${uniqueName}`, webpBuffer, {
        contentType: 'image/webp',
        upsert: false,
        cacheControl,
      });

  const { data, error } = await retry(uploadOperation, 3, 500);

  if (error) throw error;

  const getPublicUrlOperation = async () =>
    client.storage
      .from(bucketName)
      .getPublicUrl(data.path);

  const { data: { publicUrl } } = await retry(getPublicUrlOperation, 3, 500);

  return publicUrl;
}