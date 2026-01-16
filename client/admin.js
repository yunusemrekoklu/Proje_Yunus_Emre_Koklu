import * as auth from './auth.js';

const API_BASE = '';

// State
let users = [];
let faculties = [];
let departments = [];
let courses = [];
let currentUser = null;
let editingUserId = null;
let editingFacultyId = null;
let editingDepartmentId = null;

// DOM Elements
const usersContainer = document.getElementById('users-container');
const facultiesContainer = document.getElementById('faculties-container');
const departmentsContainer = document.getElementById('departments-container');
const userInfoContainer = document.getElementById('user-info');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check admin access
    const isAdmin = await auth.requireAdmin();
    if (!isAdmin) return;

    currentUser = await auth.getCurrentUser();
    renderUserInfo();

    // Load initial data
    await Promise.all([
        loadUsers(),
        loadFaculties(),
        loadDepartments(),
        loadCourses()
    ]);

    // Setup faculty panel after faculties loaded
    setTimeout(() => setupFacultyPanel(), 500);

    // Setup courses panel after courses loaded
    setTimeout(() => setupCoursesPanel(), 500);

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
    // Tab switching
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchTab(tabName);
        });
    });

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.close;
            closeModal(modalId);
        });
    });

    // User form
    document.getElementById('user-form')?.addEventListener('submit', handleUserSubmit);
    document.getElementById('add-user-btn')?.addEventListener('click', () => openUserModal());

    // Faculty form
    document.getElementById('faculty-form')?.addEventListener('submit', handleFacultySubmit);
    document.getElementById('add-faculty-btn')?.addEventListener('click', () => openFacultyModal());

    // Department form
    document.getElementById('department-form')?.addEventListener('submit', handleDepartmentSubmit);
    document.getElementById('add-department-btn')?.addEventListener('click', () => openDepartmentModal());

    // Faculty/Department dropdown dependency
    document.getElementById('user-faculty')?.addEventListener('change', (e) => {
        const facultyId = e.target.value;
        loadDepartmentsForUser(facultyId);
    });

    document.getElementById('user-role')?.addEventListener('change', (e) => {
        const role = e.target.value;
        const facultyGroup = document.getElementById('faculty-group');
        const departmentGroup = document.getElementById('department-group');

        if (role === 'instructor' || role === 'student') {
            facultyGroup.style.display = 'block';
            departmentGroup.style.display = 'block';
        } else {
            facultyGroup.style.display = 'none';
            departmentGroup.style.display = 'none';
        }
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

    // Courses panel toggle
    const coursesToggleBtn = document.getElementById('courses-toggle-btn');
    const coursesPanel = document.getElementById('courses-panel');
    const coursesPanelOverlay = document.getElementById('courses-panel-overlay');
    const coursesPanelClose = document.getElementById('courses-panel-close');

    coursesToggleBtn?.addEventListener('click', () => {
        coursesPanel?.classList.add('active');
        coursesPanelOverlay?.classList.add('active');
        coursesToggleBtn.classList.add('active');
    });

    const closeCoursesPanel = () => {
        coursesPanel?.classList.remove('active');
        coursesPanelOverlay?.classList.remove('active');
        coursesToggleBtn?.classList.remove('active');
    };

    coursesPanelClose?.addEventListener('click', closeCoursesPanel);
    coursesPanelOverlay?.addEventListener('click', closeCoursesPanel);

    // Assign course form
    document.getElementById('assign-course-form')?.addEventListener('submit', handleAssignCourseSubmit);
    document.getElementById('assign-course-faculty')?.addEventListener('change', (e) => {
        const facultyId = e.target.value;
        loadDepartmentsForAssignCourse(facultyId);
    });
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// ============================================
// USERS
// ============================================

async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/users`);
        const result = await response.json();

        if (result.success) {
            users = result.data;
            renderUsers();
        } else {
            showError('Kullanıcılar yüklenemedi');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Sunucu hatası');
    }
}

function renderUsers() {
    if (!usersContainer) return;

    if (users.length === 0) {
        usersContainer.innerHTML = '<p class="text-center">Henüz kullanıcı yok.</p>';
        return;
    }

    usersContainer.innerHTML = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Ad Soyad</th>
                    <th>E-posta</th>
                    <th>Rol</th>
                    <th>Fakülte</th>
                    <th>Bölüm</th>
                    <th>İşlemler</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${escapeHtml(user.name)}</td>
                        <td>${escapeHtml(user.email)}</td>
                        <td>${auth.getRoleBadge(user.role)}</td>
                        <td>${user.facultyName || '-'}</td>
                        <td>${user.departmentName || '-'}</td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-secondary btn-small" onclick="window.editUser(${user.id})">
                                    Düzenle
                                </button>
                                ${user.role === 'instructor' ? `
                                    <button class="btn btn-primary btn-small" onclick="window.assignCourse(${user.id})">
                                        Ders Ata
                                    </button>
                                ` : ''}
                                ${user.id !== currentUser?.id ? `
                                    <button class="btn btn-danger btn-small" onclick="window.deleteUser(${user.id})">
                                        Sil
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function openUserModal(user = null) {
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const form = document.getElementById('user-form');

    editingUserId = user ? user.id : null;
    title.textContent = user ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle';

    // Reset form
    form.reset();
    document.getElementById('user-id').value = user ? user.id : '';

    if (user) {
        document.getElementById('user-name').value = user.name;
        document.getElementById('user-email').value = user.email;
        document.getElementById('user-role').value = user.role;

        if (user.facultyId || user.departmentId) {
            document.getElementById('faculty-group').style.display = 'block';
            document.getElementById('department-group').style.display = 'block';
        }
    }

    // Load faculties for dropdown
    loadFacultiesForUser(user?.facultyId);

    modal.classList.add('active');
}

async function handleUserSubmit(e) {
    e.preventDefault();

    const userId = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value;
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const facultyId = document.getElementById('user-faculty').value || null;
    const departmentId = document.getElementById('user-department').value || null;

    const payload = { name, email, role, facultyId, departmentId };
    if (password) {
        payload.password = password;
    }

    try {
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';

        const response = await fetch(`${API_BASE}${url}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
            showSuccess(userId ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu');
            closeModal('user-modal');
            await loadUsers();
        } else {
            showError(result.error || 'İşlem başarısız');
        }
    } catch (error) {
        console.error('Error saving user:', error);
        showError('Sunucu hatası');
    }
}

window.editUser = function(userId) {
    const user = users.find(u => u.id === userId);
    if (user) {
        openUserModal(user);
    }
};

window.deleteUser = async function(userId) {
    if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/users/${userId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Kullanıcı silindi');
            await loadUsers();
        } else {
            showError(result.error || 'Silme başarısız');
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        showError('Sunucu hatası');
    }
};

window.assignCourse = function(userId) {
    const user = users.find(u => u.id === userId);
    if (user && user.role === 'instructor') {
        openAssignCourseModal(user);
    }
};

async function loadFacultiesForUser(selectedFacultyId = null) {
    const select = document.getElementById('user-faculty');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            select.innerHTML = '<option value="">Seçiniz</option>' +
                result.data.map(f => `<option value="${f.id}" ${f.id == selectedFacultyId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading faculties:', error);
    }

    if (selectedFacultyId) {
        await loadDepartmentsForUser(selectedFacultyId);
    }
}

async function loadDepartmentsForUser(facultyId, selectedDepartmentId = null) {
    const select = document.getElementById('user-department');
    if (!select) return;

    if (!facultyId) {
        select.innerHTML = '<option value="">Önce fakülte seçiniz</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/departments?facultyId=${facultyId}`);
        const result = await response.json();

        if (result.success) {
            select.innerHTML = '<option value="">Seçiniz</option>' +
                result.data.map(d => `<option value="${d.id}" ${d.id == selectedDepartmentId ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

// ============================================
// FACULTIES
// ============================================

async function loadFaculties() {
    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            faculties = result.data;
            renderFaculties();
        }
    } catch (error) {
        console.error('Error loading faculties:', error);
    }
}

function renderFaculties() {
    if (!facultiesContainer) return;

    if (faculties.length === 0) {
        facultiesContainer.innerHTML = '<p class="text-center">Henüz fakülte yok.</p>';
        return;
    }

    facultiesContainer.innerHTML = `
        <div class="faculty-dept-grid">
            ${faculties.map(faculty => {
                const facultyDepts = departments.filter(d => d.facultyId == faculty.id);
                return `
                    <div class="faculty-card">
                        <h3>${escapeHtml(faculty.name)}</h3>
                        <p class="text-muted">${facultyDepts.length} bölüm</p>
                        <div class="action-buttons" style="margin-top: 1rem;">
                            <button class="btn btn-secondary btn-small" onclick="window.editFaculty(${faculty.id})">
                                Düzenle
                            </button>
                            <button class="btn btn-danger btn-small" onclick="window.deleteFaculty(${faculty.id})">
                                Sil
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function openFacultyModal(faculty = null) {
    const modal = document.getElementById('faculty-modal');
    const title = document.getElementById('faculty-modal-title');
    const form = document.getElementById('faculty-form');

    editingFacultyId = faculty ? faculty.id : null;
    title.textContent = faculty ? 'Fakülte Düzenle' : 'Fakülte Ekle';

    form.reset();
    document.getElementById('faculty-id').value = faculty ? faculty.id : '';

    if (faculty) {
        document.getElementById('faculty-name').value = faculty.name;
    }

    modal.classList.add('active');
}

async function handleFacultySubmit(e) {
    e.preventDefault();

    const facultyId = document.getElementById('faculty-id').value;
    const name = document.getElementById('faculty-name').value;

    try {
        const url = facultyId ? `/api/faculties/${facultyId}` : '/api/faculties';
        const method = facultyId ? 'PUT' : 'POST';

        const response = await fetch(`${API_BASE}${url}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess(facultyId ? 'Fakülte güncellendi' : 'Fakülte oluşturuldu');
            closeModal('faculty-modal');
            await loadFaculties();
        } else {
            showError(result.error || 'İşlem başarısız');
        }
    } catch (error) {
        console.error('Error saving faculty:', error);
        showError('Sunucu hatası');
    }
}

window.editFaculty = function(facultyId) {
    const faculty = faculties.find(f => f.id === facultyId);
    if (faculty) {
        openFacultyModal(faculty);
    }
};

window.deleteFaculty = async function(facultyId) {
    if (!confirm('Bu fakülteyi silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/faculties/${facultyId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Fakülte silindi');
            await loadFaculties();
            await loadDepartments();
        } else {
            showError(result.error || 'Silme başarısız');
        }
    } catch (error) {
        console.error('Error deleting faculty:', error);
        showError('Sunucu hatası');
    }
};

// ============================================
// DEPARTMENTS
// ============================================

async function loadDepartments() {
    try {
        const response = await fetch(`${API_BASE}/api/departments`);
        const result = await response.json();

        if (result.success) {
            departments = result.data;
            renderDepartments();
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

function renderDepartments() {
    if (!departmentsContainer) return;

    if (departments.length === 0) {
        departmentsContainer.innerHTML = '<p class="text-center">Henüz bölüm yok.</p>';
        return;
    }

    // Group departments by faculty
    const grouped = {};
    departments.forEach(dept => {
        if (!grouped[dept.facultyId]) {
            grouped[dept.facultyId] = {
                facultyName: dept.facultyName,
                departments: []
            };
        }
        grouped[dept.facultyId].departments.push(dept);
    });

    departmentsContainer.innerHTML = `
        <div class="faculty-dept-grid">
            ${Object.values(grouped).map(group => `
                <div class="faculty-card">
                    <h3>${escapeHtml(group.facultyName)}</h3>
                    <ul class="department-list">
                        ${group.departments.map(dept => `
                            <li>
                                <span>${escapeHtml(dept.name)}</span>
                                <div class="action-buttons">
                                    <button class="btn btn-secondary btn-small" onclick="window.editDepartment(${dept.id})">
                                        Düzenle
                                    </button>
                                    <button class="btn btn-danger btn-small" onclick="window.deleteDepartment(${dept.id})">
                                        Sil
                                    </button>
                                </div>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `).join('')}
        </div>
    `;
}

function openDepartmentModal(department = null) {
    const modal = document.getElementById('department-modal');
    const title = document.getElementById('department-modal-title');
    const form = document.getElementById('department-form');

    editingDepartmentId = department ? department.id : null;
    title.textContent = department ? 'Bölüm Düzenle' : 'Bölüm Ekle';

    form.reset();
    document.getElementById('department-id').value = department ? department.id : '';

    // Load faculties
    loadFacultiesForDepartment(department?.facultyId);

    if (department) {
        document.getElementById('department-name').value = department.name;
    }

    modal.classList.add('active');
}

async function handleDepartmentSubmit(e) {
    e.preventDefault();

    const departmentId = document.getElementById('department-id').value;
    const facultyId = document.getElementById('department-faculty').value;
    const name = document.getElementById('department-name').value;

    try {
        const url = departmentId ? `/api/departments/${departmentId}` : '/api/departments';
        const method = departmentId ? 'PUT' : 'POST';

        const response = await fetch(`${API_BASE}${url}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, facultyId: Number(facultyId) })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess(departmentId ? 'Bölüm güncellendi' : 'Bölüm oluşturuldu');
            closeModal('department-modal');
            await loadDepartments();
        } else {
            showError(result.error || 'İşlem başarısız');
        }
    } catch (error) {
        console.error('Error saving department:', error);
        showError('Sunucu hatası');
    }
}

async function loadFacultiesForDepartment(selectedFacultyId = null) {
    const select = document.getElementById('department-faculty');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            select.innerHTML = '<option value="">Seçiniz</option>' +
                result.data.map(f => `<option value="${f.id}" ${f.id == selectedFacultyId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading faculties:', error);
    }
}

window.editDepartment = function(departmentId) {
    const department = departments.find(d => d.id === departmentId);
    if (department) {
        openDepartmentModal(department);
    }
};

window.deleteDepartment = async function(departmentId) {
    if (!confirm('Bu bölümü silmek istediğinizden emin misiniz?')) return;

    try {
        const response = await fetch(`${API_BASE}/api/departments/${departmentId}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Bölüm silindi');
            await loadDepartments();
        } else {
            showError(result.error || 'Silme başarısız');
        }
    } catch (error) {
        console.error('Error deleting department:', error);
        showError('Sunucu hatası');
    }
};

// ============================================
// COURSES
// ============================================

async function loadCourses() {
    try {
        const response = await fetch(`${API_BASE}/api/courses`);
        const result = await response.json();

        if (result.success) {
            courses = result.data;
            // No need to render here, courses panel will render separately
        } else {
            showError('Dersler yüklenemedi');
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showError('Sunucu hatası');
    }
}

function setupCoursesPanel() {
    renderCoursesPanel();
}

function renderCoursesPanel() {
    const panelContent = document.getElementById('courses-panel-content');
    if (!panelContent) return;

    if (courses.length === 0) {
        panelContent.innerHTML = '<p class="text-center">Henüz ders yok.</p>';
        return;
    }

    panelContent.innerHTML = `
        <div class="courses-list">
            ${courses.map(course => `
                <div class="course-item">
                    <div class="course-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                        </svg>
                        ${escapeHtml(course.title)}
                    </div>
                    <div class="course-instructor">
                        <span class="text-muted">Eğitmen:</span> ${escapeHtml(course.instructorName)}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// Open Assign Course Modal for an instructor
function openAssignCourseModal(instructor) {
    const modal = document.getElementById('assign-course-modal');
    const form = document.getElementById('assign-course-form');

    // Reset form
    form.reset();

    // Set instructor info
    document.getElementById('assign-instructor-id').value = instructor.id;
    document.getElementById('assign-instructor-faculty-id').value = instructor.facultyId || '';
    document.getElementById('assign-instructor-department-id').value = instructor.departmentId || '';
    document.getElementById('assign-instructor-name').value = instructor.name;

    // Load faculties
    loadFacultiesForAssignCourse(instructor.facultyId);

    // If instructor has a faculty, pre-load departments
    if (instructor.facultyId) {
        loadDepartmentsForAssignCourse(instructor.facultyId, instructor.departmentId);
    }

    modal.classList.add('active');
}

async function loadFacultiesForAssignCourse(selectedFacultyId = null) {
    const select = document.getElementById('assign-course-faculty');
    if (!select) return;

    try {
        const response = await fetch(`${API_BASE}/api/faculties`);
        const result = await response.json();

        if (result.success) {
            select.innerHTML = '<option value="">Seçiniz</option>' +
                result.data.map(f => `<option value="${f.id}" ${f.id == selectedFacultyId ? 'selected' : ''}>${escapeHtml(f.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading faculties:', error);
    }
}

async function loadDepartmentsForAssignCourse(facultyId, selectedDepartmentId = null) {
    const select = document.getElementById('assign-course-department');
    if (!select) return;

    if (!facultyId) {
        select.innerHTML = '<option value="">Önce fakülte seçiniz</option>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/departments?facultyId=${facultyId}`);
        const result = await response.json();

        if (result.success) {
            select.innerHTML = '<option value="">Seçiniz</option>' +
                result.data.map(d => `<option value="${d.id}" ${d.id == selectedDepartmentId ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading departments:', error);
    }
}

async function handleAssignCourseSubmit(e) {
    e.preventDefault();

    const instructorId = document.getElementById('assign-instructor-id').value;
    const title = document.getElementById('assign-course-title').value;
    const facultyId = document.getElementById('assign-course-faculty').value;
    const departmentId = document.getElementById('assign-course-department').value;

    if (!instructorId || !title || !facultyId || !departmentId) {
        showError('Tüm alanları doldurunuz');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                instructorId: Number(instructorId),
                facultyId: Number(facultyId),
                departmentId: Number(departmentId)
            })
        });

        const result = await response.json();

        if (result.success) {
            showSuccess('Ders başarıyla atandı');
            closeModal('assign-course-modal');
            await loadCourses(); // Reload courses to update the panel
            renderCoursesPanel(); // Refresh the courses panel
        } else {
            showError(result.error || 'İşlem başarısız');
        }
    } catch (error) {
        console.error('Error assigning course:', error);
        showError('Sunucu hatası');
    }
}

// ============================================
// UTILITIES
// ============================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function showSuccess(message) {
    // You can implement a toast notification here
    alert(message);
}

function showError(message) {
    alert(message);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup faculty panel
function setupFacultyPanel() {
    if (faculties.length === 0 || departments.length === 0) return;

    const facultiesWithDepts = faculties.map(faculty => ({
        ...faculty,
        departments: departments.filter(d => d.facultyId == faculty.id)
    }));

    renderFacultyPanel(facultiesWithDepts);
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
