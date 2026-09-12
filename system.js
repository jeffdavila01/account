
// ==============================
// CREATE ACCOUNT
// ==============================

const registerForm = document.querySelector("#registerForm");
const registerMessage = document.querySelector("#registerMessage");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document
        .querySelector("#registerUsername")
        .value
        .trim();

    const email = document
        .querySelector("#registerEmail")
        .value
        .trim();

    const password = document
        .querySelector("#registerPassword")
        .value;

    try {
        const response = await fetch("/api/register", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        const data = await response.json();

        if (response.ok) {
            registerMessage.textContent =
                "✅ Account created successfully!";

            registerForm.reset();

        } else {
            registerMessage.textContent =
                "❌ " + data.message;
        }

    } catch (error) {
        console.error(error);

        registerMessage.textContent =
            "❌ Registration failed.";
    }
});


// ==============================
// LOGIN
// ==============================

const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document
        .querySelector("#loginUsername")
        .value
        .trim();

    const password = document
        .querySelector("#loginPassword")
        .value;

    try {
        const response = await fetch("/api/login", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        
        if (response.ok) {
            loginMessage.textContent =
                "✅ Login successful!";

            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 800);
        }
        else {
            loginMessage.textContent =
                "❌ " + data.message;
        }

    } catch (error) {
        console.error(error);

        loginMessage.textContent =
            "❌ Login failed.";
    }
});
// =================================
// FORGOT PASSWORD
// =================================

const forgotPasswordForm =
    document.querySelector("#forgotPasswordForm");

const forgotMessage =
    document.querySelector("#forgotMessage");


forgotPasswordForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const email =
            document
                .querySelector("#forgotEmail")
                .value
                .trim();

        try {
            const response =
                await fetch("/api/forgot-password", {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email
                    })
                });

            const data = await response.json();

            forgotMessage.textContent =
                "✅ " + data.message;

        } catch (error) {
            console.error(error);

            forgotMessage.textContent =
                "❌ Could not request password reset.";
        }
    }
);


// =================================
// RESET PASSWORD
// =================================

const resetSection =
    document.querySelector("#resetPasswordSection");

const resetPasswordForm =
    document.querySelector("#resetPasswordForm");

const resetMessage =
    document.querySelector("#resetMessage");


// Read reset_token from URL
const params =
    new URLSearchParams(window.location.search);

const resetToken =
    params.get("reset_token");


// Show Reset Password form only when token exists
if (resetToken) {
    resetSection.hidden = false;
}


resetPasswordForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const newPassword =
            document.querySelector(
                "#resetNewPassword"
            ).value;

        const confirmPassword =
            document.querySelector(
                "#resetConfirmPassword"
            ).value;


        if (newPassword !== confirmPassword) {
            resetMessage.textContent =
                "❌ Passwords do not match.";

            return;
        }


        try {
            const response =
                await fetch("/api/reset-password", {

                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        token: resetToken,
                        newPassword
                    })
                });

            const data = await response.json();


            if (response.ok) {
                resetMessage.textContent =
                    "✅ Password reset successfully!";

                resetPasswordForm.reset();

                setTimeout(() => {
                    window.location.href =
                        "/system.html";
                }, 1500);

            } else {
                resetMessage.textContent =
                    "❌ " + data.message;
            }

        } catch (error) {
            console.error(error);

            resetMessage.textContent =
                "❌ Password reset failed.";
        }
    }
);

// ========================================
// RESEND VERIFICATION EMAIL
// ========================================

const resendVerificationForm =
    document.querySelector(
        "#resendVerificationForm"
    );

const resendVerificationMessage =
    document.querySelector(
        "#resendVerificationMessage"
    );

if (resendVerificationForm) {

    resendVerificationForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const email =
                document
                    .querySelector("#resendEmail")
                    .value
                    .trim();

            resendVerificationMessage.textContent =
                "Sending verification email...";

            try {

                const response =
                    await fetch(
                        "/api/resend-verification",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                email: email
                            })
                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    resendVerificationMessage.textContent =
                        "❌ " + data.message;

                    return;
                }


                resendVerificationMessage.textContent =
                    "✅ " + data.message;


                resendVerificationForm.reset();


            } catch (error) {

                console.error(
                    "Resend verification error:",
                    error
                );


                resendVerificationMessage.textContent =
                    "❌ Could not connect to the server.";
            }
        }
    );
}
// ========================================
// SHOW / HIDE PASSWORD
// ========================================

const passwordToggleButtons =
    document.querySelectorAll(
        ".password-toggle"
    );


passwordToggleButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                const targetId =
                    button.dataset.target;

                const passwordInput =
                    document.getElementById(
                        targetId
                    );


                if (!passwordInput) {
                    return;
                }


                if (
                    passwordInput.type ===
                    "password"
                ) {

                    passwordInput.type =
                        "text";

                    button.textContent =
                        "🙈";

                    button.setAttribute(
                        "aria-label",
                        "Hide password"
                    );

                } else {

                    passwordInput.type =
                        "password";

                    button.textContent =
                        "👁";

                    button.setAttribute(
                        "aria-label",
                        "Show password"
                    );
                }
            }
        );
    }
);