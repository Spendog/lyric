/**
 * Songwriting App Core Logic
 * Handles Encryption, Document Management, and UI Interactions
 */

// --- Constants & State ---
const STORAGE_KEYS = {
    DOCUMENTS: 'secure_documents_v2',
    DEVICE_ID: 'device_id',
    DEVICE_NAME: 'device_name',
    SESSION: 'session_active'
};

const THEME_BANKS = {
    medical: ['alveoli', 'bronchi', 'diffusion', 'capillaries', 'hemoglobin', 'ventricle', 'oxygenate', 'carbon dioxide', 'heartbeat', 'trachea', 'bloodstream'],
    nature: ['mountains', 'rivers', 'forests', 'oceans', 'meadows', 'sunrise', 'moonlight', 'storms', 'seasons', 'wilderness'],
    emotions: ['longing', 'euphoria', 'melancholy', 'passion', 'serenity', 'turbulence', 'hope', 'despair', 'love', 'freedom'],
    urban: ['neon', 'concrete', 'subway', 'skyscrapers', 'traffic', 'crowds', 'streetlights', 'sirens', 'windows', 'shadows']
};

const RHYME_DB = {
    "love": ["dove", "shove", "above", "glove", "of"],
    "fire": ["desire", "liar", "choir", "higher", "wire"],
    "night": ["light", "sight", "flight", "bright", "might"],
    "heart": ["start", "part", "art", "smart", "apart"],
    "time": ["rhyme", "climb", "prime", "mime", "sublime"],
    "pain": ["rain", "gain", "strain", "chain", "main"],
    "dream": ["stream", "cream", "beam", "team", "seem"]
};

const STATES = {
    IDLE: 'IDLE',
    ACTIVE: 'ACTIVE',
    SAVING: 'SAVING',
    FETCHING: 'FETCHING',
    LOADING_MODEL: 'LOADING_MODEL',
    PROCESSING_AUDIO: 'PROCESSING_AUDIO',
    ERROR: 'ERROR'
};

let state = {
    cryptoKey: null,
    documents: {},
    currentDocId: null,
    autoSaveTimer: null,
    status: STATES.IDLE
};

function setState(newState) {
    console.log(`State Transition: ${state.status} -> ${newState}`);
    state.status = newState;

    const indicator = document.getElementById('status-indicator');
    if (!indicator) return;

    switch (newState) {
        case STATES.IDLE:
            indicator.textContent = 'Ready';
            indicator.className = 'status-badge';
            break;
        case STATES.ACTIVE:
            indicator.textContent = 'Typing...';
            indicator.className = 'status-badge saving';
            break;
        case STATES.FETCHING:
            indicator.textContent = 'Fetching...';
            indicator.className = 'status-badge';
            break;
        case STATES.LOADING_MODEL:
            indicator.textContent = 'Loading AI...';
            indicator.className = 'status-badge';
            break;
        case STATES.PROCESSING_AUDIO:
            indicator.textContent = 'Thinking...';
            indicator.className = 'status-badge saving';
            break;
        case STATES.SAVING:
            indicator.textContent = 'Saving...';
            indicator.className = 'status-badge saving';
            break;
        case STATES.ERROR:
            indicator.textContent = 'Error';
            indicator.className = 'status-badge error'; // Add error style if needed
            break;
        case STATES.ERROR:
            indicator.textContent = 'Error';
            indicator.className = 'status-badge error'; // Add error style if needed
            break;
    }
}

// --- Security System ---

async function deriveKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: enc.encode("creative-journal-salt-2025"),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptData(data, key) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(data))
    );
    return {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(ciphertext))
    };
}

async function decryptData(encrypted, key) {
    const dec = new TextDecoder();
    const iv = new Uint8Array(encrypted.iv);
    const data = new Uint8Array(encrypted.data);
    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv }, key, data
        );
        return JSON.parse(dec.decode(decrypted));
    } catch (err) {
        console.error('Decryption failed:', err);
        return null;
    }
}

