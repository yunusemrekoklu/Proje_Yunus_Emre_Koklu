import * as auth from './auth.js';

const API_BASE = '';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// State
let courseId = null;
let course = null;
let materials = [];
let lectureNotes = [];
let selectedFile = null;
let selectedNoteFile = null;
let currentUser = null;
let materialRatings = {};
let materialGrades = {};
let noteRatings = {};

// DOM Elements
const courseTitle = document.getElementById('course-title');
const materialsContainer = document.getElementById('materials-container');
const notesContainer = document.getElementById('notes-container');
const uploadBtn = document.getElementById('upload-btn');
const uploadNoteBtn = document.getElementById('upload-note-btn');
const uploadModal = document.getElementById('upload-modal');
const noteModal = document.getElementById('note-modal');
const closeModalBtn = document.getElementById('close-modal');
const closeNoteModalBtn = document.getElementById('close-note-modal');
const cancelBtn = document.getElementById('cancel-btn');
const cancelNoteBtn = document.getElementById('cancel-note-btn');
const uploadForm = document.getElementById('upload-form');
const noteUploadForm = document.getElementById('note-upload-form');
const fileInput = document.getElementById('file');
const dropZone = document.getElementById('drop-zone');
const fileInfo = document.getElementById('file-info');
const descriptionInput = document.getElementById('description');
const duplicateSection = document.getElementById('duplicate-section');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const submitBtn = document.getElementById('submit-btn');
const noteFileInput = document.getElementById('note-file');
const noteDropZone = document.getElementById('note-drop-zone');
const noteFileInfo = document.getElementById('note-file-info');
const noteProgressSection = document.getElementById('note-progress-section');
const noteProgressFill = document.getElementById('note-progress-fill');
const noteProgressText = document.getElementById('note-progress-text');
const noteSubmitBtn = document.getElementById('note-submit-btn');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authenticated = await auth.requireAuth();
    if (!authenticated) return;

    currentUser = await auth.getCurrentUser();
    renderUserInfo();

    // Get courseId from URL
    const urlParams = new URLSearchParams(window.location.search);
    courseId = urlParams.get('courseId');

    if (!courseId) {
        showError('Course ID is required');
        return;
    }

    // Hide upload button for non-instructors
    if (currentUser.role !== 'instructor' && currentUser.role !== 'admin') {
        const uploadBtnEl = document.getElementById('upload-btn');
        if (uploadBtnEl) uploadBtnEl.style.display = 'none';
    }

    loadCourse();
    loadMaterials();
    loadLectureNotes();
    setupEventListeners();
});

function renderUserInfo() {
    const userInfoContainer = document.getElementById('user-info');
    if (!currentUser || !userInfoContainer) return;

    userInfoContainer.innerHTML = `
        <div class="user-dropdown">
            <button class="user-dropdown-btn" id="user-dropdown-btn">
                <span class="user-name">${escapeHtml(currentUser.name)}</span>
                ${auth.getRoleBadge(currentUser.role)}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"/>
                </svg>
            </button>
            <div class="user-dropdown-menu" id="user-dropdown-menu">
                <a href="/index.html">Dashboard</a>
                ${currentUser.role === 'admin' ? '<a href="/admin.html">User Management</a>' : ''}
                <a href="#" id="logout-btn">Logout</a>
            </div>
        </div>
    `;

    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownMenu = document.getElementById('user-dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        dropdownMenu.classList.remove('active');
    });

    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        auth.logout();
    });
}

