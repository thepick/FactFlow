# FactFlow

FactFlow is a multiplication fluency web app designed for student practice. It helps learners build speed, accuracy, and confidence with multiplication facts through short timed rounds, adaptive review, and clear progress tracking.

## What it does

FactFlow gives students focused multiplication practice while tracking how they are doing on each fact. The app adjusts practice based on performance, so facts that are slow, missed, timed out, not started, or not yet mastered can appear more often while mastered facts gradually need less attention.

Students sign in with Google before practicing. Progress is synced through Google Drive app data storage, so students can continue their practice across supported devices when signed in with the same Google account.

FactFlow does not require Firebase, a separate database, or a custom backend.

## Key features

- Google sign-in required before practice
- Timed multiplication practice rounds, with a short get-ready countdown
- Adaptive fact selection based on accuracy, speed, confidence, and recent performance
- Progress grid showing Mastered, Review Soon, Almost There, Learning, Needs Practice, and Not Started facts
- Mastery score and progress graph with recent/all-results views
- Average speed and accuracy shown for the visible graph results
- More forgiving mastery logic so one slightly slow correct answer does not immediately remove progress
- More stable mastered facts, with Review Soon used before a fact drops back down
- Streak, best streak, speed, and best-speed tracking
- Adjustable speed target: 20, 30, 40, 50, or 60 facts/min
- Light mode, dark mode, and match-device appearance options
- Optional mobile haptic feedback on supported devices
- Google Drive app data sync without Firebase, a database, or a custom backend
- Sync status shown in the app header
- Sync now, sign-out, and reset-progress options
- Confetti and a level-up message when students move to a new times table

## Google sign-in and sync

FactFlow requires students to sign in with Google before they can begin practicing.

Progress is synced using the student's Google Drive app data folder. This keeps the FactFlow progress file separate from the student's normal visible Google Drive files and limits the app to its own stored progress data.

Sync is designed for classroom use:

- Students sign in with Google to start practicing.
- Progress is saved during practice.
- Before a round starts, the app can sync recent Google progress when needed.
- If Google sync is available, progress is saved to Google Drive app data storage.
- When the app is opened on another supported device, the student's saved progress can be loaded and merged.
- If sync is interrupted, the app can continue using locally cached progress during the active signed-in session.
- Sync can resume when the connection and Google session are available again.

## Designed for students

The interface is simple and classroom-friendly. Students can start a round, answer using the on-screen keypad, and see immediate feedback.

The progress tools help students and teachers quickly understand which facts are mastered, which facts are nearly ready, which facts are still developing, and which facts need more practice.

## Mastery and progress

FactFlow tracks each multiplication fact individually from 2x2 through 12x12. A fact can move through different progress states based on accuracy, speed, confidence, and recent performance.

The mastery system is designed to encourage steady growth without being overly strict. Mastered facts are more stable, so one slightly slow correct answer should not immediately erase progress. A mastered fact may move to Review Soon when it shows a small weakness, but repeated weakness is needed before progress is reduced further.

The progress graph shows growth over time using saved quiz results. Started facts that are not yet mastered also contribute partial progress to the mastery score, so students can see improvement while facts are still developing.

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

FactFlow tracks every multiplication fact individually from 2x2 through 12x12. Each fact has its own progress state based on how accurately and how quickly the student has answered it across multiple attempts. The app uses this information to decide which facts to show more often and which facts are ready to take a back seat.

Progress moves in one direction by default - forward - but the app watches for signs of weakness and will bring a fact back for review if needed.

---

### Starting out

A new student begins with the 2 times table. The current row starts with a small set of active facts and opens more facts in that row as the student shows readiness. Facts from later rows are shown as Not Started in the progress grid and do not appear in practice yet.

When a fact appears for the very first time, a **"New fact!"** label is shown. Very slow correct answers on new facts receive smaller confidence gains, but they are not treated the same as wrong answers. Wrong answers and timeouts still count as weak attempts.

---

### What happens during a round

Each round is timed. The default round length is 60 seconds. Pressing Start begins a short get-ready countdown before the first fact appears.

The student answers as many facts as they can before time runs out. The app chooses which fact to show next based on a weighted selection. Facts that are Not Started, Learning, Almost There, Needs Practice, overdue for review, or recently answered incorrectly are more likely to appear. Facts that are already Mastered and recently answered correctly are less likely to appear, giving room for weaker facts.

For each answer, the app records:

- Whether it was correct, wrong, or timed out
- How long it took, measured as response time in milliseconds
- How the response time compares with the current speed target and fluency timing
- The fact's recent attempts, confidence, and display status

**Wrong answers** reset the current streak and lower the fact's confidence score. If the student enters repeated wrong answers on the same fact, the app briefly shows a "Slow down! Read carefully." message and a hint such as "Think carefully: 8 x 7 = ?". In the current app settings, this hint flashes briefly and does not create a blocking 3-second input lockout.

