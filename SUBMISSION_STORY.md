## Inspiration

Most productivity tools begin after a task has already been created. Follow-Through starts earlier, at the moment someone says, “I’ll send it tomorrow,” “remind me to call Meera,” or “don’t forget the domain.” Those small commitments are easy to lose because they are buried inside ordinary conversations.

We wanted to build a calmer way to preserve that context. Instead of asking people to reconstruct a task from memory, Follow-Through turns the sentence itself into the starting point for action.

The Alexa+ simulated-experience track was a natural fit because the product is built around conversational interaction. The goal is not just to show a task list, but to let people ask for their next action, add a commitment, or close a loop in natural language.

## What it does

Follow-Through helps people capture and complete the promises hidden inside conversations.

A user can create an account, paste a conversation, and receive follow-ups with a task title, due timing, person, priority, and original source sentence. The Dashboard groups commitments by urgency and includes Quick Add, person filters, a priority matrix, completion feedback, and exportable summary cards.

The Alexa+ Simulator provides a web-based assistant experience. Users can type or speak commands such as:

- “What’s due today?”
- “What should I do next?”
- “Add: call Meera on Monday.”
- “Mark the budget done.”
- “Read my open loops.”

The simulator reads the signed-in user’s task context, updates tasks, and speaks responses using browser speech APIs. Completing a task moves it to Done and shows the message, “Closed loop. Nice work.”

## How we built it

Follow-Through is a Flask application with a vanilla HTML, CSS, and JavaScript frontend.

The Flask backend handles email/password registration, login sessions, protected routes, the conversation-analysis endpoint, and optional Supabase archiving. User passwords are stored as salted hashes. The browser stores each signed-in user’s task and conversation state in a user-scoped localStorage namespace, keeping the demo responsive and private.

The extraction layer is an offline rules engine. It recognizes common commitment language such as “I’ll,” “I will,” “remind me to,” “don’t forget,” “make sure,” and “can you.” Results are returned as an HTML fragment with the source sentence preserved.

The Alexa+ Simulator is implemented in `static/alexa.js`. It parses a focused set of natural-language commands, reads the same task store used by the Dashboard, adds and completes tasks, and uses SpeechSynthesis for spoken responses. Where supported, browser SpeechRecognition provides voice input.

The project is designed to deploy on Render with Gunicorn and can use Supabase for accounts and conversation archives. The simulator itself does not require hardware, AI credentials, or personal data.

## Challenges we ran into

The first challenge was extracting useful tasks without losing the human context around them. A short task title is useful for action, but the original sentence is what explains why the task exists. We solved this by storing both the normalized task and its exact source sentence.

The second challenge was keeping the product conversational without making it feel like a generic chatbot. The Alexa+ Simulator only performs actions that are grounded in the user’s real task context. Every response either reports a task, creates a task, or updates a task.

We also had to make account state, browser state, and optional Supabase archives work together without mixing users. The final design separates authentication from the local task experience and scopes browser storage to the signed-in user.

Finally, browser voice capabilities vary by browser and permission settings. We made text commands the reliable fallback while keeping speech input and spoken responses as progressive enhancements.

## Accomplishments that we're proud of

We are proud that Follow-Through is a complete working product rather than only a concept. It includes account access, conversation capture, extraction, task grouping, completion state, voice interaction, export, history, and an Alexa+ simulation in one coherent flow.

We are especially proud of the provenance-first task cards. Each follow-up keeps the sentence it came from, which makes the system easier to trust and easier to review.

We also built the Alexa+ experience without requiring a physical device or private account integration. A judge can open the simulator, type or speak a command, see the task context update, and hear the response immediately.

The interface was deliberately designed as a dark editorial command center with expressive motion, restrained sound cues, confetti on completion, responsive layouts, and clear empty states instead of generic dashboard panels.

## What we learned

We learned that conversational productivity is not only about recognizing intent. It is also about preserving enough context for the user to trust the result.

We learned that a simulated assistant experience can be compelling when it has a real, visible state behind it. The commands feel useful because they operate on the same commitments that appear in Capture, Dashboard, and History.

We also learned to design for graceful degradation. Offline extraction, text input, local browser storage, and SQLite fallback keep the product usable even when optional services are unavailable. Supabase can still provide a persistent archive when configured.

Most importantly, we learned that a good assistant should help close the loop, not simply generate more text.

## What's next for Follow Through

Next, we would add a standards-based Alexa+ integration through an Agent Skill or self-hosted MCP server, allowing the same task actions to work beyond the simulated web experience.

We would also add cross-device task synchronization, calendar and reminder integrations, password reset and rate limiting, richer voice turn-taking, and more robust natural-language parsing for ambiguous dates and multi-step commitments.

The long-term vision is a personal follow-through layer that can receive context from conversations, wearable inputs, or assistant interactions and turn it into small, clear actions without losing the human sentence that started it.
