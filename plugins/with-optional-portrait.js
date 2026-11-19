const { withAndroidManifest } = require('expo/config-plugins');

// The app is locked to portrait ("orientation" in app.json), which makes
// Android treat a portrait screen as required hardware. Google Play blocks
// releases that require it, so declare the feature as optional: phones still
// open the app in portrait, and tablets, desktops and XR devices can install it.
const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const features = (manifest['uses-feature'] ??= []);
    const existing = features.find((feature) => feature.$?.['android:name'] === FEATURE);
    if (existing) {
      existing.$['android:required'] = 'false';
    } else {
      features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    }
    return mod;
  });
};
