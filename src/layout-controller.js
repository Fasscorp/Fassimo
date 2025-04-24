document.addEventListener('DOMContentLoaded', function() {
    // ... (keep existing variable declarations) ...
    const sidebar = document.getElementById('sidebar');
    const chatbox = document.getElementById('chatbox');
    const taskList = document.getElementById('task-list');
    const tasklistLink = document.getElementById('tasklist-link');
    const addTaskButton = document.getElementById('add-task-button');
    const taskTableBody = document.getElementById('task-table-body');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    if (!sidebar || !chatbox || !taskList || !messageInput || !sendButton) {
        console.error("Essential layout elements not found!");
        return;
    }

    const sidebarTopics = sidebar.querySelectorAll('.sidebar-topic');
    const accordionToggles = sidebar.querySelectorAll('.accordion-toggle');

    let currentTopic = null;
    let currentThreadId = null; // Store thread ID per topic conversation

    // --- Accordion Logic (remains the same) ---
    accordionToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const content = toggle.nextElementSibling;
            if (content && content.classList.contains('accordion-content')) {
                content.classList.toggle('show');
                toggle.classList.toggle('active');
            } else {
                console.warn("Accordion content not found immediately after toggle:", toggle);
            }
        });
    });

    // --- View Switching Logic (remains the same) ---
    function showView(view) {
        if (view === 'chat') {
            chatbox.style.display = 'flex';
            taskList.style.display = 'none';
        } else if (view === 'tasks') {
            chatbox.style.display = 'none';
            taskList.style.display = 'block';
        }
    }

    // --- Tasklist Link Click Handler (remains the same) ---
    if (tasklistLink) {
        tasklistLink.addEventListener('click', function(event) {
            event.preventDefault();
            showView('tasks');
            sidebarTopics.forEach(el => el.classList.remove('active-topic'));
            currentTopic = null;
            currentThreadId = null;
        });
    } else {
        console.warn("Tasklist link element not found!");
    }

    // --- Sidebar Topic Click Handler (remains the same) ---
    sidebarTopics.forEach(function(item) {
        item.addEventListener('click', function() {
            sidebarTopics.forEach(el => el.classList.remove('active-topic'));
            item.classList.add('active-topic');
            const newTopic = item.dataset.topic;
            console.log('Selected Topic:', newTopic);
            showView('chat');
            if (currentTopic !== newTopic) {
                currentTopic = newTopic;
                currentThreadId = null;
                chatbox.innerHTML = '';
                sendInitialMessageForTopic(currentTopic);
            }
        });
    });

    // --- Send Initial Message (Calls sendMessage with topic) ---
    function sendInitialMessageForTopic(topic) {
        if (!topic || !chatbox) return;
        appendMessage('System', `Switched to topic: ${topic}. Loading...`);
        scrollToBottom(chatbox);
        sendMessage(`Let's start discussing ${topic}.`, true);
    }

    // --- Event Listeners for Sending Message (remain the same) ---
    sendButton.addEventListener('click', () => sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage(messageInput.value);
        }
    });

    // --- Main sendMessage Function (remains the same) ---
    async function sendMessage(messageContent, isInitial = false) {
        const message = messageContent.trim();
        if (!message) return;
        if (!currentTopic) {
            appendMessage('System', 'Please select a topic from the sidebar first.');
            return;
        }
        if (taskList && taskList.style.display !== 'none') {
            showView('chat');
        }
        if (!isInitial) {
            appendMessage('User', message);
            messageInput.value = '';
        }
        appendMessage('AI', 'Thinking...', true);
        scrollToBottom(chatbox);

        const apiUrl = '/api/chat';
        const payload = {
            message: message,
            topic: currentTopic,
            threadId: currentThreadId
        };

        try {
            console.log(`Sending message to ${apiUrl}:`, payload);
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                let errorDetails = `HTTP error! status: ${response.status}`;
                const text = await response.text();
                try { const errorData = JSON.parse(text); errorDetails += `: ${errorData.error || JSON.stringify(errorData)}`; } catch (e) { errorDetails += `: ${text}`; }
                throw new Error(errorDetails);
            }
            const data = await response.json();
            if (data.threadId && !currentThreadId) {
                currentThreadId = data.threadId;
                console.log("Received new thread ID:", currentThreadId);
            }
            removeLoadingIndicator();
            if (isInitial) {
                const systemMsg = chatbox.querySelector('p:last-child');
                if (systemMsg && systemMsg.textContent.includes('Loading...')) {
                    systemMsg.remove();
                }
            }
            appendMessage('AI', data.reply);
        } catch (error) {
            console.error('Error sending message:', error);
            removeLoadingIndicator();
            appendMessage('AI', `Sorry, I encountered an error. ${error.message}`);
        }
        scrollToBottom(chatbox);
    }

    // --- Helper Functions (remain the same) ---
    function appendMessage(sender, text, isLoading = false) {
        const p = document.createElement('p');
        if (isLoading) {
            p.id = 'loading-indicator';
        }
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
        p.innerHTML = `<b>${sender}:</b> ${text}`;
        chatbox.appendChild(p);
    }
    function removeLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) loadingIndicator.remove();
    }
    function scrollToBottom(element) {
        setTimeout(() => {
            element.scrollTop = element.scrollHeight;
        }, 0);
    }

    // --- Task list functionality (UPDATED add task part) ---
    if (addTaskButton && taskTableBody) {
        addTaskButton.addEventListener('click', function() {
            // --- Create elements programmatically --- START
            const newRow = taskTableBody.insertRow(); // Create a new row

            // Cell 1: Checkbox
            const cell1 = newRow.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            cell1.appendChild(checkbox);

            // Cell 2: Task Name (editable)
            const cell2 = newRow.insertCell();
            cell2.className = 'task-name';
            cell2.contentEditable = 'true';
            cell2.textContent = 'New Task'; // Default text

            // Cell 3: Due Date Input
            const cell3 = newRow.insertCell();
            const dateInput = document.createElement('input');
            dateInput.type = 'date';
            cell3.appendChild(dateInput);

            // Cell 4: Tags Input
            const cell4 = newRow.insertCell();
            const tagsInput = document.createElement('input');
            tagsInput.type = 'text';
            tagsInput.placeholder = 'Tags';
            cell4.appendChild(tagsInput);

            // Cell 5: Delete Button
            const cell5 = newRow.insertCell();
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-task-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', deleteTask); // Add listener directly
            cell5.appendChild(deleteBtn);
            // --- Create elements programmatically --- END
        });

        taskTableBody.addEventListener('click', function(event) {
            if (event.target.classList.contains('delete-task-btn')) {
                // Listener is now added directly when button is created,
                // so delegation listener might not be strictly needed,
                // but doesn't hurt as a fallback.
                deleteTask(event);
            }
        });
    } else {
        console.warn("Add task button or task table body not found!");
    }

    function deleteTask(event) {
        const button = event.target;
        const row = button.closest('tr');
        if (row) {
            row.remove();
        }
    }

    // --- Initial state (remains the same) ---
    showView('chat');
    chatbox.innerHTML = '<p><em>Please select a topic from the sidebar to start chatting.</em></p>';

});