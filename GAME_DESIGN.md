# Catfished - Game Design Document

## Overview

**Catfished** is a web-based multiplayer party game inspired by Gartic Phone and dating apps. Players create absurd dating profiles for assigned personas, vote on them Tinder-style, and pick their favorites. Everything runs in the browser — no Unity host, no TV screen required.

**Stack:** Next.js 15 + React 19 + TypeScript + Tailwind CSS v4 + Firebase (Firestore, Storage, Auth)
**Hosting:** Vercel
**Target:** Mobile-first (phones), desktop-friendly

---

## Philosophy

- **Web-first.** Every player uses their own device. No shared screen or host app needed.
- **Gartic Phone-style flow.** All game phases happen on each player's screen simultaneously. The game orchestrates itself through Firestore state.
- **Meme energy.** The game should feel chaotic, funny, and shareable. The UI is bold neo-brutalist with thick borders, colored shadows, and punchy colors.
- **Low friction.** Join with a code and a name. No accounts required (anonymous auth). Future: optional accounts for pro features.

---

## Architecture

### Previous (Deprecated)

```
Unity Host (TV) ←→ Firebase ←→ Web App (Phone Controller)
```

Unity controlled all game state transitions, prompt shuffling, scoring, and the presentation screen. The web app was a passive controller.

### Current

```
Web App (All Players) ←→ Firebase (State + Storage)
```

The web app handles everything:
- Room creation and joining
- Game state machine (the host player advances phases)
- Prompt shuffling and assignment
- Drawing, profile creation, presentation, voting, scoring
- Results and scoreboard

Firebase remains the backend:
- **Firestore** — real-time game state, player data, profiles, votes
- **Firebase Storage** — drawing uploads (JPEG, 80% quality)
- **Firebase Auth** — anonymous auth for now, upgradeable to real accounts later

---

## Game Flow

```
Create/Join → Lobby → Prompt Submission → Drawing & Profile → Presentation → Voting → Favorite Pick → Results
```

### 1. Create or Join Room

- **Host** creates a room and gets a 4-character code
- **Players** enter the code + their name to join
- Session persists in localStorage for refresh recovery

**Existing UI:** Lime-green background, white card with thick black borders, neo-brutalist style. "Enter Code from TV" subtitle needs updating to just "Enter Game Code."

### 2. Lobby

- Shows all connected players in a colored card grid
- Host has a gold badge and a "Start Game" button
- Other players see "Waiting for [host]..."
- Players can leave; host transfer if host disconnects

**Existing UI:** Room code displayed large, 2-column player grid with slight card rotation.

### 3. Prompt Submission (Pre-Profile)

- Each player submits two fields: **"Who?"** (a person/character) and **"Doing What?"** (an activity/quirk)
- Examples: "Shrek / Running for president", "Your dentist / At a rave"
- Timer countdown visible on screen (60 seconds)
- After submitting, shows waiting screen

**Existing UI:** Built, needs timer display added.

### 4. Prompt Assignment

- The game collects all submissions and shuffles them
- Each player receives someone else's prompt
- **This logic moves from Unity to the web app** — the host's client (or a Firestore cloud function) performs the shuffle and writes assignments

### 5. Drawing & Profile Creation

- Player sees their assigned prompt: "Draw: [Person] [Doing What]"
- Full drawing canvas: brush, pen, eraser, 9 colors, undo, touch support
- After drawing, fill in a dating profile: **Name** and **Bio**
- Drawing uploads to Firebase Storage, URL stored in Firestore
- After submitting, waiting screen until all players are done

**Existing UI:** Fully built and polished. Canvas works well on mobile.

### 6. Presentation (NEW — replaces Unity TV screen)

- Each profile is shown one at a time **on every player's screen**
- Shows: drawn portrait, profile name, bio, and who submitted the original prompt
- Auto-advances on a timer (e.g. 8-10 seconds per profile) or host advances manually
- While viewing, players can vote Like or Nope
- If it's your own profile being shown, you see a special "It's Your Turn!" screen
- Progress indicator: "2 / 6"

**Design direction:** Full-screen dating profile card. The drawn image takes up the top half, name and bio below. Like/Nope buttons at the bottom (already built). Keep the neo-brutalist card style with thick borders and colored shadows.

### 7. Favorite Pick

- After all profiles are shown, gallery view of all profiles (excluding your own)
- Pick your one overall favorite
- Already built with clickable profile cards in a grid

**Existing UI:** Built. Grid of profile cards with hover effects.

### 8. Results & Scoreboard (NEW — replaces Unity results)

- Full scoreboard showing all players ranked by score
- Each player's profile card shown with their score breakdown
- Highlight mutual matches with a special animation/callout
- "Play Again" button to return to lobby with the same room

---

## Scoring System

| Action | Points |
|--------|--------|
| Each Like received | +5 |
| Picked as someone's favorite (one-sided) | +10 |
| Mutual favorite match (both picked each other) | +25 + 10 bonus for each |

