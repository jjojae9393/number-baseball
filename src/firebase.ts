import { initializeApp, getApps } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDeS2trfqEJY-XWi5kdOfe3dDxgx0fzlmE",
  authDomain: "number-baseball-bb603.firebaseapp.com",
  projectId: "number-baseball-bb603",
  storageBucket: "number-baseball-bb603.firebasestorage.app",
  messagingSenderId: "704776053110",
  appId: "1:704776053110:web:36b834dd3a479db561da57",
  measurementId: "G-VNEK7L7G41",
  databaseURL: "https://jaewon-80514-default-rtdb.asia-southeast1.firebasedatabase.app",
}

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
export const db = getDatabase(app)
