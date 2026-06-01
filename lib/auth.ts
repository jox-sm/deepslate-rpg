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
  const config = serviceConfigs[service];
  const token = await getToken({ template: config.templateName });
  
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
  const token = await getServiceToken(getToken, 'supabase');
  
  if (!config.baseUrl || !config.apiKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(config.baseUrl, config.apiKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}