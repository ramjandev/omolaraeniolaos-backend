import {
  BadRequestException,
  Controller,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import { CloudinaryService } from './cloudinary.service';

const ALLOWED = /^(image|video|audio)\//i;

@ApiTags('07 Shared Organizer / Communications')
@Controller('uploads')
export class UploadsController {
  constructor(@Inject(CloudinaryService) private readonly cloudinary: CloudinaryService) {}

  @Post()
  @ResponseMessage('File uploaded')
  @ApiOperation({ summary: 'Upload a chat or profile file to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(@UploadedFile() file?: { buffer: Buffer; mimetype: string; originalname: string; size: number }) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    const allowed = ALLOWED.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (!allowed) {
      throw new BadRequestException('Upload an image, video, audio file, or PDF');
    }
    return this.cloudinary.upload(file);
  }
}
