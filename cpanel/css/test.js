// ── Chat (Support) ─────────────────────────────────────────
// Renamed from USERS → CHAT_USERS to avoid collision
const CHAT_USERS = [
  { id: 1, name: 'Chioma Okafor', email: 'chioma@gmail.com', initials: 'CO', online: true, unread: 3, pinned: true, status: 'open', balance: '₦42,500', shares: 3, deposits: 7, referrals: 12, lastMsg: 'Please I need help with my withdrawal', lastTime: '09:42', muted: false, color: '#4CAF7D' },
  { id: 2, name: 'Emeka Nwachukwu', email: 'emeka.n@yahoo.com', initials: 'EN', online: true, unread: 1, pinned: false, status: 'open', balance: '₦8,200', shares: 1, deposits: 3, referrals: 2, lastMsg: 'The deposit is not showing in my wallet', lastTime: '09:31', muted: false, color: '#f59e0b' },
  { id: 3, name: 'Fatima Bello', email: 'fbello@hotmail.com', initials: 'FB', online: false, unread: 0, pinned: false, status: 'resolved', balance: '₦15,750', shares: 2, deposits: 5, referrals: 8, lastMsg: 'Thank you so much! 🙏', lastTime: 'Yesterday', muted: false, color: '#3b82f6' },
  { id: 4, name: 'Tunde Adeyemi', email: 'tunde.a@gmail.com', initials: 'TA', online: false, unread: 1, pinned: false, status: 'open', balance: '₦3,000', shares: 0, deposits: 1, referrals: 0, lastMsg: 'How do I verify my account?', lastTime: 'Yesterday', muted: true, color: '#8b5cf6' },
];

const CHAT_MESSAGES = {
  1: [
    { id: 1, from: 'user', text: 'Hello, I made a withdrawal request yesterday but it has not been processed', time: '09:10', status: 'read' },
    { id: 2, from: 'admin', text: 'Hello Chioma! I can see your request. Let me check the status right away.', time: '09:11', status: 'read' },
    { id: 3, from: 'user', text: 'Thank you. I really need the money urgently', time: '09:13', status: 'read' },
    { id: 4, from: 'admin', text: 'I understand, please bear with us. Withdrawals are processed between 9am–6pm. Your request is in the queue.', time: '09:14', status: 'read' },
    { id: 5, from: 'user', text: 'Ok noted. How long more please?', time: '09:20', status: 'read' },
    { id: 6, from: 'admin', text: 'Should be within the next 30 minutes. I have flagged your request as priority. 🙏', time: '09:21', status: 'read' },
    { id: 7, from: 'user', text: 'Please I need help with my withdrawal', time: '09:42', status: 'delivered' },
  ],
  2: [
    { id: 1, from: 'user', text: 'Good morning admin', time: '09:00', status: 'read' },
    { id: 2, from: 'admin', text: 'Good morning Emeka! How can I help you today?', time: '09:02', status: 'read' },
    { id: 3, from: 'user', text: 'The deposit is not showing in my wallet', time: '09:31', status: 'delivered' },
  ],
  3: [
    { id: 1, from: 'user', text: 'Please I cannot login to my account', time: '08:00', status: 'read' },
    { id: 2, from: 'admin', text: 'Hi Fatima, let me help you reset your password. Please check your email for reset instructions.', time: '08:05', status: 'read' },
    { id: 3, from: 'user', text: 'I received the email, trying now...', time: '08:10', status: 'read' },
    { id: 4, from: 'admin', text: 'Great! Let me know if you need any more help.', time: '08:11', status: 'read' },
    { id: 5, from: 'user', text: 'Thank you so much! 🙏', time: '08:15', status: 'read' },
  ],
};

// Chat UI state
let chatActiveUserId = null;
let currentFilter = 'all';
let chatSortDesc = true;
let replyingTo = null;
let emojiOpen = false;
let quickOpen = false;
let userPanelOpen = false;
let msgSearchActive = false;
let ctxMsgText = '';
let ctxMsgId = null;

const EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '😍', '🎉', '🔥', '💯', '😭', '😅', '🤣', '👏', '🙌', '💪', '✅', '⚡', '🎁', '💰', '🌟', '😢', '😎', '🤔', '💎', '🚀', '👀', '💬', '📱'];

// Admin Chat (Real API sessions)
let activeSessionId = null;
let activeUserData = null;
let statusTickerTimer = null;
let adminChatPollTimer = null;
let adminTypingPollTimer = null;
let adminTypingTimer = null;
let adminLastMsgCount = 0;
let adminSoundEnabled = true;
let adminSiteLogo = '';
let adminChatSessionStatus = 'active';
let adminAllMessages = [];
let adminReplyingTo = null;
let adminEditingMsgId = null;
const ADMIN_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];






window.openChatModal = async () => {
  showModal({
    title: 'Chat settings',
    content: `
      <div class="settings-row">
        <label>Chat Available</label>
        <label class="switch"><input type="checkbox" id="cs_available" checked><span class="slider"></span></label>
      </div>
      <div class="settings-row">
        <label>Sound Alerts</label>
        <label class="switch"><input type="checkbox" id="cs_sound" checked><span class="slider"></span></label>
      </div>
      <div class="settings-row">
        <label>Allow User Images</label>
        <label class="switch"><input type="checkbox" id="cs_allowImages" checked><span class="slider"></span></label>
      </div>
      <div style="margin:14px 0 6px;font-size:13px;font-weight:600;">Auto-Reply Message</div>
      <textarea id="cs_autoReply" rows="3" placeholder="e.g. Thanks for reaching out!" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:8px;font-size:13px;"></textarea>`,
    buttons: [
      { text: 'Cancel', class: 'btn-sec', onclick: "document.getElementById('createChatModal').remove()" },
      { text: 'Save Settings', class: 'btn-submit', onclick: 'saveChatSettings()' }
    ]
  });
  loadChatSettings();
};


// ══════════════════════════════════════════════════════════
//  SECTION 13 — CHAT PAGE (Support panel with mock data)
// ══════════════════════════════════════════════════════════

