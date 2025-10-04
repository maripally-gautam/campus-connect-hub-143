import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export default function ChangePassword() {
  const { user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user?.email) return;
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Verify old password by attempting sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) throw new Error('Old password is incorrect');

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      toast({ title: 'Success', description: 'Password updated successfully' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update password', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
          <CardDescription>Enter your old password and set a new one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Input type="password" placeholder="Old Password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} onKeyDown={handleKeyDown} className="pl-10" />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} onKeyDown={handleKeyDown} className="pl-10" />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
          <div className="relative">
            <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={handleKeyDown} className="pl-10" />
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={loading}>{loading ? 'Updating...' : 'Update Password'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
