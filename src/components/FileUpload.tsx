import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  viewUrl?: string;
  downloadUrl?: string;
  error?: string;
}

export default function FileUpload() {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (50MB limit)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 50MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload files",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('fileName', selectedFile.name);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('upload-to-drive', {
        body: formData,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setUploadResult(data);
        
        // Store the file information in Supabase database
        // You can customize this based on which table you want to store in
        const { error: dbError } = await supabase.from('notes').insert({
          file_name: data.fileName,
          file_url: data.downloadUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          title: selectedFile.name,
          description: `Uploaded to Google Drive - View: ${data.viewUrl}`,
          user_id: user.id,
        });

        if (dbError) {
          console.error('Failed to save file info to database:', dbError);
          toast({
            title: "Upload successful, but...",
            description: "File uploaded to Drive but failed to save to database",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Upload successful!",
            description: `${selectedFile.name} has been uploaded to Google Drive`,
          });
        }
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      setUploadResult({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload to Google Drive
          </CardTitle>
          <CardDescription>
            Upload files to Google Drive (up to 50MB). Supports PDF, PPT, DOC, MP3, MP4, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div>
            <Input
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.mp3,.mp4,.avi,.mov,.txt,.jpg,.jpeg,.png"
              disabled={uploading}
            />
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <File className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)} • {selectedFile.type || 'Unknown type'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Upload Button */}
          <Button 
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Upload to Google Drive'}
          </Button>

          {/* Upload Result */}
          {uploadResult && (
            <Card className={uploadResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    {uploadResult.success ? (
                      <>
                        <p className="font-medium text-green-800">Upload Successful!</p>
                        <p className="text-sm text-green-700 mb-3">
                          {uploadResult.fileName} has been uploaded to Google Drive
                        </p>
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(uploadResult.viewUrl, '_blank')}
                            className="mr-2"
                          >
                            View File
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(uploadResult.downloadUrl, '_blank')}
                          >
                            Download File
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-red-800">Upload Failed</p>
                        <p className="text-sm text-red-700">{uploadResult.error}</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}