**Example:**
```
Sarah:
  3 likes x 5 = 15
  Mutual match with John = 25 + 10 = 35
  Total: 50 points

John:
  2 likes x 5 = 10
  Mutual match with Sarah = 25 + 10 = 35
  Total: 45 points

Mike:
  4 likes x 5 = 20
  Picked as favorite by Sarah (one-sided) = 10
  Total: 30 points
```

Scoring is calculated client-side by the host or by reading all profile data from Firestore once the favorite pick phase ends.

---

## Firestore Data Model

```
rooms/{roomCode}
├── host: string                          # Player name of room host
├── gameState: string                     # Current phase
├── players: [{name, score}]              # Player list
├── showcaseIndex: number                 # Which profile is being presented
├── roundEndTime: timestamp               # Timer for timed phases
├── createdAt: timestamp
│
├── submissions/{playerName}              # Prompt submissions
│   ├── persona: string                   # "Shrek"
│   ├── quirk: string                     # "Running for president"
│   └── submittedAt: timestamp
│
├── assignments/{playerName}              # Shuffled prompt assignments
│   ├── assignedPersona: string
│   └── assignedQuirk: string
│
├── profiles/{playerName}                 # Completed dating profiles
│   ├── name: string                      # Profile display name
│   ├── bio: string                       # Profile bio
│   ├── imageUrl: string                  # Firebase Storage URL
│   ├── persona: string                   # Original prompt person
│   ├── quirk: string                     # Original prompt activity
│   ├── likes: string[]                   # Players who liked this profile
│   ├── favoritePick: string              # Who this player picked as favorite
│   └── submittedAt: timestamp
│
└── drawings/{playerName}                 # Drawing metadata
    ├── url: string                       # Firebase Storage download URL
    ├── playerName: string
    └── uploadedAt: timestamp
```

### Game States

```
"lobby" → "pre-profile" → "profile" → "presentation" → "voting" → "favorite" → "results"
```

Note: "presentation" and "voting" may be combined into a single phase where players see the profile AND vote simultaneously (like the current implementation).

---

## What Needs To Be Built

### New Features (previously handled by Unity)

1. **Room Creation** — "Create Game" button on join screen, generates a 4-letter code, writes room doc to Firestore
2. **Game State Machine** — Host client advances game phases by updating `gameState` in Firestore. All other clients react via `onSnapshot`
3. **Prompt Shuffling** — After all submissions are in, shuffle and assign prompts so no one gets their own. Write to `assignments/` subcollection
4. **Presentation Screen** — Full-screen profile card view on each player's device with auto-advance or host-controlled advance
5. **Scoreboard / Results Screen** — Read all profiles, calculate scores, display ranked leaderboard with match callouts
6. **Timers** — Visual countdown for timed phases (prompt submission, drawing, voting)
7. **Play Again Flow** — Reset room state, keep players, return to lobby

### Modifications to Existing Code

- **JoinPage** — Add "Create Game" option alongside "Join Game." Update subtitle from "Enter Code from TV" to "Enter Game Code"
- **VotingPage / Presentation** — Show the actual profile content (drawing, name, bio) on each player's screen instead of just vote buttons. Previously profile content only showed on the Unity TV
- **Results Phase** — Replace the placeholder trophy screen with a real scoreboard
- **page.tsx** — Move game orchestration logic (state transitions, shuffling) into the host's client. Add room creation flow
- **PreProfilePage** — Add visible countdown timer

### Cleanup

- Remove references to Unity throughout code comments and docs
- Delete old markdown docs (IMPLEMENTATION_SUMMARY.md, FIREBASE_STORAGE_SETUP.md, SHOWCASE_IMPLEMENTATION.md, COMPLETE_STORAGE_IMPLEMENTATION.md) — replaced by this document
- Remove unused `ui/` components (Button, Card, Input, Textarea, ErrorMessage, PageContainer) or repurpose them

---

## Design System

**Current aesthetic: Neo-brutalist**

- **Backgrounds:** Lime-green (`bg-lime-300`), occasionally pink/cyan accents
- **Cards:** White with thick black borders (`border-4 border-slate-900`), rounded corners (`rounded-2xl`)
- **Shadows:** Colored offset shadows (`shadow-[8px_8px_0px_#ec4899]`, `shadow-[4px_4px_0px_#1e293b]`)
- **Typography:** Bebas Neue for headings (big, uppercase, bold), Inter for body text
- **Buttons:** Bold, uppercase, thick borders, offset shadows that collapse on click (`active:shadow-none active:translate-x-1 active:translate-y-1`)
- **Cards:** Slight rotation for personality (`transform -rotate-2`)
- **Colors:** Lime green, cyan, purple, pink, red, green — bold and playful
- **Mobile-first:** Everything works on phone screens

This design system should be maintained across all new screens.

---

## Future Ideas

- **User accounts** — Firebase Auth upgrade from anonymous to Google/email sign-in
- **Pro features** — Custom drawing tools, special profile frames, room customization
- **Game history** — Save past games and profiles to user accounts
- **Spectator mode** — Watch a game without playing
- **Custom prompts** — Pre-made prompt packs or categories
- **Shareable results** — Export a results card as an image for social media
- **Sound effects** — Audio feedback for likes, matches, reveals
