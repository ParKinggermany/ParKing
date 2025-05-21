const supabaseUrl = 'https://oezsueksjdaycavlxrjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lenN1ZWtzamRheWNhdmx4cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1NTEsImV4cCI6MjA2MjgxMDU1MX0.ZsXCkzYXVSY01_OCM8zfZo9HjPTbWhI6WHdTQtQAF0E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const translations = {
    de: {
        title: "ParKing - Finde und bewerte Parkplätze",
        login: "Login",
        signup: "Registrieren",
        logout: "Logout",
        prompt: "Gib deine Bewertung für diesen Parkplatz ein:",
        login_error: "Login fehlgeschlagen: ",
        login_success: "Login erfolgreich",
        signup_error: "Registrierung fehlgeschlagen: ",
        signup_success: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre Email.",
        out_of_bounds: "Bitte nur in Deutschland bewerten."
    },
    en: {
        title: "ParKing - Find and review parking spots",
        login: "Login",
        signup: "Sign up",
        logout: "Logout",
        prompt: "Enter your review for this parking spot:",
        login_error: "Login failed: ",
        login_success: "Login successful",
        signup_error: "Registration failed: ",
        signup_success: "Registration successful. Please verify your email.",
        out_of_bounds: "Please only add reviews within Germany."
    }
};

let currentLang = 'de';

function setLanguage(lang) {
    currentLang = lang;
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert(translations[currentLang].login_error + error.message);
    } else {
        alert(translations[currentLang].login_success);
        document.getElementById('auth').style.display = 'none';
        document.getElementById('map-section').style.display = 'block';
        initMap();
    }
}

async function signup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
        alert(translations[currentLang].signup_error + error.message);
    } else {
        alert(translations[currentLang].signup_success);
    }
}

async function logout() {
    await supabase.auth.signOut();
    document.getElementById('auth').style.display = 'block';
    document.getElementById('map-section').style.display = 'none';
}

let map;
let markerLayer;

function initMap() {
    if (map) return; // Karte nur einmal erstellen

    map = L.map('map').setView([52.52, 13.405], 6); // Deutschlandübersicht

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap Contributors'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    map.on('click', async function(e) {
        const { lat, lng } = e.latlng;

        // Begrenzung auf Deutschland (ungefähr)
        if (lat < 47 || lat > 55 || lng < 5 || lng > 15) {
            alert(translations[currentLang].out_of_bounds);
            return;
        }

        const kommentar = prompt(translations[currentLang].prompt);
        if (kommentar) {
            await supabase.from('parkplaetze').insert([{ lat, lng, kommentar }]);
            loadMarkers();
        }
    });

    loadMarkers();
}

async function loadMarkers() {
    markerLayer.clearLayers();
    const { data, error } = await supabase.from('parkplaetze').select('*');
    if (!error && data) {
        data.forEach(({ lat, lng, kommentar }) => {
            L.marker([lat, lng]).addTo(markerLayer).bindPopup(kommentar);
        });

        // Auf Marker zoomen, wenn vorhanden
        if (markerLayer.getLayers().length > 0) {
            map.fitBounds(markerLayer.getBounds(), { padding: [50, 50] });
        }
    }
}

// Sprache beim Start setzen
window.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
});


