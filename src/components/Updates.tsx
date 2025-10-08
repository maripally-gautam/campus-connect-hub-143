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
  title: string;
  content: string;
  likes_count: number;
  created_at: string;
  updated_at: string;
  user_id: string;
  profiles: {
    username: string;
    is_deleted: boolean;
  } | null;
  user_liked?: boolean;
}

export default function Updates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchUpdates();
    const subscription = supabase
      .channel('updates-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'updates' },
        () => fetchUpdates()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchUpdates = async () => {
    try {
      // 1. Fetch all updates
      const { data, error } = await supabase
        .from('updates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 2. Get all user_ids
      const userIds = Array.from(new Set((data || []).filter(u => u.user_id).map(u => u.user_id)));

      // 3. Fetch profiles for those user_ids
      let profilesMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username, is_deleted')
          .in('user_id', userIds);
        (profiles || []).forEach(p => { profilesMap[p.user_id] = p; });
      }

      // 4. Attach profiles to updates
      const updatesWithProfiles = (data || []).map(update => ({
        ...update,
        profiles: update.user_id ? profilesMap[update.user_id] || null : null
      }));

      // 5. Check liked updates for current user
      if (user && updatesWithProfiles.length) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('content_type', 'update');
        const likedIds = new Set(userLikes?.map(like => like.content_id) || []);
        setUpdates(updatesWithProfiles.map(update => ({
          ...update,
          user_liked: likedIds.has(update.id)
        })));
      } else {
        setUpdates(updatesWithProfiles);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({ title: 'Error', description: 'Title and content cannot be empty', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('updates')
        .insert([{
          title: newTitle,
          content: newContent,
          user_id: user?.id
        }]);
      if (error) throw error;
      setNewTitle('');
      setNewContent('');
      setShowNewPost(false);
      toast({ title: 'Success', description: 'Update posted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLike = async (updateId: string, isLiked: boolean) => {
    if (!user) return;
    setUpdates(prevUpdates => prevUpdates.map(update =>
      update.id === updateId
        ? { ...update, user_liked: !isLiked, likes_count: isLiked ? update.likes_count - 1 : update.likes_count + 1 }
        : update
    ));
    try {
      if (isLiked) {
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
    } catch (error: any) {
      setUpdates(prevUpdates => prevUpdates.map(update =>
        update.id === updateId
          ? { ...update, user_liked: isLiked, likes_count: isLiked ? update.likes_count + 1 : update.likes_count - 1 }
          : update
      ));
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = async (updateId: string) => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast({ title: 'Error', description: 'Title and content cannot be empty', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase
        .from('updates')
        .update({ title: editTitle, content: editContent })
        .eq('id', updateId);
      if (error) throw error;
      setEditingId(null);
      setEditTitle('');
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
    update.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    update.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    update.profiles?.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-[200px]">
        <div className="fixed top-0 left-0 right-0 z-50 h-1 overflow-hidden">
          <div className="h-full w-1/3 animate-[progress_1.2s_ease-in-out_infinite] rounded-r bg-primary" />
        </div>
      </div>
    );
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
            <Input
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handlePost(); } }}
            />
            <Textarea
              placeholder="What's on your mind?"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handlePost}>Post Update</Button>
              <Button variant="outline" onClick={() => { setShowNewPost(false); setNewTitle(''); setNewContent(''); }}>
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
                    {update.profiles?.username || 'Deleted User'}
                    {update.profiles?.is_deleted && (
                      <span className="text-sm text-muted-foreground ml-2">(deleted user)</span>
                    )}
                  </div>
                  {editingId === update.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                      />
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
                          onClick={() => { setEditingId(null); setEditTitle(''); setEditContent(''); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{update.title}</h3>
                        <p className="text-foreground mt-2">{update.content}</p>
                      </div>
                    </>
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
                                setEditTitle(update.title || '');
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
