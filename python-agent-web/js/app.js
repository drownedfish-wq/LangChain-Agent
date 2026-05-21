/**
 * 本地智能体平台 - 前端逻辑（前后端分离版）
 * 支持：对话记忆、流式输出、工具调用可视化、RAG问答
 *         模型切换、文件上传、语音输入、深度思考
 * 
 * 前端独立部署在 3000 端口，后端 API 在 8000 端口
 */

// ========== 配置 ==========
// 后端 API 地址（前后端分离：跨域访问后端）
const API_BASE = 'http://localhost:8000/api';

// ========== 状态管理 ==========
const state = {
    currentChatId: 'default',
    currentMode: 'chat',       // chat | tool | rag
    isStreaming: false,
    deepThink: false,          // 深度思考模式
    currentModel: 'qwen2.5:3b',
    chats: {},                  // { chatId: [ {role, content, toolInfo?} ] }
};

// 语音识别相关
let recognition = null;
let isRecording = false;

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    createNewChat();
    document.getElementById('userInput').focus();
    checkBackendHealth();
    loadModels();
    initSpeechRecognition();
    setInterval(checkBackendHealth, 30000);
});

// ========== 后端健康检查 ==========
async function checkBackendHealth() {
    const statusEl = document.getElementById('backendStatus');
    try {
        const resp = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) });
        if (resp.ok) {
            statusEl.textContent = '🟢';
            statusEl.title = '后端连接正常';
        } else {
            statusEl.textContent = '🟡';
            statusEl.title = '后端响应异常';
        }
    } catch {
        statusEl.textContent = '🔴';
        statusEl.title = '后端未连接';
    }
}

// ========== 会话管理 ==========
function createNewChat() {
    const id = 'chat_' + Date.now();
    state.chats[id] = [];
    state.currentChatId = id;
    renderChatList();
    clearMessages();
    document.getElementById('welcomeScreen').style.display = 'flex';
    document.getElementById('userInput').focus();
}

function switchChat(id) {
    state.currentChatId = id;
    renderChatList();
    renderMessages();
}

function deleteChat(id, e) {
    e.stopPropagation();
    delete state.chats[id];
    if (state.currentChatId === id) {
        const keys = Object.keys(state.chats);
        if (keys.length) switchChat(keys[0]);
        else createNewChat();
    } else {
        renderChatList();
    }
}

function renderChatList() {
    const list = document.getElementById('chatList');
    list.innerHTML = '';
    Object.entries(state.chats).forEach(([id, msgs]) => {
        const firstMsg = msgs.find(m => m.role === 'user');
        const title = firstMsg ? firstMsg.content.slice(0, 30) : '新对话';
        const item = document.createElement('div');
        item.className = `chat-item${id === state.currentChatId ? ' active' : ''}`;
        item.innerHTML = `
            <span onclick="switchChat('${id}')">${title}</span>
            <button class="delete-chat" onclick="deleteChat('${id}', event)">✕</button>
        `;
        list.appendChild(item);
    });
}

// ========== 模式切换 ==========
function switchMode(mode) {
    state.currentMode = mode;
    document.querySelectorAll('.mode-tab').forEach(t =>
        t.classList.toggle('active', t.dataset.mode === mode)
    );
    document.getElementById('ragConfig').style.display = mode === 'rag' ? 'flex' : 'none';
}

// ========== 消息渲染 ==========
function clearMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = `<div class="welcome-screen" id="welcomeScreen">
        <div class="welcome-icon">🤖</div>
        <h1>本地智能体平台</h1>
        <p>基于 LangChain + Ollama，支持工具调用与 RAG</p>
        <p class="hint">前端端口 3000 | 后端端口 8000</p>
        <div class="quick-actions">
            <button class="quick-btn" onclick="sendQuick('你好，请介绍一下你自己')">👋 打个招呼</button>
            <button class="quick-btn" onclick="switchMode('tool');sendQuick('帮我算一下 (15+27)*3')">🧮 数学计算</button>
            <button class="quick-btn" onclick="switchMode('tool');sendQuick('北京今天天气怎么样？')">🌤️ 查天气</button>
            <button class="quick-btn" onclick="switchMode('rag');sendQuick('Spring AI Alibaba 是什么？')">📚 RAG问答</button>
        </div>
    </div>`;
}

function renderMessages() {
    const container = document.getElementById('chatMessages');
    container.innerHTML = '';
    const msgs = state.chats[state.currentChatId] || [];
    if (msgs.length === 0) { clearMessages(); return; }
    msgs.forEach(msg => appendMessageToDOM(msg));
    scrollToBottom();
}

