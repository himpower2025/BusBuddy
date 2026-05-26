/// <reference types="vite/client" />
import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';

// --- Firebase Imports ---
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// --- Types ---
interface School {
  id: string;
  name: string;
  logo: string;
  routes: string[];
  driverName: string;
  code?: string;
}

interface Schools {
  [key: string]: School;
}

interface Bus {
  id: string;
  name: string;
  driverName: string;
  route: string;
  isLive: boolean;
  latitude: number;
  longitude: number;
  updatedAt?: any;
}

interface Message {
  id: string;
  sender: string;
  text: string;
  time: string;
  isBroadcast: boolean;
  createdAt?: any;
}

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * BusLogoSVG: 디테일과 귀여움이 살아있는 웃는 스쿨버스
 */
const BusLogoSVG = ({ size = 200 }: { size?: number }) => html`
  <svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" class="bus-emoticon-anim">
    <ellipse cx="256" cy="460" rx="80" ry="12" fill="rgba(0,0,0,0.12)" class="shadow-anim" />
    <g transform="translate(256, 290)">
      <!-- Wheels -->
      <g class="wheels-group">
        <rect x="-135" y="145" width="55" height="50" rx="20" fill="#263238" />
        <rect x="80" y="145" width="55" height="50" rx="20" fill="#263238" />
      </g>
      
      <!-- Body -->
      <rect x="-140" y="-180" width="280" height="340" rx="65" fill="#FFD600" stroke="#FBC02D" stroke-width="6" />
      
      <!-- Red Safety Lights (Top) -->
      <circle cx="-80" cy="-195" r="16" fill="#F44336" stroke="white" stroke-width="4" />
      <circle cx="80" cy="-195" r="16" fill="#F44336" stroke="white" stroke-width="4" />
      
      <!-- Side Mirrors -->
      <circle cx="-165" cy="-30" r="22" fill="#546E7A" stroke="white" stroke-width="3" />
      <circle cx="165" cy="-30" r="22" fill="#546E7A" stroke="white" stroke-width="3" />
      
      <!-- Windshield (Warm Beige Glass) -->
      <rect x="-115" y="-135" width="230" height="145" rx="35" fill="#FFF9E1" stroke="#F0E68C" stroke-width="5" />
      
      <!-- STOP Sign - Centered on windshield -->
      <g transform="translate(0, -35)" class="stop-sign-shake">
        <circle r="25" fill="#D32F2F" stroke="white" stroke-width="2" />
        <text y="5" font-family="Arial" font-size="10" font-weight="900" fill="white" text-anchor="middle">STOP</text>
      </g>

      <!-- Headlights/Eyes (Center Focus) -->
      <g>
        <circle cx="-90" cy="95" r="35" fill="white" stroke="#FFF9C4" stroke-width="5" />
        <circle cx="-90" cy="95" r="12" fill="#212121" />
        <circle cx="-90" cy="92" r="4" fill="white" />
        
        <circle cx="90" cy="95" r="35" fill="white" stroke="#FFF9C4" stroke-width="5" />
        <circle cx="90" cy="95" r="12" fill="#212121" />
        <circle cx="90" cy="92" r="4" fill="white" />
      </g>
      
      <!-- Smiling Grille -->
      <g transform="translate(-45, 85)">
        <path d="M 10 10 H 80 M 10 18 H 80 M 10 26 H 80" stroke="#455A64" stroke-width="4" stroke-linecap="round" opacity="0.6" />
      </g>
    </g>
  </svg>
`;

