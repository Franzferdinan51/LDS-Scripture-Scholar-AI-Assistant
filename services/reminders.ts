import type { Reminder } from '../types';
import { getAllReminders, saveReminder } from './storage';

export const PRESET_REMINDERS: Omit<Reminder, 'id' | 'enabled' | 'lastTriggered' | 'createdAt'>[] = [
  {
    type: 'daily-reading',
    title: 'Daily Scripture Study',
    message: 'Time for your daily scripture study! 📖',
    schedule: { time: '08:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
  },
  {
    type: 'study-plan',
    title: 'Study Plan Review',
    message: 'Check your study plan progress for this week.',
    schedule: { time: '09:00', days: ['Sun'] },
  },
  {
    type: 'custom',
    title: 'Come Back and Study',
    message: "It's been a while since your last study session. Come back and continue your learning journey!",
    schedule: { time: '10:00', days: ['Sat'] },
  },
];

export async function checkDueReminders(): Promise<Reminder[]> {
  const reminders = await getAllReminders();
  const now = new Date();
  const currentDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const dueReminders: Reminder[] = [];

  for (const reminder of reminders) {
    if (!reminder.enabled) continue;
    if (!reminder.schedule.days.includes(currentDay)) continue;

    // Check if reminder time is within the current minute
    if (reminder.schedule.time === currentTime) {
      // Don't retrigger within the same hour
      const lastTriggered = reminder.lastTriggered || 0;
      const hoursSinceLastTrigger = (Date.now() - lastTriggered) / (1000 * 60 * 60);
      if (hoursSinceLastTrigger >= 1) {
        dueReminders.push(reminder);
        reminder.lastTriggered = Date.now();
        await saveReminder(reminder);
      }
    }
  }

  return dueReminders;
}

export function formatReminderTime(schedule: { time: string; days: string[] }): string {
  const dayStr = schedule.days.length === 7 ? 'Every day' :
    schedule.days.length === 5 && !schedule.days.includes('Sat') && !schedule.days.includes('Sun') ? 'Weekdays' :
    schedule.days.join(', ');

  const [hours, minutes] = schedule.time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;

  return `${dayStr} at ${displayH}:${minutes} ${ampm}`;
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderCheck(): void {
  if (reminderInterval) return;
  reminderInterval = setInterval(async () => {
    const due = await checkDueReminders();
    for (const reminder of due) {
      showReminderNotification(reminder);
    }
  }, 60000); // Check every minute
}

export function stopReminderCheck(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

function showReminderNotification(reminder: Reminder): void {
  // Try browser notification first
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(reminder.title, {
      body: reminder.message,
      icon: '/icons/icon-192.png',
      tag: reminder.id,
    });
  }

  // Dispatch custom event for in-app toast
  window.dispatchEvent(new CustomEvent('study-reminder', { detail: reminder }));
}
