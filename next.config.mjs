/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
    ],
  },
  async headers() {
    // The dataset files are versioned via a ?v= query (see usePaintings), so
    // a given URL's bytes never change — serve them immutable for a year so
    // repeat visits skip the network entirely. Bump DATA_VERSION to refresh.
    const immutable = [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ];
    return [
      { source: "/paintings.json", headers: immutable },
      { source: "/paintings-popular.json", headers: immutable },
    ];
  },
};

export default nextConfig;
