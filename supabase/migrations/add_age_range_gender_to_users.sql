-- Add optional age_range and gender columns to users with check constraints.
-- Run this migration in Supabase (SQL Editor or CLI); do not run from app code.

alter table users
add column if not exists age_range text,
add column if not exists gender text;

alter table users
drop constraint if exists age_range_check;

alter table users
add constraint age_range_check
check (
  age_range in ('18-24','25-34','35-44','45-54','55+','prefer_not_to_say')
  or age_range is null
);

alter table users
drop constraint if exists gender_check;

alter table users
add constraint gender_check
check (
  gender in ('male','female','prefer_not_to_say')
  or gender is null
);
