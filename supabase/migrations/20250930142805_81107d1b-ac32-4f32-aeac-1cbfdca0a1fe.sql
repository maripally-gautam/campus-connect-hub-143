-- Create storage bucket for notes (if not exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('notes', 'notes', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for notes bucket
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view note files'
  ) THEN
    CREATE POLICY "Anyone can view note files"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'notes');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload note files'
  ) THEN
    CREATE POLICY "Authenticated users can upload note files"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'notes' AND 
      auth.uid() IS NOT NULL
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete their own note files'
  ) THEN
    CREATE POLICY "Users can delete their own note files"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'notes' AND 
      auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Enable UPDATE policy for notes table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'notes' 
    AND policyname = 'Users can update their own notes'
  ) THEN
    CREATE POLICY "Users can update their own notes"
    ON public.notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Enable UPDATE policy for videos table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'videos' 
    AND policyname = 'Users can update their own videos'
  ) THEN
    CREATE POLICY "Users can update their own videos"
    ON public.videos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;