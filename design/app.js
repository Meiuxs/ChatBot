// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const thinkingBar = document.getElementById('thinkingBar');
const thinkingSwitch = document.getElementById('thinkingSwitch');
const chatTitle = document.getElementById('chatTitle');
const apiStatus = document.getElementById('apiStatus');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sessionList = document.getElementById('sessionList');
const newChatBtn = document.getElementById('newChatBtn');
const toggleSidebar = document.getElementById('toggleSidebar');
const toggleSettings = document.getElementById('toggleSettings');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const apiKeyInput = document.getElementById('apiKey');
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility');
const providerSelect = document.getElementById('provider');
const modelSelect = document.getElementById('model');
const toggleCustomModel = document.getElementById('toggleCustomModel');
const customModelGroup = document.getElementById('customModelGroup');
const modelCustom = document.getElementById('modelCustom');
const providerName = document.getElementById('providerName');
const apiKeyHint = document.getElementById('apiKeyHint');
const aboutProvider = document.getElementById('aboutProvider');
const temperatureSlider = document.getElementById('temperature');
const maxTokensSlider = document.getElementById('maxTokens');
const tempValue = document.getElementById('tempValue');
const tokensValue = document.getElementById('tokensValue');
const saveSettingsBtn = document.getElementById('saveSettings');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalCancel = document.getElementById('modalCancel');
const modalConfirm = document.getElementById('modalConfirm');
const toast = document.getElementById('toast');

// Auth Elements
const authView = document.getElementById('authView');
const chatView = document.getElementById('chatView');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const regEmail = document.getElementById('regEmail');
const regPassword = document.getElementById('regPassword');
const regConfirm = document.getElementById('regConfirm');
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const loginSubmit = document.getElementById('loginSubmit');
const registerSubmit = document.getElementById('registerSubmit');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const userAvatar = document.getElementById('userAvatar');
const userDropdown = document.getElementById('userDropdown');
const userDropdownEmail = document.getElementById('userDropdownEmail');
const logoutBtn = document.getElementById('logoutBtn');

// Settings Tab Elements
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsTabContents = document.querySelectorAll('.settings-tab-content');
const aboutUserEmail = document.getElementById('aboutUserEmail');
const aboutModel = document.getElementById('aboutModel');

// Storage Keys
const STORAGE_KEYS = {
  settings: 'chatbot_settings',
  sessions: 'chatbot_sessions',
  currentSession: 'chatbot_current_session',
  user: 'chatbot_user',
  isLoggedIn: 'chatbot_is_logged_in'
};

// Default Settings
const DEFAULT_SETTINGS = {
  apiKey: '',
  provider: 'openai',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2000
};

// Provider data
const MODELS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'o1-mini', label: 'o1 Mini' },
    { value: 'o1-preview', label: 'o1 Preview' },
  ],
  deepseek: [
    { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
    { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  ],
};

const PROVIDER_NAMES = {
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
};

const PROVIDER_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};

// State
let settings = { ...DEFAULT_SETTINGS };
let sessions = [];
let currentSessionId = null;
let renamingSessionId = null;
let currentAbortController = null;
let isGenerating = false;
let thinkingEnabled = false;
let currentUser = null;

// Configure marked
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
  gfm: true
});

// === Auth Functions ===

// Check login status on init
function checkAuthStatus() {
  const isLoggedIn = localStorage.getItem(STORAGE_KEYS.isLoggedIn) === 'true';
  const savedUser = localStorage.getItem(STORAGE_KEYS.user);

  if (isLoggedIn && savedUser) {
    currentUser = JSON.parse(savedUser);
    showChatView();
  } else {
    showAuthView();
  }
}

// Show auth view
function showAuthView() {
  authView.style.display = 'flex';
  chatView.style.display = 'none';
  clearAuthForms();
}

// Show chat view
function showChatView() {
  authView.style.display = 'none';
  chatView.style.display = 'flex';
  if (currentUser) {
    userDropdownEmail.textContent = currentUser.email;
  }
}

// Clear auth forms
function clearAuthForms() {
  loginForm.reset();
  registerForm.reset();
  loginError.textContent = '';
  registerError.textContent = '';
  loginEmail.classList.remove('error');
  loginPassword.classList.remove('error');
  regEmail.classList.remove('error');
  regPassword.classList.remove('error');
  regConfirm.classList.remove('error');
}

