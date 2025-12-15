import { format } from 'date-fns';

interface Assignment {
  date: string;
  doctor_id: string;
  doctors?: {
    name: string;
  };
}

interface Doctor {
  id: string;
  name: string;
}

// Generate ICS content from assignments
export function generateIcsContent(
  assignments: Assignment[],
  doctors: Doctor[],
  blockStartDate: string,
  blockEndDate: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//On-Call Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:On-Call Schedule ${blockStartDate} to ${blockEndDate}`,
  ];

  // Create a map of doctor IDs to names for quick lookup
  const doctorMap = new Map(doctors.map(d => [d.id, d.name]));

  // Sort assignments by date
  const sortedAssignments = [...assignments].sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  for (const assignment of sortedAssignments) {
    // Get doctor name from joined data or lookup from map
    const doctorName = assignment.doctors?.name || doctorMap.get(assignment.doctor_id) || 'Unknown';
    
    // Parse the date (format: YYYY-MM-DD)
    const [year, month, day] = assignment.date.split('-');
    const dateStr = `${year}${month}${day}`;
    
    // For all-day events, end date is the next day
    const endDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day) + 1);
    const endDateStr = format(endDate, 'yyyyMMdd');
    
    // Generate a unique ID for the event
    const uid = `${assignment.date}-${assignment.doctor_id}@oncall.schedule`;
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${format(new Date(), "yyyyMMdd'T'HHmmss'Z'")}`);
    lines.push(`DTSTART;VALUE=DATE:${dateStr}`);
    lines.push(`DTEND;VALUE=DATE:${endDateStr}`);
    lines.push(`SUMMARY:${escapeIcsText(doctorName)}`);
    lines.push('TRANSP:TRANSPARENT'); // Show as free
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

// Escape special characters in ICS text fields
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Download the ICS file
export function downloadIcsFile(
  assignments: Assignment[],
  doctors: Doctor[],
  blockStartDate: string,
  blockEndDate: string
): void {
  const icsContent = generateIcsContent(assignments, doctors, blockStartDate, blockEndDate);
  
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `oncall-schedule-${blockStartDate}-to-${blockEndDate}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
