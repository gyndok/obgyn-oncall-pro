import React, { useState, useEffect } from "react";
import { format, parseISO, addDays, addWeeks, isSameDay, getYear, getMonth, getDate } from "date-fns";
import { CalendarIcon, Clock, CheckCircle, AlertTriangle, Star, Calendar as CalendarIconLucide, Save, Send, AlertCircle } from "lucide-react";
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

// Helper function to parse date-only strings as local dates (avoiding UTC timezone issues)
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

// Holiday detection function
const getHolidays = (year: number) => {
  const holidays = [];
  
  // Fixed holidays
  holidays.push(new Date(year, 0, 1)); // New Year's Day
  holidays.push(new Date(year, 6, 4)); // Independence Day
  holidays.push(new Date(year, 10, 11)); // Veterans Day
  holidays.push(new Date(year, 11, 25)); // Christmas Day
  
  // Memorial Day (last Monday in May)
  const memorialDay = new Date(year, 4, 31);
  memorialDay.setDate(31 - memorialDay.getDay());
  holidays.push(memorialDay);
  
  // Labor Day (first Monday in September)
  const laborDay = new Date(year, 8, 1);
  laborDay.setDate(1 + (7 - laborDay.getDay()) % 7);
  holidays.push(laborDay);
  
  // Thanksgiving (fourth Thursday in November)
  const thanksgiving = new Date(year, 10, 1);
  thanksgiving.setDate(1 + (4 - thanksgiving.getDay() + 7) % 7 + 21);
  holidays.push(thanksgiving);
  
  return holidays;
};

const isHoliday = (date: Date) => {
  const year = getYear(date);
  const holidays = getHolidays(year);
  return holidays.some(holiday => isSameDay(holiday, date));
};

const DoctorPortal = () => {
  const { user } = useAuth();
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

          if (request) {
            setDoctorRequest(request);
            setSelectedUnavailableDates(
              Array.isArray(request.unavailable_dates) 
                ? request.unavailable_dates.map((date: string) => new Date(date))
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
            <h1 className="text-3xl font-bold text-foreground">Doctor Portal</h1>
            {getStatusBadge()}
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
                        const isHolidayDate = isHoliday(currentDate);

                        dates.push(
                          <button
                            key={dateString}
                            type="button"
                            disabled={status === 'submitted'}
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
                                  ? 'bg-warning/20 border-warning text-warning-foreground hover:bg-warning/30'
                                  : 'bg-background border-border hover:bg-muted hover:border-muted-foreground'
                              }
                              ${status === 'submitted' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
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
                    <div className="w-4 h-4 bg-warning/20 border-warning border rounded relative">
                      <Star className="h-2 w-2 absolute top-0.5 right-0.5 text-warning" />
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
                      disabled={status === 'submitted'}
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
        <Card className="mt-6 shadow-soft">
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
              disabled={status === 'submitted'}
            />
          </CardContent>
        </Card>

        {/* Submission Alert */}
        {status === 'submitted' && (
          <Alert className="mt-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Preferences Submitted:</strong> Your call preferences have been submitted successfully. 
              You can view your submission details above, but cannot make changes until the next block opens.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleSaveDraft}
            disabled={status === 'submitted' || saving}
            className="flex-1 md:flex-none"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button 
            size="lg" 
            onClick={handleSubmit}
            disabled={status === 'submitted' || saving}
            className="flex-1 md:flex-none bg-gradient-primary hover:opacity-90"
          >
            <Send className="h-4 w-4 mr-2" />
            {saving ? "Submitting..." : "Submit Preferences"}
          </Button>
        </div>
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default DoctorPortal;