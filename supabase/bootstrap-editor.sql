-- Run in Supabase SQL Editor as project owner AFTER creating your Auth user.
-- Replace the email below with your own account email. No passwords in SQL.
insert into kunstkiezer_private.editors(user_id)
select id from auth.users where lower(email) = lower('VUL_HIER_JE_EIGEN_EMAIL_IN')
on conflict do nothing;
-- Confirm that exactly the intended user is now an editor.
select u.id, u.email from auth.users u join kunstkiezer_private.editors e on e.user_id=u.id;
