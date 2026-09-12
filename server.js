const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const { Resend } = require("resend");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL =
    process.env.APP_URL ||
    `http://localhost:${PORT}`;


// ========================================
// BASIC HELPERS
// ========================================

function normalizeEmail(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}


function cleanText(value) {
    return String(value || "").trim();
}


function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}


function createToken() {
    return crypto
        .randomBytes(32)
        .toString("hex");
}


// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "change-this-local-development-secret",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,

            // false because localhost uses HTTP
            secure: false,

            sameSite: "lax",

            maxAge:
                1000 * 60 * 60
        }
    })
);


// Public folder
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ========================================
// MYSQL
// ========================================

const db = mysql.createPool({
    host: process.env.DB_HOST,

    user: process.env.DB_USER,

    password:
        process.env.DB_PASSWORD,

    database:
        process.env.DB_NAME,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0
});


async function testDatabaseConnection() {

    try {

        const connection =
            await db.getConnection();


        const [rows] =
            await connection.query(
                `
                SELECT
                    DATABASE()
                    AS database_name
                `
            );


        console.log(
            `✅ Connected to MySQL database: ${rows[0].database_name}`
        );


        connection.release();

    } catch (error) {

        console.error(
            "❌ MySQL connection failed:"
        );

        console.error(
            error.message
        );
    }
}


// ========================================
// EMAIL / RESEND
// ========================================

const resendApiKey =
    cleanText(process.env.RESEND_API_KEY);

const emailFrom =
    cleanText(process.env.EMAIL_FROM) ||
    "Account System <onboarding@resend.dev>";

const resend =
    new Resend(resendApiKey);


// ========================================
// SEND VERIFICATION EMAIL
// ========================================

async function sendVerificationEmail(email, token) {

    const verificationLink =
        `${BASE_URL}/api/verify-email?token=${encodeURIComponent(token)}`;

    const { data, error } =
        await resend.emails.send({
            from: emailFrom,
            to: [email],
            subject: "Verify Your Account",
            html: `
                <h2>Verify Your Email</h2>

                <p>
                    Thank you for creating an account.
                </p>

                <p>
                    Click the button below to verify
                    your email address.
                </p>

                <p>
                    <a
                        href="${verificationLink}"
                        style="
                            display:inline-block;
                            padding:12px 20px;
                            background:#222;
                            color:#fff;
                            text-decoration:none;
                            border-radius:6px;
                        "
                    >
                        Verify Email
                    </a>
                </p>

                <p>
                    This verification link expires in 30 minutes.
                </p>

                <p>
                    If you did not create this account,
                    you can ignore this email.
                </p>
            `
        });

    if (error) {
        throw new Error(
            error.message ||
            "Could not send verification email."
        );
    }

    return {
        messageId: data?.id
    };
}


// ========================================
// SEND PASSWORD RESET EMAIL
// ========================================

async function sendPasswordResetEmail(email, token) {

    const resetLink =
        `${BASE_URL}/system.html?reset_token=${encodeURIComponent(token)}`;

    const { data, error } =
        await resend.emails.send({
            from: emailFrom,
            to: [email],
            subject: "Reset Your Password",
            html: `
                <h2>Password Reset</h2>

                <p>
                    You requested to reset your password.
                </p>

                <p>
                    <a
                        href="${resetLink}"
                        style="
                            display:inline-block;
                            padding:12px 20px;
                            background:#222;
                            color:#fff;
                            text-decoration:none;
                            border-radius:6px;
                        "
                    >
                        Reset Password
                    </a>
                </p>

                <p>
                    This link expires in 15 minutes.
                </p>

                <p>
                    If you did not request this,
                    you can ignore this email.
                </p>
            `
        });

    if (error) {
        throw new Error(
            error.message ||
            "Could not send password reset email."
        );
    }

    return {
        messageId: data?.id
    };
}


// ========================================
// HOME
// ========================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "system.html"
        )
    );
});


// ========================================
// REGISTER
// ========================================

