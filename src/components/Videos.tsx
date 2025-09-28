import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Plus, Search, Play, Trash2, Upload } from 'lucide-react';
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
  file_name: string;
  file_type: string;
  file_size: number;
  likes_count: number;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    username: string;
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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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
          profiles!videos_user_id_fkey(name, username)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({ 
        title: 'Error', 
        description: 'File size must be less than 50MB', 
        variant: 'destructive' 
      });
      return;
    }

    // Check file type
    const allowedTypes = ['.mp4', '.mov', '.avi', '.mkv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({ 
        title: 'Error', 
        description: 'Only MP4, MOV, AVI, and MKV video files are allowed', 
        variant: 'destructive' 
      });
      return;
    }

    setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({ title: 'Error', description: 'Please select a file', variant: 'destructive' });
      return;
    }

    // Check if at least one field is filled
    const hasRequiredData = uploadData.branch || uploadData.semester || uploadData.subject || uploadData.description;
    if (!hasRequiredData) {
      toast({ 
        title: 'Error', 
        description: 'Please fill at least one field (branch, semester, subject, or description)', 
        variant: 'destructive' 
      });
      return;
    }

    setUploading(true);

    try {
      // For now, we'll simulate Google Drive upload with a placeholder URL
      // In a real implementation, this would upload to Google Drive
      const fakeGoogleDriveUrl = `https://drive.google.com/file/d/fake-${Date.now()}/view`;

      const { error } = await supabase
        .from('videos')
        .insert([{
          title: uploadData.title || uploadFile.name,
          branch: uploadData.branch || null,
          semester: uploadData.semester ? parseInt(uploadData.semester) : null,
          subject: uploadData.subject || null,
          description: uploadData.description || null,
          file_url: fakeGoogleDriveUrl,
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
          user_id: user?.id
        }]);

      if (error) throw error;

      setUploadData({ title: '', branch: '', semester: '', subject: '', description: '' });
      setUploadFile(null);
      setShowUpload(false);
      toast({ title: 'Success', description: 'Video uploaded successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (videoId: string, isLiked: boolean) => {
    if (!user) return;

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

      fetchVideos();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      toast({ title: 'Success', description: 'Video deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = 
      video.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          Upload Video
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
            <CardTitle>Upload Video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="Title (optional)"
                value={uploadData.title}
                onChange={(e) => setUploadData({...uploadData, title: e.target.value})}
              />
              
              <Select value={uploadData.branch} onValueChange={(value) => setUploadData({...uploadData, branch: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Branch (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={uploadData.semester} onValueChange={(value) => setUploadData({...uploadData, semester: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Semester (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map(sem => (
                    <SelectItem key={sem} value={sem.toString()}>Semester {sem}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Subject (optional)"
                value={uploadData.subject}
                onChange={(e) => setUploadData({...uploadData, subject: e.target.value})}
              />
            </div>

            <Textarea
              placeholder="Description (optional)"
              value={uploadData.description}
              onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
              rows={3}
            />

            <div className="space-y-2">
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".mp4,.mov,.avi,.mkv"
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: MP4, MOV, AVI, MKV (Max 50MB)
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Video'}
              </Button>
              <Button variant="outline" onClick={() => {setShowUpload(false); setUploadFile(null);}}>
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
                <p className="text-muted-foreground">No videos uploaded yet</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredVideos.map((video) => (
            <Card key={video.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="font-medium text-foreground">
                    {video.profiles.name || video.profiles.username}
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    {video.branch && `${video.branch} • `}
                    {video.semester && `Semester ${video.semester} • `}
                    {video.subject}
                  </div>
                  
                  {video.description && (
                    <div className="text-sm text-foreground">{video.description}</div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(video.file_url, '_blank')}
                    className="w-full flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Watch Video
                  </Button>
                  
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