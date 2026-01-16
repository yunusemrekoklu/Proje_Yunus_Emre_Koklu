const API_BASE = '';

// DOM Elements
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    checkAuth();

    loginForm.addEventListener('submit', handleLogin);
});

// Check if user is already authenticated
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`);
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                // Already logged in, redirect to appropriate dashboard
                redirectToDashboard(result.data);
            }
        }
    } catch (error) {
        // Not authenticated, continue to login page
    }
}

// Redirect to dashboard based on user role
function redirectToDashboard(user) {
    switch (user.role) {
        case 'admin':
            window.location.href = '/admin.html';
            break;
        case 'instructor':
            window.location.href = '/instructor.html';
            break;
        case 'student':
            window.location.href = '/index.html';
            break;
        default:
            window.location.href = '/index.html';
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('Lütfen e-posta ve şifrenizi girin');
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (result.success) {
            // Login successful, redirect to appropriate dashboard
            redirectToDashboard(result.data);
        } else {
            showError(result.error || 'Giriş başarısız');
            setLoading(false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Sunucuya bağlanılamadı');
        setLoading(false);
    }
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
    errorMessage.classList.add('hidden');
}

// Set loading state
function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span>Giriş yapılıyor...</span>';
    } else {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<span>Giriş Yap</span>';
    }
}
