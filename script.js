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
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) el.textContent = translations[lang][key];
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

    const sterne = prompt("Wie viele Sterne (1–5)?");
    if (!sterne || isNaN(sterne) || sterne < 1 || sterne > 5) return;

    const kommentar = prompt("Kommentar?");
    if (!kommentar) return;

    const file = document.getElementById('upload-input').files[0];
    const bildUrl = await uploadBild(file);
    document.getElementById('upload-input').value = '';

    const { data: platzData, error: platzErr } = await supabase
      .from('parkplaetze')
      .insert([{ lat, lng }])
      .select()
      .single();
    if (platzErr) return console.error(platzErr);

    const user = await supabase.auth.getUser();
    const user_id = user?.data?.user?.id;

    const { error: bewErr } = await supabase
      .from('bewertungen')
      .insert([{
        parkplatz_id: platzData.id,
        user_id,
        kommentar,
        sterne: parseInt(sterne),
        bild_url: bildUrl
      }]);

    if (!bewErr) loadMarkers();
  });

  loadMarkers();
}

async function loadMarkers() {
  markerLayer.clearLayers();
  const { data: parkplaetze } = await supabase.from('parkplaetze').select('*');

  for (const platz of parkplaetze) {
    const { data: bewertungen } = await supabase
      .from('bewertungen')
      .select('*')
      .eq('parkplatz_id', platz.id)
      .order('created_at', { ascending: false });

    const avg = bewertungen.length
      ? (bewertungen.reduce((s, b) => s + b.sterne, 0) / bewertungen.length).toFixed(1)
      : "Keine Bewertungen";

    let popup = `<div class="popup-content"><strong>Ø ${avg} ⭐</strong><br>`;
    if (bewertungen.length > 0) {
      popup += "<strong>Kommentare:</strong><br>";
      bewertungen.slice(0, 3).forEach(b => {
        popup += `${b.sterne}⭐ - ${b.kommentar}<br>`;
        if (b.bild_url) popup += `<img src="${b.bild_url}" alt="Bild" width="100"><br>`;
      });
    }
    popup += `<br><button onclick="bewerteParkplatz('${platz.id}')">Bewerten</button></div>`;

    L.marker([platz.lat, platz.lng]).addTo(markerLayer).bindPopup(popup);
  }

  const allMarkers = markerLayer.getLayers();
  if (allMarkers.length > 0) {
    const bounds = L.featureGroup(allMarkers).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

async function bewerteParkplatz(parkplatzId) {
  const sterne = prompt("Sterne (1–5)?");
  if (!sterne || isNaN(sterne) || sterne < 1 || sterne > 5) return;

  const kommentar = prompt("Kommentar?");
  if (!kommentar) return;

  const file = document.getElementById('upload-input').files[0];
  const bildUrl = await uploadBild(file);
  document.getElementById('upload-input').value = '';

  const user = await supabase.auth.getUser();
  const user_id = user?.data?.user?.id;

  const { error } = await supabase.from('bewertungen').insert([{
    parkplatz_id: parkplatzId,
    user_id,
    kommentar,
    sterne: parseInt(sterne),
    bild_url: bildUrl
  }]);

  if (!error) {
    alert("Bewertung gespeichert!");
    loadMarkers();
  } else {
    alert("Fehler: " + error.message);
  }
}

async function uploadBild(file) {
  if (!file) return null;
  const fileName = `${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from('bewertungen').upload(fileName, file);
  if (error) {
    alert("Fehler beim Upload: " + error.message);
    return null;
  }
  const { data } = supabase.storage.from('bewertungen').getPublicUrl(fileName);
  return data.publicUrl;
}

async function geocodeAddress() {
  const address = document.getElementById('address-input').value;
  if (!address) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
  const data = await res.json();
  if (data.length > 0) {
    map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
  } else {
    alert("Adresse nicht gefunden.");
  }
}

async function zeigeNahegelegeneParkplaetze() {
  const center = map.getCenter();
  const RADIUS = 0.5;

  const { data: alle } = await supabase.from('parkplaetze').select('*');
  const nearby = alle.filter(p => entfernungInKm(center.lat, center.lng, p.lat, p.lng) <= RADIUS);

  markerLayer.clearLayers();
  for (const platz of nearby) {
    const popup = `<div class="popup-content"><strong>Parkplatz</strong><br><button onclick="bewerteParkplatz('${platz.id}')">Bewerten</button></div>`;
    L.marker([platz.lat, platz.lng]).addTo(markerLayer).bindPopup(popup);
  }

  if (nearby.length > 0) {
    const bounds = L.featureGroup(markerLayer.getLayers()).getBounds();
    map.fitBounds(bounds, { padding: [30, 30] });
  } else {
    alert("Keine Parkplätze in der Nähe gefunden.");
  }
}

function entfernungInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLang);
});
