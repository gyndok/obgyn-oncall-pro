interface Doctor {
  id: string;
  name: string;
}

interface DoctorRequest {
  doctor_id: string;
  unavailable_dates: string[];
  preferred_weekends: number[];
  notes?: string;
}

interface Assignment {
  block_id: string;
  week_index: number;
  date: string;
  is_weekend: boolean;
  weekday_name: string;
  doctor_id: string;
}

interface ScheduleResult {
  success: boolean;
  assignments?: Assignment[];
  error?: string;
  summary?: {
    total_assignments: number;
    weekend_assignments: number;
    weekday_assignments: number;
    violations: string[];
  };
}

export class DeterministicScheduler {
  private doctors: Doctor[];
  private requests: Map<string, DoctorRequest>;
  private blockStartDate: Date;
  private dates: Date[];
  private assignments: Map<string, string>; // date -> doctor_id
  private doctorWeekends: Map<string, number>; // doctor_id -> week_index
  private doctorWeekdays: Map<string, string[]>; // doctor_id -> dates[]

  constructor(doctors: Doctor[], requests: DoctorRequest[], blockStartDate: string) {
    this.doctors = doctors;
    this.requests = new Map(requests.map(r => [r.doctor_id, r]));
    this.blockStartDate = new Date(blockStartDate);
    this.dates = this.generateDates();
    this.assignments = new Map();
    this.doctorWeekends = new Map();
    this.doctorWeekdays = new Map();
    
    // Initialize doctor weekdays
    this.doctors.forEach(d => this.doctorWeekdays.set(d.id, []));
  }

