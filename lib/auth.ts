// lib/auth.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types
export type ServiceName = 'supabase';

export interface ServiceConfig {
  templateName: string;
  baseUrl?: string;
  apiKey?: string;
}

// Service configurations
const serviceConfigs: Record<ServiceName, ServiceConfig> = {
  supabase: {
    templateName: 'supabase',
    baseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    apiKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
};

// Get token for a specific service
export async function getServiceToken(
  getToken: (options?: { template?: string }) => Promise<string | null>,
  service: ServiceName
): Promise<string> {
  // Use the Clerk session token (native Clerk<->Supabase integration).
  // The native integration injects the `role: "authenticated"` claim into the
  // session token, so no JWT template is required.
  const token = await getToken();
   
  if (!token) {
    throw new Error(`Not authenticated - could not get ${service} token`);
  }
  
  return token;
}

// Create authenticated Supabase client
export async function createAuthenticatedSupabaseClient(
  getToken: (options?: { template?: string }) => Promise<string | null>
): Promise<SupabaseClient> {
  const config = serviceConfigs.supabase;

  if (!config.baseUrl || !config.apiKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Use the accessToken option so supabase-js itself attaches the Clerk
  // session token on every request. A static global Authorization header gets
  // overridden by supabase-js's own auth header when no Supabase session
  // exists, which made every request look anonymous to Supabase.
  return createClient(config.baseUrl, config.apiKey, {
    accessToken: async () => {
      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated - could not get supabase token');
      }
      return token;
    },
  });
}

// Create a service-role Supabase client (server-only, bypasses RLS).
// Used for privileged server-side operations such as image uploads, so that
// writes don't depend on a per-user Clerk->Supabase JWT trust relationship.
export function createServiceRoleSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role environment variables');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}