// Switch between login and register
function switchToRegister() {
  loginForm.style.display = 'none';
  registerForm.style.display = 'flex';
  clearAuthForms();
}

function switchToLogin() {
  registerForm.style.display = 'none';
  loginForm.style.display = 'flex';
  clearAuthForms();
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get password strength
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '' };

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'weak' };
  if (score <= 3) return { score, label: 'medium' };
  return { score, label: 'strong' };
}

// Show auth error
function showAuthError(element, message) {
  element.textContent = message;
  element.previousElementSibling.querySelector('.auth-input')?.classList.add('error');
}

// Clear auth error
function clearAuthError(element) {
  element.textContent = '';
  element.previousElementSibling?.querySelector('.auth-input')?.classList.remove('error');
}

// Default test account for demo
const DEFAULT_TEST_ACCOUNT = {
  email: 'admin@admin.com',
  password: 'admin'
};

// Initialize default test account in localStorage
function initDefaultAccount() {
  const savedUsers = JSON.parse(localStorage.getItem('chatbot_users') || '[]');
  if (!savedUsers.find(u => u.email === DEFAULT_TEST_ACCOUNT.email)) {
    savedUsers.push(DEFAULT_TEST_ACCOUNT);
    localStorage.setItem('chatbot_users', JSON.stringify(savedUsers));
  }
}

// Simulate login (mock - replace with real API call)
async function handleLogin(email, password) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // Mock validation - in real app, call your API
  const savedUsers = JSON.parse(localStorage.getItem('chatbot_users') || '[]');
  const user = savedUsers.find(u => u.email === email && u.password === password);

  if (user) {
    currentUser = { email: user.email };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(currentUser));
    localStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
    showToast('登录成功', false, 'success');
    showChatView();
  } else {
    throw new Error('邮箱或密码错误');
  }
}

// Simulate register (mock - replace with real API call)
async function handleRegister(email, password) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  // Mock validation - in real app, call your API
  const savedUsers = JSON.parse(localStorage.getItem('chatbot_users') || '[]');

  if (savedUsers.find(u => u.email === email)) {
    throw new Error('该邮箱已被注册');
  }

  // Save new user (mock - password should be hashed in real app)
  savedUsers.push({ email, password });
  localStorage.setItem('chatbot_users', JSON.stringify(savedUsers));

  currentUser = { email };
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(currentUser));
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, 'true');
  showToast('注册成功', false, 'success');
  showChatView();
}

// Handle logout
function handleLogout() {
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.setItem(STORAGE_KEYS.isLoggedIn, 'false');
  showAuthView();
  showToast('已退出登录');
}

// Set loading state for auth button
function setAuthButtonLoading(button, loading) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = '处理中...';
    button.classList.add('auth-loading');
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText;
    button.classList.remove('auth-loading');
  }
}

// Initialize
function init() {
  initDefaultAccount();
  loadSettings();
  loadSessions();
  setupEventListeners();
  renderSessionList();
  loadCurrentSession();
  updateApiStatus();
  checkAuthStatus();
}

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEYS.settings);
  if (saved) {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  }
  applySettingsToUI();
}

// Populate model options based on selected provider
function populateModelOptions() {
  const provider = providerSelect.value;
  const models = MODELS_BY_PROVIDER[provider] || [];

  modelSelect.innerHTML = models.map(m =>
    `<option value="${m.value}">${m.label}</option>`
  ).join('') + '<option disabled>──────────</option><option value="__custom__">自定义模型…</option>';

  // Check if current model belongs to this provider, or is custom
  const modelInList = models.some(m => m.value === settings.model);
  const isCustomModel = !Object.values(MODELS_BY_PROVIDER).flat().some(m => m.value === settings.model) && settings.model;

  if (modelInList) {
    modelSelect.value = settings.model;
    customModelGroup.style.display = 'none';
    modelSelect.style.display = '';
  } else if (isCustomModel) {
    modelSelect.value = '__custom__';
    customModelGroup.style.display = '';
    modelCustom.value = settings.model;
    modelSelect.style.display = 'none';
  } else {
    // Fallback to first model
    settings.model = models.length > 0 ? models[0].value : '';
    modelSelect.value = settings.model;
    customModelGroup.style.display = 'none';
    modelSelect.style.display = '';
  }
}

