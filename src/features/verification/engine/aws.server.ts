import { AwsClient } from "aws4fetch";

import {
  FaceEngineUnavailableError,
  type AnalyzedImage,
  type FaceInfo,
  type FaceMatchingProvider,
} from "@/features/verification/face-matching.provider";

/**
 * Moteur externe (option) : AWS Rekognition, appelé directement par le serveur
 * (DetectFaces, CompareFaces). Activé par FACE_MATCH_PROVIDER=aws avec AWS_REGION,
 * AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY (jamais côté navigateur).
 * Le sens de rotation de la tête n'est pas utilisé (seule l'amplitude compte).
 * Non testé dans l'environnement de développement (pas de compte AWS) : à vérifier avec
 * un compte de test avant de l'activer.
 */
interface AwsRef {
  jpeg: string;
}

interface AwsFace {
  BoundingBox?: { Width?: number; Height?: number; Left?: number; Top?: number };
  Confidence?: number;
  Pose?: { Yaw?: number };
  Quality?: { Sharpness?: number };
}

export function createAwsProvider(): FaceMatchingProvider {
  const region = process.env["AWS_REGION"];
  const accessKeyId = process.env["AWS_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["AWS_SECRET_ACCESS_KEY"];
  if (!region || !accessKeyId || !secretAccessKey) {
    throw new FaceEngineUnavailableError("AWS Rekognition : variables d'environnement manquantes");
  }
  const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: "rekognition" });

  async function call<T>(target: string, body: unknown): Promise<T> {
    let res: Response;
    try {
      res = await aws.fetch(`https://rekognition.${region}.amazonaws.com/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": `RekognitionService.${target}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new FaceEngineUnavailableError(`AWS Rekognition injoignable : ${String(error)}`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 && text.includes("InvalidParameterException")) {
        throw Object.assign(new Error("no_face"), { noFace: true });
      }
      throw new FaceEngineUnavailableError(
        `AWS Rekognition ${target} : ${res.status} ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  return {
    name: "aws",
    directional: false,
    async analyze(bytes) {
      const sharp = (await import("sharp")).default;
      const jpeg = (
        await sharp(bytes, { failOn: "none" })
          .rotate()
          .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 90 })
          .toBuffer()
      ).toString("base64");
      const result = await call<{ FaceDetails?: AwsFace[] }>("DetectFaces", {
        Image: { Bytes: jpeg },
        Attributes: ["DEFAULT"],
      });
      const faces: FaceInfo[] = (result.FaceDetails ?? [])
        .map((f) => ({
          score: (f.Confidence ?? 0) / 100,
          box: {
            x: f.BoundingBox?.Left ?? 0,
            y: f.BoundingBox?.Top ?? 0,
            width: f.BoundingBox?.Width ?? 0,
            height: f.BoundingBox?.Height ?? 0,
          },
          yaw: (f.Pose?.Yaw ?? 0) / 180,
          sharpness: f.Quality?.Sharpness ?? 0,
          blurry: (f.Quality?.Sharpness ?? 100) < 10,
        }))
        .filter((f) => f.score >= 0.9)
        .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
      return { faces, ref: { jpeg } satisfies AwsRef } satisfies AnalyzedImage;
    },
    async similarity(a, b) {
      if (!a.faces.length || !b.faces.length) return null;
      try {
        const result = await call<{ FaceMatches?: { Similarity?: number }[] }>("CompareFaces", {
          SourceImage: { Bytes: (a.ref as AwsRef).jpeg },
          TargetImage: { Bytes: (b.ref as AwsRef).jpeg },
          SimilarityThreshold: 0,
        });
        const best = Math.max(0, ...(result.FaceMatches ?? []).map((m) => m.Similarity ?? 0));
        return best / 100;
      } catch (error) {
        if ((error as { noFace?: boolean }).noFace) return null;
        throw error;
      }
    },
  };
}
