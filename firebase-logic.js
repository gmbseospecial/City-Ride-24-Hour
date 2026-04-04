import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, setDoc, getDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Initialize Firebase
const app = initializeApp(window.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Auth State Synchronizer
export const handleAuthState = (onUserIn, onUserOut) => {
    onAuthStateChanged(auth, (user) => {
        if (user && user.emailVerified) {
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

// Signup with Email/Password and send verification
export const signupUser = async (userData) => {
    try {
        // 1. Create User
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;

        // 2. Send Email Verification
        await sendEmailVerification(user);

        // 3. Store temp profile in localStorage (to be saved to Firestore after verification)
        const profileData = {
            firstName: userData.firstName,
            lastName: userData.lastName,
            email: userData.email,
            phone: userData.phone,
            uid: user.uid
        };
        localStorage.setItem('pending_profile_' + user.uid, JSON.stringify(profileData));

        return user;
    } catch (error) {
        console.error("Signup Error:", error);
        throw error;
    }
};

// Login with Email - Checks verification and saves to Firestore if first time
export const loginEmail = async (email, password) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 1. Check if email is verified
        if (!user.emailVerified) {
            await signOut(auth);
            throw new Error("Please verify your email address before logging in. Check your inbox.");
        }

        // 2. Check if user document exists in Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            // Check if we have pending profile data in localStorage
            const pendingDataStr = localStorage.getItem('pending_profile_' + user.uid);
            if (pendingDataStr) {
                const pendingData = JSON.parse(pendingDataStr);
                await setDoc(userDocRef, {
                    firstName: pendingData.firstName,
                    lastName: pendingData.lastName,
                    email: pendingData.email,
                    phone: pendingData.phone,
                    createdAt: serverTimestamp()
                });
                localStorage.removeItem('pending_profile_' + user.uid);
            } else {
                // Fallback: If no localStorage data, create minimal profile
                await setDoc(userDocRef, {
                    email: user.email,
                    createdAt: serverTimestamp()
                });
            }
        }

        return user;
    } catch (error) {
        console.error("Login Error:", error);
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
        if (!user || !user.emailVerified) throw new Error("Auth required");
        
        await addDoc(collection(db, "bookings"), {
            ...bookingData,
            userId: user.uid,
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
        if (!user || !user.emailVerified) throw new Error("Auth required");

        await addDoc(collection(db, "long_bookings"), {
            ...bookingData,
            userId: user.uid,
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
    signupUser,
    loginEmail,
    forgotPassword,
    saveHomeBooking,
    saveLongBooking,
    saveContactRequest,
    validatePassword
};
