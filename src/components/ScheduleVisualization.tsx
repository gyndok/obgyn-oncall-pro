import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ScheduleVisualization = () => {
  // Mock schedule data (would come from backend)
  const schedule = [
    {
      week: 1,
      dates: "Feb 5-11",
      assignments: {
        monday: "Dr. Klein",
        tuesday: "Dr. Johnson", 
        wednesday: "Dr. Kenney",
        thursday: "Dr. LaBerge",
        friday: "Dr. LeBlanc",
        saturday: "Dr. LeBlanc", 
        sunday: "Dr. LeBlanc"
      }
    },
    {
      week: 2,
      dates: "Feb 12-18",
      assignments: {
        monday: "Dr. Clinger",
        tuesday: "Dr. Demerson",
        wednesday: "Dr. Klein", 
        thursday: "Dr. Johnson",
        friday: "Dr. Kenney",
        saturday: "Dr. Kenney",
        sunday: "Dr. Kenney"
      }
    },
    {
      week: 3,
      dates: "Feb 19-25", 
      assignments: {
        monday: "Dr. LaBerge",
        tuesday: "Dr. Klein",
        wednesday: "Dr. Clinger",
        thursday: "Dr. Demerson", 
        friday: "Dr. Johnson",
        saturday: "Dr. Johnson",
        sunday: "Dr. Johnson"
      }
    },
    {
      week: 4,
      dates: "Feb 26-Mar 3",
      assignments: {
        monday: "Dr. Kenney",
        tuesday: "Dr. LaBerge", 
        wednesday: "Dr. LeBlanc",
        thursday: "Dr. Klein",
        friday: "Dr. Clinger",
        saturday: "Dr. Clinger",
        sunday: "Dr. Clinger" 
      }
    },
    {
      week: 5,
      dates: "Mar 4-10",
      assignments: {
        monday: "Dr. Johnson",
        tuesday: "Dr. Clinger",
        wednesday: "Dr. Demerson",
        thursday: "Dr. LeBlanc",
        friday: "Dr. LaBerge", 
        saturday: "Dr. LaBerge",
        sunday: "Dr. LaBerge"
      }
    },
    {
      week: 6,
      dates: "Mar 11-17",
      assignments: {
        monday: "Dr. Demerson", 
        tuesday: "Dr. Kenney",
        wednesday: "Dr. Johnson",
        thursday: "Dr. Clinger",
        friday: "Dr. Demerson",
        saturday: "Dr. Demerson", 
        sunday: "Dr. Demerson"
      }
    },
    {
      week: 7,
      dates: "Mar 18-24",
      assignments: {
        monday: "Dr. LeBlanc",
        tuesday: "Dr. Johnson",
        wednesday: "Dr. LaBerge", 
        thursday: "Dr. Kenney",
        friday: "Dr. Klein",
        saturday: "Dr. Klein",
        sunday: "Dr. Klein"
      }
    }
  ];

  const doctorSummary = [
    { name: "Dr. Klein", weekend: "Week 7 (Mar 22-24)", weekdays: ["Week 1 Mon", "Week 2 Wed", "Week 3 Tue", "Week 4 Thu"] },
    { name: "Dr. LeBlanc", weekend: "Week 1 (Feb 9-11)", weekdays: ["Week 3 Wed", "Week 4 Wed", "Week 5 Thu", "Week 7 Mon"] },
    { name: "Dr. Johnson", weekend: "Week 3 (Feb 23-25)", weekdays: ["Week 1 Tue", "Week 2 Thu", "Week 5 Mon", "Week 7 Tue"] },
    { name: "Dr. Kenney", weekend: "Week 2 (Feb 16-18)", weekdays: ["Week 1 Wed", "Week 4 Mon", "Week 6 Tue", "Week 7 Thu"] },
    { name: "Dr. LaBerge", weekend: "Week 5 (Mar 8-10)", weekdays: ["Week 1 Thu", "Week 3 Mon", "Week 4 Tue", "Week 7 Wed"] },
    { name: "Dr. Clinger", weekend: "Week 4 (Mar 1-3)", weekdays: ["Week 2 Mon", "Week 3 Wed", "Week 5 Tue", "Week 6 Thu"] },
    { name: "Dr. Demerson", weekend: "Week 6 (Mar 15-17)", weekdays: ["Week 2 Tue", "Week 3 Thu", "Week 5 Wed", "Week 6 Mon"] }
  ];

  const isWeekend = (day: string) => {
    return ['friday', 'saturday', 'sunday'].includes(day);
  };

  const getDoctorColor = (doctorName: string) => {
    const colors = {
      "Dr. Klein": "bg-blue-100 text-blue-800 border-blue-200",
      "Dr. LeBlanc": "bg-green-100 text-green-800 border-green-200", 
      "Dr. Johnson": "bg-purple-100 text-purple-800 border-purple-200",
      "Dr. Kenney": "bg-orange-100 text-orange-800 border-orange-200",
      "Dr. LaBerge": "bg-red-100 text-red-800 border-red-200",
      "Dr. Clinger": "bg-yellow-100 text-yellow-800 border-yellow-200",
      "Dr. Demerson": "bg-pink-100 text-pink-800 border-pink-200"
    };
    return colors[doctorName as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200";
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
                    {Object.entries(week.assignments).map(([day, doctor]) => (
                      <TableCell key={day} className={isWeekend(day) ? 'bg-accent/10' : ''}>
                        <Badge 
                          variant="outline" 
                          className={`${getDoctorColor(doctor)} font-medium ${
                            isWeekend(day) ? 'ring-2 ring-accent/30' : ''
                          }`}
                        >
                          {doctor.replace('Dr. ', '')}
                        </Badge>
                      </TableCell>
                    ))}
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
            {doctorSummary.map((doctor) => (
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