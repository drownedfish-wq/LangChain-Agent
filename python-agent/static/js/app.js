/**
 * 本地智能体平台 - 前端逻辑
 * 支持：对话记忆、流式输出、工具调用可视化、RAG问答
 */

// ========== 状态管理 ==========
const state = {
    currentChatId: 'default',
    currentMode: 'chat',       // chat | tool | rag
    isStreaming: false,
    chats: {},                  // { chatId: [ {role, content, toolInfo?} ] }
};

const API_BASE = '/api';

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    createNewChat();
    document.getElementById('userInput').focus();
});

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
    if (msgs.length === 0) {
        clearMessages();
        return;
    }
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
    // 简单的代码块和换行处理
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

    // 添加用户消息
    const userMsg = { role: 'user', content: text };
    if (!state.chats[state.currentChatId]) state.chats[state.currentChatId] = [];
    state.chats[state.currentChatId].push(userMsg);
    appendMessageToDOM(userMsg);
    renderChatList();

    // 显示打字指示器
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
        const errMsg = { role: 'ai', content: `❌ 请求失败: ${err.message}` };
        state.chats[state.currentChatId].push(errMsg);
        appendMessageToDOM(errMsg);
    } finally {
        state.isStreaming = false;
        document.getElementById('sendBtn').disabled = false;
        scrollToBottom();
    }
}

// ========== 对话模式 ==========
async function handleChatMode(text, typingDiv) {
    // 使用流式接口
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

    // 如果响应中包含工具调用信息，额外显示
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

    // 读取文件内容
    const reader = new FileReader();
    reader.onload = async (e) => {
        const content = e.target.result;
        const collection = document.getElementById('ragCollection').value || 'default';

        // 通过 API 临时保存文件到服务端再上传
        // 这里简化：先显示提示
        const toolMsg = {
            role: 'tool',
            content: `正在上传文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
            toolInfo: '文件上传',
        };
        state.chats[state.currentChatId].push(toolMsg);
        appendMessageToDOM(toolMsg);

        // 由于 API 需要 file_path，我们需要先存文件再调用
        // 暂时用模拟方式提示用户填写文件路径
        const aiMsg = {
            role: 'ai',
            content: `📎 文件 "${file.name}" 已选择。\n\n请通过 API 上传文件到知识库：\nPOST /api/rag/upload\n{\n  "file_path": "本地文件路径",\n  "collection_name": "${collection}"\n}\n\n💡 提示：目前 RAG 文件上传需要填写服务器可访问的文件路径。`,
        };
        state.chats[state.currentChatId].push(aiMsg);
        appendMessageToDOM(aiMsg);
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