const getBusMarkerURI = (color = "#FFD600") => {
  const svg = `
    <svg width="60" height="60" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(256, 250) scale(0.8)">
        <rect x="-140" y="-180" width="280" height="340" rx="65" fill="${color}" stroke="#FBC02D" stroke-width="6" />
        <rect x="-115" y="-135" width="230" height="145" rx="35" fill="#FFF9E1" stroke="#F0E68C" stroke-width="5" />
        <circle cx="-90" cy="95" r="35" fill="white" />
        <circle cx="90" cy="95" r="35" fill="white" />
        <circle cx="-90" cy="95" r="12" fill="#212121" />
        <circle cx="90" cy="95" r="12" fill="#212121" />
      </g>
    </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const INITIAL_SCHOOLS: Schools = {
  'SEL999': { id: 'S4', name: 'Seoul Global School', logo: '🌏', routes: ['Gangnam Line', 'Hannam Shuttle', 'Mapo Express'], driverName: 'Kim Bus' },
  'PAE101': { id: 'S1', name: 'Palo Alto Elementary', logo: '🏫', routes: ['Route Gold', 'Route Silver'], driverName: 'John Doe' },
};

const INITIAL_MESSAGES: Message[] = [
  { id: '1', sender: 'Teacher / Driver 🧢', text: 'Good morning! Bus is departing on time.', time: '08:00 AM', isBroadcast: true },
  { id: '2', sender: 'Parent (Emily) 🏠', text: 'Emily will be at the stop 2 mins late.', time: '08:15 AM', isBroadcast: false },
];

function GoogleMap({ location, isLive, buses }: { location?: Location | null, isLive?: boolean, buses?: Bus[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    const checkGoogle = setInterval(() => {
      if ((window as any).google && (window as any).google.maps) {
        setMapLoaded(true);
        clearInterval(checkGoogle);
        if (mapRef.current && !mapInstance.current) {
          mapInstance.current = new (window as any).google.maps.Map(mapRef.current, {
            center: { lat: 37.5665, lng: 126.9780 },
            zoom: 15,
            styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }],
            disableDefaultUI: true,
          });
        }
      }
    }, 1000);
    return () => clearInterval(checkGoogle);
  }, []);

  // 1. Single bus tracking (Driver / Parent view)
  useEffect(() => {
    if (!buses && mapInstance.current && location) {
      const pos = { lat: location.latitude, lng: location.longitude };
      let singleMarker = markersRef.current['single'];
      
      if (!singleMarker) {
        singleMarker = new (window as any).google.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: "School Bus",
          icon: {
            url: getBusMarkerURI(),
            scaledSize: new (window as any).google.maps.Size(60, 60),
          }
        });
        markersRef.current['single'] = singleMarker;
      } else {
        singleMarker.setPosition(pos);
      }
      
      if (isLive) {
        mapInstance.current.panTo(pos);
      }
    }
  }, [location, buses, isLive]);

  // 2. Multi-bus tracking (Admin view)
  useEffect(() => {
    if (buses && mapInstance.current) {
      const currentIds = new Set(buses.map(b => b.id));
      
      // Clear offline or deleted markers
      Object.keys(markersRef.current).forEach(id => {
        if (!currentIds.has(id)) {
          markersRef.current[id].setMap(null);
          delete markersRef.current[id];
        }
      });

      // Update or add active markers
      let bounds = new (window as any).google.maps.LatLngBounds();
      let hasLiveBuses = false;

      buses.forEach(bus => {
        if (bus.isLive && bus.latitude && bus.longitude) {
          const pos = { lat: bus.latitude, lng: bus.longitude };
          bounds.extend(pos);
          hasLiveBuses = true;

          let marker = markersRef.current[bus.id];
          if (!marker) {
            marker = new (window as any).google.maps.Marker({
              position: pos,
              map: mapInstance.current,
              title: bus.name,
              label: {
                text: bus.name.substring(0, 12),
                color: "#1E293B",
                fontWeight: "900",
                fontSize: "12px",
              },
              icon: {
                url: getBusMarkerURI(bus.id.includes('2') ? '#10B981' : '#FFD600'),
                scaledSize: new (window as any).google.maps.Size(50, 50),
              }
            });
            markersRef.current[bus.id] = marker;
          } else {
            marker.setPosition(pos);
          }
        } else {
          // If a bus is offline, remove its marker
          if (markersRef.current[bus.id]) {
            markersRef.current[bus.id].setMap(null);
            delete markersRef.current[bus.id];
          }
        }
      });

      if (hasLiveBuses) {
        mapInstance.current.fitBounds(bounds);
        if (mapInstance.current.getZoom() > 16) {
          mapInstance.current.setZoom(15);
        }
      }
    }
  }, [buses]);

  if (!mapLoaded) {
    return html`
      <div class="map-placeholder">
        <div class="placeholder-content">
          <div class="pulse-icon">📍</div>
          <p>Connecting Satellite...</p>
        </div>
      </div>
    `;
  }
  return html`<div ref=${mapRef} class="map-view"></div>`;
}

function ChatView({ role, messages, onSendMessage }: { role: string, messages: Message[], onSendMessage: (t: string) => void }) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickMsgs = role === 'driver' 
    ? ['Traffic jam - 10m delay 🚦', 'Arrival in 5 mins! 🚌', 'Route changed 🚧']
    : (role === 'admin' 
      ? ['Weather Alert: Drive Safely 🌧️', 'Maintenance Notice 🛠️', 'Emergency Stop Alert 🚨']
      : ['My child is sick 🤒', 'Running late! 🏃', 'Thank you! 🙏']);

  return html`
    <div class="chat-container anim-fade-in">
      <div class="chat-messages">
        ${messages.map((msg: Message) => html`
          <div class="msg-bubble ${msg.isBroadcast ? 'broadcast' : ''} ${msg.sender.includes(role === 'driver' ? 'Driver' : (role === 'admin' ? 'Admin' : 'Parent')) ? 'mine' : 'theirs'}">
            <div class="msg-sender">${msg.isBroadcast ? '📢 ' + msg.sender : msg.sender}</div>
            <div class="msg-text">${msg.text}</div>
            <div class="msg-time">${msg.time}</div>
          </div>
        `)}
        <div ref=${chatEndRef}></div>
      </div>
      
      <div class="chat-controls">
        <div class="quick-tags">
          ${quickMsgs.map((m: string) => html`
            <button class="tag-btn" onClick=${() => onSendMessage(m)}>${m}</button>
          `)}
        </div>
        <div class="chat-input-area">
          <input type="text" placeholder="Type a message..." value=${input} onInput=${(e: any) => setInput(e.target.value)} onKeyPress=${(e: any) => { if(e.key === 'Enter' && input) { onSendMessage(input); setInput(''); } }} />
          <button class="send-btn" onClick=${() => { if(input) { onSendMessage(input); setInput(''); } }}>🚀</button>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [role, setRole] = useState<string | null>(null);
  const [schools, setSchools] = useState<Schools>(INITIAL_SCHOOLS);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [codeError, setCodeError] = useState('');
  
  // Multi-Bus states
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // UI states
  const [activeTab, setActiveTab] = useState('map');
  const [adminTab, setAdminTab] = useState('fleet'); // fleet, map, chat
  const [location, setLocation] = useState<Location | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [studentStatus, setStudentStatus] = useState('Wait');
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  
  // Admin fleet control variables
  const [newBusName, setNewBusName] = useState('');
  const [newBusDriver, setNewBusDriver] = useState('');
  const [newBusRoute, setNewBusRoute] = useState('');
  const [adminActiveBusId, setAdminActiveBusId] = useState<string>('');

  const simId = useRef<any>(null);

  // 1. Seed default buses if they don't exist
  const seedDefaultBuses = async (schoolCode: string) => {
    const defaultBuses: Record<string, Omit<Bus, 'id'>[]> = {
      'SEL999': [
        { name: 'Bus Gangnam (A)', driverName: 'Kim Bus', route: 'Gangnam Line', isLive: false, latitude: 37.5665, longitude: 126.9780 },
        { name: 'Bus Hannam (B)', driverName: 'Lee Bus', route: 'Hannam Shuttle', isLive: false, latitude: 37.5410, longitude: 127.0040 }
      ],
      'PAE101': [
        { name: 'Gold Shuttle', driverName: 'John Doe', route: 'Route Gold', isLive: false, latitude: 37.4419, longitude: -122.1430 },
        { name: 'Silver Express', driverName: 'Jane Smith', route: 'Route Silver', isLive: false, latitude: 37.4480, longitude: -122.1590 }
      ]
    };

    const list = defaultBuses[schoolCode];
    if (list) {
      for (let i = 0; i < list.length; i++) {
        const busId = `bus_${i + 1}`;
        const busRef = doc(db, 'schools', schoolCode, 'buses', busId);
        try {
          const snap = await getDoc(busRef);
          if (!snap.exists()) {
            await setDoc(busRef, list[i]);
          }
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, `schools/${schoolCode}/buses/${busId}`);
        }
      }
    }
  };

  // 2. Subscribe to Fleet Buses list under connected school
  useEffect(() => {
    if (!selectedSchool) return;

    const busesRef = collection(db, 'schools', selectedSchool.code!, 'buses');
    const unsub = onSnapshot(busesRef, (snap: any) => {
      const list: Bus[] = [];
      snap.forEach((docSnap: any) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Bus);
      });
      setBuses(list);
      
      // Auto-select first bus for admin communication if none selected
      if (list.length > 0 && !adminActiveBusId) {
        setAdminActiveBusId(list[0].id);
      }
    }, (err: any) => {
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}/buses`);
    });

    return () => unsub();
  }, [selectedSchool]);

  // 3. Subscribe to the currently selected bus's live telemetry (Driver / Parent view)
  useEffect(() => {
    if (!selectedSchool || !selectedBus || role === 'admin') return;

    const busRef = doc(db, 'schools', selectedSchool.code!, 'buses', selectedBus.id);
    const unsub = onSnapshot(busRef, (snap: any) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsLive(data.isLive || false);
        if (data.isLive && data.latitude && data.longitude) {
          setLocation({ latitude: data.latitude, longitude: data.longitude });
        } else {
          setLocation(null);
        }
      }
    }, (err: any) => {
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}/buses/${selectedBus.id}`);
    });

    return () => unsub();
  }, [selectedSchool, selectedBus, role]);

  // 4. Subscribe to Real-time Chat Messages for active channel
  useEffect(() => {
    if (!selectedSchool) return;

    let msgsRef;
    if (role === 'admin') {
      if (!adminActiveBusId) return;
      msgsRef = collection(db, 'schools', selectedSchool.code!, 'buses', adminActiveBusId, 'messages');
    } else {
      if (!selectedBus) return;
      msgsRef = collection(db, 'schools', selectedSchool.code!, 'buses', selectedBus.id, 'messages');
    }

    const unsub = onSnapshot(msgsRef, (snap: any) => {
      const list: Message[] = [];
      snap.forEach((docSnap: any) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          sender: data.sender,
          text: data.text,
          time: data.time,
          isBroadcast: data.isBroadcast || false,
          createdAt: data.createdAt
        } as any);
      });
      list.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || 0;
        const t2 = b.createdAt?.seconds || 0;
        return t1 - t2;
      });
      setMessages(list.length > 0 ? list : INITIAL_MESSAGES);
    }, (err: any) => {
      const path = role === 'admin' 
        ? `schools/${selectedSchool.code!}/buses/${adminActiveBusId}/messages`
        : `schools/${selectedSchool.code!}/buses/${selectedBus?.id}/messages`;
      handleFirestoreError(err, OperationType.GET, path);
    });

    return () => unsub();
  }, [selectedSchool, selectedBus, adminActiveBusId, role]);

  // 5. Subscribe to Student Boarding Status (Parent/Driver tracking)
  useEffect(() => {
    if (!selectedSchool || !selectedBus) return;

    const studentRef = doc(db, 'schools', selectedSchool.code!, 'students', `boarding_${selectedBus.id}`);
    const unsub = onSnapshot(studentRef, (snap: any) => {
      if (snap.exists()) {
        setStudentStatus(snap.data().status);
      } else {
        setStudentStatus('Wait');
      }
    }, (err: any) => {
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}/students/boarding_${selectedBus.id}`);
    });

    return () => unsub();
  }, [selectedSchool, selectedBus]);

  // Authentication/Connect verification
  const handleVerifyCode = async () => {
    const formattedCode = schoolCode.trim().toUpperCase();
    const ref = doc(db, 'schools', formattedCode);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const dbSchool = snap.data();
        await seedDefaultBuses(formattedCode); // Ensure default fleet loaded
        setSelectedSchool({
          id: formattedCode,
          name: dbSchool.name,
          logo: dbSchool.logo,
          routes: dbSchool.routes || [],
          driverName: dbSchool.driverName,
          code: formattedCode
        });
        setCodeError('');
      } else {
        const mockSchool = INITIAL_SCHOOLS[formattedCode];
        if (mockSchool) {
          await setDoc(ref, {
            name: mockSchool.name,
            logo: mockSchool.logo,
            routes: mockSchool.routes,
            driverName: mockSchool.driverName,
            isLive: false,
            latitude: 37.5665,
            longitude: 126.9780
          });
          await seedDefaultBuses(formattedCode); // Ensure default fleet loaded
          setSelectedSchool({ ...mockSchool, id: formattedCode, code: formattedCode });
          setCodeError('');
        } else {
          setCodeError('Invalid code. Try "SEL999" or "PAE101"');
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `schools/${formattedCode}`);
    }
  };

  // Sending a chat message
  const handleSendMessage = async (text: string) => {
    if (!selectedSchool) return;

    let msgsRef;
    let senderName = '';
    let isBroadcast = false;

    if (role === 'admin') {
      if (!adminActiveBusId) return;
      msgsRef = collection(db, 'schools', selectedSchool.code!, 'buses', adminActiveBusId, 'messages');
      senderName = 'School Admin 🏢';
      isBroadcast = true;
    } else {
      if (!selectedBus) return;
      msgsRef = collection(db, 'schools', selectedSchool.code!, 'buses', selectedBus.id, 'messages');
      senderName = role === 'driver' ? 'Teacher / Driver 🧢' : 'Parent (Emily) 🏠';
      isBroadcast = role === 'driver';
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      sender: senderName,
      text,
      time: timeStr,
      isBroadcast,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(msgsRef, payload);
    } catch (err) {
      const path = role === 'admin' 
        ? `schools/${selectedSchool.code!}/buses/${adminActiveBusId}/messages`
        : `schools/${selectedSchool.code!}/buses/${selectedBus?.id}/messages`;
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  // Driver GPS Tracking
  const startTracking = async () => {
    if (!selectedSchool || !selectedBus) return;
    setIsLive(true);
    let lat = selectedBus.latitude || 37.5665;
    let lng = selectedBus.longitude || 126.9780;

    const updateDB = async (lt: number, lg: number) => {
      try {
        await setDoc(doc(db, 'schools', selectedSchool.code!, 'buses', selectedBus.id), {
          name: selectedBus.name,
          driverName: selectedBus.driverName,
          route: selectedBus.route,
          isLive: true,
          latitude: lt,
          longitude: lg,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}/buses/${selectedBus.id}`);
      }
    };

    await updateDB(lat, lng);

    simId.current = setInterval(async () => {
      lat += 0.0001;
      lng += 0.0001;
      setLocation({ latitude: lat, longitude: lng });
      await updateDB(lat, lng);
    }, 2000);
  };

  const stopTracking = async () => {
    clearInterval(simId.current);
    setIsLive(false);
    setLocation(null);
    if (!selectedSchool || !selectedBus) return;
    try {
      await setDoc(doc(db, 'schools', selectedSchool.code!, 'buses', selectedBus.id), {
        name: selectedBus.name,
        driverName: selectedBus.driverName,
        route: selectedBus.route,
        isLive: false,
        latitude: selectedBus.latitude || 37.5665,
        longitude: selectedBus.longitude || 126.9780,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}/buses/${selectedBus.id}`);
    }
  };

  // Student Boarding status updates
  const updateStudentStatusInDB = async (status: string) => {
    if (!selectedSchool || !selectedBus) return;
    const studentRef = doc(db, 'schools', selectedSchool.code!, 'students', `boarding_${selectedBus.id}`);
    try {
      await setDoc(studentRef, {
        name: 'Emily Boarding',
        status: status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}/students/boarding_${selectedBus.id}`);
    }
  };

  // Fleet Management (Admin action: Add Bus)
  const handleAddBus = async (e: Event) => {
    e.preventDefault();
    if (!selectedSchool || !newBusName || !newBusDriver || !newBusRoute) return;

    const busId = `bus_${Date.now()}`;
    const busRef = doc(db, 'schools', selectedSchool.code!, 'buses', busId);

    try {
      await setDoc(busRef, {
        name: newBusName,
        driverName: newBusDriver,
        route: newBusRoute,
        isLive: false,
        latitude: 37.5665,
        longitude: 126.9780,
        updatedAt: serverTimestamp()
      });
      // Clear forms
      setNewBusName('');
      setNewBusDriver('');
      setNewBusRoute('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}/buses/${busId}`);
    }
  };

  // Fleet Management (Admin action: Delete Bus)
  const handleDeleteBus = async (busId: string) => {
    if (!selectedSchool || !confirm("Are you sure you want to delete this vehicle from the fleet?")) return;
    
    const busRef = doc(db, 'schools', selectedSchool.code!, 'buses', busId);
    try {
      await deleteDoc(busRef);
      if (adminActiveBusId === busId) {
        setAdminActiveBusId('');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schools/${selectedSchool.code!}/buses/${busId}`);
    }
  };

  const triggerSOS = () => {
    setSosActive(true);
    setTimeout(() => setSosActive(false), 5000);
  };

  // Render Splash (Role Selection)
  if (!role) {
    return html`
      <div class="app-viewport splash-bg anim-fade-in">
        <div class="splash-card">
          <div class="brand-container">
            <div class="logo-box-gradient">
              <${BusLogoSVG} size=${170} />
            </div>
            <h1 class="brand-title">BusBuddy <span class="brand-pro">PRO</span></h1>
            <p class="brand-subtitle">Smart School Transportation</p>
            <div class="company-badge">Developed by Himpower Pvt. Ltd.</div>
          </div>
          <div class="role-selection-area">
            <button class="role-btn driver" onClick=${() => setRole('driver')}>🧢 Teacher / Driver</button>
            <button class="role-btn parent" onClick=${() => setRole('parent')}>🏠 Parent</button>
            <button class="role-btn admin" onClick=${() => setRole('admin')}>🏢 School Admin</button>
          </div>
        </div>
      </div>
    `;
  }

  // Render Auth (Enter School Access Code)
  if (!selectedSchool) {
    const roleIcon = role === 'driver' ? '🧢' : (role === 'parent' ? '🏠' : '🏢');
    const roleName = role === 'driver' ? 'Driver' : (role === 'parent' ? 'Parent' : 'Admin');

    return html`
      <div class="app-viewport splash-bg anim-fade-in">
        <div class="auth-box">
          <button class="back-btn" onClick=${() => { setRole(null); setSchoolCode(''); setCodeError(''); }}>←</button>
          <div class="auth-icon">${roleIcon}</div>
          <h2 class="auth-title">${roleName} Login</h2>
          <p class="auth-desc">Enter your school access code.</p>
          <input 
            class="code-input"
            type="text" placeholder="------" maxlength="6"
            value=${schoolCode} onInput=${(e: any) => setSchoolCode(e.target.value.toUpperCase())}
          />
          <button class="action-btn" onClick=${handleVerifyCode}>Connect School</button>
          ${codeError && html`<p class="error-text">⚠️ ${codeError}</p>`}
        </div>
      </div>
    `;
  }

  // Render Multi-Bus Selection Screen for Driver / Parent
  if (role !== 'admin' && !selectedBus) {
    return html`
      <div class="app-viewport splash-bg anim-fade-in">
        <div class="auth-box" style="max-width: 480px; padding: 40px 25px;">
          <button class="back-btn" onClick=${() => { setSelectedSchool(null); setBuses([]); }}>←</button>
          <div class="auth-icon">🚌</div>
          <h2 class="auth-title" style="font-size: 1.6rem; margin-bottom: 5px;">Select Your Vehicle</h2>
          <p class="auth-desc" style="margin-bottom: 25px;">Select which bus you are tracking or driving.</p>
          
          <div style="display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; text-align: left; padding: 5px 2px;">
            ${buses.map(bus => html`
              <div class="tag-btn" 
                   style="display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-radius: 18px; border: 2px solid #E2E8F0; width: 100%; height: auto; white-space: normal; text-align: left;"
                   onClick=${() => { setSelectedBus(bus); setLocation(bus.isLive ? { latitude: bus.latitude, longitude: bus.longitude } : null); }}>
                <div>
                  <div style="font-weight: 900; color: #1E293B; font-size: 1.05rem;">${bus.name}</div>
                  <div style="font-size: 0.8rem; color: #64748B; margin-top: 3px; font-weight: 600;">📍 Route: ${bus.route}</div>
                  <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 500;">🧢 Driver: ${bus.driverName}</div>
                </div>
                <div>
                  <span class="status-dot ${bus.isLive ? 'online' : ''}" style="margin: 0; width: 12px; height: 12px;"></span>
                </div>
              </div>
            `)}
            ${buses.length === 0 && html`
              <p style="text-align: center; color: #94A3B8; font-weight: bold; padding: 20px;">No vehicles registered under this school.</p>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --- RENDER 1: SCHOOL ADMIN COMMAND CENTER ---
  if (role === 'admin') {
    return html`
      <div class="app-container main-app-bg anim-fade-in" style="height: 100vh;">
        <header class="tracker-header" style="padding: 15px 20px;">
          <div class="header-left">
             <div class="status-dot online"></div>
             <div class="header-info">
               <h3 class="header-title" style="font-size: 1.15rem;">Admin Command Center 🏢</h3>
               <small class="header-school">${selectedSchool.name}</small>
             </div>
          </div>
          <div class="header-right">
            <button class="info-icon-btn" onClick=${() => setShowCompanyInfo(true)}>ℹ️</button>
            <div class="eta-badge" style="background: #E2E8F0; color: #475569;">Fleet: <span>${buses.length}</span></div>
          </div>
        </header>

        <!-- Admin Navigation Tabs -->
        <div style="display: flex; background: white; border-bottom: 1px solid rgba(0,0,0,0.06); padding: 5px 15px;">
          <button style="flex: 1; border: none; background: none; padding: 15px; font-weight: 800; font-size: 0.9rem; cursor: pointer; color: ${adminTab === 'fleet' ? '#6366F1' : '#94A3B8'}; border-bottom: 3px solid ${adminTab === 'fleet' ? '#6366F1' : 'transparent'};" onClick=${() => setAdminTab('fleet')}>🚌 Fleet Fleet</button>
          <button style="flex: 1; border: none; background: none; padding: 15px; font-weight: 800; font-size: 0.9rem; cursor: pointer; color: ${adminTab === 'map' ? '#6366F1' : '#94A3B8'}; border-bottom: 3px solid ${adminTab === 'map' ? '#6366F1' : 'transparent'};" onClick=${() => setAdminTab('map')}>🗺️ Real-Time Map</button>
          <button style="flex: 1; border: none; background: none; padding: 15px; font-weight: 800; font-size: 0.9rem; cursor: pointer; color: ${adminTab === 'chat' ? '#6366F1' : '#94A3B8'}; border-bottom: 3px solid ${adminTab === 'chat' ? '#6366F1' : 'transparent'};" onClick=${() => setAdminTab('chat')}>💬 Fleet Dispatch</button>
        </div>

        <main style="flex: 1; overflow-y: ${adminTab === 'fleet' ? 'auto' : 'hidden'}; position: relative; display: flex; flex-direction: column;">
          
          <!-- TAB A: FLEET fleet & ADD BUS FORM -->
          ${adminTab === 'fleet' && html`
            <div style="padding: 20px; display: flex; flex-direction: column; gap: 20px;" class="anim-fade-in">
              <!-- Add Bus Card Form -->
              <div class="panel-card" style="border-radius: 24px; padding: 20px;">
                <h4 style="font-weight: 900; color: #1E293B; margin-bottom: 15px; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">➕ Add New Vehicle to Fleet</h4>
                <form onSubmit=${handleAddBus} style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                  <input type="text" placeholder="Vehicle Name (e.g. Bus C)" value=${newBusName} onInput=${(e: any) => setNewBusName(e.target.value)} required style="height: 48px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0 14px; font-weight: 600;" />
                  <input type="text" placeholder="Driver Name" value=${newBusDriver} onInput=${(e: any) => setNewBusDriver(e.target.value)} required style="height: 48px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0 14px; font-weight: 600;" />
                  <input type="text" placeholder="Assigned Route (e.g. Mapo Express)" value=${newBusRoute} onInput=${(e: any) => setNewBusRoute(e.target.value)} required style="grid-column: span 2; height: 48px; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0 14px; font-weight: 600;" />
                  <button type="submit" class="action-btn" style="grid-column: span 2; height: 48px; border-radius: 12px; font-size: 0.95rem; font-weight: 900; margin-top: 5px;">Register Vehicle</button>
                </form>
              </div>

              <!-- Registered Vehicles List -->
              <div style="display: flex; flex-direction: column; gap: 10px;">
                <h4 style="font-weight: 900; color: #475569; margin-left: 5px;">Active Fleet (${buses.length})</h4>
                ${buses.map(bus => html`
                  <div class="panel-card" style="border-radius: 20px; padding: 18px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(0,0,0,0.05); margin-bottom: 2px;">
                    <div style="text-align: left;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 900; color: #1E293B; font-size: 1.1rem;">${bus.name}</span>
                        <span class="status-tag ${bus.isLive ? 'Arrived' : 'Wait'}" style="font-size: 0.65rem; padding: 2px 6px;">${bus.isLive ? 'LIVE' : 'OFFLINE'}</span>
                      </div>
                      <div style="font-size: 0.85rem; color: #64748B; font-weight: bold; margin-top: 4px;">🗺️ Route: ${bus.route}</div>
                      <div style="font-size: 0.85rem; color: #94A3B8; font-weight: 600; margin-top: 2px;">🧢 Driver: ${bus.driverName}</div>
                    </div>
                    <button class="sos-btn" style="background: #FDA4AF; color: #E11D48; box-shadow: none; padding: 10px 14px; border-radius: 12px; font-weight: 900; font-size: 0.8rem;" onClick=${() => handleDeleteBus(bus.id)}>🗑️ Remove</button>
                  </div>
                `)}
                ${buses.length === 0 && html`
                  <div class="panel-card" style="border-radius: 20px; padding: 40px; text-align: center; color: #94A3B8; font-weight: bold;">
                    No registered vehicles. Use the form above to add a bus.
                  </div>
                `}
              </div>
            </div>
          `}

          <!-- TAB B: MULTI-BUS REAL-TIME MAP -->
          ${adminTab === 'map' && html`
            <div style="width: 100%; height: 100%; position: relative; flex: 1;">
              <${GoogleMap} buses=${buses} />
              <div class="control-overlay" style="bottom: 10px;">
                <div class="panel-card" style="border-radius: 20px; padding: 15px; text-align: center; background: rgba(255,255,255,0.92); backdrop-filter: blur(10px);">
                  <span style="font-weight: 900; color: #4338CA; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
                     🟢 Green & 🟡 Yellow markers represent active live school buses moving in real-time.
                  </span>
                </div>
              </div>
            </div>
          `}

          <!-- TAB C: FLEET DISPATCH REAL-TIME COMMUNICATIONS -->
          ${adminTab === 'chat' && html`
            <div style="display: flex; flex-direction: column; height: 100%; flex: 1;" class="anim-fade-in">
              <!-- Select target Bus channel -->
              <div style="background: white; padding: 12px 20px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 800; color: #475569; font-size: 0.9rem;">Dispatch to Channel:</label>
                <select value=${adminActiveBusId} onChange=${(e: any) => setAdminActiveBusId(e.target.value)} style="height: 38px; border: 2px solid #F1F5F9; border-radius: 10px; padding: 0 10px; font-weight: 800; color: #4338CA; outline: none; background: #F8FAFC;">
                  ${buses.map(bus => html`
                    <option value=${bus.id}>${bus.name} (${bus.route})</option>
                  `)}
                </select>
              </div>

              <!-- Messages Stream -->
              <div style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
                ${adminActiveBusId ? html`
                  <${ChatView} role="admin" messages=${messages} onSendMessage=${handleSendMessage} />
                ` : html`
                  <p style="text-align: center; color: #94A3B8; font-weight: bold; padding: 40px;">Please register a vehicle first to open communications.</p>
                `}
              </div>
            </div>
          `}

        </main>

        <nav class="main-tabs" style="padding-bottom: 25px;">
           <button onClick=${() => { setSelectedSchool(null); setRole(null); setBuses([]); }}><i>🔄</i>Exit Admin Control</button>
        </nav>

        <footer class="app-footer">
          <small>© 2026 Himpower Pvt. Ltd. All Rights Reserved.</small>
        </footer>

        ${showCompanyInfo && html`
          <div class="modal-overlay" onClick=${() => setShowCompanyInfo(false)}>
            <div class="modal-card anim-fade-in" onClick=${(e: any) => e.stopPropagation()}>
              <div class="modal-header">
                <h3>Company Information</h3>
                <button class="close-modal" onClick=${() => setShowCompanyInfo(false)}>✕</button>
              </div>
              <div class="modal-body">
                <div class="company-logo-small">H</div>
                <h4>Himpower Pvt. Ltd.</h4>
                <p class="company-desc">Official Developer of BusBuddy PRO</p>
                <hr />
                <div class="info-row">
                  <span class="label">Registration</span>
                  <span class="value">HPL-2026-0331</span>
                </div>
                <div class="info-row">
                  <span class="label">Contact</span>
                  <span class="value">contact@himpower.com</span>
                </div>
                <div class="info-row">
                  <span class="label">Website</span>
                  <span class="value">www.himpower.com</span>
                </div>
                <div class="info-row">
                  <span class="label">Status</span>
                  <span class="value verified">Verified Partner</span>
                </div>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
  }

  // --- RENDER 2: DRIVER / PARENT MAIN TRACKING PAGE ---
  return html`
    <div class="app-container main-app-bg anim-fade-in">
      <header class="tracker-header">
        <div class="header-left">
           <div class="status-dot ${isLive ? 'online' : ''}"></div>
           <div class="header-info">
             <h3 class="header-title" style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
               ${activeTab === 'chat' ? 'Comm. Channel' : selectedBus?.name}
             </h3>
             <small class="header-school">${selectedSchool.name}</small>
           </div>
        </div>
        <div class="header-right">
          <button class="info-icon-btn" onClick=${() => setShowCompanyInfo(true)}>ℹ️</button>
          ${role === 'driver' 
            ? html`<button class="sos-btn" onClick=${triggerSOS}>SOS</button>`
            : html`<div class="eta-badge">ETA: <span>${isLive ? '12 min' : '--'}</span></div>`
          }
        </div>
      </header>

      <main class="map-container">
        ${activeTab === 'map' ? html`
          <${GoogleMap} location=${location} isLive=${isLive} />
          
          <div class="control-overlay">
            <div class="panel-card anim-fade-in">
              ${role === 'driver' ? html`
                <div style="margin-bottom: 12px; text-align: left; font-size: 0.85rem; color: #64748B; font-weight: 700;">
                  Assigned Route: <span style="color: #4338CA; font-weight: 900;">${selectedBus?.route}</span>
                </div>
                <button class="main-cta ${isLive ? 'stop' : 'start'}" onClick=${isLive ? stopTracking : startTracking}>
                  ${isLive ? html`🛑 Stop Shift` : html`🚀 Start Shift`}
                </button>
              ` : html`
                <div class="student-info">
                   <div class="avatar">🧒</div>
                   <div class="student-meta">
                     <h4 class="student-name">Emily Boarding</h4>
                     <span class="status-tag ${studentStatus}">${studentStatus}</span>
                   </div>
                   <button class="update-btn" onClick=${() => {
                      const next = studentStatus === 'Wait' ? 'Boarded' : (studentStatus === 'Boarded' ? 'Arrived' : 'Wait');
                      updateStudentStatusInDB(next);
                   }}>Update Status</button>
                </div>
              `}
            </div>
          </div>
        ` : html`
          <${ChatView} role=${role} messages=${messages} onSendMessage=${handleSendMessage} />
        `}
      </main>

      <nav class="main-tabs" style="padding-bottom: 25px;">
         <button class=${activeTab === 'map' ? 'active' : ''} onClick=${() => setActiveTab('map')}><i>📍</i>Map</button>
         <button class=${activeTab === 'chat' ? 'active' : ''} onClick=${() => setActiveTab('chat')}><i>💬</i>Chat</button>
         <button onClick=${() => { setSelectedBus(null); setMessages([]); }}><i>🔄</i>Switch Bus</button>
      </nav>
      
      <footer class="app-footer">
        <small>© 2026 Himpower Pvt. Ltd. All Rights Reserved.</small>
      </footer>
      
      ${sosActive && html`<div class="sos-fullscreen">⚠️ EMERGENCY SIGNAL SENT</div>`}
      
      ${showCompanyInfo && html`
        <div class="modal-overlay" onClick=${() => setShowCompanyInfo(false)}>
          <div class="modal-card anim-fade-in" onClick=${(e: any) => e.stopPropagation()}>
            <div class="modal-header">
              <h3>Company Information</h3>
              <button class="close-modal" onClick=${() => setShowCompanyInfo(false)}>✕</button>
            </div>
            <div class="modal-body">
              <div class="company-logo-small">H</div>
              <h4>Himpower Pvt. Ltd.</h4>
              <p class="company-desc">Official Developer of BusBuddy PRO</p>
              <hr />
              <div class="info-row">
                <span class="label">Registration</span>
                <span class="value">HPL-2026-0331</span>
              </div>
              <div class="info-row">
                <span class="label">Contact</span>
                <span class="value">contact@himpower.com</span>
              </div>
              <div class="info-row">
                <span class="label">Website</span>
                <span class="value">www.himpower.com</span>
              </div>
              <div class="info-row">
                <span class="label">Status</span>
                <span class="value verified">Verified Partner</span>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
