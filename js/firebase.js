// firebase.js — lazy Firebase-Init für den Coop-Transport (RTDB + anonyme Auth).
// Wird nie statisch importiert (siehe coop.js) — Solo-Spieler laden Firebase nie.
//
// Diese Werte sind öffentlich/committbar (kein Secret): die Absicherung läuft über
// die RTDB-Security-Rules + Anonymous Auth, nicht über Geheimhaltung des Configs.
import { log } from './debuglog.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAVpCzaRbJu6C1nSNRQCjD3MLwf5wijPbY',
  authDomain: 'coop-number-sums.firebaseapp.com',
  databaseURL: 'https://coop-number-sums-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'coop-number-sums',
  storageBucket: 'coop-number-sums.firebasestorage.app',
  messagingSenderId: '380862882686',
  appId: '1:380862882686:web:87d4831bd678ca2723092f',
};

let dbPromise = null;

export function ensureFirebase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        const [{ initializeApp }, authMod, dbModule] = await Promise.all([
          import('./vendor/firebase/firebase-app.js'),
          import('./vendor/firebase/firebase-auth.js'),
          import('./vendor/firebase/firebase-database.js'),
        ]);
        const app = initializeApp(firebaseConfig);
        const auth = authMod.getAuth(app);
        const db = dbModule.getDatabase(app);
        // Beim Start IMMER eine Session sicherstellen: ist bereits ein (echter)
        // Account eingeloggt — Auth-Token wird vom SDK in IndexedDB/localStorage
        // gehalten —, übernimmt dessen uid; sonst anonym anmelden. So nutzen coop.js
        // (Räume) und account.js (Cloud-Sync) dieselbe, korrekte uid.
        const uid = await new Promise((resolve, reject) => {
          authMod.onAuthStateChanged(auth, (user) => { if (user) resolve(user.uid); }, reject);
          if (!auth.currentUser) authMod.signInAnonymously(auth).catch(reject);
        });
        log('firebase', auth.currentUser && !auth.currentUser.isAnonymous ? 'Account-Session aktiv' : 'Anonyme Anmeldung erfolgreich', { uid });
        // auth + authMod zusätzlich exportieren (für account.js); dbModule-Spread
        // bleibt unverändert, damit coop.js { db, uid, ...dbModule } weiter passt.
        return { db, uid, auth, authMod, ...dbModule };
      } catch (e) {
        // Bei einem Fehlschlag (SDK-Laden oder Anmeldung) den Cache verwerfen,
        // damit ein erneuter Versuch (z.B. nächster Host/Join-Klick) nicht für
        // immer am selben gescheiterten Promise hängen bleibt.
        log('firebase', 'Verbindungsaufbau fehlgeschlagen', e);
        dbPromise = null;
        throw e;
      }
    })();
  }
  return dbPromise;
}
