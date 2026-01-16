const API_BASE = '';

// DOM Elements
const registerForm = document.getElementById('register-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const registerBtn = document.getElementById('register-btn');
const errorMessage = document.getElementById('error-message');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    checkAuth();

    registerForm.addEventListener('submit', handleRegister);
});

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
        // Not authenticated, continue to registration page
    }
}

// Handle registration form submission
async function handleRegister(e) {
    e.preventDefault();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showError('Lütfen tüm alanları doldurun');
        return;
    }

    if (password !== confirmPassword) {
        showError('Şifreler eşleşmiyor');
        return;
    }

    if (password.length < 6) {
        showError('Şifre en az 6 karakter olmalıdır');
        return;
    }

    // Show loading state
    setLoading(true);
    hideError();

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });

        const result = await response.json();

        if (result.success) {
            // Registration successful, redirect to appropriate dashboard
            redirectToDashboard(result.data);
        } else {
            showError(result.error || 'Kayıt başarısız');
            setLoading(false);
        }
    } catch (error) {
        console.error('Registration error:', error);
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
        registerBtn.disabled = true;
        registerBtn.innerHTML = '<span>Hesap oluşturuluyor...</span>';
    } else {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<span>Hesap Oluştur</span>';
    }
}
