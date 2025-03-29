import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { S3_FOLDERS } from '../constants/s3-folders';

export class UploadFileDto {
  @IsEnum(S3_FOLDERS)
  @IsOptional()
  folder?: string = S3_FOLDERS.IMAGES;

  @IsString()
  @IsOptional()
  subFolder?: string;
}

export class DeleteFileDto {
  @IsNotEmpty({ message: 'Key is required' })
  key: string | string[];
}
