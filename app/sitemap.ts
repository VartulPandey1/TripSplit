import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tripsplit.app';

  return [
    {
      url: baseUrl,
      lastModified: '2026-11-02',
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/trips/new`,
      lastModified: '2026-11-02',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/trips/join`,
      lastModified: '2026-11-02',
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
