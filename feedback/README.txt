=====================================================================
 PERSONA FEEDBACK & CUSTOMER JOURNEYS — READ ME
 ABA Therapy Platform · MVP feedback pass · Oct 2026
=====================================================================

WHAT'S IN THIS FOLDER
---------------------------------------------------------------------
Feedback (each persona speaks in first person, based on the app
as actually built):
  persona-1-center-admin-feedback.txt   (Amira — center owner)
  persona-2-supervisor-feedback.txt     (Omar — BCBA supervisor)
  persona-3-therapist-feedback.txt      (Sara — RBT therapist)
  persona-4-parent-feedback.txt         (Layla — parent/guardian)

Customer journeys (draw-ready: stages → actions → touchpoints →
thoughts → emotion 1–10 → pains → opportunities):
  journey-1-center-admin.txt   (60-day arc: sign-up → renewal)
  journey-2-supervisor.txt     (weekly clinical loop, intake → co-sign)
  journey-3-therapist.txt      (one typical day, 6 sessions)
  journey-4-parent.txt         (first 30 days: trust building)

HOW TO USE THE JOURNEYS TO DRAW
---------------------------------------------------------------------
- X-axis: the 6 stages per file.
- Swimlanes per stage: Actions / Touchpoints / Thoughts / Emotion /
  Pain points / Opportunities.
- Plot the emotion scores (given at the end of each file) as a
  line across stages — the dips show exactly where to fix.
- Each file ends with "BIGGEST LEAK" = the stage to fix first.

=====================================================================
 CROSS-PERSONA FIX PRIORITY (what to build, in order)
=====================================================================

TIER 0 — FIX NOW (small, high pain, mentioned by everyone)
---------------------------------------------------------------------
1. Login error honesty: "server unreachable" vs "invalid
   credentials"                            [Sara #4, blocks trust]
2. Self-serve password reset (emailed link, staff + parents)
                                            [Amira #5, Sara #9, Layla]
3. Plain-language labels/tooltips in the parent portal
                                            [Layla #1, cheap to add]

TIER 1 — BIGGEST VALUE GAPS (backend models exist, no UI!)
---------------------------------------------------------------------
4. In-app messaging (per student, parent + therapist + supervisor)
   → Message model exists in DB, zero UI    [Omar #3, Sara #8, Layla #4]
5. Attendance UI + per-session parent invoicing
   → AttendanceRecord model exists          [Amira #1, Sara]
6. Documents area (reports/letters/invoices per child)
   → DocumentUpload model exists            [Layla #5, Omar #7]

TIER 2 — CLINICAL SUPERPOWERS (retention drivers)
---------------------------------------------------------------------
7. Supervisor risk dashboard: stalling students, accuracy drops,
   overdue notes in one screen              [Omar #1]
8. Co-sign queue + "notes awaiting YOUR signature" counter
                                            [Omar #2, #6]
9. Skill-progress view per program for parents (not session
   counts) + auto plain-language session summaries
                                            [Layla #2, #3]
10. Parent-friendly progress report PDF (per student)
                                            [Amira #3, Omar #7, Layla]

TIER 3 — SPEED & SCALE
---------------------------------------------------------------------
11. Quick-trial capture (target chips → ✓/✗, 2 taps) + mand
    quick-tally                             [Sara #1, #7]
12. "My Day" mobile-first view for therapists + responsive
    session flow (phone)                    [Sara #2, #6]
13. Recurring sessions + availability conflicts in calendar
                                            [Omar #5]
14. Suggested assessment goals → one-click create target
                                            [Omar #4]
15. Trial-end email sequence + "upgrade without losing typed
    data" flow                              [Amira #1, #7]

TIER 4 — LATER
---------------------------------------------------------------------
16. Notifications (cancellations, reminders, new notes, admin
    digest) — needs email/push infrastructure
17. Real mobile app (replace the Expo stub)
18. Program templates, data-quality flags, home-practice feed,
    billing visibility for parents

PATTERN WORTH SEEING
---------------------------------------------------------------------
- Parents churn the CENTER when the portal stops at "viewing":
  give them language, story, documents, payments visibility.
- Therapists' data quality is a SPEED problem, not a training
  problem: fewer taps = better data.
- Supervisors need LOOKOUT (risk overview) and COMMS (messaging)
  more than more data-entry screens.
- Admins churn over manual workflows that survive outside the
  app (attendance, invoicing, passwords) — close those loops.
- Three of the top fixes need ZERO new backend models — the
  schema already has Message, AttendanceRecord, DocumentUpload.
