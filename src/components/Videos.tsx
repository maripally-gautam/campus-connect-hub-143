import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Plus, Search, Trash2, Link as LinkIcon, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Video {
  id: string;
  title: string;
  branch: string;
  semester: number;
  subject: string;
  description: string;
  file_url: string;
  likes_count: number;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    username: string;
    is_deleted: boolean;
  };
  user_liked?: boolean;
}

const branches = ['CSE', 'CSM', 'ECE', 'CSD', 'CSC', 'IT'];
const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Videos() {
  const { user } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSemester, setFilterSemester] = useState('');
  
  // Upload form state
  const [uploadData, setUploadData] = useState({
    title: '',
    branch: '',
    semester: '',
    subject: '',
    description: ''
  });
  const [videoLinks, setVideoLinks] = useState<string[]>(['']);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchVideos();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('videos-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'videos' 
        }, 
        () => {
          fetchVideos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select(`
          *,
          profiles!videos_user_id_fkey(name, username, is_deleted)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which videos the current user has liked
      if (user && data) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('content_type', 'video');

        const likedIds = new Set(userLikes?.map(like => like.content_id) || []);
        
        setVideos(data.map(video => ({
          ...video,
          user_liked: likedIds.has(video.id)
        })));
      } else {
        setVideos(data || []);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const addLinkField = () => {
    setVideoLinks([...videoLinks, '']);
  };

  const removeLinkField = (index: number) => {
    if (videoLinks.length > 1) {
      setVideoLinks(videoLinks.filter((_, i) => i !== index));
    }
  };

  const updateLink = (index: number, value: string) => {
    const newLinks = [...videoLinks];
    newLinks[index] = value;
    setVideoLinks(newLinks);
  };

  const handleUpload = async () => {
    // Filter out empty links
    const validLinks = videoLinks.filter(link => link.trim());
    
    if (validLinks.length === 0) {
      toast({ title: 'Error', description: 'Please enter at least one video link', variant: 'destructive' });
      return;
    }

    // Check if at least one field is filled
    const hasRequiredData = uploadData.title || uploadData.branch || uploadData.semester || uploadData.subject || uploadData.description;
    if (!hasRequiredData) {
      toast({ 
        title: 'Error', 
        description: 'Please fill at least one field (title, branch, semester, subject, or description)', 
        variant: 'destructive' 
      });
      return;
    }

    setUploading(true);

    try {
      // Insert each video link as a separate entry
      const videoEntries = validLinks.map(link => ({
        title: uploadData.title || 'Video',
        branch: uploadData.branch || null,
        semester: uploadData.semester ? parseInt(uploadData.semester) : null,
        subject: uploadData.subject || null,
        description: uploadData.description || null,
        file_url: link,
        file_name: 'Video Link',
        file_type: 'video/link',
        file_size: 0,
        user_id: user?.id
      }));

      const { error } = await supabase
        .from('videos')
        .insert(videoEntries);

      if (error) throw error;

      setUploadData({ title: '', branch: '', semester: '', subject: '', description: '' });
      setVideoLinks(['']);
      setShowUpload(false);
      toast({ title: 'Success', description: `${validLinks.length} video link(s) uploaded successfully!` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (videoId: string, isLiked: boolean) => {
    if (!user) return;

    // Optimistic update
    setVideos(prevVideos => prevVideos.map(video => 
      video.id === videoId 
        ? { 
            ...video, 
            user_liked: !isLiked, 
            likes_count: isLiked ? video.likes_count - 1 : video.likes_count + 1 
          } 
        : video
    ));

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('content_type', 'video')
          .eq('content_id', videoId);

        await supabase
          .from('videos')
          .update({ likes_count: videos.find(v => v.id === videoId)!.likes_count - 1 })
          .eq('id', videoId);
      } else {
        // Like
        await supabase
          .from('likes')
          .insert([{
            user_id: user.id,
            content_type: 'video',
            content_id: videoId
          }]);

        await supabase
          .from('videos')
          .update({ likes_count: videos.find(v => v.id === videoId)!.likes_count + 1 })
          .eq('id', videoId);
      }
    } catch (error: any) {
      // Revert on error
      setVideos(prevVideos => prevVideos.map(video => 
        video.id === videoId 
          ? { 
              ...video, 
              user_liked: isLiked, 
              likes_count: isLiked ? video.likes_count + 1 : video.likes_count - 1 
            } 
          : video
      ));
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video link?')) return;

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Video link deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = 
      video.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.branch?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.semester?.toString().includes(searchQuery) ||
      video.profiles.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.profiles.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBranch = !filterBranch || filterBranch === 'all' || video.branch === filterBranch;
    const matchesSemester = !filterSemester || filterSemester === 'all' || video.semester?.toString() === filterSemester;

    return matchesSearch && matchesBranch && matchesSemester;
  });

  if (loading) {
    return <div className="flex justify-center p-8">Loading videos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-foreground">Videos</h1>
        <Button onClick={() => setShowUpload(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Upload a Video Link
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search videos, subjects, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Branch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(branch => (
              <SelectItem key={branch} value={branch}>{branch}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterSemester} onValueChange={setFilterSemester}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Semester" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Semesters</SelectItem>
            {semesters.map(sem => (
              <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Video Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Title"
                value={uploadData.title}
                onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
              />
              
              <Select value={uploadData.branch} onValueChange={(value) => setUploadData({...uploadData, branch: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={uploadData.semester} onValueChange={(value) => setUploadData({...uploadData, semester: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Semester" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map(sem => (
                    <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Subject"
                value={uploadData.subject}
                onChange={(e) => setUploadData({...uploadData, subject: e.target.value})}
              />
            </div>

            <Textarea
              placeholder="Description"
              value={uploadData.description}
              onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
              rows={3}
            />

            <div className="space-y-3">
              <label className="text-sm font-medium">Video Links</label>
              {videoLinks.map((link, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Paste video link (YouTube, Drive, etc.)"
                    value={link}
                    onChange={(e) => updateLink(index, e.target.value)}
                  />
                  {videoLinks.length > 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => removeLinkField(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {index === videoLinks.length - 1 && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={addLinkField}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading}>
                <LinkIcon className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Video Links'}
              </Button>
              <Button variant="outline" onClick={() => {
                setShowUpload(false); 
                setVideoLinks(['']);
                setUploadData({ title: '', branch: '', semester: '', subject: '', description: '' });
              }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Videos List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVideos.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center p-8">
                <p className="text-muted-foreground">No video links uploaded yet</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredVideos.map((video) => (
            <Card key={video.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* <div className="font-semibold text-lg text-foreground">
                    {video.title}
                  </div> */}
                  
                  <div className="font-medium text-sm text-foreground">
                    {video.profiles.name || video.profiles.username}
                    {video.profiles.is_deleted && (
                      <span className="text-sm text-muted-foreground ml-2">(deleted user)</span>
                    )}
                  </div>
                                    
                  {video.title && video.title !== 'Video' && (
                    <div className="font-medium text-foreground">{video.title}</div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {video.branch && `${video.branch} • `}
                    {video.semester && `Semester ${video.semester}`}
                    {video.subject && ` • ${video.subject}`}
                  </div>
                  
                  {video.description && (
                    <div className="text-sm text-foreground">{video.description}</div>
                  )}
                  
                  <a 
                    href={video.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline break-all"
                  >
                    <LinkIcon className="h-4 w-4 flex-shrink-0" />
                    {video.file_url}
                  </a>
                  
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(video.id, video.user_liked || false)}
                        className={`flex items-center gap-1 ${video.user_liked ? 'text-red-500' : ''}`}
                      >
                        <Heart className={`h-4 w-4 ${video.user_liked ? 'fill-current' : ''}`} />
                        {video.likes_count}
                      </Button>
                      
                      {video.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(video.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <span>
                      {new Date(video.created_at).toLocaleDateString('en-GB')}
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