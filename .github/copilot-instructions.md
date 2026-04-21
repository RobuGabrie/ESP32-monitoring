# Copilot Instructions for ESP32-monitoring

## Build, lint, typecheck, and run commands

Use npm scripts from `package.json`:

- `npm install` — install dependencies
- `npm run lint` — lint (Expo ESLint config)
- `npm run typecheck` — TypeScript check (`tsc --noEmit`)
- `npm run start` — Expo dev server
- `npm run dev:web` — web target
- `npm run dev:client` / `npm run dev:client:tunnel` / `npm run dev:client:lan` — dev client modes
- `npm run android` (or `npm run android:dev`) — Android native/dev-client run
- `npm run ios` — iOS native run

EAS profiles are present in `eas.json` (example: `eas build --platform android --profile development`).

From `README.md`, if Android dev-client QR connection fails/timeouts:

1. Use tunnel first: `npm run dev:client:tunnel`
2. For USB debugging flows: `adb reverse tcp:8081 tcp:8081` then `npm run dev:client:lan`

There is currently **no test framework/script configured** in `package.json`, so there is no single-test command yet.

## High-level architecture

- **Expo Router with platform-specific entry points**
  - Root layouts: `app/_layout.native.tsx`, `app/_layout.web.tsx`
  - Tabs layouts: `app/(tabs)/_layout.native.tsx`, `app/(tabs)/_layout.tsx`
  - Platform wrappers are used in several routes (`index.tsx`, `settings.native.tsx`, `sensors.native.tsx`).

- **Two telemetry paths**
  - **Mobile app path (BLE-first):**
    - `hooks/useConnectivity.ts` orchestrates mobile runtime state and delegates BLE operations to `services/mobileDataService.ts`.
    - BLE scanning/connection, remembered-device reconnect, stopwatch command flow, and telemetry listeners are in `mobileDataService`.
  - **Web/dashboard path (MQTT + IMU WS):**
    - `hooks/useESP32.ts` owns shared MQTT connection, topic subscriptions, IMU websocket, payload normalization, history hydration, and command publishing.
    - Store updates go through `hooks/useStore.ts`.
    - `app/(tabs)/connect.web.tsx` redirects to `/`, so BLE connection UX is native-first.

- **Global app store**
  - `hooks/useStore.ts` is the central state source (custom `useSyncExternalStore` implementation, capped histories, module toggles, ACK/log buffers, theme mode).
  - `useAppTheme` and telemetry hooks consume this shared state.

- **UI foundation**
  - `components/ScreenShell.tsx` provides top-level shell (status/range/theme controls).
  - Theme tokens are centralized in `constants/theme.ts`.

## Key repository-specific conventions

- Use `@/` imports (configured in `tsconfig.json`) instead of deep relative paths.

- **Language convention (strict):**
  - User-facing app copy should be Romanian.
  - Keep new labels, alerts, and status text in Romanian to match existing screens.

- **Mobile data-flow convention (strict):**
  - Mobile app should use BLE for ESP32 communication (receive telemetry + send ESP commands).
  - Mobile app acts as MQTT bridge for the web app, and should publish bridged data only when phone is on Wi-Fi.

- **MQTT/state contract convention:**
  - Preserve compatibility for both:
    - Legacy module toggles: `{ "module": "...", "enabled": boolean }`
    - Structured actions: `{ "id", "action", "params", "ts", "source" }`
  - Process ACK/state through `MQTT_STATE_TOPIC` (`last_command`, `modules`, optional `wifi.scan.result` payloads).
  - Check `SETTINGS_MQTT_SPEC.md` and `SETTINGS_FUNCTIONALITY.md` before changing settings or command behavior.

- **Telemetry normalization convention:**
  - Extend existing normalization utilities in `hooks/useESP32.ts` (multi-alias parsing, timestamp normalization, quaternion normalization, inverted LDR logic).
  - Do not introduce one-off parsing logic in screens/components.

- **Transport-mode convention:**
  - Keep `online` / `offline` / `disconnected` semantics consistent with current NetInfo-driven mode switching and fallback behavior in `useESP32.ts`.

- **Design convention (strict):**
  - Use `reference/reference.jpg` as the visual benchmark when changing UI.
  - Keep premium, cohesive styling aligned with current design system (`theme.ts`, `ScreenShell`, shared cards), and avoid ad-hoc styles that break visual consistency.
  - Follow existing frontend craft constraints already present in `.github/agents/expo-frontend-craft.agent.md`: preserve architecture unless justified, prefer incremental/reviewable edits, avoid heavy dependencies without clear value, and keep mobile-friendly patterns.
