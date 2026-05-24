import type { Reminder, ApiProviderSettings } from '../types';
import { getAllReminders, saveReminder } from './storage';
import { generateJsonWithSettings } from './llmService';

export interface SuggestedReminder {
  title: string;
  message: string;
  type: 'daily-reading' | 'study-plan' | 'custom';
  schedule: {
    time: string;
    days: string[];
  };
}

const REMINDER_SUGGESTION_PROMPT = `You are a reminder assistant for an LDS scripture study app. Analyze the conversation context and suggest relevant reminders.

Return a JSON array of suggested reminders. Each reminder should have:
- title: short title (max 50 chars)
- message: helpful message encouraging action (max 200 chars)
- type: "daily-reading", "study-plan", or "custom"
- schedule: with time (HH:MM 24hr format) and days array

Return empty array [] if no reminders are warranted.

Examples of suggestion-worthy context:
- User wants to study something regularly (e.g., "I want to study the Book of Mormon more")
- User has an upcoming event/assignment/talk/lesson (e.g., "I have a talk in 2 weeks", "I'm preparing a lesson for Sunday")
- User expressed commitment to build a habit (e.g., "I need to be more consistent with my scripture study")

Examples of NOT suggestion-worthy:
- General questions about doctrine or scripture
- Casual conversation
- Questions about church history

Current date: ${new Date().toISOString().split('T')[0]}

Respond only with valid JSON array.`;

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

export async function suggestReminders(
  conversationContext: string,
  settings: ApiProviderSettings
): Promise<SuggestedReminder[]> {
  if (!conversationContext.trim()) return [];

  try {
    const suggestions = await generateJsonWithSettings<SuggestedReminder[]>(
      settings,
      conversationContext,
      {
        systemInstruction: REMINDER_SUGGESTION_PROMPT,
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    );

    return Array.isArray(suggestions) ? suggestions : [];
  } catch (err) {
    console.error('Failed to suggest reminders:', err);
    return [];
  }
}

export async function createReminderFromSuggestion(
  suggestion: SuggestedReminder
): Promise<Reminder> {
  const reminder: Reminder = {
    id: `reminder-${Date.now()}`,
    type: suggestion.type,
    title: suggestion.title,
    message: suggestion.message,
    schedule: suggestion.schedule,
    enabled: true,
    createdAt: Date.now(),
  };

  await saveReminder(reminder);
  return reminder;
}

// Agent-facing function: create a reminder directly from conversation context
export async function createReminderFromContext(
  context: string,
  settings: ApiProviderSettings
): Promise<Reminder | null> {
  const CREATEREMINDER_PROMPT = `Extract or create a reminder from this conversation context.

Return a JSON object with:
- title: short title (max 50 chars)
- message: helpful message (max 200 chars)
- type: "daily-reading", "study-plan", or "custom"
- schedule: with time (HH:MM 24hr format) and days array (e.g., ["Mon","Wed","Fri"] for MWF)

If no reminder is warranted, return null.

Current date: ${new Date().toISOString().split('T')[0]}

Respond only with valid JSON object or null.`;

  try {
    const suggestion = await generateJsonWithSettings<SuggestedReminder | null>(
      settings,
      context,
      {
        systemInstruction: CREATEREMINDER_PROMPT,
        temperature: 0.3,
        responseMimeType: 'application/json',
      }
    );

    if (!suggestion) return null;
    return createReminderFromSuggestion(suggestion);
  } catch (err) {
    console.error('Failed to create reminder from context:', err);
    return null;
  }
}
