export type TagId =
  | 'personal' | 'family' | 'health' | 'education'
  | 'finance' | 'property' | 'vehicle' | 'travel'
  | 'milestone' | 'work' | 'hobby' | 'project'
  | 'achievement' | 'social' | 'document' | 'purchase' | 'noted' | 'other';

export interface LifeEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  eventDate: string;           // ISO date string YYYY-MM-DD
  endDate?: string;            // ISO date string YYYY-MM-DD (range events only)
  isEndDateUnknown?: boolean;  // true = ongoing / unknown end
  isDateUnknown?: boolean;
  eventTime?: string;          // HH:MM optional
  isTimeUnknown?: boolean;
  place?: string;
  people?: string[];
  tags: TagId[];
  mediaUrls: string[];         // Cloud file IDs
  mediaNames: string[];        // Names of files on cloud
  localMediaUris: string[];    // Device cache URIs
  localMediaNames?: string[];  // Names for local media
  documentUrls: string[];      // Cloud file IDs
  documentNames: string[];
  localDocumentUris?: string[]; // Device cache URIs for documents
  localDocumentNames?: string[]; // Names for local documents
  customFields: Record<string, any>; // Phase 2
  groupId?: string;            // Link multiple occurrences
  groupTitle?: string;         // Optional title for the group
  occurrenceIndex?: number;    // Index in the series
  hasReminder?: boolean;
  reminderDaysBefore?: number;
  reminderTime?: string;
  notificationId?: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
}
