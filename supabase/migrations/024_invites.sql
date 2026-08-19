-- ============================================================
-- Convites para cadastro: tabela + trigger handle_new_user
-- Execute no Supabase → SQL Editor → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Tabela
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invites (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  workshop_id  UUID NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email        TEXT,
  status       TEXT NOT NULL DEFAULT 'pendente'
                 CHECK (status IN ('pendente', 'usado', 'expirado', 'revogado')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at      TIMESTAMPTZ,
  used_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invites_token_min_length CHECK (char_length(token) >= 32),
  CONSTRAINT invites_email_format CHECK (
    email IS NULL OR email ~ '^[^@]+@[^@]+\.[^@]+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_invites_workshop_created
  ON public.invites (workshop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invites_status_expires
  ON public.invites (status, expires_at);

-- ------------------------------------------------------------
-- Normaliza e-mail opcional (vazio = convite aberto)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_invite_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := NULLIF(LOWER(TRIM(COALESCE(NEW.email, ''))), '');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invites_normalize_email ON public.invites;
CREATE TRIGGER invites_normalize_email
  BEFORE INSERT OR UPDATE OF email ON public.invites
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_invite_email();

-- ------------------------------------------------------------
-- RLS: qualquer membro da oficina (mesmo acesso que owner, por enquanto)
-- ------------------------------------------------------------

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.invites FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.invites TO authenticated;
GRANT ALL ON TABLE public.invites TO supabase_auth_admin;

DROP POLICY IF EXISTS invites_select_own_workshop ON public.invites;
CREATE POLICY invites_select_own_workshop
  ON public.invites
  FOR SELECT
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS invites_insert_own_workshop ON public.invites;
CREATE POLICY invites_insert_own_workshop
  ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND workshop_id IN (
      SELECT profiles.workshop_id
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

DROP POLICY IF EXISTS invites_update_own_workshop ON public.invites;
CREATE POLICY invites_update_own_workshop
  ON public.invites
  FOR UPDATE
  TO authenticated
  USING (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    workshop_id IN (
      SELECT profiles.workshop_id
      FROM public.profiles
      WHERE profiles.id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- RPCs públicas de cadastro (anon): não expõem outros convites
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.signup_requires_invite()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.workshops);
$$;

CREATE OR REPLACE FUNCTION public.get_signup_invite(p_token text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_row public.invites%ROWTYPE;
  workshop_name TEXT;
BEGIN
  IF p_token IS NULL OR char_length(TRIM(p_token)) < 32 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid');
  END IF;

  SELECT *
    INTO invite_row
  FROM public.invites
  WHERE token = TRIM(p_token);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid');
  END IF;

  IF invite_row.status = 'revogado' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'revoked');
  END IF;

  IF invite_row.status = 'usado' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'used');
  END IF;

  IF invite_row.status <> 'pendente' OR invite_row.expires_at <= NOW() THEN
    IF invite_row.status = 'pendente' THEN
      UPDATE public.invites
      SET status = 'expirado'
      WHERE id = invite_row.id
        AND status = 'pendente';
    END IF;

    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;

  SELECT name INTO workshop_name
  FROM public.workshops
  WHERE id = invite_row.workshop_id;

  RETURN jsonb_build_object(
    'valid', true,
    'workshop_name', COALESCE(workshop_name, 'Oficina'),
    'email', invite_row.email,
    'expires_at', invite_row.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.signup_requires_invite() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_signup_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.signup_requires_invite() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_signup_invite(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- Trigger de cadastro: convite válido → entra na oficina;
-- sem token, só permite se ainda não existir nenhuma oficina.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_token TEXT;
  invite_row public.invites%ROWTYPE;
  new_workshop_id UUID;
  workshop_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
  profile_name TEXT;
BEGIN
  profile_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );

  invite_token := NULLIF(TRIM(NEW.raw_user_meta_data->>'invite_token'), '');

  IF invite_token IS NOT NULL THEN
    SELECT *
      INTO invite_row
    FROM public.invites
    WHERE token = invite_token
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Convite inválido';
    END IF;

    IF invite_row.status = 'revogado' THEN
      RAISE EXCEPTION 'Convite revogado';
    END IF;

    IF invite_row.status = 'usado' THEN
      RAISE EXCEPTION 'Convite já utilizado';
    END IF;

    IF invite_row.status <> 'pendente' OR invite_row.expires_at <= NOW() THEN
      IF invite_row.status = 'pendente' THEN
        UPDATE public.invites
        SET status = 'expirado'
        WHERE id = invite_row.id;
      END IF;
      RAISE EXCEPTION 'Convite expirado';
    END IF;

    IF invite_row.email IS NOT NULL
       AND LOWER(NEW.email) <> invite_row.email THEN
      RAISE EXCEPTION 'Este convite é válido apenas para %', invite_row.email;
    END IF;

    INSERT INTO public.profiles (id, workshop_id, full_name, role)
    VALUES (NEW.id, invite_row.workshop_id, profile_name, 'member');

    UPDATE public.invites
    SET
      status = 'usado',
      used_at = NOW(),
      used_by = NEW.id
    WHERE id = invite_row.id;

    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.workshops) THEN
    RAISE EXCEPTION 'Cadastro disponível apenas por convite';
  END IF;

  workshop_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'workshop_name'), ''),
    'Minha Estética Automotiva'
  );

  base_slug := regexp_replace(lower(workshop_name), '[^a-z0-9]+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  IF base_slug = '' THEN
    base_slug := 'oficina';
  END IF;

  final_slug := base_slug || '-' || substr(replace(NEW.id::text, '-', ''), 1, 8);

  INSERT INTO public.workshops (name, slug, email)
  VALUES (workshop_name, final_slug, NEW.email)
  RETURNING id INTO new_workshop_id;

  INSERT INTO public.profiles (id, workshop_id, full_name, role)
  VALUES (NEW.id, new_workshop_id, profile_name, 'owner');

  RETURN NEW;
END;
$$;
