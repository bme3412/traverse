/**
 * Input validation schemas using Zod
 * Provides type-safe validation for all user inputs
 */

import { z } from "zod";

/**
 * Travel purpose enum
 */
export const TravelPurposeSchema = z.enum([
  "tourism",
  "business",
  "work",
  "study",
  "medical",
  "family",
  "digital_nomad",
]);

/**
 * Travel details validation schema
 */
export const TravelDetailsSchema = z.object({
  passports: z.array(z.string().min(1, "Country name required")).min(1, "At least one passport required"),
  destination: z.string().min(1, "Destination is required"),
  purpose: TravelPurposeSchema,
  dates: z.object({
    depart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
    return: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  }).refine(
    (data) => {
      return new Date(data.return) > new Date(data.depart);
    },
    { message: "Return date must be after departure date", path: ["return"] }
  ),
  travelers: z.number().int().min(1).max(100),
  event: z.string().optional(),
});

/**
 * Document upload validation schema
 */
export const UploadedDocumentSchema = z.object({
  id: z.string(),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.enum(["image/png", "image/jpeg"]),
  base64: z.string().min(1, "File data is required"),
  sizeBytes: z.number().positive(),
});

/**
 * API request validation for /api/analyze
 */
export const AnalyzeRequestSchema = z.object({
  travelDetails: TravelDetailsSchema,
  documents: z.array(UploadedDocumentSchema).optional().default([]),
});

/**
 * Environment variable validation
 */
export const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "Anthropic API key is required"),
  ANTHROPIC_MODEL: z.string().optional(),
  USE_LIVE_SEARCH: z.enum(["true", "false"]).optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

/**
 * Validates environment variables at runtime
 * Throws if validation fails
 */
export function validateEnv() {
  try {
    return EnvSchema.parse({
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
      USE_LIVE_SEARCH: process.env.USE_LIVE_SEARCH,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
      throw new Error(`Environment validation failed:\n${issues}`);
    }
    throw error;
  }
}

/**
 * Validates travel details at runtime
 * Returns validated data or null if invalid
 */
export function validateTravelDetails(data: unknown): z.infer<typeof TravelDetailsSchema> | null {
  try {
    return TravelDetailsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Travel details validation failed:", error.issues);
    }
    return null;
  }
}

/**
 * Type helpers - infer TypeScript types from Zod schemas
 */
export type TravelDetailsInput = z.infer<typeof TravelDetailsSchema>;
export type UploadedDocumentInput = z.infer<typeof UploadedDocumentSchema>;
export type AnalyzeRequestInput = z.infer<typeof AnalyzeRequestSchema>;