function appendMessageToDOM(msg) {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${msg.role}`;

    if (msg.role === 'user') {
        div.innerHTML = `<div class="msg-content">${escapeHtml(msg.content)}</div>`;
    } else if (msg.role === 'tool') {
        div.innerHTML = `
            <div class="msg-avatar">🔧</div>
            <div class="msg-content">
                <div class="tool-label">${msg.toolInfo || '工具调用'}</div>
                ${escapeHtml(msg.content)}
            </div>`;
    } else {
        div.innerHTML = `
            <div class="msg-avatar">🤖</div>
            <div class="msg-content">${formatContent(msg.content)}</div>`;
    }
    container.appendChild(div);
    return div;
}

function formatContent(text) {
    let html = escapeHtml(text);
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<code>$2</code>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
}

// ========== 发送消息 ==========
function sendQuick(text) {
    document.getElementById('userInput').value = text;
    sendMessage();
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const text = input.value.trim();
    if (!text || state.isStreaming) return;

    input.value = '';
    autoResize(input);

    const userMsg = { role: 'user', content: text };
    if (!state.chats[state.currentChatId]) state.chats[state.currentChatId] = [];
    state.chats[state.currentChatId].push(userMsg);
    appendMessageToDOM(userMsg);
    renderChatList();

    const typingDiv = showTypingIndicator();
    state.isStreaming = true;
    document.getElementById('sendBtn').disabled = true;

    try {
        if (state.currentMode === 'chat') {
            await handleChatMode(text, typingDiv);
        } else if (state.currentMode === 'tool') {
            await handleToolMode(text, typingDiv);
        } else if (state.currentMode === 'rag') {
            await handleRAGMode(text, typingDiv);
        }
    } catch (err) {
        removeTypingIndicator(typingDiv);
        const errMsg = { role: 'ai', content: `❌ 请求失败: ${err.message}\n\n请确认后端服务已在 http://localhost:8000 运行。` };
        state.chats[state.currentChatId].push(errMsg);
        appendMessageToDOM(errMsg);
    } finally {
        state.isStreaming = false;
        document.getElementById('sendBtn').disabled = false;
        scrollToBottom();
    }
}

// ========== 对话模式（流式SSE）==========
async function handleChatMode(text, typingDiv) {
    const resp = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversation_id: state.currentChatId }),
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    removeTypingIndicator(typingDiv);

    const aiMsg = { role: 'ai', content: '' };
    state.chats[state.currentChatId].push(aiMsg);
    const msgDiv = appendMessageToDOM(aiMsg);
    const contentEl = msgDiv.querySelector('.msg-content');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') break;
                try {
                    const json = JSON.parse(data);
                    if (json.content) {
                        aiMsg.content += json.content;
                        contentEl.textContent = aiMsg.content;
                        scrollToBottom();
                    }
                } catch {}
            }
        }
    }
}

// ========== 工具智能体模式 ==========
async function handleToolMode(text, typingDiv) {
    const resp = await fetch(`${API_BASE}/tool/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
    });

    const data = await resp.json();
    removeTypingIndicator(typingDiv);

    if (data.error) {
        const errMsg = { role: 'ai', content: `❌ ${data.error}` };
        state.chats[state.currentChatId].push(errMsg);
        appendMessageToDOM(errMsg);
        return;
    }

    const aiMsg = { role: 'ai', content: data.response };
    state.chats[state.currentChatId].push(aiMsg);
    appendMessageToDOM(aiMsg);

    if (data.tool_calls && data.tool_calls.length > 0) {
        data.tool_calls.forEach(tc => {
            const toolMsg = {
                role: 'tool',
                content: `调用: ${tc.name}(${JSON.stringify(tc.args)})`,
                toolInfo: `工具: ${tc.name}`,
            };
            state.chats[state.currentChatId].push(toolMsg);
            appendMessageToDOM(toolMsg);
        });
    }
}

// ========== RAG 问答模式 ==========
async function handleRAGMode(text, typingDiv) {
    const collection = document.getElementById('ragCollection').value || 'default';
    const resp = await fetch(`${API_BASE}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, collection_name: collection }),
    });

    const data = await resp.json();
    removeTypingIndicator(typingDiv);

    if (data.error) {
        const errMsg = { role: 'ai', content: `❌ ${data.error}` };
        state.chats[state.currentChatId].push(errMsg);
        appendMessageToDOM(errMsg);
        return;
    }

    const aiMsg = { role: 'ai', content: data.response };
    state.chats[state.currentChatId].push(aiMsg);
    appendMessageToDOM(aiMsg);
}

// ========== RAG 文件上传 ==========
function uploadFileToRAG() {
    document.getElementById('ragFileInput').click();
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        const collection = document.getElementById('ragCollection').value || 'default';

        const toolMsg = {
            role: 'tool',
            content: `正在上传文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
            toolInfo: '文件上传',
        };
        state.chats[state.currentChatId].push(toolMsg);
        appendMessageToDOM(toolMsg);

        // 调用后端文件上传 API
        try {
            const resp = await fetch(`${API_BASE}/rag/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: file.name,
                    collection_name: collection,
                }),
            });
            const data = await resp.json();
            const aiMsg = {
                role: 'ai',
                content: data.error
                    ? `❌ 上传失败: ${data.error}`
                    : `✅ ${data.message}，已分 ${data.chunks} 个片段入库`,
            };
            state.chats[state.currentChatId].push(aiMsg);
            appendMessageToDOM(aiMsg);
        } catch (err) {
            const errMsg = { role: 'ai', content: `❌ 上传失败: ${err.message}` };
            state.chats[state.currentChatId].push(errMsg);
            appendMessageToDOM(errMsg);
        }
        scrollToBottom();
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ========== UI 辅助 ==========
function showTypingIndicator() {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';

    const div = document.createElement('div');
    div.className = 'message ai';
    div.id = 'typingIndicator';
    div.innerHTML = `
        <div class="msg-avatar">🤖</div>
        <div class="msg-content">
            <div class="typing-indicator"><span></span><span></span><span></span></div>
        </div>`;
    document.getElementById('chatMessages').appendChild(div);
    scrollToBottom();
    return div;
}

