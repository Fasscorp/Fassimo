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

    // --- Helper function (topicToPath - not needed anymore) ---
    // function topicToPath(topic) { ... }

    // --- Accordion Logic (remains the same) ---
    accordionToggles.forEach(toggle => { /* ... */ });

    // --- View Switching Logic (remains the same) ---
    function showView(view) { /* ... */ }

    // --- Tasklist Link Click Handler (remains the same) ---
    if (tasklistLink) { /* ... */ }

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
                 currentThreadId = null; // Reset thread ID for new topic
                 chatbox.innerHTML = ''; // Clear chatbox
                 sendInitialMessageForTopic(currentTopic);
            }
        });
    });

    // --- Send Initial Message (Calls sendMessage with topic) ---
    function sendInitialMessageForTopic(topic) {
        if (!topic || !chatbox) return;
        // Clear chatbox is now done in the click handler
        appendMessage('System', `Switched to topic: ${topic}. Loading...`);
        scrollToBottom(chatbox);
        // Send a specific initial prompt to the backend, including the topic
        sendMessage(`Let's start discussing ${topic}.`, true); // Pass flag indicating it's initial message
    }

    // --- Event Listeners for Sending Message (remain the same) ---
    sendButton.addEventListener('click', () => sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', function(event) { /* ... */ });

    // --- Main sendMessage Function (REVERTED and UPDATED) ---
    async function sendMessage(messageContent, isInitial = false) {
        const message = messageContent.trim();
        // const topicPath = topicToPath(currentTopic); // No longer needed

        if (!message) return;
        if (!currentTopic) { // Check if topic is selected
            appendMessage('System', 'Please select a topic from the sidebar first.');
            return;
        }

        // Switch view if needed (remains the same)
        if (taskList && taskList.style.display !== 'none') {
            showView('chat');
        }

        // Append user message only if not initial, clear input (remains the same)
        if (!isInitial) {
            appendMessage('User', message);
            messageInput.value = '';
        }
        appendMessage('AI', 'Thinking...', true);
        scrollToBottom(chatbox);

        // *** REVERTED: Use single endpoint, send topic in body ***
        const apiUrl = '/api/chat'; // Use the single API endpoint
        const payload = {
            message: message,
            topic: currentTopic, // Send the topic string
            threadId: currentThreadId // Send current thread ID (null if new)
        };

        try {
            console.log(`Sending message to ${apiUrl}:`, payload);

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Send message, topic, and threadId
            });

            // Error handling (remains the same)
            if (!response.ok) {
                let errorDetails = `HTTP error! status: ${response.status}`;
                const text = await response.text();
                try { const errorData = JSON.parse(text); errorDetails += `: ${errorData.error || JSON.stringify(errorData)}`; } catch (e) { errorDetails += `: ${text}`; }
                throw new Error(errorDetails);
            }

            const data = await response.json();

            // Update thread ID if received (remains the same)
            if (data.threadId && !currentThreadId) {
                currentThreadId = data.threadId;
                console.log("Received new thread ID:", currentThreadId);
            }

            // Update UI (remains the same)
            removeLoadingIndicator();
            if (isInitial) {
                 const systemMsg = chatbox.querySelector('p:last-child');
                 // Adjust check to match the actual system message
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

    // --- Helper Functions (appendMessage, removeLoadingIndicator, scrollToBottom - remain the same) ---
    function appendMessage(sender, text, isLoading = false) { /* ... */ }
    function removeLoadingIndicator() { /* ... */ }
    function scrollToBottom(element) { /* ... */ }

    // --- Task list functionality (remains the same) ---
    if (addTaskButton && taskTableBody) { /* ... */ }
    function deleteTask(event) { /* ... */ }

    // --- Initial state (remains the same) ---
    showView('chat');
    chatbox.innerHTML = '<p><em>Please select a topic from the sidebar to start chatting.</em></p>';

    // Re-add helper function definitions that were shortened above
    function appendMessage(sender, text, isLoading = false) {
         const p = document.createElement('p');
         if (isLoading) {
             p.id = 'loading-indicator';
         }
         text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
         text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
         p.innerHTML = \`<b>${sender}:</b> ${text}\`;
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
    function showView(view) {
        if (view === 'chat') {
            chatbox.style.display = 'flex';
            taskList.style.display = 'none';
        } else if (view === 'tasks') {
            chatbox.style.display = 'none';
            taskList.style.display = 'block';
        }
    }
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
     if (addTaskButton && taskTableBody) {
         addTaskButton.addEventListener('click', function() {
            const newRow = taskTableBody.insertRow();
             newRow.innerHTML = `
                 <td><input type="checkbox"></td>
                 <td class="task-name" contenteditable="true">New Task</td>
                 <td><input type="date"></td>
                 <td><input type="text" placeholder="Tags"></td>
                 <td><button class="delete-task-btn">Delete</button></td>
             `;
             const deleteBtn = newRow.querySelector('.delete-task-btn');
             if (deleteBtn) {
                 deleteBtn.addEventListener('click', deleteTask);
             }
        });
         taskTableBody.addEventListener('click', function(event) {
             if (event.target.classList.contains('delete-task-btn')) {
                 deleteTask(event);
             }
         });
    } else { console.warn("Add task button or task table body not found!"); }
    function deleteTask(event) {
        const button = event.target;
        const row = button.closest('tr');
        if (row) {
            row.remove();
        }
     }

});