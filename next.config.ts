import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "pg", "nodemailer", "@google/genai"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "qannfgylnsqmyocsfyse.supabase.co" },
    ],
  },
};

export default nextConfig;
