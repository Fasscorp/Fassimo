// src/layout-controller.js
import Sortable from 'sortablejs';

document.addEventListener('DOMContentLoaded', function() {
    // --- Element References ---
    const sidebar = document.getElementById('sidebar');
    const chatbox = document.getElementById('chatbox');
    const inputArea = document.getElementById('input-area'); 
    const taskListContainer = document.getElementById('task-list');
    const taskTableContainer = document.getElementById('task-table-container');
    const taskDetailView = document.getElementById('task-detail-view');
    const tasklistLink = document.getElementById('tasklist-link');
    const addTaskButton = document.getElementById('add-task-button');
    const taskTableBody = document.getElementById('task-table-body');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const taskDetailId = document.getElementById('task-detail-id');
    const taskDetailName = document.getElementById('task-detail-name');
    const taskDetailDescription = document.getElementById('task-detail-description');
    const taskDetailCreated = document.getElementById('task-detail-created');
    const taskDetailUpdated = document.getElementById('task-detail-updated');
    const taskDetailCloseBtn = document.getElementById('task-detail-close');
    const taskDetailSaveBtn = document.getElementById('task-detail-save');

    if (!sidebar || !chatbox || !taskListContainer || !messageInput || !sendButton || !taskTableBody || !addTaskButton || !inputArea || !taskTableContainer || !taskDetailView || !taskDetailId || !taskDetailName || !taskDetailDescription || !taskDetailCreated || !taskDetailUpdated || !taskDetailCloseBtn || !taskDetailSaveBtn) {
        console.error("Essential layout, task, or detail elements not found! Check the logs.");
        console.error({ sidebar, chatbox, taskListContainer, messageInput, sendButton, taskTableBody, addTaskButton, inputArea, taskTableContainer, taskDetailView, taskDetailId, taskDetailName, taskDetailDescription, taskDetailCreated, taskDetailUpdated, taskDetailCloseBtn, taskDetailSaveBtn });
        return; 
    }
    console.log("All essential elements found.");

    const sidebarTopics = sidebar.querySelectorAll('.sidebar-topic');
    const accordionToggles = sidebar.querySelectorAll('.accordion-toggle');

    // --- State Variables ---
    let currentTopic = null;
    let currentThreadId = null;
    let sortableInstance = null;
    let currentTasks = [];
    let selectedTaskId = null;

    // --- Accordion Logic --- 
    accordionToggles.forEach(toggle => {
         toggle.addEventListener('click', () => {
             const content = toggle.nextElementSibling;
             if (content && content.classList.contains('accordion-content')) {
                 content.classList.toggle('show');
                 toggle.classList.toggle('active');
             } else {
                 console.warn("Accordion content not found:", toggle);
             }
         });
     });

    // --- View Switching Logic --- 
    function showView(view) {
        if (view === 'chat') {
            chatbox.style.display = 'flex';
            inputArea.style.display = 'flex'; 
            taskListContainer.style.display = 'none';
            hideTaskDetails(); 
        } else if (view === 'tasks') {
            chatbox.style.display = 'none';
            inputArea.style.display = 'none'; 
            taskListContainer.style.display = 'flex'; 
            fetchAndDisplayTasks(); 
        }
    }

    // --- Tasklist Link Click Handler --- 
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

    // --- Sidebar Topic Click Handler --- 
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

    // --- Send Initial Message --- 
    function sendInitialMessageForTopic(topic) {
         if (!topic || !chatbox) return;
         appendMessage('System', `Switched to topic: ${topic}. Loading...`);
         scrollToBottom(chatbox);
         sendMessage(`Let's start discussing ${topic}.`, true);
     }

    // --- Send Message Logic --- 
    sendButton.addEventListener('click', () => {
        console.log("Send button CLICKED!"); 
        sendMessage(messageInput.value)
    });
    messageInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            console.log("Enter key pressed in input!"); 
            event.preventDefault();
            sendMessage(messageInput.value);
        }
     });
    async function sendMessage(messageContent, isInitial = false) {
         console.log("sendMessage function called. Initial:", isInitial, "Content:", messageContent);
         const message = messageContent.trim();
         if (!message) {
              console.log("sendMessage: Message empty, returning.");
              return;
         }
         if (!currentTopic) {
             appendMessage('System', 'Please select a topic from the sidebar first.');
             return;
         }
         if (taskListContainer && taskListContainer.style.display !== 'none') {
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
             console.log(`Sending fetch to ${apiUrl}:`, payload);
             const response = await fetch(apiUrl, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(payload)
             });
             console.log("Fetch response received, status:", response.status);
             if (!response.ok) {
                 let errorDetails = `HTTP error! status: ${response.status}`;
                 const text = await response.text();
                 try { const errorData = JSON.parse(text); errorDetails += `: ${errorData.error || JSON.stringify(errorData)}`; } catch (e) { errorDetails += `: ${text}`; }
                 throw new Error(errorDetails);
             }
             const data = await response.json();
             console.log("Fetch response data:", data);
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

    // --- Helper Functions --- 
    function appendMessage(sender, text, isLoading = false) {
         // console.log(`Appending message: ${sender} - ${isLoading ? '(Thinking)' : text.substring(0,30)}`); 
         const p = document.createElement('p');
         if (isLoading) {
             p.id = 'loading-indicator';
         }
         text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
         text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
         p.innerHTML = `<b>${sender}:</b> ${text}`;
         if (!chatbox) {
              console.error("CANNOT APPEND MESSAGE - CHATBOX NOT FOUND");
              return;
         }
         chatbox.appendChild(p);
     }
    function removeLoadingIndicator() { const loadingIndicator = document.getElementById('loading-indicator'); if (loadingIndicator) loadingIndicator.remove(); }
    function scrollToBottom(element) { if(element) { setTimeout(() => { element.scrollTop = element.scrollHeight; }, 0); } }

    // ==================================
    // --- Task List Logic ---
    // ==================================

    async function fetchAndDisplayTasks() {
         console.log("Fetching tasks...");
         if (sortableInstance) {
             sortableInstance.destroy();
             sortableInstance = null;
         }
         hideTaskDetails(); 
         try {
             const response = await fetch('/api/tasks');
             if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
             currentTasks = await response.json(); 
             console.log("Tasks received:", currentTasks);
 
             renderTaskList(currentTasks);
 
         } catch (error) {
             console.error("Error fetching tasks:", error);
             taskTableBody.innerHTML = '<tr><td colspan="7" style="color: red; text-align: center;">Error loading tasks.</td></tr>';
         }
     }

    function renderTaskList(tasks) {
         taskTableBody.innerHTML = ''; 
         if (tasks && tasks.length > 0) {
             tasks.forEach((task, index) => {
                 const row = taskTableBody.insertRow();
                 row.dataset.taskId = task._id;
                 if(task.completed) row.classList.add('completed');
                 if(task._id === selectedTaskId) row.classList.add('selected'); 
 
                 // Click listener for the ROW (for selection/detail view)
                 row.addEventListener('click', (e) => {
                     // Check if the click originated on an interactive element we want to ignore for row selection
                    if (e.target.closest('.drag-handle, input, button, .task-checkbox-container, .task-name')) {
                        return; 
                    }
                    handleRowSelection(task._id, row);
                 });
 
                 // --- Create Cells ---
                 const cellHandle = row.insertCell(); 
                 const handle = document.createElement('span'); 
                 handle.className = 'drag-handle'; 
                 handle.innerHTML = '&#x2630;'; 
                 handle.title = 'Drag to reorder'; 
                 cellHandle.appendChild(handle);
                 
                 const cellNum = row.insertCell(); 
                 cellNum.textContent = index + 1;
                 
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
                 
                 const cellName = row.insertCell(); 
                 cellName.className = 'task-name'; 
                 cellName.textContent = task.name || 'Unnamed Task'; 
                 // Click listener specifically for the task name cell to enable editing
                 cellName.addEventListener('click', (e) => { 
                    // Stop propagation NOT needed if row listener checks target correctly
                    // e.stopPropagation(); 
                    console.log('Task name cell CLICKED!', cellName);
                    makeTaskNameEditable(cellName, task._id);
                 });
                 
                 const cellDate = row.insertCell(); 
                 const dateInput = document.createElement('input'); 
                 dateInput.type = 'date'; 
                 dateInput.value = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''; 
                 dateInput.addEventListener('change', (e) => handleTaskUpdate(task._id, { dueDate: e.target.value })); 
                 cellDate.appendChild(dateInput);
                 
                 const cellTags = row.insertCell(); 
                 const tagsInput = document.createElement('input'); 
                 tagsInput.type = 'text'; 
                 tagsInput.value = Array.isArray(task.tags) ? task.tags.join(', ') : (task.tags || ''); 
                 tagsInput.placeholder = 'Tags'; 
                 tagsInput.addEventListener('blur', (e) => handleTaskUpdate(task._id, { tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) })); 
                 cellTags.appendChild(tagsInput);
                 
                 const cellDelete = row.insertCell(); 
                 const deleteBtn = document.createElement('button'); 
                 deleteBtn.className = 'delete-task-btn'; 
                 deleteBtn.innerHTML = '&#x1f5d1;'; 
                 deleteBtn.title = 'Delete Task'; 
                 deleteBtn.addEventListener('click', () => deleteTask(task._id, row)); 
                 cellDelete.appendChild(deleteBtn);
             });
 
             // --- Initialize SortableJS (Using handle ONLY) ---
             sortableInstance = new Sortable(taskTableBody, {
                 animation: 150,
                 handle: '.drag-handle', // Dragging starts only on elements with this class
                 // filter: '.task-name, input, button, .task-checkbox-container', // Filter might not be needed if handle works correctly
                 // preventOnFilter: true, 
                 ghostClass: 'sortable-ghost',
                 chosenClass: 'sortable-chosen',
                 dragClass: 'sortable-drag',
                 onEnd: function (evt) {
                     const itemEl = evt.item; 
                     console.log("Drag ended!", { oldIndex: evt.oldIndex, newIndex: evt.newIndex, taskId: itemEl.dataset.taskId });
                     const taskRows = Array.from(taskTableBody.querySelectorAll('tr'));
                     const newOrderIds = taskRows.map(row => row.dataset.taskId);
                     console.log("New Order:", newOrderIds);
                     // TODO: Call backend to save the new order
                     // updateTaskOrderOnBackend(newOrderIds);
                 }
             });
 
         } else {
              const row = taskTableBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 7; cell.textContent = 'No tasks found.'; cell.style.textAlign = 'center'; cell.style.fontStyle = 'italic';
         }
     }

    // --- Row Selection and Detail View Logic ---
    function handleRowSelection(taskId, clickedRow) { console.log("Row selected:", taskId); selectedTaskId = taskId; const rows = taskTableBody.querySelectorAll('tr'); rows.forEach(row => row.classList.remove('selected')); clickedRow.classList.add('selected'); const task = currentTasks.find(t => t._id === taskId); if (task) { showTaskDetails(task); } else { console.error("Selected task not found in cache?"); hideTaskDetails(); } }
    function showTaskDetails(task) { console.log("Showing details for task:", task); taskDetailId.value = task._id; taskDetailName.value = task.name || ''; taskDetailDescription.value = task.description || ''; taskDetailCreated.textContent = task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'; taskDetailUpdated.textContent = task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'N/A'; taskDetailView.style.display = 'block'; }
    function hideTaskDetails() { console.log("Hiding task details"); taskDetailView.style.display = 'none'; selectedTaskId = null; const rows = taskTableBody.querySelectorAll('tr.selected'); rows.forEach(row => row.classList.remove('selected')); }
    taskDetailCloseBtn.addEventListener('click', hideTaskDetails);
    taskDetailSaveBtn.addEventListener('click', async () => { const taskId = taskDetailId.value; if (!taskId) return; const updatedData = { name: taskDetailName.value, description: taskDetailDescription.value }; console.log(`Saving details for task ${taskId}:`, updatedData); await handleTaskUpdate(taskId, updatedData); fetchAndDisplayTasks(); });

    // --- Make Task Name Editable Function --- 
    function makeTaskNameEditable(cell, taskId) { console.log('makeTaskNameEditable called for cell:', cell, 'taskId:', taskId); if (cell.isContentEditable) { console.log('Already editing, returning.'); return; } const originalText = cell.textContent; cell.contentEditable = 'true'; console.log('Set contentEditable to true'); cell.focus(); console.log('Cell focused'); cell.classList.add('editing'); try { const range = document.createRange(); range.selectNodeContents(cell); const selection = window.getSelection(); if (selection) { selection.removeAllRanges(); selection.addRange(range); console.log('Text selected');} else { console.warn('Could not get window selection.'); } } catch (e) { console.error("Error selecting text:", e); } const handleBlur = async () => { console.log('Blur event on cell', cell); cell.contentEditable = 'false'; cell.classList.remove('editing'); const newName = cell.textContent.trim(); cell.removeEventListener('blur', handleBlur); cell.removeEventListener('keydown', handleKeyDown); console.log('Removed blur/keydown listeners'); if (newName && newName !== originalText) { console.log(`Saving new name: ${newName} for task ${taskId}`); await handleTaskUpdate(taskId, { name: newName }); if (selectedTaskId === taskId) { taskDetailName.value = newName; } } else { console.log(`Name unchanged or empty, reverting to: ${originalText}`); cell.textContent = originalText; } }; const handleKeyDown = (event) => { console.log(`Keydown event: ${event.key}`); if (event.key === 'Enter') { event.preventDefault(); console.log('Enter pressed, triggering blur'); cell.blur(); } else if (event.key === 'Escape') { console.log('Escape pressed, reverting'); cell.contentEditable = 'false'; cell.classList.remove('editing'); cell.textContent = originalText; cell.removeEventListener('blur', handleBlur); cell.removeEventListener('keydown', handleKeyDown); console.log('Removed blur/keydown listeners after escape'); } }; cell.addEventListener('blur', handleBlur); cell.addEventListener('keydown', handleKeyDown); console.log('Added blur/keydown listeners'); }

    // --- Add Task Button Handler ---
    addTaskButton.addEventListener('click', async () => { const newTaskData = { name: "New Task - Edit Me", completed: false, tags: [], dueDate: null }; console.log("Adding new task..."); try { const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newTaskData) }); if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`); } const createdTask = await response.json(); console.log("Task created:", createdTask); fetchAndDisplayTasks(); } catch (error) { console.error("Error adding task:", error); alert(`Error adding task: ${error.message}`); } });
    // --- Delete Task Function ---
    async function deleteTask(taskId, rowElement) { if (!taskId || !confirm("Are you sure you want to delete this task?")) return; console.log(`Deleting task ${taskId}...`); try { const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' }); if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`); } console.log(`Task ${taskId} deleted.`); if(rowElement) { rowElement.remove(); } else { fetchAndDisplayTasks(); } if(selectedTaskId === taskId) { hideTaskDetails(); } } catch (error) { console.error(`Error deleting task ${taskId}:`, error); alert(`Error deleting task: ${error.message}`); } }
    // --- Update Task Completion Handler ---
    async function handleTaskCompletion(taskId, isCompleted) { console.log(`Updating task ${taskId} completion to ${isCompleted}`); try { const response = await fetch(`/api/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: isCompleted }) }); if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`); } const updatedTask = await response.json(); console.log("Task completion updated:", updatedTask); const row = taskTableBody.querySelector(`tr[data-task-id="${taskId}"]`); if(row) { row.classList.toggle('completed', isCompleted); } const taskIndex = currentTasks.findIndex(t => t._id === taskId); if (taskIndex > -1) currentTasks[taskIndex].completed = isCompleted; } catch (error) { console.error(`Error updating task ${taskId} completion:`, error); alert(`Error updating task completion: ${error.message}`); fetchAndDisplayTasks(); } }
    // --- Generic Task Update Handler ---
    async function handleTaskUpdate(taskId, updateData) { console.log(`Updating task ${taskId} with:`, updateData); try { const response = await fetch(`/api/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateData) }); if (!response.ok) { const errorData = await response.json(); throw new Error(`HTTP error! status: ${response.status} - ${errorData.error || 'Unknown error'}`); } const updatedTask = await response.json(); console.log("Task updated:", updatedTask); const taskIndex = currentTasks.findIndex(t => t._id === taskId); if (taskIndex > -1) currentTasks[taskIndex] = {...currentTasks[taskIndex], ...updatedTask }; } catch (error) { console.error(`Error updating task ${taskId}:`, error); alert(`Error updating task: ${error.message}`); fetchAndDisplayTasks(); } }

    // --- Initial state ---
    showView('chat');
    chatbox.innerHTML = '<p><em>Please select a topic from the sidebar to start chatting.</em></p>';

});
