/**
 * Calculate the number of working hours between two dates (excluding weekends)
 */
export function calculateWorkingHours(start: Date, end: Date): number {
  if (end < start) return 0;
  
  let currentDate = new Date(start);
  let hours = 0;
  
  while (currentDate < end) {
    const dayOfWeek = currentDate.getDay();
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const nextDay = new Date(currentDate);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      
      const endOfPeriod = nextDay < end ? nextDay : end;
      const periodHours = (endOfPeriod.getTime() - currentDate.getTime()) / (1000 * 60 * 60);
      hours += periodHours;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }
  
  return hours;
}

/**
 * Check if response time is within one working day (24 hours excluding weekends)
 */
export function isWithinOneWorkingDay(start: Date, end: Date): boolean {
  const workingHours = calculateWorkingHours(start, end);
  return workingHours <= 24;
}

/**
 * Get the start of the week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const weekStart = new Date(d.setDate(diff));
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Parse command line arguments
 */
export function parseArgs(): {
  startDate: Date;
  endDate: Date;
  configPath: string;
} {
  const args = process.argv.slice(2);
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  // Default to 4 full weeks + current week
  // Start from 4 weeks before the beginning of the current week
  const currentWeekStart = getWeekStart(new Date());
  const startDate = new Date(currentWeekStart);
  startDate.setDate(startDate.getDate() - (7 * 4)); // Go back 4 weeks
  startDate.setHours(0, 0, 0, 0);
  
  let configPath = './config.json';
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-date' && args[i + 1]) {
      const parsed = new Date(args[i + 1]);
      if (!isNaN(parsed.getTime())) {
        startDate.setTime(parsed.getTime());
        startDate.setHours(0, 0, 0, 0);
      }
      i++;
    } else if (args[i] === '--end-date' && args[i + 1]) {
      const parsed = new Date(args[i + 1]);
      if (!isNaN(parsed.getTime())) {
        endDate.setTime(parsed.getTime());
        endDate.setHours(23, 59, 59, 999);
      }
      i++;
    } else if (args[i] === '--config' && args[i + 1]) {
      configPath = args[i + 1];
      i++;
    }
  }
  
  return { startDate, endDate, configPath };
}

/**
 * Calculate statistics for response times
 */
export function calculateStats(responseTimes: number[]): {
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
} {
  if (responseTimes.length === 0) {
    return { min: null, max: null, mean: null, median: null };
  }
  
  const sorted = [...responseTimes].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const mean = sum / sorted.length;
  
  let median: number;
  if (sorted.length % 2 === 0) {
    median = (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  } else {
    median = sorted[Math.floor(sorted.length / 2)];
  }
  
  return { min, max, mean, median };
}

