export type TagId =
  | 'personal' | 'family' | 'health' | 'education'
  | 'finance' | 'property' | 'vehicle' | 'travel'
  | 'milestone' | 'other';

export interface LifeEvent {
  id: string;
  userId: string;
  title: string;
  description: string;
  eventDate: string;           // ISO date string YYYY-MM-DD
  isDateUnknown?: boolean;
  eventTime?: string;          // HH:MM optional
  isTimeUnknown?: boolean;
  place?: string;
  tags: TagId[];
  mediaUrls: string[];         // Firebase Storage URLs (Future)
  localMediaUris: string[];    // Device cache URIs
  documentUrls: string[];      // Firebase Storage URLs (Future)
  documentNames: string[];
  localDocumentUris?: string[]; // Device cache URIs for documents
  customFields: Record<string, any>; // Phase 2
  groupId?: string;            // Link multiple occurrences
  groupTitle?: string;         // Optional title for the group
  occurrenceIndex?: number;    // Index in the series
  createdAt: string;
  updatedAt: string;
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
}
