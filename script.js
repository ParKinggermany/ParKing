const supabaseUrl = 'https://oezsueksjdaycavlxrjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lenN1ZWtzamRheWNhdmx4cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1NTEsImV4cCI6MjA2MjgxMDU1MX0.ZsXCkzYXVSY01_OCM8zfZo9HjPTbWhI6WHdTQtQAF0E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const translations = {
  de: {
    title: "ParKing - Finde und bewerte Parkplätze",
    login: "Login",
    signup: "Registrieren",
    logout: "Logout",
    login_error: "Login fehlgeschlagen: ",
    login_success: "Login erfolgreich",
    signup_error: "Registrierung fehlgeschlagen: ",
    signup_success: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre Email.",
    out_of_bounds: "Bitte nur in Deutschland bewerten."
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
  if (map) return;

  map = L.map('map').setView([52.52, 13.405], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap Contributors'
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  map.on('click', async function (e) {
    const { lat, lng } = e.latlng;
    if (lat < 47 || lat > 55 || lng < 5 || lng > 15) {
      alert(translations[currentLang].out_of_bounds);
      return;
    }

    const kommentar = prompt("Kommentar?");
    const sterne = prompt("Wie viele Sterne (1-5)?");
    const bildUrl = prompt("Bild-URL (optional)?");

    const { data: platzData, error: insertError } = await supabase
      .from('parkplaetze')
      .insert([{ lat, lng }])
      .select()
      .single();

    if (insertError) {
      console.error("Fehler beim Parkplatz:", insertError);
      return;
    }

    const user = await supabase.auth.getUser();
    const user_id = user?.data?.user?.id;

    const { error: ratingError } = await supabase
      .from('bewertungen')
      .insert([{
        parkplatz_id: platzData.id,
        user_id,
        kommentar,
        sterne: parseInt(sterne),
        bild_url: bildUrl
      }]);

    if (ratingError) {
      console.error("Bewertungsfehler:", ratingError);
    } else {
      loadMarkers();
    }
  });

  loadMarkers();
}

async function loadMarkers() {
  markerLayer.clearLayers();
  const { data: parkplaetze, error } = await supabase.from('parkplaetze').select('*');
  if (error) return console.error("Ladefehler:", error);

  for (const platz of parkplaetze) {
    const { data: bewertungen } = await supabase
      .from('bewertungen')
      .select('*')
      .eq('parkplatz_id', platz.id);

    const avg = bewertungen.length
      ? (bewertungen.reduce((sum, b) => sum + b.sterne, 0) / bewertungen.length).toFixed(1)
      : "Keine Bewertungen";

    const popupContent = `
      <div class="popup-content">
        <strong>Durchschnitt: ${avg} ⭐</strong><br>
        <button onclick="bewerteParkplatz('${platz.id}')">Bewerten</button>
      </div>`;

    L.marker([platz.lat, platz.lng])
      .addTo(markerLayer)
      .bindPopup(popupContent);
  }

  if (markerLayer.getLayers().length > 0) {
    map.fitBounds(markerLayer.getBounds(), { padding: [50, 50] });
  }
}

async function bewerteParkplatz(parkplatzId) {
  const sterne = prompt("Sterne (1–5)?");
  const kommentar = prompt("Kommentar?");
  const bildUrl = prompt("Bild-URL (optional)?");

  const user = await supabase.auth.getUser();
  const user_id = user?.data?.user?.id;

  const { error } = await supabase.from('bewertungen').insert([{
    parkplatz_id: parkplatzId,
    user_id,
    kommentar,
    sterne: parseInt(sterne),
    bild_url: bildUrl
  }]);

  if (error) {
    alert("Fehler beim Speichern der Bewertung: " + error.message);
  } else {
    alert("Bewertung gespeichert!");
    loadMarkers();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});
