// app/api/server-url/route.ts
// Returns the current Express server URL (Cloudflare tunnel URL stored in Supabase)
import { NextResponse } from 'next/server';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/radio_config?id=eq.server_url&select=value`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
          cache: 'no-store',
        }
      );
      if (res.ok) {
        const data: { value: string }[] = await res.json();
        if (data[0]?.value) {
          return NextResponse.json({ url: data[0].value });
        }
      }
    } catch {
      // Fall through to env var fallback
    }
  }

  // Fallback: use env var (local dev or Supabase unavailable)
  const fallback = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001';
  return NextResponse.json({ url: fallback });
}
