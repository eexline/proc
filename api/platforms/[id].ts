import type { VercelRequest, VercelResponse } from "@vercel/node";
import { proxy } from "../_proxy.js";

export { config } from "../_proxy.js";

export default (req: VercelRequest, res: VercelResponse) => proxy(req, res);
