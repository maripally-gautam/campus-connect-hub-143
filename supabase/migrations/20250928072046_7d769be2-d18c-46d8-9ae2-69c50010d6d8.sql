-- Update foreign keys to reference profiles table instead of auth.users
-- First, add foreign key constraints to profiles table for proper joins

-- Drop existing foreign key constraints 
ALTER TABLE public.updates DROP CONSTRAINT IF EXISTS updates_user_id_fkey;
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_user_id_fkey;
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_user_id_fkey;
ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS todos_user_id_fkey;
ALTER TABLE public.likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;

-- Add new foreign key constraints to reference profiles table
ALTER TABLE public.updates 
ADD CONSTRAINT updates_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.requests 
ADD CONSTRAINT requests_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.notes 
ADD CONSTRAINT notes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.videos 
ADD CONSTRAINT videos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.todos 
ADD CONSTRAINT todos_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.likes 
ADD CONSTRAINT likes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;