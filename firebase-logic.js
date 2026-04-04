import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, RecaptchaVerifier, signInWithPhoneNumber, EmailAuthProvider, linkWithCredential } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth State Synchronizer
export const handleAuthState = (onUserIn, onUserOut) => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            onUserIn(user);
        } else {
            onUserOut();
        }
    });
};

// Logout
export const logoutUser = async () => {
    try {
        await signOut(auth);
        location.reload();
    } catch (error) {
        console.error("Logout Error:", error);
    }
};

// --- AUTH FUNCTIONS ---

// Recaptcha Verifier
export const setupRecaptcha = (containerId) => {
    try {
        // If it already exists, clear it first to avoid multiple instances
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        }
        
        window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
            'size': 'invisible',
            'callback': (response) => {
                console.log("Recaptcha verified");
            },
            'expired-callback': () => {
                console.log("Recaptcha expired, resetting...");
                setupRecaptcha(containerId);
            }
        });
        
        // Explicitly render to ensure it's ready
        return window.recaptchaVerifier.render();
    } catch (error) {
        console.error("Recaptcha Setup Error:", error);
        throw error;
    }
};

// Send OTP for Signup or Login
export const sendOTP = async (phoneNumber) => {
    try {
        if (!window.recaptchaVerifier) {
            throw new Error("Recaptcha not initialized. Please refresh.");
        }
        
        // Ensure phone number starts with + (E.164)
        const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber.replace(/\D/g, '');
        
        const appVerifier = window.recaptchaVerifier;
        window.confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        return true;
    } catch (error) {
        console.error("OTP Error Details:", error.code, error.message);
        // If captcha failed, reset it
        if (error.code === 'auth/captcha-check-failed' || error.code === 'auth/invalid-app-credential') {
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = null;
            }
        }
        throw error;
    }
};

// Verify OTP & Complete Signup (Link Email/Pwd)
export const verifyOTPAndCreateUser = async (otpCode, userData) => {
    try {
        // 1. Confirm Phone
        const result = await window.confirmationResult.confirm(otpCode);
        const user = result.user;
        
        // 2. Link with Email/Password
        const credential = EmailAuthProvider.credential(userData.email, userData.password);
        await linkWithCredential(user, credential);

        // 3. Save details to Firestore using UID as Document ID
        await setDoc(doc(db, "users", user.uid), {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            createdAt: serverTimestamp()
        });

        return user;
    } catch (error) {
        console.error("Verification/Signup Error:", error);
        throw error;
    }
};

// Verify OTP for Login
export const verifyOTPForLogin = async (otpCode) => {
    try {
        const result = await window.confirmationResult.confirm(otpCode);
        return result.user;
    } catch (error) {
        console.error("OTP Login Error:", error);
        throw error;
    }
};

// Login with Email
export const loginEmail = async (email, password) => {
    try {
        return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Login Email Error:", error);
        throw error;
    }
};

// Forgot Password
export const forgotPassword = async (email) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (error) {
        console.error("Forgot Pwd Error:", error);
        throw error;
    }
};

// --- FIRESTORE FUNCTIONS ---

// Save Home Booking
export const saveHomeBooking = async (bookingData) => {
    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "bookings"), {
            ...bookingData,
            userId: user ? user.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Home Booking Error:", error);
        throw error;
    }
};

// Save Long Booking
export const saveLongBooking = async (bookingData) => {
    try {
        const user = auth.currentUser;
        await addDoc(collection(db, "long_bookings"), {
            ...bookingData,
            userId: user ? user.uid : "anonymous",
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Long Booking Error:", error);
        throw error;
    }
};

// Save Contact Request
export const saveContactRequest = async (contactData) => {
    try {
        await addDoc(collection(db, "contact_requests"), {
            ...contactData,
            createdAt: serverTimestamp()
        });
        return true;
    } catch (error) {
        console.error("Contact Request Error:", error);
        throw error;
    }
};

// --- VALIDATION HELPER ---
export const validatePassword = (password) => {
    const hasMinLength = password.length >= 8;
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    return {
        isValid: hasMinLength && hasUppercase && hasNumber && hasSpecial,
        requirements: {
            length: hasMinLength,
            capital: hasUppercase,
            number: hasNumber,
            special: hasSpecial
        }
    };
};

// Global Exposure
window.firebaseLogic = {
    handleAuthState,
    logoutUser,
    setupRecaptcha,
    sendOTP,
    verifyOTPAndCreateUser,
    verifyOTPForLogin,
    loginEmail,
    forgotPassword,
    saveHomeBooking,
    saveLongBooking,
    saveContactRequest,
    validatePassword
};