// --- Document Management ---

async function saveDocuments() {
    if (!state.cryptoKey) return;

    setState(STATES.SAVING);

    try {
        const encrypted = await encryptData(state.documents, state.cryptoKey);
        localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(encrypted));

        // Simulate network delay for visual feedback if needed, or just switch back
        setTimeout(() => setState(STATES.IDLE), 500);
    } catch (e) {
        console.error("Save failed", e);
        setState(STATES.ERROR);
    }
}

async function loadDocuments() {
    const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    if (saved && state.cryptoKey) {
        const decrypted = await decryptData(JSON.parse(saved), state.cryptoKey);
        if (decrypted) {
            state.documents = decrypted;
            renderDocumentList();
        }
    }
}

function createDocument() {
    const name = prompt("Enter song title:");
    if (!name) return;

    const id = crypto.randomUUID();
    state.documents[id] = {
        id: id,
        title: name,
        created: Date.now(),
        blocks: [createBlockData('verse')]
    };

    state.currentDocId = id;
    saveDocuments();
    renderDocumentList();
    loadDocument(id);
}

function createBlockData(type) {
    return {
        id: crypto.randomUUID(),
        type: type,
        content: ''
    };
}

// --- UI Rendering ---

function renderDocumentList() {
    const select = document.getElementById('doc-select');
    select.innerHTML = '<option value="">Select Song...</option>';

    Object.values(state.documents).forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = doc.title;
        select.appendChild(option);
    });

    if (state.currentDocId) {
        select.value = state.currentDocId;
    }
}

function loadDocument(id) {
    if (!state.documents[id]) return;
    state.currentDocId = id;

    const doc = state.documents[id];
    const container = document.getElementById('writing-area');
    container.innerHTML = '';

    doc.blocks.forEach(block => {
        container.appendChild(createBlockElement(block));
    });

    updateStats();
}

function createBlockElement(blockData) {
    const div = document.createElement('div');
    div.className = 'block glass-panel';
    div.dataset.id = blockData.id;

    div.innerHTML = `
        <div class="block-header">
            <span class="block-type">${blockData.type}</span>
            <div class="block-actions">
                <button class="btn btn-icon" onclick="toggleSpeech('${blockData.id}')" title="Voice Input">🎤</button>
                <button class="btn btn-icon" onclick="removeBlock('${blockData.id}')" title="Delete Block">🗑️</button>
            </div>
        </div>
        <textarea class="editor" placeholder="Write lyrics here..." oninput="handleInput('${blockData.id}', this)">${blockData.content}</textarea>
    `;

    return div;
}

function addBlock(type) {
    if (!state.currentDocId) {
        alert("Create or select a song first!");
        return;
    }

    const newBlock = createBlockData(type);
    state.documents[state.currentDocId].blocks.push(newBlock);

    const container = document.getElementById('writing-area');
    container.appendChild(createBlockElement(newBlock));

    saveDocuments();
}

function removeBlock(blockId) {
    if (!confirm("Delete this block?")) return;

    const doc = state.documents[state.currentDocId];
    doc.blocks = doc.blocks.filter(b => b.id !== blockId);

    const el = document.querySelector(`.block[data-id="${blockId}"]`);
    if (el) el.remove();

    saveDocuments();
}

// --- Interactions ---

function handleInput(blockId, textarea) {
    const doc = state.documents[state.currentDocId];
    const block = doc.blocks.find(b => b.id === blockId);
    if (block) {
        block.content = textarea.value;
    }

    if (state.status !== STATES.ACTIVE) {
        setState(STATES.ACTIVE);
    }

    // Debounced Autosave
    clearTimeout(state.autoSaveTimer);
    state.autoSaveTimer = setTimeout(() => {
        saveDocuments();
        updateStats();
    }, 1000);
}

// Removed updateStatus as it is replaced by setState logic

