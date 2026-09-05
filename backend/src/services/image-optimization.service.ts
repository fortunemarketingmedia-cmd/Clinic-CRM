import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { formsRepository } from '../repositories/forms.repository.js';
import { fileStorageService } from './file-storage.service.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const variants = [
  { variant: 'THUMBNAIL', width: 320, quality: 75 },
  { variant: 'GALLERY', width: 800, quality: 80 },
  { variant: 'PREVIEW', width: 1600, quality: 82 },
] as const;

function pipeline(buffer: Buffer) {
  return sharp(buffer, { failOn: 'error', limitInputPixels: env.MAX_IMAGE_PIXELS });
}

export const imageOptimizationService = {
  isImage(mimeType: string) { return imageMimeTypes.has(mimeType); },
  async inspect(buffer: Buffer) {
    const metadata = await pipeline(buffer).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Image dimensions could not be determined');
    if (metadata.width * metadata.height > env.MAX_IMAGE_PIXELS) throw new Error('Image dimensions exceed the configured safety limit');
    return { width: metadata.width, height: metadata.height };
  },
  async optimize(fileId: string) {
    const original = await formsRepository.findFile(fileId);
    if (!original || !original.storageKey || !original.mimeType || !this.isImage(original.mimeType) || original.originalFileId) return;
    await formsRepository.updateFileOptimization(fileId, 'PROCESSING');
    try {
      const source = await fileStorageService.read(original.storageKey);
      const dimensions = await this.inspect(source);
      for (const spec of variants) {
        const optimized = await pipeline(source).rotate().resize({ width: spec.width, withoutEnlargement: true }).webp({ quality: spec.quality, effort: 4 }).toBuffer({ resolveWithObject: true });
        const buffer = optimized.data;
        const stored = await fileStorageService.writeBuffer(original.patientId, buffer, 'image/webp');
        try {
          await formsRepository.upsertDerivedFile({
            patientId: original.patientId,
            sessionId: original.sessionId ?? undefined,
            invoiceId: original.invoiceId ?? undefined,
            encounterId: original.encounterId ?? undefined,
            procedureSessionId: original.procedureSessionId ?? undefined,
            appointmentId: original.appointmentId ?? undefined,
            category: original.category,
            fileType: original.fileType,
            name: `${path.parse(original.name).name}-${spec.variant.toLowerCase()}.webp`,
            originalFilename: `${path.parse(original.originalFilename ?? original.name).name}-${spec.variant.toLowerCase()}.webp`,
            storageKey: stored.storageKey,
            url: `secure://${stored.storageKey}`,
            mimeType: 'image/webp',
            sizeBytes: stored.sizeBytes,
            checksum: stored.checksum,
            uploadedById: original.uploadedById ?? undefined,
            clinicalUsePermission: original.clinicalUsePermission,
            marketingPermission: original.marketingPermission,
            visibility: original.visibility,
            photoAngle: original.photoAngle ?? undefined,
            treatmentArea: original.treatmentArea ?? undefined,
            visitDate: original.visitDate ?? undefined,
            annotation: original.annotation ?? undefined,
            originalFileId: original.id,
            variant: spec.variant,
            width: optimized.info.width,
            height: optimized.info.height,
            optimizationStatus: 'READY',
          });
        } catch (error) {
          await fileStorageService.delete(stored.storageKey).catch(() => undefined);
          throw error;
        }
      }
      await formsRepository.updateFileOptimization(fileId, 'READY', dimensions);
    } catch (error) {
      await formsRepository.updateFileOptimization(fileId, 'FAILED');
      throw error;
    }
  },
};