app.post(
    "/api/register",
    async (req, res) => {

        const username =
            cleanText(
                req.body.username
            );


        const email =
            normalizeEmail(
                req.body.email
            );


        const password =
            String(
                req.body.password ||
                ""
            );


        if (
            !username ||
            !email ||
            !password
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Please complete all fields."
                });
        }


        if (
            password.length < 6
        ) {

            return res
                .status(400)
                .json({
                    message:
                        "Password must be at least 6 characters."
                });
        }


        try {

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );


            const verificationToken =
                createToken();


            const verificationTokenHash =
                hashToken(
                    verificationToken
                );


            const verificationExpires =
                new Date(
                    Date.now() +
                    30 * 60 * 1000
                );


            await db.execute(
                `
                INSERT INTO users (
                    username,
                    email,
                    password,
                    is_verified,
                    verification_token_hash,
                    verification_token_expires
                )

                VALUES (
                    ?,
                    ?,
                    ?,
                    FALSE,
                    ?,
                    ?
                )
                `,
                [
                    username,
                    email,
                    hashedPassword,
                    verificationTokenHash,
                    verificationExpires
                ]
            );


            try {

                const info =
                    await sendVerificationEmail(
                        email,
                        verificationToken
                    );


                console.log(
                    `✅ Verification email sent to ${email}`
                );


                console.log(
                    "Message ID:",
                    info.messageId
                );


                return res
                    .status(201)
                    .json({

                        message:
                            "Account created! Check your email to verify your account."
                    });


            } catch (emailError) {

                console.error(
                    "❌ Verification email failed:",
                    emailError.message
                );


                return res
                    .status(500)
                    .json({

                        message:
                            "Account created, but the verification email could not be sent. Fix your email settings, then use Resend Verification."
                    });
            }


        } catch (error) {


            if (
                error.code ===
                "ER_DUP_ENTRY"
            ) {

                return res
                    .status(409)
                    .json({

                        message:
                            "Username or email already exists."
                    });
            }


            console.error(
                "Register error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);


// ========================================
// VERIFY EMAIL
// ========================================

app.get(
    "/api/verify-email",
    async (req, res) => {

        const token =
            cleanText(
                req.query.token
            );


        if (!token) {

            return res
                .status(400)
                .send(
                    "Verification token is missing."
                );
        }


        try {

            const tokenHash =
                hashToken(token);


            const [results] =
                await db.execute(
                    `
                    SELECT id

                    FROM users

                    WHERE
                        verification_token_hash = ?

                    AND
                        verification_token_expires > NOW()

                    LIMIT 1
                    `,
                    [
                        tokenHash
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(400)
                    .send(
                        "Verification link is invalid or has expired."
                    );
            }


            await db.execute(
                `
                UPDATE users

                SET
                    is_verified = TRUE,

                    verification_token_hash = NULL,

                    verification_token_expires = NULL

                WHERE id = ?
                `,
                [
                    results[0].id
                ]
            );


            return res.send(`
                <!doctype html>

                <html lang="en">

                <head>

                    <meta charset="utf-8">

                    <meta
                        name="viewport"
                        content="width=device-width, initial-scale=1"
                    >

                    <title>
                        Email Verified
                    </title>

                </head>

                <body>

                    <h1>
                        ✅ Email Verified!
                    </h1>

                    <p>
                        Your account has been
                        verified successfully.
                    </p>

                    <p>
                        <a href="/">
                            Go to Login
                        </a>
                    </p>

                </body>

                </html>
            `);


        } catch (error) {

            console.error(
                "Verify email error:",
                error
            );


            return res
                .status(500)
                .send(
                    "Could not verify account."
                );
        }
    }
);


// ========================================
// RESEND VERIFICATION
// ========================================

app.post(
    "/api/resend-verification",
    async (req, res) => {

        const email =
            normalizeEmail(
                req.body.email
            );


        if (!email) {

            return res
                .status(400)
                .json({

                    message:
                        "Please enter your email."
                });
        }


        try {

            const [results] =
                await db.execute(
                    `
                    SELECT
                        id,
                        email,
                        is_verified

                    FROM users

                    WHERE
                        LOWER(TRIM(email)) = ?

                    LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "Account not found."
                    });
            }


            const user =
                results[0];


            if (
                user.is_verified
            ) {

                return res.json({

                    message:
                        "Your email is already verified."
                });
            }


            const verificationToken =
                createToken();


            const verificationTokenHash =
                hashToken(
                    verificationToken
                );


            const expires =
                new Date(
                    Date.now() +
                    30 * 60 * 1000
                );


            await db.execute(
                `
                UPDATE users

                SET
                    verification_token_hash = ?,

                    verification_token_expires = ?

                WHERE id = ?
                `,
                [
                    verificationTokenHash,
                    expires,
                    user.id
                ]
            );


            try {

                const info =
                    await sendVerificationEmail(
                        user.email,
                        verificationToken
                    );


                console.log(
                    `✅ Verification email resent to ${user.email}`
                );


                console.log(
                    "Message ID:",
                    info.messageId
                );


                return res.json({

                    message:
                        "Verification email sent. Check your inbox and Spam folder."
                });


            } catch (emailError) {

                console.error(
                    "❌ Verification email failed:",
                    emailError.message
                );


                return res
                    .status(500)
                    .json({

                        message:
                            "Could not send verification email. Check the Node terminal for the Gmail error."
                    });
            }


        } catch (error) {

            console.error(
                "Resend verification error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);


// ========================================
// LOGIN
// ========================================

app.post("/api/login", async (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    console.log("LOGIN ATTEMPT:", username);

    if (!username || !password) {
        return res.status(400).json({
            message: "Please enter username and password."
        });
    }

    try {
        const [results] = await db.execute(
            `
            SELECT id, username, email, password, is_verified
            FROM users
            WHERE username = ?
            LIMIT 1
            `,
            [username]
        );

        console.log("Users found:", results.length);

        if (results.length === 0) {
            return res.status(401).json({
                message: "Incorrect username or password."
            });
        }

        const user = results[0];

        console.log(
            "Password hash length:",
            user.password ? user.password.length : 0
        );

        if (!user.password) {
            console.error("❌ User has no password hash.");

            return res.status(500).json({
                message: "Account password data is invalid."
            });
        }

        let passwordMatch;

        try {
            passwordMatch = await bcrypt.compare(
                password,
                user.password
            );
        } catch (bcryptError) {
            console.error(
                "❌ bcrypt.compare error:",
                bcryptError
            );

            return res.status(500).json({
                message: "Stored password hash is invalid."
            });
        }

        if (!passwordMatch) {
            return res.status(401).json({
                message: "Incorrect username or password."
            });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                message:
                    "Please verify your email before logging in."
            });
        }

        req.session.user = {
            id: user.id,
            username: user.username
        };

        req.session.save((error) => {
            if (error) {
                console.error(
                    "❌ Session save error:",
                    error
                );

                return res.status(500).json({
                    message: "Could not save login session."
                });
            }

            console.log(
                "✅ Login successful:",
                user.username
            );

            return res.json({
                message: "Login successful!",
                username: user.username
            });
        });

    } catch (error) {
        console.error("❌ LOGIN ERROR:");
        console.error(error);

        return res.status(500).json({
            message: "Server error."
        });
    }
});


// ========================================
// CURRENT USER
// ========================================

app.get(
    "/api/current-user",
    async (req, res) => {

        if (
            !req.session?.user
        ) {

            return res
                .status(401)
                .json({

                    message:
                        "Not logged in."
                });
        }


        try {

            const [results] =
                await db.execute(
                    `
                    SELECT
                        id,
                        username,
                        email,
                        is_verified,
                        role,
                        created_at

                    FROM users

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        req.session.user.id
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "User not found."
                    });
            }


            return res.json(
                results[0]
            );


        } catch (error) {

            console.error(
                "Current user error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Database error."
                });
        }
    }
);


