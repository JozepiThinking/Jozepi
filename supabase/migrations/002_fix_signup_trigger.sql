-- ============================================================
-- Correção: "Database error saving new user" no cadastro
-- Execute este SQL no Supabase → SQL Editor → Run
-- ============================================================

-- Permissões para o Auth criar workshop e profile no trigger
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.workshops TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workshop_id UUID;
  workshop_name TEXT;
  base_slug TEXT;
  final_slug TEXT;
BEGIN
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

  INSERT INTO public.profiles (id, workshop_id, full_name)
  VALUES (
    NEW.id,
    new_workshop_id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      split_part(NEW.email, '@', 1)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
