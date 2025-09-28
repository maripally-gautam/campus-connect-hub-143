import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OTPRequest {
  email: string;
  type: 'signup' | 'reset';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, type }: OTPRequest = await req.json();

    if (!email || !type) {
      return new Response(
        JSON.stringify({ error: "Email and type are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Store OTP in database
    const { error: dbError } = await supabase
      .from('otps')
      .insert({
        email,
        otp_code: otpCode,
        expires_at: expiresAt.toISOString()
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: "Failed to generate OTP" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send email using Gmail SMTP
    const emailData = {
      to: [{ email }],
      from: { 
        email: Deno.env.get('SMTP_USER')!,
        name: 'EduConnect'
      },
      subject: type === 'signup' ? 'Your EduConnect Verification Code' : 'Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #333; text-align: center;">EduConnect</h1>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">
              ${type === 'signup' ? 'Verify Your Email' : 'Reset Your Password'}
            </h2>
            <p style="color: #666; line-height: 1.5;">
              ${type === 'signup' 
                ? 'Thank you for signing up! Please use the following verification code to complete your registration:'
                : 'You requested to reset your password. Use the following code:'
              }
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 4px; padding: 15px 25px; background: white; border: 2px dashed #007bff; border-radius: 8px; display: inline-block;">
                ${otpCode}
              </span>
            </div>
            <p style="color: #666; font-size: 14px;">
              This code will expire in 10 minutes. If you didn't request this, please ignore this email.
            </p>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center;">
            © 2024 EduConnect. All rights reserved.
          </p>
        </div>
      `
    };

    // Send email using SMTP
    const client = new SMTPClient({
      connection: {
        hostname: Deno.env.get('SMTP_HOST')!,
        port: parseInt(Deno.env.get('SMTP_PORT')!),
        tls: true,
        auth: {
          username: Deno.env.get('SMTP_USER')!,
          password: Deno.env.get('SMTP_PASS')!,
        },
      },
    });

    try {
      await client.send({
        from: `EduConnect <${Deno.env.get('SMTP_USER')!}>`,
        to: email,
        subject: emailData.subject,
        content: emailData.html,
        html: emailData.html,
      });

      console.log("OTP email sent successfully to:", email);

    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Log the OTP for development/testing
      console.log(`OTP for ${email}: ${otpCode}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "OTP generated successfully",
          devNote: "Check server logs for OTP (email service unavailable)"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } finally {
      await client.close();
    }

    console.log("OTP sent successfully to:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-otp function:", error);
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