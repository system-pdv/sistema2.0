import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyD7HIgiL4WjqBO6PMUizdyqHcCHikGH8QA",
    authDomain: "sistemaminimercado-fc4a5.firebaseapp.com",
    projectId: "sistemaminimercado-fc4a5",
    storageBucket: "sistemaminimercado-fc4a5.firebasestorage.app",
    messagingSenderId: "543846706936",
    appId: "1:543846706936:web:c8498b58d390108a3a150d",
    measurementId: "G-3CRCHVSWP9"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);