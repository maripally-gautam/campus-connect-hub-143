-- Add title column to updates table
ALTER TABLE public.updates ADD COLUMN title TEXT;

-- Add title column to requests table
ALTER TABLE public.requests ADD COLUMN title TEXT;

-- Add unique constraint on username
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Add is_deleted flag to profiles
ALTER TABLE public.profiles ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;

-- Create chats table for storing chat conversations
CREATE TABLE public.chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('everyone', 'private', 'bot')),
  participant1_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  participant2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_count table to track registrations
CREATE TABLE public.user_count (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_registered INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Initialize user count with current number of users
INSERT INTO public.user_count (total_registered)
SELECT COUNT(*) FROM auth.users;

-- Enable RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_count ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats
CREATE POLICY "Users can view their own chats and everyone chat"
ON public.chats
FOR SELECT
USING (
  type = 'everyone' OR
  type = 'bot' AND participant1_id = auth.uid() OR
  participant1_id = auth.uid() OR 
  participant2_id = auth.uid()
);

CREATE POLICY "Users can create chats"
ON public.chats
FOR INSERT
WITH CHECK (
  participant1_id = auth.uid() OR
  type = 'everyone'
);

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their chats"
ON public.messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
    AND (
      chats.type = 'everyone' OR
      chats.type = 'bot' AND chats.participant1_id = auth.uid() OR
      chats.participant1_id = auth.uid() OR
      chats.participant2_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can create messages in their chats"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.chats
    WHERE chats.id = messages.chat_id
    AND (
      chats.type = 'everyone' OR
      chats.type = 'bot' AND chats.participant1_id = auth.uid() OR
      chats.participant1_id = auth.uid() OR
      chats.participant2_id = auth.uid()
    )
  )
);

-- RLS Policies for user_count (read-only for authenticated users)
CREATE POLICY "Anyone can view user count"
ON public.user_count
FOR SELECT
USING (true);

-- Create function to increment user count on new user registration
CREATE OR REPLACE FUNCTION public.increment_user_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_count 
  SET total_registered = total_registered + 1,
      updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger to increment user count on new user
CREATE TRIGGER on_auth_user_registered
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.increment_user_count();

-- Create everyone chat
INSERT INTO public.chats (type)
VALUES ('everyone');

-- Add indexes for performance
CREATE INDEX idx_chats_participants ON public.chats(participant1_id, participant2_id);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_is_deleted ON public.profiles(is_deleted);