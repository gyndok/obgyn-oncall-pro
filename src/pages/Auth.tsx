import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Mail, Lock, User, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('signin');
  const [resetEmail, setResetEmail] = useState('');
  const [showResetForm, setShowResetForm] = useState(false);
  const navigate = useNavigate();
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      // Check if admin
      if (user.email === 'gyndok@yahoo.com') {
        navigate('/admin');
      } else {
        navigate('/doctor');
      }
    }
  }, [user, navigate]);
  const validateForm = (isSignUp: boolean) => {
    if (!email || !password) {
      setError('Please fill in all required fields');
      return false;
    }
    if (isSignUp && !name) {
      setError('Please enter your full name');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    return true;
  };
  const linkDoctorAccount = async (userId: string, userEmail: string) => {
    try {
      // Check if there's an existing doctor record with this email
      const {
        data: existingDoctor,
        error: doctorError
      } = await supabase.from('doctors').select('*').eq('email', userEmail.toLowerCase()).single();
      if (doctorError && doctorError.code !== 'PGRST116') {
        console.error('Error checking for existing doctor:', doctorError);
        return;
      }
      if (existingDoctor && !existingDoctor.auth_user_id) {
        // Link the existing doctor record to the new auth user
        const {
          error: updateError
        } = await supabase.from('doctors').update({
          auth_user_id: userId,
          first_login_at: new Date().toISOString(),
          account_setup_completed: true
        }).eq('id', existingDoctor.id);
        if (updateError) {
          console.error('Error linking doctor account:', updateError);
        } else {
          console.log('Successfully linked doctor account');
          toast({
            title: "Account Linked",
            description: "Your account has been successfully linked to your doctor profile."
          });
        }
      }
    } catch (error) {
      console.error('Error in linkDoctorAccount:', error);
    }
  };
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    setLoading(true);
    setError('');
    try {
      const redirectUrl = `${window.location.origin}/doctor`;
      const {
        data,
        error: signUpError
      } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name
          }
        }
      });
      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in instead.');
          setActiveTab('signin');
        } else {
          setError(signUpError.message);
        }
        return;
      }
      if (data.user) {
        // Try to link to existing doctor record
        await linkDoctorAccount(data.user.id, email);
        toast({
          title: "Account Created",
          description: "Please check your email to verify your account, then you can sign in."
        });
        setActiveTab('signin');
        setPassword('');
      }
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Generate a password reset token without sending Supabase's email
      const { data, error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail.toLowerCase(),
        {
          redirectTo: `${window.location.origin}/auth/reset-password`
        }
      );
      
      if (resetError) {
        setError(resetError.message);
        return;
      }
      
      // Only send our custom email - the reset token is already generated
      const { error: emailError } = await supabase.functions.invoke('send-password-reset', {
        body: {
          email: resetEmail.toLowerCase(),
          resetLink: `${window.location.origin}/auth/reset-password`
        }
      });
      
      if (emailError) {
        setError('Failed to send reset email. Please try again.');
        return;
      }
      
      toast({
        title: "Password Reset Sent",
        description: "Please check your email for password reset instructions."
      });
      
      setShowResetForm(false);
      setResetEmail('');
      
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    setLoading(true);
    setError('');
    try {
      const {
        data,
        error: signInError
      } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else {
          setError(signInError.message);
        }
        return;
      }
      if (data.user) {
        // Try to link to existing doctor record if not already linked
        await linkDoctorAccount(data.user.id, email);
        toast({
          title: "Welcome back!",
          description: "You have been successfully signed in."
        });

        // Redirect will be handled by useEffect
      }
    } catch (error: any) {
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };
  return <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Call Schedule Portal
          </h1>
          <p className="text-muted-foreground mt-2">
            Access your call schedule preferences
          </p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Doctor Access</CardTitle>
            <CardDescription className="text-center">
              Sign in to manage your call schedule preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              {error && <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>}

              <TabsContent value="signin" className="space-y-4">
                {!showResetForm ? (
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input id="signin-email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input id="signin-password" type="password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Signing In...' : 'Sign In'}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setShowResetForm(true)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reset-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input 
                          id="reset-email" 
                          type="email" 
                          placeholder="Enter your email address" 
                          value={resetEmail} 
                          onChange={e => setResetEmail(e.target.value)} 
                          className="pl-10" 
                          required 
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                    </Button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setShowResetForm(false);
                          setResetEmail('');
                          setError('');
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input id="signup-name" type="text" placeholder="Enter your full name" value={name} onChange={e => setName(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input id="signup-email" type="email" placeholder="Enter your email" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                      <Input id="signup-password" type="password" placeholder="Create a password (min. 6 characters)" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" required />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>
                <p className="text-sm text-muted-foreground text-center">
                  By creating an account, you agree to our terms of service.
                </p>
              </TabsContent>
            </Tabs>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Need help? Contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Auth;