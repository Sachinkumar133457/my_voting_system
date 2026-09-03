const API_URL = 'http://localhost:5000/api';

document.addEventListener("DOMContentLoaded", () => {
    updateNavbarUI();
    highlightActiveNavLink();
    setupVoteNowTriggers();
    
    // Path checking solution for all environments (Live Server, Localhost, File System)
    const currentPath = window.location.pathname.toLowerCase();

    if (currentPath.endsWith("register.html") || currentPath.includes("register")) setupRegisterForm();
    if (currentPath.endsWith("login.html") || currentPath.includes("login")) setupLoginForm();
    if (currentPath.endsWith("vote.html") || currentPath.includes("vote")) loadVotingPanel();
    if (currentPath.endsWith("results.html") || currentPath.includes("results")) loadLiveResults();

    if (currentPath.endsWith("login.html") || currentPath.endsWith("register.html") || currentPath.includes("login") || currentPath.includes("register")) {
        initGoogleAuth();
    }
});

function setupVoteNowTriggers() {
    const voteBtns = document.querySelectorAll(".vote-now-trigger, a[href*='vote.html']");
    voteBtns.forEach(btn => {
        btn.onclick = handleVoteNowClick;
    });
}

function updateNavbarUI() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const buttonsDiv = document.querySelector('.navbar .buttons');

    if (token && user && buttonsDiv) {
        buttonsDiv.innerHTML = `
            <span style="color:#333; font-weight:600; font-size:14px; display:flex; align-items:center; gap:6px; margin-right:10px;">
                <i class="fa-solid fa-circle-user" style="color:#10b981; font-size:18px;"></i> ${user.name}
            </span>
            <button onclick="logout()" class="login-btn" style="border-color:#ef4444; color:#ef4444; cursor:pointer;">Logout</button>
        `;
    }
}

function highlightActiveNavLink() {
    const currentPath = window.location.pathname.toLowerCase();
    const navLinks = document.querySelectorAll(".nav-links a");

    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href") ? link.getAttribute("href").toLowerCase() : "";
        if (linkPath && (currentPath.endsWith(linkPath) || (currentPath.endsWith('/') && linkPath.includes('index.html')))) {
            navLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");
        }
    });
}

function logout() {
    localStorage.clear();
    alert("Logged out successfully!");
    window.location.href = "index.html";
}

// 🛡️ ANTI-FRAUD / STRICT ROUTE GUARD FUNCTION
function handleVoteNowClick(e) {
    if (e) e.preventDefault();
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token) {
        alert("⚠️ Access Denied! Voting panel access karne ke liye pehle Register/Login karein.");
        window.location.href = "register.html";
    } else if (user && user.hasVoted) {
        alert("ℹ️ Safety Lock: Aap pehle hi vote de chuke hain!");
        window.location.href = "results.html";
    } else {
        window.location.href = "vote.html";
    }
}

// STEP 1: REGISTER WITH GMAIL OTP
function setupRegisterForm() {
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const regEmailInput = document.getElementById('regEmail');
    const otpGroup = document.getElementById('otpGroup');
    const otpStatusText = document.getElementById('otpStatusText');
    const form = document.getElementById('registerForm') || document.querySelector('.auth-form');

    // Send OTP Trigger
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener('click', async () => {
            const email = regEmailInput ? regEmailInput.value.trim() : "";
            if (!email) return alert("⚠️ Pehle Email ID dalein!");

            sendOtpBtn.textContent = "Sending...";
            sendOtpBtn.disabled = true;

            try {
                const res = await fetch(`${API_URL}/auth/send-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                if (res.ok) {
                    alert("📩 " + (data.msg || "OTP Sent!"));
                    if (otpGroup) otpGroup.style.display = "flex";
                    if (otpStatusText) otpStatusText.textContent = "OTP aapke Gmail par bhej diya gaya hai.";
                } else {
                    alert("❌ " + (data.msg || "OTP sending failed!"));
                }
            } catch (err) {
                alert("⚠️ Server error! Backend connectivity check karein.");
            } finally {
                sendOtpBtn.textContent = "Resend OTP";
                sendOtpBtn.disabled = false;
            }
        });
    }

    // Submit Registration
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName')?.value.trim() || form.querySelectorAll('input')[0]?.value;
            const email = regEmailInput?.value.trim() || form.querySelectorAll('input')[1]?.value;
            const otp = document.getElementById('regOtp')?.value.trim();
            const password = document.getElementById('regPassword')?.value || form.querySelectorAll('input')[2]?.value;

            if (otpGroup && otpGroup.style.display !== "none" && !otp) {
                return alert("⚠️ Pehle Email par aaya OTP enter karein!");
            }

            try {
                const res = await fetch(`${API_URL}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, otp })
                });

                const data = await res.json();
                if (res.ok) {
                    alert("🎉 " + (data.msg || "Registration successful!"));
                    window.location.href = "login.html"; // Redirection FIXED
                } else {
                    alert("❌ " + (data.msg || "Registration failed!"));
                }
            } catch (err) {
                alert("⚠️ Registration Error!");
            }
        });
    }
}