// Apply settings to UI elements
function applySettingsToUI() {
  apiKeyInput.value = settings.apiKey;
  providerSelect.value = settings.provider || 'openai';
  populateModelOptions();
  temperatureSlider.value = settings.temperature;
  maxTokensSlider.value = settings.maxTokens;
  tempValue.textContent = settings.temperature.toFixed(1);
  tokensValue.textContent = settings.maxTokens;

  // Update provider-specific UI
  updateProviderUI();
  updateThinkingToggle();
}

// Update UI elements that depend on the selected provider
function updateProviderUI() {
  const displayName = PROVIDER_NAMES[providerSelect.value] || 'OpenAI';
  providerName.textContent = displayName;
  apiKeyInput.placeholder = `${displayName} API Key`;
  apiKeyHint.innerHTML = `请填写 <strong>${displayName}</strong> API Key`;
}

// Load sessions from localStorage
function loadSessions() {
  const saved = localStorage.getItem(STORAGE_KEYS.sessions);
  if (saved) {
    sessions = JSON.parse(saved);
  }
}

// Load current session
function loadCurrentSession() {
  const savedId = localStorage.getItem(STORAGE_KEYS.currentSession);
  if (savedId && sessions.find(s => s.id === savedId)) {
    currentSessionId = savedId;
  } else if (sessions.length > 0) {
    currentSessionId = sessions[0].id;
  } else {
    createNewSession();
  }
  renderSessionList();
  renderMessages();
  updateChatTitle();
}

// Update API Key status indicator
function updateApiStatus() {
  if (settings.apiKey) {
    apiStatus.className = 'api-status configured';
    apiStatus.title = 'API Key 已配置';
    apiStatus.innerHTML = '<span class="api-status-dot"></span>已配置';
  } else {
    apiStatus.className = 'api-status unconfigured';
    apiStatus.title = 'API Key 未配置';
    apiStatus.innerHTML = '<span class="api-status-dot"></span>未配置';
  }
}

// Save settings to localStorage
function saveSettings() {
  settings.apiKey = apiKeyInput.value.trim();
  settings.provider = providerSelect.value;

  if (customModelGroup.style.display !== 'none') {
    settings.model = modelCustom.value.trim() || settings.model;
  } else if (modelSelect.value === '__custom__') {
    settings.model = modelCustom.value.trim() || settings.model;
  } else {
    settings.model = modelSelect.value;
  }

  settings.temperature = parseFloat(temperatureSlider.value);
  settings.maxTokens = parseInt(maxTokensSlider.value);
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  updateApiStatus();
  updateAboutTab();
  showToast('设置已保存', false, 'success');
}

// Save sessions to localStorage
function saveSessions() {
  localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
}

// Save current session ID
function saveCurrentSessionId() {
  localStorage.setItem(STORAGE_KEYS.currentSession, currentSessionId);
}

// Create new session
function createNewSession() {
  renamingSessionId = null;
  const session = {
    id: generateId(),
    title: '新对话',
    createdAt: Date.now(),
    messages: []
  };
  sessions.unshift(session);
  currentSessionId = session.id;
  saveSessions();
  saveCurrentSessionId();
  renderSessionList();
  renderMessages();
  updateChatTitle();
  chatInput.focus();
  closeSidebarMobile();
}

// Delete session (with confirm modal)
function deleteSession(id, event) {
  event.stopPropagation();
  const session = sessions.find(s => s.id === id);
  if (!session) return;

  showModal(
    '确认删除',
    `会话「${session.title}」删除后无法恢复，确定要删除吗？`,
    () => {
      if (renamingSessionId === id) renamingSessionId = null;
      sessions = sessions.filter(s => s.id !== id);
      if (sessions.length === 0) {
        createNewSession();
      } else if (currentSessionId === id) {
        currentSessionId = sessions[0].id;
        saveCurrentSessionId();
        renderMessages();
        updateChatTitle();
      }
      saveSessions();
      renderSessionList();
    }
  );
}

// Switch session
function switchSession(id) {
  if (isGenerating) {
    showToast('请等待当前回复完成', true);
    return;
  }
  currentSessionId = id;
  saveCurrentSessionId();
  renamingSessionId = null;
  renderSessionList();
  renderMessages();
  updateChatTitle();
  closeSidebarMobile();
}

