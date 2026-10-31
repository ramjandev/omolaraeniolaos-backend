import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface StoredMedia {
  url: string;
  mediaKind: 'image' | 'video' | 'audio' | 'file';
  fileName: string;
}

@Injectable()
export class CloudinaryService {
  async upload(file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<StoredMedia> {
    const cloud = process.env.CLOUDINARY_CLOUD_NAME || '';
    const secret = process.env.CLOUDINARY_API_SECRET || '';
    const apiKey = process.env.CLOUDINARY_API_KEY || '';
    const preset = process.env.CLOUDINARY_UPLOAD_PRESET || 'ml_default';
    if (!cloud) {
      throw new BadRequestException('Cloudinary cloud name is not configured');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Choose a file to upload');
    }

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' }), file.originalname || 'upload');

    if (apiKey && secret) {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHash('sha1')
        .update(`folder=mceniesvite&timestamp=${timestamp}${secret}`)
        .digest('hex');
      form.append('api_key', apiKey);
      form.append('timestamp', timestamp);
      form.append('signature', signature);
      form.append('folder', 'mceniesvite');
    } else {
      form.append('upload_preset', preset);
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
      method: 'POST',
      body: form,
    });
    const json = (await response.json().catch(() => ({}))) as {
      secure_url?: string;
      resource_type?: string;
      error?: { message?: string };
    };
    if (!response.ok || !json.secure_url) {
      const raw = json.error?.message || '';
      if (!apiKey && /preset|unsigned|api_key/i.test(raw)) {
        throw new BadRequestException(
          'Cloudinary needs the numeric API key before photos, video, and voice notes can upload.',
        );
      }
      throw new BadRequestException(raw || 'The file could not be uploaded');
    }

    return {
      url: json.secure_url,
      mediaKind: this.kind(file.mimetype, json.resource_type),
      fileName: file.originalname || 'file',
    };
  }

  private kind(mime: string, resourceType?: string): StoredMedia['mediaKind'] {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime.startsWith('video/')) return 'video';
    if (resourceType === 'image') return 'image';
    if (resourceType === 'video') return 'video';
    return 'file';
  }
}