async function initChatPage() {
  buildEmojiGrid();
  await loadChatSessionsIntoList();
  if (window._chatPagePollTimer) clearInterval(window._chatPagePollTimer);
  window._chatPagePollTimer = setInterval(loadChatSessionsIntoList, 15000);
}

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
  const text = input?.value.trim();
  if (!text) return;
  
  const key = Number(chatActiveUserId) || chatActiveUserId;
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
  if (user) { user.lastMsg = text;
    user.lastTime = nowTime(); }
  
  if (input) input.value = '';
  document.getElementById('msgInput')?.style && (document.getElementById('msgInput').style.height = 'auto');
  
  cancelReply();
  closeQuickReplies();
  closeEmoji();
  renderMessages(chatActiveUserId);
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function closeMobileChat() {
  document.getElementById('chatMain').classList.remove('mobile-open');
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  chatActiveUserId = null;
}

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


function clearChatSearch() {
  const input = document.getElementById('chatSearch');
  if (input) input.value = '';
  handleChatSearch('');
  document.getElementById('chatSearch')?.focus();
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function applyChatFilter(users) {
  switch (currentFilter) {
    case 'unread':
      return users.filter(u => u.unread > 0);
    case 'open':
      return users.filter(u => u.status === 'open');
    case 'resolved':
      return users.filter(u => u.status === 'resolved');
    case 'pinned':
      return users.filter(u => u.pinned);
    default:
      return users;
  }
}

function toggleSearch() {
  const bar = document.getElementById('msgSearchBar');
  if (!bar) return;
  msgSearchActive = !msgSearchActive;
  bar.style.display = msgSearchActive ? 'block' : 'none';
  document.getElementById('msgSearchBtn')?.classList.toggle('active', msgSearchActive);
  if (msgSearchActive) {
    document.getElementById('msgSearchInput')?.focus();
    document.getElementById('msgSearchClear')?.classList.add('visible');
  } else {
    closeMessageSearch();
  }
}

function searchInChat(query) {
  if (!chatActiveUserId) return;
  const q = query.trim();
  const countEl = document.getElementById('msgSearchCount');
  if (!q) { renderMessages(chatActiveUserId); if (countEl) countEl.textContent = ''; return; }
  const msgs = CHAT_MESSAGES[chatActiveUserId] || [];
  const matches = msgs.filter(m => m.text.toLowerCase().includes(q.toLowerCase()));
  if (countEl) countEl.textContent = matches.length ? `${matches.length} result${matches.length!==1?'s':''}` : 'No results';
  renderMessages(chatActiveUserId, q);
}

function closeMessageSearch() {
  const bar = document.getElementById('msgSearchBar');
  if (bar) bar.style.display = 'none';
  const si = document.getElementById('msgSearchInput');
  if (si) si.value = '';
  document.getElementById('msgSearchClear')?.classList.remove('visible');
  const cnt = document.getElementById('msgSearchCount');
  if (cnt) cnt.textContent = '';
  document.getElementById('msgSearchBtn')?.classList.remove('active');
  msgSearchActive = false;
  if (chatActiveUserId) renderMessages(chatActiveUserId);
}

function showCtxMenu(e, msgId, text) {
  e.preventDefault();
  ctxMsgId = msgId;
  ctxMsgText = text;
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.classList.add('visible');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 220) + 'px';
}

function hideCtxMenu() { document.getElementById('ctxMenu')?.classList.remove('visible'); }

function ctxAction(action) {
  hideCtxMenu();
  switch (action) {
    case 'reply':
      startReply(ctxMsgId, ctxMsgText);
      break;
    case 'copy':
      navigator.clipboard.writeText(ctxMsgText).then(() => showToast('Copied!', 'success'));
      break;
    case 'forward':
      showToast('Forward: coming soon', 'info');
      break;
    case 'star':
      showToast('Message starred ⭐', 'success');
      break;
    case 'delete':
      if (chatActiveUserId && ctxMsgId) {
        const msgs = CHAT_MESSAGES[chatActiveUserId];
        const idx = msgs.findIndex(m => m.id === ctxMsgId);
        if (idx > -1) {
          msgs.splice(idx, 1);
          renderMessages(chatActiveUserId);
          showToast('Message deleted', 'info');
        }
      }
      break;
  }
}

function startReply(msgId, text) {
  if (!chatActiveUserId) return;
  replyingTo = { msgId, text };
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  const rs = document.getElementById('replyBarSender');
  const rt = document.getElementById('replyBarText');
  if (rs) rs.textContent = user?.name.split(' ')[0] || 'User';
  if (rt) rt.textContent = text;
  document.getElementById('replyBar')?.classList.add('visible');
  document.getElementById('msgInput')?.focus();
}

function cancelReply() {
  replyingTo = null;
  document.getElementById('replyBar')?.classList.remove('visible');
}

function toggleQuickReplies() {
  quickOpen = !quickOpen;
  document.getElementById('quickReplies')?.classList.toggle('visible', quickOpen);
}

function closeQuickReplies() {
  quickOpen = false;
  document.getElementById('quickReplies')?.classList.remove('visible');
}

function useQuickReply(text) {
  const input = document.getElementById('msgInput');
  if (input) {
    input.value = text;
    autoResize(input);
  }
  closeQuickReplies();
  input?.focus();
}

function buildEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  if (!grid) return;
  grid.innerHTML = EMOJIS.map(e => `<span class="emoji-btn-item" onclick="insertEmoji('${e}')">${e}</span>`).join('');
}

function toggleEmoji() {
  emojiOpen = !emojiOpen;
  document.getElementById('emojiPicker')?.classList.toggle('visible', emojiOpen);
}

function closeEmoji() {
  emojiOpen = false;
  document.getElementById('emojiPicker')?.classList.remove('visible');
}

function insertEmoji(emoji) {
  const inp = document.getElementById('msgInput');
  if (!inp) return;
  const pos = inp.selectionStart;
  inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
  inp.selectionStart = inp.selectionEnd = pos + emoji.length;
  inp.focus();
}

function toggleUserPanel() {
  userPanelOpen = !userPanelOpen;
  document.getElementById('userInfoPanel')?.classList.toggle('hidden', !userPanelOpen);
  document.getElementById('uipToggleBtn')?.classList.toggle('active', userPanelOpen);
}

