// hooks/useAuth.ts
"use client";

import { useAuth as useClerkAuth } from '@clerk/nextjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useState, useEffect, useCallback } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export interface AuthState {
  supabase: SupabaseClient | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const { getToken, isLoaded, isSignedIn } = useClerkAuth();
  const [state, setState] = useState<AuthState>({
    supabase: null,
    isLoading: true,
    error: null,
  });

  const createClients = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Get Supabase token
      const supabaseToken = await getToken({ template: 'supabase' });
      const supabase = supabaseToken 
        ? createClient(supabaseUrl, supabaseKey, {
            global: {
              headers: {
                Authorization: `Bearer ${supabaseToken}`,
              },
            },
          })
        : null;

      setState({
        supabase,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to create authenticated clients:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    createClients();
  }, [createClients]);

  const getServiceToken = useCallback(async (service: 'supabase') => {
    return getToken({ template: service });
  }, [getToken]);

  return {
    ...state,
    getServiceToken,
    refresh: createClients,
  };
}