# RestoSmart — Customer Mobile App

React Native (Expo SDK 51) customer app for the RestoSmart marketplace.
Built with Expo Router, React Query and plain `StyleSheet` styling.

## Voraussetzungen

- Node.js 18+ und `pnpm`
- Die **Expo Go** App auf deinem Handy (iOS App Store / Android Play Store)
- Der **API-Server** muss laufen (`artifacts/api-server`)

## Schnellstart

```bash
# 1. Abhängigkeiten installieren (vom Monorepo-Root)
cd <repo-root>
pnpm install

# 2. API-URL setzen
cd artifacts/customer-mobile
cp .env.example .env
# .env bearbeiten — WICHTIG: nicht "localhost", sondern die
# lokale IP deines Rechners verwenden, damit das Handy ihn erreicht:
#   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
# (IP finden: `ipconfig` auf Windows, `ifconfig`/`ip addr` auf macOS/Linux)

# 3. API-Server in einem zweiten Terminal starten
cd ../api-server
pnpm dev

# 4. App starten
cd ../customer-mobile
npx expo start
```

Scanne den QR-Code:
- **iOS**: mit der Kamera-App
- **Android**: aus der Expo Go App heraus

## Testen ohne Handy

```bash
npx expo start --web      # Browser-Vorschau (nur Layout)
npx expo start --android  # Android-Emulator (Android Studio nötig)
npx expo start --ios      # iOS-Simulator (Xcode, nur macOS)
```

## Projektstruktur

```
app/
  (auth)/        E-Mail + OTP Login
  (tabs)/        Home, Erkunden, Buchungen, Feed, Plan, Freunde, Profil
  restaurant/    Restaurant-Detail + Buchung
  messages/      Konversationen + Chat
  profile/       Öffentliches Profil
components/       RestaurantCard, UI-Bausteine
constants/        Theme (Farben, Abstände, Typografie)
hooks/            useAuth
lib/              api (axios), storage (SecureStore)
```

## Hinweise

- Styling läuft komplett über React Native `StyleSheet` (kein NativeWind nötig).
- `metro.config.js` ist für das pnpm-Monorepo konfiguriert (watchFolders +
  nodeModulesPaths), damit gemeinsame Pakete korrekt aufgelöst werden.
- Die Icon-/Splash-Dateien unter `assets/images/` sind einfarbige Platzhalter —
  vor einem echten Store-Build durch finale Grafiken ersetzen.
