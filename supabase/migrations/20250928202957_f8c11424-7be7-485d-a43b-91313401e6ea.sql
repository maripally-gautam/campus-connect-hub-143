-- Add email field to profiles table to store user email for username lookup
ALTER TABLE public.profiles ADD COLUMN email TEXT;

-- Update existing profiles with their email from auth.users via trigger
-- We'll create a function to sync email from auth.users
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
  -- Update existing profiles where email is null
  -- We can't directly access auth.users, so we'll use the user_id to get email
  UPDATE public.profiles 
  SET email = auth.users.email 
  FROM auth.users 
  WHERE profiles.user_id = auth.users.id AND profiles.email IS NULL;
END;
$$;

-- Update the handle_new_user trigger to also set email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, email)
  VALUES (NEW.id, NEW.email, NEW.email);
  RETURN NEW;
END;
$$;