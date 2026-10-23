(() => {
  const input = document.querySelector('#alexa-input');
  const form = document.querySelector('#alexa-form');
  const thread = document.querySelector('#alexa-thread');
  const taskList = document.querySelector('#alexa-task-list');
  const count = document.querySelector('#alexa-task-count');
  const status = document.querySelector('#alexa-status');
  const mic = document.querySelector('#alexa-mic');
  if (!input || !form || !thread) return;

  const clean = value => String(value || '').replace(/[?!.]+$/, '').trim();
  const openTasks = () => tasks().filter(task => !isDone(task));
  const titleMatch = phrase => {
    const needle = clean(phrase).toLowerCase();
    return tasks().find(task => task.title.toLowerCase().includes(needle) || needle.includes(task.title.toLowerCase().slice(0, 18)));
  };
  const dueFor = value => {
    const lower = value.toLowerCase();
    if (lower.includes('today')) return ['Today', dateISO(0)];
    if (lower.includes('tomorrow')) return ['Tomorrow', dateISO(1)];
    const day = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].find(name => lower.includes(name));
    return day ? [day[0].toUpperCase() + day.slice(1), dateISO((7 + ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(day) - new Date().getDay()) % 7 || 7)] : ['No date', ''];
  };
  const say = text => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = .96;
    window.speechSynthesis.speak(utterance);
  };
  const addMessage = (text, kind) => {
    const item = document.createElement('div');
    item.className = `alexa-message alexa-${kind}`;
    item.innerHTML = `<span class="message-mark">${kind === 'user' ? '↗' : '✦'}</span><div><strong>${kind === 'user' ? 'You' : 'Alexa+ simulator'}</strong><p>${escapeHTML(text)}</p></div>`;
    thread.appendChild(item);
    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const renderTasks = () => {
    const all = openTasks();
    count.textContent = String(all.length).padStart(2, '0');
    taskList.innerHTML = all.slice(0, 5).map(task => `<div class="alexa-task"><span class="status-dot"></span><div><strong>${escapeHTML(task.title)}</strong><small>${escapeHTML(task.due || 'No date')}${task.who ? ` · ${escapeHTML(task.who)}` : ''}</small></div></div>`).join('') || '<p class="muted small-copy">No open loops. You’re clear.</p>';
  };
  const respond = command => {
    const lower = command.toLowerCase();
    let response = '';
    if (lower.includes('due today') || lower.includes('today')) {
      const list = openTasks().filter(task => bucket(task) === 'Today');
      response = list.length ? `You have ${list.length} task${list.length === 1 ? '' : 's'} due today: ${list.map(task => task.title).join('; ')}.` : 'You have nothing due today. Your runway is clear.';
    } else if (lower.includes('what should') || lower.includes('next') || lower.includes('priority')) {
      const list = openTasks().sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));
      response = list.length ? `Start with ${list[0].title}${list[0].who ? ` for ${list[0].who}` : ''}. It is your next highest-signal follow-up.` : 'You have no open follow-ups right now.';
    } else if (lower.startsWith('add:') || lower.startsWith('add ')) {
      const raw = clean(command.replace(/^add:?\s*/i, ''));
      const [due, dueDate] = dueFor(raw);
      const task = { id: `task-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, title: raw.replace(/\b(today|tomorrow|on monday|on tuesday|on wednesday|on thursday|on friday|on saturday|on sunday)\b/ig, '').trim() || raw, due, due_date: dueDate, who: '', priority: /today|tomorrow|urgent/i.test(raw) ? 'high' : 'normal', source: 'Added through Alexa+ simulator.', done: '0' };
      saveTask(task); renderTasks(); if (typeof dashboardRefresh === 'function') dashboardRefresh(); response = `Done. I added “${task.title}” for ${due === 'No date' ? 'no specific date' : due}.`;
    } else if (lower.includes('mark') && (lower.includes('done') || lower.includes('complete'))) {
      const phrase = command.replace(/mark|done|complete|the/ig, '').trim();
      const task = titleMatch(phrase);
      if (task) { task.done = '1'; saveTask(task); renderTasks(); if (typeof dashboardRefresh === 'function') dashboardRefresh(); confetti(); soundCue(); showToast('Closed loop. Nice work.'); response = `Closed loop. Nice work. I marked “${task.title}” done.`; }
      else response = 'I could not find that follow-up. Try saying more of the task title.';
    } else if (lower.includes('read') || lower.includes('open loop')) {
      const list = openTasks().slice(0, 4);
      response = list.length ? `You have ${list.length} open loop${list.length === 1 ? '' : 's'}: ${list.map(task => task.title).join('; ')}.` : 'Your open loops are clear.';
    } else {
      response = 'I can show what is due today, suggest your next priority, add a task, mark a task done, or read your open loops.';
    }
    addMessage(response, 'agent');
    status.textContent = 'Spoken response ready';
    say(response);
  };
  form.addEventListener('submit', event => { event.preventDefault(); const command = input.value.trim(); if (!command) return; addMessage(command, 'user'); input.value = ''; respond(command); });
  document.querySelectorAll('[data-alexa-command]').forEach(button => button.addEventListener('click', () => { input.value = button.dataset.alexaCommand; form.requestSubmit(); }));
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition(); recognition.lang = 'en-US'; recognition.interimResults = false;
    mic.addEventListener('click', () => { status.textContent = 'Listening…'; mic.classList.add('is-listening'); recognition.start(); });
    recognition.onresult = event => { input.value = event.results[0][0].transcript; mic.classList.remove('is-listening'); status.textContent = 'Voice command captured'; form.requestSubmit(); };
    recognition.onerror = () => { mic.classList.remove('is-listening'); status.textContent = 'Voice input unavailable · try text mode'; };
  } else { mic.disabled = true; mic.title = 'Voice input is not available in this browser'; }
  renderTasks();
})();