function simulateTyping() {
  if (!chatActiveUserId) return;
  const tb = document.getElementById('typingBubble');
  const area = document.getElementById('messagesArea');
  const ci = document.getElementById(`ci-${chatActiveUserId}`);
  ci?.classList.add('typing');
  tb?.classList.add('visible');
  if (area) area.scrollTop = area.scrollHeight;
  
  setTimeout(() => {
    tb?.classList.remove('visible');
    ci?.classList.remove('typing');
    const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
    const responses = ['Thank you for your help!', 'Ok I will wait then', 'Is there anything else I should do?', 'My issue has been resolved 🙏', 'Please when will it be done?'];
    const text = responses[Math.floor(Math.random() * responses.length)];
    CHAT_MESSAGES[chatActiveUserId].push({ id: Date.now(), from: 'user', text, time: nowTime(), status: 'delivered' });
    if (user) {
      user.lastMsg = text;
      user.lastTime = nowTime();
    }
    renderMessages(chatActiveUserId);
    handleChatSearch(document.getElementById('chatSearch')?.value || '');
  }, 2500);
}

function resolveSession() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  if (!user) return;
  user.status = 'resolved';
  document.getElementById('sessionEndedBar')?.classList.add('visible');
  const ia = document.getElementById('inputArea');
  if (ia) {
    ia.style.opacity = '0.5';
    ia.style.pointerEvents = 'none';
  }
  showToast(`Session with ${user.name} resolved`, 'success');
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
}

function reopenSession() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  if (!user) return;
  user.status = 'open';
  document.getElementById('sessionEndedBar')?.classList.remove('visible');
  const ia = document.getElementById('inputArea');
  if (ia) {
    ia.style.opacity = '';
    ia.style.pointerEvents = '';
  }
  showToast('Session reopened', 'info');
}

function chatItemCtx(e, userId) {
  e.preventDefault();
  const user = CHAT_USERS.find(u => u.id === userId);
  if (!user) return;
  const actions = [
    { label: user.pinned ? 'Unpin chat' : 'Pin chat', fn: `user.pinned=!user.pinned;handleChatSearch('');showToast(user.pinned?'Chat pinned':'Chat unpinned','info');` },
    { label: user.muted ? 'Unmute chat' : 'Mute chat', fn: `user.muted=!user.muted;handleChatSearch('');showToast(user.muted?'Chat muted':'Chat unmuted','info');` },
    { label: 'Mark as unread', fn: `user.unread=1;handleChatSearch('');showToast('Marked as unread','info');` },
    { label: 'Resolve chat', fn: `user.status='resolved';handleChatSearch('');showToast('Resolved','success');` },
  ];
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  // We need access to user in the onclick scope — use a closure via data attribute
  menu.innerHTML = actions.map((a, i) => `<div class="ctx-item" onclick="executeChatCtx(${userId},${i})">${a.label}</div>`).join('');
  menu._chatCtxActions = actions;
  menu._chatCtxUser = user;
  menu.classList.add('visible');
  menu.style.left = Math.min(e.clientX, window.innerWidth - 190) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - 180) + 'px';
  menu.addEventListener('mouseleave', resetCtxMenu, { once: true });
}

window.executeChatCtx = function(userId, actionIdx) {
  const menu = document.getElementById('ctxMenu');
  const user = CHAT_USERS.find(u => u.id === userId);
  if (!menu || !user) return;
  const actions = [
    () => {
      user.pinned = !user.pinned;
      handleChatSearch('');
      showToast(user.pinned ? 'Chat pinned' : 'Chat unpinned', 'info');
    },
    () => {
      user.muted = !user.muted;
      handleChatSearch('');
      showToast(user.muted ? 'Chat muted' : 'Chat unmuted', 'info');
    },
    () => {
      user.unread = 1;
      handleChatSearch('');
      showToast('Marked as unread', 'info');
    },
    () => {
      user.status = 'resolved';
      handleChatSearch('');
      showToast('Resolved', 'success');
    },
  ];
  actions[actionIdx]?.();
  menu.classList.remove('visible');
  resetCtxMenu();
};

function resetCtxMenu() {
  const menu = document.getElementById('ctxMenu');
  if (!menu) return;
  menu.innerHTML = `
    <div class="ctx-item" onclick="ctxAction('reply')"><i class="ri-reply-line"></i> Reply</div>
    <div class="ctx-item" onclick="ctxAction('copy')"><i class="ri-file-copy-line"></i> Copy</div>
    <div class="ctx-item" onclick="ctxAction('forward')"><i class="ri-share-forward-line"></i> Forward</div>
    <div class="ctx-item" onclick="ctxAction('star')"><i class="ri-star-line"></i> Star message</div>
    <div class="ctx-divider"></div>
    <div class="ctx-item danger" onclick="ctxAction('delete')"><i class="ri-delete-bin-line"></i> Delete</div>`;
}

function toggleSort() {
  chatSortDesc = !chatSortDesc;
  const btn = document.getElementById('sortBtn');
  if (btn) btn.querySelector('i').className = chatSortDesc ? 'ri-sort-desc' : 'ri-sort-asc';
  handleChatSearch(document.getElementById('chatSearch')?.value || '');
  showToast(`Sorted ${chatSortDesc?'newest first':'oldest first'}`, 'info');
}

function showMoreMenu() {
  if (!chatActiveUserId) return;
  const user = CHAT_USERS.find(u => u.id === chatActiveUserId);
  showToast(`More options for ${user?.name}`, 'info');
}


// ══════════════════════════════════════════════════════════
//  SECTION 14 — ADMIN CHAT SESSIONS (Real API)
// ══════════════════════════════════════════════════════════

async function getAdminSiteLogo() {
  if (adminSiteLogo) return adminSiteLogo;
  const data = await api('/api/admin/settings');
  adminSiteLogo = data?.settings?.config?.siteLogo || '';
  return adminSiteLogo;
}

