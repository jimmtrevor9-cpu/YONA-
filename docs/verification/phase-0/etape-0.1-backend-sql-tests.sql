-- YONA — Phase 0 / Étape 0.1 — Tests fonctionnels des fonctions SQL du backend.
-- À exécuter UNIQUEMENT sur une base PostgreSQL locale jetable (stubs auth/storage
-- + migrations supabase/migrations appliquées). Tout est annulé par ROLLBACK final.
-- Les 3 comptes créés sont des comptes de TEST temporaires (domaine example.test).
\set ON_ERROR_STOP 0
begin;
-- 3 comptes de test : A, B (gratuits), C (premium)
insert into auth.users (id,email,raw_user_meta_data) values
 ('aaaaaaaa-0000-4000-8000-000000000001','test-a@example.test','{"first_name":"TestA"}'),
 ('bbbbbbbb-0000-4000-8000-000000000002','test-b@example.test','{"first_name":"TestB"}'),
 ('cccccccc-0000-4000-8000-000000000003','test-c@example.test','{}');
select 'T1 provisionnement handle_new_user', (select count(*) from public.users)=3 and (select count(*) from public.profiles)=3 and (select count(*) from public.christian_profiles)=3 and (select count(*) from public.preferences)=3 and (select count(*) from public.user_activity)=3 and (select count(*) from public.user_roles where role='user')=3;
select 'T2 prénom vide -> NULL', (select first_name from public.profiles where user_id='cccccccc-0000-4000-8000-000000000003') is null;
insert into public.payments (id,user_id,type,amount,provider,status) values ('dddddddd-0000-4000-8000-000000000004','cccccccc-0000-4000-8000-000000000003','subscription',500,'test','succeeded');
insert into public.subscriptions (user_id,plan,status,starts_at,expires_at,payment_id) values ('cccccccc-0000-4000-8000-000000000003','premium_monthly','active',now()-interval '1 day',now()+interval '29 days','dddddddd-0000-4000-8000-000000000004');
select 'T3 is_premium C=true, A=false', public.is_premium('cccccccc-0000-4000-8000-000000000003') and not public.is_premium('aaaaaaaa-0000-4000-8000-000000000001');
insert into public.matches (id,user_1_id,user_2_id) values ('eeeeeeee-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002');
insert into public.conversations (id,match_id,user_1_id,user_2_id) values ('ffffffff-0000-4000-8000-000000000006','eeeeeeee-0000-4000-8000-000000000005','aaaaaaaa-0000-4000-8000-000000000001','bbbbbbbb-0000-4000-8000-000000000002') on conflict (match_id) do update set id = excluded.id; -- depuis l'étape 4.1, la base crée déjà la conversation du Match

set local role authenticated;
-- === Utilisateur A ===
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
select 'T4 has_role(A,user)=true, is_admin()=false', public.has_role(auth.uid(),'user') and not public.is_admin();
select 'T5 quota conv A initial', public.get_conversation_quota('ffffffff-0000-4000-8000-000000000006');
select 'T6 A msg1', public.consume_free_message('ffffffff-0000-4000-8000-000000000006')->>'used';
select 'T6 A msg2', public.consume_free_message('ffffffff-0000-4000-8000-000000000006')->>'used';
select 'T6 A msg3', public.consume_free_message('ffffffff-0000-4000-8000-000000000006')->>'used';
select 'T7 A msg4 refusé', public.consume_free_message('ffffffff-0000-4000-8000-000000000006');
-- === Utilisateur B : quota indépendant ===
select set_config('request.jwt.claim.sub','bbbbbbbb-0000-4000-8000-000000000002',true);
select 'T8 B quota indépendant', public.get_conversation_quota('ffffffff-0000-4000-8000-000000000006');
-- === Utilisateur C : pas participant ===
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',true);
select 'T9 C non participant', public.consume_free_message('ffffffff-0000-4000-8000-000000000006');
-- === IA ===
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
select 'T10 IA A q1..q4', public.consume_ai_quota()->>'allowed', public.consume_ai_quota()->>'allowed', public.consume_ai_quota()->>'allowed', public.consume_ai_quota();
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',true);
select 'T11 IA premium C q1..q4', public.consume_ai_quota()->>'allowed', public.consume_ai_quota()->>'allowed', public.consume_ai_quota()->>'allowed', public.consume_ai_quota()->>'allowed';
-- === Visites ===
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
select public.record_profile_visit('cccccccc-0000-4000-8000-000000000003');
select public.record_profile_visit('cccccccc-0000-4000-8000-000000000003');
select public.record_profile_visit('aaaaaaaa-0000-4000-8000-000000000001');
select 'T12 visites A (anti-spam 1h + pas d''auto-visite) = 1', count(*) from public.profile_visits;
select 'T13 visiteurs vus par A (gratuit) = 0', count(*) from public.get_profile_visitors();
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000003',true);
select 'T14 visiteurs vus par C (premium) = 1', count(*) from public.get_profile_visitors();
-- === Présence ===
select public.touch_activity();
select set_config('request.jwt.claim.sub','aaaaaaaa-0000-4000-8000-000000000001',true);
select 'T15 get_presence(C) vu par A', public.get_presence('cccccccc-0000-4000-8000-000000000003');
-- === Photos : limite 3 en gratuit ===
insert into public.photos (user_id,storage_path) values (auth.uid(),auth.uid()||'/1.jpg'),(auth.uid(),auth.uid()||'/2.jpg'),(auth.uid(),auth.uid()||'/3.jpg');
select 'T16 statut photo forcé pending', string_agg(distinct status::text,',') from public.photos;
-- T17 : 4e photo en gratuit (attendu : photo_limit_reached)
savepoint p; insert into public.photos (user_id,storage_path) values (auth.uid(),auth.uid()||'/4.jpg'); rollback to savepoint p;
-- === Protection colonnes ===
update public.users set status='suspended', email='x@x' where id=auth.uid();
select 'T18 A ne peut pas changer son statut/email', status||' / '||email from public.users where id=auth.uid();
-- === Appel direct des fonctions internes ===
-- T19 : appel direct de handle_new_user (attendu : permission denied)
savepoint q; select public.handle_new_user(); rollback to savepoint q;
reset role;
set local role anon;
savepoint r; select 'T20 anon -> is_premium (attendu : permission denied)', public.is_premium('cccccccc-0000-4000-8000-000000000003'); rollback to savepoint r;
rollback;
