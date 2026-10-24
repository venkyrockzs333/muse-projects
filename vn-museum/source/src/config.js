// ============================================================
//  ALL PERSONAL CONTENT LIVES HERE. Edit this file only.
//  Everything below is a PLACEHOLDER — replace before gifting.
// ============================================================
export const CONFIG = {
  fromName: 'Venky',          // PLACEHOLDER
  toName: 'Your Love',        // PLACEHOLDER
  title: 'VN Museum',

  // Secret code for the locked door (digits or letters).
  passcode: '1302',
  hint: 'Hint: the day I proposed (DDMM)', // PLACEHOLDER

  // Text on the entrance placard (opens in the "Viewing" overlay).
  placard: {
    heading: 'A PERMANENT COLLECTION',
    to: 'For Your Love',      // PLACEHOLDER
    body: [
      'Every frame on these walls is a moment I never want to forget.',
      'Walk slowly. Every one of them is ours.',
    ],                        // PLACEHOLDER
    signoff: 'Love, Venky',   // PLACEHOLDER
  },

  // Photos on the walls. src: put files in public/photos/ and use
  // 'photos/name.jpg' (small WebP/JPG ~1200px keeps it fast on phones).
  // src: null => a generated "Your photo here" placeholder artwork.
  photos: [
    // PREVIEW: CC0 car photos from Wikimedia Commons (see README). Swap for real photos.
    { src: 'photos/car1.webp', caption: 'Ferrari Roma — PLACEHOLDER' },
    { src: 'photos/car2.webp', caption: 'Aston Martin DBS — PLACEHOLDER' },
    { src: 'photos/car3.webp', caption: 'Lotus Elise — PLACEHOLDER' },
    { src: 'photos/car4.webp', caption: 'Mercedes-AMG GT R — PLACEHOLDER' },
    { src: 'photos/car5.webp', caption: 'Porsche 914 — PLACEHOLDER' },
    { src: 'photos/car6.webp', caption: 'McLaren MP4-12C — PLACEHOLDER' },
    { src: 'photos/car7.webp', caption: 'Mazda Roadster — PLACEHOLDER' },
    { src: 'photos/car8.webp', caption: 'Silver Ferrari — PLACEHOLDER' },
  ],

  // Lines the second avatar says while walking with you.
  bubbles: [
    'our whole story is on those walls',
    'remember this one? 🥹',
    'I love you ❤️',
    'Dance with me',
  ],

  // Optional background music, e.g. 'audio/song.mp3' in public/audio/.
  // Starts only after a tap. null = no music.
  music: null,
};
