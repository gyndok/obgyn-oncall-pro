import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

/** Links the signed-in user to their doctor record (server-side, safe) once per session. */
export const useFirstLoginTracker = () => {
  const { user, session } = useAuth();

  useEffect(() => {
    if (!user || !session) return;
    supabase.rpc('link_my_doctor_account').then(({ error }) => {
      if (error) console.error('Error linking doctor account:', error);
    });
  }, [user?.id]);
};
