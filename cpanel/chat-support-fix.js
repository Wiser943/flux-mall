// ══════════════════════════════════════════════════════════
//  CHAT PAGE — FIXED VERSION
//  Key fixes:
//  1. openChat: use String() comparison so ObjectId vs number never mismatches
//  2. renderChatList: encode id in data-attribute, attach click via JS (no inline onclick with raw id)
//  3. loadChatSessionsIntoList: never falls back to mock CHAT_USERS once real sessions loaded
//  4. Mock fallback completely disabled when window._chatSessions is a non-empty array
// ══════════════════════════════════════════════════════════

// ── Initialise ────────────────────────────────────────────
async function initChatPage() {
  buildEmojiGrid();
  await loadChatSessionsIntoList();
  if (window._chatPagePollTimer) clearInterval(window._chatPagePollTimer);
  window._chatPagePollTimer = setInterval(loadChatSessionsIntoList, 15000);
}

// ── Load real sessions from API ───────────────────────────
async function loadChatSessionsIntoList() {
  const list = document.getElementById('chatList');
  if (!list) return;

  const data = await api('/api/admin/chat/sessions');

  if (!data?.success) {
    // Only show mock data if we have NEVER successfully loaded real sessions
    // (window._chatSessions === undefined means first load, null means API failed before)
    if (window._chatSessions === undefined) {
      window._chatSessions = null; // mark as "tried but failed"
      renderChatList(CHAT_USERS);
    }
    // If real sessions were previously loaded, keep showing them — don't overwrite with mock
    return;
  }

  const sessions = data.sessions || [];

  const mapped = sessions.map((s, i) => ({
    id: String(s._id),          // FIX: always store as string
    sessionId: String(s._id),   // FIX: always store as string
    name: s.username || 'Unknown User',
    initials: (s.username || 'U').substring(0, 2).toUpperCase(),
    email: s.userEmail || '',
    online: s.status !== 'ended',
    unread: s.unreadAdmin || 0,
    pinned: s.pinned || false,
    muted: s.muted || false,
    status: s.status === 'ended' ? 'resolved' : 'open',
    balance: s.userId?.ib || 0,
    shares: s.userId?.shares || 0,
    deposits: s.userId?.transCount || 0,
    referrals: s.userId?.refPoints || 0,
    lastMsg: s.lastMessage || 'No messages yet',
    lastTime: s.lastMessageAt
      ? new Date(s.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    color: COLORS[i % COLORS.length],
    userData: s.userId,
  }));

  // Badge counts
  const openCount     = mapped.filter(u => u.status === 'open').length;
  const unreadCount   = mapped.reduce((a, u) => a + u.unread, 0);
  const resolvedCount = mapped.filter(u => u.status === 'resolved').length;
  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('stat-open',     openCount);
  setEl('stat-unread',   unreadCount);
  setEl('stat-resolved', resolvedCount);
  setEl('badge-all',     mapped.length);
  setEl('badge-unread',  unreadCount);

  window._chatSessions = mapped;

  const q = document.getElementById('chatSearch')?.value.trim().toLowerCase() || '';
  handleChatSearch(q);
}

// ── Render the sidebar list ───────────────────────────────
function renderChatList(users, query = '') {
  const list    = document.getElementById('chatList');
  const noChats = document.getElementById('noChats');
  if (!list) return;

  const sorted = [...users].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return chatSortDesc ? -1 : 1;
  });

  if (sorted.length === 0) {
    list.innerHTML = '';
    noChats?.classList.add('visible');
    return;
  }
  noChats?.classList.remove('visible');

  // FIX: store the raw id in a data-attribute instead of embedding it in onclick
  // This avoids any quoting / escaping issues with ObjectId strings
  list.innerHTML = sorted.map(u => {
    const name    = query ? highlightText(u.name,    query) : u.name;
    const preview = query ? highlightText(u.lastMsg, query) : u.lastMsg;
    const isActive = String(chatActiveUserId) === String(u.id);
    return `
    <div class="chat-item ${u.unread ? 'unread' : ''} ${u.pinned ? 'pinned' : ''} ${u.muted ? 'muted' : ''} ${isActive ? 'active' : ''}"
      id="ci-${u.id}"
      data-chat-id="${u.id}"
      oncontextmenu="chatItemCtx(event, this.dataset.chatId)">
      <div class="chat-avatar">
        <div class="avatar-img initials" style="color:${u.color};border-color:${u.color}22;">${u.initials}</div>
        <div class="online-dot ${u.online ? 'visible' : ''}"></div>
      </div>
      <div class="chat-info">
        <div class="chat-name-row">
          <span class="chat-name">${name}</span>
          <div style="display:flex;align-items:center;gap:4px;">
            <i class="ri-pushpin-2-fill pin-icon"></i>
            <span class="chat-time">${u.lastTime}</span>
          </div>
        </div>
        <div class="chat-preview-row">
          <span class="chat-preview">${preview}</span>
          <span class="typing-preview">typing...</span>
          <i class="ri-volume-mute-line muted-icon"></i>
          <span class="unread-badge">${u.unread}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // FIX: attach click handlers via JS after rendering — safe for any id format
  list.querySelectorAll('.chat-item[data-chat-id]').forEach(el => {
    el.addEventListener('click', () => openChat(el.dataset.chatId));
  });
}

// ── Open a conversation ───────────────────────────────────
function openChat(userId) {
  // Normalise to string so ObjectId ('abc123') and mock numeric ids ('1') both match
  const uid = String(userId);
  chatActiveUserId = uid;

  // ── Real API session path ─────────────────────────────
  const sessions = Array.isArray(window._chatSessions) ? window._chatSessions : [];
  const realSession = sessions.find(u => String(u.id) === uid);

  if (realSession) {
    // Mark active in sidebar
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
    const ci = document.getElementById(`ci-${uid}`);
    if (ci) {
      ci.classList.add('active');
      ci.classList.remove('unread');
      const badge = ci.querySelector('.unread-badge');
      if (badge) badge.style.display = 'none';
    }

    openAdminChatSession(
      realSession.sessionId,
      realSession.name,
      realSession.status === 'resolved' ? 'ended' : 'active',
      realSession.userData
    );
    return;
  }

  // ── Mock fallback — only used when no real sessions exist ─
  // If window._chatSessions is a non-empty array, all users should have been found above;
  // reaching here means the id truly isn't in the list, so bail out gracefully.
  if (Array.isArray(window._chatSessions) && window._chatSessions.length > 0) {
    console.warn('[openChat] id not found in real sessions:', uid);
    return;
  }

  // Demo / offline mock
  const user = CHAT_USERS.find(u => String(u.id) === uid);
  if (!user) return;
  user.unread = 0;

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  const ci = document.getElementById(`ci-${uid}`);
  if (ci) {
    ci.classList.remove('unread');
    ci.classList.add('active');
    const badge = ci.querySelector('.unread-badge');
    if (badge) { badge.textContent = '0'; badge.style.display = 'none'; }
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  const hdrAvatar = document.getElementById('hdrAvatar');
  if (hdrAvatar) { hdrAvatar.textContent = user.initials; hdrAvatar.style.color = user.color; }
  set('hdrName', user.name);

  const statusEl = document.getElementById('hdrStatus');
  const dotEl    = document.getElementById('hdrOnlineDot');
  if (statusEl) {
    statusEl.textContent = user.online ? 'Online' : 'Offline';
    statusEl.className   = `chat-header-status${user.online ? ' online' : ''}`;
  }
  dotEl?.classList.toggle('visible', user.online);

  const uipAvatar = document.getElementById('uipAvatar');
  if (uipAvatar) { uipAvatar.textContent = user.initials; uipAvatar.style.color = user.color; }
  set('uipName',     user.name);
  set('uipEmail',    user.email);
  set('uipBalance',  user.balance);
  set('uipShares',   user.shares);
  set('uipDeposits', user.deposits);
  set('uipReferrals',user.referrals);

  document.getElementById('sessionEndedBar')?.classList.toggle('visible', user.status === 'resolved');
  document.getElementById('chatEmpty').style.display  = 'none';
  document.getElementById('chatWindow').classList.add('active');
  document.getElementById('chatMain').classList.add('mobile-open');

  renderMessages(uid);
}

// ── Render messages for mock sessions ────────────────────
function renderMessages(userId, highlight = '') {
  const area = document.getElementById('messagesArea');
  if (!area) return;

  // CHAT_MESSAGES keys are numbers; uid may be a string — coerce to match
  const msgs = CHAT_MESSAGES[userId] || CHAT_MESSAGES[Number(userId)] || [];

  if (msgs.length === 0) {
    area.innerHTML = '<div class="sys-msg"><span>No messages yet. Say hello! 👋</span></div>';
    return;
  }

  let html = '<div class="date-sep"><span class="date-sep-text">Today</span></div>';
  let prevFrom = null;

  // Find the matching mock user for display name (works for both string '1' and number 1)
  const mockUser = CHAT_USERS.find(u => String(u.id) === String(userId));

  msgs.forEach((msg, i) => {
    const isContinuation = prevFrom === msg.from && i > 0;
    const isOut = msg.from === 'admin';
    const cls = `msg-wrap ${isOut ? 'out' : 'in'} ${isContinuation ? 'continuation' : ''}`;
    const textContent = highlight
      ? highlightText(escapeHtml(msg.text), highlight)
      : escapeHtml(msg.text);
    const isEmoji = /^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\s]+$/u.test(msg.text) && msg.text.length <= 6;
    const statusIcon = isOut
      ? `<i class="ri-check-double-line bubble-status ${msg.status === 'read' ? 'read' : ''}"></i>`
      : '';

    html += `
    <div class="${cls}" data-msg-id="${msg.id}" oncontextmenu="showCtxMenu(event,${msg.id},'${escapeHtml(msg.text)}')">
      <div class="bubble ${isEmoji ? 'emoji-only' : ''}">
        ${!isOut && !isContinuation
          ? `<span class="bubble-sender">${mockUser?.name.split(' ')[0] || 'User'}</span>`
          : ''}
        <div class="bubble-text">${textContent}</div>
        ${!isEmoji
          ? `<div class="bubble-meta"><span class="bubble-time">${msg.time}</span>${statusIcon}</div>`
          : ''}
      </div>
    </div>`;
    prevFrom = msg.from;
  });

  area.innerHTML = html;
  area.scrollTop = area.scrollHeight;
}

// ── Send message (mock) ───────────────────────────────────
function sendMessage() {
  if (!chatActiveUserId) return;

  // If a real session is active, delegate to the real admin chat sender
  const sessions = Array.isArray(window._chatSessions) ? window._chatSessions : [];
  const realSession = sessions.find(u => String(u.id) === String(chatActiveUserId));
  if (realSession) {
    // sendAdminMessage() is your existing real-session sender — call it instead
    if (typeof sendAdminMessage === 'function') { sendAdminMessage(); return; }
  }

  // Mock path
  const input = document.getElementById('msgInput');
  const text  = input?.value.trim();
  if (!text) return;

  const key  = Number(chatActiveUserId) || chatActiveUserId;
  const msgs = CHAT_MESSAGES[key];
  if (!msgs) return;

  const newMsg = {
    id: msgs.length + 1,
    from: 'admin',
    text,
    time: nowTime(),
    status: 'delivered',
    replyTo: replyingTo ? { ...replyingTo } : null,
  };
  msgs.push(newMsg);

  const user = CHAT_USERS.find(u => String(u.id) === String(chatActiveUserId));
  if (user) { user.lastMsg = text; user.lastTime = nowTime(); }

  if (input) input.value = '';
  document.getElementById('msgInput')?.style && (document.getElementById('msgInput').style.height = 'auto');

  cancelReply();
  closeQuickReplies();
  closeEmoji();
  renderMessages(chatActiveUserId);
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

// ── Search / filter helpers (unchanged logic, safe ids) ──
function handleChatSearch(query) {
  const q        = query.trim().toLowerCase();
  const clearBtn = document.getElementById('searchClearBtn');
  clearBtn?.classList.toggle('visible', q.length > 0);

  let users = Array.isArray(window._chatSessions) && window._chatSessions.length > 0
    ? window._chatSessions
    : CHAT_USERS;   // only use mock when real sessions never loaded

  if (q) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.lastMsg.toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  users = applyChatFilter(users);
  renderChatList(users, q);
}
