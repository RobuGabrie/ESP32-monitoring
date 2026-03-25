# ESP32 Web Dashboard Code Generation Prompt

Act as an expert Frontend Developer specializing in UI/UX for IoT devices.

I need a single-page HTML/CSS/JavaScript template for an ESP32 web dashboard. Do not use external frameworks like React or Vue; use pure HTML, CSS (Grid/Flexbox), and vanilla JavaScript only. It must be mobile-responsive, visually clean, and production-ready.

Implement the following design principles and behavior:

1. Card-Based Grid Layout
- Group GPIO and telemetry blocks logically with clear section titles.
- Use section groups such as: Environment Sensors, Digital Outputs, System Info, and Network Health.

2. Clear Naming
- Every control/metric must include a human-readable label and hardware mapping.
- Example: Main Light (GPIO 12), Fan Relay (GPIO 14), LDR (ADC 0).

3. Data Type Differentiation
- Digital Inputs: show colored badges/dots for Active and Inactive states.
- Digital Outputs: show interactive toggle switches.
- Analog Inputs: show progress bars or compact gauges with proper units.
- Values must include units where applicable (for example: 24.5 C, 3.29 V, 86 mA, -61 dBm).

4. Standardized Color System
- Active and ON: green.
- Inactive and OFF: gray.
- Errors and disconnected: red.
- Informational states and highlights: blue.

5. System Health Strip
- Add a global Connection Status indicator with a pulsing green dot when online and red when offline.
- Add Last Updated timestamp in the same top status area.

6. Interactive Feedback for Toggles
- When a toggle is clicked:
  - Immediately show a temporary loading state (spinner or disabled control).
  - Simulate a wait for ESP32 confirmation.
  - Resolve to ON/OFF only after simulated confirmation.
  - If confirmation fails, revert state and show an error indicator.

7. Chart Requirements (Important)
- Use smooth line charts for temperature, light, current, and RSSI trends.
- Remove any decorative top strip or unrelated colored line above charts.
- Ensure the main bold trend line renders fully above the fill area and never appears partially clipped.
- Keep line joins and caps rounded.
- Include subtle horizontal grid lines and value labels.

8. Layout and Responsiveness
- Desktop: multi-column card layout.
- Mobile: single-column stacked layout with proper spacing and touch targets.
- Use CSS variables for theme colors, spacing, radius, and shadows.

9. Deliverables
- Return complete code in one response with:
  - HTML
  - CSS (inside style tag)
  - JavaScript (inside script tag)
- Include realistic mock JSON telemetry in JavaScript and a periodic update loop to simulate live data.
- Keep code readable, modular, and commented only where needed for non-obvious logic.
