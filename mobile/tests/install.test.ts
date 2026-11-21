// Version web : proposer d'installer l'app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installState } from "../src/lib/install";

const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ipad = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36";

test("déjà sur l'écran d'accueil", () => {
  assert.equal(installState({ standalone: true, hasPrompt: true, userAgent: android, maxTouchPoints: 5 }), "installed");
});

test("le navigateur propose l'installation : un bouton", () => {
  assert.equal(installState({ standalone: false, hasPrompt: true, userAgent: android, maxTouchPoints: 5 }), "prompt");
});

test("iPhone et iPad (qui se présente comme un Mac) : Partager › Sur l'écran d'accueil", () => {
  assert.equal(installState({ standalone: false, hasPrompt: false, userAgent: iphone, maxTouchPoints: 5 }), "ios");
  assert.equal(installState({ standalone: false, hasPrompt: false, userAgent: ipad, maxTouchPoints: 5 }), "ios");
  // Un vrai Mac (sans écran tactile) : par le menu du navigateur
  assert.equal(installState({ standalone: false, hasPrompt: false, userAgent: ipad, maxTouchPoints: 0 }), "manual");
});
