# Time Clock — turned off 2026-07-10 (code saved, nothing deleted)

Karley asked to remove the Time Clock section for now, with the code kept for a
possible future re-add. Nothing was deleted — the whole feature is behind one
switch.

## What's hidden while it's off
- The **Time Clock** card (Clock In / Out to Lunch / Back from Lunch / Clock Out
  buttons, Undo Last, "You today" line)
- **Who's In** (per-person status cards, staff In Office / Out of Office bubbles,
  admin punch corrections, the Day picker)
- **Pending punch changes** (staff fix requests + admin approve/deny)
- **Hours This Week** admin sidebar card (worked vs scheduled — it's built from
  punches, so it goes with them)
- Clock-in/clock-out **shift reminder toasts** and the **confetti clock-out**
  send-off (it only played on the Clock Out punch)
- The **Time Clock** nav pill (the `#clock` page falls back to the homepage)

## How to bring it all back (one line)
In `app.js`, near the top:

```js
const FEATURE_TIME_CLOCK = false;   →   const FEATURE_TIME_CLOCK = true;
```

Then bump the cache-bust version in `index.html` (`style.css?v=N`, `app.js?v=N`,
and the footer stamp) and push. That's it — the flag drives everything:
the section and nav pill un-hide, `#clock` routing is restored, punch/request
loading resumes, reminders re-arm, and the Hours This Week card returns for
admins.

## Data
The `time_punches` and `punch_requests` tables (and their RLS policies) are
untouched in Supabase — old punches are still there and new ones will simply
resume when the flag is flipped.
