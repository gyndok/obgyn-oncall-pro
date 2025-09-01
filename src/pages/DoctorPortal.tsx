import React, { useState, useEffect } from "react";
import { format, parseISO, addDays, addWeeks, isSameDay, getYear, getMonth, getDate, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from "date-fns";
import { CalendarIcon, Clock, CheckCircle, AlertTriangle, Star, Calendar as CalendarIconLucide, Save, Send, AlertCircle, ChevronLeft, ChevronRight, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import ProtectedRoute from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// Helper function to parse date-only strings as local dates (avoiding UTC timezone issues)
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

// Holiday detection function
const getHolidays = (year: number) => {
  const holidays = [];
  
  // Fixed holidays
  holidays.push({ date: new Date(year, 0, 1), name: "New Year's Day" });
  holidays.push({ date: new Date(year, 6, 4), name: "Independence Day" });
  holidays.push({ date: new Date(year, 10, 11), name: "Veterans Day" });
  holidays.push({ date: new Date(year, 11, 25), name: "Christmas Day" });
  
  // Memorial Day (last Monday in May)
  const memorialDay = new Date(year, 4, 31);
  memorialDay.setDate(31 - memorialDay.getDay());
  holidays.push({ date: memorialDay, name: "Memorial Day" });
  
  // Labor Day (first Monday in September)
  const laborDay = new Date(year, 8, 1);
  laborDay.setDate(1 + (7 - laborDay.getDay()) % 7);
  holidays.push({ date: laborDay, name: "Labor Day" });
  
  // Thanksgiving (fourth Thursday in November)
  const thanksgiving = new Date(year, 10, 1);
  thanksgiving.setDate(1 + (4 - thanksgiving.getDay() + 7) % 7 + 21);
  holidays.push({ date: thanksgiving, name: "Thanksgiving" });
  
  return holidays;
};

const getHolidayInfo = (date: Date) => {
  const year = getYear(date);
  const holidays = getHolidays(year);
  return holidays.find(holiday => isSameDay(holiday.date, date));
};

const isHoliday = (date: Date) => {
  return !!getHolidayInfo(date);
};

const DoctorPortal = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedUnavailableDates, setSelectedUnavailableDates] = useState<Date[]>([]);
  const [preferredWeekends, setPreferredWeekends] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<'not_started' | 'in_progress' | 'submitted'>('not_started');
  const [currentBlock, setCurrentBlock] = useState<any>(null);
  const [doctorRequest, setDoctorRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weekends, setWeekends] = useState<any[]>([]);
  const [doctorRecord, setDoctorRecord] = useState<any>(null);
  const [allDoctorRequests, setAllDoctorRequests] = useState<any[]>([]);
  const [allDoctors, setAllDoctors] = useState<any[]>([]);

  // Calendar view state
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Fetch calendar events
  const fetchCalendarEvents = async () => {
    if (!user?.email) return;

    setCalendarLoading(true);
    try {
      // Configure your actual calendar IDs
      const calendarIds = [
        "odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com",
        "q6u72r1ummu006qishq90i7iek@group.calendar.google.com"
      ];

      // Get date range for current month and surrounding months
      const startOfCurrentMonth = startOfMonth(currentMonth);
      const endOfCurrentMonth = endOfMonth(currentMonth);
      const timeMin = new Date(startOfCurrentMonth);
      timeMin.setMonth(timeMin.getMonth() - 1);
      const timeMax = new Date(endOfCurrentMonth);
      timeMax.setMonth(timeMax.getMonth() + 1);

      const { data, error } = await supabase.functions.invoke('fetch-calendar-events', {
        body: {
          calendarIds,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          userEmail: user.email
        }
      });

      if (error) {
        console.error('Error fetching calendar events:', error);
        toast({
          title: "Calendar Error",
          description: "Failed to load calendar events. Please check your calendar configuration.",
          variant: "destructive"
        });
        return;
      }

      setCalendarEvents(data.events || []);
      console.log(`Loaded ${data.events?.length || 0} calendar events`);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      toast({
        title: "Calendar Error",
        description: "Failed to load calendar events.",
        variant: "destructive"
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  // Fetch calendar events when month changes
  useEffect(() => {
    fetchCalendarEvents();
  }, [currentMonth, user?.email]);

  // Fetch current block and doctor's existing request
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // First, find the doctor record for this authenticated user
        const { data: doctor, error: doctorError } = await supabase
          .from('doctors')
          .select('*')
          .eq('email', user.email)
          .maybeSingle();

        if (doctorError) throw doctorError;

        if (!doctor) {
          toast({
            title: "Access Denied",
            description: "You are not registered as a doctor in the system. Please contact your administrator.",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }

        setDoctorRecord(doctor);

        // Get current active block
        const { data: blocks, error: blockError } = await supabase
          .from('blocks')
          .select('*')
          .eq('status', 'collecting')
          .order('created_at', { ascending: false })
          .limit(1);

        if (blockError) throw blockError;

        if (blocks && blocks.length > 0) {
          const block = blocks[0];
          setCurrentBlock(block);

          // Generate weekend options for the 7-week block
          const startMonday = parseLocalDate(block.start_monday_date);
          const weekendOptions = [];
          
          for (let week = 0; week < 7; week++) {
            const weekStart = addWeeks(startMonday, week);
            const friday = addDays(weekStart, 4); // Friday is 4 days after Monday
            const sunday = addDays(weekStart, 6); // Sunday is 6 days after Monday
            
            weekendOptions.push({
              id: week + 1,
              dates: `${format(friday, 'MMM d')}-${format(sunday, 'd')}`,
              label: `Week ${week + 1}: Friday-Sunday`,
              friday: format(friday, 'yyyy-MM-dd'),
              saturday: format(addDays(friday, 1), 'yyyy-MM-dd'),
              sunday: format(sunday, 'yyyy-MM-dd')
            });
          }
          setWeekends(weekendOptions);

          // Get doctor's existing request for this block
          const { data: request, error: requestError } = await supabase
            .from('doctor_requests')
            .select('*')
            .eq('block_id', block.id)
            .eq('doctor_id', doctor.id)
            .maybeSingle();

          if (requestError) throw requestError;

          // Fetch all doctors and their requests for team status
          const { data: allDoctorsData, error: allDoctorsError } = await supabase
            .from('doctors')
            .select('*')
            .eq('active', true)
            .order('name');

          if (allDoctorsError) throw allDoctorsError;
          setAllDoctors(allDoctorsData || []);

          const { data: allRequestsData, error: allRequestsError } = await supabase
            .from('doctor_requests')
            .select('*, doctors(name, email)')
            .eq('block_id', block.id);

          if (allRequestsError) throw allRequestsError;
          setAllDoctorRequests(allRequestsData || []);

          if (request) {
            setDoctorRequest(request);
            setSelectedUnavailableDates(
              Array.isArray(request.unavailable_dates) 
                ? request.unavailable_dates.map((date: string) => parseLocalDate(date))
                : []
            );
            setPreferredWeekends(
              Array.isArray(request.preferred_weekends) 
                ? request.preferred_weekends as number[] 
                : []
            );
            setNotes(request.notes || "");
            setStatus((request.status as 'not_started' | 'in_progress' | 'submitted') || 'not_started');
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Failed to load block information. Please refresh the page.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleSaveDraft = async () => {
    if (!currentBlock || !doctorRecord) return;
    
    setSaving(true);
    try {
      const requestData = {
        block_id: currentBlock.id,
        doctor_id: doctorRecord.id,
        unavailable_dates: selectedUnavailableDates.map(date => format(date, 'yyyy-MM-dd')),
        preferred_weekends: preferredWeekends,
        notes: notes,
        status: 'in_progress',
        updated_at: new Date().toISOString()
      };

      if (doctorRequest) {
        // Update existing request
        const { error } = await supabase
          .from('doctor_requests')
          .update(requestData)
          .eq('id', doctorRequest.id);
        
        if (error) throw error;
      } else {
        // Create new request
        const { data, error } = await supabase
          .from('doctor_requests')
          .insert([requestData])
          .select()
          .single();
        
        if (error) throw error;
        setDoctorRequest(data);
      }

      setStatus('in_progress');
      toast({
        title: "Draft Saved",
        description: "Your preferences have been saved. You can submit when ready.",
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentBlock || !doctorRecord) return;
    
    setSaving(true);
    try {
      const requestData = {
        block_id: currentBlock.id,
        doctor_id: doctorRecord.id,
        unavailable_dates: selectedUnavailableDates.map(date => format(date, 'yyyy-MM-dd')),
        preferred_weekends: preferredWeekends,
        notes: notes,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (doctorRequest) {
        // Update existing request
        const { error } = await supabase
          .from('doctor_requests')
          .update(requestData)
          .eq('id', doctorRequest.id);
        
        if (error) throw error;
      } else {
        // Create new request
        const { data, error } = await supabase
          .from('doctor_requests')
          .insert([requestData])
          .select()
          .single();
        
        if (error) throw error;
        setDoctorRequest(data);
      }

      setStatus('submitted');
      toast({
        title: "Preferences Submitted",
        description: "Your call preferences have been submitted successfully.",
      });
    } catch (error) {
      console.error('Error submitting preferences:', error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit your preferences. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'not_started':
        return <Badge variant="outline" className="border-muted-foreground"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
      case 'in_progress':
        return <Badge variant="outline" className="border-warning text-warning"><AlertCircle className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'submitted':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Submitted</Badge>;
    }
  };

  // Check if editing is allowed (not if block is closed/published)
  const canEdit = currentBlock && (currentBlock.status === 'collecting');
  const isSubmitted = status === 'submitted';

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading block information...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!currentBlock) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-background p-4">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center py-16">
              <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-bold mb-2">No Active Call Block</h2>
              <p className="text-muted-foreground">
                There are currently no active call blocks available for submission.
                Please check back later or contact your administrator.
              </p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background p-4">
        <div className="container mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-3xl font-bold text-foreground">Doctor Portal</h1>
                <Badge variant="outline">
                  {doctorRecord?.name || user?.email}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Admin Dashboard
                  </Button>
                )}
              </div>
            </div>
            <p className="text-muted-foreground">Submit your time-off requests and weekend preferences for the upcoming call block.</p>
          </div>

          {/* Block Information */}
          <Card className="mb-6 bg-gradient-card shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Call Block Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                  <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.start_monday_date), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                  <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.end_sunday_date), 'MMM d, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Submission Deadline</Label>
                  <p className="text-lg font-semibold text-destructive">
                    {currentBlock.deadline ? format(new Date(currentBlock.deadline), 'MMM d, yyyy h:mm a') : 'No deadline set'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="preferences" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="preferences">Submit Preferences</TabsTrigger>
              <TabsTrigger value="team-status">Team Status</TabsTrigger>
              <TabsTrigger value="schedule">Call Schedule</TabsTrigger>
            </TabsList>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Unavailable Dates */}
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle>Unavailable Dates</CardTitle>
                    <CardDescription>
                      Select any dates you are not available for call duties (hard excludes)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Custom 7x7 Calendar Grid */}
                    <div className="space-y-4">
                      {/* Day Headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                            {day}
                          </div>
                        ))}
                      </div>

                      {/* 7x7 Date Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const startMonday = parseLocalDate(currentBlock.start_monday_date);
                          const dates = [];
                          
                          // Generate all 49 dates (7 weeks x 7 days)
                          for (let week = 0; week < 7; week++) {
                            for (let day = 0; day < 7; day++) {
                              const currentDate = addDays(addWeeks(startMonday, week), day);
                              const dateString = format(currentDate, 'yyyy-MM-dd');
                              const isSelected = selectedUnavailableDates.some(
                                selectedDate => format(selectedDate, 'yyyy-MM-dd') === dateString
                              );
                              const holidayInfo = getHolidayInfo(currentDate);
                              const isHolidayDate = !!holidayInfo;

                              dates.push(
                                <button
                                  key={dateString}
                                  type="button"
                                  disabled={!canEdit}
                                  title={holidayInfo ? holidayInfo.name : undefined}
                                  onClick={() => {
                                    if (isSelected) {
                                      // Remove date
                                      setSelectedUnavailableDates(
                                        selectedUnavailableDates.filter(
                                          selectedDate => format(selectedDate, 'yyyy-MM-dd') !== dateString
                                        )
                                      );
                                    } else {
                                      // Add date
                                      setSelectedUnavailableDates([...selectedUnavailableDates, currentDate]);
                                    }
                                  }}
                                  className={`
                                    aspect-square p-1 text-sm border rounded-md transition-all relative
                                    ${isSelected 
                                      ? 'bg-destructive text-destructive-foreground border-destructive shadow-md' 
                                      : isHolidayDate
                                        ? 'bg-accent/10 border-accent text-accent hover:bg-accent/20 font-semibold'
                                        : 'bg-background border-border hover:bg-muted hover:border-muted-foreground'
                                    }
                                    ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
                                  `}
                                >
                                  <div className="flex flex-col items-center justify-center h-full">
                                    <span className="font-medium">{format(currentDate, 'd')}</span>
                                    <span className="text-xs opacity-75">{format(currentDate, 'MMM')}</span>
                                    {isHolidayDate && (
                                      <Star className="h-2 w-2 absolute top-1 right-1" />
                                    )}
                                  </div>
                                </button>
                              );
                            }
                          }
                          
                          return dates;
                        })()}
                      </div>

                      {/* Legend */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-destructive border rounded"></div>
                          <span>Unavailable</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-accent/10 border-accent border rounded relative">
                            <Star className="h-2 w-2 absolute top-0.5 right-0.5 text-accent" />
                          </div>
                          <span>Holiday</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-background border rounded"></div>
                          <span>Available</span>
                        </div>
                      </div>
                    </div>
                    {selectedUnavailableDates.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium">Selected Unavailable Dates:</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {selectedUnavailableDates.map((date) => (
                            <Badge key={date.toISOString()} variant="secondary">
                              {format(date, 'MMM d, yyyy')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Weekend Preferences */}
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle>Weekend Preferences</CardTitle>
                    <CardDescription>
                      Select your preferred weekend(s) for call duties (Friday-Sunday blocks)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {weekends.map((weekend) => (
                        <div key={weekend.id} className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                          <Checkbox
                            id={`weekend-${weekend.id}`}
                            checked={preferredWeekends.includes(weekend.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPreferredWeekends([...preferredWeekends, weekend.id]);
                              } else {
                                setPreferredWeekends(preferredWeekends.filter(id => id !== weekend.id));
                              }
                            }}
                            disabled={!canEdit}
                          />
                          <Label htmlFor={`weekend-${weekend.id}`} className="flex-1 cursor-pointer">
                            <div className="font-medium">{weekend.label}</div>
                            <div className="text-sm text-muted-foreground">{weekend.dates}</div>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Notes */}
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Additional Notes</CardTitle>
                  <CardDescription>
                    Any additional information or special requests (optional)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Enter any additional notes or special requests..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[100px]"
                    disabled={!canEdit}
                  />
                </CardContent>
              </Card>

              {/* Submission Status */}
              {isSubmitted && canEdit && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Preferences Submitted:</strong> Your call preferences have been submitted successfully. 
                    You can still modify your submission until the block is closed for scheduling.
                  </AlertDescription>
                </Alert>
              )}

              {isSubmitted && !canEdit && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Block Closed:</strong> This call block has been closed for scheduling. 
                    Your preferences are locked and cannot be modified.
                  </AlertDescription>
                </Alert>
              )}

              {!isSubmitted && !canEdit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Block Closed:</strong> This call block has been closed. 
                    New submissions are no longer accepted.
                  </AlertDescription>
                </Alert>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4">
                <Button 
                  variant="outline" 
                  size="lg" 
                  onClick={handleSaveDraft}
                  disabled={!canEdit || saving}
                  className="flex-1 md:flex-none"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button 
                  size="lg" 
                  onClick={handleSubmit}
                  disabled={!canEdit || saving}
                  className="flex-1 md:flex-none bg-gradient-primary hover:opacity-90"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {saving ? "Submitting..." : (isSubmitted ? "Update Submission" : "Submit Preferences")}
                </Button>
              </div>
            </TabsContent>

            {/* Team Status Tab */}
            <TabsContent value="team-status" className="space-y-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Submission Status
                  </CardTitle>
                  <CardDescription>
                    View the status of all doctors' call preference submissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {allDoctors.map((doctor) => {
                      const request = allDoctorRequests.find(req => req.doctors?.email === doctor.email);
                      const status = request?.status || 'not_started';
                      
                      return (
                        <div key={doctor.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                          <div className="flex-1">
                            <div className="font-medium">{doctor.name}</div>
                            <div className="text-sm text-muted-foreground">{doctor.email}</div>
                            
                            {/* Show basic request info if submitted */}
                            {request && status === 'submitted' && (
                              <div className="mt-2 space-y-1">
                                {request.unavailable_dates && request.unavailable_dates.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    Unavailable: {request.unavailable_dates.length} date(s)
                                  </div>
                                )}
                                {request.preferred_weekends && request.preferred_weekends.length > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    Preferred weekends: {request.preferred_weekends.map((w: number) => `Week ${w}`).join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            {status === 'submitted' && (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Submitted
                              </Badge>
                            )}
                            {status === 'in_progress' && (
                              <Badge variant="secondary">
                                <Clock className="h-3 w-3 mr-1" />
                                In Progress
                              </Badge>
                            )}
                            {status === 'not_started' && (
                              <Badge variant="outline">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Not Started
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Summary Stats */}
                  <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">
                        {allDoctorRequests.filter(req => req.status === 'submitted').length}
                      </div>
                      <div className="text-sm text-muted-foreground">Submitted</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-warning">
                        {allDoctorRequests.filter(req => req.status === 'in_progress').length}
                      </div>
                      <div className="text-sm text-muted-foreground">In Progress</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-muted-foreground">
                        {allDoctors.length - allDoctorRequests.length}
                      </div>
                      <div className="text-sm text-muted-foreground">Not Started</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" />
                    Call Schedule Calendar
                  </CardTitle>
                  <CardDescription>
                    View the final call schedule populated from Google Calendars
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold">
                      {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(new Date())}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="space-y-2">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {(() => {
                        const monthStart = startOfMonth(currentMonth);
                        const monthEnd = endOfMonth(currentMonth);
                        const startDate = new Date(monthStart);
                        startDate.setDate(startDate.getDate() - monthStart.getDay()); // Start from Sunday
                        
                        const endDate = new Date(monthEnd);
                        endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay())); // End on Saturday
                        
                        const days = eachDayOfInterval({ start: startDate, end: endDate });
                        
                        return days.map((day) => {
                          const isCurrentMonth = isSameMonth(day, currentMonth);
                          const isCurrentDay = isToday(day);
                          const dayEvents = calendarEvents.filter(event => {
                            // Compare date strings directly to avoid timezone issues
                            const eventDateStr = event.date.split('T')[0]; // Get YYYY-MM-DD part
                            const dayDateStr = format(day, 'yyyy-MM-dd');
                            return eventDateStr === dayDateStr;
                          }).sort((a, b) => {
                            // Sort by priority: Call events first, then holidays, then Out events
                            const aIsCall = a.title.toLowerCase().includes('call');
                            const bIsCall = b.title.toLowerCase().includes('call');
                            const aIsHoliday = (a as any).isHoliday;
                            const bIsHoliday = (b as any).isHoliday;
                            const aIsOut = a.title.toLowerCase().includes('out');
                            const bIsOut = b.title.toLowerCase().includes('out');
                            
                            // Call events come first
                            if (aIsCall && !bIsCall) return -1;
                            if (!aIsCall && bIsCall) return 1;
                            
                            // If both are calls or neither are calls, check for holidays
                            if (aIsCall === bIsCall) {
                              // Holidays come after calls but before out events
                              if (aIsHoliday && !bIsHoliday && !bIsCall) return -1;
                              if (!aIsHoliday && bIsHoliday && !aIsCall) return 1;
                            }
                            
                            // Within same type, sort alphabetically
                            return a.title.localeCompare(b.title);
                          });
                          
                          const getEventColor = (calendarId: string, isUserEvent: boolean, eventTitle: string, doctorName: string, isHoliday?: boolean) => {
                            // Check if this is a holiday
                            if (isHoliday) {
                              return "bg-amber-500 text-white font-medium border border-amber-600";
                            }
                            
                            // Check if this event contains the current doctor's name
                            const isCurrentDoctor = eventTitle.toLowerCase().includes(doctorName.toLowerCase().split(' ')[0]) || 
                                                   eventTitle.toLowerCase().includes(doctorName.toLowerCase().split(' ')[1]);
                            
                            if (isCurrentDoctor) {
                              // Current doctor's events - use bright, distinctive colors
                              if (calendarId === "odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com") {
                                return "bg-green-600 text-white font-bold border-2 border-green-800 shadow-md"; // Bright green with border
                              } else {
                                return "bg-red-600 text-white font-bold border-2 border-red-800 shadow-md"; // Bright red with border
                              }
                            } else if (isUserEvent) {
                              // User's events - use distinct color families
                              if (calendarId === "odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com") {
                                return "bg-blue-600 text-white"; // Blue for calendar 1
                              } else {
                                return "bg-purple-600 text-white"; // Purple for calendar 2
                              }
                            } else {
                              // Other events - use complementary distinct colors
                              if (calendarId === "odn75bvuc02onjrb0ai9oskbc4@group.calendar.google.com") {
                                return "bg-orange-500 text-white"; // Orange for calendar 1
                              } else {
                                return "bg-pink-500 text-white"; // Pink for calendar 2
                              }
                            }
                          };

                          return (
                            <div
                              key={day.toString()}
                              className={`
                                min-h-[80px] p-2 border rounded-md
                                ${isCurrentMonth ? 'bg-background' : 'bg-muted/30 text-muted-foreground'}
                                ${isCurrentDay ? 'ring-2 ring-primary' : ''}
                              `}
                            >
                              <div className="text-sm font-medium mb-1">
                                {format(day, 'd')}
                              </div>
                              <div className="space-y-1">
                                 {dayEvents.map((event, idx) => (
                                   <div
                                     key={idx}
                                     className={`text-[10px] p-0.5 rounded text-center leading-tight ${getEventColor(event.calendarId, event.isUserEvent, event.title, doctorRecord?.name || '', (event as any).isHoliday)}`}
                                     title={`${event.title} - ${event.calendarId.includes('odn75bvuc02onjrb0ai9oskbc4') ? 'Staffing' : 'Call'}`}
                                   >
                                     {event.title}
                                   </div>
                                 ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                   {/* Setup Instructions */}
                  <Alert className="mt-6">
                    <CalendarIcon className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Google Calendar Integration:</strong> This calendar displays events from 2 Google Calendars. 
                      To configure, update the calendar IDs in the code with your actual Google Calendar IDs.
                      <br /><br />
                      <Button variant="outline" size="sm" onClick={fetchCalendarEvents} className="mt-2">
                        Refresh Calendar
                      </Button>
                    </AlertDescription>
                  </Alert>

                  {calendarLoading && (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading calendar events...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default DoctorPortal;