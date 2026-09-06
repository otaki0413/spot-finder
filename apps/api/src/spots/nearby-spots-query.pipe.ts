import {
  BadRequestException,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import type { ArgumentMetadata } from "@nestjs/common";
import { nearbySpotsQuerySchema } from "./nearby-spots-query.schema.js";

export class NearbySpotsQueryPipe extends StandardSchemaValidationPipe {
  override transform<T>(value: T, metadata: ArgumentMetadata) {
    if (value === null || typeof value !== "object") {
      return super.transform(value, metadata);
    }
    // 変換時に除去される特殊なキーも、未知の検索条件として拒否する。
    const unknown = Object.keys(value).filter(
      (key) => !Object.hasOwn(nearbySpotsQuerySchema.entries, key),
    );
    if (unknown.length > 0) {
      throw new BadRequestException(
        unknown.map((key) => `property ${key} should not exist`),
      );
    }
    return super.transform(value, metadata);
  }
}
