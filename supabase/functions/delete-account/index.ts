import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      throw new Error('Supabase credentials not configured');
    }

    // Authenticated client to identify the caller
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser();
    if (userError || !userData?.user) {
      throw new Error('Unauthorized');
    }
    const userId = userData.user.id;

    // Admin client to perform privileged operations (bypass RLS)
    const admin = createClient(supabaseUrl, serviceKey);

    console.log('Starting account deletion for user:', userId);

    // Mark profile as deleted (keeps username visible with deleted flag)
    const { error: profileError } = await admin
      .from('profiles')
      .update({ is_deleted: true })
      .eq('user_id', userId)
      .select()
      .single();
    if (profileError) {
      console.error('Profile update error:', profileError);
      throw profileError;
    }

    // Delete user's todos
    const { error: todosError } = await admin
      .from('todos')
      .delete()
      .eq('user_id', userId);
    if (todosError) {
      console.error('Todos delete error:', todosError);
      throw todosError;
    }

    // Delete user's chat messages (sender_id = userId)
    const { error: messagesError } = await admin
      .from('messages')
      .delete()
      .eq('sender_id', userId);
    if (messagesError) {
      console.error('Messages delete error:', messagesError);
      throw messagesError;
    }

    // Delete chats where user is a participant (participant1 or participant2)
    const { error: chatsError } = await admin
      .from('chats')
      .delete()
      .or(`participant1_id.eq.${userId},participant2_id.eq.${userId}`);
    if (chatsError) {
      console.error('Chats delete error:', chatsError);
      throw chatsError;
    }

    console.log('Deleting auth user:', userId);
    // Finally delete the auth user
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error('Auth user delete error:', deleteUserError);
      throw deleteUserError;
    }

    console.log('Account deletion completed successfully');

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in delete-account function:', error);
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
