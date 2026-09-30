-- ============================================================
-- PHASE 1 — FONDATIONS : types
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'disabled', 'deleted');
CREATE TYPE public.gender AS ENUM ('male', 'female');
CREATE TYPE public.profile_status AS ENUM ('incomplete', 'active', 'hidden', 'suspended');
CREATE TYPE public.profile_visibility AS ENUM ('visible', 'hidden');
CREATE TYPE public.photo_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.like_kind AS ENUM ('like', 'pass');
CREATE TYPE public.like_status AS ENUM ('active', 'withdrawn');
CREATE TYPE public.match_status AS ENUM ('active', 'unmatched', 'blocked');
CREATE TYPE public.conversation_status AS ENUM ('open', 'locked', 'closed');
CREATE TYPE public.message_status AS ENUM ('delivered', 'blocked', 'deleted');
CREATE TYPE public.moderation_status AS ENUM ('clean', 'flagged', 'rejected');
CREATE TYPE public.unlock_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE public.subscription_plan AS ENUM ('premium_monthly');
CREATE TYPE public.subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
CREATE TYPE public.payment_type AS ENUM ('conversation_unlock', 'subscription');
CREATE TYPE public.payment_status AS ENUM ('pending', 'succeeded', 'failed', 'cancelled', 'refunded');
CREATE TYPE public.report_reason AS ENUM ('fake_profile', 'harassment', 'inappropriate_content', 'scam', 'suspicious_behavior', 'other');
CREATE TYPE public.report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE public.moderation_action_type AS ENUM ('warn', 'suspend', 'unsuspend', 'disable', 'delete_photo', 'hide_profile', 'note');

-- ============================================================
-- Utilitaires
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============================================================
-- users (miroir applicatif du compte) + rôles séparés
-- ============================================================
CREATE TABLE public.users (
  id uuid PRIMARY KEY,
  email text NOT NULL UNIQUE,
  status public.account_status NOT NULL DEFAULT 'active',
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- ============================================================
-- profiles / christian_profiles / preferences / photos
-- ============================================================
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  first_name text,
  birth_date date,
  gender public.gender,
  city text,
  country text,
  latitude double precision,
  longitude double precision,
  profession text,
  education_level text,
  marital_status text,
  has_children boolean,
  children_count smallint,
  bio text,
  personality jsonb NOT NULL DEFAULT '{}'::jsonb,
  interests text[] NOT NULL DEFAULT '{}',
  status public.profile_status NOT NULL DEFAULT 'incomplete',
  visibility public.profile_visibility NOT NULL DEFAULT 'visible',
  onboarding_step smallint NOT NULL DEFAULT 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_bio_length CHECK (bio IS NULL OR char_length(bio) <= 2000),
  CONSTRAINT profiles_first_name_length CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 60)
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX profiles_discovery_idx ON public.profiles (status, visibility, gender, city);

CREATE TABLE public.christian_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  denomination text,
  faith_commitment text,
  church_attendance text,
  prayer_practice text,
  faith_importance text,
  marriage_vision text,
  couple_vision text,
  christian_values text[] NOT NULL DEFAULT '{}',
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.christian_profiles TO authenticated;
GRANT ALL ON public.christian_profiles TO service_role;
ALTER TABLE public.christian_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.preferences (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  min_age smallint NOT NULL DEFAULT 18,
  max_age smallint NOT NULL DEFAULT 60,
  preferred_gender public.gender,
  city text,
  country text,
  max_distance_km integer,
  relationship_goal text,
  family_project text,
  christian_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preferences_age_range CHECK (min_age >= 18 AND max_age >= min_age AND max_age <= 99)
);
GRANT SELECT, UPDATE ON public.preferences TO authenticated;
GRANT ALL ON public.preferences TO service_role;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  position smallint NOT NULL DEFAULT 0,
  status public.photo_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, storage_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX photos_user_idx ON public.photos (user_id, position);
CREATE UNIQUE INDEX photos_one_primary_idx ON public.photos (user_id) WHERE is_primary;

-- ============================================================
-- blocks (déclaré tôt : utilisé par les politiques)
-- ============================================================
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX blocks_blocked_idx ON public.blocks (blocked_id);

CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  )
$$;

-- ============================================================
-- likes / matches / conversations / messages
-- ============================================================
CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind public.like_kind NOT NULL DEFAULT 'like',
  status public.like_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, receiver_id),
  CONSTRAINT likes_no_self CHECK (sender_id <> receiver_id)
);
GRANT SELECT, INSERT, UPDATE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE INDEX likes_receiver_idx ON public.likes (receiver_id, kind, status);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.match_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_1_id, user_2_id),
  CONSTRAINT matches_ordered_pair CHECK (user_1_id < user_2_id)
);
GRANT SELECT ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX matches_user_2_idx ON public.matches (user_2_id);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  user_1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'open',
  free_messages_used smallint NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_ordered_pair CHECK (user_1_id < user_2_id)
);
GRANT SELECT ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX conversations_user_1_idx ON public.conversations (user_1_id, last_message_at DESC);
CREATE INDEX conversations_user_2_idx ON public.conversations (user_2_id, last_message_at DESC);

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = _conversation_id AND (_user_id = user_1_id OR _user_id = user_2_id)
  )
