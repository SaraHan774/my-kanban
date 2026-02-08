/**
 * Application configuration
 * Stored in .kanban-config.json at the root
 */
export interface AppConfig {
  workspacePath: string;  // Path to workspace folder
  googleCalendar?: GoogleCalendarConfig;
  theme: 'light' | 'dark' | 'auto';
  defaultTags: string[];
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
  theme: 'auto',
  defaultTags: []
};
