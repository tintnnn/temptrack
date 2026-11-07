import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onValueWritten } from "firebase-functions/v2/database";

initializeApp();

const firestore = getFirestore();

export const archiveSensorReading = onValueWritten(
  {
    ref: "/dht_station",
    region: "asia-southeast1",
  },
  async (event) => {
    const reading = event.data.after.val();

    if (!reading || typeof reading !== "object") return;

    const temperature = Number(reading.temperature ?? reading.temp ?? reading.temperatureC);
    const humidity = Number(reading.humidity ?? reading.hum ?? reading.humidityPercent);
    if (!Number.isFinite(temperature) || !Number.isFinite(humidity)) return;

    const recordedAt = reading.timestamp ?? reading.time ?? reading.createdAt ?? event.timestamp;
    const date = new Date(recordedAt);
    const recordedDate = Number.isNaN(date.getTime()) ? new Date(event.timestamp) : date;
    const readingId = `dht_station_${recordedDate.getTime()}`;

    await firestore.collection("sensorReadings").doc(readingId).set({
      temperature,
      humidity,
      status: reading.status || null,
      uptime: Number.isFinite(Number(reading.uptime)) ? Number(reading.uptime) : null,
      recordedAt: Timestamp.fromDate(recordedDate),
      source: "rtdb:dht_station",
      rtdbPath: "dht_station",
    }, { merge: true });
  },
);
