import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: [
          '/admin/',
          '/admin/*',
          '/api/',
          '/api/*',
          '/dashboard/',
          '/dashboard/*',
          '/account/',
          '/account/*',
          '/students/',
          '/students/*',
          '/tasks/',
          '/tasks/*',
          '/leads/',
          '/leads/*',
          '/reports/',
          '/reports/*',
        ],
      },
    ],
  };
}
