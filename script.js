const supabaseUrl = 'https://oezsueksjdaycavlxrjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lenN1ZWtzamRheWNhdmx4cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1NTEsImV4cCI6MjA2MjgxMDU1MX0.ZsXCkzYXVSY01_OCM8zfZo9HjPTbWhI6WHdTQtQAF0E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Login fehlgeschlagen: ' + error.message);
    } else {
        alert('Login erfolgreich');
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
        alert('Registrierung fehlgeschlagen: ' + error.message);
    } else {
        alert('Registrierung erfolgreich. Bitte bestätigen Sie Ihre Email.');
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
    map = L.map('map').setView([52.52, 13.405], 13); // Berlin

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap Contributors'
    }).addTo(map);

    markerLayer = L.layerGroup().addTo(map);

    map.on('click', async function(e) {
        const { lat, lng } = e.latlng;
        const kommentar = prompt("Gib deine Bewertung für diesen Parkplatz ein:");
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
    }
}
