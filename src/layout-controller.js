document.addEventListener('DOMContentLoaded', function() {
            const sidebar = document.getElementById('sidebar');
            const chatbox = document.getElementById('chatbox');
            const taskList = document.getElementById('task-list');
            const tasklistLink = document.getElementById('tasklist-link');
            const addTaskButton = document.getElementById('add-task-button');
            const taskTableBody = document.getElementById('task-table-body');
            const messageInput = document.getElementById('message-input');
            const sendButton = document.getElementById('send-button');

            // Check if sidebar exists before querying inside it
            if (!sidebar) {
                console.error("Sidebar element not found!");
                return; // Exit if sidebar isn't there
            }

            const sidebarTopics = sidebar.querySelectorAll('.sidebar-topic');
            const accordionToggles = sidebar.querySelectorAll('.accordion-toggle');

            let currentTopic = null; // No default topic initially

            // --- Accordion Logic ---
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
            // --- End Accordion Logic ---


            // Function to switch view between chat and task list in the #main area
            function showView(view) {
                 // Ensure elements exist before trying to modify style
                 if (!chatbox || !taskList) {
                     console.error("Chatbox or Task List element not found!");
                     return;
                 }
                if (view === 'chat') {
                    chatbox.style.display = 'flex';
                    taskList.style.display = 'none';
                } else if (view === 'tasks') {
                    chatbox.style.display = 'none';
                    taskList.style.display = 'block';
                }
            }

            // Handle clicks on the Tasklist link
            if (tasklistLink) {
                tasklistLink.addEventListener('click', function(event) {
                    event.preventDefault();
                    showView('tasks');
                    sidebarTopics.forEach(el => el.classList.remove('active-topic'));
                    currentTopic = null;
                });
            } else {
                 console.warn("Tasklist link element not found!");
            }

            // Handle clicks on sidebar topics
            sidebarTopics.forEach(function(item) {
                item.addEventListener('click', function() {
                    sidebarTopics.forEach(el => el.classList.remove('active-topic'));
                    item.classList.add('active-topic');

                    const newTopic = item.dataset.topic;
                    console.log('Selected Topic:', newTopic);

                    showView('chat'); // Ensure chat view is visible

                    if (currentTopic !== newTopic) {
                         currentTopic = newTopic;
                         if (chatbox) chatbox.innerHTML = ''; // Clear previous chat content ONLY if topic changed
                         sendInitialMessageForTopic(currentTopic);
                    }
                });
            });

           // Function to send an initial message to the AI when a topic is selected
            async function sendInitialMessageForTopic(topic) {
                if (!topic || !chatbox) return;

                appendMessage('System', `Switched to topic: ${topic}`);
                appendMessage('AI', 'Loading initial context...', true);
                scrollToBottom(chatbox);

                try {
                    const initialPrompt = `Let's discuss ${topic}. What's the first thing I should know or do regarding this?`;

                    const response = await fetch('/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: initialPrompt })
                    });

                    if (!response.ok) {
                         let errorDetails = `HTTP error! status: ${response.status}`;
                         try { const errorData = await response.json(); errorDetails += `: ${errorData.error || JSON.stringify(errorData)}`; } catch (e) { errorDetails += `: ${await response.text()}`; }
                         throw new Error(errorDetails);
                    }
                    const data = await response.json();
                    removeLoadingIndicator();
                    appendMessage('AI', data.reply);

                } catch (error) {
                     console.error('Error sending initial topic message:', error);
                     removeLoadingIndicator();
                     appendMessage('AI', `Sorry, I couldn't load information for ${topic}. ${error.message}`);
                }
                 scrollToBottom(chatbox);
            }

            // Event listener for sending chat messages from input
            if (sendButton && messageInput) {
                sendButton.addEventListener('click', sendMessage);
                messageInput.addEventListener('keypress', function(event) {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage();
                    }
                });
            } else {
                console.warn("Send button or message input element not found!");
            }

            async function sendMessage() {
                if (!messageInput || !chatbox) return; // Check elements exist

                const message = messageInput.value.trim();
                if (!message) return;

                // If task list is visible, switch back to chat view automatically
                if (taskList && taskList.style.display !== 'none') {
                    showView('chat');
                    if (!currentTopic) {
                         chatbox.innerHTML = '';
                         appendMessage('System', 'Switched back to chat. Select a topic or continue conversation.');
                    }
                }

                appendMessage('User', message);
                messageInput.value = '';
                appendMessage('AI', 'Thinking...', true); // Add loading indicator
                scrollToBottom(chatbox);

                try {
                    console.log("Sending message to /ask:", message);
                    const response = await fetch('/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message })
                    });

                    if (!response.ok) {
                         let errorDetails = `HTTP error! status: ${response.status}`;
                         try { const errorData = await response.json(); errorDetails += `: ${errorData.error || JSON.stringify(errorData)}`; } catch (e) { errorDetails += `: ${await response.text()}`; }
                         throw new Error(errorDetails);
                    }
                    const data = await response.json();
                    removeLoadingIndicator();
                    appendMessage('AI', data.reply);
                } catch (error) {
                    console.error('Error sending message:', error);
                    removeLoadingIndicator();
                    appendMessage('AI', `Sorry, I encountered an error. ${error.message}`);
                }
                 scrollToBottom(chatbox);
            }

            // Helper function to append messages
            function appendMessage(sender, text, isLoading = false) {
                 if (!chatbox) return; // Don't try to append if chatbox doesn't exist
                 const p = document.createElement('p');
                 if (isLoading) {
                     p.id = 'loading-indicator';
                 }
                 text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                 text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
                 p.innerHTML = `<b>${sender}:</b> ${text}`;
                 chatbox.appendChild(p);
            }

             // Helper function to remove loading indicator
            function removeLoadingIndicator() {
                 const loadingIndicator = document.getElementById('loading-indicator');
                 if (loadingIndicator) loadingIndicator.remove();
            }

             // Helper function to scroll chatbox to bottom
            function scrollToBottom(element) {
                 if (!element) return;
                 setTimeout(() => {
                    element.scrollTop = element.scrollHeight;
                 }, 0);
            }

            // --- Task list functionality ---
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

            // --- Initial state ---
            showView('chat'); // Show chatbox by default

        });