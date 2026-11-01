import type { MetadataRoute } from 'next';

/** Lets phones add Bookbot to the home screen with its icon */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bookbot',
    short_name: 'Bookbot',
    description: 'KDP research, design, and puzzle book tools',
    start_url: '/research',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
