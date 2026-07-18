import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

const storage = diskStorage({
  destination: process.env.UPLOADS_DIR || join(process.cwd(), 'uploads'),
  filename: (_, file, cb) => {
    // Never reuse the user-provided extension. It can make a forged upload be
    // served as HTML by the static server even when its claimed MIME type is an image.
    const extension = EXTENSION_BY_MIME[file.mimetype];
    cb(null, `${randomBytes(16).toString('hex')}${extension}`);
  },
});

@Controller('upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file', {
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('Formato não suportado. Use JPG, PNG, WEBP ou MP4/WEBM'), false);
      }
      cb(null, true);
    },
  }))
  upload(@UploadedFile() file: { filename: string; mimetype: string; size: number }) {
    const baseUrl = process.env.API_URL || 'http://localhost:3001';
    return { url: `${baseUrl}/uploads/${file.filename}` };
  }
}
