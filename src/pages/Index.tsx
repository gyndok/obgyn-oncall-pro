import { Calendar, Users, Shield, Clock, CheckCircle, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, signOut } = useAuth();

  const features = [
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Automated Scheduling",
      description: "Generate compliant 7-week on-call schedules automatically following all medical guidelines."
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: "Doctor Portal",
      description: "Easy submission of time-off requests and weekend preferences with real-time status tracking."
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Constraint Compliance", 
      description: "100% adherence to hard rules including weekend assignments and doctor-specific restrictions."
    },
    {
      icon: <CheckCircle className="h-6 w-6" />,
      title: "Google Calendar Sync",
      description: "Seamless integration with Google Calendar for automatic schedule publishing and updates."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                OBGYN Call Scheduler
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    Welcome, {user.email}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={signOut}
                    className="flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <Link to="/auth">
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-hero py-20 px-4">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
            Professional Healthcare Scheduling
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            OBGYN Call Scheduler
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
            Streamline your medical practice with intelligent, constraint-based scheduling that ensures fair coverage and compliance with all medical guidelines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-medium" asChild>
              <Link to="/doctor">Doctor Portal</Link>
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-primary" asChild>
              <Link to="/admin">Admin Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Intelligent Scheduling Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built specifically for medical practices with complex scheduling requirements
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-gradient-card border-border shadow-soft hover:shadow-medium transition-all duration-300">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-center text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 bg-secondary/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-primary mb-2">≥95%</div>
              <p className="text-muted-foreground">Schedules generated without manual edits</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">&lt;2min</div>
              <p className="text-muted-foreground">From generation to validated schedule</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-primary mb-2">100%</div>
              <p className="text-muted-foreground">Hard constraint compliance</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Streamline Your Scheduling?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join medical practices that have eliminated manual scheduling conflicts and improved work-life balance.
          </p>
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-8">
            <Clock className="h-5 w-5" />
            <span>Setup takes less than 10 minutes</span>
          </div>
          <Button size="lg" className="bg-gradient-primary hover:opacity-90 shadow-medium">
            Get Started Today
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Index;