function setupEventListeners() {
    uploadBtn.addEventListener('click', openModal);
    uploadNoteBtn.addEventListener('click', openNoteModal);
    closeModalBtn.addEventListener('click', closeModal);
    closeNoteModalBtn.addEventListener('click', closeNoteModal);
    cancelBtn.addEventListener('click', closeModal);
    cancelNoteBtn.addEventListener('click', closeNoteModal);
    uploadModal.addEventListener('click', (e) => {
        if (e.target === uploadModal) closeModal();
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) closeNoteModal();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Note file input change
    noteFileInput.addEventListener('change', handleNoteFileSelect);

    // Note drag and drop
    noteDropZone.addEventListener('click', () => noteFileInput.click());
    noteDropZone.addEventListener('dragover', handleNoteDragOver);
    noteDropZone.addEventListener('dragleave', handleNoteDragLeave);
    noteDropZone.addEventListener('drop', handleNoteDrop);

    // Form submit
    uploadForm.addEventListener('submit', handleUpload);
    noteUploadForm.addEventListener('submit', handleNoteUpload);
}

// Load course details
async function loadCourse() {
    try {
        const response = await fetch(`${API_BASE}/api/courses/${courseId}`);
        const result = await response.json();

        if (result.success) {
            course = result.data;
            courseTitle.textContent = course.title;
        } else {
            showError(result.error || 'Failed to load course');
        }
    } catch (error) {
        console.error('Error loading course:', error);
    }
}

// Load materials
async function loadMaterials() {
    try {
        const response = await fetch(`${API_BASE}/api/courses/${courseId}/materials`);
        const result = await response.json();

        if (result.success) {
            materials = result.data;
            // Load ratings and grades for all materials
            await Promise.all(materials.map(m => loadMaterialRatings(m.id)));
            await Promise.all(materials.map(m => loadMaterialGrades(m.id)));
            renderMaterials();
        } else {
            showError(result.error || 'Failed to load materials');
        }
    } catch (error) {
        console.error('Error loading materials:', error);
        showError('Failed to connect to the server');
    }
}

// Load ratings for a material
async function loadMaterialRatings(materialId) {
    try {
        const response = await fetch(`${API_BASE}/api/materials/${materialId}/ratings`);
        const result = await response.json();
        if (result.success) {
            materialRatings[materialId] = result.data;
        }
    } catch (error) {
        console.error('Error loading ratings:', error);
    }
}

// Load grades for a material
async function loadMaterialGrades(materialId) {
    try {
        const response = await fetch(`${API_BASE}/api/materials/${materialId}/grades`);
        const result = await response.json();
        if (result.success) {
            materialGrades[materialId] = result.data;
        }
    } catch (error) {
        console.error('Error loading grades:', error);
    }
}

// ============================================
// Lecture Notes Functions
// ============================================

// Load lecture notes
async function loadLectureNotes() {
    try {
        const response = await fetch(`${API_BASE}/api/courses/${courseId}/notes`);
        const result = await response.json();

        if (result.success) {
            lectureNotes = result.data;
            // Load ratings for all notes
            await Promise.all(lectureNotes.map(n => loadNoteRatings(n.id)));
            renderLectureNotes();
        } else {
            showError(result.error || 'Failed to load lecture notes');
        }
    } catch (error) {
        console.error('Error loading lecture notes:', error);
    }
}

// Load ratings for a note
async function loadNoteRatings(noteId) {
    try {
        const response = await fetch(`${API_BASE}/api/notes/${noteId}/ratings`);
        const result = await response.json();
        if (result.success) {
            noteRatings[noteId] = result.data;
        }
    } catch (error) {
        console.error('Error loading note ratings:', error);
    }
}

// Render lecture notes
function renderLectureNotes() {
    if (lectureNotes.length === 0) {
        notesContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3>No Lecture Notes Yet</h3>
                <p>Be the first to share a lecture note!</p>
            </div>
        `;
        return;
    }

    notesContainer.innerHTML = lectureNotes.map(note => {
        const ratings = noteRatings[note.id] || { ratings: [], average: 0, count: 0 };
        const isInstructor = note.uploaderRole === 'instructor';

        return `
        <div class="note-item">
            <div class="note-header">
                <div class="note-owner">
                    <span>${escapeHtml(note.uploaderName)}</span>
                    <span class="owner-badge ${isInstructor ? 'instructor' : 'student'}">
                        ${isInstructor ? 'Instructor' : 'Student'}
                    </span>
                </div>
                <div class="note-actions">
                    <button class="btn btn-small btn-secondary" onclick="downloadNote(${note.id})">
                        Download
                    </button>
                    ${note.uploaderId === currentUser.id || currentUser.role === 'admin' ? `
                        <button class="btn btn-small btn-danger" onclick="deleteNote(${note.id})">
                            Delete
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="note-title">${escapeHtml(note.originalName)}</div>
            ${note.description ? `<div class="note-description">${escapeHtml(note.description)}</div>` : ''}

            <div class="note-meta">
                <span>${formatDate(note.createdAt)}</span>
                <span>${formatFileSize(note.sizeBytes)}</span>
            </div>

            <!-- Rating Section -->
            <div class="note-rating-section">
                <div class="rating-summary">
                    <span class="rating-average">${ratings.average.toFixed(1)}</span>
                    <span class="rating-count">${ratings.count} ${ratings.count === 1 ? 'rating' : 'ratings'}</span>
                </div>
                <div class="stars">
                    ${renderStars(ratings.average)}
                </div>
            </div>

            <!-- Rating Form -->
            <div class="rating-form">
                <div class="rating-stars-input" id="note-rating-stars-${note.id}">
                    ${[1,2,3,4,5].map(i => `
                        <svg class="star-input" data-rating="${i}" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                    `).join('')}
                </div>
                <textarea class="rating-comment-input" id="note-comment-${note.id}"
                          placeholder="Add a comment..." rows="2"></textarea>
                <button class="btn btn-primary btn-small" onclick="submitNoteRating(${note.id})">
                    Submit Rating
                </button>
            </div>

            <!-- Comments (Latest 3) -->
            <div class="rating-comments">
                ${(ratings.ratings || []).filter(r => r.comment).slice(0, 3).map(r => `
                    <div class="rating-comment">
                        <div class="rating-comment-header">
                            <span class="rating-comment-user">${escapeHtml(r.userName)}</span>
                            <span class="rating-comment-date">${formatDate(r.createdAt)}</span>
                        </div>
                        <div class="stars">${renderStars(r.rating)}</div>
                        ${r.comment ? `<div style="margin-top: 0.5rem;">${escapeHtml(r.comment)}</div>` : ''}
                    </div>
                `).join('')}

                ${(ratings.ratings || []).filter(r => r.comment).length > 3 ? `
                    <button class="btn btn-secondary btn-small show-more-btn" onclick="showAllComments(${note.id})">
                        Show all ${ratings.ratings.filter(r => r.comment).length} comments
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    }).join('');

    setupNoteStarInputs();
}

// Setup note rating stars
function setupNoteStarInputs() {
    lectureNotes.forEach(note => {
        const container = document.getElementById(`note-rating-stars-${note.id}`);
        if (!container) return;

        const stars = container.querySelectorAll('.star-input');
        let selectedRating = 0;

        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                // Store selected rating in container dataset
                container.dataset.selectedRating = selectedRating;
                updateStars(selectedRating);
            });

            star.addEventListener('mouseenter', () => {
                updateStars(parseInt(star.dataset.rating));
            });
        });

        container.addEventListener('mouseleave', () => {
            updateStars(selectedRating);
        });

        function updateStars(rating) {
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < rating);
            });
        }
    });
}

