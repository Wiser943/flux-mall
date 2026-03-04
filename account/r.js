// Initialize Lucide icons
lucide.createIcons();

// Toggle Password Visibility
function togglePass() {
    const passInput = document.getElementById('password');
    if (passInput.type === 'password') {
        passInput.type = 'text';
    } else {
        passInput.type = 'password';
    }
}

// Form Submission Prevention
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Login attempted!');
});
