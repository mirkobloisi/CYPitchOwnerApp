import { Redirect } from 'expo-router';

// The Google Calendar OAuth sync feature (and this callback route it needed)
// has been removed. This file is kept only as a harmless redirect — rather
// than deleted — because this session's connection to your PC has no
// file-delete capability on Windows. Feel free to delete
// src/app/oauth-callback.tsx by hand; nothing links to it anymore.
export default function OAuthCallbackScreen() {
  return <Redirect href="/(tabs)/agenda" />;
}
