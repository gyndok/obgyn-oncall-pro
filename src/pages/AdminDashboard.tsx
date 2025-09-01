import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Users, 
  Calendar as CalendarIcon, 
  Send, 
  Download, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Mail,
  Lock,
  Play,
  Upload,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronRight
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import ScheduleVisualization from "@/components/ScheduleVisualization";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";

// Helper function to parse date-only strings as local dates (avoiding UTC timezone issues)
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

const AdminDashboard = () => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [doctorRequests, setDoctorRequests] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Block creation form state
  const [newBlockStartDate, setNewBlockStartDate] = useState("");
  const [newBlockDeadline, setNewBlockDeadline] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Block editing state
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState<Date | undefined>();
  const [editEndDate, setEditEndDate] = useState<Date | undefined>();

  // Doctor management state
  const [showDoctorDialog, setShowDoctorDialog] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [doctorForm, setDoctorForm] = useState({ name: "", email: "", mobile: "" });

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch blocks
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;
      setBlocks(blocksData || []);

      // Get current active block
      const activeBlock = blocksData?.find(block => block.status === 'collecting') || blocksData?.[0];
      setCurrentBlock(activeBlock);

      // Fetch doctors
      const { data: doctorsData, error: doctorsError } = await supabase
        .from('doctors')
        .select('*')
        .order('name');

      if (doctorsError) throw doctorsError;
      setDoctors(doctorsData || []);

      if (activeBlock) {
        // Fetch doctor requests for current block
        const { data: requestsData, error: requestsError } = await supabase
          .from('doctor_requests')
          .select(`
            *,
            doctors (name, email)
          `)
          .eq('block_id', activeBlock.id);

        if (requestsError) throw requestsError;
        setDoctorRequests(requestsData || []);

        // Fetch assignments for current block
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select(`
            *,
            doctors (name, email)
          `)
          .eq('block_id', activeBlock.id);

        if (assignmentsError) throw assignmentsError;
        setAssignments(assignmentsData || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewBlock = async () => {
    if (!newBlockStartDate) {
      toast({
        title: "Error",
        description: "Please select a start date",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const startDate = new Date(newBlockStartDate);
      const endDate = addDays(addWeeks(startDate, 7), -1); // 7 weeks, ending on Sunday

      const { error } = await supabase
        .from('blocks')
        .insert({
          start_monday_date: format(startDate, 'yyyy-MM-dd'),
          end_sunday_date: format(endDate, 'yyyy-MM-dd'),
          deadline: newBlockDeadline ? new Date(newBlockDeadline).toISOString() : null,
          status: 'collecting'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "New call block created successfully",
      });

      setShowCreateDialog(false);
      setNewBlockStartDate("");
      setNewBlockDeadline("");
      fetchData();
    } catch (error) {
      console.error('Error creating block:', error);
      toast({
        title: "Error",
        description: "Failed to create call block",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const updateBlockStatus = async (blockId: string, status: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('blocks')
        .update({ status })
        .eq('id', blockId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Block status updated to ${status}`,
      });

      fetchData();
    } catch (error) {
      console.error('Error updating block status:', error);
      toast({
        title: "Error",
        description: "Failed to update block status",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const generateSchedule = async () => {
    if (!currentBlock) return;

    setSaving(true);
    try {
      // Simple schedule generation algorithm
      const blockStart = parseLocalDate(currentBlock.start_monday_date);
      const assignments = [];
      const availableDoctors = [...doctors];

      // Create assignments for each day of the 7-week block
      for (let week = 0; week < 7; week++) {
        for (let day = 0; day < 7; day++) {
          const currentDate = addDays(addWeeks(blockStart, week), day);
          const isWeekend = day >= 5; // Friday, Saturday, Sunday
          const weekdayName = format(currentDate, 'EEEE');

          // Simple round-robin assignment (in real app, this would consider preferences)
          const doctorIndex = (week * 7 + day) % availableDoctors.length;
          const assignedDoctor = availableDoctors[doctorIndex];

          assignments.push({
            block_id: currentBlock.id,
            week_index: week,
            date: format(currentDate, 'yyyy-MM-dd'),
            is_weekend: isWeekend,
            weekday_name: weekdayName,
            doctor_id: assignedDoctor.id
          });
        }
      }

      // Clear existing assignments for this block
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('block_id', currentBlock.id);

      if (deleteError) throw deleteError;

      // Insert new assignments
      const { error: insertError } = await supabase
        .from('assignments')
        .insert(assignments);

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Schedule generated successfully",
      });

      fetchData();
    } catch (error) {
      console.error('Error generating schedule:', error);
      toast({
        title: "Error",
        description: "Failed to generate schedule",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const startEditingDates = () => {
    if (currentBlock) {
      setEditStartDate(parseLocalDate(currentBlock.start_monday_date));
      setEditEndDate(parseLocalDate(currentBlock.end_sunday_date));
      setIsEditingDates(true);
    }
  };

  const cancelEditingDates = () => {
    setIsEditingDates(false);
    setEditStartDate(undefined);
    setEditEndDate(undefined);
  };

  const saveBlockDates = async () => {
    if (!currentBlock || !editStartDate) {
      toast({
        title: "Error",
        description: "Please select valid dates",
        variant: "destructive"
      });
      return;
    }

    // Calculate end date as 7 weeks from start date (49 days - 1)
    const calculatedEndDate = addDays(addWeeks(editStartDate, 7), -1);

    setSaving(true);
    try {
      const { error } = await supabase
        .from('blocks')
        .update({
          start_monday_date: format(editStartDate, 'yyyy-MM-dd'),
          end_sunday_date: format(calculatedEndDate, 'yyyy-MM-dd')
        })
        .eq('id', currentBlock.id);

      if (error) throw error;

      // Update the current block state immediately for instant UI feedback
      setCurrentBlock({
        ...currentBlock,
        start_monday_date: format(editStartDate, 'yyyy-MM-dd'),
        end_sunday_date: format(calculatedEndDate, 'yyyy-MM-dd')
      });

      toast({
        title: "Success",
        description: `Block dates updated: ${format(editStartDate, 'MMM d, yyyy')} - ${format(calculatedEndDate, 'MMM d, yyyy')}`,
      });

      setIsEditingDates(false);
      setEditStartDate(undefined);
      setEditEndDate(undefined);
      
      // Fetch fresh data from database
      await fetchData();
    } catch (error) {
      console.error('Error updating block dates:', error);
      toast({
        title: "Error",
        description: "Failed to update block dates",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Doctor management functions
  const fetchAllDoctors = async () => {
    const { data, error } = await supabase
      .from('doctors')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching all doctors:', error);
      return [];
    }
    return data || [];
  };

  const openDoctorDialog = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setDoctorForm({ name: doctor.name, email: doctor.email, mobile: doctor.mobile || "" });
    } else {
      setEditingDoctor(null);
      setDoctorForm({ name: "", email: "", mobile: "" });
    }
    setShowDoctorDialog(true);
  };

  const closeDoctorDialog = () => {
    setShowDoctorDialog(false);
    setEditingDoctor(null);
    setDoctorForm({ name: "", email: "", mobile: "" });
  };

  const saveDoctor = async () => {
    if (!doctorForm.name.trim() || !doctorForm.email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      if (editingDoctor) {
        // Update existing doctor
        const { error } = await supabase
          .from('doctors')
          .update({
            name: doctorForm.name.trim(),
            email: doctorForm.email.trim(),
            mobile: doctorForm.mobile.trim() || null
          })
          .eq('id', editingDoctor.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Doctor updated successfully",
        });
      } else {
        // Create new doctor
        const { error } = await supabase
          .from('doctors')
          .insert({
            name: doctorForm.name.trim(),
            email: doctorForm.email.trim(),
            mobile: doctorForm.mobile.trim() || null,
            active: true
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Doctor added successfully",
        });
      }

      closeDoctorDialog();
      fetchData();
    } catch (error) {
      console.error('Error saving doctor:', error);
      toast({
        title: "Error",
        description: error.message.includes('duplicate') ? "Email already exists" : "Failed to save doctor",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleDoctorActive = async (doctor: any) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('doctors')
        .update({ active: !doctor.active })
        .eq('id', doctor.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Doctor ${doctor.active ? 'deactivated' : 'activated'} successfully`,
      });

      fetchData();
    } catch (error) {
      console.error('Error updating doctor status:', error);
      toast({
        title: "Error",
        description: "Failed to update doctor status",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate submission stats
  const submissionStats = React.useMemo(() => {
    if (!doctors.length || !Array.isArray(doctorRequests)) {
      return { submittedCount: 0, inProgressCount: 0, notStartedCount: 0, progressPercent: 0 };
    }

    const submittedCount = doctorRequests.filter(req => req.status === 'submitted').length;
    const inProgressCount = doctorRequests.filter(req => req.status === 'in_progress').length;
    const notStartedCount = doctors.length - doctorRequests.length;
    const progressPercent = doctors.length > 0 ? (submittedCount / doctors.length) * 100 : 0;

    return { submittedCount, inProgressCount, notStartedCount, progressPercent };
  }, [doctorRequests, doctors]);

  // Create doctor status list with full request data
  const doctorStatuses = React.useMemo(() => {
    if (!Array.isArray(doctors) || !Array.isArray(doctorRequests)) {
      return [];
    }

    return doctors.map(doctor => {
      const request = doctorRequests.find(req => req.doctors?.email === doctor.email);
      return {
        ...doctor,
        status: request?.status || 'not_started',
        submittedAt: request?.submitted_at ? format(new Date(request.submitted_at), 'MMM d, yyyy h:mm a') : null,
        request: request // Include full request data for expanded view
      };
    });
  }, [doctors, doctorRequests]);

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

  const toggleRowExpansion = (doctorEmail: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(doctorEmail)) {
      newExpanded.delete(doctorEmail);
    } else {
      newExpanded.add(doctorEmail);
    }
    setExpandedRows(newExpanded);
  };

  const formatDateList = (dates: any[]) => {
    if (!dates || !Array.isArray(dates) || dates.length === 0) return 'None';
    return dates.map(date => format(new Date(date), 'MMM d')).join(', ');
  };

  if (loading) {
    return (
      <ProtectedRoute requireAdmin={true}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage call blocks, monitor submissions, and generate schedules</p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Create New Block
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Call Block</DialogTitle>
                <DialogDescription>
                  Set up a new 7-week call block starting on a Monday
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="new-start-date">Block Start Date (Monday)</Label>
                  <Input 
                    id="new-start-date" 
                    type="date" 
                    value={newBlockStartDate}
                    onChange={(e) => setNewBlockStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="new-deadline">Submission Deadline (Optional)</Label>
                  <Input 
                    id="new-deadline" 
                    type="datetime-local"
                    value={newBlockDeadline}
                    onChange={(e) => setNewBlockDeadline(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createNewBlock} disabled={saving}>
                  {saving ? "Creating..." : "Create Block"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full lg:w-fit grid-cols-5 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {currentBlock ? (
              <>
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
                      <div className="text-2xl font-bold text-primary">{submissionStats.submittedCount}/{doctors.length}</div>
                      <Progress value={submissionStats.progressPercent} className="mt-2" />
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-card shadow-soft">
                     <CardHeader className="pb-3">
                       <CardTitle className="text-lg flex items-center gap-2">
                         <CalendarIcon className="h-5 w-5 text-accent" />
                         Block Status
                       </CardTitle>
                     </CardHeader>
                    <CardContent>
                      <div className="text-lg font-semibold">
                        {currentBlock.status === 'closed' ? 'Closed' : 'Open'}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {currentBlock.deadline ? format(new Date(currentBlock.deadline), 'MMM d, h:mm a') : 'No deadline set'}
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
                        {assignments.length > 0 ? 'Generated' : 'Pending'}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {assignments.length > 0 ? 'Ready to publish' : 'Awaiting generation'}
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
                        {currentBlock.status === 'published' ? 'Published' : 'Not Published'}
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateBlockStatus(currentBlock.id, currentBlock.status === 'closed' ? 'collecting' : 'closed')}
                          disabled={saving}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          {currentBlock.status === 'closed' ? 'Reopen' : 'Close'} Block
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead className="w-12"></TableHead>
                           <TableHead>Doctor</TableHead>
                           <TableHead>Email</TableHead>
                           <TableHead>Status</TableHead>
                           <TableHead>Submitted At</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {doctorStatuses.map((doctor) => (
                           <React.Fragment key={doctor.email}>
                             <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(doctor.email)}>
                               <TableCell>
                                 <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                   {expandedRows.has(doctor.email) ? (
                                     <ChevronDown className="h-4 w-4" />
                                   ) : (
                                     <ChevronRight className="h-4 w-4" />
                                   )}
                                 </Button>
                               </TableCell>
                               <TableCell className="font-medium">{doctor.name}</TableCell>
                               <TableCell>{doctor.email}</TableCell>
                               <TableCell>{getStatusBadge(doctor.status)}</TableCell>
                               <TableCell>{doctor.submittedAt || '-'}</TableCell>
                             </TableRow>
                             {expandedRows.has(doctor.email) && doctor.request && (
                               <TableRow>
                                 <TableCell colSpan={5} className="bg-muted/30 p-6">
                                   <div className="space-y-4">
                                     <h4 className="font-semibold text-sm">Request Details</h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                       <div>
                                         <Label className="font-medium text-muted-foreground">Unavailable Dates</Label>
                                         <p className="mt-1">{formatDateList(doctor.request.unavailable_dates)}</p>
                                       </div>
                                       <div>
                                         <Label className="font-medium text-muted-foreground">Preferred Weekends</Label>
                                         <p className="mt-1">{formatDateList(doctor.request.preferred_weekends)}</p>
                                       </div>
                                       {doctor.request.notes && (
                                         <div className="md:col-span-2">
                                           <Label className="font-medium text-muted-foreground">Notes</Label>
                                           <p className="mt-1 text-muted-foreground">{doctor.request.notes}</p>
                                         </div>
                                       )}
                                     </div>
                                   </div>
                                 </TableCell>
                               </TableRow>
                             )}
                           </React.Fragment>
                         ))}
                       </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-16 text-center">
                  <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new call block to get started with managing doctor schedules
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Configure Tab */}
          <TabsContent value="configure" className="space-y-6">
            {currentBlock ? (
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Current Block Configuration</CardTitle>
                  <CardDescription>Manage the current call block settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Block Dates</h3>
                    {!isEditingDates ? (
                      <Button variant="outline" size="sm" onClick={startEditingDates}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Dates
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditingDates}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveBlockDates} disabled={saving}>
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                      {!isEditingDates ? (
                        <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.start_monday_date), 'MMM d, yyyy')}</p>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal mt-1",
                                !editStartDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {editStartDate ? format(editStartDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={editStartDate}
                              onSelect={(date) => setEditStartDate(date)}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                      {!isEditingDates ? (
                        <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.end_sunday_date), 'MMM d, yyyy')}</p>
                      ) : (
                        <p className="text-lg font-semibold text-muted-foreground mt-1">
                          {editStartDate ? format(addDays(addWeeks(editStartDate, 7), -1), 'MMM d, yyyy') : 'Auto-calculated'}
                          <span className="block text-sm font-normal">Automatically calculated as 7 weeks from start date</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <div className="mt-1">
                        <Select 
                          value={currentBlock.status} 
                          onValueChange={(status) => updateBlockStatus(currentBlock.id, status)}
                          disabled={isEditingDates}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="collecting">Collecting</SelectItem>
                            <SelectItem value="closed">Closed</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {currentBlock.deadline && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Submission Deadline:</strong> {format(new Date(currentBlock.deadline), 'MMM d, yyyy h:mm a')}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-soft">
                <CardContent className="py-16 text-center">
                  <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new call block to configure settings
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            {currentBlock ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Schedule Generation</h2>
                    <p className="text-muted-foreground">Generate and validate the call schedule</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={generateSchedule}
                      disabled={saving}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {saving ? "Generating..." : "Generate Schedule"}
                    </Button>
                    <Button variant="outline" disabled={assignments.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                {assignments.length > 0 ? (
                  <ScheduleVisualization />
                ) : (
                  <Card className="shadow-soft">
                    <CardContent className="py-16 text-center">
                       <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                       <h3 className="text-xl font-semibold mb-2">No Schedule Generated</h3>
                       <p className="text-muted-foreground mb-4">
                         Generate a schedule to assign doctors to call duties
                       </p>
                       <Button onClick={generateSchedule} disabled={saving}>
                         {saving ? "Generating..." : "Generate Schedule"}
                       </Button>
                     </CardContent>
                   </Card>
                 )}
               </>
             ) : (
               <Card className="shadow-soft">
                 <CardContent className="py-16 text-center">
                   <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a call block first to generate schedules
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Doctors Tab */}
          <TabsContent value="doctors" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Doctor Management</h2>
                <p className="text-muted-foreground">Manage doctor profiles and permissions</p>
              </div>
              <Button onClick={() => openDoctorDialog()} className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                Add Doctor
              </Button>
            </div>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>All Doctors</CardTitle>
                <CardDescription>Manage doctor accounts and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell>{doctor.mobile || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={doctor.active ? "default" : "secondary"}>
                            {doctor.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openDoctorDialog(doctor)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleDoctorActive(doctor)}
                              disabled={saving}
                            >
                              {doctor.active ? <X className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Doctor Dialog */}
            <Dialog open={showDoctorDialog} onOpenChange={setShowDoctorDialog}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingDoctor ? 'Edit Doctor' : 'Add New Doctor'}</DialogTitle>
                  <DialogDescription>
                    {editingDoctor ? 'Update doctor information' : 'Add a new doctor to the system'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="doctor-name">Name</Label>
                    <Input 
                      id="doctor-name" 
                      value={doctorForm.name}
                      onChange={(e) => setDoctorForm({...doctorForm, name: e.target.value})}
                      placeholder="Enter doctor's full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="doctor-email">Email</Label>
                    <Input 
                      id="doctor-email" 
                      type="email"
                      value={doctorForm.email}
                      onChange={(e) => setDoctorForm({...doctorForm, email: e.target.value})}
                      placeholder="doctor@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="doctor-mobile">Phone Number</Label>
                    <Input 
                      id="doctor-mobile" 
                      value={doctorForm.mobile}
                      onChange={(e) => setDoctorForm({...doctorForm, mobile: e.target.value})}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDoctorDialog}>
                    Cancel
                  </Button>
                  <Button onClick={saveDoctor} disabled={saving}>
                    {saving ? "Saving..." : (editingDoctor ? "Update" : "Add")} Doctor
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                    and backend integration through Supabase Edge Functions.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-4">
                  <Button 
                    onClick={() => updateBlockStatus(currentBlock?.id || '', 'published')}
                    disabled={!currentBlock || assignments.length === 0 || saving}
                    className="bg-gradient-primary hover:opacity-90"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {saving ? "Publishing..." : "Publish to Calendar"}
                  </Button>
                  <Button 
                    variant="outline" 
                    disabled={!currentBlock || currentBlock.status !== 'published' || saving}
                    onClick={() => updateBlockStatus(currentBlock?.id || '', 'closed')}
                  >
                    Unpublish Schedule
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </ProtectedRoute>
  );
};

export default AdminDashboard;