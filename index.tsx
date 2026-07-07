
import { render } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { html } from 'htm/preact';

// --- Firebase Imports ---
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

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
  throw new Error(JSON.stringify(errInfo));
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

interface Message {
  id: number;
  sender: string;
  text: string;
  time: string;
  isBroadcast: boolean;
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

const getBusMarkerURI = () => {
  const svg = `
    <svg width="60" height="60" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(256, 250) scale(0.8)">
        <rect x="-140" y="-180" width="280" height="340" rx="65" fill="#FFD600" stroke="#FBC02D" stroke-width="6" />
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
  { id: 1, sender: 'Teacher', text: 'Good morning! Bus is departing on time.', time: '08:00 AM', isBroadcast: true },
  { id: 2, sender: 'Parent (Emily)', text: 'Emily will be at the stop 2 mins late.', time: '08:15 AM', isBroadcast: false },
];

function GoogleMap({ location, isLive }: { location: Location | null, isLive: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapInstance = useRef<any>(null);
  const busMarker = useRef<any>(null);

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

  useEffect(() => {
    if (mapInstance.current && location) {
      const pos = { lat: location.latitude, lng: location.longitude };
      if (!busMarker.current) {
        busMarker.current = new (window as any).google.maps.Marker({
          position: pos,
          map: mapInstance.current,
          title: "School Bus",
          icon: {
            url: getBusMarkerURI(),
            scaledSize: new (window as any).google.maps.Size(60, 60),
          }
        });
      } else {
        busMarker.current.setPosition(pos);
      }
      mapInstance.current.panTo(pos);
    }
  }, [location]);

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

function ChatView({ role, messages, onSendMessage }: { role: string, messages: Message[], onSendMessage: (t: string, q: boolean) => void }) {
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const quickMsgs = role === 'driver' 
    ? ['Traffic jam - 10m delay 🚦', 'Arrival in 5 mins! 🚌', 'Route changed 🚧']
    : ['My child is sick 🤒', 'Running late! 🏃', 'Thank you! 🙏'];

  return html`
    <div class="chat-container anim-fade-in">
      <div class="chat-messages">
        ${messages.map((msg: Message) => html`
          <div class="msg-bubble ${msg.isBroadcast ? 'broadcast' : ''} ${msg.sender.includes(role === 'driver' ? 'Teacher' : 'Parent') ? 'mine' : 'theirs'}">
            <div class="msg-sender">${msg.isBroadcast ? '📢 Announcement' : msg.sender}</div>
            <div class="msg-text">${msg.text}</div>
            <div class="msg-time">${msg.time}</div>
          </div>
        `)}
        <div ref=${chatEndRef}></div>
      </div>
      
      <div class="chat-controls">
        <div class="quick-tags">
          ${quickMsgs.map((m: string) => html`
            <button class="tag-btn" onClick=${() => onSendMessage(m, true)}>${m}</button>
          `)}
        </div>
        <div class="chat-input-area">
          <input type="text" placeholder="Type a message..." value=${input} onInput=${(e: any) => setInput(e.target.value)} onKeyPress=${(e: any) => { if(e.key === 'Enter' && input) { onSendMessage(input, false); setInput(''); } }} />
          <button class="send-btn" onClick=${() => { if(input) { onSendMessage(input, false); setInput(''); } }}>🚀</button>
        </div>
      </div>
    </div>
  `;
}

function App() {
  const [role, setRole] = useState<string | null>(null);
  const [schools, setSchools] = useState<Schools>(INITIAL_SCHOOLS);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolCode, setSchoolCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [route, setRoute] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('map');
  const [location, setLocation] = useState<Location | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [studentStatus, setStudentStatus] = useState('Wait');
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const simId = useRef<any>(null);

  // 1. Subscribe to Live Location / School status
  useEffect(() => {
    if (!selectedSchool) return;

    const ref = doc(db, 'schools', selectedSchool.code!);
    const unsub = onSnapshot(ref, (snap: any) => {
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
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}`);
    });

    return () => unsub();
  }, [selectedSchool]);

  // 2. Subscribe to Real-time Chat Messages
  useEffect(() => {
    if (!selectedSchool) return;

    const msgsRef = collection(db, 'schools', selectedSchool.code!, 'messages');
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
      // Safely sort client-side by createdAt timestamp
      list.sort((a: any, b: any) => {
        const t1 = a.createdAt?.seconds || 0;
        const t2 = b.createdAt?.seconds || 0;
        return t1 - t2;
      });
      setMessages(list.length > 0 ? list : INITIAL_MESSAGES);
    }, (err: any) => {
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}/messages`);
    });

    return () => unsub();
  }, [selectedSchool]);

  // 3. Subscribe to Student Boarding Status
  useEffect(() => {
    if (!selectedSchool) return;

    const studentRef = doc(db, 'schools', selectedSchool.code!, 'students', 'emily');
    const unsub = onSnapshot(studentRef, (snap: any) => {
      if (snap.exists()) {
        setStudentStatus(snap.data().status);
      } else {
        setStudentStatus('Wait');
      }
    }, (err: any) => {
      handleFirestoreError(err, OperationType.GET, `schools/${selectedSchool.code!}/students/emily`);
    });

    return () => unsub();
  }, [selectedSchool]);

  const handleVerifyCode = async () => {
    const formattedCode = schoolCode.trim().toUpperCase();
    const ref = doc(db, 'schools', formattedCode);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const dbSchool = snap.data();
        setSelectedSchool({
          id: formattedCode,
          name: dbSchool.name,
          logo: dbSchool.logo,
          routes: dbSchool.routes,
          driverName: dbSchool.driverName,
          code: formattedCode
        });
        setCodeError('');
      } else {
        // Automatically seed the database project if the sample code matches standard mock sets
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

  const handleSendMessage = async (text: string) => {
    if (!selectedSchool) return;
    const msgsRef = collection(db, 'schools', selectedSchool.code!, 'messages');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = {
      sender: role === 'driver' ? 'Teacher' : 'Parent (Emily)',
      text,
      time: timeStr,
      isBroadcast: role === 'driver',
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(msgsRef, payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `schools/${selectedSchool.code!}/messages`);
    }
  };

  const startTracking = async () => {
    setIsLive(true);
    let lat = 37.5665;
    let lng = 126.9780;

    const updateDB = async (lt: number, lg: number) => {
      if (!selectedSchool) return;
      try {
        await setDoc(doc(db, 'schools', selectedSchool.code!), {
          name: selectedSchool.name,
          logo: selectedSchool.logo,
          routes: selectedSchool.routes,
          driverName: selectedSchool.driverName,
          isLive: true,
          latitude: lt,
          longitude: lg
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}`);
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
    if (!selectedSchool) return;
    try {
      await setDoc(doc(db, 'schools', selectedSchool.code!), {
        name: selectedSchool.name,
        logo: selectedSchool.logo,
        routes: selectedSchool.routes,
        driverName: selectedSchool.driverName,
        isLive: false,
        latitude: 37.5665,
        longitude: 126.9780
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}`);
    }
  };

  const updateStudentStatusInDB = async (status: string) => {
    if (!selectedSchool) return;
    const studentRef = doc(db, 'schools', selectedSchool.code!, 'students', 'emily');
    try {
      await setDoc(studentRef, {
        name: 'Emily Boarding',
        status: status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `schools/${selectedSchool.code!}/students/emily`);
    }
  };

  const triggerSOS = () => {
    setSosActive(true);
    setTimeout(() => setSosActive(false), 5000);
  };

  const renderTermsModal = () => html`
    <div class="modal-overlay" onClick=${() => setShowTermsModal(false)}>
      <div class="policy-modal-card anim-fade-in" onClick=${(e: any) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Terms of Service</h3>
          <button class="close-modal" onClick=${() => setShowTermsModal(false)}>✕</button>
        </div>
        <div class="policy-body">
          <div class="policy-text-container">
            <h4>1. Agreement to Terms</h4>
            <p>By accessing BusBuddy PRO (operated by Himpower Pvt. Ltd.), you agree to be bound by these Terms of Service. If you do not agree, you must not use the application.</p>
            
            <h4>2. School Code Verification</h4>
            <p>Access requires a valid school code issued by your institution. Sharing code access with unauthorized third parties is strictly prohibited.</p>
            
            <h4>3. Driver Location Sharing</h4>
            <p>Drivers explicitly consent to broadcast their real-time location while active on-shift to authorized parents and school administrators. Location tracking terminates immediately when the shift is stopped.</p>
            
            <h4>4. Disclaimer of Liability</h4>
            <p>The service is provided "as-is". Estimated arrival times and bus tracking can be affected by weather and network conditions. Himpower Pvt. Ltd. is not responsible for transit delays.</p>
          </div>
          <div class="policy-footer-actions">
            <a href="/terms.html" target="_blank" class="policy-link-btn">
              <span>View Full Document</span> 🌐
            </a>
            <button class="policy-close-btn" onClick=${() => setShowTermsModal(false)}>Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const renderPrivacyPolicyModal = () => html`
    <div class="modal-overlay" onClick=${() => setShowPrivacyModal(false)}>
      <div class="policy-modal-card anim-fade-in" onClick=${(e: any) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>Privacy Policy</h3>
          <button class="close-modal" onClick=${() => setShowPrivacyModal(false)}>✕</button>
        </div>
        <div class="policy-body">
          <div class="policy-text-container">
            <h4>1. Scope and Owner</h4>
            <p>This policy details how Himpower Pvt. Ltd. handles your data inside BusBuddy PRO. We are dedicated to maintaining the confidentiality of your personal records.</p>
            
            <h4>2. On-Shift Location Data</h4>
            <p>We transmit precise geographical coordinates of school buses during active shifts. Location tracking only applies to active driver roles and stops when off-shift.</p>
            
            <h4>3. Communication and Safety</h4>
            <p>Text chat exchanges and safety status indicators are stored securely on Firebase Firestore, readable only by parents, teachers, and admins within your school circle.</p>
            
            <h4>4. Third-Party Sharing</h4>
            <p>We do NOT sell, rent, or lease your private data. Information is only shared within your verified school system and with critical platform partners like Google Maps.</p>
          </div>
          <div class="policy-footer-actions">
            <a href="/privacy.html" target="_blank" class="policy-link-btn">
              <span>View Full Document</span> 🌐
            </a>
            <button class="policy-close-btn" onClick=${() => setShowPrivacyModal(false)}>Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

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
          
          <div style="margin-top: 35px; display: flex; justify-content: center; gap: 12px; font-size: 0.8rem; font-weight: 700;">
            <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowTermsModal(true); }} style="color: #6366F1; text-decoration: none; transition: 0.2s;">Terms of Service</a>
            <span style="color: #CBD5E1;">•</span>
            <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowPrivacyModal(true); }} style="color: #6366F1; text-decoration: none; transition: 0.2s;">Privacy Policy</a>
          </div>
        </div>
        ${showTermsModal && renderTermsModal()}
        ${showPrivacyModal && renderPrivacyPolicyModal()}
      </div>
    `;
  }

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
          
          <div style="margin-top: 30px; display: flex; justify-content: center; gap: 12px; font-size: 0.8rem; font-weight: 700;">
            <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowTermsModal(true); }} style="color: #6366F1; text-decoration: none;">Terms of Service</a>
            <span style="color: #CBD5E1;">•</span>
            <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowPrivacyModal(true); }} style="color: #6366F1; text-decoration: none;">Privacy Policy</a>
          </div>
        </div>
        ${showTermsModal && renderTermsModal()}
        ${showPrivacyModal && renderPrivacyPolicyModal()}
      </div>
    `;
  }

  return html`
    <div class="app-container main-app-bg anim-fade-in">
      <header class="tracker-header">
        <div class="header-left">
           <div class="status-dot ${isLive ? 'online' : ''}"></div>
           <div class="header-info">
             <h3 class="header-title">${activeTab === 'chat' ? 'Comm. Channel' : (route || 'Select Route')}</h3>
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

      <nav class="main-tabs">
         <button class=${activeTab === 'map' ? 'active' : ''} onClick=${() => setActiveTab('map')}><i>📍</i>Map</button>
         <button class=${activeTab === 'chat' ? 'active' : ''} onClick=${() => setActiveTab('chat')}><i>💬</i>Chat</button>
         <button onClick=${() => { setSelectedSchool(null); setRoute(null); setRole(null); }}><i>🔄</i>Switch</button>
      </nav>
      
      <footer class="app-footer" style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
        <small>© 2026 Himpower Pvt. Ltd. All Rights Reserved.</small>
        <div style="display: flex; gap: 10px; font-size: 0.7rem; font-weight: 700;">
          <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowTermsModal(true); }} style="color: #6366F1; text-decoration: none;">Terms of Service</a>
          <span style="color: #E2E8F0;">•</span>
          <a href="#" onClick=${(e: any) => { e.preventDefault(); setShowPrivacyModal(true); }} style="color: #6366F1; text-decoration: none;">Privacy Policy</a>
        </div>
      </footer>
      
      ${sosActive && html`<div class="sos-fullscreen">⚠️ EMERGENCY SIGNAL SENT</div>`}
      ${showTermsModal && renderTermsModal()}
      ${showPrivacyModal && renderPrivacyPolicyModal()}
      
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
              <hr />
              <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button class="policy-link-btn" style="height: 40px; font-size: 0.8rem;" onClick=${() => { setShowCompanyInfo(false); setShowTermsModal(true); }}>Terms of Service</button>
                <button class="policy-link-btn" style="height: 40px; font-size: 0.8rem;" onClick=${() => { setShowCompanyInfo(false); setShowPrivacyModal(true); }}>Privacy Policy</button>
              </div>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

render(html`<${App} />`, document.getElementById('root') || document.body);
