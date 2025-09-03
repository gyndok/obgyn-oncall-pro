import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";

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
      const dayKey = assignment.weekday_name.toLowerCase();
      week.assignments[dayKey] = assignment.doctors.name;
      week.dayDates[dayKey] = assignment.date;
    });
    
    // Calculate date ranges for each week
    const blockStartDate = new Date(block.start_monday_date);
    weekMap.forEach((week, weekIndex) => {
      const weekStartDate = addDays(blockStartDate, (weekIndex - 1) * 7);
      const weekEndDate = addDays(weekStartDate, 6);
      week.dates = `${format(weekStartDate, 'MMM d')}-${format(weekEndDate, 'd')}`;
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
          weekdays: []
        });
      }
      
      const doctor = summary.get(doctorName);
      if (assignment.is_weekend && assignment.weekday_name === 'Fri') {
        // Weekend assignment (Friday of weekend block)
        const weekStartDate = addDays(new Date(block.start_monday_date), (assignment.week_index - 1) * 7);
        const weekEndDate = addDays(weekStartDate, 6);
        doctor.weekend = `Week ${assignment.week_index} (${format(addDays(weekStartDate, 4), 'MMM d')}-${format(weekEndDate, 'd')})`;
      } else if (!assignment.is_weekend) {
        // Weekday assignment - show day and date like "Mon 11/3"
        const assignmentDate = new Date(assignment.date);
        doctor.weekdays.push(`${assignment.weekday_name} ${format(assignmentDate, 'M/d')}`);
      }
    });
    
    return Array.from(summary.values());
  };

  const doctorSummaryData = doctorSummary();

  const isWeekend = (day: string) => {
    return ['friday', 'saturday', 'sunday'].includes(day);
  };

  const getDoctorColor = (doctorName: string) => {
    const name = doctorName.replace('Dr. ', '');
    const colors = {
      "Klein": "bg-blue-100 text-blue-800 border-blue-200",
      "LeBlanc": "bg-green-100 text-green-800 border-green-200", 
      "Johnson": "bg-purple-100 text-purple-800 border-purple-200",
      "Kenney": "bg-orange-100 text-orange-800 border-orange-200",
      "LaBerge": "bg-red-100 text-red-800 border-red-200",
      "Clinger": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Demerson": "bg-pink-100 text-pink-800 border-pink-200"
    };
    return colors[name as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="space-y-6">
      {/* Schedule Grid */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>7-Week Call Schedule</CardTitle>
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
                     {Object.entries(week.assignments).map(([day, doctor]) => {
                       const dayDate = week.dayDates[day];
                       const formattedDate = dayDate ? format(new Date(dayDate), 'M/d') : '';
                       
                       return (
                         <TableCell key={day} className={isWeekend(day) ? 'bg-accent/10' : ''}>
                           <div className="text-center space-y-1">
                             <div className="text-xs text-muted-foreground font-medium">
                               {formattedDate}
                             </div>
                             <Badge 
                               variant="outline" 
                               className={`${getDoctorColor(doctor as string)} font-medium ${
                                 isWeekend(day) ? 'ring-2 ring-accent/30' : ''
                               }`}
                             >
                               {(doctor as string).replace('Dr. ', '')}
                             </Badge>
                           </div>
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