import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LifeEvent, TagId } from '../types';

interface EventState {
  events: LifeEvent[];
  addEvent: (event: LifeEvent) => void;
  updateEvent: (id: string, updatedEvent: Partial<LifeEvent>) => void;
  deleteEvent: (id: string) => void;
  getEventById: (id: string) => LifeEvent | undefined;
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [],
      addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
      updateEvent: (id, updatedEvent) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updatedEvent } : e)),
        })),
      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        })),
      getEventById: (id) => get().events.find((e) => e.id === id),
    }),
    {
      name: 'timeline-events-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
