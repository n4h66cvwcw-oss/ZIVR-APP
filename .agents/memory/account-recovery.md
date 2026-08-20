---
name: Cross-platform account recovery
description: Reinstall recovery must work when Android removes all app-local and secure storage.
---

Account recovery must use a verified, user-held credential that can survive an Android uninstall. OS-secure storage can provide a convenient same-device session recovery path, but it is not the cross-platform source of truth.

**Why:** Android removes both AsyncStorage and Expo SecureStore when an app is uninstalled. An account must still be able to authenticate and restore server-owned settings, such as language, with no device-resident identity available.

**How to apply:** Issue recovery credentials through secure registration and one-time authenticated provisioning for older signed-in accounts; retain only a non-reversible server-side verifier, and exchange a presented credential for a new authenticated session. Require explicit server-side acknowledgment before treating a code as saved; after an unacknowledged relaunch, require authenticated rotation rather than re-revealing the old secret. Hydrate server-owned preferences before completing recovery onboarding.