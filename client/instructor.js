import * as auth from './auth.js';

const API_BASE = '';

// State
let myCourses = [];
let enrollmentRequests = [];
let currentUser = null;

// DOM Elements
const coursesContainer = document.getElementById('courses-container');
const requestsContainer = document.getElementById('requests-container');
const userInfoContainer = document.getElementById('user-info');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isAuthenticated = await auth.requireAuth();
    if (!isAuthenticated) return;

    currentUser = await auth.getCurrentUser();

    // Only instructors can access this page
    if (currentUser.role !== 'instructor' && currentUser.role !== 'admin') {
        if (currentUser.role === 'student') {
            window.location.href = '/index.html';
        } else if (currentUser.role === 'admin') {
            window.location.href = '/admin.html';
        }
        return;
    }

    renderUserInfo();

    // Load data
    await Promise.all([
        loadMyCourses(),
        loadEnrollmentRequests()
    ]);

    // Load faculties for panel
    loadFacultiesForPanel();

    setupEventListeners();
});

function renderUserInfo() {
    if (!currentUser) return;

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
                <a href="/instructor.html">Panel</a>
                <a href="/admin.html">Yönetim</a>
                <a href="#" id="logout-btn">Çıkış</a>
            </div>
        </div>
    `;

    // Setup dropdown
    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownMenu = document.getElementById('user-dropdown-menu');
    const logoutBtn = document.getElementById('logout-btn');

    dropdownBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    });

    document.addEventListener('click', () => {
        dropdownMenu?.classList.remove('active');
    });

    logoutBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        await auth.logout();
    });
}

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.course-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Faculty panel toggle
    const facultyToggleBtn = document.getElementById('faculty-toggle-btn');
    const facultyPanel = document.getElementById('faculty-panel');
    const facultyPanelOverlay = document.getElementById('faculty-panel-overlay');
    const facultyPanelClose = document.getElementById('faculty-panel-close');

    facultyToggleBtn?.addEventListener('click', () => {
        facultyPanel?.classList.add('active');
        facultyPanelOverlay?.classList.add('active');
        facultyToggleBtn.classList.add('active');
    });

    const closePanel = () => {
        facultyPanel?.classList.remove('active');
        facultyPanelOverlay?.classList.remove('active');
        facultyToggleBtn?.classList.remove('active');
    };

    facultyPanelClose?.addEventListener('click', closePanel);
    facultyPanelOverlay?.addEventListener('click', closePanel);
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.course-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// Load my courses
async function loadMyCourses() {
    try {
        const response = await fetch(`${API_BASE}/api/courses?instructorId=${currentUser.id}`);
        const result = await response.json();

        if (result.success) {
            myCourses = result.data;
            renderCourses();
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showError('Dersler yüklenemedi');
    }
}

function renderCourses() {
    if (!coursesContainer) return;

    if (myCourses.length === 0) {
        coursesContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                </svg>
                <h3>Henüz dersiniz yok</h3>
                <p>Size atanmış ders bulunmamaktadır.</p>
            </div>
        `;
        return;
    }

    coursesContainer.innerHTML = `
        <div class="course-grid">
            ${myCourses.map(course => `
                <a href="/course.html?courseId=${course.id}" class="course-card">
                    <h3>${escapeHtml(course.title)}</h3>
                    <p class="course-id">Ders Kodu: ${course.id}</p>
                    <p class="instructor">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        ${escapeHtml(currentUser.name)}
                    </p>
                    <div style="margin-top: 1rem;">
                        <span class="badge">${course.enrollmentCount || 0} kayıtlı öğrenci</span>
                    </div>
                </a>
            `).join('')}
        </div>
    `;
}