function updateStats() {
    if (!state.currentDocId) return;
    const doc = state.documents[state.currentDocId];
    let words = 0;
    doc.blocks.forEach(b => {
        words += b.content.trim().split(/\s+/).filter(w => w.length > 0).length;
    });
    document.getElementById('stat-words').textContent = words;
}

// --- Auth Flow ---

async function unlockApp() {
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error');

    if (!password) {
        errorMsg.textContent = "Please enter a password";
        return;
    }

    try {
        state.cryptoKey = await deriveKey(password);

        // Try to decrypt existing data to verify password
        const saved = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
        if (saved) {
            const test = await decryptData(JSON.parse(saved), state.cryptoKey);
            if (test === null) {
                errorMsg.textContent = "Incorrect password";
                return;
            }
            state.documents = test;
        }

        document.getElementById('auth-overlay').style.display = 'none';
        renderDocumentList();

        // Load first doc if exists
        const docIds = Object.keys(state.documents);
        if (docIds.length > 0) {
            loadDocument(docIds[0]);
        }

    } catch (e) {
        console.error(e);
        errorMsg.textContent = "Authentication failed";
    }
}

// --- Inspiration Tools ---

function loadTheme(theme) {
    const words = THEME_BANKS[theme];
    const container = document.getElementById('word-bank');
    container.innerHTML = '';

    words.forEach(word => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.textContent = word;
        chip.onclick = () => insertWord(word);
        container.appendChild(chip);
    });
}

function insertWord(word) {
    // Find active or last focused textarea
    // For simplicity, just append to the last block if none focused
    // In a real app, we'd track cursor position globally
    alert(`Clicked ${word} - (Cursor insertion to be implemented)`);
}

// --- Local Speech to Text (Transformers.js) ---
let transcriber = null;
let mediaRecorder = null;
let audioChunks = [];

async function toggleSpeech(blockId) {
    // Check if recording
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setState(STATES.PROCESSING_AUDIO);
        return;
    }

    // Initialize Model if needed
    if (!transcriber) {
        setState(STATES.LOADING_MODEL);
        try {
            // Using window.pipeline from index.html
            transcriber = await window.pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        } catch (e) {
            console.error("Model Load Failed", e);
            setState(STATES.ERROR);
            alert("Failed to load AI model. Check internet connection for first download.");
            return;
        }
    }

    // Start Recording
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await processAudio(audioBlob, blockId);

            // Stop all tracks to release mic
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setState(STATES.ACTIVE);

        // Visual feedback
        const btn = document.querySelector(`.block[data-id="${blockId}"] .btn-icon[title="Voice Input"]`);
        if (btn) btn.style.background = 'var(--accent-danger)';

    } catch (e) {
        console.error("Mic Error", e);
        alert("Microphone access denied.");
        setState(STATES.ERROR);
    }
}

async function processAudio(audioBlob, blockId) {
    try {
        // Convert Blob to AudioBuffer
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get channel data (Whisper expects mono, 16kHz usually, but library handles resampling)
        let audioData = audioBuffer.getChannelData(0);

        // Run Inference
        const output = await transcriber(audioData);
        const text = output.text;

        if (text) {
            const doc = state.documents[state.currentDocId];
            const block = doc.blocks.find(b => b.id === blockId);
            if (block) {
                block.content += (block.content ? ' ' : '') + text.trim();

                // Update UI
                const textarea = document.querySelector(`.block[data-id="${blockId}"] textarea`);
                if (textarea) textarea.value = block.content;

                handleInput(blockId, textarea); // Trigger save
            }
        }

        setState(STATES.IDLE);

        // Reset button style
        const btn = document.querySelector(`.block[data-id="${blockId}"] .btn-icon[title="Voice Input"]`);
        if (btn) btn.style.background = '';

    } catch (e) {
        console.error("Transcription Error", e);
        setState(STATES.ERROR);
    }
}

// Initialize
window.onload = () => {
    loadTheme('nature');
};
