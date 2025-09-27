import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, Video, CheckSquare, MessageSquare, UserCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Updates from '@/components/Updates';
import Requests from '@/components/Requests';
import Notes from '@/components/Notes';
import Videos from '@/components/Videos';
import TodoList from '@/components/TodoList';
import Profile from '@/components/Profile';

type Tab = 'dashboard' | 'updates' | 'requests' | 'notes' | 'videos' | 'todos' | 'profile';

export default function Dashboard() {
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    // Fetch total registered users
    const fetchUserCount = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setTotalUsers(count || 0);
    };

    fetchUserCount();

    // Subscribe to profile changes for real-time user count
    const subscription = supabase
      .channel('profiles-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'profiles' 
        }, 
        () => {
          fetchUserCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const tabs = [
    { id: 'dashboard' as Tab, label: 'Dashboard', icon: Users },
    { id: 'updates' as Tab, label: 'Updates', icon: MessageSquare },
    { id: 'requests' as Tab, label: 'Requests', icon: MessageSquare },
    { id: 'notes' as Tab, label: 'Notes', icon: FileText },
    { id: 'videos' as Tab, label: 'Videos', icon: Video },
    { id: 'todos' as Tab, label: 'To Do List', icon: CheckSquare },
    { id: 'profile' as Tab, label: 'Profile', icon: UserCircle },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            <h1 className="text-3xl font-bold text-foreground">Welcome to EduConnect</h1>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Community Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary">{totalUsers}</div>
                  <div className="text-muted-foreground">Total Registered Users</div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'updates':
        return <Updates />;
      case 'requests':
        return <Requests />;
      case 'notes':
        return <Notes />;
      case 'videos':
        return <Videos />;
      case 'todos':
        return <TodoList />;
      case 'profile':
        return <Profile />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h2 className="text-xl font-bold text-primary">EduConnect</h2>
              <div className="hidden md:flex space-x-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? 'default' : 'ghost'}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <Button
              onClick={signOut}
              variant="ghost"
              className="flex items-center gap-2 text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
          
          {/* Mobile Navigation */}
          <div className="md:hidden pb-4">
            <div className="grid grid-cols-3 gap-1">
              {tabs.slice(0, 6).map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex flex-col items-center gap-1 h-16 text-xs"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {renderContent()}
      </main>
    </div>
  );
}