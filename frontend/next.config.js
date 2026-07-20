/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' é para o build Docker; no Netlify o runtime deles cuida do output.
  ...(process.env.NETLIFY ? {} : { output: 'standalone' }),
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

module.exports = nextConfig;
