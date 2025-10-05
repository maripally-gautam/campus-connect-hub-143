import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      throw new Error('Email and new password are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize inputs
    const normalizedEmail = email.trim().toLowerCase();

    // Try to find the user by email (case-insensitive), searching multiple pages just in case
    let foundUser: { id: string } | null = null;
    let page = 1;
    const perPage = 200;

    while (!foundUser) {
      const { data: pageData, error: listErr } = await supabase.auth.admin.listUsers({ page, perPage } as any);
      if (listErr) throw listErr;

      const usersPage = pageData?.users ?? [];
      foundUser = usersPage.find((u: any) => (u.email || '').toLowerCase() === normalizedEmail) || null;

      // If fewer than perPage returned, we've reached the end
      if (foundUser || usersPage.length < perPage) break;
      page += 1;
    }

    // Fallback: try resolving user id from public.profiles by email
    if (!foundUser) {
      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('email', email.trim())
        .maybeSingle();

      if (profileErr) throw profileErr;
      if (profileRow?.user_id) {
        foundUser = { id: profileRow.user_id };
      }
    }

    if (!foundUser) {
      throw new Error('User not found');
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      foundUser.id,
      { password: newPassword }
    );

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in reset-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