  private generateDates(): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < 49; i++) {
      const date = new Date(this.blockStartDate);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private getWeekday(date: Date): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
  }

  private getWeekIndex(date: Date): number {
    const diffTime = date.getTime() - this.blockStartDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 5 || day === 6 || day === 0; // Fri, Sat, Sun
  }

  private isWeekday(date: Date): boolean {
    const day = date.getDay();
    return day >= 1 && day <= 4; // Mon, Tue, Wed, Thu
  }

  private isDoctorAvailable(doctorId: string, date: Date): boolean {
    const request = this.requests.get(doctorId);
    if (!request) return true;
    
    const dateStr = this.formatDate(date);
    return !request.unavailable_dates.includes(dateStr);
  }

  private canDoctorWorkTuesday(doctorId: string): boolean {
    const doctor = this.doctors.find(d => d.id === doctorId);
    // LeBlanc never works Tuesday
    return !doctor?.name.toLowerCase().includes('leblanc');
  }

  private getWeekendDates(weekIndex: number): Date[] {
    const weekendDates: Date[] = [];
    for (const date of this.dates) {
      if (this.getWeekIndex(date) === weekIndex && this.isWeekend(date)) {
        weekendDates.push(date);
      }
    }
    return weekendDates.sort((a, b) => a.getTime() - b.getTime());
  }

  private getAdjacentDates(weekIndex: number): { thursday: Date | null; monday: Date | null } {
    let thursday: Date | null = null;
    let monday: Date | null = null;

    for (const date of this.dates) {
      const dateWeekIndex = this.getWeekIndex(date);
      const weekday = date.getDay();
      
      // Thursday before weekend (same week)
      if (dateWeekIndex === weekIndex && weekday === 4) {
        thursday = date;
      }
      
      // Monday after weekend (next week)
      if (dateWeekIndex === weekIndex + 1 && weekday === 1) {
        monday = date;
      }
    }

    return { thursday, monday };
  }

  public generateSchedule(): ScheduleResult {
    try {
      // Step 1: Assign weekends with preferences
      if (!this.assignWeekends()) {
        return { success: false, error: "Could not assign weekends while respecting constraints" };
      }

      // Step 2: Assign weekdays
      if (!this.assignWeekdays()) {
        return { success: false, error: "Could not assign weekdays while respecting constraints" };
      }

      // Convert to assignment objects
      const assignments: Assignment[] = [];
      for (const date of this.dates) {
        const dateStr = this.formatDate(date);
        const doctorId = this.assignments.get(dateStr);
        
        if (!doctorId) {
          return { success: false, error: `No doctor assigned for ${dateStr}` };
        }

        assignments.push({
          block_id: '', // Will be set by caller
          week_index: this.getWeekIndex(date),
          date: dateStr,
          is_weekend: this.isWeekend(date),
          weekday_name: this.getWeekday(date),
          doctor_id: doctorId
        });
      }

      const summary = {
        total_assignments: assignments.length,
        weekend_assignments: assignments.filter(a => a.is_weekend).length,
        weekday_assignments: assignments.filter(a => !a.is_weekend).length,
        violations: this.validateSchedule(assignments)
      };

      return {
        success: true,
        assignments,
        summary
      };

    } catch (error) {
      return { 
        success: false, 
        error: `Scheduling error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private assignWeekends(): boolean {
    const availableWeeks = Array.from({length: 7}, (_, i) => i + 1);
    const doctorIds = [...this.doctors.map(d => d.id)];

    // Sort doctors by preference specificity (most specific first)
    doctorIds.sort((a, b) => {
      const reqA = this.requests.get(a);
      const reqB = this.requests.get(b);
      const prefA = reqA?.preferred_weekends?.length || 0;
      const prefB = reqB?.preferred_weekends?.length || 0;
      return prefB - prefA; // More preferences first
    });

    return this.assignWeekendsRecursive(doctorIds, availableWeeks, 0);
  }

  private assignWeekendsRecursive(doctorIds: string[], availableWeeks: number[], index: number): boolean {
    if (index === doctorIds.length) return true;

    const doctorId = doctorIds[index];
    const request = this.requests.get(doctorId);
    
    // Try preferred weeks first, then all available weeks
    const weekPreferences = request?.preferred_weekends || [];
    const weeksToTry = [...weekPreferences, ...availableWeeks.filter(w => !weekPreferences.includes(w))];

    for (const weekIndex of weeksToTry) {
      if (!availableWeeks.includes(weekIndex)) continue;

      const weekendDates = this.getWeekendDates(weekIndex);
      if (weekendDates.length !== 3) continue;

      // Check if doctor is available for all weekend dates
      const canWork = weekendDates.every(date => this.isDoctorAvailable(doctorId, date));
      if (!canWork) continue;

      // Check adjacent dates constraint
      const { thursday, monday } = this.getAdjacentDates(weekIndex);
      
      // Assign weekend
      this.doctorWeekends.set(doctorId, weekIndex);
      weekendDates.forEach(date => {
        this.assignments.set(this.formatDate(date), doctorId);
      });

      // Block adjacent dates for this doctor
      if (thursday) this.assignments.set(this.formatDate(thursday), 'BLOCKED_' + doctorId);
      if (monday) this.assignments.set(this.formatDate(monday), 'BLOCKED_' + doctorId);

      // Remove week from available
      const newAvailableWeeks = availableWeeks.filter(w => w !== weekIndex);

      // Recurse
      if (this.assignWeekendsRecursive(doctorIds, newAvailableWeeks, index + 1)) {
        return true;
      }

      // Backtrack
      this.doctorWeekends.delete(doctorId);
      weekendDates.forEach(date => {
        this.assignments.delete(this.formatDate(date));
      });
      if (thursday) this.assignments.delete(this.formatDate(thursday));
      if (monday) this.assignments.delete(this.formatDate(monday));
    }

    return false;
  }

  private assignWeekdays(): boolean {
    const weekdayDates = this.dates.filter(date => this.isWeekday(date));
    
    // Group weekdays by week and day
    const weekdaysByWeekAndDay: Map<string, Date[]> = new Map();
    
    for (const date of weekdayDates) {
      if (this.assignments.has(this.formatDate(date))) continue; // Already blocked or assigned
      
      const weekIndex = this.getWeekIndex(date);
      const dayOfWeek = date.getDay(); // 1=Mon, 2=Tue, 3=Wed, 4=Thu
      const key = `${weekIndex}-${dayOfWeek}`;
      
      if (!weekdaysByWeekAndDay.has(key)) {
        weekdaysByWeekAndDay.set(key, []);
      }
      weekdaysByWeekAndDay.get(key)!.push(date);
    }

    return this.assignWeekdaysRecursive([...weekdaysByWeekAndDay.entries()], 0);
  }

  private assignWeekdaysRecursive(slots: [string, Date[]][], slotIndex: number): boolean {
    if (slotIndex === slots.length) {
      // Check if all doctors have exactly 4 weekdays
      return this.doctors.every(doctor => 
        (this.doctorWeekdays.get(doctor.id)?.length || 0) === 4
      );
    }

    const [slotKey, dates] = slots[slotIndex];
    const [weekIndexStr, dayOfWeekStr] = slotKey.split('-');
    const weekIndex = parseInt(weekIndexStr);
    const dayOfWeek = parseInt(dayOfWeekStr);

    if (dates.length === 0) {
      return this.assignWeekdaysRecursive(slots, slotIndex + 1);
    }

    const date = dates[0]; // Should only be one date per slot
    const dateStr = this.formatDate(date);

    // Skip if already assigned/blocked
    if (this.assignments.has(dateStr)) {
      return this.assignWeekdaysRecursive(slots, slotIndex + 1);
    }

    // Find eligible doctors
    const eligibleDoctors = this.doctors.filter(doctor => {
      const doctorWeekdays = this.doctorWeekdays.get(doctor.id) || [];
      
      // Must need more weekdays
      if (doctorWeekdays.length >= 4) return false;
      
      // Must be available
      if (!this.isDoctorAvailable(doctor.id, date)) return false;
      
      // Tuesday constraint for LeBlanc
      if (dayOfWeek === 2 && !this.canDoctorWorkTuesday(doctor.id)) return false;
      
      // Max one weekday per week constraint
      const hasWeekdayThisWeek = doctorWeekdays.some(d => this.getWeekIndex(new Date(d)) === weekIndex);
      if (hasWeekdayThisWeek) return false;
      
      return true;
    });

    // Sort doctors by priority (those who need more weekdays first)
    eligibleDoctors.sort((a, b) => {
      const weekdaysA = this.doctorWeekdays.get(a.id)?.length || 0;
      const weekdaysB = this.doctorWeekdays.get(b.id)?.length || 0;
      return weekdaysA - weekdaysB;
    });

    for (const doctor of eligibleDoctors) {
      // Assign weekday
      this.assignments.set(dateStr, doctor.id);
      const doctorWeekdays = this.doctorWeekdays.get(doctor.id) || [];
      this.doctorWeekdays.set(doctor.id, [...doctorWeekdays, dateStr]);

      // Recurse
      if (this.assignWeekdaysRecursive(slots, slotIndex + 1)) {
        return true;
      }

      // Backtrack
      this.assignments.delete(dateStr);
      this.doctorWeekdays.set(doctor.id, doctorWeekdays);
    }

    return false;
  }

  private validateSchedule(assignments: Assignment[]): string[] {
    const violations: string[] = [];
    
    // Check each doctor has exactly 1 weekend and 4 weekdays
    for (const doctor of this.doctors) {
      const doctorAssignments = assignments.filter(a => a.doctor_id === doctor.id);
      const weekends = doctorAssignments.filter(a => a.is_weekend);
      const weekdays = doctorAssignments.filter(a => !a.is_weekend);
      
      if (weekends.length !== 3) {
        violations.push(`${doctor.name}: ${weekends.length} weekend days (should be 3)`);
      }
      
      if (weekdays.length !== 4) {
        violations.push(`${doctor.name}: ${weekdays.length} weekdays (should be 4)`);
      }
    }

    return violations;
  }
}