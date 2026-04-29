document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const taskInput = document.getElementById('new-task');
    const dueDateInput = document.getElementById('due-date');
    const dueTimeInput = document.getElementById('due-time');
    const prioritySelect = document.getElementById('priority-select');
    const categorySelect = document.getElementById('category-select');
    const addButton = document.getElementById('add-button');
    
    function updateSelectColor(el) {
        if (!el) return;
        if (el.tagName === 'INPUT' && el.type === 'hidden') {
            const wrapper = el.closest('.custom-select-wrapper');
            if (wrapper) {
                const display = wrapper.querySelector('.custom-select');
                const opt = wrapper.querySelector(`.custom-option[data-value="${el.value}"]`);
                if (display && opt) {
                    display.className = `custom-select bg-${el.value}`;
                    display.textContent = opt.textContent;
                }
            }
        } else {
            el.classList.remove('bg-high', 'bg-medium', 'bg-low');
            el.classList.add('bg-' + el.value);
        }
    }
    
    function setupCustomDropdowns() {
        document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
            const display = wrapper.querySelector('.custom-select');
            const optionsContainer = wrapper.querySelector('.custom-options');
            const hiddenInput = wrapper.querySelector('input[type="hidden"]');
            const options = wrapper.querySelectorAll('.custom-option');

            if(display) display.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !optionsContainer.classList.contains('hidden');
                document.querySelectorAll('.custom-options').forEach(c => c.classList.add('hidden')); 
                if (!isOpen) optionsContainer.classList.remove('hidden');
            });

            options.forEach(opt => {
                opt.addEventListener('mouseenter', () => {
                    const val = opt.getAttribute('data-value');
                    if(display) {
                        display.className = `custom-select bg-${val}`;
                        display.textContent = opt.textContent;
                    }
                });

                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const val = opt.getAttribute('data-value');
                    hiddenInput.value = val;
                    if(display) {
                        display.className = `custom-select bg-${val}`;
                        display.textContent = opt.textContent;
                    }
                    optionsContainer.classList.add('hidden');
                    hiddenInput.dispatchEvent(new Event('change'));
                });
            });

            if(optionsContainer) optionsContainer.addEventListener('mouseleave', () => {
                const val = hiddenInput.value;
                const selectedOpt = wrapper.querySelector(`.custom-option[data-value="${val}"]`);
                if (selectedOpt && display) {
                    display.className = `custom-select bg-${val}`;
                    display.textContent = selectedOpt.textContent;
                }
            });
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.custom-options').forEach(c => c.classList.add('hidden'));
            document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
                const display = wrapper.querySelector('.custom-select');
                const hiddenInput = wrapper.querySelector('input[type="hidden"]');
                const selectedOpt = wrapper.querySelector(`.custom-option[data-value="${hiddenInput.value}"]`);
                if (selectedOpt && display) {
                    display.className = `custom-select bg-${hiddenInput.value}`;
                    display.textContent = selectedOpt.textContent;
                }
            });
        });
    }
    setupCustomDropdowns();
    const navBtns = document.querySelectorAll('.nav-btn');
    const viewPanels = document.querySelectorAll('.view-panel');
    const micBtn = document.getElementById('mic-btn');

    const lists = {
        'todo-today': document.getElementById('list-todo-today'),
        'todo-later': document.getElementById('list-todo-later'),
        'in-progress': document.getElementById('list-in-progress'),
        'done': document.getElementById('list-done')
    };
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const shortcutsBtn = document.getElementById('shortcuts-btn');
    const shortcutsModal = document.getElementById('shortcuts-modal');

    // Mobile specific
    const fabAdd = document.getElementById('fab-add'), bottomSheet = document.getElementById('bottom-sheet'), bottomSheetOverlay = document.getElementById('bottom-sheet-overlay'), inputSection = document.getElementById('input-section'), mobileInputContainer = document.getElementById('mobile-input-container');

    // Multi-select & Bulk
    let selectedTasks = new Set();
    const bulkActionBar = document.getElementById('bulk-action-bar'), bulkCount = document.getElementById('bulk-count');
    const remainingTasksBadge = document.getElementById('remaining-tasks-count');

    // Split Detail Panel
    const detailPanel = document.getElementById('detail-panel');
    const dtTitle = document.getElementById('dt-title'), dtNotes = document.getElementById('dt-notes'), dtDate = document.getElementById('dt-date'), dtTime = document.getElementById('dt-time'), dtPriority = document.getElementById('dt-priority'), dtCategory = document.getElementById('dt-category'), dtRemindTime = document.getElementById('dt-remind-time');
    const dtSubtaskInput = document.getElementById('dt-subtask-input'), dtSubtaskAdd = document.getElementById('dt-subtask-add'), dtSubtasksList = document.getElementById('dt-subtasks-list');
    let activeDetailId = null;

    // Hover Preview
    const hoverPreview = document.getElementById('hover-preview'), hpTitle = document.getElementById('hp-title'), hpDate = document.getElementById('hp-date'), hpNotes = document.getElementById('hp-notes');
    let hoverTimeout = null;

    // Emoji Picker
    const emojiPicker = document.getElementById('emoji-picker');
    let activeEmojiTaskId = null;

    let tasks = []; // Populated in real-time by Firestore onSnapshot
    let currentView = 'kanban-view', currentMonth = new Date().getMonth(), currentYear = new Date().getFullYear();
    let deletedTask = null, deletedTaskIndex = -1;

    let initialLoad = true;
    let prevRateValue = 0;
    let prevTodayRateValue = 0;
    let allDoneCelebrated = false;

    function countUp(element, start, end, duration = 400, suffix = '') {
        if (start === end) { element.textContent = end + suffix; return; }
        const startTime = performance.now();
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentVal = Math.floor(start + (end - start) * easeOut);
            element.textContent = currentVal + suffix;
            if (progress < 1) requestAnimationFrame(update);
            else element.textContent = end + suffix;
        }
        requestAnimationFrame(update);
    }


    function setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((registration) => {
                    console.log('[App] Service Worker registered. Scope:', registration.scope);

                    if (registration.waiting) {
                        promptUpdate(registration.waiting);
                    }

                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                promptUpdate(newWorker);
                            }
                        });
                    });
                })
                .catch((err) => console.error('[App] SW registration failed:', err));

            let refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
            });
        }
    }

    function promptUpdate(worker) {
        // Auto-update without prompt
        worker.postMessage({ type: 'SKIP_WAITING' });
    }

    taskInput.addEventListener('focus', () => {
        if (taskInput.value.trim().length > 0) document.getElementById('typing-indicator').classList.remove('hidden');
    });



    // --- Toasts ---
    function showToast(message, type = 'info', actionText = null, actionCallback = null) {
        const container = document.getElementById('toast-container');
        
        // Limit to 3 toasts - remove oldest if needed
        const activeToasts = container.querySelectorAll('.app-toast:not(.leaving)');
        if (activeToasts.length >= 3) {
            const oldest = activeToasts[0];
            oldest.classList.add('leaving');
            setTimeout(() => oldest.remove(), 300);
        }

        const toast = document.createElement('div');
        toast.className = `app-toast toast-${type}`;

        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';
        if (type === 'warning') icon = '⚠️';

        let innerHTML = `<div class="toast-content"><span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
        if (actionText) innerHTML += `<button class="toast-action">${actionText}</button>`;
        innerHTML += `</div><div class="toast-progress"></div>`;
        toast.innerHTML = innerHTML;

        if (actionText && actionCallback) {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                actionCallback();
                closeToast();
            });
        }

        container.appendChild(toast);
        let closeTimeout = setTimeout(closeToast, 4000);
        function closeToast() {
            if (!toast.parentNode) return;
            clearTimeout(closeTimeout);
            toast.classList.add('leaving');
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }
    }

    function showUndoToast() {
        showToast('Task deleted.', 'warning', 'Undo', () => {
            if (deletedTask) {
                const { id, ...data } = deletedTask;
                db.collection('tasks').doc(id).set(data)
                    .catch(err => { console.error('[Firestore] Undo failed:', err); showToast('Failed to restore task.', 'error'); });
                deletedTask = null;
            }
        });
    }

    // --- Bulk Actions ---
    function updateBulkActionBar() {
        if (selectedTasks.size > 0) {
            bulkCount.textContent = `${selectedTasks.size} task${selectedTasks.size > 1 ? 's' : ''} selected`;
            bulkActionBar.classList.remove('hidden');
            // Force reflow for animation
            void bulkActionBar.offsetWidth;
            bulkActionBar.classList.add('active');
        } else {
            bulkActionBar.classList.remove('active');
            setTimeout(() => {
                if (selectedTasks.size === 0) bulkActionBar.classList.add('hidden');
            }, 300);
        }
    }
    document.getElementById('bulk-cancel').addEventListener('click', () => { selectedTasks.clear(); renderAll(); updateBulkActionBar(); });
    document.getElementById('bulk-complete').addEventListener('click', () => {
        let count = 0;
        const batch = db.batch();
        selectedTasks.forEach(id => {
            const t = tasks.find(tsk => tsk.id === id);
            if (t && t.status !== 'done') {
                batch.update(db.collection('tasks').doc(id), { status: 'done', completedAt: new Date().toISOString() });
                count++;
            }
        });
        if (count > 0) {
            batch.commit().catch(err => { console.error('[Firestore] Bulk complete failed:', err); showToast('Sync error.', 'error'); });
            if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 100 });
        }
        if (navigator.vibrate) navigator.vibrate([50, 50]);
        selectedTasks.clear(); updateBulkActionBar();
        showToast(`${count} tasks completed!`, 'success');
    });
    document.getElementById('bulk-delete').addEventListener('click', () => {
        let count = selectedTasks.size;
        const batch = db.batch();
        selectedTasks.forEach(id => batch.delete(db.collection('tasks').doc(id)));
        batch.commit().catch(err => { console.error('[Firestore] Bulk delete failed:', err); showToast('Sync error.', 'error'); });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        selectedTasks.clear(); updateBulkActionBar();
        showToast(`${count} tasks deleted.`, 'warning');
    });

    // --- Detail Panel ---
    function openDetailPanel(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        activeDetailId = id;
        dtTitle.value = task.text; 
        dtNotes.value = task.notes || '';
        dtDate.value = task.dueDate || '';
        dtTime.value = task.dueTime || '';
        dtRemindTime.value = task.remindTime || '';
        dtPriority.value = task.priority; 
        updateSelectColor(dtPriority);
        dtCategory.value = task.category || 'general';
        
        const dtEarlyRemind = document.getElementById('dt-early-remind');
        if (dtEarlyRemind) dtEarlyRemind.checked = task.earlyRemind || false;
        
        checkEarlyWarningVisibility();
        renderSubtasks(task);
        detailPanel.classList.add('active');
    }

    function checkEarlyWarningVisibility() {
        const earlyWarningRow = document.getElementById('early-warning-row');
        if (dtTime.value) {
            earlyWarningRow.style.display = 'block';
        } else {
            earlyWarningRow.style.display = 'none';
        }
    }

    dtTime.addEventListener('change', checkEarlyWarningVisibility);

    document.getElementById('close-detail').addEventListener('click', () => { detailPanel.classList.remove('active'); activeDetailId = null; });

    function updateDetailField(field, value) {
        if (!activeDetailId) return;
        db.collection('tasks').doc(activeDetailId).update({ [field]: value })
            .catch(err => console.error(`[Firestore] Update ${field} failed:`, err));
    }

    dtTitle.addEventListener('input', (e) => updateDetailField('text', e.target.value));
    dtNotes.addEventListener('input', (e) => updateDetailField('notes', e.target.value));
    dtDate.addEventListener('change', (e) => updateDetailField('dueDate', e.target.value));
    dtTime.addEventListener('change', (e) => {
        updateDetailField('dueTime', e.target.value);
        checkEarlyWarningVisibility();
    });
    dtRemindTime.addEventListener('change', (e) => updateDetailField('remindTime', e.target.value));
    dtPriority.addEventListener('change', (e) => {
        updateSelectColor(e.target);
        updateDetailField('priority', e.target.value);
    });
    dtCategory.addEventListener('change', (e) => updateDetailField('category', e.target.value));

    const dtEarlyRemind = document.getElementById('dt-early-remind');
    if (dtEarlyRemind) {
        dtEarlyRemind.addEventListener('change', (e) => updateDetailField('earlyRemind', e.target.checked));
    }

    dtSubtaskAdd.addEventListener('click', addSubtask);
    dtSubtaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addSubtask(); });

    function addSubtask() {
        const text = dtSubtaskInput.value.trim();
        if (!text || !activeDetailId) return;
        const task = tasks.find(t => t.id === activeDetailId);
        if (!task) return;
        const subtasks = task.subtasks || [];
        subtasks.push({ id: Date.now().toString(), text, done: false });
        db.collection('tasks').doc(activeDetailId).update({ subtasks })
            .then(() => { dtSubtaskInput.value = ''; })
            .catch(err => console.error('[Firestore] Add subtask failed:', err));
    }

    if (document.getElementById('dt-tomorrow-btn')) {
        document.getElementById('dt-tomorrow-btn').addEventListener('click', () => {
            if (activeDetailId) moveToTomorrow(activeDetailId);
        });
    }

    function renderSubtasks(task) {
        dtSubtasksList.innerHTML = '';
        if (!task.subtasks || task.subtasks.length === 0) return;
        task.subtasks.forEach(st => {
            const item = document.createElement('div');
            item.className = `subtask-item ${st.done ? 'done' : ''}`;
            item.innerHTML = `
                <input type="checkbox" ${st.done ? 'checked' : ''}>
                <span class="subtask-text">${st.text}</span>
                <div class="subtask-meta">
                    <input type="time" class="st-time" value="${st.remindTime || ''}" title="Reminder Time">
                    <button class="st-action st-remind ${st.remind ? 'active' : ''}" title="Toggle Reminder">🔔</button>
                </div>
                <div class="subtask-actions">
                    <button class="st-action promote-st" title="Promote to full task">🚀</button>
                    <button class="st-action delete-st" title="Delete subtask">🗑️</button>
                </div>
            `;
            item.querySelector('input').addEventListener('change', () => toggleSubtask(task.id, st.id));
            item.querySelector('.delete-st').addEventListener('click', () => deleteSubtask(task.id, st.id));
            item.querySelector('.promote-st').addEventListener('click', () => promoteSubtask(task.id, st.id));
            
            const timeInput = item.querySelector('.st-time');
            const remindBtn = item.querySelector('.st-remind');
            
            timeInput.addEventListener('change', () => updateSubtaskRemind(task.id, st.id, timeInput.value, st.remind));
            remindBtn.addEventListener('click', () => updateSubtaskRemind(task.id, st.id, st.remindTime, !st.remind));

            dtSubtasksList.appendChild(item);
        });
    }

    function toggleSubtask(taskId, stId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const subtasks = task.subtasks.map(st => st.id === stId ? { ...st, done: !st.done } : st);
        
        const allDone = subtasks.every(st => st.done);
        const anyDone = subtasks.some(st => st.done);
        
        let nextStatus = task.status;
        if (allDone) nextStatus = 'done';
        else if (task.status === 'done' && !allDone) nextStatus = 'in-progress';
        else if (anyDone && task.status === 'todo') nextStatus = 'in-progress';

        db.collection('tasks').doc(taskId).update({ subtasks, status: nextStatus });
    }

    function deleteSubtask(taskId, stId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const subtasks = task.subtasks.filter(st => st.id !== stId);
        db.collection('tasks').doc(taskId).update({ subtasks });
    }

    function updateSubtaskRemind(taskId, stId, time, remind) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const subtasks = task.subtasks.map(st => st.id === stId ? { ...st, remindTime: time, remind } : st);
        db.collection('tasks').doc(taskId).update({ subtasks });
    }

    function promoteSubtask(taskId, stId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        const st = task.subtasks.find(s => s.id === stId);
        if (!st) return;

        // Add as a new standalone task
        db.collection('tasks').add({
            text: st.text, priority: task.priority, category: task.category,
            dueDate: task.dueDate || '', status: 'todo', pinned: false, notified: false,
            remind: task.remind !== false, subtasks: [], notes: '', emoji: null,
            completedAt: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            // Remove from original task
            deleteSubtask(taskId, stId);
            showToast('Subtask promoted to full task!', 'success');
        }).catch(err => { console.error('[Firestore] Promote subtask failed:', err); showToast('Failed to promote task.', 'error'); });
    }

    // --- Emoji Picker ---
    document.addEventListener('click', e => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.emoji-btn')) { emojiPicker.classList.add('hidden'); activeEmojiTaskId = null; }
    });
    document.querySelectorAll('.emoji-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            if (activeEmojiTaskId) {
                const newEmoji = opt.classList.contains('clear-emoji') ? null : opt.textContent;
                db.collection('tasks').doc(activeEmojiTaskId).update({ emoji: newEmoji })
                    .catch(err => console.error('[Firestore] Emoji update failed:', err));
            }
            emojiPicker.classList.add('hidden'); activeEmojiTaskId = null;
        });
    });

    // --- Hover Preview ---
    function showPreview(task, e) {
        if (isSwiping || isDragging) return;
        if (!task.notes || task.notes.trim() === '') return;
        hpTitle.textContent = task.text;
        hpDate.textContent = task.dueDate ? (formatDate(task.dueDate) || 'Today') : 'No due date';
        hpNotes.textContent = task.notes ? (task.notes.length > 100 ? task.notes.substring(0, 100) + '...' : task.notes) : 'No notes.';
        hoverPreview.style.left = `${e.clientX + 15}px`; hoverPreview.style.top = `${e.clientY + 15}px`;
        hoverPreview.classList.remove('hidden'); hoverPreview.classList.add('visible');
    }
    function updatePreviewPosition(e) { hoverPreview.style.left = `${e.clientX + 15}px`; hoverPreview.style.top = `${e.clientY + 15}px`; }
    function hidePreview() { hoverPreview.classList.remove('visible'); setTimeout(() => hoverPreview.classList.add('hidden'), 200); }


    // --- Mobile Bottom Sheet & PTR ---
    function toggleBottomSheet() {
        const isActive = bottomSheet.classList.contains('active');
        if (!isActive) { mobileInputContainer.appendChild(inputSection); bottomSheet.classList.add('active'); bottomSheetOverlay.classList.add('active'); }
        else { document.querySelector('.main-content').insertBefore(inputSection, document.querySelector('.main-content-split')); bottomSheet.classList.remove('active'); bottomSheetOverlay.classList.remove('active'); }
    }
    if (fabAdd) fabAdd.addEventListener('click', toggleBottomSheet);
    if (bottomSheetOverlay) bottomSheetOverlay.addEventListener('click', toggleBottomSheet);



    // --- Voice Input (Audio Recording) ---
    let mediaRecorder;
    let audioChunks = [];

    function setupVoiceInput() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            micBtn.style.display = 'none';
            return;
        }

        let isRecording = false;
        micBtn.addEventListener('click', async () => {
            if (isRecording) {
                mediaRecorder.stop();
                micBtn.classList.remove('listening');
                isRecording = false;
                return;
            }

            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                mediaRecorder = new MediaRecorder(stream);
                audioChunks = [];

                mediaRecorder.ondataavailable = e => {
                    if (e.data.size > 0) audioChunks.push(e.data);
                };

                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        addAudioTask(reader.result);
                    };
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                micBtn.classList.add('listening');
                isRecording = true;
                if (navigator.vibrate) navigator.vibrate(50);
                showToast('Recording... Click mic again to stop.', 'info');
            } catch (err) {
                console.error("Microphone error", err);
                showToast("Microphone access denied.", "error");
            }
        });
    }

    function addAudioTask(base64Audio) {
        const text = "Voice Memo 🎤";
        const dVal = dueDateInput.value, tVal = dueTimeInput.value;
        const finalDate = dVal ? dVal + (tVal ? `T${tVal}` : '') : '';
        db.collection('tasks').add({
            text, audioData: base64Audio, priority: prioritySelect.value,
            category: categorySelect.value, dueDate: finalDate, status: 'todo',
            pinned: false, notified: false, remind: !!tVal, subtasks: [], notes: '', emoji: null,
            completedAt: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            dueDateInput.value = ''; dueTimeInput.value = '';
            showToast('Voice memo added successfully', 'success');
        }).catch(err => { console.error('[Firestore] Add audio task failed:', err); showToast('Failed to add voice memo.', 'error'); });
    }

    // --- Onboarding Tour ---
    function setupTour() {
        if (localStorage.getItem('onboardingDone') === 'true') return;
        const tourOverlay = document.getElementById('tour-overlay'), tourTooltip = document.getElementById('tour-tooltip'), tourText = document.getElementById('tour-text');
        const steps = [
            { target: '#input-section', text: 'Add your tasks here. Date & time separate now!', placement: 'bottom' },
            { target: '#sidebar', text: 'Navigate views and change themes here!', placement: 'top' },
            { target: '#kanban-board', text: 'Ctrl+Click to multi-select. Hover 500ms to preview. Swipe on mobile!', placement: 'top' }
        ];
        let stepIdx = 0;

        function showStep() {
            if (stepIdx >= steps.length) { finishTour(); return; }
            const step = steps[stepIdx]; const targetEl = document.querySelector(step.target);
            if (!targetEl) { stepIdx++; showStep(); return; }
            tourText.textContent = step.text; tourTooltip.setAttribute('data-placement', step.placement);
            const rect = targetEl.getBoundingClientRect();
            
            // Smarter positioning to avoid off-screen
            let top, left;
            if (step.placement === 'bottom') {
                top = rect.bottom + 15;
                left = Math.max(10, Math.min(window.innerWidth - 290, rect.left));
            } else {
                top = rect.top - 180; // Larger gap for header
                left = Math.max(10, Math.min(window.innerWidth - 290, rect.left + rect.width / 2 - 140));
            }

            // Viewport boundary checks
            if (top < 20) top = rect.bottom + 15; // Flip to bottom if off-screen top
            if (top + 200 > window.innerHeight) top = rect.top - 180; // Flip to top if off-screen bottom
            
            tourTooltip.style.top = `${top}px`;
            tourTooltip.style.left = `${left}px`;

            document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight')); targetEl.classList.add('tour-highlight');
        }

        function finishTour() { tourOverlay.classList.remove('active'); setTimeout(() => tourOverlay.classList.add('hidden'), 300); document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight')); localStorage.setItem('onboardingDone', 'true'); }
        tourOverlay.classList.remove('hidden'); setTimeout(() => tourOverlay.classList.add('active'), 100); showStep();
        document.getElementById('tour-next').addEventListener('click', () => { stepIdx++; showStep(); }); document.getElementById('tour-skip').addEventListener('click', finishTour);
    }

    // --- Core Logic ---
    themeToggleBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const newTheme = isDark ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        themeToggleBtn.textContent = newTheme === 'light' ? '☀️ Light' : '🌙 Dark';
    });

    shortcutsBtn.addEventListener('click', () => {
        shortcutsModal.classList.add('active');
        shortcutsModal.classList.remove('hidden');
    });

    document.getElementById('close-shortcuts').addEventListener('click', () => {
        shortcutsModal.classList.remove('active');
        setTimeout(() => shortcutsModal.classList.add('hidden'), 300);
    });

    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) {
            shortcutsModal.classList.remove('active');
            setTimeout(() => shortcutsModal.classList.add('hidden'), 300);
        }
    });

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentView = btn.dataset.view;
            
            // Auto-close detail panel on view change
            if (detailPanel) detailPanel.classList.remove('active');
            activeDetailId = null;

            // Toggle Global Input Section visibility based on view
            if (inputSection) {
                inputSection.style.display = (currentView === 'kanban-view') ? 'flex' : 'none';
            }

            viewPanels.forEach(p => {
                if (p.id === currentView) {
                    p.classList.add('active');
                } else {
                    p.classList.remove('active');
                }
            });
            renderAll();
        });
    });

    addButton.addEventListener('click', () => { addTask(); if (window.innerWidth <= 768 && bottomSheet.classList.contains('active')) toggleBottomSheet(); });
    taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

    document.getElementById('prev-month').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderAll(); });
    document.getElementById('next-month').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderAll(); });

    function customConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        if (!modal) return;
        document.getElementById('confirm-message').textContent = message;
        modal.classList.remove('hidden');
        modal.classList.add('active');

        const yesBtn = document.getElementById('confirm-yes');
        const cancelBtn = document.getElementById('confirm-cancel');

        const cleanup = () => {
            modal.classList.remove('active');
            setTimeout(() => modal.classList.add('hidden'), 300);
        };

        const handleYes = () => { cleanup(); onConfirm(); yesBtn.removeEventListener('click', handleYes); cancelBtn.removeEventListener('click', handleCancel); };
        const handleCancel = () => { cleanup(); yesBtn.removeEventListener('click', handleYes); cancelBtn.removeEventListener('click', handleCancel); };

        yesBtn.addEventListener('click', handleYes);
        cancelBtn.addEventListener('click', handleCancel);
    }

    const clearDoneBtn = document.getElementById('clear-done-btn');
    if (clearDoneBtn) {
        clearDoneBtn.addEventListener('click', () => {
            const doneTasks = tasks.filter(t => t.status === 'done');
            if (doneTasks.length === 0) return showToast('No completed tasks to clear.', 'info');
            customConfirm(`Are you sure you want to permanently delete ${doneTasks.length} completed tasks?`, () => {
                const batch = db.batch();
                doneTasks.forEach(t => batch.delete(db.collection('tasks').doc(t.id)));
                batch.commit()
                    .then(() => showToast('Completed tasks cleared.', 'success'))
                    .catch(err => { console.error('[Firestore] Clear done failed:', err); showToast('Failed to clear tasks.', 'error'); });
            });
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') { if (document.activeElement !== taskInput) taskInput.focus(); else addTask(); }
    });

    function addTask() {
        const text = taskInput.value.trim(); if (text === '') return;
        let dVal = dueDateInput.value;
        const tVal = dueTimeInput.value;
        
        // If category is "Today" (general) and no date is set, default to today
        if (categorySelect.value === 'general' && !dVal) {
            const today = new Date();
            dVal = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
        }

        const finalDate = dVal ? dVal + (tVal ? `T${tVal}` : '') : '';
        taskInput.value = ''; dueDateInput.value = ''; dueTimeInput.value = '';
        document.getElementById('typing-indicator').classList.add('hidden');
        if (navigator.vibrate) navigator.vibrate(50);
        db.collection('tasks').add({
            text, priority: prioritySelect.value, category: categorySelect.value,
            dueDate: finalDate, status: 'todo', pinned: false, notified: false,
            remind: !!tVal,
            subtasks: [], notes: '', emoji: null, completedAt: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
            showToast('Task added successfully', 'success');
        })
          .catch(err => { console.error('[Firestore] Add task failed:', err); showToast('Failed to add task.', 'error'); });
    }

    function triggerParticles(x, y) {
        for (let i = 0; i < 12; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 20;
            p.style.left = `${x}px`; p.style.top = `${y}px`;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            document.body.appendChild(p);
            setTimeout(() => p.remove(), 500);
        }
    }

    function toggleTaskStatus(id, element) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        const newStatus = task.status === 'done' ? 'todo' : 'done';
        const updateData = { status: newStatus, completedAt: newStatus === 'done' ? new Date().toISOString() : null };
        if (newStatus === 'done' && navigator.vibrate) navigator.vibrate(50);
        if (element) {
            element.classList.remove('completed-anim', 'uncompleted-anim'); void element.offsetWidth;
            element.classList.add(newStatus === 'done' ? 'completed-anim' : 'uncompleted-anim');
            if (newStatus === 'done') {
                element.classList.add('done');
                triggerSmallConfetti(element);
                const cbWrapper = element.querySelector('.svg-checkbox-wrapper');
                if (cbWrapper) {
                    const ripple = document.createElement('div');
                    ripple.className = 'ripple';
                    ripple.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
                    cbWrapper.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 500);
                    const r = cbWrapper.getBoundingClientRect();
                    triggerParticles(r.left + r.width / 2, r.top + r.height / 2);
                }
            } else {
                element.classList.remove('done');
            }
        }
        db.collection('tasks').doc(id).update(updateData)
            .catch(err => { console.error('[Firestore] Toggle status failed:', err); showToast('Sync error.', 'error'); });
    }

    function triggerSmallConfetti(el) { if (typeof confetti !== 'function') return; const r = el.getBoundingClientRect(); confetti({ particleCount: 50, spread: 60, origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight }, zIndex: 9999 }); }

    const motivationalMessages = [
        "Keep going! You're crushing it! 🚀",
        "Time to tackle your next task! You got this! 💪",
        "Consistency is key! Let's get it done! ✨",
        "One step at a time, you're making progress! 🌟",
        "Don't stop now, you're on a roll! 🔥",
        "Victory is near! Complete that task! 🏆"
    ];





    function deleteTask(id, wrapper) {
        const index = tasks.findIndex(t => t.id === id);
        if (index === -1) return;
        deletedTask = { ...tasks[index] }; deletedTaskIndex = index;
        if (navigator.vibrate) navigator.vibrate([50, 50]);
        const doDelete = () => {
            db.collection('tasks').doc(id).delete()
                .then(() => showUndoToast())
                .catch(err => { console.error('[Firestore] Delete failed:', err); showToast('Failed to delete task.', 'error'); });
        };
        if (wrapper) { wrapper.classList.add('leaving'); setTimeout(doDelete, 300); } else doDelete();
    }

    function moveToTomorrow(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

        let newDueDate = dateStr;
        if (task.dueDate && task.dueDate.includes('T')) {
            newDueDate += 'T' + task.dueDate.split('T')[1];
        }

        const updateData = {
            dueDate: newDueDate,
            category: task.category === 'general' ? 'daily' : (task.category || 'daily')
        };

        if (navigator.vibrate) navigator.vibrate(50);
        db.collection('tasks').doc(id).update(updateData)
            .then(() => showToast('Moved to tomorrow! ⏭️', 'success'))
            .catch(err => { console.error('[Firestore] Move to tomorrow failed:', err); showToast('Failed to move task.', 'error'); });
    }
    function saveTasks() { /* No-op: replaced by Firestore */ }
    function setupFirestore() {
        db.collection('tasks').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
            tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Auto-pin overdue tasks (done once per sync)
            tasks.forEach(t => {
                if (t.status !== 'done' && t.dueDate && !t.pinned) {
                    const dueTime = t.dueDate.includes('T') ? t.dueDate : t.dueDate + "T23:59:59";
                    if (new Date(dueTime) < new Date()) {
                        db.collection('tasks').doc(t.id).update({ pinned: true }).catch(() => {});
                    }
                }
            });

            renderAll();
            if (initialLoad) initialLoad = false;
        }, err => {
            console.error('[Firestore] Snapshot error:', err);
            showToast('Real-time sync error. Check your connection.', 'error');
        });
    }

    function isTodayOrPast(dateStr) {
        if (!dateStr) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(dateStr.includes('T') ? dateStr : dateStr + "T00:00:00");
        d.setHours(0, 0, 0, 0);
        return d <= today;
    }

    // --- Rendering ---
    function renderAll(animateNew = false, newId = null) {
        // PREVENT GLITCH: Skip rendering if user is actively interacting with the UI
        if (isDragging || isSwiping || document.querySelector('.dragging')) return;

        updateRemainingCount();
        
        if (activeDetailId) {
            const activeTask = tasks.find(t => t.id === activeDetailId);
            if (activeTask) renderSubtasks(activeTask);
        }

        // Big Celebration Check removed

        if (currentView === 'kanban-view') renderKanban(animateNew, newId, initialLoad);
        else if (currentView === 'calendar-view') renderCalendar();
        else if (currentView === 'analytics-view') renderAnalytics();
    }



    function updateRemainingCount() {
        const remainingBadgeAnalytic = document.getElementById('remaining-tasks-badge-analytics');
        if (remainingBadgeAnalytic) {
            const remCount = tasks.filter(t => t.status !== 'done').length;
            remainingBadgeAnalytic.textContent = remCount;
            remainingBadgeAnalytic.className = `rate-badge ${remCount === 0 ? 'green' : remCount > 10 ? 'red' : 'amber'}`;
        }
    }

    function sortTasks(taskArr) {
        const priorityMap = { 'high': 3, 'medium': 2, 'low': 1, 'none': 0 };
        return [...taskArr].sort((a, b) => {
            // 1. Done tasks to the bottom
            const aDone = a.status === 'done', bDone = b.status === 'done';
            if (aDone !== bDone) return aDone ? 1 : -1;

            // 2. Sort by Group Priority (Parent's priority)
            const aP = priorityMap[a.priority] || 0;
            const bP = priorityMap[b.priority] || 0;
            if (aP !== bP) return bP - aP;

            // 3. Sort by Group Date (Parent's creation time)
            const aDate = a.sortDate?.seconds || 0;
            const bDate = b.sortDate?.seconds || 0;
            if (aDate !== bDate) return bDate - aDate;

            // 4. Within the same group (parent + its subtasks), 
            // subtasks (groupOrder 0) come before the parent (groupOrder 1)
            if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;

            return 0;
        });
    }

    function renderKanban(animateNew, newId, isInitial) {
        Object.values(lists).forEach(list => list.innerHTML = '');
        let idx = 0;
        
        const allRenderItems = [];
        tasks.forEach(task => {
            if (task.subtasks && task.subtasks.length > 0) {
                // Add subtasks
                task.subtasks.forEach((st, idx) => {
                    allRenderItems.push({
                        ...task,
                        id: `st-${task.id}-${st.id}`,
                        text: st.text,
                        status: st.done ? 'done' : task.status,
                        isSubtask: true,
                        originalTaskId: task.id,
                        subtaskId: st.id,
                        pinned: false,
                        groupOrder: 0,
                        sortDate: task.createdAt,
                        subtaskIndex: idx + 1
                    });
                });
                // Add the parent task after its subtasks
                allRenderItems.push({ 
                    ...task, 
                    isParent: true, 
                    groupOrder: 1,
                    sortDate: task.createdAt 
                });
            } else {
                allRenderItems.push({
                    ...task,
                    groupOrder: 0,
                    sortDate: task.createdAt
                });
            }
        });

        sortTasks(allRenderItems).forEach(task => {
            let listKey = task.status;
            if (listKey === 'todo') {
                if (task.category === 'general' || (task.dueDate && isTodayOrPast(task.dueDate))) {
                    listKey = 'todo-today';
                } else {
                    listKey = 'todo-later';
                }
            }

            if (lists[listKey]) {
                const el = createTaskElement(task, animateNew, newId);
                if (isInitial && !animateNew) {
                    el.style.opacity = '0';
                    el.style.animation = `cascadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`;
                    el.style.animationDelay = `${idx * 0.05}s`;
                }
                lists[listKey].appendChild(el);
                idx++;
            }
        });
    }

    function renderCalendar() {
        const grid = document.getElementById('calendar-grid'); if (!grid) return;
        grid.innerHTML = '';
        const headerGrid = document.getElementById('calendar-grid-header');
        if (headerGrid) {
            headerGrid.innerHTML = '';
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(d => {
                const dDiv = document.createElement('div'); 
                dDiv.textContent = d; 
                dDiv.style.fontWeight = 'bold';
                headerGrid.appendChild(dDiv);
            });
        }

        const mNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('month-year-display').textContent = `${mNames[currentMonth]} ${currentYear}`;
        
        const firstDay = new Date(currentYear, currentMonth, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const today = new Date(), isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;

        // Add padding cells for days from previous month
        for (let p = 0; p < firstDay; p++) {
            const cell = document.createElement('div'); cell.className = 'calendar-cell other-month empty'; 
            grid.appendChild(cell);
        }

        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        for (let i = 1; i <= daysInMonth; i++) {
            const currentCellDate = new Date(currentYear, currentMonth, i);
            currentCellDate.setHours(0, 0, 0, 0);

            // Skip past days entirely — don't render them
            if (currentCellDate < todayDate) continue;

            const dayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const cell = createCalCell(i, false, isCurrentMonth && today.getDate() === i, dayStr);
            tasks.filter(t => t.dueDate && t.dueDate.startsWith(dayStr) && t.status !== 'done').forEach(task => {
                const tDiv = document.createElement('div'); tDiv.className = `calendar-task status-${task.status} p-${task.priority}`; tDiv.textContent = task.text; tDiv.title = task.text;
                tDiv.addEventListener('click', (e) => { e.stopPropagation(); openDetailPanel(task.id); });
                cell.appendChild(tDiv);
            });
            grid.appendChild(cell);
        }
    }
    function createCalCell(dNum, isOther, isToday = false, dateStr) {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const cellDate = new Date(dateStr + "T00:00:00");
        cellDate.setHours(0, 0, 0, 0);
        const isPast = cellDate < todayDate;

        const div = document.createElement('div'); 
        div.className = `calendar-cell ${isOther ? 'other-month' : ''} ${isToday ? 'today-cell' : ''} ${isPast ? 'past-date' : ''}`;
        div.innerHTML = `<span class="calendar-day-number">${dNum}</span>`;
        
        div.addEventListener('click', (e) => {
            if ((e.target === div || e.target.classList.contains('calendar-day-number')) && dateStr) {
                openDatePanel(dateStr);
            }
        });
        
        return div;
    }

    // ── Date Panel ──────────────────────────────────────────
    function openDatePanel(dateStr) {
        const panel = document.getElementById('date-panel');
        const overlay = document.getElementById('date-panel-overlay');
        const label = document.getElementById('date-panel-label');
        const subtitle = document.getElementById('date-panel-subtitle');
        const input = document.getElementById('date-panel-input');
        if (!panel) return;

        // Format date nicely
        const d = new Date(dateStr + 'T00:00:00');
        const isToday = d.toDateString() === new Date().toDateString();
        label.textContent = isToday ? '📅 Today' : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        subtitle.textContent = isToday ? 'Add or manage today\'s tasks' : `Tasks for ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

        // Populate tasks list
        renderDatePanelTasks(dateStr);

        // Store active date
        panel.dataset.activeDate = dateStr;
        input.value = '';

        panel.classList.remove('hidden');
        overlay.classList.remove('hidden');
        requestAnimationFrame(() => { panel.classList.add('sliding-in'); });
        setTimeout(() => panel.classList.remove('sliding-in'), 350);
        input.focus();
    }

    function renderDatePanelTasks(dateStr) {
        const container = document.getElementById('date-panel-tasks');
        if (!container) return;
        container.innerHTML = '';
        const dayTasks = tasks.filter(t => t.dueDate && t.dueDate.startsWith(dateStr));
        if (dayTasks.length === 0) {
            container.innerHTML = '<div class="date-panel-empty">No tasks yet — add one above!</div>';
            return;
        }
        dayTasks.forEach(task => {
            const item = document.createElement('div');
            item.className = `date-panel-task-item ${task.status === 'done' ? 'done-task' : ''}`;
            item.innerHTML = `
                <div class="dpt-priority-dot ${task.priority || 'medium'}"></div>
                <div class="dpt-text">${task.text}</div>
                <div class="dpt-status">${task.status === 'in-progress' ? 'In Progress' : task.status === 'done' ? 'Done ✓' : 'To Do'}</div>
            `;
            item.addEventListener('click', () => { openDetailPanel(task.id); });
            container.appendChild(item);
        });
    }

    function closeDatePanel() {
        const panel = document.getElementById('date-panel');
        const overlay = document.getElementById('date-panel-overlay');
        if (panel) panel.classList.add('hidden');
        if (overlay) overlay.classList.add('hidden');
    }

    function setupDatePanel() {
        document.getElementById('date-panel-close')?.addEventListener('click', closeDatePanel);
        document.getElementById('date-panel-overlay')?.addEventListener('click', closeDatePanel);

        const addBtn = document.getElementById('date-panel-add-btn');
        const input = document.getElementById('date-panel-input');

        const doAdd = () => {
            const panel = document.getElementById('date-panel');
            const dateStr = panel?.dataset.activeDate;
            const text = input?.value.trim();
            if (!text || !dateStr) return;
            db.collection('tasks').add({
                text,
                priority: 'medium',
                category: 'daily',
                dueDate: dateStr,
                status: 'todo',
                pinned: false,
                notified: false,
                remind: false,
                subtasks: [], notes: '', emoji: null,
                completedAt: null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                input.value = '';
                renderDatePanelTasks(dateStr);
                showToast('Task added!', 'success');
            }).catch(err => { console.error(err); showToast('Failed to add task.', 'error'); });
        };

        addBtn?.addEventListener('click', doAdd);
        input?.addEventListener('keypress', e => { if (e.key === 'Enter') doAdd(); });
    }
    setupDatePanel();

    function renderAnalytics() {
        if (typeof Chart === 'undefined') return;

        // --- Persistent completion counter ---
        // Track cumulative completions in localStorage so deleting done tasks doesn't reset the count
        const currentDone = tasks.filter(t => t.status === 'done').length;
        const storedMax = parseInt(localStorage.getItem('analyticsMaxDone') || '0', 10);
        const lifetimeDone = Math.max(currentDone, storedMax);
        localStorage.setItem('analyticsMaxDone', lifetimeDone);

        const activeTotal = tasks.filter(t => t.status !== 'done').length;
        const lifetimeTotal = lifetimeDone + activeTotal;
        const rate = lifetimeTotal === 0 ? 0 : Math.round((lifetimeDone / lifetimeTotal) * 100);

        const badge = document.getElementById('completion-badge');
        if (badge) {
            badge.className = `rate-badge ${rate >= 80 ? 'green' : rate >= 50 ? 'amber' : 'red'}`;
            countUp(badge, prevRateValue, rate, 400, '%');
            prevRateValue = rate;
        }

        let todayTotal = 0, todayDone = 0;
        const todayStr = new Date().toDateString();
        tasks.forEach(t => {
            if (t.dueDate) {
                const parseStr = t.dueDate.includes('T') ? t.dueDate : t.dueDate + 'T00:00:00';
                if (new Date(parseStr).toDateString() === todayStr || isTodayOrPast(t.dueDate)) {
                    todayTotal++;
                    if (t.status === 'done') todayDone++;
                }
            }
        });
        const todayRate = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);
        const todayBadge = document.getElementById('today-completion-badge');
        if (todayBadge) {
            todayBadge.className = `rate-badge ${todayRate >= 80 ? 'green' : todayRate >= 50 ? 'amber' : 'red'}`;
            countUp(todayBadge, prevTodayRateValue, todayRate, 400, '%');
            prevTodayRateValue = todayRate;
        }

        // Delayed tasks calculation
        const delayedCount = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate.includes('T') ? t.dueDate : t.dueDate + "T23:59:59") < new Date()).length;
        const delayedBadge = document.getElementById('delayed-tasks-badge');
        if (delayedBadge) {
            delayedBadge.textContent = delayedCount;
            delayedBadge.className = `rate-badge ${delayedCount === 0 ? 'green' : 'red'}`;
        }

        const last7Days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return d.toLocaleDateString('en-US', { weekday: 'short' }); }).reverse();
        const completedCounts = [0, 0, 0, 0, 0, 0, 0];
        tasks.filter(t => t.status === 'done' && t.completedAt).forEach(t => {
            const d = new Date(t.completedAt), now = new Date(); now.setHours(23, 59, 59, 999);
            const diffDays = Math.floor(Math.abs(now - d) / 86400000);
            if (diffDays < 7 && diffDays >= 0) completedCounts[6 - diffDays]++;
        });

        const weeklyCtx = document.getElementById('weeklyChart').getContext('2d'); if (window.weeklyChartInst) window.weeklyChartInst.destroy();
        const gradient = weeklyCtx.createLinearGradient(0, 0, 0, 400);
        const pColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color');
        gradient.addColorStop(0, pColor);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        window.weeklyChartInst = new Chart(weeklyCtx, { 
            type: 'line', 
            data: { 
                labels: last7Days, 
                datasets: [{ 
                    label: 'Efficiency', 
                    data: completedCounts, 
                    borderColor: pColor,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: pColor,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    borderWidth: 4
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { stepSize: 1, color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                } 
            } 
        });

        const priorityCtx = document.getElementById('priorityChart').getContext('2d'); if (window.priorityChartInst) window.priorityChartInst.destroy();
        window.priorityChartInst = new Chart(priorityCtx, { type: 'doughnut', data: { labels: ['High', 'Medium', 'Low', 'None'], datasets: [{ data: [tasks.filter(t => t.priority === 'high' && t.status !== 'done').length, tasks.filter(t => t.priority === 'medium' && t.status !== 'done').length, tasks.filter(t => t.priority === 'low' && t.status !== 'done').length, tasks.filter(t => (t.priority === 'none' || !t.priority) && t.status !== 'done').length], backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#94a3b8'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } } });

        const statusCtx = document.getElementById('statusChart').getContext('2d'); if (window.statusChartInst) window.statusChartInst.destroy();
        window.statusChartInst = new Chart(statusCtx, { type: 'doughnut', data: { labels: ['To Do', 'In Progress', 'Done'], datasets: [{ data: [tasks.filter(t => t.status === 'todo').length, tasks.filter(t => t.status === 'in-progress').length, tasks.filter(t => t.status === 'done').length], backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom' } } } });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const hasTime = dateStr.includes('T');
        const parseStr = hasTime ? dateStr : dateStr + 'T00:00:00';
        const d = new Date(parseStr);
        const isToday = d.toDateString() === new Date().toDateString();
        if (isToday) return hasTime ? d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
        const opts = hasTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' };
        return d.toLocaleString('en-US', opts);
    }

    let isDragging = false, isSwiping = false;

    function createTaskElement(task, animateNew, newId) {
        const wrapper = document.createElement('div'); wrapper.className = 'task-wrapper';
        if (animateNew && task.id === newId) wrapper.classList.add('entering');
        const bg = document.createElement('div'); bg.className = 'task-bg'; wrapper.appendChild(bg);

        const li = document.createElement('div');
        li.className = `task-container priority-${task.priority} ${task.status === 'done' ? 'done' : ''} ${task.pinned ? 'pinned' : ''} ${selectedTasks.has(task.id) ? 'selected' : ''} ${task.isSubtask ? 'subtask-task' : ''} ${task.isParent ? 'parent-task' : ''}`;
        li.tabIndex = 0; li.dataset.id = task.id;

        let isOverdue = false;
        if (task.dueDate && new Date(task.dueDate.includes('T') ? task.dueDate : task.dueDate + "T23:59:59") < new Date() && task.status !== 'done') {
            li.classList.add('overdue'); isOverdue = true;
        }

        // Multi-select & Open Detail Panel
        li.addEventListener('click', (e) => {
            if (e.target.closest('.svg-checkbox-wrapper') || e.target.tagName.toLowerCase() === 'button' || e.target.classList.contains('grab-handle') || e.target.classList.contains('emoji-btn')) return;
            if (e.ctrlKey || e.metaKey) {
                if (selectedTasks.has(task.id)) { selectedTasks.delete(task.id); li.classList.remove('selected'); }
                else { selectedTasks.add(task.id); li.classList.add('selected'); }
                updateBulkActionBar();
            } else {
                const openId = task.isSubtask ? task.originalTaskId : task.id;
                openDetailPanel(openId);
            }
        });

        // Hover Preview
        li.addEventListener('mouseenter', e => { hoverTimeout = setTimeout(() => showPreview(task, e), 500); });
        li.addEventListener('mouseleave', () => { clearTimeout(hoverTimeout); hidePreview(); });

        // Drag & Drop
        if (currentView === 'kanban-view') {
            li.draggable = true;
            li.addEventListener('dragstart', (e) => { if (e.target.closest('.svg-checkbox-wrapper')) { e.preventDefault(); return; } isDragging = true; clearTimeout(hoverTimeout); hidePreview(); li.classList.add('dragging'); });
            li.addEventListener('dragend', () => { isDragging = false; li.classList.remove('dragging'); });
        }

        // Swipe Gestures
        let startX = 0, currentX = 0;
        li.addEventListener('touchstart', e => { startX = e.touches[0].clientX; isSwiping = true; clearTimeout(hoverTimeout); hidePreview(); li.classList.add('swiping'); }, { passive: true });
        li.addEventListener('touchmove', e => {
            if (!isSwiping) return; currentX = e.touches[0].clientX; let diff = currentX - startX;
            if (diff > 150) diff = 150; if (diff < -150) diff = -150;
            li.style.transform = `translateX(${diff}px)`;
            if (diff > 50) { bg.className = 'task-bg bg-done'; bg.innerHTML = '<span>Done ✅</span><span></span>'; }
            else if (diff < -50) { bg.className = 'task-bg bg-delete'; bg.innerHTML = '<span></span><span>Delete 🗑️</span>'; }
            else { bg.className = 'task-bg'; bg.innerHTML = ''; }
        }, { passive: true });
        li.addEventListener('touchend', e => {
            if (!isSwiping) return; isSwiping = false; li.classList.remove('swiping');
            let diff = currentX - startX; li.style.transform = `translateX(0)`;
            if (diff > 100) toggleTaskStatus(task.id, li); else if (diff < -100) deleteTask(task.id, wrapper);
            setTimeout(() => { bg.className = 'task-bg'; bg.innerHTML = ''; }, 200);
        });

        const mainDiv = document.createElement('div'); mainDiv.className = 'task-main';

        // Custom SVG Checkbox
        const checkWrapper = document.createElement('div'); checkWrapper.className = 'svg-checkbox-wrapper';
        checkWrapper.innerHTML = `<div class="svg-checkbox-bg"></div><svg class="svg-checkbox" viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"></path></svg>`;
        checkWrapper.addEventListener('click', (e) => { 
            e.stopPropagation(); 
            if (task.isSubtask) toggleSubtask(task.originalTaskId, task.subtaskId);
            else toggleTaskStatus(task.id, li); 
        });

        const infoDiv = document.createElement('div'); infoDiv.className = 'task-info';
        const headerRow = document.createElement('div'); headerRow.className = 'task-header-row';

        // Subtask "Step" Badge
        if (task.isSubtask) {
            const stepBadge = document.createElement('span');
            stepBadge.className = 'badge-pill step-badge';
            stepBadge.textContent = `STEP ${task.subtaskIndex}`;
            headerRow.appendChild(stepBadge);
        }

        // Emoji Badges
        const pLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
        if (!task.isSubtask) headerRow.innerHTML += `<span class="badge-pill">${pLabels[task.priority]}</span>`;
        if (task.pinned) headerRow.innerHTML += `<span class="badge-pill">📌 Pinned</span>`;
        if (isOverdue) headerRow.innerHTML += `<span class="badge-pill" style="color: #ef4444; border-color: #ef4444">⚠️ Overdue</span>`;

        const textSpan = document.createElement('span'); textSpan.className = 'task-text'; textSpan.textContent = task.text; headerRow.appendChild(textSpan);
        
        // Progress Bar for Parents
        if (task.isParent) {
            const total = task.subtasks.length;
            const done = task.subtasks.filter(st => st.done).length;
            const progress = Math.round((done / total) * 100);
            
            const progressText = document.createElement('span');
            progressText.className = 'progress-text';
            progressText.textContent = `${done}/${total} steps`;
            headerRow.appendChild(progressText);

            const progressWrap = document.createElement('div');
            progressWrap.className = 'task-progress-bar-wrap';
            progressWrap.innerHTML = `<div class="task-progress-bar" style="width: ${progress}%"></div>`;
            infoDiv.appendChild(headerRow);
            infoDiv.appendChild(progressWrap);
        } else {
            infoDiv.appendChild(headerRow);
        }

        const formattedDate = task.dueDate ? formatDate(task.dueDate) : '';
        if (formattedDate) { const dateLabel = document.createElement('span'); dateLabel.className = 'due-date-label'; dateLabel.textContent = formattedDate; headerRow.appendChild(dateLabel); }

        if (task.audioData) {
            const audioWrapper = document.createElement('div');
            audioWrapper.style.marginTop = '8px';
            audioWrapper.innerHTML = `<audio controls src="${task.audioData}" style="height: 32px; width: 100%; max-width: 250px; outline: none;" draggable="false"></audio>`;
            audioWrapper.addEventListener('click', e => e.stopPropagation());
            audioWrapper.addEventListener('mousedown', e => e.stopPropagation());
            audioWrapper.addEventListener('touchstart', e => e.stopPropagation());
            audioWrapper.addEventListener('dragstart', e => { e.preventDefault(); e.stopPropagation(); });
            infoDiv.appendChild(audioWrapper);
        }

        const actionsDiv = document.createElement('div'); actionsDiv.className = 'task-actions';
        const grabHandle = document.createElement('span'); grabHandle.className = 'grab-handle'; grabHandle.innerHTML = '⋮⋮';
        if (task.isSubtask) grabHandle.style.display = 'none';

        actionsDiv.append(grabHandle);
        mainDiv.append(checkWrapper, infoDiv, actionsDiv); li.appendChild(mainDiv); wrapper.appendChild(li); return wrapper;
    }

    // Kanban Drop Logic
    Object.values(lists).forEach(list => {
        if (!list) return;
        list.addEventListener('dragover', e => {
            e.preventDefault(); const afterEl = getDragAfterElement(list, e.clientY), dragEl = document.querySelector('.dragging');
            if (dragEl) { const wrapper = dragEl.parentElement; if (afterEl == null) list.appendChild(wrapper); else list.insertBefore(wrapper, afterEl); }
        });
        list.addEventListener('drop', e => {
            e.preventDefault(); const dragEl = document.querySelector('.dragging'); if (!dragEl) return;
            const draggedId = dragEl.dataset.id, newStatus = list.dataset.status;

            // Handle Subtask Dragging
            if (draggedId.startsWith('st-')) {
                const [_, parentId, stId] = draggedId.split('-');
                const parentTask = tasks.find(t => t.id === parentId);
                if (parentTask) {
                    const isDone = (newStatus === 'done');
                    const updatedSubtasks = parentTask.subtasks.map(st => 
                        st.id === stId ? { ...st, done: isDone } : st
                    );
                    const allDone = updatedSubtasks.every(st => st.done);
                    const anyDone = updatedSubtasks.some(st => st.done);
                    
                    let nextStatus = parentTask.status;
                    if (allDone) nextStatus = 'done';
                    else if (parentTask.status === 'done' && !allDone) nextStatus = 'in-progress';
                    else if (anyDone && parentTask.status === 'todo') nextStatus = 'in-progress';
                    
                    db.collection('tasks').doc(parentId).update({ subtasks: updatedSubtasks, status: nextStatus });
                }
                return;
            }

            const task = tasks.find(t => t.id === draggedId);
            if (!task) return;
            const updateData = {};
            const destListId = list.dataset.listId;
            if (destListId === 'todo-today') {
                if (!task.dueDate || !isTodayOrPast(task.dueDate)) updateData.dueDate = new Date().toISOString().split('T')[0];
                if (task.category !== 'general') updateData.category = 'general';
            } else if (destListId === 'todo-later') {
                if (isTodayOrPast(task.dueDate)) updateData.dueDate = '';
                if (task.category !== 'daily') updateData.category = 'daily';
            }
            if (task.status !== newStatus) {
                updateData.status = newStatus;
                if (newStatus === 'done') { updateData.completedAt = new Date().toISOString(); triggerSmallConfetti(dragEl); }
                else updateData.completedAt = null;
            }
            if (Object.keys(updateData).length > 0) {
                db.collection('tasks').doc(draggedId).update(updateData)
                    .catch(err => { console.error('[Firestore] Drag update failed:', err); showToast('Sync error.', 'error'); });
            }
            const parentCol = list.closest('.kanban-col');
            if (parentCol) { parentCol.classList.remove('col-flash'); void parentCol.offsetWidth; parentCol.classList.add('col-flash'); }
        });
    });

    function getDragAfterElement(container, y) {
        const els = [...container.querySelectorAll('.task-wrapper:not(:has(.dragging))')];
        return els.reduce((closest, child) => { const box = child.getBoundingClientRect(), offset = y - box.top - box.height / 2; return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest; }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    function init() {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggleBtn.textContent = '🌙 Dark';

        const colors = document.querySelectorAll('.color-dot');
        let savedColor = localStorage.getItem('accentColor') || '#6366f1';
        document.documentElement.style.setProperty('--primary-color', savedColor);
        colors.forEach(c => {
            if (c.dataset.color === savedColor) c.classList.add('active');
            c.addEventListener('click', () => {
                colors.forEach(cc => cc.classList.remove('active')); c.classList.add('active');
                const color = c.dataset.color; document.documentElement.style.setProperty('--primary-color', color); localStorage.setItem('accentColor', color);
            });
        });

        setupVoiceInput();
        setupFirestore(); 
        setupNotifications();

        // Splash screen out
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if (splash) {
                splash.classList.add('splash-hide');
                setTimeout(() => splash.remove(), 500);
            }
        }, 900);

        setTimeout(setupTour, 1200);
        setupServiceWorker();
    }

    function setupNotifications() {
        if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") {
                    showToast("Notifications enabled! 🔔", "success");
                }
            });
        }
        setInterval(checkReminders, 60000);
        checkReminders();
    }

    function checkReminders() {
        if (Notification.permission !== "granted") return;
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const nowStr = `${y}-${m}-${d}`;
        const nowTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        tasks.forEach(task => {
            // 1. Task Reminders (uses remindTime if set, else dueTime)
            const nowTimeOnly = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
            const targetRemindTime = task.remindTime || task.dueTime;
            
            if (task.remind && task.status !== 'done' && task.dueDate === nowStr && targetRemindTime === nowTimeOnly) {
                showLocalNotification("Task Reminder 🔔", task.text);
            }

            // 1.1 Early Warning (15m before)
            if (task.earlyRemind && task.status !== 'done' && task.dueDate === nowStr && task.dueTime) {
                const [h, m] = task.dueTime.split(':').map(Number);
                const taskMinutes = h * 60 + m;
                const nowMinutes = now.getHours() * 60 + now.getMinutes();
                if (taskMinutes - nowMinutes === 15) {
                    showLocalNotification("Early Warning ⏲️", `Upcoming: ${task.text} (in 15m)`);
                }
            }

            // 1.2 Subtask Reminders
            if (task.subtasks) {
                task.subtasks.forEach(st => {
                    if (st.remind && !st.done && st.remindTime === nowTime) {
                        showLocalNotification(`Step: ${st.text}`, `From: ${task.text}`);
                    }
                });
            }
        });

        const dailySlots = ['09:00', '13:00', '17:00', '21:00'];
        if (dailySlots.includes(nowTime)) {
            const lastSentKey = `last_daily_notif_${nowStr}_${nowTime}`;
            if (!localStorage.getItem(lastSentKey)) {
                const pendingCount = tasks.filter(t => t.status !== 'done' && (t.dueDate ? isTodayOrPast(t.dueDate) : true)).length;
                if (pendingCount > 0) {
                    showLocalNotification("Daily Task Summary 📊", `You have ${pendingCount} pending tasks for today!`);
                }
                localStorage.setItem(lastSentKey, 'true');
            }
        }
    }

    function showLocalNotification(title, body) {
        if (Notification.permission === "granted") {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png',
                    vibrate: [200, 100, 200],
                    tag: 'task-reminder'
                });
            });
        }
    }

    // --- App Reset Logic ---
    const resetBtn = document.getElementById('reset-app-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async () => {
            if (!confirm("⚠️ DANGER: This will delete ALL your tasks permanently! Are you sure?")) return;
            
            try {
                showToast("Resetting app data...", "info");
                const snapshot = await db.collection('tasks').get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                showToast("App data cleared successfully.", "success");
                renderAll(); // Refresh view
            } catch (err) {
                console.error("Reset failed:", err);
                showToast("Failed to reset data.", "error");
            }
        });
    }

    // --- Click Outside to Close Detail Panel ---
    document.addEventListener('mousedown', (e) => {
        const detailPanel = document.getElementById('detail-panel');
        if (detailPanel && detailPanel.classList.contains('active')) {
            // If click is NOT inside detail panel AND NOT on a task
            if (!detailPanel.contains(e.target) && !e.target.closest('.task-wrapper')) {
                detailPanel.classList.remove('active');
                activeDetailId = null;
            }
        }
    });

    init();
});