// Rename session
function startRename(id, event) {
  if (event) event.stopPropagation();
  if (isGenerating) {
    showToast('请等待当前回复完成', true);
    return;
  }
  renamingSessionId = id;
  renderSessionList();
}

function saveRename(value, id) {
  const session = sessions.find(s => s.id === id);
  if (!session) return;
  const trimmed = value.trim();
  if (trimmed && trimmed !== session.title) {
    session.title = trimmed.slice(0, 100);
    saveSessions();
    renderSessionList();
    updateChatTitle();
    showToast('会话已重命名');
  } else {
    renamingSessionId = null;
    renderSessionList();
  }
  renamingSessionId = null;
}

function cancelRename(id) {
  renamingSessionId = null;
  renderSessionList();
}

function onRenameKeydown(event, id) {
  if (event.key === 'Enter') {
    event.preventDefault();
    const input = event.target;
    saveRename(input.value, id);
  } else if (event.key === 'Escape') {
    event.preventDefault();
    cancelRename(id);
  }
}

// Get current session
function getCurrentSession() {
  return sessions.find(s => s.id === currentSessionId);
}

// Render session list
function renderSessionList() {
  if (sessions.length === 0) {
    sessionList.innerHTML = `
      <div class="session-list-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>暂无会话<br>点击上方 + 开始</p>
      </div>
    `;
    return;
  }
  sessionList.innerHTML = sessions.map(session => {
    const isEditing = renamingSessionId === session.id;
    return `
    <div class="session-item ${session.id === currentSessionId ? 'active' : ''} ${isEditing ? 'editing' : ''}"
         onclick="${isEditing ? '' : `switchSession('${session.id}')`}">
      <svg class="session-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      ${isEditing
        ? `<input class="session-item-input" value="${escapeHtml(session.title)}" maxlength="100"
             onfocus="this.select()" data-rename-id="${session.id}"
             onkeydown="onRenameKeydown(event, '${session.id}')"
             onblur="saveRename(this.value, '${session.id}')">`
        : `<span class="session-item-title">${escapeHtml(session.title)}</span>`
      }
      <button class="session-item-edit" onclick="startRename('${session.id}', event)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
        </svg>
      </button>
      <button class="session-item-delete" onclick="deleteSession('${session.id}', event)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>`;
  }).join('');
  // Auto-focus rename input if active
  if (renamingSessionId) {
    const input = document.querySelector(`.session-item.editing .session-item-input`);
    if (input) setTimeout(() => input.focus(), 0);
  }
}

