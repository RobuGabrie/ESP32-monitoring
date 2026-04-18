# ESP32-monitoring

Skydiver telemetry app built with Expo Router, React Native, BLE and MQTT.

## Development

- Install dependencies: `npm install`
- Start standard Expo server: `npm run start`
- Start with development client: `npm run dev:client`
- Start with development client over tunnel (recommended if QR fails): `npm run dev:client:tunnel`

## Android Dev Client QR Timeout (java.net.SocketTimeoutException)

If scanning the QR code opens the app but you get a timeout error, your phone usually cannot reach Metro over LAN.

Use this order:

1. Start tunnel mode: `npm run dev:client:tunnel`
2. Scan the new QR code from that tunnel session.
3. Keep phone and computer online without VPN/proxy.
4. Disable any firewall rule blocking Node.js/Expo if prompted by Windows.

If you use USB debugging:

1. Connect Android device with USB debugging enabled.
2. Run `adb reverse tcp:8081 tcp:8081`
3. Start the server with `npm run dev:client:lan`
4. Open the app from the dev client and reload.

If the build still fails, rebuild and reinstall the development client:

- `npm run android`

Then restart Metro and reconnect using tunnel mode.