function playAdminChatSound() {
  try {
    const ctx = new(window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

window.loadAdminChatSessions = async function() {
  const container = document.getElementById('chatSessionItems');
  if (!container) return;
  const logo = await getAdminSiteLogo();
  const data = await api('/api/admin/chat/sessions');
  if (!data?.success) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;">Failed to load chats.</div>'; return; }
  if (!data.sessions.length) { container.innerHTML = '<div style="padding:20px;text-align:center;color:#aaa;font-size:13px;">No chats yet.</div>'; return; }
  
  container.innerHTML = '';
  data.sessions.forEach(s => {
    const isActive = s._id === activeSessionId;
    const hasUnread = s.unreadAdmin > 0;
    const timeStr = s.lastMessageAt ? new Date(s.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const ended = s.status === 'ended';
    const div = document.createElement('div');
    div.style.cssText = `padding:12px 14px;cursor:pointer;border-bottom:1px solid var(--border,#e0e5f2);display:flex;align-items:center;gap:10px;background:${isActive?'rgba(67,24,255,0.06)':'transparent'};`;
    div.onclick = () => openAdminChatSession(s._id, s.username, s.status, s.userId);
    div.innerHTML = `
      <img src="${logo}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;background:#eee;border:2px solid ${ended?'#e74c3c':'#10ac84'};">
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:700;font-size:13px;">${s.username}</span>
          <span style="font-size:10px;color:#aaa;">${timeStr}</span>
        </div>
        <div style="font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;">${s.lastMessage||'No messages'}</div>
      </div>
      ${hasUnread?`<span style="background:#e74c3c;color:#fff;border-radius:50%;width:20px;height:20px;font-size:11px;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;">${s.unreadAdmin}</span>`:''}
      ${ended?`<span style="background:#e74c3c;color:#fff;border-radius:10px;padding:2px 6px;font-size:10px;flex-shrink:0;">Ended</span>`:''}`;
    container.appendChild(div);
  });
  
  const totalUnread = data.sessions.reduce((a, s) => a + (s.unreadAdmin || 0), 0);
  const badge = document.getElementById('adminChatBadge');
  if (badge) {
    badge.textContent = totalUnread;
    badge.style.display = totalUnread > 0 ? 'flex' : 'none';
  }
};

window.openAdminChatSession = async function(sessionId, username, status, userData) {
  activeSessionId = sessionId;
  activeUserData = userData || null;
  adminChatSessionStatus = status || 'active';
  adminAllMessages = [];
  adminReplyingTo = null;
  adminEditingMsgId = null;
  
  const logo = await getAdminSiteLogo();
  /*document.getElementById('chatWindowEmpty').style.display = 'none';
  document.getElementById('chatWindowActive').style.display = 'flex';
  */
  if (window.innerWidth <= 700) {
    document.getElementById('chatSessionList')?.classList.add('slide-out');
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) backBtn.style.display = 'flex';
  }
  
  const uname = document.getElementById('adminChatUsername');
  const ulogo = document.getElementById('adminChatUserLogo');
  if (uname) uname.textContent = username;
  if (ulogo) ulogo.src = logo;
  
  updateBlockBtn(userData?.status);
  startStatusTicker(sessionId, status, userData?.status);
  
  const inputBar = document.getElementById('adminChatInputBar');
  const polarBtn = document.getElementById('adminPolarBtn');
  if (inputBar) inputBar.style.display = status === 'ended' ? 'none' : 'flex';
  if (polarBtn) polarBtn.style.display = status === 'ended' ? 'none' : 'inline-block';
  
  cancelAdminReply();
  await loadAdminMessages(sessionId);
  startAdminChatPolling(sessionId);
  startAdminTypingPoll(sessionId);
  loadAdminChatSessions();
  setTimeout(initScrollToBottom, 200);
};

async function loadAdminMessages(sessionId) {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;
  const data = await api(`/api/admin/chat/messages/${sessionId}`);
  if (!data?.success) return;
  adminAllMessages = data.messages;
  container.innerHTML = '';
  if (!data.messages.length) {
    container.innerHTML = '<div style="text-align:center;color:#aaa;padding:30px;font-size:13px;">No messages yet.</div>';
    adminLastMsgCount = 0;
    return;
  }
  const logo = await getAdminSiteLogo();
  let lastDate = '';
  data.messages.forEach(msg => {
    const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    if (dateStr !== lastDate) {
      const divider = document.createElement('div');
      divider.style.cssText = 'text-align:center;margin:12px 0;';
      divider.innerHTML = `<span style="background:rgba(0,0,0,0.06);color:#aaa;border-radius:12px;padding:3px 12px;font-size:11px;">${dateStr}</span>`;
      container.appendChild(divider);
      lastDate = dateStr;
    }
    container.appendChild(buildAdminMsgBubble(msg, logo));
  });
  container.scrollTop = container.scrollHeight;
  adminLastMsgCount = data.messages.length;
  setTimeout(() => updateSeenLabel(data.messages), 100);
}

function buildAdminMsgBubble(msg, logo) {
  const isMe = msg.sender === 'admin';
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const wrapper = document.createElement('div');
  wrapper.dataset.msgId = msg._id;
  wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isMe?'flex-end':'flex-start'};gap:2px;margin-bottom:2px;position:relative;`;
  
  let replyHtml = '';
  if (msg.replyTo?.msgId) {
    replyHtml = `<div style="background:rgba(0,0,0,0.06);border-left:3px solid #4318ff;border-radius:6px;padding:5px 10px;margin-bottom:4px;font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
      <span style="font-weight:700;color:#4318ff;margin-right:6px;">${msg.replyTo.sender==='admin'?'You':'User'}</span>${msg.replyTo.preview}
    </div>`;
  }
  
  let bubbleContent = '';
  if (msg.deleted) {
    bubbleContent = `<span style="font-style:italic;opacity:0.6;font-size:13px;">🚫 This message was deleted</span>`;
  } else if (msg.type === 'image' && msg.imageUrl) {
    bubbleContent = `<img src="${msg.imageUrl}" style="max-width:220px;border-radius:10px;cursor:pointer;" onclick="window.open('${msg.imageUrl}','_blank')">`;
  } else if (msg.type === 'polar') {
    const answered = msg.polarAnswer;
    bubbleContent = `<div style="font-size:13px;margin-bottom:6px;font-weight:600;">❓ ${msg.polarQuestion}</div>
      ${answered?`<div style="padding:6px 12px;border-radius:8px;background:rgba(255,255,255,0.2);font-weight:700;color:${answered==='yes'?'#10ac84':'#e74c3c'};">${answered==='yes'?'✅ User answered: Yes':'❌ User answered: No'}</div>`
      :'<div style="color:rgba(255,255,255,0.7);font-size:12px;">⏳ Awaiting answer...</div>'}`;
  } else {
    bubbleContent = `<span style="font-size:13px;line-height:1.5;word-break:break-word;">${msg.content}</span>`;
  }
  
  let ticksHtml = '';
  if (isMe && !msg.deleted) {
    const tickColor = msg.read ? '#4fc3f7' : 'rgba(255,255,255,0.4)';
    ticksHtml = `<span style="font-size:11px;color:${tickColor};margin-left:4px;">${msg.read?'✓✓':'✓'}</span>`;
  }
  
  const editedHtml = msg.edited && !msg.deleted ? `<span style="font-size:10px;opacity:0.5;margin-left:4px;">edited</span>` : '';
  const reactEntries = Object.entries(msg.reactions || {}).filter(([, v]) => v.length > 0);
  const reactionsHtml = reactEntries.length ? `
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">
      ${reactEntries.map(([emoji,users]) => `
        <span onclick="adminToggleReaction('${msg._id}','${emoji}')" style="background:rgba(0,0,0,0.07);border-radius:12px;padding:2px 7px;font-size:12px;cursor:pointer;border:1px solid ${users.includes('admin')?'#4318ff':'transparent'};">
          ${emoji} ${users.length}
        </span>`).join('')}
    </div>` : '';
  
  const emojiBarId = `aebar-${msg._id}`;
  const emojiBarHtml = msg.deleted ? '' : `
    <div id="${emojiBarId}" style="display:none;position:absolute;${isMe?'right:0':'left:0'};bottom:calc(100% + 4px);background:#fff;border-radius:20px;padding:6px 10px;box-shadow:0 4px 16px rgba(0,0,0,0.15);gap:6px;z-index:100;white-space:nowrap;">
      ${ADMIN_EMOJIS.map(e => `<span onclick="adminToggleReaction('${msg._id}','${e}');adminHideEmojiBar('${emojiBarId}')" style="font-size:20px;cursor:pointer;">${e}</span>`).join('')}
      <span onclick="adminStartReply('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;" title="Reply">↩️</span>
      ${isMe&&!msg.deleted?`<span onclick="adminStartEdit('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;">✏️</span>
      <span onclick="adminDeleteMsg('${msg._id}');adminHideEmojiBar('${emojiBarId}')" style="font-size:18px;cursor:pointer;padding:0 3px;">🗑️</span>`:''}
    </div>`;
  
  wrapper.innerHTML = `
    ${emojiBarHtml}
    <div>
      <div class="admin-bubble" data-msg-id="${msg._id}"
        style="max-width:72%;background:${isMe?'#4318ff':'#fff'};color:${isMe?'#fff':'#333'};border-radius:${isMe?'16px 16px 4px 16px':'16px 16px 16px 4px'};padding:10px 13px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:pointer;position:relative;"
        oncontextmenu="adminShowEmojiBar(event,'${emojiBarId}')"
        ontouchstart="adminHandleTouchStart(event,'${emojiBarId}')"
        ontouchend="adminHandleTouchEnd()">
        ${replyHtml}${bubbleContent}
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:3px;padding:0 38px;">
      <span style="font-size:10px;color:#aaa;">${time}</span>${editedHtml}${ticksHtml}
    </div>
    ${reactionsHtml}`;
  return wrapper;
}

let adminLongPressTimer = null;
window.adminShowEmojiBar = (e, barId) => {
  e.preventDefault();
  adminHideAllEmojiBars();
  const b = document.getElementById(barId);
  if (b) b.style.display = 'flex';
};
window.adminHideEmojiBar = (barId) => { const b = document.getElementById(barId); if (b) b.style.display = 'none'; };
window.adminHandleTouchStart = (e, barId) => { adminLongPressTimer = setTimeout(() => adminShowEmojiBar(e, barId), 500); };
window.adminHandleTouchEnd = () => clearTimeout(adminLongPressTimer);

function adminHideAllEmojiBars() { document.querySelectorAll('[id^="aebar-"]').forEach(b => b.style.display = 'none'); }
document.addEventListener('click', e => { if (!e.target.closest('[id^="aebar-"]') && !e.target.closest('.admin-bubble')) adminHideAllEmojiBars(); });

window.adminToggleReaction = async (msgId, emoji) => {
  const data = await api('/api/admin/chat/react', { method: 'POST', body: JSON.stringify({ msgId, emoji }) });
  if (data?.success) await loadAdminMessages(activeSessionId);
};

window.adminStartReply = (msgId) => {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg) return;
  adminEditingMsgId = null;
  adminReplyingTo = { msgId, sender: msg.sender, preview: msg.type === 'image' ? '📷 Image' : msg.content?.substring(0, 80) || '' };
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  const rs = document.getElementById('adminReplyBarSender');
  const rt = document.getElementById('adminReplyBarText');
  if (rs) rs.textContent = msg.sender === 'admin' ? 'You' : 'User';
  if (rt) rt.textContent = adminReplyingTo.preview;
  document.getElementById('adminChatInput')?.focus();
};

window.cancelAdminReply = () => {
  adminReplyingTo = null;
  adminEditingMsgId = null;
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'none';
  const input = document.getElementById('adminChatInput');
  if (input) input.value = '';
};

window.adminStartEdit = (msgId) => {
  const msg = adminAllMessages.find(m => m._id === msgId);
  if (!msg || msg.deleted) return;
  adminReplyingTo = null;
  adminEditingMsgId = msgId;
  const input = document.getElementById('adminChatInput');
  if (input) {
    input.value = msg.content;
    input.focus();
  }
  const bar = document.getElementById('adminReplyBar');
  if (bar) bar.style.display = 'flex';
  const rs = document.getElementById('adminReplyBarSender');
  const rt = document.getElementById('adminReplyBarText');
  if (rs) rs.textContent = '✏️ Editing';
  if (rt) rt.textContent = msg.content?.substring(0, 80);
};

window.adminDeleteMsg = async (msgId) => {
  showConfirm({
    title: 'Delete Message?',
    msg: 'This message will be permanently deleted.',
    type: 'danger',
    yesLabel: 'Delete',
    onYes: async () => {
      const data = await api(`/api/admin/chat/message/${msgId}`, { method: 'DELETE' });
      if (data?.success) await loadAdminMessages(activeSessionId);
    }
  });
};

window.sendAdminMessage = async () => {
  if (adminChatSessionStatus === 'ended') return showToast('Session has ended.', 'error');
  const input = document.getElementById('adminChatInput');
  const text = input?.value.trim();
  if (!text || !activeSessionId) return;
  
  if (adminEditingMsgId) {
    const data = await api(`/api/admin/chat/message/${adminEditingMsgId}`, { method: 'PUT', body: JSON.stringify({ content: text }) });
    if (data?.success) {
      cancelAdminReply();
      await loadAdminMessages(activeSessionId);
    }
    else showToast(data?.error || 'Failed to edit.', 'error');
    return;
  }
  
  if (input) input.value = '';
  const body = { sessionId: activeSessionId, content: text, type: 'text' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();
  
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    const empty = container?.querySelector('[style*="No messages"]');
    if (empty) empty.remove();
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    adminLastMsgCount++;
  }
};

window.onAdminInputKeydown = (e) => {
  if (e.key === 'Enter') { sendAdminMessage(); return; }
  clearTimeout(adminTypingTimer);
  adminTypingTimer = setTimeout(() => {
    if (activeSessionId) api('/api/admin/chat/typing', { method: 'POST', body: JSON.stringify({ sessionId: activeSessionId }) });
  }, 300);
};

window.sendAdminImage = async (input) => {
  const file = input.files[0];
  if (!file || !activeSessionId) return;
  if (adminChatSessionStatus === 'ended') return showToast('Session has ended.', 'error');
  const keysRes = await api('/api/admin/settings/apikeys');
  const imgbbKey = keysRes?.apikeys?.imgbb;
  if (!imgbbKey) return showToast('ImgBB key not set in Settings → API Keys.', 'error');
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, { method: 'POST', body: formData });
  const result = await res.json();
  if (!result.success) return showToast('Image upload failed.', 'error');
  const body = { sessionId: activeSessionId, type: 'image', imageUrl: result.data.url, content: '📷 Image' };
  if (adminReplyingTo) body.replyTo = adminReplyingTo;
  cancelAdminReply();
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify(body) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    adminLastMsgCount++;
  }
  input.value = '';
};

window.togglePolarInput = () => { const a = document.getElementById('polarInputArea'); if (a) a.style.display = a.style.display === 'none' ? 'block' : 'none'; };
window.sendAdminPolar = async () => {
  const question = document.getElementById('polarQuestionInput')?.value.trim();
  if (!question || !activeSessionId) return;
  const data = await api('/api/admin/chat/send', { method: 'POST', body: JSON.stringify({ sessionId: activeSessionId, type: 'polar', polarQuestion: question, content: `❓ ${question}` }) });
  if (data?.success) {
    const logo = await getAdminSiteLogo();
    adminAllMessages.push(data.message);
    const container = document.getElementById('adminChatMessages');
    container?.appendChild(buildAdminMsgBubble(data.message, logo));
    if (container) container.scrollTop = container.scrollHeight;
    const qi = document.getElementById('polarQuestionInput');
    if (qi) qi.value = '';
    togglePolarInput();
    adminLastMsgCount++;
  }
};

window.endAdminChatSession = async () => {
  if (!activeSessionId) return;
  showConfirm({
    title: 'End Chat Session?',
    msg: 'This will close the session. The user will no longer be able to send messages.',
    type: 'warning',
    yesLabel: 'End Session',
    onYes: async () => {
      const data = await api(`/api/admin/chat/session/${activeSessionId}/end`, { method: 'PUT' });
      if (data?.success) {
        adminChatSessionStatus = 'ended';
        const st = document.getElementById('adminChatSessionStatus');
        if (st) st.textContent = '🔴 Session Ended';
        document.getElementById('adminChatInputBar').style.display = 'none';
        document.getElementById('adminPolarBtn').style.display = 'none';
        loadAdminChatSessions();
      }
    }
  });
};

window.deleteAdminChatSession = async () => {
  if (!activeSessionId) return;
  showConfirm({
    title: 'Delete Entire Chat?',
    msg: 'This will permanently delete all messages in this chat. This cannot be undone.',
    type: 'danger',
    yesLabel: 'Delete Chat',
    onYes: async () => {
      const data = await api(`/api/admin/chat/session/${activeSessionId}`, { method: 'DELETE' });
      if (data?.success) {
        activeSessionId = null;
        document.getElementById('chatWindowEmpty').style.display = 'flex';
        document.getElementById('chatWindowActive').style.display = 'none';
        stopAdminChatPolling();
        loadAdminChatSessions();
      }
    }
  });
};

function startAdminTypingPoll(sessionId) {
  if (adminTypingPollTimer) clearInterval(adminTypingPollTimer);
  adminTypingPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/typing/${sessionId}`);
    const el = document.getElementById('adminTypingIndicator');
    if (el) el.style.display = data?.typing ? 'flex' : 'none';
  }, 2000);
}