// Render messages
function renderMessages() {
  const session = getCurrentSession();
  if (!session || session.messages.length === 0) {
    chatMessages.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <h3>开始新对话</h3>
        <p>输入消息，AI 将尽快为你解答</p>
      </div>
    `;
    return;
  }
  chatMessages.innerHTML = session.messages.map((msg, index) => {
    if (msg.role === 'user') {
      return `
        <div class="message user">
          <div class="message-content">${escapeHtml(msg.content)}</div>
        </div>
      `;
    }
    if (msg.role === 'error') {
      return `
        <div class="message error">
          <div class="message-content">
            <div class="error-text">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>${escapeHtml(msg.content)}</span>
            </div>
            <button class="error-retry" onclick="retryMessage(${index})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
              </svg>
              重新发送
            </button>
          </div>
        </div>
      `;
    }
    const hasReasoning = msg.reasoning && msg.reasoning.length > 0;
    const charCount = hasReasoning ? `约 ${msg.reasoning.length} 字符` : '';
    const reasoningBlock = hasReasoning ? `
      <div class="reasoning-wrapper">
        <button class="reasoning-toggle" onclick="toggleReasoning(this)">
          <svg class="reasoning-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span>思考过程</span>
          <span class="reasoning-badge">AI</span>
          <span class="reasoning-count">${charCount}</span>
        </button>
        <div class="reasoning-content">
          <p>${escapeHtml(msg.reasoning)}</p>
        </div>
      </div>
    ` : '';
    return `
      <div class="message assistant">
        ${reasoningBlock}
        <div class="message-content">${marked.parse(msg.content)}</div>
      </div>
    `;
  }).join('');
  scrollToBottom();
}

// Update chat title
function updateChatTitle() {
  const session = getCurrentSession();
  if (session) {
    if (headerRenaming) {
      chatTitle.innerHTML = `<input class="chat-title-input" value="${escapeHtml(session.title)}" maxlength="100" id="header-rename-input">`;
      setTimeout(() => {
        const input = document.getElementById('header-rename-input');
        if (input) {
          input.focus();
          input.select();
          input.onkeydown = (e) => {
            if (e.key === 'Enter') { e.preventDefault(); saveHeaderRename(input.value); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelHeaderRename(); }
          };
          input.onblur = () => saveHeaderRename(input.value);
        }
      }, 0);
    } else {
      chatTitle.textContent = session.title || '新对话';
    }
  } else {
    chatTitle.textContent = '新对话';
  }
}

let headerRenaming = false;

function startHeaderRename() {
  if (isGenerating) return;
  if (!currentSessionId) return;
  headerRenaming = true;
  updateChatTitle();
}

function saveHeaderRename(value) {
  headerRenaming = false;
  const session = getCurrentSession();
  if (!session) { updateChatTitle(); return; }
  const trimmed = value.trim();
  if (trimmed && trimmed !== session.title) {
    session.title = trimmed.slice(0, 100);
    saveSessions();
    renderSessionList();
    showToast('会话已重命名');
  }
  updateChatTitle();
}

function cancelHeaderRename() {
  headerRenaming = false;
  updateChatTitle();
}

// Set generating state
function setGeneratingState(generating) {
  isGenerating = generating;
  if (generating) {
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'flex';
    chatInput.disabled = true;
    thinkingSwitch.style.pointerEvents = 'none';
    thinkingBar.style.opacity = '0.5';
  } else {
    sendBtn.style.display = 'flex';
    stopBtn.style.display = 'none';
    chatInput.disabled = false;
    chatInput.focus();
    autoResizeTextarea();
    thinkingSwitch.style.pointerEvents = '';
    thinkingBar.style.opacity = '';
  }
}

// Stop generation
function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
  setGeneratingState(false);
  showToast('已停止生成');
}

// Send message
async function sendMessage() {
  const content = chatInput.value.trim();
  if (!content || isGenerating) return;

  if (!settings.apiKey) {
    showToast('请先配置 API Key', true);
    settingsPanel.classList.add('open');
    return;
  }

  const session = getCurrentSession();
  session.messages.push({ role: 'user', content });

  chatInput.value = '';
  chatInput.style.height = 'auto';
  sendBtn.disabled = true;

  renderMessages();

  // Show loading
  const loadingHtml = `
    <div class="message assistant loading" id="loadingMessage">
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.insertAdjacentHTML('beforeend', loadingHtml);
  scrollToBottom();

  setGeneratingState(true);

  try {
    await streamResponse(session);
  } catch (error) {
    removeLoadingMessage();
    if (error.name === 'AbortError') {
      // User stopped generation
    } else {
      // Show error as inline message
      session.messages.push({ role: 'error', content: error.message });
      saveSessions();
      renderMessages();
    }
  } finally {
    setGeneratingState(false);
  }
}

// Retry failed message
function retryMessage(errorIndex) {
  const session = getCurrentSession();
  if (!session) return;

  // Remove the error message
  session.messages.splice(errorIndex, 1);
  saveSessions();

  // Find the last user message before the error
  let lastUserMsg = null;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    if (session.messages[i].role === 'user') {
      lastUserMsg = session.messages[i].content;
      // Remove messages from this user message onward
      session.messages.splice(i);
      break;
    }
  }

  saveSessions();

  if (lastUserMsg) {
    chatInput.value = lastUserMsg;
    autoResizeTextarea();
    sendMessage();
  }
}

