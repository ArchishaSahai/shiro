import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Keep Studio self-contained so `shiro dev` works outside the monorepo.
  turbopack: {
    root: directory,
  },
};

export default config;
