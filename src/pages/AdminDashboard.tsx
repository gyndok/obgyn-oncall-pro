import React, { useState, useEffect } from "react";
import { Settings, Users, Calendar as CalendarIcon, Send, Download, CheckCircle, Clock, AlertTriangle, Mail, Lock, Play, Upload, Plus, Edit, Trash2, Save, X, ChevronDown, ChevronRight, UserCheck, LogOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import ScheduleVisualization from "@/components/ScheduleVisualization";
import ProtectedRoute from "@/components/ProtectedRoute";
import { GoogleCalendarConnect } from "@/components/GoogleCalendarConnect";
import { AIPromptEditor } from "@/components/AIPromptEditor";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

// Helper function to parse date-only strings as local dates (avoiding UTC timezone issues)
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};
const AdminDashboard = () => {
  console.log('AdminDashboard component rendering');
  const {
    user,
    isAdmin,
    signOut
  } = useAuth();
  const navigate = useNavigate();
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
  const [doctorForm, setDoctorForm] = useState({
    name: "",
    email: "",
    mobile: "",
    is_admin: false
  });

  // Expanded rows state
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Edit request state
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);
  const [editRequestForm, setEditRequestForm] = useState({
    unavailable_dates: [] as Date[],
    preferred_weekends: [] as number[],
    notes: ""
  });

  // ChatGPT Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  // State for tracking individual reminder sends
  const [reminderSends, setReminderSends] = useState<Record<string, {
    sentAt: number;
    success: boolean;
  }>>({});

  // State for tracking individual schedule email sends
  const [scheduleEmailSends, setScheduleEmailSends] = useState<Record<string, {
    sentAt: number;
    success: boolean;
    sending: boolean;
  }>>({});

  // Load reminder sends from localStorage on mount
  useEffect(() => {
    const savedReminderSends = localStorage.getItem('adminReminderSends');
    if (savedReminderSends) {
      try {
        setReminderSends(JSON.parse(savedReminderSends));
      } catch (error) {
        console.error('Error loading reminder sends from localStorage:', error);
      }
    }

    const savedScheduleEmailSends = localStorage.getItem('adminScheduleEmailSends');
    if (savedScheduleEmailSends) {
      try {
        setScheduleEmailSends(JSON.parse(savedScheduleEmailSends));
      } catch (error) {
        console.error('Error loading schedule email sends from localStorage:', error);
      }
    }
  }, []);

  // Save reminder sends to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminReminderSends', JSON.stringify(reminderSends));
  }, [reminderSends]);

  // Save schedule email sends to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('adminScheduleEmailSends', JSON.stringify(scheduleEmailSends));
  }, [scheduleEmailSends]);

  // Check if a doctor can receive a reminder (24 hour cooldown)
  const canSendReminder = (doctorId: string) => {
    const lastSend = reminderSends[doctorId];
    if (!lastSend) return true;
    const now = Date.now();
    const hoursSinceLastSend = (now - lastSend.sentAt) / (1000 * 60 * 60);
    return hoursSinceLastSend >= 24;
  };

  // Get button state for reminder button
  const getReminderButtonState = (doctorId: string) => {
    const lastSend = reminderSends[doctorId];
    if (!lastSend) return {
      variant: 'outline' as const,
      text: 'Send Reminder',
      disabled: false
    };
    const now = Date.now();
    const hoursSinceLastSend = (now - lastSend.sentAt) / (1000 * 60 * 60);
    if (hoursSinceLastSend < 24) {
      const hoursLeft = Math.ceil(24 - hoursSinceLastSend);
      return {
        variant: lastSend.success ? 'default' as const : 'destructive' as const,
        text: `Sent (${hoursLeft}h)`,
        disabled: true,
        className: lastSend.success ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' : ''
      };
    }
    return {
      variant: 'outline' as const,
      text: 'Send Reminder',
      disabled: false
    };
  };

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [lastPublishResult, setLastPublishResult] = useState<any>(null);

  // Calendar testing state
  const [testingCalendar, setTestingCalendar] = useState(false);
  const [testStatus, setTestStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Unpublish state
  const [unpublishing, setUnpublishing] = useState(false);
  const [unpublishStatus, setUnpublishStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Mass email state
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [customEmailMessage, setCustomEmailMessage] = useState("");

  // Never submitted tracking state
  const [neverSubmittedDoctors, setNeverSubmittedDoctors] = useState<Set<string>>(new Set());
  
  // Cleanup state
  const [cleaningUp, setCleaningUp] = useState(false);
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      // Fetch blocks (but prioritize active 'collecting' blocks)
      const {
        data: blocksData,
        error: blocksError
      } = await supabase.from('blocks').select('*').order('created_at', {
        ascending: false
      });
      if (blocksError) throw blocksError;
      setBlocks(blocksData || []);

      // Get current active block (prefer 'collecting' status, otherwise most recent)
      const activeBlock = blocksData?.find(block => block.status === 'collecting') || blocksData?.[0];
      setCurrentBlock(activeBlock);

      // Fetch doctors
      const {
        data: doctorsData,
        error: doctorsError
      } = await supabase.from('doctors').select('*').order('name');
      if (doctorsError) throw doctorsError;
      setDoctors(doctorsData || []);
      if (activeBlock) {
        // Fetch doctor requests for CURRENT active block only (not old completed blocks)
        const {
          data: requestsData,
          error: requestsError
        } = await supabase.from('doctor_requests').select(`
            *,
            doctors (name, email)
          `).eq('block_id', activeBlock.id); // CRITICAL: Only current block data

        if (requestsError) throw requestsError;
        setDoctorRequests(requestsData || []);

        // Fetch assignments for CURRENT block only (not old published schedules)
        const {
          data: assignmentsData,
          error: assignmentsError
        } = await supabase.from('assignments').select(`
            *,
            doctors (name, email)
          `).eq('block_id', activeBlock.id); // CRITICAL: Only current block assignments

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

      const {
        error
      } = await supabase.from('blocks').insert({
        start_monday_date: format(startDate, 'yyyy-MM-dd'),
        end_sunday_date: format(endDate, 'yyyy-MM-dd'),
        deadline: newBlockDeadline ? new Date(newBlockDeadline).toISOString() : null,
        status: 'collecting'
      });
      if (error) throw error;
      
      // Clean up old doctor requests from previous blocks to avoid confusion
      await cleanupOldData();
      
      toast({
        title: "Success",
        description: "New call block created successfully! Old doctor requests have been archived."
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
      const {
        error
      } = await supabase.from('blocks').update({
        status
      }).eq('id', blockId);
      if (error) throw error;
      toast({
        title: "Success",
        description: `Block status updated to ${status}`
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
      console.log('🤖 Generating AI-powered schedule...');

      // Generate the AI prompt with all doctor preferences
      const aiPrompt = generateAIPrompt();

      // Prepare doctor data for the AI function
      const doctorData = doctors.map(doctor => ({
        id: doctor.id,
        name: doctor.name
      }));

      // Call the AI scheduling edge function
      const response = await supabase.functions.invoke('generate-ai-schedule', {
        body: {
          prompt: aiPrompt,
          blockStartDate: currentBlock.start_monday_date,
          doctors: doctorData
        }
      });
      if (response.error) {
        console.error('AI scheduling error:', response.error);
        throw new Error(response.error.message || 'Failed to generate AI schedule');
      }
      const {
        assignments: aiAssignments,
        summary
      } = response.data;
      if (!aiAssignments || aiAssignments.length === 0) {
        throw new Error('AI returned no assignments');
      }
      console.log(`📋 AI generated ${aiAssignments.length} assignments`);
      if (summary) {
        console.log('📊 Schedule summary:', summary);
      }

      // Add block_id to each assignment
      const assignmentsWithBlockId = aiAssignments.map((assignment: any) => ({
        ...assignment,
        block_id: currentBlock.id
      }));

      // Clear existing assignments for this block
      const {
        error: deleteError
      } = await supabase.from('assignments').delete().eq('block_id', currentBlock.id);
      if (deleteError) throw deleteError;

      // Insert new AI-generated assignments
      const {
        error: insertError
      } = await supabase.from('assignments').insert(assignmentsWithBlockId);
      if (insertError) throw insertError;
      toast({
        title: "AI Schedule Generated Successfully! 🤖",
        description: `Created ${aiAssignments.length} assignments using DeepSeek AI with doctor preferences`
      });
      fetchData();
    } catch (error: any) {
      console.error('Error generating AI schedule:', error);
      toast({
        title: "AI Schedule Generation Failed",
        description: error.message || "Failed to generate schedule. Check console for details.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Import ChatGPT schedule
  const importChatGPTSchedule = async () => {
    if (!importText.trim() && !importFile || !currentBlock) return;
    
    setImporting(true);
    try {
      let text = importText.trim();
      
      // If file is provided, use file content instead
      if (importFile && !text) {
        text = await importFile.text();
      }
      
      let scheduleData;
      
      // Try to parse as JSON first, then CSV
      try {
        scheduleData = JSON.parse(text);
      } catch {
        // Parse as CSV
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        scheduleData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index];
          });
          return obj;
        });
      }
      
      // Convert ChatGPT data to assignments format
      const importedAssignments = [];
      const doctorNameToId: Record<string, string> = {};
      
      // Create doctor name mapping (handle last names and full names)
      doctors.forEach(doctor => {
        const lastName = doctor.name.split(' ').pop()?.toLowerCase();
        const firstName = doctor.name.split(' ')[0]?.toLowerCase();
        if (lastName) {
          doctorNameToId[lastName] = doctor.id;
          doctorNameToId[doctor.name.toLowerCase()] = doctor.id;
        }
        if (firstName) {
          doctorNameToId[firstName] = doctor.id;
        }
      });
      
      // Handle structured ChatGPT JSON format
      if (scheduleData.assignments && Array.isArray(scheduleData.assignments)) {
        // This is the structured format from ChatGPT
        for (const entry of scheduleData.assignments) {
          const date = entry.date;
          const doctorName = entry.doctor?.toLowerCase();
          const isWeekend = entry.is_weekend;
          const weekIndex = entry.week_index;
          const weekdayName = entry.weekday;
          
          if (!date || !doctorName) {
            console.warn(`Missing date or doctor in entry:`, entry);
            continue;
          }
          
          const doctorId = doctorNameToId[doctorName] || 
                          Object.keys(doctorNameToId).find(key => 
                            key.includes(doctorName) || doctorName.includes(key)
                          );
          
          if (!doctorId) {
            console.warn(`Doctor not found: ${doctorName}`);
            continue;
          }
          
          importedAssignments.push({
            block_id: currentBlock.id,
            week_index: weekIndex,
            date: date,
            weekday_name: weekdayName,
            is_weekend: isWeekend,
            doctor_id: doctorId
          });
        }
      } else {
        // Handle simple array format or single entries
        const entries = Array.isArray(scheduleData) ? scheduleData : [scheduleData];
        
        for (const entry of entries) {
          const date = entry.date || entry.Date;
          const doctorName = (entry.doctor || entry.Doctor || entry.name || entry.Name)?.toLowerCase();
          
          if (!date || !doctorName) continue;
          
          const doctorId = doctorNameToId[doctorName] || 
                          Object.keys(doctorNameToId).find(key => 
                            key.includes(doctorName) || doctorName.includes(key)
                          );
          
          if (!doctorId) {
            console.warn(`Doctor not found: ${doctorName}`);
            continue;
          }
          
          const assignmentDate = new Date(date);
          const dayOfWeek = assignmentDate.getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6; // Sun, Fri, Sat
          
          // Calculate week index
          const blockStart = parseLocalDate(currentBlock.start_monday_date);
          const weekIndex = Math.floor((assignmentDate.getTime() - blockStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
          
          const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          
          importedAssignments.push({
            block_id: currentBlock.id,
            week_index: weekIndex,
            date: format(assignmentDate, 'yyyy-MM-dd'),
            weekday_name: weekdays[dayOfWeek],
            is_weekend: isWeekend,
            doctor_id: doctorId
          });
        }
      }
      
      if (importedAssignments.length === 0) {
        throw new Error('No valid schedule entries found in the imported data');
      }
      
      // Clear existing assignments and insert imported ones
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('block_id', currentBlock.id);
      
      if (deleteError) throw deleteError;
      
      const { error: insertError } = await supabase
        .from('assignments')
        .insert(importedAssignments);
      
      if (insertError) throw insertError;
      
      toast({
        title: "ChatGPT Schedule Imported Successfully!",
        description: `Imported ${importedAssignments.length} schedule assignments`
      });
      
      setImportDialogOpen(false);
      setImportFile(null);
      setImportText('');
      fetchData();
      
    } catch (error: any) {
      console.error('Error importing ChatGPT schedule:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import ChatGPT schedule. Please check the JSON format.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const publishToCalendar = async () => {
    console.log('publishToCalendar function called', {
      currentBlock
    });
    if (!currentBlock) {
      console.log('No current block, returning early');
      return;
    }
    setPublishing(true);
    setPublishStatus(null);
    try {
      console.log('Calling supabase function with:', {
        blockId: currentBlock.id,
        userId: user?.id
      });
      const {
        data,
        error
      } = await supabase.functions.invoke('publish-to-calendar', {
        body: {
          blockId: currentBlock.id,
          userId: user?.id
        }
      });
      console.log('Supabase function response:', {
        data,
        error
      });
      if (error) throw error;
      if (data.success) {
        setPublishStatus({
          type: 'success',
          message: `Successfully published ${data.eventsCreated} events to Google Calendar! (${data.callEvents} call events, ${data.offEvents} off events)`
        });
        setLastPublishResult(data);
        await fetchData(); // Refresh to show updated status
        toast({
          title: "Success", 
          description: "Schedule published to Google Calendar successfully!"
        });
      } else {
        throw new Error(data.error || 'Publication failed');
      }
    } catch (error) {
      console.error('Error publishing to calendar:', error);
      
      // Check if this is a token refresh error
      const errorMessage = error.message || '';
      const isTokenError = errorMessage.includes('invalid_grant') || 
                          errorMessage.includes('refresh') || 
                          errorMessage.includes('token');
      
      if (isTokenError) {
        setPublishStatus({
          type: 'error',
          message: 'Google Calendar token expired. Please disconnect and reconnect your Google Calendar below.'
        });
        toast({
          title: "Google Calendar Token Expired",
          description: "Please disconnect and reconnect your Google Calendar to continue.",
          variant: "destructive"
        });
      } else {
        setPublishStatus({
          type: 'error',
          message: `Failed to publish: ${errorMessage}`
        });
        toast({
          title: "Error",
          description: "Failed to publish schedule",
          variant: "destructive"
        });
      }
    } finally {
      setPublishing(false);
    }
  };

  const cleanupOldData = async () => {
    try {
      // Delete doctor requests from blocks that are not the current active block
      // Keep published blocks' data but remove collecting/closed blocks that are old
      const { error } = await supabase
        .from('doctor_requests')
        .delete()
        .not('block_id', 'eq', currentBlock?.id || '')
        .in('status', ['not_started', 'in_progress']);
      
      if (error) throw error;
      
      console.log('Cleaned up old doctor requests');
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  };

  const manualCleanup = async () => {
    setCleaningUp(true);
    try {
      await cleanupOldData();
      await fetchData(); // Refresh the data
      toast({
        title: "Success",
        description: "Old doctor requests have been cleaned up. Doctors will start fresh for the current block."
      });
    } catch (error: any) {
      console.error('Error during cleanup:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cleanup old data"
      });
    } finally {
      setCleaningUp(false);
    }
  };

  const testCalendar = async () => {
    if (!user) return;
    
    setTestingCalendar(true);
    setTestStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-calendar-event', {
        body: { userId: user.id }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setTestStatus({
          type: 'success',
          message: `Test event created! Check the Staffing Calendar at ${data.eventTime}`
        });
        toast({
          title: "Success",
          description: "Test event created successfully in Staffing Calendar"
        });
      } else {
        throw new Error(data.error || 'Test failed');
      }
    } catch (error) {
      console.error('Error testing calendar:', error);
      setTestStatus({
        type: 'error',
        message: `Test failed: ${error.message}`
      });
      toast({
        title: "Error",
        description: "Failed to create test event",
        variant: "destructive"
      });
    } finally {
      setTestingCalendar(false);
    }
  };

  const unpublishSchedule = async () => {
    if (!currentBlock || !user) return;
    
    setUnpublishing(true);
    setUnpublishStatus(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('unpublish-schedule', {
        body: { 
          blockId: currentBlock.id,
          userId: user.id
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        setUnpublishStatus({
          type: 'success',
          message: data.message
        });
        // Clear the last publish result since we've unpublished
        setLastPublishResult(null);
        // Refresh data to show updated status
        await fetchData();
        toast({
          title: "Success",
          description: `Unpublished successfully! ${data.eventsDeleted} events removed.`
        });
      } else {
        throw new Error(data.error || 'Unpublish failed');
      }
    } catch (error) {
      console.error('Error unpublishing schedule:', error);
      setUnpublishStatus({
        type: 'error',
        message: `Unpublish failed: ${error.message}`
      });
      toast({
        title: "Error",
        description: "Failed to unpublish schedule",
        variant: "destructive"
      });
    } finally {
      setUnpublishing(false);
    }
  };

  // Send mass email with schedule details
  const sendMassEmail = async () => {
    if (!currentBlock || currentBlock.status !== 'published') {
      toast({
        title: "Cannot Send Emails",
        description: "Schedule must be published before sending emails to doctors",
        variant: "destructive"
      });
      return;
    }
    
    setSendingEmails(true);
    setEmailStatus(null);
    
    try {
      console.log('Sending mass email with schedule details...');
      
      const { data, error } = await supabase.functions.invoke('send-schedule-email', {
        body: {
          blockId: currentBlock.id,
          customMessage: customEmailMessage.trim() || null
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to send mass emails');
      }
      
      console.log('Mass email result:', data);
      
      if (data.success) {
        const { summary } = data;
        setEmailStatus({
          type: 'success',
          message: `Successfully sent ${summary.successfulEmails}/${summary.totalEmails} emails`
        });
        
        toast({
          title: "Mass Email Sent",
          description: `Successfully sent schedule emails to ${summary.successfulEmails}/${summary.totalEmails} doctors`
        });
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
      
    } catch (error: any) {
      console.error('Error sending mass emails:', error);
      setEmailStatus({
        type: 'error',
        message: error.message || 'Failed to send mass emails'
      });
      toast({
        title: "Mass Email Failed",
        description: error.message || "Failed to send schedule emails to doctors",
        variant: "destructive"
      });
    } finally {
      setSendingEmails(false);
    }
  };

  // Send schedule email to individual doctor
  const sendIndividualScheduleEmail = async (doctor: any) => {
    if (!currentBlock || currentBlock.status !== 'published') {
      toast({
        title: "Cannot Send Email",
        description: "Schedule must be published before sending emails",
        variant: "destructive"
      });
      return;
    }

    // Set sending state for this doctor
    setScheduleEmailSends(prev => ({
      ...prev,
      [doctor.id]: {
        ...prev[doctor.id],
        sending: true
      }
    }));

    try {
      console.log(`Sending schedule email to ${doctor.name} (${doctor.email})...`);
      
      // Create a fake assignment data for just this doctor
      const doctorAssignments = assignments.filter(a => a.doctor_id === doctor.id);
      
      // Create a temporary edge function call just for this doctor
      const { error } = await supabase.functions.invoke('send-schedule-email', {
        body: {
          blockId: currentBlock.id,
          customMessage: customEmailMessage.trim() || null,
          singleDoctorId: doctor.id // Add this parameter to send to just one doctor
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to send email');
      }

      // Mark as successfully sent
      setScheduleEmailSends(prev => ({
        ...prev,
        [doctor.id]: {
          sentAt: Date.now(),
          success: true,
          sending: false
        }
      }));

      toast({
        title: "Email Sent",
        description: `Schedule email sent successfully to ${doctor.name}`
      });

    } catch (error: any) {
      console.error(`Error sending email to ${doctor.name}:`, error);
      
      // Mark as failed
      setScheduleEmailSends(prev => ({
        ...prev,
        [doctor.id]: {
          sentAt: Date.now(),
          success: false,
          sending: false
        }
      }));

      toast({
        title: "Email Failed",
        description: `Failed to send email to ${doctor.name}: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  // Reset all schedule email send states
  const resetScheduleEmailSends = () => {
    setScheduleEmailSends({});
    localStorage.removeItem('adminScheduleEmailSends');
    toast({
      title: "Reset Complete",
      description: "All schedule email sending status has been reset"
    });
  };

  // Get button state for individual email send
  const getEmailButtonState = (doctorId: string) => {
    const emailSend = scheduleEmailSends[doctorId];
    if (!emailSend) return {
      variant: 'outline' as const,
      text: 'Send Schedule',
      disabled: false
    };
    
    if (emailSend.sending) return {
      variant: 'outline' as const,
      text: 'Sending...',
      disabled: true
    };

    const now = Date.now();
    const hoursSinceLastSend = (now - emailSend.sentAt) / (1000 * 60 * 60);
    
    if (hoursSinceLastSend < 1) { // 1 hour cooldown
      return {
        variant: emailSend.success ? 'default' as const : 'destructive' as const,
        text: emailSend.success ? 'Sent ✓' : 'Failed ✗',
        disabled: true,
        className: emailSend.success ? 'bg-green-600 hover:bg-green-700 text-white' : ''
      };
    }
    
    return {
      variant: 'outline' as const,
      text: 'Send Schedule',
      disabled: false
    };
  };

  // Generate AI prompt based on doctor requests and preferences
  const generateAIPrompt = () => {
    if (!currentBlock) return "No active block available.";
    const blockStart = parseLocalDate(currentBlock.start_monday_date);
    const blockEnd = parseLocalDate(currentBlock.end_sunday_date);

    // Get submitted requests
    const submittedRequests = doctorRequests.filter(req => req.status === 'submitted');
    let prompt = `**Role:** You are a medical call-scheduling AI. Generate an optimal 7-week on-call schedule for 7 doctors.

**Schedule Period**

* Start: ${format(blockStart, 'yyyy-MM-dd')} (a Monday)
* Duration: 7 weeks (Mon–Sun weeks; 49 consecutive days)

**Doctors (exactly 7)**

* Klein, LeBlanc, Johnson, Kenney, LaBerge, Clinger, Demerson

  * Standing constraint: **LeBlanc may never be scheduled on a Tuesday.**

**Hard Constraints (must never be violated)**

1. **Coverage:** Exactly **one** doctor assigned per calendar day.
2. **Weekend bundle per doctor:** Each doctor is assigned **exactly one** full weekend bundle in the block (Fri+Sat+Sun of the same week).
3. **No adjacency around a doctor's weekend:** For any doctor's Fri+Sat+Sun bundle:

   * That doctor **cannot** be assigned the **Thursday immediately before** it.
   * That doctor **cannot** be assigned the **Monday immediately after** it.
4. **Weekday totals:** Across the 7 weeks, each doctor is assigned **exactly 4 weekdays** from **Monday–Thursday** (no Fri/Sat/Sun count toward this).
5. **Max one weekday per week per doctor:** For every doctor, in each week, at most **one** of Mon–Thu may be assigned to that doctor.
6. **Doctor-specific rule:** **LeBlanc** is assigned **0 Tuesdays** across the entire block.
7. **Time-off / Unavailability:** Any date listed as unavailable for a doctor is a **hard exclude** for that doctor.
8. **Date bounds:** Do not assign outside the 49-day window.

**Soft Constraints (optimize these after satisfying all hard constraints)**
A) **Honor preferred weekend(s):** If a doctor listed preferred weekend bundles, assign them when feasible.
B) **Fairness / Smoothness:** Spread each doctor's 4 Mon–Thu days across the block to avoid front-loading or back-loading (aim for at least one weekday in early weeks and one in late weeks when feasible).
C) **Even distribution per week:** Avoid stacking many different doctors' weekdays into the same one or two weeks if alternatives exist.

**Optimization Objective (lexicographic preference)**

1. Minimize the number of **preferred-weekend violations** (doctor has a preferred weekend but receives a different one).
2. Minimize **weekday distribution imbalance** per doctor across the 7 weeks (avoid clustering all 4 weekdays into the same small window).
3. Minimize minor aesthetic issues (e.g., avoid same doctor on back-to-back weekdays across week boundaries when alternatives exist).

**Input You Will Receive**

* Block start Monday date: ${format(blockStart, 'yyyy-MM-dd')}
* Per-doctor: unavailable dates (hard), preferred weekend indices (soft), optional notes.`;
    if (submittedRequests.length === 0 && neverSubmittedDoctors.size === 0) {
      prompt += `\n\nNo doctor preferences have been submitted yet. Use default fair distribution.`;
    } else {
      prompt += `\n\n**Doctor Preferences & Constraints:**`;

      // Handle submitted requests
      submittedRequests.forEach(request => {
        const doctor = doctors.find(d => d.id === request.doctor_id);
        if (doctor) {
          prompt += `\n\n**${doctor.name}:**`;
          if (request.unavailable_dates && request.unavailable_dates.length > 0) {
            const unavailableDates = request.unavailable_dates.map(dateStr => format(parseLocalDate(dateStr), 'yyyy-MM-dd')).join(', ');
            prompt += `\n- Unavailable dates (hard): ${unavailableDates}`;
          }
          if (request.preferred_weekends && request.preferred_weekends.length > 0) {
            const preferredWeekends = request.preferred_weekends.join(', ');
            prompt += `\n- Preferred weekend indices (soft): ${preferredWeekends}`;
          }
          if (request.notes && request.notes.trim()) {
            prompt += `\n- Notes: ${request.notes}`;
          }
        }
      });

      // Handle doctors marked as "never submitted"
      doctors.forEach(doctor => {
        if (neverSubmittedDoctors.has(doctor.id)) {
          const hasExistingRequest = submittedRequests.some(req => req.doctor_id === doctor.id);
          if (!hasExistingRequest) {
            prompt += `\n\n**${doctor.name}:**`;
            prompt += `\n- No preferences submitted (use default scheduling)`;
            prompt += `\n- No unavailable dates`;
            prompt += `\n- No preferred weekends`;
          }
        }
      });
    }
    prompt += `

**Output Requirements**
Provide both human-readable and machine-readable outputs.

1. **Readable schedule (by week):**

   * Week N (Mon–Sun with dates):
     Mon, YYYY-MM-DD — {Doctor}
     Tue, YYYY-MM-DD — {Doctor}
     Wed, YYYY-MM-DD — {Doctor}
     Thu, YYYY-MM-DD — {Doctor}
     Fri, YYYY-MM-DD — {Doctor}  (Weekend Bundle if Fri)
     Sat, YYYY-MM-DD — {Doctor}  (Weekend Bundle if Sat)
     Sun, YYYY-MM-DD — {Doctor}  (Weekend Bundle if Sun)

2. **Per-doctor summary:**

   * {Doctor}: Weekend = Week # (Fri/Sat/Sun dates), Weekdays = [Week#/Day, …] (total must equal 4)

3. **JSON payload (strict schema):**

\`\`\`json
{
  "block": {
    "start_monday": "${format(blockStart, 'yyyy-MM-dd')}",
    "end_sunday": "${format(blockEnd, 'yyyy-MM-dd')}"
  },
  "assignments": [
    {"date": "YYYY-MM-DD", "weekday": "Mon|Tue|Wed|Thu|Fri|Sat|Sun", "doctor": "Klein|LeBlanc|Johnson|Kenney|LaBerge|Clinger|Demerson", "is_weekend": true|false, "week_index": 1}
    // 49 records total
  ],
  "doctor_summaries": [
    {"doctor": "Klein", "weekend_week_index": 3, "weekend_dates": ["YYYY-MM-DD","YYYY-MM-DD","YYYY-MM-DD"], "weekday_dates": ["YYYY-MM-DD", "YYYY-MM-DD", "YYYY-MM-DD", "YYYY-MM-DD"]}
    // one per doctor
  ],
  "validation": {
    "hard_constraints_passed": true,
    "errors": []
  }
}
\`\`\`

**Validator (run before returning output)**
Confirm all of the following are true; otherwise set \`hard_constraints_passed=false\` and list each violation in \`errors\`:

* Every date in the 49-day range is assigned exactly once.
* For each doctor:

  * Exactly **one** Fri+Sat+Sun bundle (same week).
  * **Zero** assignment on the Thu immediately before their weekend.
  * **Zero** assignment on the Mon immediately after their weekend.
  * Exactly **4** total assignments among Mon–Thu across the full block.
  * In each week, **≤1** assignment among Mon–Thu.
* For LeBlanc: **0** Tuesday assignments.
* No assignment occurs on a date marked unavailable for that doctor.

**Tie-Breakers (if multiple optimal solutions)**

1. Prefer giving each doctor one weekday in the first 3 weeks **and** one weekday in the last 3 weeks when possible.
2. Prefer distributing Tuesday assignments evenly among the doctors who can take Tuesday (never LeBlanc).
3. Prefer that a doctor's weekend be as close as possible to their preferred weekend if an exact match isn't feasible.
4. If still tied, choose the lexicographically smallest schedule by (week, day, doctor name).

**Failure / Infeasibility Behavior**

* If infeasible under the hard constraints, do **not** relax them.
* Return an **Infeasibility Report** listing the minimal conflicting elements (e.g., too many Tuesday unavailabilities combined with the LeBlanc Tuesday ban, dense time-off near all weekends). Include the smallest set of **soft** preference relaxations that would restore feasibility (never relax hard rules).

**Formatting Notes**

* Use the exact doctor names above in all outputs.
* Use ISO dates (YYYY-MM-DD).
* Week indices are 1–7 where Week 1 is the start week.`;
    return prompt;
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
      const {
        error
      } = await supabase.from('blocks').update({
        start_monday_date: format(editStartDate, 'yyyy-MM-dd'),
        end_sunday_date: format(calculatedEndDate, 'yyyy-MM-dd')
      }).eq('id', currentBlock.id);
      if (error) throw error;

      // Update the current block state immediately for instant UI feedback
      setCurrentBlock({
        ...currentBlock,
        start_monday_date: format(editStartDate, 'yyyy-MM-dd'),
        end_sunday_date: format(calculatedEndDate, 'yyyy-MM-dd')
      });
      toast({
        title: "Success",
        description: `Block dates updated: ${format(editStartDate, 'MMM d, yyyy')} - ${format(calculatedEndDate, 'MMM d, yyyy')}`
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
    const {
      data,
      error
    } = await supabase.from('doctors').select('*').order('name');
    if (error) {
      console.error('Error fetching all doctors:', error);
      return [];
    }
    return data || [];
  };
  const openDoctorDialog = (doctor = null) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setDoctorForm({
        name: doctor.name,
        email: doctor.email,
        mobile: doctor.mobile || "",
        is_admin: doctor.is_admin || false
      });
    } else {
      setEditingDoctor(null);
      setDoctorForm({
        name: "",
        email: "",
        mobile: "",
        is_admin: false
      });
    }
    setShowDoctorDialog(true);
  };
  const closeDoctorDialog = () => {
    setShowDoctorDialog(false);
    setEditingDoctor(null);
    setDoctorForm({
      name: "",
      email: "",
      mobile: "",
      is_admin: false
    });
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
        const {
          error
        } = await supabase.from('doctors').update({
          name: doctorForm.name.trim(),
          email: doctorForm.email.trim(),
          mobile: doctorForm.mobile.trim() || null,
          is_admin: doctorForm.is_admin
        }).eq('id', editingDoctor.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Doctor updated successfully"
        });
      } else {
        // Create new doctor
        const {
          error
        } = await supabase.from('doctors').insert({
          name: doctorForm.name.trim(),
          email: doctorForm.email.trim(),
          mobile: doctorForm.mobile.trim() || null,
          is_admin: doctorForm.is_admin,
          active: true
        });
        if (error) throw error;
        toast({
          title: "Success",
          description: "Doctor added successfully"
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
      const {
        error
      } = await supabase.from('doctors').update({
        active: !doctor.active
      }).eq('id', doctor.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: `Doctor ${doctor.active ? 'deactivated' : 'activated'} successfully`
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
      return {
        submittedCount: 0,
        inProgressCount: 0,
        notStartedCount: 0,
        progressPercent: 0
      };
    }
    const submittedCount = doctorRequests.filter(req => req.status === 'submitted').length;
    const inProgressCount = doctorRequests.filter(req => req.status === 'in_progress').length;
    const notStartedCount = doctors.length - doctorRequests.length;
    const progressPercent = doctors.length > 0 ? submittedCount / doctors.length * 100 : 0;
    return {
      submittedCount,
      inProgressCount,
      notStartedCount,
      progressPercent
    };
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
  const toggleNeverSubmitted = (doctorId: string) => {
    const newSet = new Set(neverSubmittedDoctors);
    if (newSet.has(doctorId)) {
      newSet.delete(doctorId);
    } else {
      newSet.add(doctorId);
    }
    setNeverSubmittedDoctors(newSet);
  };
  const formatDateList = (dates: any[]) => {
    if (!dates || !Array.isArray(dates) || dates.length === 0) return 'None';
    return dates.map(dateStr => {
      // Use parseLocalDate to avoid timezone issues
      const date = parseLocalDate(dateStr);
      return format(date, 'MMM d');
    }).join(', ');
  };
  const formatPreferredWeekends = (weekendNumbers: any[]) => {
    if (!weekendNumbers || !Array.isArray(weekendNumbers) || weekendNumbers.length === 0) return 'None';
    if (!currentBlock) return 'None';
    const startDate = parseLocalDate(currentBlock.start_monday_date);
    return weekendNumbers.map(weekNum => {
      // Calculate the Friday of the specified weekend
      const fridayOfWeek = addDays(startDate, (weekNum - 1) * 7 + 4); // Friday is 4 days after Monday
      const sundayOfWeek = addDays(fridayOfWeek, 2); // Sunday is 2 days after Friday
      return `Week ${weekNum}: ${format(fridayOfWeek, 'MMM d')}-${format(sundayOfWeek, 'd')}`;
    }).join(', ');
  };
  const handleSendReminders = async () => {
    console.log('🟢 handleSendReminders called');
    if (!currentBlock) {
      console.log('❌ No current block');
      return;
    }
    console.log('📊 Current data:', {
      doctorsCount: doctors.length,
      requestsCount: doctorRequests.length,
      currentBlockId: currentBlock.id
    });

    // Find doctors who haven't submitted requests
    const nonSubmitters = doctors.filter(doctor => {
      const request = doctorRequests.find(req => req.doctor_id === doctor.id && req.block_id === currentBlock.id);
      return !request || request.status === 'not_started';
    }).filter(doctor => doctor.active && doctor.email); // Only include active doctors with email addresses

    console.log('📧 Non-submitters with email:', nonSubmitters.map(d => ({
      name: d.name,
      email: d.email
    })));
    if (nonSubmitters.length === 0) {
      console.log('⚠️ No reminders needed');
      toast({
        title: "No Reminders Needed",
        description: "All active doctors with email addresses have already submitted their requests."
      });
      return;
    }
    const blockDates = `${format(parseLocalDate(currentBlock.start_monday_date), 'MMMM d')} - ${format(parseLocalDate(currentBlock.end_sunday_date), 'MMMM d, yyyy')}`;
    const deadlineText = currentBlock.deadline ? format(new Date(currentBlock.deadline), 'MMMM d, yyyy') : 'TBD';
    toast({
      title: "Sending Email Reminders",
      description: `Sending reminders to ${nonSubmitters.length} doctors...`
    });
    let successCount = 0;
    let errorCount = 0;

    // Send emails with a small delay between each
    for (const doctor of nonSubmitters) {
      try {
        console.log(`📧 Sending reminder email to ${doctor.name} (${doctor.email})`);
        const response = await supabase.functions.invoke('send-reminder-email', {
          body: {
            doctorName: doctor.name,
            doctorEmail: doctor.email,
            blockTitle: `${currentBlock.title} (${blockDates})`,
            submissionDeadline: deadlineText,
            doctorPortalUrl: `${window.location.origin}/doctor`
          }
        });
        if (response.error) {
          console.error(`Failed to send email to ${doctor.name}:`, response.error);
          errorCount++;
        } else {
          console.log(`✅ Email sent successfully to ${doctor.name}`);
          successCount++;
        }

        // Small delay between emails
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error sending email to ${doctor.name}:`, error);
        errorCount++;
      }
    }

    // Show final result
    if (successCount > 0 && errorCount === 0) {
      toast({
        title: "Reminders Sent Successfully",
        description: `Email reminders sent to ${successCount} doctors.`
      });
    } else if (successCount > 0 && errorCount > 0) {
      toast({
        title: "Reminders Partially Sent",
        description: `${successCount} emails sent successfully, ${errorCount} failed.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Failed to Send Reminders",
        description: `Failed to send all ${errorCount} reminder emails. Please check the logs.`,
        variant: "destructive"
      });
    }
  };
  const handleSendTestEmail = async () => {
    // Send test email to verify the reminder format
    try {
      console.log('📧 Sending test email to gyndok@yahoo.com');
      const response = await supabase.functions.invoke('send-reminder-email', {
        body: {
          doctorName: "Dr. Test User",
          doctorEmail: "gyndok@yahoo.com",
          blockTitle: "Sample Call Block (November 3 - December 21, 2025)",
          submissionDeadline: "September 15, 2025",
          doctorPortalUrl: `${window.location.origin}/doctor`,
          isTest: true
        }
      });
      if (response.error) {
        console.error('Failed to send test email:', response.error);
        toast({
          title: "Failed to Send Test Email",
          description: "Please check the logs for details.",
          variant: "destructive"
        });
      } else {
        console.log('✅ Test email sent successfully');
        toast({
          title: "Test Email Sent",
          description: "Check your inbox at gyndok@yahoo.com"
        });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive"
      });
    }
  };
  const handleSendIndividualReminder = async (doctor: any) => {
    if (doctor.status === 'submitted') {
      toast({
        title: "Already Submitted",
        description: `${doctor.name} has already submitted their preferences.`
      });
      return;
    }
    if (!canSendReminder(doctor.id)) {
      toast({
        title: "Recently Sent",
        description: `Reminder already sent to ${doctor.name}. Please wait 24 hours before sending another.`,
        variant: "destructive"
      });
      return;
    }
    try {
      console.log(`📧 Sending individual reminder email to ${doctor.name} (${doctor.email})`);
      const blockDates = currentBlock ? `${format(parseLocalDate(currentBlock.start_monday_date), 'MMMM d')} - ${format(parseLocalDate(currentBlock.end_sunday_date), 'MMMM d, yyyy')}` : 'Call Block';
      const deadlineText = currentBlock?.deadline ? format(new Date(currentBlock.deadline), 'MMMM d, yyyy') : 'TBD';
      const response = await supabase.functions.invoke('send-reminder-email', {
        body: {
          doctorName: doctor.name,
          doctorEmail: doctor.email,
          blockTitle: `Call Block (${blockDates})`,
          submissionDeadline: deadlineText,
          doctorPortalUrl: `${window.location.origin}/doctor`
        }
      });
      const success = !response.error;

      // Update reminder tracking state
      setReminderSends(prev => ({
        ...prev,
        [doctor.id]: {
          sentAt: Date.now(),
          success
        }
      }));
      if (response.error) {
        console.error(`Failed to send email to ${doctor.name}:`, response.error);
        toast({
          title: "Failed to Send Reminder",
          description: "Please check the logs for details.",
          variant: "destructive"
        });
      } else {
        console.log(`✅ Email sent successfully to ${doctor.name}`);
        toast({
          title: "Reminder Sent",
          description: `Email reminder sent to ${doctor.name}`
        });
      }
    } catch (error) {
      console.error(`Error sending email to ${doctor.name}:`, error);

      // Track failed attempt
      setReminderSends(prev => ({
        ...prev,
        [doctor.id]: {
          sentAt: Date.now(),
          success: false
        }
      }));
      toast({
        title: "Error",
        description: "Failed to send reminder email",
        variant: "destructive"
      });
    }
  };

  // Edit request functions
  const openEditRequestDialog = (doctor: any) => {
    if (doctor.request) {
      // Editing existing request
      setEditingRequest(doctor.request);
      setEditRequestForm({
        unavailable_dates: Array.isArray(doctor.request.unavailable_dates) ? doctor.request.unavailable_dates.map((date: string) => parseLocalDate(date)) : [],
        preferred_weekends: Array.isArray(doctor.request.preferred_weekends) ? doctor.request.preferred_weekends : [],
        notes: doctor.request.notes || ""
      });
    } else {
      // Creating new request for doctor without one
      setEditingRequest({
        doctor_id: doctor.id,
        block_id: currentBlock?.id,
        isNew: true
      });
      setEditRequestForm({
        unavailable_dates: [],
        preferred_weekends: [],
        notes: ""
      });
    }
    setShowEditRequestDialog(true);
  };
  const closeEditRequestDialog = () => {
    setShowEditRequestDialog(false);
    setEditingRequest(null);
    setEditRequestForm({
      unavailable_dates: [],
      preferred_weekends: [],
      notes: ""
    });
  };
  const saveEditedRequest = async () => {
    if (!editingRequest) return;
    setSaving(true);
    try {
      if (editingRequest.isNew) {
        // Creating a new request
        const {
          error
        } = await supabase.from('doctor_requests').insert({
          doctor_id: editingRequest.doctor_id,
          block_id: editingRequest.block_id,
          unavailable_dates: editRequestForm.unavailable_dates.map(date => format(date, 'yyyy-MM-dd')),
          preferred_weekends: editRequestForm.preferred_weekends,
          notes: editRequestForm.notes,
          status: 'not_started'
        });
        if (error) throw error;
        toast({
          title: "Request Created",
          description: "Doctor's request has been created successfully."
        });
      } else {
        // Updating existing request
        const {
          error
        } = await supabase.from('doctor_requests').update({
          unavailable_dates: editRequestForm.unavailable_dates.map(date => format(date, 'yyyy-MM-dd')),
          preferred_weekends: editRequestForm.preferred_weekends,
          notes: editRequestForm.notes,
          updated_at: new Date().toISOString()
        }).eq('id', editingRequest.id);
        if (error) throw error;
        toast({
          title: "Request Updated",
          description: "Doctor's request has been updated successfully."
        });
      }
      closeEditRequestDialog();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error saving request:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  const removeUnavailableDate = (dateToRemove: Date) => {
    setEditRequestForm({
      ...editRequestForm,
      unavailable_dates: editRequestForm.unavailable_dates.filter(date => format(date, 'yyyy-MM-dd') !== format(dateToRemove, 'yyyy-MM-dd'))
    });
  };
  const addUnavailableDate = (date: Date | undefined) => {
    if (date && !editRequestForm.unavailable_dates.some(existingDate => format(existingDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'))) {
      setEditRequestForm({
        ...editRequestForm,
        unavailable_dates: [...editRequestForm.unavailable_dates, date]
      });
    }
  };
  if (loading) {
    return <ProtectedRoute requireAdmin={true}>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </ProtectedRoute>;
  }
  return <ProtectedRoute requireAdmin={true}>
      <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage call blocks, monitor submissions, and generate AI-powered schedules</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/doctor')} className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Switch to Doctor View
            </Button>
            <Button variant="outline" onClick={signOut} className="flex items-center gap-2">
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
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
                  <Input id="new-start-date" type="date" value={newBlockStartDate} onChange={e => setNewBlockStartDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="new-deadline">Submission Deadline (Optional)</Label>
                  <Input id="new-deadline" type="datetime-local" value={newBlockDeadline} onChange={e => setNewBlockDeadline(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createNewBlock} disabled={saving}>
                  {saving ? "Creating..." : "Create Block & Clean Old Data"}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full lg:w-fit grid-cols-5 lg:grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="doctors">Doctors</TabsTrigger>
            <TabsTrigger value="publish">Publish</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {currentBlock ? <>
                {/* Submission Progress Alert */}
                {(() => {
                const activeDoctors = doctors.filter(d => d.active);
                const submittedCount = activeDoctors.filter(doctor => {
                  const request = doctorRequests.find(req => req.doctor_id === doctor.id);
                  return request && request.status === 'submitted';
                }).length;
                const totalDoctors = activeDoctors.length;
                const allSubmitted = submittedCount === totalDoctors && totalDoctors > 0;
                return <Alert className={cn("mb-6", allSubmitted ? "border-success bg-success/10" : "border-warning bg-warning/10")}>
                      <div className="flex items-center gap-3">
                        {allSubmitted ? <CheckCircle className="h-5 w-5 text-success" /> : <Clock className="h-5 w-5 text-warning" />}
                        <div className="flex-1">
                          <div className="font-semibold">
                            {allSubmitted ? "🎉 All Doctors Have Submitted!" : `Waiting for ${totalDoctors - submittedCount} more submission${totalDoctors - submittedCount !== 1 ? 's' : ''}`}
                          </div>
                          <AlertDescription className="mt-1">
                            {allSubmitted ? "All active doctors have submitted their preferences. You can now generate the schedule." : `${submittedCount} of ${totalDoctors} doctors have submitted their requests.`}
                          </AlertDescription>
                        </div>
                        {allSubmitted && <Button className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => {
                      toast({
                        title: "Ready to Generate Schedule",
                        description: "All doctors have submitted. You can now create the final schedule."
                      });
                    }}>
                            Generate Schedule
                          </Button>}
                      </div>
                    </Alert>;
              })()}

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
                        <Button variant="outline" size="sm" onClick={handleSendReminders} disabled={!currentBlock}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Reminders
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSendTestEmail}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Test Email
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => updateBlockStatus(currentBlock.id, currentBlock.status === 'closed' ? 'collecting' : 'closed')} disabled={saving}>
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
                             <TableHead className="w-20">Never Submitted</TableHead>
                             <TableHead>Doctor</TableHead>
                             <TableHead>Email</TableHead>
                             <TableHead>Status</TableHead>
                             <TableHead>Submitted At</TableHead>
                             <TableHead className="w-24">Actions</TableHead>
                           </TableRow>
                         </TableHeader>
                        <TableBody>
                          {doctorStatuses.map(doctor => <React.Fragment key={doctor.email}>
                              <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRowExpansion(doctor.email)}>
                                <TableCell>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    {expandedRows.has(doctor.email) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                  </Button>
                                </TableCell>
                                <TableCell onClick={e => e.stopPropagation()}>
                                  {doctor.status !== 'submitted' ? <Checkbox checked={neverSubmittedDoctors.has(doctor.id)} onCheckedChange={() => toggleNeverSubmitted(doctor.id)} /> : <span className="text-muted-foreground text-sm">-</span>}
                                </TableCell>
                                 <TableCell className="font-medium">{doctor.name}</TableCell>
                                 <TableCell>{doctor.email}</TableCell>
                                 <TableCell>{getStatusBadge(doctor.status)}</TableCell>
                                 <TableCell>{doctor.submittedAt || '-'}</TableCell>
                                 <TableCell onClick={e => e.stopPropagation()}>
                                   <div className="flex gap-1">
                                     <Button variant="outline" size="sm" onClick={() => openEditRequestDialog(doctor)}>
                                       <Edit className="h-3 w-3 mr-1" />
                                       {doctor.request ? 'Edit' : 'Create'}
                                     </Button>
                                     {doctor.status !== 'submitted' && (() => {
                                const buttonState = getReminderButtonState(doctor.id);
                                return <Button variant={buttonState.variant} size="sm" onClick={() => handleSendIndividualReminder(doctor)} disabled={!doctor.email || buttonState.disabled} className={buttonState.className}>
                                                <Mail className="h-3 w-3 mr-1" />
                                                {buttonState.text}
                                              </Button>;
                              })()}
                                   </div>
                                 </TableCell>
                              </TableRow>
                              {expandedRows.has(doctor.email) && doctor.request && <TableRow>
                                   <TableCell colSpan={7} className="bg-muted/30 p-6">{/* Updated colSpan from 6 to 7 */}
                                    <div className="space-y-4">
                                       <h4 className="font-semibold text-sm">Request Details</h4>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <Label className="font-medium text-muted-foreground">Unavailable Dates</Label>
                                          <p className="mt-1">{formatDateList(doctor.request.unavailable_dates)}</p>
                                        </div>
                                         <div>
                                           <Label className="font-medium text-muted-foreground">Preferred Weekends</Label>
                                           <p className="mt-1">{formatPreferredWeekends(doctor.request.preferred_weekends)}</p>
                                         </div>
                                        {doctor.request.notes && <div className="md:col-span-2">
                                            <Label className="font-medium text-muted-foreground">Notes</Label>
                                            <p className="mt-1 text-muted-foreground">{doctor.request.notes}</p>
                                          </div>}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>}
                           </React.Fragment>)}
                       </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </> : <Card className="shadow-soft">
                <CardContent className="py-16 text-center">
                  <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new call block to get started with managing doctor schedules
                  </p>
                </CardContent>
              </Card>}
          </TabsContent>

          {/* Configure Tab */}
          <TabsContent value="configure" className="space-y-6">
            {currentBlock ? <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Current Block Configuration</CardTitle>
                  <CardDescription>Manage the current call block settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Block Dates</h3>
                    {!isEditingDates ? <Button variant="outline" size="sm" onClick={startEditingDates}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Dates
                      </Button> : <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditingDates}>
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveBlockDates} disabled={saving}>
                          <Save className="h-4 w-4 mr-2" />
                          {saving ? "Saving..." : "Save"}
                        </Button>
                      </div>}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Start Date</Label>
                      {!isEditingDates ? <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.start_monday_date), 'MMM d, yyyy')}</p> : <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !editStartDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {editStartDate ? format(editStartDate, "PPP") : <span>Pick a date</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={editStartDate} onSelect={date => setEditStartDate(date)} initialFocus className={cn("p-3 pointer-events-auto")} />
                          </PopoverContent>
                        </Popover>}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                      {!isEditingDates ? <p className="text-lg font-semibold">{format(parseLocalDate(currentBlock.end_sunday_date), 'MMM d, yyyy')}</p> : <p className="text-lg font-semibold text-muted-foreground mt-1">
                          {editStartDate ? format(addDays(addWeeks(editStartDate, 7), -1), 'MMM d, yyyy') : 'Auto-calculated'}
                          <span className="block text-sm font-normal">Automatically calculated as 7 weeks from start date</span>
                        </p>}
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                      <div className="mt-1">
                        <Select value={currentBlock.status} onValueChange={status => updateBlockStatus(currentBlock.id, status)} disabled={isEditingDates}>
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

                  {currentBlock.deadline && <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Submission Deadline:</strong> {format(new Date(currentBlock.deadline), 'MMM d, yyyy h:mm a')}
                      </AlertDescription>
                    </Alert>}
                </CardContent>
              </Card> : <Card className="shadow-soft">
                <CardContent className="py-16 text-center">
                  <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a new call block to configure settings
                  </p>
                </CardContent>
              </Card>}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            {currentBlock ? <>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">AI Schedule Generation</h2>
                    
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={generateSchedule} disabled={saving} className="bg-gradient-primary hover:opacity-90">
                      <Play className="h-4 w-4 mr-2" />
                       {saving ? "Generating..." : "Generate AI Schedule"}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setImportDialogOpen(true)}
                      disabled={!currentBlock}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import ChatGPT
                    </Button>
                    <Button variant="outline" disabled={assignments.length === 0}>
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                {/* AI Prompt Preview */}
                <Card className="card-stats">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Settings className="h-5 w-5 text-primary" />
                      AI Scheduling Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                        {generateAIPrompt()}
                      </pre>
                    </div>
                  </CardContent>
                </Card>

                {assignments.length > 0 ? <ScheduleVisualization assignments={assignments} block={currentBlock} /> : <Card className="shadow-soft">
                    <CardContent className="py-16 text-center">
                       <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                       <h3 className="text-xl font-semibold mb-2">No Schedule Generated</h3>
                        <p className="text-muted-foreground mb-4">
                          Generate an AI-powered schedule using ChatGPT to assign doctors optimally
                        </p>
                       <Button onClick={generateSchedule} disabled={saving}>
                         {saving ? "Generating..." : "Generate AI Schedule"}
                       </Button>
                     </CardContent>
                   </Card>}
               </> : <Card className="shadow-soft">
                 <CardContent className="py-16 text-center">
                   <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Call Block</h3>
                  <p className="text-muted-foreground mb-4">
                    Create a call block first to generate schedules
                  </p>
                </CardContent>
              </Card>}
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
                  <TableHead>Password Setup</TableHead>
                  <TableHead>Last Login</TableHead>
                      <TableHead>Send Schedule</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctors.map(doctor => <TableRow key={doctor.id}>
                        <TableCell className="font-medium">{doctor.name}</TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell>{doctor.mobile || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={doctor.active ? "default" : "secondary"}>
                            {doctor.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                  <TableCell>
                    {doctor.account_setup_completed ? <Badge className="bg-success text-success-foreground">
                        Complete
                      </Badge> : <Badge variant="destructive">
                        Pending
                      </Badge>}
                  </TableCell>
                  <TableCell>
                     {doctor.first_login_at ? <span className="text-sm text-muted-foreground">
                         {format(new Date(doctor.first_login_at), 'MMM d, yyyy h:mm a')}
                       </span> : <span className="text-sm text-muted-foreground">Never</span>}
                   </TableCell>
                        <TableCell>
                          {(() => {
                            const buttonState = getEmailButtonState(doctor.id);
                            return (
                              <Button 
                                variant={buttonState.variant}
                                size="sm" 
                                onClick={() => sendIndividualScheduleEmail(doctor)}
                                disabled={buttonState.disabled || !currentBlock || currentBlock.status !== 'published'}
                                className={buttonState.className}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                {buttonState.text}
                              </Button>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => openDoctorDialog(doctor)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => toggleDoctorActive(doctor)} disabled={saving}>
                              {doctor.active ? <X className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>)}
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
                    <Input id="doctor-name" value={doctorForm.name} onChange={e => setDoctorForm({
                      ...doctorForm,
                      name: e.target.value
                    })} placeholder="Enter doctor's full name" />
                  </div>
                  <div>
                    <Label htmlFor="doctor-email">Email</Label>
                    <Input id="doctor-email" type="email" value={doctorForm.email} onChange={e => setDoctorForm({
                      ...doctorForm,
                      email: e.target.value
                    })} placeholder="doctor@example.com" />
                  </div>
                  <div>
                    <Label htmlFor="doctor-mobile">AI Scheduling Prompt</Label>
                    <Input id="doctor-mobile" value={doctorForm.mobile} onChange={e => setDoctorForm({
                      ...doctorForm,
                      mobile: e.target.value
                    })} placeholder="+1 (555) 123-4567" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="doctor-admin" checked={doctorForm.is_admin} onCheckedChange={checked => setDoctorForm({
                      ...doctorForm,
                      is_admin: !!checked
                    })} />
                    <Label htmlFor="doctor-admin">Admin privileges</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeDoctorDialog}>
                    Cancel
                  </Button>
                  <Button onClick={saveDoctor} disabled={saving}>
                    {saving ? "Saving..." : editingDoctor ? "Update" : "Add"} Doctor
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <AIPromptEditor />
          </TabsContent>

          {/* Publish Tab */}
          <TabsContent value="publish" className="space-y-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Google Calendar Integration</CardTitle>
                <CardDescription>Publish schedule to Google Calendar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {publishStatus && <Alert className={publishStatus.type === 'error' ? 'border-destructive bg-destructive/10' : 'border-green-500 bg-green-50'}>
                    {publishStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {publishStatus.message}
                    </AlertDescription>
                  </Alert>}

                <div className="space-y-4">
                  <GoogleCalendarConnect onConnected={fetchData} />

                  {testStatus && <Alert className={testStatus.type === 'error' ? "border-destructive" : "border-green-500"}>
                    {testStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {testStatus.message}
                    </AlertDescription>
                  </Alert>}

                  {unpublishStatus && <Alert className={unpublishStatus.type === 'error' ? "border-destructive" : "border-green-500"}>
                    {unpublishStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {unpublishStatus.message}
                    </AlertDescription>
                  </Alert>}

                  {emailStatus && <Alert className={emailStatus.type === 'error' ? "border-destructive" : "border-green-500"}>
                    {emailStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    <AlertDescription>
                      {emailStatus.message}
                    </AlertDescription>
                  </Alert>}

                  {currentBlock && currentBlock.status === 'published' && (
                    <div className="space-y-3 p-4 border rounded bg-muted/30">
                      <Label htmlFor="custom-email-message" className="text-sm font-medium">
                        Custom Message (Optional)
                      </Label>
                      <Textarea
                        id="custom-email-message"
                        placeholder="Add a custom message to include in the schedule emails..."
                        value={customEmailMessage}
                        onChange={(e) => setCustomEmailMessage(e.target.value)}
                        className="min-h-[80px]"
                        disabled={sendingEmails}
                      />
                      <p className="text-xs text-muted-foreground">
                        This message will be included at the beginning of each doctor's schedule email.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 flex-wrap">
                    <Button onClick={testCalendar} disabled={testingCalendar} variant="outline" size="sm">
                      {testingCalendar ? "Testing..." : "Test Calendar"}
                    </Button>
                    
                    <Button onClick={manualCleanup} disabled={cleaningUp} variant="outline" size="sm" className="text-orange-600 border-orange-600 hover:bg-orange-50">
                      {cleaningUp ? "Cleaning..." : "Clean Old Data"}
                    </Button>
                    
                    <Button onClick={publishToCalendar} disabled={!currentBlock || assignments.length === 0 || publishing} className="bg-gradient-primary hover:opacity-90">
                      <Upload className="h-4 w-4 mr-2" />
                      {publishing ? "Publishing..." : "Publish to Calendar"}
                    </Button>
                    <Button variant="outline" disabled={!currentBlock || currentBlock.status !== 'published' || unpublishing} onClick={unpublishSchedule}>
                      {unpublishing ? "Unpublishing..." : "Unpublish Schedule"}
                    </Button>
                    <Button onClick={sendMassEmail} disabled={!currentBlock || currentBlock.status !== 'published' || sendingEmails} className="bg-blue-600 hover:bg-blue-700 text-white">
                      <Mail className="h-4 w-4 mr-2" />
                      {sendingEmails ? "Sending..." : "Email Schedule to All Doctors"}
                    </Button>
                    <Button onClick={resetScheduleEmailSends} variant="outline" size="sm" className="text-gray-600 hover:bg-gray-50">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset Email Status
                    </Button>
                  </div>

                   {lastPublishResult && <div className="p-3 border rounded bg-muted/30">
                       <p className="text-sm font-medium">Last Publication:</p>
                       <p className="text-sm text-muted-foreground mb-2">
                         Created {lastPublishResult.eventsCreated} total calendar events
                         ({lastPublishResult.callEvents || 0} call events, {lastPublishResult.offEvents || 0} off events)
                       </p>
                       <div className="text-xs text-muted-foreground mb-2">
                         • Call events → On-Call Calendar
                         <br />
                         • Off events → Staffing Calendar
                       </div>
                       {lastPublishResult.events && <details className="mt-2">
                           <summary className="text-sm cursor-pointer text-primary hover:underline">
                             View Events ({lastPublishResult.events.length})
                           </summary>
                           <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                             {lastPublishResult.events.map((event, index) => <div key={index} className="text-xs p-2 bg-background rounded border">
                                 <strong>{event.summary}</strong>
                                 <br />
                                 {event.start.date} - {event.end.date}
                               </div>)}
                           </div>
                         </details>}
                     </div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>

      {/* Edit Request Dialog */}
      <Dialog open={showEditRequestDialog} onOpenChange={setShowEditRequestDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Doctor Request</DialogTitle>
            <DialogDescription>
              Manually edit unavailable dates and preferences for this doctor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Unavailable Dates Section */}
            <div>
              <Label className="text-base font-medium">Unavailable Dates</Label>
              <div className="space-y-3 mt-2">
                {/* Current unavailable dates */}
                <div className="flex flex-wrap gap-2">
                  {editRequestForm.unavailable_dates.map((date, index) => <Badge key={index} variant="outline" className="px-2 py-1">
                      {format(date, 'MMM d, yyyy')}
                      <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground" onClick={() => removeUnavailableDate(date)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>)}
                  {editRequestForm.unavailable_dates.length === 0 && <span className="text-muted-foreground text-sm">No unavailable dates</span>}
                </div>
                
                {/* Add new date */}
                <div>
                  <Label className="text-sm text-muted-foreground">Add Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Add unavailable date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" onSelect={addUnavailableDate} initialFocus className={cn("p-3 pointer-events-auto")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Preferred Weekends Section */}
            <div>
              <Label className="text-base font-medium">Preferred Weekends</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[1, 2, 3, 4, 5, 6, 7].map(weekNum => {
                const isSelected = editRequestForm.preferred_weekends.includes(weekNum);
                const weekEndDates = currentBlock ? (() => {
                  const startDate = parseLocalDate(currentBlock.start_monday_date);
                  const fridayOfWeek = addDays(startDate, (weekNum - 1) * 7 + 4);
                  const sundayOfWeek = addDays(fridayOfWeek, 2);
                  return `${format(fridayOfWeek, 'MMM d')}-${format(sundayOfWeek, 'd')}`;
                })() : '';
                return <div key={weekNum} className={cn("p-2 border rounded cursor-pointer transition-colors", isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")} onClick={() => {
                  if (isSelected) {
                    setEditRequestForm({
                      ...editRequestForm,
                      preferred_weekends: editRequestForm.preferred_weekends.filter(w => w !== weekNum)
                    });
                  } else {
                    setEditRequestForm({
                      ...editRequestForm,
                      preferred_weekends: [...editRequestForm.preferred_weekends, weekNum]
                    });
                  }
                }}>
                      <div className="text-sm font-medium">Week {weekNum}</div>
                      <div className="text-xs text-muted-foreground">{weekEndDates}</div>
                    </div>;
              })}
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <Label htmlFor="request-notes" className="text-base font-medium">Notes</Label>
              <Textarea id="request-notes" value={editRequestForm.notes} onChange={e => setEditRequestForm({
              ...editRequestForm,
              notes: e.target.value
            })} placeholder="Additional notes or special requests..." className="mt-2" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditRequestDialog}>
              Cancel
            </Button>
            <Button onClick={saveEditedRequest} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ChatGPT Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import ChatGPT Schedule</DialogTitle>
            <DialogDescription>
              Paste the JSON schedule generated by ChatGPT
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule-json" className="text-base font-medium">ChatGPT JSON Output</Label>
              <Textarea
                id="schedule-json"
                placeholder='Paste your ChatGPT JSON here...\n\nExample:\n[\n  {"date": "2025-11-03", "doctor": "Klein"},\n  {"date": "2025-11-04", "doctor": "Johnson"}\n]'
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="mt-2 min-h-32 font-mono text-sm"
                rows={8}
              />
              <p className="text-sm text-muted-foreground mt-2">
                Expected JSON format with "date" and "doctor" fields. Doctor names can be first name, last name, or full name.
              </p>
            </div>
            {importText.trim() && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Ready to import:</p>
                <p className="text-sm text-muted-foreground">
                  {importText.trim().split('\n').length} lines of JSON data
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              setImportText('');
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={importChatGPTSchedule} 
              disabled={!importText.trim() || importing}
            >
              {importing ? "Importing..." : "Import Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ProtectedRoute>;
};
export default AdminDashboard;