import { useState } from "react";
import { Calendar as CalendarIcon, Save, Send, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

const DoctorPortal = () => {
  const [selectedUnavailableDates, setSelectedUnavailableDates] = useState<string[]>([]);
  const [preferredWeekends, setPreferredWeekends] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<'not-started' | 'in-progress' | 'submitted'>('not-started');

  // Mock data for 7-week block (would come from backend)
  const blockInfo = {
    startDate: "2024-02-05", // Monday
    endDate: "2024-03-24", // Sunday
    deadline: "2024-01-29 11:59 PM"
  };

  const weekends = [
    { id: 1, dates: "Feb 9-11", label: "Week 1: Friday-Sunday" },
    { id: 2, dates: "Feb 16-18", label: "Week 2: Friday-Sunday" },
    { id: 3, dates: "Feb 23-25", label: "Week 3: Friday-Sunday" },
    { id: 4, dates: "Mar 1-3", label: "Week 4: Friday-Sunday" },
    { id: 5, dates: "Mar 8-10", label: "Week 5: Friday-Sunday" },
    { id: 6, dates: "Mar 15-17", label: "Week 6: Friday-Sunday" },
    { id: 7, dates: "Mar 22-24", label: "Week 7: Friday-Sunday" }
  ];

  const handleSaveDraft = () => {
    setStatus('in-progress');
    toast({
      title: "Draft Saved",
      description: "Your preferences have been saved. You can submit when ready.",
    });
  };

  const handleSubmit = () => {
    setStatus('submitted');
    toast({
      title: "Preferences Submitted",
      description: "Your call preferences have been submitted successfully.",
    });
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'not-started':
        return <Badge variant="outline" className="border-muted-foreground"><Clock className="h-3 w-3 mr-1" />Not Started</Badge>;
      case 'in-progress':
        return <Badge variant="outline" className="border-warning text-warning"><AlertCircle className="h-3 w-3 mr-1" />In Progress</Badge>;
      case 'submitted':
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="h-3 w-3 mr-1" />Submitted</Badge>;
    }
  };

  return (
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
                <p className="text-lg font-semibold">{blockInfo.startDate}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">End Date</Label>
                <p className="text-lg font-semibold">{blockInfo.endDate}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Submission Deadline</Label>
                <p className="text-lg font-semibold text-destructive">{blockInfo.deadline}</p>
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
              <div className="p-4 border border-border rounded-lg bg-muted/20">
                <p className="text-sm text-muted-foreground text-center">
                  Interactive calendar would be here
                  <br />
                  (Requires Supabase backend integration)
                </p>
              </div>
              {selectedUnavailableDates.length > 0 && (
                <div className="mt-4">
                  <Label className="text-sm font-medium">Selected Dates:</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedUnavailableDates.map((date) => (
                      <Badge key={date} variant="secondary">{date}</Badge>
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
            />
          </CardContent>
        </Card>

        {/* Submission Alert */}
        {status === 'not-started' && (
          <Alert className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Backend Integration Required:</strong> To enable form submission, time-off requests, and schedule management, 
              you'll need to connect this project to Supabase using Lovable's native integration.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <Button 
            variant="outline" 
            size="lg" 
            onClick={handleSaveDraft}
            disabled={status === 'submitted'}
            className="flex-1 md:flex-none"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
          <Button 
            size="lg" 
            onClick={handleSubmit}
            disabled={status === 'submitted'}
            className="flex-1 md:flex-none bg-gradient-primary hover:opacity-90"
          >
            <Send className="h-4 w-4 mr-2" />
            Submit Preferences
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DoctorPortal;