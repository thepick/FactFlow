# FactFlow

FactFlow is a local-first multiplication fluency web app designed for student practice. It helps learners build speed, accuracy, and confidence with multiplication facts through short timed rounds, adaptive review, and clear progress tracking.

## What it does

FactFlow gives students focused multiplication practice while tracking how they are doing on each fact. The app adjusts practice based on performance, so facts that are slow, missed, or not yet fluent can appear again while mastered facts gradually need less attention.

Progress is saved directly on the device using browser storage. No sign-in, account, database, Firebase setup, or custom backend is required.

## Key features

- Timed multiplication practice rounds
- Adaptive fact selection based on accuracy, speed, and recent performance
- Progress grid showing fluent, in-progress, struggling, and locked facts
- Mastery score and progress graph
- More forgiving mastery logic so one slightly slow answer does not immediately remove progress
- Streak and facts-per-minute tracking
- Adjustable speed target
- Light mode, dark mode, and match-device appearance options
- Optional mobile haptic feedback
- Simple reset-progress options
- Local device storage with no account required
- Offline-friendly practice
- Short confetti celebration when students progress to a new table

## Local progress storage

FactFlow saves progress locally in the browser. This means students can open the app and begin practicing without creating an account or signing in.

Progress is saved on the device being used. If a student switches to a different browser or device, that device will have its own separate progress unless progress data is manually transferred outside the app.

Because FactFlow is local-first:

- Practice works without an internet connection after the app has loaded.
- Progress is saved immediately on the device.
- No student account is required.
- No cloud database or server is needed.
- Student progress stays on the device.

## Designed for students

The interface is simple and classroom-friendly. Students can start a round, answer using the on-screen keypad, and see immediate feedback.

The progress tools help students and teachers quickly understand which facts are becoming fluent, which facts are still developing, and which facts need more practice.

## Mastery and progress

FactFlow tracks each multiplication fact individually. A fact can move through different progress states based on accuracy, speed, confidence, and recent performance.

The mastery system is designed to encourage steady growth without being overly strict. Mastered facts are more stable, so one slightly slow correct answer should not immediately erase progress. Facts that are missed, timed out, or repeatedly slow can still be reviewed more often.

The progress graph shows growth over time using the student's saved quiz results.

## Privacy and storage

FactFlow saves progress locally using browser storage. No login is required.

FactFlow should not store student names, class lists, or other unnecessary personal information in the progress data.

If browser data is cleared, local progress may be deleted.

## Best use case

FactFlow works well for daily multiplication fluency practice in upper elementary classrooms, intervention groups, homework stations, or independent review.

It is especially useful for quick, repeated practice sessions where students need clear feedback, manageable goals, and visible progress over time.
