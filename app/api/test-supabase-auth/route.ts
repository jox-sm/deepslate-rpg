import { NextResponse } from 'next/server';
import { createAuthenticatedSupabaseClient } from '@/lib/auth';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  try {
    const authResult = await auth();
    const getToken = authResult.getToken;
    
    if (!getToken) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated - please sign in first'
      }, { status: 401 });
    }
    
    const supabaseClient = await createAuthenticatedSupabaseClient(getToken);
    
    // Test: Try to list buckets (requires authenticated user)
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
  } catch (error) {
    console.error('Test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}