function startAdminChatPolling(sessionId) {
  stopAdminChatPolling();
  adminChatPollTimer = setInterval(async () => {
    if (!activeSessionId) return;
    const data = await api(`/api/admin/chat/messages/${sessionId}`);
    if (!data?.success) return;
    const hasChanges = data.messages.length !== adminLastMsgCount ||
      JSON.stringify(data.messages.map(m => m.reactions)) !== JSON.stringify(adminAllMessages.map(m => m.reactions));
    if (hasChanges) {
      const newMsgs = data.messages.slice(adminLastMsgCount);
      const hasUserMsg = newMsgs.some(m => m.sender === 'user');
      const logo = await getAdminSiteLogo();
      adminAllMessages = data.messages;
      const container = document.getElementById('adminChatMessages');
      if (container) {
        container.innerHTML = '';
        let lastDate = '';
        data.messages.forEach(msg => {
          const dateStr = new Date(msg.createdAt).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
          if (dateStr !== lastDate) {
            const divider = document.createElement('div');
            divider.style.cssText = 'text-align:center;margin:12px 0;';
            divider.innerHTML = `<span style="background:rgba(0,0,0,0.06);color:#aaa;border-radius:12px;padding:3px 12px;font-size:11px;">${dateStr}</span>`;
            container.appendChild(divider);
            lastDate = dateStr;
          }
          container.appendChild(buildAdminMsgBubble(msg, logo));
        });
        container.scrollTop = container.scrollHeight;
      }
      if (adminSoundEnabled && hasUserMsg) playAdminChatSound();
      adminLastMsgCount = data.messages.length;
      loadAdminChatSessions();
      setTimeout(() => updateSeenLabel(data.messages), 100);
    }
  }, 4000);
}

