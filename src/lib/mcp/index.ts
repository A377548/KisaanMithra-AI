import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listFields from "./tools/list-fields";
import irrigationAdvice from "./tools/irrigation-advice";
import recentAdvice from "./tools/recent-advice";
import recentDiagnoses from "./tools/recent-diagnoses";
import listYields from "./tools/list-yields";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "kisaan-mithra-mcp",
  title: "Kisaan Mithra",
  version: "0.1.0",
  instructions:
    "Tools for Kisaan Mithra, a multilingual irrigation and plant-disease advisor for Indian farmers. Use list_fields to see the farmer's saved farms, get_irrigation_advice to decide whether to water today (uses live weather + AI), and list_recent_advice / list_recent_diagnoses / list_crop_yields to read the farmer's history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listFields, irrigationAdvice, recentAdvice, recentDiagnoses, listYields],
});