// Submit note rating
window.submitNoteRating = async function(noteId) {
    const container = document.getElementById(`note-rating-stars-${noteId}`);
    const commentInput = document.getElementById(`note-comment-${noteId}`);

    // Read selected rating from container dataset
    const rating = container.dataset.selectedRating ? parseInt(container.dataset.selectedRating) : null;
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!rating) {
        showToast('Please select a rating', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/notes/${noteId}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, comment })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Rating submitted', 'success');
            await loadNoteRatings(noteId);
            renderLectureNotes();
        } else {
            showToast(result.error || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Failed to connect', 'error');
    }
};

// Download note
window.downloadNote = function(noteId) {
    window.open(`${API_BASE}/api/notes/${noteId}/download`, '_blank');
};

// Delete note
window.deleteNote = async function(noteId) {
    if (!confirm('Delete this lecture note?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/notes/${noteId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Lecture note deleted', 'success');
            await loadLectureNotes();
        } else {
            showToast(result.error || 'Failed', 'error');
        }
    } catch (error) {
        showToast('Failed to connect', 'error');
    }
};

// Show all comments modal
window.showAllComments = function(noteId) {
    const ratings = noteRatings[noteId];
    if (!ratings) return;

    const comments = (ratings.ratings || []).filter(r => r.comment);

    // Create modal HTML dynamically
    const modalHtml = `
        <div id="comments-modal" class="modal active">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>All Comments</h3>
                    <button class="close-btn" onclick="closeCommentsModal()">&times;</button>
                </div>
                <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                    ${comments.map(r => `
                        <div class="rating-comment">
                            <div class="rating-comment-header">
                                <span class="rating-comment-user">${escapeHtml(r.userName)}</span>
                                <span class="rating-comment-date">${formatDate(r.createdAt)}</span>
                            </div>
                            <div class="stars">${renderStars(r.rating)}</div>
                            <div style="margin-top: 0.5rem;">${escapeHtml(r.comment)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('comments-modal');
    if (existingModal) existingModal.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// Close comments modal
window.closeCommentsModal = function() {
    const modal = document.getElementById('comments-modal');
    if (modal) modal.remove();
};

// Note modal functions
function openNoteModal() {
    noteModal.classList.add('active');
}

function closeNoteModal() {
    noteModal.classList.remove('active');
    resetNoteForm();
}

function resetNoteForm() {
    noteUploadForm.reset();
    selectedNoteFile = null;
    noteFileInfo.classList.remove('active');
    noteProgressSection.classList.add('hidden');
    noteSubmitBtn.disabled = true;
    noteFileInput.value = '';
}

// Handle note upload
async function handleNoteUpload(e) {
    e.preventDefault();

    if (!selectedNoteFile) {
        showToast('Please select a file', 'error');
        return;
    }

    const description = document.getElementById('note-description').value;

    // Validate file type
    const allowedTypes = ['.pdf', '.docx'];
    const fileExt = '.' + selectedNoteFile.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
        showToast('Only PDF and DOCX files are allowed', 'error');
        return;
    }

    // Validate file size
    if (selectedNoteFile.size > MAX_FILE_SIZE) {
        showToast('File too large. Maximum size is 100MB', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedNoteFile);
    formData.append('description', description);

    // Show progress
    noteProgressSection.classList.remove('hidden');
    noteSubmitBtn.disabled = true;
    cancelNoteBtn.disabled = true;

    // Simulate progress for large files
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            noteProgressFill.style.width = Math.min(progress, 90) + '%';
        }
    }, 100);

    try {
        const response = await fetch(`${API_BASE}/api/courses/${courseId}/notes`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        noteProgressFill.style.width = '100%';

        const result = await response.json();

        if (result.success) {
            noteProgressText.textContent = 'Upload complete!';
            showToast('Lecture note uploaded successfully', 'success');

            setTimeout(() => {
                closeNoteModal();
                loadLectureNotes();
            }, 500);
        } else {
            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        clearInterval(progressInterval);
        noteProgressSection.classList.add('hidden');
        noteSubmitBtn.disabled = false;
        cancelNoteBtn.disabled = false;
        showToast(error.message || 'Upload failed. Please try again.', 'error');
    }
}

// Render materials with ratings and grades
function renderMaterials() {
    if (materials.length === 0) {
        materialsContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3>No Materials Yet</h3>
                <p>Upload your first course material to get started.</p>
            </div>
        `;
        return;
    }

    materialsContainer.innerHTML = materials.map(material => {
        const ratings = materialRatings[material.id] || { ratings: [], average: 0, count: 0 };
        const grades = materialGrades[material.id] || { grades: [], average: 0, count: 0 };

        return `
        <div class="material-wrapper">
            <div class="material-item">
                <div class="material-icon">
                    ${getFileIcon(material.originalName)}
                </div>
                <div class="material-info">
                    <div class="material-name">
                        ${escapeHtml(material.originalName)}
                        ${material.version > 1 ? `<span class="version-badge">v${material.version}</span>` : ''}
                    </div>
                    ${material.description ? `<div class="material-description">${escapeHtml(material.description)}</div>` : ''}
                    <div class="material-meta">
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            ${formatDate(material.createdAt)}
                        </span>
                        <span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            ${formatFileSize(material.sizeBytes)}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Rating Section -->
            <div class="material-rating-section">
                <div class="rating-summary">
                    <div>
                        <div class="rating-average">${ratings.average.toFixed(1)}</div>
                        <div class="rating-count">${ratings.count} ${ratings.count === 1 ? 'rating' : 'ratings'}</div>
                    </div>
                    <div class="stars">
                        ${renderStars(ratings.average)}
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700;">${grades.average.toFixed(0)}</div>
                        <div class="rating-count">${grades.count} ${grades.count === 1 ? 'grade' : 'grades'}</div>
                    </div>
                </div>

                <!-- Rating Form -->
                <div class="rating-form">
                    <div class="rating-stars-input" id="rating-stars-${material.id}">
                        ${[1,2,3,4,5].map(i => `
                            <svg class="star-input" data-rating="${i}" viewBox="0 0 24 24">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        `).join('')}
                    </div>
                    <textarea class="rating-comment-input" id="rating-comment-${material.id}" placeholder="Add a comment..." rows="2"></textarea>
                    <button class="btn btn-primary btn-small" onclick="submitRating(${material.id})">Submit Rating</button>

                    <div class="grade-form" style="margin-top: 1rem;">
                        <input type="number" class="grade-input" id="grade-${material.id}" min="0" max="100" placeholder="0-100">
                        <button class="btn btn-secondary btn-small" onclick="submitGrade(${material.id})">Give Grade</button>
                    </div>
                </div>

                <!-- Comments -->
                <div class="rating-comments">
                    ${(ratings.ratings || []).filter(r => r.comment).map(r => `
                        <div class="rating-comment">
                            <div class="rating-comment-header">
                                <span class="rating-comment-user">${escapeHtml(r.userName)}</span>
                                <span class="rating-comment-date">${formatDate(r.createdAt)}</span>
                            </div>
                            <div class="stars">${renderStars(r.rating)}</div>
                            ${r.comment ? `<div style="margin-top: 0.5rem;">${escapeHtml(r.comment)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `}).join('');

    // Setup star input handlers
    setupStarInputs();
}

function setupStarInputs() {
    materials.forEach(material => {
        const container = document.getElementById(`rating-stars-${material.id}`);
        if (!container) return;

        const stars = container.querySelectorAll('.star-input');
        let selectedRating = 0;

        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.rating);
                // Store selected rating in container dataset
                container.dataset.selectedRating = selectedRating;
                updateStars(selectedRating);
            });

            star.addEventListener('mouseenter', () => {
                updateStars(parseInt(star.dataset.rating));
            });
        });

        container.addEventListener('mouseleave', () => {
            updateStars(selectedRating);
        });

        function updateStars(rating) {
            stars.forEach((s, i) => {
                s.classList.toggle('active', i < rating);
            });
        }
    });
}

// Submit rating
window.submitRating = async function(materialId) {
    const container = document.getElementById(`rating-stars-${materialId}`);
    const commentInput = document.getElementById(`rating-comment-${materialId}`);

    // Read selected rating from container dataset
    const rating = container.dataset.selectedRating ? parseInt(container.dataset.selectedRating) : null;
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!rating) {
        showToast('Please select a rating', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/materials/${materialId}/ratings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rating, comment })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Rating submitted successfully', 'success');
            // Reload ratings
            await loadMaterialRatings(materialId);
            renderMaterials();
        } else {
            showToast(result.error || 'Failed to submit rating', 'error');
        }
    } catch (error) {
        console.error('Error submitting rating:', error);
        showToast('Failed to connect to the server', 'error');
    }
};

// Submit grade
window.submitGrade = async function(materialId) {
    const gradeInput = document.getElementById(`grade-${materialId}`);
    const grade = parseInt(gradeInput.value);

    if (isNaN(grade) || grade < 0 || grade > 100) {
        showToast('Please enter a grade between 0 and 100', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/materials/${materialId}/grades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grade })
        });

        const result = await response.json();

        if (result.success) {
            showToast('Grade submitted successfully', 'success');
            // Reload grades
            await loadMaterialGrades(materialId);
            renderMaterials();
        } else {
            showToast(result.error || 'Failed to submit grade', 'error');
        }
    } catch (error) {
        console.error('Error submitting grade:', error);
        showToast('Failed to connect to the server', 'error');
    }
};

function renderStars(rating) {
    let stars = '';
    const filledStars = Math.floor(rating); // Use floor instead of round to fix star display

    for (let i = 1; i <= 5; i++) {
        const filled = i <= filledStars;
        stars += `<svg class="star ${filled ? 'filled' : ''}" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>`;
    }
    return stars;
}

// Get file icon based on extension
function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg>',
        docx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l2 2 4-4"/></svg>',
        pptx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><rect x="9" y="12" width="6" height="8"/></svg>',
        xlsx: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M12 9v8"/></svg>',
        zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>'
    };
    return icons[ext] || icons.pdf;
}

// Modal functions
function openModal() {
    uploadModal.classList.add('active');
    resetForm();
}

function closeModal() {
    uploadModal.classList.remove('active');
    resetForm();
}

function resetForm() {
    uploadForm.reset();
    selectedFile = null;
    fileInfo.classList.remove('active');
    duplicateSection.classList.add('hidden');
    progressSection.classList.add('hidden');
    submitBtn.disabled = true;
    fileInput.value = '';
}

// File handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndSetFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
        validateAndSetFile(file);
    }
}

function validateAndSetFile(file) {
    // Check file type
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.xlsx', '.zip'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
        showToast('Unsupported file type. Allowed: PDF, DOCX, PPTX, XLSX, ZIP', 'error');
        return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        showToast('File too large. Maximum size is 100MB', 'error');
        return;
    }

    selectedFile = file;

    // Show file info
    fileInfo.innerHTML = `
        <div class="file-info-name">${escapeHtml(file.name)}</div>
        <div class="file-info-size">${formatFileSize(file.size)}</div>
    `;
    fileInfo.classList.add('active');

    // Check for duplicate
    checkDuplicate(file.name);

    submitBtn.disabled = false;
}

function checkDuplicate(fileName) {
    const existing = materials.find(m => m.originalName === fileName);

    if (existing) {
        duplicateSection.classList.remove('hidden');
    } else {
        duplicateSection.classList.add('hidden');
    }
}

// Note file handling
function handleNoteFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        validateAndSetNoteFile(file);
    }
}

function handleNoteDragOver(e) {
    e.preventDefault();
    noteDropZone.classList.add('drag-over');
}

function handleNoteDragLeave(e) {
    e.preventDefault();
    noteDropZone.classList.remove('drag-over');
}

function handleNoteDrop(e) {
    e.preventDefault();
    noteDropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file) {
        validateAndSetNoteFile(file);
    }
}

function validateAndSetNoteFile(file) {
    // Check file type
    const allowedTypes = ['.pdf', '.docx'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(fileExt)) {
        showToast('Unsupported file type. Allowed: PDF, DOCX', 'error');
        return;
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        showToast('File too large. Maximum size is 100MB', 'error');
        return;
    }

    selectedNoteFile = file;

    // Show file info
    noteFileInfo.innerHTML = `
        <div class="file-info-name">${escapeHtml(file.name)}</div>
        <div class="file-info-size">${formatFileSize(file.size)}</div>
    `;
    noteFileInfo.classList.add('active');

    noteSubmitBtn.disabled = false;
}

// Upload handling
async function handleUpload(e) {
    e.preventDefault();

    if (!selectedFile) {
        showToast('Please select a file', 'error');
        return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', descriptionInput.value);
    formData.append('instructorId', currentUser.id);

    // Get duplicate policy
    const policyRadios = document.getElementsByName('duplicatePolicy');
    for (const radio of policyRadios) {
        if (radio.checked) {
            formData.append('duplicatePolicy', radio.value);
            break;
        }
    }

    // Show progress
    progressSection.classList.remove('hidden');
    submitBtn.disabled = true;
    cancelBtn.disabled = true;

    // Simulate progress for large files
    let progress = 0;
    const progressInterval = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            progressFill.style.width = Math.min(progress, 90) + '%';
        }
    }, 100);

    try {
        const response = await fetch(`${API_BASE}/api/courses/${courseId}/materials/upload`, {
            method: 'POST',
            body: formData
        });

        clearInterval(progressInterval);
        progressFill.style.width = '100%';

        const result = await response.json();

        if (result.success) {
            progressText.textContent = 'Upload complete!';
            showToast(result.message || 'File uploaded successfully', 'success');

            setTimeout(() => {
                closeModal();
                loadMaterials();
            }, 500);
        } else {
            // Handle duplicate conflict
            if (result.duplicateExists) {
                clearInterval(progressInterval);
                progressSection.classList.add('hidden');
                submitBtn.disabled = false;
                cancelBtn.disabled = false;
                showToast(result.error, 'error');
                return;
            }

            throw new Error(result.error || 'Upload failed');
        }
    } catch (error) {
        clearInterval(progressInterval);
        progressSection.classList.add('hidden');
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        showToast(error.message || 'Upload failed. Please try again.', 'error');
    }
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    materialsContainer.innerHTML = `
        <div class="alert alert-error">
            <strong>Error</strong>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

function showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        ${type === 'success'
            ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        }
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
