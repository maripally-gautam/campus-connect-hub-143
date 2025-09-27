import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  otpCode: string;
  password?: string; // Required for signup
  username?: string; // Required for signup
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otpCode, password, username }: VerifyOTPRequest = await req.json();

    if (!email || !otpCode) {
      return new Response(
        JSON.stringify({ error: "Email and OTP code are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify OTP
    const { data: otpRecord, error: otpError } = await supabase
      .from('otps')
      .select('*')
      .eq('email', email)
      .eq('otp_code', otpCode)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (otpError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark OTP as used
    await supabase
      .from('otps')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // If password is provided, this is a signup request
    if (password && username) {
      // Create user account
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Skip email confirmation since we verified OTP
      });

      if (authError) {
        console.error('Auth error:', authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Update the profile with username (profile was created by trigger)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('user_id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Account created successfully",
          user: authData.user
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // If no password, this is just OTP verification (for password reset)
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP verified successfully" 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);