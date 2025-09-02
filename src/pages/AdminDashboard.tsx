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
  ChevronRight,
  UserCheck
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import ScheduleVisualization from "@/components/ScheduleVisualization";
import ProtectedRoute from "@/components/ProtectedRoute";
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
  
  const { user, isAdmin } = useAuth();
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
  const [doctorForm, setDoctorForm] = useState({ name: "", email: "", mobile: "", is_admin: false });

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

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [lastPublishResult, setLastPublishResult] = useState<any>(null);

  // Never submitted tracking state
  const [neverSubmittedDoctors, setNeverSubmittedDoctors] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch blocks (but prioritize active 'collecting' blocks)
      const { data: blocksData, error: blocksError } = await supabase
        .from('blocks')
        .select('*')
        .order('created_at', { ascending: false });

      if (blocksError) throw blocksError;
      setBlocks(blocksData || []);

      // Get current active block (prefer 'collecting' status, otherwise most recent)
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
        // Fetch doctor requests for CURRENT active block only (not old completed blocks)
        const { data: requestsData, error: requestsError } = await supabase
          .from('doctor_requests')
          .select(`
            *,
            doctors (name, email)
          `)
          .eq('block_id', activeBlock.id); // CRITICAL: Only current block data

        if (requestsError) throw requestsError;
        setDoctorRequests(requestsData || []);

        // Fetch assignments for CURRENT block only (not old published schedules)
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('assignments')
          .select(`
            *,
            doctors (name, email)
          `)
          .eq('block_id', activeBlock.id); // CRITICAL: Only current block assignments

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

  const publishToCalendar = async () => {
    console.log('publishToCalendar function called', { currentBlock });
    if (!currentBlock) {
      console.log('No current block, returning early');
      return;
    }
    
    setPublishing(true);
    setPublishStatus(null);
    
    try {
      console.log('Calling supabase function with:', { blockId: currentBlock.id });
      const { data, error } = await supabase.functions.invoke('publish-to-calendar', {
        body: { 
          blockId: currentBlock.id,
          calendarId: 'primary' // Can be made configurable later
        }
      });

      console.log('Supabase function response:', { data, error });

      if (error) throw error;

      if (data.success) {
        setPublishStatus({
          type: 'success',
          message: `Successfully prepared ${data.eventsCreated} events for Google Calendar. ${data.message}`
        });
        setLastPublishResult(data);
        await fetchData(); // Refresh to show updated status
        toast({
          title: "Success",
          description: "Schedule published successfully"
        });
      } else {
        throw new Error(data.error || 'Publication failed');
      }
    } catch (error) {
      console.error('Error publishing to calendar:', error);
      setPublishStatus({
        type: 'error',
        message: `Failed to publish: ${error.message}`
      });
      toast({
        title: "Error",
        description: "Failed to publish schedule",
        variant: "destructive"
      });
    } finally {
      setPublishing(false);
    }
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
            const unavailableDates = request.unavailable_dates.map(dateStr => 
              format(parseLocalDate(dateStr), 'yyyy-MM-dd')
            ).join(', ');
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
      setDoctorForm({ 
        name: doctor.name, 
        email: doctor.email, 
        mobile: doctor.mobile || "",
        is_admin: doctor.is_admin || false
      });
    } else {
      setEditingDoctor(null);
      setDoctorForm({ name: "", email: "", mobile: "", is_admin: false });
    }
    setShowDoctorDialog(true);
  };

  const closeDoctorDialog = () => {
    setShowDoctorDialog(false);
    setEditingDoctor(null);
    setDoctorForm({ name: "", email: "", mobile: "", is_admin: false });
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
            mobile: doctorForm.mobile.trim() || null,
            is_admin: doctorForm.is_admin
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
            is_admin: doctorForm.is_admin,
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

  const handleSendReminders = () => {
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
    }).filter(doctor => doctor.active && doctor.mobile); // Only include active doctors with mobile numbers
    
    console.log('📱 Non-submitters with mobile:', nonSubmitters.map(d => ({ name: d.name, mobile: d.mobile })));
    
    if (nonSubmitters.length === 0) {
      console.log('⚠️ No reminders needed');
      toast({
        title: "No Reminders Needed",
        description: "All active doctors with mobile numbers have already submitted their requests.",
      });
      return;
    }
    
    const blockDates = `${format(parseLocalDate(currentBlock.start_monday_date), 'MMMM d')} - ${format(parseLocalDate(currentBlock.end_sunday_date), 'MMMM d, yyyy')}`;
    const deadlineText = currentBlock.deadline ? format(new Date(currentBlock.deadline), 'MMMM d, yyyy') : 'soon';
    
    const message = `Hi! This is a friendly reminder that we need your call schedule preferences for the upcoming call block:

📅 Call Block Dates: ${blockDates}
⏰ Submission Deadline: ${deadlineText}

Please log into the call scheduling system to submit:
• Your unavailable dates
• Your preferred weekend call preferences  
• Any additional notes or special requests

Your input is essential for creating a fair and balanced call schedule for everyone.

If you have any questions or technical difficulties, please don't hesitate to reach out.

Thank you!`;

    // Format phone number for WhatsApp (remove non-digits, ensure it starts with country code)
    const formatPhoneForWhatsApp = (phone: string) => {
      console.log('📞 Formatting phone:', phone);
      // Remove all non-digit characters
      const digits = phone.replace(/\D/g, '');
      console.log('📞 Digits only:', digits);
      // If it starts with 1 and is 11 digits, it's already formatted for US
      if (digits.startsWith('1') && digits.length === 11) {
        return digits;
      }
      // If it's 10 digits, add US country code
      if (digits.length === 10) {
        return '1' + digits;
      }
      return digits; // Return as-is if different format
    };

    // Generate WhatsApp links for each doctor
    const whatsappLinks = nonSubmitters.map(doctor => {
      const formattedPhone = formatPhoneForWhatsApp(doctor.mobile);
      const encodedMessage = encodeURIComponent(message);
      const link = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
      console.log(`🔗 WhatsApp link for ${doctor.name}:`, link);
      return {
        doctor: doctor.name,
        phone: doctor.mobile,
        link: link
      };
    });

    // Show success message
    toast({
      title: `WhatsApp Reminders Ready`,
      description: `Opening WhatsApp for ${nonSubmitters.length} doctors: ${nonSubmitters.map(d => d.name).join(', ')}`,
    });

    console.log('🚀 About to open WhatsApp links:', whatsappLinks.length);

    // Open WhatsApp links with delay between each to avoid overwhelming the browser
    whatsappLinks.forEach((item, index) => {
      setTimeout(() => {
        console.log(`📱 Opening WhatsApp for ${item.doctor} (${item.phone})`);
        console.log(`🔗 Link: ${item.link}`);
        window.open(item.link, '_blank');
      }, index * 1000); // 1 second delay between each link
    });

    // Also show a summary in case some links don't open
    setTimeout(() => {
      const summary = whatsappLinks.map(item => 
        `${item.doctor} (${item.phone}): ${item.link}`
      ).join('\n\n');
      
      if (confirm(`${whatsappLinks.length} WhatsApp windows should have opened. If any didn't open, click OK to see the links.`)) {
        console.log('📋 Showing summary to user');
        alert(`WhatsApp Links:\n\n${summary}`);
      }
    }, whatsappLinks.length * 1000 + 2000);
  };

  // Edit request functions
  const openEditRequestDialog = (doctor: any) => {
    if (!doctor.request) {
      toast({
        title: "No Request Found",
        description: "This doctor hasn't submitted a request yet.",
        variant: "destructive"
      });
      return;
    }

    setEditingRequest(doctor.request);
    setEditRequestForm({
      unavailable_dates: Array.isArray(doctor.request.unavailable_dates) 
        ? doctor.request.unavailable_dates.map((date: string) => parseLocalDate(date))
        : [],
      preferred_weekends: Array.isArray(doctor.request.preferred_weekends) 
        ? doctor.request.preferred_weekends 
        : [],
      notes: doctor.request.notes || ""
    });
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
      const { error } = await supabase
        .from('doctor_requests')
        .update({
          unavailable_dates: editRequestForm.unavailable_dates.map(date => format(date, 'yyyy-MM-dd')),
          preferred_weekends: editRequestForm.preferred_weekends,
          notes: editRequestForm.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRequest.id);

      if (error) throw error;

      toast({
        title: "Request Updated",
        description: "Doctor's request has been updated successfully.",
      });

      closeEditRequestDialog();
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Update Failed",
        description: "Failed to update the request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const removeUnavailableDate = (dateToRemove: Date) => {
    setEditRequestForm({
      ...editRequestForm,
      unavailable_dates: editRequestForm.unavailable_dates.filter(date => 
        format(date, 'yyyy-MM-dd') !== format(dateToRemove, 'yyyy-MM-dd')
      )
    });
  };

  const addUnavailableDate = (date: Date | undefined) => {
    if (date && !editRequestForm.unavailable_dates.some(existingDate => 
      format(existingDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    )) {
      setEditRequestForm({
        ...editRequestForm,
        unavailable_dates: [...editRequestForm.unavailable_dates, date]
      });
    }
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
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/doctor')}
              className="flex items-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              Switch to Doctor View
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
                {/* Submission Progress Alert */}
                {(() => {
                  const activeDoctors = doctors.filter(d => d.active);
                  const submittedCount = activeDoctors.filter(doctor => {
                    const request = doctorRequests.find(req => req.doctor_id === doctor.id);
                    return request && request.status === 'submitted';
                  }).length;
                  const totalDoctors = activeDoctors.length;
                  const allSubmitted = submittedCount === totalDoctors && totalDoctors > 0;

                  return (
                    <Alert className={cn(
                      "mb-6",
                      allSubmitted ? "border-success bg-success/10" : "border-warning bg-warning/10"
                    )}>
                      <div className="flex items-center gap-3">
                        {allSubmitted ? (
                          <CheckCircle className="h-5 w-5 text-success" />
                        ) : (
                          <Clock className="h-5 w-5 text-warning" />
                        )}
                        <div className="flex-1">
                          <div className="font-semibold">
                            {allSubmitted 
                              ? "🎉 All Doctors Have Submitted!" 
                              : `Waiting for ${totalDoctors - submittedCount} more submission${totalDoctors - submittedCount !== 1 ? 's' : ''}`
                            }
                          </div>
                          <AlertDescription className="mt-1">
                            {allSubmitted
                              ? "All active doctors have submitted their preferences. You can now generate the schedule."
                              : `${submittedCount} of ${totalDoctors} doctors have submitted their requests.`
                            }
                          </AlertDescription>
                        </div>
                        {allSubmitted && (
                          <Button 
                            className="bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => {
                              toast({
                                title: "Ready to Generate Schedule",
                                description: "All doctors have submitted. You can now create the final schedule.",
                              });
                            }}
                          >
                            Generate Schedule
                          </Button>
                        )}
                      </div>
                    </Alert>
                  );
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
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleSendReminders}
                          disabled={!currentBlock}
                        >
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
                            <TableHead className="w-20">Never Submitted</TableHead>
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
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  {doctor.status !== 'submitted' ? (
                                    <Checkbox 
                                      checked={neverSubmittedDoctors.has(doctor.id)}
                                      onCheckedChange={() => toggleNeverSubmitted(doctor.id)}
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-sm">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium">{doctor.name}</TableCell>
                                <TableCell>{doctor.email}</TableCell>
                                <TableCell>{getStatusBadge(doctor.status)}</TableCell>
                                <TableCell>{doctor.submittedAt || '-'}</TableCell>
                              </TableRow>
                              {expandedRows.has(doctor.email) && doctor.request && (
                                 <TableRow>
                                   <TableCell colSpan={6} className="bg-muted/30 p-6">{/* Updated colSpan from 5 to 6 */}
                                    <div className="space-y-4">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-sm">Request Details</h4>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={() => openEditRequestDialog(doctor)}
                                        >
                                          <Edit className="h-3 w-3 mr-1" />
                                          Edit Request
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <Label className="font-medium text-muted-foreground">Unavailable Dates</Label>
                                          <p className="mt-1">{formatDateList(doctor.request.unavailable_dates)}</p>
                                        </div>
                                         <div>
                                           <Label className="font-medium text-muted-foreground">Preferred Weekends</Label>
                                           <p className="mt-1">{formatPreferredWeekends(doctor.request.preferred_weekends)}</p>
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

                {/* AI Prompt Preview */}
                <Card className="card-stats">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Settings className="h-5 w-5 text-primary" />
                      AI Scheduling Prompt Preview
                    </CardTitle>
                    <CardDescription>
                      This is the prompt that would be sent to AI for intelligent schedule generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                        {generateAIPrompt()}
                      </pre>
                    </div>
                    <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-accent mt-2 flex-shrink-0"></div>
                        <div className="text-sm">
                          <p className="font-medium text-accent mb-1">Future Enhancement</p>
                          <p className="text-muted-foreground">
                            This prompt will be used when AI-powered scheduling is implemented. 
                            Currently using simple round-robin assignment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

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
                  <TableHead>Password Setup</TableHead>
                  <TableHead>Last Login</TableHead>
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
                    {doctor.account_setup_completed ? (
                      <Badge className="bg-success text-success-foreground">
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {doctor.first_login_at ? (
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(doctor.first_login_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
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
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="doctor-admin"
                      checked={doctorForm.is_admin}
                      onCheckedChange={(checked) => 
                        setDoctorForm({...doctorForm, is_admin: !!checked})
                      }
                    />
                    <Label htmlFor="doctor-admin">Admin privileges</Label>
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
                {publishStatus && (
                  <Alert className={publishStatus.type === 'error' ? 'border-destructive bg-destructive/10' : 'border-green-500 bg-green-50'}>
                    {publishStatus.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>
                      {publishStatus.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-medium mb-2">Google Calendar Integration Status</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      The backend integration is ready. To enable full Google Calendar publishing, you'll need to:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      <li>• Set up Google Calendar OAuth 2.0 credentials</li>
                      <li>• Configure user authentication flow</li>
                      <li>• Connect to your target calendar</li>
                    </ul>
                  </div>

                  <div className="flex gap-4">
                    <Button 
                      onClick={publishToCalendar}
                      disabled={!currentBlock || assignments.length === 0 || publishing}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {publishing ? "Publishing..." : "Publish to Calendar"}
                    </Button>
                    <Button 
                      variant="outline" 
                      disabled={!currentBlock || currentBlock.status !== 'published' || saving}
                      onClick={() => updateBlockStatus(currentBlock?.id || '', 'closed')}
                    >
                      Unpublish Schedule
                    </Button>
                  </div>

                  {lastPublishResult && (
                    <div className="p-3 border rounded bg-muted/30">
                      <p className="text-sm font-medium">Last Publication:</p>
                      <p className="text-sm text-muted-foreground">
                        Created {lastPublishResult.eventsCreated} calendar events
                      </p>
                      {lastPublishResult.events && (
                        <details className="mt-2">
                          <summary className="text-sm cursor-pointer text-primary hover:underline">
                            View Events ({lastPublishResult.events.length})
                          </summary>
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {lastPublishResult.events.map((event, index) => (
                              <div key={index} className="text-xs p-2 bg-background rounded border">
                                <strong>{event.summary}</strong>
                                <br />
                                {event.start.date} - {event.end.date}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
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
                  {editRequestForm.unavailable_dates.map((date, index) => (
                    <Badge key={index} variant="outline" className="px-2 py-1">
                      {format(date, 'MMM d, yyyy')}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 ml-2 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeUnavailableDate(date)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {editRequestForm.unavailable_dates.length === 0 && (
                    <span className="text-muted-foreground text-sm">No unavailable dates</span>
                  )}
                </div>
                
                {/* Add new date */}
                <div>
                  <Label className="text-sm text-muted-foreground">Add Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal mt-1"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Add unavailable date
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        onSelect={addUnavailableDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            {/* Preferred Weekends Section */}
            <div>
              <Label className="text-base font-medium">Preferred Weekends</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[1, 2, 3, 4, 5, 6, 7].map((weekNum) => {
                  const isSelected = editRequestForm.preferred_weekends.includes(weekNum);
                  const weekEndDates = currentBlock ? (() => {
                    const startDate = parseLocalDate(currentBlock.start_monday_date);
                    const fridayOfWeek = addDays(startDate, (weekNum - 1) * 7 + 4);
                    const sundayOfWeek = addDays(fridayOfWeek, 2);
                    return `${format(fridayOfWeek, 'MMM d')}-${format(sundayOfWeek, 'd')}`;
                  })() : '';

                  return (
                    <div
                      key={weekNum}
                      className={cn(
                        "p-2 border rounded cursor-pointer transition-colors",
                        isSelected 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => {
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
                      }}
                    >
                      <div className="text-sm font-medium">Week {weekNum}</div>
                      <div className="text-xs text-muted-foreground">{weekEndDates}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <Label htmlFor="request-notes" className="text-base font-medium">Notes</Label>
              <Textarea
                id="request-notes"
                value={editRequestForm.notes}
                onChange={(e) => setEditRequestForm({...editRequestForm, notes: e.target.value})}
                placeholder="Additional notes or special requests..."
                className="mt-2"
                rows={4}
              />
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
    </ProtectedRoute>
  );
};

export default AdminDashboard;