// STEP 2: LOGIN FORM
function setupLoginForm() {
    const form = document.getElementById('loginForm') || document.querySelector('.auth-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail')?.value.trim() || form.querySelectorAll('input')[0]?.value;
        const password = document.getElementById('loginPassword')?.value || form.querySelectorAll('input')[1]?.value;

        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                alert(`✅ Welcome ${data.user.name}!`);

                // REDIRECTION LOGIC
                if (data.user.hasVoted) {
                    window.location.href = "results.html";
                } else {
                    window.location.href = "index.html"; // Login ke baad direct Home Page par bheja
                }
            } else {
                alert("❌ " + (data.msg || "Invalid Credentials!"));
            }
        } catch (err) {
            alert("⚠️ Backend Server Connected Nahi Hai (Port 5000 check karein)!");
        }
    });
}

// GOOGLE AUTHENTICATION INTEGRATION
function initGoogleAuth() {
    window.onload = function () {
        google.accounts.id.initialize({
            client_id: "861443712292-mmiiijbula8ujmbnp2trfhl4gbif5phv.apps.googleusercontent.com",
            callback: handleGoogleResponse
        });
        
        const btnContainer = document.getElementById("googleSignInBtn");
        if (btnContainer) {
            google.accounts.id.renderButton(
                btnContainer,
                { theme: "outline", size: "large", width: "100%" }
            );
        }
    };
}

async function handleGoogleResponse(response) {
    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            alert(`✅ Welcome ${data.user.name}!`);

            if (data.user.hasVoted) {
                window.location.href = "results.html";
            } else {
                window.location.href = "index.html";
            }
        } else {
            alert("❌ " + (data.msg || "Google login failed!"));
        }
    } catch (err) {
        console.error("Google login error:", err);
        alert("⚠️ Server Error during Google Sign-In.");
    }
}

// STEP 3: SECURE VOTING PANEL
async function loadVotingPanel() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token) {
        alert("⛔ Unauthorized Access Blocked! Pehle Login karein.");
        window.location.href = "register.html";
        return;
    }

    if (user && user.hasVoted) {
        alert("⚠️ Aap pehle hi apna vote cast kar chuke hain!");
        window.location.href = "results.html";
        return;
    }

    try {
        const candRes = await fetch(`${API_URL}/candidates`);
        const candidates = await candRes.json();
        
        const form = document.querySelector('.voting-form') || document.querySelector('#votingForm');
        if (form && candidates.length > 0) {
            let candidatesHTML = '';
            const symbols = ['fa-flag text-blue-icon', 'fa-star text-orange-icon', 'fa-leaf text-green-icon', 'fa-shield-halved'];
            
            candidates.forEach((cand, index) => {
                const iconClass = symbols[index % symbols.length];
                candidatesHTML += `
                    <div class="candidate-card-row">
                        <div class="cand-profile">
                            <div class="cand-avatar"><i class="fa-solid fa-user-tie"></i></div>
                            <div>
                                <h4>${cand.name}</h4>
                                <p>${cand.party}</p>
                            </div>
                        </div>
                        <div class="cand-symbol"><i class="fa-solid ${iconClass}"></i></div>
                        <div class="cand-action">
                            <label class="radio-vote-btn">
                                <input type="radio" name="election_candidate" value="${cand._id}" required>
                                <span class="custom-radio-btn">Select</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            candidatesHTML += `
                <div class="submit-vote-container">
                    <p><i class="fa-solid fa-lock"></i> Your vote is encrypted and anonymous.</p>
                    <button type="submit" class="final-vote-submit-btn">Submit My Secure Vote</button>
                </div>
            `;
            form.innerHTML = candidatesHTML;
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const selected = form.querySelector('input[name="election_candidate"]:checked');
                if (!selected) return alert("⚠️ Please candidate select karein!");

                const candidateId = selected.value;

                const res = await fetch(`${API_URL}/vote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': token
                    },
                    body: JSON.stringify({ candidateId })
                });

                const data = await res.json();
                if (res.ok) {
                    if (user) {
                        user.hasVoted = true;
                        localStorage.setItem('user', JSON.stringify(user));
                    }
                    
                    alert("🎉 " + (data.msg || "Vote recorded successfully!"));
                    window.location.href = "results.html";
                } else {
                    alert("❌ " + (data.msg || "Vote submission failed!"));
                }
            });
        }
    } catch (err) {
        console.error("Voting panel load error:", err);
    }
}

// STEP 4: LIVE RESULTS PAGE
async function loadLiveResults() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        alert("⛔ Access Denied! Live results dekhne ke liye Register/Login karein.");
        window.location.href = "register.html";
        return;
    }

    try {
        const res = await fetch(`${API_URL}/results`);
        const data = await res.json();

        const totalVotesDisplay = document.querySelector('.results-summary-card .res-meta strong');
        if (totalVotesDisplay) totalVotesDisplay.textContent = data.totalVotes.toLocaleString();

        const overviewCard = document.querySelector('.results-overview-card');
        if (!overviewCard) return;

        const colors = ['bar-blue', 'bar-green', 'bar-orange', 'bar-purple', 'bar-red'];
        let html = '<h3>Live Results Distribution</h3>';

        data.candidates.forEach((cand, idx) => {
            const pct = data.totalVotes > 0 ? ((cand.votes / data.totalVotes) * 100).toFixed(1) : 0;
            const colorClass = colors[idx % colors.length];

            html += `
                <div class="progress-block">
                    <div class="progress-details">
                        <span class="cand-name">${cand.name} (${cand.party})</span>
                        <strong>${pct}% <small>(${cand.votes.toLocaleString()} Votes)</small></strong>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-fill ${colorClass}" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        });

        overviewCard.innerHTML = html;
    } catch (err) {
        console.error("Results load error:", err);
    }
}