$$;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  status public.message_status NOT NULL DEFAULT 'delivered',
  moderation_status public.moderation_status NOT NULL DEFAULT 'clean',
  moderation_flags jsonb NOT NULL DEFAULT '{}'::jsonb,
  contains_phone_number boolean NOT NULL DEFAULT false,
  blocked_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 4000)
);
GRANT SELECT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);

-- ============================================================
-- payments / conversation_unlocks / subscriptions
-- ============================================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type public.payment_type NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'XAF',
  provider text NOT NULL,
  provider_transaction_id text,
  status public.payment_status NOT NULL DEFAULT 'pending',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_positive CHECK (amount > 0)
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX payments_user_idx ON public.payments (user_id, created_at DESC);
CREATE UNIQUE INDEX payments_provider_tx_idx ON public.payments (provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;

CREATE TABLE public.conversation_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  paid_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 350,
  currency text NOT NULL DEFAULT 'XAF',
  starts_at timestamptz,
  expires_at timestamptz,
  status public.unlock_status NOT NULL DEFAULT 'pending',
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unlocks_period CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
GRANT SELECT ON public.conversation_unlocks TO authenticated;
GRANT ALL ON public.conversation_unlocks TO service_role;
ALTER TABLE public.conversation_unlocks ENABLE ROW LEVEL SECURITY;
CREATE INDEX unlocks_conversation_idx ON public.conversation_unlocks (conversation_id, status, expires_at DESC);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'premium_monthly',
  amount integer NOT NULL DEFAULT 2500,
  currency text NOT NULL DEFAULT 'XAF',
  status public.subscription_status NOT NULL DEFAULT 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_period CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at > starts_at)
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX subscriptions_user_idx ON public.subscriptions (user_id, status, expires_at DESC);

CREATE OR REPLACE FUNCTION public.is_premium(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id AND status = 'active' AND starts_at <= now() AND expires_at > now()
  )
$$;

-- ============================================================
-- reports / moderation_actions / user_activity
-- ============================================================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason public.report_reason NOT NULL,
  description text,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reports_no_self CHECK (reporter_id <> reported_user_id),
  CONSTRAINT reports_description_length CHECK (description IS NULL OR char_length(description) <= 2000)
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE INDEX reports_status_idx ON public.reports (status, created_at DESC);

CREATE TABLE public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action public.moderation_action_type NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
CREATE INDEX moderation_actions_target_idx ON public.moderation_actions (target_user_id, created_at DESC);

CREATE TABLE public.user_activity (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  is_online boolean NOT NULL DEFAULT false,
  login_count integer NOT NULL DEFAULT 0,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.user_activity TO authenticated;
GRANT ALL ON public.user_activity TO service_role;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Triggers updated_at
-- ============================================================
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER christian_profiles_updated_at BEFORE UPDATE ON public.christian_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON public.preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_activity_updated_at BEFORE UPDATE ON public.user_activity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Provisionnement à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email) VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.profiles (user_id, first_name)
    VALUES (NEW.id, NULLIF(NEW.raw_user_meta_data ->> 'first_name', ''));
  INSERT INTO public.christian_profiles (user_id) VALUES (NEW.id);
  INSERT INTO public.preferences (user_id) VALUES (NEW.id);
  INSERT INTO public.user_activity (user_id, last_login_at, last_seen_at) VALUES (NEW.id, now(), now());
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Empêche un utilisateur de changer son propre statut de compte ou son email via l'API
CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    NEW.status := OLD.status;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER users_protect_columns BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();

-- Empêche un utilisateur de s'auto-approuver une photo ou de forcer un statut de profil suspendu → actif
CREATE OR REPLACE FUNCTION public.protect_photo_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.status := 'pending';
    ELSE NEW.status := OLD.status; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER photos_protect_status BEFORE INSERT OR UPDATE ON public.photos FOR EACH ROW EXECUTE FUNCTION public.protect_photo_status();

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL AND OLD.status = 'suspended' THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER profiles_protect_status BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();

-- ============================================================
-- POLITIQUES RLS
-- ============================================================
-- users
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "users_select_admin" ON public.users FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "users_update_admin" ON public.users FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- user_roles (lecture de ses propres rôles ; gestion réservée au serveur)
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin());

-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_select_visible" ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND status = 'active' AND visibility = 'visible'
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = profiles.user_id AND u.status = 'active')
  );
CREATE POLICY "profiles_select_admin" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- christian_profiles (même visibilité que le profil)
CREATE POLICY "christian_select_own" ON public.christian_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "christian_select_visible" ON public.christian_profiles FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid()
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
                WHERE p.user_id = christian_profiles.user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active')
  );
