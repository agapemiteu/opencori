/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@corri/contracts",
    "@corri/crypto-envelope",
    "@corri/sdk",
    "@corri/config-verifier",
  ],
  allowedDevOrigins: ["10.36.103.80", "localhost:3002"],
};

export default nextConfig;
