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
  }, [user]);

  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      toast.error(`Google Calendar connection failed: ${error}`);
      
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, document.title, url.toString());
      return;
    }

    if (code && state === user?.id) {
      handleOAuthCallback(code);
    }
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('google_access_token, google_email')
        .eq('auth_user_id', user.id)
        .single();

      if (error) {
        console.error('Error checking Google Calendar connection:', error);
        setIsConnected(false);
      } else {
        setIsConnected(!!data?.google_access_token);
        setGoogleEmail(data?.google_email || null);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      console.error('No user found');
      return;
    }

    console.log('Starting Google Calendar connection...');
    setIsConnecting(true);
    
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      console.log('Redirect URI:', redirectUri);
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'getAuthUrl',
          userId: user.id,
          redirectUri: redirectUri
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.authUrl) {
        console.log('Redirecting to Google OAuth:', data.authUrl);
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        console.error('No authUrl in response:', data);
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('Error initiating Google Calendar connection:', error);
      toast.error(`Failed to connect to Google Calendar: ${error.message || 'Unknown error'}`);
      setIsConnecting(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    if (!user) return;

    setIsConnecting(true);
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: {
          action: 'exchangeCode',
          code: code,
          userId: user.id,
          redirectUri: redirectUri
        }
      });

      if (error) throw error;

      if (data?.success) {
        setIsConnected(true);
        setGoogleEmail(data.userEmail);
        toast.success('Google Calendar connected successfully!');
        onConnected?.();
        
        // Clean up URL
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('scope');
        window.history.replaceState({}, document.title, url.toString());
      } else {
        throw new Error(data?.error || 'Failed to connect Google Calendar');
      }
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
      const { error } = await supabase
        .from('doctors')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expires_at: null,
          google_email: null,
        })
        .eq('auth_user_id', user.id);

      if (error) throw error;

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