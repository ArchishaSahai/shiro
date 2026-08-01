import { createMDX } from "fumadocs-mdx/next";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {
    root: resolve(directory, "../.."),
  },
};

const withMDX = createMDX();

export default withMDX(config);
