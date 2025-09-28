import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type AuthMode = 'signin' | 'signup' | 'verify' | 'forgot';

export default function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    otp: ''
  });

  const validatePassword = (password: string) => {
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const minLength = password.length >= 6;
    
    if (!minLength) return 'Password must be at least 6 characters';
    if (!hasUpper) return 'Password must contain at least one uppercase letter';
    if (!hasLower) return 'Password must contain at least one lowercase letter';
    return null;
  };

  const handleSendOTP = async () => {
    if (!formData.email) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }

    if (mode === 'signup') {
      if (!formData.username) {
        toast({ title: 'Error', description: 'Username is required', variant: 'destructive' });
        return;
      }
      
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        toast({ title: 'Error', description: passwordError, variant: 'destructive' });
        return;
      }
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: {
          email: formData.email,
          type: mode === 'signup' ? 'signup' : 'reset'
        }
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'OTP sent to your email!' });
      setMode('verify');
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to send OTP', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!formData.otp) {
      toast({ title: 'Error', description: 'OTP is required', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: {
          email: formData.email,
          otpCode: formData.otp,
          ...(mode === 'verify' && formData.password ? {
            password: formData.password,
            username: formData.username
          } : {})
        }
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Account created successfully!' });
      
      // Sign in the user after successful verification
      if (formData.password) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });
        
        if (signInError) {
          toast({ 
            title: 'Error', 
            description: 'Account created but sign in failed. Please try signing in manually.', 
            variant: 'destructive' 
          });
        }
      }
    } catch (error: any) {
      if (error.message.includes('Invalid') || error.message.includes('expired')) {
        toast({ title: 'Error', description: 'Invalid Mail ID or Incorrect OTP', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    if (!formData.username || !formData.password) {
      toast({ title: 'Error', description: 'Email/Username and password are required', variant: 'destructive' });
      return;
    }

    setLoading(true);

    try {
      let emailToUse = formData.username;
      
      // Check if input is an email (contains @)
      if (!formData.username.includes('@')) {
        // It's a username, look up the email from the profiles table
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', formData.username)
          .maybeSingle();

        if (profileError) {
          throw new Error('Error looking up user');
        }
        
        if (!profile || !profile.email) {
          throw new Error('Username not found');
        }

        emailToUse = profile.email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: formData.password
      });

      if (error) throw error;
      
      toast({ title: 'Success', description: 'Signed in successfully!' });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Invalid email/username or password', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">EduConnect</CardTitle>
          <CardDescription>
            {mode === 'signin' && 'Sign in with your email or username'}
            {mode === 'signup' && 'Create your account'}
            {mode === 'verify' && 'Enter verification code'}
            {mode === 'forgot' && 'Reset your password'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
            <>
              {mode === 'signin' ? (
                <div className="space-y-2 relative">
                  <Input
                    type="text"
                    placeholder="Email or Username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="pl-10"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 relative">
                  <Input
                    type="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="pl-10"
                  />
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-2 relative">
                  <Input
                    type="text"
                    placeholder="Username"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="pl-10"
                  />
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              )}

              {(mode === 'signin' || mode === 'signup') && (
                <div className="space-y-2 relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="pl-10 pr-10"
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </>
          )}

          {mode === 'verify' && (
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={formData.otp}
                onChange={(e) => setFormData({...formData, otp: e.target.value})}
                maxLength={6}
                className="text-center text-lg tracking-widest"
              />
              <p className="text-sm text-muted-foreground text-center">
                Code sent to {formData.email}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {mode === 'signin' && (
              <Button onClick={handleSignIn} className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            )}
            
            {(mode === 'signup' || mode === 'forgot') && (
              <Button onClick={handleSendOTP} className="w-full" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            )}
            
            {mode === 'verify' && (
              <Button onClick={handleVerifyOTP} className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </Button>
            )}
          </div>

          <div className="text-center space-y-2">
            {mode === 'signin' && (
              <>
                <Button 
                  variant="link" 
                  onClick={() => setMode('signup')}
                  className="text-sm"
                >
                  Don't have an account? Sign up
                </Button>
                <br />
                <Button 
                  variant="link" 
                  onClick={() => setMode('forgot')}
                  className="text-sm"
                >
                  Forgot password?
                </Button>
              </>
            )}
            
            {(mode === 'signup' || mode === 'forgot' || mode === 'verify') && (
              <Button 
                variant="link" 
                onClick={() => {setMode('signin'); setFormData({email: '', password: '', username: '', otp: ''});}}
                className="text-sm"
              >
                Back to Sign In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}