# Follow-Through

**Turn the promises you make in conversation into a private, actionable plan.**

Built for the Amazon Developer Hackathon 2026 — **Alexa+ simulated experience track**.

Most commitments are made in passing: “I’ll send it tomorrow”, “remind me to call Meera on Monday”. They never reach a to-do list, so they slip. Follow-Through finds them, keeps the source sentence, and gives an assistant a useful task context.

**Live demo:** https://adh-followthrough.onrender.com
<<<<<<< HEAD
**Demo video:** [add your public video link here]
=======
**Demo video:** [add your video link here]
>>>>>>> ca57a5f9ef378ba1545ee40866bc94b78d8f7001

## Track fit

Follow-Through includes a web-based Alexa+ simulation. A judge can type or speak commands such as:

- “What’s due today?”
- “What should I do next?”
- “Add: call Meera on Monday”
- “Mark the budget done”
- “Read my open loops”

The simulator reads the signed-in user’s real browser task context, updates tasks, and speaks responses with the browser speech APIs. It is intentionally a simulated Alexa+ experience and does not claim to use Alexa hardware, an Alexa account, or a live MCP server.

## Features

- **Capture:** paste a conversation and get each follow-up with its task, due date, person, priority and exact source sentence.
- **Alexa+ Simulator:** typed and browser voice commands for reading, adding and completing tasks.
- **Dashboard:** tasks grouped into Overdue, Today, Tomorrow, This week, Later, No date and Done. Filter by person, use Quick add, inspect the priority matrix, and export a summary.
- **Read my day:** a spoken briefing of what is overdue or due soon, with play, pause and stop controls.
- **History:** completion rate, past conversations, and open follow-ups by person.
- **Accounts:** email and password login. Passwords are stored as salted hashes, and each user’s task data is kept separate.
- **Offline-first:** the rules extractor and Alexa+ simulator work without AI credentials or device hardware.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask, Gunicorn |
| Frontend | HTML, CSS, vanilla JavaScript |
| Alexa+ simulation | Browser speech recognition and speech synthesis |
| Data | Supabase archive optional; SQLite fallback for accounts; user-scoped browser storage for tasks |
| Hosting | Render-compatible |

## Run locally

```bash
git clone https://github.com/<your-username>/ADH_Follow-through.git
cd follow-through
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
cp .env.example .env                                # then set FLASK_SECRET_KEY
python app.py                                       # http://127.0.0.1:3000
```

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

With no other settings, accounts are stored in local SQLite and follow-ups come from the deterministic rules extractor.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `FLASK_SECRET_KEY` | Yes in production | Signs login sessions |
| `SUPABASE_URL`, `SUPABASE_KEY` | No | Store accounts and archive captures. Run `schema.sql` first. |
| `PORT` | No | Local port, default `3000` |

## How it works

1. The user registers or logs in.
2. The user pastes a conversation on Capture.
3. `POST /api/analyze` runs the offline rules extractor and returns an HTML result fragment.
4. Results come back with the source sentence for each task and are saved to the signed-in user’s browser storage.
5. The Dashboard, History, and Alexa+ Simulator read that task context.
6. If Supabase is configured, each capture is also archived with the user id.

## Project structure

```
app.py                  Flask auth, rules extractor, and routes
templates/              Shared shell, auth, four product pages, Alexa+ page
static/app.js           Local task storage, dashboard, voice reader, export, motion
static/alexa.js         Alexa+ command parsing, speech input/output, task actions
static/style.css        Dark editorial design system and simulator styles
schema.sql              Optional Supabase tables
.env.example            Runtime configuration template
```

## Deploy on Render

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Set `FLASK_SECRET_KEY` and optional Supabase variables. Without Supabase, accounts reset on redeploy.

## Known limitations

- Task data lives in each user’s browser, so it does not sync across devices. Supabase archives captures but does not yet sync task state.
- Browser speech recognition depends on browser support and permission.
- No password reset or login rate limiting yet.
- The rules extractor handles common commitment phrasing such as “I’ll”, “remind me to”, and “don’t forget”.

## License

MIT
