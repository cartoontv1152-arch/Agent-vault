import type { MetadataRoute } from "next";
import { publicConfig } from "@/lib/network";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: publicConfig.appUrl, changeFrequency: "weekly", priority: 1 }];
}
