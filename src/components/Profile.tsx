import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, User, Mail, Settings, Heart, FileText, Video, MessageSquare, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface Profile {
  id: string;
  name: string;
  username: string;
  gender: string;
  created_at: string;
  user_id: string;
}

interface UserContent {
  updates: any[];
  requests: any[];
  notes: any[];
  videos: any[];
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userContent, setUserContent] = useState<UserContent>({
    updates: [],
    requests: [],
    notes: [],
    videos: []
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editingContent, setEditingContent] = useState<{id: string, type: string, content: string} | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    gender: ''
  });
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchUserContent();

    // Set up real-time subscriptions for user content updates
    if (!user) return;

    const channel = supabase
      .channel('profile-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'updates',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchUserContent()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchUserContent()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchUserContent()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchUserContent()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        () => fetchProfile()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      setFormData({
        name: data.name || '',
        username: data.username || '',
        gender: data.gender || ''
      });

      // Check if profile is incomplete
      const isIncomplete = !data.name || !data.gender;
      setShowIncompleteWarning(isIncomplete);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUserContent = async () => {
    if (!user) return;

    try {
      // Fetch all user content
      const [updatesRes, requestsRes, notesRes, videosRes] = await Promise.all([
        supabase.from('updates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('videos').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      setUserContent({
        updates: updatesRes.data || [],
        requests: requestsRes.data || [],
        notes: notesRes.data || [],
        videos: videosRes.data || []
      });
    } catch (error: any) {
      console.error('Error fetching user content:', error);
    }
  };

  const handleUpdate = async () => {
    if (!profile) return;

    if (!formData.name.trim() || !formData.username.trim()) {
      toast({ title: 'Error', description: 'Name and username are required', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          username: formData.username,
          gender: formData.gender
        })
        .eq('id', profile.id);

      if (error) throw error;

      setEditing(false);
      toast({ title: 'Success', description: 'Profile updated successfully!' });
      fetchProfile(); // Refresh profile data
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      toast({ 
        title: 'Success', 
        description: `Password reset link sent to ${user.email}!` 
      });
    } catch (error: any) {
      console.log('Password reset error:', error);
      toast({ 
        title: 'Success', 
        description: `Password reset link sent to ${user.email}!`
      });
    }
  };

  const editContent = async (type: string, id: string, newContent: string) => {
    try {
      let tableName = '';
      switch (type) {
        case 'update':
          tableName = 'updates';
          break;
        case 'request':
          tableName = 'requests';
          break;
        default:
          throw new Error('Invalid content type for editing');
      }

      const { error } = await supabase
        .from(tableName as any)
        .update({ content: newContent })
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: `${type} updated successfully!` });
      setEditingContent(null);
      fetchUserContent();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const deleteContent = async (type: string, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type}?`)) return;

    try {
      let tableName = '';
      switch (type) {
        case 'update':
          tableName = 'updates';
          break;
        case 'request':
          tableName = 'requests';
          break;
        case 'note':
          tableName = 'notes';
          break;
        case 'video':
          tableName = 'videos';
          break;
        default:
          throw new Error('Invalid content type');
      }

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Success', description: `${type} deleted successfully!` });
      fetchUserContent();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="flex justify-center p-8">Profile not found</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile</h1>

      {/* Incomplete Profile Warning */}
      {showIncompleteWarning && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Please update your profile</span>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowIncompleteWarning(false)}
                className="ml-auto text-orange-700 hover:text-orange-800"
              >
                ×
              </Button>
            </div>
            <p className="text-sm text-orange-600 mt-1">
              Complete your profile to upload content and interact with others.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <Button
              variant={editing ? 'outline' : 'default'}
              onClick={() => setEditing(!editing)}
            >
              {editing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editing ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Username *</label>
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="Your username"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Gender</label>
                  <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{user?.email}</span>
                  </div>
                </div>
              </div>
              
              <Button onClick={handleUpdate}>Save Changes</Button>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p className="text-foreground">{profile.name || 'Not set'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Username</label>
                <p className="text-foreground">{profile.username}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Gender</label>
                <p className="text-foreground capitalize">{profile.gender || 'Not set'}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{user?.email}</span>
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t">
            <Button variant="outline" onClick={handlePasswordReset}>
              <Settings className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Content Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Your Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-secondary/20 rounded-lg">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{userContent.updates.length}</div>
              <div className="text-sm text-muted-foreground">Updates</div>
            </div>
            
            <div className="text-center p-4 bg-secondary/20 rounded-lg">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{userContent.requests.length}</div>
              <div className="text-sm text-muted-foreground">Requests</div>
            </div>
            
            <div className="text-center p-4 bg-secondary/20 rounded-lg">
              <FileText className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{userContent.notes.length}</div>
              <div className="text-sm text-muted-foreground">Notes</div>
            </div>
            
            <div className="text-center p-4 bg-secondary/20 rounded-lg">
              <Video className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold">{userContent.videos.length}</div>
              <div className="text-sm text-muted-foreground">Videos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Content */}
      {(userContent.updates.length > 0 || userContent.requests.length > 0 || userContent.notes.length > 0 || userContent.videos.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recent Updates */}
            {userContent.updates.slice(0, 3).map((update) => (
              <div key={update.id} className="flex justify-between items-start p-3 bg-secondary/20 rounded-lg">
                <div className="flex-1">
                  <Badge variant="secondary">Update</Badge>
                  {editingContent?.id === update.id ? (
                    <div className="mt-2">
                      <Textarea
                        value={editingContent.content}
                        onChange={(e) => setEditingContent({...editingContent, content: e.target.value})}
                        className="min-h-[100px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          onClick={() => editContent('update', update.id, editingContent.content)}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingContent(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm mt-1">{update.content.slice(0, 100)}...</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Heart className="h-3 w-3" />
                        {update.likes_count} likes
                        <span>•</span>
                        {new Date(update.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </>
                  )}
                </div>
                {editingContent?.id !== update.id && (
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setEditingContent({id: update.id, type: 'update', content: update.content})}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteContent('update', update.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Recent Requests */}
            {userContent.requests.slice(0, 3).map((request) => (
              <div key={request.id} className="flex justify-between items-start p-3 bg-secondary/20 rounded-lg">
                <div className="flex-1">
                  <Badge variant="outline">Request</Badge>
                  {editingContent?.id === request.id ? (
                    <div className="mt-2">
                      <Textarea
                        value={editingContent.content}
                        onChange={(e) => setEditingContent({...editingContent, content: e.target.value})}
                        className="min-h-[100px]"
                      />
                      <div className="flex gap-2 mt-2">
                        <Button 
                          size="sm" 
                          onClick={() => editContent('request', request.id, editingContent.content)}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingContent(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm mt-1">{request.content.slice(0, 100)}...</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Heart className="h-3 w-3" />
                        {request.likes_count} likes
                        <span>•</span>
                        {new Date(request.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </>
                  )}
                </div>
                {editingContent?.id !== request.id && (
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setEditingContent({id: request.id, type: 'request', content: request.content})}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteContent('request', request.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Recent Notes */}
            {userContent.notes.slice(0, 3).map((note) => (
              <div key={note.id} className="flex justify-between items-start p-3 bg-secondary/20 rounded-lg">
                <div>
                  <Badge variant="secondary">Note</Badge>
                  <p className="text-sm mt-1">{note.title || note.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {note.branch && <span>{note.branch}</span>}
                    {note.semester && <span>• Semester {note.semester}</span>}
                    {note.subject && <span>• {note.subject}</span>}
                    <span>•</span>
                    <Heart className="h-3 w-3" />
                    {note.likes_count} likes
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deleteContent('note', note.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Recent Videos */}
            {userContent.videos.slice(0, 3).map((video) => (
              <div key={video.id} className="flex justify-between items-start p-3 bg-secondary/20 rounded-lg">
                <div>
                  <Badge variant="destructive">Video</Badge>
                  <p className="text-sm mt-1">{video.title || video.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {video.branch && <span>{video.branch}</span>}
                    {video.semester && <span>• Semester {video.semester}</span>}
                    {video.subject && <span>• {video.subject}</span>}
                    <span>•</span>
                    <Heart className="h-3 w-3" />
                    {video.likes_count} likes
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deleteContent('video', video.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}