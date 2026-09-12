// ========================================
// DASHBOARD ELEMENTS
// ========================================

const topAvatar =
    document.querySelector("#topAvatar");

const profileAvatar =
    document.querySelector("#profileAvatar");

const menuToggle =
    document.querySelector("#menuToggle");

const sidebar =
    document.querySelector(".sidebar");

const welcome =
    document.querySelector("#welcome");

const usernameText =
    document.querySelector("#username");

const emailText =
    document.querySelector("#email");

const usernameDisplay =
    document.querySelector("#usernameDisplay");

const emailDisplay =
    document.querySelector("#emailDisplay");

const createdAtText =
    document.querySelector("#createdAt");

const editProfileForm =
    document.querySelector("#editProfileForm");

const editUsername =
    document.querySelector("#editUsername");

const editEmail =
    document.querySelector("#editEmail");

const editMessage =
    document.querySelector("#editMessage");

const changePasswordForm =
    document.querySelector("#changePasswordForm");

const currentPassword =
    document.querySelector("#currentPassword");

const newPassword =
    document.querySelector("#newPassword");

const confirmPassword =
    document.querySelector("#confirmPassword");

const passwordMessage =
    document.querySelector("#passwordMessage");

const deleteAccountForm =
    document.querySelector("#deleteAccountForm");

const deletePassword =
    document.querySelector("#deletePassword");

const deleteMessage =
    document.querySelector("#deleteMessage");

const logoutBtn =
    document.querySelector("#logoutBtn");

const adminDashboardBtn =
    document.querySelector("#adminDashboardBtn");


// ========================================
// LOAD CURRENT USER
// ========================================

async function loadUser() {

    try {

        const response =
            await fetch("/api/current-user");

        const user =
            await response.json();


        if (!response.ok) {

            console.error(user);

            window.location.href = "/";

            return;
        }

        // ========================================
// USER INITIALS
// ========================================

const nameParts =
    user.username
        .trim()
        .split(/\s+/);

let initials = "";

if (nameParts.length === 1) {

    initials =
        nameParts[0]
            .substring(0, 2)
            .toUpperCase();

} else {

    initials =
        (
            nameParts[0][0] +
            nameParts[nameParts.length - 1][0]
        )
        .toUpperCase();
}

if (topAvatar) {
    topAvatar.textContent = initials;
}

if (profileAvatar) {
    profileAvatar.textContent = initials;
}


        // Welcome
        welcome.textContent =
            `Welcome, ${user.username}!`;


        // Profile banner
        usernameText.textContent =
            user.username;

        emailText.textContent =
            user.email;


        // Information cards
        usernameDisplay.textContent =
            user.username;

        emailDisplay.textContent =
            user.email;


        // Edit profile form
        editUsername.value =
            user.username;

        editEmail.value =
            user.email;


        // Created date
        if (user.created_at) {

            const createdDate =
                new Date(user.created_at);

            createdAtText.textContent =
                createdDate.toLocaleString();

        } else {

            createdAtText.textContent =
                "Not available";
        }


        // ========================================
        // ADMIN BUTTON
        // ========================================

        if (adminDashboardBtn) {

            if (user.role === "admin") {

                adminDashboardBtn.hidden =
                    false;

            } else {

                adminDashboardBtn.hidden =
                    true;
            }
        }


    } catch (error) {

        console.error(
            "Load user error:",
            error
        );
    }
}


// ========================================
// EDIT PROFILE
// ========================================

editProfileForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        editMessage.textContent =
            "Updating profile...";


        try {

            const response =
                await fetch(
                    "/api/profile",
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                username:
                                    editUsername.value.trim(),

                                email:
                                    editEmail.value.trim()
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                editMessage.textContent =
                    "❌ " + data.message;

                return;
            }


            editMessage.textContent =
                "✅ " + data.message;


            // Reload updated information
            await loadUser();


        } catch (error) {

            console.error(
                "Profile update error:",
                error
            );


            editMessage.textContent =
                "❌ Could not update profile.";
        }
    }
);


// ========================================
// CHANGE PASSWORD
// ========================================

changePasswordForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const current =
            currentPassword.value;

        const newPass =
            newPassword.value;

        const confirm =
            confirmPassword.value;


        if (newPass !== confirm) {

            passwordMessage.textContent =
                "❌ New passwords do not match.";

            return;
        }


        if (newPass.length < 6) {

            passwordMessage.textContent =
                "❌ Password must be at least 6 characters.";

            return;
        }


        passwordMessage.textContent =
            "Changing password...";


        try {

            const response =
                await fetch(
                    "/api/change-password",
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                currentPassword:
                                    current,

                                newPassword:
                                    newPass
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                passwordMessage.textContent =
                    "❌ " + data.message;

                return;
            }


            passwordMessage.textContent =
                "✅ " + data.message;


            changePasswordForm.reset();


        } catch (error) {

            console.error(
                "Change password error:",
                error
            );


            passwordMessage.textContent =
                "❌ Could not change password.";
        }
    }
);


// ========================================
// DELETE ACCOUNT
// ========================================

deleteAccountForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const confirmed =
            confirm(
                "Are you sure you want to permanently delete your account?"
            );


        if (!confirmed) {
            return;
        }


        deleteMessage.textContent =
            "Deleting account...";


        try {

            const response =
                await fetch(
                    "/api/delete-account",
                    {
                        method: "DELETE",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                password:
                                    deletePassword.value
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                deleteMessage.textContent =
                    "❌ " + data.message;

                return;
            }


            deleteMessage.textContent =
                "✅ " + data.message;


            setTimeout(() => {

                window.location.href = "/";

            }, 1000);


        } catch (error) {

            console.error(
                "Delete account error:",
                error
            );


            deleteMessage.textContent =
                "❌ Could not delete account.";
        }
    }
);


// ========================================
// LOGOUT
// ========================================

logoutBtn.addEventListener(
    "click",
    async () => {

        try {

            const response =
                await fetch(
                    "/api/logout",
                    {
                        method: "POST"
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                alert(
                    data.message ||
                    "Logout failed."
                );

                return;
            }


            window.location.href = "/";


        } catch (error) {

            console.error(
                "Logout error:",
                error
            );


            alert(
                "Could not logout."
            );
        }
    }
);


// ========================================
// START DASHBOARD
// ========================================

loadUser();

// ========================================
// MOBILE SIDEBAR
// ========================================

if (menuToggle && sidebar) {

    menuToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "sidebar-open"
            );
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

                const input =
                    document.getElementById(
                        button.dataset.target
                    );


                if (!input) {
                    return;
                }


                const showing =
                    input.type === "text";


                input.type =
                    showing
                        ? "password"
                        : "text";


                button.textContent =
                    showing
                        ? "👁"
                        : "🙈";
            }
        );
    }
);