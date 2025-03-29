import {
  Controller,
  Post,
  Delete,
  UseInterceptors,
  UploadedFiles,
  Query,
  BadRequestException,
  Logger,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploaderService } from './uploader.service';
import { S3_FOLDERS } from './constants/s3-folders';
import { DeleteFileDto, UploadFileDto } from './dto/file.dto';

@Controller('upload')
export class UploaderController {
  private readonly logger = new Logger(UploaderController.name);

  constructor(private readonly uploaderService: UploaderService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10)) // Allow up to 10 files
  async uploadFiles(
    @UploadedFiles() files: any[],
    @Query() query: UploadFileDto,
  ) {
    this.logger.debug(
      `Upload request received for ${files?.length || 0} files`,
    );

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const folder = query.folder || S3_FOLDERS.IMAGES;
    const subFolder = query.subFolder;

    try {
      const urls = await this.uploaderService.uploadFiles(
        files,
        folder,
        subFolder,
      );
      return { urls };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete()
  async deleteFile(@Body() deleteFileDto: DeleteFileDto) {
    try {
      if (Array.isArray(deleteFileDto.key)) {
        // Handle multiple keys
        this.logger.debug(
          `Delete request received for ${deleteFileDto.key.length} files`,
        );
        const deletePromises = deleteFileDto.key.map((key) =>
          this.uploaderService.deleteFile(key),
        );
        await Promise.all(deletePromises);
        return {
          message: `${deleteFileDto.key.length} files deleted successfully`,
        };
      } else {
        // Handle single key
        this.logger.debug(
          `Delete request received for file: ${deleteFileDto.key}`,
        );
        await this.uploaderService.deleteFile(deleteFileDto.key);
        return { message: 'File deleted successfully' };
      }
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
