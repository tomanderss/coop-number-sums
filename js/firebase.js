// firebase.js — lazy Firebase-Init für den Coop-Transport (RTDB + anonyme Auth).
// Wird nie statisch importiert (siehe coop.js) — Solo-Spieler laden Firebase nie.
//
// Diese Werte sind öffentlich/committbar (kein Secret): die Absicherung läuft über
// die RTDB-Security-Rules + Anonymous Auth, nicht über Geheimhaltung des Configs.
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
      const [{ initializeApp }, { getAuth, signInAnonymously, onAuthStateChanged }, dbModule] = await Promise.all([
        import('./vendor/firebase/firebase-app.js'),
        import('./vendor/firebase/firebase-auth.js'),
        import('./vendor/firebase/firebase-database.js'),
      ]);
      const app = initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = dbModule.getDatabase(app);
      const uid = await new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => { if (user) resolve(user.uid); }, reject);
        signInAnonymously(auth).catch(reject);
      });
      return { db, uid, ...dbModule };
    })();
  }
  return dbPromise;
}
