import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, Users, FileText, Video, MessageSquare, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Index = () => {
  return (
  <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 backdrop-blur-sm">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary drop-shadow-[0_0_10px_rgba(79,143,255,0.7)]" />
            <h1 className="text-2xl font-bold text-foreground">EduConnect</h1>
          </div>
          <Link to="/auth?mode=signup">
            <Button className="flex items-center gap-2">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Connect. Share. Learn.
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join the ultimate college student community where you can share notes, videos, 
            collaborate on projects, and stay organized with your academic journey.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="text-lg px-8 py-3">
                Join EduConnect Today
              </Button>
            </Link>
            <Link to="/auth?mode=signin">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(79,143,255,0.4)]">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-foreground">Share Notes</CardTitle>
              <CardDescription className="text-muted-foreground">
                Upload and download study materials, notes, and documents with your peers
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-accent/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(185,131,255,0.4)]">
                <Video className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-foreground">Video Library</CardTitle>
              <CardDescription className="text-muted-foreground">
                Access educational videos and tutorials shared by students across branches
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-secondary/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(125,211,252,0.4)]">
                <MessageSquare className="h-6 w-6 text-secondary" />
              </div>
              <CardTitle className="text-foreground">Updates & Requests</CardTitle>
              <CardDescription className="text-muted-foreground">
                Stay updated with announcements and help fellow students with their requests
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-destructive/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                <Users className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-foreground">Community</CardTitle>
              <CardDescription className="text-muted-foreground">
                Connect with students from CSE, CSM, ECE, CSD, CSC, and IT branches
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-[hsl(36,100%,61%)]/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(255,176,55,0.4)]">
                <GraduationCap className="h-6 w-6 text-[hsl(36,100%,61%)]" />
              </div>
              <CardTitle className="text-foreground">Organize Studies</CardTitle>
              <CardDescription className="text-muted-foreground">
                Manage your tasks and set reminders to stay on top of your academic goals
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-12 h-12 bg-[hsl(150,80%,50%)]/20 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                <FileText className="h-6 w-6 text-[hsl(150,80%,50%)]" />
              </div>
              <CardTitle className="text-foreground">Free Forever</CardTitle>
              <CardDescription className="text-muted-foreground">
                All features are completely free for students. No hidden costs or subscriptions
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold mb-4 text-foreground">Ready to Get Started?</h3>
              <p className="text-muted-foreground mb-6">
                Join thousands of students already using EduConnect to enhance their learning experience.
              </p>
              <Link to="/auth?mode=signup">
                <Button size="lg" className="w-full md:w-auto">
                  Create Your Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border/50 backdrop-blur-sm">
        <div className="text-center text-muted-foreground">
          <p>&copy; 2024 EduConnect. Built for students, by students.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
