import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Heart, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Request {
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
  };
  user_liked?: boolean;
}

export default function Requests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchRequests();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('requests-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'requests' 
        }, 
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`
          *,
          profiles!requests_user_id_fkey(username, is_deleted)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which requests the current user has liked
      if (user && data) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('content_type', 'request');

        const likedIds = new Set(userLikes?.map(like => like.content_id) || []);
        
        setRequests(data.map(request => ({
          ...request,
          user_liked: likedIds.has(request.id)
        })));
      } else {
        setRequests(data || []);
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
        .from('requests')
        .insert([{
          title: newTitle,
          content: newContent,
          user_id: user?.id
        }]);

      if (error) throw error;

      setNewTitle('');
      setNewContent('');
      setShowNewPost(false);
      toast({ title: 'Success', description: 'Request posted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleLike = async (requestId: string, isLiked: boolean) => {
    if (!user) return;

    // Optimistic update
    setRequests(prevRequests => prevRequests.map(request => 
      request.id === requestId 
        ? { 
            ...request, 
            user_liked: !isLiked, 
            likes_count: isLiked ? request.likes_count - 1 : request.likes_count + 1 
          } 
        : request
    ));

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('content_type', 'request')
          .eq('content_id', requestId);

        await supabase
          .from('requests')
          .update({ likes_count: requests.find(r => r.id === requestId)!.likes_count - 1 })
          .eq('id', requestId);
      } else {
        // Like
        await supabase
          .from('likes')
          .insert([{
            user_id: user.id,
            content_type: 'request',
            content_id: requestId
          }]);

        await supabase
          .from('requests')
          .update({ likes_count: requests.find(r => r.id === requestId)!.likes_count + 1 })
          .eq('id', requestId);
      }
    } catch (error: any) {
      // Revert on error
      setRequests(prevRequests => prevRequests.map(request => 
        request.id === requestId 
          ? { 
              ...request, 
              user_liked: isLiked, 
              likes_count: isLiked ? request.likes_count + 1 : request.likes_count - 1 
            } 
          : request
      ));
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = async (requestId: string) => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast({ title: 'Error', description: 'Title and content cannot be empty', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({ title: editTitle, content: editContent })
        .eq('id', requestId);

      if (error) throw error;

      setEditingId(null);
      setEditTitle('');
      setEditContent('');
      toast({ title: 'Success', description: 'Request edited successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this request?')) return;

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Request deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const canEdit = (request: Request) => {
    if (request.user_id !== user?.id) return false;
    const hoursSincePost = (new Date().getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60);
    return hoursSincePost < 24;
  };

  const filteredRequests = requests.filter(request => 
    request.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.profiles.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center p-8">Loading requests...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Requests</h1>
        <Button onClick={() => setShowNewPost(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search requests, users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* New Post Form */}
      {showNewPost && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="What do you need help with?"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />
            <div className="flex gap-2">
              <Button onClick={handlePost}>Post Request</Button>
              <Button variant="outline" onClick={() => {setShowNewPost(false); setNewTitle(''); setNewContent('');}}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center p-8">
              <p className="text-muted-foreground">No requests to show</p>
            </CardContent>
          </Card>
        ) : (
          filteredRequests.map((request) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="font-medium text-foreground">
                    {request.profiles.username}
                    {request.profiles.is_deleted && (
                      <span className="text-sm text-muted-foreground ml-2">(deleted user)</span>
                    )}
                  </div>
                  
                  {editingId === request.id ? (
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
                        <Button size="sm" onClick={() => handleEdit(request.id)}>
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {setEditingId(null); setEditTitle(''); setEditContent('');}}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">{request.title}</h3>
                        <p className="text-foreground mt-2">{request.content}</p>
                      </div>
                    </>
                  )}
                  
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(request.id, request.user_liked || false)}
                        className={`flex items-center gap-1 ${request.user_liked ? 'text-red-500' : ''}`}
                      >
                        <Heart className={`h-4 w-4 ${request.user_liked ? 'fill-current' : ''}`} />
                        {request.likes_count}
                      </Button>
                      
                      {request.user_id === user?.id && (
                        <div className="flex gap-1">
                          {canEdit(request) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingId(request.id);
                                setEditTitle(request.title || '');
                                setEditContent(request.content);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(request.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <span>
                      {new Date(request.created_at).toLocaleDateString('en-GB')}
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