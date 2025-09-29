import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
}

interface UploadResponse {
  success: boolean;
  fileId?: string;
  fileName?: string;
  viewUrl?: string;
  downloadUrl?: string;
  error?: string;
}

async function getAccessToken(serviceAccountJson: any): Promise<string> {
  const privateKey = serviceAccountJson.private_key;
  const clientEmail = serviceAccountJson.client_email;
  const tokenUri = serviceAccountJson.token_uri;

  // Create JWT header
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Create signature
  const textToSign = `${encodedHeader}.${encodedPayload}`;
  
  // Import private key
  const pemKey = privateKey.replace(/\\n/g, '\n');
  const binaryKey = pemToBinary(pemKey);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the JWT
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(textToSign)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${textToSign}.${encodedSignature}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function pemToBinary(pem: string): ArrayBuffer {
  const pemContent = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  
  const binaryString = atob(pemContent);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function uploadToDrive(
  accessToken: string,
  file: File,
  folderId: string,
  fileName?: string
): Promise<GoogleDriveFile> {
  const metadata = {
    name: fileName || file.name,
    parents: [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Upload failed: ${uploadResponse.statusText} - ${errorText}`);
  }

  return await uploadResponse.json();
}

async function setFilePermissions(accessToken: string, fileId: string): Promise<void> {
  const permissionResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    }
  );

  if (!permissionResponse.ok) {
    throw new Error(`Failed to set permissions: ${permissionResponse.statusText}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting file upload to Google Drive...');
    
    // Get secrets
    const serviceAccountJsonStr = Deno.env.get('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON');
    const folderId = Deno.env.get('GOOGLE_DRIVE_FOLDER_ID');

    if (!serviceAccountJsonStr || !folderId) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing Google Drive configuration' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const serviceAccountJson = JSON.parse(serviceAccountJsonStr);

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string | null;

    if (!file) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file provided' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB in bytes
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File size exceeds 50MB limit' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Uploading file: ${file.name}, size: ${file.size} bytes`);

    // Get access token
    const accessToken = await getAccessToken(serviceAccountJson);
    console.log('Got access token successfully');

    // Upload file to Drive
    const uploadedFile = await uploadToDrive(accessToken, file, folderId, fileName || undefined);
    console.log(`File uploaded with ID: ${uploadedFile.id}`);

    // Set permissions to make file public
    await setFilePermissions(accessToken, uploadedFile.id);
    console.log('File permissions set to public');

    // Generate URLs
    const viewUrl = `https://drive.google.com/file/d/${uploadedFile.id}/view`;
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${uploadedFile.id}`;

    const response: UploadResponse = {
      success: true,
      fileId: uploadedFile.id,
      fileName: uploadedFile.name,
      viewUrl,
      downloadUrl,
    };

    console.log('Upload completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in upload-to-drive function:', error);
    
    const response: UploadResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});