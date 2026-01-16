const API_BASE = '';

// Current user state
let currentUser = null;

/**
 * Get current user from server
 */
export async function getCurrentUser() {
  if (currentUser) {
    return currentUser;
  }

  try {
    const response = await fetch(`${API_BASE}/api/auth/me`);
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        currentUser = result.data;
        return currentUser;
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error);
  }

  return null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return user !== null;
}

/**
 * Logout user
 */
export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
  } catch (error) {
    console.error('Logout error:', error);
  }
  currentUser = null;
  window.location.href = '/login.html';
}

/**
 * Update user info in state
 */
export function setCurrentUser(user) {
  currentUser = user;
}

/**
 * Check if user has specific role
 */
export function hasRole(role) {
  return currentUser && currentUser.role === role;
}

/**
 * Check if user is admin
 */
export function isAdmin() {
  return hasRole('admin');
}

/**
 * Check if user is instructor
 */
export function isInstructor() {
  return hasRole('instructor');
}

/**
 * Check if user is student
 */
export function isStudent() {
  return hasRole('student');
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return false;
  }
  return true;
}

/**
 * Require admin role - redirect if not admin
 */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/**
 * Get role display name
 */
export function getRoleName(role) {
  const roleNames = {
    admin: 'Yönetici',
    instructor: 'Öğretmen',
    student: 'Öğrenci'
  };
  return roleNames[role] || role;
}

/**
 * Get role badge HTML
 */
export function getRoleBadge(role) {
  const colors = {
    admin: 'role-admin',
    instructor: 'role-instructor',
    student: 'role-student'
  };
  return `<span class="role-badge ${colors[role] || ''}">${getRoleName(role)}</span>`;
}