// ============================================================
// PWA Install Banner
// ============================================================
let deferredInstallPrompt = null;

// Grab the install button (hidden by default via CSS/HTML attribute)
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();

    // Save the event so it can be triggered later
    deferredInstallPrompt = e;

    // Show the custom install button
    if (installBtn) {
        installBtn.style.display = 'flex';
    }
});

if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        // Show the native install prompt
        deferredInstallPrompt.prompt();

        // Wait for the user's choice
        const { outcome } = await deferredInstallPrompt.userChoice;
        console.log('[App] PWA install prompt outcome:', outcome);

        // Discard the prompt — it can only be used once
        deferredInstallPrompt = null;

        // Hide the button regardless of outcome
        installBtn.style.display = 'none';
    });
}

window.addEventListener('appinstalled', () => {
    console.log('[App] App installed successfully.');
    deferredInstallPrompt = null;
    if (installBtn) {
        installBtn.style.display = 'none';
    }
});

// ============================================================
// Offline / Online Detection Banner
// ============================================================
(function setupOfflineBanner() {
    let banner = null;
    let hideTimer = null;

    function getBanner() {
        if (!banner) {
            banner = document.createElement('div');
            banner.className = 'offline-banner';
            document.body.prepend(banner);
        }
        return banner;
    }

    function showBanner(message, type) {
        clearTimeout(hideTimer);
        const el = getBanner();
        el.textContent = message;
        el.className = `offline-banner ${type}`;
        // Force reflow so transition plays
        void el.offsetHeight;
        el.classList.add('visible');
    }

    function hideBanner() {
        if (!banner) return;
        banner.classList.remove('visible');
        hideTimer = setTimeout(() => {
            if (banner) { banner.remove(); banner = null; }
        }, 350);
    }

    window.addEventListener('offline', () => {
        showBanner('You are offline — data saved locally', 'offline');
    });

    window.addEventListener('online', () => {
        showBanner('Back online', 'online');
        setTimeout(hideBanner, 3000);
    });

    // Show immediately if already offline on load
    if (!navigator.onLine) {
        window.addEventListener('load', () => {
            showBanner('You are offline — data saved locally', 'offline');
        }, { once: true });
    }
}());
