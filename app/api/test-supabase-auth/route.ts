import { NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';
import { tryApiRoute } from '@/utilities/apiErrorHandler';

export async function GET() {
  return tryApiRoute(async () => {
    const authResult = await auth();
    const getToken = authResult.getToken;
    
    if (!getToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated - please sign in first'
      }, { status: 401 });
    }
    
    const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
    
    const { data, error } = await supabaseClient.storage.listBuckets();
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: 'Failed to list buckets - check Supabase RLS policies'
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Supabase JWT integration is working!',
      buckets: data.map(b => b.name)
    });
  }, "test-supabase-auth");
}