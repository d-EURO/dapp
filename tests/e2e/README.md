# E2E Testing Guide - JuiceDollar bApp

Diese Anleitung erklärt, wie du das E2E-Test-Setup mit Playwright und Synpress lokal zum Laufen bekommst.

## Inhaltsverzeichnis

1. [Voraussetzungen](#voraussetzungen)
2. [Installation](#installation)
3. [Test-Wallet einrichten](#test-wallet-einrichten)
4. [Umgebungsvariablen konfigurieren](#umgebungsvariablen-konfigurieren)
5. [Tests ausführen](#tests-ausführen)
6. [Test-Struktur](#test-struktur)
7. [Eigene Tests schreiben](#eigene-tests-schreiben)
8. [Troubleshooting](#troubleshooting)

---

## Voraussetzungen

Bevor du mit dem Testen beginnen kannst, stelle sicher, dass folgende Software installiert ist:

-   **Node.js** >= 18.x
-   **Yarn** >= 1.22.x
-   **Google Chrome** (für MetaMask-Extension)
-   **Git**

### Versionen prüfen

```bash
node --version    # Sollte >= 18.x sein
yarn --version    # Sollte >= 1.22.x sein
```

---

## Installation

### 1. Repository klonen (falls noch nicht geschehen)

```bash
git clone <repository-url>
cd bapp
```

### 2. Dependencies installieren

```bash
yarn install
```

### 3. Playwright Browser installieren

Synpress verwendet Chromium für die Tests. Installiere den Browser mit:

```bash
npx playwright install chromium
```

Dies lädt den Chromium-Browser herunter (~160 MB) und speichert ihn im Playwright-Cache.

---

## Test-Wallet einrichten

> **WICHTIG: Verwende NIEMALS eine Wallet mit echten Funds für Tests!**

Für E2E-Tests benötigst du eine dedizierte Test-Wallet. Du hast zwei Optionen:

### Option A: Neue Test-Wallet erstellen (Empfohlen)

1. Öffne Chrome und installiere [MetaMask](https://metamask.io/download/)
2. Erstelle eine neue Wallet
3. **Notiere die Seed-Phrase** (12 Wörter) - du brauchst sie später
4. Wähle ein Passwort für MetaMask

### Option B: Standard Hardhat Test-Wallet

Für lokale Tests kannst du die Standard-Hardhat-Seed-Phrase verwenden:

```
test test test test test test test test test test test junk
```

Diese Wallet hat auf Testnets keine Funds - du musst ggf. Test-Tokens von einem Faucet holen.

### Testnet-Tokens besorgen

Die App läuft auf dem **Citrea Testnet** (Chain ID: 5115). Um Tests mit Transaktionen durchzuführen, benötigst du Test-cBTC:

1. Gehe zum Citrea Testnet Faucet
2. Gib deine Test-Wallet-Adresse ein
3. Fordere Test-Tokens an

---

## Umgebungsvariablen konfigurieren

### 1. Lokale .env Datei erstellen

Kopiere die Beispiel-Datei:

```bash
cp .env.example .env
```

### 2. Test-Variablen eintragen

Öffne `.env` und füge deine Test-Wallet-Daten hinzu:

```env
# Bestehende App-Variablen...
NEXT_PUBLIC_LANDINGPAGE_URL=https://juicedollar.com
NEXT_PUBLIC_APP_URL=https://dev.app.testnet.juicedollar.com
NEXT_PUBLIC_API_URL=https://dev.api.testnet.juicedollar.com/
NEXT_PUBLIC_PONDER_URL=https://dev.ponder.testnet.juicedollar.com
NEXT_PUBLIC_WAGMI_ID=<dein-walletconnect-project-id>
NEXT_PUBLIC_CHAIN_NAME=testnet
NEXT_PUBLIC_RPC_URL_TESTNET=https://rpc.testnet.juiceswap.com/

# E2E Testing Variablen
WALLET_SEED_PHRASE=deine zwölf wörter seed phrase hier eintragen
WALLET_PASSWORD=DeinSicheresTestPasswort123!
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

### Variablen-Erklärung

| Variable              | Beschreibung                           | Beispiel                |
| --------------------- | -------------------------------------- | ----------------------- |
| `WALLET_SEED_PHRASE`  | 12-Wort Seed-Phrase deiner Test-Wallet | `test test test...`     |
| `WALLET_PASSWORD`     | Passwort für MetaMask (min. 8 Zeichen) | `TestPassword123!`      |
| `PLAYWRIGHT_BASE_URL` | URL der App für Tests                  | `http://localhost:3000` |

---

## Tests ausführen

### Verfügbare Test-Befehle

| Befehl                        | Beschreibung                                           |
| ----------------------------- | ------------------------------------------------------ |
| `yarn test:e2e`               | Basis-Tests ausführen (Navigation, UI) - ohne MetaMask |
| `yarn test:e2e:visual`        | Visual Regression Tests ausführen                      |
| `yarn test:e2e:visual:update` | Baseline-Screenshots aktualisieren                     |
| `yarn test:e2e:wallet`        | Wallet-Tests ausführen (erfordert Synpress-Cache)      |
| `yarn test:e2e:all`           | Alle Tests ausführen                                   |
| `yarn test:e2e:ui`            | Tests mit Playwright UI ausführen                      |
| `yarn test:e2e:headed`        | Tests im sichtbaren Browser ausführen                  |
| `yarn test:e2e:debug`         | Tests im Debug-Modus ausführen                         |
| `yarn test:e2e:report`        | Letzten Test-Report im Browser öffnen                  |
| `yarn synpress:cache`         | Synpress-Cache für Wallet-Tests erstellen              |

### Test-Kategorien

**Basis-Tests** (`yarn test:e2e`)

-   Laufen ohne MetaMask
-   Testen Navigation und UI-Elemente
-   Können headless ausgeführt werden

**Visual Regression Tests** (`yarn test:e2e:visual`)

-   Vergleichen Screenshots gegen Baseline-Bilder
-   Erkennen visuelle Änderungen automatisch
-   Baseline aktualisieren mit `yarn test:e2e:visual:update`
-   Screenshots werden in `tests/e2e/snapshots/` gespeichert

**Wallet-Tests** (`yarn test:e2e:wallet`)

-   Erfordern MetaMask-Integration
-   Benötigen Synpress-Cache (siehe unten)
-   Müssen im headed-Modus laufen

### Ersten Test durchführen

1. **Starte die App** (in einem separaten Terminal):

    ```bash
    yarn dev
    ```

    Warte bis die App unter `http://localhost:3000` erreichbar ist.

2. **Führe die Basis-Tests aus**:
    ```bash
    yarn test:e2e
    ```

### Wallet-Tests einrichten

Für Wallet-Tests muss der Synpress-Cache einmalig erstellt werden:

```bash
# Cache erstellen (öffnet Browser mit MetaMask)
yarn synpress:cache
```

Danach können Wallet-Tests ausgeführt werden:

```bash
yarn test:e2e:wallet
```

### Einzelne Test-Dateien ausführen

```bash
# Nur Navigations-Tests
npx playwright test navigation.spec.ts

# Nur UI-Tests
npx playwright test ui.spec.ts

# Nur Wallet-Verbindungs-Tests (erfordert Cache)
npx playwright test tests/e2e/specs/wallet/connect-wallet.spec.ts
```

### Einzelne Tests ausführen

```bash
# Test nach Namen filtern
npx playwright test -g "should connect MetaMask"
```

### Tests im Debug-Modus

Der Debug-Modus ist hilfreich, um Fehler zu finden:

```bash
yarn test:e2e:debug
```

Dies öffnet den Playwright Inspector, wo du:

-   Schritt für Schritt durch Tests gehen kannst
-   Selektoren inspizieren kannst
-   Den Browser-Zustand sehen kannst

---

## Test-Struktur

```
tests/
└── e2e/
    ├── README.md                    # Diese Dokumentation
    ├── wallet-setup/
    │   └── basic.setup.ts           # MetaMask Wallet-Konfiguration
    ├── snapshots/                   # Baseline-Screenshots für Visual Tests
    │   └── specs/
    │       └── visual.spec.ts/      # Screenshots pro Test-Datei
    │           ├── dashboard.png
    │           ├── mint.png
    │           └── ...
    └── specs/
        ├── navigation.spec.ts       # Navigations-Tests (ohne MetaMask)
        ├── ui.spec.ts               # UI-Element-Tests (ohne MetaMask)
        ├── visual.spec.ts           # Visual Regression Tests
        └── wallet/                  # Wallet-Tests (mit MetaMask)
            ├── connect-wallet.spec.ts
            └── dashboard.spec.ts
```

### Vorhandene Tests

#### Basis-Tests (ohne MetaMask)

**navigation.spec.ts** (9 Tests)

-   Alle Hauptseiten erreichbar (Dashboard, Mint, Savings, Equity, etc.)
-   Home-Redirect zu Dashboard
-   404-Handling für ungültige Routen

**ui.spec.ts** (6 Tests)

-   Navigation-Bar sichtbar
-   Connect-Wallet-Button sichtbar
-   Logo sichtbar
-   Navigation-Links vorhanden
-   Responsive auf Mobile und Tablet

#### Visual Regression Tests

**visual.spec.ts** (10 Tests)

-   Screenshot-Vergleich für alle Hauptseiten (Dashboard, Mint, Savings, Equity, Governance, Challenges, Swap, Referrals)
-   Responsive Screenshots (Mobile 375px, Tablet 768px)
-   Dynamische Elemente werden vor Screenshot ausgeblendet (Loading-Spinner, Preise, etc.)

#### Wallet-Tests (mit MetaMask)

**wallet/connect-wallet.spec.ts**

-   Testet MetaMask-Verbindung zur dApp
-   Verifiziert Netzwerk-Wechsel zu Citrea Testnet

**wallet/dashboard.spec.ts**

-   Dashboard nach Wallet-Verbindung
-   Portfolio-Informationen laden
-   Navigation zu Mint/Savings-Seite

---

## Eigene Tests schreiben

### Test-Datei erstellen

Erstelle eine neue Datei in `tests/e2e/specs/`:

```typescript
// tests/e2e/specs/mein-feature.spec.ts

import { testWithSynpress } from "@synthetixio/synpress";
import { MetaMask, metaMaskFixtures } from "@synthetixio/synpress/playwright";
import basicSetup from "../wallet-setup/basic.setup";

const test = testWithSynpress(metaMaskFixtures(basicSetup));
const { expect } = test;

test.describe("Mein Feature", () => {
	test("sollte etwas tun", async ({ page }) => {
		await page.goto("/meine-seite");

		// Dein Test-Code hier
		await expect(page.locator("h1")).toBeVisible();
	});
});
```

### Test mit Wallet-Verbindung

```typescript
test("sollte mit verbundener Wallet funktionieren", async ({ context, page, metamaskPage, extensionId }) => {
	// MetaMask-Instanz erstellen
	const metamask = new MetaMask(context, metamaskPage, basicSetup.walletPassword, extensionId);

	await page.goto("/");

	// Wallet verbinden
	await page.getByRole("button", { name: /connect/i }).click();
	await page
		.getByText(/metamask/i)
		.first()
		.click();
	await metamask.connectToDapp();

	// Jetzt ist die Wallet verbunden - teste dein Feature
	await page.goto("/mint");
	// ...
});
```

### Häufig verwendete MetaMask-Aktionen

```typescript
// Wallet verbinden
await metamask.connectToDapp();

// Transaktion bestätigen
await metamask.confirmTransaction();

// Signatur bestätigen
await metamask.confirmSignature();

// Netzwerk wechseln
await metamask.switchNetwork("Citrea Testnet");

// Token hinzufügen
await metamask.addToken("0x...");
```

### Best Practices

1. **Isolierte Tests**: Jeder Test sollte unabhängig funktionieren
2. **Aussagekräftige Namen**: `test('should display error when balance is insufficient')`
3. **Warten statt Sleep**: Verwende `await expect(...).toBeVisible()` statt `page.waitForTimeout()`
4. **Selektoren**: Bevorzuge `getByRole`, `getByText`, `getByTestId` gegenüber CSS-Selektoren

---

## Troubleshooting

### Problem: "Cache for playwright-metamask does not exist"

**Lösung:**

```bash
# Cache neu generieren
npx synpress

# Falls der Ordner nicht passt, manuell umbenennen
ls .cache-synpress/
# Benenne den Ordner entsprechend der Fehlermeldung um
```

### Problem: Tests schlagen fehl wegen Timeout

**Mögliche Ursachen:**

-   App läuft nicht (`yarn dev`)
-   Netzwerk-Verbindung langsam
-   Selektoren stimmen nicht

**Lösung:**

```bash
# Debug-Modus verwenden
yarn test:e2e:debug
```

### Problem: MetaMask öffnet sich nicht

**Lösung:**

1. Stelle sicher, dass `headless: false` in `playwright.config.ts` gesetzt ist
2. Prüfe, ob Chromium korrekt installiert ist:
    ```bash
    npx playwright install chromium --force
    ```

### Problem: Wallet-Verbindung schlägt fehl

**Mögliche Ursachen:**

-   Falsche Seed-Phrase in `.env`
-   Passwort zu kurz (min. 8 Zeichen)

**Lösung:**

1. Prüfe `.env` Datei
2. Teste Seed-Phrase manuell in MetaMask

### Problem: "Network not found"

**Lösung:**
Stelle sicher, dass das Citrea Testnet korrekt konfiguriert ist in `wallet-setup/basic.setup.ts`:

```typescript
await metamask.addNetwork({
	name: "Citrea Testnet",
	rpcUrl: "https://rpc.testnet.citrea.xyz",
	chainId: 5115,
	symbol: "cBTC",
});
```

### Problem: Tests laufen zu langsam

**Tipps:**

-   Verwende `test.describe.serial()` für abhängige Tests
-   Reduziere `timeout` in `playwright.config.ts` für schnelleres Feedback
-   Nutze `test.skip()` für bekannte Probleme

### Logs und Reports

Nach jedem Test-Lauf findest du:

-   **HTML Report**: `playwright-report/index.html`
-   **Screenshots bei Fehlern**: `test-results/`
-   **Videos bei Fehlern**: `test-results/`

Report öffnen:

```bash
yarn test:e2e:report
```

---

## Weiterführende Ressourcen

-   [Playwright Dokumentation](https://playwright.dev/docs/intro)
-   [Synpress Dokumentation](https://docs.synpress.io/)
-   [Synpress GitHub](https://github.com/synpress-io/synpress)
-   [MetaMask Test Best Practices](https://docs.synpress.io/docs/guides/playwright)

---

## Support

Bei Fragen oder Problemen:

1. Prüfe zuerst dieses README und das Troubleshooting
2. Schaue in die Playwright- und Synpress-Dokumentation
3. Erstelle ein Issue im Repository mit:
    - Fehlermeldung
    - Schritte zur Reproduktion
    - Node/Yarn Version
    - Betriebssystem
