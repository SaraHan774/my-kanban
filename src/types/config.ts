/**
 * Application configuration
 * Stored in .kanban-config.json at the root
 */
export interface AppConfig {
  workspacePath: string;  // Path to workspace folder
  pomodoroSettings: PomodoroSettings;
  googleCalendar?: GoogleCalendarConfig;
  theme: 'light' | 'dark' | 'auto';
  defaultTags: string[];
}

/**
 * Pomodoro timer settings
 */
export interface PomodoroSettings {
  defaultDuration: number;  // Default work duration in minutes (e.g., 25)
  shortBreak: number;  // Short break duration (e.g., 5)
  longBreak: number;  // Long break duration (e.g., 15)
  autoStartBreaks: boolean;  // Auto-start breaks after work sessions
  autoStartPomodoros: boolean;  // Auto-start next pomodoro after breaks
}

/**
 * Google Calendar sync configuration
 */
export interface GoogleCalendarConfig {
  enabled: boolean;
  calendarId: string;
  syncInterval: number;  // Sync interval in minutes
  oauth2Credentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    accessToken?: string;
    refreshToken?: string;
  };
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: AppConfig = {
  workspacePath: 'workspace',
  pomodoroSettings: {
    defaultDuration: 25,
    shortBreak: 5,
    longBreak: 15,
    autoStartBreaks: false,
    autoStartPomodoros: false
  },
  theme: 'auto',
  defaultTags: []
};