**Timeouts** happen when there is no answer within 12 seconds. A timeout counts as a weak attempt. The correct answer is shown, and the student must type it before moving on. This turns a timeout into a small learning moment rather than just skipping past the fact.

---

### How a fact changes color

Each fact in the progress grid has one of six student-facing states:

| Color | State | What it means |
|---|---|---|
| Dark green | **Mastered** | Fast, accurate, and consistent. This fact counts fully toward mastery. |
| Dark green with a small yellow dot | **Review Soon** | Still counts as mastered, but the app has noticed a small weakness and will review it sooner. |
| Light green with a dashed border | **Almost There** | Nearly mastered. A few more good answers can turn it fully green. |
| Yellow | **Learning** | Started, but not yet fast or consistent enough. |
| Red / pink | **Needs Practice** | Recently missed, timed out, or repeatedly slow. |
| Grey | **Not Started** | Not started yet, not currently active, or not yet reached in practice. |

A fact usually moves from Not Started to Learning, then toward Almost There and Mastered as the student answers it correctly and quickly across multiple spaced attempts. A fact can also become Needs Practice after missed, timed-out, or repeatedly slow attempts.

No single good answer makes a fact Mastered. The app looks at a window of recent attempts to confirm that improvement is consistent.

---

### What "Mastered" actually requires

A fact reaches **Mastered** status only when all of the following are true across recent attempts:

- The fact has been shown at least 4 times.
- Confidence score is 85 or higher, out of 100.
- At least 3 of the last 4 attempts were correct.
- At least 1 of those attempts was answered within the fluent time threshold.
- At least 2 of those attempts were answered within 1.6x the fluent time threshold.
- The most recent attempt was not wrong and did not time out.
- There is no more than one weak attempt in the recent window.
- There is no more than one wrong answer or timeout in the recent window.

This means a student cannot luck into a green fact with one fast answer. The app waits for consistent performance across several spaced attempts before awarding mastery.

---

### Protecting mastered facts

Once a fact is Mastered, it is protected. One typo, one timeout, or one slightly slow answer will not immediately erase progress.

A mastered fact may first become Review Soon. Review Soon still counts as mastered, but it tells the app to bring the fact back sooner. The fact drops out of mastery only after repeated weakness or a large confidence drop.

This makes the system feel fair. A student who genuinely knows a fact will not lose their progress from a single bad moment.

---

### Opening more facts in the current row

The current times-table row does not necessarily show every fact from x2 through x12 right away. More facts open within the current row as the student shows readiness on the facts already active.

Readiness is based on repeated practice, accuracy, confidence, and response time. This keeps the app from overwhelming a student with too many new facts at once.

---

### Moving to the next table

A student graduates to the next table only after the current row has been fully opened and every fact in that row has been answered at least once.

A regular graduation happens when there are no Needs Practice facts in the current row and at least 9 of the 11 facts are Mastered or Review Soon.

A very strong round can also trigger graduation when the student has at least 10 attempts in the round, reaches at least 85% accuracy, meets or beats the speed target, has no Needs Practice facts, has at least 8 Mastered or Review Soon facts, and has at least 9 facts that are ready or nearly ready.

When the student graduates, a level-up message appears and confetti plays. Facts from previous tables are still reviewed occasionally so earlier learning is not forgotten.

---

### The mastery score

The mastery score is shown as a number out of 100. It reflects progress across all 121 multiplication facts from 2x2 through 12x12.

It is calculated mostly from grid progress:

- **Mastered** and **Review Soon** facts count fully toward the score.
- Started but not-yet-mastered facts count partially.
- Accuracy and speed from the completed round add a small progress-based bonus.

This means the score can move forward even while facts are still yellow or light green. The student does not have to wait for every fact to turn green before seeing improvement.

After each round, a one-sentence note explains why the score went up, held steady, or dipped - for example: *"Great round! Fast, accurate answers pushed your score up by 6 points."*

The progress graph shows the most recent 10 quiz results by default. The Show all results button changes the graph to all saved quiz results. The scorecard above the graph shows the current mastery score plus the average facts/min and accuracy for whichever results are currently visible.

---

### Daily practice goal

The app tracks how many rounds a student completes each day. The daily goal is **5 rounds**. The practice header shows "Today: X of 5" and turns green when the goal is reached. Five rounds takes roughly 5 minutes and is enough to meaningfully move facts forward.

---

### The full journey

| Stage | What the student experiences |
|---|---|
| First session | New facts are introduced gradually. "New fact!" appears the first time a fact is shown. |
| Early practice | Facts appear often. Correct answers raise confidence. Wrong answers or timeouts bring facts back quickly. |
| Building fluency | Facts start turning yellow, then light green as confidence and speed improve. |
| Mastery | Facts turn dark green. Some may show as Review Soon when they need a little extra review. |
| Graduation | Enough row progress triggers a move to the next times table, with a level-up message and confetti. |
| Long-term | All facts from 2x2 to 12x12 are worked through. The mastery score climbs toward 100. |
