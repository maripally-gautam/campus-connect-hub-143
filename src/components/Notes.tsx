import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Plus, Search, Download, Trash2, Upload, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Note {
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
    is_deleted: boolean;
  };
  user_liked?: boolean;
}

const branches = ['CSE', 'CSM', 'ECE', 'CSD', 'CSC', 'IT'];
const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

export default function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
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
    fetchNotes();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel('notes-changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'notes' 
        }, 
        () => {
          fetchNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          profiles!notes_user_id_fkey(name, username, is_deleted)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which notes the current user has liked
      if (user && data) {
        const { data: userLikes } = await supabase
          .from('likes')
          .select('content_id')
          .eq('user_id', user.id)
          .eq('content_type', 'note');

        const likedIds = new Set(userLikes?.map(like => like.content_id) || []);
        
        setNotes(data.map(note => ({
          ...note,
          user_liked: likedIds.has(note.id)
        })));
      } else {
        setNotes(data || []);
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
    const allowedTypes = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.mp3', '.mp4'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      toast({ 
        title: 'Error', 
        description: 'Only PDF, PPT, DOC, MP3, and MP4 files are allowed', 
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
      // Upload file to Supabase Storage
      const fileExt = uploadFile.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('notes')
        .upload(fileName, uploadFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('notes')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('notes')
        .insert([{
          title: uploadData.title || uploadFile.name,
          branch: uploadData.branch || null,
          semester: uploadData.semester ? parseInt(uploadData.semester) : null,
          subject: uploadData.subject || null,
          description: uploadData.description || null,
          file_url: publicUrl,
          file_name: uploadFile.name,
          file_type: uploadFile.type,
          file_size: uploadFile.size,
          user_id: user?.id
        }]);

      if (error) throw error;

      setUploadData({ title: '', branch: '', semester: '', subject: '', description: '' });
      setUploadFile(null);
      setShowUpload(false);
      toast({ title: 'Success', description: 'Note uploaded successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (noteId: string, isLiked: boolean) => {
    if (!user) return;

    // Optimistic update
    setNotes(prevNotes => prevNotes.map(note => 
      note.id === noteId 
        ? { 
            ...note, 
            user_liked: !isLiked, 
            likes_count: isLiked ? note.likes_count - 1 : note.likes_count + 1 
          } 
        : note
    ));

    try {
      if (isLiked) {
        // Unlike
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('content_type', 'note')
          .eq('content_id', noteId);

        await supabase
          .from('notes')
          .update({ likes_count: notes.find(n => n.id === noteId)!.likes_count - 1 })
          .eq('id', noteId);
      } else {
        // Like
        await supabase
          .from('likes')
          .insert([{
            user_id: user.id,
            content_type: 'note',
            content_id: noteId
          }]);

        await supabase
          .from('notes')
          .update({ likes_count: notes.find(n => n.id === noteId)!.likes_count + 1 })
          .eq('id', noteId);
      }
    } catch (error: any) {
      // Revert on error
      setNotes(prevNotes => prevNotes.map(note => 
        note.id === noteId 
          ? { 
              ...note, 
              user_liked: isLiked, 
              likes_count: isLiked ? note.likes_count + 1 : note.likes_count - 1 
            } 
          : note
      ));
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      // Get the note to find the file path
      const note = notes.find(n => n.id === noteId);
      
      // Delete from database
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      // Delete from storage if it's a storage URL
      if (note?.file_url.includes('supabase.co/storage')) {
        const filePath = note.file_url.split('/notes/')[1];
        if (filePath) {
          await supabase.storage
            .from('notes')
            .remove([filePath]);
        }
      }

      toast({ title: 'Success', description: 'Note deleted successfully!' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.profiles.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.profiles.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBranch = !filterBranch || filterBranch === 'all' || note.branch === filterBranch;
    const matchesSemester = !filterSemester || filterSemester === 'all' || note.semester?.toString() === filterSemester;

    return matchesSearch && matchesBranch && matchesSemester;
  });

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
        <h1 className="text-2xl font-bold text-foreground">Notes</h1>
        <Button onClick={() => setShowUpload(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Upload Note
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search notes, subjects, users..."
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
            <CardTitle>Upload Note</CardTitle>
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

            <div className="space-y-2">
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.ppt,.pptx,.doc,.docx,.mp3,.mp4"
              />
              <p className="text-sm text-muted-foreground">
                Supported formats: PDF, PPT, DOC, MP3, MP4 (Max 50MB)
              </p>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Note'}
              </Button>
              <Button variant="outline" onClick={() => {setShowUpload(false); setUploadFile(null);}}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredNotes.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="text-center p-8">
                <p className="text-muted-foreground">No notes uploaded yet</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          filteredNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* <div className="font-semibold text-lg text-foreground">
                    {note.title}
                  </div> */}
                  
                  <div className="font-medium text-sm text-foreground">
                    {note.profiles.name || note.profiles.username}
                    {note.profiles.is_deleted && (
                      <span className="text-sm text-muted-foreground ml-2">(deleted user)</span>
                    )}
                  </div>
                                    
                  {note.title && note.title !== 'note' && (
                    <div className="font-medium text-foreground">{note.title}</div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    {note.branch && `${note.branch} • `}
                    {note.semester && `Semester ${note.semester} • `}
                    {note.subject}
                  </div>
                  
                  {note.description && (
                    <div className="text-sm text-foreground">{note.description}</div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(note.file_url, '_blank', 'noopener,noreferrer')}
                        className="flex items-center gap-2"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = note.file_url;
                        link.download = note.file_name;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike(note.id, note.user_liked || false)}
                        className={`flex items-center gap-1 ${note.user_liked ? 'text-red-500' : ''}`}
                      >
                        <Heart className={`h-4 w-4 ${note.user_liked ? 'fill-current' : ''}`} />
                        {note.likes_count}
                      </Button>
                      
                      {note.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <span>
                      {new Date(note.created_at).toLocaleDateString('en-GB')}
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