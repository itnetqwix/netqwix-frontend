/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable gzip/brotli compression on all responses
  compress: true,

  // Optimize images served through next/image
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 3600, // 1 hour browser cache for optimized images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
  },

  // Add long-lived cache headers for static assets
  async headers() {
    return [
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Tree-shake moment locale data — moment is used in BookingList; this removes
    // all unused locale bundles and saves ~250 KB from the bundle.
    const webpack = require("webpack");
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      })
    );

    return config;
  },

  async rewrites() {
    return [
      {
        source: "/privacy-policy",
        destination: "/privacy-policy.html",
      },
      {
        source: "/t&c",
        destination: "/t&c.html",
      },
    ];
  },
};

module.exports = nextConfig;
