import "server-only";

import { createPublicClient, http } from "viem";
import { galileo } from "@/lib/network";

export const publicClient = createPublicClient({
  chain: galileo,
  transport: http(galileo.rpcUrls.default.http[0], {
    timeout: 15_000,
    retryCount: 2,
  }),
});
