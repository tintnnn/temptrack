import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp({
  databaseURL: "https://testiot-8abfb-default-rtdb.asia-southeast1.firebasedatabase.app",
});

const database = getDatabase();
const firestore = getFirestore();

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const snapshot = await database.ref("dht_history").once("value");
const history = snapshot.val() || {};
const entries = Object.entries(history);

for (let index = 0; index < entries.length; index += 400) {
  const batch = firestore.batch();
  entries.slice(index, index + 400).forEach(([key, reading]) => {
    const temperature = numberValue(reading?.temperature ?? reading?.temp);
    const humidity = numberValue(reading?.humidity ?? reading?.hum);
    if (temperature == null || humidity == null) return;

    const rawDate = reading.recordedAt ?? reading.timestamp ?? key;
    const date = new Date(numberValue(rawDate) ?? rawDate);
    const recordedAt = Number.isNaN(date.getTime()) ? new Date(Number(key)) : date;
    const document = firestore.collection("sensorReadings").doc(`dht_history_${key}`);

    batch.set(document, {
      temperature,
      humidity,
      status: reading.status || null,
      recordedAt: Timestamp.fromDate(recordedAt),
      source: "rtdb:dht_history",
      rtdbPath: `dht_history/${key}`,
    }, { merge: true });
  });
  await batch.commit();
  console.log(`Migrated ${Math.min(index + 400, entries.length)} of ${entries.length} records`);
}
