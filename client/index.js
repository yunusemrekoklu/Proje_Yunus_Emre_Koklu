import * as auth from './auth.js';

const API_BASE = '';

// State
let availableCourses = [];
let myRequests = [];
let enrolledCourses = [];
let faculties = [];
let departments = [];
let currentUser = null;

// DOM Elements
const coursesContainer = document.getElementById('courses-container');
const requestsContainer = document.getElementById('requests-container');
const enrolledContainer = document.getElementById('enrolled-container');
const userInfoContainer = document.getElementById('user-info');
const filterFaculty = document.getElementById('filter-faculty');
const filterDepartment = document.getElementById('filter-department');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isAuthenticated = await auth.requireAuth();
    if (!isAuthenticated) return;

    currentUser = await auth.getCurrentUser();

    // Only students can access this page
    if (currentUser.role !== 'student') {
        if (currentUser.role === 'instructor') {
            window.location.href = '/instructor.html';
        } else if (currentUser.role === 'admin') {
            window.location.href = '/admin.html';
        }
        return;
    }

    renderUserInfo();

    // Load data
    await Promise.all([
        loadEnrolledCourses(),
        loadMyRequests(),
        loadAvailableCourses(),
        loadFaculties()
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
                <a href="/index.html">Panel</a>
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
    // Filter faculty change
    filterFaculty?.addEventListener('change', async (e) => {
        const facultyId = e.target.value;

        if (facultyId) {
            // Load departments for this faculty
            await loadDepartments(facultyId);
            filterDepartment.disabled = false;
        } else {
            filterDepartment.innerHTML = '<option value="">Önce fakülte seçiniz</option>';
            filterDepartment.disabled = true;
        }

        filterCourses();
    });

    // Filter department change
    filterDepartment?.addEventListener('change', () => {
        filterCourses();
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

// Load enrolled courses
async function loadEnrolledCourses() {
    try {
        const response = await fetch(`${API_BASE}/api/enrollments/my-courses`);
        const result = await response.json();

        if (result.success) {
            enrolledCourses = result.data;
            renderEnrolledCourses();
        }
    } catch (error) {
        console.error('Error loading enrolled courses:', error);
    }
}

function renderEnrolledCourses() {
    if (!enrolledContainer) return;

    if (enrolledCourses.length === 0) {
        enrolledContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: #666;">Henüz kayıtlı dersiniz yok.</p>';
        return;
    }

    enrolledContainer.innerHTML = enrolledCourses.map(course => `
        <a href="/course.html?courseId=${course.id}" class="course-card">
            <h3>${escapeHtml(course.title)}</h3>
            <p class="instructor">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                ${escapeHtml(course.instructorName)}
            </p>
            <div class="meta">
                <span>${course.facultyName || ''}</span>
                <span>${course.departmentName || ''}</span>
            </div>
            <div style="margin-top: auto;">
                <span class="enrollment-count">Derse Git →</span>
            </div>
        </a>
    `).join('');
}

// Load my enrollment requests
async function loadMyRequests() {
    try {
        const response = await fetch(`${API_BASE}/api/enrollments/my-requests`);
        const result = await response.json();

        if (result.success) {
            myRequests = result.data;
            renderRequests();
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    }
}

function renderRequests() {
    if (!requestsContainer) return;

    if (myRequests.length === 0) {
        requestsContainer.innerHTML = '<p class="text-muted">Henüz ders kayıt talebiniz yok.</p>';
        return;
    }

    requestsContainer.innerHTML = myRequests.map(request => {
        const statusClass = `status-${request.status}`;
        const statusText = {
            'pending': 'Beklemede',
            'approved': 'Onaylandı',
            'rejected': 'Reddedildi'
        }[request.status];

        return `
            <div class="request-item">
                <div class="request-info">
                    <h4>${escapeHtml(request.courseTitle)}</h4>
                    <div class="request-meta">
                        ${escapeHtml(request.instructorName)} •
                        ${request.facultyName ? escapeHtml(request.facultyName) : ''}
                        ${request.departmentName ? ' • ' + escapeHtml(request.departmentName) : ''}
                    </div>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
        `;
    }).join('');
}

// Load available courses
async function loadAvailableCourses() {
    try {
        const response = await fetch(`${API_BASE}/api/enrollments/courses/available`);
        const result = await response.json();

        if (result.success) {
            availableCourses = result.data;
            renderCourses(availableCourses);
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showError('Dersler yüklenemedi');
    }
}

function renderCourses(courses) {
    if (!coursesContainer) return;

    if (courses.length === 0) {
        coursesContainer.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">Kayıt olabileceğiniz ders bulunmamaktadır.</p>';
        return;
    }

    coursesContainer.innerHTML = courses.map(course => `
        <div class="course-card">
            <h3>${escapeHtml(course.title)}</h3>
            <div class="instructor">${escapeHtml(course.instructorName)}</div>
            <div class="meta">
                <span>${course.facultyName || ''}</span>
                <span>${course.departmentName || ''}</span>
            </div>
            <div class="meta" style="margin-top: auto;">
                <span class="enrollment-count">${course.enrollmentCount} kayıtlı</span>
                <button class="btn btn-primary btn-small" onclick="window.requestEnrollment(${course.id})">
                    Kayıt Talep Et
                </button>
            </div>
        </div>
    `).join('');
}

function filterCourses() {
    const facultyId = filterFaculty?.value;
    const departmentId = filterDepartment?.value;

    let filtered = [...availableCourses];

    if (facultyId) {
        filtered = filtered.filter(c => c.facultyId == facultyId);
    }

    if (departmentId) {
        filtered = filtered.filter(c => c.departmentId == departmentId);
    }

    renderCourses(filtered);
}

// Load faculties for filter
async function loadFaculties() {
    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            faculties = result.data;

            filterFaculty.innerHTML = '<option value="">Tüm Fakülteler</option>' +
                faculties.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading faculties:', error);
    }
}

async function loadDepartments(facultyId) {
    try {
        const response = await fetch(`${API_BASE}/api/departments?facultyId=${facultyId}`);
        const result = await response.json();

        if (result.success) {
            departments = result.data;

            filterDepartment.innerHTML = '<option value="">Tüm Bölümler</option>' +
                departments.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// Request enrollment in a course
window.requestEnrollment = async function(courseId) {
    if (!confirm('Bu ders için kayıt talebi oluşturmak istediğinizden emin misiniz?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/enrollments/courses/${courseId}/enroll`, {
            method: 'POST'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Kayıt talebi oluşturuldu!');
            await Promise.all([
                loadMyRequests(),
                loadAvailableCourses()
            ]);
        } else {
            showError(result.error || 'Talep oluşturulamadı');
        }
    } catch (error) {
        console.error('Error requesting enrollment:', error);
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
            faculties = result.data;

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
                    <div class="faculty-department" onclick="window.filterByDepartment(${dept.id}, '${escapeHtml(dept.name)}', '${escapeHtml(faculty.name)}')">
                        ${escapeHtml(dept.name)}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Filter courses by department from panel
window.filterByDepartment = function(departmentId, departmentName, facultyName) {
    // Close panel
    const facultyPanel = document.getElementById('faculty-panel');
    const facultyPanelOverlay = document.getElementById('faculty-panel-overlay');
    const facultyToggleBtn = document.getElementById('faculty-toggle-btn');
    facultyPanel?.classList.remove('active');
    facultyPanelOverlay?.classList.remove('active');
    facultyToggleBtn?.classList.remove('active');

    // Set filters
    filterFaculty.value = '';
    filterDepartment.innerHTML = `<option value="${departmentId}">${departmentName}</option>`;
    filterDepartment.disabled = false;

    // Filter courses
    filterCourses();

    // Scroll to courses section
    coursesContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
