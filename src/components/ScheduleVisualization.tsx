import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";

// Helper function to parse date-only strings as local dates (avoiding UTC timezone issues)
const parseLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
};

interface Assignment {
  id: string;
  date: string;
  weekday_name: string;
  week_index: number;
  is_weekend: boolean;
  doctor_id: string;
  doctors: {
    name: string;
    email: string;
  };
}

interface Block {
  start_monday_date: string;
  end_sunday_date: string;
}

interface ScheduleVisualizationProps {
  assignments: Assignment[];
  block: Block;
}

const ScheduleVisualization = ({ assignments, block }: ScheduleVisualizationProps) => {
  // Process assignments into week-based structure
  const weeklySchedule = () => {
    const weeks: any[] = [];
    const weekMap = new Map();
    
    // Group assignments by week
    assignments.forEach(assignment => {
      const weekIndex = assignment.week_index;
      if (!weekMap.has(weekIndex)) {
        weekMap.set(weekIndex, {
          week: weekIndex,
          dates: "",
          assignments: {},
          dayDates: {}
        });
      }
      
      const week = weekMap.get(weekIndex);
      const dayKey = assignment.weekday_name.toLowerCase(); // Convert 'Mon' to 'mon', etc.
      week.assignments[dayKey] = assignment.doctors.name;
      week.dayDates[dayKey] = assignment.date;
    });
    
    // Calculate date ranges for each week using actual assignment dates
    weekMap.forEach((week, weekIndex) => {
      // Find Monday and Sunday dates for this week from actual assignments
      const mondayDate = week.dayDates['mon'] ? parseLocalDate(week.dayDates['mon']) : null;
      const sundayDate = week.dayDates['sun'] ? parseLocalDate(week.dayDates['sun']) : null;
      
      if (mondayDate && sundayDate) {
        week.dates = `${format(mondayDate, 'MMM d')}-${format(sundayDate, 'd')}`;
      } else if (mondayDate) {
        // Calculate Sunday from Monday
        const calculatedSunday = addDays(mondayDate, 6);
        week.dates = `${format(mondayDate, 'MMM d')}-${format(calculatedSunday, 'd')}`;
      }
      weeks.push(week);
    });
    
    // Sort by week number
    return weeks.sort((a, b) => a.week - b.week);
  };

  const schedule = weeklySchedule();

  // Generate doctor summary
  const doctorSummary = () => {
    const summary = new Map();
    
    assignments.forEach(assignment => {
      const doctorName = assignment.doctors.name;
      if (!summary.has(doctorName)) {
        summary.set(doctorName, {
          name: doctorName,
          weekend: "",
          weekdays: [],
          weekendWeekIndex: 0
        });
      }
      
      const doctor = summary.get(doctorName);
      if (assignment.is_weekend && assignment.weekday_name === 'Fri') {
        // Weekend assignment (Friday of weekend block)
        const weekStartDate = addDays(parseLocalDate(block.start_monday_date), (assignment.week_index - 1) * 7);
        const weekEndDate = addDays(weekStartDate, 6);
        doctor.weekend = `Week ${assignment.week_index} (${format(addDays(weekStartDate, 4), 'MMM d')}-${format(weekEndDate, 'd')})`;
        doctor.weekendWeekIndex = assignment.week_index;
      } else if (!assignment.is_weekend) {
        // Weekday assignment - show day and date like "Mon 11/3"
        const assignmentDate = parseLocalDate(assignment.date);
        doctor.weekdays.push(`${assignment.weekday_name} ${format(assignmentDate, 'M/d')}`);
      }
    });
    
    return Array.from(summary.values()).sort((a, b) => a.weekendWeekIndex - b.weekendWeekIndex);
  };

  const doctorSummaryData = doctorSummary();

  const isWeekend = (day: string) => {
    return ['friday', 'saturday', 'sunday'].includes(day);
  };

  const getDoctorLastName = (fullName: string) => {
    const name = fullName.replace('Dr. ', '');
    const nameParts = name.split(' ');
    return nameParts[nameParts.length - 1]; // Return the last part (last name)
  };

  const getDoctorColor = (doctorName: string) => {
    // Generate a consistent color based on doctor name hash
    const colorPalettes = [
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-green-100 text-green-800 border-green-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-orange-100 text-orange-800 border-orange-200",
      "bg-red-100 text-red-800 border-red-200",
      "bg-yellow-100 text-yellow-800 border-yellow-200",
      "bg-pink-100 text-pink-800 border-pink-200",
      "bg-teal-100 text-teal-800 border-teal-200",
      "bg-indigo-100 text-indigo-800 border-indigo-200",
    ];
    // Simple hash from name to get consistent color index
    let hash = 0;
    const name = doctorName.replace('Dr. ', '');
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colorPalettes.length;
    return colorPalettes[index];
  };

  return (
    <div className="space-y-6">
      {/* Schedule Grid */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>{schedule.length}-Week Call Schedule</CardTitle>
          <CardDescription>Generated schedule showing daily assignments (Weekend blocks highlighted)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Week</TableHead>
                  <TableHead>Monday</TableHead>
                  <TableHead>Tuesday</TableHead>
                  <TableHead>Wednesday</TableHead>
                  <TableHead>Thursday</TableHead>
                  <TableHead className="bg-accent/20">Friday</TableHead>
                  <TableHead className="bg-accent/20">Saturday</TableHead>
                  <TableHead className="bg-accent/20">Sunday</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedule.map((week) => (
                  <TableRow key={week.week}>
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-semibold">Week {week.week}</div>
                        <div className="text-xs text-muted-foreground">{week.dates}</div>
                      </div>
                    </TableCell>
                     {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                       const doctor = week.assignments[day];
                       const dayDate = week.dayDates[day];
                       const formattedDate = dayDate ? format(parseLocalDate(dayDate), 'M/d') : '';
                       
                       return (
                         <TableCell key={day} className={['fri', 'sat', 'sun'].includes(day) ? 'bg-accent/10' : ''}>
                           {doctor ? (
                             <div className="text-center space-y-1">
                               <div className="text-xs text-muted-foreground font-medium">
                                 {formattedDate}
                               </div>
                               <Badge 
                                 variant="outline" 
                                 className={`${getDoctorColor(doctor as string)} font-medium ${
                                   ['fri', 'sat', 'sun'].includes(day) ? 'ring-2 ring-accent/30' : ''
                                 }`}
                               >
                                 {getDoctorLastName(doctor as string)}
                               </Badge>
                             </div>
                           ) : (
                             <div className="text-center space-y-1">
                               <div className="text-xs text-muted-foreground font-medium">
                                 {formattedDate}
                               </div>
                               <div className="text-xs text-muted-foreground">No assignment</div>
                             </div>
                           )}
                         </TableCell>
                       );
                     })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Doctor Summary */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Doctor Assignment Summary</CardTitle>
          <CardDescription>Each doctor gets exactly 1 weekend and 4 weekdays</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-4">
            {doctorSummaryData.map((doctor: any) => (
              <div key={doctor.name} className="p-4 rounded-lg border border-border bg-gradient-card">
                <h4 className="font-semibold mb-3">{doctor.name}</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Weekend Assignment:</span>
                    <Badge className="ml-2 bg-accent text-accent-foreground">
                      {doctor.weekend}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Weekday Assignments:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {doctor.weekdays.map((weekday, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {weekday}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ScheduleVisualization;