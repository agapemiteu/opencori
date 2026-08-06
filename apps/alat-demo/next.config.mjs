/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@corri/contracts", "@corri/crypto-envelope", "@corri/sdk", "@corri/config-verifier"],
};

export default nextConfig;