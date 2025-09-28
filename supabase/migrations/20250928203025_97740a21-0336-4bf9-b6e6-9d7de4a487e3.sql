-- Fix function search path security issue
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
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