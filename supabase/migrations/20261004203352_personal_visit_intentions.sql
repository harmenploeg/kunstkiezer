-- Reuse the private, owner-scoped collection. Existing visits remain seen.
alter table public.kk_seen add column status text not null default 'seen'
 check (status in ('seen','wanted'));
alter table public.kk_seen add constraint wanted_has_no_rating
 check (status = 'seen' or rating is null);
-- Existing ownership RLS/grants remain intact. Wanted entries cannot contribute
-- to kk_rating_totals, which only aggregates non-null ratings.
