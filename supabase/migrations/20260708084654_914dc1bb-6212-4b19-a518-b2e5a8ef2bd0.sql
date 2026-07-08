
-- 1. Role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'doctor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role SECURITY DEFINER function (avoids recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 4. user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Seed current admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'gyndok@yahoo.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Rewrite existing policies that used the hardcoded email

-- assignments
DROP POLICY IF EXISTS "Admin can manage assignments" ON public.assignments;
CREATE POLICY "Admin can manage assignments" ON public.assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Everyone can view completed assignments or admin can view all" ON public.assignments;
CREATE POLICY "Everyone can view completed assignments or admin can view all" ON public.assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.blocks WHERE blocks.id = assignments.block_id AND blocks.status = 'published')
    OR public.has_role(auth.uid(), 'admin')
  );

-- calendar_publishes
DROP POLICY IF EXISTS "Only admin can access calendar publishes" ON public.calendar_publishes;
CREATE POLICY "Only admin can access calendar publishes" ON public.calendar_publishes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- doctor_requests
DROP POLICY IF EXISTS "Doctors can insert their own requests" ON public.doctor_requests;
CREATE POLICY "Doctors can insert their own requests" ON public.doctor_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Doctors can update their own requests or admin can update all" ON public.doctor_requests;
CREATE POLICY "Doctors can update their own requests or admin can update all" ON public.doctor_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Doctors can view own requests and others' submitted requests" ON public.doctor_requests;
CREATE POLICY "Doctors can view own requests and others' submitted requests" ON public.doctor_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR ((status = 'submitted') AND auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.doctors WHERE doctors.auth_user_id = auth.uid()))
    OR public.has_role(auth.uid(), 'admin')
  );

-- doctors
DROP POLICY IF EXISTS "Only admin can delete doctors" ON public.doctors;
CREATE POLICY "Only admin can delete doctors" ON public.doctors
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admin can insert doctors" ON public.doctors;
CREATE POLICY "Only admin can insert doctors" ON public.doctors
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- emails
DROP POLICY IF EXISTS "Only admin can access emails" ON public.emails;
CREATE POLICY "Only admin can access emails" ON public.emails
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- system_settings
DROP POLICY IF EXISTS "Only admin can manage system settings" ON public.system_settings;
CREATE POLICY "Only admin can manage system settings" ON public.system_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
