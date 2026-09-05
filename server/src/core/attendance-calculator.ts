/**
 * Attendance calculation engine for PeoplePay360.
 * Derives worked hours, overtime thresholds, and attendance statuses from check-in/out timestamps.
 */

export interface AttendanceShiftRule {
  standardWorkHours: number; // typically 8 hours
  gracePeriodMinutes: number; // e.g., 15 mins before marking LATE
  overtimeThresholdMinutes: number; // minimum overtime to qualify
}

export const DEFAULT_SHIFT_RULES: AttendanceShiftRule = {
  standardWorkHours: 8.0,
  gracePeriodMinutes: 15,
  overtimeThresholdMinutes: 30,
};

export interface ShiftCalculationResult {
  workedHours: number;
  overtimeHours: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'MISSING_CHECKOUT';
}

/**
 * Calculates net worked hours and overtime from check-in and check-out timestamps.
 */
export function calculateShiftMetrics(
  checkIn: Date,
  checkOut: Date | null,
  expectedStartHour: number = 9,
  rules: AttendanceShiftRule = DEFAULT_SHIFT_RULES
): ShiftCalculationResult {
  if (!checkOut) {
    return {
      workedHours: 0,
      overtimeHours: 0,
      status: 'MISSING_CHECKOUT',
    };
  }

  const durationMs = checkOut.getTime() - checkIn.getTime();
  if (durationMs <= 0) {
    return {
      workedHours: 0,
      overtimeHours: 0,
      status: 'MISSING_CHECKOUT',
    };
  }

  // Convert milliseconds to hours (minus standard 1-hour lunch break if worked > 5 hours)
  let totalHours = durationMs / (1000 * 60 * 60);
  if (totalHours > 5) {
    totalHours = Math.max(0, totalHours - 1);
  }

  // Round to 2 decimal places
  const workedHours = Math.round(totalHours * 100) / 100;

  // Overtime calculation
  let overtimeHours = 0;
  if (workedHours > rules.standardWorkHours) {
    const extraMinutes = (workedHours - rules.standardWorkHours) * 60;
    if (extraMinutes >= rules.overtimeThresholdMinutes) {
      overtimeHours = Math.round((workedHours - rules.standardWorkHours) * 100) / 100;
    }
  }

  // Punctuality check
  const checkInHour = checkIn.getHours();
  const checkInMinutes = checkIn.getMinutes();
  const arrivalMinutes = checkInHour * 60 + checkInMinutes;
  const expectedArrivalMinutes = expectedStartHour * 60;

  let status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'MISSING_CHECKOUT' = 'PRESENT';

  if (arrivalMinutes > expectedArrivalMinutes + rules.gracePeriodMinutes) {
    status = 'LATE';
  }

  if (workedHours < rules.standardWorkHours / 2) {
    status = 'HALF_DAY';
  }

  return {
    workedHours,
    overtimeHours,
    status,
  };
}
