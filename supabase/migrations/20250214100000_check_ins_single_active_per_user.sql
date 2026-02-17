-- Single-active-court rule: a user can be checked in at most one court at a time.
-- Check-out deletes the row, so UNIQUE(user_id) enforces one row per user (one active check-in).
-- Prevents race conditions; server is source of truth.
ALTER TABLE public.check_ins
ADD CONSTRAINT check_ins_user_id_key UNIQUE (user_id);
