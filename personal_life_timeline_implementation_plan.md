# Personal Life Timeline — Implementation Plan

> **Stack:** Expo React Native · Firebase (Firestore + Auth + Storage) · Android-first · Multi-user / SaaS-ready

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Folder Structure](#3-folder-structure)
4. [Phase 1 — Core App](#4-phase-1--core-app)
5. [Phase 2 — Dynamic Custom Fields](#5-phase-2--dynamic-custom-fields)
6. [Firebase Setup](#6-firebase-setup)
7. [Data Models](#7-data-models)
8. [Screen-by-Screen Breakdown](#8-screen-by-screen-breakdown)
9. [Local-First Sync Strategy](#9-local-first-sync-strategy)
10. [Key Libraries](#10-key-libraries)
11. [Development Milestones](#11-development-milestones)
12. [Future SaaS Considerations](#12-future-saas-considerations)

---

## 1. Project Overview

**Personal Life Timeline** is a mobile app where users store, view, and search any meaningful life event — from birth to today — displayed as a beautiful chronological timeline. Each event carries rich metadata: date, place, description, category tags, images, and documents.

### Goals by Phase

| Phase | Goal |
|-------|------|
| Phase 1 | Core event CRUD, timeline view, tag-based theming, Firebase sync |
| Phase 2 | Dynamic form builder — user-defined custom fields per event type |
| Future | SaaS multi-tenancy, family sharing, subscriptions |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────┐
│             Expo React Native App            │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Screens │  │Components│  │ Hooks/    │ │
│  │          │  │          │  │ Context   │ │
│  └──────────┘  └──────────┘  └───────────┘ │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │         Local Layer (Zustand)        │   │
│  │ Zustand Persist + AsyncStorage       │   │
│  └──────────────────────────────────────┘   │
│                    ▲  ▼  Sync (Later)       │
│  ┌──────────────────────────────────────┐   │
│  │         Firebase Layer (Future)      │   │
│  │  Firestore (data)  Storage (files)   │   │
│  │  Firebase Auth     Functions (opt.)  │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

- **Local-first:** All reads/writes hit SQLite first. The app works fully offline.
- **Sync layer:** A background sync service pushes dirty records to Firestore and pulls remote changes on app resume / network restore.
- **Firebase Storage:** Images and documents are uploaded with a user-scoped path and a local URI is cached for fast display.

---

## 3. Folder Structure

```
life-timeline/
├── app/                          # Expo Router screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (app)/
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── index.tsx             # Timeline screen
│   │   ├── event/
│   │   │   ├── [id].tsx          # Event detail
│   │   │   └── new.tsx           # Create/Edit event
│   │   ├── search.tsx
│   │   ├── settings.tsx
│   │   └── field-builder.tsx     # Phase 2: Custom field builder
├── components/
│   ├── timeline/
│   │   ├── TimelineList.tsx
│   │   ├── TimelineCard.tsx
│   │   ├── TimelineConnector.tsx
│   │   └── YearDivider.tsx
│   ├── event/
│   │   ├── EventForm.tsx
│   │   ├── TagSelector.tsx
│   │   ├── MediaPicker.tsx
│   │   └── DocumentPicker.tsx
│   ├── fields/                   # Phase 2
│   │   ├── DynamicField.tsx
│   │   ├── FieldBuilder.tsx
│   │   └── field-types/
│   │       ├── TextField.tsx
│   │       ├── TextareaField.tsx
│   │       ├── DateField.tsx
│   │       ├── RadioField.tsx
│   │       └── CheckboxField.tsx
│   └── ui/
│       ├── ThemedCard.tsx
│       ├── TagBadge.tsx
│       └── EmptyState.tsx
├── hooks/
│   ├── useEvents.ts
│   ├── useSync.ts
│   ├── useTheme.ts
│   └── useAuth.ts
├── services/
│   ├── db/
│   │   ├── schema.ts             # SQLite schema definitions
│   │   ├── events.ts             # Local CRUD
│   │   └── customFields.ts       # Phase 2 local storage
│   ├── firebase/
│   │   ├── auth.ts
│   │   ├── firestore.ts
│   │   └── storage.ts
│   └── sync/
│       ├── syncEngine.ts
│       └── conflictResolver.ts
├── store/
│   ├── eventStore.ts             # Zustand
│   ├── authStore.ts
│   └── settingsStore.ts
├── constants/
│   ├── tags.ts                   # Predefined event tags
│   ├── themes.ts                 # Tag-to-theme mapping
│   └── fieldTypes.ts             # Phase 2 field type registry
├── types/
│   └── index.ts
└── utils/
    ├── dateHelpers.ts
    └── mediaHelpers.ts
```

---

## 4. Phase 1 — Core App

### 4.1 Authentication

- Firebase Auth with Email/Password (primary)
- Google Sign-In via `@react-native-google-signin/google-signin`
- Auth state persisted via AsyncStorage
- Protected routes using Expo Router layout guards

### 4.2 Event Tags (Predefined)

Each tag has a name, icon, and associated theme color:

| Tag | Icon | Color |
|-----|------|-------|
| Personal | 👤 | Indigo |
| Family | 👨‍👩‍👧 | Amber |
| Health | 🏥 | Red |
| Education | 🎓 | Blue |
| Finance | 💰 | Green |
| Property | 🏠 | Brown |
| Vehicle | 🚗 | Gray |
| Travel | ✈️ | Cyan |
| Milestone | ⭐ | Purple |
| Other | 📌 | Slate |

### 4.3 Event Fields (Standard)

Every event stores:

```
- id (uuid)
- userId
- title
- description
- eventDate (date)
- eventTime (optional time)
- place (text)
- tags (array of tag ids)
- mediaUrls (array — Firebase Storage)
- localMediaUris (array — device cache)
- documentUrls (array — Firebase Storage)
- customFields (JSON — Phase 2)
- createdAt
- updatedAt
- syncStatus (local | synced | pending | conflict)
```

### 4.4 Timeline View

- Vertical scrolling list sorted by `eventDate` descending (newest on top) with toggle to flip order
- **Year dividers** separating events by year
- Each **TimelineCard** shows:
  - Left: colored dot + vertical connector line (color = tag theme)
  - Right: title, date, place, tag badges, thumbnail if media exists
- **Filter bar** at top to filter by one or more tags — timeline re-renders filtered results
- Switching active filter changes the overall UI accent color (tag theme)
- Pull-to-refresh triggers sync

### 4.5 Event Detail Screen

- Full-screen scroll view
- Hero image carousel (if media exists)
- All event fields displayed
- Attached documents listed with open/download option
- Edit and Delete actions in header
- Tag badge(s) shown with themed background

### 4.6 Create / Edit Event

- Form with all standard fields
- Date picker (`@react-native-community/datetimepicker`)
- Place input (plain text; Google Places optional in future)
- Tag multi-selector (chip UI)
- Media picker — camera + gallery (`expo-image-picker`)
- Document picker (`expo-document-picker`) — supports PDF, images
- On save: write to SQLite → mark as `pending` → sync engine picks up

### 4.7 Search

- Full-text search on title + description (SQLite FTS5)
- Filter by tag, date range
- Results shown as condensed timeline cards

---

## 5. Phase 2 — Dynamic Custom Fields

### 5.1 Overview

Users can define extra fields for any event type (tag). These custom field definitions are stored and then rendered dynamically on the event form and detail screen.

### 5.2 Field Types Supported

| Field Type | Input Component |
|------------|----------------|
| text | Single-line TextInput |
| textarea | Multi-line TextInput |
| number | Numeric TextInput |
| date | DateTimePicker |
| radio | RadioGroup (custom) |
| checkbox | CheckboxGroup (custom) |
| dropdown | Picker / BottomSheet select |

### 5.3 Custom Field Definition Schema

```json
{
  "id": "uuid",
  "userId": "uid",
  "tagId": "health",
  "label": "Tooth Number",
  "fieldType": "text",
  "placeholder": "e.g. Upper right molar",
  "required": false,
  "options": [],
  "order": 1
}
```

For `radio`, `checkbox`, `dropdown`:
```json
"options": ["Option A", "Option B", "Option C"]
```

### 5.4 Field Builder UI

- Accessible from Settings → "Manage Custom Fields"
- User selects a tag (event category) to add fields to
- Taps "+ Add Field" → picks field type from list → fills label, placeholder, options (if applicable)
- Fields can be reordered (drag handle) and deleted
- Definitions saved to Firestore under `users/{uid}/fieldDefinitions`

### 5.5 Dynamic Rendering

- On opening Create/Edit event form, app fetches field definitions for selected tags
- `DynamicField.tsx` component maps `fieldType` → correct input component
- Values stored in event's `customFields` JSON blob:
```json
{
  "customFields": {
    "field_uuid_1": "Upper right molar",
    "field_uuid_2": "Root canal"
  }
}
```

### 5.6 Timeline / Detail Theming per Tag

Each tag maps to a full theme object:

```typescript
type TagTheme = {
  primary: string;
  background: string;
  cardBorder: string;
  dotColor: string;
  badgeText: string;
  icon: string;
}
```

When user filters timeline by a tag, or opens an event detail, the active theme switches to match — affecting accent colors, card borders, connector line color, and header gradient.

---

## 6. Firebase Setup

### 6.1 Firestore Collections

```
users/
  {uid}/
    profile/
    fieldDefinitions/      # Phase 2 custom field schemas
      {fieldId}

events/
  {eventId}/               # Top-level for query flexibility
    userId: uid
    ... event fields

```

### 6.2 Security Rules (Firestore)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read, write: if request.auth != null
        && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null
        && request.auth.uid == request.resource.data.userId;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth.uid == uid;
    }
  }
}
```

### 6.3 Firebase Storage Structure

```
users/
  {uid}/
    events/
      {eventId}/
        media/
          image_1.jpg
          image_2.jpg
        docs/
          document_1.pdf
```

### 6.4 Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## 7. Data Models

### TypeScript Types

```typescript
// types/index.ts

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
  eventTime?: string;          // HH:MM optional
  place?: string;
  tags: TagId[];
  mediaUrls: string[];         // Firebase Storage URLs
  localMediaUris: string[];    // Device cache URIs
  documentUrls: string[];      // Firebase Storage URLs
  documentNames: string[];
  customFields: Record<string, any>; // Phase 2
  createdAt: string;
  updatedAt: string;
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
}

export interface CustomFieldDefinition {
  id: string;
  userId: string;
  tagId: TagId;
  label: string;
  fieldType: FieldType;
  placeholder?: string;
  required: boolean;
  options?: string[];           // for radio, checkbox, dropdown
  order: number;
}

export type FieldType =
  | 'text' | 'textarea' | 'number'
  | 'date' | 'radio' | 'checkbox' | 'dropdown';
```

### SQLite Schema

```sql
-- Events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  event_time TEXT,
  place TEXT,
  tags TEXT,                   -- JSON array
  media_urls TEXT,             -- JSON array
  local_media_uris TEXT,       -- JSON array
  document_urls TEXT,          -- JSON array
  document_names TEXT,         -- JSON array
  custom_fields TEXT,          -- JSON object (Phase 2)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sync_status TEXT DEFAULT 'local'
);

-- FTS5 virtual table for search
CREATE VIRTUAL TABLE events_fts USING fts5(
  id,
  title,
  description,
  place,
  content='events',
  content_rowid='rowid'
);

-- Custom field definitions (Phase 2)
CREATE TABLE field_definitions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL,
  placeholder TEXT,
  required INTEGER DEFAULT 0,
  options TEXT,               -- JSON array
  sort_order INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'local'
);
```

---

## 8. Screen-by-Screen Breakdown

### Screen 1: Timeline (Home)

- Component: `TimelineList` (FlashList for performance)
- Header: App name + search icon + filter icon
- Filter chips: Horizontal scroll of tag chips, multi-selectable
- Active tag filter → changes accent theme
- FAB (Floating Action Button): "+" → navigate to new event screen
- Empty state with illustration when no events

### Screen 2: Event Detail

- Hero media carousel at top (if images exist)
- Scrollable content below: date/time/place chips, description, custom fields, documents
- Header: Edit (pencil) + Delete (trash) icons
- Tag badges with themed colors
- Documents section: list of attached files with open/share actions

### Screen 3: Create / Edit Event

- Scrollable form
- Title (required), Date (required), Time (optional)
- Place text field
- Description (multiline)
- Tag selector (multi-select chips)
- Media section: thumbnails of selected images + add button
- Documents section: list of attached docs + add button
- Custom Fields section (Phase 2): rendered below standard fields
- Save button (sticky footer)

### Screen 4: Search

- Search bar (auto-focused on enter)
- Filter row: by tag, date range pickers
- Results as timeline cards

### Screen 5: Settings

- Profile info
- Manage Custom Fields (Phase 2)
- Sync status indicator (last synced time)
- Theme preference (light/dark)
- Export data (JSON) — future
- Sign out

### Screen 6: Field Builder (Phase 2)

- Select tag to manage
- List of existing field definitions for that tag (draggable to reorder)
- "+ Add Field" button
- Field editor bottom sheet: type selector, label, placeholder, options

---

## 9. Local-First Sync Strategy

### Write Flow

```
User saves event
      │
      ▼
Write to SQLite (syncStatus = 'pending')
      │
      ▼
Update UI immediately
      │
      ▼
Sync engine detects pending record
      │
   Online?
   /     \
 Yes      No → wait for connectivity
  │
  ▼
Upload media to Firebase Storage → get URLs
      │
      ▼
Write event doc to Firestore
      │
      ▼
Update SQLite syncStatus = 'synced'
```

### Conflict Resolution

- Last-write-wins based on `updatedAt` timestamp for simple fields
- Media: union merge (never delete remote files silently)
- If conflict detected: mark as `'conflict'`, show user a resolution UI (keep local / keep remote / merge)

### Sync Triggers

- App comes to foreground
- Network connectivity restored (NetInfo listener)
- Manual pull-to-refresh on timeline
- Background fetch (every 15 min via `expo-background-fetch`)

---

## 10. Key Libraries

| Purpose | Library |
|---------|---------|
| Framework | `expo` (SDK 51+) |
| Navigation | `expo-router` |
| UI Components | `react-native-paper` or custom |
| List performance | `@shopify/flash-list` |
| Local DB | `expo-sqlite` |
| Async storage | `@react-native-async-storage/async-storage` |
| State management | `zustand` |
| Firebase | `@react-native-firebase/app`, `firestore`, `auth`, `storage` |
| Image picker | `expo-image-picker` |
| Document picker | `expo-document-picker` |
| Date picker | `@react-native-community/datetimepicker` |
| Drag-and-drop (Phase 2) | `react-native-draggable-flatlist` |
| Network state | `@react-native-community/netinfo` |
| Background sync | `expo-background-fetch`, `expo-task-manager` |
| Icons | `@expo/vector-icons` |
| Animations | `react-native-reanimated` |
| Image caching | `expo-image` |

---

## 11. Development Milestones

### Milestone 1 — Foundation (Week 1–2)
- [x] Expo project setup with Expo Router
- [ ] Firebase project creation + config
- [ ] Authentication screens (login, register, Google sign-in)
- [ ] SQLite schema setup (using Zustand store temporarily)
- [x] Navigation structure (tab bar + stack)

### Milestone 2 — Event Core (Week 3–4)
- [x] Create/Edit event form (standard fields only)
- [ ] SQLite CRUD for events (using Zustand store temporarily)
- [x] Tag selector component
- [x] Date/time/place inputs

### Milestone 3 — Timeline UI (Week 5–6)
- [x] Timeline screen with FlashList
- [x] TimelineCard component
- [x] Year dividers
- [x] Tag filter chips
- [x] Tag-based theme switching
- [x] Empty state

### Milestone 4 — Media & Documents (Week 7)
- [ ] Image picker integration
- [ ] Document picker integration
- [ ] Firebase Storage upload service
- [ ] Media display in event detail (carousel)
- [ ] Document list with open/share

### Milestone 5 — Sync Engine (Week 8–9)
- [ ] Sync engine (pending → Firestore)
- [ ] NetInfo listener for auto-sync
- [ ] Pull-to-refresh
- [ ] Conflict detection UI

### Milestone 6 — Search & Polish (Week 10)
- [ ] FTS5 search
- [x] Filter by tag + date range
- [ ] App icon, splash screen
- [ ] Loading states, error handling
- [ ] Android build + internal testing

### Milestone 7 — Phase 2: Custom Fields (Week 11–13)
- [ ] Field definition data model (SQLite + Firestore)
- [ ] Field Builder screen
- [ ] DynamicField renderer component
- [ ] All field types (text, textarea, number, date, radio, checkbox, dropdown)
- [ ] Drag-to-reorder field definitions
- [ ] Integration into event form and detail screen

### Milestone 8 — Phase 2: Themes (Week 14)
- [x] Full theme objects per tag
- [x] Apply tag theme to event detail screen
- [x] Apply active filter theme to timeline
- [x] Theme transitions (Reanimated)

---

## 12. Future SaaS Considerations

| Feature | Notes |
|---------|-------|
| **Family sharing** | Firestore subcollections under a `family/{familyId}` doc; role-based access (owner, member, viewer) |
| **Subscription tiers** | Free (50 events, 500MB storage), Pro (unlimited), Family (5 members) via RevenueCat |
| **Export / Backup** | Export all events as JSON or PDF timeline — Firebase Functions trigger |
| **Web app** | Shared Firebase backend; React web app using same Firestore schema |
| **Notifications** | Firebase Cloud Messaging — reminders for anniversaries, policy renewals |
| **AI summaries** | "Your year in review" — Cloud Function calls Gemini API to summarize the year's events |
| **Onboarding templates** | Pre-seed common events (birthday, school start) on signup based on user input |

---

*Document generated: Personal Life Timeline — Full Implementation Plan*
*Stack: Expo React Native · Firebase · Android-first · Phase 1 + Phase 2*