function removeTypingIndicator(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('hidden');
    document.querySelector('.sidebar').classList.toggle('show');
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

// ========== 模型管理 ==========
async function loadModels() {
    try {
        const resp = await fetch(`${API_BASE}/models`);
        const data = await resp.json();
        const select = document.getElementById('modelSelect');
        select.innerHTML = '';
        data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.textContent = `${m.name} (${m.size}GB)`;
            if (m.name === data.current) opt.selected = true;
            select.appendChild(opt);
        });
        state.currentModel = data.current;
        document.getElementById('modelBadge').textContent = data.current;
    } catch (err) {
        console.error('加载模型列表失败:', err);
    }
}

async function switchModel(modelName) {
    try {
        const resp = await fetch(`${API_BASE}/models/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName }),
        });
        const data = await resp.json();
        state.currentModel = data.current;
        document.getElementById('modelBadge').textContent = data.current;
        setToolbarStatus(data.message);
    } catch (err) {
        setToolbarStatus('模型切换失败');
    }
}

// ========== 文件上传 ==========
async function handleFileUploadAction(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 在聊天中显示上传提示
    const toolMsg = {
        role: 'tool',
        content: `正在上传文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        toolInfo: '文件上传',
    };
    state.chats[state.currentChatId].push(toolMsg);
    appendMessageToDOM(toolMsg);
    setToolbarStatus('上传中...');

    try {
        const formData = new FormData();
        formData.append('file', file);

        const resp = await fetch(`${API_BASE}/files/upload`, {
            method: 'POST',
            body: formData,
        });
        const data = await resp.json();

        if (data.error) {
            const errMsg = { role: 'ai', content: `❌ 上传失败: ${data.error}` };
            state.chats[state.currentChatId].push(errMsg);
            appendMessageToDOM(errMsg);
        } else {
            const aiMsg = {
                role: 'ai',
                content: `✅ 文件上传成功！\n文件名: ${file.name}\n服务器路径: ${data.file_path}\n\n你可以：\n1. 在工具模式下让AI读取此文件\n2. 在RAG模式下将文件导入知识库`,
            };
            state.chats[state.currentChatId].push(aiMsg);
            appendMessageToDOM(aiMsg);
            setToolbarStatus(`已上传: ${file.name}`);
        }
    } catch (err) {
        const errMsg = { role: 'ai', content: `❌ 上传失败: ${err.message}` };
        state.chats[state.currentChatId].push(errMsg);
        appendMessageToDOM(errMsg);
    }
    event.target.value = '';
    scrollToBottom();
}

// ========== 语音输入 ==========
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('浏览器不支持语音识别');
        return;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        document.getElementById('userInput').value = transcript;
        autoResize(document.getElementById('userInput'));
        setToolbarStatus('语音识别中...');
    };

    recognition.onend = () => {
        isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
        setToolbarStatus('语音输入完成');
    };

    recognition.onerror = (event) => {
        isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
        setToolbarStatus(`语音错误: ${event.error}`);
    };
}

function toggleVoiceInput() {
    if (!recognition) {
        setToolbarStatus('浏览器不支持语音识别，请使用 Chrome');
        return;
    }
    if (isRecording) {
        recognition.stop();
        isRecording = false;
        document.getElementById('voiceBtn').classList.remove('recording');
        setToolbarStatus('');
    } else {
        recognition.start();
        isRecording = true;
        document.getElementById('voiceBtn').classList.add('recording');
        setToolbarStatus('正在聆听...');
    }
}

// ========== 深度思考模式 ==========
function toggleDeepThink() {
    state.deepThink = !state.deepThink;
    const btn = document.getElementById('deepThinkBtn');
    btn.classList.toggle('active', state.deepThink);

    if (state.deepThink) {
        // 切换到 deepseek-r1 推理模型
        switchModel('deepseek-r1:1.5b');
        setToolbarStatus('深度思考模式已开启（deepseek-r1）');
    } else {
        // 切回主力模型
        switchModel('qwen2.5:3b');
        setToolbarStatus('深度思考模式已关闭');
    }
}

// ========== 工具栏状态 ==========
function setToolbarStatus(text) {
    const el = document.getElementById('toolbarStatus');
    if (el) el.textContent = text;
    // 3秒后自动清除
    if (text) {
        setTimeout(() => { if (el) el.textContent = ''; }, 3000);
    }
}
