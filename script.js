const supabaseUrl = 'https://oezsueksjdaycavlxrjl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lenN1ZWtzamRheWNhdmx4cmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQ1NTEsImV4cCI6MjA2MjgxMDU1MX0.ZsXCkzYXVSY01_OCM8zfZo9HjPTbWhI6WHdTQtQAF0E';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let map, markerLayer;
let aktuelleParkplatzId = null;
let neueKoordinaten = null;
let currentLang = 'de';

async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('map-section').style.display = 'block';
    initMap();
  } else {
    alert("Login fehlgeschlagen: " + error.message);
  }
}

async function signup() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabase.auth.signUp({ email, password });
  alert(error ? "Fehler: " + error.message : "Registrierung erfolgreich!");
}

async function logout() {
  await supabase.auth.signOut();
  document.getElementById('auth').style.display = 'block';
  document.getElementById('map-section').style.display = 'none';
}

function initMap() {
  if (map) return;
  map = L.map('map').setView([52.52, 13.405], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  markerLayer = L.layerGroup().addTo(map);

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    if (lat < 47 || lat > 55 || lng < 5 || lng > 15) {
      alert("Bitte nur in Deutschland bewerten.");
      return;
    }
    oeffneModal(null, { lat, lng });
  });

  loadMarkers();
}

function oeffneModal(parkplatzId = null, coords = null) {
  aktuelleParkplatzId = parkplatzId;
  neueKoordinaten = coords;
  document.getElementById('sterne-input').value = '';
  document.getElementById('kommentar-input').value = '';
  document.getElementById('bild-input').value = '';
  document.getElementById('bewertungs-modal').style.display = 'flex';
}

function schliesseModal() {
  document.getElementById('bewertungs-modal').style.display = 'none';
  aktuelleParkplatzId = null;
  neueKoordinaten = null;
}

async function submitBewertung() {
  const sterne = document.getElementById('sterne-input').value;
  const kommentar = document.getElementById('kommentar-input').value;
  const file = document.getElementById('bild-input').files[0];
  if (!sterne || !kommentar) return alert("Bitte Sterne und Kommentar angeben.");

  let bildUrl = null;
  if (file) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('bewertungen').upload(fileName, file);
    if (uploadError) return alert("Bild-Upload fehlgeschlagen: " + uploadError.message);
    const { data } = supabase.storage.from('bewertungen').getPublicUrl(fileName);
    bildUrl = data.publicUrl;
  }

  const user = await supabase.auth.getUser();
  const user_id = user?.data?.user?.id;

  let parkplatzId = aktuelleParkplatzId;
  if (!parkplatzId && neueKoordinaten) {
    const { data, error } = await supabase.from('parkplaetze')
      .insert([{ lat: neueKoordinaten.lat, lng: neueKoordinaten.lng }])
      .select().single();
    if (error) return alert("Fehler beim Erstellen des Parkplatzes");
    parkplatzId = data.id;
  }

  const { error } = await supabase.from('bewertungen').insert([{
    parkplatz_id: parkplatzId,
    user_id,
    kommentar,
    sterne: parseInt(sterne),
    bild_url: bildUrl
  }]);

  if (!error) {
    alert("Bewertung gespeichert!");
    schliesseModal();
    loadMarkers();
  } else {
    alert("Fehler: " + error.message);
  }
}

async function loadMarkers() {
  markerLayer.clearLayers();
  const { data: parkplaetze } = await supabase.from('parkplaetze').select('*');

  for (const platz of parkplaetze) {
    const { data: bewertungen } = await supabase.from('bewertungen')
      .select('*').eq('parkplatz_id', platz.id).order('created_at', { ascending: false });

    const avg = bewertungen.length
      ? (bewertungen.reduce((sum, b) => sum + b.sterne, 0) / bewertungen.length).toFixed(1)
      : "Keine Bewertungen";

    let content = `<div class="popup-content"><strong>Ø ${avg} ⭐</strong><br>`;
    bewertungen.slice(0, 3).forEach(b => {
      content += `${b.sterne}⭐ – ${b.kommentar}<br>`;
      if (b.bild_url) content += `<img src="${b.bild_url}" width="100"><br>`;
    });
    content += `<button onclick="oeffneModal('${platz.id}')">Bewerten</button></div>`;

    L.marker([platz.lat, platz.lng]).addTo(markerLayer).bindPopup(content);
  }

  const bounds = L.featureGroup(markerLayer.getLayers()).getBounds();
  if (markerLayer.getLayers().length > 0) map.fitBounds(bounds, { padding: [50, 50] });
}

async function geocodeAddress() {
  const address = document.getElementById('address-input').value;
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
  const { data } = await supabase.from('parkplaetze').select('*');
  const nearby = data.filter(p => entfernungInKm(center.lat, center.lng, p.lat, p.lng) <= RADIUS);

  markerLayer.clearLayers();
  for (const platz of nearby) {
    const content = `<div class="popup-content"><strong>Parkplatz</strong><br><button onclick="oeffneModal('${platz.id}')">Bewerten</button></div>`;
    L.marker([platz.lat, platz.lng]).addTo(markerLayer).bindPopup(content);
  }

  const bounds = L.featureGroup(markerLayer.getLayers()).getBounds();
  if (nearby.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
  else alert("Keine Parkplätze in der Nähe gefunden.");
}

function entfernungInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

window.addEventListener('DOMContentLoaded', () => {
  // setLanguage(currentLang); // optional für mehrsprachigkeit
});
