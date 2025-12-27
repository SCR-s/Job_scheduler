/**
 * Extended CRON parser that includes seconds
 * Format: second minute hour day month dayOfWeek
 * Example: "31 10-15 1 * * MON-FRI"
 */
class CronParser {
  constructor() {
    this.daysOfWeek = {
      'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5, 'SAT': 6
    };
  }

  parse(cronExpression) {
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 6) {
      throw new Error('Invalid CRON expression. Expected format: second minute hour day month dayOfWeek');
    }

    return {
      second: this.parseField(parts[0], 0, 59),
      minute: this.parseField(parts[1], 0, 59),
      hour: this.parseField(parts[2], 0, 23),
      day: this.parseField(parts[3], 1, 31),
      month: this.parseField(parts[4], 1, 12),
      dayOfWeek: this.parseDayOfWeek(parts[5])
    };
  }

  parseField(field, min, max) {
    if (field === '*') {
      return { type: 'all', values: null };
    }

    if (field.includes(',')) {
      const values = field.split(',').map(v => parseInt(v.trim()));
      values.forEach(v => {
        if (isNaN(v) || v < min || v > max) {
          throw new Error(`Invalid value in field: ${field}`);
        }
      });
      return { type: 'list', values };
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(v => parseInt(v.trim()));
      if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
        throw new Error(`Invalid range in field: ${field}`);
      }
      const values = [];
      for (let i = start; i <= end; i++) {
        values.push(i);
      }
      return { type: 'range', values };
    }

    if (field.includes('/')) {
      const [base, step] = field.split('/').map(v => v === '*' ? null : parseInt(v.trim()));
      if (step && (isNaN(step) || step < 1)) {
        throw new Error(`Invalid step in field: ${field}`);
      }
      const start = base === null ? min : (isNaN(base) ? min : base);
      const values = [];
      for (let i = start; i <= max; i += (step || 1)) {
        values.push(i);
      }
      return { type: 'step', values };
    }

    const value = parseInt(field);
    if (isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid value in field: ${field}`);
    }
    return { type: 'single', values: [value] };
  }

  parseDayOfWeek(field) {
    if (field === '*') {
      return { type: 'all', values: null };
    }

    // Handle day name ranges like MON-FRI
    if (field.includes('-')) {
      const [startDay, endDay] = field.split('-').map(d => d.trim().toUpperCase());
      if (this.daysOfWeek[startDay] === undefined || this.daysOfWeek[endDay] === undefined) {
        throw new Error(`Invalid day of week range: ${field}`);
      }
      const values = [];
      let current = this.daysOfWeek[startDay];
      const end = this.daysOfWeek[endDay];
      while (true) {
        values.push(current);
        if (current === end) break;
        current = (current + 1) % 7;
      }
      return { type: 'range', values };
    }

    // Handle comma-separated days
    if (field.includes(',')) {
      const values = field.split(',').map(d => {
        const day = d.trim().toUpperCase();
        if (this.daysOfWeek[day] !== undefined) {
          return this.daysOfWeek[day];
        }
        const num = parseInt(day);
        if (!isNaN(num) && num >= 0 && num <= 6) {
          return num;
        }
        throw new Error(`Invalid day of week: ${day}`);
      });
      return { type: 'list', values };
    }

    // Single day
    const day = field.toUpperCase();
    if (this.daysOfWeek[day] !== undefined) {
      return { type: 'single', values: [this.daysOfWeek[day]] };
    }
    const num = parseInt(day);
    if (!isNaN(num) && num >= 0 && num <= 6) {
      return { type: 'single', values: [num] };
    }
    throw new Error(`Invalid day of week: ${day}`);
  }

  /**
   * Check if a given date matches the cron expression
   */
  matches(date, parsed) {
    const second = date.getSeconds();
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1; // JavaScript months are 0-indexed
    const dayOfWeek = date.getDay();

    return (
      this.fieldMatches(second, parsed.second) &&
      this.fieldMatches(minute, parsed.minute) &&
      this.fieldMatches(hour, parsed.hour) &&
      this.fieldMatches(day, parsed.day) &&
      this.fieldMatches(month, parsed.month) &&
      this.fieldMatches(dayOfWeek, parsed.dayOfWeek)
    );
  }

  fieldMatches(value, field) {
    if (field.type === 'all') return true;
    if (field.type === 'single' || field.type === 'list' || field.type === 'range' || field.type === 'step') {
      return field.values.includes(value);
    }
    return false;
  }

  /**
   * Get the next execution time from a given date
   */
  getNextExecution(fromDate, parsed) {
    let current = new Date(fromDate);
    current.setMilliseconds(0);
    
    // Try up to 1 year ahead
    const maxIterations = 365 * 24 * 60 * 60;
    let iterations = 0;

    while (iterations < maxIterations) {
      current.setSeconds(current.getSeconds() + 1);
      iterations++;

      if (this.matches(current, parsed)) {
        return current;
      }
    }

    throw new Error('Could not find next execution time');
  }
}

module.exports = new CronParser();

