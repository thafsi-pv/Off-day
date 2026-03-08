import React, { useState, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { User, Role } from './types';
import Auth from './components/Auth';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';
import LeaveHistory from './components/LeaveHistory';
import { SunIcon, MoonIcon } from './components/icons';
import { Button } from './components/ui';
import { IoIosLogOut } from 'react-icons/io';

const ThemeToggle: React.FC<{ theme: string; toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
  <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
    {theme === 'light' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
  </Button>
);

const App: React.FC = () => {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('currentUser');
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };


  const handleLogin = (user: User, _rememberMe: boolean) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleLogout = async () => {
    try {
      await import('./services/api').then(api => api.logout());
    } catch (error) {
      console.error("Logout API call failed", error);
    }
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    window.location.hash = '';
    toast('You have been logged out.');
  };

  const renderContent = () => {
    if (!currentUser) {
      return <Auth onLogin={handleLogin} />;
    }

    const hasExtraPermissions = currentUser.allowedTabs && currentUser.allowedTabs.length > 0;

    let dashboardContent;
    if (currentUser.role === Role.ADMIN || hasExtraPermissions) {
      dashboardContent = <AdminDashboard user={currentUser} />;
    } else {
      if (route === '#/history') {
        dashboardContent = <LeaveHistory user={currentUser} />;
      } else {
        dashboardContent = <UserDashboard user={currentUser} />;
      }
    }

    return (
      <div className="min-h-screen w-full bg-secondary/50">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="w-full px-4 sm:container h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">OffDay</span>
              <span className="text-sm bg-primary/10 text-primary px-2 py-0.5 rounded-full">{currentUser.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">Welcome, {currentUser.name}</span>
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Logout">
                <IoIosLogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </header>
        <main>{dashboardContent}</main>
      </div>
    );
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '0.5rem',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
      {renderContent()}
    </>
  );
};

export default App;