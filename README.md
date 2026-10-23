# Follow-Through

**Turn the promises you make in conversation into a private, actionable plan.**

Built for the Amazon Developer Hackathon 2026.

Most commitments are made in passing: "I'll send it tomorrow", "remind me to call Meera on Monday". They never reach a to-do list, so they slip. Follow-Through finds them for you.

**Live demo:** [add your Render URL here]
**Demo video:** [add your video link here]

<!-- Add 2-3 screenshots here: Capture, Dashboard, History -->

## Features

- **Capture:** paste a conversation and get each follow-up with its task, due date, person, priority and the exact source sentence.
- **Dashboard:** tasks grouped into Overdue, Today, Tomorrow, This week, Later, No date and Done. Filter by person, Quick add, priority matrix, export a summary.
- **Read my day:** a spoken briefing of what is overdue or due soon, with play, pause and stop controls.
- **History:** completion rate, past conversations, and open follow-ups by person.
- **Accounts:** email and password login. Passwords are stored as salted hashes, and each user's task data is kept separate.
- **Resilient by design:** works offline with a rules extractor, and uses Amazon Bedrock when configured. If the AI call fails, it falls back automatically.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask, Gunicorn |
| Frontend | HTML, CSS, vanilla JavaScript |
| AI (optional) | Amazon Bedrock (Converse API via boto3) |
| Data (optional) | Supabase (accounts and conversation archive), SQLite fallback for accounts |
| Hosting | Render |

## Run locally

```bash
git clone https://github.com/<your-username>/ADH_Follow-through.git
cd follow-through
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                # then set FLASK_SECRET_KEY
python app.py                                       # http://127.0.0.1:3000
```

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

With no other settings, everything works offline: accounts are stored in a local SQLite file and follow-ups come from the rules extractor.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `FLASK_SECRET_KEY` | Yes (production) | Signs login sessions |
| `SUPABASE_URL`, `SUPABASE_KEY` | No | Store accounts and archive captures. Run `schema.sql` first. Use the service_role key, server-side only |
| `BEDROCK_MODEL_ID`, `AWS_REGION` | No | Enable AI extraction. Enable the model in the Bedrock console and provide AWS credentials |
| `PORT` | No | Local port (default 3000) |

## How it works

1. The user pastes a conversation on the Capture page.
2. `POST /api/analyze` runs the extractor: Bedrock if configured, otherwise the rules engine.
3. Results come back with the source sentence for each task and are saved to the user's account-scoped browser storage.
4. The Dashboard and History pages read that data. If Supabase is configured, each capture is also archived with the user id.

## Project structure

```
app.py            Flask app: auth, extractors, routes
templates/        Shared layout, four pages, login/register, results partial
static/           app.js (dashboard, voice, storage) and style.css
schema.sql        Supabase tables
.env.example      Configuration template
```

## Deploy on Render

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Set `FLASK_SECRET_KEY` and the Supabase variables. Without Supabase, accounts are lost on every redeploy.

## Known limitations

- Task data lives in each user's browser, so it does not sync across devices. Supabase only archives captures.
- No password reset or login rate limiting yet.
- The rules extractor handles common phrasing like "I'll", "remind me to" and "don't forget"; Bedrock handles subtler language.

## Roadmap

- Sync tasks across devices through Supabase
- Live conversation sources such as voice or wearable transcripts
- Reminders and calendar integration
- Password reset and rate limiting

## License

MIT
