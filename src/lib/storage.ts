import { createClient, SupabaseClient } from "@supabase/supabase-js";

declare global {
  // eslint-disable-next-line no-var
  var __palateStorage: SupabaseClient | undefined;
}

export function adminSupabase(): SupabaseClient {
  if (global.__palateStorage) return global.__palateStorage;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!,
    { auth: { persistSession: false } }
  );
  global.__palateStorage = client;
  return client;
}

const BUCKET = "assets";

/** Upload a buffer to Supabase storage; returns { path, publicUrl }. */
export async function uploadAsset(
  path: string,
  data: Buffer,
  contentType: string
): Promise<{ path: string; publicUrl: string }> {
  const sb = adminSupabase();
  const { error } = await sb.storage.from(BUCKET).upload(path, data, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: pub.publicUrl };
}

export async function downloadAsset(path: string): Promise<Buffer> {
  const sb = adminSupabase();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}