function stopAdminChatPolling() {
  if (adminChatPollTimer) clearInterval(adminChatPollTimer);
}

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
}
requestNotifPermission();

function sendBrowserNotif(username, message) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  const notif = new Notification(`💬 ${username}`, { body: message, icon: adminSiteLogo || '/favicon.ico', tag: 'flux-chat', requireInteraction: true });
  notif.onclick = () => {
    window.focus();
    notif.close();
  };
}

let lastKnownUnread = 0;
setInterval(async () => {
  const data = await api('/api/admin/chat/unread');
  const badge = document.getElementById('adminChatBadge');
  if (data?.unread > 0) {
    if (badge) {
      badge.textContent = data.unread;
      badge.style.display = 'flex';
    }
    if (data.unread > lastKnownUnread) {
      if (adminSoundEnabled) playAdminChatSound();
      const sessions = await api('/api/admin/chat/sessions');
      if (sessions?.sessions?.length) {
        const active = sessions.sessions.filter(s => s.unreadAdmin > 0).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt))[0];
        if (active) sendBrowserNotif(active.username, active.lastMessage || 'New message');
      }
    }
    lastKnownUnread = data.unread;
  } else {
    if (badge) badge.style.display = 'none';
    lastKnownUnread = 0;
  }
}, 15000);

