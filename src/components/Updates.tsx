import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Heart, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Update {
  id: string;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    name: string;
    username: string;
  };
  user_liked?: boolean;
}

export default function Updates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchUpdates();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('updates-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'updates' 
        }, 
        () => {
          fetchUpdates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchUpdates = async () => {
    try {
      const { data, error } = await supabase
        .from('updates')
        .select(`
          *,
          profiles(name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which updates the current user has liked
      if (user && data) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('content_type', 'update');

        const likedIds = new Set(userLikes?.map(like => like.content_id) || []);
        
        setUpdates(data.map(update => ({
          ...update,
          user_liked: likedIds.has(update.id)
        })));
      } else {
        setUpdates(data || []);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newContent.trim()) {
      toast({ title: 'Error', description: 'Content cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('updates')
        .insert([{
          content: newContent,
          user_id: user?.id
        }]);

      if (error) throw error;

      setNewContent('');
      setShowNewPost(false);
      toast({ title: 'Success', description: 'Update posted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLike = async (updateId: string, isLiked: boolean) => {
    if (!user) return;

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('content_type', 'update')
          .eq('content_id', updateId);

        await supabase
          .from('updates')
          .update({ likes_count: updates.find(u => u.id === updateId)!.likes_count - 1 })
          .eq('id', updateId);
      } else {
        // Like
        await supabase
          .from('likes')
          .insert([{
            user_id: user.id,
            content_type: 'update',
            content_id: updateId
          }]);

        await supabase
          .from('updates')
          .update({ likes_count: updates.find(u => u.id === updateId)!.likes_count + 1 })
          .eq('id', updateId);
      }

      fetchUpdates();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = async (updateId: string) => {
    if (!editContent.trim()) {
      toast({ title: 'Error', description: 'Content cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('updates')
        .update({ content: editContent })
        .eq('id', updateId);

      if (error) throw error;

      setEditingId(null);
      setEditContent('');
      toast({ title: 'Success', description: 'Update edited successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (updateId: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;

    try {
      const { error } = await supabase
        .from('updates')
        .delete()
        .eq('id', updateId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Update deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const canEdit = (update: Update) => {
    if (update.user_id !== user?.id) return false;
    const hoursSincePost = (new Date().getTime() - new Date(update.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSincePost < 24;
  };

  const filteredUpdates = updates.filter(update => 
    update.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    update.profiles.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    update.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center p-8">Loading updates...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Updates</h1>
        <Button onClick={() => setShowNewPost(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Update
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search updates, users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* New Post Form */}
      {showNewPost && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="What's on your mind?"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handlePost}>Post Update</Button>
              <Button variant="outline" onClick={() => {setShowNewPost(false); setNewContent('');}}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Updates List */}
      <div className="space-y-4">
        {filteredUpdates.length === 0 ? (
          <Card>
            <CardContent className="text-center p-8">
              <p className="text-muted-foreground">No updates to show</p>
            </CardContent>
          </Card>
        ) : (
          filteredUpdates.map((update) => (
            <Card key={update.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="font-medium text-foreground">
                    {update.profiles.name || update.profiles.username}
                  </div>
                  
                  {editingId === update.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEdit(update.id)}>
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {setEditingId(null); setEditContent('');}}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-foreground">{update.content}</div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(update.id, update.user_liked || false)}
                        className={`flex items-center gap-1 ${update.user_liked ? 'text-red-500' : ''}`}
                      >
                        <Heart className={`h-4 w-4 ${update.user_liked ? 'fill-current' : ''}`} />
                        {update.likes_count}
                      </Button>
                      
                      {update.user_id === user?.id && (
                        <div className="flex gap-1">
                          {canEdit(update) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(update.id);
                                setEditContent(update.content);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(update.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <span>
                      {new Date(update.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}