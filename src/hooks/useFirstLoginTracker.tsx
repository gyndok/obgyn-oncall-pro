import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useFirstLoginTracker = () => {
  const { user, session } = useAuth();

  useEffect(() => {
    const trackFirstLogin = async () => {
      if (!user || !session) return;

      try {
        // Check if this user is a doctor and hasn't logged in before
        const { data: doctor, error } = await supabase
          .from('doctors')
          .select('id, first_login_at, auth_user_id')
          .eq('email', user.email)
          .maybeSingle();

        if (error) {
          console.error('Error checking doctor status:', error);
          return;
        }

        // If doctor exists and hasn't logged in before, update their record
        if (doctor && !doctor.first_login_at) {
          const { error: updateError } = await supabase
            .from('doctors')
            .update({ 
              first_login_at: new Date().toISOString(),
              auth_user_id: user.id,
              account_setup_completed: true
            })
            .eq('id', doctor.id);

          if (updateError) {
            console.error('Error updating first login:', updateError);
          } else {
            console.log('First login tracked for doctor:', user.email);
          }
        }
      } catch (error) {
        console.error('Error in first login tracker:', error);
      }
    };

    trackFirstLogin();
  }, [user, session]);
};