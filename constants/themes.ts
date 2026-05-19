import { TagId } from '../types';
import {
  User,
  Users,
  HeartPulse,
  GraduationCap,
  Landmark,
  Home,
  Car,
  Plane,
  Star,
  Pin,
  Briefcase,
  Palette,
  FolderOpen,
  Trophy,
  Ticket,
  FileText,
  ShoppingBag,
  Bookmark
} from 'lucide-react-native';

export type TagTheme = {
  id: TagId;
  label: string;
  primary: string;
  background: string;
  cardBorder: string;
  dotColor: string;
  badgeText: string;
  badgeBackground: string;
  icon: any;
};

export const TAG_THEMES: Record<TagId, TagTheme> = {
  personal: {
    id: 'personal',
    label: 'Personal',
    primary: '#6366f1', // Indigo
    background: '#eef2ff',
    cardBorder: '#c7d2fe',
    dotColor: '#6366f1',
    badgeText: '#4338ca',
    badgeBackground: '#e0e7ff',
    icon: User,
  },
  family: {
    id: 'family',
    label: 'Family',
    primary: '#f59e0b', // Amber
    background: '#fffbeb',
    cardBorder: '#fde68a',
    dotColor: '#f59e0b',
    badgeText: '#b45309',
    badgeBackground: '#fef3c7',
    icon: Users,
  },
  health: {
    id: 'health',
    label: 'Health',
    primary: '#ef4444', // Red
    background: '#fef2f2',
    cardBorder: '#fecaca',
    dotColor: '#ef4444',
    badgeText: '#b91c1c',
    badgeBackground: '#fee2e2',
    icon: HeartPulse,
  },
  education: {
    id: 'education',
    label: 'Education',
    primary: '#3b82f6', // Blue
    background: '#eff6ff',
    cardBorder: '#bfdbfe',
    dotColor: '#3b82f6',
    badgeText: '#1d4ed8',
    badgeBackground: '#dbeafe',
    icon: GraduationCap,
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    primary: '#10b981', // Emerald
    background: '#ecfdf5',
    cardBorder: '#a7f3d0',
    dotColor: '#10b981',
    badgeText: '#047857',
    badgeBackground: '#d1fae5',
    icon: Landmark,
  },
  property: {
    id: 'property',
    label: 'Property',
    primary: '#8b5cf6', // Violet
    background: '#f5f3ff',
    cardBorder: '#ddd6fe',
    dotColor: '#8b5cf6',
    badgeText: '#6d28d9',
    badgeBackground: '#ede9fe',
    icon: Home,
  },
  vehicle: {
    id: 'vehicle',
    label: 'Vehicle',
    primary: '#64748b', // Slate
    background: '#f8fafc',
    cardBorder: '#e2e8f0',
    dotColor: '#64748b',
    badgeText: '#334155',
    badgeBackground: '#f1f5f9',
    icon: Car,
  },
  travel: {
    id: 'travel',
    label: 'Travel',
    primary: '#0ea5e9', // Sky
    background: '#f0f9ff',
    cardBorder: '#bae6fd',
    dotColor: '#0ea5e9',
    badgeText: '#0369a1',
    badgeBackground: '#e0f2fe',
    icon: Plane,
  },
  milestone: {
    id: 'milestone',
    label: 'Milestone',
    primary: '#d946ef', // Fuchsia
    background: '#fdf4ff',
    cardBorder: '#f5d0fe',
    dotColor: '#d946ef',
    badgeText: '#a21caf',
    badgeBackground: '#fae8ff',
    icon: Star,
  },
  work: {
    id: 'work',
    label: 'Work',
    primary: '#0284c7', // light blue
    background: '#f0f9ff',
    cardBorder: '#e0f2fe',
    dotColor: '#0284c7',
    badgeText: '#0369a1',
    badgeBackground: '#bae6fd',
    icon: Briefcase,
  },
  hobby: {
    id: 'hobby',
    label: 'Hobby',
    primary: '#84cc16', // Lime
    background: '#f7fee7',
    cardBorder: '#ecfccb',
    dotColor: '#84cc16',
    badgeText: '#4d7c0f',
    badgeBackground: '#d9f99d',
    icon: Palette,
  },
  project: {
    id: 'project',
    label: 'Project',
    primary: '#f97316', // Orange
    background: '#fff7ed',
    cardBorder: '#ffedd5',
    dotColor: '#f97316',
    badgeText: '#c2410c',
    badgeBackground: '#fed7aa',
    icon: FolderOpen,
  },
  achievement: {
    id: 'achievement',
    label: 'Achievement',
    primary: '#eab308', // Yellow
    background: '#fefce8',
    cardBorder: '#fef08a',
    dotColor: '#eab308',
    badgeText: '#a16207',
    badgeBackground: '#fde047',
    icon: Trophy,
  },
  social: {
    id: 'social',
    label: 'Social / Event',
    primary: '#db2777', // Pink
    background: '#fdf2f8',
    cardBorder: '#fbcfe8',
    dotColor: '#db2777',
    badgeText: '#9d174d',
    badgeBackground: '#f9a8d4',
    icon: Ticket,
  },
  document: {
    id: 'document',
    label: 'Document',
    primary: '#475569', // Slate
    background: '#f8fafc',
    cardBorder: '#e2e8f0',
    dotColor: '#475569',
    badgeText: '#1e293b',
    badgeBackground: '#cbd5e1',
    icon: FileText,
  },
  purchase: {
    id: 'purchase',
    label: 'Purchase',
    primary: '#14b8a6', // Teal
    background: '#f0fdfa',
    cardBorder: '#ccfbf1',
    dotColor: '#14b8a6',
    badgeText: '#0f766e',
    badgeBackground: '#99f6e4',
    icon: ShoppingBag,
  },
  noted: {
    id: 'noted',
    label: 'Noted',
    primary: '#a18072', // Warm muted brown
    background: '#faf6f4',
    cardBorder: '#e8ddd8',
    dotColor: '#a18072',
    badgeText: '#6d4c41',
    badgeBackground: '#efebe9',
    icon: Bookmark,
  },
  other: {
    id: 'other',
    label: 'Other',
    primary: '#71717a', // Zinc
    background: '#fafafa',
    cardBorder: '#e4e4e7',
    dotColor: '#71717a',
    badgeText: '#3f3f46',
    badgeBackground: '#f4f4f5',
    icon: Pin,
  },
};

export const TAGS_LIST = Object.values(TAG_THEMES);
