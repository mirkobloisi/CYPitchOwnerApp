export type Place = {
  /** A short label for the venue, used as the session's location name. */
  name: string;
  /** The full address, shown under the name so near-identical hits differ. */
  address: string;
  latitude: number;
  longitude: number;
};

/**
 * Free-text place lookup, for an away match at a ground the owner does not
 * run. Their own pitches come from the database; anywhere else has to be
 * found on a map.
 *
 * OpenStreetMap's Nominatim is used because it needs no key and no billing
 * account, which keeps this working for every owner without setup. Its usage
 * policy asks for an identifying User-Agent and no more than one call a
 * second — the caller debounces typing, and the header is set below.
 */
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export async function searchPlaces(query: string, limit = 8): Promise<Place[]> {
  const term = query.trim();
  if (term.length < 3) return [];

  const url =
    `${ENDPOINT}?format=jsonv2&addressdetails=1&limit=${limit}` +
    `&q=${encodeURIComponent(term)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // Nominatim asks callers to identify themselves.
        'User-Agent': 'MYPitch/1.0 (academy match locations)',
      },
    });

    if (!response.ok) return [];

    const rows = (await response.json()) as {
      name?: string;
      display_name?: string;
      lat?: string;
      lon?: string;
    }[];

    return rows
      .map((row) => {
        const latitude = Number(row.lat);
        const longitude = Number(row.lon);
        const display = row.display_name ?? '';

        return {
          // display_name is a long comma-separated address; its first part is
          // the venue itself, which is what belongs on a match card.
          name: row.name?.trim() || display.split(',')[0]?.trim() || term,
          address: display,
          latitude,
          longitude,
        };
      })
      .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));
  } catch {
    // Offline, blocked, or the service is down: the owner can still type a
    // location name by hand, so this fails quietly rather than blocking them.
    return [];
  }
}

/**
 * A maps link everyone can open, whatever they have installed. Built from the
 * coordinates rather than the name so it lands on the exact spot the owner
 * picked, even where several grounds share a name.
 */
export function mapsUrlFor(place: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
}

/**
 * What is at a point on the map.
 *
 * The map hands back coordinates; a match card needs a name. Nominatim's
 * reverse lookup supplies one, and if it cannot, the coordinates themselves
 * are shown — the maps link works either way, since it is built from the
 * point rather than the name.
 */
export async function describePoint(latitude: number, longitude: number): Promise<Place> {
  const fallback: Place = {
    name: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    address: '',
    latitude,
    longitude,
  };

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'MYPitch/1.0 (academy match locations)',
        },
      }
    );

    if (!response.ok) return fallback;

    const row = (await response.json()) as { name?: string; display_name?: string };
    const display = row.display_name ?? '';

    return {
      name: row.name?.trim() || display.split(',')[0]?.trim() || fallback.name,
      address: display,
      latitude,
      longitude,
    };
  } catch {
    return fallback;
  }
}
