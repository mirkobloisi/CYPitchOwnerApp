import { Redirect } from 'expo-router';

// The .ics calendar import feature (and this route it needed) has been
// removed. This file is kept only as a harmless redirect — rather than
// deleted — because this session's connection to your PC has no file-delete
// capability on Windows. Feel free to delete src/app/import-calendar.tsx by
// hand; nothing links to it anymore.
export default function ImportCalendarScreen() {
  return <Redirect href="/(tabs)/availability" />;
}
