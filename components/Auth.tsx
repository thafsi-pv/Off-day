import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { User } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { useLoginMutation, useRegisterMutation } from '../hooks/useAuth';

interface AuthProps {
  onLogin: (user: User, rememberMe: boolean) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, showToast }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register
  const [registerName, setRegisterName] = useState('');
  const [registerMobile, setRegisterMobile] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerError, setRegisterError] = useState<string | null>(null);

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  // --- LOGIN ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginMobile || !loginPassword) {
      setLoginError('Please enter mobile and password.');
      return;
    }

    toast.promise(
      loginMutation.mutateAsync({ mobile: loginMobile, password: loginPassword }),
      {
        loading: 'Logging in...',
        success: (user) => {
          onLogin(user, rememberMe);
          return `Welcome back, ${user.name}!`;
        },
        error: (error: any) => {
          const message = error.response?.data?.message || 'Invalid mobile number or password.';
          setLoginError(message);
          return message;
        },
      }
    ).catch(() => {});
  };

  // --- REGISTER ---
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!registerName || !registerMobile || !registerPassword) {
      setRegisterError('Please fill in all required fields.');
      return;
    }

    toast.promise(
      registerMutation.mutateAsync({
        name: registerName,
        email: registerEmail || null,
        mobile: registerMobile,
        password: registerPassword,
      }),
      {
        loading: 'Registering...',
        success: () => {
          setActiveTab('login');
          setRegisterName('');
          setRegisterEmail('');
          setRegisterMobile('');
          setRegisterPassword('');
          return 'Registration successful! Awaiting admin approval.';
        },
        error: (error: any) => {
          const message = error.response?.data?.message || 'Registration failed. Try again.';
          setRegisterError(message);
          return message;
        },
      }
    ).catch(() => {});
  };

  // --- FORMS ---
  const loginForm = (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="grid gap-4">
          {loginError && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-md p-3">{loginError}</div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="mobile-login">Mobile</Label>
            <PhoneInput
              country={'in'}
              value={loginMobile}
              onChange={(value) => setLoginMobile(value)}
              inputProps={{ name: 'mobile', required: true }}
              disabled={loginMutation.isPending}
              inputClass="!w-full !py-5 !text-base !rounded-md !border-gray-200"
              buttonClass="!border-gray-200"
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
        <CardDescription>Admin approval is required after registration.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="grid gap-4">
          {registerError && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-md p-3">{registerError}</div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="name-register">Name</Label>
            <Input
              id="name-register"
              type="text"
              placeholder="John Doe"
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mobile-register">Mobile</Label>
            <PhoneInput
              country={'in'}
              value={registerMobile}
              onChange={(value) => setRegisterMobile(value)}
              inputProps={{ name: 'mobile', required: true }}
              disabled={registerMutation.isPending}
              inputClass="!w-full !py-5 !text-base !rounded-md !border-gray-200"
              buttonClass="!border-gray-200"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email-register">Email (optional)</Label>
            <Input
              id="email-register"
              type="email"
              placeholder="m@example.com"
              value={registerEmail}
              onChange={(e) => setRegisterEmail(e.target.value)}
              disabled={registerMutation.isPending}
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
            />
          </div>
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
          <TabsTrigger onClick={() => setActiveTab('login')} active={activeTab === 'login'}>Login</TabsTrigger>
          <TabsTrigger onClick={() => setActiveTab('register')} active={activeTab === 'register'}>Register</TabsTrigger>
        </TabsList>
        {activeTab === 'login' && <TabsContent>{loginForm}</TabsContent>}
        {activeTab === 'register' && <TabsContent>{registerForm}</TabsContent>}
      </Tabs>
    </div>
  );
};

export default Auth;
