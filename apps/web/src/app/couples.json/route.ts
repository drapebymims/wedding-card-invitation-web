import { getCoupleSummaries } from "@/lib/config";

/** Build-time manifest of couples — consumed by the admin couple picker. */
export const dynamic = "force-static";

export async function GET() {
  return Response.json(getCoupleSummaries());
}
