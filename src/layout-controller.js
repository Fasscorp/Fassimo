// src/layout-controller.js
import Sortable from 'sortablejs'; // Import SortableJS

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

    if (!sidebar || !chatbox || !taskList || !messageInput || !sendButton || !taskTableBody || !addTaskButton) {
        console.error("Essential layout or task elements not found!");
        return;
    }

    const sidebarTopics = sidebar.querySelectorAll('.sidebar-topic');
    const accordionToggles = sidebar.querySelectorAll('.accordion-toggle');

    let currentTopic = null;
    let currentThreadId = null;
    let sortableInstance = null; // To hold the Sortable instance

    // --- Accordion Logic (remains the same) ---
    accordionToggles.forEach(toggle => { /* ... */ });

    // --- View Switching Logic (remains the same) ---
    function showView(view) {
        if (view === 'chat') {
            chatbox.style.display = 'flex';
            taskList.style.display = 'none';
        } else if (view === 'tasks') {
            chatbox.style.display = 'none';
            taskList.style.display = 'block';
            fetchAndDisplayTasks(); // Fetch tasks when view switched
        }
    }

    // --- Tasklist Link Click Handler (calls showView) ---
    if (tasklistLink) { /* ... */ }

    // --- Sidebar Topic Click Handler (remains the same) ---
    sidebarTopics.forEach(function(item) { /* ... */ });

    // --- Send Initial Message (Calls sendMessage with topic) ---
    function sendInitialMessageForTopic(topic) { /* ... */ }

    // --- Event Listeners for Sending Message (remain the same) ---
    sendButton.addEventListener('click', () => sendMessage(messageInput.value));
    messageInput.addEventListener('keypress', function(event) { /* ... */ });

    // --- Main sendMessage Function (remains the same) ---
    async function sendMessage(messageContent, isInitial = false) { /* ... */ }

    // --- Helper Functions (appendMessage, removeLoadingIndicator, scrollToBottom - remain the same) ---
    function appendMessage(sender, text, isLoading = false) { /* ... */ }
    function removeLoadingIndicator() { /* ... */ }
    function scrollToBottom(element) { /* ... */ }


    // ==================================
    // --- Task List Logic (UPDATED) ---
    // ==================================

    async function fetchAndDisplayTasks() {
        console.log("Fetching tasks...");
        // Destroy previous Sortable instance if it exists to prevent duplicates
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const tasks = await response.json();
            console.log("Tasks received:", tasks);

            taskTableBody.innerHTML = '';

            if (tasks && tasks.length > 0) {
                tasks.forEach((task, index) => {
                    const row = taskTableBody.insertRow();
                    row.dataset.taskId = task._id;
                    if(task.completed) row.classList.add('completed');

                    // Cell 0: Drag Handle
                    const cellHandle = row.insertCell();
                    const handle = document.createElement('span');
                    handle.className = 'drag-handle';
                    handle.innerHTML = '&#x2630;'; // Trigram for heaven (☰) or use :::
                    handle.title = 'Drag to reorder';
                    cellHandle.appendChild(handle);

                    // Cell 1: Row Number
                    const cellNum = row.insertCell();
                    cellNum.textContent = index + 1;

                    // Cell 2: Custom Checkbox
                    const cellCheck = row.insertCell();
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.className = 'task-checkbox-container';
                    if (task.completed) checkboxDiv.classList.add('checked');
                    checkboxDiv.addEventListener('click', (e) => {
                        const isNowChecked = checkboxDiv.classList.toggle('checked');
                        row.classList.toggle('completed', isNowChecked);
                        handleTaskCompletion(task._id, isNowChecked);
                    });
                    cellCheck.appendChild(checkboxDiv);

                    // Cell 3: Task Name
                    const cellName = row.insertCell();
                    cellName.className = 'task-name';
                    cellName.textContent = task.name || 'Unnamed Task';

                    // Cell 4: Due Date Input
                    const cellDate = row.insertCell();
                    const dateInput = document.createElement('input');
                    dateInput.type = 'date';
                    dateInput.value = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '';
                    dateInput.addEventListener('change', (e) => handleTaskUpdate(task._id, { dueDate: e.target.value }));
                    cellDate.appendChild(dateInput);

                    // Cell 5: Tags Input
                    const cellTags = row.insertCell();
                    const tagsInput = document.createElement('input');
                    tagsInput.type = 'text';
                    tagsInput.value = Array.isArray(task.tags) ? task.tags.join(', ') : (task.tags || '');
                    tagsInput.placeholder = 'Tags';
                    tagsInput.addEventListener('blur', (e) => handleTaskUpdate(task._id, { tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }));
                    cellTags.appendChild(tagsInput);

                    // Cell 6: Delete Button
                    const cellDelete = row.insertCell();
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-task-btn';
                    deleteBtn.innerHTML = '&#x1f5d1;';
                    deleteBtn.title = 'Delete Task';
                    deleteBtn.addEventListener('click', () => deleteTask(task._id, row));
                    cellDelete.appendChild(deleteBtn);
                });

                 // --- Initialize SortableJS --- START
                sortableInstance = new Sortable(taskTableBody, {
                    animation: 150,
                    handle: '.drag-handle', // Use the handle we added
                    ghostClass: 'sortable-ghost',
                    chosenClass: 'sortable-chosen',
                    dragClass: 'sortable-drag',
                    onEnd: function (evt) {
                        const itemEl = evt.item; // Dragged <tr> element
                        console.log("Drag ended!", {
                            oldIndex: evt.oldIndex,
                            newIndex: evt.newIndex,
                            taskId: itemEl.dataset.taskId
                        });
                        // Get the new order of task IDs
                        const taskRows = Array.from(taskTableBody.querySelectorAll('tr'));
                        const newOrderIds = taskRows.map(row => row.dataset.taskId);
                        console.log("New Order:", newOrderIds);

                        // TODO: Call backend to save the new order
                        // updateTaskOrderOnBackend(newOrderIds);
                    }
                });
                 // --- Initialize SortableJS --- END

            } else {
                 const row = taskTableBody.insertRow();
                 const cell = row.insertCell();
                 cell.colSpan = 7; // Adjusted colspan for handle + number
                 cell.textContent = 'No tasks found.';
                 cell.style.textAlign = 'center';
                 cell.style.fontStyle = 'italic';
            }

        } catch (error) {
            console.error("Error fetching tasks:", error);
            taskTableBody.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">Error loading tasks.</td></tr>';
        }
    }

    // --- Add Task Button Handler (remains the same) ---
    addTaskButton.addEventListener('click', async () => { /* ... */ });

    // --- Delete Task Function (remains the same) ---
    async function deleteTask(taskId, rowElement) { /* ... */ }

    // --- Update Task Completion Handler (remains the same) ---
    async function handleTaskCompletion(taskId, isCompleted) { /* ... */ }

     // --- Generic Task Update Handler (remains the same) ---
     async function handleTaskUpdate(taskId, updateData) { /* ... */ }

    // --- Initial state (remains the same) ---
    showView('chat');
    chatbox.innerHTML = '<p><em>Please select a topic from the sidebar to start chatting.</em></p>';

    // Re-add helper function definitions that were shortened above
    function appendMessage(sender, text, isLoading = false) { const p = document.createElement('p'); if (isLoading) { p.id = 'loading-indicator'; } text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>'); p.innerHTML = `<b>${sender}:</b> ${text}`; chatbox.appendChild(p); }
    function removeLoadingIndicator() { const loadingIndicator = document.getElementById('loading-indicator'); if (loadingIndicator) loadingIndicator.remove(); }
    function scrollToBottom(element) { setTimeout(() => { element.scrollTop = element.scrollHeight; }, 0); }

    // Re-add other handlers if they were shortened
    async function handleTaskCompletion(taskId, isCompleted) {
         console.log(`Updating task ${taskId} completion to ${isCompleted}`);
         try {
             const response = await fetch(`/api/tasks/${taskId}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ completed: isCompleted })
             });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
             }
             const updatedTask = await response.json();
             console.log("Task completion updated:", updatedTask);
             const row = taskTableBody.querySelector(`tr[data-task-id="${taskId}"]`);
             if(row) {
                  row.classList.toggle('completed', isCompleted);
             }
         } catch (error) {
             console.error(`Error updating task ${taskId} completion:`, error);
             alert(`Error updating task completion: ${error.message}`);
              fetchAndDisplayTasks();
         }
    }
     async function handleTaskUpdate(taskId, updateData) {
         console.log(`Updating task ${taskId} with:`, updateData);
         try {
             const response = await fetch(`/api/tasks/${taskId}`, {
                 method: 'PUT',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(updateData)
             });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
             }
             const updatedTask = await response.json();
             console.log("Task updated:", updatedTask);
         } catch (error) {
             console.error(`Error updating task ${taskId}:`, error);
             alert(`Error updating task: ${error.message}`);
             fetchAndDisplayTasks();
         }
     }
      addTaskButton.addEventListener('click', async () => {
        const newTaskData = { name: "New Task - Edit Me", completed: false, tags: [], dueDate: null };
        console.log("Adding new task...");
        try {
             const response = await fetch('/api/tasks', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(newTaskData)
             });
             if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
             }
             const createdTask = await response.json();
             console.log("Task created:", createdTask);
             fetchAndDisplayTasks();
        } catch (error) {
             console.error("Error adding task:", error);
             alert(`Error adding task: ${error.message}`);
        }
    });
     async function deleteTask(taskId, rowElement) {
        if (!taskId || !confirm("Are you sure you want to delete this task?")) return;
        console.log(`Deleting task ${taskId}...`);
        try {
            const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
            if (!response.ok) {
                 const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`);
            }
            console.log(`Task ${taskId} deleted.`);
            if(rowElement) { rowElement.remove(); }
            else { fetchAndDisplayTasks(); }
        } catch (error) {
            console.error(`Error deleting task ${taskId}:`, error);
            alert(`Error deleting task: ${error.message}`);
        }
    }
    function showView(view) { if (view === 'chat') { chatbox.style.display = 'flex'; taskList.style.display = 'none'; } else if (view === 'tasks') { chatbox.style.display = 'none'; taskList.style.display = 'block'; fetchAndDisplayTasks(); } }
     if (tasklistLink) { tasklistLink.addEventListener('click', function(event) { event.preventDefault(); showView('tasks'); sidebarTopics.forEach(el => el.classList.remove('active-topic')); currentTopic = null; currentThreadId = null; }); } else { console.warn("Tasklist link element not found!"); }
      sidebarTopics.forEach(function(item) { item.addEventListener('click', function() { sidebarTopics.forEach(el => el.classList.remove('active-topic')); item.classList.add('active-topic'); const newTopic = item.dataset.topic; console.log('Selected Topic:', newTopic); showView('chat'); if (currentTopic !== newTopic) { currentTopic = newTopic; currentThreadId = null; chatbox.innerHTML = ''; sendInitialMessageForTopic(currentTopic); } }); });
      function sendInitialMessageForTopic(topic) { if (!topic || !chatbox) return; appendMessage('System', `Switched to topic: ${topic}. Loading...`); scrollToBottom(chatbox); sendMessage(`Let's start discussing ${topic}.`, true); }

});