async function loadChatSettings() {
  const data = await api('/api/admin/chat/settings');
  if (!data?.success) return;
  const s = data.settings;
  const sc = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  sc('cs_available', s.available !== false);
  sc('cs_sound', s.sound !== false);
  sc('cs_allowImages', s.allowImages !== false);
  sc('cs_requireVerified', !!s.requireVerified);
  sc('cs_officeHoursEnabled', !!s.officeHours?.enabled);
  sv('cs_autoReply', s.autoReply);
  sv('cs_open', s.officeHours?.open || 9);
  sv('cs_close', s.officeHours?.close || 18);
  sv('cs_offlineMsg', s.officeHours?.offlineMsg);
  sv('cs_autoClose', s.autoClose || 48);
  sv('cs_charLimit', s.charLimit || 500);
  adminSoundEnabled = s.sound !== false;
}

window.saveChatSettings = async () => {
  const gc = (id) => document.getElementById(id)?.checked;
  const gv = (id) => document.getElementById(id)?.value;
  const body = {
    available: gc('cs_available'),
    sound: gc('cs_sound'),
    allowImages: gc('cs_allowImages'),
    requireVerified: gc('cs_requireVerified'),
    autoReply: gv('cs_autoReply'),
    autoClose: parseInt(gv('cs_autoClose')) || 48,
    charLimit: parseInt(gv('cs_charLimit')) || 500,
    officeHours: { enabled: gc('cs_officeHoursEnabled'), open: gv('cs_open'), close: gv('cs_close'), offlineMsg: gv('cs_offlineMsg') }
  };
  const data = await api('/api/admin/chat/settings', { method: 'PUT', body: JSON.stringify(body) });
  if (data?.success) {
    adminSoundEnabled = body.sound;
    showToast('Chat settings saved!', 'success');
  }
  else showToast(data?.error || 'Error saving settings.', 'error');
};

loadChatSettings();

function updateBlockBtn(userStatus) {
  const btn = document.getElementById('adminBlockBtn');
  const label = document.getElementById('adminBlockLabel');
  if (!btn) return;
  const isBlocked = userStatus === 'blocked';
  const icon = btn.querySelector('i');
  if (icon) icon.className = isBlocked ? 'ri-shield-check-line' : 'ri-forbid-line';
  if (label) label.textContent = isBlocked ? 'Unblock' : 'Block';
  btn.style.background = isBlocked ? '#e8f8f1' : '#fdecea';
  btn.style.color = isBlocked ? '#10ac84' : '#e74c3c';
}

window.toggleBlockFromChat = async () => {
  if (!activeSessionId) return;
  const isBlocked = activeUserData?.status === 'blocked';
  showConfirm({
    title: isBlocked ? 'Unblock This User?' : 'Block This User?',
    msg: isBlocked ?
      'The user will be able to send messages again.' : 'The user will be blocked and the session will end immediately.',
    type: isBlocked ? 'info' : 'danger',
    yesLabel: isBlocked ? 'Unblock' : 'Block User',
    onYes: async () => {
      const data = await api(`/api/admin/chat/session/${activeSessionId}/block`, { method: 'PUT', body: JSON.stringify({ block: !isBlocked }) });
      if (data?.success) {
        if (activeUserData) activeUserData.status = data.userStatus;
        updateBlockBtn(data.userStatus);
        startStatusTicker(activeSessionId, isBlocked ? 'active' : 'ended', data.userStatus);
        adminChatSessionStatus = isBlocked ? 'active' : 'ended';
        document.getElementById('adminChatInputBar').style.display = isBlocked ? 'flex' : 'none';
        document.getElementById('adminPolarBtn').style.display = isBlocked ? 'inline-block' : 'none';
        loadAdminChatSessions();
      } else {
        showToast(data?.error || 'Failed.', 'error');
      }
    }
  });
};

