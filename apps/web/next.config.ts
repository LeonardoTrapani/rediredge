import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
	typedRoutes: true,
};

export default withWorkflow(nextConfig);
