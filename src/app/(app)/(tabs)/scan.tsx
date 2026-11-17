import { Redirect } from 'expo-router';
import React from 'react';

// The Scan tab opens the scan screen (see the tab's tabPress listener in
// _layout.tsx); reaching this route any other way goes there too.
export default function ScanTab() {
  return <Redirect href="/upload-bill" />;
}
