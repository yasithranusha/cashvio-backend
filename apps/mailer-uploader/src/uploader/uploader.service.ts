import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { S3_FOLDERS, S3FolderType } from './constants/s3-folders';

@Injectable()
export class UploaderService {
  private readonly logger = new Logger(UploaderService.name);
  private readonly s3Client: S3Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_S3_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_KEY'),
      },
    });
    this.bucketName = this.configService.get<string>('AWS_BUCKET_NAME');
  }

  async uploadFile(
    file: any,
    folder: S3FolderType = S3_FOLDERS.IMAGES,
    subFolder?: string,
  ): Promise<string> {
    try {
      // Validate folder
      if (!Object.values(S3_FOLDERS).includes(folder as S3_FOLDERS)) {
        folder = S3_FOLDERS.IMAGES;
      }

      // Sanitize subFolder
      const sanitizedSubFolder = subFolder
        ? subFolder
            .replace(/([^a-zA-Z0-9\-_/])/g, '') // Allow forward slashes
            .replace(/(^\/+|\/+$)/g, '') // Remove leading/trailing slashes
            .replace(/(\/+)/g, '/') // Replace multiple slashes with single
        : '';

      const timestamp = Date.now();
      const uuid = uuidv4();
      const originalName = path
        .parse(file.originalname)
        .name.replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
      const extension = path.extname(file.originalname);

      // Construct key with optional subFolder
      let key;
      if (sanitizedSubFolder) {
        key = `${folder}/${sanitizedSubFolder}/${timestamp}-${originalName}-${uuid}${extension}`;
      } else {
        key = `${folder}/${timestamp}-${originalName}-${uuid}${extension}`;
      }

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      const fileUrl = `${key}`;
      this.logger.log(`File uploaded successfully: ${fileUrl}`);
      return fileUrl;
    } catch (error) {
      this.logger.error(`Error uploading file: ${error.message}`, error.stack);
      throw error;
    }
  }

  async uploadFiles(
    files: any[],
    folder: S3FolderType = S3_FOLDERS.IMAGES,
    subFolder?: string,
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map((file) =>
        this.uploadFile(file, folder, subFolder),
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      this.logger.error(`Error uploading files: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      this.logger.log(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file: ${error.message}`, error.stack);
      throw error;
    }
  }
}
