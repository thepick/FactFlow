# FactFlow

FactFlow is a multiplication fluency web app designed for student practice. It helps learners build speed, accuracy, and confidence with multiplication facts through short timed rounds, adaptive review, and clear progress tracking.

## What it does

FactFlow gives students focused multiplication practice while tracking how they are doing on each fact. The app adjusts practice based on performance, so facts that are slow, missed, timed out, or not yet fluent can appear again while mastered facts gradually need less attention.

Students sign in with Google before practicing. Progress is synced through Google Drive app data storage, so students can continue their practice across supported devices when signed in with the same Google account.

FactFlow does not require Firebase, a separate database, or a custom backend.

## Key features

- Google sign-in required before practice
- Timed multiplication practice rounds
- Adaptive fact selection based on accuracy, speed, confidence, and recent performance
- Progress grid showing fluent, in-progress, struggling, and locked facts
- Mastery score and progress graph
- More forgiving mastery logic so one slightly slow correct answer does not immediately remove progress
- More stable mastered facts, with repeated weakness needed before progress is reduced
- Streak and facts-per-minute tracking
- Adjustable speed target
- Light mode, dark mode, and match-device appearance options
- Optional mobile haptic feedback
- Google Drive app data sync without Firebase, a database, or a custom backend
- Sync status shown in the app header
- Reset-progress options
- Short confetti celebration when students progress to a new table

## Google sign-in and sync

FactFlow requires students to sign in with Google before they can begin practicing.

Progress is synced using the student's Google Drive app data folder. This keeps the FactFlow progress file separate from the student's normal visible Google Drive files and limits the app to its own stored progress data.

Sync is designed for classroom use:

- Students sign in with Google to start practicing.
- Progress is saved during practice.
- If Google sync is available, progress is saved to Google Drive app data storage.
- When the app is opened on another supported device, the student's saved progress can be loaded and merged.
- If sync is interrupted, the app can continue using locally cached progress during the active signed-in session.
- Sync can resume when the connection and Google session are available again.

## Designed for students

The interface is simple and classroom-friendly. Students can start a round, answer using the on-screen keypad, and see immediate feedback.

The progress tools help students and teachers quickly understand which facts are becoming fluent, which facts are still developing, and which facts need more practice.

## Mastery and progress

FactFlow tracks each multiplication fact individually. A fact can move through different progress states based on accuracy, speed, confidence, and recent performance.

The mastery system is designed to encourage steady growth without being overly strict. Mastered facts are more stable, so one slightly slow correct answer should not immediately erase progress. Facts that are missed, timed out, or repeatedly slow can still be reviewed more often.

The progress graph shows growth over time using saved quiz results. In-progress facts also contribute to the mastery score, so students can see progress even while facts are still developing.

## Privacy and storage

FactFlow requires students to sign in with Google before practicing.

Progress is stored for the signed-in Google user and synced through the student's Google Drive app data folder. The sync file is used for FactFlow progress data and is not meant to appear in the student's normal Google Drive files.

FactFlow does not require Firebase, a separate database, or a custom server.

FactFlow does not store student names, class lists, or other unnecessary personal information in the progress data.

If a student signs out, clears browser data, changes devices, loses internet access, or loses access to Google sync, locally cached progress on that device may not remain available. Synced progress can be restored when the student signs in again and sync is available.

## Best use case

FactFlow works well for daily multiplication fluency practice in upper elementary classrooms, intervention groups, homework stations, or independent review.

It is especially useful when students need quick, repeated practice sessions with clear feedback, manageable goals, visible progress, and progress syncing across supported devices.
