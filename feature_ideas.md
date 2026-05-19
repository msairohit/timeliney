# Timeliney — Feature Improvement Ideas

Based on the current codebase, here are feature ideas organized by effort and impact.

## Selected for Implementation: 2, 3, 5, 6, 7, 10, 13

---

## 🟢 Quick Wins (Low effort, high impact)

### 1. Hide "Noted" events from main timeline by default
Since you just added the `noted` tag for others' events — the timeline could **auto-hide** events tagged as `noted` unless the user explicitly filters for them. A small toggle like "Show noted events" or a persistent filter preference would keep your timeline clean.

### 2. Share / Export an event ✅ DONE
The Share FAB on the detail page (`[id].tsx`) currently does nothing. Wire it up to generate a **beautiful shareable card** (image or text) with the event title, date, location, and photo — great for sharing anniversaries or milestones on social media.

### 3. Reminders / Notifications ✅ DONE
Already in your `notes.txt`! Set reminders for:
- Upcoming anniversaries ("X years since...")
- Future events ("Event in 3 days")
- Noted events like others' birthdays

Use `expo-notifications` with local scheduling. The insight engine on your home screen already calculates `daysTo` — just hook it to notification scheduling.

### 4. Favorite / Pin events
Let users ⭐ favorite important events. Show them in a dedicated "Pinned Moments" section on the home screen, always accessible regardless of filters.

### 5. "Years Ago Today" push notification ✅ DONE - To be tested
A daily morning notification: *"On this day 5 years ago: Got my first job"* — leveraging the "On This Day" logic you already have in `index.tsx`.

---

## 🟡 Medium Effort (Good value, moderate work)

### 6. Timeline View Modes ✅ DONE
Currently it's a flat card list. Add toggleable views:
- **Compact list** — one-line per event, denser info
- **Calendar view** — month grid with dots on event days (tap to expand)
- **Year overview** — horizontal year-by-year blocks showing event density per month (heatmap style)

### 7. Custom Tag Colors ✅ SELECTED
Already in `notes.txt` — let users pick their own color for each tag from the profile/settings screen. Store preferences in AsyncStorage and override `TAG_THEMES` at runtime.

### 8. Event Templates
For recurring life events (doctor visits, travel trips, annual reviews), let users create **templates** with pre-filled tags, places, and descriptions. One-tap creation from the template.

### 9. Full-text Search Improvements
- **Search within description** (already done ✅)
- Add **search suggestions** / recent searches
- **Voice-to-text** input for quick search (expo-speech)
- Highlight matched text in results

### 10. Statistics / Analytics Dashboard ✅ DONE
A dedicated screen showing:
- Events per year (bar chart)
- Most-used tags (pie chart)
- Events by location (grouped list or map)
- Longest date-range events
- "Your life in numbers" summary

Could use `react-native-chart-kit` or `victory-native`.

### 11. Import from other apps
Allow importing life events from:
- **Google Calendar** (via API — you already have Google auth)
- **CSV/JSON file** import
- **Contacts birthdays** (auto-populate `noted` events)

### 12. Bulk operations
- Multi-select events on the timeline
- Bulk tag, bulk delete, bulk export
- "Select all in year 2024" type shortcuts

---

## 🔵 Bigger Vision (High effort, transformative)

### 13. People / Relationships tagging ✅ DONE
Add a **People** field to events — tag people who were involved (e.g., "Mom", "Ravi", "College friends"). Then:
- Filter timeline by person
- See "Your story with Ravi" — all shared events
- Auto-suggest people based on previous events

### 14. Map View
Plot all events with locations on an interactive map. Tap pins to see event cards. Filter by tag/date. Show travel paths between events. Uses `react-native-maps`.

### 15. Life Chapters / Periods
Group events into broader life chapters: *"School Days (2005–2015)"*, *"Bangalore Era (2018–2022)"*. These would be collapsible sections in the timeline, giving a high-level narrative structure to your life story.

### 16. AI-powered event summary
Use an LLM API to generate:
- A "Year in Review" narrative from your events
- Smart grouping suggestions ("These 5 events seem related")
- Auto-tagging from event descriptions

### 17. Collaborative timeline
Let family members contribute to a shared family timeline. Each person adds their perspective. Events can be linked across accounts.

### 18. Offline-first media caching
Cache the last N event images locally so the timeline looks great even without internet. You already have `localMediaUris` — extend the cache manager to proactively download recent cloud media.

---

## 📋 From Original Notes (Still TODO)

| Item | Status |
|------|--------|
| Export & share with nice UI | ⬜ Not started |
| Custom tag colors | ⬜ Not started |
| Reminders | ⬜ Not started |
| Noted events tag | ✅ Done |