// Load enrollment requests
async function loadEnrollmentRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/enrollments/requests`);
        const result = await response.json();

        if (result.success) {
            enrollmentRequests = result.data;
            renderRequests();
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        showError('Talepler yüklenemedi');
    }
}

function renderRequests() {
    if (!requestsContainer) return;

    if (enrollmentRequests.length === 0) {
        requestsContainer.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293H19a2 2 0 012 2v10a2 2 0 01-2 2H9a2 2 0 01-2-2v-5a2 2 0 012-2h5.586a1 1 0 01.707-.293l5.414-5.414a1 1 0 011.414 0z"/>
                </svg>
                <h3>Bekleyen talep yok</h3>
                <p>Şu anda bekleyen ders kayıt talebi bulunmamaktadır.</p>
            </div>
        `;
        return;
    }

    requestsContainer.innerHTML = `
        <div class="enrollment-requests">
            ${enrollmentRequests.map(request => `
                <div class="request-card" id="request-${request.id}">
                    <div class="request-header">
                        <h3>${escapeHtml(request.courseTitle)}</h3>
                        <span class="badge">Beklemede</span>
                    </div>

                    <div class="request-details">
                        <div class="request-detail">
                            <label>Öğrenci</label>
                            <span>${escapeHtml(request.studentName)}</span>
                        </div>
                        <div class="request-detail">
                            <label>E-posta</label>
                            <span>${escapeHtml(request.studentEmail)}</span>
                        </div>
                        <div class="request-detail">
                            <label>Fakülte</label>
                            <span>${escapeHtml(request.facultyName || '-')}</span>
                        </div>
                        <div class="request-detail">
                            <label>Bölüm</label>
                            <span>${escapeHtml(request.departmentName || '-')}</span>
                        </div>
                    </div>

                    <div class="request-actions">
                        <button class="btn btn-primary" onclick="window.handleRequest(${request.id}, 'approved')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: text-bottom; margin-right: 0.5rem;">
                                <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Onayla
                        </button>
                        <button class="btn btn-danger" onclick="window.handleRequest(${request.id}, 'rejected')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: text-bottom; margin-right: 0.5rem;">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                            Reddet
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Handle enrollment request (approve/reject)
window.handleRequest = async function(requestId, status) {
    const action = status === 'approved' ? 'onaylamak' : 'reddetmek';

    if (!confirm(`Bu kayıt talebini ${action} istediğinizden emin misiniz?`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/enrollments/requests/${requestId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess(result.message);
            // Remove the request card from DOM
            const requestCard = document.getElementById(`request-${requestId}`);
            if (requestCard) {
                requestCard.style.opacity = '0.5';
                requestCard.style.pointerEvents = 'none';
            }
            // Reload all requests
            await loadEnrollmentRequests();
            await loadMyCourses(); // Update enrollment counts
        } else {
            showError(result.error || 'İşlem başarısız');
        }
    } catch (error) {
        console.error('Error handling request:', error);
        showError('Sunucu hatası');
    }
};

function showSuccess(message) {
    alert(message);
}

function showError(message) {
    alert(message);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load faculties for faculty panel
async function loadFacultiesForPanel() {
    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            const faculties = result.data;

            // Load departments for each faculty
            const facultiesWithDepts = await Promise.all(
                faculties.map(async (faculty) => {
                    const deptResponse = await fetch(`${API_BASE}/api/departments?facultyId=${faculty.id}`);
                    const deptResult = await deptResponse.json();
                    return {
                        ...faculty,
                        departments: deptResult.success ? deptResult.data : []
                    };
                })
            );

            renderFacultyPanel(facultiesWithDepts);
        }
    } catch (error) {
        console.error('Error loading faculties for panel:', error);
    }
}

function renderFacultyPanel(facultiesWithDepts) {
    const panelContent = document.getElementById('faculty-panel-content');
    if (!panelContent) return;

    panelContent.innerHTML = facultiesWithDepts.map(faculty => `
        <div class="faculty-item">
            <div class="faculty-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10-5z"/>
                </svg>
                ${escapeHtml(faculty.name)}
            </div>
            <div class="faculty-departments">
                ${faculty.departments.map(dept => `
                    <div class="faculty-department">
                        ${escapeHtml(dept.name)}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}