CREATE POLICY "christian_select_admin" ON public.christian_profiles FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "christian_update_own" ON public.christian_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- preferences (strictement privées)
CREATE POLICY "preferences_select_own" ON public.preferences FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "preferences_update_own" ON public.preferences FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "preferences_select_admin" ON public.preferences FOR SELECT TO authenticated USING (public.is_admin());

-- photos
CREATE POLICY "photos_select_own" ON public.photos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "photos_select_visible" ON public.photos FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid() AND status = 'approved'
    AND NOT public.is_blocked_between(auth.uid(), user_id)
    AND EXISTS (SELECT 1 FROM public.profiles p JOIN public.users u ON u.id = p.user_id
                WHERE p.user_id = photos.user_id AND p.status = 'active' AND p.visibility = 'visible' AND u.status = 'active')
  );
CREATE POLICY "photos_select_admin" ON public.photos FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "photos_insert_own" ON public.photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "photos_update_own" ON public.photos FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "photos_update_admin" ON public.photos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "photos_delete_own" ON public.photos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "photos_delete_admin" ON public.photos FOR DELETE TO authenticated USING (public.is_admin());

-- blocks
CREATE POLICY "blocks_select_own" ON public.blocks FOR SELECT TO authenticated USING (blocker_id = auth.uid());
CREATE POLICY "blocks_select_admin" ON public.blocks FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "blocks_insert_own" ON public.blocks FOR INSERT TO authenticated WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "blocks_delete_own" ON public.blocks FOR DELETE TO authenticated USING (blocker_id = auth.uid());

-- likes (le destinataire ne voit pas les likes reçus : règle gratuite ; création des matchs côté serveur)
CREATE POLICY "likes_select_sent" ON public.likes FOR SELECT TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "likes_select_admin" ON public.likes FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND sender_id <> receiver_id AND NOT public.is_blocked_between(sender_id, receiver_id));
CREATE POLICY "likes_update_own" ON public.likes FOR UPDATE TO authenticated USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- matches / conversations / messages : lecture participants ; écriture serveur uniquement
CREATE POLICY "matches_select_participant" ON public.matches FOR SELECT TO authenticated USING (auth.uid() IN (user_1_id, user_2_id));
CREATE POLICY "matches_select_admin" ON public.matches FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "conversations_select_participant" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (user_1_id, user_2_id));
CREATE POLICY "conversations_select_admin" ON public.conversations FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "messages_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (status = 'delivered' AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "messages_select_own_blocked" ON public.messages FOR SELECT TO authenticated
  USING (sender_id = auth.uid());
CREATE POLICY "messages_select_admin" ON public.messages FOR SELECT TO authenticated USING (public.is_admin());

-- monétisation : lecture propriétaire / participants ; écriture serveur (confirmation prestataire)
CREATE POLICY "payments_select_own" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "payments_select_admin" ON public.payments FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "unlocks_select_participant" ON public.conversation_unlocks FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "unlocks_select_admin" ON public.conversation_unlocks FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subscriptions_select_admin" ON public.subscriptions FOR SELECT TO authenticated USING (public.is_admin());

-- reports
CREATE POLICY "reports_select_own" ON public.reports FOR SELECT TO authenticated USING (reporter_id = auth.uid());
CREATE POLICY "reports_select_admin" ON public.reports FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "reports_insert_own" ON public.reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "reports_update_admin" ON public.reports FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT UPDATE ON public.reports TO authenticated;

-- moderation_actions
CREATE POLICY "moderation_select_admin" ON public.moderation_actions FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "moderation_insert_admin" ON public.moderation_actions FOR INSERT TO authenticated WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- user_activity (privé ; l'affichage « actif récemment » des autres passera par une fonction serveur dédiée)
CREATE POLICY "activity_select_own" ON public.user_activity FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "activity_update_own" ON public.user_activity FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "activity_select_admin" ON public.user_activity FOR SELECT TO authenticated USING (public.is_admin());

-- Présence approximative d'un autre membre, sans exposer les horodatages exacts
CREATE OR REPLACE FUNCTION public.get_presence(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN a.last_seen_at IS NULL THEN 'unknown'
    WHEN a.last_seen_at > now() - interval '5 minutes' THEN 'online'
    WHEN a.last_seen_at > now() - interval '24 hours' THEN 'recent'
    WHEN a.last_seen_at > now() - interval '7 days' THEN 'this_week'
    ELSE 'inactive'
  END
  FROM public.user_activity a
  WHERE a.user_id = _user_id
    AND auth.uid() IS NOT NULL
    AND NOT public.is_blocked_between(auth.uid(), _user_id)
$$;

-- Mise à jour de la présence par l'utilisateur lui-même
CREATE OR REPLACE FUNCTION public.touch_activity()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.user_activity SET last_seen_at = now(), is_online = true WHERE user_id = auth.uid();
  UPDATE public.users SET last_active_at = now() WHERE id = auth.uid();
$$;