// ========================================
// DASHBOARD
// ========================================

app.get(
    "/dashboard",
    (req, res) => {

        if (
            !req.session?.user
        ) {

            return res.redirect(
                "/"
            );
        }


        return res.sendFile(
            path.join(
                __dirname,
                "dashboard.html"
            )
        );
    }
);


// ========================================
// LOGOUT
// ========================================

app.post(
    "/api/logout",
    (req, res) => {

        req.session.destroy(
            (error) => {

                if (error) {

                    console.error(
                        "Logout error:",
                        error
                    );


                    return res
                        .status(500)
                        .json({

                            message:
                                "Logout failed."
                        });
                }


                res.clearCookie(
                    "connect.sid"
                );


                return res.json({

                    message:
                        "Logout successful!"
                });
            }
        );
    }
);


// ========================================
// EDIT PROFILE
// ========================================

app.put(
    "/api/profile",
    async (req, res) => {

        if (
            !req.session?.user
        ) {

            return res
                .status(401)
                .json({

                    message:
                        "You must be logged in."
                });
        }


        const username =
            cleanText(
                req.body.username
            );


        const email =
            normalizeEmail(
                req.body.email
            );


        const userId =
            req.session.user.id;


        if (
            !username ||
            !email
        ) {

            return res
                .status(400)
                .json({

                    message:
                        "Username and email are required."
                });
        }


        try {

            const [currentRows] =
                await db.execute(
                    `
                    SELECT email

                    FROM users

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        userId
                    ]
                );


            if (
                currentRows.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "User not found."
                    });
            }


            const currentEmail =
                normalizeEmail(
                    currentRows[0].email
                );


            const emailChanged =
                currentEmail !==
                email;


            let verificationToken =
                null;


            if (
                emailChanged
            ) {

                verificationToken =
                    createToken();


                const tokenHash =
                    hashToken(
                        verificationToken
                    );


                const expires =
                    new Date(
                        Date.now() +
                        30 * 60 * 1000
                    );


                await db.execute(
                    `
                    UPDATE users

                    SET
                        username = ?,

                        email = ?,

                        is_verified = FALSE,

                        verification_token_hash = ?,

                        verification_token_expires = ?

                    WHERE id = ?
                    `,
                    [
                        username,
                        email,
                        tokenHash,
                        expires,
                        userId
                    ]
                );


            } else {

                await db.execute(
                    `
                    UPDATE users

                    SET username = ?

                    WHERE id = ?
                    `,
                    [
                        username,
                        userId
                    ]
                );
            }


            req.session.user.username =
                username;


            req.session.save(
                async (
                    sessionError
                ) => {

                    if (
                        sessionError
                    ) {

                        console.error(
                            "Session update error:",
                            sessionError
                        );


                        return res
                            .status(500)
                            .json({

                                message:
                                    "Profile changed, but session could not update."
                            });
                    }


                    if (
                        !emailChanged
                    ) {

                        return res.json({

                            message:
                                "Profile updated successfully!"
                        });
                    }


                    try {

                        await sendVerificationEmail(
                            email,
                            verificationToken
                        );


                        return res.json({

                            message:
                                "Profile updated. Please verify your new email address."
                        });


                    } catch (
                    emailError
                    ) {

                        console.error(
                            "New-email verification failed:",
                            emailError.message
                        );


                        return res
                            .status(500)
                            .json({

                                message:
                                    "Profile updated, but the verification email could not be sent. Use Resend Verification."
                            });
                    }
                }
            );


        } catch (error) {


            if (
                error.code ===
                "ER_DUP_ENTRY"
            ) {

                return res
                    .status(409)
                    .json({

                        message:
                            "Username or email is already being used."
                    });
            }


            console.error(
                "Profile update error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Database error."
                });
        }
    }
);


// ========================================
// CHANGE PASSWORD
// ========================================

app.put(
    "/api/change-password",
    async (req, res) => {

        if (
            !req.session?.user
        ) {

            return res
                .status(401)
                .json({

                    message:
                        "You must be logged in."
                });
        }


        const currentPassword =
            String(
                req.body.currentPassword ||
                ""
            );


        const newPassword =
            String(
                req.body.newPassword ||
                ""
            );


        if (
            !currentPassword ||
            !newPassword
        ) {

            return res
                .status(400)
                .json({

                    message:
                        "Please complete all password fields."
                });
        }


        if (
            newPassword.length < 6
        ) {

            return res
                .status(400)
                .json({

                    message:
                        "New password must be at least 6 characters."
                });
        }


        try {

            const [results] =
                await db.execute(
                    `
                    SELECT password

                    FROM users

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        req.session.user.id
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "User not found."
                    });
            }


            const passwordMatch =
                await bcrypt.compare(
                    currentPassword,
                    results[0].password
                );


            if (
                !passwordMatch
            ) {

                return res
                    .status(401)
                    .json({

                        message:
                            "Current password is incorrect."
                    });
            }


            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            await db.execute(
                `
                UPDATE users

                SET password = ?

                WHERE id = ?
                `,
                [
                    hashedPassword,
                    req.session.user.id
                ]
            );


            return res.json({

                message:
                    "Password changed successfully!"
            });


        } catch (error) {

            console.error(
                "Change password error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);


// ========================================
// DELETE ACCOUNT
// ========================================

app.delete(
    "/api/delete-account",
    async (req, res) => {

        if (
            !req.session?.user
        ) {

            return res
                .status(401)
                .json({

                    message:
                        "You must be logged in."
                });
        }


        const password =
            String(
                req.body.password ||
                ""
            );


        if (!password) {

            return res
                .status(400)
                .json({

                    message:
                        "Password is required."
                });
        }


        try {

            const [results] =
                await db.execute(
                    `
                    SELECT password

                    FROM users

                    WHERE id = ?

                    LIMIT 1
                    `,
                    [
                        req.session.user.id
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(404)
                    .json({

                        message:
                            "User not found."
                    });
            }


            const passwordMatch =
                await bcrypt.compare(
                    password,
                    results[0].password
                );


            if (
                !passwordMatch
            ) {

                return res
                    .status(401)
                    .json({

                        message:
                            "Incorrect password."
                    });
            }


            await db.execute(
                `
                DELETE FROM users

                WHERE id = ?
                `,
                [
                    req.session.user.id
                ]
            );


            req.session.destroy(
                (error) => {

                    if (error) {

                        console.error(
                            "Session destroy error:",
                            error
                        );
                    }


                    res.clearCookie(
                        "connect.sid"
                    );


                    return res.json({

                        message:
                            "Account deleted successfully."
                    });
                }
            );


        } catch (error) {

            console.error(
                "Delete account error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);


// ========================================
// FORGOT PASSWORD
// ========================================

app.post(
    "/api/forgot-password",
    async (req, res) => {

        const email =
            normalizeEmail(
                req.body.email
            );


        if (!email) {

            return res
                .status(400)
                .json({

                    message:
                        "Please enter your email address."
                });
        }


        const genericMessage =
            "If that email is registered, password reset instructions have been sent.";


        try {

            const [results] =
                await db.execute(
                    `
                    SELECT
                        id,
                        email

                    FROM users

                    WHERE
                        LOWER(TRIM(email)) = ?

                    LIMIT 1
                    `,
                    [
                        email
                    ]
                );


            if (
                results.length === 0
            ) {

                return res.json({

                    message:
                        genericMessage
                });
            }


            const user =
                results[0];


            const resetToken =
                createToken();


            const resetTokenHash =
                hashToken(
                    resetToken
                );


            const expires =
                new Date(
                    Date.now() +
                    15 * 60 * 1000
                );


            await db.execute(
                `
                UPDATE users

                SET
                    reset_token_hash = ?,

                    reset_token_expires = ?

                WHERE id = ?
                `,
                [
                    resetTokenHash,
                    expires,
                    user.id
                ]
            );


            try {

                const info =
                    await sendPasswordResetEmail(
                        user.email,
                        resetToken
                    );


                console.log(
                    `✅ Reset email sent to ${user.email}`
                );


                console.log(
                    "Message ID:",
                    info.messageId
                );


                return res.json({

                    message:
                        genericMessage
                });


            } catch (
            emailError
            ) {

                console.error(
                    "❌ Reset email failed:",
                    emailError.message
                );


                return res
                    .status(500)
                    .json({

                        message:
                            "Could not send reset email. Check the Node terminal for the Gmail error."
                    });
            }


        } catch (error) {

            console.error(
                "Forgot password error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);


// ========================================
// RESET PASSWORD
// ========================================

app.post(
    "/api/reset-password",
    async (req, res) => {

        const token =
            cleanText(
                req.body.token
            );


        const newPassword =
            String(
                req.body.newPassword ||
                ""
            );


        if (
            !token ||
            !newPassword
        ) {

            return res
                .status(400)
                .json({

                    message:
                        "Token and new password are required."
                });
        }


        if (
            newPassword.length < 6
        ) {

            return res
                .status(400)
                .json({

                    message:
                        "Password must be at least 6 characters."
                });
        }


        try {

            const tokenHash =
                hashToken(token);


            const [results] =
                await db.execute(
                    `
                    SELECT id

                    FROM users

                    WHERE
                        reset_token_hash = ?

                    AND
                        reset_token_expires > NOW()

                    LIMIT 1
                    `,
                    [
                        tokenHash
                    ]
                );


            if (
                results.length === 0
            ) {

                return res
                    .status(400)
                    .json({

                        message:
                            "Reset link is invalid or has expired."
                    });
            }


            const hashedPassword =
                await bcrypt.hash(
                    newPassword,
                    10
                );


            await db.execute(
                `
                UPDATE users

                SET
                    password = ?,

                    reset_token_hash = NULL,

                    reset_token_expires = NULL

                WHERE id = ?
                `,
                [
                    hashedPassword,
                    results[0].id
                ]
            );


            return res.json({

                message:
                    "Password reset successfully!"
            });


        } catch (error) {

            console.error(
                "Reset password error:",
                error
            );


            return res
                .status(500)
                .json({

                    message:
                        "Server error."
                });
        }
    }
);

// ========================================
// ADMIN ACTIVITY LOGGER
// ========================================

// ========================================
// ADMIN ACTIVITY LOGGER
// ========================================

async function logAdminAction(
    adminId,
    action,
    targetUserId = null,
    targetUsername = null,
    details = null
) {

    console.log(
        "📝 Logging admin action:",
        adminId,
        action,
        targetUserId,
        targetUsername,
        details
    );

    try {

        await db.execute(
            `
            INSERT INTO admin_activity_logs
            (
                admin_id,
                action,
                target_user_id,
                target_username,
                details
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                adminId,
                action,
                targetUserId,
                targetUsername,
                details
            ]
        );

        console.log(
            "✅ Activity log saved."
        );

    } catch (error) {

        console.error(
            "❌ Activity log error:",
            error
        );
    }
}

// ========================================
// ADMIN MIDDLEWARE
// ========================================

async function requireAdmin(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({
            message: "You must be logged in."
        });
    }

    try {
        const [results] = await db.execute(
            `
            SELECT role
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.session.user.id]
        );

        if (results.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (results[0].role !== "admin") {
            return res.status(403).json({
                message: "Admin access only."
            });
        }

        next();

    } catch (error) {
        console.error("Admin check error:", error);

        return res.status(500).json({
            message: "Server error."
        });
    }
}

// ========================================
// ADMIN DASHBOARD
// ========================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);


// ========================================
// GET ALL USERS
// ========================================

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {

        try {
            const [users] =
                await db.execute(
                    `
                    SELECT
                        id,
                        username,
                        email,
                        role,
                        is_verified,
                        created_at
                    FROM users
                    ORDER BY id DESC
                    `
                );

            return res.json(users);

        } catch (error) {
            console.error(
                "Admin users error:",
                error
            );

            return res.status(500).json({
                message:
                    "Could not load users."
            });
        }
    }
);


// ========================================
// CHANGE USER ROLE
// ========================================

app.put(
    "/api/admin/users/:id/role",
    requireAdmin,
    async (req, res) => {

        const userId =
            Number(req.params.id);

        const role =
            String(req.body.role || "");

        if (
            role !== "user" &&
            role !== "admin"
        ) {
            return res.status(400).json({
                message: "Invalid role."
            });
        }

        try {

            const [targetUsers] =
                await db.execute(
                    `
        SELECT username
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
                    [userId]
                );


            if (targetUsers.length === 0) {

                return res.status(404).json({
                    message: "User not found."
                });
            }


            const targetUsername =
                targetUsers[0].username;
            await db.execute(
                `
                UPDATE users
                SET role = ?
                WHERE id = ?
                `,
                [role, userId]
            );

            return res.json({
                message:
                    "User role updated."
            });

        } catch (error) {
            console.error(
                "Role update error:",
                error
            );

            return res.status(500).json({
                message:
                    "Could not update role."
            });
        }
    }
);


// ========================================
// ADMIN DELETE USER
// ========================================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req, res) => {

        const userId =
            Number(req.params.id);

        if (
            userId ===
            req.session.user.id
        ) {
            return res.status(400).json({
                message:
                    "You cannot delete your own admin account here."
            });
        }

        try {
            await db.execute(
                `
                DELETE FROM users
                WHERE id = ?
                `,
                [userId]
            );

            return res.json({
                message:
                    "User deleted successfully."
            });

        } catch (error) {
            console.error(
                "Admin delete error:",
                error
            );

            return res.status(500).json({
                message:
                    "Could not delete user."
            });
        }
    }
);

// ========================================
// ADMIN MIDDLEWARE
// ========================================

async function requireAdmin(req, res, next) {
    if (!req.session?.user) {
        return res.status(401).json({
            message: "You must be logged in."
        });
    }

    try {
        const [results] = await db.execute(
            `
            SELECT role
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [req.session.user.id]
        );

        if (results.length === 0) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        if (results[0].role !== "admin") {
            return res.status(403).json({
                message: "Admin access only."
            });
        }

        next();

    } catch (error) {
        console.error("Admin check error:", error);

        return res.status(500).json({
            message: "Server error."
        });
    }
}


// ========================================
// ADMIN PAGE
// ========================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "admin.html"
            )
        );
    }
);


// ========================================
// GET ALL USERS
// ========================================

app.get(
    "/api/admin/users",
    requireAdmin,
    async (req, res) => {
        try {
            const [users] = await db.execute(
                `
                SELECT
                    id,
                    username,
                    email,
                    role,
                    is_verified,
                    created_at
                FROM users
                ORDER BY id DESC
                `
            );

            return res.json(users);

        } catch (error) {
            console.error(
                "Admin users error:",
                error
            );

            return res.status(500).json({
                message: "Could not load users."
            });
        }
    }
);


// ========================================
// CHANGE USER ROLE
// ========================================

app.put(
    "/api/admin/users/:id/role",
    requireAdmin,
    async (req, res) => {
        const userId = Number(req.params.id);
        const role = String(req.body.role || "");

        if (!Number.isInteger(userId)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        if (
            role !== "user" &&
            role !== "admin"
        ) {
            return res.status(400).json({
                message: "Invalid role."
            });
        }

        // Prevent admin from removing their own admin role
        if (
            userId === req.session.user.id &&
            role !== "admin"
        ) {
            return res.status(400).json({
                message:
                    "You cannot remove your own admin role."
            });
        }

        try {
            const [result] = await db.execute(
                `
                UPDATE users
                SET role = ?
                WHERE id = ?
                `,
                [role, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found."
                });
            }

            await logAdminAction(
                req.session.user.id,
                "ROLE_CHANGED",
                userId,
                targetUsername,
                `Changed ${targetUsername}'s role to ${role}`
            );

            return res.json({
                message: "User role updated successfully."
            });

        } catch (error) {
            console.error(
                "Admin role update error:",
                error
            );

            return res.status(500).json({
                message: "Could not update user role."
            });
        }
    }
);


// ========================================
// ADMIN DELETE USER
// ========================================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    async (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isInteger(userId)) {
            return res.status(400).json({
                message: "Invalid user ID."
            });
        }

        // Prevent deleting your own admin account
        if (userId === req.session.user.id) {
            return res.status(400).json({
                message:
                    "You cannot delete your own admin account."
            });
        }

        try {
            const [targetUsers] =
                await db.execute(
                    `
        SELECT username, email
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
                    [userId]
                );


            if (targetUsers.length === 0) {

                return res.status(404).json({
                    message: "User not found."
                });
            }


            const targetUser =
                targetUsers[0];


            const [result] =
                await db.execute(
                    `
        DELETE FROM users
        WHERE id = ?
        `,
                    [userId]
                );


            await logAdminAction(
                req.session.user.id,
                "USER_DELETED",
                userId,
                `Deleted user: ${targetUser.username} (${targetUser.email})`
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "User not found."
                });
            }

            return res.json({
                message: "User deleted successfully."
            });

        } catch (error) {
            console.error(
                "Admin delete user error:",
                error
            );

            return res.status(500).json({
                message: "Could not delete user."
            });
        }
    }
);

// ========================================
// GET ADMIN ACTIVITY LOGS
// ========================================

app.get(
    "/api/admin/activity-logs",
    requireAdmin,
    async (req, res) => {

        try {

            const [logs] =
                await db.execute(
                    `
                    SELECT
                        logs.id,
                        logs.admin_id,
                        logs.action,
                        logs.target_user_id,
                        logs.details,
                        logs.created_at,

                        admin_user.username
                            AS admin_username,

                        target_user.username
                            AS target_username

                    FROM admin_activity_logs AS logs

                    LEFT JOIN users AS admin_user
                        ON admin_user.id =
                           logs.admin_id

                    LEFT JOIN users AS target_user
                        ON target_user.id =
                           logs.target_user_id

                    ORDER BY logs.id DESC

                    LIMIT 100
                    `
                );


            return res.json(logs);


        } catch (error) {

            console.error(
                "Activity logs error:",
                error
            );


            return res.status(500).json({
                message:
                    "Could not load activity logs."
            });
        }
    }
);

// ========================================
// START SERVER
// ========================================

app.listen(PORT, async () => {

    console.log(
        `✅ Server running at ${BASE_URL}`
    );

    await testDatabaseConnection();

    if (resendApiKey) {
        console.log(
            "✅ Resend email API is configured."
        );
    } else {
        console.error(
            "❌ RESEND_API_KEY is missing."
        );
    }
});