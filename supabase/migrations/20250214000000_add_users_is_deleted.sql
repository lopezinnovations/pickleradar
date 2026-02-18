-- Add is_deleted for soft-delete (launch-safe account deletion)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Ensure existing rows are not marked deleted
UPDATE public.users SET is_deleted = false WHERE is_deleted IS NULL;
