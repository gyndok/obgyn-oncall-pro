
-- 1. Fix blocks policies: restrict write ops to admins
DROP POLICY IF EXISTS "Authenticated users can create blocks" ON public.blocks;
DROP POLICY IF EXISTS "Authenticated users can update blocks" ON public.blocks;
DROP POLICY IF EXISTS "Authenticated users can delete blocks" ON public.blocks;

CREATE POLICY "Only admin can create blocks"
  ON public.blocks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admin can update blocks"
  ON public.blocks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admin can delete blocks"
  ON public.blocks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Fix doctor_requests SELECT: remove cross-doctor visibility of submitted requests
DROP POLICY IF EXISTS "Doctors can view own requests and others' submitted requests" ON public.doctor_requests;

CREATE POLICY "Doctors can view own requests or admin views all"
  ON public.doctor_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doctors
      WHERE doctors.id = doctor_requests.doctor_id
        AND doctors.auth_user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. Remove hardcoded admin email in can_access_doctor_record
CREATE OR REPLACE FUNCTION public.can_access_doctor_record(doctor_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    LOWER(auth.email()) = LOWER(doctor_email) AND auth.email() IS NOT NULL
  ) OR public.has_role(auth.uid(), 'admin'::app_role);
END;
$function$;

-- 4. Move SECURITY DEFINER helpers out of the exposed public API schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- Recreate has_role in private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate can_access_doctor_record in private schema
CREATE OR REPLACE FUNCTION private.can_access_doctor_record(doctor_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (
    LOWER(auth.email()) = LOWER(doctor_email) AND auth.email() IS NOT NULL
  ) OR private.has_role(auth.uid(), 'admin'::public.app_role);
END;
$function$;

REVOKE ALL ON FUNCTION private.can_access_doctor_record(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_access_doctor_record(text) TO authenticated, service_role;

-- Update all RLS policies to use private schema functions
-- blocks
DROP POLICY IF EXISTS "Only admin can create blocks" ON public.blocks;
DROP POLICY IF EXISTS "Only admin can update blocks" ON public.blocks;
DROP POLICY IF EXISTS "Only admin can delete blocks" ON public.blocks;
CREATE POLICY "Only admin can create blocks" ON public.blocks FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admin can update blocks" ON public.blocks FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admin can delete blocks" ON public.blocks FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- doctors
DROP POLICY IF EXISTS "Doctors can only view their own record" ON public.doctors;
DROP POLICY IF EXISTS "Doctors can only update their own record" ON public.doctors;
DROP POLICY IF EXISTS "Only admin can insert doctors" ON public.doctors;
DROP POLICY IF EXISTS "Only admin can delete doctors" ON public.doctors;

CREATE POLICY "Doctors can only view their own record" ON public.doctors FOR SELECT
  USING (private.can_access_doctor_record(email));
CREATE POLICY "Doctors can only update their own record" ON public.doctors FOR UPDATE
  USING (private.can_access_doctor_record(email));
CREATE POLICY "Only admin can insert doctors" ON public.doctors FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Only admin can delete doctors" ON public.doctors FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- emails
DROP POLICY IF EXISTS "Only admin can access emails" ON public.emails;
CREATE POLICY "Only admin can access emails" ON public.emails FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- system_settings
DROP POLICY IF EXISTS "Only admin can manage system settings" ON public.system_settings;
CREATE POLICY "Only admin can manage system settings" ON public.system_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- assignments
DROP POLICY IF EXISTS "Admin can manage assignments" ON public.assignments;
DROP POLICY IF EXISTS "Everyone can view completed assignments or admin can view all" ON public.assignments;
CREATE POLICY "Admin can manage assignments" ON public.assignments FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Everyone can view completed assignments or admin can view all" ON public.assignments FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.blocks WHERE blocks.id = assignments.block_id AND blocks.status = 'published')
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- calendar_publishes
DROP POLICY IF EXISTS "Only admin can access calendar publishes" ON public.calendar_publishes;
CREATE POLICY "Only admin can access calendar publishes" ON public.calendar_publishes FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- doctor_requests
DROP POLICY IF EXISTS "Doctors can insert their own requests" ON public.doctor_requests;
DROP POLICY IF EXISTS "Doctors can update their own requests or admin can update all" ON public.doctor_requests;
DROP POLICY IF EXISTS "Doctors can view own requests or admin views all" ON public.doctor_requests;

CREATE POLICY "Doctors can insert their own requests" ON public.doctor_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Doctors can update their own requests or admin can update all" ON public.doctor_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Doctors can view own requests or admin views all" ON public.doctor_requests FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.doctors WHERE doctors.id = doctor_requests.doctor_id AND doctors.auth_user_id = auth.uid())
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Drop the public-schema originals now that policies no longer reference them
DROP FUNCTION IF EXISTS public.can_access_doctor_record(text);
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