function startStatusTicker(sessionId, sessionStatus, userStatus) {
  if (statusTickerTimer) clearInterval(statusTickerTimer);
  const el = document.getElementById('adminChatSessionStatus');
  if (!el) return;
  const shortId = sessionId ? sessionId.toString().slice(-8).toUpperCase() : '--------';
  const isBlocked = userStatus === 'blocked';
  const isEnded = sessionStatus === 'ended';
  const states = [
    () => {
      if (isEnded) el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-stop-circle-line"></i> Session Ended</span>`;
      else if (isBlocked) el.innerHTML = `<span style="color:#e74c3c;display:flex;align-items:center;gap:4px;"><i class="ri-forbid-line"></i> Offline — Blocked</span>`;
      else el.innerHTML = `<span style="color:#10ac84;display:flex;align-items:center;gap:4px;"><i class="ri-radio-button-line"></i> Online — Active</span>`;
    },
    () => { el.innerHTML = `<span style="color:#aaa;display:flex;align-items:center;gap:4px;"><i class="ri-fingerprint-line"></i> ID: <code style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 5px;border-radius:4px;">${shortId}</code></span>`; }
  ];
  let idx = 0;
  states[0]();
  statusTickerTimer = setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      idx = (idx + 1) % states.length;
      states[idx]();
      el.style.opacity = '1';
    }, 300);
  }, 3500);
}

window.toggleChatSearch = () => {
  const bar = document.getElementById('chatSearchBar');
  if (!bar) return;
  const isVisible = bar.style.display !== 'none';
  bar.style.display = isVisible ? 'none' : 'block';
  if (!isVisible) document.getElementById('chatSearchInput')?.focus();
  else {
    const si = document.getElementById('chatSearchInput');
    if (si) si.value = '';
    const sr = document.getElementById('chatSearchResults');
    if (sr) sr.textContent = '';
    document.querySelectorAll('.search-highlight').forEach(el => { el.outerHTML = el.textContent; });
  }
};

window.searchChatMessages = (query) => {
  const resultsEl = document.getElementById('chatSearchResults');
  document.querySelectorAll('.search-highlight').forEach(el => {
    const text = document.createTextNode(el.textContent);
    el.parentNode.replaceChild(text, el);
  });
  if (!query.trim()) { if (resultsEl) resultsEl.textContent = ''; return; }
  const q = query.toLowerCase();
  const bubbles = document.querySelectorAll('#adminChatMessages .admin-bubble');
  let matchCount = 0,
    firstMatch = null;
  bubbles.forEach(bubble => {
    bubble.querySelectorAll('span').forEach(span => {
      if (span.children.length > 0) return;
      const text = span.textContent;
      if (text.toLowerCase().includes(q)) {
        matchCount++;
        span.innerHTML = text.replace(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'), '<mark class="search-highlight" style="background:#fff176;border-radius:3px;padding:0 2px;">$1</mark>');
        if (!firstMatch) firstMatch = bubble;
      }
    });
  });
  if (resultsEl) {
    resultsEl.textContent = matchCount > 0 ? `${matchCount} result${matchCount>1?'s':''} found` : 'No results found';
    resultsEl.style.color = matchCount > 0 ? '#10ac84' : '#e74c3c';
  }
  if (firstMatch) firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

function initScrollToBottom() {
  const container = document.getElementById('adminChatMessages');
  if (!container) return;
  let btn = document.getElementById('scrollToBottomBtn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'scrollToBottomBtn';
    btn.innerHTML = '↓';
    btn.style.cssText = 'display:none;position:absolute;bottom:80px;right:16px;width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;border:none;cursor:pointer;font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:50;';
    btn.onclick = () => { container.scrollTop = container.scrollHeight; };
    container.parentElement.style.position = 'relative';
    container.parentElement.appendChild(btn);
  }
  container.onscroll = () => {
    const d = container.scrollHeight - container.scrollTop - container.clientHeight;
    btn.style.display = d > 120 ? 'flex' : 'none';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
  };
}

function updateSeenLabel(messages) {
  document.querySelectorAll('.seen-label').forEach(el => el.remove());
  const lastRead = [...messages].reverse().find(m => m.sender === 'admin' && m.read && !m.deleted);
  if (!lastRead) return;
  const bubble = document.querySelector(`[data-msg-id="${lastRead._id}"]`);
  if (!bubble) return;
  const label = document.createElement('div');
  label.className = 'seen-label';
  label.style.cssText = 'font-size:10px;color:#4fc3f7;text-align:right;padding:0 42px;margin-top:-4px;';
  label.textContent = 'Seen ✓✓';
  bubble.after(label);
}

window.closeChatOnMobile = () => {
  document.getElementById('chatSessionList')?.classList.remove('slide-out');
  document.getElementById('chatWindowActive').style.display = 'none';
  document.getElementById('chatWindowEmpty').style.display = 'flex';
  const backBtn = document.getElementById('chatBackBtn');
  if (backBtn) backBtn.style.display = 'none';
  stopAdminChatPolling();
  activeSessionId = null;
};

window.addEventListener('resize', () => {
  if (window.innerWidth > 700) {
    document.getElementById('chatSessionList')?.classList.remove('slide-out');
    const backBtn = document.getElementById('chatBackBtn');
    if (backBtn) backBtn.style.display = 'none';
  }
});


// ══════════════════════════════════════════════════════════
//  SECTION 15 — KEYBOARD SHORTCUTS & GLOBAL EVENTS
// ══════════════════════════════════════════════════════════

document.addEventListener('keydown', (e) => {
  // / = focus settings search
  if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
    const si = document.getElementById('settingsSearch');
    if (si) {
      e.preventDefault();
      si.focus();
    }
  }
  if (e.key === 'Escape') {
    // Settings search
    const si = document.getElementById('settingsSearch');
    if (document.activeElement === si) {
      clearSettingsSearch();
      si.blur();
      return;
    }
    // Confirm modal
    closeConfirm();
    // Ctx menus
    hideCtx();
    hideCtxMenu();
    // Slide modal
    closeSlideModal();
    // Chat emoji / quick
    closeEmoji();
    closeQuickReplies();
    cancelReply();
    if (msgSearchActive) closeMessageSearch();
  }
});

