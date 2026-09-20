import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, writeBatch, collection } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "burk-haustechnik.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "burk-haustechnik",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "burk-haustechnik.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "209459117942",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:209459117942:web:5c2e32cfcee6467492c457",
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9CBCVHREHS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PROJECT_ID = "hallenbad-weingarten";

async function seedData() {
  console.log("🚀 Starting Firestore Seeding for Burk Haustechnik...");
  
  // 1. Create Main Project Document
  const projectRef = doc(db, "projects", PROJECT_ID);
  await setDoc(projectRef, {
    id: PROJECT_ID,
    name: "Hallenbad Weingarten Sanierung",
    projectNumber: "1638 / 24316-044",
    client: "Stadt Weingarten",
    location: "Weingarten",
    status: "in_progress",
    createdAt: new Date().toISOString(),
    currency: "EUR",
    totalPositions: 0,
    totalDeliveredPercentage: 0
  }, { merge: true });

  console.log(`✅ Project '${PROJECT_ID}' document initialized.`);

  // 2. Default Rooms setup with multi-language titles
  const defaultRooms = [
    { id: "room_101", name: "Umkleide Herren", code: "EG-101", floor: "EG", translations: { ro: "Vestiar Bărbați", pl: "Szatnia Męska", hr: "Muška Svlačionica" } },
    { id: "room_102", name: "Umkleide Damen", code: "EG-102", floor: "EG", translations: { ro: "Vestiar Femei", pl: "Szatnia Damska", hr: "Ženska Svlačionica" } },
    { id: "room_103", name: "Duschen Herren", code: "EG-103", floor: "EG", translations: { ro: "Dușuri Bărbați", pl: "Prysznice Męskie", hr: "Muški Tuševi" } },
    { id: "room_104", name: "Duschen Damen", code: "EG-104", floor: "EG", translations: { ro: "Dușuri Femei", pl: "Prysznice Damskie", hr: "Ženske Tuševi" } },
    { id: "room_201", name: "Technikraum OG", code: "OG-201", floor: "OG", translations: { ro: "Cameră Tehnică", pl: "Maszynownia", hr: "Tehnička Soba" } },
    { id: "room_001", name: "Keller / Lüftung", code: "UG-001", floor: "UG", translations: { ro: "Subsol / Ventilație", pl: "Piwnica / Wentylacja", hr: "Podrum / Ventilacija" } }
  ];

  for (const r of defaultRooms) {
    await setDoc(doc(db, "projects", PROJECT_ID, "rooms", r.id), r, { merge: true });
  }
  console.log(`✅ ${defaultRooms.length} standard rooms added to Firestore.`);

  // 3. Parse GAEB X81 file
  const gaebPath = path.resolve("../docs/BURK Projekt/Material von Flo Buck/24316-044 LV Sanitär HBW.X81");
  console.log(`📄 Reading GAEB file: ${gaebPath}`);

  if (!fs.existsSync(gaebPath)) {
    console.error(`❌ File not found: ${gaebPath}`);
    process.exit(1);
  }

  const xmlData = fs.readFileSync(gaebPath, "utf-8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });

  const parsed = parser.parse(xmlData);
  const boqBody = parsed?.GAEB?.Award?.BoQ?.BoQBody;
  
  if (!boqBody) {
    console.error("❌ Invalid GAEB XML structure: BoQBody not found.");
    process.exit(1);
  }

  const categories = Array.isArray(boqBody.BoQCtgy) ? boqBody.BoQCtgy : [boqBody.BoQCtgy];
  let positionCount = 0;
  let batch = writeBatch(db);
  let batchCount = 0;

  for (const ctgy of categories) {
    if (!ctgy) continue;
    const categoryTitle = extractText(ctgy?.LblTx) || "Allgemeine Positionen";
    const categoryRNo = ctgy["@_RNoPart"] || "01";
    
    // Find item list
    const items = ctgy?.BoQBody?.Itemlist?.Item;
    if (!items) continue;

    const itemList = Array.isArray(items) ? items : [items];

    for (const item of itemList) {
      if (!item) continue;

      const posNrRaw = item["@_RNoPart"] || item["@_ID"] || String(positionCount + 1);
      const posNr = `${categoryRNo}.${posNrRaw.padStart(2, "0")}`;
      const qty = parseFloat(item.Qty) || 0;
      const qu = item.QU || "Stk";
      
      const shortText = extractText(item?.Description?.CompleteText?.OutlineText) || 
                        extractText(item?.Description?.CompleteText?.DetailTxt) || 
                        "Position ohne Text";

      const longText = extractText(item?.Description?.CompleteText?.DetailTxt) || shortText;

      const posId = `pos_${posNr.replace(/\./g, "_")}`;

      const posRef = doc(db, "projects", PROJECT_ID, "positions", posId);

      batch.set(posRef, {
        id: posId,
        posNr: posNr,
        group: categoryTitle,
        shortText: cleanString(shortText),
        longText: cleanString(longText),
        qty: qty,
        qu: qu,
        deliveredQty: 0,
        unitPrice: 0, // can be updated or filled via Excel
        isCutMaterial: shortText.toLowerCase().includes("m") && (qu === "m" || qu === "Meter"),
        status: "open",
        updatedAt: new Date().toISOString()
      }, { merge: true });

      positionCount++;
      batchCount++;

      if (batchCount >= 400) {
        await batch.commit();
        console.log(`📦 Batch commit: ${positionCount} positions uploaded...`);
        batch = writeBatch(db);
        batchCount = 0;
      }
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  // Update total count on project doc
  await setDoc(projectRef, { totalPositions: positionCount }, { merge: true });

  console.log(`🎉 SUCCESS! Uploaded ${positionCount} real LV positions to Firestore document 'projects/${PROJECT_ID}/positions'!`);
  process.exit(0);
}

function extractText(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number") return String(obj);
  
  if (obj["#text"]) return obj["#text"];
  
  if (Array.isArray(obj)) {
    return obj.map(extractText).join(" ");
  }

  if (typeof obj === "object") {
    let result = "";
    for (const key of Object.keys(obj)) {
      if (key.startsWith("@_")) continue;
      result += " " + extractText(obj[key]);
    }
    return result;
  }
  return "";
}

function cleanString(str) {
  return str
    .replace(/<[^>]*>/g, " ") // remove HTML tags
    .replace(/\s+/g, " ")
    .trim();
}

seedData().catch(err => {
  console.error("❌ Error seeding Firestore:", err);
  process.exit(1);
});
