import ast
import datetime as dt
import functools
import json
import logging
import os
import re
import sqlite3
import uuid
from contextlib import closing

from dotenv import load_dotenv
from flask import Flask, g, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()
app = Flask(__name__)
DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

# ---------- Sessions (simple email + password login) ----------
_secret = os.getenv("FLASK_SECRET_KEY")
if not _secret:
    logging.warning("FLASK_SECRET_KEY is not set. Using an insecure development key. Set it before deploying.")
app.config.update(
    SECRET_KEY=_secret or "dev-only-insecure-key",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=bool(os.getenv("RENDER")) or os.getenv("COOKIE_SECURE") == "1",
    PERMANENT_SESSION_LIFETIME=dt.timedelta(days=30),
    MAX_CONTENT_LENGTH=256 * 1024,
)

# ---------- Storage: Supabase if configured, otherwise local SQLite for accounts ----------
sb = None
if os.getenv("SUPABASE_URL") and os.getenv("SUPABASE_KEY"):
    try:
        from supabase import create_client
        sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    except Exception as error:
        logging.warning("Supabase disabled: %s", error)

USERS_DB = os.getenv("USERS_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.db"))


def sqlite_conn():
    conn = sqlite3.connect(USERS_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("create table if not exists users (id integer primary key autoincrement, email text unique not null, name text not null default '', password_hash text not null, created_at text default current_timestamp)")
    return conn


def find_user(email):
    if sb:
        rows = sb.table("users").select("*").eq("email", email).limit(1).execute().data
        return rows[0] if rows else None
    with closing(sqlite_conn()) as conn:
        row = conn.execute("select * from users where email = ?", (email,)).fetchone()
        return dict(row) if row else None


def create_user(email, name, password_hash):
    if sb:
        return sb.table("users").insert({"email": email, "name": name, "password_hash": password_hash}).execute().data[0]
    with closing(sqlite_conn()) as conn:
        cursor = conn.execute("insert into users (email, name, password_hash) values (?, ?, ?)", (email, name, password_hash))
        conn.commit()
        return {"id": cursor.lastrowid, "email": email, "name": name}


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PROTECTED = ("/capture", "/dashboard", "/history", "/api/")


def safe_next(target):
    """Only allow redirects to paths on this site."""
    if target and target.startswith("/") and not target.startswith("//") and "\\" not in target:
        return target
    return None


def start_session(user):
    session.clear()
    session.permanent = True
    session.update(uid=str(user["id"]), name=user.get("name") or "", email=user.get("email") or "")


@app.before_request
def load_user():
    g.user = {"id": session["uid"], "name": session.get("name", ""), "email": session.get("email", "")} if "uid" in session else None


@app.after_request
def no_store_for_private_pages(response):
    if request.path.startswith(PROTECTED):
        response.headers["Cache-Control"] = "no-store"  # back button after logout must not show private pages
    return response


def login_required(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not g.user:
            if request.path.startswith("/api/"):
                return '<p class="empty-state">Your session has ended. Please log in again.</p>', 401
            return redirect(url_for("login", next=request.path))
        return view(*args, **kwargs)
    return wrapped


@app.route("/login", methods=["GET", "POST"])
def login():
    if g.user:
        return redirect(url_for("dashboard"))
    if request.method == "GET":
        return render_template("auth.html", mode="login", next=safe_next(request.args.get("next")) or "")
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    nxt = safe_next(request.form.get("next")) or ""
    try:
        user = find_user(email) if email else None
    except Exception as error:
        app.logger.error("Login lookup failed: %s", error)
        return render_template("auth.html", mode="login", next=nxt, email=email, error="We could not reach the account database. Please try again."), 503
    if user and check_password_hash(user["password_hash"], password):
        start_session(user)
        return redirect(nxt or url_for("dashboard"))
    return render_template("auth.html", mode="login", next=nxt, email=email, error="Incorrect email or password."), 401


@app.route("/register", methods=["GET", "POST"])
def register():
    if g.user:
        return redirect(url_for("dashboard"))
    if request.method == "GET":
        return render_template("auth.html", mode="register", next=safe_next(request.args.get("next")) or "")
    name = request.form.get("name", "").strip()[:60]
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    nxt = safe_next(request.form.get("next")) or ""

    def fail(message, status=400):
        return render_template("auth.html", mode="register", next=nxt, email=email, name=name, error=message), status

    if not EMAIL_RE.match(email) or len(email) > 254:
        return fail("Enter a valid email address.")
    if len(password) < 8:
        return fail("Use a password with at least 8 characters.")
    if len(password) > 200:
        return fail("That password is too long.")
    try:
        if find_user(email):
            return fail("An account with this email already exists. Try logging in.", 409)
        user = create_user(email, name or email.split("@")[0], generate_password_hash(password))
    except Exception as error:
        app.logger.error("Registration failed: %s", error)
        return fail("We could not create your account right now. Please try again.", 503)
    start_session(user)
    return redirect(nxt or url_for("dashboard"))


@app.post("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# ---------- Date helpers ----------
def to_date(label):
    label = (label or "").lower()
    today = dt.date.today()
    if re.search(r"today|tonight", label): return today.isoformat()
    if "tomorrow" in label: return (today + dt.timedelta(days=1)).isoformat()
    if "next week" in label: return (today + dt.timedelta(days=7)).isoformat()
    if "this week" in label: return (today + dt.timedelta(days=5)).isoformat()
    if "weekend" in label: label = "saturday"
    for index, day in enumerate(DAYS):
        if day in label: return (today + dt.timedelta(days=(index - today.weekday()) % 7 or 7)).isoformat()
    return ""


# ---------- Extractor 1: Amazon Bedrock ----------
def extract_bedrock(text):
    import boto3
    client = boto3.client("bedrock-runtime", region_name=os.getenv("AWS_REGION", "us-east-1"))
    prompt = f"""Today is {dt.date.today():%A %d %B %Y}. Read the conversation and list every action item the person called Me now has to do.
Return ONLY a JSON array. Each item has: "title" (short, starts with a verb), "due" (Today, Tomorrow, a weekday name, This week, Next week, or No date), "who" (person involved or an empty string), "priority" (high if due today/tomorrow/urgent, else normal), and "source" (the exact sentence).

Conversation:
{text}"""
    response = client.converse(modelId=os.environ["BEDROCK_MODEL_ID"], messages=[{"role": "user", "content": [{"text": prompt}]}], inferenceConfig={"maxTokens": 1500, "temperature": 0})
    output = response["output"]["message"]["content"][0]["text"]
    output = output[output.find("["): output.rfind("]") + 1]
    try:
        parsed = json.loads(output)
    except ValueError:  # model answered with a Python-style list instead of JSON
        output = re.sub(r"\btrue\b", "True", output, flags=re.I)
        output = re.sub(r"\bfalse\b", "False", output, flags=re.I)
        output = re.sub(r"\bnull\b", "None", output, flags=re.I)
        parsed = ast.literal_eval(output)
    return [item for item in parsed if isinstance(item, dict)] if isinstance(parsed, list) else []


# ---------- Extractor 2: simple rules (offline fallback) ----------
RULES = [re.compile(pattern, re.I) for pattern in [r"\bi['’]ll\b", r"\bi will\b", r"\bi (also )?need to\b", r"\bremind me\b", r"\bdon['’]?t forget\b", r"\b(can|could) you\b", r"\bmake sure\b", r"\blet['’]s\b", r"\bwe (should|need to)\b"]]
STRIP = [r"^(sure|okay|ok|yes|yeah|right|great|also|and|oh)[,!. ]+", r"^(can|could) you( please)?\s*", r"^(i['’]ll|i will|let me)\s*", r"^i (also )?(need|have|got) to\s*", r"^(please )?remind me to\s*", r"^don['’]?t forget to\s*", r"^we (should|need to)\s*", r"^make sure (to |that )?", r"^let['’]s\s*", r"^also\s+"]


def clean(sentence):
    for pattern in STRIP: sentence = re.sub(pattern, "", sentence, flags=re.I)
    sentence = sentence.strip(" ?.! ")
    return sentence[:1].upper() + sentence[1:]


def due_of(sentence):
    lower = sentence.lower()
    if "today" in lower or "tonight" in lower: return "Today"
    if "tomorrow" in lower: return "Tomorrow"
    for day in DAYS:
        if day in lower: return day.capitalize()
    for label in ("weekend", "this week", "next week"):
        if label in lower: return label.capitalize()
    return "No date"


def who_of(sentence):
    match = re.search(r"\b(?:to|with|call|email|ask|tell|for|text|meet|about)\s+((?:Professor |Dr\.? )?[A-Z][a-z]{2,})", sentence)
    blocked = {day.capitalize() for day in DAYS} | {"Diwali"}
    return match.group(1) if match and match.group(1) not in blocked else ""


def extract_rules(text):
    found = []
    for line in filter(str.strip, text.splitlines()):
        speaker = re.match(r"^([A-Za-z ]{1,20}):\s*(.*)$", line)
        for sentence in re.findall(r"[^.!?]+[.!?]*", speaker.group(2) if speaker else line):
            sentence = sentence.strip()
            if sentence and any(rule.search(sentence) for rule in RULES) and not re.match(r"did you\b", sentence, re.I):
                due = due_of(sentence)
                found.append({"title": clean(sentence), "due": due, "who": who_of(sentence), "source": sentence, "priority": "high" if due in ("Today", "Tomorrow") else "normal"})
    return found


def text_of(value, limit):
    return ("" if value is None else str(value)).strip()[:limit]


def normalize_tasks(found):
    rows = []
    for task in found:
        title = text_of(task.get("title"), 200)
        if not title: continue
        due = text_of(task.get("due"), 40) or "No date"
        rows.append({"title": title, "due": due, "due_date": text_of(task.get("due_date"), 10) or to_date(due), "who": text_of(task.get("who"), 80),
                     "priority": "high" if text_of(task.get("priority"), 10).lower() == "high" else "normal",
                     "source": text_of(task.get("source"), 300), "server_id": uuid.uuid4().hex[:10]})
    return rows


def archive_capture(text, engine, tasks):
    if not sb: return
    try:
        user_id = g.user["id"]
        conversation = sb.table("conversations").insert({"user_id": user_id, "text": text, "engine": engine}).execute().data[0]
        if tasks:
            sb.table("tasks").insert([{**task, "user_id": user_id, "conversation_id": conversation["id"], "done": False, "due_date": task["due_date"] or None} for task in tasks]).execute()
    except Exception as error:
        app.logger.warning("Supabase archive skipped: %s", error)


# ---------- Pages ----------
@app.get("/")
def index(): return render_template("index.html")

@app.get("/capture")
@login_required
def capture(): return render_template("capture.html")

@app.get("/dashboard")
@login_required
def dashboard(): return render_template("dashboard.html")

@app.get("/history")
@login_required
def history(): return render_template("history.html")


@app.post("/api/analyze")
@login_required
def analyze():
    text = request.form.get("text", "").strip()[:20000]
    if not text: return '<p class="empty-state">Paste a conversation first.</p>', 400
    engine = "rules"
    try:
        if os.getenv("BEDROCK_MODEL_ID"):
            found, engine = extract_bedrock(text), "bedrock"
        else:
            found = extract_rules(text)
    except Exception as error:
        app.logger.warning("Bedrock failed, using rules: %s", error)
        found, engine = extract_rules(text), "rules"
    tasks = normalize_tasks(found)
    archive_capture(text, engine, tasks)
    return render_template("partials/task_results.html", tasks=tasks, engine=engine)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "3000")), debug=os.getenv("FLASK_DEBUG", "0") == "1")