// Stream response from API
async function streamResponse(session) {
  currentAbortController = new AbortController();

  const endpoint = PROVIDER_ENDPOINTS[settings.provider] || PROVIDER_ENDPOINTS.openai;

  const body = {
    model: settings.model,
    messages: session.messages
      .filter(m => m.role !== 'error')
      .map(m => ({ role: m.role, content: m.content })),
    stream: true,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
  };

  if (thinkingEnabled) {
    body.reasoning_effort = 'high';
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body),
    signal: currentAbortController.signal
  });

  if (!response.ok) {
    let errorMsg = `API 错误: ${response.status}`;
    try {
      const error = await response.json();
      errorMsg = error.error?.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let assistantMessage = { role: 'assistant', content: '', reasoning: '' };

  removeLoadingMessage();

  // Create message element
  const msgElement = document.createElement('div');
  msgElement.className = 'message assistant';

  // Reasoning wrapper (hidden initially, shown when reasoning_content arrives)
  const reasoningWrapper = document.createElement('div');
  reasoningWrapper.className = 'reasoning-wrapper';
  reasoningWrapper.style.display = 'none';

  const reasoningToggleBtn = document.createElement('button');
  reasoningToggleBtn.className = 'reasoning-toggle';
  reasoningToggleBtn.innerHTML = `
    <svg class="reasoning-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <path d="M9 18l6-6-6-6"/>
    </svg>
    <span>思考过程</span>
    <span class="reasoning-badge">AI</span>
    <span class="reasoning-count"></span>
  `;
  reasoningToggleBtn.addEventListener('click', function() {
    const content = this.nextElementSibling;
    const chevron = this.querySelector('.reasoning-chevron');
    content.classList.toggle('open');
    chevron.classList.toggle('open');
  });

  const reasoningContentDiv = document.createElement('div');
  reasoningContentDiv.className = 'reasoning-content';

  reasoningWrapper.appendChild(reasoningToggleBtn);
  reasoningWrapper.appendChild(reasoningContentDiv);

  const contentElement = document.createElement('div');
  contentElement.className = 'message-content';

  msgElement.appendChild(reasoningWrapper);
  msgElement.appendChild(contentElement);
  chatMessages.appendChild(msgElement);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            assistantMessage.reasoning += delta.reasoning_content;
            reasoningWrapper.style.display = '';
            reasoningContentDiv.textContent = assistantMessage.reasoning;
            reasoningToggleBtn.querySelector('.reasoning-count').textContent =
              `约 ${assistantMessage.reasoning.length} 字符`;
            scrollToBottom();
          }
          if (delta?.content) {
            assistantMessage.content += delta.content;
            contentElement.innerHTML = marked.parse(assistantMessage.content);
            scrollToBottom();
          }
        } catch (e) {
          // SSE JSON parse error, skip invalid data
        }
      }
    }
  }

  session.messages.push(assistantMessage);
  saveSessions();
  currentAbortController = null;
}

// Remove loading message
function removeLoadingMessage() {
  const loading = document.getElementById('loadingMessage');
  if (loading) loading.remove();
}

// Toggle reasoning visibility
function toggleReasoning(btn) {
  const wrapper = btn.parentElement;
  const content = wrapper.querySelector('.reasoning-content');
  const chevron = btn.querySelector('.reasoning-chevron');
  content.classList.toggle('open');
  chevron.classList.toggle('open');
}

// Update thinking toggle visibility
function updateThinkingToggle() {
  const showThinking = providerSelect.value === 'deepseek';
  if (showThinking) {
    thinkingBar.style.display = 'flex';
  } else {
    thinkingBar.style.display = 'none';
    thinkingEnabled = false;
    thinkingBar.classList.remove('active');
    thinkingSwitch.classList.remove('active');
    thinkingSwitch.setAttribute('aria-checked', 'false');
  }
}

// Scroll to bottom
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show toast with type
function showToast(message, isError = false, type = '') {
  const icon = isError
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
    : type === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '';

  toast.innerHTML = icon + `<span>${escapeHtml(message)}</span>`;
  toast.className = 'toast show' + (isError ? ' error' : type ? ` ${type}` : '');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// Show confirm modal
let modalConfirmCallback = null;

function showModal(title, message, onConfirm) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalConfirmCallback = onConfirm;
  modalOverlay.classList.add('open');
}

function hideModal() {
  modalOverlay.classList.remove('open');
  modalConfirmCallback = null;
}

// Generate unique ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Auto-resize textarea
function autoResizeTextarea() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  sendBtn.disabled = !chatInput.value.trim();
}

// Toggle sidebar on mobile
function toggleSidebarMobile() {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('show');
}

function closeSidebarMobile() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}

// Settings Tab switching
function switchSettingsTab(tabId) {
  settingsTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  settingsTabContents.forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });
}

// Update about tab info
function updateAboutTab() {
  if (currentUser) {
    aboutUserEmail.textContent = currentUser.email;
  }
  const displayName = PROVIDER_NAMES[settings.provider] || 'OpenAI';
  aboutProvider.textContent = displayName;
  aboutModel.textContent = settings.model;
}

