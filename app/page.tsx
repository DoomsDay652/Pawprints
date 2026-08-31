'use client';

import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker, StyleSpecification } from 'maplibre-gl';
import { FormEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';

type Coordinates = [number, number];
type PetType = 'Dogs' | 'Cats' | 'Birds' | 'Rabbits' | 'Reptiles' | 'Other';
type Certainty = 'sure' | 'maybe' | 'unsure';
type Profile = { name: string; email: string; phone?: string };
type ProfilePet = { id: number; name: string; type: PetType; breed: string; description: string; photo?: string };
type MissingPet = { id: number; name: string; type: PetType; breed?: string; description: string; photo?: string; coordinates: Coordinates; missingSince: string; ownerName: string; ownerPhone?: string; ownerEmail?: string; lastSeenPlace: string; contactNote: string };
type Sighting = { id: number; petId: number; coordinates: Coordinates; capturedAt: string; certainty: Certainty; direction: string; hasMedia: boolean; note?: string; reporter?: string; upvotes?: number; downvotes?: number };
type ChatMessage = { id: number; petId: number; author: string; body: string; sentAt: string };
type ThemeMode = 'system' | 'light' | 'dark';
type AppSettings = { theme: ThemeMode; showServices: boolean; followLocation: boolean; largeControls: boolean };

const SALEM_CENTER: Coordinates = [-80.85564, 40.8995];
const DROP_RADIUS_METERS = 200;
const MOCK_PETS: MissingPet[] = [
  { id: 101, name: 'Buddy', type: 'Dogs', breed: 'Beagle', description: 'Tri-color beagle with a blue collar. Friendly, but may back away if approached quickly.', coordinates: [-80.84092, 40.89811], missingSince: '2026-08-30T08:15:00-04:00', ownerName: 'Melissa R.', ownerPhone: '330-555-0147', ownerEmail: 'melissa@example.test', lastSeenPlace: 'Centennial Park near the Pershing Street entrance', contactNote: 'Text or use the private profile relay' },
  { id: 102, name: 'Luna', type: 'Cats', breed: 'Domestic Shorthair', description: 'Small black-and-white tuxedo cat with a clipped left ear. Shy and likely hiding.', coordinates: [-80.8495, 40.9006], missingSince: '2026-08-29T19:40:00-04:00', ownerName: 'James T.', ownerPhone: '330-555-0182', ownerEmail: 'james@example.test', lastSeenPlace: 'Near Salem Public Library, 821 E. State Street', contactNote: 'Text relay preferred' },
  { id: 103, name: 'Sunny', type: 'Birds', breed: 'Cockatiel', description: 'Yellow and gray cockatiel. Responds to whistling and the phrase “pretty bird.”', coordinates: [-80.8542, 40.9022], missingSince: '2026-08-30T10:05:00-04:00', ownerName: 'Priya K.', ownerPhone: '330-555-0119', ownerEmail: 'priya@example.test', lastSeenPlace: 'North Broadway Avenue near downtown Salem', contactNote: 'Call if safely contained' },
];
const MOCK_SIGHTINGS: Sighting[] = [
  { id: 501, petId: 101, coordinates: [-80.8582, 40.89945], capturedAt: '2026-08-31T09:12:00-04:00', certainty: 'sure', direction: 'E', hasMedia: true, note: 'Blue collar visible near the corner.', reporter: 'Avery', upvotes: 8, downvotes: 1 },
  { id: 502, petId: 101, coordinates: [-80.8559, 40.8995], capturedAt: '2026-08-31T09:19:00-04:00', certainty: 'maybe', direction: 'N', hasMedia: false, note: 'Crossed the road and turned north.', reporter: 'Jordan', upvotes: 5, downvotes: 1 },
];
const MOCK_CHAT: ChatMessage[] = [
  { id: 701, petId: 101, author: 'Melissa R. · Owner', body: 'Buddy may respond to a squeaky toy. Please do not chase him.', sentAt: '2026-08-31T09:05:00-04:00' },
  { id: 702, petId: 101, author: 'Avery', body: 'I saw a beagle heading east near downtown. Blue collar looked right.', sentAt: '2026-08-31T09:14:00-04:00' },
];
const PUBLIC_SERVICES = [
  { id: 'police', name: 'Salem Police Department', kind: 'Police · non-emergency', phone: '330-337-7811', address: '231 S. Broadway Avenue, Salem, OH 44460', coordinates: SALEM_CENTER as Coordinates, icon: '★' },
  { id: 'wildlife', name: 'Ohio Division of Wildlife · District 3', kind: 'Northeast Ohio wildlife assistance', phone: '330-644-2293', address: '912 Portage Lakes Drive, Akron, OH 44319', coordinates: [-81.54889, 41.00083] as Coordinates, icon: '◆' },
];
const BREEDS = ['Beagle', 'Border Collie', 'Boxer', 'Chihuahua', 'German Shepherd', 'Golden Retriever', 'Labrador Retriever', 'Pit Bull–type', 'Poodle', 'Domestic Shorthair', 'Domestic Longhair', 'Maine Coon', 'Siamese', 'Cockatiel', 'Parakeet', 'Mixed / Unknown'];
const DEFAULT_SETTINGS: AppSettings = { theme: 'system', showServices: true, followLocation: true, largeControls: false };
const categories: { type: PetType; icon: string }[] = [
  { type: 'Dogs', icon: '🐕' }, { type: 'Cats', icon: '🐈' }, { type: 'Birds', icon: '🦜' },
  { type: 'Rabbits', icon: '🐇' }, { type: 'Reptiles', icon: '🦎' }, { type: 'Other', icon: '🐾' },
];
const directions = [
  ['N', '↑', 'North'], ['NE', '↗', 'Northeast'], ['E', '→', 'East'], ['SE', '↘', 'Southeast'], ['S', '↓', 'South'], ['SW', '↙', 'Southwest'], ['W', '←', 'West'], ['NW', '↖', 'Northwest'], ['?', '•', 'Not sure'],
];
const mapStyle: StyleSpecification = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

const dateTimeText = (iso: string) => new Intl.DateTimeFormat([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
const accuracyPolygon = (coordinates: Coordinates, meters: number): GeoJSON.Feature<GeoJSON.Polygon> => {
  const [lng, lat] = coordinates;
  const latRadius = meters / 111320;
  const lngRadius = meters / (111320 * Math.max(.2, Math.cos(lat * Math.PI / 180)));
  const ring: Coordinates[] = Array.from({ length: 49 }, (_, index) => {
    const angle = (index / 48) * Math.PI * 2;
    return [lng + Math.cos(angle) * lngRadius, lat + Math.sin(angle) * latRadius];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
};

const distanceMeters = (from: Coordinates, to: Coordinates) => {
  const radius = 6371000;
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  const deltaLat = (to[1] - from[1]) * Math.PI / 180;
  const deltaLng = (to[0] - from[0]) * Math.PI / 180;
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const directionDegrees: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const directionFromDrag = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (distance < 24) return '?';
  const bearing = (Math.atan2(end.x - start.x, start.y - end.y) * 180 / Math.PI + 360) % 360;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
};
const projectDirection = (coordinates: Coordinates, direction: string, meters = 65): Coordinates => {
  const bearing = directionDegrees[direction];
  if (bearing === undefined) return coordinates;
  const radians = bearing * Math.PI / 180;
  return [coordinates[0] + Math.sin(radians) * meters / (111320 * Math.max(.2, Math.cos(coordinates[1] * Math.PI / 180))), coordinates[1] + Math.cos(radians) * meters / 111320];
};
const midpoint = (from: Coordinates, to: Coordinates): Coordinates => [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
const smoothPath = (points: Coordinates[]) => {
  let result = points;
  for (let pass = 0; pass < 2 && result.length > 2; pass += 1) {
    const next: Coordinates[] = [result[0]];
    for (let index = 0; index < result.length - 1; index += 1) {
      const a = result[index]; const b = result[index + 1];
      next.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    next.push(result[result.length - 1]); result = next;
  }
  return result;
};
const fileToDataUrl = (file: File) => new Promise<string>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.readAsDataURL(file); });

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRefs = useRef<MapLibreMarker[]>([]);
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const testLocationRef = useRef<Coordinates>(SALEM_CENTER);
  const dataReadyRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profilePets, setProfilePets] = useState<ProfilePet[]>([]);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [addProfilePetOpen, setAddProfilePetOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [selectedSightingId, setSelectedSightingId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createPetOpen, setCreatePetOpen] = useState(false);
  const [pets, setPets] = useState<MissingPet[]>([]);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeCategory, setActiveCategory] = useState<PetType | 'All'>('All');
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [locationConsentOpen, setLocationConsentOpen] = useState(false);
  const [locationConsent, setLocationConsent] = useState<'unknown' | 'granted' | 'declined'>('unknown');
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState<1 | 2 | 3 | 4>(1);
  const [reportLocation, setReportLocation] = useState<Coordinates | null>(null);
  const [reportTime, setReportTime] = useState('');
  const [reportMedia, setReportMedia] = useState('');
  const [reportCertainty, setReportCertainty] = useState<Certainty>('maybe');
  const [reportDirection, setReportDirection] = useState('?');
  const [reportNote, setReportNote] = useState('');
  const [directionMode, setDirectionMode] = useState(false);
  const [directionGesture, setDirectionGesture] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);
  const [toast, setToast] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [pinMenu, setPinMenu] = useState<{ coordinates: Coordinates; x: number; y: number; distance: number; withinRange: boolean } | null>(null);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const filteredPets = useMemo(() => activeCategory === 'All' ? pets : pets.filter((pet) => pet.type === activeCategory), [activeCategory, pets]);
  const activeSightings = sightings.filter((sighting) => sighting.petId === selectedPetId);
  const selectedSighting = sightings.find((sighting) => sighting.id === selectedSightingId) ?? null;
  const selectedChat = chatMessages.filter((message) => message.petId === selectedPetId);

  useEffect(() => {
    try {
      const storedProfile = localStorage.getItem('pawtrace-profile');
      const storedPets = localStorage.getItem('pawtrace-pets');
      const storedSightings = localStorage.getItem('pawtrace-sightings');
      const storedProfilePets = localStorage.getItem('pawprints-profile-pets');
      const storedChat = localStorage.getItem('pawprints-chat');
      const storedSettings = localStorage.getItem('pawprints-settings');
      const mockVersion = localStorage.getItem('pawtrace-salem-mocks');
      if (storedProfile) setProfile(JSON.parse(storedProfile)); else setOnboardingOpen(true);
      if (mockVersion !== 'v1') {
        setPets(MOCK_PETS);
        setSightings([]);
        localStorage.setItem('pawtrace-salem-mocks', 'v1');
      } else {
        if (storedPets) setPets(JSON.parse(storedPets));
        if (storedSightings) setSightings(JSON.parse(storedSightings));
      }
      if (storedProfilePets) setProfilePets(JSON.parse(storedProfilePets));
      if (storedChat) setChatMessages(JSON.parse(storedChat)); else setChatMessages(MOCK_CHAT);
      if (storedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
      if (localStorage.getItem('pawprints-demo-trail') !== 'v1') {
        if (!storedSightings || JSON.parse(storedSightings).length === 0) setSightings(MOCK_SIGHTINGS);
        localStorage.setItem('pawprints-demo-trail', 'v1');
      }
    } catch { setOnboardingOpen(true); }
    dataReadyRef.current = true;
  }, []);

  useEffect(() => { if (dataReadyRef.current) localStorage.setItem('pawtrace-pets', JSON.stringify(pets)); }, [pets]);
  useEffect(() => { if (dataReadyRef.current) localStorage.setItem('pawtrace-sightings', JSON.stringify(sightings)); }, [sightings]);
  useEffect(() => { if (dataReadyRef.current) localStorage.setItem('pawprints-profile-pets', JSON.stringify(profilePets)); }, [profilePets]);
  useEffect(() => { if (dataReadyRef.current) localStorage.setItem('pawprints-chat', JSON.stringify(chatMessages)); }, [chatMessages]);
  useEffect(() => {
    localStorage.setItem('pawprints-settings', JSON.stringify(settings));
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => { document.documentElement.dataset.theme = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme; document.documentElement.dataset.largeControls = String(settings.largeControls); };
    applyTheme(); media.addEventListener('change', applyTheme); return () => media.removeEventListener('change', applyTheme);
  }, [settings]);

  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').then((registration) => registration.update()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    let active = true;
    import('maplibre-gl').then((maplibre) => {
      if (!active || !mapContainer.current) return;
      const map = new maplibre.Map({ container: mapContainer.current, style: mapStyle, center: SALEM_CENTER, zoom: 14.2, attributionControl: {} });
      map.addControl(new maplibre.NavigationControl({ showCompass: true }), 'top-right');
      map.on('load', () => {
        map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'trail-shadow', type: 'line', source: 'trail', paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': .82 } });
        map.addLayer({ id: 'trail-line', type: 'line', source: 'trail', paint: { 'line-color': '#e66c50', 'line-width': 4 } });
        map.addSource('user-accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'user-accuracy-fill', type: 'fill', source: 'user-accuracy', paint: { 'fill-color': '#2678d8', 'fill-opacity': .12 } });
        map.addLayer({ id: 'user-accuracy-line', type: 'line', source: 'user-accuracy', paint: { 'line-color': '#2678d8', 'line-width': 1.5, 'line-opacity': .5 } });
        map.addSource('drop-radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'drop-radius-fill', type: 'fill', source: 'drop-radius', paint: { 'fill-color': '#1d6b54', 'fill-opacity': .07 } });
        map.addLayer({ id: 'drop-radius-line', type: 'line', source: 'drop-radius', paint: { 'line-color': '#1d6b54', 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': .78 } });
        setMapReady(true);
      });
      mapRef.current = map;
    });
    return () => { active = false; stopLocationWatch(); markerRefs.current.forEach((marker) => marker.remove()); userMarkerRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const choice = sessionStorage.getItem('pawtrace-location-consent');
    if (choice === 'granted') startLocationWatch();
    else if (choice === 'declined') setLocationConsent('declined');
    else setLocationConsentOpen(true);
  }, [mapReady]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) stopLocationWatch();
      else if (locationConsent === 'granted' && !testMode) startLocationWatch();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [locationConsent, testMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('trail') as GeoJSONSource | undefined;
    const orderedSightings = [...activeSightings].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
    const routePoints = orderedSightings.map((sighting) => sighting.coordinates);
    if (orderedSightings.length) {
      const last = orderedSightings[orderedSightings.length - 1];
      if (directionDegrees[last.direction] !== undefined) routePoints.push(projectDirection(last.coordinates, last.direction));
    }
    source?.setData(routePoints.length > 1
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: smoothPath(routePoints) } }
      : { type: 'FeatureCollection', features: [] });
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];
    import('maplibre-gl').then((maplibre) => {
      filteredPets.forEach((pet) => {
        const element = document.createElement('button');
        element.className = `pet-alert-marker ${selectedPetId === pet.id ? 'selected' : ''}`;
        element.textContent = categories.find((item) => item.type === pet.type)?.icon ?? '🐾';
        element.setAttribute('aria-label', `Missing ${pet.type.slice(0, -1).toLowerCase()} ${pet.name}`);
        element.addEventListener('click', (event) => { event.stopPropagation(); setSelectedPetId(pet.id); setMenuOpen(false); setPinMenu(null); });
        markerRefs.current.push(new maplibre.Marker({ element }).setLngLat(pet.coordinates).addTo(map));
      });
      orderedSightings.forEach((sighting, index) => {
        const element = document.createElement('button');
        element.className = `sighting-marker ${sighting.certainty}`;
        element.textContent = String(index + 1);
        element.setAttribute('aria-label', `Sighting ${index + 1}, ${dateTimeText(sighting.capturedAt)}`);
        element.addEventListener('click', (event) => { event.stopPropagation(); setPinMenu(null); setSelectedSightingId(sighting.id); });
        markerRefs.current.push(new maplibre.Marker({ element }).setLngLat(sighting.coordinates).addTo(map));
        if (directionDegrees[sighting.direction] !== undefined) {
          const arrow = document.createElement('div');
          arrow.className = 'trail-arrow';
          arrow.innerHTML = '<span>➤</span>';
          arrow.style.setProperty('--bearing', `${directionDegrees[sighting.direction]}deg`);
          const nextPoint = orderedSightings[index + 1]?.coordinates ?? projectDirection(sighting.coordinates, sighting.direction);
          markerRefs.current.push(new maplibre.Marker({ element: arrow }).setLngLat(midpoint(sighting.coordinates, nextPoint)).addTo(map));
        }
      });
      if (settings.showServices) PUBLIC_SERVICES.forEach((service) => {
        const element = document.createElement('button');
        element.className = `service-marker ${service.id}`;
        element.textContent = service.icon;
        element.setAttribute('aria-label', service.name);
        element.addEventListener('click', (event) => { event.stopPropagation(); setPinMenu(null); setHelpOpen(true); });
        markerRefs.current.push(new maplibre.Marker({ element }).setLngLat(service.coordinates).addTo(map));
      });
    });
  }, [mapReady, filteredPets, selectedPetId, sightings, settings.showServices]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const handleMapPress = (event: { lngLat: { lng: number; lat: number }; point: { x: number; y: number } }) => {
      if (!userLocation) { showToast('Turn on location or Salem test mode first'); return; }
      const coordinates: Coordinates = [event.lngLat.lng, event.lngLat.lat];
      const distance = distanceMeters(userLocation, coordinates);
      const withinRange = distance <= DROP_RADIUS_METERS;
      if (!withinRange && !testMode) {
        setPinMenu(null);
        showToast(`That point is ${Math.round(distance)} m away — sightings must be within ${DROP_RADIUS_METERS} m`);
        return;
      }
      setPinMenu({ coordinates, x: event.point.x, y: event.point.y, distance, withinRange });
    };
    map.on('click', handleMapPress);
    return () => { map.off('click', handleMapPress); };
  }, [mapReady, userLocation, testMode]);

  function stopLocationWatch() {
    if (watchIdRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
  }

  function startLocationWatch() {
    if (!navigator.geolocation) { setLocationConsent('declined'); return; }
    setTestMode(false);
    setPinMenu(null);
    stopLocationWatch();
    setLocationConsentOpen(false);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coordinates: Coordinates = [position.coords.longitude, position.coords.latitude];
        const accuracy = Math.max(1, position.coords.accuracy);
        setLocationConsent('granted');
        setUserLocation(coordinates);
        setLocationAccuracy(accuracy);
        sessionStorage.setItem('pawtrace-location-consent', 'granted');
        updatePrivateLocation(coordinates, accuracy);
      },
      () => { setLocationConsent('declined'); sessionStorage.setItem('pawtrace-location-consent', 'declined'); showToast('Location permission was not enabled'); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  function updatePrivateLocation(coordinates: Coordinates, accuracy: number, duration = 800) {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('user-accuracy') as GeoJSONSource | undefined)?.setData(accuracyPolygon(coordinates, accuracy));
    (map.getSource('drop-radius') as GeoJSONSource | undefined)?.setData(accuracyPolygon(coordinates, DROP_RADIUS_METERS));
    import('maplibre-gl').then((maplibre) => {
      userMarkerRef.current?.remove();
      const element = document.createElement('div');
      element.className = 'private-user-marker';
      element.innerHTML = '<span></span>';
      userMarkerRef.current = new maplibre.Marker({ element }).setLngLat(coordinates).addTo(map);
    });
    if (settings.followLocation) map.flyTo({ center: coordinates, zoom: 15.8, duration });
  }

  function moveTestHere() {
    if (!testMode || !pinMenu) return;
    const next = pinMenu.coordinates;
    testLocationRef.current = next;
    setUserLocation(next);
    setLocationAccuracy(5);
    setPinMenu(null);
    updatePrivateLocation(next, 5);
    showToast('Test location moved here');
  }

  function toggleTestMode() {
    if (testMode) {
      setTestMode(false);
      setPinMenu(null);
      if (locationConsent === 'granted') startLocationWatch();
      else {
        setUserLocation(null); setLocationAccuracy(null); userMarkerRef.current?.remove(); userMarkerRef.current = null;
        (mapRef.current?.getSource('user-accuracy') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
        (mapRef.current?.getSource('drop-radius') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
      }
      showToast('Salem test location turned off');
      return;
    }
    stopLocationWatch();
    setTestMode(true);
    testLocationRef.current = SALEM_CENTER;
    setUserLocation(SALEM_CENTER);
    setLocationAccuracy(5);
    updatePrivateLocation(SALEM_CENTER, 5);
    showToast('Test location set at Salem City Hall');
  }

  function showToast(message: string) { setToast(message); window.setTimeout(() => setToast(''), 2600); }

  function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextProfile = { name: String(data.get('name')), email: String(data.get('email')), phone: String(data.get('phone') || '') };
    setProfile(nextProfile); localStorage.setItem('pawtrace-profile', JSON.stringify(nextProfile)); setOnboardingOpen(false);
  }

  async function createMissingPet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const center = mapRef.current?.getCenter();
    const coordinates = userLocation ?? (center ? [center.lng, center.lat] as Coordinates : SALEM_CENTER);
    const photoFile = data.get('photo');
    const photo = photoFile instanceof File && photoFile.size ? await fileToDataUrl(photoFile) : undefined;
    const pet: MissingPet = { id: Date.now(), name: String(data.get('name')), type: String(data.get('type')) as PetType, breed: String(data.get('breed') || ''), description: String(data.get('description') || ''), photo, coordinates, missingSince: new Date().toISOString(), ownerName: profile?.name || 'Local owner', ownerPhone: profile?.phone, ownerEmail: profile?.email, lastSeenPlace: 'Current map location', contactNote: 'Use owner profile contact' };
    setPets((items) => [...items, pet]); setSelectedPetId(pet.id); setCreatePetOpen(false); setProfileOpen(false); mapRef.current?.flyTo({ center: coordinates, zoom: 15.5 });
  }

  async function addProfilePet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const photoFile = data.get('photo');
    const photo = photoFile instanceof File && photoFile.size ? await fileToDataUrl(photoFile) : undefined;
    const pet: ProfilePet = { id: Date.now(), name: String(data.get('name')), type: String(data.get('type')) as PetType, breed: String(data.get('breed') || 'Mixed / Unknown'), description: String(data.get('description') || ''), photo };
    setProfilePets((items) => [...items, pet]); setAddProfilePetOpen(false); setProfileOpen(true); showToast(`${pet.name} added to your profile`);
  }

  function markProfilePetMissing(profilePet: ProfilePet) {
    const center = mapRef.current?.getCenter();
    const coordinates = userLocation ?? (center ? [center.lng, center.lat] as Coordinates : SALEM_CENTER);
    const missing: MissingPet = { ...profilePet, coordinates, missingSince: new Date().toISOString(), ownerName: profile?.name || 'Local owner', ownerPhone: profile?.phone, ownerEmail: profile?.email, lastSeenPlace: 'Current private map location', contactNote: 'Use owner profile contact' };
    setPets((items) => [...items, missing]); setSelectedPetId(missing.id); setProfileOpen(false); mapRef.current?.flyTo({ center: coordinates, zoom: 15.5 }); showToast(`${missing.name} is now on the search map`);
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPetId) return;
    const form = event.currentTarget;
    const data = new FormData(form); const body = String(data.get('message') || '').trim();
    if (!body) return;
    setChatMessages((items) => [...items, { id: Date.now(), petId: selectedPetId, author: profile?.name || 'Guest helper', body, sentAt: new Date().toISOString() }]);
    form.reset();
  }

  function voteSighting(value: 'up' | 'down') {
    if (!selectedSighting) return;
    setSightings((items) => items.map((sighting) => sighting.id === selectedSighting.id ? { ...sighting, upvotes: (sighting.upvotes ?? 0) + (value === 'up' ? 1 : 0), downvotes: (sighting.downvotes ?? 0) + (value === 'down' ? 1 : 0) } : sighting));
  }

  function deleteAccount() {
    stopLocationWatch();
    ['pawtrace-profile', 'pawtrace-pets', 'pawtrace-sightings', 'pawtrace-salem-mocks', 'pawprints-profile-pets', 'pawprints-chat', 'pawprints-demo-trail', 'pawprints-settings'].forEach((key) => localStorage.removeItem(key));
    sessionStorage.removeItem('pawtrace-location-consent');
    setProfile(null); setProfilePets([]); setPets(MOCK_PETS); setSightings(MOCK_SIGHTINGS); setChatMessages(MOCK_CHAT); setSettings(DEFAULT_SETTINGS); setSelectedPetId(null); setUserLocation(null); setLocationAccuracy(null);
    userMarkerRef.current?.remove(); userMarkerRef.current = null;
    (mapRef.current?.getSource('user-accuracy') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    (mapRef.current?.getSource('drop-radius') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    setDeleteConfirmOpen(false); setSettingsOpen(false); setProfileOpen(false); setOnboardingOpen(true); showToast('Account and local app data deleted');
  }

  function beginReport() {
    if (!selectedPet) { showToast('Choose a missing pet first'); setMenuOpen(true); return; }
    setReportTime(new Date().toISOString()); setReportLocation(userLocation); setReportMedia(''); setReportCertainty('maybe'); setReportDirection('?'); setReportNote(''); setReportStep(1); setReportOpen(true);
    if (!userLocation && locationConsent !== 'granted') startLocationWatch();
  }

  function beginPinnedReport(withCamera: boolean) {
    if (!pinMenu) return;
    if (!selectedPet) { setPinMenu(null); setMenuOpen(true); showToast('Choose which missing pet you saw'); return; }
    setReportTime(new Date().toISOString());
    setReportLocation(pinMenu.coordinates);
    setReportMedia('');
    setReportCertainty('maybe');
    setReportDirection('?');
    setReportNote('');
    setReportStep(withCamera ? 1 : 2);
    setPinMenu(null);
    setReportOpen(true);
  }

  function beginDirectionCapture(certainty: Certainty) {
    setReportCertainty(certainty);
    setReportDirection('?');
    setDirectionGesture(null);
    setReportOpen(false);
    setDirectionMode(true);
  }

  function saveSighting(basic = false, directionOverride?: string) {
    if (!selectedPet || !reportLocation) return;
    const direction = basic ? '?' : directionOverride ?? reportDirection;
    setSightings((items) => [...items, { id: Date.now(), petId: selectedPet.id, coordinates: reportLocation, capturedAt: reportTime, certainty: basic ? 'maybe' : reportCertainty, direction, hasMedia: basic ? false : Boolean(reportMedia), note: reportNote, reporter: profile?.name || 'Community helper', upvotes: 0, downvotes: 0 }]);
    setReportStep(4);
  }

  function directionPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function finishDirectionCapture(end: { x: number; y: number }) {
    if (!directionGesture) return;
    const direction = directionFromDrag(directionGesture.start, end);
    const label = direction === '?' ? 'direction unsure' : `heading ${directions.find(([value]) => value === direction)?.[2]}`;
    saveSighting(false, direction);
    setReportDirection(direction);
    setDirectionMode(false);
    setDirectionGesture(null);
    showToast(`Sighting saved · ${label}`);
  }

  useEffect(() => { if (reportOpen && userLocation && !reportLocation) setReportLocation(userLocation); }, [reportOpen, userLocation, reportLocation]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#"><span>P</span>PawPrints</a>
        <nav>
          <button className="header-button area-button" onClick={() => setMenuOpen(true)}>⌖ <span>Missing pets near me</span><b>{pets.length}</b></button>
          <button className="settings-button" onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙ <span>Settings</span></button>
          <button className="profile-button" onClick={() => setProfileOpen(true)}><i>{profile?.name?.slice(0, 1).toUpperCase() || '?'}</i><span>Profile</span></button>
        </nav>
      </header>

      <section className="app-body">
        <aside className={`pet-menu ${menuOpen ? 'open' : ''}`}>
          <div className="menu-title"><div><p className="eyebrow">Community search</p><h1>Missing pets</h1></div><button onClick={() => setMenuOpen(false)} aria-label="Close menu">×</button></div>
          <button className={`category-row ${activeCategory === 'All' ? 'active' : ''}`} onClick={() => setActiveCategory('All')}><span>⌖</span><strong>All nearby</strong><em>{pets.length}</em></button>
          {categories.map((item) => <button key={item.type} className={`category-row ${activeCategory === item.type ? 'active' : ''}`} onClick={() => setActiveCategory(item.type)}><span>{item.icon}</span><strong>{item.type}</strong><em>{pets.filter((pet) => pet.type === item.type).length}</em></button>)}
          <div className="case-list">
            <p>{activeCategory === 'All' ? 'All active alerts' : activeCategory}</p>
            {filteredPets.length === 0 ? <div className="empty-list">No missing pets listed yet.</div> : filteredPets.map((pet) => <button key={pet.id} className={selectedPetId === pet.id ? 'selected' : ''} onClick={() => { setSelectedPetId(pet.id); setMenuOpen(false); setPinMenu(null); mapRef.current?.flyTo({ center: pet.coordinates, zoom: 15.5 }); }}><span>{categories.find((item) => item.type === pet.type)?.icon}</span><div><strong>{pet.name}</strong><small>{pet.type.slice(0, -1)} · Owner {pet.ownerName}</small><em>{pet.lastSeenPlace}</em></div></button>)}
          </div>
          <button className="add-alert" onClick={() => setCreatePetOpen(true)}>＋ Create missing-pet alert</button>
        </aside>

        <section className="map-panel">
          <div ref={mapContainer} className="real-map" />
          <button className="private-location" onClick={startLocationWatch}><span>⌖</span><div><strong>{locationConsent === 'granted' ? 'Location private' : 'Use my location'}</strong><small>{locationConsent === 'granted' ? `Accuracy ±${Math.round(locationAccuracy ?? 0)} m` : 'Permission required'}</small></div></button>
          <button className={`test-mode-button ${testMode ? 'active' : ''}`} onClick={toggleTestMode}><span>◎</span><div><strong>{testMode ? 'Salem test mode on' : 'Test without moving'}</strong><small>{testMode ? 'Location: Salem City Hall' : 'Places you in downtown Salem'}</small></div></button>
          {userLocation && <div className="radius-label">Sightings can be placed within {DROP_RADIUS_METERS} m</div>}
          {pets.length === 0 && <div className="empty-map"><span>🐾</span><h2>Your map is ready</h2><p>No missing-pet alerts are loaded. Create your first alert to begin testing.</p><button onClick={() => setCreatePetOpen(true)}>Create first alert</button></div>}
          {selectedPet && <article className="selected-pet-card">{selectedPet.photo ? <img src={selectedPet.photo} alt={selectedPet.name}/> : <span>{categories.find((item) => item.type === selectedPet.type)?.icon}</span>}<div className="pet-card-main"><p className="eyebrow">Selected search</p><strong>{selectedPet.name}</strong><small>{selectedPet.breed || selectedPet.type.slice(0, -1)} · Owner {selectedPet.ownerName} · {activeSightings.length} sightings</small></div><button onClick={beginReport}>Report sighting</button><p>{selectedPet.description}</p><div className="pet-card-actions"><button onClick={() => setOwnerOpen(true)}>Owner</button><button onClick={() => setChatOpen(true)}>Chat <b>{selectedChat.length}</b></button><button onClick={() => setHelpOpen(true)}>Local help</button></div><dl><div><dt>Last seen</dt><dd>{selectedPet.lastSeenPlace}</dd></div><div><dt>Trail</dt><dd>{activeSightings.length ? `${activeSightings.length} community reports` : 'No sightings yet'}</dd></div></dl></article>}
          {pinMenu && <><button className="pin-menu-dismiss" onClick={() => setPinMenu(null)} aria-label="Close quick menu"/><div className="pin-radial" style={{ left: pinMenu.x, top: pinMenu.y }}><span className="pin-center">●</span>{pinMenu.withinRange && <button className="pin-action sighted" onClick={() => beginPinnedReport(false)}><b>✓</b><small>Sighted</small></button>}{pinMenu.withinRange && <button className="pin-action camera" onClick={() => beginPinnedReport(true)}><b>▣</b><small>Camera</small></button>}<button className="pin-action owner" onClick={() => { setPinMenu(null); selectedPet ? setOwnerOpen(true) : showToast('Choose a missing pet first'); }}><b>♙</b><small>Owner</small></button><button className="pin-action help" onClick={() => { setPinMenu(null); setHelpOpen(true); }}><b>☎</b><small>Help</small></button>{testMode && <button className={`pin-action move ${pinMenu.withinRange ? '' : 'solo'}`} onClick={moveTestHere}><b>⌖</b><small>Move here</small></button>}<em>{pinMenu.withinRange ? `${Math.round(pinMenu.distance)} m away` : 'Move test location here'}</em></div></>}
          <button className="floating-report" onClick={beginReport}>● Report a sighting</button>
          <div className="privacy-strip">Live location is visible only to you · tracking pauses in the background</div>
          {directionMode && <div
            className="direction-capture"
            role="application"
            aria-label="Slide a finger in the direction the animal was traveling. Tap once if unsure."
            onPointerDown={(event) => {
              const point = directionPoint(event);
              event.currentTarget.setPointerCapture(event.pointerId);
              setDirectionGesture({ start: point, current: point });
            }}
            onPointerMove={(event) => {
              if (!directionGesture || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
              setDirectionGesture((current) => current ? { ...current, current: directionPoint(event) } : current);
            }}
            onPointerUp={(event) => finishDirectionCapture(directionPoint(event))}
            onPointerCancel={() => setDirectionGesture(null)}
          >
            <div className="direction-capture-head"><p>Final step · {selectedPet?.name}</p><strong>Which way were they going?</strong><small>Touch the map, slide in that direction, and release. Tap once if you’re not sure.</small></div>
            {!directionGesture && <div className="direction-dial" aria-hidden="true"><b className="dial-n">N</b><b className="dial-ne">NE</b><b className="dial-e">E</b><b className="dial-se">SE</b><b className="dial-s">S</b><b className="dial-sw">SW</b><b className="dial-w">W</b><b className="dial-nw">NW</b><span>Touch<br/>and slide</span></div>}
            {directionGesture && <>
              <div className="gesture-origin" style={{ left: directionGesture.start.x, top: directionGesture.start.y }}/>
              <div className="gesture-arrow" style={{ left: directionGesture.start.x, top: directionGesture.start.y, width: Math.hypot(directionGesture.current.x - directionGesture.start.x, directionGesture.current.y - directionGesture.start.y), transform: `rotate(${Math.atan2(directionGesture.current.y - directionGesture.start.y, directionGesture.current.x - directionGesture.start.x)}rad)` }}><span>➤</span></div>
              <div className="direction-live-label">{directionFromDrag(directionGesture.start, directionGesture.current) === '?' ? 'Tap = not sure' : directions.find(([value]) => value === directionFromDrag(directionGesture.start, directionGesture.current))?.[2]}</div>
            </>}
            <button className="direction-cancel" onPointerDown={(event) => event.stopPropagation()} onClick={() => { setDirectionMode(false); setDirectionGesture(null); setReportOpen(true); setReportStep(2); }}>Cancel</button>
          </div>}
        </section>
      </section>

      {onboardingOpen && <div className="modal-layer onboarding-layer"><section className="onboarding"><div className="onboarding-mark">P</div><p className="eyebrow">Welcome to PawPrints</p><h2>Create your testing profile</h2><p>Your profile and pets are saved only on this device in the prototype.</p><form onSubmit={createAccount}><label><span>Name</span><input name="name" autoComplete="name" required placeholder="Your name" /></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label><label><span>Phone (optional)</span><input name="phone" type="tel" autoComplete="tel" placeholder="330-555-0123" /></label><button className="primary-action" type="submit">Create account</button></form><button className="text-button" onClick={() => setOnboardingOpen(false)}>Explore first</button></section></div>}

      {locationConsentOpen && !onboardingOpen && <div className="modal-layer"><section className="consent-modal"><div className="location-icon">⌖</div><p className="eyebrow">Private by default</p><h2>Use your location?</h2><p>PawPrints refines your position only while the app is visible. Your live location stays on this device.</p><div><span>✓ Other people cannot see where you are</span><span>✓ Updates stop when the app is in the background</span><span>✓ Only submitted sightings share a location</span></div><button className="primary-action" onClick={startLocationWatch}>Allow while using app</button><button className="text-button" onClick={() => { setLocationConsentOpen(false); setLocationConsent('declined'); sessionStorage.setItem('pawtrace-location-consent', 'declined'); }}>Not now</button></section></div>}

      {profileOpen && <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="profile-modal upgraded-profile"><button className="modal-close" onClick={() => setProfileOpen(false)}>×</button><div className="profile-head"><div className="big-avatar">{profile?.name?.slice(0, 1).toUpperCase() || '?'}</div><div><p className="eyebrow">Your PawPrints profile</p><h2>{profile?.name || 'Guest tester'}</h2><p>{profile?.email || 'No account created'}{profile?.phone ? ` · ${profile.phone}` : ''}</p></div><button className="profile-settings-link" onClick={() => { setProfileOpen(false); setSettingsOpen(true); }}>⚙ Settings</button></div><div className="karma-card"><span>👍</span><div><strong>Community standing</strong><small>New helper · 0 reviewed reports</small></div><b>Neutral</b></div><div className="profile-pets-title"><div><strong>Your pets</strong><small>Add details once, then place a missing alert quickly.</small></div><button onClick={() => { setProfileOpen(false); setAddProfilePetOpen(true); }}>＋ Add pet</button></div><div className="profile-pets">{profilePets.length ? profilePets.map((pet) => <article key={pet.id}>{pet.photo ? <img src={pet.photo} alt={pet.name}/> : <span>{categories.find((item) => item.type === pet.type)?.icon}</span>}<div><strong>{pet.name}</strong><small>{pet.breed} · {pet.type.slice(0, -1)}</small><p>{pet.description || 'No description yet.'}</p></div><button onClick={() => markProfilePetMissing(pet)}>Mark missing</button></article>) : <p className="profile-empty">No pets added yet.</p>}</div><dl><div><dt>Missing-pet alerts</dt><dd>{pets.filter((pet) => pet.ownerEmail === profile?.email).length}</dd></div><div><dt>Location</dt><dd>{locationConsent === 'granted' ? `Private · ±${Math.round(locationAccuracy ?? 0)} m` : 'Off'}</dd></div></dl><button className="primary-action" onClick={() => setCreatePetOpen(true)}>Create a custom missing-pet alert</button>{!profile && <button className="secondary-action" onClick={() => { setProfileOpen(false); setOnboardingOpen(true); }}>Create account</button>}</section></div>}

      {createPetOpen && <div className="modal-layer"><section className="form-modal"><button className="modal-close" onClick={() => setCreatePetOpen(false)}>×</button><p className="eyebrow">New search</p><h2>Create missing-pet alert</h2><p>The current private map location becomes the last-seen point.</p><form onSubmit={createMissingPet}><label><span>Pet’s name</span><input name="name" required placeholder="Name" /></label><label><span>Animal type</span><select name="type" defaultValue="Dogs">{categories.map((item) => <option key={item.type}>{item.type}</option>)}</select></label><label><span>Breed</span><input name="breed" list="alert-breeds" placeholder="Type or choose a breed"/><datalist id="alert-breeds">{BREEDS.map((breed) => <option key={breed} value={breed}/>)}</datalist></label><label><span>Description</span><textarea name="description" rows={3} placeholder="Color, collar, temperament…" /></label><label className="file-button"><input name="photo" type="file" accept="image/*" capture="environment" />Add a pet photo</label><button className="primary-action" type="submit">Start search</button></form></section></div>}

      {addProfilePetOpen && <div className="modal-layer"><section className="form-modal"><button className="modal-close" onClick={() => setAddProfilePetOpen(false)}>×</button><p className="eyebrow">Your pet profile</p><h2>Add a pet</h2><p>This information stays on this device until you create a missing-pet alert.</p><form onSubmit={addProfilePet}><label><span>Pet’s name</span><input name="name" required placeholder="Name" /></label><label><span>Animal type</span><select name="type" defaultValue="Dogs">{categories.map((item) => <option key={item.type}>{item.type}</option>)}</select></label><label><span>Breed</span><input name="breed" list="profile-breeds" required placeholder="Type or choose a breed"/><datalist id="profile-breeds">{BREEDS.map((breed) => <option key={breed} value={breed}/>)}</datalist></label><label><span>Brief description</span><textarea name="description" rows={3} placeholder="Color, markings, collar, temperament…" /></label><label className="file-button"><input name="photo" type="file" accept="image/*" capture="environment" />Add a pet photo</label><button className="primary-action" type="submit">Save pet</button></form></section></div>}

      {settingsOpen && <div className="modal-layer"><section className="settings-modal"><button className="modal-close" onClick={() => setSettingsOpen(false)}>×</button><p className="eyebrow">Profile settings</p><h2>Settings</h2><div className="settings-group"><strong>Appearance</strong><div className="theme-picker">{(['system', 'light', 'dark'] as ThemeMode[]).map((mode) => <button key={mode} className={settings.theme === mode ? 'active' : ''} onClick={() => setSettings((current) => ({ ...current, theme: mode }))}>{mode === 'system' ? '◐ System' : mode === 'light' ? '☀ Light' : '☾ Dark'}</button>)}</div></div><div className="settings-group"><strong>Map and accessibility</strong><label className="setting-toggle"><div><b>Show public-service markers</b><small>Display police and regional wildlife contacts on the map.</small></div><input type="checkbox" checked={settings.showServices} onChange={(event) => setSettings((current) => ({ ...current, showServices: event.target.checked }))}/></label><label className="setting-toggle"><div><b>Follow my location</b><small>Keep the map centered when GPS or test location changes.</small></div><input type="checkbox" checked={settings.followLocation} onChange={(event) => setSettings((current) => ({ ...current, followLocation: event.target.checked }))}/></label><label className="setting-toggle"><div><b>Larger quick-menu buttons</b><small>Increase map action targets for easier one-handed use.</small></div><input type="checkbox" checked={settings.largeControls} onChange={(event) => setSettings((current) => ({ ...current, largeControls: event.target.checked }))}/></label></div><div className="settings-group app-update-card"><strong>App updates</strong><p>PawPrints checks for the newest web version whenever it opens. Your profile and pet information stay on this device during normal app updates.</p><small>Mobile prototype version 0.2.0</small></div>{profile && <button className="danger-button" onClick={() => { setSettingsOpen(false); setDeleteConfirmOpen(true); }}>Delete my account</button>}</section></div>}

      {deleteConfirmOpen && <div className="modal-layer"><section className="delete-modal"><div className="danger-icon">!</div><p className="eyebrow">Permanent on this device</p><h2>Delete your account?</h2><p>This removes your profile, saved pets, local alerts, sightings, chat messages, and settings from this device. It cannot be undone.</p><button className="danger-confirm" onClick={deleteAccount}>Delete account and local data</button><button className="text-button" onClick={() => { setDeleteConfirmOpen(false); setSettingsOpen(true); }}>Cancel</button></section></div>}

      {ownerOpen && selectedPet && <div className="modal-layer"><section className="contact-modal"><button className="modal-close" onClick={() => setOwnerOpen(false)}>×</button><p className="eyebrow">Owner contact</p><h2>{selectedPet.ownerName}</h2><div className="owner-pet-summary">{selectedPet.photo ? <img src={selectedPet.photo} alt={selectedPet.name}/> : <span>{categories.find((item) => item.type === selectedPet.type)?.icon}</span>}<div><strong>{selectedPet.name}</strong><small>{selectedPet.breed || selectedPet.type.slice(0, -1)}</small></div></div><p>{selectedPet.contactNote}</p>{selectedPet.ownerPhone && <a className="contact-call" href={`tel:${selectedPet.ownerPhone}`}>☎ Call {selectedPet.ownerPhone}</a>}{selectedPet.ownerEmail && <a className="contact-message" href={`mailto:${selectedPet.ownerEmail}`}>Message owner profile</a>}<small className="prototype-note">Mock owner details are for prototype testing.</small></section></div>}

      {helpOpen && <div className="modal-layer"><section className="help-modal"><button className="modal-close" onClick={() => setHelpOpen(false)}>×</button><p className="eyebrow">Salem-area help</p><h2>Public contacts</h2><p>Use 911 only for an immediate emergency. These buttons call the listed non-emergency or regional office numbers.</p><div className="service-list">{PUBLIC_SERVICES.map((service) => <article key={service.id}><span>{service.icon}</span><div><strong>{service.name}</strong><small>{service.kind}</small><p>{service.address}</p></div><div><a href={`tel:${service.phone}`}>Call<br/>{service.phone}</a><button onClick={() => { setHelpOpen(false); mapRef.current?.flyTo({ center: service.coordinates, zoom: 15 }); }}>Map</button></div></article>)}</div></section></div>}

      {chatOpen && selectedPet && <div className="modal-layer"><section className="chat-modal"><button className="modal-close" onClick={() => setChatOpen(false)}>×</button><p className="eyebrow">Localized search chat</p><h2>{selectedPet.name} search team</h2><p>Share useful details. Do not post a helper’s live location or private information.</p><div className="chat-feed">{selectedChat.length ? selectedChat.map((message) => <article key={message.id}><div><strong>{message.author}</strong><time>{dateTimeText(message.sentAt)}</time></div><p>{message.body}</p></article>) : <div className="empty-list">No messages yet.</div>}</div><form onSubmit={sendChat}><input name="message" required maxLength={240} placeholder="Add a useful search detail…"/><button type="submit">Send</button></form><small className="prototype-note">Prototype chat is stored only in this browser.</small></section></div>}

      {selectedSighting && <div className="modal-layer"><section className="sighting-modal"><button className="modal-close" onClick={() => setSelectedSightingId(null)}>×</button><div className="sighting-title"><span>{activeSightings.findIndex((item) => item.id === selectedSighting.id) + 1}</span><div><p className="eyebrow">Sighting details</p><h2>{dateTimeText(selectedSighting.capturedAt)}</h2></div></div><div className="sighting-facts"><div><small>Reporter</small><strong>{selectedSighting.reporter || 'Community helper'}</strong></div><div><small>Confidence</small><strong>{selectedSighting.certainty}</strong></div><div><small>Heading</small><strong>{selectedSighting.direction === '?' ? 'Not sure' : directions.find(([value]) => value === selectedSighting.direction)?.[2]}</strong></div><div><small>Media</small><strong>{selectedSighting.hasMedia ? 'Attached' : 'None'}</strong></div></div><p className="sighting-note">{selectedSighting.note || 'No extra details were added.'}</p><div className="reputation-box"><div><strong>Does this report line up?</strong><small>Community feedback helps rank reliable sightings.</small></div><button onClick={() => voteSighting('up')}>👍 {selectedSighting.upvotes ?? 0}</button><button onClick={() => voteSighting('down')}>👎 {selectedSighting.downvotes ?? 0}</button></div></section></div>}

      {reportOpen && <div className="sheet-layer"><section className="report-sheet"><div className="sheet-handle"/><button className="modal-close" onClick={() => setReportOpen(false)}>×</button><div className="capture-status"><span>{reportLocation ? '✓' : '⌖'}</span><div><strong>{reportLocation ? `Location ready · ±${Math.round(locationAccuracy ?? 0)} m` : 'Refining location…'}</strong><small>{reportTime && `${dateTimeText(reportTime)} · automatic`}</small></div></div>
        {reportStep === 1 && <div className="report-step"><p className="eyebrow">1 of 2 · {selectedPet?.name}</p><h2>Add photo or video?</h2><label className="camera-choice"><input type="file" accept="image/*,video/*" capture="environment" onChange={(event) => { setReportMedia(event.target.files?.[0]?.name || 'capture'); setReportStep(2); }}/><span>▣</span><strong>Take photo or short video</strong></label><button className="large-choice" onClick={() => setReportStep(2)}>No photo — continue</button></div>}
        {reportStep === 2 && <div className="report-step"><p className="eyebrow">2 of 2 · {selectedPet?.name}</p><h2>How sure are you?</h2><p className="direction-help">Choose once. The map will open for one quick direction swipe.</p><div className="certainty-grid"><button onClick={() => beginDirectionCapture('sure')}>✓<strong>Sure</strong></button><button onClick={() => beginDirectionCapture('maybe')}>≈<strong>Maybe</strong></button><button onClick={() => beginDirectionCapture('unsure')}>?<strong>Unsure</strong></button></div></div>}
        {reportStep === 4 && <div className="success"><span>✓</span><h2>Sighting saved</h2><p>The automatic location and timestamp were added to {selectedPet?.name}’s trail.</p><button className="primary-action" onClick={() => setReportOpen(false)}>View map</button></div>}
        {reportStep < 4 && <button className="text-button basic-save" disabled={!reportLocation} onClick={() => saveSighting(true)}>Save basic sighting now</button>}
      </section></div>}
      {menuOpen && <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close missing-pets menu" />}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
