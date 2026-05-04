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

## How practice, progress, and mastery work

This section explains what a student experiences from their very first round to full mastery, and how the app decides what to show them and when.

---

### The big picture

FactFlow tracks every multiplication fact individually. Each fact has its own progress state based on how accurately and how quickly the student has answered it across multiple attempts. The app uses this information to decide which facts to show more often and which facts are ready to take a back seat.

Progress moves in one direction by default - forward - but the app watches for signs of weakness and will bring a fact back for review if needed.

---

### Starting out

A new student begins with the 2 times table. Only facts from the current table (and lower) are active during practice. Facts from tables the student has not reached yet are locked and do not appear.

When a fact appears for the very first time, a **"New fact!"** label is shown so the student knows it is okay to be slow. Speed is not penalised for facts seen fewer than six times - only accuracy matters in the early attempts.

---

### What happens during a round

Each round is timed (default: 60 seconds). The student answers as many facts as they can before time runs out.

The app chooses which fact to show next based on a weighted selection. Facts that are struggling, overdue for review, or recently answered incorrectly are more likely to appear. Facts that are already fluent and recently answered correctly are less likely to appear, giving room for weaker facts.

For each answer, the app records:

- Whether it was correct or timed out
- How long it took (response time in milliseconds)
- Whether it was fast, timely, slow, or very slow relative to the speed target

**Wrong answers** reset the current streak and lower the fact's confidence score. Three wrong inputs in quick succession trigger a 3-second cooldown with a hint ("Think carefully: 8 × 7 = ?") to slow the student down and encourage careful thinking rather than guessing.

**Timeouts** (no answer within 12 seconds) count as a weak attempt. The correct answer is shown, and the student must type it before moving on. This turns a timeout into a small learning moment rather than just skipping past the fact.

---

### How a fact changes colour

Each fact in the progress grid has one of five states:

| Colour | State | What it means |
|---|---|---|
| Dark green | **Fluent** | Fast, accurate, and consistent. This fact is mastered. |
| Light green (dashed) | **Almost there** | Nearly fluent. A few more good answers will turn it fully green. |
| Yellow | **Learning** | Seen and answered correctly, but not yet fast or consistent enough. |
| Red / pink | **Struggling** | Recently missed, timed out, or repeatedly slow. Needs more practice. |
| Grey | **Locked** | Belongs to a table the student has not reached yet. |

A fact starts empty (never seen), then moves through learning toward fluent as the student answers it correctly and quickly across multiple spaced attempts. No single good answer makes a fact green - the app looks at a window of recent attempts to confirm the improvement is real.

---

### What "fluent" actually requires

A fact reaches **fluent** status only when all of the following are true across recent attempts:

- Confidence score is 85 or higher (out of 100)
- At least 3 of the last 4 attempts were correct
- At least 1 of those was answered within the fluent time threshold
- At least 2 of those were answered within 1.6x the fluent time threshold
- No timeout or wrong answer in the most recent attempt
- No more than one weak attempt in the recent window

This means a student cannot "luck into" a green fact with one fast answer. The app waits for consistent performance across several spaced attempts before awarding fluency.

---

### Protecting mastered facts

Once a fact is green, it is protected. One typo, one timeout, or one slightly slow answer will **not** immediately remove it from fluent status. The fact needs to show repeated weakness - or a significant drop in confidence - before it is demoted.

This makes the system feel fair. A student who genuinely knows a fact will not lose their progress from a single bad moment.

---

### Moving to the next table

When enough facts in the current table are fluent, the student **graduates** to the next table. A confetti celebration plays and the progress grid expands to include the new table's facts.

After graduation, facts from the previous table are still reviewed occasionally. The app keeps a review pool of facts from all completed tables to make sure earlier learning is not forgotten.

---

### The mastery score

The mastery score (shown as a number out of 100) reflects overall progress across all active facts. It is calculated from:

- **Fluent facts** count fully toward the score
- **In-progress (almost there) facts** count partially
- **Accuracy and speed** from recent rounds add a small bonus

This means the score can move forward even while facts are still yellow - the student does not have to wait for everything to turn green before seeing improvement.

After each round, a one-sentence note explains why the score went up, held steady, or dipped - for example: *"Great round! Fast, accurate answers pushed your score up by 6 points."*

---

### Daily practice goal

The app tracks how many rounds a student completes each day. The daily goal is **5 rounds**. The header shows "Today: X of 5" and turns green when the goal is reached. Five rounds takes roughly 5 minutes and is enough to meaningfully move facts forward.

---

### The full journey

| Stage | What the student experiences |
|---|---|
| First session | New facts introduced one table at a time. "New fact!" label appears. No speed penalty yet. |
| Early practice | Facts appear often. Correct answers raise confidence. Wrong answers or timeouts bring facts back quickly. |
| Building fluency | Facts start turning yellow, then light green as confidence and speed improve. |
| Mastery | Facts turn dark green. They appear less often but still come back for spaced review. |
| Graduation | Enough facts mastered triggers a table unlock and confetti celebration. |
| Long-term | All tables from ×2 to ×12 worked through. Mastery score climbs toward 100. |