// Setup event listeners
function setupEventListeners() {
  // Auth - Switch between login and register
  showRegister.addEventListener('click', switchToRegister);
  showLogin.addEventListener('click', switchToLogin);

  // Auth - Login form
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    // Clear previous errors
    clearAuthError(loginError);
    loginEmail.classList.remove('error');
    loginPassword.classList.remove('error');

    // Validate
    if (!email) {
      showAuthError(loginError, '请输入邮箱');
      loginEmail.classList.add('error');
      return;
    }
    if (!isValidEmail(email)) {
      showAuthError(loginError, '请输入有效的邮箱地址');
      loginEmail.classList.add('error');
      return;
    }
    if (!password) {
      showAuthError(loginError, '请输入密码');
      loginPassword.classList.add('error');
      return;
    }

    // Submit
    setAuthButtonLoading(loginSubmit, true);
    try {
      await handleLogin(email, password);
    } catch (error) {
      showAuthError(loginError, error.message);
    } finally {
      setAuthButtonLoading(loginSubmit, false);
    }
  });

  // Auth - Register form
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = regEmail.value.trim();
    const password = regPassword.value;
    const confirm = regConfirm.value;

    // Clear previous errors
    clearAuthError(registerError);
    regEmail.classList.remove('error');
    regPassword.classList.remove('error');
    regConfirm.classList.remove('error');

    // Validate
    if (!email) {
      showAuthError(registerError, '请输入邮箱');
      regEmail.classList.add('error');
      return;
    }
    if (!isValidEmail(email)) {
      showAuthError(registerError, '请输入有效的邮箱地址');
      regEmail.classList.add('error');
      return;
    }
    if (!password) {
      showAuthError(registerError, '请输入密码');
      regPassword.classList.add('error');
      return;
    }
    if (password.length < 6) {
      showAuthError(registerError, '密码至少需要 6 位');
      regPassword.classList.add('error');
      return;
    }
    if (password !== confirm) {
      showAuthError(registerError, '两次输入的密码不一致');
      regConfirm.classList.add('error');
      return;
    }

    // Submit
    setAuthButtonLoading(registerSubmit, true);
    try {
      await handleRegister(email, password);
    } catch (error) {
      showAuthError(registerError, error.message);
    } finally {
      setAuthButtonLoading(registerSubmit, false);
    }
  });

  // Input focus - clear error state
  loginEmail.addEventListener('input', () => {
    if (loginEmail.classList.contains('error')) {
      loginEmail.classList.remove('error');
      clearAuthError(loginError);
    }
  });
  loginPassword.addEventListener('input', () => {
    if (loginPassword.classList.contains('error')) {
      loginPassword.classList.remove('error');
      clearAuthError(loginError);
    }
  });
  regEmail.addEventListener('input', () => {
    if (regEmail.classList.contains('error')) {
      regEmail.classList.remove('error');
      clearAuthError(registerError);
    }
  });
  regPassword.addEventListener('input', () => {
    if (regPassword.classList.contains('error')) {
      regPassword.classList.remove('error');
      clearAuthError(registerError);
    }
    // 更新密码强度指示器
    const bars = document.querySelectorAll('#passwordStrength .password-strength-bar');
    const strength = getPasswordStrength(regPassword.value);
    bars.forEach((bar, i) => {
      bar.className = 'password-strength-bar';
      if (i < strength.score) {
        bar.classList.add(strength.label || 'weak');
      }
    });
  });
  regConfirm.addEventListener('input', () => {
    if (regConfirm.classList.contains('error')) {
      regConfirm.classList.remove('error');
      clearAuthError(registerError);
    }
  });

  // User dropdown toggle
  userAvatar.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('show');
  });
  document.addEventListener('click', () => {
    userDropdown.classList.remove('show');
  });

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Send message
  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', autoResizeTextarea);

  // Thinking toggle switch
  thinkingSwitch.addEventListener('click', () => {
    if (isGenerating) return;
    thinkingEnabled = !thinkingEnabled;
    thinkingBar.classList.toggle('active');
    thinkingSwitch.classList.toggle('active');
    thinkingSwitch.setAttribute('aria-checked', thinkingEnabled.toString());
  });

  // Stop generation
  stopBtn.addEventListener('click', stopGeneration);

  // Sidebar toggle
  toggleSidebar.addEventListener('click', toggleSidebarMobile);
  sidebarOverlay.addEventListener('click', closeSidebarMobile);

  // Settings toggle
  toggleSettings.addEventListener('click', () => {
    settingsPanel.classList.add('open');
    updateAboutTab();
  });
  closeSettings.addEventListener('click', () => {
    settingsPanel.classList.remove('open');
  });

  // Settings tabs
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchSettingsTab(tab.dataset.tab);
      // 保存按钮只在"模型配置"Tab 显示
      saveSettingsBtn.style.display = tab.dataset.tab === 'model' ? 'block' : 'none';
    });
  });

  // API Key visibility toggle
  toggleApiKeyVisibility.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    const eyeIcon = toggleApiKeyVisibility.querySelector('.icon-eye');
    const eyeOffIcon = toggleApiKeyVisibility.querySelector('.icon-eye-off');
    eyeIcon.style.display = isPassword ? 'none' : 'block';
    eyeOffIcon.style.display = isPassword ? 'block' : 'none';
  });

  // New chat
  newChatBtn.addEventListener('click', createNewSession);

  // Settings sliders
  temperatureSlider.addEventListener('input', () => {
    tempValue.textContent = parseFloat(temperatureSlider.value).toFixed(1);
  });
  maxTokensSlider.addEventListener('input', () => {
    tokensValue.textContent = maxTokensSlider.value;
  });

  // Provider select - update model list and UI
  providerSelect.addEventListener('change', () => {
    // Save current provider
    settings.provider = providerSelect.value;
    // Populate models for new provider
    const models = MODELS_BY_PROVIDER[providerSelect.value] || [];
    settings.model = models.length > 0 ? models[0].value : '';
    populateModelOptions();
    updateProviderUI();
    updateAboutTab();
    updateThinkingToggle();
  });

  // Custom model toggle
  toggleCustomModel.addEventListener('click', (e) => {
    e.preventDefault();
    modelSelect.style.display = 'none';
    customModelGroup.style.display = '';
    modelCustom.value = settings.model;
    modelCustom.focus();
  });

  // Model select - handle custom option
  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === '__custom__') {
      modelSelect.style.display = 'none';
      customModelGroup.style.display = '';
      modelCustom.value = '';
      modelCustom.focus();
    } else {
      settings.model = modelSelect.value;
      updateAboutTab();
    }
  });

  // Custom model input - update model on Enter
  modelCustom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      settings.model = modelCustom.value.trim();
      updateAboutTab();
      showToast('自定义模型已设置');
    }
  });

  // Save settings
  saveSettingsBtn.addEventListener('click', saveSettings);

  // Theme toggle (placeholder for future implementation)
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showToast(`主题切换将在后续版本支持: ${btn.dataset.theme}`, false, 'success');
    });
  });

  // Export / Import (placeholder)
  document.getElementById('exportData')?.addEventListener('click', () => {
    showToast('导出功能将在后续版本支持');
  });
  document.getElementById('importData')?.addEventListener('click', () => {
    showToast('导入功能将在后续版本支持');
  });
  document.getElementById('addShortcut')?.addEventListener('click', () => {
    showToast('快捷指令编辑将在后续版本支持');
  });

  // Clear all data
  document.getElementById('clearAllData')?.addEventListener('click', () => {
    showModal('清除所有数据', '确定要清除所有会话数据和设置吗？此操作不可恢复。', () => {
      localStorage.clear();
      sessions = [];
      settings = { ...DEFAULT_SETTINGS };
      currentSessionId = null;
      initDefaultAccount();
      loadSettings();
      loadSessions();
      renderSessionList();
      createNewSession();
      updateApiStatus();
      showToast('所有数据已清除', false, 'success');
    });
  });

  // Modal actions
  modalCancel.addEventListener('click', hideModal);
  modalConfirm.addEventListener('click', () => {
    if (modalConfirmCallback) modalConfirmCallback();
    hideModal();
  });
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) hideModal();
  });

  // Close panels on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('open')) {
        hideModal();
      } else {
        settingsPanel.classList.remove('open');
        closeSidebarMobile();
      }
    }
  });

  // Window resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebarMobile();
    }
  });
}

// Initialize app
init();
