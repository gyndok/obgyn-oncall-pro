import { useState } from "react";
import { 
  Settings, 
  Users, 
  Calendar, 
  Send, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Mail,
  Lock,
  Play,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ScheduleVisualization from "@/components/ScheduleVisualization";

const AdminDashboard = () => {
  const [blockLocked, setBlockLocked] = useState(false);
  const [scheduleGenerated, setScheduleGenerated] = useState(false);
  const [schedulePublished, setSchedulePublished] = useState(false);

  // Mock data
  const doctors = [
    { name: "Dr. Klein", email: "klein@clinic.com", status: "submitted", submittedAt: "2024-01-15 10:30 AM" },
    { name: "Dr. LeBlanc", email: "leblanc@clinic.com", status: "submitted", submittedAt: "2024-01-16 2:15 PM" },
    { name: "Dr. Johnson", email: "johnson@clinic.com", status: "in-progress", submittedAt: null },
    { name: "Dr. Kenney", email: "kenney@clinic.com", status: "submitted", submittedAt: "2024-01-17 9:45 AM" },
    { name: "Dr. LaBerge", email: "laberge@clinic.com", status: "not-started", submittedAt: null },
    { name: "Dr. Clinger", email: "clinger@clinic.com", status: "submitted", submittedAt: "2024-01-16 4:20 PM" },
    { name: "Dr. Demerson", email: "demerson@clinic.com", status: "submitted", submittedAt: "2024-01-17 11:10 AM" }
  ];

  const submittedCount = doctors.filter(d => d.status === 'submitted').length;
  const progressPercent = (submittedCount / doctors.length) * 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Submitted</Badge>;
      case 'in-progress':
        return <Badge variant="outline" className="border-warning text-warning"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'not-started':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage call blocks, monitor submissions, and generate schedules</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full lg:w-fit grid-cols-4 lg:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-gradient-card shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Submissions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{submittedCount}/7</div>
                  <Progress value={progressPercent} className="mt-2" />
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-accent" />
                    Block Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {blockLocked ? 'Locked' : 'Open'}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Deadline: Jan 29, 11:59 PM
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-success" />
                    Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {scheduleGenerated ? 'Generated' : 'Pending'}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {scheduleGenerated ? 'Ready to publish' : 'Awaiting generation'}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-card shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="h-5 w-5 text-warning" />
                    Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {schedulePublished ? 'Published' : 'Not Published'}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Google Calendar sync
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Doctor Submissions Table */}
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Doctor Submissions</CardTitle>
                    <CardDescription>Track submission status for all doctors</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Reminders
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setBlockLocked(!blockLocked)}>
                      <Lock className="h-4 w-4 mr-2" />
                      {blockLocked ? 'Unlock' : 'Lock'} Block
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doctor) => (
                      <TableRow key={doctor.email}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell>{getStatusBadge(doctor.status)}</TableCell>
                        <TableCell>{doctor.submittedAt || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configure Tab */}
          <TabsContent value="configure" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Block Configuration</CardTitle>
                <CardDescription>Set up the call block parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date">Block Start Date (Monday)</Label>
                    <Input id="start-date" type="date" defaultValue="2024-02-05" />
                  </div>
                  <div>
                    <Label htmlFor="deadline">Submission Deadline</Label>
                    <Input id="deadline" type="datetime-local" defaultValue="2024-01-29T23:59" />
                  </div>
                </div>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Backend Integration Required:</strong> Block configuration, deadline management, 
                    and automated reminders require Supabase integration for full functionality.
                  </AlertDescription>
                </Alert>

                <Button className="bg-gradient-primary hover:opacity-90">
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Schedule Generation</h2>
                <p className="text-muted-foreground">Generate and validate the call schedule</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setScheduleGenerated(true)}
                  disabled={submittedCount < 7 && !blockLocked}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Generate Schedule
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {scheduleGenerated ? (
              <ScheduleVisualization />
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-16 text-center">
                  <Calendar className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Schedule Generated</h3>
                  <p className="text-muted-foreground mb-4">
                    Generate a schedule once all doctors have submitted or you've locked the block
                  </p>
                  <Button 
                    onClick={() => setScheduleGenerated(true)}
                    disabled={submittedCount < 7 && !blockLocked}
                  >
                    Generate Schedule
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Google Calendar Integration</CardTitle>
                <CardDescription>Publish schedule to Google Calendar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Integration Required:</strong> Google Calendar publishing requires OAuth setup 
                    and backend integration through Supabase.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-4">
                  <Button 
                    onClick={() => setSchedulePublished(true)}
                    disabled={!scheduleGenerated}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Publish to Calendar
                  </Button>
                  <Button variant="outline" disabled={!schedulePublished}>
                    Unpublish Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;