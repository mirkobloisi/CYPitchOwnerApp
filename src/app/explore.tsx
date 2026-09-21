import { Redirect } from 'expo-router';
import React from 'react';

// Left over from the default Expo template's demo tabs — not part of the
// MYPitch Pitch Owner app. Redirects anywhere it might still be reached from.
export default function ExploreScreen() {
  return <Redirect href="/" />;
}
