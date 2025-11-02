
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { User } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuth';

interface AuthProps {
  onLogin: (user: User, rememberMe: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, showToast }) => {
  const [activeTab, setActiveTab] = useState('login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter email and password.');
      return;
    }

    toast.promise(
      loginMutation.mutateAsync({ email: loginEmail, password: loginPassword }),
      {
        loading: 'Logging in...',
        success: (user) => {
          if (user) {
            onLogin(user, rememberMe);
            return `Welcome back, ${user.name}!`;
          }
          throw new Error("Login failed");
        },
        error: (error: any) => {
          const message = error.response?.data?.message || 'Invalid credentials or account not active.';
          setLoginError(message);
          return message;
        },
      }
    ).catch(() => {});
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);
    if (!registerName || !registerEmail || !registerPassword) {
      setRegisterError('Please fill in all fields.');
      return;
    }

    toast.promise(
      registerMutation.mutateAsync({ name: registerName, email: registerEmail, password: registerPassword }),
      {
        loading: 'Registering...',
        success: () => {
          setActiveTab('login');
          setRegisterName('');
          setRegisterEmail('');
          setRegisterPassword('');
          setRegisterError(null);
          setLoginEmail(registerEmail);
          setLoginPassword('');
          return 'Registration successful! Your account is now pending admin approval.';
        },
        error: (error: any) => {
          const message = error.response?.data?.message || 'Registration failed. Please try again.';
          setRegisterError(message);
          return message;
        },
      }
    ).catch(() => {});
  };

  const loginForm = (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Login to Off-day</CardTitle>
        <CardDescription>
          Enter your credentials to access your account. <br />
          (admin: admin@test.com, pw: admin123)
        </CardDescription>
      </CardHeader>
      <CardContent className="">
        <form onSubmit={handleLogin} className="grid gap-4">
           {loginError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3" role="alert">
                {loginError}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email-login">Email</Label>
            <Input
              id="email-login"
              type="email"
              placeholder="m@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              disabled={loginMutation.isPending}
              required
              aria-describedby="login-error"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password-login">Password</Label>
            <Input
              id="password-login"
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              disabled={loginMutation.isPending}
              required
              aria-describedby="login-error"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring"
            />
            <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
              Remember me
            </Label>
          </div>
          {loginError && <p id="login-error" className="sr-only">{loginError}</p>}
          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
  
  const registerForm = (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create an Account</CardTitle>
        <CardDescription>
          After registering, an admin must approve your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="grid gap-4">
          {registerError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-md p-3" role="alert">
                {registerError}
            </div>
          )}
           <div className="grid gap-2">
            <Label htmlFor="name-register">Name</Label>
            <Input
              id="name-register"
              type="text"
              placeholder="John Doe"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              disabled={registerMutation.isPending}
              required
              aria-describedby="register-error"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email-register">Email</Label>
            <Input
              id="email-register"
              type="email"
              placeholder="m@example.com"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              disabled={registerMutation.isPending}
              required
              aria-describedby="register-error"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password-register">Password</Label>
            <Input
              id="password-register"
              type="password"
              placeholder="Must be at least 6 characters"
              value={registerPassword}
              onChange={(e) => setRegisterPassword(e.target.value)}
              disabled={registerMutation.isPending}
              required
              aria-describedby="register-error"
            />
          </div>
          {registerError && <p id="register-error" className="sr-only">{registerError}</p>}
          <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Registering...' : 'Register'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-secondary/50 px-4">
        <Tabs className="w-full max-w-sm">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger onClick={() => { setActiveTab('login'); setRegisterError(null); }} active={activeTab === 'login'}>Login</TabsTrigger>
                <TabsTrigger onClick={() => { setActiveTab('register'); setLoginError(null); }} active={activeTab === 'register'}>Register</TabsTrigger>
            </TabsList>
            {activeTab === 'login' && <TabsContent>{loginForm}</TabsContent>}
            {activeTab === 'register' && <TabsContent>{registerForm}</TabsContent>}
        </Tabs>
    </div>
  );
};

export default Auth;