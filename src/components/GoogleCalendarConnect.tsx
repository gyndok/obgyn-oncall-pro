import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface GoogleCalendarConnectProps {
  onConnected?: () => void;
}

export const GoogleCalendarConnect: React.FC<GoogleCalendarConnectProps> = ({ onConnected }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
    
    // Check if we returned from a failed OAuth attempt
    const oauthAttempt = sessionStorage.getItem('google_oauth_attempt');
    if (oauthAttempt) {
      const attemptTime = parseInt(oauthAttempt);
      const now = Date.now();
      
      // If we returned within 10 seconds and have no code, it likely failed
      if (now - attemptTime < 10000) {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.get('code')) {
          toast.error(
            'Google OAuth failed. Please ensure redirect URI is configured in Google Cloud Console:\n' +
            window.location.origin + window.location.pathname,
            { duration: 10000 }
          );
        }
      }
      sessionStorage.removeItem('google_oauth_attempt');
    }
  }, [user]);

  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      ['code', 'state', 'scope', 'error', 'authuser', 'prompt'].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState({}, document.title, url.toString());
    };

    if (error) {
      toast.error(`Google Calendar connection failed: ${error}`);
      cleanUrl();
      return;
    }

    if (code && user) {
      const expected = sessionStorage.getItem('google_oauth_state');
      sessionStorage.removeItem('google_oauth_state');
      if (!expected || state !== expected) {
        toast.error('Google Calendar connection rejected: security check failed. Please try again.');
        cleanUrl();
        return;
      }
      handleOAuthCallback(code).finally(cleanUrl);
    }
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('google_email')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setIsConnected(!!data?.google_email);
      setGoogleEmail(data?.google_email || null);
    } catch (error) {
      console.error('Error checking connection status:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      return;
    }
    setIsConnecting(true);
    try {
      const state = crypto.randomUUID();
      sessionStorage.setItem('google_oauth_state', state);
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          state,
          redirectUri: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error(data?.error || 'Failed to get authorization URL');
      sessionStorage.setItem('google_oauth_attempt', Date.now().toString());
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error('Error initiating Google Calendar connection:', error);
      toast.error(`Failed to connect to Google Calendar: ${error.message || 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    if (!user) return;
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'exchangeCode',
          code,
          redirectUri: window.location.origin + window.location.pathname,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to connect Google Calendar');
      setIsConnected(true);
      setGoogleEmail(data.userEmail);
      toast.success('Google Calendar connected successfully!');
      onConnected?.();
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      toast.error('Failed to connect Google Calendar');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      setIsConnected(false);
      setGoogleEmail(null);
      toast.success('Google Calendar disconnected');
    } catch (error) {
      console.error('Error disconnecting Google Calendar:', error);
      toast.error('Failed to disconnect Google Calendar');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 animate-pulse" />
            <span>Checking Google Calendar connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Google Calendar Integration</span>
        </CardTitle>
        <CardDescription>
          Connect your Google Calendar to publish schedules automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Connected to Google Calendar
              {googleEmail && <span className="block text-sm text-muted-foreground">Account: {googleEmail}</span>}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Google Calendar is not connected. Connect to publish schedules to your calendars.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex space-x-2">
          {isConnected ? (
            <Button 
              variant="outline" 
              onClick={handleDisconnect}
              disabled={isConnecting}
            >
              Disconnect Google Calendar
            </Button>
          ) : (
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center space-x-2"
            >
              <Calendar className="h-4 w-4" />
              <span>
                {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
              </span>
            </Button>
          )}
        </div>

        {!isConnected && (
          <div className="text-sm text-muted-foreground">
            <p>After connecting, you'll be able to:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Automatically publish call schedules to your calendars</li>
              <li>Keep your calendar in sync with schedule changes</li>
              <li>View availability across multiple calendars</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};